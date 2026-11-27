/**
 * The MCP server's HTTP route table, as a value: `http.ts` is only the wiring that supplies its dependencies, and
 * the tests drive THIS app over a real socket. Carried route for route from the server this one replaces, so a
 * client meets the same answers, status codes and headers on every path.
 *
 * Two transports are served, and they are two protocol revisions of the same server:
 *
 *  * **Streamable HTTP** on `/mcp` (2025-03-26 and later): POST for requests, a standalone GET for the
 *    server-to-client stream, DELETE to end the session.
 *  * **HTTP+SSE** on `/sse` + `/messages` (2024-11-05, deprecated in the spec and still the only transport
 *    several clients and proxies speak).
 *
 * Both share one session map, one sweeper and one origin allow-list, because a second map is a second set of
 * rules nobody remembers to change.
 */
import { randomUUID } from "node:crypto";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { armSseKeepAlive, DEFAULT_SSE_KEEP_ALIVE_MS } from "@modelcontextprotocol/sdk/server/sseKeepAlive.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest, JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";
import express, { type Express, type Request, type Response } from "express";
import { BlockList } from "node:net";
import { bucketKey, clientIp } from "./client-ip.js";
import { homePage } from "./home-page.js";
import { IpLimiter, type IpLimitOptions } from "./ip-limit.js";
import type { ReadyState } from "./readiness.js";

/** A connection pool's counts. */
export type PoolCounts = { readonly total: number; readonly idle: number; readonly waiting: number };
import { createServer, type ServerDeps } from "./server.js";
import { isServerCardPath, SECURITY_TXT_URL, SERVER_CARD_MEDIA_TYPE, SERVER_CARD_PATHS, serverCard } from "./server-card.js";
import type { UsageEvent } from "./usage.js";
import { MCP_USAGE_CLIENT_STATELESS, normaliseClientName, toolErrorCodeOf, toolErrorReasonOf, type ToolErrorCode, type ToolErrorReason } from "./usage-names.js";

/** What a session is, whichever transport minted it. */
type SessionTransport = StreamableHTTPServerTransport | SSEServerTransport;

export type Session = {
  readonly transport: SessionTransport;
  readonly transportKind: "streamable" | "sse";
  /** Last REQUEST on this session. Only requests advance it. */
  touched: number;
  /**
   * How many server→client streams this session currently holds open — the
   * standalone `GET /mcp`, or the `GET /sse` response.
   *
   * The sweeper reads this and not `touched`, because they answer different
   * questions. `touched` says when the client last ASKED something; a client
   * that has subscribed and is waiting asks nothing by design, and expiring it
   * closed the stream underneath a client that was behaving correctly.
   * A session holding a stream is not idle, it is listening.
   */
  streams: number;
  /**
   * Legacy door only: requests posted to `/messages` whose answer has not yet
   * left on the stream, by JSON-RPC id. The POST itself is answered `202` at
   * once, so the HTTP response says nothing about when the WORK ended — the
   * answer leaving does. This is where the request log's `ms` and the
   * per-address in-flight slot are closed for that door.
   */
  pending?: Map<string | number, PendingRpc>;
  /**
   * The per-address bucket key of the client that OPENED the session (launch
   * audit F-6), for the per-address session cap. Undefined when the opener was
   * not attributable — a trusted peer naming nobody — which the cap then does
   * not count, for the reason `admit` gives about unattributed requests.
   */
  owner?: string;
  /**
   * The client NAME this session's `initialize` carried, already normalised
   * (`normaliseClientName`) — for the usage ledger. A product name, not
   * a person: no address, no version, no session id.
   */
  client?: string;
  /**
   * Streamable door only: the outcome slot of each request of this
   * session whose answer has not left yet, by JSON-RPC id. The transport's
   * `send` wrapper (`watchAnswers`) fills it when the answer goes out, so the
   * usage ledger can tell a delivered `isError` result — which leaves inside an
   * HTTP 200 — from a success.
   */
  answers?: Map<string | number, AnswerOutcome>;
};

/**
 * What the ANSWER to one request turned out to be, written by the
 * transport's `send` wrapper when it leaves and read by `emit` when the
 * request closes. Mutable on purpose: it is a slot, filled once.
 */
type AnswerOutcome = { rpcError: boolean; toolError: boolean; rpcErrorCode?: number; toolErrorCode?: ToolErrorCode; toolErrorReason?: ToolErrorReason };

/** The JSON-RPC error code of an answer, when it carries a numeric one. */
function errorCodeOf(error: unknown): number | undefined {
  const c = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof c === "number" && Number.isInteger(c) ? c : undefined;
}

/** True for a JSON-RPC result that is a tool's own error (`isError: true`). */
function isErrorResult(result: unknown): boolean {
  return typeof result === "object" && result !== null && (result as { isError?: unknown }).isError === true;
}

/**
 * Wrap a Streamable-HTTP transport's `send` so each RESPONSE fills the outcome
 * slot its request registered in `answers`. An instance property, like
 * the legacy door's wrapper below, so the SDK's `Protocol` — which calls
 * `this._transport.send` — goes through it; the original is called unchanged
 * and a slot nobody registered is ignored.
 */
function watchAnswers(transport: StreamableHTTPServerTransport, answers: Map<string | number, AnswerOutcome>): void {
  const send = transport.send.bind(transport);
  transport.send = async (message, options) => {
    const m = message as { id?: unknown; result?: unknown; error?: unknown };
    if ((typeof m.id === "string" || typeof m.id === "number") && ("result" in m || "error" in m)) {
      const slot = answers.get(m.id);
      if (slot !== undefined) {
        slot.rpcError = "error" in m;
        slot.toolError = isErrorResult(m.result);
        // the error result's reason, off the closed list; never its text.
        const reason = toolErrorCodeOf(m.result);
        if (reason !== null) slot.toolErrorCode = reason;
        // which argument clause refused it, off its own closed list.
        const clause = toolErrorReasonOf(m.result);
        if (clause !== null) slot.toolErrorReason = clause;
        const code = errorCodeOf(m.error);
        if (code !== undefined) slot.rpcErrorCode = code;
      }
    }
    return send(message, options);
  };
}

/** One JSON-RPC request in flight on the legacy door. */
type PendingRpc = { readonly line: RequestStart; readonly release: () => void };

/**
 * One line per MCP request. What it carries is a closed list, and what it does NOT carry is the
 * point: no arguments, no address, no session id, no user agent — nothing a
 * person typed and nothing that identifies who typed it.
 */
export type RequestLogLine = {
  /** Which door: Streamable HTTP (`/mcp`) or legacy HTTP+SSE (`/messages`). */
  readonly door: "streamable" | "sse";
  /** JSON-RPC method, `batch` for an array, null when the body was not JSON-RPC. */
  readonly rpc: string | null;
  /** For `tools/call`: the tool name, if it is shaped like one; else null. */
  readonly tool: string | null;
  /** HTTP status of the POST (Streamable), or 200 when a legacy answer left on its stream. */
  readonly status: number;
  /** For a legacy answer: whether it was a JSON-RPC error. */
  readonly rpcError?: boolean;
  /** On a 429: which of the two per-address limits refused it. Never an address. */
  readonly limited?: "inflight" | "rate";
  /** True for the one request answered without a session: a bare `tools/list`. */
  readonly stateless?: true;
  /** The answer's JSON-RPC error code, when it was an error carrying one. */
  readonly rpcErrorCode?: number;
  /** True when a `tools/call` answer was the tool's own error result. */
  readonly toolError?: true;
  /** That error result's reason code, off the closed list. Never its message. */
  readonly toolErrorCode?: ToolErrorCode;
  /** Which argument clause refused it, off `TOOL_ERROR_REASONS`. Never an argument. */
  readonly toolErrorReason?: ToolErrorReason;
  /** Milliseconds from the request arriving to the answer leaving. */
  readonly ms: number;
  /** A connection pool's waiting count when the request arrived; null when none is wired (this server has none). */
  readonly poolWaiting: number | null;
};

type RequestStart = { readonly t0: number; readonly door: RequestLogLine["door"]; readonly rpc: string | null; readonly tool: string | null; readonly poolWaiting: number | null; readonly client: string; readonly stateless?: true; readonly outcome: AnswerOutcome };

/**
 * The client name an `initialize` body carries, normalised; null for any other
 * body. An `initialize` with no usable name is `unknown`, never the raw value.
 */
export function initializeClient(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const b = body as { method?: unknown; params?: { clientInfo?: { name?: unknown } } };
  if (b.method !== "initialize") return null;
  return normaliseClientName(b.params?.clientInfo?.name);
}

/**
 * Method and tool name, and only when they are SHAPED like a method and a tool
 * name. Both come from the client; logging an arbitrary string from an
 * unauthenticated body is logging whatever somebody chose to put there.
 */
const METHOD_SHAPE = /^[A-Za-z][A-Za-z0-9_/.-]{0,63}$/;
/**
 * a tool name is words of ASCII letters and digits joined by single
 * `_`, `.`, `:` or `-` — `check_road_status`, but also `checkRoadStatus`,
 * `check-road-status` and a namespaced `viafrei.check_road_status` or
 * `viafrei:find_place`, the shapes a client invents for a tool we do not
 * register — at most 64 characters. Until 2.5.13 only lower-case snake case
 * passed, so 46 of 46 calls to an unregistered tool in seven days were logged
 * with no name at all. A space, a quote or any other character is no tool
 * name and is still dropped (`unshaped` in the request log). Every
 * registered name is lower-case snake case, so the wider shape admits no
 * registered tool it did not before; the usage ledger still counts any name
 * it does not register as `other`.
 */
const TOOL_SHAPE = /^(?=.{1,64}$)[A-Za-z][A-Za-z0-9]*(?:[_.:-][A-Za-z0-9]+)*$/;

export function rpcSummary(body: unknown): { rpc: string | null; tool: string | null; id: string | number | null; isRequest: boolean } {
  if (Array.isArray(body)) return { rpc: "batch", tool: null, id: null, isRequest: false };
  if (typeof body !== "object" || body === null) return { rpc: null, tool: null, id: null, isRequest: false };
  const b = body as { method?: unknown; id?: unknown; params?: { name?: unknown } };
  const rpc = typeof b.method === "string" && METHOD_SHAPE.test(b.method) ? b.method : null;
  const name = b.params?.name;
  const tool = rpc === "tools/call" && typeof name === "string" && TOOL_SHAPE.test(name) ? name : null;
  const id = typeof b.id === "string" || typeof b.id === "number" ? b.id : null;
  return { rpc, tool, id, isRequest: typeof b.method === "string" && id !== null };
}

/**
 * The ONE request this server answers without a session: a POST whose
 * body is a single JSON-RPC `tools/list` REQUEST (it has an id, so it expects
 * an answer) sent with no `Mcp-Session-Id`, by a client of the protocol era
 * this server speaks.
 *
 * Why this one: directory and audit crawlers send it without `initialize`, met a 400, and may list the server as
 * broken. The catalogue is static and public — the same list every session
 * gets — so answering it shows nothing a session would not, and costs no
 * session. `tools/call` is NOT on this list and never may be: a call spends
 * the API's budget and, for the two write tools, a session's
 * watches, and every one of those rules is written against a session.
 *
 * Why NOT `server/discover`, which the same crawlers send: it is a method of
 * the 2026-07-28 revision, which removed `initialize` and sessions — a
 * revision the SDK this server runs (1.30.0, latest `2025-11-25`) does not
 * implement. That revision's own backward-compatibility rule (Streamable HTTP
 * § Backward Compatibility) has a modern client send a modern request first
 * and, on a `400` whose body is not a modern JSON-RPC error, FALL BACK to
 * `initialize`. Today's 400 is therefore the correct answer to
 * `server/discover`: answering it would claim an era whose other obligations
 * (per-request `_meta`, `subscriptions/listen`, a stateless `tools/call`) this
 * server does not meet, and a client that believed it would fail on its next
 * request instead of falling back.
 *
 * The same rule is why a `tools/list` carrying the 2026-07-28 per-request
 * metadata (`params._meta["io.modelcontextprotocol/protocolVersion"]`) is NOT
 * answered here: that is a modern client's era probe, and a 200 would tell it
 * we speak its revision. It keeps the 400 and falls back to `initialize`,
 * which works. (A modern client that also sends an `Mcp-Protocol-Version`
 * header the SDK does not support is refused by the SDK's own check anyway.)
 */
export function isStatelessToolsList(body: unknown): boolean {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return false;
  const b = body as { jsonrpc?: unknown; method?: unknown; id?: unknown; params?: unknown };
  if (b.jsonrpc !== "2.0" || b.method !== "tools/list") return false;
  if (typeof b.id !== "string" && typeof b.id !== "number") return false;
  const meta = typeof b.params === "object" && b.params !== null ? (b.params as { _meta?: unknown })._meta : undefined;
  if (typeof meta === "object" && meta !== null && "io.modelcontextprotocol/protocolVersion" in meta) return false;
  return true;
}

/** The Accept value the SDK's transport requires of every POST. */
const TRANSPORT_ACCEPT = "application/json, text/event-stream";
/** The ranges that cover `application/json`, most specific first. */
const JSON_RANGES = ["application/json", "application/*", "*/*"] as const;

/**
 * Will a client sending this `Accept` take an `application/json` answer?
 * HTTP's rule (RFC 9110 §12.5.1): an ABSENT or empty field means any media
 * type is acceptable. Otherwise the MOST SPECIFIC range that matches
 * `application/json` decides — `application/json`, then `application/*`,
 * then `*\/*` — and it covers JSON unless its weight is `q=0` ("not
 * acceptable"). So `application/json;q=0, *\/*` and `application/*;q=0, *\/*`
 * both refuse. Anything naming only other types (`text/html`) is not covered.
 */
export function acceptsJson(accept: string | undefined): boolean {
  if (accept === undefined || accept.trim() === "") return true;
  const weight = new Map<string, boolean>();
  for (const range of accept.split(",")) {
    const [type = "", ...params] = range.split(";").map((p) => p.trim().toLowerCase());
    if (!(JSON_RANGES as readonly string[]).includes(type)) continue;
    const q = params.find((p) => p.startsWith("q="));
    const refused = q !== undefined && Number(q.slice(2)) === 0;
    weight.set(type, (weight.get(type) ?? false) || !refused);
  }
  for (const type of JSON_RANGES) {
    const acceptable = weight.get(type);
    if (acceptable !== undefined) return acceptable;
  }
  return false;
}

/**
 * Rewrites the request's `Accept` to the transport's dual value, in BOTH
 * places the SDK's Node→Web bridge reads headers from (`headers`, and
 * `rawHeaders` when it materialises them).
 */
function forceTransportAccept(req: Request): void {
  req.headers.accept = TRANSPORT_ACCEPT;
  const kept: string[] = [];
  for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) {
    const name = req.rawHeaders[i] ?? "";
    if (name.toLowerCase() !== "accept") kept.push(name, req.rawHeaders[i + 1] ?? "");
  }
  kept.push("Accept", TRANSPORT_ACCEPT);
  req.rawHeaders = kept;
}

export type McpAppOptions = {
  /** Everything a tool handler needs; passed straight to `createServer`. */
  readonly deps: ServerDeps;
  /** Origins allowed to reach the transports, and to pass a CORS preflight. */
  readonly allowedOrigins: readonly string[];
  /** Host header values accepted (DNS-rebinding protection). */
  readonly allowedHosts: readonly string[];
  /** Largest JSON-RPC request body accepted. */
  readonly maxBodyKb: number;
  /** Idle lifetime of a session holding no stream. */
  readonly sessionTtlMs: number;
  /** How often the sweeper runs. Zero or less: do not arm it. */
  readonly sessionSweepMs: number;
  /**
   * Comment frame cadence on a legacy SSE stream. Zero or less disables it;
   * absent means `DEFAULT_SSE_KEEP_ALIVE_MS`, which is what production runs on
   * — no deployment surface sets this, so the default IS the behaviour.
   */
  readonly keepAliveMs?: number;
  /**
   * LIVENESS: `/healthz`, answered from process state only — no
   * request to the API, no I/O, so a slow API cannot make it slow and a slow answer
   * means the process itself is wedged. Absent: the route is not registered.
   */
  readonly health?: () => { ok: boolean };
  /**
   * READINESS: `/readyz` — `200 {"status":"ok"}`, or `503` with
   * `{"status":"slow"}` past the deadline or `{"status":"degraded"}` when the
   * API refused or was unreachable. See `readiness.ts`. Absent: the route is not registered.
   */
  readonly ready?: () => Promise<ReadyState>;
  /** A pool's counts, for the request log's `poolWaiting`. Absent: null. */
  readonly poolCounts?: () => PoolCounts;
  /** Where each MCP request's line goes. Absent: nothing is logged. */
  readonly requestLog?: (line: RequestLogLine) => void;
  /**
   * Where each MCP request's usage EVENT goes — the same instant as the
   * log line, plus the session's normalised client name. It must be
   * synchronous and cheap (`UsageLedger.record`); a throw is swallowed.
   * Absent: nothing is counted.
   */
  readonly usage?: (event: UsageEvent) => void;
  /**
   * The per-address limit on the MCP routes. Absent: no limit — the
   * shape every test that is not ABOUT the limit wants, and a local dev server.
   */
  readonly ipLimits?: IpLimitOptions;
  /**
   * Peers believed when they name the client in `X-Forwarded-For` (see
   * `client-ip.ts`). Absent: the socket peer is the client.
   */
  readonly trustedProxies?: BlockList;
  /** Operational warnings this route table raises (an unattributed proxy request). */
  readonly warn?: (fields: Record<string, unknown>, message: string) => void;
  /**
   * The GLOBAL cap on live sessions. Each session is a
   * transport and an `McpServer` held in memory until it is deleted or swept,
   * and `initialize` costs nothing to send — so without a cap a loop of
   * handshakes grows the map until the container's memory limit kills the
   * process for everyone. At the cap, a new session first EVICTS the session
   * that has been idle longest (no stream held — the sweeper's own definition
   * of idle); when every session holds a stream, the new one is refused `503`
   * with `Retry-After`. Absent or 0: no cap.
   */
  readonly maxSessions?: number;
  /**
   * The optional PER-ADDRESS cap on live sessions. At the cap, the
   * address's own longest-idle session is evicted; when all of them hold a
   * stream, the new one is refused `429` + `Retry-After` — the address's
   * problem, not the server's, so not a 503. Absent or 0: no per-address cap,
   * which is the production default: a hosted assistant opens every one of its
   * users' sessions from a handful of addresses.
   */
  readonly maxSessionsPerAddress?: number;
  /** The `Retry-After` of a session refusal, seconds. Default 30. */
  readonly sessionRetryAfterS?: number;
};

/** What the session caps did since boot — counts only, never an id or an address. */
export type SessionCapStats = { readonly evicted: number; readonly refusedGlobal: number; readonly refusedAddress: number };

export type McpApp = {
  readonly app: Express;
  readonly sessions: Map<string, Session>;
  /**
   * Expire every session idle past the TTL and holding no stream; returns how
   * many were closed. Exported so a test can make the sweep happen instead of
   * waiting `MCP_SESSION_TTL_S` for it — a sweep nothing can trigger is a
   * sweep nothing can prove.
   */
  sweep(now?: number): number;
  /** The per-address limiter, when one is configured — exported for a test. */
  readonly limiter: IpLimiter | undefined;
  /** Stop the sweeper and close every live session. */
  close(): Promise<void>;
  /** What the session caps have done since boot. */
  sessionCapStats(): SessionCapStats;
  /**
   * The cadence legacy streams are actually kept alive at. Exported because it
   * is resolved from an option nothing sets, so a test that re-typed the
   * number would agree with any change to it.
   */
  readonly keepAliveMs: number;
  /**
   * Keep-alive ticks since boot, counted BEFORE the write is attempted. A
   * timer whose stream has closed and that nobody cleared goes on counting —
   * which is the only way to see the leak from outside.
   */
  keepAliveTicks(): number;
};

/**
 * The JSON-RPC code of a `429`. Inside the implementation-defined server-error
 * range (-32000..-32099), and the same code the SDK's transports use for their
 * own transport-level refusals, because that is what this is: the request was
 * never read, so no method-level code applies.
 */
export const RATE_LIMITED_CODE = -32000;

/**
 * The answer to a session id the server does not hold: HTTP 404 with the
 * SDK transport's own JSON-RPC code, -32001. The spec makes 404 the signal to
 * re-initialise; a 400 here left Claude's connector dead after every restart.
 */
export const SESSION_NOT_FOUND = { jsonrpc: "2.0", error: { code: -32001, message: "Session not found: it has ended (a restart or the idle limit); send initialize to start a new one" }, id: null } as const;

/** GET and DELETE /mcp without a live session: no id is a 400, an id we do not hold is the 404 above. */
function refuseSession(res: Response, sid: string): void {
  if (sid === "") { res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "No valid session; send initialize first" }, id: null }); return; }
  res.status(404).json(SESSION_NOT_FOUND);
}

/**
 * What `/mcp` accepts: POST for every request, GET to open a session's stream, DELETE to end a session.
 *
 * GET stays in the list on the 405s below that refuse a GET, deliberately. RFC 9110
 * §10.2.1 defines `Allow` as the methods "advertised as supported by the target resource", and §15.5.6 asks a 405
 * to list "the target resource's currently supported methods": the resource is `/mcp`, and `/mcp` does support
 * GET — a GET that names a live session opens its stream (Streamable HTTP 2025-11-25, "Listening for Messages from
 * the Server"). What is missing on the refused GET is a SESSION, which is a property of the request, not of the
 * resource; `Allow: POST, DELETE` would tell a client that reads the field that the endpoint has no stream at
 * all, which is false. The spec itself reads the 405 as "no SSE stream at this endpoint", and the body says what
 * to send instead. HEAD is not listed: no MCP revision defines it, and it is refused with a 405 in every state.
 */
export const MCP_ENDPOINT_ALLOW = "POST, GET, DELETE";

/**
 * A GET/HEAD of `/mcp` with no session, and a HEAD with one: 405 and the methods the endpoint takes. Streamable
 * HTTP (2025-06-18 and 2025-11-25, "Listening for Messages from the Server" 3): the server MUST answer a GET with
 * `text/event-stream` or 405; without a session there is no stream to give.
 */
export const STREAM_WITHOUT_SESSION = { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed: GET /mcp opens a session's stream; send POST /mcp with initialize first" }, id: null } as const;

/** Any other method on `/mcp` (PUT, PATCH, …): the resource exists, so it is 405 with `Allow` (RFC 9110 §15.5.6), never a 404. */
export const METHOD_NOT_ALLOWED = { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed: /mcp takes POST (every JSON-RPC message), GET (a session's stream) and DELETE (end a session)" }, id: null } as const;

/**
 * A POST body that is JSON but not a JSON-RPC 2.0 message: `-32600 Invalid Request` (JSON-RPC 2.0 §5.1, "The JSON
 * sent is not a valid Request object"), not the SDK transport's `-32700 Parse error`, which JSON-RPC reserves for a
 * body that is not JSON at all (that one is answered by the body parser's handler above the routes).
 */
export const INVALID_REQUEST = { jsonrpc: "2.0", error: { code: -32600, message: "Invalid Request: the body is JSON but not a JSON-RPC 2.0 message (a request with a string or integer id, a notification, or a response)" }, id: null } as const;

/**
 * True for a parsed body the transport may take: one JSON-RPC message, or an array (a 2025-03-26 batch, which the
 * SDK's transport judges element by element). `undefined` — a body the JSON parser did not read, because its
 * Content-Type is not JSON — is left to the transport's own `415`.
 */
function isJsonRpcBody(body: unknown): boolean {
  if (body === undefined || Array.isArray(body)) return true;
  return JSONRPCMessageSchema.safeParse(body).success;
}

function refuseStreamWithoutSession(res: Response): void {
  res.setHeader("allow", MCP_ENDPOINT_ALLOW);
  res.status(405).json(STREAM_WITHOUT_SESSION);
}

/** The two MCP request headers a browser must be told it may send. */
const CORS_REQUEST_HEADERS = "content-type, accept, mcp-session-id, mcp-protocol-version, last-event-id, authorization";
const CORS_METHODS = "GET, POST, DELETE, OPTIONS";

/**
 * The allow-list, spoken in the SDK's own words.
 *
 * `StreamableHTTPServerTransport` refuses a bad Host or Origin itself, but
 * `SSEServerTransport` validates only the POST — its `start()` writes the
 * stream head without looking at a header — so the legacy GET would otherwise
 * have a weaker rule than the modern one. The message text matches the SDK's
 * so that a client sees one answer from one server.
 */
function originRefusal(req: Request, allowedHosts: readonly string[], allowedOrigins: readonly string[]): string | undefined {
  const host = req.headers.host;
  if (allowedHosts.length > 0 && (!host || !allowedHosts.includes(host))) return `Invalid Host header: ${String(host)}`;
  const origin = req.headers.origin;
  if (allowedOrigins.length > 0 && origin && !allowedOrigins.includes(origin)) return `Invalid Origin header: ${origin}`;
  return undefined;
}

/**
 * Refuse a bad Host or Origin on `/mcp` BEFORE any session is looked up, in the SDK transport's own shape: 403 and
 * a JSON-RPC error with no usable id. Streamable HTTP 2025-11-25, Security Warning 1: "Servers MUST validate the
 * Origin header on all incoming connections … If the Origin header is present and invalid, servers MUST respond
 * with HTTP 403 Forbidden." The transport validates only the requests that reach it, so a refused origin naming
 * an ended session used to be told 404 (and invited to re-initialise) and one naming none 400. Returns true when
 * the request has been answered.
 */
function refuseBadOrigin(req: Request, res: Response, allowedHosts: readonly string[], allowedOrigins: readonly string[]): boolean {
  const refusal = originRefusal(req, allowedHosts, allowedOrigins);
  if (refusal === undefined) return false;
  res.status(403).json({ jsonrpc: "2.0", error: { code: -32000, message: refusal }, id: null });
  return true;
}

export function createMcpApp(o: McpAppOptions): McpApp {
  const keepAliveMs = o.keepAliveMs ?? DEFAULT_SSE_KEEP_ALIVE_MS;
  let ticks = 0;
  const { deps, allowedOrigins, allowedHosts, maxBodyKb, sessionTtlMs, sessionSweepMs } = o;
  const app = express();
  app.disable("x-powered-by");

  // CORS, before the body parser: a preflight carries no body and must not
  // wait for one. Only a listed origin is granted anything — an allow-list
  // that answers `*` is not an allow-list — and the grant names
  // `Mcp-Session-Id` in `expose-headers` because a browser client cannot read
  // the session id otherwise, which makes the whole session model unusable
  // from a page.
  app.use((req: Request, res: Response, next) => {
    const origin = req.headers.origin;
    const allowed = typeof origin === "string" && allowedOrigins.includes(origin);
    if (allowed) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("access-control-allow-methods", CORS_METHODS);
      res.setHeader("access-control-allow-headers", CORS_REQUEST_HEADERS);
      res.setHeader("access-control-expose-headers", "Mcp-Session-Id");
      res.setHeader("access-control-max-age", "600");
    }
    // `Vary: Origin` whether or not this one was allowed: the answer depends
    // on the request's origin either way, and a cache that does not know that
    // serves one client's grant to another.
    res.appendHeader("vary", "Origin");
    if (req.method === "OPTIONS") {
      // The server card's preflight: `*`, GET, from any page — the
      // card's own CORS rule, set out with the route below.
      if (isServerCardPath(req.path)) {
        res.setHeader("access-control-allow-origin", "*");
        res.setHeader("access-control-allow-methods", "GET");
        res.setHeader("access-control-allow-headers", "Content-Type, If-None-Match");
        res.setHeader("access-control-max-age", "600");
        res.status(204).end();
        return;
      }
      // A preflight from an origin on no list is refused in the same words the
      // transports use, so the browser's console and our log agree.
      if (typeof origin === "string" && !allowed) { res.status(403).send(`Invalid Origin header: ${origin}`); return; }
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: `${maxBodyKb}kb` }));
  // A body the parser refused is answered in JSON-RPC, never with Express's
  // HTML error page: a machine client that sends malformed JSON must be
  // able to read WHY, and `-32700 Parse error` is the code the spec gives it.
  // An over-long body keeps its 413 and gets a JSON-RPC body too (-32600: the
  // request as sent is not one we accept). Nothing of the body or the parser's
  // message is echoed — it may carry whatever the client sent.
  app.use((err: unknown, _req: Request, res: Response, next: (e?: unknown) => void) => {
    const type = (err as { type?: unknown } | null)?.type;
    if (type === "entity.parse.failed") {
      res.status(400).json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error: the request body is not valid JSON." }, id: null });
      return;
    }
    if (type === "entity.too.large") {
      res.status(413).json({ jsonrpc: "2.0", error: { code: -32600, message: `Invalid Request: the body is larger than ${String(maxBodyKb)} kB.` }, id: null });
      return;
    }
    next(err);
  });

  const sessions = new Map<string, Session>();

  // ---- The session caps --------------------------------

  const maxSessions = o.maxSessions ?? 0;
  const maxPerAddress = o.maxSessionsPerAddress ?? 0;
  const sessionRetryAfterS = o.sessionRetryAfterS ?? 30;
  /** Handshakes admitted and not yet in the map: `onsessioninitialized` runs inside `handleRequest`. */
  let opening = 0;
  const capStats = { evicted: 0, refusedGlobal: 0, refusedAddress: 0 };
  let capSaid = false;
  /** Close one session exactly as the sweeper would. */
  const evict = (id: string, s: Session): void => {
    void s.transport.close();
    sessions.delete(id);
    capStats.evicted += 1;
  };
  /** The longest-idle session holding no stream, optionally of one owner. */
  const oldestIdle = (owner?: string): [string, Session] | undefined => {
    let best: [string, Session] | undefined;
    for (const e of sessions) {
      const s = e[1];
      if (s.streams > 0) continue;
      if (owner !== undefined && s.owner !== owner) continue;
      if (best === undefined || s.touched < best[1].touched) best = e;
    }
    return best;
  };
  /**
   * Make room for one more session, or refuse it. Returns false when the
   * request has already been answered (429 or 503). Called BEFORE a transport
   * is built, so a refused handshake costs nothing but this answer.
   */
  const makeRoom = (req: Request, res: Response, owner: string | undefined): boolean => {
    const refuse = (status: 429 | 503, message: string): false => {
      res.setHeader("retry-after", String(sessionRetryAfterS));
      res.status(status).json({ jsonrpc: "2.0", error: { code: RATE_LIMITED_CODE, message, data: { retryAfterS: sessionRetryAfterS } }, id: rpcSummary(req.body).id });
      if (!capSaid) {
        capSaid = true;
        o.warn?.({ sessions: sessions.size, maxSessions, maxPerAddress }, "a session cap refused a handshake (MCP_MAX_SESSIONS / MCP_MAX_SESSIONS_PER_ADDRESS); said once per process");
      }
      return false;
    };
    if (maxPerAddress > 0 && owner !== undefined) {
      let mine = 0;
      for (const s of sessions.values()) if (s.owner === owner) mine += 1;
      if (mine >= maxPerAddress) {
        const victim = oldestIdle(owner);
        if (victim === undefined) {
          capStats.refusedAddress += 1;
          return refuse(429, `Too many sessions from this address (at most ${String(maxPerAddress)} at once, every one holding a stream); retry after ${String(sessionRetryAfterS)} s.`);
        }
        evict(victim[0], victim[1]);
      }
    }
    if (maxSessions > 0 && sessions.size + opening >= maxSessions) {
      const victim = oldestIdle();
      if (victim === undefined) {
        capStats.refusedGlobal += 1;
        return refuse(503, `The server is at its session limit and no session is idle; retry after ${String(sessionRetryAfterS)} s.`);
      }
      evict(victim[0], victim[1]);
    }
    return true;
  };
  /** The bucket key of the client opening a session, when it can be attributed. */
  const ownerOf = (req: Request): string | undefined => {
    const who = clientIp(req.socket.remoteAddress, req.headers["x-forwarded-for"], o.trustedProxies ?? new BlockList());
    return who !== null && who.kind === "client" ? bucketKey(who.ip) : undefined;
  };

  /**
   * Count a server→client stream for as long as the socket is open.
   *
   * `res.on("close")` fires for a clean end and for a client that vanished, so
   * the count cannot leak upwards and strand a session for ever — which would
   * be the sweeper's defect wearing the opposite sign.
   */
  const holdStream = (res: Response, s: Session): void => {
    s.streams += 1;
    res.on("close", () => { s.streams = Math.max(0, s.streams - 1); s.touched = Date.now(); });
  };

  // ---- The per-address limit and the request log -------------

  const limiter = o.ipLimits === undefined ? undefined : new IpLimiter(o.ipLimits);
  const trusted = o.trustedProxies ?? new BlockList();
  let unattributedSaid = false;
  let forwardedIgnoredSaid = false;
  /**
   * Admit one request, or answer it `429` with a JSON-RPC error body and
   * return null. `holdsSlot` is false for a stream that is merely being OPENED.
   *
   * A request a trusted proxy forwarded WITHOUT naming the client is admitted
   * unlimited: counting it would put every caller behind that proxy into one
   * bucket, which turns a limit on one address into an outage for all of them.
   * In-network probes of `/readyz` arrive that way by design, so it is said
   * ONCE per process, not per request, or the log would be that sentence at
   * every probe.
   */
  const admit = (req: Request, res: Response, holdsSlot: boolean): (() => void) | null => {
    if (limiter === undefined) return () => undefined;
    const who = clientIp(req.socket.remoteAddress, req.headers["x-forwarded-for"], trusted);
    if (who === null || who.kind === "unattributed") {
      if (!unattributedSaid) {
        unattributedSaid = true;
        o.warn?.({ path: req.path }, "first request with no attributable client address (a trusted peer sent no X-Forwarded-For); such requests are not rate-limited — expected for in-network probes, a fault if public traffic arrives this way");
      }
      return () => undefined;
    }
    // The mirror of the sentence above: an UNtrusted peer that sends
    // X-Forwarded-For. Its header is correctly ignored, but when that peer is
    // the edge, its network fell outside MCP_TRUSTED_PROXY_CIDR, every
    // request's peer is the one gateway, and the per-address limit has
    // silently become a global one.
    // Once per process; the peer address is not logged.
    if (who.forwardedIgnored === true && !forwardedIgnoredSaid) {
      forwardedIgnoredSaid = true;
      o.warn?.({ path: req.path }, "a peer outside MCP_TRUSTED_PROXY_CIDR sent X-Forwarded-For; the header was ignored and the peer itself is being rate-limited — if the edge is that peer, every client now shares ONE bucket: add its network to MCP_TRUSTED_PROXY_CIDR");
    }
    const a = limiter.admit(bucketKey(who.ip), holdsSlot);
    if (a.ok) return a.release;
    // Read by the request log: which limit fired, never who it fired for.
    (res.locals as { limited?: "inflight" | "rate" }).limited = a.reason;
    const { maxInflight, ratePerMin } = limiter.options;
    const why = a.reason === "inflight" ? `at most ${String(maxInflight)} requests running at once` : `at most ${String(ratePerMin)} requests per minute`;
    res.setHeader("retry-after", String(a.retryAfterS));
    res.status(429).json({
      jsonrpc: "2.0",
      error: { code: RATE_LIMITED_CODE, message: `Too many requests from this address (${why}); retry after ${String(a.retryAfterS)} s.`, data: { retryAfterS: a.retryAfterS } },
      id: rpcSummary(req.body).id,
    });
    return null;
  };

  // The client a request belongs to: the name in its own `initialize`, else
  // the name its session's `initialize` carried, else `unknown`.
  const clientOf = (req: Request, door: RequestLogLine["door"]): string => {
    const own = initializeClient(req.body);
    if (own !== null) return own;
    const sid = door === "streamable" ? (req.header("mcp-session-id") ?? "") : typeof req.query["sessionId"] === "string" ? req.query["sessionId"] : "";
    return (sid === "" ? undefined : sessions.get(sid)?.client) ?? "unknown";
  };
  const startLine = (req: Request, door: RequestLogLine["door"], stateless = false): RequestStart => {
    const { rpc, tool } = rpcSummary(req.body);
    // A stateless request has no `initialize` and no session, so it has no
    // client name: it is counted under its own marker, never as
    // `unknown`, which belongs to SESSIONS whose client sent no name.
    const client = o.usage === undefined ? "unknown" : stateless ? MCP_USAGE_CLIENT_STATELESS : clientOf(req, door);
    return { t0: Date.now(), door, rpc, tool, poolWaiting: o.poolCounts?.().waiting ?? null, client, ...(stateless ? { stateless: true as const } : {}), outcome: { rpcError: false, toolError: false } };
  };
  const emit = (line: RequestStart, status: number, rpcError?: boolean, res?: Response): void => {
    const ms = Date.now() - line.t0;
    if (o.usage !== undefined) {
      try {
        // The answer's own outcome: what the `send` wrappers saw leave.
        // An explicit `rpcError` (the legacy door's) is the same fact.
        const answerRpcError = rpcError ?? (line.outcome.rpcError ? true : undefined);
        o.usage({
          door: line.door,
          rpc: line.rpc,
          tool: line.tool,
          client: line.client,
          status,
          ...(answerRpcError === undefined ? {} : { rpcError: answerRpcError }),
          ...(line.outcome.toolError ? { toolError: true } : {}),
          ...(line.outcome.toolErrorCode === undefined ? {} : { toolErrorCode: line.outcome.toolErrorCode }),
          ms,
        });
      } catch { /* a counter never fails a request */ }
    }
    if (o.requestLog === undefined) return;
    const limited = res === undefined ? undefined : (res.locals as { limited?: "inflight" | "rate" }).limited;
    try {
      const code = line.outcome.rpcErrorCode;
      o.requestLog({ door: line.door, rpc: line.rpc, tool: line.tool, status, ...(rpcError === undefined ? {} : { rpcError }), ...(limited === undefined ? {} : { limited }), ...(line.stateless === true ? { stateless: true as const } : {}), ...(code === undefined ? {} : { rpcErrorCode: code }), ...(line.outcome.toolError ? { toolError: true as const } : {}), ...(line.outcome.toolError && line.outcome.toolErrorCode !== undefined ? { toolErrorCode: line.outcome.toolErrorCode } : {}), ...(line.outcome.toolError && line.outcome.toolErrorReason !== undefined ? { toolErrorReason: line.outcome.toolErrorReason } : {}), ms, poolWaiting: line.poolWaiting });
    } catch { /* a log line never fails a request */ }
  };

  if (o.health) {
    const health = o.health;
    // No await, no I/O: see `health` in the options. The body is the same two
    // words it always was, because the probe is public and says nothing else.
    app.get("/healthz", (_req, res) => {
      const { ok } = health();
      res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "degraded" });
    });
  }

  if (o.ready) {
    const ready = o.ready;
    // Rate-limited like the MCP routes: unlike `/healthz` it spends a
    // statement, and it is as public as they are. It never holds a slot — the
    // single flight in `readiness.ts` already bounds it to one statement.
    app.get("/readyz", async (req, res) => {
      if (admit(req, res, false) === null) return;
      const state = await ready();
      res.status(state === "ok" ? 200 : 503).json({ status: state });
    });
  }

  // ---- Streamable HTTP (2025-03-26 and later) ----------------------------

  app.post("/mcp", async (req, res) => {
    // An EMPTY `Mcp-Session-Id: ""` is no id, deliberately: it
    // names no session, so it is read exactly like an absent header — a bare
    // `tools/list` with it is answered statelessly, an `initialize` with it
    // opens a session, anything else gets the no-session 400. The one
    // alternative, refusing it as an unknown session, would make a client
    // that always sends the header (empty before `initialize`) unable to
    // list without one. Pinned in `stateless.test.ts`.
    const sid = req.header("mcp-session-id") ?? "";
    const stateless = sid === "" && isStatelessToolsList(req.body);
    const line = startLine(req, "streamable", stateless);
    res.on("close", () => { emit(line, res.statusCode, undefined, res); });
    // The limit is taken BEFORE the stateless branch, so a bare `tools/list`
    // spends the same bucket and the same in-flight slot as any request. The
    // body limit was applied by the parser above; the Host/Origin rule is the
    // transport's own DNS-rebinding check, built below with the same
    // allow-lists a session's transport gets.
    const release = admit(req, res, true);
    if (release === null) return;
    res.on("close", release);
    if (refuseBadOrigin(req, res, allowedHosts, allowedOrigins)) return;
    if (!isJsonRpcBody(req.body)) { res.status(400).json(INVALID_REQUEST); return; }
    if (stateless) {
      // The SDK's stateless mode: no session id is generated, none is
      // returned, nothing enters `sessions` and the session caps are not
      // consulted — a crawler's listing must not evict a person's session.
      // A fresh transport and server per request, as the SDK requires, built
      // by the SAME `createServer` a session gets, so the list IS the
      // registration and not a copy of it.
      const transport = new StreamableHTTPServerTransport({
        // No `sessionIdGenerator`: its ABSENCE is the SDK's stateless mode.
        // One JSON answer, not an SSE stream: nothing follows it.
        enableJsonResponse: true,
        enableDnsRebindingProtection: true,
        allowedHosts: [...allowedHosts],
        allowedOrigins: [...allowedOrigins],
      });
      const server = createServer(deps);
      // A close that rejects after the answer has left has nobody to tell; it
      // must never surface as an unhandled rejection.
      res.on("close", () => { transport.close().catch(() => undefined); server.close().catch(() => undefined); });
      // The Accept leniency, on THIS branch only. The
      // spec's "the client MUST list both application/json and
      // text/event-stream" exists so the server may choose either; this
      // transport has `enableJsonResponse` and answers ONE JSON document,
      // never a stream, so the second type buys nothing here — and directory
      // crawlers send no Accept, `*/*` or `application/json` and got the
      // SDK's 406. A client whose Accept
      // covers JSON (`acceptsJson`, RFC 9110 §12.5.1) gets the header the SDK
      // wants and the same JSON as before; one naming only other types keeps
      // the SDK's 406 untouched. Sessions, initialize and every other request
      // keep the SDK's strict check: they may be answered with a stream.
      if (acceptsJson(req.header("accept"))) forceTransportAccept(req);
      await server.connect(transport as unknown as Parameters<typeof server.connect>[0]);
      await transport.handleRequest(req, res, req.body);
      return;
    }
    const s = sid !== "" ? sessions.get(sid) : undefined;
    // The request's outcome slot: the `send` wrapper fills it when the
    // answer leaves, `emit` reads it when this POST closes.
    const { id: rpcId, isRequest } = rpcSummary(req.body);
    const register = (answers: Map<string | number, AnswerOutcome> | undefined): void => {
      if (answers === undefined || !isRequest || rpcId === null) return;
      answers.set(rpcId, line.outcome);
      res.on("close", () => { if (answers.get(rpcId) === line.outcome) answers.delete(rpcId); });
    };
    if (!s) {
      // A session id we do not hold is a session that ENDED — a restart (every
      // deploy), the idle TTL or an eviction — and the spec's answer to it is
      // 404, the one status on which a client MUST open a new session
      // (Streamable HTTP, "Session Management" 4). It used to be this 400, and a
      // client that follows the spec (Claude's connector) read it as a broken
      // server and never re-initialised: the owner had to delete and re-add the
      // connector after each deploy. An `initialize` that still carries
      // the dead id is that re-initialisation and opens a session; a request
      // with no id at all is still the no-session 400.
      if (!isInitializeRequest(req.body)) {
        if (sid !== "") { res.status(404).json(SESSION_NOT_FOUND); return; }
        res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "No valid session; send initialize first" }, id: null });
        return;
      }
      const owner = ownerOf(req);
      if (!makeRoom(req, res, owner)) return;
      const answers = new Map<string | number, AnswerOutcome>();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        // Passed so the two doors cannot drift apart: this transport arms its
        // own keep-alive on the standalone GET stream and would otherwise run
        // at the SDK's default while the legacy door ran at ours.
        keepAliveMs,
        enableDnsRebindingProtection: true,
        allowedHosts: [...allowedHosts],
        allowedOrigins: [...allowedOrigins],
        onsessioninitialized: (id) => { sessions.set(id, { transport, transportKind: "streamable", touched: Date.now(), streams: 0, client: line.client, answers, ...(owner === undefined ? {} : { owner }) }); },
        onsessionclosed: (id) => { sessions.delete(id); },
      });
      watchAnswers(transport, answers);
      register(answers);
      const server = createServer(deps);
      opening += 1;
      try {
        await server.connect(transport as unknown as Parameters<typeof server.connect>[0]);
        await transport.handleRequest(req, res, req.body);
      } finally {
        opening -= 1;
      }
      return;
    }
    s.touched = Date.now();
    register(s.answers);
    await (s.transport as StreamableHTTPServerTransport).handleRequest(req, res, req.body);
  });

  app.get("/mcp", async (req, res) => {
    if (admit(req, res, false) === null) return;
    // The Host/Origin rule first, for every GET and HEAD whatever session it names (2025-11-25, Security Warning
    // 1): a probe from an origin we refuse learns nothing more than a refusal.
    if (refuseBadOrigin(req, res, allowedHosts, allowedOrigins)) return;
    // A GET (or HEAD — Express answers HEAD from this route) that names no session is a reachability probe, not a
    // stream: the spec's answer is 405, "no stream here", with what the endpoint does accept. Spring AI and
    // OpenCode read 405 as "request/response only" and stop on anything else; a 400 read as a broken server.
    const sid = req.header("mcp-session-id") ?? "";
    if (sid === "") { refuseStreamWithoutSession(res); return; }
    const s = sessions.get(sid);
    // An id we do not hold is an ENDED session, and the spec's answer to any request naming one is 404 (Session
    // Management 3) — a HEAD included, so a client probing with it still learns to re-initialise.
    if (!s || s.transportKind !== "streamable") { refuseSession(res, sid); return; }
    // A HEAD that names a LIVE session is answered here, never handed to the transport. No
    // MCP revision defines HEAD; a HEAD of an event stream would describe a stream that is never sent; and the
    // transport answered it with its own 405 and its own `Allow` order AFTER the session had been touched and a
    // stream counted — so a HEAD kept a session alive that nobody used. One 405, one `Allow`, nothing touched.
    if (req.method === "HEAD") { refuseStreamWithoutSession(res); return; }
    s.touched = Date.now();
    holdStream(res, s);
    await (s.transport as StreamableHTTPServerTransport).handleRequest(req, res);
  });

  app.delete("/mcp", async (req, res) => {
    const release = admit(req, res, true);
    if (release === null) return;
    res.on("close", release);
    if (refuseBadOrigin(req, res, allowedHosts, allowedOrigins)) return;
    const s = sessions.get(req.header("mcp-session-id") ?? "");
    if (!s || s.transportKind !== "streamable") { refuseSession(res, req.header("mcp-session-id") ?? ""); return; }
    await (s.transport as StreamableHTTPServerTransport).handleRequest(req, res);
  });

  // Every other method on `/mcp` — PUT, PATCH and the rest (OPTIONS is the CORS preflight above, HEAD the GET
  // route's). The resource exists, so the answer is 405 with the methods it takes (RFC 9110 §15.5.6), not the
  // catch-all's 404, which says there is nothing here.
  app.all("/mcp", (req, res) => {
    if (admit(req, res, false) === null) return;
    if (refuseBadOrigin(req, res, allowedHosts, allowedOrigins)) return;
    res.setHeader("allow", MCP_ENDPOINT_ALLOW);
    res.status(405).json(METHOD_NOT_ALLOWED);
  });

  // ---- Legacy HTTP+SSE (2024-11-05) -------------------------------------
  //
  // The shape is fixed by the old revision: the GET opens the stream and its
  // FIRST frame tells the client where to post — `/messages?sessionId=<id>`,
  // resolved by the client against the URL it opened — and every request then
  // arrives on that POST while every answer leaves on the stream.

  app.get("/sse", async (req, res) => {
    const refusal = originRefusal(req, allowedHosts, allowedOrigins);
    if (refusal) { res.status(403).send(refusal); return; }
    if (admit(req, res, false) === null) return;
    const owner = ownerOf(req);
    if (!makeRoom(req, res, owner)) return;
    const transport = new SSEServerTransport("/messages", res, {
      enableDnsRebindingProtection: true,
      allowedHosts: [...allowedHosts],
      allowedOrigins: [...allowedOrigins],
    });
    const pending = new Map<string | number, PendingRpc>();
    const session: Session = { transport, transportKind: "sse", touched: Date.now(), streams: 0, pending, ...(owner === undefined ? {} : { owner }) };
    // The answer to a `/messages` POST leaves HERE, on the stream, so this is
    // where that request ends: its log line is written and its in-flight slot
    // freed when a response carrying its id is sent. An instance property, so
    // the SDK's `Protocol` — which calls `this._transport.send` — goes through
    // it; the original is called unchanged.
    const send = transport.send.bind(transport);
    transport.send = async (message) => {
      const m = message as { id?: unknown; result?: unknown; error?: unknown };
      if ((typeof m.id === "string" || typeof m.id === "number") && ("result" in m || "error" in m)) {
        const p = pending.get(m.id);
        if (p !== undefined) {
          pending.delete(m.id);
          p.release();
          p.line.outcome.toolError = isErrorResult(m.result);
          const reason = toolErrorCodeOf(m.result);
          if (reason !== null) p.line.outcome.toolErrorCode = reason;
          const clause = toolErrorReasonOf(m.result);
          if (clause !== null) p.line.outcome.toolErrorReason = clause;
          const code = errorCodeOf(m.error);
          if (code !== undefined) p.line.outcome.rpcErrorCode = code;
          emit(p.line, 200, "error" in m);
        }
      }
      return send(message);
    };
    // A stream that ends with answers outstanding must not strand their slots.
    res.on("close", () => { for (const p of pending.values()) p.release(); pending.clear(); });
    // Registered BEFORE `connect()`, which calls `start()` and writes the
    // endpoint frame: a client that posts the instant it reads that frame must
    // find its session already in the map.
    sessions.set(transport.sessionId, session);
    holdStream(res, session);
    res.on("close", () => { sessions.delete(transport.sessionId); });
    // A silent stream is closed by an idle proxy long before any MCP rule
    // applies, and the client then sees a dead connection rather than a
    // deliberate end. A comment frame costs two bytes and keeps it honest.
    //
    // ONLY the legacy door needs this from us, and that asymmetry is easy to
    // read as an oversight, so: `StreamableHTTPServerTransport` is a thin
    // wrapper around `WebStandardStreamableHTTPServerTransport`, which arms a
    // keep-alive on its standalone GET stream itself and clears it in that
    // stream's cleanup (SDK 1.30.0, `server/webStandardStreamableHttp.js`,
    // `startKeepAlive` at the three stream sites). `SSEServerTransport` takes
    // no `keepAliveMs` option at all and arms nothing — so the route does it,
    // at the same cadence, which is why `keepAliveMs` is passed to the modern
    // transport above rather than left at the SDK's own default.
    //
    // `ticks` is incremented before the write is attempted, so a timer that
    // outlived its stream is visible from outside rather than merely harmless
    // looking.
    const keepAlive = armSseKeepAlive(keepAliveMs, () => { ticks += 1; if (!res.writableEnded) res.write(": keep-alive\n\n"); });
    res.on("close", () => { if (keepAlive) clearInterval(keepAlive); });
    const server = createServer(deps);
    // No cast here, unlike the Streamable HTTP path above: `SSEServerTransport`
    // does satisfy the SDK's own `Transport` interface under
    // `exactOptionalPropertyTypes`, and asserting anyway would hide the day it
    // stops doing so.
    await server.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    const line = startLine(req, "sse");
    const release = admit(req, res, true);
    if (release === null) { emit(line, 429, undefined, res); return; }
    // The Host/Origin rule before the session is looked up (2024-11-05 HTTP with SSE, Security Warning 1: "Servers
    // MUST validate the Origin header on all incoming connections"), in the SDK's legacy words and shape (plain
    // 403), which `handlePostMessage` applies only to a session it holds.
    const refusal = originRefusal(req, allowedHosts, allowedOrigins);
    if (refusal !== undefined) { release(); emit(line, 403); res.status(403).send(refusal); return; }
    const sid = typeof req.query["sessionId"] === "string" ? req.query["sessionId"] : "";
    const s = sessions.get(sid);
    if (!s || s.transportKind !== "sse") { release(); emit(line, 400); res.status(400).send("Missing or unknown sessionId"); return; }
    s.touched = Date.now();
    // The legacy door's `initialize` arrives HERE, on a session the stream
    // opened: remember its client name for the requests that follow.
    if (line.rpc === "initialize") s.client = line.client;
    // A REQUEST is finished when its answer leaves on the stream (see the
    // `send` wrapper in `GET /sse`); a notification, a response or a refused
    // body is finished when this POST is.
    const { id, isRequest } = rpcSummary(req.body);
    const pending = s.pending;
    if (isRequest && id !== null && pending !== undefined) {
      pending.get(id)?.release();
      pending.set(id, { line, release });
      res.on("close", () => {
        // The transport refused the body (a 4xx): no answer will ever leave.
        if (res.statusCode >= 400 && pending.get(id)?.line === line) { pending.delete(id); release(); emit(line, res.statusCode); }
      });
    } else {
      res.on("close", () => { release(); emit(line, res.statusCode); });
    }
    await (s.transport as SSEServerTransport).handlePostMessage(req, res, req.body);
  });

  // ---- The server card -------------------------------------------
  //
  // Public, read-only metadata (`server-card.ts`), so the CORS rule is the
  // extension's — `*`, GET only — and not the session allow-list above: a
  // browser client may read a card from any page, and the card carries
  // nothing a page could not read off viafrei.de. No cookie or credential is
  // involved, so `*` grants nothing. Rate-limited like every route here (the
  // SEP's "SHOULD rate-limit"), holding no in-flight slot because it is a
  // constant. Cacheable for an hour with a validator: Express computes the
  // ETag from the body and answers a matching `If-None-Match` with a 304.
  const cardBody = `${JSON.stringify(serverCard(deps.catalogue), null, 2)}\n`;
  for (const path of SERVER_CARD_PATHS) {
    app.get(path, (req, res) => {
      if (admit(req, res, false) === null) return;
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-methods", "GET");
      res.setHeader("access-control-allow-headers", "Content-Type, If-None-Match");
      res.setHeader("access-control-expose-headers", "ETag");
      res.setHeader("cache-control", "public, max-age=3600");
      // The card's own media type to a client that names it; plain JSON to
      // everybody else (a crawler, `curl`), which is what they can read.
      const type = (req.header("accept") ?? "").includes(SERVER_CARD_MEDIA_TYPE) ? SERVER_CARD_MEDIA_TYPE : "application/json";
      res.type(`${type}; charset=utf-8`).send(cardBody);
    });
  }

  // The brand icon: a client that shows a connector by its
  // domain's favicon gets ViaFrei's, from the one copy viafrei.de serves — a redirect, so there is no second file.
  for (const f of ["/favicon.ico", "/favicon.svg"]) {
    app.get(f, (_req, res) => {
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.redirect(301, `https://viafrei.de${f}`);
    });
  }
  // RFC 9116 security.txt: one document, viafrei.de's, so the two hosts name one contact. The RFC lets a
  // host's file redirect to another; the file's `Canonical` names the viafrei.de address the client lands on.
  app.get("/.well-known/security.txt", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.redirect(301, SECURITY_TXT_URL);
  });
  // GET/HEAD / (owner order): the page for a browser, the old empty 404 for every other client.
  app.get("/", homePage);
  // Every other path: a JSON 404 naming the endpoint, not Express's HTML page.
  // Registered last, so it answers only what no route above claimed.
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ jsonrpc: "2.0", error: { code: -32601, message: "Not found: the MCP endpoint is POST /mcp (Streamable HTTP); legacy clients use GET /sse." }, id: null });
  });

  const sweep = (now = Date.now()): number => {
    const cutoff = now - sessionTtlMs;
    let closed = 0;
    for (const [id, s] of sessions) {
      if (s.streams > 0 || s.touched >= cutoff) continue;
      void s.transport.close();
      sessions.delete(id);
      closed += 1;
    }
    return closed;
  };
  // The limiter's buckets are pruned on the same cadence: an address that has
  // gone quiet is dropped once its bucket is full again.
  const timer = sessionSweepMs > 0 ? setInterval(() => { sweep(); limiter?.prune(); }, sessionSweepMs) : undefined;
  timer?.unref();

  return {
    app,
    sessions,
    sweep,
    keepAliveMs,
    keepAliveTicks: () => ticks,
    limiter,
    sessionCapStats: () => ({ ...capStats }),
    close: async () => {
      if (timer) clearInterval(timer);
      for (const [id, s] of sessions) { await s.transport.close().catch(() => undefined); sessions.delete(id); }
    },
  };
}
