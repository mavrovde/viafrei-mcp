/**
 * The two directory doors, through the REAL route table over a real socket: the bare `tools/list` answered
 * without a session (nothing enters the session map, the list is EXACTLY the catalogue), and the server card
 * on its well-known paths.
 */
import { request, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { MCP_USAGE_CLIENT_STATELESS, MCP_USAGE_CLIENTS, normaliseClientName } from "../../src/usage-names.js";
import { LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";
import { loadCatalogue } from "../../src/catalogue.js";
import { acceptsJson, createMcpApp, INVALID_REQUEST, isStatelessToolsList, RATE_LIMITED_CODE, SESSION_NOT_FOUND, type McpApp, type McpAppOptions, type RequestLogLine } from "../../src/app.js";
import { apiStub, transportDeps } from "./deps.js";
import { PUBLIC_MCP_ENDPOINT, SERVER_CARD_MEDIA_TYPE, SERVER_CARD_PATHS, serverCard } from "../../src/server-card.js";
import { createUsageLedger, type UsageEvent, type UsageRow } from "../../src/usage.js";

type Booted = { mcp: McpApp; http: HttpServer; origin: string; lines: RequestLogLine[]; events: UsageEvent[] };

const CATALOGUE = loadCatalogue();
const TOOLS = CATALOGUE.tools;
const SERVER_VERSION = CATALOGUE.serverInfo.version;
const running: Booted[] = [];

afterEach(async () => {
  for (const b of running.splice(0)) {
    await b.mcp.close();
    await new Promise<void>((resolve) => { b.http.close(() => resolve()); });
  }
});


async function boot(o: Partial<McpAppOptions> = {}): Promise<Booted> {
  const allowedHosts: string[] = [];
  const lines: RequestLogLine[] = [];
  const events: UsageEvent[] = [];
  const mcp = createMcpApp({
    deps: transportDeps(),
    allowedOrigins: ["https://alpha.example"],
    allowedHosts,
    maxBodyKb: 64,
    sessionTtlMs: 60_000,
    sessionSweepMs: 0,
    requestLog: (l) => { lines.push(l); },
    usage: (e) => { events.push(e); },
    ...o,
  });
  const http = await new Promise<HttpServer>((resolve) => { const s = mcp.app.listen(0, "127.0.0.1", () => resolve(s)); });
  const port = (http.address() as AddressInfo).port;
  allowedHosts.push(`127.0.0.1:${String(port)}`);
  const b = { mcp, http, origin: `http://127.0.0.1:${String(port)}`, lines, events };
  running.push(b);
  return b;
}

/** The Accept header the Streamable HTTP transport requires of every POST. */
const ACCEPT = "application/json, text/event-stream";
const LIST = { jsonrpc: "2.0", id: 1, method: "tools/list" };
const CALL = { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "find_parking", arguments: { place: "Köln" } } };
const INIT = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "Claude Code", version: "0" } } };
/** Today's refusal, word for word: the stateless door must not change it for anything else. */
const NO_SESSION = { jsonrpc: "2.0", error: { code: -32000, message: "No valid session; send initialize first" }, id: null };

const post = (b: Booted, body: unknown, headers: Record<string, string> = {}): Promise<Response> =>
  fetch(`${b.origin}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: ACCEPT, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

/** The JSON-RPC message of a response, whether it came as JSON or as one SSE frame. */
async function message(r: Response): Promise<{ result?: { tools?: { name: string }[] }; error?: unknown; id?: unknown }> {
  const text = await r.text();
  if ((r.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const data = text.split("\n").find((l) => l.startsWith("data: "));
    return JSON.parse((data ?? "data: {}").slice(6)) as never;
  }
  return JSON.parse(text) as never;
}

/** One request over node:http, which sends the headers it is given and adds none. */
function rawStatus(b: Booted, method: string, path: string, headers: Record<string, string>, body = ""): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const q = request(`${b.origin}${path}`, { method, headers: { ...headers, "content-length": String(Buffer.byteLength(body)) } }, (res) => { res.resume(); resolve(res.statusCode ?? 0); });
    q.on("error", reject);
    q.end(body);
  });
}

async function waitFor(pred: () => boolean, ms = 3_000): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until && !pred()) await new Promise((r) => setTimeout(r, 5));
}

describe("a bare tools/list is answered without a session", () => {
  it("answers 200 with the full catalogue, no Mcp-Session-Id, no session", async () => {
    const b = await boot();
    const r = await post(b, LIST);
    expect(r.status).toBe(200);
    expect(r.headers.get("mcp-session-id")).toBeNull();
    const m = await message(r);
    expect(m.id).toBe(1);
    expect(m.result?.tools?.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    expect(b.mcp.sessions.size).toBe(0);
    await waitFor(() => b.lines.length >= 1);
    expect(b.lines).toEqual([expect.objectContaining({ door: "streamable", rpc: "tools/list", status: 200, stateless: true })]);
  });

  it("lists exactly what an initialised session lists — the same registration, byte for byte", async () => {
    const b = await boot();
    const bare = await message(await post(b, LIST));
    const init = await post(b, INIT);
    await init.text();
    const sid = init.headers.get("mcp-session-id") ?? "";
    expect(sid).not.toBe("");
    await (await post(b, { jsonrpc: "2.0", method: "notifications/initialized" }, { "mcp-session-id": sid })).text();
    const inSession = await message(await post(b, LIST, { "mcp-session-id": sid }));
    expect(bare.result).toEqual(inSession.result);
    // The session made by `initialize` is the only one; the bare call added none.
    expect(b.mcp.sessions.size).toBe(1);
  });

  it("leaves every other session-less request at today's 400 — tools/call above all", async () => {
    const b = await boot();
    const refused: [string, unknown, Record<string, string>?][] = [
      ["tools/call", CALL],
      ["server/discover", { jsonrpc: "2.0", id: 3, method: "server/discover", params: {} }],
      ["resources/list", { jsonrpc: "2.0", id: 4, method: "resources/list" }],
      ["a batch holding tools/list", [LIST]],
      ["tools/list as a notification (no id)", { jsonrpc: "2.0", method: "tools/list" }],
      ["a 2026-07-28 era probe", { ...LIST, params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } } }],
    ];
    for (const [what, body, headers] of refused) {
      const r = await post(b, body, headers);
      expect(r.status, what).toBe(400);
      expect(await r.json(), what).toEqual(NO_SESSION);
    }
    // Not a JSON-RPC message at all is refused before the session question (2.3.22 spec audit): still a 400 that
    // mints nothing, now with JSON-RPC's own code for it, -32600 Invalid Request.
    const notRpc = await post(b, { id: 5, method: "tools/list" });
    expect(notRpc.status).toBe(400);
    expect(await notRpc.json()).toEqual(INVALID_REQUEST);
    expect(b.mcp.sessions.size).toBe(0);
    expect(b.lines.filter((l) => l.stateless === true)).toEqual([]);
  });

  it("answers a session id it does not hold with 404 -32001, the spec's signal to re-initialise", async () => {
    const b = await boot();
    const dead = { "mcp-session-id": "zz-771-ended-by-a-restart" };
    for (const [what, body] of [["tools/list", LIST], ["tools/call", CALL], ["notifications/initialized", { jsonrpc: "2.0", method: "notifications/initialized" }], ["server/discover", { jsonrpc: "2.0", id: 3, method: "server/discover", params: {} }]] as const) {
      const r = await post(b, body, dead);
      expect(r.status, what).toBe(404);
      expect(await r.json(), what).toEqual(SESSION_NOT_FOUND);
    }
    for (const method of ["GET", "DELETE"]) {
      const r = await fetch(`${b.origin}/mcp`, { method, headers: { accept: ACCEPT, ...dead } });
      expect(r.status, method).toBe(404);
      expect(await r.json(), method).toEqual(SESSION_NOT_FOUND);
      // No id at all is not an ended session: a DELETE is a bad request, and a GET is a probe the spec answers
      // with 405, "no stream here" (probe-405.test.ts).
      const none = await fetch(`${b.origin}/mcp`, { method, headers: { accept: ACCEPT } });
      expect(none.status, `${method} without an id`).toBe(method === "GET" ? 405 : 400);
      await none.text();
    }
    expect(b.mcp.sessions.size).toBe(0);
  });

  it("recovers a session lost to a restart: 404, then initialize (even carrying the dead id) opens a working session", async () => {
    const before = await boot();
    const first = await post(before, INIT);
    const old = first.headers.get("mcp-session-id") ?? "";
    await first.text();
    expect(old).toMatch(/^[0-9a-f-]{36}$/);
    // A deploy: a new process holds none of the old sessions.
    const after = await boot();
    const lost = await post(after, CALL, { "mcp-session-id": old });
    expect(lost.status).toBe(404);
    await lost.text();
    const init = await post(after, INIT, { "mcp-session-id": old });
    expect(init.status).toBe(200);
    const sid = init.headers.get("mcp-session-id") ?? "";
    await init.text();
    expect(sid).toMatch(/^[0-9a-f-]{36}$/);
    expect(sid).not.toBe(old);
    await (await post(after, { jsonrpc: "2.0", method: "notifications/initialized" }, { "mcp-session-id": sid })).text();
    const list = await message(await post(after, LIST, { "mcp-session-id": sid }));
    expect((list.result?.tools ?? []).length).toBeGreaterThan(0);
    expect(after.mcp.sessions.size).toBe(1);
  });

  it("reads an EMPTY Mcp-Session-Id as no id: a bare tools/list is answered, an initialize opens a session, anything else is today's 400", async () => {
    const b = await boot();
    const empty = { "mcp-session-id": "" };
    const list = await post(b, LIST, empty);
    expect(list.status).toBe(200);
    expect(list.headers.get("mcp-session-id")).toBeNull();
    expect((await message(list)).result?.tools?.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    expect(b.mcp.sessions.size).toBe(0);
    const call = await post(b, CALL, empty);
    expect(call.status).toBe(400);
    expect(await call.json()).toEqual(NO_SESSION);
    const init = await post(b, INIT, empty);
    expect(init.status).toBe(200);
    expect(init.headers.get("mcp-session-id")).toMatch(/^[0-9a-f-]{36}$/);
    await init.text();
    expect(b.mcp.sessions.size).toBe(1);
  });

  it("keeps initialize and the session that follows it unchanged", async () => {
    const b = await boot();
    const r = await post(b, INIT);
    expect(r.status).toBe(200);
    expect(r.headers.get("mcp-session-id")).toMatch(/^[0-9a-f-]{36}$/);
    await r.text();
    expect(b.mcp.sessions.size).toBe(1);
  });
});

describe("the stateless path keeps every /mcp rule", () => {
  it("is rate-limited by the same per-address bucket: the third bare tools/list in a burst of two is 429", async () => {
    const b = await boot({ ipLimits: { maxInflight: 0, ratePerMin: 1, burst: 2 } });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const r = await post(b, { ...LIST, id: 10 + i });
      statuses.push(r.status);
      if (r.status === 429) {
        const body = (await r.json()) as { error: { code: number } };
        expect(body.error.code).toBe(RATE_LIMITED_CODE);
        expect(r.headers.get("retry-after")).toMatch(/^\d+$/);
      } else await r.text();
    }
    expect(statuses).toEqual([200, 200, 429]);
    await waitFor(() => b.lines.length >= 3);
    expect(b.lines[2]).toMatchObject({ status: 429, limited: "rate", stateless: true });
  });

  it("shares that bucket with session traffic: two bare listings spend what an initialize would have", async () => {
    const b = await boot({ ipLimits: { maxInflight: 0, ratePerMin: 1, burst: 2 } });
    await (await post(b, LIST)).text();
    await (await post(b, LIST)).text();
    const r = await post(b, INIT);
    expect(r.status).toBe(429);
    await r.text();
    expect(b.mcp.sessions.size).toBe(0);
  });

  it("refuses an Origin outside the allow-list (403), and serves a listed one", async () => {
    const b = await boot();
    const bad = await post(b, LIST, { origin: "https://eta.example" });
    expect(bad.status).toBe(403);
    await bad.text();
    const good = await post(b, LIST, { origin: "https://alpha.example" });
    expect(good.status).toBe(200);
    await good.text();
  });

  it("refuses a Host outside the allow-list (DNS rebinding)", async () => {
    const b = await boot();
    // `fetch` will not send a Host header of the caller's choosing; node:http will.
    expect(await rawStatus(b, "POST", "/mcp", { host: "eta.example", "content-type": "application/json", accept: ACCEPT }, JSON.stringify(LIST))).toBe(403);
  });

  it("refuses a body over the limit with 413 before anything is built", async () => {
    const b = await boot({ maxBodyKb: 1 });
    const r = await post(b, { ...LIST, params: { pad: "x".repeat(4_096) } });
    expect(r.status).toBe(413);
    await r.text();
  });

});

/** One POST over node:http with EXACTLY these headers — `fetch` would add `Accept: *\/*` to a request that sent none. */
function rawPost(b: Booted, body: unknown, headers: Record<string, string>): Promise<{ status: number; type: string; text: string; sid: string | undefined }> {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const q = request(`${b.origin}/mcp`, { method: "POST", headers: { "content-type": "application/json", ...headers, "content-length": String(Buffer.byteLength(payload)) } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c: string) => { text += c; });
      res.on("end", () => { resolve({ status: res.statusCode ?? 0, type: String(res.headers["content-type"] ?? ""), text, sid: res.headers["mcp-session-id"] as string | undefined }); });
    });
    q.on("error", reject);
    q.end(payload);
  });
}

describe("the stateless tools/list takes any Accept that covers JSON", () => {
  const covered: [string, Record<string, string>][] = [
    ["no Accept at all", {}],
    ["Accept: */*", { accept: "*/*" }],
    ["Accept: application/*", { accept: "application/*" }],
    ["Accept: application/json", { accept: "application/json" }],
    ["Accept with params and weights", { accept: "text/html;q=0.9, Application/JSON; charset=utf-8; q=0.5" }],
    ["a browser's Accept, wildcard last", { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }],
    ["the transport's own dual Accept", { accept: ACCEPT }],
  ];
  for (const [what, headers] of covered) {
    it(`answers ${what} with 200 and the same JSON catalogue, no session`, async () => {
      const b = await boot();
      const r = await rawPost(b, LIST, headers);
      expect(r.status, r.text).toBe(200);
      expect(r.type).toMatch(/^application\/json/);
      expect(r.sid).toBeUndefined();
      const m = JSON.parse(r.text) as { id: number; result: { tools: { name: string }[] } };
      expect(m.id).toBe(1);
      expect(m.result.tools.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
      expect(b.mcp.sessions.size).toBe(0);
    });
  }

  it("keeps the SDK's 406 for an Accept naming only other types, or refusing JSON outright", async () => {
    const b = await boot();
    for (const accept of ["text/html", "text/event-stream", "text/html, image/png", "application/json;q=0, */*", "*/*;q=0"]) {
      const r = await rawPost(b, LIST, { accept });
      expect(r.status, accept).toBe(406);
      expect(r.text, accept).toContain("Not Acceptable");
    }
    expect(b.mcp.sessions.size).toBe(0);
  });

  it("does not leak: an initialize, and a session's own requests, still need the dual Accept", async () => {
    const b = await boot();
    for (const headers of [{}, { accept: "*/*" }, { accept: "application/json" }]) {
      const r = await rawPost(b, INIT, headers);
      expect(r.status, JSON.stringify(headers)).toBe(406);
      expect(r.sid).toBeUndefined();
    }
    expect(b.mcp.sessions.size).toBe(0);
    // A real session, then a tools/list ON it with JSON-only Accept: strict.
    const init = await rawPost(b, INIT, { accept: ACCEPT });
    expect(init.status).toBe(200);
    const sid = init.sid ?? "";
    expect(sid).not.toBe("");
    const inSession = await rawPost(b, LIST, { accept: "application/json", "mcp-session-id": sid });
    expect(inSession.status).toBe(406);
  });

  it("leaves a session-less tools/call at today's 400 whatever the Accept", async () => {
    const b = await boot();
    for (const headers of [{}, { accept: "*/*" }, { accept: "application/json" }, { accept: ACCEPT }]) {
      const r = await rawPost(b, CALL, headers);
      expect(r.status, JSON.stringify(headers)).toBe(400);
      expect(JSON.parse(r.text), JSON.stringify(headers)).toEqual(NO_SESSION);
    }
  });
});

describe("acceptsJson: RFC 9110 §12.5.1 for one media type", () => {
  it("covers absent, empty, wildcards and application/json in any spelling", () => {
    for (const yes of [undefined, "", "  ", "*/*", "application/*", "application/json", "APPLICATION/JSON", "application/json; charset=utf-8", "text/html, application/json;q=0.1", "text/plain;q=0.5, */*;q=0.1", "application/*;q=0, application/json"]) {
      expect(acceptsJson(yes), String(yes)).toBe(true);
    }
  });
  it("refuses other types only, a q=0 range, and an explicit JSON refusal beside a wildcard", () => {
    for (const no of ["text/html", "text/event-stream", "application/xml", "application/jsonx", "application/json;q=0", "*/*;q=0", "application/json;q=0, */*", "application/json; q=0.0", "application/*;q=0, */*", "application/*;q=0, */*;q=1"]) {
      expect(acceptsJson(no), no).toBe(false);
    }
  });
});

describe("the ledger counts it apart from sessions", () => {
  it("records a bare tools/list under the `stateless` marker, and a session's under its client", async () => {
    const b = await boot();
    await (await post(b, LIST)).text();
    const init = await post(b, INIT);
    await init.text();
    const sid = init.headers.get("mcp-session-id") ?? "";
    await (await post(b, LIST, { "mcp-session-id": sid })).text();
    await waitFor(() => b.events.length >= 3);
    expect(b.events.map((e) => [e.door, e.rpc, e.client, e.status])).toEqual([
      ["streamable", "tools/list", MCP_USAGE_CLIENT_STATELESS, 200],
      ["streamable", "initialize", "claude-code", 200],
      ["streamable", "tools/list", "claude-code", 200],
    ]);
  });

  it("writes it as its own row, counting a request and never a session", async () => {
    const writes: UsageRow[][] = [];
    const ledger = createUsageLedger({ tools: new Set(TOOLS.map((t) => t.name)), write: (rows) => { writes.push([...rows]); return Promise.resolve(); } });
    const b = await boot({ usage: ledger.record });
    await (await post(b, LIST)).text();
    await (await post(b, { ...LIST, id: 2 })).text();
    await waitFor(() => ledger.pending() >= 1);
    expect(await ledger.flush()).toBe(true);
    expect(writes.flat().map((r) => ({ door: r.door, rpc: r.rpc, client: r.client, requests: r.requests, sessions: r.sessions }))).toEqual([
      { door: "streamable", rpc: "tools/list", client: "stateless", requests: 2, sessions: 0 },
    ]);
  });

  it("cannot be claimed by a client naming itself so", () => {
    // The allow-list maps no name to the marker — the reason no spelling can reach it.
    expect(Object.values(MCP_USAGE_CLIENTS)).not.toContain(MCP_USAGE_CLIENT_STATELESS);
    for (const name of ["stateless", "Stateless", "stateless-probe"]) expect(normaliseClientName(name), name).toBe("other");
  });
});

describe("isStatelessToolsList: the one shape answered", () => {
  it("is a single tools/list request and nothing else", () => {
    expect(isStatelessToolsList(LIST)).toBe(true);
    expect(isStatelessToolsList({ ...LIST, id: "a" })).toBe(true);
    expect(isStatelessToolsList({ ...LIST, params: { cursor: "x" } })).toBe(true);
    for (const no of [CALL, [LIST], { ...LIST, id: null }, { jsonrpc: "2.0", method: "tools/list" }, null, "tools/list", { ...LIST, params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } } }]) {
      expect(isStatelessToolsList(no), JSON.stringify(no)).toBe(false);
    }
  });
});

describe("the server card", () => {
  it("answers 200 application/json on every path, parses as JSON, and is one document", async () => {
    // both /.well-known/ spellings, the two viafrei.de serves too — one host may not refuse a path the other answers.
    expect([...SERVER_CARD_PATHS]).toEqual(["/mcp/server-card", "/.well-known/mcp.json", "/.well-known/mcp/server-card.json"]);
    const b = await boot();
    const bodies: string[] = [];
    for (const path of SERVER_CARD_PATHS) {
      const r = await fetch(`${b.origin}${path}`);
      expect(r.status, path).toBe(200);
      expect(r.headers.get("content-type"), path).toBe("application/json; charset=utf-8");
      expect(r.headers.get("access-control-allow-origin"), path).toBe("*");
      expect(r.headers.get("cache-control"), path).toBe("public, max-age=3600");
      const text = await r.text();
      expect(() => JSON.parse(text) as unknown, path).not.toThrow();
      bodies.push(text);
    }
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0] ?? "")).toEqual(serverCard(CATALOGUE));
  });

  it("carries the version initialize reports as serverInfo.version", async () => {
    const b = await boot();
    const card = (await (await fetch(`${b.origin}/.well-known/mcp.json`)).json()) as { version: string };
    const init = await post(b, INIT);
    const m = (await message(init)) as { result?: { serverInfo?: { version?: string } } };
    expect(m.result?.serverInfo?.version).toBe(SERVER_VERSION);
    expect(card.version).toBe(m.result?.serverInfo?.version);
    // A function of the catalogue's version, not a constant typed beside it.
    expect(serverCard({ ...CATALOGUE, serverInfo: { ...CATALOGUE.serverInfo, version: "9.9.9-zz" } }).version).toBe("9.9.9-zz");
  });

  it("follows the SEP-2127 shape: reverse-DNS name, ≤100-character description, the public streamable-http remote, no headers", () => {
    const c = serverCard(CATALOGUE);
    expect(c.$schema).toBe("https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json");
    expect(c.name).toMatch(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
    expect(c.description.length).toBeGreaterThan(0);
    expect(c.description.length).toBeLessThanOrEqual(100);
    expect(c.remotes).toEqual([{ type: "streamable-http", url: PUBLIC_MCP_ENDPOINT, supportedProtocolVersions: expect.arrayContaining(["2025-06-18"]) as unknown }]);
    expect(PUBLIC_MCP_ENDPOINT).toBe("https://mcp.viafrei.de/mcp");
    expect(c.websiteUrl).toBe("https://viafrei.de");
    expect(c.repository).toEqual({ url: "https://github.com/mavrovde/viafrei-mcp", source: "github" });
    expect(c._meta["de.viafrei/authentication"]).toBe("none");
    expect(c._meta["de.viafrei/attribution"]).toBe("viafrei://attribution");
  });

  it("advertises on the streamable-http remote only the SDK's versions from 2025-03-26 on — none older than the transport", () => {
    const listed = serverCard(CATALOGUE).remotes[0]?.supportedProtocolVersions ?? [];
    // Derived from the SDK, never typed: exactly its list, filtered.
    expect(listed).toEqual(SUPPORTED_PROTOCOL_VERSIONS.filter((v) => v >= "2025-03-26"));
    expect(listed).toEqual(expect.arrayContaining(["2025-03-26", "2025-06-18", LATEST_PROTOCOL_VERSION]));
    for (const old of ["2024-11-05", "2024-10-07"]) expect(listed, old).not.toContain(old);
    for (const v of listed) expect(v >= "2025-03-26", v).toBe(true);
    // The SDK still supports the older ones (the legacy door speaks them), so the filter is not vacuous.
    expect(SUPPORTED_PROTOCOL_VERSIONS).toContain("2024-11-05");
  });

  it("names nothing internal: no address, no port, no container, no person", () => {
    const text = JSON.stringify(serverCard(CATALOGUE));
    for (const bad of [/\b\d{1,3}(\.\d{1,3}){3}\b/, /:\d{2,5}\b/, /localhost/i, /8787/, /@/, /\.env|DATABASE|PASSWORD|KEY=/i, /internal/i]) {
      expect(text, String(bad)).not.toMatch(bad);
    }
    // Every URL in it is https on a public name we publish anyway.
    const urls = text.match(/https?:\/\/[^"\s]+/g) ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u, u).toMatch(/^https:\/\/(mcp\.viafrei\.de|viafrei\.de|github\.com\/mavrovde\/viafrei-mcp|static\.modelcontextprotocol\.io)(\/|$)/);
  });

  it("speaks the card media type to a client that names it, and answers If-None-Match with 304", async () => {
    const b = await boot();
    const r = await fetch(`${b.origin}/mcp/server-card`, { headers: { accept: SERVER_CARD_MEDIA_TYPE } });
    expect(r.headers.get("content-type")).toBe(`${SERVER_CARD_MEDIA_TYPE}; charset=utf-8`);
    const etag = r.headers.get("etag") ?? "";
    expect(etag).not.toBe("");
    await r.text();
    // node:http and not fetch: fetch turns a conditional request into
    // `Cache-Control: no-cache`, which (correctly) defeats the validator.
    expect(await rawStatus(b, "GET", "/.well-known/mcp.json", { "if-none-match": etag })).toBe(304);
    expect(await rawStatus(b, "GET", "/.well-known/mcp.json", { "if-none-match": "W/\"zz-534-stale\"" })).toBe(200);
  });

  it("passes a CORS preflight from any page — the card's rule, not the session allow-list", async () => {
    const b = await boot();
    const r = await fetch(`${b.origin}/.well-known/mcp.json`, { method: "OPTIONS", headers: { origin: "https://eta.example", "access-control-request-method": "GET", "access-control-request-headers": "if-none-match" } });
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect(r.headers.get("access-control-allow-methods")).toBe("GET");
    // The MCP endpoint's preflight is untouched: an unlisted origin is still refused.
    const mcp = await fetch(`${b.origin}/mcp`, { method: "OPTIONS", headers: { origin: "https://eta.example", "access-control-request-method": "POST" } });
    expect(mcp.status).toBe(403);
  });

  it("grants the preflight on exactly the spellings Express routes the GET to — trailing slash and case included", async () => {
    const b = await boot();
    const spellings = ["/mcp/server-card", "/mcp/server-card/", "/MCP/Server-Card", "/.WELL-KNOWN/MCP.JSON/", "/.well-known/mcp.json", "/mcp/server-card//", "/mcp/server-cardx", "/mcp/server-card.json", "/.well-known/mcp/server-card.json", "/.well-known/mcp/server-card"];
    const seen: string[] = [];
    for (const path of spellings) {
      const get = await fetch(`${b.origin}${path}`);
      await get.text();
      const pre = await fetch(`${b.origin}${path}`, { method: "OPTIONS", headers: { origin: "https://eta.example", "access-control-request-method": "GET" } });
      const granted = pre.status === 204 && pre.headers.get("access-control-allow-origin") === "*";
      expect(granted, `${path}: GET ${String(get.status)}, preflight ${String(pre.status)}`).toBe(get.status === 200);
      if (granted) seen.push(path);
    }
    // Not vacuous: both the folded spellings and the refusals occurred.
    expect(seen).toEqual(["/mcp/server-card", "/mcp/server-card/", "/MCP/Server-Card", "/.WELL-KNOWN/MCP.JSON/", "/.well-known/mcp.json", "/.well-known/mcp/server-card.json"]);
  });

  it("is rate-limited like every route", async () => {
    const b = await boot({ ipLimits: { maxInflight: 0, ratePerMin: 1, burst: 1 } });
    expect((await fetch(`${b.origin}/.well-known/mcp.json`)).status).toBe(200);
    expect((await fetch(`${b.origin}/mcp/server-card`)).status).toBe(429);
  });
});
