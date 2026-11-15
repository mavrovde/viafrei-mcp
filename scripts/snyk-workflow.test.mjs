#!/usr/bin/env node
/**
 * Snyk's wiring, read off the workflow files (owner 2026-11-15): Snyk runs once a
 * week on main and once per release, before the npm workflow packs and publishes,
 * and never on a pull request or a push.
 *
 * Pinned: snyk.yml's trigger block (a dispatch with no input, followed directly by
 * the call, so a dispatch on a branch cannot name a commit), the scan step exactly
 * (no `|| true`), the caller's secrets block (SNYK_TOKEN by name, never
 * `secrets: inherit`), and that publish needs snyk. The guard step is RUN under
 * bash the way the runner runs it. Then each planted fault must be reported, so
 * the checks can say no.
 *
 *   node scripts/snyk-workflow.test.mjs
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChecker } from './check-harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const WF = join(ROOT, '.github', 'workflows');
const { check, failures, passed } = createChecker();

const TRIGGERS = '\non:\n  schedule:\n    - cron: "17 5 * * 1" # Mondays 05:17 UTC\n  workflow_dispatch:\n  workflow_call:\n    inputs:\n      ref:\n';
const SCAN = '\n      - name: Snyk test\n        env:\n          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}\n        run: |\n          mkdir -p sarif\n          ./snyk test --severity-threshold=high --sarif-file-output=sarif/snyk.sarif\n' +
    "      - name: Upload SARIF to code scanning\n        # A called run scans another commit than the caller's github.sha; its findings are\n        # uploaded only when they belong to the commit code scanning files them under.\n" +
    "        if: always() && hashFiles('sarif/snyk.sarif') != '' && (inputs.ref == '' || inputs.ref == github.sha)\n";
const CHECKOUT = '\n        with:\n          ref: ${{ inputs.ref || github.sha }}\n          persist-credentials: false\n';
const PUBLISH_IF = "\n  publish:\n    needs: snyk\n    # After a passed scan, or a branch dry run with no scan; never past a failed\n    # or cancelled one, and never a real publish without one.\n    if: ${{ !cancelled() && (needs.snyk.result == 'success' || (needs.snyk.result == 'skipped' && github.event_name == 'workflow_dispatch' && inputs.dry_run)) }}\n";
const SECRETS = '\n    secrets:\n      SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}\n';
const CALLER = '\n  snyk:\n    name: Snyk (dependencies)\n    if: startsWith(github.ref, \'refs/tags/v\')\n    permissions:\n      contents: read\n      security-events: write\n    uses: ./.github/workflows/snyk.yml\n    with:\n      ref: ${{ github.sha }}\n' + SECRETS.slice(1);

const SHA40 = '0123456789abcdef0123456789abcdef01234567';
/** What the guard must answer: a wrong ref is exit 2, never a skip. */
const GUARD_CASES = [
    ['', 'refs/heads/feature', 2],
    ['', 'refs/pull/1/merge', 2],
    ['', 'refs/tags/v1.2.3', 2],
    ['', 'refs/heads/main', 0],
    [SHA40, 'refs/heads/feature', 0],
    ['v1.2.3', 'refs/heads/main', 2],
    [SHA40.toUpperCase(), 'refs/heads/main', 2],
    [SHA40.slice(1), 'refs/heads/main', 2],
];

/** The guard step's run block, dedented, as the runner hands it to bash. */
function guardOf(snyk) {
    const m = /\n {6}- name: The run scans main or a release's commit\n(?: {8}.*\n)*? {8}run: \|\n((?: {10}.*\n)+)/u.exec(snyk);
    return (m?.[1] ?? '').replace(/^ {10}/gmu, '');
}

function runGuard(script, ref, gitRef) {
    try {
        execFileSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], { env: { PATH: process.env.PATH ?? '', REF_IN: ref, GITHUB_REF: gitRef }, stdio: 'ignore' });
        return 0;
    } catch (e) {
        return e.status ?? -1;
    }
}

/** The text of one job: from `  <id>:` to the next job or the end. */
function job(text, id) {
    const jobs = text.slice(text.indexOf('\njobs:\n'));
    const start = jobs.indexOf(`\n  ${id}:\n`);
    if (start < 0) return '';
    const rest = jobs.slice(start + 1);
    const next = /\n {2}[a-z][\w-]*:\n/u.exec(rest.slice(1));
    return next === null ? rest : rest.slice(0, next.index + 1);
}

function faults(files) {
    const out = [];
    const sn = files['snyk.yml'] ?? '';
    const on = /\non:\n([^]*?)\n(?=[a-z])/u.exec(sn)?.[1] ?? '';
    const triggers = [...on.matchAll(/^ {2}([a-z_]+):/gmu)].map((m) => m[1]);
    if (triggers.join() !== 'schedule,workflow_dispatch,workflow_call') out.push(`snyk.yml runs on ${triggers.join(', ')}, not the weekly schedule, a dispatch and the release call alone`);
    if (!sn.includes(TRIGGERS)) out.push("snyk.yml's trigger block is not the weekly schedule, a dispatch with no input and the release call");
    if (!sn.includes(SCAN)) out.push("snyk.yml's scan step and SARIF upload are not exactly the high-threshold scan and the own-commit upload");
    if (!sn.includes(CHECKOUT)) out.push('snyk.yml does not check out ${{ inputs.ref || github.sha }}');
    if (sn.includes('continue-on-error')) out.push('snyk.yml carries continue-on-error');
    const guard = guardOf(sn);
    if (guard === '') out.push('snyk.yml has no guard step');
    else for (const [ref, gitRef, want] of GUARD_CASES) {
        const got = runGuard(guard, ref, gitRef);
        if (got !== want) out.push(`the guard exits ${got} for REF_IN="${ref}" on ${gitRef}, not ${want}`);
    }
    for (const [n, t] of Object.entries(files)) {
        if (n !== 'snyk.yml' && t.includes('snyk test')) out.push(`${n} runs the Snyk CLI; only snyk.yml does`);
        if (n !== 'publish.yml' && t.includes('workflows/snyk.yml')) out.push(`${n} references workflows/snyk.yml; only publish.yml calls it`);
        if (t.includes('secrets: inherit')) out.push(`${n} passes secrets: inherit`);
    }
    const pub = files['publish.yml'] ?? '';
    if (!pub.includes(CALLER)) out.push("publish.yml's snyk job does not call snyk.yml on the tagged commit with exactly SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}");
    if (!/^ {4}needs: snyk\n/mu.test(job(pub, 'publish'))) out.push("publish.yml's publish does not need snyk");
    if (!pub.includes(PUBLISH_IF)) out.push("publish.yml's publish does not run only after a passed scan or a branch dry run");
    return out;
}

const files = Object.fromEntries(readdirSync(WF).filter((n) => n.endsWith('.yml')).map((n) => [n, readFileSync(join(WF, n), 'utf8')]));

console.log('the workflows as committed');
{
    const f = faults(files);
    check('Snyk runs weekly on main and once per release, before publish, and nowhere else', f.length === 0, f.join('; '));
    check('the guard step is found and run', guardOf(files['snyk.yml'] ?? '') !== '');
}

console.log('each planted fault is reported');
{
    const plant = (n, from, to) => {
        const t = files[n] ?? '';
        if (!t.includes(from)) return null;
        return { ...files, [n]: t.replace(from, to) };
    };
    const cases = [
        ['guard exit 2 -> 0', 'the guard exits 0 for REF_IN="" on refs/heads/feature', plant('snyk.yml', 'not on $GITHUB_REF"; exit 2', 'not on $GITHUB_REF"; exit 0')],
        ['-n always true', 'the guard exits 2 for REF_IN="" on refs/heads/main', plant('snyk.yml', 'if [[ -n $REF_IN ]]; then', 'if [[ -n x ]]; then')],
        ['hex check removed', 'the guard exits 0 for REF_IN="v1.2.3"', plant('snyk.yml', '            [[ $REF_IN =~ ^[0-9a-f]{40}$ ]] || {', '            true || {')],
        ['a dispatch input', 'a dispatch with no input', plant('snyk.yml', '  workflow_dispatch:\n', '  workflow_dispatch:\n    inputs:\n      ref:\n        type: string\n')],
        ['a pull_request trigger', 'the weekly schedule, a dispatch and the release call alone', plant('snyk.yml', '  workflow_dispatch:\n', '  pull_request:\n  workflow_dispatch:\n')],
        ['a push trigger', 'the weekly schedule, a dispatch and the release call alone', plant('snyk.yml', '  workflow_dispatch:\n', '  push:\n    branches: [main]\n  workflow_dispatch:\n')],
        ['|| true on the scan', 'the high-threshold scan', plant('snyk.yml', '--sarif-file-output=sarif/snyk.sarif\n', '--sarif-file-output=sarif/snyk.sarif || true\n')],
        ['secrets: inherit', 'publish.yml passes secrets: inherit', plant('publish.yml', SECRETS, '\n    secrets: inherit\n')],
        ['publish not needing snyk', "publish.yml's publish does not need snyk", plant('publish.yml', '  publish:\n    needs: snyk\n', '  publish:\n')],
        ['the SARIF condition dropped', 'the own-commit upload', plant('snyk.yml', " && (inputs.ref == '' || inputs.ref == github.sha)", '')],
        ['a key inside the scan step', 'the high-threshold scan', plant('snyk.yml', '          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}\n        run: |\n          mkdir', '          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}\n        continue-on-error: true\n        run: |\n          mkdir')],
        ['checkout ref changed', 'snyk.yml does not check out', plant('snyk.yml', 'ref: ${{ inputs.ref || github.sha }}', 'ref: ${{ github.sha }}')],
        ['continue-on-error on the job', 'snyk.yml carries continue-on-error', plant('snyk.yml', '    timeout-minutes: 10\n', '    timeout-minutes: 10\n    continue-on-error: true\n')],
        ['a second caller', 'ci.yml references workflows/snyk.yml', plant('ci.yml', '\njobs:\n', '\njobs:\n  s:\n    uses: ./.github/workflows/snyk.yml\n')],
        ['snyk on a branch dispatch', "publish.yml's snyk job does not call", plant('publish.yml', "    if: startsWith(github.ref, 'refs/tags/v')\n", '')],
        ['publish if: always()', 'only after a passed scan or a branch dry run', plant('publish.yml', "    if: ${{ !cancelled() && (needs.snyk.result", "    if: always()\n    # ${{ !cancelled() && (needs.snyk.result")],
        ['a second Snyk run', 'ci.yml runs the Snyk CLI', plant('ci.yml', '\njobs:\n', '\njobs:\n  x:\n    steps:\n      - run: ./snyk test\n')],
    ];
    for (const [label, want, f] of cases) {
        if (f === null) { check(`${label}: the plant applies`, false, 'the planted text is not in the file'); continue; }
        const got = faults(f).join('; ');
        check(`${label} is reported`, got.includes(want), got);
    }
}

console.log(`\nsnyk-workflow self-test: ${passed()} passed, ${failures.length} failed`);
process.exit(failures.length === 0 ? 0 : 1);
