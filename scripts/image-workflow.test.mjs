#!/usr/bin/env node
/**
 * The container image release, read from the files it runs and proved able to say no:
 *   - every `uses:` in every workflow is pinned by a full 40-hex commit SHA (a tag or a
 *     short SHA can be moved under a release); the checker itself refuses `@v4`, a
 *     39-hex SHA, a branch, and a `docker://` image without a digest;
 *   - image.yml's jobs run in the order gate → server tests → publish → verify → tag,
 *     each `needs` the one before, and every job ends within 15 minutes (the repository's
 *     own timeout gate, faultsOf, read on this file, and proved to refuse 16);
 *   - the gate takes an annotated vX.Y.Z tag on main equal to both package.json
 *     versions and CI green on that commit (scripts/ci-gate.mjs, its refusals below);
 *   - Trivy fails on HIGH or CRITICAL and runs before the push; the push is by digest
 *     only; cosign verify pins the certificate identity to image.yml on a release tag
 *     and to the gate's commit; the version tag is written only in the tag job, after
 *     verify; the verify job runs the digest through scripts/image-smoke.sh, which runs
 *     it as uid 10001 with a read-only root file system and probes /healthz;
 *   - server/Dockerfile: both stages on one base pinned by digest, uid 10001, npm
 *     removed, runtime only (no test, mock or env file in the context).
 * Offline: files on disk only.
 *
 *   node scripts/image-workflow.test.mjs        exit 0 when every case passes
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChecker } from './check-harness.mjs';
import { faultsOf, MAX_MINUTES } from './check-timeouts.mjs';
import { judgeCi, runsOf } from './ci-gate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WF = join(ROOT, '.github', 'workflows');
const { check, failures, passed } = createChecker();
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** Every `uses:` reference of a workflow text that is not pinned by a full commit SHA (or a digest). */
export function unpinned(text) {
    const out = [];
    for (const m of text.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)/gmu)) {
        const ref = m[1].replace(/^['"]|['"]$/gu, '');
        if (ref.startsWith('./')) continue;
        if (ref.startsWith('docker://')) {
            if (!/@sha256:[0-9a-f]{64}$/u.test(ref)) out.push(ref);
            continue;
        }
        if (!/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/u.test(ref)) out.push(ref);
    }
    return out;
}

console.log('every action pinned by its full commit SHA');
{
    const files = readdirSync(WF).filter((f) => /\.ya?ml$/u.test(f));
    check('the workflows are read (at least image.yml and ten others)', files.includes('image.yml') && files.length >= 10, files.join(' '));
    for (const f of files) {
        const bad = unpinned(readFileSync(join(WF, f), 'utf8'));
        check(`${f}: every uses: is pinned`, bad.length === 0, bad.join(', '));
    }
    const sha = '3d3c42e5aac5ba805825da76410c181273ba90b1';
    for (const [label, line] of [
        ['a major tag', '      - uses: actions/checkout@v4'],
        ['a 39-hex SHA', `      - uses: actions/checkout@${sha.slice(1)}`],
        ['a branch', '    uses: actions/checkout@main'],
        ['no ref at all', '      - uses: actions/checkout'],
        ['a docker image by tag', '      - uses: docker://alpine:3.24'],
    ]) check(`the pin check refuses ${label}`, unpinned(`steps:\n${line}\n`).length === 1);
    check('the pin check passes a full SHA and a local workflow', unpinned(`      - uses: actions/checkout@${sha} # v7\n    uses: ./.github/workflows/server.yml\n`).length === 0);
}

const yml = read('.github/workflows/image.yml');
/** One job's text: from its header to the next job's. */
const jobOf = (id) => {
    const m = new RegExp(`^ {2}${id}:\\n((?: {4}.*\\n|\\n)*)`, 'mu').exec(yml);
    return m?.[1] ?? '';
};
const order = ['gate', 'server', 'publish', 'verify', 'tag'];

console.log('image.yml: the order, the bounds');
{
    const at = order.map((id) => yml.search(new RegExp(`^ {2}${id}:$`, 'mu')));
    check('the jobs are gate, server, publish, verify, tag, in that order', at.every((p, i) => p >= 0 && (i === 0 || p > at[i - 1])), at.join(','));
    check('server needs the gate and calls server.yml', /\n {4}needs: gate\n/u.test(jobOf('server')) && /\n {4}uses: \.\/\.github\/workflows\/server\.yml\n/u.test(jobOf('server')));
    check('publish needs the gate and the server tests', /\n {4}needs: \[gate, server\]\n/u.test(jobOf('publish')));
    check('verify needs publish', /\n {4}needs: \[gate, publish\]\n/u.test(jobOf('verify')));
    check('tag needs verify', /\n {4}needs: \[gate, publish, verify\]\n/u.test(jobOf('tag')));
    check('no job is skipped past a failure (no always() or !cancelled() anywhere)', !/always\(\)|!cancelled\(\)/u.test(yml));
    check(`every job of image.yml ends within ${String(MAX_MINUTES)} min (the timeout gate)`, faultsOf('image.yml', yml).length === 0, faultsOf('image.yml', yml).join('; '));
    check('every job that runs steps names its timeout', order.filter((id) => id !== 'server').every((id) => /\n {4}timeout-minutes: \d+\n/u.test(jobOf(id))));
    check('the timeout gate refuses 16 on this file', faultsOf('image.yml', yml.replace('timeout-minutes: 15', 'timeout-minutes: 16')).length === 1);
    const serverWf = read('.github/workflows/server.yml');
    check('server.yml can be called (workflow_call)', /\n {2}workflow_call:\n/u.test(serverWf));
    check('server.yml bounds each of its jobs', faultsOf('server.yml', serverWf).length === 0);
}

console.log('image.yml: the gate');
{
    const gate = jobOf('gate');
    check('starts on a tag push or a dispatch only', /\non:\n {2}push:\n {4}tags: \['v\*'\]\n {2}workflow_dispatch:\n/u.test(yml) && !/pull_request|schedule/u.test(yml));
    check('the run must be on its tag, first', gate.indexOf('[[ $GITHUB_REF == "refs/tags/$TAG" ]]') > 0 && gate.indexOf('[[ $GITHUB_REF == "refs/tags/$TAG" ]]') < gate.indexOf('actions/checkout@'));
    check('a final vX.Y.Z only', gate.includes('[[ $TAG =~ ^v([0-9]+)\\.([0-9]+)\\.([0-9]+)$ ]] ||'));
    check('an annotated tag only', gate.includes('--jq .object.type) == tag ]]'));
    check('equal to both package.json versions', gate.includes('for f in package.json server/package.json; do') && gate.includes('[[ $pkg == "$version" ]] ||'));
    check('on main', gate.includes('git merge-base --is-ancestor "$TAG^{commit}" origin/main ||'));
    check('the tag names the run\'s commit', gate.includes('[[ $commit == "$GITHUB_SHA" ]] ||'));
    check('CI green on that commit, through ci-gate.mjs', gate.includes('node scripts/ci-gate.mjs "$SHA" "$GH_REPO" < "$RUNNER_TEMP/runs.json"'));
}

console.log('ci-gate.mjs: green only on a completed success of a trusted run on exactly the commit');
{
    const sha = 'a'.repeat(40);
    const repo = 'mavrovde/viafrei-mcp';
    const run = (o = {}) => ({ id: 1, path: '.github/workflows/ci.yml', head_sha: sha, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success', created_at: '2026-11-22T10:00:00Z', head_repository: { full_name: repo }, ...o });
    check('a push-to-main success is green', judgeCi([run()], sha, repo).ok);
    check('a dispatched success is green', judgeCi([run({ event: 'workflow_dispatch', head_branch: 'v2.7.0' })], sha, repo).ok);
    for (const [label, runs] of [
        ['no run', []],
        ['a failure', [run({ conclusion: 'failure' })]],
        ['a run still going', [run({ status: 'in_progress', conclusion: null })]],
        ['another commit', [run({ head_sha: 'b'.repeat(40) })]],
        ['a pull_request run', [run({ event: 'pull_request' })]],
        ['a push to another branch', [run({ head_branch: 'feature' })]],
        ['a fork', [run({ head_repository: { full_name: 'someone/viafrei-mcp' } })]],
        ['another workflow', [run({ path: '.github/workflows/snyk.yml' })]],
        ['an older success under a newer failure', [run({ id: 1 }), run({ id: 2, created_at: '2026-11-22T11:00:00Z', conclusion: 'failure' })]],
        ['the first attempt passed, the re-run failed', [run({ id: 1, run_attempt: 1 }), run({ id: 1, run_attempt: 2, conclusion: 'failure' })]],
    ]) check(`red on ${label}`, !judgeCi(runs, sha, repo).ok);
    check('red on a sha that is not 40-hex', !judgeCi([run()], 'v2.7.0', repo).ok);
    let threw = false;
    try { runsOf({ message: 'Bad credentials' }); } catch { threw = true; }
    check('a listing without workflow_runs is an error, never green', threw);
    check('the slurped pages are read together', runsOf([{ workflow_runs: [run()] }, { workflow_runs: [run({ id: 2 })] }]).length === 2);
}

console.log('image.yml: scan, push by digest, sign, verify, then tag');
{
    const publish = jobOf('publish');
    const trivy = publish.indexOf('aquasec/trivy:');
    const push = publish.indexOf('push-by-digest=true');
    check('Trivy is pinned by digest', /aquasec\/trivy:[\d.]+@sha256:[0-9a-f]{64}/u.test(publish));
    check('Trivy fails on HIGH and CRITICAL', /--exit-code 1 --severity HIGH,CRITICAL/u.test(publish));
    check('Trivy runs before the push and before the registry login', trivy > 0 && trivy < push && trivy < publish.indexOf('docker/login-action@'));
    check('the push is by digest only, for amd64 and arm64', push > 0 && publish.includes('platforms: linux/amd64,linux/arm64') && !/^\s+tags:\s*\$\{\{ env\.IMAGE/mu.test(publish));
    check('never a release twice: checked before the build and again before the tag', publish.includes('scripts/ghcr-not-released.sh "$IMAGE" "$VERSION"') && jobOf('tag').includes('scripts/ghcr-not-released.sh "$IMAGE" "$VERSION"'));
    check('signed keyless and attested (provenance, SPDX SBOM)', publish.includes('cosign sign --yes "$IMAGE@$DIGEST"') && publish.includes('actions/attest-build-provenance@') && publish.includes('cosign attest --yes --type spdxjson'));
    check('publish may write packages and mint an OIDC token; verify may not write', /packages: write/u.test(publish) && /id-token: write/u.test(publish) && !/write/u.test(jobOf('verify').split('steps:')[0]));
    const identity = /\n {2}IDENTITY: (.+)\n/u.exec(yml)?.[1] ?? '';
    check('the identity is THIS workflow on a release tag, anchored', identity === '^https://(?:github\\.com)/mavrovde/viafrei-mcp/\\.github/workflows/image\\.yml@refs/tags/v[0-9]+\\.[0-9]+\\.[0-9]+$', identity);
    const re = new RegExp(identity);
    check('the identity refuses another workflow, a branch and another repository', re.test('https://github.com/mavrovde/viafrei-mcp/.github/workflows/image.yml@refs/tags/v2.7.0')
        && !re.test('https://github.com/mavrovde/viafrei-mcp/.github/workflows/ci.yml@refs/tags/v2.7.0')
        && !re.test('https://github.com/mavrovde/viafrei-mcp/.github/workflows/image.yml@refs/heads/main')
        && !re.test('https://github.com/someone/viafrei-mcp/.github/workflows/image.yml@refs/tags/v2.7.0'));
    const verify = jobOf('verify');
    check('cosign verify pins the identity, the issuer and the gate\'s commit', verify.includes('cosign verify "$IMAGE@$DIGEST" --certificate-identity-regexp "$IDENTITY" --certificate-oidc-issuer "$ISSUER" --certificate-github-workflow-sha "$COMMIT"'));
    check('the SBOM attestation is verified under the same identity', verify.includes('cosign verify-attestation "$IMAGE@$DIGEST" --type spdxjson --certificate-identity-regexp "$IDENTITY"'));
    check('the published digest is run through the smoke, after verify', verify.indexOf('scripts/image-smoke.sh') > verify.indexOf('cosign verify "$IMAGE@$DIGEST"') && verify.includes('IMAGE_REF: ${{ env.IMAGE }}@${{ needs.publish.outputs.digest }}'));
    const tags = [...yml.matchAll(/imagetools create/gu)].length;
    check('the version tag is written once, in the tag job only', tags === 1 && jobOf('tag').includes('docker buildx imagetools create') && jobOf('tag').includes('tags=("$IMAGE:$VERSION")'));
    check('each tag is read back against the verified digest', jobOf('tag').includes('[[ $got == "$DIGEST" ]] ||'));
}

console.log('image-smoke.sh: non-root, read-only, /healthz');
{
    const smoke = read('scripts/image-smoke.sh');
    check('runs with a read-only root, uid 10001, no capabilities, no new privileges', smoke.includes('--read-only --tmpfs /tmp --user 10001:10001 --cap-drop ALL --security-opt no-new-privileges'));
    check('probes /healthz for 200', smoke.includes('"http://127.0.0.1:$port/healthz"') && smoke.includes('[[ $status == 200 ]] || fail'));
    check('asserts the uid and the read-only root from inside', smoke.includes('[[ $uid == 10001 ]] || fail') && smoke.includes("ReadonlyRootfs}}' \"$name\") == true ]] || fail"));
    check('asserts SIGTERM exits 143', smoke.includes('[[ $code == 143 ]] || fail'));
    check('removes only its own container', !/docker (rm|kill|stop)[^\n]*\$\(/u.test(smoke) && smoke.includes('name="viafrei-mcp-smoke-$$-$RANDOM"'));
}

console.log('server/Dockerfile: pinned, non-root, runtime only');
{
    const df = read('server/Dockerfile');
    const froms = [...df.matchAll(/^FROM (\S+)/gmu)].map((m) => m[1]);
    check('two stages on one base, pinned by digest', froms.length === 2 && froms[0] === froms[1] && /^node:\d+\.\d+\.\d+-alpine[\d.]+@sha256:[0-9a-f]{64}$/u.test(froms[0]), froms.join(' '));
    check('the runtime runs as uid 10001', /^USER 10001:10001$/mu.test(df) && df.lastIndexOf('USER 10001:10001') > df.lastIndexOf('FROM '));
    check('npm and npx are removed from the runtime', df.includes('rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx'));
    check('dev dependencies are pruned before the copy', df.includes('npm prune --omit=dev'));
    check('the runtime copies only node_modules, dist, package.json and the catalogue', [...df.slice(df.lastIndexOf('FROM ')).matchAll(/^COPY (.+)$/gmu)].map((m) => m[1]).join(' | ') === '--from=build /src/node_modules ./node_modules | --from=build /src/dist ./dist | package.json ./ | catalogue/catalogue.json ./catalogue/catalogue.json');
    check('a HEALTHCHECK on /healthz', /HEALTHCHECK[\s\S]*\/healthz/u.test(df));
    check('the HEALTHCHECK asks the configured port (MCP_PORT, then PORT), not a fixed one', /HEALTHCHECK[\s\S]*process\.env\.MCP_PORT\|\|process\.env\.PORT\|\|'8787'[\s\S]*'http:\/\/127\.0\.0\.1:'\+p\+'\/healthz'/u.test(df));
    const ignore = read('server/.dockerignore').split('\n').filter((l) => l && !l.startsWith('#'));
    check('the build context lets in only what it names', ignore[0] === '*' && ignore.every((l) => l === '*' || l.startsWith('!') || l === 'src/**/*.test.ts'), ignore.join(' '));
    check('no test, mock or env file is let in', !ignore.some((l) => /^!(test|mock|\.env|dist|node_modules)/u.test(l)));
}

console.log(`\n${String(passed())} passed, ${String(failures.length)} failed`);
if (failures.length > 0) process.exit(1);
