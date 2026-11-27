/**
 * Every handler refusal names its own reason code (`_meta.errorCode`) and, for a refused argument clause, which one
 * (`_meta.errorReason`): the handlers are called here directly, without the server, so no code can come from the
 * server's own fallback. The request log and the usage counters count an error by these, never by its text.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HttpResponse } from "msw";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ApiClient, ApiError, type ApiFailure } from "../src/api/client.js";
import { loadCatalogue } from "../src/catalogue.js";
import { apiFailure, notAvailable } from "../src/presentation.js";
import { SessionWatches, type ToolContext } from "../src/tools/context.js";
import { HANDLERS } from "../src/tools/handlers.js";
import { REFRESH_WAIT } from "../src/tools/trains.js";
import { toolErrorCodeOf, toolErrorReasonOf } from "../src/usage-names.js";
import { inputCheck } from "../src/validate.js";
import { API_BASE, calls, exampleOf, handlerFor, mockServer } from "./api-mock.js";
import { TEST_KEY } from "./harness.js";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => { mockServer.resetHandlers(); calls.length = 0; });
afterAll(() => mockServer.close());

const serve = (op: string, data: unknown): void => {
  mockServer.use(handlerFor(op, () => HttpResponse.json({ ...exampleOf<Record<string, unknown>>(op), data })));
};
const nothingFound = (): void => { serve("resolvePlace", null); serve("listPlaces", []); serve("listStations", []); };
const ctxFor = (tool: string): ToolContext => ({
  tool, language: "en", watches: new SessionWatches(), refreshWait: REFRESH_WAIT, api: new ApiClient({ baseUrl: API_BASE, key: TEST_KEY }).withLanguage("en"),
});
/** A handler's own answer; an API failure it lets through is worded (and coded) as the server words it. */
const run = async (tool: string, args: Record<string, unknown>): Promise<CallToolResult> =>
  HANDLERS[tool]!({ language: "en", ...args }, ctxFor(tool)).catch((e: unknown) => (e instanceof ApiError ? apiFailure(e, "en") : Promise.reject(e)));
const codeOf = (r: CallToolResult): [string | null, string | null] => [toolErrorCodeOf(r), toolErrorReasonOf(r)];
const CATALOGUE = loadCatalogue().tools;
const TOOLS = CATALOGUE.map((t) => t.name);
/** The server refuses (and codes invalid_input) a call its schema refuses before any handler runs; those are not asked here. */
const schemaRefuses = ((check) => (tool: string, args: Record<string, unknown>): boolean => check(tool, { language: "en", ...args }) !== null)(inputCheck(CATALOGUE));

describe("every handler refusal carries its code", () => {
  it("called with nothing but a language: every refusal is coded, and most tools refuse", async () => {
    let refused = 0;
    for (const tool of TOOLS.filter((t) => !schemaRefuses(t, {}))) {
      const r = await run(tool, {});
      if (r.isError !== true) continue;
      refused += 1;
      expect([tool, toolErrorCodeOf(r)]).toEqual([tool, expect.any(String)]);
    }
    expect(refused).toBeGreaterThanOrEqual(10);
  });
  it("a place, station, stop or region no search finds: every refusal is coded", async () => {
    let unknown = 0;
    for (const tool of TOOLS) {
      nothingFound();
      const asked = Object.fromEntries(["place", "station", "stop", "region"].filter((k) => !schemaRefuses(tool, { [k]: "Nirgendwo" })).map((k) => [k, "Nirgendwo"]));
      if (Object.keys(asked).length === 0) continue;
      const r = await run(tool, asked);
      if (r.isError !== true) continue;
      unknown += 1;
      expect([tool, toolErrorCodeOf(r)]).toEqual([tool, expect.any(String)]);
    }
    expect(unknown).toBeGreaterThanOrEqual(5);
  });
});

describe("each refusal's code and reason", () => {
  const cases: [string, string, Record<string, unknown>, [string, string | null]][] = [
    ["no place", "find_cheapest_fuel", {}, ["invalid_input", "place_missing"]],
    ["an unknown place", "find_parking", { place: "Nirgendwo" }, ["not_found", null]],
    ["an unknown place, the rules", "get_driving_rules", { place: "Nirgendwo" }, ["not_found", null]],
    ["an unknown region", "check_transit_disruption", { region: "Nirgendwo" }, ["not_found", "region"]],
    ["a road where a point is meant", "find_parking", { kind: "disabled_badge", road: "A7" }, ["invalid_input", "road_not_point"]],
    ["no station", "describe_station", {}, ["invalid_input", null]],
    ["an unknown station", "describe_station", { station: "Nirgendwo" }, ["not_found", null]],
    ["an unknown station's facilities", "check_station_facilities", { station: "Nirgendwo" }, ["not_found", null]],
    ["an unknown stop", "get_departures", { stop: "Nirgendwo" }, ["not_found", null]],
    ["two ways in", "get_departures", { stop: "A", stop_id: "1:x" }, ["invalid_input", "two_ways_in"]],
    ["no station for a train board", "get_train_departures", {}, ["invalid_input", null]],
    ["an unknown train station", "get_train_departures", { station: "Nirgendwo" }, ["not_found", null]],
    ["a watch without kind or key", "watch_situation", {}, ["invalid_input", null]],
    ["stop_watch with nothing to stop", "stop_watch", {}, ["invalid_input", null]],
    ["stop_watch with a uri no watch has", "stop_watch", { uri: "viafrei://watches/not-a-number" }, ["invalid_input", null]],
    ["describe_location with no coordinate", "describe_location", {}, ["invalid_input", "place_missing"]],
    ["describe_location with half a coordinate", "describe_location", { lat: 52.52 }, ["invalid_input", "half_coordinate"]],
  ];
  for (const [what, tool, args, want] of cases) {
    it(`${tool}: ${what}`, async () => {
      nothingFound();
      const r = await run(tool, args);
      expect(r.isError).toBe(true);
      expect(codeOf(r)).toEqual(want);
    });
  }
});

describe("an API failure's code, set where it is worded", () => {
  const want: Record<ApiFailure, string> = { not_found: "not_found", invalid: "invalid_input", rate_limited: "limit_reached", not_configured: "unavailable", refused: "unavailable", unavailable: "unavailable" };
  for (const [kind, code] of Object.entries(want) as [ApiFailure, string][]) {
    it(`${kind} is ${code}`, () => {
      expect(toolErrorCodeOf(apiFailure(new ApiError(kind, "x"), "en"))).toBe(code);
    });
  }
  it("quota-exceeded is limit_reached, overloaded unavailable; a missing operation unavailable, with no reason", () => {
    const quota = { type: "https://api.viafrei.de/problems/quota-exceeded", title: "q", status: 429 };
    const overload = { type: "https://api.viafrei.de/problems/overloaded", title: "o", status: 503 };
    expect(toolErrorCodeOf(apiFailure(new ApiError("rate_limited", "x", 429, quota as never), "en"))).toBe("limit_reached");
    expect(toolErrorCodeOf(apiFailure(new ApiError("unavailable", "x", 503, overload as never), "en"))).toBe("unavailable");
    expect(toolErrorCodeOf(notAvailable("en", "x"))).toBe("unavailable");
    expect(toolErrorReasonOf(notAvailable("en"))).toBeNull();
  });
});
