/**
 * The usage counters: what one flush writes (one row per hour, door, method, tool and client, each latency
 * bucket and error code counted), how a client is kept from minting rows, that a failed write loses nothing
 * and blocks nothing, and the route table feeding it.
 */
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { MCP_USAGE_BUCKET_COLUMNS, MCP_USAGE_CLIENT_MAX, MCP_USAGE_CLIENT_STATELESS, MCP_USAGE_CLIENTS, normaliseClientName } from "../../src/usage-names.js";
import { afterEach, describe, expect, it } from "vitest";
import { transportDeps } from "./deps.js";
import { createMcpApp, initializeClient, type McpApp } from "../../src/app.js";
import { createUsageLedger, usageLogFields, type UsageRow, USAGE_MAX_CLIENTS_PER_HOUR, type UsageEvent } from "../../src/usage.js";

const T = Date.parse("2026-10-08T09:17:00.000Z");
const HOUR = Date.parse("2026-10-08T09:00:00.000Z");
const TOOLS = new Set(["find_parking", "describe_location"]);

const ev = (over: Partial<UsageEvent> = {}): UsageEvent => ({ door: "streamable", rpc: "tools/call", tool: "find_parking", client: "claude-ai", status: 200, ms: 120, ...over });

/** A ledger whose writes are recorded, and fail while `failing` is set. */
function harness(over: { failing?: boolean; maxKeys?: number; now?: () => number } = {}) {
  const writes: UsageRow[][] = [];
  const warned: { fields: Record<string, unknown>; message: string }[] = [];
  const state = { failing: over.failing ?? false };
  const ledger = createUsageLedger({
    tools: TOOLS,
    now: over.now ?? (() => T),
    ...(over.maxKeys === undefined ? {} : { maxKeys: over.maxKeys }),
    write: (rows) => {
      if (state.failing) return Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:8080"));
      writes.push([...rows]);
      return Promise.resolve();
    },
    warn: (fields, message) => { warned.push({ fields, message }); },
  });
  return { ledger, writes, warned, state };
}

describe("what one flush writes", () => {
  it("folds events into one row per (hour, door, rpc, tool, client), in ONE write", async () => {
    const { ledger, writes } = harness();
    ledger.record(ev({ ms: 80 }));
    ledger.record(ev({ ms: 300 }));
    ledger.record(ev({ ms: 12_000, status: 200, rpcError: true }));
    ledger.record(ev({ rpc: "initialize", tool: null, ms: 5 }));
    ledger.record(ev({ rpc: "initialize", tool: null, status: 503, ms: 1 }));
    expect(await ledger.flush()).toBe(true);
    expect(writes).toHaveLength(1);
    const rows = writes[0] ?? [];
    expect(rows).toHaveLength(2);
    const call = rows.find((r) => r.rpc === "tools/call");
    expect(call).toMatchObject({ periodStart: new Date(HOUR), door: "streamable", tool: "find_parking", client: "claude-ai", requests: 3, errors: 1, sessions: 0, totalMs: 12_380 });
    expect(call?.buckets).toEqual([1, 0, 1, 0, 0, 0, 0, 1]);
    const init = rows.find((r) => r.rpc === "initialize");
    // A refused handshake is a request and an error, but not a session.
    expect(init).toMatchObject({ tool: "", requests: 2, errors: 1, sessions: 1 });
    expect(ledger.pending()).toBe(0);
    expect(await ledger.flush(), "nothing waiting is a successful flush").toBe(true);
    expect(writes).toHaveLength(1);
  });

  it("counts each error in exactly one class, and `errors` is their sum", async () => {
    const { ledger, writes } = harness();
    ledger.record(ev({ status: 200 }));
    ledger.record(ev({ status: 200, toolError: true }));
    ledger.record(ev({ status: 200, rpcError: true }));
    ledger.record(ev({ status: 400 }));
    ledger.record(ev({ status: 406 }));
    ledger.record(ev({ status: 429 }));
    ledger.record(ev({ status: 500 }));
    // A 5xx is the server's whatever the body said; a 4xx is a refusal.
    ledger.record(ev({ status: 503, toolError: true }));
    ledger.record(ev({ status: 429, rpcError: true }));
    expect(await ledger.flush()).toBe(true);
    const [row] = writes[0] ?? [];
    expect(row).toMatchObject({ requests: 9, errors: 8, refusals: 4, toolErrors: 2, serverErrors: 2 });
    expect((row?.refusals ?? 0) + (row?.toolErrors ?? 0) + (row?.serverErrors ?? 0)).toBe(row?.errors);
  });

  it("counts a tool error result under its reason code too, and nothing else under one", async () => {
    const { ledger, writes } = harness();
    ledger.record(ev({ status: 200, toolError: true, toolErrorCode: "not_found" }));
    ledger.record(ev({ status: 200, toolError: true, toolErrorCode: "not_found" }));
    ledger.record(ev({ status: 200, toolError: true, toolErrorCode: "timeout" }));
    // No code (a JSON-RPC error, or a result that carried none), and a 5xx whatever it carried.
    ledger.record(ev({ status: 200, toolError: true }));
    ledger.record(ev({ status: 200, rpcError: true }));
    ledger.record(ev({ status: 503, toolError: true, toolErrorCode: "internal" }));
    expect(await ledger.flush()).toBe(true);
    const [row] = writes[0] ?? [];
    expect(row).toMatchObject({ toolErrors: 5, serverErrors: 1 });
    // MCP_TOOL_ERROR_CODES order: invalid_input, not_found, out_of_coverage, unavailable, limit_reached, timeout, internal.
    expect(row?.toolErrorCodes).toEqual([0, 2, 0, 0, 0, 1, 0]);
    // The bucket's log line names each code's count, as the table's column did.
    const fields = usageLogFields(row!);
    expect([fields["tool_error_not_found"], fields["tool_error_timeout"], fields["tool_error_internal"]]).toEqual([2, 1, 0]);
  });

  it("starts a new row in a new hour", async () => {
    let t = T;
    const { ledger, writes } = harness({ now: () => t });
    ledger.record(ev());
    t += 3_600_000;
    ledger.record(ev());
    await ledger.flush();
    expect((writes[0] ?? []).map((r) => r.periodStart.toISOString()).sort()).toEqual(["2026-10-08T09:00:00.000Z", "2026-10-08T10:00:00.000Z"]);
  });
});

describe("a client cannot mint rows", () => {
  it("counts an unregistered tool name as `other`, and an unknown method as `other`", async () => {
    const { ledger, writes } = harness();
    for (let i = 0; i < 500; i += 1) ledger.record(ev({ tool: `zz_invented_${String(i)}` }));
    for (let i = 0; i < 500; i += 1) ledger.record(ev({ rpc: `zz/method${String(i)}`, tool: null }));
    ledger.record(ev({ rpc: null, tool: null, status: 400 }));
    await ledger.flush();
    const rows = writes[0] ?? [];
    expect(rows.map((r) => `${r.rpc}|${r.tool}`).sort()).toEqual(["invalid|", "other|", "tools/call|other"]);
    expect(rows.find((r) => r.tool === "other")?.requests).toBe(500);
  });

  it("caps distinct client names per hour; past the cap a NEW name is `other` and a known one stays itself", async () => {
    const { ledger, writes } = harness();
    for (let i = 0; i < 1_000; i += 1) ledger.record(ev({ client: `zz-client-${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26) % 26)}x${String(i % 7)}` }));
    ledger.record(ev({ client: "zz-client-aax0" }));
    await ledger.flush();
    const clients = new Set((writes[0] ?? []).map((r) => r.client));
    expect(clients.size).toBe(USAGE_MAX_CLIENTS_PER_HOUR + 1);
    expect(clients.has("other")).toBe(true);
    expect(clients.has("zz-client-aax0")).toBe(true);
  });

  it("stores only allow-listed client products, by their canonical key", () => {
    const positives: readonly (readonly [string, string])[] = [
      ["claude-ai", "claude-ai"],
      ["Claude Desktop", "claude-desktop"],
      ["claude-code", "claude-code"],
      ["cursor-vscode", "cursor"],
      ["Visual Studio Code", "vscode"],
      ["Visual Studio Code - Insiders", "vscode"],
      ["windsurf-client", "windsurf"],
      ["Cline", "cline"],
      ["continue-client", "continue"],
      ["Zed", "zed"],
      ["goose", "goose"],
      ["mcp-inspector", "mcp-inspector"],
      ["inspector-client", "mcp-inspector"],
      ["openai-mcp", "openai"],
      ["gemini-cli-mcp-client", "gemini-cli"],
      ["codex-mcp-client", "codex"],
      ["mcp-remote", "mcp-remote"],
      ["LibreChat", "librechat"],
      ["viafrei-smoke", "viafrei-smoke"],
      ["release-probe", "release-probe"],
    ];
    for (const [raw, key] of positives) expect(normaliseClientName(raw), raw).toBe(key);
    // A suffix a user appended to a product name never reaches the table.
    expect(normaliseClientName("claude-code Erika Mustermann's laptop")).toBe("claude-code");
    // Every canonical key satisfies the table's CHECK.
    for (const key of new Set(Object.values(MCP_USAGE_CLIENTS))) {
      expect(key).toMatch(/^[a-z0-9][a-z0-9._-]{0,39}$/);
      expect(key.length).toBeLessThanOrEqual(MCP_USAGE_CLIENT_MAX);
    }
  });

  it("counts every other name as `other` — a filter cannot tell a person from a product, a list can", () => {
    for (const hostile of [
      "+49 151 234 567 89",
      "0151-234-5678",
      "DE89370400440532013000",
      "Musterstraße 12, 10117 Berlin",
      "Max Mustermann",
      "Erika Mustermann's laptop",
      "max.mustermann@example.com",
      "probe-3f2a9c1e-77ab",
      "<script>alert(1)</script>",
      "cursorx",
      "claudeai-but-not-really",
      "x".repeat(10_000),
    ]) {
      expect(normaliseClientName(hostile), hostile).toBe("other");
    }
    expect(normaliseClientName("")).toBe("unknown");
    expect(normaliseClientName("!!!")).toBe("unknown");
    expect(normaliseClientName("日本語")).toBe("unknown");
    expect(normaliseClientName(undefined)).toBe("unknown");
    expect(normaliseClientName({ name: "x" })).toBe("unknown");
  });

  it("reads the name only out of an initialize body", () => {
    expect(initializeClient({ jsonrpc: "2.0", id: 1, method: "initialize", params: { clientInfo: { name: "Claude.ai", version: "1" } } })).toBe("claude-ai");
    expect(initializeClient({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })).toBe("unknown");
    expect(initializeClient({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { clientInfo: { name: "x" } } })).toBeNull();
    expect(initializeClient([{ method: "initialize" }])).toBeNull();
  });
});

describe("a failed flush loses nothing and blocks nothing", () => {
  it("keeps the counts, warns once per failure, and writes the SUM at the next good flush", async () => {
    const { ledger, writes, warned, state } = harness({ failing: true });
    ledger.record(ev());
    ledger.record(ev());
    expect(await ledger.flush()).toBe(false);
    expect(ledger.pending()).toBe(1);
    expect(warned).toHaveLength(1);
    expect(warned[0]?.message).toMatch(/flush failed/);
    expect(warned[0]?.fields).toMatchObject({ rows: 1, pending: 1 });
    ledger.record(ev());
    state.failing = false;
    expect(await ledger.flush()).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.[0]?.requests).toBe(3);
  });

  it("bounds the buffer during an outage, and SAYS how many events it could not count", async () => {
    const { ledger, warned, state, writes } = harness({ failing: true, maxKeys: 3 });
    for (const tool of ["find_parking", "describe_location"]) ledger.record(ev({ tool }));
    await ledger.flush();
    for (const client of ["a1", "a2", "a3", "a4"]) ledger.record(ev({ client }));
    await ledger.flush();
    expect(ledger.pending()).toBeLessThanOrEqual(3);
    expect(ledger.dropped()).toBeGreaterThan(0);
    state.failing = false;
    await ledger.flush();
    expect(warned.some((w) => /not counted/.test(w.message) && typeof w.fields["dropped"] === "number")).toBe(true);
    expect(ledger.dropped()).toBe(0);
    expect(writes).toHaveLength(1);
  });

  it("gives up on a write that never returns (a half-open connection): warns, keeps the rows, and the next flush writes them", async () => {
    const warned: string[] = [];
    const written: UsageRow[][] = [];
    let hang = true;
    const ledger = createUsageLedger({
      tools: TOOLS,
      now: () => T,
      flushDeadlineMs: 30,
      write: (rows) => {
        if (hang) return new Promise<void>(() => undefined);
        written.push([...rows]);
        return Promise.resolve();
      },
      warn: (fields, message) => { warned.push(`${message} ${String(fields["err"])}`); },
    });
    ledger.record(ev());
    ledger.record(ev());
    expect(await ledger.flush(), "a flush past its deadline is a failed flush").toBe(false);
    expect(warned.some((w) => /flush failed/.test(w) && /did not finish within 30 ms/.test(w))).toBe(true);
    expect(ledger.pending()).toBe(1);
    // The flush is no longer in flight, so the next tick really runs…
    ledger.record(ev());
    hang = false;
    expect(await ledger.flush()).toBe(true);
    // …and writes the sum of what was kept and what arrived meanwhile.
    expect(written[0]?.[0]?.requests).toBe(3);
  });

  it("never runs two flushes at once", async () => {
    let release = (): void => undefined;
    let calls = 0;
    const ledger = createUsageLedger({
      tools: TOOLS,
      now: () => T,
      write: () => { calls += 1; return new Promise<void>((ok) => { release = ok; }); },
    });
    ledger.record(ev());
    const first = ledger.flush();
    ledger.record(ev({ client: "other-one" }));
    expect(await ledger.flush(), "a flush asked for while one runs reports it did not write").toBe(false);
    expect(calls).toBe(1);
    release();
    expect(await first).toBe(true);
  });

  it("record() swallows its own failure", () => {
    const ledger = createUsageLedger({ tools: TOOLS, now: () => { throw new Error("clock broke"); }, write: () => Promise.resolve() });
    expect(() => { ledger.record(ev()); }).not.toThrow();
  });
});

// --- through the real route table -----------------------------------------

type Booted = { mcp: McpApp; http: HttpServer; origin: string };
const running: Booted[] = [];
afterEach(async () => {
  for (const b of running.splice(0)) {
    await b.mcp.close();
    await new Promise<void>((resolve) => { b.http.close(() => resolve()); });
  }
});


async function boot(usage: (e: UsageEvent) => void): Promise<Booted> {
  const allowedHosts: string[] = [];
  const mcp = createMcpApp({ deps: transportDeps(), allowedOrigins: ["https://alpha.example"], allowedHosts, maxBodyKb: 64, sessionTtlMs: 60_000, sessionSweepMs: 0, usage });
  const http = await new Promise<HttpServer>((resolve) => { const s = mcp.app.listen(0, "127.0.0.1", () => resolve(s)); });
  const port = (http.address() as AddressInfo).port;
  allowedHosts.push(`127.0.0.1:${String(port)}`);
  const b = { mcp, http, origin: `http://127.0.0.1:${String(port)}` };
  running.push(b);
  return b;
}

const post = (b: Booted, body: unknown, headers: Record<string, string> = {}): Promise<Response> =>
  fetch(`${b.origin}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers }, body: JSON.stringify(body) });

const INIT = (name: unknown): unknown => ({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name, version: "0" } } });

async function waitFor(pred: () => boolean, ms = 3_000): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until && !pred()) await new Promise((r) => setTimeout(r, 5));
}

describe("fed by the route table", () => {
  it("counts a Streamable session's requests under the client name its initialize carried — and nothing else about it", async () => {
    const events: UsageEvent[] = [];
    const b = await boot((e) => { events.push(e); });
    const r = await post(b, INIT("Claude Desktop"));
    await r.text();
    const sid = r.headers.get("mcp-session-id") ?? "";
    await (await post(b, { jsonrpc: "2.0", method: "notifications/initialized" }, { "mcp-session-id": sid })).text();
    await (await post(b, { jsonrpc: "2.0", id: 2, method: "tools/list" }, { "mcp-session-id": sid })).text();
    await waitFor(() => events.length >= 3);
    expect(events.map((e) => [e.door, e.rpc, e.client, e.status])).toEqual([
      ["streamable", "initialize", "claude-desktop", 200],
      ["streamable", "notifications/initialized", "claude-desktop", 202],
      ["streamable", "tools/list", "claude-desktop", 200],
    ]);
    for (const e of events) expect(Object.keys(e).sort()).toEqual(["client", "door", "ms", "rpc", "status", "tool"]);
    expect(JSON.stringify(events)).not.toContain(sid);
  });

  it("tells a refusal from a tool error on the Streamable door — an isError result leaves inside an HTTP 200", async () => {
    const events: UsageEvent[] = [];
    const b = await boot((e) => { events.push(e); });
    // Refusals: no session, an unknown session, an Accept the transport refuses.
    await (await post(b, { jsonrpc: "2.0", id: 7, method: "resources/list" })).text();
    await (await post(b, { jsonrpc: "2.0", id: 8, method: "tools/list" }, { "mcp-session-id": "not-a-session" })).text();
    await (await post(b, INIT("Claude Desktop"), { accept: "text/html" })).text();
    // A session, and a call the tool answers with isError (its arguments are refused).
    const r = await post(b, INIT("Claude Desktop"));
    await r.text();
    const sid = r.headers.get("mcp-session-id") ?? "";
    await (await post(b, { jsonrpc: "2.0", method: "notifications/initialized" }, { "mcp-session-id": sid })).text();
    const call = await post(b, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "describe_location", arguments: { lat: "not a number" } } }, { "mcp-session-id": sid });
    expect(call.status).toBe(200);
    expect(await call.text()).toContain('"isError":true');
    await (await post(b, { jsonrpc: "2.0", id: 3, method: "tools/list" }, { "mcp-session-id": sid })).text();
    await waitFor(() => events.length >= 7);
    const tool = events.find((e) => e.rpc === "tools/call");
    // The SDK refused the arguments itself; its result is classified like ours.
    expect(tool).toMatchObject({ status: 200, toolError: true, toolErrorCode: "invalid_input" });
    expect(events.find((e) => e.rpc === "tools/list" && e.status === 200)?.toolError, "a success is no tool error").toBeUndefined();
    const rows: UsageRow[] = [];
    const sum = createUsageLedger({ tools: new Set(["describe_location"]), write: (w) => { rows.push(...w); return Promise.resolve(); }, warn: () => undefined });
    for (const e of events) sum.record(e);
    await sum.flush();
    const total = (k: "requests" | "errors" | "refusals" | "toolErrors" | "serverErrors"): number => rows.reduce((a, x) => a + x[k], 0);
    expect({ requests: total("requests"), errors: total("errors"), refusals: total("refusals"), toolErrors: total("toolErrors"), serverErrors: total("serverErrors") })
      .toEqual({ requests: 7, errors: 4, refusals: 3, toolErrors: 1, serverErrors: 0 });
  });

  it("counts the legacy door under its client name too", async () => {
    const events: UsageEvent[] = [];
    const b = await boot((e) => { events.push(e); });
    const client = new Client({ name: "Goose", version: "0" });
    await client.connect(new SSEClientTransport(new URL(`${b.origin}/sse`)));
    await client.listTools();
    await client.close();
    await waitFor(() => events.some((e) => e.rpc === "tools/list"));
    expect(events.find((e) => e.rpc === "initialize")).toMatchObject({ door: "sse", client: "goose" });
    expect(events.find((e) => e.rpc === "tools/list")).toMatchObject({ door: "sse", client: "goose", status: 200 });
  });

  it("answers every request at full speed while the counters' write fails or hangs", async () => {
    // The two failure shapes a write has: refusing at once, and never
    // answering. Neither may reach a request.
    for (const write of [() => Promise.reject(new Error("ECONNREFUSED")), () => new Promise<void>(() => undefined)]) {
      const ledger = createUsageLedger({ tools: new Set(["describe_location"]), write, warn: () => undefined });
      const b = await boot(ledger.record);
      const r0 = await post(b, INIT("zz-outage"));
      await r0.text();
      const sid = r0.headers.get("mcp-session-id") ?? "";
      const flushing = ledger.flush();
      const t0 = Date.now();
      for (let i = 0; i < 20; i += 1) {
        const r = await post(b, { jsonrpc: "2.0", id: 10 + i, method: "tools/list" }, { "mcp-session-id": sid });
        expect(r.status).toBe(200);
        await r.text();
        void ledger.flush();
      }
      expect(Date.now() - t0, "twenty tools/list round trips with the ledger failing").toBeLessThan(2_000);
      // Let the last refused flush put its rows back before looking.
      await new Promise((r) => setTimeout(r, 20));
      expect(ledger.pending()).toBeGreaterThan(0);
      void flushing;
    }
  });
});
