#!/usr/bin/env node
// Did that publish land? Read the registry until the version is served, then
// assert what a user of `npx viafrei@X.Y.Z` depends on.
//
// `npm publish` exiting 0 is not the answer: publication is asynchronous, the
// registry answers 404 for a while after it, and both npm's CDN and the npm
// client cache stale documents. So every read here defeats both caches (a
// `no-cache` header AND a unique query string), never uses the npm client, and
// polls with a DEADLINE. One negative read is "not visible yet", never "not
// published"; only the deadline turns it into a failure, and the message says so.
// npm makes the version document, `dist-tags.latest` and the tarball visible at
// DIFFERENT moments, so each of the three is polled, and all three share ONE
// deadline for the time spent WAITING between reads: the wait for the document
// is not given back to the dist-tag. Each read has its own timeout
// (readTimeoutMs, default READ_TIMEOUT_MS), so a run lasts at most the deadline plus one read timeout
// per read. A property still negative when the deadline passes fails with what
// was last seen. A read that throws (a network error, a timeout, a body that is
// not JSON) counts as a negative read and is retried under the same budget;
// it never ends the run with an unhandled rejection.
//
// Asserted, each a failure when it does not hold:
//   - the version document exists and is about THIS version;
//   - dist-tags.latest is this version (a release here is always the latest);
//   - dist.attestations is present (published with provenance);
//   - repository.url names the repository this workflow runs in;
//   - the tarball itself is served (an HTTP 200 on dist.tarball).
//
// Usage: node scripts/verify-published.mjs <name> <version> <owner/repo> [deadlineSeconds]

import { randomUUID } from 'node:crypto';

const REGISTRY = 'https://registry.npmjs.org';
/** One read may take this long before it is abandoned and counted as a negative read. */
export const READ_TIMEOUT_MS = 15_000;

/**
 * @param {{name: string, version: string, repo: string, deadlineMs?: number, intervalMs?: number, readTimeoutMs?: number,
 *          fetch?: typeof fetch, sleep?: (ms: number) => Promise<void>, log?: (s: string) => void}} o
 * @returns {Promise<{ok: boolean, failures: string[], reads: number}>}
 */
export async function verifyPublished(o) {
  const ctx = {
    fetchFn: o.fetch ?? fetch,
    sleep: o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    log: o.log ?? ((s) => console.log(s)),
    deadline: o.deadlineMs ?? 300_000,
    interval: o.intervalMs ?? 5_000,
    readTimeout: o.readTimeoutMs ?? READ_TIMEOUT_MS,
    // Milliseconds waited so far, across every poll: the one budget all three share.
    spent: 0,
  };
  const { doc, reads, lastError } = await pollVersion(ctx, o.name, o.version);
  if (!doc) {
    const why = lastError ? ` The last read failed: ${lastError}.` : '';
    return { ok: false, reads, failures: [`${o.name}@${o.version} was not visible within ${Math.round(ctx.deadline / 1000)} s (${reads} reads).${why} That is a timeout, not proof it was never published: check the registry again before re-tagging.`] };
  }
  ctx.log(`${o.name}@${o.version} is on the registry (after ${reads} read(s))`);
  const failures = [...checkDocument(doc, o), ...(await checkLatest(ctx, o)), ...(await checkTarball(ctx, doc))];
  return { ok: failures.length === 0, failures, reads };
}

/** A GET that defeats both caches (a no-cache header and a unique query string), bounded by the read timeout. */
function freshGet(ctx, url) {
  return ctx.fetchFn(`${url}?nocache=${randomUUID()}`, {
    headers: { 'cache-control': 'no-cache', accept: 'application/json' },
    signal: AbortSignal.timeout(ctx.readTimeout),
  });
}

/** What a thrown read says, in one line. */
function describeError(ctx, e) {
  return e?.name === 'TimeoutError' ? `no answer within ${ctx.readTimeout / 1000} s` : String(e?.message ?? e).split('\n')[0];
}

/** Sleep one interval if the shared deadline still allows it; false when it does not. */
async function wait(ctx) {
  if (ctx.spent + ctx.interval > ctx.deadline) return false;
  await ctx.sleep(ctx.interval);
  ctx.spent += ctx.interval;
  return true;
}

/** Poll the version document until it answers 200 or the deadline passes. */
async function pollVersion(ctx, name, version) {
  let reads = 0;
  let lastError = null;
  for (;;) {
    reads += 1;
    // Sequential on purpose: each read waits for the previous one and the interval.
    try {
      const r = await freshGet(ctx, `${REGISTRY}/${name}/${version}`);
      if (r.status === 200) return { doc: await r.json(), reads, lastError: null };
      lastError = null;
      if (r.status !== 404) ctx.log(`read ${reads}: HTTP ${r.status} (retrying)`);
    } catch (e) {
      lastError = describeError(ctx, e);
      ctx.log(`read ${reads}: ${lastError} (retrying)`);
    }
    if (!(await wait(ctx))) break;
  }
  return { doc: null, reads, lastError };
}

function checkDocument(doc, o) {
  const failures = [];
  if (doc.version !== o.version) failures.push(`the registry answered a document about ${doc.version}, not ${o.version}`);
  if (!doc.dist?.attestations) failures.push('dist.attestations is absent: the version was not published with provenance');
  const want = `git+https://github.com/${o.repo}.git`;
  if (doc.repository?.url !== want) failures.push(`repository.url is ${doc.repository?.url ?? '(absent)'}, not ${want}`);
  return failures;
}

/**
 * Poll one property until `probe` answers `{ ok: true }` or the deadline passes. Each read is fresh (both cache
 * defeats are in `probe`); the failure names the property and what the last read saw.
 */
async function pollProperty(ctx, what, probe) {
  let reads = 0;
  let seen = '(no read)';
  for (;;) {
    reads += 1;
    // Sequential on purpose: each read waits for the previous one and the interval.
    let r;
    try {
      r = await probe();
    } catch (e) {
      r = { ok: false, seen: `a failed read (${describeError(ctx, e)})` };
    }
    if (r.ok) return [];
    seen = r.seen;
    if (!(await wait(ctx))) break;
  }
  return [`${what}: still ${seen} after ${reads} read(s) within ${Math.round(ctx.deadline / 1000)} s`];
}

async function checkLatest(ctx, o) {
  return pollProperty(ctx, `dist-tags.latest is not ${o.version}`, async () => {
    const packument = await freshGet(ctx, `${REGISTRY}/${o.name}`);
    const latest = packument.status === 200 ? (await packument.json())['dist-tags']?.latest : undefined;
    return { ok: latest === o.version, seen: `dist-tags.latest is ${latest ?? `(unreadable, HTTP ${packument.status})`}` };
  });
}

/** HEAD the tarball — only ever on the registry itself, never a host a document names. */
async function checkTarball(ctx, doc) {
  const tarball = doc.dist?.tarball;
  if (!tarball) return ['dist.tarball is absent'];
  if (!tarball.startsWith(`${REGISTRY}/`)) return [`dist.tarball is not on ${REGISTRY}: ${tarball}`];
  return pollProperty(ctx, `the tarball ${tarball} is not served`, async () => {
    const t = await ctx.fetchFn(`${tarball}?nocache=${randomUUID()}`, { method: 'HEAD', headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(ctx.readTimeout) });
    return { ok: t.status === 200, seen: `answered HTTP ${t.status}` };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [name, version, repo, secs] = process.argv.slice(2);
  if (!name || !/^\d+\.\d+\.\d+$/.test(version ?? '') || !/^[\w.-]+\/[\w.-]+$/.test(repo ?? '')) {
    console.error('usage: node scripts/verify-published.mjs <name> <X.Y.Z> <owner/repo> [deadlineSeconds]');
    process.exit(2);
  }
  const res = await verifyPublished({ name, version, repo, deadlineMs: (Number(secs) || 300) * 1000 });
  for (const f of res.failures) console.error(`✗ ${f}`);
  if (res.ok) console.log(`verify: PASSED — ${name}@${version}: latest, provenance, repository, tarball served`);
  process.exit(res.ok ? 0 : 1);
}
