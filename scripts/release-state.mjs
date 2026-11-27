#!/usr/bin/env node
/**
 * Where the newest release stands, from five facts the Version sync workflow reads, and
 * which listings to dispatch. It decides; it calls nothing.
 *
 * THE CHAIN it judges (CONTRIBUTING.md, "How a release happens"): release pull request ->
 * merge -> tag (release-please.yml) -> checks, npm, image, release page (publish.yml) ->
 * the deploy, outside this repository -> the live server serves the version -> the MCP
 * Registry and Smithery list it. Only the last step depends on something this repository
 * does not do, so it cannot be chained to npm: a listing run straight after npm always met
 * the older live server and refused (no listing from 2.7.6 to 2.7.10). This is what starts
 * it instead, once a day, without waiting on anything.
 *
 * THE NEWEST TAG is judged, never an older one. A tag that npm never served and that is
 * not the newest is ABANDONED: a release that stopped (a red check, a gate) and was then
 * superseded by a newer tag. It stays a tag, because tags are never moved or deleted; it
 * is never published, because a newer version already is or will be; and nothing waits on
 * it. It is reported once per run as a fact, never as stuck - 2.7.9 stayed "STUCK" after
 * 2.7.10 was cut, which said a release was owed that never would be.
 *
 * States, as `state=` on stdout:
 *   stuck            the newest tag is not on npm. Exit 1, with the recovery.
 *   untagged-npm     npm latest is above the newest tag. Exit 1.
 *   awaiting-deploy  npm serves the newest tag; the live server is older. Exit 0: the deploy
 *                    is outside this repository and owes nothing here.
 *   live             the live server serves the newest tag. Exit 0; `dispatch=` names the
 *                    listings whose last successful run is of another version.
 *   untagged-live    the live server is above the newest tag. Exit 1.
 * Exit 2: an input that is not what it must be (a version not X.Y.Z, an unreadable file).
 *
 *   node scripts/release-state.mjs --live X.Y.Z --npm-latest X.Y.Z --npm-versions <file>
 *        --tags <file> --registry <run title> --smithery <run title>
 * <file>s hold one entry per line (`npm view viafrei versions --json` is read as JSON too);
 * a listing is the name of its last successful run ("Smithery 2.7.10"), empty when none.
 */

import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VERSION = /^\d+\.\d+\.\d+$/u;

export const cmp = (a, b) => {
    const x = a.split('.').map(Number);
    const y = b.split('.').map(Number);
    for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    return 0;
};

/** The version a listing's last successful run was for, from its run name; undefined when it names none. */
export function listed(title) {
    const m = /(?:^|\s)(\d+\.\d+\.\d+)$/u.exec(String(title ?? '').trim());
    return m === null ? undefined : m[1];
}

/**
 * The judgement. `tags` are tag names (only plain vX.Y.Z count), `npmVersions` every
 * version npm serves.
 */
export function judge({ live, npmLatest, npmVersions, tags, registry, smithery }) {
    for (const [name, v] of [['live', live], ['npm latest', npmLatest]]) {
        if (!VERSION.test(String(v))) return { state: 'unreadable', exit: 2, lines: [`${name} is ${JSON.stringify(v)}, not X.Y.Z`], dispatch: [] };
    }
    const plain = tags.filter((t) => /^v\d+\.\d+\.\d+$/u.test(t)).map((t) => t.slice(1)).sort(cmp);
    if (plain.length === 0) return { state: 'unreadable', exit: 2, lines: ['no vX.Y.Z tag was listed'], dispatch: [] };
    const newest = plain.at(-1);
    const published = new Set(npmVersions);
    const lines = [`newest tag v${newest}; npm latest ${npmLatest}; live server ${live}`];
    for (const v of plain) {
        if (!published.has(v) && cmp(v, newest) < 0) {
            lines.push(`v${v}: tagged, never published, superseded by v${newest} - abandoned: it stays a tag (tags are never moved or deleted), is never published, and nothing waits on it`);
        }
    }
    const out = (state, exit, more, dispatch = []) => ({ state, exit, lines: [...lines, ...more], dispatch });
    if (!published.has(newest)) {
        return out('stuck', 1, [
            `STUCK - v${newest} is tagged but npm does not serve ${newest}. The Release run on that tag stopped, never ran, or is still running (a run between the tag and the npm publish reads as this too).`,
            `Recover: read the Release run on v${newest} and re-run its failed jobs once the cause is fixed, or start it: gh workflow run publish.yml --ref v${newest} -f dry_run=false`,
        ]);
    }
    if (cmp(npmLatest, newest) > 0) {
        return out('untagged-npm', 1, [`npm latest ${npmLatest} is above the newest tag v${newest}: something published without a tag. A person decides; nothing here publishes or unpublishes.`]);
    }
    if (cmp(npmLatest, newest) < 0) {
        return out('stuck', 1, [`npm serves ${newest} but its latest is ${npmLatest}: the dist-tag did not move. Recover: npm dist-tag add viafrei@${newest} latest (the owner), then re-run this.`]);
    }
    const c = cmp(live, newest);
    if (c < 0) return out('awaiting-deploy', 0, [`awaiting the deploy: npm serves ${newest}, the live server ${live}. The listings follow once it serves ${newest}; nothing to do here.`]);
    if (c > 0) return out('untagged-live', 1, [`the live server ${live} is above the newest tag v${newest}: it runs a build no release names. A person decides.`]);
    const dispatch = [];
    for (const [workflow, title] of [['mcp-registry.yml', registry], ['smithery.yml', smithery]]) {
        const at = listed(title);
        if (at === newest) lines.push(`${workflow}: lists ${newest}`);
        else {
            lines.push(`${workflow}: last listed ${at ?? 'nothing this can read'}; dispatching it for ${newest}`);
            dispatch.push(workflow);
        }
    }
    return out('live', 0, [], dispatch);
}

function entries(file) {
    const text = readFileSync(file, 'utf8').trim();
    if (text.startsWith('[') || text.startsWith('"')) {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
    }
    return text === '' ? [] : text.split('\n').map((l) => l.trim()).filter(Boolean);
}

function main(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/u, '')] = argv[i + 1] ?? '';
    let result;
    try {
        result = judge({
            live: args.live,
            npmLatest: args['npm-latest'],
            npmVersions: entries(args['npm-versions']),
            tags: entries(args.tags),
            registry: args.registry,
            smithery: args.smithery,
        });
    } catch (error) {
        process.stderr.write(`release-state: cannot read the inputs: ${error instanceof Error ? error.message : String(error)}\n`);
        return 2;
    }
    for (const l of result.lines) process.stderr.write(`${l}\n`);
    process.stdout.write(`state=${result.state}\ndispatch=${result.dispatch.join(' ')}\n`);
    return result.exit;
}

const real = (p) => {
    try {
        return realpathSync(p);
    } catch {
        return p;
    }
};
if (process.argv[1] !== undefined && real(fileURLToPath(import.meta.url)) === real(process.argv[1])) process.exitCode = main(process.argv.slice(2));
