#!/usr/bin/env node
/**
 * Self-test of scripts/release-state.mjs: every state, the abandoned rule, the listing
 * dispatch, and the CLI's exit codes and output lines. Offline: no network, no gh.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChecker } from './check-harness.mjs';
import { judge, listed } from './release-state.mjs';
import { runTool } from './tools.mjs';

const { check, failures, passed } = createChecker();
const SCRIPT = fileURLToPath(new URL('./release-state.mjs', import.meta.url));

const base = {
    live: '2.7.10', npmLatest: '2.7.10', npmVersions: ['2.7.7', '2.7.8', '2.7.10'],
    tags: ['v2.7.7', 'v2.7.8', 'v2.7.9', 'v2.7.10', 'v2.7.10-rc.1', 'not-a-tag'],
    registry: 'MCP Registry 2.7.10', smithery: 'Smithery 2.7.10',
};
const j = (o) => judge({ ...base, ...o });
const said = (r) => r.lines.join('\n');

console.log('release-state: the newest tag is judged, an older unpublished one is abandoned');
{
    const r = j({});
    check('all in order: live, nothing to dispatch, exit 0', r.state === 'live' && r.exit === 0 && r.dispatch.length === 0, JSON.stringify(r));
    check('2.7.9, tagged and superseded, is reported abandoned', /v2\.7\.9: tagged, never published, superseded by v2\.7\.10 - abandoned/u.test(said(r)), said(r));
    check('a published tag is never called abandoned', !/v2\.7\.8: tagged, never published/u.test(said(r)));
    check('an rc or other tag is not the newest and not judged', /newest tag v2\.7\.10;/u.test(said(r)) && !/rc/u.test(said(r)));
}

console.log('release-state: stuck, with the recovery');
{
    // Today's shape (2026-11-27): 2.7.9 and 2.7.10 tagged, npm at 2.7.8.
    const r = j({ live: '2.7.9', npmLatest: '2.7.8', npmVersions: ['2.7.7', '2.7.8'] });
    check('the newest unpublished tag is stuck, exit 1', r.state === 'stuck' && r.exit === 1, JSON.stringify(r));
    check('it names v2.7.10, not v2.7.9', /STUCK - v2\.7\.10 is tagged/u.test(said(r)) && !/STUCK - v2\.7\.9/u.test(said(r)), said(r));
    check('it says how to recover', said(r).includes('gh workflow run publish.yml --ref v2.7.10 -f dry_run=false'));
    check('2.7.9 is abandoned beside it, not stuck', /v2\.7\.9: tagged, never published, superseded by v2\.7\.10 - abandoned/u.test(said(r)));
    check('nothing is dispatched while stuck', r.dispatch.length === 0);
    const lag = j({ npmLatest: '2.7.8' });
    check('published but latest not moved is stuck too, with the dist-tag fix', lag.state === 'stuck' && said(lag).includes('npm dist-tag add viafrei@2.7.10 latest'), said(lag));
}

console.log('release-state: the deploy and the listings');
{
    const wait = j({ live: '2.7.8' });
    check('npm ahead of the live server is awaiting-deploy, exit 0, nothing dispatched', wait.state === 'awaiting-deploy' && wait.exit === 0 && wait.dispatch.length === 0, JSON.stringify(wait));
    const behind = j({ registry: 'MCP Registry 2.7.8', smithery: '' });
    check('live: each listing behind is dispatched', behind.state === 'live' && behind.dispatch.join(' ') === 'mcp-registry.yml smithery.yml', behind.dispatch.join(' '));
    const one = j({ smithery: 'Smithery 2.7.9' });
    check('only the listing behind is dispatched', one.dispatch.join(' ') === 'smithery.yml', one.dispatch.join(' '));
    const title = j({ registry: 'MCP Registry', smithery: 'some commit subject 2.7.10 more' });
    check('a run name that names no version counts as behind', title.dispatch.join(' ') === 'mcp-registry.yml smithery.yml', title.dispatch.join(' '));
    check('listed() reads the trailing version only', listed('Smithery 2.7.10') === '2.7.10' && listed('Smithery') === undefined && listed(undefined) === undefined);
}

console.log('release-state: what a person decides');
{
    const ahead = j({ live: '2.7.11' });
    check('a live server above the newest tag is exit 1', ahead.state === 'untagged-live' && ahead.exit === 1);
    const npm = j({ npmLatest: '2.7.11', npmVersions: [...base.npmVersions, '2.7.11'] });
    check('npm above the newest tag is exit 1', npm.state === 'untagged-npm' && npm.exit === 1, JSON.stringify(npm));
    check('a live version that is not X.Y.Z is exit 2', j({ live: '' }).exit === 2 && j({ live: '2.7' }).exit === 2);
    check('no plain tag is exit 2', j({ tags: ['v2.7.10-rc.1'] }).exit === 2);
}

console.log('release-state: the command line');
{
    const dir = mkdtempSync(join(tmpdir(), 'viafrei-release-state-'));
    try {
        writeFileSync(join(dir, 'versions.json'), JSON.stringify(base.npmVersions));
        writeFileSync(join(dir, 'tags.txt'), `${base.tags.join('\n')}\n`);
        const args = (o = {}) => Object.entries({ live: '2.7.10', 'npm-latest': '2.7.10', 'npm-versions': join(dir, 'versions.json'), tags: join(dir, 'tags.txt'), registry: 'MCP Registry 2.7.8', smithery: 'Smithery 2.7.10', ...o }).flatMap(([k, v]) => [`--${k}`, v]);
        const ok = runTool(process.execPath, [SCRIPT, ...args()], { encoding: 'utf8' });
        check('exit 0 prints state= and dispatch= lines', ok === 'state=live\ndispatch=mcp-registry.yml\n', JSON.stringify(ok));
        let status;
        let stdout = '';
        try {
            runTool(process.execPath, [SCRIPT, ...args({ 'npm-latest': '2.7.8' })], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        } catch (error) {
            status = error.status;
            stdout = String(error.stdout);
        }
        check('stuck exits 1 and says so on stdout', status === 1 && stdout.startsWith('state=stuck\n'), `${status} ${stdout}`);
        status = undefined;
        try {
            runTool(process.execPath, [SCRIPT, ...args({ tags: join(dir, 'absent.txt') })], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        } catch (error) {
            status = error.status;
        }
        check('an unreadable file is exit 2', status === 2, String(status));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

console.log(`\n${String(passed())} passed, ${String(failures.length)} failed`);
if (failures.length > 0) process.exit(1);
