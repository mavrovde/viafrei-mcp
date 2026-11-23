#!/usr/bin/env node
/**
 * The 15-minute job gate (check-timeouts.mjs) passes on the workflows as committed and
 * says no to each planted fault: a job with no timeout, one above 15, an expression
 * instead of a number, and a timeout set on a step rather than on the job. A job that
 * calls a reusable workflow is not asked for one.
 *
 *   node scripts/check-timeouts.test.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChecker } from './check-harness.mjs';
import { EXCEPTIONS, faultsOf, jobsOf, workflows } from './check-timeouts.mjs';

const { check, failures, passed } = createChecker();
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-timeouts.mjs');

console.log('the workflows as committed');
{
    const files = workflows();
    const jobs = Object.values(files).reduce((sum, t) => sum + jobsOf(t).size, 0);
    check('the gate reads the jobs of every workflow', Object.keys(files).length >= 10 && jobs >= 20, `${Object.keys(files).length} files, ${jobs} jobs`);
    const faults = Object.entries(files).flatMap(([n, t]) => faultsOf(n, t));
    check('every job is bounded at 15 minutes or less', faults.length === 0, faults.join('; '));
    const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    check('the gate exits 0 on them', r.status === 0, `${r.status} ${r.stderr}`);
}

console.log('each planted fault is reported');
{
    const wf = (jobs) => `name: x\non:\n  workflow_dispatch:\n\njobs:\n${jobs}`;
    const steps = '    steps:\n      - run: true\n';
    const cases = [
        ['a job with no timeout', wf(`  a:\n    runs-on: ubuntu-24.04\n${steps}`), 'job a has no timeout-minutes'],
        ['a job at 16', wf(`  a:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 16\n${steps}`), 'job a has timeout-minutes 16'],
        ['a job at 0', wf(`  a:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 0\n${steps}`), 'job a has timeout-minutes 0'],
        ['an expression', wf(`  a:\n    runs-on: ubuntu-24.04\n    timeout-minutes: \${{ inputs.t }}\n${steps}`), 'not a plain number'],
        ['a step timeout only', wf(`  a:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: true\n        timeout-minutes: 5\n`), 'job a has no timeout-minutes'],
        ['the second job unbounded', wf(`  a:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 15\n${steps}  b:\n    runs-on: ubuntu-24.04\n${steps}`), 'job b has no timeout-minutes'],
    ];
    for (const [label, text, want] of cases) {
        const got = faultsOf('x.yml', text).join('; ');
        check(`${label} is reported`, got.includes(want), got);
    }
    const ok = wf(`  a:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 15 # a comment\n${steps}  call:\n    uses: ./.github/workflows/snyk.yml\n`);
    const mut = (jobs) => wf(jobs);
    const ex = [
        ['the mutation shards at 20 pass', 'mutation.yml', mut(`  shards:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 20\n${steps}`), ''],
        ['the mutation shards at 21', 'mutation.yml', mut(`  shards:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 21\n${steps}`), 'job shards has timeout-minutes 21, not 1-20'],
        ['another mutation.yml job at 16', 'mutation.yml', mut(`  gather:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 16\n${steps}`), 'job gather has timeout-minutes 16, not 1-15'],
        ['a shards job in another workflow at 16', 'ci.yml', mut(`  shards:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 16\n${steps}`), 'job shards has timeout-minutes 16, not 1-15'],
    ];
    for (const [label, file, text, want] of ex) {
        const got = faultsOf(file, text).join('; ');
        check(want === '' ? label : `${label} is reported`, want === '' ? got === '' : got.includes(want), got);
    }
    check('the one exception is mutation.yml\'s shards at 20, nothing wider', JSON.stringify(EXCEPTIONS) === JSON.stringify({ 'mutation.yml': { shards: 20 } }), JSON.stringify(EXCEPTIONS));
    // The committed workflows: every job but mutation.yml's shards at 15 or less.
    {
        const files = workflows();
        const over = Object.entries(files).flatMap(([n, t]) => [...jobsOf(t)].filter(([id, body]) => !(n === 'mutation.yml' && id === 'shards') && body.some((l) => { const m = /^ {4}timeout-minutes:\s*(\d+)/u.exec(l); return m !== null && Number(m[1]) > 15; })).map(([id]) => `${n}:${id}`));
        check('every committed job but the mutation shards is at 15 or less', over.length === 0, over.join(' '));
    }
    check('15 with a comment passes, and a reusable-workflow call is not asked for a timeout', faultsOf('x.yml', ok).length === 0, faultsOf('x.yml', ok).join('; '));
}

console.log(`\ncheck-timeouts self-test: ${passed()} passed, ${failures.length} failed`);
process.exit(failures.length === 0 ? 0 : 1);
