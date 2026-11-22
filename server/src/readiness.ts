/**
 * Readiness, apart from liveness.
 *
 *  * `/healthz` is LIVENESS: answered from process state only, no I/O, so a slow
 *    API cannot make it slow and a slow answer means the process is wedged.
 *  * `/readyz` is READINESS: one request to the API's own `/readyz`, under a
 *    deadline, answered `ok`, `slow` (past the deadline) or `degraded` (the API
 *    refused or was unreachable). One flight at a time, so a flood of probes
 *    costs the API one request at most.
 *
 * A `slow` or `degraded` answer is logged at most once per `warnEveryMs`, with
 * how many were suppressed since; the probe is public and says nothing more
 * than its one word.
 */
export type ReadyState = "ok" | "slow" | "degraded";


export type ReadinessOptions = {
  /** One readiness request to the API. Rejects on failure. */
  readonly ping: () => Promise<unknown>;
  /** The deadline, ms. The server sets 1 000. */
  readonly deadlineMs: number;
  /** Where a non-ok answer is recorded. */
  readonly warn?: (fields: Record<string, unknown>, message: string) => void;
  /**
   * At most one warn line per this many ms. The probe is public
   * and polled; during a stall every caller would otherwise write a line per
   * call. The count of answers folded into the next line is carried in it.
   */
  readonly warnEveryMs?: number;
  /** Injected clock, ms. */
  readonly now?: () => number;
};

export const READINESS_WARN_EVERY_MS = 10_000;

export const READINESS_DEADLINE_MS = 1_000;

export function createReadiness(o: ReadinessOptions): () => Promise<ReadyState> {
  const now = o.now ?? Date.now;
  const every = o.warnEveryMs ?? READINESS_WARN_EVERY_MS;
  let lastWarnAt = Number.NEGATIVE_INFINITY;
  let suppressed = 0;
  let inFlight: Promise<"ok" | "degraded"> | undefined;
  const run = (): Promise<"ok" | "degraded"> => {
    if (inFlight === undefined) {
      const started = o.ping().then(
        () => "ok" as const,
        () => "degraded" as const,
      );
      inFlight = started;
      void started.finally(() => { if (inFlight === started) inFlight = undefined; });
    }
    return inFlight;
  };
  return async () => {
    const t0 = Date.now();
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<"slow">((resolve) => { timer = setTimeout(() => { resolve("slow"); }, o.deadlineMs); });
    const state = await Promise.race([run(), deadline]);
    if (timer !== undefined) clearTimeout(timer);
    if (state !== "ok") {
      const at = now();
      if (at - lastWarnAt >= every) {
        o.warn?.({ state, ms: Date.now() - t0, suppressed }, state === "slow" ? "readyz: the API did not answer its readiness within the deadline" : "readyz: the API is not ready or unreachable");
        lastWarnAt = at;
        suppressed = 0;
      } else {
        suppressed += 1;
      }
    }
    return state;
  };
}
