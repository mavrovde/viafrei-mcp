/**
 * Reachability probes of /mcp: a GET or HEAD with no session is 405 with Allow, never a 404 or a 400; a GET
 * naming an ended session is still 404.
 */
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createMcpApp, MCP_ENDPOINT_ALLOW, SESSION_NOT_FOUND, STREAM_WITHOUT_SESSION, type McpApp } from "../../src/app.js";
import { apiStub, transportDeps } from "./deps.js";

type Booted = { mcp: McpApp; http: HttpServer; origin: string };
const running: Booted[] = [];

afterEach(async () => {
  for (const b of running.splice(0)) {
    await b.mcp.close();
    await new Promise<void>((resolve) => { b.http.close(() => resolve()); });
  }
});


async function boot(): Promise<Booted> {
  const allowedHosts: string[] = [];
  const mcp = createMcpApp({ deps: transportDeps(), allowedOrigins: ["https://alpha.example"], allowedHosts, maxBodyKb: 64, sessionTtlMs: 60_000, sessionSweepMs: 0 });
  const http = await new Promise<HttpServer>((resolve) => { const s = mcp.app.listen(0, "127.0.0.1", () => resolve(s)); });
  const port = (http.address() as AddressInfo).port;
  allowedHosts.push(`127.0.0.1:${String(port)}`);
  const b = { mcp, http, origin: `http://127.0.0.1:${String(port)}` };
  running.push(b);
  return b;
}

const ACCEPT = "application/json, text/event-stream";
const INIT = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "probe-test", version: "0" } } };

describe("GET/HEAD /mcp with no session (#reachability probes)", () => {
  it("HEAD answers 405 with Allow and no body — the request Copilot's checker sends", async () => {
    const b = await boot();
    const r = await fetch(`${b.origin}/mcp`, { method: "HEAD" });
    expect(r.status).toBe(405);
    expect(r.headers.get("allow")).toBe(MCP_ENDPOINT_ALLOW);
    expect(await r.text()).toBe("");
  });

  it("a bare GET answers 405 with Allow and a JSON-RPC error saying what to send instead", async () => {
    const b = await boot();
    for (const accept of [undefined, "text/event-stream", "*/*"]) {
      const r = await fetch(`${b.origin}/mcp`, { method: "GET", headers: accept === undefined ? {} : { accept } });
      expect(r.status, String(accept)).toBe(405);
      expect(r.headers.get("allow")).toBe("POST, GET, DELETE");
      expect(await r.json()).toEqual(STREAM_WITHOUT_SESSION);
    }
  });

  it("a GET naming a session that does not exist still answers 404 Session not found (unchanged)", async () => {
    const b = await boot();
    const r = await fetch(`${b.origin}/mcp`, { method: "GET", headers: { accept: "text/event-stream", "mcp-session-id": "no-such-session" } });
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual(SESSION_NOT_FOUND);
  });

  it("a GET naming a live session still opens its event stream", async () => {
    const b = await boot();
    const init = await fetch(`${b.origin}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: ACCEPT }, body: JSON.stringify(INIT) });
    expect(init.status).toBe(200);
    const sid = init.headers.get("mcp-session-id") ?? "";
    expect(sid).not.toBe("");
    await init.text();
    const ctl = new AbortController();
    const r = await fetch(`${b.origin}/mcp`, { method: "GET", headers: { accept: "text/event-stream", "mcp-session-id": sid, "mcp-protocol-version": "2025-06-18" }, signal: ctl.signal });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/event-stream");
    ctl.abort();
  });

  it("a HEAD naming a LIVE session is the same 405 and Allow, and touches neither the session nor its streams", async () => {
    const b = await boot();
    const init = await fetch(`${b.origin}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: ACCEPT }, body: JSON.stringify(INIT) });
    const sid = init.headers.get("mcp-session-id") ?? "";
    await init.text();
    const session = b.mcp.sessions.get(sid);
    expect(session).toBeDefined();
    const touched = session?.touched ?? 0;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const r = await fetch(`${b.origin}/mcp`, { method: "HEAD", headers: { accept: "text/event-stream", "mcp-session-id": sid } });
    expect(r.status).toBe(405);
    // OUR Allow, in our order — the transport's own 405 says "GET, POST, DELETE".
    expect(r.headers.get("allow")).toBe(MCP_ENDPOINT_ALLOW);
    expect(await r.text()).toBe("");
    expect(session?.touched, "a HEAD kept the session alive").toBe(touched);
    expect(session?.streams).toBe(0);
    // …and the session still opens its stream on a GET.
    const ctl = new AbortController();
    const g = await fetch(`${b.origin}/mcp`, { method: "GET", headers: { accept: "text/event-stream", "mcp-session-id": sid }, signal: ctl.signal });
    expect(g.status).toBe(200);
    ctl.abort();
  });

  it("a HEAD naming an ENDED session is 404, the spec's signal to re-initialise (Session Management 3)", async () => {
    const b = await boot();
    const r = await fetch(`${b.origin}/mcp`, { method: "HEAD", headers: { "mcp-session-id": "no-such-session" } });
    expect(r.status).toBe(404);
  });

  it("a POST with no session that is not initialize keeps its 400 (unchanged)", async () => {
    const b = await boot();
    const r = await fetch(`${b.origin}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: ACCEPT }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "prompts/list" }) });
    expect(r.status).toBe(400);
  });

  it("an origin the allow-list refuses is refused before the probe answer (403, not 405)", async () => {
    const b = await boot();
    const r = await fetch(`${b.origin}/mcp`, { method: "GET", headers: { origin: "https://gamma.example" } });
    expect(r.status).toBe(403);
  });
});
