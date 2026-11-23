#!/usr/bin/env node
// The measured weight of every mutation piece: the seconds Stryker spent on it in
// one full release run, written to scripts/mutation-weights.json, which
// mutation.mjs deals the shards by (a piece without a weight is refused there).
//
//   node scripts/mutation-weights.mjs SHARDS_DIR RUN_LOG RUN_ID > scripts/mutation-weights.json
//
// SHARDS_DIR holds the run's mutation-shard-K artefacts (scope.txt and
// mutation.json each; `gh run download RUN_ID`), RUN_LOG the run's log
// (`gh run view RUN_ID --log`), whose "Done in" line gives each shard's
// mutation time. A shard's time is split over its pieces by their cost: per
// mutant 1, plus the tests that cover it, plus 200 when it timed out (the cost
// that fitted the measured shard times best). Re-measure after a change that
// moves a piece boundary; the self-tests fail on a piece with no weight. The committed
// file was then fitted to a second run as well (see its _about).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TIMEOUT_COST = 200;
const [dir, logFile, run] = process.argv.slice(2);
if (!dir || !logFile || !run) {
  console.error("usage: node scripts/mutation-weights.mjs SHARDS_DIR RUN_LOG RUN_ID");
  process.exit(2);
}

const doneOf = new Map();
for (const line of readFileSync(logFile, "utf8").split("\n")) {
  const m = /^Mutation shard \((\d+)\)\t.*Done in (?:(\d+) minutes? and )?(\d+) seconds?\./u.exec(line);
  if (m) doneOf.set(Number(m[1]), Number(m[2] ?? 0) * 60 + Number(m[3]));
}

const seconds = {};
for (const name of readdirSync(dir).filter((n) => /^mutation-shard-\d+$/u.test(n))) {
  const k = Number(name.slice("mutation-shard-".length));
  const time = doneOf.get(k);
  if (time === undefined) throw new Error(`the log has no "Done in" line for shard ${k}`);
  const ids = readFileSync(join(dir, name, "scope.txt"), "utf8").split(/\s+/u).filter(Boolean);
  const pieces = ids.map((id) => {
    const m = /^(.+):(\d+)-(\d+)$/u.exec(id);
    return { id, file: m[1], start: Number(m[2]), end: Number(m[3]), cost: 0 };
  });
  const report = JSON.parse(readFileSync(join(dir, name, "mutation.json"), "utf8"));
  for (const [file, f] of Object.entries(report.files)) {
    const rel = file.slice(file.indexOf("src/"));
    for (const mu of f.mutants) {
      const line = mu.location.start.line;
      const p = pieces.find((x) => x.file === rel && x.start <= line && line <= x.end);
      if (p === undefined) throw new Error(`shard ${k}: mutant ${mu.id} at ${rel}:${line} lies in none of its pieces`);
      p.cost += 1 + (mu.coveredBy ?? []).length + (mu.status === "Timeout" ? TIMEOUT_COST : 0);
    }
  }
  const total = pieces.reduce((s, p) => s + p.cost, 0);
  for (const p of pieces) seconds[p.id] = total === 0 ? 0 : Math.round((time * p.cost) / total * 10) / 10;
}

const sorted = Object.fromEntries(Object.entries(seconds).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
process.stdout.write(`${JSON.stringify({
  _about: "Seconds Stryker spent on each mutation piece, measured in one full run (scripts/mutation-weights.mjs); mutation.mjs deals the shards by them.",
  measuredIn: `mutation.yml run ${run}`,
  seconds: sorted,
}, null, 2)}\n`);
