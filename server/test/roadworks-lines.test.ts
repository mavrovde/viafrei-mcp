/**
 * find_roadworks_ahead's lines (mcp #290; round Q13, Q14 listed "A7: Baustelle bis 27.07.2029" twenty times, with
 * neither where nor from when nor how many): each site says where on the road and from when to when, the head
 * says how many the window holds and how many are listed, a place's sites come nearest first.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { HttpResponse } from "msw";
import { calls, exampleOf, handlerFor, mockServer } from "./api-mock.js";
import { connect, textOf } from "./harness.js";
import type * as T from "../src/api/types.js";
import { readFileSync } from "node:fs";
import { roadPlace, roadworksLine } from "../src/tools/handlers.js";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  mockServer.resetHandlers();
  calls.length = 0;
});
afterAll(() => mockServer.close());

async function call(args: Record<string, unknown>): Promise<CallToolResult> {
  const { client, close } = await connect();
  try {
    return (await client.callTool({ name: "find_roadworks_ahead", arguments: args })) as CallToolResult;
  } finally {
    await close();
  }
}
const body = (r: CallToolResult): string => textOf(r).slice(0, textOf(r).lastIndexOf("\n\n"));

/** A site as the Autobahn GmbH publishes one of the round's A7 works: a code headline, the stretch as subtitle. */
const site = (o: Partial<T.RoadSituation> = {}): T.RoadSituation => ({
  id: "w1", kind: "roadworks", severity: "lane_closed", road: "A7", direction: null, directionText: "Richtung Hamburg",
  validity: { from: "2026-11-30T05:00:00Z", until: "2029-07-26T22:00:00Z" }, headline: "constructionWorks", description: null,
  delayMin: null, lengthM: null, subtitle: "AS Soltau-Ost - AS Bispingen", ...o,
});
function world(situations: T.RoadSituation[], page: Record<string, unknown> = {}, op: "getMotorwayConditions" | "listRoadConditions" = "getMotorwayConditions") {
  const ex = exampleOf<{ data: Record<string, unknown>; meta: Record<string, unknown> }>(op);
  mockServer.use(handlerFor(op, () => HttpResponse.json({ ...ex, data: { ...ex.data, situations }, meta: { ...ex.meta, page: { limit: 10, hasMore: false, nextCursor: null, ...page } } })));
}

describe("a site's line: where and when", () => {
  it("road, carriageway, what, the stretch, start and end (de, en)", () => {
    expect(roadworksLine(site(), "de")).toBe("- A7 Richtung Hamburg: Baustelle · AS Soltau-Ost - AS Bispingen · 30.11.2026, 06:00 – 27.07.2029, 00:00");
    expect(roadworksLine(site(), "en")).toMatch(/^- A7 Richtung Hamburg: Roadworks \(Baustelle\) · AS Soltau-Ost - AS Bispingen · .+ – .+$/u);
  });
  it("no subtitle: the text's first line; neither: place not given", () => {
    expect(roadworksLine(site({ subtitle: null, description: "Hamburg-Stellingen - Othmarschen\nSanierung der Fahrbahn" }), "de")).toContain(" · Hamburg-Stellingen - Othmarschen · ");
    expect(roadworksLine(site({ subtitle: null, descriptionShown: "Kreuz Hamburg-Nordwest" }), "en")).toContain(" · Kreuz Hamburg-Nordwest · ");
    expect(roadworksLine(site({ subtitle: "  " }), "de")).toContain(" · Ort nicht angegeben · ");
    expect(roadworksLine(site({ subtitle: null }), "en")).toContain(" · place not given · ");
  });
  it("edges: no end, no start, no dates, an end in 2033", () => {
    expect(roadworksLine(site({ validity: { from: "2026-11-30T05:00:00Z", until: null } }), "de")).toMatch(/ · ab 30\.11\.2026, 06:00, Ende nicht angegeben$/u);
    expect(roadworksLine(site({ validity: { from: null, until: "2033-05-01T21:59:00Z" } }), "en")).toMatch(/ · start not given, until .*2033.*$/u);
    expect(roadworksLine(site({ validity: { from: null, until: null } }), "de")).toMatch(/ · ohne Zeitangabe$/u);
  });
});

describe("the answer: the window's count, the listed, nearest first for a place", () => {
  it("the head says how many the window holds and how many are listed (page total)", async () => {
    world([site(), site({ id: "w2" })], { total: 20, hasMore: true });
    const t = body(await call({ road: "A7", from: "2026-11-30", to: "2026-12-06", limit: 2, language: "de" })).split("\n");
    expect(t[1]).toBe("Im Zeitraum 30.11.2026–06.12.2026 20 Baustellen; hier die ersten 2:");
    expect(t.slice(2)).toHaveLength(2);
  });
  it("no total sent and more held: at least one more; all listed: the count; one; none", async () => {
    world([site(), site({ id: "w2" })], { hasMore: true });
    expect(body(await call({ road: "A7", from: "2026-11-30", to: "2026-12-06", limit: 2, language: "en" })).split("\n")[1]).toBe("At least 3 roadworks sites for 2026-11-30–2026-12-06; the first 2:");
    world([site(), site({ id: "w2" })]);
    expect(body(await call({ road: "A7", from: "2026-11-30", to: "2026-12-06", language: "en" })).split("\n")[1]).toBe("2 roadworks sites for 2026-11-30–2026-12-06:");
    world([site()]);
    expect(body(await call({ road: "A7", from: "2026-11-30", to: "2026-12-06", language: "de" })).split("\n")[1]).toBe("Im Zeitraum 30.11.2026–06.12.2026 eine Baustelle:");
    world([]);
    expect(body(await call({ road: "A7", from: "2026-11-30", to: "2026-12-06", language: "de" })).split("\n")[1]).toBe("Im Zeitraum 30.11.2026–06.12.2026 ist keine Baustelle gemeldet.");
  });
  it("a place: nearest first, the same distance in the API's order", async () => {
    world([site({ id: "a", distanceM: 2_400, subtitle: "far" }), site({ id: "b", distanceM: 300, subtitle: "near" }), site({ id: "c", distanceM: 300, subtitle: "near too" })], {}, "listRoadConditions");
    const t = body(await call({ place: "Hamburg-Altona", language: "en" })).split("\n").slice(2);
    expect(t.map((l) => l.split(" · ")[1])).toEqual(["near", "near too", "far"]);
  });
});

// The API's real roadworks rows (2.7.9 round Q13, Q14: every line said "Ort nicht angegeben"): no subtitle, no
// description, only the chainage and a point. The hand-made rows above all carried a text, which is why the
// 2.7.9 tests passed while prod did not.
describe("roadworks rows as the API sends them", () => {
  const real = JSON.parse(readFileSync(new URL("./fixtures/roadworks-a7.json", import.meta.url), "utf8")) as { data: T.RoadConditionsData };
  for (const language of ["de", "en"] as const) {
    it(`each line says its kilometre, never "place not given" (${language})`, async () => {
      mockServer.use(handlerFor("getMotorwayConditions", () => HttpResponse.json({ data: real.data, meta: exampleOf<{ meta: Record<string, unknown> }>("getMotorwayConditions").meta })));
      const lines = body(await call({ road: "A7", language })).split("\n").filter((l) => l.startsWith("- "));
      expect(lines).toHaveLength(3);
      expect(lines.some((l) => /Ort nicht angegeben|place not given/u.test(l))).toBe(false);
      expect(lines[0]).toBe(language === "de"
        ? "- A7: Baustelle · km 346,2 · 23.03.2023, 00:00 – 27.07.2029, 00:00"
        : "- A7: Roadworks (Baustelle) · km 346.2 · 23/03/2023, 00:00 – 27/07/2029, 00:00");
    });
  }
  for (const language of ["de", "en"] as const) {
    it(`a publisher text and a kilometre: both, the text first (${language})`, () => {
      const row = { ...real.data.situations[0]!, subtitle: "AS Seesen (Harz) (aus Richtung Harz) nach A7" };
      expect(roadworksLine(row, language)).toContain(` · AS Seesen (Harz) (aus Richtung Harz) nach A7, km ${language === "de" ? "346,2" : "346.2"} · `);
    });
  }
  it("between junctions where named, a point where no kilometre, nothing where neither", () => {
    const row = real.data.situations[0]!;
    expect(roadPlace({ ...row, position: { fromKm: 1, toKm: 2, junctionFrom: "AS Seesen", junctionTo: "AS Echte" } }, "de")).toBe("zwischen AS Seesen und AS Echte");
    expect(roadPlace({ ...row, position: { fromKm: 346.2, toKm: 350, junctionFrom: null, junctionTo: null } }, "en")).toBe("km 346.2–350.0");
    expect(roadPlace({ ...row, position: { fromKm: 346.2, toKm: null, junctionFrom: "AS Seesen", junctionTo: null } }, "de")).toBe("km 346,2");
    expect(roadPlace({ ...row, position: null }, "en")).toBe("at 50.334, 9.775");
    expect(roadPlace({ ...row, position: null, location: null }, "de")).toBeNull();
  });
});
