/**
 * The typed ViaFrei API client: the one source of every answer the MCP server gives. The base URL and the key come from the environment (VIAFREI_API_URL,
 * VIAFREI_API_KEY); the operations, their paths and parameter names come from the contract
 * (`test/fixtures/api-openapi.json`, through the generated `operations.ts`), so no path is spelled by hand.
 */
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
  readonly licenceUrl?: string;
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
export type FreshnessEntry = { readonly family: string; readonly dataAsOf: string | null; readonly ageS?: number | null; readonly stale?: boolean };
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
  readonly page?: { readonly limit?: number; readonly hasMore?: boolean; readonly nextCursor?: string | null };
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
      if (v === undefined || v === null || v === "") continue;
      q.set(name, Array.isArray(v) ? v.join(",") : String(v));
    }
    const qs = q.toString();
    return `${this.config.baseUrl}${path}${qs === "" ? "" : `?${qs}`}`;
  }

  async get<D>(op: OperationId, params: Params = {}): Promise<Envelope<D>> {
    return this.send<D>(op, params, undefined);
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
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.config.key !== null) headers["x-api-key"] = this.config.key;
    if (body !== undefined) headers["content-type"] = "application/json";
    let res: Response;
    try {
      res = await this.doFetch(url, {
        method: OPERATIONS[op].method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new ApiError("unavailable", `the ViaFrei API did not answer ${op}: ${err instanceof Error ? err.name : "error"}`);
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text === "" ? null : JSON.parse(text);
    } catch {
      json = null;
    }
    if (res.status >= 200 && res.status < 300) {
      if (json === null || typeof json !== "object" || !("data" in json)) throw new ApiError("unavailable", `${op} answered ${res.status} without a body`, res.status);
      return json as Envelope<D>;
    }
    const problem = json !== null && typeof json === "object" ? (json as Problem) : null;
    const detail = problem?.detail ?? problem?.title ?? `HTTP ${res.status}`;
    const kind: ApiFailure =
      res.status === 401 ? "not_configured"
      : res.status === 403 ? "refused"
      : res.status === 404 ? "not_found"
      : res.status === 400 || res.status === 422 ? "invalid"
      : res.status === 429 ? "rate_limited"
      : "unavailable";
    throw new ApiError(kind, `${op}: ${detail}`, res.status, problem);
  }
}
