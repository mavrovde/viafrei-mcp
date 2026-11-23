/**
 * The fault line beside the request line: one per kind, from the derivation and through the real program
 * (startHttp over a socket, the API a stub on loopback answering 503), with the closed fields only.
 */
import { createServer, type Server } from "node:http";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RequestLogLine } from "../src/app.js";
import { startHttp, type HttpProgram } from "../src/http-server.js";
import { log } from "../src/log.js";
import { clientKey } from "../src/log-mask.js";
import { METHOD_NOT_FOUND, requestErrorLine, TOOL_UNSHAPED } from "../src/request-log.js";

const TOOLS = new Set(["find_parking", "check_weather_warnings"]);
const line = (o: Partial<RequestLogLine>): RequestLogLine => ({ door: "streamable", rpc: "tools/call", tool: "find_parking", status: 200, ms: 7, poolWaiting: null, ...o });

describe("requestErrorLine: one fault line per kind, none for a good answer", () => {
  it("none for a good answer, a limited one, or a list", () => {
    expect(requestErrorLine(line({}), TOOLS)).toBeNull();
    expect(requestErrorLine(line({ status: 429, limited: "rate", rpcErrorCode: -32000 }), TOOLS)).toBeNull();
    expect(requestErrorLine(line({ rpc: "tools/list", tool: null }), TOOLS)).toBeNull();
  });

  it("server_5xx: error level, keyed by the tool, else the method, with no tool code", () => {
    expect(requestErrorLine(line({ status: 503, toolError: true, toolErrorCode: "internal" }), TOOLS)).toEqual({ level: "error", fields: { kind: "server_5xx", key: "find_parking", status: 503, ms: 7 }, message: "an MCP request was answered with a server error" });
    expect(requestErrorLine(line({ rpc: "initialize", tool: null, status: 500, rpcErrorCode: -32603 }), TOOLS)?.fields).toEqual({ kind: "server_5xx", key: "initialize", status: 500, ms: 7, rpcErrorCode: -32603 });
  });

  it("rpc_unknown_method: warn, keyed by the method", () => {
    expect(requestErrorLine(line({ rpc: "server/discover", tool: null, rpcErrorCode: METHOD_NOT_FOUND }), TOOLS)).toEqual({ level: "warn", fields: { kind: "rpc_unknown_method", key: "server/discover", status: 200, ms: 7, rpcErrorCode: -32601 }, message: "an MCP client asked for a method this server does not have" });
  });

  it("tool_unknown: warn, keyed by the name, or `unshaped` when it is not shaped like one", () => {
    expect(requestErrorLine(line({ tool: "find_unicorn", rpcErrorCode: -32602 }), TOOLS)?.fields).toEqual({ kind: "tool_unknown", key: "find_unicorn", status: 200, ms: 7, rpcErrorCode: -32602 });
    expect(requestErrorLine(line({ tool: "find_unicorn", toolError: true, toolErrorCode: "not_found" }), TOOLS)?.fields).toMatchObject({ kind: "tool_unknown", key: "find_unicorn" });
    expect(requestErrorLine(line({ tool: null, toolError: true }), TOOLS)?.fields).toMatchObject({ kind: "tool_unknown", key: TOOL_UNSHAPED });
  });

  it("tool_error: warn, with the closed-list code and the reason when there is one; `unclassified` without a code", () => {
    expect(requestErrorLine(line({ toolError: true, toolErrorCode: "invalid_input", toolErrorReason: "place_and_coords" }), TOOLS)).toEqual({ level: "warn", fields: { kind: "tool_error", key: "find_parking", status: 200, ms: 7, code: "invalid_input", reason: "place_and_coords" }, message: "a tool answered with an error result" });
    expect(requestErrorLine(line({ toolError: true, toolErrorCode: "unavailable" }), TOOLS)?.fields).toEqual({ kind: "tool_error", key: "find_parking", status: 200, ms: 7, code: "unavailable" });
    expect(requestErrorLine(line({ toolError: true }), TOOLS)?.fields).toMatchObject({ kind: "tool_error", code: "unclassified" });
  });

  it("rpc_error: any other JSON-RPC error, keyed by the method", () => {
    expect(requestErrorLine(line({ rpc: "resources/read", tool: null, rpcError: true }), TOOLS)?.fields).toEqual({ kind: "rpc_error", key: "resources/read", status: 200, ms: 7 });
  });

  it("a key the client chose is masked: an address, a UUID, an e-mail or a token never reaches the line", () => {
    for (const planted of ["10.1.2.3", "3f2b8c1e-1d2a-4b5c-9e8f-0a1b2c3d4e5f", "someone@alpha.example", "Bearer abcdefghijklmnopqrstuvwxyz0123456789"]) {
      const f = requestErrorLine(line({ rpc: planted, tool: null, rpcErrorCode: METHOD_NOT_FOUND }), TOOLS)?.fields;
      expect(f?.kind).toBe("rpc_unknown_method");
      expect(JSON.stringify(f)).not.toContain(planted.split(" ").pop());
    }
    expect(clientKey("find_unicorn")).toBe("find_unicorn");
    // A long run is a token whatever it spells, so it is masked, never cut to a fragment.
    expect(clientKey("x".repeat(100))).toBe("token");
    // A quoted name keeps only the mask's word.
    expect(clientKey("„someone«")).toBe("q");
  });
});

describe("the program writes the fault line beside the request line", () => {
  let api: Server | undefined;
  let program: HttpProgram | undefined;
  afterEach(async () => {
    if (program !== undefined) {
      program.server.closeAllConnections();
      await new Promise<void>((resolve) => { program!.server.close(() => resolve()); });
      await program.mcp.close();
      await program.usage.stop();
      program = undefined;
    }
    if (api !== undefined) { api.closeAllConnections(); await new Promise<void>((resolve) => { api!.close(() => resolve()); }); api = undefined; }
  });

  it("tool_error with its code, tool_unknown and rpc_unknown_method, each as one structured warn line", async () => {
    api = createServer((_req, res) => { res.writeHead(503, { "content-type": "application/problem+json" }).end('{"type":"about:blank","title":"Service Unavailable","status":503}'); });
    await new Promise<void>((resolve) => api!.listen(0, "127.0.0.1", () => resolve()));
    const apiUrl = `http://127.0.0.1:${String((api.address() as AddressInfo).port)}`;
    const free = createNetServer();
    await new Promise<void>((resolve) => free.listen(0, "127.0.0.1", () => resolve()));
    const port = (free.address() as AddressInfo).port;
    await new Promise<void>((resolve) => free.close(() => resolve()));
    const warns: { fields: Record<string, unknown>; message: string }[] = [];
    vi.spyOn(log, "info").mockImplementation((() => undefined) as never);
    vi.spyOn(log, "warn").mockImplementation(((fields: Record<string, unknown>, message: string) => { warns.push({ fields, message }); }) as never);
    program = startHttp({ MCP_PORT: String(port), VIAFREI_API_URL: apiUrl, VIAFREI_API_KEY: "request-log-test" }, { exit: vi.fn(), onSignal: () => undefined });
    if (!program.server.listening) await new Promise<void>((resolve) => program!.server.once("listening", () => resolve()));
    const base = `http://127.0.0.1:${String(port)}/mcp`;
    const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
    const init = await fetch(base, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "request-log-test", version: "0" } } }) });
    await init.text();
    const session = { ...headers, "mcp-session-id": init.headers.get("mcp-session-id") ?? "", "mcp-protocol-version": "2025-06-18" };
    const send = async (id: number, method: string, params?: unknown): Promise<number> => {
      const r = await fetch(base, { method: "POST", headers: session, body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) }) });
      await r.text();
      return r.status;
    };
    expect(await send(2, "tools/call", { name: "check_weather_warnings", arguments: { lat: 50.5546, lon: 9.6773, language: "en" } })).toBe(200);
    expect(await send(3, "tools/call", { name: "find_unicorn", arguments: {} })).toBe(200);
    expect(await send(4, "server/discover")).toBe(200);
    // Only the fault lines: the handler's own "tool call failed" warn about the 503 is not one of them.
    const FAULT_MESSAGES = new Set(["a tool answered with an error result", "an MCP client called a tool this server does not have", "an MCP client asked for a method this server does not have"]);
    const faults = (): typeof warns => warns.filter((w) => FAULT_MESSAGES.has(w.message));
    await vi.waitFor(() => { expect(faults()).toHaveLength(3); });
    const kinds = faults().map((w) => w.fields);
    expect(kinds[0]).toMatchObject({ kind: "tool_error", key: "check_weather_warnings", status: 200, code: "unavailable" });
    expect(kinds[1]).toMatchObject({ kind: "tool_unknown", key: "find_unicorn" });
    expect(kinds[2]).toMatchObject({ kind: "rpc_unknown_method", key: "server/discover", rpcErrorCode: METHOD_NOT_FOUND });
    for (const w of faults()) {
      expect(Object.keys(w.fields).every((k) => ["kind", "key", "status", "ms", "rpcErrorCode", "code", "reason"].includes(k))).toBe(true);
      expect(JSON.stringify(w)).not.toMatch(/50\.5546|request-log-test|127\.0\.0\.1/u);
    }
  });
});
