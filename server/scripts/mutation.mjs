#!/usr/bin/env node
// Mutation testing of the server, StrykerJS over stryker.config.mjs: once per
// release (.github/workflows/mutation.yml, called by publish.yml), never per pull
// request. The scope is every .ts file under src/ except the generated operation
// table. A shard is a set of PIECES, not of files: a piece is a run of a file's
// top-level statements, given as Stryker's `file:start-end` line range, so one
// large file is spread over several shards and every shard ends inside the
// 15-minute job limit. A boundary falls only between two top-level statements, so
// every mutant lies inside exactly one piece. The pieces are dealt heaviest first,
// each to the lightest shard (weight: the statement's syntax nodes, types left
// out), so the N shards are disjoint, together the whole scope, and none is empty
// while there are N pieces with a weight or more.
//
//   node scripts/mutation.mjs full [DIR]          the whole scope, floor 70 % (npm run mutation)
//   node scripts/mutation.mjs plan N              print the N shards; exit 2 if one is empty
//   node scripts/mutation.mjs shard K/N DIR       mutate shard K of N, no floor; DIR gets
//                                                 mutation.json, mutation.html and scope.txt
//   node scripts/mutation.mjs gather DIR OUT.md   score the shard directories under DIR as
//                                                 one run: exit 1 below 70 %, exit 2 when a
//                                                 piece has no shard or two, or a mutant strays
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const FLOOR = 70;
/** The shards of the release run (mutation.yml's matrix). */
export const SHARDS = 8;
/** A piece holds consecutive top-level statements up to this weight; one heavier statement is a piece alone. */
export const PIECE_WEIGHT = 200;
const SERVER = resolve(fileURLToPath(new URL("..", import.meta.url)));
/** Generated files: pinned by their generator's --check, not mutated. */
export const GENERATED = ["src/api/operations.ts"];

/** Every in-scope file, relative to server/, sorted. */
export function inScope(root = SERVER) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(relative(root, p).split("\\").join("/"));
    }
  };
  walk(join(root, "src"));
  return out.filter((f) => !GENERATED.includes(f)).sort();
}

/** The weight of one statement: its syntax nodes, type annotations and type-only declarations left out. */
function weightOf(node) {
  if (ts.isTypeNode(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isImportDeclaration(node)) return 0;
  let w = 1;
  ts.forEachChild(node, (c) => { w += weightOf(c); });
  return w;
}

/**
 * The pieces of one file, in order: runs of top-level statements, each run as
 * heavy as PIECE_WEIGHT at most (a heavier statement alone). A run ends only
 * where the next statement starts on a later line, so a line range never cuts a
 * statement. A file with no statement is one piece of weight 0.
 */
export function piecesOf(file, root = SERVER) {
  const text = readFileSync(join(root, file), "utf8");
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const lineOf = (pos) => src.getLineAndCharacterOfPosition(pos).line + 1;
  const runs = [];
  for (const st of src.statements) {
    const s = { start: lineOf(st.getStart(src)), end: lineOf(st.getEnd()), weight: weightOf(st) };
    const last = runs.at(-1);
    if (last !== undefined && (s.start <= last.end || last.weight + s.weight <= PIECE_WEIGHT)) {
      last.end = Math.max(last.end, s.end);
      last.weight += s.weight;
    } else runs.push(s);
  }
  if (runs.length === 0) runs.push({ start: 1, end: Math.max(1, text.split("\n").length), weight: 0 });
  return runs.map((r) => ({ id: `${file}:${r.start}-${r.end}`, file, ...r }));
}

/** Every piece of the scope, in scope order. */
export function piecesOfScope(scope, root = SERVER) {
  return scope.flatMap((f) => piecesOf(f, root));
}

/** The file and line range of a piece id (`src/x.ts:3-40`). */
export function parsePiece(id) {
  const m = /^(.+):(\d+)-(\d+)$/.exec(id);
  if (!m) throw new Refusal(`'${id}' is not a piece (file:start-end)`);
  return { file: m[1], start: Number(m[2]), end: Number(m[3]) };
}

/** The n shards of the scope: piece ids, the heaviest piece first to the lightest shard (the lower k on a tie). */
export function planOf(scope, n, root = SERVER) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`bad shard count ${n}`);
  const all = piecesOfScope(scope, root);
  const order = all.map((p, i) => ({ p, i })).sort((a, b) => b.p.weight - a.p.weight || a.i - b.i);
  const shards = Array.from({ length: n }, () => ({ weight: 0, ids: [] }));
  for (const { p } of order) {
    let best = 0;
    for (let k = 1; k < n; k++) if (shards[k].weight < shards[best].weight) best = k;
    shards[best].weight += p.weight;
    shards[best].ids.push(p.id);
  }
  return shards.map((s) => ({ weight: s.weight, ids: s.ids.sort() }));
}

/** Shard k of n (1-based): its piece ids, sorted. */
export function shardOf(scope, k, n, root = SERVER) {
  if (!Number.isInteger(k) || !Number.isInteger(n) || n < 1 || k < 1 || k > n) throw new Error(`bad shard ${k}/${n}`);
  return planOf(scope, n, root)[k - 1].ids;
}

const DETECTED = new Set(["Killed", "Timeout"]);
const UNDETECTED = new Set(["Survived", "NoCoverage"]);
/** Not scored: Stryker leaves them out of the score too. */
const UNSCORED = new Set(["CompileError", "RuntimeError", "Ignored"]);

class Refusal extends Error {}

/**
 * Scores the shard directories under `dir` as one run. Each holds scope.txt (its
 * pieces) and mutation.json (Stryker's report). Throws a Refusal (exit 2) when a
 * piece of the scope is in no shard or in two, a shard has no report, a report
 * names a file none of its pieces is in or a mutant outside its pieces, or a
 * mutant has a status Stryker does not finish with. A file's mutants from several
 * shards are scored as one file.
 */
export function gather(dir, scope, root = SERVER) {
  const shards = readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()).sort();
  if (shards.length === 0) throw new Refusal(`no shard directory under ${dir}`);
  const expected = piecesOfScope(scope, root).map((p) => p.id);
  const owner = new Map();
  const files = {};
  for (const s of shards) {
    const scopeFile = join(dir, s, "scope.txt");
    const reportFile = join(dir, s, "mutation.json");
    if (!existsSync(scopeFile) || !existsSync(reportFile)) throw new Refusal(`shard ${s} has no ${existsSync(scopeFile) ? "mutation.json" : "scope.txt"}`);
    const mine = readFileSync(scopeFile, "utf8").split("\n").filter(Boolean);
    for (const id of mine) {
      if (owner.has(id)) throw new Refusal(`${id} is in two shards (${owner.get(id)}, ${s})`);
      owner.set(id, s);
    }
    const ranges = mine.map(parsePiece);
    const report = JSON.parse(readFileSync(reportFile, "utf8"));
    for (const [f, entry] of Object.entries(report.files ?? {})) {
      const own = ranges.filter((r) => r.file === f);
      if (own.length === 0) throw new Refusal(`shard ${s} reports ${f}, which is not in its scope`);
      for (const m of entry.mutants ?? []) {
        const line = m.location?.start?.line;
        if (!own.some((r) => line >= r.start && line <= r.end)) throw new Refusal(`shard ${s} reports ${f} mutant ${m.id} at line ${line}, outside its pieces`);
      }
      files[f] = files[f] === undefined ? entry : { ...files[f], mutants: [...(files[f].mutants ?? []), ...(entry.mutants ?? [])] };
    }
  }
  for (const id of expected) if (!owner.has(id)) throw new Refusal(`${id} has no report: no shard mutated it`);
  for (const id of owner.keys()) if (!expected.includes(id)) throw new Refusal(`${id} is in a shard but not in the scope`);

  const rows = [];
  const missed = [];
  const total = { killed: 0, timeout: 0, survived: 0, noCoverage: 0, unscored: 0 };
  for (const f of Object.keys(files).sort()) {
    const row = { killed: 0, timeout: 0, survived: 0, noCoverage: 0, unscored: 0 };
    for (const m of files[f].mutants ?? []) {
      if (m.status === "Killed") row.killed++;
      else if (m.status === "Timeout") row.timeout++;
      else if (m.status === "Survived") row.survived++;
      else if (m.status === "NoCoverage") row.noCoverage++;
      else if (UNSCORED.has(m.status)) row.unscored++;
      else throw new Refusal(`${f} mutant ${m.id} ended '${m.status}', not a final status`);
      if (UNDETECTED.has(m.status)) missed.push({ f, m });
    }
    for (const k of Object.keys(total)) total[k] += row[k];
    rows.push([f, row]);
  }
  const score = (r) => {
    const valid = r.killed + r.timeout + r.survived + r.noCoverage;
    return valid === 0 ? null : (100 * (r.killed + r.timeout)) / valid;
  };
  const all = score(total);
  if (all === null) throw new Refusal("the shards generated no scored mutant");
  const pass = all >= FLOOR;
  const pct = (s) => (s === null ? "–" : `${s.toFixed(2)} %`);
  const md = [
    `## Mutation testing: ${pct(all)} (floor ${FLOOR} %) — ${pass ? "pass" : "FAIL"}`,
    "",
    `${shards.length} shards, ${scope.length} files in scope (${expected.length} pieces), ${total.killed + total.timeout} of ${total.killed + total.timeout + total.survived + total.noCoverage} scored mutants detected (${total.unscored} not scored: compile or runtime errors, ignored).`,
    "",
    "| File | Score | Killed | Timeout | Survived | No coverage |",
    "|---|---:|---:|---:|---:|---:|",
    ...rows.map(([f, r]) => `| ${f} | ${pct(score(r))} | ${r.killed} | ${r.timeout} | ${r.survived} | ${r.noCoverage} |`),
    `| **all** | **${pct(all)}** | ${total.killed} | ${total.timeout} | ${total.survived} | ${total.noCoverage} |`,
    "",
    `### Not detected (${missed.length})`,
    "",
    ...missed.map(({ f, m }) => {
      const r = String(m.replacement ?? "").replace(/\s+/g, " ").replace(/`/g, "'");
      return `- ${f}:${m.location.start.line}:${m.location.start.column} ${m.mutatorName} ${m.status === "NoCoverage" ? "(no coverage)" : "(survived)"}: \`${r.length > 80 ? `${r.slice(0, 77)}...` : r}\``;
    }),
    "",
  ].join("\n");
  return { score: all, pass, md, files };
}

function stryker(env) {
  const bin = join(SERVER, "node_modules", ".bin", process.platform === "win32" ? "stryker.cmd" : "stryker");
  // CI=1: vitest never writes a missing snapshot, so a mutant that renames a test cannot pass by recording a new one.
  const r = spawnSync(bin, ["run"], { cwd: SERVER, stdio: "inherit", env: { ...process.env, ...env, CI: "1" } });
  return r.status ?? 1;
}

function parseShard(arg) {
  const m = /^(\d+)\/(\d+)$/.exec(arg ?? "");
  if (!m) throw new Refusal(`a shard is K/N, not '${arg}'`);
  return [Number(m[1]), Number(m[2])];
}

function main(argv) {
  const [cmd, a, b] = argv;
  const scope = inScope();
  if (cmd === "full") {
    return stryker({ MUTATION_REPORT_DIR: a ?? "reports/mutation" });
  }
  if (cmd === "plan") {
    const n = Number(a);
    if (!Number.isInteger(n) || n < 1) throw new Refusal(`plan N, not '${a}'`);
    const plan = planOf(scope, n);
    plan.forEach((s, i) => {
      if (s.weight === 0) throw new Refusal(`shard ${i + 1}/${n} has nothing to mutate: the scope has ${piecesOfScope(scope).filter((p) => p.weight > 0).length} pieces with a weight`);
      console.log(`shard ${i + 1}/${n} (weight ${s.weight}): ${s.ids.join(" ")}`);
    });
    return 0;
  }
  if (cmd === "shard") {
    const [k, n] = parseShard(a);
    if (!b) throw new Refusal("shard K/N DIR: no DIR");
    let files;
    try { files = shardOf(scope, k, n); } catch (e) { throw new Refusal(e.message); }
    if (planOf(scope, n)[k - 1].weight === 0) throw new Refusal(`shard ${k}/${n} has nothing to mutate: the scope has ${piecesOfScope(scope).filter((p) => p.weight > 0).length} pieces with a weight`);
    const dir = resolve(b);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "scope.txt"), `${files.join("\n")}\n`);
    console.log(`mutation shard ${k}/${n}: ${files.join(" ")}`);
    return stryker({ MUTATION_FILES: files.join("\n"), MUTATION_REPORT_DIR: relative(SERVER, dir), MUTATION_BREAK: "none" });
  }
  if (cmd === "gather") {
    if (!a || !b) throw new Refusal("gather DIR OUT.md");
    const g = gather(resolve(a), scope);
    writeFileSync(resolve(b), g.md);
    writeFileSync(resolve(a, "mutation.json"), JSON.stringify({ schemaVersion: "2", thresholds: { high: 85, low: FLOOR }, files: g.files }));
    console.log(g.md.split("\n")[0]);
    return g.pass ? 0 : 1;
  }
  throw new Refusal(`unknown command '${cmd ?? ""}': full, plan, shard or gather`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    console.error(`::error::mutation: ${e.message}`);
    process.exitCode = 2;
  }
}
