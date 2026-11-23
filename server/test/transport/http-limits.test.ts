/**
 * The per-address limit, the request log, liveness and readiness, the keep-alive and the body parser's
 * answers, through the REAL route table over a real socket. The API behind it is a stub that records, answers
 * 503 or holds each request, so what is asserted is what the routes do, not what the API holds.
 */
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { apiStub, type ApiStub } from "./deps.js";
import { afterEach, describe, expect, it } from "vitest";
import { createMcpApp, RATE_LIMITED_CODE, type McpApp, type McpAppOptions, type RequestLogLine } from "../../src/app.js";
import { parseTrustedProxies } from "../../src/client-ip.js";
import { createReadiness } from "../../src/readiness.js";
import { SECURITY_TXT_URL } from "../../src/server-card.js";

type Booted = { mcp: McpApp; http: HttpServer; origin: string; asked: string[]; lines: RequestLogLine[]; warned: string[] };
const running: Booted[] = [];

afterEach(async () => {
  for (const b of running.splice(0)) {
    await b.mcp.close();
    await new Promise<void>((resolve) => { b.http.close(() => resolve()); });
  }
});

async function boot(o: Partial<McpAppOptions> & { api?: ApiStub } = {}): Promise<Booted> {
  const allowedHosts: string[] = [];
  const lines: RequestLogLine[] = [];
  const warned: string[] = [];
  const api = o.api ?? apiStub();
  const mcp = createMcpApp({
    deps: api.deps,
    allowedOrigins: ["https://alpha.example"],
    allowedHosts,
    maxBodyKb: 64,
    sessionTtlMs: 60_000,
    sessionSweepMs: 0,
    requestLog: (l) => { lines.push(l); },
    warn: (_f, m) => { warned.push(m); },
    ...o,
  });
  const http = await new Promise<HttpServer>((resolve) => { const s = mcp.app.listen(0, "127.0.0.1", () => resolve(s)); });
  const port = (http.address() as AddressInfo).port;
  allowedHosts.push(`127.0.0.1:${String(port)}`);
  const b = { mcp, http, origin: `http://127.0.0.1:${String(port)}`, asked: api.asked, lines, warned };
  running.push(b);
  return b;
}

const INIT = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "zz-test", version: "0" } } };

async function post(b: Booted, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${b.origin}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify(body),
  });
}

/** Initialise a Streamable HTTP session and return its id. */
async function session(b: Booted, headers: Record<string, string> = {}): Promise<string> {
  const r = await post(b, INIT, headers);
  expect(r.status).toBe(200);
  await r.text();
  const sid = r.headers.get("mcp-session-id") ?? "";
  const n = await post(b, { jsonrpc: "2.0", method: "notifications/initialized" }, { "mcp-session-id": sid, ...headers });
  await n.text();
  return sid;
}

async function waitFor(pred: () => boolean, ms = 3_000): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until && !pred()) await new Promise((r) => setTimeout(r, 5));
}

describe("a stream outlives the edge's 100 s idle limit", () => {
  // Behind the edge proxy an HTTP response that sends no byte for 100 s is cut, so each door must write a comment
  // frame well inside that, on the DEFAULT cadence, which is what the server runs with (nothing sets it).
  const EDGE_IDLE_MS = 100_000;

  it("the default cadence leaves at least three keep-alives inside 100 s", async () => {
    const b = await boot();
    expect(b.mcp.keepAliveMs).toBeGreaterThan(0);
    expect(b.mcp.keepAliveMs * 3, "fewer than three keep-alives fit inside the edge's idle limit").toBeLessThanOrEqual(EDGE_IDLE_MS);
  });

  it("the legacy /sse door writes comment frames on an idle stream", async () => {
    const b = await boot({ keepAliveMs: 40 });
    const ctl = new AbortController();
    const r = await fetch(`${b.origin}/sse`, { headers: { accept: "text/event-stream" }, signal: ctl.signal });
    expect(r.status).toBe(200);
    const reader = r.body!.getReader();
    const dec = new TextDecoder();
    let text = "";
    const until = Date.now() + 1_500;
    while (Date.now() < until && (text.match(/^: keep-alive$/gm) ?? []).length < 2) {
      const { value, done } = await reader.read();
      if (done) break;
      text += dec.decode(value);
    }
    ctl.abort();
    expect((text.match(/^: keep-alive$/gm) ?? []).length, "an idle legacy stream wrote no comment frame").toBeGreaterThanOrEqual(2);
  });
});

describe("/healthz is liveness: process state, no API request", () => {
  it("answers 200 {status: ok} without a single API request, even when the API hangs", async () => {
    const api = apiStub(true);
    const b = await boot({ api, health: () => ({ ok: true }) });
    const r = await fetch(`${b.origin}/healthz`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "ok" });
    expect(api.asked).toEqual([]);
  });
});

describe("/readyz is readiness: the API's readiness, a deadline, nothing served but the word", () => {
  it("answers 200 {status: ok} when the ping returns in time", async () => {
    const b = await boot({ ready: createReadiness({ ping: () => Promise.resolve(), deadlineMs: 1_000 }) });
    const r = await fetch(`${b.origin}/readyz`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "ok" });
  });

  it("answers 503 {status: slow} at the deadline, and nothing but the word is served", async () => {
    const logged: Record<string, unknown>[] = [];
    const ready = createReadiness({
      ping: () => new Promise(() => undefined),
      deadlineMs: 50,
      warn: (f) => { logged.push(f); },
    });
    const b = await boot({ ready });
    const t0 = Date.now();
    const r = await fetch(`${b.origin}/readyz`);
    const body = await r.text();
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(r.status).toBe(503);
    expect(JSON.parse(body)).toEqual({ status: "slow" });
    expect(body, "how busy the host is, is not the internet's business").not.toMatch(/waiting|idle|total|16|9/);
    expect(logged[0]).toMatchObject({ state: "slow" });
  });

  it("answers 503 {status: degraded} when the API refuses", async () => {
    const b = await boot({ ready: createReadiness({ ping: () => Promise.reject(new Error("ECONNREFUSED")), deadlineMs: 1_000 }) });
    const r = await fetch(`${b.origin}/readyz`);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ status: "degraded" });
  });
});

describe("one log line per MCP request, and nothing personal in it", () => {
  it("records method, tool, status, ms and the pool's waiting count — and no argument, address or session id", async () => {
    const b = await boot({ poolCounts: () => ({ total: 16, idle: 13, waiting: 3 }) });
    const sid = await session(b);
    const r = await post(b, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "check_weather_warnings", arguments: { lat: 50.5546, lon: 9.6773, language: "en" } } }, { "mcp-session-id": sid });
    await r.text();
    await waitFor(() => b.lines.length >= 3);
    expect(b.lines.map((l) => [l.door, l.rpc, l.tool, l.status])).toEqual([
      ["streamable", "initialize", null, 200],
      ["streamable", "notifications/initialized", null, 202],
      ["streamable", "tools/call", "check_weather_warnings", 200],
    ]);
    for (const l of b.lines) {
      // The stub API answers 503, so the call's answer is the tool's own error: counted by its code, never its text.
      const extra = l.rpc === "tools/call" ? ["toolError", "toolErrorCode"] : [];
      if (l.rpc === "tools/call") expect(l.toolErrorCode).toBe("unavailable");
      expect(Object.keys(l).sort()).toEqual(["door", "ms", "poolWaiting", "rpc", "status", "tool", ...extra].sort());
      expect(l.poolWaiting).toBe(3);
      expect(typeof l.ms === "number" && l.ms >= 0).toBe(true);
    }
    const all = JSON.stringify(b.lines);
    expect(all).not.toContain("50.5546");
    expect(all).not.toContain("127.0.0.1");
    expect(all).not.toContain(sid);
  });

  it("logs a tool name only when it is SHAPED like one — a client's arbitrary string never reaches the log", async () => {
    const b = await boot();
    const sid = await session(b);
    const r = await post(b, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "Robert'); DROP TABLE x;--", arguments: {} } }, { "mcp-session-id": sid });
    await r.text();
    await waitFor(() => b.lines.some((l) => l.rpc === "tools/call"));
    expect(b.lines.find((l) => l.rpc === "tools/call")?.tool).toBeNull();
    expect(JSON.stringify(b.lines)).not.toContain("DROP");
  });

  it("closes the legacy door's line when the ANSWER leaves on the stream, and frees its slot", async () => {
    const b = await boot({ ipLimits: { maxInflight: 1, ratePerMin: 0, burst: 1 } });
    const client = new Client({ name: "zz-sse", version: "0" });
    await client.connect(new SSEClientTransport(new URL(`${b.origin}/sse`)));
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(10);
    await waitFor(() => b.lines.some((l) => l.door === "sse" && l.rpc === "tools/list"));
    const line = b.lines.find((l) => l.door === "sse" && l.rpc === "tools/list");
    expect(line).toMatchObject({ door: "sse", rpc: "tools/list", status: 200, rpcError: false });
    expect(b.mcp.limiter?.inflight("127.0.0.1"), "an answered legacy request must give its slot back").toBe(0);
    // With a cap of ONE in flight, a second request only works if the first was released.
    await client.listTools();
    await client.close();
  });
});

describe("the per-address limit", () => {
  it("answers 429 with Retry-After and a JSON-RPC error body that echoes the request id", async () => {
    const b = await boot({ ipLimits: { maxInflight: 0, ratePerMin: 60, burst: 2 } });
    const sid = await session(b); // two requests: the bucket is now empty
    const r = await post(b, { jsonrpc: "2.0", id: 42, method: "tools/list" }, { "mcp-session-id": sid });
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    const body = (await r.json()) as { jsonrpc: string; id: unknown; error: { code: number; message: string; data: { retryAfterS: number } } };
    expect(body.jsonrpc).toBe("2.0");
    expect(body.id).toBe(42);
    expect(body.error.code).toBe(RATE_LIMITED_CODE);
    expect(body.error.message).toMatch(/^Too many requests from this address \(at most 60 requests per minute\); retry after \d+ s\.$/);
    expect(body.error.data.retryAfterS).toBeGreaterThanOrEqual(1);
    await waitFor(() => b.lines.some((l) => l.status === 429));
    expect(b.lines.find((l) => l.status === 429)?.rpc).toBe("tools/list");
  });

  it("caps what one address has RUNNING: a second call while the first waits on the API is refused, and freed after", async () => {
    const api = apiStub(true);
    const { asked, release } = api;
    const b = await boot({ api, ipLimits: { maxInflight: 1, ratePerMin: 0, burst: 1 } });
    const sid = await session(b);
    const slow = post(b, { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "check_weather_warnings", arguments: { lat: 50.5546, lon: 9.6773 } } }, { "mcp-session-id": sid });
    await waitFor(() => asked.length > 0);
    expect(asked.length, "PRECONDITION: the first call is waiting on the API").toBeGreaterThan(0);
    const second = await post(b, { jsonrpc: "2.0", id: 6, method: "tools/list" }, { "mcp-session-id": sid });
    expect(second.status).toBe(429);
    expect(((await second.json()) as { error: { message: string } }).error.message).toMatch(/at most 1 requests running at once/);
    release();
    const done = await slow;
    await done.text();
    await waitFor(() => b.mcp.limiter?.inflight("127.0.0.1") === 0);
    const third = await post(b, { jsonrpc: "2.0", id: 7, method: "tools/list" }, { "mcp-session-id": sid });
    expect(third.status).toBe(200);
    await third.text();
  });

  it("counts each forwarded client in its own bucket behind a trusted proxy, and never the proxy's own address", async () => {
    const b = await boot({
      ready: createReadiness({ ping: () => Promise.resolve(), deadlineMs: 1_000 }),
      ipLimits: { maxInflight: 0, ratePerMin: 1, burst: 1 },
      trustedProxies: parseTrustedProxies("127.0.0.1/32"),
    });
    const get = (xff?: string): Promise<Response> => fetch(`${b.origin}/readyz`, { headers: xff === undefined ? {} : { "x-forwarded-for": xff } });
    expect((await get("203.0.113.1")).status).toBe(200);
    expect((await get("203.0.113.1")).status).toBe(429);
    // A forged first hop does not buy a fresh bucket: the LAST hop is the one counted.
    expect((await get("198.51.100.99, 203.0.113.1")).status).toBe(429);
    expect((await get("203.0.113.2")).status).toBe(200);
    // The proxy naming nobody is not limited (one bucket for everyone behind it
    // would be an outage), and the log says so — once per process, because on
    // a deployment every in-network probe arrives this way.
    for (let i = 0; i < 3; i += 1) expect((await get()).status).toBe(200);
    expect(b.warned.filter((w) => /no attributable client address/.test(w))).toHaveLength(1);
  });

  it("a spoofed CF-Connecting-IP buys no fresh bucket, from an untrusted peer or a trusted proxy", async () => {
    // The edge proxy is the ONE reader of a CDN client-address header, and only from
    // the CDN's ranges; it hands the result on as X-Forwarded-For. This
    // server must never read the header itself, or any client that reaches it
    // names its own bucket.
    const untrusted = await boot({
      ready: createReadiness({ ping: () => Promise.resolve(), deadlineMs: 1_000 }),
      ipLimits: { maxInflight: 0, ratePerMin: 1, burst: 1 },
    });
    const spoof = (b: Booted, cf: string, xff?: string): Promise<Response> =>
      fetch(`${b.origin}/readyz`, { headers: { "cf-connecting-ip": cf, "true-client-ip": cf, "x-real-ip": cf, ...(xff === undefined ? {} : { "x-forwarded-for": xff }) } });
    expect((await spoof(untrusted, "203.0.113.10")).status).toBe(200);
    expect((await spoof(untrusted, "203.0.113.11")).status, "the peer is counted, not the header").toBe(429);
    const proxied = await boot({
      ready: createReadiness({ ping: () => Promise.resolve(), deadlineMs: 1_000 }),
      ipLimits: { maxInflight: 0, ratePerMin: 1, burst: 1 },
      trustedProxies: parseTrustedProxies("127.0.0.1/32"),
    });
    expect((await spoof(proxied, "203.0.113.20", "198.51.100.5")).status).toBe(200);
    expect((await spoof(proxied, "203.0.113.21", "198.51.100.5")).status, "behind a trusted proxy X-Forwarded-For decides").toBe(429);
    // A trusted proxy naming nobody in X-Forwarded-For is unattributed (not
    // limited, warned about); a CF-Connecting-IP beside it does not attribute it.
    for (let i = 0; i < 3; i += 1) expect((await spoof(proxied, "203.0.113.30")).status).toBe(200);
    expect(proxied.warned.filter((w) => /no attributable client address/.test(w))).toHaveLength(1);
  });

  it("counts an IPv6 client by its /64: rotating the low 64 bits buys no fresh bucket", async () => {
    const b = await boot({
      ready: createReadiness({ ping: () => Promise.resolve(), deadlineMs: 1_000 }),
      ipLimits: { maxInflight: 0, ratePerMin: 1, burst: 1 },
      trustedProxies: parseTrustedProxies("127.0.0.1/32"),
    });
    const get = (xff: string): Promise<Response> => fetch(`${b.origin}/readyz`, { headers: { "x-forwarded-for": xff } });
    expect((await get("2001:db8:1:2::a")).status).toBe(200);
    expect((await get("2001:db8:1:2::b")).status).toBe(429);
    expect((await get("2001:db8:1:2:dead:beef:0:1")).status).toBe(429);
    expect((await get("2001:db8:1:3::a")).status, "another /64 is another holder").toBe(200);
  });

  it("warns ONCE when an untrusted peer sends X-Forwarded-For — the sign the limit has gone global", async () => {
    // No trust list: 127.0.0.1 is the client, so its header is not read.
    const b = await boot({
      ready: createReadiness({ ping: () => Promise.resolve(), deadlineMs: 1_000 }),
      ipLimits: { maxInflight: 0, ratePerMin: 0, burst: 1 },
    });
    for (let i = 0; i < 3; i += 1) expect((await fetch(`${b.origin}/readyz`, { headers: { "x-forwarded-for": "203.0.113.1" } })).status).toBe(200);
    expect((await fetch(`${b.origin}/readyz`)).status).toBe(200);
    const said = b.warned.filter((w) => /outside MCP_TRUSTED_PROXY_CIDR sent X-Forwarded-For/.test(w));
    expect(said).toHaveLength(1);
    expect(said[0], "the warning names no address").not.toMatch(/127\.0\.0\.1|203\.0\.113/);
  });

  it("says in the 429's log line WHICH limit fired, and nothing about who", async () => {
    const b = await boot({ ipLimits: { maxInflight: 0, ratePerMin: 60, burst: 2 } });
    const sid = await session(b);
    await (await post(b, { jsonrpc: "2.0", id: 8, method: "tools/list" }, { "mcp-session-id": sid })).text();
    await waitFor(() => b.lines.some((l) => l.status === 429));
    const line = b.lines.find((l) => l.status === 429);
    expect(line?.limited).toBe("rate");
    expect(b.lines.filter((l) => l.status !== 429).every((l) => l.limited === undefined)).toBe(true);
    expect(JSON.stringify(line)).not.toContain("127.0.0.1");
  });

  it("leaves /healthz unlimited — the container's own healthcheck must never meet a 429", async () => {
    const b = await boot({ health: () => ({ ok: true }), ipLimits: { maxInflight: 0, ratePerMin: 1, burst: 1 } });
    for (let i = 0; i < 5; i += 1) expect((await fetch(`${b.origin}/healthz`)).status).toBe(200);
  });

  it("limits the legacy door's stream opening too, with the same JSON-RPC body", async () => {
    // Three tokens: the stream, `initialize` and `notifications/initialized`.
    const b = await boot({ ipLimits: { maxInflight: 0, ratePerMin: 1, burst: 3 } });
    const first = new Client({ name: "zz-sse", version: "0" });
    await first.connect(new SSEClientTransport(new URL(`${b.origin}/sse`)));
    const r = await fetch(`${b.origin}/sse`);
    expect(r.status).toBe(429);
    expect(((await r.json()) as { error: { code: number } }).error.code).toBe(RATE_LIMITED_CODE);
    await first.close();
  });
});

describe("a refused body and an unknown path answer in JSON-RPC, never an HTML page", () => {
  it("the brand icon: /favicon.ico and /favicon.svg redirect to viafrei.de's one copy", async () => {
    const b = await boot();
    for (const f of ["/favicon.ico", "/favicon.svg"]) {
      const r = await fetch(`${b.origin}${f}`, { redirect: "manual" });
      expect(r.status, f).toBe(301);
      expect(r.headers.get("location"), f).toBe(`https://viafrei.de${f}`);
    }
  });

  it("security.txt: /.well-known/security.txt redirects to viafrei.de's one RFC 9116 file", async () => {
    const b = await boot();
    const r = await fetch(`${b.origin}/.well-known/security.txt`, { redirect: "manual" });
    expect(r.status).toBe(301);
    expect(r.headers.get("location")).toBe("https://viafrei.de/.well-known/security.txt");
    expect(SECURITY_TXT_URL).toBe("https://viafrei.de/.well-known/security.txt");
  });

  const raw = (b: Booted, path: string, body: string): Promise<Response> =>
    fetch(`${b.origin}${path}`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body });

  it("malformed JSON on /mcp is 400 with a -32700 Parse error body that echoes nothing", async () => {
    const b = await boot();
    const r = await raw(b, "/mcp", '{"jsonrpc":"2.0","id":1,"method":"initialize",<script>');
    expect(r.status).toBe(400);
    expect(r.headers.get("content-type") ?? "").toContain("application/json");
    const body = await r.text();
    const parsed = JSON.parse(body) as { jsonrpc: string; error: { code: number; message: string }; id: null };
    expect(parsed.jsonrpc).toBe("2.0");
    expect(parsed.id).toBeNull();
    expect(parsed.error.code).toBe(-32700);
    expect(parsed.error.message).toContain("Parse error");
    expect(body).not.toContain("<script>");
    expect(body).not.toMatch(/<html|<pre/i);
  });

  it("an over-long body keeps its 413 and gets a JSON-RPC body too", async () => {
    const b = await boot();
    const r = await raw(b, "/mcp", JSON.stringify({ ...INIT, pad: "x".repeat(70 * 1024) }));
    expect(r.status).toBe(413);
    expect((await r.json() as { error: { code: number } }).error.code).toBe(-32600);
  });

  it("an unknown path is a JSON 404 naming the endpoint", async () => {
    const b = await boot();
    const r = await fetch(`${b.origin}/nope`);
    expect(r.status).toBe(404);
    const body = await r.json() as { error: { code: number; message: string } };
    expect(body.error.code).toBe(-32601);
    expect(body.error.message).toContain("/mcp");
  });
});
