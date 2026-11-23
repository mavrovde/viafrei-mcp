/**
 * Every status the HTTP surface answers, in one table: the request, the status, and the header or JSON-RPC code
 * that goes with it. The rows are the server this one replaces, route for route; where the MCP specification
 * names the status, the row says which clause. Each row is its own case, so a change to one answer names itself.
 */
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMcpApp, MCP_ENDPOINT_ALLOW, RATE_LIMITED_CODE, type McpApp, type McpAppOptions } from "../../src/app.js";
import { SECURITY_TXT_URL, SERVER_CARD_MEDIA_TYPE } from "../../src/server-card.js";
import { transportDeps } from "./deps.js";

type Booted = { mcp: McpApp; http: HttpServer; origin: string };
const booted: Booted[] = [];

async function boot(o: Partial<McpAppOptions> = {}): Promise<Booted> {
  const allowedHosts: string[] = [];
  const mcp = createMcpApp({ deps: transportDeps(), allowedOrigins: ["https://alpha.example"], allowedHosts, maxBodyKb: 8, sessionTtlMs: 60_000, sessionSweepMs: 0, health: () => ({ ok: true }), ready: () => Promise.resolve("ok"), ...o });
  const http = await new Promise<HttpServer>((resolve) => { const s = mcp.app.listen(0, "127.0.0.1", () => resolve(s)); });
  const port = (http.address() as AddressInfo).port;
  allowedHosts.push(`127.0.0.1:${String(port)}`);
  const b = { mcp, http, origin: `http://127.0.0.1:${String(port)}` };
  booted.push(b);
  return b;
}
afterAll(async () => {
  for (const b of booted.splice(0)) {
    await b.mcp.close();
    b.http.closeAllConnections();
    await new Promise<void>((resolve) => { b.http.close(() => resolve()); });
  }
});

const ACCEPT = "application/json, text/event-stream";
const INIT = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "status-table", version: "0" } } };
const LIST = { jsonrpc: "2.0", id: 2, method: "tools/list" };

let plain: Booted;
let liveSession = "";
beforeAll(async () => {
  plain = await boot();
  const r = await fetch(`${plain.origin}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: ACCEPT }, body: JSON.stringify(INIT) });
  await r.text();
  liveSession = r.headers.get("mcp-session-id") ?? "";
});

type Row = {
  readonly name: string;
  readonly app?: () => Promise<Booted>;
  readonly method?: string;
  readonly path: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  /** Sent first, on the same app: a request that spends what the row then finds spent. */
  readonly before?: number;
  readonly status: number;
  readonly header?: readonly [string, string | RegExp];
  readonly rpcCode?: number;
  readonly text?: string | RegExp;
};

const json = (body: unknown, headers: Record<string, string> = {}): Pick<Row, "headers" | "body" | "method"> => ({ method: "POST", headers: { "content-type": "application/json", accept: ACCEPT, ...headers }, body });

const ROWS: readonly Row[] = [
  { name: "/healthz is liveness", path: "/healthz", status: 200, text: '{"status":"ok"}' },
  { name: "/readyz is readiness", path: "/readyz", status: 200, text: '{"status":"ok"}' },
  { name: "/readyz past its deadline is 503 slow", app: () => boot({ ready: () => Promise.resolve("slow") }), path: "/readyz", status: 503, text: '{"status":"slow"}' },
  { name: "initialize opens a session", path: "/mcp", ...json(INIT), status: 200, header: ["mcp-session-id", /^[0-9a-f-]{36}$/u] },
  { name: "a request with no session (Session Management: SHOULD 400)", path: "/mcp", ...json({ jsonrpc: "2.0", id: 3, method: "resources/list" }), status: 400, rpcCode: -32000 },
  { name: "a request naming an ended session (Session Management: MUST 404)", path: "/mcp", ...json(LIST, { "mcp-session-id": "ended" }), status: 404, rpcCode: -32001 },
  { name: "JSON that is no JSON-RPC message is -32600", path: "/mcp", ...json({ hello: "world" }), status: 400, rpcCode: -32600 },
  { name: "a body that is not JSON is -32700", path: "/mcp", method: "POST", headers: { "content-type": "application/json", accept: ACCEPT }, body: "{not json", status: 400, rpcCode: -32700 },
  { name: "a body over MCP_MAX_BODY_KB keeps its 413, with -32600", path: "/mcp", ...json({ ...LIST, params: { pad: "x".repeat(9 * 1024) } }), status: 413, rpcCode: -32600 },
  { name: "an unsupported MCP-Protocol-Version on a live session is 400", path: "/mcp", ...json(LIST, { "mcp-session-id": "LIVE", "mcp-protocol-version": "1999-01-01" }), status: 400 },
  { name: "an Origin off the allow-list is 403 (Security Warning 1: MUST 403)", path: "/mcp", ...json(INIT, { origin: "https://gamma.example" }), status: 403, rpcCode: -32000 },
  { name: "a Host off the allow-list is 403 (DNS rebinding)", app: () => boot({ allowedHosts: ["mcp.viafrei.de"] }), path: "/mcp", ...json(INIT), status: 403, rpcCode: -32000 },
  { name: "GET /mcp with no session (GET stream: MUST event-stream or 405)", path: "/mcp", status: 405, header: ["allow", MCP_ENDPOINT_ALLOW], rpcCode: -32000 },
  { name: "HEAD /mcp is 405 in every state", method: "HEAD", path: "/mcp", headers: { "mcp-session-id": "LIVE" }, status: 405, header: ["allow", MCP_ENDPOINT_ALLOW] },
  { name: "GET /mcp naming an ended session is 404", path: "/mcp", headers: { "mcp-session-id": "ended" }, status: 404, rpcCode: -32001 },
  { name: "DELETE /mcp with no session is 400", method: "DELETE", path: "/mcp", status: 400, rpcCode: -32000 },
  { name: "DELETE /mcp naming an ended session is 404", method: "DELETE", path: "/mcp", headers: { "mcp-session-id": "ended" }, status: 404, rpcCode: -32001 },
  { name: "PUT /mcp: the resource exists, so 405 with Allow (RFC 9110 §15.5.6)", method: "PUT", path: "/mcp", status: 405, header: ["allow", MCP_ENDPOINT_ALLOW], rpcCode: -32000 },
  { name: "a CORS preflight from a listed origin is 204 with the grant", method: "OPTIONS", path: "/mcp", headers: { origin: "https://alpha.example", "access-control-request-method": "POST" }, status: 204, header: ["access-control-expose-headers", "Mcp-Session-Id"] },
  { name: "a CORS preflight from an unlisted origin is 403", method: "OPTIONS", path: "/mcp", headers: { origin: "https://gamma.example", "access-control-request-method": "POST" }, status: 403, text: "Invalid Origin header: https://gamma.example" },
  { name: "the legacy /messages with an unknown session is 400", method: "POST", path: "/messages?sessionId=nope", headers: { "content-type": "application/json" }, body: LIST, status: 400, text: "Missing or unknown sessionId" },
  { name: "the legacy /sse from an unlisted origin is 403", path: "/sse", headers: { origin: "https://gamma.example" }, status: 403, text: "Invalid Origin header: https://gamma.example" },
  { name: "past the per-address rate: 429 with Retry-After", app: () => boot({ ipLimits: { maxInflight: 0, ratePerMin: 1, burst: 1 } }), before: 1, path: "/mcp", ...json(INIT), status: 429, header: ["retry-after", /^\d+$/u], rpcCode: RATE_LIMITED_CODE },
  { name: "the server card, any origin may read it", path: "/.well-known/mcp.json", status: 200, header: ["access-control-allow-origin", "*"] },
  { name: "the server card in its own media type to a client that names it", path: "/mcp/server-card", headers: { accept: SERVER_CARD_MEDIA_TYPE }, status: 200, header: ["content-type", `${SERVER_CARD_MEDIA_TYPE}; charset=utf-8`] },
  { name: "the server card's preflight is 204, GET from anywhere", method: "OPTIONS", path: "/.well-known/mcp/server-card.json", headers: { origin: "https://gamma.example" }, status: 204, header: ["access-control-allow-methods", "GET"] },
  { name: "security.txt redirects to viafrei.de's one RFC 9116 file", path: "/.well-known/security.txt", status: 301, header: ["location", SECURITY_TXT_URL] },
  { name: "the favicon redirects to viafrei.de's", path: "/favicon.ico", status: 301, header: ["location", "https://viafrei.de/favicon.ico"] },
  { name: "the root is a bare 404", path: "/", status: 404, text: "" },
  { name: "any other path is a JSON 404 naming the endpoint", path: "/nothing-here", status: 404, rpcCode: -32601 },
];

describe("every status the HTTP surface answers", () => {
  it.each(ROWS)("$name: $status", async (row) => {
    const b = row.app === undefined ? plain : await row.app();
    const headers = Object.fromEntries(Object.entries(row.headers ?? {}).map(([k, v]) => [k, v === "LIVE" ? liveSession : v]));
    const send = async (): Promise<Response> => fetch(`${b.origin}${row.path}`, {
      method: row.method ?? "GET",
      headers,
      // A redirect is the answer under test; following it would leave this machine.
      redirect: "manual",
      ...(row.body === undefined ? {} : { body: typeof row.body === "string" ? row.body : JSON.stringify(row.body) }),
    });
    for (let i = 0; i < (row.before ?? 0); i += 1) await (await send()).text();
    const r = await send();
    const text = await r.text();
    expect(r.status).toBe(row.status);
    if (row.header !== undefined) {
      const [name, want] = row.header;
      const got = r.headers.get(name) ?? "";
      if (typeof want === "string") expect(got).toBe(want);
      else expect(got).toMatch(want);
    }
    if (row.rpcCode !== undefined) expect((JSON.parse(text) as { error?: { code?: number } }).error?.code).toBe(row.rpcCode);
    if (row.text !== undefined) {
      if (typeof row.text === "string") expect(text).toBe(row.text);
      else expect(text).toMatch(row.text);
    }
  });

  it("at the global session cap with every session holding a stream: 503 with Retry-After, the cap's code", async () => {
    const b = await boot({ maxSessions: 1, sessionRetryAfterS: 7 });
    const ctl = new AbortController();
    const held = await fetch(`${b.origin}/sse`, { headers: { accept: "text/event-stream" }, signal: ctl.signal });
    expect(held.status).toBe(200);
    try {
      const r = await fetch(`${b.origin}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: ACCEPT }, body: JSON.stringify(INIT) });
      expect(r.status).toBe(503);
      expect(r.headers.get("retry-after")).toBe("7");
      expect(((await r.json()) as { error: { code: number } }).error.code).toBe(RATE_LIMITED_CODE);
    } finally {
      ctl.abort();
    }
  });
});
