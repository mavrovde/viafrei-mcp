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
// mutation time. A shard's time is split over its pieces by their cost, in
// seconds as fitted by least squares to the 35 measured shard times of the
// 2.7.10 and 2.7.11 release runs: 0.22 per mutant, 1.52 per STATIC mutant
// instead (Stryker runs the whole suite for each, with a fresh module), 0.0028
// per test that covers a mutant, and 8.87 more when it timed out. The earlier
// cost (1 a mutant, 1 a covering test, 200 a timeout) weighed a static mutant
// like any other, which dealt app.ts's, catalogue.ts's, server-card.ts's and
// watch-words.ts's static mutants into one shard (shard 7 of the 2.7.11 run,
// past its 20 minutes twice). Re-measure after a change that
// moves a piece boundary; the self-tests fail on a piece with no weight. The committed
// file was then fitted to a second run as well (see its _about).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const COST = { mutant: 0.2216, staticMutant: 1.5188, coveringTest: 0.0028, timeout: 8.874 };
const [dir, logFile, run] = process.argv.slice(2);
if (!dir || !logFile || !run) {
  console.error("usage: node scripts/mutation-weights.mjs SHARDS_DIR RUN_LOG RUN_ID");
  process.exit(2);
}

const doneOf = new Map();
for (const line of readFileSync(logFile, "utf8").split("\n")) {
  const m = /^(?:Mutation \/ )?Mutation shard \((\d+)\)\t.*Done in (?:(\d+) minutes? and )?(\d+) seconds?\./u.exec(line);
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
      p.cost += (mu.static ? COST.staticMutant : COST.mutant) + COST.coveringTest * (mu.coveredBy ?? []).length + (mu.status === "Timeout" ? COST.timeout : 0);
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
