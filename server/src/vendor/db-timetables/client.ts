/**
 * The DB Timetables client, vendored from the platform's DB API Marketplace client and cut to the two
 * calls a departure board needs: `/plan` (the published timetable of one Berlin hour) and `/fchg` (every
 * change DB knows for the station). The one live provider call the MCP server makes; every other answer
 * comes from the ViaFrei API.
 *
 * Outcomes are cached (a 404 is an answer, a 429 is remembered briefly so a burst does not repeat it),
 * identical requests in flight are shared, and every request takes a slot of the 60-per-minute limiter.
 * The endpoint comes from DB_TIMETABLES_BASE_URL (the Timetables API base of the DB API Marketplace, as
 * its developer portal documents it) and the credentials from DB_API_CLIENT_ID and DB_API_CLIENT_SECRET;
 * an absent one is not an error: `configured` is false and the tool says one sentence about it.
 */
import { berlinWallClock } from "./berlin-time.js";
import { limiter as processLimiter, type RateLimiter } from "./rate-limiter.js";
import { redact } from "../../log.js";

export const DB_API_CREDENTIAL_VARS = ["DB_TIMETABLES_BASE_URL", "DB_API_CLIENT_ID", "DB_API_CLIENT_SECRET"] as const;

export type DbApiFailure = "not_configured" | "rate_limited" | "unavailable" | "not_found" | "bad_request";

export class DbApiError extends Error {
  constructor(readonly kind: DbApiFailure, message: string, readonly status?: number) {
    super(redact(message));
    this.name = "DbApiError";
  }
}

export type DbApiCredentials = { readonly baseUrl: string; readonly clientId: string; readonly apiKey: string };

/** Present and not blank. Blank counts as absent: a whitespace key is one 401 per call. */
export function dbApiCredentials(source: Record<string, string | undefined> = process.env): DbApiCredentials | null {
  const clientId = source["DB_API_CLIENT_ID"]?.trim() ?? "";
  const apiKey = source["DB_API_CLIENT_SECRET"]?.trim() ?? "";
  const baseUrl = (source["DB_TIMETABLES_BASE_URL"]?.trim() ?? "").replace(/\/+$/, "");
  if (baseUrl === "" || clientId === "" || apiKey === "") return null;
  return { baseUrl, clientId, apiKey };
}

export const NOT_CONFIGURED_MESSAGE = `the DB API Marketplace account is not configured: set ${DB_API_CREDENTIAL_VARS.join(", ")}. No request was made.`;

export type DbApiPayload = { readonly body: string; readonly url: string; readonly cached: boolean };

/** `/plan` is the published timetable for one hour, so it cannot change inside it. */
export const PLAN_TTL_MS = 60 * 60 * 1000;
/** The changes feed is the live half. 30 s collapses a burst and hides nothing. */
export const CHANGES_TTL_MS = 30 * 1000;
export const RATE_LIMITED_TTL_MS = 10 * 1000;
export const NOT_FOUND_TTL_MS = 5 * 60 * 1000;
export const DB_API_CACHE_MAX = 300;

/** `YYMMDD` and `HH` in Europe/Berlin: the API's date and hour are local, not UTC. */
export function planPathParts(at: Date): { date: string; hour: string } {
  const w = berlinWallClock(at);
  return { date: `${w.day.slice(2, 4)}${w.day.slice(5, 7)}${w.day.slice(8, 10)}`, hour: String(w.hour).padStart(2, "0") };
}

type CacheEntry =
  | { readonly kind: "payload"; readonly payload: DbApiPayload; readonly expiresAt: number }
  | { readonly kind: "failure"; readonly error: DbApiError; readonly expiresAt: number };

export type DbApiOptions = {
  readonly now?: () => number;
  readonly fetch?: typeof fetch;
  readonly credentials?: DbApiCredentials | null;
  readonly limiter?: RateLimiter;
  readonly timeoutMs?: number;
};

export class DbTimetablesClient {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<DbApiPayload>>();
  private hits = 0;
  private misses = 0;
  private readonly now: () => number;
  private readonly doFetch: typeof fetch;
  private readonly creds: DbApiCredentials | null;
  private readonly limiter: RateLimiter;
  private readonly timeoutMs: number;

  constructor(o: DbApiOptions = {}) {
    this.now = o.now ?? Date.now;
    this.doFetch = o.fetch ?? ((input, init) => fetch(input, init));
    this.creds = o.credentials !== undefined ? o.credentials : dbApiCredentials();
    this.limiter = o.limiter ?? processLimiter;
    this.timeoutMs = o.timeoutMs ?? 10_000;
  }

  get configured(): boolean {
    return this.creds !== null;
  }

  cacheHitRate(): number | null {
    const total = this.hits + this.misses;
    return total === 0 ? null : Math.round((this.hits / total) * 100) / 100;
  }

  plan(evaNo: string, at: Date): Promise<DbApiPayload> {
    const { date, hour } = planPathParts(at);
    return this.get(`${this.base()}/plan/${encodeURIComponent(evaNo)}/${date}/${hour}`, PLAN_TTL_MS);
  }

  fullChanges(evaNo: string): Promise<DbApiPayload> {
    return this.get(`${this.base()}/fchg/${encodeURIComponent(evaNo)}`, CHANGES_TTL_MS);
  }

  private base(): string {
    return this.creds?.baseUrl ?? "";
  }

  private async get(url: string, ttlMs: number): Promise<DbApiPayload> {
    const creds = this.creds;
    if (creds === null) throw new DbApiError("not_configured", NOT_CONFIGURED_MESSAGE);
    const hit = this.cache.get(url);
    if (hit !== undefined && hit.expiresAt > this.now()) {
      this.hits++;
      if (hit.kind === "failure") throw hit.error;
      return { ...hit.payload, cached: true };
    }
    const pending = this.inFlight.get(url);
    if (pending !== undefined) {
      this.hits++;
      return { ...(await pending), cached: true };
    }
    this.misses++;
    const load = this.load(url, ttlMs, creds);
    this.inFlight.set(url, load);
    try {
      return await load;
    } finally {
      this.inFlight.delete(url);
    }
  }

  private keep(url: string, entry: CacheEntry): void {
    this.cache.delete(url);
    while (this.cache.size >= DB_API_CACHE_MAX) {
      const oldest = this.cache.keys().next();
      if (oldest.done === true) break;
      this.cache.delete(oldest.value);
    }
    this.cache.set(url, entry);
  }

  private async load(url: string, ttlMs: number, creds: DbApiCredentials): Promise<DbApiPayload> {
    const release = await this.limiter.acquire();
    let res: Response;
    try {
      res = await this.doFetch(url, {
        headers: { "DB-Client-Id": creds.clientId, "DB-Api-Key": creds.apiKey, accept: "application/xml" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new DbApiError("unavailable", `db_timetables did not answer for ${url}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      release();
    }
    const shown = redact(url);
    if (res.status === 429) {
      this.limiter.penalise(RATE_LIMITED_TTL_MS);
      throw this.remember(url, new DbApiError("rate_limited", `db_timetables answered 429 (rate limited) for ${shown}`, 429), RATE_LIMITED_TTL_MS);
    }
    if (res.status === 404) throw this.remember(url, new DbApiError("not_found", `db_timetables knows no such station (404) for ${shown}`, 404), Math.min(ttlMs, NOT_FOUND_TTL_MS));
    if (res.status === 401 || res.status === 403) throw new DbApiError("not_configured", `db_timetables refused the credential (${res.status})`, res.status);
    if (res.status >= 500 || res.status === 408) throw new DbApiError("unavailable", `db_timetables answered ${res.status} for ${shown}`, res.status);
    if (res.status < 200 || res.status >= 300) throw new DbApiError("bad_request", `db_timetables answered ${res.status} for ${shown}`, res.status);
    const payload: DbApiPayload = { body: await res.text(), url: shown, cached: false };
    this.keep(url, { kind: "payload", payload, expiresAt: this.now() + ttlMs });
    return payload;
  }

  private remember(url: string, error: DbApiError, ttlMs: number): DbApiError {
    this.keep(url, { kind: "failure", error, expiresAt: this.now() + ttlMs });
    return error;
  }
}
