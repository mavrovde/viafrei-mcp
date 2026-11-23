#!/usr/bin/env node
/**
 * Every GitHub job here ends within 15 minutes of wall clock (owner 2026-11-22: a test
 * pipeline that runs longer is split into parallel jobs or shards, never given more
 * time). This gate reads every workflow under .github/workflows and fails when a job
 * that runs steps has no `timeout-minutes`, a value that is not a plain number, or a
 * value above 15. A job that calls a reusable workflow (`uses:` on the job) cannot carry
 * a timeout; the jobs of the workflow it calls are read in their own file.
 *
 * One exception, exact: the `shards` job of mutation.yml may take up to 20 minutes
 * (owner 2026-11-23: a viafrei-mcp pipeline ends within 30 minutes, this repository
 * only). Every other job, in mutation.yml too, keeps the 15.
 *
 *   node scripts/check-timeouts.mjs            exit 0 when every job is bounded, 1 otherwise
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_MINUTES = 15;
/** The one job allowed more, file → job → its ceiling (owner 2026-11-23, the 30-minute mcp pipeline). */
export const EXCEPTIONS = { 'mutation.yml': { shards: 20 } };
const WF = join(dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows');

/** The jobs of one workflow text: id → the job's lines, its header line left out. */
export function jobsOf(text) {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => /^jobs:\s*(#.*)?$/u.test(l));
    const jobs = new Map();
    if (start < 0) return jobs;
    let current = null;
    for (const line of lines.slice(start + 1)) {
        if (/^\S/u.test(line)) break;
        const head = /^ {2}([A-Za-z0-9_-]+):\s*(#.*)?$/u.exec(line);
        if (head) {
            current = head[1];
            jobs.set(current, []);
        } else if (current !== null) jobs.get(current).push(line);
    }
    return jobs;
}

/** What is wrong with the jobs of one workflow text: one sentence per job, none when all are bounded. */
export function faultsOf(name, text) {
    const out = [];
    for (const [id, body] of jobsOf(text)) {
        if (body.some((l) => /^ {4}uses:\s/u.test(l))) continue;
        const set = body.map((l) => /^ {4}timeout-minutes:\s*(.*?)\s*(#.*)?$/u.exec(l)).filter((m) => m !== null);
        if (set.length === 0) { out.push(`${name}: job ${id} has no timeout-minutes`); continue; }
        const raw = set[0][1];
        if (!/^\d+$/u.test(raw)) { out.push(`${name}: job ${id} has timeout-minutes '${raw}', not a plain number`); continue; }
        const max = Object.hasOwn(EXCEPTIONS, name) && Object.hasOwn(EXCEPTIONS[name], id) ? EXCEPTIONS[name][id] : MAX_MINUTES;
        if (Number(raw) > max || Number(raw) < 1) out.push(`${name}: job ${id} has timeout-minutes ${raw}, not 1-${max}`);
    }
    return out;
}

/** Every workflow file under `dir`, read. */
export function workflows(dir = WF) {
    return Object.fromEntries(readdirSync(dir).filter((n) => /\.ya?ml$/u.test(n)).sort().map((n) => [n, readFileSync(join(dir, n), 'utf8')]));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    const files = workflows();
    const faults = Object.entries(files).flatMap(([n, t]) => faultsOf(n, t));
    const jobs = Object.values(files).reduce((sum, t) => sum + jobsOf(t).size, 0);
    if (jobs === 0) { console.error('check-timeouts: no job read under .github/workflows'); process.exit(2); }
    for (const f of faults) console.error(`::error::${f}`);
    console.log(`check-timeouts: ${jobs} jobs in ${Object.keys(files).length} workflows, ${faults.length} over ${MAX_MINUTES} minutes or unbounded`);
    process.exit(faults.length === 0 ? 0 : 1);
}
