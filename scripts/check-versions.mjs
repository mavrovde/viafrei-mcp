#!/usr/bin/env node
/**
 * Every version field of the release must agree: the manifest's, BOTH of the lockfile's,
 * and the five release-please writes beside them.
 *
 * WHY THIS EXISTS, and it is the one that actually bit. Cutting 1.3.15 left
 * `package.json` saying `1.3.15` while `package-lock.json` still said `1.3.12`, on a
 * tree seven review rounds had confirmed. Every gate this repository owns passed. The
 * measured reason: **`npm ci` does not compare the root `version` field at all** —
 * checked on npm 11.19.1 and on the 12.0.2 the publish workflow pins — so nothing in
 * build, test, pack, publish-hygiene or the tarball gate reads that pair. It was found
 * by a person reading the two files side by side, which is not a gate.
 *
 * It has since been kept in step by hand at every release: 1.3.16 and 1.3.22 each wrote
 * three version fields deliberately and said so in their commit messages. "Done
 * deliberately" is precisely the failure mode, because the only thing holding it
 * together is somebody remembering.
 *
 *   node scripts/check-versions.mjs
 *
 * release-please writes five more version fields beside the root pair (its extra-files in
 * release-please-config.json): server/package.json, both of server/package-lock.json's,
 * and serverInfo.version in both catalogue.json copies. A jsonpath it does not match is
 * skipped without a word, so all eight are read here and must agree; the docs job on the
 * release branch runs this, and a missed field goes red there, before the merge.
 *
 * Exit codes are distinct on purpose: **2** means this check could not run (a file is
 * missing, unreadable, or not the shape it must be) and **1** means it ran and the
 * versions disagree. A gate that cannot read its input must not be able to look like a
 * gate that read it and was satisfied.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.VF_VERSIONS_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..');

function refuse(message) {
    console.error(`check-versions: ${message}`);
    process.exit(2);
}

function read(path, label) {
    let text;
    try {
        text = readFileSync(path, 'utf8');
    } catch (error) {
        refuse(`cannot read ${label} at ${path} — ${error.message}. A missing file is a failure here, never a skip.`);
    }
    try {
        return JSON.parse(text);
    } catch (error) {
        refuse(`${label} at ${path} is not valid JSON — ${error.message}`);
    }
    return undefined;
}

// [file, label, the field read from it]: the root pair npm writes, then release-please's five.
const FILES = [
    ['package.json', [['.version', json => json.version]]],
    ['package-lock.json', [['.version', json => json.version], ['.packages[""].version', json => json.packages?.['']?.version]]],
    ['server/package.json', [['.version', json => json.version]]],
    ['server/package-lock.json', [['.version', json => json.version], ['.packages[""].version', json => json.packages?.['']?.version]]],
    ['catalogue.json', [['.serverInfo.version', json => json.serverInfo?.version]]],
    ['server/catalogue/catalogue.json', [['.serverInfo.version', json => json.serverInfo?.version]]]
];

const fields = FILES.flatMap(([file, reads]) => {
    const json = read(join(ROOT, file), file);
    return reads.map(([path, get]) => [`${file} ${path}`, get(json)]);
});

// Each field is required to EXIST and to be a string before anything is compared:
// absent fields are all equal to one another, which would be a gate reporting
// agreement about nothing.
for (const [label, value] of fields) {
    if (typeof value !== 'string' || value.length === 0) {
        refuse(
            `${label} is ${value === undefined ? 'absent' : JSON.stringify(value)}, not a version string. ` +
            'Absent fields would compare equal, so this refuses rather than agreeing about nothing.'
        );
    }
}

const distinct = new Set(fields.map(([, value]) => value));
const printed = fields.map(([label, value]) => `    ${label} = ${value}`).join('\n');

if (distinct.size !== 1) {
    console.error(
        'check-versions: the version fields disagree.\n' +
        `${printed}\n` +
        '  `npm ci` does not compare the root `version` field, and release-please skips a jsonpath that ' +
        'matches nothing, so no other gate here reads these. Fix the field that differs (for a release-please ' +
        'field, its extra-files entry in release-please-config.json) and commit it.'
    );
    process.exit(1);
}

console.log(`check-versions: PASS - all ${fields.length} agree at ${[...distinct][0]}`);
console.log(printed);
