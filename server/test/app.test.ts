/**
 * The HTTP app through real requests, in process: health and readiness, Streamable HTTP on /mcp (a session
 * from initialize to DELETE, the refusals before one exists, the idle sweep), the legacy HTTP+SSE pair, and
 * the body parser's JSON-RPC answers. The API behind it is the contract mock; requests to the app itself go through undici's own
 * fetch, which the mock does not intercept, so a streamed answer streams.
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { HttpResponse } from "msw";
import { fetch as undiciFetch } from "undici";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { API_BASE, calls, handlerFor, mockServer } from "./api-mock.js";
import { TEST_KEY, textOf } from "./harness.js";
import { ApiClient } from "../src/api/client.js";
import { loadCatalogue } from "../src/catalogue.js";
import { createMcpApp, SESSION_NOT_FOUND } from "../src/app.js";
import { apiReadiness } from "../src/http-server.js";

/** The idle lifetime the server runs with by default (MCP_SESSION_TTL_S, 1 800 s). */
const SESSION_IDLE_MS = 30 * 60 * 1000;

beforeAll(() => mockServer.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  mockServer.resetHandlers();
  calls.length = 0;
  vi.restoreAllMocks();
  vi.useRealTimers();
});
afterAll(() => mockServer.close());

/** A fetch to the app, past the API mock. */
const appFetch = undiciFetch as unknown as typeof fetch;
const deps = () => ({ api: new ApiClient({ baseUrl: API_BASE, key: TEST_KEY }), catalogue: loadCatalogue() });

async function serve(): Promise<{ base: string; stop: () => Promise<void> }> {
  const d = deps();
  const { app } = createMcpApp({ deps: d, allowedOrigins: [], allowedHosts: [], maxBodyKb: 64, sessionTtlMs: SESSION_IDLE_MS, sessionSweepMs: 60_000, health: () => ({ ok: true }), ready: apiReadiness(API_BASE) });
  const server: Server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}

const INIT = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "0" } } };
const LIST = { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };
const post = (base: string, body: unknown, headers: Record<string, string> = {}) =>
  appFetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

describe("health and readiness", () => {
  it("/healthz answers ok and does not name the framework", async () => {
    const { base, stop } = await serve();
    try {
      const r = await appFetch(`${base}/healthz`);
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ status: "ok" });
      expect(r.headers.get("x-powered-by")).toBeNull();
    } finally {
      await stop();
    }
  });

  it("/readyz is the API's own readiness: ok, and degraded when the API is not ready or unreachable", async () => {
    const { base, stop } = await serve();
    try {
      let r = await appFetch(`${base}/readyz`);
      expect([r.status, await r.json()]).toEqual([200, { status: "ok" }]);
      expect(calls.map((c) => c.url.href)).toEqual([`${API_BASE}/readyz`]);
      mockServer.use(handlerFor("getReadiness", () => HttpResponse.json({ status: "starting" }, { status: 503 })));
      r = await appFetch(`${base}/readyz`);
      expect([r.status, await r.json()]).toEqual([503, { status: "degraded" }]);
      mockServer.use(handlerFor("getReadiness", () => HttpResponse.error()));
      r = await appFetch(`${base}/readyz`);
      expect([r.status, await r.json()]).toEqual([503, { status: "degraded" }]);
    } finally {
      await stop();
    }
  });
});

describe("Streamable HTTP on /mcp", () => {
  it("a session from initialize to DELETE: tools listed and called through it, then gone", async () => {
    const { base, stop } = await serve();
    try {
      const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { fetch: appFetch });
      const client = new Client({ name: "t", version: "0" });
      await client.connect(transport);
      const id = transport.sessionId!;
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect((await client.listTools()).tools).toHaveLength(loadCatalogue().tools.length);
      const r = await client.callTool({ name: "find_place", arguments: { query: "Köln", language: "en" } });
      expect(textOf(r)).toContain("Matfienland (state)");
      const stream = await appFetch(`${base}/mcp`, { headers: { "mcp-session-id": id, accept: "text/event-stream" } });
      // The client already holds the session's one standalone stream: the session's own transport refuses a
      // second (409), which shows the GET reached that session (an unknown one is 404, below).
      expect(stream.status).toBe(409);
      await stream.body?.cancel();
      await transport.terminateSession();
      const after = await post(base, LIST, { "mcp-session-id": id });
      expect(after.status).toBe(404);
      await client.close();
    } finally {
      await stop();
    }
  });

  it("refuses a request before initialize, and an unknown session; an initialize naming a dead session opens one", async () => {
    const { base, stop } = await serve();
    try {
      let r = await post(base, { ...LIST, method: "resources/list" });
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ jsonrpc: "2.0", error: { code: -32000, message: "No valid session; send initialize first" }, id: null });
      r = await post(base, LIST, { "mcp-session-id": "nope" });
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual(SESSION_NOT_FOUND);
      r = await post(base, INIT, { "mcp-session-id": "nope" });
      expect(r.status).toBe(200);
      await r.text();
      for (const method of ["GET", "DELETE"]) {
        const named = await appFetch(`${base}/mcp`, { method, headers: { "mcp-session-id": "nope" } });
        expect([method, named.status, await named.json()]).toEqual([method, 404, SESSION_NOT_FOUND]);
      }
      expect((await appFetch(`${base}/mcp`, { method: "GET" })).status).toBe(405);
      expect((await appFetch(`${base}/mcp`, { method: "DELETE" })).status).toBe(400);
    } finally {
      await stop();
    }
  });

  it("a body that is no JSON is 400 with a -32700 Parse error, not a stack trace", async () => {
    const { base, stop } = await serve();
    try {
      const r = await post(base, "{not json");
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error: the request body is not valid JSON." }, id: null });
    } finally {
      await stop();
    }
  });

  it("a session idle for longer than SESSION_IDLE_MS is closed by the minute sweep; a request keeps it alive", async () => {
    expect(SESSION_IDLE_MS).toBe(30 * 60 * 1000);
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const { base, stop } = await serve();
    try {
      const init = await post(base, INIT);
      expect(init.status).toBe(200);
      const id = init.headers.get("mcp-session-id")!;
      await init.text();
      const ask = async (): Promise<number> => {
        const r = await post(base, LIST, { "mcp-session-id": id, "mcp-protocol-version": "2025-03-26" });
        await r.text();
        return r.status;
      };
      now += 20 * 60 * 1000;
      expect(await ask()).toBe(200);
      now += SESSION_IDLE_MS;
      vi.advanceTimersByTime(59_000);
      expect(await ask()).toBe(200);
      now += SESSION_IDLE_MS;
      vi.advanceTimersByTime(60_000);
      expect(await ask()).toBe(200);
      now += SESSION_IDLE_MS - 1;
      vi.advanceTimersByTime(60_000);
      expect(await ask()).toBe(200);
      now += SESSION_IDLE_MS + 1;
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
      expect(await ask()).toBe(404);
    } finally {
      await stop();
    }
  });
});

describe("the legacy HTTP+SSE pair", () => {
  it("/sse opens a session whose /messages answer tools/list and a tool call; an unknown or missing session is 400", async () => {
    const { base, stop } = await serve();
    try {
      const client = new Client({ name: "t", version: "0" });
      await client.connect(new SSEClientTransport(new URL(`${base}/sse`), { fetch: appFetch }));
      expect((await client.listTools()).tools).toHaveLength(loadCatalogue().tools.length);
      const r = await client.callTool({ name: "find_place", arguments: { query: "Köln", language: "de" } });
      expect(textOf(r)).toContain("Matfienland (state)");
      await client.close();
      for (const q of ["?sessionId=nope", ""]) {
        const m = await appFetch(`${base}/messages${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(LIST) });
        expect([m.status, await m.text()]).toEqual([400, "Missing or unknown sessionId"]);
      }
    } finally {
      await stop();
    }
  });
});
