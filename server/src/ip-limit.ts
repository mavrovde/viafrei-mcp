/**
 * The per-address bound on what one caller may cost this server.
 *
 * Two independent limits, because they bound two different things:
 *
 *  * **in flight** — how many JSON-RPC requests one address may have running
 *    AT ONCE. This is the one that protects the database: a tool call holds a
 *    connection to the API for as long as its call runs, and those are shared
 *    by every caller together. With the cap, no single address can hold all
 *    of them, however slow its calls;
 *  * **rate** — a token bucket per address, `ratePerMin` refilled continuously
 *    up to `burst`. It bounds the cheap-but-many case the first limit cannot
 *    see: a loop of fast calls that never overlap.
 *
 * Why the app and not the edge: the edge in front may serve other sites too and
 * need not have a rate limiter. The limit that can be reviewed, tested and
 * shipped with this server is the one in this server; an edge limit is a
 * second, coarser layer.
 *
 * **The shared-egress caveat, said here because it decides the defaults.**
 * Hosted assistants (claude.ai, ChatGPT) call MCP servers from their own
 * servers, so many people can arrive from one address. The defaults are
 * therefore sized for "one address must not take the whole pool" and not for
 * "one address is one person"; every knob is an environment variable, and a
 * refused caller gets `429` + `Retry-After`, which a well-behaved client waits
 * out rather than failing.
 *
 * Memory is bounded by `prune`, which drops every bucket that is full and has
 * nothing in flight — i.e. every address that would be treated as new anyway.
 */
export type IpLimitOptions = {
  /** Requests one address may have running at once. 0 = no in-flight limit. */
  readonly maxInflight: number;
  /** Sustained requests per minute per address. 0 = no rate limit. */
  readonly ratePerMin: number;
  /** Bucket size: how many requests may arrive back to back. */
  readonly burst: number;
  /** Injected clock, milliseconds. */
  readonly now?: () => number;
};

export type Admission =
  | { readonly ok: true; readonly release: () => void }
  | { readonly ok: false; readonly reason: "inflight" | "rate"; readonly retryAfterS: number };

type Bucket = { tokens: number; at: number; inflight: number };

export class IpLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly now: () => number;

  constructor(readonly options: IpLimitOptions) {
    this.now = options.now ?? Date.now;
  }

  private bucket(ip: string, now: number): Bucket {
    let b = this.buckets.get(ip);
    if (b === undefined) {
      b = { tokens: this.options.burst, at: now, inflight: 0 };
      this.buckets.set(ip, b);
      return b;
    }
    if (this.options.ratePerMin > 0) {
      b.tokens = Math.min(this.options.burst, b.tokens + ((now - b.at) / 60_000) * this.options.ratePerMin);
    }
    b.at = now;
    return b;
  }

  /**
   * Admit one request from `ip`. `holdsSlot` is false for a request whose
   * response is a long-lived stream (`GET /sse`, `GET /mcp`): it costs a token
   * to OPEN, but holding it open is not a running query and must not occupy
   * one of the address's in-flight slots for an hour.
   */
  admit(ip: string, holdsSlot = true): Admission {
    const now = this.now();
    const b = this.bucket(ip, now);
    const { maxInflight, ratePerMin } = this.options;
    if (holdsSlot && maxInflight > 0 && b.inflight >= maxInflight) {
      // Nothing to compute: a slot frees when a running call ends, which is
      // under a second for nearly every call this server answers.
      return { ok: false, reason: "inflight", retryAfterS: 1 };
    }
    if (ratePerMin > 0) {
      if (b.tokens < 1) {
        const waitMs = ((1 - b.tokens) / ratePerMin) * 60_000;
        return { ok: false, reason: "rate", retryAfterS: Math.max(1, Math.ceil(waitMs / 1000)) };
      }
      b.tokens -= 1;
    }
    if (!holdsSlot || maxInflight <= 0) return { ok: true, release: () => undefined };
    b.inflight += 1;
    let released = false;
    return {
      ok: true,
      // Idempotent: the release is wired to more than one end-of-request event
      // (the socket closing AND the answer leaving), and a double release would
      // hand the address a slot it never paid for.
      release: () => {
        if (released) return;
        released = true;
        b.inflight = Math.max(0, b.inflight - 1);
      },
    };
  }

  /** Drop every bucket that is full and idle; returns how many were dropped. */
  prune(): number {
    const now = this.now();
    let dropped = 0;
    for (const [ip] of this.buckets) {
      const b = this.bucket(ip, now);
      if (b.inflight === 0 && b.tokens >= this.options.burst) {
        this.buckets.delete(ip);
        dropped += 1;
      }
    }
    return dropped;
  }

  /** How many addresses are being tracked — for a test, and for the prune's proof. */
  get size(): number {
    return this.buckets.size;
  }

  /** In-flight count for one address — for a test. */
  inflight(ip: string): number {
    return this.buckets.get(ip)?.inflight ?? 0;
  }
}
