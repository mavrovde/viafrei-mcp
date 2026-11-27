#!/usr/bin/env node
/**
 * Mutation testing's wiring (owner 2026-11-18): the full StrykerJS run of the
 * server once per release, cut into 18 shards of pieces (every job ends within 15
 * minutes, owner 2026-11-22, except the shards at 20: owner 2026-11-23, a viafrei-mcp
 * pipeline ends within 30) and gathered into one 70 % gate,
 * called by the npm workflow on the commit about to be published, and never on
 * a pull request or a push. Read off the workflow files and run:
 *
 *   - mutation.yml: triggers (the release call with a ref, a dispatch, nothing
 *     else), the plan, the 18-shard matrix (fail-fast off, 20 min each, each
 *     uploading its report), the gate job "Mutation testing" (needs the shards,
 *     runs unless cancelled, its shard-result guard RUN under bash, the gather,
 *     the job summary, the report artefact);
 *   - publish.yml: the mutation job calls mutation.yml on the tagged commit, and
 *     publish needs it next to Snyk;
 *   - the 18 shards of the real scope are disjoint, together every piece of every
 *     in-scope file, none empty, and leave out the generated operation table
 *     (that no MUTANT is lost or counted twice is server/scripts/mutation-pieces.test.mjs,
 *     which needs Stryker's instrumenter);
 *   - the gather on planted reports: exit 0 at the floor, 1 below it, 2 when a file is over its static bound, or when a
 *     piece has no report or two, a shard has no report, or a report or a mutant strays.
 * Then each planted fault in the workflows must be reported.
 *
 *   node scripts/mutation-workflow.test.mjs
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChecker } from './check-harness.mjs';
import { resolveTool, runTool } from './tools.mjs';
import { FLOOR, GENERATED, PIECE_WEIGHT, SHARDS, STATIC_CEILING, STATIC_MAX, WEIGHTS, gather, inScope, parsePiece, piecesOf, piecesOfScope, planOf, shardOf } from '../server/scripts/mutation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const WF = join(ROOT, '.github', 'workflows');
const SCRIPT = join(ROOT, 'server', 'scripts', 'mutation.mjs');
const { check, failures, passed } = createChecker();

const REF = '${{ inputs.ref || github.sha }}';
const TRIGGERS = '\non:\n  workflow_call:\n    inputs:\n      ref:\n        description: The commit to mutate (the release\'s tagged commit)\n        required: true\n        type: string\n  workflow_dispatch:\n\n';
const KS = Array.from({ length: SHARDS }, (_, i) => i + 1);
const MATRIX = `\n    timeout-minutes: 20\n    strategy:\n      fail-fast: false\n      matrix:\n        shard: [${KS.join(', ')}]\n`;
const SHARD_RUN = `run: node scripts/mutation.mjs shard "$SHARD/${SHARDS}" "$GITHUB_WORKSPACE/mutation-shard"\n`;
const SHARD_UPLOAD = '\n        with:\n          name: mutation-shard-${{ matrix.shard }}\n          path: mutation-shard/\n          if-no-files-found: error\n';
const GATE_HEAD = '\n  mutation:\n    name: Mutation testing\n    needs: [plan, shards]\n    if: ${{ !cancelled() }}\n';
const GATHER = 'run: node scripts/mutation.mjs gather "$GITHUB_WORKSPACE/mutation-shards" "$GITHUB_WORKSPACE/mutation-report.md"\n';
const SUMMARY = '\n        if: always()\n        run: if [[ -f mutation-report.md ]]; then cat mutation-report.md >> "$GITHUB_STEP_SUMMARY"; fi\n';
const CALLER = "\n  mutation:\n    name: Mutation\n    if: startsWith(github.ref, 'refs/tags/v')\n    permissions:\n      contents: read\n    uses: ./.github/workflows/mutation.yml\n    with:\n      ref: ${{ github.sha }}\n";
const PUBLISH_MUT = "(needs.mutation.result == 'success' || (needs.mutation.result == 'skipped' && github.event_name == 'workflow_dispatch' && inputs.dry_run))";

/** The text of one job: from `  <id>:` to the next job or the end. */
function job(text, id) {
    const jobs = text.slice(text.indexOf('\njobs:\n'));
    const start = jobs.indexOf(`\n  ${id}:\n`);
    if (start < 0) return '';
    const rest = jobs.slice(start + 1);
    const next = /\n {2}[a-z][\w-]*:\n/u.exec(rest.slice(1));
    return next === null ? rest : rest.slice(0, next.index + 1);
}

/** The gate's shard-result guard, dedented, as the runner hands it to bash. */
function guardOf(text) {
    const m = /\n {6}- name: Every shard finished with its reports\n(?: {8}.*\n)*? {8}run: \|\n((?: {10}.*\n)+)/u.exec(text);
    return (m?.[1] ?? '').replace(/^ {10}/gmu, '');
}

function runGuard(script, result) {
    try {
        runTool(resolveTool('bash'), ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], { env: { PATH: process.env.PATH ?? '', SHARDS: result }, stdio: 'ignore' });
        return 0;
    } catch (e) {
        return e.status ?? -1;
    }
}

function faults(files) {
    const out = [];
    const mu = files['mutation.yml'] ?? '';
    const on = /\non:\n([^]*?)\n(?=[a-z])/u.exec(mu)?.[1] ?? '';
    const triggers = [...on.matchAll(/^ {2}([a-z_]+):/gmu)].map((m) => m[1]);
    if (triggers.join() !== 'workflow_call,workflow_dispatch') out.push(`mutation.yml runs on ${triggers.join(', ')}, not the release call and a dispatch alone`);
    if (!mu.includes(TRIGGERS)) out.push("mutation.yml's trigger block is not the release call with a required ref and a dispatch");
    if (mu.includes('continue-on-error')) out.push('mutation.yml carries continue-on-error');
    if ((mu.match(/\n {10}ref: \$\{\{ inputs\.ref \|\| github\.sha \}\}\n/gu) ?? []).length !== 3) out.push(`mutation.yml does not check out ${REF} in each of its three jobs`);
    if (!job(mu, 'plan').includes(`run: node scripts/mutation.mjs plan ${SHARDS}\n`)) out.push(`mutation.yml's plan does not check the ${SHARDS} shards`);
    const shards = job(mu, 'shards');
    if (!/^ {4}needs: plan\n/mu.test(shards)) out.push("mutation.yml's shards do not need the plan");
    if (!shards.includes(MATRIX)) out.push(`mutation.yml's shards are not the ${SHARDS}-shard matrix with fail-fast off and 20 minutes each`);
    if (!shards.includes(SHARD_RUN)) out.push(`mutation.yml's shard does not run its 1/${SHARDS} of the scope`);
    if (!shards.includes(SHARD_UPLOAD)) out.push("mutation.yml's shard does not upload its report, failing when there is none");
    const gate = job(mu, 'mutation');
    if (!mu.includes(GATE_HEAD)) out.push("mutation.yml's gate is not 'Mutation testing', needing the plan and the shards and running unless cancelled");
    if (!/^ {6}- uses: actions\/download-artifact@[0-9a-f]{40} # v[\d.]+\n {8}with:\n {10}pattern: mutation-shard-\*\n {10}path: mutation-shards\n/mu.test(gate)) out.push("mutation.yml's gate does not download every shard's report");
    if (!gate.includes(GATHER)) out.push("mutation.yml's gate does not gather the shards into one report");
    if (!gate.includes(SUMMARY)) out.push("mutation.yml's gate does not put the report in the job summary");
    if (!/name: mutation-report\n {10}path: \|\n {12}mutation-report\.md\n {12}mutation-shards\/\n/u.test(gate)) out.push("mutation.yml's gate does not upload the report");
    const guard = guardOf(gate);
    if (guard === '') out.push('mutation.yml has no shard-result guard');
    else for (const [result, want] of [['success', 0], ['failure', 1], ['cancelled', 1], ['skipped', 1], ['', 1]]) {
        const got = runGuard(guard, result);
        if (got !== want) out.push(`the shard guard exits ${got} for shards '${result}', not ${want}`);
    }
    for (const [n, t] of Object.entries(files)) {
        if (n !== 'publish.yml' && t.includes('workflows/mutation.yml')) out.push(`${n} references workflows/mutation.yml; only publish.yml calls it`);
        if (n !== 'mutation.yml' && /stryker|scripts\/mutation\.mjs|npm run mutation/u.test(t)) out.push(`${n} runs mutation testing; only mutation.yml does`);
    }
    const pub = files['publish.yml'] ?? '';
    if (!pub.includes(CALLER)) out.push("publish.yml's mutation job does not call mutation.yml on the tagged commit");
    const publish = job(pub, 'publish');
    const needs = /^ {4}needs: \[([^\]]*)\]\n/mu.exec(publish)?.[1].split(/,\s*/u) ?? [];
    if (!needs.includes('mutation') || !needs.includes('snyk')) out.push("publish.yml's publish does not need mutation next to snyk");
    const cond = /^ {4}if: (.*)\n/mu.exec(publish)?.[1] ?? '';
    if (!cond.startsWith('${{ !cancelled() && ') || !cond.includes(` && ${PUBLISH_MUT} && `)) out.push("publish.yml's publish does not run only after a passed mutation run or a branch dry run");
    return out;
}

const files = Object.fromEntries(readdirSync(WF).filter((n) => n.endsWith('.yml')).map((n) => [n, readFileSync(join(WF, n), 'utf8')]));

console.log('the workflows as committed');
{
    const f = faults(files);
    check(`mutation testing runs once per release in ${SHARDS} shards, before publish, and nowhere else`, f.length === 0, f.join('; '));
}

console.log(`the ${SHARDS} shards of the real scope`);
const scope = inScope();
const pieces = piecesOfScope(scope);
{
    const shards = KS.map((k) => shardOf(scope, k, SHARDS));
    const all = shards.flat();
    check('the scope is the server source, not empty', scope.length >= 4 && scope.every((f) => f.startsWith('src/') && f.endsWith('.ts') && !f.endsWith('.test.ts')), scope.join(' '));
    check('the generated operation table is out of the scope', GENERATED.length > 0 && GENERATED.every((g) => !scope.includes(g)));
    check('every in-scope file has a piece, and a large one several', scope.every((f) => pieces.some((p) => p.file === f)) && pieces.length > scope.length);
    check("a file's pieces do not overlap", scope.every((f) => pieces.filter((p) => p.file === f).every((p, i, ps) => p.start <= p.end && (i === 0 || ps[i - 1].end < p.start))));
    {
        // Planted: a statement heavier than a piece, then two that share its last line, then one alone.
        const root = mkdtempSync(join(tmpdir(), 'mut-pieces-'));
        mkdirSync(join(root, 'src'));
        const heavy = `const a = [${Array.from({ length: PIECE_WEIGHT }, (_, i) => i).join(', ')}];`;
        writeFileSync(join(root, 'src', 'x.ts'), `${heavy} const b = 1;\n\n${heavy.replace('a', 'c')}\n`);
        writeFileSync(join(root, 'src', 'empty.ts'), '// nothing\n');
        const ids = piecesOf('src/x.ts', root).map((p) => p.id).join(' ');
        check('two statements on one line stay in one piece; a heavy one is a piece alone', ids === 'src/x.ts:1-1 src/x.ts:3-3', ids);
        const none = piecesOf('src/empty.ts', root);
        check('a file with no statement is one piece of weight 0', none.length === 1 && none[0].weight === 0 && none[0].id === 'src/empty.ts:1-2', JSON.stringify(none));
        rmSync(root, { recursive: true, force: true });
    }
    check('no shard is empty', planOf(scope, SHARDS).every((s) => s.ids.length > 0 && s.weight > 0), shards.map((s) => s.length).join(','));
    check('the shards are disjoint', new Set(all).size === all.length);
    check('together they are every piece', all.length === pieces.length && pieces.every((p) => all.includes(p.id)));
    let threw = 0;
    for (const [k, n] of [[0, 4], [5, 4], [1, 0], [1.5, 4]]) { try { shardOf(scope, k, n); } catch { threw++; } }
    check('a bad K/N is refused', threw === 4);
    const plan = spawnSync(process.execPath, [SCRIPT, 'plan', String(SHARDS)], { encoding: 'utf8' });
    check(`mutation.mjs plan ${SHARDS} passes on the real scope`, plan.status === 0, plan.stderr);
    const big = spawnSync(process.execPath, [SCRIPT, 'plan', String(pieces.filter((p) => p.weight > 0).length + 1)], { encoding: 'utf8' });
    check('a plan with an empty shard is exit 2', big.status === 2, `${big.status}`);
}

console.log('the gather on planted reports');
{
    const tmp = mkdtempSync(join(tmpdir(), 'mut-gather-'));
    const at = (line) => ({ start: { line, column: 1 }, end: { line, column: 2 } });
    const mutants = (line, killed, survived) => [
        ...Array.from({ length: killed }, (_, i) => ({ id: `k${line}-${i}`, mutatorName: 'BooleanLiteral', replacement: 'false', status: 'Killed', location: at(line) })),
        ...Array.from({ length: survived }, (_, i) => ({ id: `s${line}-${i}`, mutatorName: 'StringLiteral', replacement: '""', status: 'Survived', location: at(line) })),
    ];
    const N = 4;
    /** Four shard dirs over the real scope, each piece with `killed`/`survived` mutants at its first line; `edit` plants a fault. */
    const plantRun = (name, killed, survived, edit = () => {}) => {
        const dir = join(tmp, name);
        const shards = [1, 2, 3, 4].map((k) => ({ k, scope: shardOf(scope, k, N) }));
        for (const s of shards) {
            const files = {};
            for (const id of s.scope) {
                const p = parsePiece(id);
                (files[p.file] ??= { language: 'typescript', source: '', mutants: [] }).mutants.push(...mutants(p.start, killed, survived));
            }
            s.report = { schemaVersion: '2', files };
        }
        edit(shards);
        for (const s of shards) {
            if (s.skip) continue;
            const d = join(dir, `mutation-shard-${s.k}`);
            mkdirSync(d, { recursive: true });
            writeFileSync(join(d, 'scope.txt'), `${s.scope.join('\n')}\n`);
            if (s.report !== null) writeFileSync(join(d, 'mutation.json'), JSON.stringify(s.report));
        }
        return dir;
    };
    const cli = (dir) => spawnSync(process.execPath, [SCRIPT, 'gather', dir, join(dir, 'report.md')], { encoding: 'utf8' });

    const atFloor = plantRun('floor', FLOOR, 100 - FLOOR);
    const g = gather(atFloor, scope);
    check(`exactly ${FLOOR} % passes`, g.pass && Math.abs(g.score - FLOOR) < 1e-9, `${g.score}`);
    const owners = (f) => new Set([1, 2, 3, 4].filter((k) => shardOf(scope, k, N).some((id) => parsePiece(id).file === f))).size;
    const split = scope.find((f) => owners(f) > 1);
    check("a file spread over several shards is scored as one, with every shard's mutants", split !== undefined && g.files[split].mutants.length === 100 * pieces.filter((p) => p.file === split).length, String(split));
    const r0 = cli(atFloor);
    check('the gather at the floor is exit 0 and writes the report', r0.status === 0 && readFileSync(join(atFloor, 'report.md'), 'utf8').includes(`| **all** | **${FLOOR.toFixed(2)} %**`), `${r0.status} ${r0.stderr}`);
    check('the report lists every mutant not detected', readFileSync(join(atFloor, 'report.md'), 'utf8').includes(`### Not detected (${pieces.length * (100 - FLOOR)})`));
    const below = plantRun('below', FLOOR - 1, 100 - FLOOR + 1);
    check('below the floor is exit 1', cli(below).status === 1);
    const unscored = plantRun('unscored', FLOOR, 100 - FLOOR, (sh) => { for (const s of sh) for (const f of Object.values(s.report.files)) f.mutants.push({ ...f.mutants[0], id: `c${f.mutants[0].id}`, status: 'CompileError' }); });
    check('compile errors are not scored', Math.abs(gather(unscored, scope).score - FLOOR) < 1e-9);
    const foreign = (sh) => parsePiece(sh[1].scope.find((id) => !sh[0].scope.some((o) => parsePiece(o).file === parsePiece(id).file))).file;
    const refusals = [
        ['a shard missing', (sh) => { sh[2].skip = true; }, 'has no report: no shard mutated it'],
        ['a shard without its report', (sh) => { sh[1].report = null; }, 'has no mutation.json'],
        ['a piece in two shards', (sh) => { sh[0].scope.push(sh[1].scope[0]); }, 'is in two shards'],
        ['a report outside its shard', (sh) => { sh[0].report.files[foreign(sh)] = { mutants: [] }; }, 'which is not in its scope'],
        ['a mutant outside its pieces', (sh) => { Object.values(sh[0].report.files)[0].mutants.push({ id: 'x', status: 'Killed', location: at(999_999) }); }, 'outside its pieces'],
        ['a piece outside the scope', (sh) => { sh[0].scope.push('src/nope.ts:1-2'); }, 'is in a shard but not in the scope'],
        ['a mutant not finished', (sh) => { const f = Object.values(sh[3].report.files)[0]; f.mutants.push({ ...f.mutants[0], id: 'p', status: 'Pending' }); }, "ended 'Pending'"],
    ];
    // Static mutants: n of them planted in the shard that holds file f's first piece.
    const plantStatic = (f, n) => (sh) => {
        const s = sh.find((x) => x.scope.some((id) => parsePiece(id).file === f));
        const p = parsePiece(s.scope.find((id) => parsePiece(id).file === f));
        s.report.files[f].mutants.push(...Array.from({ length: n }, (_, i) => ({ id: `st${i}`, mutatorName: 'StringLiteral', replacement: '""', status: 'Killed', static: true, location: at(p.start) })));
    };
    const table = scope.find((f) => STATIC_CEILING[f] === undefined && pieces.some((p) => p.file === f && p.weight > 0));
    const ceiled = Object.keys(STATIC_CEILING)[0];
    check('a file at the static bound passes', gather(plantRun('static-at', FLOOR, 100 - FLOOR, plantStatic(table, STATIC_MAX)), scope).files[table] !== undefined);
    check('a file at its static ceiling passes', gather(plantRun('static-ceiling', FLOOR, 100 - FLOOR, plantStatic(ceiled, STATIC_CEILING[ceiled])), scope).files[ceiled] !== undefined);
    check('the static bound is small and every ceiling above it', STATIC_MAX <= 50 && Object.values(STATIC_CEILING).every((n) => n > STATIC_MAX), `${STATIC_MAX}`);
    refusals.push(
        ['a file over the static bound', plantStatic(table, STATIC_MAX + 1), `${table} has ${STATIC_MAX + 1} static mutants, over its bound of ${STATIC_MAX}`],
        ['a file over its static ceiling', plantStatic(ceiled, STATIC_CEILING[ceiled] + 1), `${ceiled} has ${STATIC_CEILING[ceiled] + 1} static mutants, over its bound of ${STATIC_CEILING[ceiled]}`],
    );
    for (const [label, edit, want] of refusals) {
        const r = cli(plantRun(label.replace(/\W+/gu, '-'), FLOOR, 100 - FLOOR, edit));
        check(`${label} is exit 2`, r.status === 2 && r.stderr.includes(want), `${r.status} ${r.stderr.trim()}`);
    }
    rmSync(tmp, { recursive: true, force: true });
}

console.log('each planted fault in the workflows is reported');
{
    const plant = (n, from, to) => {
        const t = files[n] ?? '';
        if (!t.includes(from)) return null;
        return { ...files, [n]: t.replace(from, to) };
    };
    const cases = [
        ['a pull_request trigger', 'not the release call and a dispatch alone', plant('mutation.yml', '  workflow_dispatch:\n', '  pull_request:\n  workflow_dispatch:\n')],
        ['a push trigger', 'not the release call and a dispatch alone', plant('mutation.yml', '  workflow_dispatch:\n', '  push:\n    branches: [main]\n  workflow_dispatch:\n')],
        ['the ref not required', 'with a required ref', plant('mutation.yml', '        required: true\n', '        required: false\n')],
        ['a shard short', `the ${SHARDS}-shard matrix`, plant('mutation.yml', `, ${SHARDS}]`, ']')],
        ['fail-fast on', `the ${SHARDS}-shard matrix`, plant('mutation.yml', 'fail-fast: false', 'fail-fast: true')],
        ['a longer shard timeout', `the ${SHARDS}-shard matrix`, plant('mutation.yml', '    timeout-minutes: 20\n    strategy:', '    timeout-minutes: 30\n    strategy:')],
        ['a shard of another count', `its 1/${SHARDS} of the scope`, plant('mutation.yml', `"$SHARD/${SHARDS}"`, '"$SHARD/4"')],
        ['a shard upload that may be empty', 'failing when there is none', plant('mutation.yml', 'if-no-files-found: error', 'if-no-files-found: ignore')],
        ['the gate renamed', "is not 'Mutation testing'", plant('mutation.yml', 'name: Mutation testing\n', 'name: Mutation\n')],
        ['the gate not needing the shards', "is not 'Mutation testing'", plant('mutation.yml', 'needs: [plan, shards]', 'needs: [plan]')],
        ['the gate if: always()', "is not 'Mutation testing'", plant('mutation.yml', '    if: ${{ !cancelled() }}\n', '    if: always()\n')],
        ['the guard accepting a failure', "exits 0 for shards 'failure'", plant('mutation.yml', '[[ $SHARDS == success ]] ||', '[[ $SHARDS != cancelled ]] ||')],
        ['the guard removed', 'no shard-result guard', plant('mutation.yml', '- name: Every shard finished with its reports', '- name: Shards')],
        ['continue-on-error on a shard', 'carries continue-on-error', plant('mutation.yml', '    timeout-minutes: 20\n    strategy:', '    timeout-minutes: 20\n    continue-on-error: true\n    strategy:')],
        ['no gather', 'gather the shards', plant('mutation.yml', 'scripts/mutation.mjs gather', 'scripts/mutation.mjs full')],
        ['no summary', 'job summary', plant('mutation.yml', '>> "$GITHUB_STEP_SUMMARY"', '> /dev/null')],
        ['no report artefact', 'upload the report', plant('mutation.yml', 'name: mutation-report\n', 'name: report\n')],
        ['a shard on the branch head', 'in each of its three jobs', plant('mutation.yml', `ref: ${REF}\n          persist-credentials: false\n      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0\n        with:\n          node-version: '24'\n          cache`, `ref: \${{ github.sha }}\n          persist-credentials: false\n      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0\n        with:\n          node-version: '24'\n          cache`)],
        ['publish not needing mutation', 'does not need mutation next to snyk', plant('publish.yml', 'needs: [snyk, mutation, server-e2e-api]', 'needs: [snyk, server-e2e-api]')],
        ['publish past a failed mutation run', 'only after a passed mutation run', plant('publish.yml', ` && ${PUBLISH_MUT}`, '')],
        ['the mutation job on a branch dispatch', "mutation job does not call", plant('publish.yml', "    name: Mutation\n    if: startsWith(github.ref, 'refs/tags/v')\n", '    name: Mutation\n')],
        ['a second caller', 'ci.yml references workflows/mutation.yml', plant('ci.yml', '\njobs:\n', '\njobs:\n  m:\n    uses: ./.github/workflows/mutation.yml\n')],
        ['mutation in CI', 'ci.yml runs mutation testing', plant('ci.yml', '\njobs:\n', '\njobs:\n  x:\n    steps:\n      - run: npx stryker run\n')],
    ];
    for (const [label, want, f] of cases) {
        if (f === null) { check(`${label}: the plant applies`, false, 'the planted text is not in the file'); continue; }
        const got = faults(f).join('; ');
        check(`${label} is reported`, got.includes(want), got);
    }
}

// Stryker runs vitest on worker THREADS (cheaper per mutant than forks, 2.7.2) with its own vitest config:
// a worker thread refuses the V8 flags vitest.config.ts passes in execArgv (--expose-gc), which failed every
// shard's dry run in 2.7.0. The one case that needs a real collection is declared off there by name, and
// anywhere else a missing gc still fails it.
{
    const stryker = (await import('../server/stryker.config.mjs')).default;
    const read = (f) => readFileSync(join(ROOT, 'server', f), 'utf8');
    const argvOf = (text) => /execArgv:\s*\[([^\]]*)\]/u.exec(text)?.[1];
    const main = read('vitest.config.ts');
    check('the main suite keeps --expose-gc (precondition)', (argvOf(main) ?? '').includes('--expose-gc'), argvOf(main));
    check('the main suite does not declare the gc case off', !main.includes('MUTATION_NO_GC'), '');
    const file = stryker.vitest?.configFile ?? '';
    check('Stryker runs vitest on its own config', file !== '' && file !== 'vitest.config.ts', file);
    check('Stryker runs vitest on threads, not forks', stryker.vitest?.pool === undefined || stryker.vitest.pool === 'threads', String(stryker.vitest?.pool));
    const own = file === '' ? '' : read(file);
    check('Stryker\'s vitest config passes no V8 flag a thread refuses', argvOf(own) !== undefined && argvOf(own).trim() === '' && !own.includes('mergeConfig('), String(argvOf(own)));
    check('Stryker\'s vitest config declares the gc case off', /MUTATION_NO_GC:\s*"1"/u.test(own), '');
    // A mutant that leaves a request unanswered fails its test here, inside Stryker's timeout, rather than
    // timing out: a timeout costs the shard Stryker's whole wait and a restarted worker (2.7.2's first proof).
    const testMs = Number(/testTimeout:\s*([\d_]+)/u.exec(own)?.[1]?.replaceAll('_', '') ?? NaN);
    check('Stryker\'s vitest fails a hanging test before Stryker\'s own timeout', testMs > 0 && testMs < stryker.timeoutMS && /hookTimeout:\s*[\d_]+/u.test(own), String(testMs));
    const cap = read('test/transport/session-cap.test.ts');
    check('the gc case is skipped only where MUTATION_NO_GC is declared', /it\.skipIf\(process\.env\.MUTATION_NO_GC === "1"\)\("a held stream survives a garbage collection/u.test(cap), '');
    check('a missing gc elsewhere still fails the case', /typeof gc !== "function"\) \{\s*throw new Error/u.test(cap), '');
}

// The shards are dealt by measured seconds (server/scripts/mutation-weights.json): every piece of the scope
// has one, and a piece without one is refused by name rather than dealt by a guess.
{
    const ids = piecesOfScope(inScope()).map((p) => p.id);
    const unweighted = ids.filter((id) => typeof WEIGHTS[id] !== 'number');
    check('every piece of the scope has a measured weight', unweighted.length === 0, unweighted.slice(0, 5).join(' '));
    const { [ids[0]]: _, ...without } = WEIGHTS;
    let refused = '';
    try { planOf(inScope(), SHARDS, undefined, without); } catch (e) { refused = String(e.message); }
    check('a piece with no weight is refused by name', refused.includes(ids[0]) && refused.includes('no measured weight'), refused);
    const plan = planOf(inScope(), SHARDS);
    const slowestPiece = Math.max(...ids.map((id) => WEIGHTS[id] ?? 0));
    const slowest = Math.max(...plan.map((x) => x.seconds));
    check('no shard is measured slower than 10 minutes, or than its slowest piece alone', slowest <= Math.max(600, slowestPiece), `${slowest} s; piece ${slowestPiece} s`);
    // The weights are fitted to two measured runs within ~43 %, so a shard dealt 10 minutes lands near 14 at worst,
    // inside the shards' 20-minute limit; 2.7.2's proof had shard 8 at 19.4 when its timed-out static table
    // (src/tools/facilities.ts:61-71, 63 timeouts) was weighed as 46 s.
    check('no shard is dealt more than 10 minutes', slowest <= 600, `${slowest} s`);
    const mean = plan.reduce((sum, x) => sum + x.seconds, 0) / plan.length;
    const crowded = plan.filter((x) => x.ids.length > 1 && x.ids.some((id) => (WEIGHTS[id] ?? 0) > mean));
    check('a piece heavier than the mean shard has a shard of its own', crowded.length === 0, crowded.map((x) => x.ids.join(' ')).join(' | '));
    const stale = Object.keys(WEIGHTS).filter((id) => !ids.includes(id));
    check('the weights name no piece the scope does not have', stale.length === 0, stale.slice(0, 5).join(' '));
}

// Stryker mutates the sources in place, so a test that reads them (test/static-tables.test.ts) would see the
// instrumented code and fail Stryker's dry run: Stryker's vitest config leaves it out, the defaults kept.
{
    const cfg = readFileSync(join(ROOT, 'server', 'vitest.stryker.config.ts'), 'utf8');
    check("Stryker's vitest leaves out the source-reading table test, keeping vitest's default excludes",
        /exclude:\s*\[\s*\.\.\.configDefaults\.exclude,\s*"test\/static-tables\.test\.ts"\s*\]/u.test(cfg) && existsSync(join(ROOT, 'server', 'test', 'static-tables.test.ts')));
}

console.log(`\nmutation-workflow self-test: ${passed()} passed, ${failures.length} failed`);
process.exit(failures.length === 0 ? 0 : 1);
