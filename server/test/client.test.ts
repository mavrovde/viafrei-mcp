import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiClient, ApiError, apiConfigFromEnv, DEFAULT_API_URL } from "../src/api/client.js";
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

  it("refuses a write the contract lacks", async () => {
    await expect(api.post("postTrainBoard", {})).rejects.toMatchObject({ kind: "missing_operation" });
  });

  it("the operation table is generated from the pinned contract", () => {
    execFileSync(process.execPath, [new URL("../scripts/gen-operations.mjs", import.meta.url).pathname, "--check"]);
  });

  it("the contract fixture is api/openapi.json of the release api.pin names", () => {
    const pin = /^api_version=(\d+\.\d+\.\d+)$/m.exec(readFileSync(new URL("../api.pin", import.meta.url), "utf8"))?.[1];
    const spec = JSON.parse(readFileSync(new URL("./fixtures/api-openapi.json", import.meta.url), "utf8")) as { "x-source": { comment: string } };
    expect(pin).toBe("0.3.0");
    expect(spec["x-source"].comment).toContain(`at the release tag v${pin ?? ""}`);
  });

  it("asks for a tool call's language with the contract's lang parameter, where the operation takes it", () => {
    const en = api.withLanguage("en");
    expect(en.url("listPlaces", { q: "Köln" })).toBe(`${API_BASE}/v1/places?q=K%C3%B6ln&lang=en`);
    expect(en.url("getMeta")).toBe(`${API_BASE}/v1/meta`);
    expect(api.url("listPlaces", { q: "Köln" })).toBe(`${API_BASE}/v1/places?q=K%C3%B6ln`);
  });
});
