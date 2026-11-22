/**
 * The Streamable HTTP transport rules of the MCP specification, through `createMcpApp` over a real socket: the
 * Origin and Host check before any session lookup, the 404 that tells a client to re-initialise, 405 with
 * Allow for every method the endpoint does not take, and -32600 for JSON that is no JSON-RPC message.
 */
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createMcpApp, INVALID_REQUEST, MCP_ENDPOINT_ALLOW, METHOD_NOT_ALLOWED, SESSION_NOT_FOUND, type McpApp } from "../../src/app.js";
import { apiStub, transportDeps } from "./deps.js";

type Booted = { mcp: McpApp; http: HttpServer; origin: string };
const running: Booted[] = [];

afterEach(async () => {
  for (const b of running.splice(0)) {
    await b.mcp.close();
    await new Promise<void>((resolve) => { b.http.close(() => resolve()); });
  }
});

const ALLOWED = "https://alpha.example";
const STRANGER = "https://gamma.example";
const ACCEPT = "application/json, text/event-stream";
const DEAD = "00000000-0000-4000-8000-000000000000";

async function boot(): Promise<Booted> {
  const allowedHosts: string[] = [];
  const mcp = createMcpApp({ deps: transportDeps(), allowedOrigins: [ALLOWED], allowedHosts, maxBodyKb: 64, sessionTtlMs: 60_000, sessionSweepMs: 0 });
  const http = await new Promise<HttpServer>((resolve) => { const s = mcp.app.listen(0, "127.0.0.1", () => resolve(s)); });
  const port = (http.address() as AddressInfo).port;
  allowedHosts.push(`127.0.0.1:${String(port)}`);
  const b = { mcp, http, origin: `http://127.0.0.1:${String(port)}` };
  running.push(b);
  return b;
}

async function call(b: Booted, method: string, headers: Record<string, string>, body?: unknown, path = "/mcp"): Promise<{ status: number; allow: string | null; json: unknown; text: string; type: string }> {
  const r = await fetch(`${b.origin}${path}`, { method, headers: { "content-type": "application/json", accept: ACCEPT, ...headers }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
  const type = r.headers.get("content-type") ?? "";
  let text = "";
  if (type.includes("event-stream")) {
    const reader = r.body?.getReader();
    const chunk = reader === undefined ? undefined : await reader.read();
    text = chunk?.value === undefined ? "" : new TextDecoder().decode(chunk.value);
    await reader?.cancel();
  } else {
    text = await r.text();
  }
  let json: unknown = undefined;
  try { json = JSON.parse(type.includes("event-stream") ? (/^data: (.*)$/m.exec(text)?.[1] ?? "") : text); } catch { /* not JSON */ }
  return { status: r.status, allow: r.headers.get("allow"), json, text, type };
}

async function openSession(b: Booted, protocolVersion = "2025-11-25"): Promise<string> {
  const r = await fetch(`${b.origin}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: ACCEPT, origin: ALLOWED },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion, capabilities: {}, clientInfo: { name: "spec-test", version: "0" } } }),
  });
  expect(r.status).toBe(200);
  const sid = r.headers.get("mcp-session-id") ?? "";
  expect(sid).not.toBe("");
  await r.body?.cancel();
  return sid;
}

describe("Origin is validated on every request, before any session is looked up (2025-11-25 Streamable HTTP, Security Warning 1)", () => {
  // "Servers MUST validate the Origin header on all incoming connections to prevent DNS rebinding attacks. If the
  // Origin header is present and invalid, servers MUST respond with HTTP 403 Forbidden."
  it("a refused Origin is 403 whatever session the request names — none, an ended one, or a live one", async () => {
    const b = await boot();
    const live = await openSession(b);
    const ping = { jsonrpc: "2.0", id: 7, method: "ping" };
    const cases: [string, string, Record<string, string>, unknown][] = [
      ["POST, no session", "POST", {}, ping],
      ["POST, ended session", "POST", { "mcp-session-id": DEAD }, ping],
      ["POST, live session", "POST", { "mcp-session-id": live }, ping],
      ["GET, ended session", "GET", { "mcp-session-id": DEAD, accept: "text/event-stream" }, undefined],
      ["HEAD, ended session", "HEAD", { "mcp-session-id": DEAD }, undefined],
      ["DELETE, no session", "DELETE", {}, undefined],
      ["DELETE, ended session", "DELETE", { "mcp-session-id": DEAD }, undefined],
      ["PUT", "PUT", {}, undefined],
    ];
    for (const [label, method, headers, body] of cases) {
      const r = await call(b, method, { ...headers, origin: STRANGER }, body);
      expect(r.status, label).toBe(403);
      if (method !== "HEAD") expect((r.json as { error?: { message?: string } }).error?.message, label).toMatch(/Invalid Origin header/);
    }
    // The live session is untouched by the refused requests aimed at it.
    expect(b.mcp.sessions.has(live)).toBe(true);
  });

  it("the same requests from a listed Origin, or with none, keep their answers: 404 for an ended session, 400 for none", async () => {
    const b = await boot();
    for (const headers of [{ origin: ALLOWED }, {}]) {
      const label = JSON.stringify(headers);
      const ended = await call(b, "POST", { ...headers, "mcp-session-id": DEAD }, { jsonrpc: "2.0", id: 1, method: "ping" });
      expect(ended.status, label).toBe(404);
      expect(ended.json, label).toEqual(SESSION_NOT_FOUND);
      expect((await call(b, "GET", { ...headers, "mcp-session-id": DEAD, accept: "text/event-stream" })).status, label).toBe(404);
      expect((await call(b, "DELETE", { ...headers, "mcp-session-id": DEAD })).status, label).toBe(404);
      expect((await call(b, "POST", headers, { jsonrpc: "2.0", id: 1, method: "ping" })).status, label).toBe(400);
    }
  });

  it("the legacy door refuses a bad Origin before the sessionId too (2024-11-05 HTTP with SSE, Security Warning 1)", async () => {
    const b = await boot();
    const msg = { jsonrpc: "2.0", id: 1, method: "ping" };
    const refused = await call(b, "POST", { origin: STRANGER }, msg, `/messages?sessionId=${DEAD}`);
    expect(refused.status).toBe(403);
    expect(refused.text).toMatch(/Invalid Origin header/);
    const unknown = await call(b, "POST", { origin: ALLOWED }, msg, `/messages?sessionId=${DEAD}`);
    expect(unknown.status, "a listed origin still meets the unknown-session refusal").toBe(400);
  });
});

describe("a method /mcp does not take is 405 with Allow, not 404 (RFC 9110 §15.5.6)", () => {
  // "The 405 (Method Not Allowed) status code indicates that the method received in the request-line is known by
  // the origin server but not supported by the target resource. The origin server MUST generate an Allow header
  // field in a 405 response containing a list of the target resource's currently supported methods."
  it("PUT and PATCH, with or without a session", async () => {
    const b = await boot();
    const live = await openSession(b);
    for (const method of ["PUT", "PATCH"]) {
      for (const headers of [{}, { "mcp-session-id": live }]) {
        const r = await call(b, method, headers, {});
        expect(r.status, method).toBe(405);
        expect(r.allow, method).toBe(MCP_ENDPOINT_ALLOW);
        expect(r.json, method).toEqual(METHOD_NOT_ALLOWED);
      }
    }
    // …while a path that is not the endpoint keeps the catch-all's 404.
    expect((await call(b, "PUT", {}, {}, "/nowhere")).status).toBe(404);
    // …and the session the PUT named is still live: a refused method is not a request on it.
    expect((await call(b, "POST", { "mcp-session-id": live }, { jsonrpc: "2.0", id: 2, method: "ping" })).status).toBe(200);
  });
});

describe("a body that is JSON but not JSON-RPC is -32600 Invalid Request (JSON-RPC 2.0 §5.1)", () => {
  // MCP 2025-11-25 Base Protocol, Messages: "All messages between MCP clients and servers MUST follow the JSON-RPC
  // 2.0 specification." JSON-RPC 2.0 §5.1: -32700 Parse error "Invalid JSON was received by the server";
  // -32600 Invalid Request "The JSON sent is not a valid Request object". And Requests: "Unlike base JSON-RPC, the
  // ID MUST NOT be null."
  it("a null id, no jsonrpc member, or a numeric method is 400 with -32600, on a session and without one", async () => {
    const b = await boot();
    const live = await openSession(b);
    const bodies = [
      { jsonrpc: "2.0", id: null, method: "ping" },
      { id: 3, method: "ping" },
      { jsonrpc: "2.0", id: 3, method: 5 },
      { jsonrpc: "1.0", id: 3, method: "ping" },
    ];
    for (const body of bodies) {
      for (const headers of [{ "mcp-session-id": live }, {}]) {
        const r = await call(b, "POST", headers, body);
        expect(r.status, JSON.stringify(body)).toBe(400);
        expect(r.json, JSON.stringify(body)).toEqual(INVALID_REQUEST);
      }
    }
  });

  it("text that is not JSON keeps -32700 Parse error; valid messages keep their answers", async () => {
    const b = await boot();
    const live = await openSession(b);
    const broken = await call(b, "POST", { "mcp-session-id": live }, '{"jsonrpc":"2.0","id":1,"method":');
    expect(broken.status).toBe(400);
    expect((broken.json as { error?: { code?: number } }).error?.code).toBe(-32700);
    // A request, a notification and a response are all JSON-RPC messages, and each is still taken.
    const asked = await call(b, "POST", { "mcp-session-id": live }, { jsonrpc: "2.0", id: 4, method: "ping" });
    expect(asked.status).toBe(200);
    expect(asked.json).toEqual({ jsonrpc: "2.0", id: 4, result: {} });
    expect((await call(b, "POST", { "mcp-session-id": live }, { jsonrpc: "2.0", method: "notifications/initialized" })).status).toBe(202);
    expect((await call(b, "POST", { "mcp-session-id": live }, { jsonrpc: "2.0", id: 99, result: {} })).status).toBe(202);
    // A body the JSON parser did not read (not application/json) is the transport's 415, unchanged.
    const plain = await fetch(`${b.origin}/mcp`, { method: "POST", headers: { "content-type": "text/plain", accept: ACCEPT, "mcp-session-id": live }, body: "ping" });
    expect(plain.status).toBe(415);
  });
});

describe("JSON-RPC batches (2025-03-26 Base Protocol: implementations MUST support receiving batches)", () => {
  // 2025-03-26 basic/index: "MCP implementations MAY support sending JSON-RPC batches, but MUST support receiving
  // JSON-RPC batches." Batching was removed in 2025-06-18; a session negotiated at 2025-03-26 is still owed it.
  it("a 2025-03-26 session gets one answer per request of a batch", async () => {
    const b = await boot();
    const live = await openSession(b, "2025-03-26");
    const r = await fetch(`${b.origin}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: ACCEPT, "mcp-session-id": live, "mcp-protocol-version": "2025-03-26" },
      body: JSON.stringify([{ jsonrpc: "2.0", id: 11, method: "ping" }, { jsonrpc: "2.0", id: 12, method: "ping" }, { jsonrpc: "2.0", method: "notifications/initialized" }]),
    });
    expect(r.status).toBe(200);
    const reader = r.body?.getReader();
    let text = "";
    while (reader !== undefined && !(text.includes('"id":11') && text.includes('"id":12'))) {
      const { value, done } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
    await reader?.cancel();
    expect(text).toContain('"id":11');
    expect(text).toContain('"id":12');
  });
});

describe("MCP-Protocol-Version (2025-11-25 Streamable HTTP, Protocol Version Header)", () => {
  // "If the server receives a request with an invalid or unsupported MCP-Protocol-Version, it MUST respond with 400
  // Bad Request." / "if the server does not receive an MCP-Protocol-Version header … the server SHOULD assume
  // protocol version 2025-03-26."
  it("an unsupported value is 400 on POST, GET and DELETE; an absent one is accepted; the negotiated one works", async () => {
    const b = await boot();
    const live = await openSession(b);
    const ping = { jsonrpc: "2.0", id: 5, method: "ping" };
    expect((await call(b, "POST", { "mcp-session-id": live, "mcp-protocol-version": "2099-01-01" }, ping)).status).toBe(400);
    expect((await call(b, "POST", { "mcp-session-id": live, "mcp-protocol-version": "garbage" }, ping)).status).toBe(400);
    expect((await call(b, "GET", { "mcp-session-id": live, "mcp-protocol-version": "2099-01-01", accept: "text/event-stream" })).status).toBe(400);
    expect((await call(b, "DELETE", { "mcp-session-id": live, "mcp-protocol-version": "2099-01-01" })).status).toBe(400);
    expect(b.mcp.sessions.has(live), "a refused DELETE must not end the session").toBe(true);
    expect((await call(b, "POST", { "mcp-session-id": live }, ping)).status).toBe(200);
    expect((await call(b, "POST", { "mcp-session-id": live, "mcp-protocol-version": "2025-11-25" }, ping)).status).toBe(200);
  });
});

describe("lifecycle answers on the wire (2025-11-25 Lifecycle, Version Negotiation)", () => {
  // "If the server supports the requested protocol version, it MUST respond with the same version. Otherwise, the
  // server MUST respond with another protocol version it supports. This SHOULD be the latest version supported by
  // the server."
  it("each supported version is echoed; an unknown one is answered with the latest, 2025-11-25", async () => {
    const b = await boot();
    for (const [asked, answered] of [["2025-11-25", "2025-11-25"], ["2025-06-18", "2025-06-18"], ["2025-03-26", "2025-03-26"], ["2024-11-05", "2024-11-05"], ["1999-01-01", "2025-11-25"], ["2026-07-28", "2025-11-25"]] as const) {
      const r = await call(b, "POST", { origin: ALLOWED }, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: asked, capabilities: {}, clientInfo: { name: "v", version: "0" } } });
      expect(r.status, asked).toBe(200);
      expect((r.json as { result?: { protocolVersion?: string } }).result?.protocolVersion, asked).toBe(answered);
    }
  });

  it("a second initialize on a live session is refused, and the session survives it", async () => {
    const b = await boot();
    const live = await openSession(b);
    const again = await call(b, "POST", { "mcp-session-id": live }, { jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "v", version: "0" } } });
    expect(again.status).toBe(400);
    expect((again.json as { error?: { code?: number } }).error?.code).toBe(-32600);
    expect((await call(b, "POST", { "mcp-session-id": live }, { jsonrpc: "2.0", id: 3, method: "ping" })).status).toBe(200);
  });

  it("DELETE ends the session with 200, and the id is then 404 (Session Management 3 and 5)", async () => {
    const b = await boot();
    const live = await openSession(b);
    expect((await call(b, "DELETE", { "mcp-session-id": live })).status).toBe(200);
    const after = await call(b, "POST", { "mcp-session-id": live }, { jsonrpc: "2.0", id: 3, method: "ping" });
    expect(after.status).toBe(404);
    expect(after.json).toEqual(SESSION_NOT_FOUND);
  });

  it("the session id is visible ASCII (0x21–0x7E) and unguessable (Session Management 1)", async () => {
    const b = await boot();
    const ids = new Set<string>();
    for (let i = 0; i < 5; i += 1) ids.add(await openSession(b));
    expect(ids.size).toBe(5);
    for (const id of ids) {
      expect(id).toMatch(/^[\x21-\x7e]+$/);
      expect(id.length).toBeGreaterThanOrEqual(32);
    }
  });
});
