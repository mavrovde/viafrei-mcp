// Mutation testing of the server (StrykerJS, vitest runner): once per release,
// never per pull request. publish.yml calls .github/workflows/mutation.yml on the
// commit about to be published; it runs four shards and gathers them into one
// gate that stops the publish below 70 %. scripts/mutation.mjs drives every run
// (`npm run mutation` is the full run for a maintainer) and sets the variables
// read below; a bare `npx stryker run` is the full run with the floor.
// @ts-check
import { FLOOR, inScope } from "./scripts/mutation.mjs";

const env = process.env;
const reportDir = env.MUTATION_REPORT_DIR ?? "reports/mutation";
// A shard has no floor of its own: the gather scores the shards together.
const floor = env.MUTATION_BREAK === "none" ? null : FLOOR;

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.ts" },
  // A shard's files (newline-separated), else the whole scope: every source
  // file of the server; tests live under test/, and the generated operation
  // table (scripts/gen-operations.mjs) is pinned by check:operations, not by tests.
  mutate: env.MUTATION_FILES ? env.MUTATION_FILES.split("\n").filter(Boolean) : inScope(),
  // vitest strips types without checking them, so no file needs Stryker's
  // `// @ts-nocheck` header; left on, it rewrites the generated operation table
  // and the test that pins it to the contract fails the dry run.
  disableTypeChecks: false,
  checkers: [],
  coverageAnalysis: "perTest",
  thresholds: { high: 85, low: FLOOR, break: floor },
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: `${reportDir}/mutation.html` },
  jsonReporter: { fileName: `${reportDir}/mutation.json` },
  // In place, not in a sandbox copy of server/: test/catalogue.test.ts reads the
  // repository's catalogue.json one level above server/, which a sandbox under
  // server/.stryker-tmp would not have. Stryker restores every file when the run
  // ends (also on Ctrl-C); a run killed hard leaves mutants behind: `git status`.
  inPlace: true,
  tempDirName: ".stryker-tmp",
  cleanTempDir: "always",
  timeoutMS: 10000,
};
