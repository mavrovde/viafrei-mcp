#!/usr/bin/env node
/**
 * The version gate's self-test.
 *
 * The gate itself is twenty lines of comparison, so the thing worth testing is not the
 * comparison — it is that the gate can SAY NO, and that it says no for the right reason
 * with the right exit code. Issue #18 asks for the mutant proof explicitly: bump one
 * field, watch it go red, restore, watch it go green. Done here rather than in a
 * terminal, because a proof nobody can re-run is a story about a proof.
 *
 * The two exit codes are the substance. **2** means the gate could not run — a file is
 * missing, unreadable or the wrong shape — and **1** means it ran and found a mismatch.
 * Collapsing those would let "I could not read the lockfile" look like "I read it and
 * was satisfied", which is the §5b failure this repository refuses everywhere else.
 *
 *   node scripts/check-versions.test.mjs
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exitOrHang, nodePath, runTool } from './tools.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const GATE = join(HERE, 'check-versions.mjs');

let passed = 0;
const failures = [];

function check(label, ok, detail = '') {
    if (ok) {
        passed += 1;
        console.log(`  PASS  ${label}`);
        return;
    }
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

function refuse(message) {
    console.error(`check-versions self-test: ${message}`);
    process.exit(2);
}

/** Run the gate against a throwaway root. Returns { status, out }. */
function run(root) {
    try {
        const out = runTool(nodePath(), [GATE], {
            encoding: 'utf8',
            env: { ...process.env, VF_VERSIONS_ROOT: root }
        });
        return { status: 0, out };
    } catch (error) {
        const { code, stdout } = exitOrHang(error, 'check-versions self-test');
        return { status: code, out: stdout };
    }
}

const FILES = ['package.json', 'package-lock.json', 'server/package.json', 'server/package-lock.json',
    'catalogue.json', 'server/catalogue/catalogue.json'];
const real = file => JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
const versionsOf = json => [json['package.json'].version, json['package-lock.json'].version,
    json['package-lock.json'].packages?.['']?.version, json['server/package.json'].version,
    json['server/package-lock.json'].version, json['server/package-lock.json'].packages?.['']?.version,
    json['catalogue.json'].serverInfo?.version, json['server/catalogue/catalogue.json'].serverInfo?.version];

const roots = [];
/** A throwaway root with copies of the six files; `mutate` edits `state.json[file]` or drops a file from `state.write`. */
function fixture(mutate) {
    const root = mkdtempSync(join(tmpdir(), 'viafrei-versions-'));
    roots.push(root);
    const state = { json: Object.fromEntries(FILES.map(file => [file, real(file)])), write: new Set(FILES) };
    // The old names the cases below were written against.
    state.manifest = state.json['package.json'];
    state.lockfile = state.json['package-lock.json'];
    mutate(state);
    for (const file of state.write) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), JSON.stringify(state.json[file], null, 2));
    }
    return root;
}

// --- Precondition: the real tree is the state the gate is supposed to accept ---------
//
// If this repository were itself mismatched, every "red" case below would pass for the
// wrong reason and the green case would be the only real signal. So it is asserted
// first, and it doubles as the control.
{
    const eight = versionsOf(Object.fromEntries(FILES.map(file => [file, real(file)])));
    if (new Set(eight).size !== 1 || typeof eight[0] !== 'string') {
        refuse(`this repository's own eight version fields are ${JSON.stringify(eight)} — fix the tree before trusting this suite`);
    }
}

// --- The green case, on the real tree -----------------------------------------------
{
    const result = run(ROOT);
    check('the real tree passes, and the run prints all eight values it compared',
        result.status === 0
        && /PASS - all 8 agree at /u.test(result.out)
        && (result.out.match(/= \d+\.\d+\.\d+/gu) ?? []).length === 8,
        `status ${result.status}, out ${JSON.stringify(result.out.slice(0, 120))}`);
}

// --- The DEFAULT root, with no override at all ---------------------------------------
//
// Every other case sets VF_VERSIONS_ROOT, including the green one, which passes the real
// root through the override - so without this the default path is never exercised and a
// wrong default would be invisible here. This repository's convention for a named root
// override is that a self-test pins BOTH directions.
{
    const clean = { ...process.env };
    delete clean.VF_VERSIONS_ROOT;
    let status = 0;
    let out = '';
    try {
        out = runTool(nodePath(), [GATE], { encoding: 'utf8', cwd: ROOT, env: clean });
    } catch (error) {
        ({ code: status, stdout: out } = exitOrHang(error, 'check-versions self-test'));
    }
    check('with no VF_VERSIONS_ROOT it reads this repository and passes',
        status === 0 && /PASS - all 8 agree at /u.test(out),
        `status ${status}, out ${JSON.stringify(out.slice(0, 120))}`);
}

// --- Red: each field moved on its own ------------------------------------------------
//
// The last five are the fields release-please writes through extra-files; a jsonpath that
// matches nothing (`$.packages['']` spelled wrong) leaves its field at the old version,
// which is this case.
for (const [label, mutate] of [
    ['package.json alone', state => { state.manifest.version = '9.9.9'; }],
    ['the lockfile root alone', state => { state.lockfile.version = '9.9.9'; }],
    ['the lockfile packages[""] alone', state => { state.lockfile.packages[''].version = '9.9.9'; }],
    ['server/package.json alone', state => { state.json['server/package.json'].version = '9.9.9'; }],
    ['the server lockfile root alone', state => { state.json['server/package-lock.json'].version = '9.9.9'; }],
    ['the server lockfile packages[""] alone', state => { state.json['server/package-lock.json'].packages[''].version = '9.9.9'; }],
    ['catalogue.json alone', state => { state.json['catalogue.json'].serverInfo.version = '9.9.9'; }],
    ['server/catalogue/catalogue.json alone', state => { state.json['server/catalogue/catalogue.json'].serverInfo.version = '9.9.9'; }]
]) {
    const result = run(fixture(mutate));
    check(`${label} moved is refused with exit 1 and all eight printed`,
        result.status === 1
        && /the version fields disagree/u.test(result.out)
        && /9\.9\.9/u.test(result.out)
        && (result.out.match(/= \S+/gu) ?? []).length === 8,
        `status ${result.status}, out ${JSON.stringify(result.out.slice(0, 140))}`);
}

// --- Refusals: the gate could not run. Exit 2, and never confusable with success -----
for (const [label, mutate, needle] of [
    ['a missing lockfile', state => { state.write.delete('package-lock.json'); }, 'never a skip'],
    ['a missing manifest', state => { state.write.delete('package.json'); }, 'never a skip'],
    ['a missing server lockfile', state => { state.write.delete('server/package-lock.json'); }, 'never a skip'],
    ['a missing catalogue copy', state => { state.write.delete('server/catalogue/catalogue.json'); }, 'never a skip'],
    ['a server lockfile with no packages[""]', state => { delete state.json['server/package-lock.json'].packages['']; }, 'not a version string'],
    ['a catalogue with no serverInfo', state => { delete state.json['catalogue.json'].serverInfo; }, 'not a version string'],
    ['a lockfile with no packages[""]', state => { delete state.lockfile.packages['']; }, 'not a version string'],
    ['a manifest with no version', state => { delete state.manifest.version; }, 'not a version string'],
    ['a non-string version', state => { state.manifest.version = 3; }, 'not a version string']
]) {
    const result = run(fixture(mutate));
    check(`${label} is refused with exit 2, naming why`,
        result.status === 2 && result.out.includes(needle),
        `status ${result.status}, out ${JSON.stringify(result.out.slice(0, 140))}`);
}

// --- The one that would silently agree about nothing ---------------------------------
//
// Absent fields are all `undefined`, and `undefined === undefined`. A gate that compared
// before checking presence would report agreement on files with no versions in them at
// all. This is the case that says it does not.
{
    const result = run(fixture(state => {
        for (const file of FILES) {
            delete state.json[file].version;
            if (state.json[file].packages?.[''] !== undefined) delete state.json[file].packages[''].version;
            if (state.json[file].serverInfo !== undefined) delete state.json[file].serverInfo.version;
        }
    }));
    check('all eight ABSENT is a refusal, not a report of agreement',
        result.status === 2 && /not a version string/u.test(result.out),
        `status ${result.status}, out ${JSON.stringify(result.out.slice(0, 140))}`);
}

// --- Invalid JSON is a refusal, not a crash -----------------------------------------
{
    const root = mkdtempSync(join(tmpdir(), 'viafrei-versions-'));
    roots.push(root);
    writeFileSync(join(root, 'package.json'), '{ not json');
    writeFileSync(join(root, 'package-lock.json'), '{}');
    const result = run(root);
    check('a manifest that is not JSON is refused with exit 2',
        result.status === 2 && /not valid JSON/u.test(result.out),
        `status ${result.status}, out ${JSON.stringify(result.out.slice(0, 120))}`);
}

for (const root of roots) rmSync(root, { recursive: true, force: true });

console.log('');
if (failures.length > 0) {
    console.error(`check-versions self-test: FAIL - ${failures.length} of ${passed + failures.length} case(s)`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
}
console.log(`check-versions self-test: PASS - ${passed} cases`);
