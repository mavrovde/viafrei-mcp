/**
 * End to end over Streamable HTTP: the built server (dist/http.js) against an API.
 *
 * - `npm run test:e2e:mock`: the API is Prism mocking test/fixtures/api-openapi.json with --errors, so a
 *   request the contract does not allow fails the call.
 * - The pre-release job sets E2E_API_URL (and E2E_API_KEY) to a real API built from the pinned image, and
 *   E2E_FACTS=1 to also check the answers' key facts against that API's own answers.
 *
 * Checks: initialize, tools/list byte-equal to catalogue.json (under the capture's documented
 * normalisation), and one tools/call per tool that answers without an error and with its attribution.
 * Against a real API the motorway a road case asks is one that API lists (the fixture world's own roads,
 * not a real-world name): the one with the most situations, read through listMotorways.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normaliseLikeCapture } from "../../src/catalogue.js";
import { TOOL_CASES } from "../tool-cases.js";
import { ApiClient, apiConfigFromEnv } from "../../src/api/client.js";
import type { PlaceItem, Station } from "../../src/api/types.js";

type MotorwayItem = { road: string; situations: number };

/** A case's arguments with the motorway it names replaced by `road` (the road tools and a road watch). */
function withRoad(args: Record<string, unknown>, road: string): Record<string, unknown> {
  const out = { ...args };
  if (Array.isArray(out["roads"])) out["roads"] = [road];
  if (typeof out["road"] === "string") out["road"] = road;
  if (out["kind"] === "road" && typeof out["key"] === "string") out["key"] = road;
  return out;
}

const root = new URL("../../", import.meta.url).pathname;
const catalogue = JSON.parse(readFileSync(new URL("../../catalogue/catalogue.json", import.meta.url), "utf8"));
const children: ChildProcess[] = [];

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      s.close(() => resolve(typeof a === "object" && a !== null ? a.port : 0));
    });
  });
}

async function waitFor(url: string, ms: number): Promise<void> {
  const until = Date.now() + ms;
  for (;;) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (r.status < 500 || r.status === 503) return;
    } catch {
      // not up yet
    }
    if (Date.now() > until) throw new Error(`${url} did not come up within ${ms} ms`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

function start(cmd: string, args: string[], env: Record<string, string>): ChildProcess {
  const c = spawn(cmd, args, { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  c.stdout?.on("data", () => undefined);
  c.stderr?.on("data", (d: Buffer) => {
    if (process.env["E2E_VERBOSE"] === "1") process.stderr.write(d);
  });
  children.push(c);
  return c;
}

let mcpUrl = "";
let fixtureRoad: string | undefined;
let session = "";
let id = 0;

async function rpc(method: string, params: unknown, notify = false): Promise<{ raw: string; body: { result?: Record<string, unknown>; error?: unknown } }> {
  const r = await fetch(mcpUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(session === "" ? {} : { "mcp-session-id": session }) },
    body: JSON.stringify(notify ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id: ++id, method, params }),
  });
  const sid = r.headers.get("mcp-session-id");
  if (sid !== null) session = sid;
  const text = await r.text();
  if (notify) return { raw: text, body: {} };
  const data = r.headers.get("content-type")?.includes("text/event-stream")
    ? text.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).find((l) => l.includes(`"id":${id}`)) ?? ""
    : text;
  return { raw: data, body: JSON.parse(data) };
}

beforeAll(async () => {
  let apiUrl = process.env["E2E_API_URL"] ?? "";
  if (apiUrl === "") {
    const apiPort = await freePort();
    start(`${root}node_modules/.bin/prism`, ["mock", "--errors", "-h", "127.0.0.1", "-p", String(apiPort), "test/fixtures/api-openapi.json"], {});
    apiUrl = `http://127.0.0.1:${apiPort}`;
    await waitFor(`${apiUrl}/healthz`, 60_000);
  } else {
    const api = new ApiClient(apiConfigFromEnv({ VIAFREI_API_URL: apiUrl, VIAFREI_API_KEY: process.env["E2E_API_KEY"] }));
    const roads = (await api.get<MotorwayItem[]>("listMotorways", { limit: 100 })).data;
    fixtureRoad = [...roads].sort((a, b) => b.situations - a.situations)[0]?.road;
    if (fixtureRoad === undefined) throw new Error("the API lists no motorway: the fixture world was not seeded");
  }
  const port = await freePort();
  start(process.execPath, ["dist/http.js"], {
    PORT: String(port),
    HOST: "127.0.0.1",
    VIAFREI_API_URL: apiUrl,
    VIAFREI_API_KEY: process.env["E2E_API_KEY"] ?? "e2e-mock-key",
    LOG_LEVEL: "warn",
  });
  mcpUrl = `http://127.0.0.1:${port}/mcp`;
  await waitFor(`http://127.0.0.1:${port}/healthz`, 30_000);
}, 120_000);

afterAll(() => {
  for (const c of children) c.kill("SIGTERM");
});

describe("MCP over Streamable HTTP against the API", () => {
  it("initialize answers with the catalogue's server info and instructions", async () => {
    const r = await rpc("initialize", { protocolVersion: catalogue.protocolVersion, capabilities: {}, clientInfo: { name: "e2e", version: "0" } });
    expect(r.body.result?.["serverInfo"]).toEqual(catalogue.serverInfo);
    expect(r.body.result?.["instructions"]).toBe(catalogue.instructions);
    expect(session).not.toBe("");
    await rpc("notifications/initialized", {}, true);
  });

  it("tools/list is byte-equal to catalogue.json", async () => {
    const r = await rpc("tools/list", {});
    expect(JSON.stringify(normaliseLikeCapture(r.body.result?.["tools"]))).toBe(JSON.stringify(catalogue.tools));
  });

  for (const c of TOOL_CASES) {
    it(`tools/call ${c.tool}`, async () => {
      const r = await rpc("tools/call", { name: c.tool, arguments: fixtureRoad === undefined ? c.args : withRoad(c.args, fixtureRoad) });
      const result = r.body.result as { isError?: boolean; content: { text: string }[]; _meta?: { attribution?: string } };
      expect(result.isError, result.content[0]?.text).not.toBe(true);
      expect(typeof result._meta?.attribution).toBe("string");
    });
  }

  it("tools/call stop_watch", async () => {
    const r = await rpc("tools/call", { name: "stop_watch", arguments: { watch_id: 1, language: "en" } });
    expect((r.body.result as { isError?: boolean }).isError).not.toBe(true);
  });

  // The real-API run only: the answer carries the API's own first result, asked directly.
  it.runIf(process.env["E2E_FACTS"] === "1")("key facts: find_place and get_departures name what the API answers", async () => {
    const api = new ApiClient(apiConfigFromEnv({ VIAFREI_API_URL: process.env["E2E_API_URL"], VIAFREI_API_KEY: process.env["E2E_API_KEY"] }));
    const places = await api.get<PlaceItem[]>("listPlaces", { q: "Köln", limit: 1 });
    const place = await rpc("tools/call", { name: "find_place", arguments: { query: "Köln", language: "en" } });
    const placeText = (place.body.result as { content: { text: string }[] }).content[0]?.text ?? "";
    if (places.data[0] !== undefined) expect(placeText).toContain(places.data[0].name);
    const stations = await api.get<Station[]>("listStations", { q: "Köln Hbf", limit: 1 });
    const dep = await rpc("tools/call", { name: "get_departures", arguments: { stop: "Köln Hbf", language: "en" } });
    const depText = (dep.body.result as { content: { text: string }[] }).content[0]?.text ?? "";
    if (stations.data[0] !== undefined) expect(depText).toContain(stations.data[0].name);
    expect((places.meta.attribution ?? []).length + (stations.meta.attribution ?? []).length).toBeGreaterThan(0);
  });
});
