import { configDefaults, defineConfig } from "vitest/config";
import base from "./vitest.config";

// Stryker's vitest (stryker.config.mjs): the suite of vitest.config.ts on worker
// threads, without its --expose-gc, a V8 flag a worker thread refuses
// (ERR_WORKER_INVALID_EXEC_ARGV). Threads cost each mutant less than forks.
// MUTATION_NO_GC declares the one case that needs a real collection (the
// session-cap gc case) off here; the main suite keeps the flag and runs it.
// 5 s per test and hook, not 20: a mutant that leaves a request unanswered fails
// its test inside Stryker's timeout instead of costing the wait and a restarted worker.
// test/static-tables.test.ts is left out: it reads the sources, and Stryker mutates them in place (inPlace),
// so in a Stryker run it would read the instrumented code and fail the dry run. Today it is not picked anyway
// (Stryker's vitest runs only the tests related to the mutated files, `related`, and it imports none); the
// exclusion keeps it out if `related` is ever turned off. The server suite runs it.
// Spread, not mergeConfig: mergeConfig concatenates arrays and keeps the flag.
export default defineConfig({ ...base, test: { ...base.test, exclude: [...configDefaults.exclude, "test/static-tables.test.ts"], execArgv: [], testTimeout: 5_000, hookTimeout: 5_000, env: { ...base.test?.env, MUTATION_NO_GC: "1" } } });
