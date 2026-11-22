/**
 * The session caps, global and per address, through the real route table over a real socket: the longest idle
 * session is evicted first, and when every session holds a stream the new one is refused with Retry-After.
 */
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { transportDeps } from "./deps.js";
import { afterEach, describe, expect, it } from "vitest";
import { createMcpApp, RATE_LIMITED_CODE, type McpApp, type McpAppOptions } from "../../src/app.js";
import { parseTrustedProxies } from "../../src/client-ip.js";
import { mcpEnvSchema } from "../../src/env.js";

type Booted = { mcp: McpApp; http: HttpServer; origin: string; warned: string[] };
const running: Booted[] = [];
const streams: AbortController[] = [];
/** A held stream's reader ending for any reason but the test's own abort. */
const clientErrors: string[] = [];

afterEach(async () => {
  for (const c of streams.splice(0)) c.abort();
  clientErrors.splice(0);
  for (const b of running.splice(0)) {
    await b.mcp.close();
    await new Promise<void>((resolve) => { b.http.close(() => resolve()); });
  }
});

async function boot(o: Partial<McpAppOptions> = {}): Promise<Booted> {
  const allowedHosts: string[] = [];
  const warned: string[] = [];
  const mcp = createMcpApp({
    deps: transportDeps(),
    allowedOrigins: ["https://alpha.example"],
    allowedHosts,
    maxBodyKb: 64,
    sessionTtlMs: 60_000,
    sessionSweepMs: 0,
    warn: (_f, m) => { warned.push(m); },
    ...o,
  });
  const http = await new Promise<HttpServer>((resolve) => { const s = mcp.app.listen(0, "127.0.0.1", () => resolve(s)); });
  const port = (http.address() as AddressInfo).port;
  allowedHosts.push(`127.0.0.1:${String(port)}`);
  const b = { mcp, http, origin: `http://127.0.0.1:${String(port)}`, warned };
  running.push(b);
  return b;
}

const INIT = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "zz-cap", version: "0" } } };

async function post(b: Booted, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${b.origin}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify(body),
  });
}

/** Initialise a session; return its id, or the refusal. */
async function open(b: Booted, headers: Record<string, string> = {}): Promise<{ sid: string; status: number; retryAfter: string | null; body: string }> {
  const r = await post(b, INIT, headers);
  const body = await r.text();
  const sid = r.headers.get("mcp-session-id") ?? "";
  if (r.status === 200) {
    const n = await post(b, { jsonrpc: "2.0", method: "notifications/initialized" }, { "mcp-session-id": sid, ...headers });
    await n.text();
  }
  return { sid, status: r.status, retryAfter: r.headers.get("retry-after"), body };
}

/** Is this session still served? A ping on it answers 200, or 400/404 once it is gone. */
async function alive(b: Booted, sid: string, headers: Record<string, string> = {}): Promise<boolean> {
  const r = await post(b, { jsonrpc: "2.0", id: 9, method: "ping" }, { "mcp-session-id": sid, ...headers });
  await r.text();
  return r.status === 200;
}

/**
 * Open a server→client stream and KEEP READING it until the test aborts it.
 *
 * Reading is what holds it. A `Response` whose body nobody reads is
 * garbage once the helper returns, and undici cancels the body of a collected
 * `Response`, which destroys the socket: the server then sees a client that
 * vanished (`req.aborted` true, `writableEnded` false), drops the stream count
 * to 0, and the cap rightly evicts that session. Under full-suite load a
 * collection lands between the hold and the next open often enough to fail.
 * undici cancels only an unlocked, undisturbed body, so a locked (and read)
 * body survives the collection, and the pump is what a listening client does
 * anyway.
 */
async function hold(url: string, headers: Record<string, string>): Promise<Response> {
  const c = new AbortController();
  streams.push(c);
  const r = await fetch(url, { method: "GET", headers: { accept: "text/event-stream", ...headers }, signal: c.signal });
  const reader = r.body?.getReader();
  if (reader !== undefined) {
    void (async () => {
      try {
        for (;;) {
          if ((await reader.read()).done) {
            if (!c.signal.aborted) clientErrors.push("the server ended the stream");
            return;
          }
        }
      } catch (e) {
        if (!c.signal.aborted) clientErrors.push(e instanceof Error ? e.message : String(e));
      }
    })();
  }
  return r;
}

/**
 * A full collection, on demand: what a loaded suite does at a moment nobody
 * chooses. `--expose-gc` reaches every worker through `NODE_OPTIONS` in the
 * root `test` script (the `charging.test.ts` rule); setting it with
 * `v8.setFlagsFromString()` here would mutate V8's flags mid-process under
 * whatever file the reused worker runs next.
 */
function collect(): void {
  const gc = (globalThis as { gc?: () => void }).gc;
  // A precondition, not a fallback: without a real collection
  // the garbage-collection case proves nothing, so it fails loudly.
  if (typeof gc !== "function") {
    throw new Error("--expose-gc is missing; vitest.config.ts sets it in execArgv");
  }
  gc();
}

/** Hold the session's standalone server→client stream open until the test ends. */
async function holdStream(b: Booted, sid: string, headers: Record<string, string> = {}): Promise<void> {
  const r = await hold(`${b.origin}/mcp`, { "mcp-session-id": sid, ...headers });
  expect(r.status).toBe(200);
  const until = Date.now() + 2_000;
  while (Date.now() < until && (b.mcp.sessions.get(sid)?.streams ?? 0) === 0) await new Promise((res) => setTimeout(res, 5));
  expect(b.mcp.sessions.get(sid)?.streams).toBe(1);
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 5));

describe("the global session cap", () => {
  it("evicts the LONGEST-IDLE session to make room, and only that one", async () => {
    const b = await boot({ maxSessions: 2 });
    const s1 = await open(b); await tick();
    const s2 = await open(b); await tick();
    // s1 is touched again, so s2 is now the longest idle.
    expect(await alive(b, s1.sid)).toBe(true); await tick();
    const s3 = await open(b);
    expect(s3.status).toBe(200);
    expect(b.mcp.sessions.size).toBe(2);
    expect(await alive(b, s2.sid), "the longest-idle session should have been evicted").toBe(false);
    expect(await alive(b, s1.sid)).toBe(true);
    expect(await alive(b, s3.sid)).toBe(true);
    expect(b.mcp.sessionCapStats()).toEqual({ evicted: 1, refusedGlobal: 0, refusedAddress: 0 });
  });

  it("refuses 503 + Retry-After when every session holds a stream — a listening client is never evicted", async () => {
    const b = await boot({ maxSessions: 2, sessionRetryAfterS: 17 });
    const s1 = await open(b); const s2 = await open(b);
    await holdStream(b, s1.sid); await holdStream(b, s2.sid);
    const s3 = await open(b);
    expect(s3.status).toBe(503);
    expect(s3.retryAfter).toBe("17");
    const body = JSON.parse(s3.body) as { jsonrpc: string; error: { code: number; data: { retryAfterS: number } }; id: unknown };
    expect(body).toMatchObject({ jsonrpc: "2.0", error: { code: RATE_LIMITED_CODE, data: { retryAfterS: 17 } }, id: 1 });
    expect(b.mcp.sessions.size).toBe(2);
    expect(b.mcp.sessionCapStats().refusedGlobal).toBe(1);
    expect(b.warned.filter((w) => w.includes("session cap"))).toHaveLength(1);
    // A second refusal is counted but not said again.
    expect((await open(b)).status).toBe(503);
    expect(b.mcp.sessionCapStats().refusedGlobal).toBe(2);
    expect(b.warned.filter((w) => w.includes("session cap"))).toHaveLength(1);
  });

  it("a held stream survives a garbage collection before the next open: the 503 does not hang on GC timing", async () => {
    const b = await boot({ maxSessions: 2 });
    const s1 = await open(b); const s2 = await open(b);
    await holdStream(b, s1.sid); await holdStream(b, s2.sid);
    for (let i = 0; i < 3; i++) { collect(); await tick(); }
    expect(b.mcp.sessions.get(s1.sid)?.streams, "a held stream was closed by the collection").toBe(1);
    expect(b.mcp.sessions.get(s2.sid)?.streams).toBe(1);
    expect((await open(b)).status).toBe(503);
    expect(clientErrors).toEqual([]);
  });

  it("counts the legacy door's sessions too: an open /sse stream fills the cap", async () => {
    const b = await boot({ maxSessions: 1 });
    const r = await hold(`${b.origin}/sse`, {});
    expect(r.status).toBe(200);
    const until = Date.now() + 2_000;
    while (Date.now() < until && b.mcp.sessions.size === 0) await tick();
    expect(b.mcp.sessions.size).toBe(1);
    expect((await open(b)).status).toBe(503);
  });

  it("does nothing at all without a cap", async () => {
    const b = await boot();
    for (let i = 0; i < 6; i++) expect((await open(b)).status).toBe(200);
    expect(b.mcp.sessions.size).toBe(6);
    expect(b.mcp.sessionCapStats()).toEqual({ evicted: 0, refusedGlobal: 0, refusedAddress: 0 });
  });
});

describe("the per-address session cap", () => {
  const A = { "x-forwarded-for": "203.0.113.5" };
  const B = { "x-forwarded-for": "198.51.100.7" };
  const trustedProxies = parseTrustedProxies("127.0.0.0/8");

  it("evicts the address's OWN longest-idle session and leaves another address alone", async () => {
    const b = await boot({ maxSessionsPerAddress: 2, trustedProxies });
    const other = await open(b, B); await tick();
    const a1 = await open(b, A); await tick();
    const a2 = await open(b, A); await tick();
    const a3 = await open(b, A);
    expect(a3.status).toBe(200);
    expect(await alive(b, a1.sid, A)).toBe(false);
    expect(await alive(b, a2.sid, A)).toBe(true);
    // B's session is OLDER than every one of A's, and survives: the eviction is per address.
    expect(await alive(b, other.sid, B)).toBe(true);
    expect(b.mcp.sessionCapStats().evicted).toBe(1);
  });

  it("refuses 429 + Retry-After when all of the address's sessions hold a stream; other addresses still get in", async () => {
    const b = await boot({ maxSessionsPerAddress: 1, trustedProxies, sessionRetryAfterS: 5 });
    const a1 = await open(b, A);
    await holdStream(b, a1.sid, A);
    const a2 = await open(b, A);
    expect(a2.status).toBe(429);
    expect(a2.retryAfter).toBe("5");
    expect((await open(b, B)).status).toBe(200);
    expect(b.mcp.sessionCapStats().refusedAddress).toBe(1);
  });

  it("does not count an unattributable opener (a trusted peer naming nobody)", async () => {
    const b = await boot({ maxSessionsPerAddress: 1, trustedProxies });
    for (let i = 0; i < 3; i++) expect((await open(b)).status).toBe(200);
    expect(b.mcp.sessions.size).toBe(3);
  });
});

describe("the environment that sets them", () => {
  it("defaults to a global cap and NO per-address cap, and refuses nonsense", () => {
    const e = mcpEnvSchema.parse({});
    expect(e.MCP_MAX_SESSIONS).toBe(500);
    expect(e.MCP_MAX_SESSIONS_PER_ADDRESS).toBe(0);
    expect(mcpEnvSchema.parse({ MCP_MAX_SESSIONS: "0" }).MCP_MAX_SESSIONS).toBe(0);
    expect(() => mcpEnvSchema.parse({ MCP_MAX_SESSIONS: "-1" })).toThrow();
    expect(() => mcpEnvSchema.parse({ MCP_MAX_SESSIONS_PER_ADDRESS: "x" })).toThrow();
  });
});
