/**
 * The DB Timetables limiter, vendored from the platform's transport layer: spacing, concurrency and a
 * per-minute window. DB's terms for the Timetables API are 60 requests per minute per key; this enforces
 * at most 60 request starts in any rolling 61 s (one second of margin for the network), at most four in
 * flight (the most one board asks at once) and 100 ms between starts so a board's calls do not leave as
 * one burst. One instance per process: the quota is per key, so two limiters would be two spenders.
 */
export type Limit = { readonly minIntervalMs: number; readonly maxConcurrent: number; readonly perMinute?: number };

/** DB Timetables: 60 per minute, four in flight, 100 ms apart. */
export const DB_TIMETABLES_LIMIT: Limit = Object.freeze({ minIntervalMs: 100, maxConcurrent: 4, perMinute: 60 });

/** The rolling window `perMinute` counts starts over: one second longer than the minute, on purpose. */
export const PER_MINUTE_WINDOW_MS = 61_000;

export class RateLimiter {
  private nextAt = 0;
  private inFlight = 0;
  private starts: number[] = [];
  constructor(
    private readonly limit: Limit = DB_TIMETABLES_LIMIT,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  /** Waits for a slot; returns the release. */
  async acquire(): Promise<() => void> {
    const { minIntervalMs, maxConcurrent, perMinute } = this.limit;
    for (;;) {
      const now = this.now();
      let wait = this.nextAt - now;
      if (perMinute !== undefined) {
        const recent = this.window(now);
        if (recent.length >= perMinute) wait = Math.max(wait, recent[recent.length - perMinute]! + PER_MINUTE_WINDOW_MS - now);
      }
      if (this.inFlight < maxConcurrent && wait <= 0) break;
      await this.sleep(Math.max(wait, 10));
    }
    const at = this.now();
    this.nextAt = at + minIntervalMs;
    if (perMinute !== undefined) this.window(at).push(at);
    this.inFlight++;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.inFlight--;
      }
    };
  }

  /** Holds every request back until `forMs` from now (a 429 or a Retry-After); never shortens a longer hold. */
  penalise(forMs: number): void {
    this.nextAt = Math.max(this.nextAt, this.now() + Math.max(0, forMs));
  }

  private window(now: number): number[] {
    let drop = 0;
    while (drop < this.starts.length && this.starts[drop]! <= now - PER_MINUTE_WINDOW_MS) drop++;
    if (drop > 0) this.starts.splice(0, drop);
    return this.starts;
  }
}

/** The process-wide limiter. */
export const limiter = new RateLimiter();
