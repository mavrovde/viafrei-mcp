import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiClient, ApiError, apiConfigFromEnv, DEFAULT_API_URL } from "../src/api/client.js";
import { OPERATIONS } from "../src/api/operations.js";
import { PENDING_QUERY } from "../src/api/pending.js";
import { API_BASE, calls, handlerFor, mockServer, problem } from "./api-mock.js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  calls.length = 0;
});
afterAll(() => mockServer.close());

describe("ApiClient", () => {
  const api = new ApiClient({ baseUrl: API_BASE, key: "k" });

  it("reads its configuration from generic env names", () => {
    expect(apiConfigFromEnv({})).toEqual({ baseUrl: DEFAULT_API_URL, key: null });
    expect(apiConfigFromEnv({ VIAFREI_API_URL: "http://127.0.0.1/", VIAFREI_API_KEY: " k " })).toEqual({ baseUrl: "http://127.0.0.1", key: "k" });
  });

  it("sends a parameter the next API release adds after the contract's own, and only for its operation", () => {
    expect(api.url("listStations", { q: "Frankfurt", limit: 1, railway: "true" })).toBe(`${API_BASE}/v1/stations?q=Frankfurt&limit=1&railway=true`);
    expect(api.url("listStations", { q: "Frankfurt", railway: undefined })).toBe(`${API_BASE}/v1/stations?q=Frankfurt`);
    expect(api.url("listPlaces", { q: "Köln", railway: "true" })).toBe(`${API_BASE}/v1/places?q=K%C3%B6ln`);
  });

  it("no pending parameter is in the contract yet: one the contract copy carries leaves pending.ts", () => {
    for (const [op, names] of Object.entries(PENDING_QUERY)) {
      expect(Object.keys(OPERATIONS)).toContain(op);
      for (const name of names) expect(OPERATIONS[op as keyof typeof OPERATIONS].query as readonly string[]).not.toContain(name);
    }
  });

  it("fills path parameters and keeps only contract query parameters", () => {
    expect(api.url("listStationDepartures", { stationId: "a b", limit: 3, bogus: "x" })).toBe(`${API_BASE}/v1/stations/a%20b/departures?limit=3`);
    expect(api.url("listChargingOptions", { at: "1,2", conditions: ["free", "24h"] })).toBe(`${API_BASE}/v1/charging-options?at=1%2C2&conditions=free%2C24h`);
  });

  it("sends the key and returns the envelope", async () => {
    const r = await api.get<unknown[]>("listPlaces", { q: "Köln" });
    expect(Array.isArray(r.data)).toBe(true);
    expect(calls[0]?.headers.get("x-api-key")).toBe("k");
  });

  it("maps problems to kinds", async () => {
    for (const [status, kind] of [[401, "not_configured"], [403, "refused"], [404, "not_found"], [400, "invalid"], [429, "rate_limited"], [503, "unavailable"]] as const) {
      mockServer.use(handlerFor("listPlaces", () => problem(status, "x")));
      await expect(api.get("listPlaces", { q: "x" })).rejects.toMatchObject({ kind, status });
    }
  });

  it("makes no request without a key", async () => {
    await expect(new ApiClient({ baseUrl: API_BASE, key: null }).get("listPlaces", { q: "x" })).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(0);
  });

  it("sends a write operation's JSON body with the key", async () => {
    const r = await api.post<{ source: string }>("createRefresh", { source: "train-board-de", subject: { eva: "8001001" } });
    expect(r.data.source).toBe("fuel-prices-de");
    expect(calls.map((c) => c.operationId)).toEqual(["createRefresh"]);
    expect(calls[0]!.headers.get("content-type")).toBe("application/json");
  });

  it("the operation table is generated from the pinned contract", () => {
    execFileSync(process.execPath, [new URL("../scripts/gen-operations.mjs", import.meta.url).pathname, "--check"]);
  });

  it("the contract fixture is api/openapi.json of the release api.pin names", () => {
    const pin = /^api_version=(\d+\.\d+\.\d+)$/m.exec(readFileSync(new URL("../api.pin", import.meta.url), "utf8"))?.[1];
    const spec = JSON.parse(readFileSync(new URL("./fixtures/api-openapi.json", import.meta.url), "utf8")) as { "x-source": { comment: string } };
    expect(pin).toBe("0.3.2");
    expect(spec["x-source"].comment).toContain(`at the release tag v${pin ?? ""}`);
  });

  it("asks for a tool call's language with the contract's lang parameter, where the operation takes it", () => {
    const en = api.withLanguage("en");
    expect(en.url("listPlaces", { q: "Köln" })).toBe(`${API_BASE}/v1/places?q=K%C3%B6ln&lang=en`);
    expect(en.url("getMeta")).toBe(`${API_BASE}/v1/meta`);
    expect(api.url("listPlaces", { q: "Köln" })).toBe(`${API_BASE}/v1/places?q=K%C3%B6ln`);
  });
});
