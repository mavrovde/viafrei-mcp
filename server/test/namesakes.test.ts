/**
 * A name several towns share is asked, not guessed (round Q50 "Neustadt" took a Hamburg district; mcp #291), and
 * find_place says a place held twice once and, with near, lists nearest first (round Q61, Q64, Q65). Built on the
 * rows the round's answers showed.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HttpResponse } from "msw";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { calls, exampleOf, handlerFor, mockServer } from "./api-mock.js";
import { connect, textOf } from "./harness.js";
import type * as T from "../src/api/types.js";
import { NAMESAKES_SHOWN, namesakes, onePerPlace, SAME_PLACE_M } from "../src/tools/find-place.js";
import { SPEED_NOTICE_DE, speedNotice } from "../src/tools/speed-cameras.js";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  calls.length = 0;
});
afterAll(() => mockServer.close());

async function call(tool: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const { client, close } = await connect();
  try {
    return (await client.callTool({ name: tool, arguments: args })) as CallToolResult;
  } finally {
    await close();
  }
}
const ops = (): string[] => calls.map((c) => c.operationId);
/** A speed-camera answer's lines after the planning notice it opens with. */
function afterNotice(r: CallToolResult, language: "de" | "en"): string[] {
  const t = textOf(r);
  expect(t.startsWith(`${speedNotice(language)}\n\n`)).toBe(true);
  return t.slice(speedNotice(language).length + 2).split("\n");
}
const meta = () => exampleOf<{ meta: Record<string, unknown> }>("listPlaces").meta;
const place = (o: Partial<T.PlaceItem> & { name: string; lat: number; lon: number }): T.PlaceItem => {
  const { lat, lon, ...rest } = o;
  return { id: `p-${o.name}-${lat}`, kind: "municipality", districtCode: null, sourceFamily: "geonames", location: { lat, lon }, ...rest } as T.PlaceItem;
};
/** The resolver names no one place (several alike), the place search answers `rows`. */
function world(rows: T.PlaceItem[]) {
  mockServer.use(
    handlerFor("resolvePlace", () => HttpResponse.json({ data: null, meta: meta() })),
    handlerFor("listPlaces", () => HttpResponse.json({ data: rows, meta: meta() })),
  );
}

// The round's "Neustadt" rows (Q61), two with their official key and Kreis as the BKG rows carry them.
const NEUSTADT = [
  place({ name: "Neustadt", lat: 53.55196, lon: 9.98558, kind: "locality", districtCode: "02000000" }),
  place({ name: "Neustadt", lat: 51.46725, lon: 10.46726, districtCode: "16061074", kreis: "Kreis Eichsfeld" }),
  place({ name: "Neustadt", lat: 53.71979, lon: 9.30941 }),
];

describe("an ambiguous town name is asked (mcp #291 A1)", () => {
  for (const language of ["de", "en"] as const) {
    it(`find_speed_cameras "Neustadt": the candidates with Land and Kreis, no guess, no camera read (${language})`, async () => {
      world(NEUSTADT);
      const r = await call("find_speed_cameras", { place: "Neustadt", language });
      expect(r.isError).toBeFalsy();
      expect(ops()).toEqual(["resolvePlace", "listPlaces"]);
      const lines = afterNotice(r, language);
      expect(lines[0]).toBe(language === "de"
        ? "„Neustadt“ heißen 3 Orte, ich rate nicht. Welcher ist gemeint? Bitte erneut fragen, mit dem Ort und seinem Kreis oder Land (z. B. „Neustadt, Hamburg“) oder mit lat und lon des gemeinten Orts:"
        : '3 places are called "Neustadt", so I do not guess. Which one is meant? Please ask again with the place and its Kreis or Land (for example "Neustadt, Hamburg") or with the lat and lon of the one meant:');
      expect(lines[2]).toBe(language === "de"
        ? "2. Neustadt — Stadt/Gemeinde, Thüringen, Kreis Eichsfeld, 51.46725, 10.46726"
        : "2. Neustadt — town, Thuringia, district Eichsfeld, 51.46725, 10.46726");
      expect(lines[3]).toMatch(/^3\. Neustadt — (Stadt\/Gemeinde|town), 53\.71979, 9\.30941$/u);
      expect(r._meta?.["attribution"]).not.toBe("");
      expect(r.structuredContent).toMatchObject({ ambiguous: true, query: "Neustadt", candidates: [{ districtCode: "02000000" }, { kreis: "Kreis Eichsfeld" }, { lat: 53.71979 }], planningOnly: true, noticeDe: SPEED_NOTICE_DE });
    });
  }

  it("get_driving_rules and every place tool go through the same ask (watch, parking: one resolver)", async () => {
    world(NEUSTADT);
    const r = await call("find_parking", { place: "Neustadt", language: "en" });
    expect(textOf(r).startsWith('3 places are called "Neustadt"')).toBe(true);
  });

  it("one clear match is answered at once: one town of the name, the others other names", async () => {
    world([NEUSTADT[1]!, place({ name: "Neustadt an der Weinstraße", lat: 49.35, lon: 8.14 }), place({ name: "Neustadt (Hessen)", lat: 50.85, lon: 9.11 })]);
    expect(namesakes("Neustadt", [NEUSTADT[1]!, place({ name: "Neustadt an der Weinstraße", lat: 49.35, lon: 8.14 })])).toHaveLength(1);
    mockServer.use(handlerFor("listSpeedCameras", () => HttpResponse.json({ data: { official: [], officialTotal: 0, osm: [], osmTotal: 0 }, meta: exampleOf<{ meta: Record<string, unknown> }>("listSpeedCameras").meta })));
    const r = await call("find_speed_cameras", { place: "Neustadt", language: "en" });
    expect(r.isError).toBeFalsy();
    expect(ops()).toEqual(["resolvePlace", "listPlaces", "listSpeedCameras"]);
  });

  it("one town held twice (GeoNames beside BKG, 160 m apart) is one place: answered, not asked", () => {
    const halle = [place({ name: "Halle", lat: 51.99122, lon: 9.56532 }), place({ name: "Halle", lat: 51.99125, lon: 9.56302, districtCode: "03255021", kreis: "Kreis Holzminden" })];
    expect(namesakes("halle", halle)).toEqual([halle[1]]);
  });

  it("a stop or a district of the name is not a town to ask between", () => {
    expect(namesakes("Neustadt", [NEUSTADT[1]!, place({ name: "Neustadt", lat: 50, lon: 8, kind: "station_area" }), place({ name: "Neustadt", lat: 49, lon: 9, kind: "district" })])).toHaveLength(1);
  });

  it("at most five are listed, the rest counted", async () => {
    world(Array.from({ length: 7 }, (_, i) => place({ name: "Neustadt", lat: 48 + i, lon: 9 })));
    const t = afterNotice(await call("find_speed_cameras", { place: "Neustadt", language: "en" }), "en");
    expect(NAMESAKES_SHOWN).toBe(5);
    expect(t[6]).toBe("… and 2 more (find_place lists them).");
    expect(t[0]).toContain('"Neustadt, district"');
  });
});

describe("find_place: a place held twice said once, nearest first with near", () => {
  it("Q64 'Munich': München, Landeshauptstadt (Munich) and the GeoNames 'Munich' 500 m away are one row", () => {
    const rows = [
      place({ name: "München, Landeshauptstadt", nameEn: "Munich", lat: 48.13452, lon: 11.571, districtCode: "09162000" }),
      place({ name: "Munich", lat: 48.13743, lon: 11.57549 }),
      place({ name: "Landkreis München", nameEn: "Munich", lat: 48.05139, lon: 11.64222, kind: "district" }),
    ];
    expect(onePerPlace(rows).map((p) => p.name)).toEqual(["München, Landeshauptstadt", "Landkreis München"]);
  });

  it("Q65 'Halle': the copy that names its Land and Kreis takes the first one's slot; two Halle far apart stay two", () => {
    const rows = [
      place({ name: "Halle", lat: 52.06007, lon: 8.36083 }),
      place({ name: "Halle", lat: 51.99122, lon: 9.56532, distanceM: 10 }),
      place({ name: "Halle", lat: 51.99125, lon: 9.56302, districtCode: "03255021", kreis: "Kreis Holzminden" }),
    ];
    const once = onePerPlace(rows);
    expect(once.map((p) => [p.location.lon, p.kreis ?? null, p.distanceM ?? null])).toEqual([[8.36083, null, null], [9.56302, "Kreis Holzminden", 10]]);
    expect(SAME_PLACE_M).toBe(2_000);
    expect(onePerPlace([rows[0]!, place({ name: "Halle", lat: 52.06007 + 0.017, lon: 8.36083 })])).toHaveLength(1);
    expect(onePerPlace([rows[0]!, place({ name: "Halle", lat: 52.06007 + 0.017, lon: 8.36083, kind: "district" })])).toHaveLength(2);
  });

  it("Q61 with near: nearest first, equal distances in the API's order", async () => {
    const km = [1, 234, 49, 96, 49];
    mockServer.use(handlerFor("listPlaces", () => HttpResponse.json({ data: km.map((k, i) => place({ name: `Neustadt ${i}`, lat: 50 + i, lon: 9, distanceM: k * 1000 })), meta: meta() })));
    const r = await call("find_place", { query: "Neustadt", lat: 53.55, lon: 9.99, language: "en" });
    expect(textOf(r).split("\n").slice(1, 6).map((l) => /(\d+) km/u.exec(l)?.[1] + /Neustadt (\d)/u.exec(l)![1]!)).toEqual(["10", "492", "494", "963", "2341"]);
  });
});
