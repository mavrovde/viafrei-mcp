/**
 * The typed ViaFrei API client: the one source of every answer the MCP server gives. The base URL and the key come from the environment (VIAFREI_API_URL,
 * VIAFREI_API_KEY); the operations, their paths and parameter names come from the contract
 * (`test/fixtures/api-openapi.json`, through the generated `operations.ts`), so no path is spelled by hand.
 * A proposed operation (`test/fixtures/api-proposed.json`, in no released API yet) is asked only once the API's own
 * OpenAPI document lists it: that document is read once per process and API, kept for DISCOVERY_TTL_MS, and while it
 * does not list the operation no request for it is sent (the API counts every unknown path, a 404 or 405, against the
 * key from API 2.0.4, so a probe on every call would run the server into 429s). While the document cannot be read, a tool takes
 * the released operations, as the server did before the proposals; the failed read is logged at warn, once per read.
 */
import { log } from "../log.js";
import { OPERATIONS, type OperationId } from "./operations.js";

export const DEFAULT_API_URL = "https://api.viafrei.de";

export type ApiConfig = {
  readonly baseUrl: string;
  readonly key: string | null;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
};

export function apiConfigFromEnv(env: Record<string, string | undefined> = process.env): ApiConfig {
  const key = env["VIAFREI_API_KEY"]?.trim() ?? "";
  const timeout = Number(env["VIAFREI_API_TIMEOUT_MS"] ?? "");
  return {
    baseUrl: (env["VIAFREI_API_URL"]?.trim() || DEFAULT_API_URL).replace(/\/+$/, ""),
    key: key === "" ? null : key,
    ...(Number.isFinite(timeout) && timeout > 0 ? { timeoutMs: timeout } : {}),
  };
}

/** Contract types: the fields the renderers read, as `openapi.json` names them. */
export type LatLon = { readonly lat: number; readonly lon: number };
export type Attribution = {
  readonly family: string;
  readonly domain?: string;
  readonly publisher?: string;
  readonly text: string;
  readonly licence?: string;
  readonly licenceUrl?: string | null;
  readonly shareAlike?: boolean;
  readonly shareAlikeOffer?: string | null;
  readonly termsUrl?: string | null;
};
export type Notes = { readonly condition: readonly string[]; readonly purpose: readonly string[] };
export type DataWarning = { readonly code: string; readonly detail?: string };
export type TermsBody = { readonly lang: string; readonly binding: boolean; readonly heading: string; readonly body: string; readonly url: string };
export type TermsOffer = {
  readonly parameter: "accept_terms";
  readonly accept: string;
  readonly id: string;
  readonly version: string;
  readonly inForceFrom: string;
  readonly providerTerms: string;
  readonly texts: readonly TermsBody[];
};
export type FreshnessEntry = {
  readonly family: string; readonly dataAsOf: string | null; readonly ageS?: number | null; readonly stale?: boolean;
  /** Proposed: when the family's feed was last asked, also when it answered "unchanged" (listSources' SourceStamp). */
  readonly lastCheckedAt?: string | null;
};
export type DataMeta = {
  readonly requestId: string;
  readonly generatedAt: string;
  readonly language: string;
  readonly asOf?: string | null;
  readonly freshness?: readonly FreshnessEntry[];
  readonly attribution?: readonly Attribution[];
  readonly notes?: Notes;
  readonly warnings?: readonly DataWarning[];
  readonly terms?: readonly TermsOffer[];
  readonly page?: { readonly limit?: number; readonly hasMore?: boolean; readonly nextCursor?: string | null; readonly total?: number };
  readonly [k: string]: unknown;
};
export type Envelope<D> = { readonly data: D; readonly meta: DataMeta };

export type Problem = {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly code?: string;
  readonly retryable?: boolean;
  readonly retryAfter?: number;
  readonly terms?: readonly TermsOffer[];
  readonly [k: string]: unknown;
};

export type ApiFailure = "not_configured" | "not_found" | "invalid" | "refused" | "rate_limited" | "unavailable";

export class ApiError extends Error {
  constructor(readonly kind: ApiFailure, message: string, readonly status: number | null = null, readonly problem: Problem | null = null) {
    super(message);
    this.name = "ApiError";
  }
}

export type ParamValue = string | number | boolean | readonly string[] | undefined | null;
export type Params = Readonly<Record<string, ParamValue>>;

/** The API's own OpenAPI document, the address getMeta's `openapi` names: which operations this API offers. */
export const OPENAPI_PATH = "/v1/openapi.json";
/** How long the API's list of operations is trusted before it is read again. */
export const DISCOVERY_TTL_MS = 10 * 60_000;
/** How long a failed read of that list is said again, without a request, before it is read again. */
export const DISCOVERY_RETRY_MS = 15_000;

type Discovery = { at: number; offered?: ReadonlySet<string>; failure?: ApiError; pending?: Promise<ReadonlySet<string>> };
/** Per API (its config, which every language's client shares): what its document lists, or why it could not be read. */
let discoveries = new WeakMap<ApiConfig, Discovery>();
/** Forget every API's list of operations (tests that change what the mock API offers). */
export function forgetDiscovery(): void {
  discoveries = new WeakMap();
}

/**
 * A failed read of the document: its own kind, except a 404, which here means the document was not served (not that
 * an operation is not offered) and so is never read as "not offered".
 */
const discoveryFailure = (err: unknown): ApiError => {
  const e = err instanceof ApiError ? err : new ApiError("unavailable", "the ViaFrei API did not answer its OpenAPI document");
  const message = `the ViaFrei API's list of operations (${OPENAPI_PATH}) could not be read: ${e.message}`;
  return new ApiError(e.kind === "not_found" ? "unavailable" : e.kind, message, e.status, e.problem);
};

/** `lat,lon` as the contract's `at` parameter spells it. */
export const atParam = (p: LatLon): string => `${Number(p.lat.toFixed(6))},${Number(p.lon.toFixed(6))}`;

export class ApiClient {
  private readonly doFetch: typeof fetch;
  private readonly timeoutMs: number;
  /**
   * `lang`: the language of the answers' texts (source notes, rules texts, notices), sent as the contract's `lang`
   * query parameter to every operation that takes it; undefined leaves it to the API (German).
   */
  constructor(readonly config: ApiConfig, readonly lang?: "de" | "en") {
    this.doFetch = config.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = config.timeoutMs ?? 15_000;
  }

  /** The same client, asking for its answers' texts in `lang` (one tool call's language). */
  withLanguage(lang: "de" | "en"): ApiClient {
    return new ApiClient(this.config, lang);
  }

  /** The request URL of an operation, with its path parameters filled and its query in contract order. */
  url(op: OperationId, params: Params = {}): string {
    const spec = OPERATIONS[op];
    let path: string = spec.path;
    for (const name of spec.pathParams as readonly string[]) {
      const v = params[name];
      if (v === undefined || v === null || v === "") throw new ApiError("invalid", `${op} needs ${name}`);
      path = path.replace(`{${name}}`, encodeURIComponent(String(v)));
    }
    const q = new URLSearchParams();
    for (const name of spec.query as readonly string[]) {
      const v = name === "lang" ? (params[name] ?? this.lang) : params[name];
      if (v === undefined || v === null) continue;
      // An empty list is skipped as "" is: the API answers an empty query value (`name=`) 400 "empty value".
      const value = Array.isArray(v) ? v.join(",") : String(v);
      if (value === "") continue;
      q.set(name, value);
    }
    const qs = q.toString();
    return `${this.config.baseUrl}${path}${qs === "" ? "" : `?${qs}`}`;
  }

  async get<D>(op: OperationId, params: Params = {}): Promise<Envelope<D>> {
    return this.send<D>(op, params, undefined);
  }

  /**
   * Whether the API offers an operation: a contract operation always; a proposed one only when the API's own document
   * lists it. A failed read of the document throws (rate_limited, unavailable, …): it is reported, never "not offered".
   */
  async offers(op: OperationId): Promise<boolean> {
    if (!("proposed" in OPERATIONS[op])) return true;
    return (await this.offered()).has(op);
  }

  private offered(): Promise<ReadonlySet<string>> {
    const now = Date.now();
    const d = discoveries.get(this.config);
    if (d?.pending !== undefined) return d.pending;
    if (d?.offered !== undefined && now - d.at < DISCOVERY_TTL_MS) return Promise.resolve(d.offered);
    if (d?.failure !== undefined && now - d.at < DISCOVERY_RETRY_MS) return Promise.reject(d.failure);
    const pending = this.readOperations().then(
      (offered) => {
        discoveries.set(this.config, { at: Date.now(), offered });
        return offered;
      },
      (err: unknown) => {
        const failure = discoveryFailure(err);
        discoveries.set(this.config, { at: Date.now(), failure });
        log.warn({ kind: failure.kind, status: failure.status, document: OPENAPI_PATH }, "the API's list of operations could not be read; proposed operations are not asked, the released ones answer");
        throw failure;
      },
    );
    discoveries.set(this.config, { at: now, pending });
    return pending;
  }

  /** The operation ids the API's own OpenAPI document lists. */
  private async readOperations(): Promise<ReadonlySet<string>> {
    const res = await this.fetchJson(`${this.config.baseUrl}${OPENAPI_PATH}`, "GET", undefined, "the OpenAPI document");
    const paths = res.json !== null && typeof res.json === "object" ? (res.json as { paths?: unknown }).paths : undefined;
    if (!res.ok || paths === null || typeof paths !== "object") throw failureOf("the OpenAPI document", res.status, res.json, res.ok);
    const ids = new Set<string>();
    for (const item of Object.values(paths as Record<string, unknown>)) {
      if (item === null || typeof item !== "object") continue;
      for (const op of Object.values(item as Record<string, unknown>)) {
        const id = op !== null && typeof op === "object" ? (op as { operationId?: unknown }).operationId : undefined;
        if (typeof id === "string") ids.add(id);
      }
    }
    return ids;
  }

  /** A write operation of the contract (createRefresh), with its JSON body. */
  async post<D>(op: OperationId, body: unknown, params: Params = {}): Promise<Envelope<D>> {
    return this.send<D>(op, params, body);
  }

  private async send<D>(op: OperationId, params: Params, body: unknown): Promise<Envelope<D>> {
    if (this.config.key === null && op !== "getHealth" && op !== "getReadiness" && op !== "getMeta") {
      throw new ApiError("not_configured", "the ViaFrei API key is not configured (VIAFREI_API_KEY); no request was made");
    }
    const url = this.url(op, params);
    // A proposed operation the API's document does not list, or while the document cannot be read (that failure is
    // logged where it is read): answered as the API would (not offered), unsent, so the released path answers.
    if (!(await this.offers(op).catch(() => false))) throw new ApiError("not_found", `${op} is not offered by this API (not in ${OPENAPI_PATH}); no request was made`);
    const res = await this.fetchJson(url, OPERATIONS[op].method, body, op);
    const json = res.json;
    if (res.ok) {
      if (json === null || typeof json !== "object" || !("data" in json)) throw new ApiError("unavailable", `${op} answered ${res.status} without a body`, res.status);
      return json as Envelope<D>;
    }
    throw failureOf(op, res.status, json, false);
  }

  private async fetchJson(url: string, method: string, body: unknown, what: string): Promise<{ ok: boolean; status: number; json: unknown }> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.config.key !== null) headers["x-api-key"] = this.config.key;
    if (body !== undefined) headers["content-type"] = "application/json";
    let res: Response;
    try {
      res = await this.doFetch(url, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new ApiError("unavailable", `the ViaFrei API did not answer ${what}: ${err instanceof Error ? err.name : "error"}`);
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text === "" ? null : JSON.parse(text);
    } catch {
      json = null;
    }
    return { ok: res.status >= 200 && res.status < 300, status: res.status, json };
  }
}

/**
 * A problem's type as its code: the last path segment of its type URI (`…/problems/quota-exceeded` →
 * `quota-exceeded`); "" for a problem without a type, or `about:blank`.
 */
export function problemCode(problem: Problem | null): string {
  const type = typeof problem?.type === "string" ? problem.type : "";
  return type === "" || type === "about:blank" ? "" : (type.split("/").pop() ?? "");
}

/**
 * The API's failure as its kind: the status read, the problem body's detail said. A refusal under load
 * (`overloaded`, a 429 or a 503) is the API being unavailable for a moment, not the key's budget: it is told by
 * the problem type only (API 2.0.4 sends it RateLimit-Policy but no RateLimit field; a header is never read).
 * A 429 of any other type, also on a path the API answers 404 or 405 for (API 2.0.4 counts those against the
 * key), is the key's rate or quota (rate_limited).
 */
function failureOf(what: string, status: number, json: unknown, ok: boolean): ApiError {
  if (ok) return new ApiError("unavailable", `${what} answered ${status} without a body`, status);
  const problem = json !== null && typeof json === "object" ? (json as Problem) : null;
  const detail = problem?.detail ?? problem?.title ?? `HTTP ${status}`;
  const kind: ApiFailure =
    problemCode(problem) === "overloaded" ? "unavailable"
    : status === 401 ? "not_configured"
    : status === 403 ? "refused"
    : status === 404 ? "not_found"
    : status === 400 || status === 422 ? "invalid"
    : status === 429 ? "rate_limited"
    : "unavailable";
  return new ApiError(kind, `${what}: ${detail}`, status, problem);
}
