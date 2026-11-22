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
import { faultsOf, jobsOf, workflows } from './check-timeouts.mjs';

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
    check('15 with a comment passes, and a reusable-workflow call is not asked for a timeout', faultsOf('x.yml', ok).length === 0, faultsOf('x.yml', ok).join('; '));
}

console.log(`\ncheck-timeouts self-test: ${passed()} passed, ${failures.length} failed`);
process.exit(failures.length === 0 ? 0 : 1);
