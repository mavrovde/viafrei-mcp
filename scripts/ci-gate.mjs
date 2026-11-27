#!/usr/bin/env node
/**
 * The image release's CI gate: CI passed on the tagged commit. It reads a workflow-runs
 * listing (gh api --paginate --slurp "repos/OWNER/REPO/actions/runs?head_sha=SHA") on
 * stdin and passes only when, for every required workflow, the NEWEST run of this
 * repository on exactly that commit, started by a push to main or dispatched by a
 * maintainer (the automatic release path dispatches CI on the tag, because the merge it
 * makes with the workflow token starts no push run), completed with success.
 *
 * A missing run, a run still going, or any other conclusion is red: a release never
 * waits on a check and never reads "could not read" as green.
 *
 *   node scripts/ci-gate.mjs <sha> <owner/repo> < runs.json     exit 0 green, 1 red, 2 bad input
 *
 * The server's own tests are not read here: image.yml calls server.yml on the same
 * commit as a job of its own run, so they run whatever paths the commit touched.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REQUIRED_WORKFLOWS = ['.github/workflows/ci.yml'];

/** The runs of one listing or of the pages `--slurp` gathers. */
export function runsOf(json) {
    const pages = Array.isArray(json) ? json : [json];
    const out = [];
    for (const p of pages) {
        const runs = p?.workflow_runs;
        if (!Array.isArray(runs)) throw new Error('not a workflow-runs listing (no workflow_runs array)');
        out.push(...runs);
    }
    return out;
}

/** How to re-run the job this gate is in, when it runs in Actions. */
const rerun = () => (process.env.GITHUB_RUN_ID === undefined ? '' : `: gh run rerun ${process.env.GITHUB_RUN_ID} --failed`);

const trusted = (r) => (r.event === 'push' && r.head_branch === 'main') || r.event === 'workflow_dispatch';

export function judgeCi(runs, sha, repo, required = REQUIRED_WORKFLOWS) {
    if (!/^[0-9a-f]{40}$/u.test(sha)) return { ok: false, lines: [`✗ '${String(sha).slice(0, 50)}' is not a 40-hex commit`] };
    const lines = [];
    let ok = true;
    for (const path of required) {
        const mine = runs
            .filter((r) => r.path === path && r.head_sha === sha && trusted(r) && r.head_repository?.full_name === repo)
            .sort((a, b) => (a.created_at === b.created_at ? (b.run_attempt ?? 1) - (a.run_attempt ?? 1) : a.created_at < b.created_at ? 1 : -1));
        const newest = mine[0];
        if (newest === undefined) {
            ok = false;
            lines.push(`✗ ${path}: no push-to-main or dispatched run of ${repo} on ${sha.slice(0, 12)}`);
        } else if (newest.status !== 'completed') {
            ok = false;
            lines.push(`✗ ${path}: run ${newest.id} is ${newest.status}, not completed; a release never waits on a running check. Recover: once that run has finished green, re-run this job${rerun()}`);
        } else if (newest.conclusion !== 'success') {
            ok = false;
            lines.push(`✗ ${path}: run ${newest.id} concluded ${newest.conclusion ?? 'nothing'}; the commit is not releasable until CI passes on it (re-run CI if the failure was not the commit's, then re-run this job${rerun()})`);
        } else {
            lines.push(`✓ ${path}: run ${newest.id} concluded success`);
        }
    }
    return { ok, lines };
}

function main(argv) {
    const [sha, repo] = argv;
    if (sha === undefined || repo === undefined || !/^[\w.-]+\/[\w.-]+$/u.test(repo)) {
        process.stderr.write('usage: node scripts/ci-gate.mjs <sha> <owner/repo> < runs.json\n');
        return 2;
    }
    let runs;
    try {
        runs = runsOf(JSON.parse(readFileSync(0, 'utf8')));
    } catch (err) {
        process.stderr.write(`ci gate: cannot read the runs listing: ${err instanceof Error ? err.message : String(err)}\n`);
        return 2;
    }
    const { ok, lines } = judgeCi(runs, sha, repo);
    for (const l of lines) process.stdout.write(`${l}\n`);
    return ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
