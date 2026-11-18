#!/usr/bin/env node
// Mutation testing of the server, StrykerJS over stryker.config.mjs: once per
// release (.github/workflows/mutation.yml, called by publish.yml), never per pull
// request. The scope is every .ts file under src/ except the generated operation
// table; sorted, the file at position p belongs to shard (p mod N) + 1, so the N
// shards are disjoint, together the whole scope, and none is empty while the
// scope has N files or more.
//
//   node scripts/mutation.mjs full [DIR]          the whole scope, floor 70 % (npm run mutation)
//   node scripts/mutation.mjs plan N              print the N shards; exit 2 if one is empty
//   node scripts/mutation.mjs shard K/N DIR       mutate shard K of N, no floor; DIR gets
//                                                 mutation.json, mutation.html and scope.txt
//   node scripts/mutation.mjs gather DIR OUT.md   score the shard directories under DIR as
//                                                 one run: exit 1 below 70 %, exit 2 when a
//                                                 scope file has no report or two
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const FLOOR = 70;
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

/** Shard k of n (1-based): the files at the positions p with p mod n = k - 1. */
export function shardOf(files, k, n) {
  if (!Number.isInteger(k) || !Number.isInteger(n) || n < 1 || k < 1 || k > n) throw new Error(`bad shard ${k}/${n}`);
  return files.filter((_, p) => p % n === k - 1);
}

const DETECTED = new Set(["Killed", "Timeout"]);
const UNDETECTED = new Set(["Survived", "NoCoverage"]);
/** Not scored: Stryker leaves them out of the score too. */
const UNSCORED = new Set(["CompileError", "RuntimeError", "Ignored"]);

class Refusal extends Error {}

/**
 * Scores the shard directories under `dir` as one run. Each holds scope.txt (its
 * files) and mutation.json (Stryker's report). Throws a Refusal (exit 2) when a
 * scope file is in no shard or in two, a shard has no report, a report names a
 * file outside its shard, or a mutant has a status Stryker does not finish with.
 */
export function gather(dir, scope) {
  const shards = readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()).sort();
  if (shards.length === 0) throw new Refusal(`no shard directory under ${dir}`);
  const owner = new Map();
  const files = {};
  for (const s of shards) {
    const scopeFile = join(dir, s, "scope.txt");
    const reportFile = join(dir, s, "mutation.json");
    if (!existsSync(scopeFile) || !existsSync(reportFile)) throw new Refusal(`shard ${s} has no ${existsSync(scopeFile) ? "mutation.json" : "scope.txt"}`);
    const mine = readFileSync(scopeFile, "utf8").split("\n").filter(Boolean);
    for (const f of mine) {
      if (owner.has(f)) throw new Refusal(`${f} is in two shards (${owner.get(f)}, ${s})`);
      owner.set(f, s);
    }
    const report = JSON.parse(readFileSync(reportFile, "utf8"));
    for (const [f, entry] of Object.entries(report.files ?? {})) {
      if (!mine.includes(f)) throw new Refusal(`shard ${s} reports ${f}, which is not in its scope`);
      files[f] = entry;
    }
  }
  for (const f of scope) if (!owner.has(f)) throw new Refusal(`${f} has no report: no shard mutated it`);
  for (const f of owner.keys()) if (!scope.includes(f)) throw new Refusal(`${f} is in a shard but not in the scope`);

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
    `${shards.length} shards, ${scope.length} files in scope, ${total.killed + total.timeout} of ${total.killed + total.timeout + total.survived + total.noCoverage} scored mutants detected (${total.unscored} not scored: compile or runtime errors, ignored).`,
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
  const r = spawnSync(bin, ["run"], { cwd: SERVER, stdio: "inherit", env: { ...process.env, ...env } });
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
    for (let k = 1; k <= n; k++) {
      const s = shardOf(scope, k, n);
      if (s.length === 0) throw new Refusal(`shard ${k}/${n} is empty: the scope has ${scope.length} files`);
      console.log(`shard ${k}/${n}: ${s.join(" ")}`);
    }
    return 0;
  }
  if (cmd === "shard") {
    const [k, n] = parseShard(a);
    if (!b) throw new Refusal("shard K/N DIR: no DIR");
    let files;
    try { files = shardOf(scope, k, n); } catch (e) { throw new Refusal(e.message); }
    if (files.length === 0) throw new Refusal(`shard ${k}/${n} is empty: the scope has ${scope.length} files`);
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
