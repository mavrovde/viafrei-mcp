#!/usr/bin/env node
/**
 * The publish verifier's self-test. Hermetic: `fetch` and `sleep` are injected, the
 * registry is a table of answers, and no request leaves this process.
 *
 * Pinned: a version visible only on a later read passes (publication is asynchronous), and so do
 * a dist-tag and a tarball that become visible later still, all three inside ONE shared deadline
 * (the total time waited never exceeds it, so the verifier ends inside the job's timeout);
 * one that never appears fails with a TIMEOUT message rather than "not published"; each
 * asserted property fails on its own when it does not hold (another version's document,
 * latest elsewhere, no provenance, another repository, a tarball not served); and every
 * registry read carries both cache defeats, because a verifier reading a cached 404 or a
 * cached old packument is the failure this script exists to avoid.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyPublished } from './verify-published.mjs';

const NAME = 'viafrei';
const V = '9.9.9';
const REPO = 'mavrovde/viafrei-mcp';
const TARBALL = `https://registry.npmjs.org/${NAME}/-/${NAME}-${V}.tgz`;

const goodDoc = () => ({
  version: V,
  repository: { url: `git+https://github.com/${REPO}.git` },
  dist: { tarball: TARBALL, attestations: { url: 'x', provenance: {} } },
});

/** A registry stub: `visibleFrom` is the read on which the version document appears. */
// `versionThrowsUntil`: version reads before this one throw (a network error); `latestBadJson`: the packument's body is not JSON.
function registry({ doc = goodDoc(), latest = V, visibleFrom = 1, tarballStatus = 200, latestFrom = 1, tarballFrom = 1,
  versionThrowsUntil = 0, latestBadJson = false, allThrow = false } = {}) {
  const calls = [];
  let versionReads = 0;
  let latestReads = 0;
  let tarballReads = 0;
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (allThrow) throw new TypeError('fetch failed');
    const bare = url.split('?')[0];
    const res = (status, body) => ({ status, json: async () => body });
    if (bare === `https://registry.npmjs.org/${NAME}/${V}`) {
      versionReads += 1;
      if (versionReads < versionThrowsUntil) throw new TypeError('fetch failed');
      return versionReads >= visibleFrom ? res(200, doc) : res(404, {});
    }
    if (bare === `https://registry.npmjs.org/${NAME}`) {
      latestReads += 1;
      if (latestBadJson) return { status: 200, json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); } };
      return res(200, { 'dist-tags': { latest: latestReads >= latestFrom ? latest : '9.9.8' } });
    }
    if (bare === TARBALL) {
      tarballReads += 1;
      return res(tarballReads >= tarballFrom ? tarballStatus : 404, null);
    }
    return res(500, {});
  };
  return { fetch, calls };
}

const run = (reg, extra = {}) =>
  verifyPublished({ name: NAME, version: V, repo: REPO, deadlineMs: 20_000, intervalMs: 5_000,
    fetch: reg.fetch, sleep: async () => {}, log: () => {}, ...extra });

let passed = 0;
let failed = 0;
async function t(label, fn) {
  try { await fn(); passed += 1; console.log(`  ✓ ${label}`); }
  catch (e) { failed += 1; console.log(`  ✗ ${label}\n    ${e.message}`); }
}

await t('a publish visible on the 3rd read passes', async () => {
  const r = await run(registry({ visibleFrom: 3 }));
  assert.equal(r.ok, true, r.failures.join('; '));
  assert.equal(r.reads, 3);
});

await t('a publish that never appears fails as a TIMEOUT, not as "not published"', async () => {
  const r = await run(registry({ visibleFrom: 99 }));
  assert.equal(r.ok, false);
  assert.match(r.failures[0], /not visible within 20 s/);
  assert.match(r.failures[0], /timeout, not proof it was never published/);
});

await t('a document about another version fails', async () => {
  const r = await run(registry({ doc: { ...goodDoc(), version: '9.9.8' } }));
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => /about 9\.9\.8, not 9\.9\.9/.test(f)), r.failures.join('; '));
});

await t('latest pointing elsewhere fails', async () => {
  const r = await run(registry({ latest: '9.9.8' }));
  assert.ok(r.failures.some((f) => /dist-tags\.latest is 9\.9\.8/.test(f)), r.failures.join('; '));
});

await t('absent provenance fails', async () => {
  const d = goodDoc(); delete d.dist.attestations;
  const r = await run(registry({ doc: d }));
  assert.ok(r.failures.some((f) => /not published with provenance/.test(f)), r.failures.join('; '));
});

await t('a repository.url naming another repository fails', async () => {
  const r = await run(registry({ doc: { ...goodDoc(), repository: { url: 'git+https://github.com/someone/else.git' } } }));
  assert.ok(r.failures.some((f) => /repository\.url is git\+https:\/\/github\.com\/someone\/else\.git/.test(f)), r.failures.join('; '));
});

await t('a tarball that is not served fails', async () => {
  const r = await run(registry({ tarballStatus: 404 }));
  assert.ok(r.failures.some((f) => /answered HTTP 404/.test(f)), r.failures.join('; '));
});

await t('a tarball on another host is refused and never fetched', async () => {
  const reg = registry({ doc: { ...goodDoc(), dist: { ...goodDoc().dist, tarball: 'https://example.invalid/viafrei.tgz' } } });
  const r = await run(reg);
  assert.ok(r.failures.some((f) => /dist\.tarball is not on https:\/\/registry\.npmjs\.org/.test(f)), r.failures.join('; '));
  assert.ok(!reg.calls.some((c) => c.url.startsWith('https://example.invalid')), 'the foreign tarball was fetched');
});

await t('every registry read defeats both caches', async () => {
  const reg = registry({ visibleFrom: 2 });
  await run(reg);
  const reads = reg.calls.filter((c) => !c.url.startsWith(TARBALL));
  assert.ok(reads.length >= 3);
  for (const c of reads) {
    assert.match(c.url, /\?nocache=/, `no unique query on ${c.url}`);
    assert.equal(c.init.headers?.['cache-control'], 'no-cache', `no no-cache header on ${c.url}`);
  }
  const queries = new Set(reads.map((c) => c.url));
  assert.equal(queries.size, reads.length, 'two reads shared a query string');
});

await t('every tarball HEAD defeats both caches too', async () => {
  const reg = registry({ tarballFrom: 3 });
  await run(reg);
  const heads = reg.calls.filter((c) => c.url.startsWith(TARBALL));
  assert.ok(heads.length >= 3, `only ${heads.length} tarball reads`);
  for (const c of heads) {
    assert.equal(c.init.method, 'HEAD');
    assert.match(c.url, /\?nocache=/, `no unique query on ${c.url}`);
    assert.equal(c.init.headers?.['cache-control'], 'no-cache', `no no-cache header on ${c.url}`);
  }
  assert.equal(new Set(heads.map((c) => c.url)).size, heads.length, 'two tarball reads shared a query string');
});

await t('every read is bounded by its own timeout signal', async () => {
  const reg = registry({ visibleFrom: 2, tarballFrom: 2 });
  await run(reg);
  assert.ok(reg.calls.length >= 4);
  for (const c of reg.calls) assert.ok(c.init.signal instanceof AbortSignal, `no timeout signal on ${c.url}`);
});

/** A registry that never answers: each read resolves only when its own abort signal fires. */
function hangingRegistry() {
  const aborted = [];
  const fetch = (url, init = {}) => new Promise((_, reject) => {
    if (!init.signal) return; // a read without a signal hangs for ever, and the test's own guard catches it
    init.signal.addEventListener('abort', () => { aborted.push(url); reject(init.signal.reason); }, { once: true });
  });
  return { fetch, aborted };
}

await t('the read timeout fires: a registry that never answers ends in "no answer within", and every read was aborted', async () => {
  const reg = hangingRegistry();
  const guard = new Promise((_, reject) => setTimeout(() => reject(new Error('the run did not end: a read was never aborted')), 5_000));
  const r = await Promise.race([
    verifyPublished({ name: NAME, version: V, repo: REPO, deadlineMs: 10_000, intervalMs: 5_000, readTimeoutMs: 25,
      fetch: reg.fetch, sleep: async () => {}, log: () => {} }),
    guard,
  ]);
  assert.equal(r.ok, false);
  assert.match(r.failures[0], /The last read failed: no answer within 0\.025 s\./);
  assert.equal(reg.aborted.length, r.reads, `${r.reads} reads, ${reg.aborted.length} aborted`);
});

await t('a failed read followed by plain 404s does not blame "the last read"', async () => {
  const r = await run(registry({ versionThrowsUntil: 2, visibleFrom: 99 }));
  assert.equal(r.ok, false);
  assert.match(r.failures[0], /not visible within 20 s/);
  assert.doesNotMatch(r.failures[0], /last read failed/);
});

await t('a read that throws is retried under the same budget, and the run still passes', async () => {
  const r = await run(registry({ versionThrowsUntil: 3 }));
  assert.equal(r.ok, true, r.failures.join('; '));
  assert.equal(r.reads, 3);
});

await t('a registry that always throws ends in a named failure, never an unhandled rejection', async () => {
  const r = await run(registry({ allThrow: true }));
  assert.equal(r.ok, false);
  assert.match(r.failures[0], /not visible within 20 s \(5 reads\)\. The last read failed: fetch failed\./);
});

await t('a packument whose body is not JSON fails by name and is retried, not thrown', async () => {
  const r = await run(registry({ latestBadJson: true }));
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => /dist-tags\.latest is not 9\.9\.9: still a failed read \(Unexpected token/.test(f)), r.failures.join('; '));
});

// npm shows the version document, the dist-tag and the tarball at different moments (the v2.3.2 run saw the document,
// then latest still on the previous release and the tarball 404, all three fine minutes later).
const staggered = () => registry({ visibleFrom: 1, latestFrom: 3, tarballFrom: 5 });

// Time is shared: latest's reads 1-3 take 0, 5 and 10 s; the tarball's reads 1-5 then take 10 to 30 s.
await t('document on read 1, latest on read 3, tarball on read 5: passes inside a 30 s deadline', async () => {
  const r = await run(staggered(), { deadlineMs: 30_000 });
  assert.equal(r.ok, true, r.failures.join('; '));
});

await t('the same registry with a deadline shorter than read 5 fails and names the tarball and what it last saw', async () => {
  const r = await run(staggered(), { deadlineMs: 25_000 });
  assert.equal(r.ok, false);
  assert.equal(r.failures.length, 1, r.failures.join('; '));
  assert.match(r.failures[0], /the tarball https:\/\/registry\.npmjs\.org\/viafrei\/-\/viafrei-9\.9\.9\.tgz is not served: still answered HTTP 404 after 4 read\(s\) within 25 s/);
});

/** Run with a sleep that adds up what it was asked to wait. */
async function timed(verify, reg, deadlineMs) {
  let slept = 0;
  const r = await verify({ name: NAME, version: V, repo: REPO, deadlineMs, intervalMs: 5_000,
    fetch: reg.fetch, sleep: async (ms) => { slept += ms; }, log: () => {} });
  return { r, slept };
}
const neverSettles = () => registry({ visibleFrom: 3, latestFrom: 99, tarballFrom: 99 });

await t('the three polls share ONE deadline: a registry that never settles waits at most the deadline in total', async () => {
  const { r, slept } = await timed(verifyPublished, neverSettles(), 20_000);
  assert.equal(r.ok, false);
  assert.ok(slept <= 20_000, `waited ${slept / 1000} s in total against a 20 s deadline`);
  assert.equal(r.failures.length, 2, r.failures.join('; '));
});

await t('the guard on the guard: a verifier that gives each poll its own deadline waits past it and is caught', async () => {
  const src = readFileSync(new URL('./verify-published.mjs', import.meta.url), 'utf8');
  const mutant = src.replace("let seen = '(no read)';", "let seen = '(no read)';\n  ctx.spent = 0;");
  assert.notEqual(mutant, src, 'the mutant changed nothing');
  const dir = mkdtempSync(join(tmpdir(), 'verify-mutant-'));
  writeFileSync(join(dir, 'verify-published.mjs'), mutant);
  const { verifyPublished: mutated } = await import(join(dir, 'verify-published.mjs'));
  const { slept } = await timed(mutated, neverSettles(), 20_000);
  assert.ok(slept > 20_000, `the per-poll mutant waited only ${slept / 1000} s, so the shared-deadline test could not tell it apart`);
});

await t('latest still elsewhere at the deadline names what was last seen', async () => {
  const r = await run(registry({ latestFrom: 99 }));
  assert.ok(r.failures.some((f) => /dist-tags\.latest is not 9\.9\.9: still dist-tags\.latest is 9\.9\.8 after 5 read\(s\)/.test(f)), r.failures.join('; '));
});

await t('the guard on the guard: a verifier that reads latest ONCE fails the staggered registry', async () => {
  const src = readFileSync(new URL('./verify-published.mjs', import.meta.url), 'utf8');
  const mutant = src.replace(/return pollProperty\(ctx, `dist-tags\.latest[^]*?\n  \}\);\n/, (m) => m.replace('return pollProperty(ctx,', 'return pollOnce(ctx,'))
    + '\nasync function pollOnce(ctx, what, probe) { const r = await probe(); return r.ok ? [] : [`${what}: ${r.seen}`]; }\n';
  assert.match(mutant, /return pollOnce\(ctx, `dist-tags/, 'the mutation did not reach the latest read');
  const dir = mkdtempSync(join(tmpdir(), 'verify-mutant-'));
  writeFileSync(join(dir, 'verify-published.mjs'), mutant);
  const { verifyPublished: mutated } = await import(join(dir, 'verify-published.mjs'));
  const reg = staggered();
  const r = await mutated({ name: NAME, version: V, repo: REPO, deadlineMs: 20_000, intervalMs: 5_000, fetch: reg.fetch, sleep: async () => {}, log: () => {} });
  assert.equal(r.ok, false, 'the single-read mutant passed the staggered registry');
});

console.log(`\nverify-published self-test: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
