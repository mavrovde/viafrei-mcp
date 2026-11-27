#!/usr/bin/env node
// The pieces of the mutation shards lose no mutant and count none twice: Stryker's
// own instrumenter is run over the real scope once whole and once per shard of the
// release plan (SHARDS), with each shard's pieces as the mutate ranges a shard run
// gets, and the mutants must be the same set, each in exactly one shard. Offline,
// in-process and quick (no test is run): server.yml's unit job runs it.
//
//   node scripts/mutation-pieces.test.mjs
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Instrumenter } from "@stryker-mutator/instrumenter";
import { SHARDS, inScope, parsePiece, planOf } from "./mutation.mjs";

const SERVER = resolve(fileURLToPath(new URL("..", import.meta.url)));
const quiet = { isDebugEnabled: () => false, isTraceEnabled: () => false, isInfoEnabled: () => false, debug() {}, trace() {}, info() {}, warn() {}, error() {}, fatal() {} };
const options = { plugins: null, excludedMutations: [], ignorers: [] };
let failed = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failed++;
};

/** The mutants Stryker generates for `files` (name → mutate: true or Stryker's 0-based line ranges), as keys. */
async function mutantsOf(files) {
  const input = Object.entries(files).map(([name, mutate]) => ({ name, mutate, content: readFileSync(join(SERVER, name), "utf8") }));
  const { mutants } = await new Instrumenter(quiet).instrument(input, options);
  return mutants.map((m) => `${m.fileName}:${m.location.start.line}:${m.location.start.column}-${m.location.end.line}:${m.location.end.column} ${m.mutatorName} ${m.replacement}`);
}

const scope = inScope();
const whole = await mutantsOf(Object.fromEntries(scope.map((f) => [f, true])));
check("the whole scope has mutants", whole.length > 1000, `${whole.length}`);
const seen = new Map();
const plan = planOf(scope, SHARDS);
for (const [i, shard] of plan.entries()) {
  const files = {};
  for (const id of shard.ids) {
    const p = parsePiece(id);
    (files[p.file] ??= []).push({ start: { line: p.start - 1, column: 0 }, end: { line: p.end - 1, column: Number.MAX_SAFE_INTEGER } });
  }
  for (const key of await mutantsOf(files)) seen.set(key, [...(seen.get(key) ?? []), i + 1]);
}
const twice = [...seen].filter(([, ks]) => ks.length > 1);
const lost = whole.filter((k) => !seen.has(k));
const extra = [...seen.keys()].filter((k) => !whole.includes(k));
check(`every mutant of the whole run is in a shard of ${SHARDS}`, lost.length === 0, `${lost.length} lost, e.g. ${lost.slice(0, 3).join(" | ")}`);
check("no mutant is in two shards", twice.length === 0, twice.slice(0, 3).map(([k, ks]) => `${k} in ${ks.join(",")}`).join(" | "));
check("no shard mutates what the whole run does not", extra.length === 0, extra.slice(0, 3).join(" | "));
const counts = plan.map((_, i) => [...seen.values()].filter((ks) => ks[0] === i + 1).length);
// The mutant count is no measure of a shard's time (osm-words.ts's ~980 cheap mutants take about 4 minutes,
// 153 static mutants took shard 7 of the 2.7.11 run past 20): the plan deals by measured seconds, so the
// bound is on those. A shard over 1.25 times the mean is one piece alone (createMcpApp, a single top-level
// statement, cannot be cut by line range); and no shard is planned past 12 minutes, so a shard the fit
// misjudges by half again still ends inside its 20-minute job.
const meanS = plan.reduce((a, s) => a + s.seconds, 0) / SHARDS;
const heavy = plan.map((s, i) => [s, i]).filter(([s]) => s.seconds > 1.25 * meanS);
check(`no shard is planned over 1.25 times the mean (${Math.round(meanS)} s) unless it is one piece alone`,
  heavy.every(([s]) => s.ids.length === 1), heavy.map(([s, i]) => `${i + 1} (${s.seconds} s, ${s.ids.length} pieces)`).join(" "));
const slowest = Math.max(...plan.map((s) => s.seconds));
check("no shard is planned past 12 minutes", slowest <= 720, `${slowest} s`);
console.log(`mutants per shard: ${counts.join(" ")}`);
console.log(`planned seconds per shard: ${plan.map((s) => s.seconds).join(" ")}`);
console.log(`\nmutation-pieces self-test: ${failed === 0 ? "pass" : `${failed} failed`}`);
process.exit(failed === 0 ? 0 : 1);
