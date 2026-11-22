/**
 * What each tool answers, case by case: the body text in German and English (pinned as text files under
 * test/__snapshots__/handlers, reviewed like code), the operation asked with which query, the credit and the notes
 * in `_meta`, and the model-actionable errors. Every answer starts from the API contract's v0.3.0 example
 * (test/fixtures/api-openapi.json), changed only in the fields a case is about.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HttpResponse } from "msw";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { calls, exampleOf, handlerFor, mockServer, problem } from "./api-mock.js";
import { pinned } from "./pinned.js";
import { connect, textOf } from "./harness.js";
import { GAPS, lampText, nearestMotorways } from "../src/tools/handlers.js";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  calls.length = 0;
});
afterAll(() => mockServer.close());

type Body = { data: unknown; meta: Record<string, unknown> };
const LANGS = ["de", "en"] as const;
const at = { lat: 52.52, lon: 13.405 };

async function call(tool: string, args: Record<string, unknown>, o: Parameters<typeof connect>[0] = {}): Promise<CallToolResult> {
  const { client, close } = await connect(o);
  try {
    return (await client.callTool({ name: tool, arguments: args })) as CallToolResult;
  } finally {
    await close();
  }
}

/** The answer without its credit footer (the part after the last blank line). */
const body = (r: CallToolResult): string => {
  const t = textOf(r);
  const i = t.lastIndexOf("\n\n");
  return i < 0 ? t : t.slice(0, i);
};
const footer = (r: CallToolResult): string => textOf(r).slice(textOf(r).lastIndexOf("\n\n") + 2);

/** Answers `op` with its contract example, `data` replaced (and `meta` merged) where given. */
function serve(op: string, data?: unknown, meta: Record<string, unknown> = {}): void {
  mockServer.use(
    handlerFor(op, () => {
      const ex = exampleOf<Body>(op);
      return HttpResponse.json({ data: data === undefined ? ex.data : data, meta: { ...ex.meta, ...meta } });
    }),
  );
}
const ex = <T>(op: string): T => exampleOf<{ data: T; meta: Record<string, unknown> }>(op).data;
const ops = (): string[] => calls.map((c) => c.operationId);
const query = (op: string): Record<string, string>[] => calls.filter((c) => c.operationId === op).map((c) => Object.fromEntries(c.url.searchParams));
const paths = (op: string): string[] => calls.filter((c) => c.operationId === op).map((c) => c.url.pathname);
const meta = (r: CallToolResult) => r._meta as Record<string, unknown>;

type Sit = Record<string, unknown>;
const situation = (o: Sit = {}): Sit => ({ ...(ex<{ situations: Sit[] }>("getMotorwayConditions").situations[0] as Sit), ...o });
const roads = (situations: Sit[], lampReason = "narrowing"): Record<string, unknown> => ({ ...ex<object>("getMotorwayConditions"), lampReason, situations });
const rich = [
  situation({ road: "A1", directionText: "Richtung Köln", headline: "Stau", delayMin: 12, validity: { from: "2026-03-30T08:00:00Z", until: "2026-03-30T10:00:00Z" }, distanceM: 1800 }),
  situation({ road: null, headline: "Unfall", delayMin: null, distanceM: 400 }),
  situation({ road: "B 27", headline: "Baustelle" }),
];

describe("check_autobahn_traffic", () => {
  for (const language of LANGS) {
    it(`two roads (${language}): one read per road, each block headed by its road, situation details rendered`, async () => {
      serve("getMotorwayConditions", roads(rich));
      const r = await call("check_autobahn_traffic", { roads: ["A1", "A7"], kinds: ["warning"], limit: 2, cursor: "c1", language });
      expect(r.isError).toBeUndefined();
      expect(query("getMotorwayConditions")).toEqual([
        { kinds: "warning", limit: "2", cursor: "c1", lang: language },
        { kinds: "warning", limit: "2", cursor: "c1", lang: language },
      ]);
      expect(paths("getMotorwayConditions")).toEqual(["/v1/motorways/A1/conditions", "/v1/motorways/A7/conditions"]);
      await pinned("handlers", body(r));
      expect(meta(r)["nextCursor"]).toBeUndefined();
    });
  }

  it("asks five roads, refuses a sixth as the schema does; one road passes its next cursor on", async () => {
    serve("getMotorwayConditions", roads([]), { page: { limit: 20, hasMore: true, nextCursor: "next-1" } });
    const six = await call("check_autobahn_traffic", { roads: ["A1", "A2", "A3", "A4", "A5", "A6"], language: "en" });
    expect(textOf(six)).toBe("MCP error -32602: Input validation error: Invalid arguments for tool check_autobahn_traffic: Too big: expected array to have <=5 items at roads");
    expect(calls).toHaveLength(0);
    await call("check_autobahn_traffic", { roads: ["A1", "A2", "A3", "A4", "A5"], language: "en" });
    expect(paths("getMotorwayConditions")).toEqual(["A1", "A2", "A3", "A4", "A5"].map((r) => `/v1/motorways/${r}/conditions`));
    calls.length = 0;
    const one = await call("check_autobahn_traffic", { roads: ["A1"], language: "en" });
    expect(meta(one)["nextCursor"]).toBe("next-1");
    expect(body(one)).toBe("A1 — traffic light yellow: roadworks narrowing the carriageway.");
  });

  it("without a limit lists twenty situations", async () => {
    serve("getMotorwayConditions", roads(Array.from({ length: 25 }, (_, i) => situation({ headline: `S${i}` }))));
    const r = await call("check_autobahn_traffic", { roads: ["A1"], language: "en" });
    expect(body(r).split("\n").filter((l) => l.startsWith("- "))).toHaveLength(20);
    expect(body(r)).toContain("S19");
    expect(body(r)).not.toContain("S20");
  });

  it("a Land by its name: the state's motorway conditions, asked by its Land code", async () => {
    const r = await call("check_autobahn_traffic", { land: "saarland", kinds: ["roadworks"], limit: 1, language: "en" });
    expect(paths("listStateRoadConditions")).toEqual(["/v1/states/10/road-conditions"]);
    expect(query("listStateRoadConditions")).toEqual([{ kinds: "roadworks", road_class: "motorway", limit: "1", lang: "en" }]);
    expect(body(r)).toBe("traffic light yellow: traffic report.\n- A103: MaintenanceWorks");
  });

  it("a position: the motorway conditions around it, the radius in metres", async () => {
    const r = await call("check_autobahn_traffic", { ...at, radius_km: 3, language: "en" });
    expect(query("listRoadConditions")).toEqual([{ at: "52.52,13.405", radius_m: "3000", road_class: "motorway", lang: "en" }]);
    expect(body(r)).toBe("traffic light yellow: roadworks narrowing the carriageway.\n- A103: MaintenanceWorks · 500 m");
  });

  for (const language of LANGS) {
    it(`no road, no Land, no position (${language}): asks for a road or a Land in today's words, asks the API nothing`, async () => {
      const r = await call("check_autobahn_traffic", { language });
      expect(r).toEqual({
        content: [{ type: "text", text: language === "de" ? 'Bitte roads (Autobahnnummern, z. B. ["A9"]) oder land (ein Bundesland, z. B. "bayern") angeben. Hat die Person nichts davon genannt, bitte fragen, welche Autobahn oder welches Bundesland; für den Verkehr in einer Stadt check_road_status. Zum Beispiel {"roads": ["A9"]} oder {"land": "bayern"}.' : 'Give roads (motorway numbers, e.g. ["A9"]) or land (one Bundesland, e.g. "bayern"). If the person named neither, ask which motorway or which Land; for a town\'s own traffic use check_road_status. For example {"roads": ["A9"]} or {"land": "bayern"}.' }],
        isError: true,
        _meta: { errorCode: "invalid_input", errorReason: "place_missing" },
      });
      expect(calls).toHaveLength(0);
    });
  }
});

describe("check_road_status", () => {
  it("a motorway number in any spelling asks its conditions with the horizon", async () => {
    serve("getMotorwayConditions", roads(rich));
    const r = await call("check_road_status", { road: "a 1", horizon_days: 3, limit: 5, language: "en" });
    expect(paths("getMotorwayConditions")).toEqual(["/v1/motorways/A1/conditions"]);
    expect(query("getMotorwayConditions")).toEqual([{ horizon_days: "3", limit: "5", lang: "en" }]);
    await pinned("handlers", body(r));
  });

  it("another road at a position keeps only that road's situations", async () => {
    serve("listRoadConditions", roads(rich, "narrowing"));
    const r = await call("check_road_status", { ...at, road: "b27", horizon_days: 2, language: "en" });
    expect(query("listRoadConditions")).toEqual([{ at: "52.52,13.405", horizon_days: "2", lang: "en" }]);
    expect(body(r)).toBe("traffic light yellow: roadworks narrowing the carriageway.\n- B 27: Baustelle");
  });

  it("no road at a position keeps every situation", async () => {
    serve("listRoadConditions", roads(rich, "narrowing"));
    const r = await call("check_road_status", { ...at, language: "en" });
    expect(body(r).split("\n")).toHaveLength(4);
  });

  for (const language of LANGS) {
    it(`a lorry adds the lorry rules (${language}), ten at most`, async () => {
      const rule = (o: Record<string, unknown>) => ({ ...ex<Record<string, unknown>[]>("listLorryRules")[0], ...o });
      serve("listLorryRules", [
        rule({ road: "A1", street: "Hauptstraße", municipality: "Köln", publishedText: "Durchfahrt verboten", kind: "ban" }),
        rule({ road: null, kind: "weight", publishedText: null }),
        rule({}),
        ...Array.from({ length: 10 }, (_, i) => rule({ road: `A${i + 10}` })),
      ]);
      const r = await call("check_road_status", { road: "A1", vehicle: "lorry", language });
      expect(query("listLorryRules")).toEqual([{ vehicle: "lorry", road: "A1", lang: language }]);
      await pinned("handlers", body(r));
    });
  }

  it("a long lorry at a position passes the position to the lorry rules; none found adds nothing", async () => {
    serve("listLorryRules", []);
    const r = await call("check_road_status", { ...at, vehicle: "long_lorry", language: "en" });
    expect(query("listLorryRules")).toEqual([{ vehicle: "long_lorry", at: "52.52,13.405", lang: "en" }]);
    expect(body(r)).toBe(`${String(meta(r)["conditionNote"])}\ntraffic light yellow: roadworks narrowing the carriageway.\n- A103: MaintenanceWorks · 500 m`);
    expect(meta(r)["sources"]).toEqual(["dwd_eta", "roads_alpha", "lorry_bast_langlkw"]);
  });

  it("no vehicle asks no lorry rules", async () => {
    await call("check_road_status", { road: "A1", language: "en" });
    expect(ops()).toEqual(["getMotorwayConditions"]);
  });

  it("no road and no position: asks for a place", async () => {
    const r = await call("check_road_status", { road: "B27", language: "en" });
    expect(r.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe("find_roadworks_ahead", () => {
  it("a road: the roadworks of the next fortnight on it", async () => {
    const r = await call("find_roadworks_ahead", { road: "a 3", limit: 4, language: "en" });
    expect(paths("getMotorwayConditions")).toEqual(["/v1/motorways/A3/conditions"]);
    expect(query("getMotorwayConditions")).toEqual([{ kinds: "roadworks", horizon_days: "14", limit: "4", lang: "en" }]);
    expect(body(r)).toBe("traffic light yellow: DWD warning.\n- A101: GeneralObstruction\n- A101: GeneralObstruction");
  });

  for (const key of ["place"]) {
    it(`a place (${key}): the roadworks around the resolved place`, async () => {
      const r = await call("find_roadworks_ahead", { [key]: "Köln", language: "en" });
      expect(ops()).toEqual(["listPlaces", "listRoadConditions"]);
      expect(query("listPlaces")).toEqual([{ q: "Köln", limit: "1", lang: "en" }]);
      expect(query("listRoadConditions")).toEqual([{ at: "48.24375,7.01625", kinds: "roadworks", horizon_days: "14", lang: "en" }]);
      expect(body(r)).toBe("traffic light yellow: roadworks narrowing the carriageway.\n- A103: MaintenanceWorks · 500 m");
    });
  }

  for (const language of LANGS) {
    it(`an unknown place (${language}) is named back`, async () => {
      serve("listPlaces", []);
      const r = await call("find_roadworks_ahead", { place: "Nirgendwo", language });
      expect(r).toEqual({
        content: [{ type: "text", text: language === "de" ? "„Nirgendwo“ habe ich als Ort nicht gefunden." : 'I could not find "Nirgendwo" as a place.' }],
        isError: true,
        _meta: { errorCode: "not_found" },
      });
    });
  }
});

describe("fuel", () => {
  const station = (o: Record<string, unknown>) => ({ ...ex<Record<string, unknown>[]>("listFuelOptions")[0], ...o });
  const stations = [
    station({ name: "Aral Mitte", brand: "Aral", distanceM: 1234, prices: [{ fuel: "e10", priceEur: 1.699, reportedAt: "2026-03-30T00:00:00Z", current: true }, { fuel: "diesel", priceEur: 1.589, reportedAt: "2026-03-30T00:00:00Z", current: true }] }),
    station({ name: "Freie Tankstelle", brand: null, distanceM: 640.4, openingState: "closed", prices: [] }),
  ];

  for (const language of LANGS) {
    it(`find_cheapest_fuel (${language}): e10 by price unless asked otherwise, only the asked fuel's price`, async () => {
      serve("listFuelOptions", stations);
      const r = await call("find_cheapest_fuel", { ...at, language });
      expect(query("listFuelOptions")).toEqual([{ at: "52.52,13.405", fuel: "e10", sort: "price", lang: language }]);
      await pinned("handlers", body(r));
      expect(meta(r)["purposeNote"]).toBe("For consumer information only (synthetic).");
      expect(textOf(r).startsWith("For consumer information only (synthetic).\n")).toBe(true);
    });
  }

  it("find_fuel_station: by distance, every fuel's price; each filter passed on", async () => {
    serve("listFuelOptions", stations);
    const r = await call("find_fuel_station", { ...at, radius_km: 3, brand: "Aral", name: "Mitte", open_now: true, open_at: "2026-03-30T08:00", whole_day: false, sort: "price", limit: 2, language: "en" });
    expect(query("listFuelOptions")).toEqual([{ at: "52.52,13.405", radius_m: "3000", brand: "Aral", name: "Mitte", open_now: "true", open_at: "2026-03-30T08:00", whole_day: "false", sort: "price", limit: "2", lang: "en" }]);
    expect(body(r).split("\n").slice(1)).toEqual(["- Aral Mitte (Aral) · 1.2 km · E10 1.699 €, DIESEL 1.589 €", "- Freie Tankstelle · 640 m · – · closed"]);
  });

  it("find_fuel_station without a sort sorts by distance", async () => {
    await call("find_fuel_station", { ...at, fuel: "diesel", language: "en" });
    expect(query("listFuelOptions")).toEqual([{ at: "52.52,13.405", fuel: "diesel", sort: "distance", lang: "en" }]);
  });

  for (const language of LANGS) {
    it(`no station (${language}) says so`, async () => {
      serve("listFuelOptions", []);
      const r = await call("find_cheapest_fuel", { ...at, language });
      expect(body(r).split("\n").at(-1)).toBe(language === "de" ? "Keine Tankstellen gefunden." : "No filling stations found.");
    });
  }
});

describe("find_charging_station", () => {
  const site = (o: Record<string, unknown>, summary: Record<string, unknown>) => ({ ...ex<Record<string, unknown>[]>("listChargingOptions")[0], ...o, summary });
  for (const language of LANGS) {
    it(`renders points, power and free points (${language}); passes every filter`, async () => {
      serve("listChargingOptions", [
        site({ name: "Laden Mitte", distanceM: 2985 }, { chargePoints: 3, availableNow: 1, maxPowerKw: 150 }),
        site({ name: null, operator: "Strom AG" }, { chargePoints: 2, availableNow: null, maxPowerKw: null }),
        site({ name: null, operator: null, id: "cs-9" }, { chargePoints: 1, availableNow: 0, maxPowerKw: 22 }),
      ]);
      const r = await call("find_charging_station", { ...at, radius_km: 1, connector: "ccs2", min_power_kw: 50, max_power_kw: 350, operator: "Strom AG", conditions: ["free", "open247"], only_available: true, limit: 3, language });
      expect(query("listChargingOptions")).toEqual([{ at: "52.52,13.405", radius_m: "1000", connector: "ccs2", min_kw: "50", max_kw: "350", operator: "Strom AG", conditions: "free,open247", only_available: "true", limit: "3", lang: language }]);
      await pinned("handlers", body(r));
    });
    it(`none found (${language})`, async () => {
      serve("listChargingOptions", []);
      expect(body(await call("find_charging_station", { ...at, language }))).toBe(language === "de" ? "Keine Ladestationen gefunden." : "No charging stations found.");
    });
  }
});

describe("find_hydrogen_station", () => {
  const h2 = (o: Record<string, unknown>) => ({ ...ex<{ stations: Record<string, unknown>[] }>("listHydrogenOptions").stations[0], ...o });
  it("lists the stations in the radius, named by name, operator, brand or H2", async () => {
    serve("listHydrogenOptions", { stations: [h2({}), h2({ name: null, operator: "H2 Mobility" }), h2({ name: null, operator: null, brand: "Shell" }), h2({ name: null, operator: null, brand: null, distanceM: 950 })], nearest: null });
    const r = await call("find_hydrogen_station", { ...at, radius_km: 100, vehicle: "car", limit: 4, language: "de" });
    expect(query("listHydrogenOptions")).toEqual([{ at: "52.52,13.405", radius_m: "100000", vehicle: "car", limit: "4", lang: "de" }]);
    expect(body(r)).toBe("- H2 Schömpingbach · 62,4 km\n- H2 Mobility · 62,4 km\n- Shell · 62,4 km\n- H2 · 950 m");
  });
  it("none in the radius: the nearest one", async () => {
    serve("listHydrogenOptions", { stations: [], nearest: h2({ name: "H2 Fern", distanceM: 120_000 }) });
    expect(body(await call("find_hydrogen_station", { ...at, language: "en" }))).toBe("- H2 Fern · 120.0 km");
  });
  for (const language of LANGS) {
    it(`none at all (${language})`, async () => {
      serve("listHydrogenOptions", { stations: [], nearest: null });
      expect(body(await call("find_hydrogen_station", { ...at, language }))).toBe(language === "de" ? "Keine Wasserstofftankstellen gefunden." : "No hydrogen stations found.");
    });
  }
});

describe("find_parking", () => {
  const park = (o: Record<string, unknown>) => ({ ...ex<Record<string, unknown>[]>("listParkingOptions")[0], ...o });
  const sites = [
    park({}),
    park({ name: null, operator: "Parkraum GmbH", kind: "garage", distanceM: null, occupancy: { free: 5, total: null } }),
    park({ name: null, operator: null, id: "p:3", kind: "street", distanceM: 80, occupancy: null }),
    park({ name: "Nur Zahl", occupancy: { free: null, total: 40 } }),
  ];
  for (const language of LANGS) {
    it(`renders kind, distance and free spaces (${language})`, async () => {
      serve("listParkingOptions", sites);
      const r = await call("find_parking", { ...at, radius_km: 1, kind: "car_park", only_with_free_spaces: true, facilities: ["charging"], limit: 4, language });
      expect(query("listParkingOptions")).toEqual([{ at: "52.52,13.405", radius_m: "1000", kind: "car_park", free_min: "1", facilities: "charging", limit: "4", lang: language }]);
      await pinned("handlers", body(r));
      expect(meta(r)["conditionNote"]).toBeUndefined();
    });
  }

  it("a motorway: its parking, any kind, free spaces not required", async () => {
    const r = await call("find_parking", { road: "a 7", kind: "any", only_with_free_spaces: false, language: "en" });
    expect(paths("listMotorwayParking")).toEqual(["/v1/motorways/A7/parking-options"]);
    expect(query("listMotorwayParking")).toEqual([{ lang: "en" }]);
    expect(body(r)).toBe("- Stunsaltal Parken (rest_area) · 32 free of 229");
  });

  for (const language of LANGS) {
    it(`a disabled-badge space is not available (${language}) and nothing is asked`, async () => {
      const r = await call("find_parking", { ...at, kind: "disabled_badge", language });
      expect(textOf(r)).toBe(language === "de" ? "Diese Auskunft ist über die ViaFrei-API derzeit nicht verfügbar. (kind=disabled_badge)" : "This answer is not available through the ViaFrei API yet. (kind=disabled_badge)");
      expect(r.isError).toBe(true);
      expect(calls).toHaveLength(0);
    });
    it(`none found (${language})`, async () => {
      serve("listParkingOptions", []);
      expect(body(await call("find_parking", { ...at, language }))).toBe(language === "de" ? "Keine Parkplätze gefunden." : "No car parks found.");
    });
  }

  it("no place: asks for one", async () => {
    expect((await call("find_parking", { language: "en" })).isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  const terms = [
    { parameter: "accept_terms", accept: "sid-1", id: "sid", version: "1", inForceFrom: "2026-04-10", providerTerms: "https://viafrei.de/terms#sid", texts: [] },
    { parameter: "accept_terms", accept: "sid-2", id: "sid2", version: "1", inForceFrom: "2026-04-10", providerTerms: "https://viafrei.de/terms#sid", texts: [] },
  ];
  for (const language of LANGS) {
    it(`accepted SID terms (${language}): every accept token passed, the condition note shown verbatim`, async () => {
      serve("listMotorwayParking", undefined, { terms });
      const r = await call("find_parking", { road: "A7", language }, { elicit: () => ({ action: "accept", content: { accept: true } }) });
      expect(query("listMotorwayParking")).toEqual([{ lang: language }, { accept_terms: "sid-1,sid-2", lang: language }]);
      const note = language === "de" ? "Lkw-Stellplatzbelegung: Toll Collect GmbH" : "Truck-parking occupancy: Toll Collect GmbH";
      expect(String(meta(r)["conditionNote"]).startsWith(note)).toBe(true);
      expect(textOf(r).startsWith(note)).toBe(true);
    });
  }

  it("a question left unanswered: the first answer, no acceptance, no note", async () => {
    serve("listMotorwayParking", undefined, { terms });
    const r = await call("find_parking", { road: "A7", language: "en" }, { elicit: () => ({ action: "cancel" }) });
    expect(query("listMotorwayParking")).toEqual([{ lang: "en" }]);
    expect(meta(r)["conditionNote"]).toBeUndefined();
  });

  it("no terms in the answer: nobody is asked", async () => {
    let asked = 0;
    await call("find_parking", { road: "A7", language: "en" }, { elicit: () => (asked++, { action: "accept", content: { accept: true } }) });
    expect(asked).toBe(0);
    expect(ops()).toEqual(["listMotorwayParking"]);
  });
});

describe("find_speed_cameras", () => {
  const cam = (o: Record<string, unknown>) => ({ ...ex<{ osm: Record<string, unknown>[] }>("listSpeedCameras").osm[0], ...o });
  it("official cameras first, then OSM; located by street and town, label or id", async () => {
    serve("listSpeedCameras", {
      official: [cam({ street: "Ringstraße", municipality: "Köln", kind: "mobile", limitKmh: 30 })],
      officialTotal: 1,
      osm: [cam({ street: "Allee", municipality: null }), cam({ locationLabel: null, id: "osm:1", limitKmh: null })],
      osmTotal: 2,
    });
    const r = await call("find_speed_cameras", { ...at, radius_km: 2, limit: 3, language: "en" });
    expect(query("listSpeedCameras")).toEqual([{ at: "52.52,13.405", radius_m: "2000", limit: "3", lang: "en" }]);
    expect(body(r)).toBe(`${String(meta(r)["conditionNote"])}\n- Ringstraße, Köln (mobile) · 30 km/h\n- Allee (fixed) · 50 km/h\n- osm:1 (fixed)`);
    expect(String(meta(r)["conditionNote"])).toMatch(/^Note on use \(§ 23 Abs\. 1c StVO\)/);
  });
  for (const language of LANGS) {
    it(`none (${language})`, async () => {
      serve("listSpeedCameras", { official: [], officialTotal: 0, osm: [], osmTotal: 0 });
      expect(body(await call("find_speed_cameras", { ...at, language })).split("\n").at(-1)).toBe(language === "de" ? "Keine Blitzer gefunden." : "No speed cameras found.");
    });
  }
});

describe("find_place, find_poi, find_address", () => {
  it("find_place maps the catalogue's kind to the contract's and lists coordinates to five places", async () => {
    serve("listPlaces", [{ ...ex<object[]>("listPlaces")[0], name: "Köln", kind: "municipality", location: { lat: 50.9375123, lon: 6.9602789 } }]);
    const r = await call("find_place", { query: "Köln", kind: "city", radius_km: 10, limit: 3, language: "en" });
    expect(query("listPlaces")).toEqual([{ q: "Köln", kind: "municipality", radius_m: "10000", limit: "3", lang: "en" }]);
    expect(body(r)).toBe("- Köln (municipality) · 50.93751, 6.96028");
  });

  for (const [kind, contract] of [["district", "district"], ["admin", "region"], ["station", "station_area"], ["stop", "station_area"]]) {
    it(`find_place kind=${kind} asks kind=${contract}`, async () => {
      await call("find_place", { query: "Xy", kind, language: "en" });
      expect(query("listPlaces")[0]!["kind"]).toBe(contract);
    });
  }

  it("find_place near a named place resolves it first; near a position passes it", async () => {
    await call("find_place", { query: "Neustadt", near: "Hamburg", language: "en" });
    expect(query("listPlaces")).toEqual([{ q: "Hamburg", limit: "1", lang: "en" }, { q: "Neustadt", at: "48.24375,7.01625", lang: "en" }]);
    calls.length = 0;
    await call("find_place", { query: "Neustadt", ...at, language: "en" });
    expect(query("listPlaces")).toEqual([{ q: "Neustadt", at: "52.52,13.405", lang: "en" }]);
  });

  it("find_place near an unknown place says so", async () => {
    serve("listPlaces", []);
    const r = await call("find_place", { query: "Neustadt", near: "Nirgendwo", language: "en" });
    expect(textOf(r)).toBe('I do not know the place "Nirgendwo". Please be more specific or give coordinates.');
  });

  for (const language of LANGS) {
    it(`find_place and find_poi with nothing found (${language})`, async () => {
      serve("listPlaces", []);
      serve("listPois", []);
      const want = language === "de" ? "Keine Orte gefunden." : "No places found.";
      expect(body(await call("find_place", { query: "Xy", language }))).toBe(want);
      expect(body(await call("find_poi", { name: "Xy", language }))).toBe(want);
    });
  }

  it("find_poi: name, kind or category; street and town; distance; the next cursor; every filter passed", async () => {
    const poi = (o: Record<string, unknown>) => ({ ...ex<Record<string, unknown>[]>("listPois")[0], ...o });
    serve("listPois", [poi({}), poi({ name: null, number: null, postcode: null, distanceM: null }), poi({ name: null, kind: null, street: null, place: null, distanceM: 1800 })], { page: { limit: 3, hasMore: true, nextCursor: "poi-2" } });
    const r = await call("find_poi", { name: "Apotheke", in: "Köln", ...at, radius_km: 2, category: "amenity", limit: 3, cursor: "poi-1", language: "de" });
    expect(query("listPois")).toEqual([{ name: "Apotheke", in: "Köln", at: "52.52,13.405", radius_m: "2000", category: "amenity", limit: "3", cursor: "poi-1", lang: "de" }]);
    expect(body(r)).toBe("- Pharmacy Pößfül · Marktweg 1, 10001 Kansilkamp · 208 m\n- pharmacy · Marktweg, Kansilkamp\n- amenity · 1, 10001 · 1,8 km");
    expect(meta(r)["nextCursor"]).toBe("poi-2");
  });

  it("find_poi near a named place resolves it", async () => {
    await call("find_poi", { name: "Apotheke", near: "Köln", language: "en" });
    expect(ops()).toEqual(["listPlaces", "listPois"]);
    expect(query("listPois")[0]!["at"]).toBe("48.24375,7.01625");
  });

  it("find_poi near an unknown place says so", async () => {
    serve("listPlaces", []);
    expect((await call("find_poi", { name: "Apotheke", near: "Nirgendwo", language: "en" })).isError).toBe(true);
    expect(ops()).toEqual(["listPlaces"]);
  });

  it("find_address: street and number, postcode and town, coordinate", async () => {
    const a = ex<{ addresses: Record<string, unknown>[] }>("listAddresses").addresses[0]!;
    serve("listAddresses", { addresses: [a, { ...a, number: null, postcode: null, location: { lat: 1.234567, lon: 2.5 } }] });
    const r = await call("find_address", { query: "Marktweg 1", limit: 2, language: "en" });
    expect(query("listAddresses")).toEqual([{ q: "Marktweg 1", limit: "2", lang: "en" }]);
    expect(body(r)).toBe("- Marktweg 1, 20000 Kansilkamp · 47.60983, 7.89724\n- Marktweg, Kansilkamp · 1.23457, 2.50000");
  });

  for (const language of LANGS) {
    it(`find_address with nothing found (${language})`, async () => {
      serve("listAddresses", { addresses: [] });
      expect(body(await call("find_address", { query: "Xyz", language }))).toBe(language === "de" ? "Keine Adressen gefunden." : "No addresses found.");
    });
  }
});

describe("describe_location", () => {
  const loc = (o: Record<string, unknown>) => ({ ...ex<object>("describeLocation"), ...o });
  const lez = { verdict: "outside", zone: "Köln", distanceM: 2000 };
  for (const language of LANGS) {
    for (const [name, zone] of [
      ["inside", { ...lez, verdict: "inside" }],
      ["transfer", { ...lez, verdict: "transfer" }],
      ["outside", lez],
      ["outside, no distance", { ...lez, distanceM: null }],
    ] as const) {
      it(`municipality, district, Land and the low-emission zone ${name} (${language})`, async () => {
        serve("describeLocation", loc({ municipality: { name: "Köln" }, district: { name: "Köln, Stadt" }, lowEmissionZone: zone }));
        const r = await call("describe_location", { ...at, language });
        expect(query("describeLocation")).toEqual([{ at: "52.52,13.405", lang: language }]);
        await pinned("handlers", body(r));
      });
    }
    it(`nothing known (${language})`, async () => {
      serve("describeLocation", loc({ state: null, lowEmissionZone: { verdict: "unknown", zone: "X", distanceM: null } }));
      expect(body(await call("describe_location", { ...at, language }))).toBe(language === "de" ? "Zu dieser Position ist nichts bekannt." : "Nothing is known about this position.");
    });
    it(`without lon (${language}): the schema's refusal, as today's server words it`, async () => {
      const r = await call("describe_location", { lat: 52.5, language });
      expect(r.isError).toBe(true);
      expect(textOf(r)).toBe("MCP error -32602: Input validation error: Invalid arguments for tool describe_location: Invalid input: expected number, received undefined at lon");
      expect(calls).toHaveLength(0);
    });
  }
  it("a zone without a name and a named nothing are left out", async () => {
    serve("describeLocation", loc({ municipality: { name: null }, district: null, lowEmissionZone: { verdict: "inside", zone: null, distanceM: null } }));
    expect(body(await call("describe_location", { lon: 13.4, lat: 52.5, language: "en" }))).toBe("Matfienland");
  });
});

describe("find_nearby and find_sharing", () => {
  it("find_nearby: a block per need, five places at most, the street and number where known", async () => {
    const p = (name: string, street: string | null, houseNo: string | null, distanceM = 120) => ({ name, kind: "shop", street, houseNo, location: at, distanceM, sourceFamily: "osm" });
    serve("listNearby", { needs: [{ need: "groceries", radiusM: 5000, widened: false, places: [p("A", "Weg", "2"), p("B", "Weg", null), p("C", null, "9", 2000), p("D", null, null), p("E", null, null), p("F", null, null)] }, { need: "food", radiusM: 5000, widened: true, places: [] }] });
    const r = await call("find_nearby", { ...at, radius_km: 5, categories: ["groceries", "food"], language: "de" });
    expect(query("listNearby")).toEqual([{ at: "52.52,13.405", radius_m: "5000", categories: "groceries,food", lang: "de" }]);
    expect(body(r)).toBe("groceries:\n- A, Weg 2 · 120 m\n- B, Weg · 120 m\n- C · 2,0 km\n- D · 120 m\n- E · 120 m\n\nfood:\n- –");
  });

  it("find_nearby without categories: the API's default vehicle categories, each a block, three at most, in the fixed order fuel, charging, parking, stations, junctions", async () => {
    const fuel = (name: string | null, brand: string | null, distanceM: number, current = true) => ({ id: "f", name, brand, location: at, distanceM, prices: [{ fuel: "e5", priceEur: 1.789, reportedAt: "2026-11-18T10:00:00Z", reportedAtLocal: "2026-11-18T11:00:00+01:00", current }], sourceFamily: "tk" });
    const charging = { id: "c", name: null, operator: "EnBW", location: at, distanceM: 1800, access: "public", summary: { chargePoints: 4, availableNow: null, maxPowerKw: 150 } };
    const parking = { id: "p", name: "P1", operator: null, kind: "car_park", location: at, distanceM: null, occupancy: null, termsRequired: false, sourceFamily: "p" };
    const station = { id: "s", name: "Musterstadt Hbf", location: at, stopCode: null, eva: null, evaNumbers: [], districtCode: null, modes: [], distanceM: 800, sourceFamily: "s" };
    const junction = (road: string | null, number: string | null) => ({ id: "j", name: "Musterstadt-Nord", road, number, location: at, distanceM: 3000, sourceFamily: "r" });
    serve("listNearby", { fuel: [fuel("Tank A", null, 300), fuel(null, "Brand B", 400, false), fuel(null, null, 500), fuel("Fourth", null, 600)], charging: [charging], parking: [parking], stations: [station], junctions: [junction("A101", "12"), junction("A101", null), junction(null, null)] });
    const r = await call("find_nearby", { ...at, language: "en" });
    expect(query("listNearby")).toEqual([{ at: "52.52,13.405", lang: "en" }]);
    expect(body(r)).toBe(
      "Fuel:\n- Tank A · E5 1.789 € · 300 m\n- Brand B · E5 1.789 € (not current, reported 18/11/2026, 11:00) · 400 m\n- – · E5 1.789 € · 500 m\n\nCharging:\n- EnBW · 150 kW · 1.8 km\n\nParking:\n- P1\n\nStations:\n- Musterstadt Hbf · 800 m\n\n" +
        "Motorway junctions:\n- Musterstadt-Nord (A101 12) · 3.0 km\n- Musterstadt-Nord (A101) · 3.0 km\n- Musterstadt-Nord · 3.0 km",
    );
    serve("listNearby", { fuel: [fuel(null, "Marke", 400, false)], stations: [station] });
    expect(body(await call("find_nearby", { ...at, language: "de" }))).toBe("Tankstellen:\n- Marke · E5 1,789 € (nicht aktuell, gemeldet 18.11.2026, 11:00) · 400 m\n\nBahnhöfe:\n- Musterstadt Hbf · 800 m");
  });

  // NearbyMeta.parts: a category that is not ok is absent from data; the answer names it with its status.
  const parts = (s: Record<string, string>) => ({ parts: Object.entries(s).map(([part, status]) => ({ part, status })) });
  it("find_nearby: a category that is not ok is said per status, after the blocks that answered", async () => {
    const station = { id: "s", name: "Musterstadt Hbf", location: at, stopCode: null, eva: null, evaNumbers: [], districtCode: null, modes: [], distanceM: 800, sourceFamily: "s" };
    serve("listNearby", { fuel: [], stations: [station] }, parts({ fuel: "ok", charging: "timeout", parking: "unavailable", station: "ok", junction: "not_permitted", needs: "not_requested" }));
    expect(body(await call("find_nearby", { ...at, language: "en" }))).toBe(
      "Fuel:\n- –\n\nStations:\n- Musterstadt Hbf · 800 m\n\nCharging: did not answer in time – please ask again shortly.\nParking: not available right now.\nMotorway junctions: not included in this access.",
    );
    serve("listNearby", { fuel: [] }, parts({ fuel: "ok", charging: "unavailable", parking: "timeout", station: "not_permitted", junction: "unavailable", needs: "timeout" }));
    expect(body(await call("find_nearby", { ...at, language: "de" }))).toBe(
      "Tankstellen:\n- –\n\nLaden: gerade nicht verfügbar.\nParken: hat nicht rechtzeitig geantwortet – bitte gleich noch einmal fragen.\nBahnhöfe: mit diesem Zugang nicht freigegeben.\nAutobahn-Anschlussstellen: gerade nicht verfügbar.\nOrte des Alltags: hat nicht rechtzeitig geantwortet – bitte gleich noch einmal fragen.",
    );
  });

  it("find_nearby: every part failed is not 'nothing is known'; only all ok or not asked is", async () => {
    serve("listNearby", {}, parts({ fuel: "timeout", charging: "unavailable", parking: "not_permitted", station: "timeout", junction: "unavailable", needs: "not_requested" }));
    const failed = body(await call("find_nearby", { ...at, language: "en" }));
    expect(failed).toBe(
      "Fuel: did not answer in time – please ask again shortly.\nCharging: not available right now.\nParking: not included in this access.\nStations: did not answer in time – please ask again shortly.\nMotorway junctions: not available right now.",
    );
    expect(failed).not.toContain("Nothing is known");
    serve("listNearby", {}, parts({ fuel: "ok", charging: "ok", parking: "ok", station: "ok", junction: "ok", needs: "not_requested" }));
    expect(body(await call("find_nearby", { ...at, language: "de" }))).toBe("In diesem Umkreis ist nichts bekannt.");
    serve("listNearby", {}, parts({ fuel: "ok", charging: "ok", parking: "ok", station: "ok", junction: "ok", needs: "not_requested" }));
    expect(body(await call("find_nearby", { ...at, language: "en" }))).toBe("Nothing is known within this radius.");
  });

  for (const language of LANGS) {
    it(`find_sharing (${language}): stations by name, system label or system, bikes, free vehicles`, async () => {
      const s = { name: "Station 1", systemLabel: "Nextbike", system: "nextbike_de", distanceM: 300, bikes: 4, freeDocks: 2, available: true };
      serve("listSharingOptions", { stations: [s, { ...s, name: null, bikes: null }, { ...s, name: null, systemLabel: null, distanceM: 1234 }], stationsInRadius: 3, vehicles: { count: 7, electric: 2, atLeast: false, nearest: [] } });
      const r = await call("find_sharing", { ...at, radius_km: 1, limit: 3, only_available: false, language });
      expect(query("listSharingOptions")).toEqual([{ at: "52.52,13.405", radius_m: "1000", limit: "3", only_available: "false", lang: language }]);
      await pinned("handlers", body(r));
    });
  }

  it("find_sharing without the availability filter does not send it", async () => {
    await call("find_sharing", { ...at, language: "en" });
    expect(query("listSharingOptions")).toEqual([{ at: "52.52,13.405", lang: "en" }]);
  });
});

describe("get_driving_rules", () => {
  const rule = (id: string, o: Record<string, unknown> = {}): Record<string, unknown> => ({ id, text: `Text ${id}.`, legalBasis: `§ ${id} StVO`, sourceUrl: `https://alpha.example/${id}`, reviewedOn: "2026-09-19", unconfirmed: null, ...o });
  const rulesOf = (topic: string, rules: Record<string, unknown>[], o: Record<string, unknown> = {}): Record<string, unknown> => ({ topic, title: `Titel ${topic}`, rules, reviewedOn: "2026-09-01", disclaimer: "Informational, not legal advice.", ...o });
  /** Answers each topic with its own rules: `topic.1`, `topic.2`. */
  const serveByTopic = (extra: (topic: string) => Record<string, unknown> = () => ({})): void => {
    mockServer.use(handlerFor("getDrivingRules", (url) => {
      const t = url.searchParams.get("topic") ?? "";
      return HttpResponse.json({ data: rulesOf(t, [rule(`${t}.1`, { reviewedOn: t === "toll" ? "2026-08-30" : "2026-09-19" }), rule(`${t}.2`)], extra(t)), meta: exampleOf<Body>("getDrivingRules").meta });
    }));
  };

  for (const language of LANGS) {
    it(`a topic: its headline, one bullet per rule with its citation and its open doubt, the review date as the Stand, the disclaimer last (${language})`, async () => {
      serve("getDrivingRules", rulesOf("winter", [rule("winter.a"), rule("winter.b", { legalBasis: null, unconfirmed: language === "de" ? "die Frist" : "the deadline", reviewedOn: "2026-09-02" })], { title: language === "de" ? "Winterreifen" : "Winter tyres" }));
      const r = await call("get_driving_rules", { topic: "winter", language });
      expect(query("getDrivingRules")).toEqual([{ topic: "winter", lang: language }]);
      expect(body(r)).toBe(language === "de"
        ? "Regeln in Deutschland — Winterreifen:\n• Text winter.a. (§ winter.a StVO)\n• Text winter.b. (nicht bestätigt: die Frist — bitte an der Quelle nachlesen)"
        : "Driving in Germany — Winter tyres:\n• Text winter.a. (§ winter.a StVO)\n• Text winter.b. (not confirmed: the deadline — check the source)");
      expect(footer(r).endsWith(language === "de"
        ? " · Stand 02.09.2026\nGeprüft am 02.09.2026 · Informativ, keine Rechtsberatung (informational, not legal advice)."
        : " · As of 2026-09-02\nReviewed 2026-09-02 · Informational, not legal advice.")).toBe(true);
      const sc = r.structuredContent as Record<string, unknown>;
      expect(sc["asOf"]).toBe("2026-09-02T00:00:00.000Z");
      expect({ ...sc, asOf: undefined, attribution: undefined, license: undefined }).toEqual({
        topic: "winter", city: null, language, reviewedAt: "2026-09-02", omittedLines: 0,
        facts: [
          { key: "winter.a", topic: "winter", text: "Text winter.a.", source: "https://alpha.example/winter.a", sourceName: "§ winter.a StVO", lastReviewed: "2026-09-19" },
          { key: "winter.b", topic: "winter", text: "Text winter.b.", source: "https://alpha.example/winter.b", sourceName: null, lastReviewed: "2026-09-02", toVerify: language === "de" ? "die Frist" : "the deadline" },
        ],
        lines: [
          { key: "winter.a", text: "• Text winter.a. (§ winter.a StVO)" },
          { key: "winter.b", text: language === "de" ? "• Text winter.b. (nicht bestätigt: die Frist — bitte an der Quelle nachlesen)" : "• Text winter.b. (not confirmed: the deadline — check the source)" },
        ],
        toVerify: [{ key: "winter.b", note: language === "de" ? "die Frist" : "the deadline" }],
        disclaimer: language === "de" ? "Geprüft am 02.09.2026 · Informativ, keine Rechtsberatung (informational, not legal advice)." : "Reviewed 2026-09-02 · Informational, not legal advice.",
        asOf: undefined, attribution: undefined, license: undefined,
      });
    });
  }

  it("no topic: the first rule of each of the nine topics under its title, in order, the oldest review of them; the city goes to the zone topic only", async () => {
    serveByTopic((t) => (t === "lez" ? { zoneCity: { name: "Köln", zone: "Zone im Autobahnring.", plakette: "green", covered: true } } : {}));
    const r = await call("get_driving_rules", { city: "Köln", language: "de" });
    expect(query("getDrivingRules")).toEqual(["lez", "speed", "winter", "alcohol", "toll", "truck_ban", "equipment", "emergency", "ev"].map((t) => (t === "lez" ? { topic: t, city: "Köln", lang: "de" } : { topic: t, lang: "de" })));
    const lines = body(r).split("\n");
    expect(lines[0]).toBe("Autofahren in Deutschland — das Wichtigste in neun Themen (topic=… für Details):");
    expect(lines[1]).toBe("• Köln: Zone im Autobahnring. Erforderlich: die grüne Plakette (Schadstoffgruppe 4). Sie gibt es bei Zulassungsstellen, TÜV/DEKRA/GTÜ/KÜS und anerkannten Werkstätten gegen Vorlage der Zulassungsbescheinigung Teil I.");
    expect(lines[2]).toBe('• Titel lez (topic="lez"): Text lez.1. (§ lez.1 StVO)');
    expect(lines[10]).toBe('• Titel ev (topic="ev"): Text ev.1. (§ ev.1 StVO)');
    expect(lines).toHaveLength(11);
    expect((r.structuredContent as { reviewedAt: string }).reviewedAt).toBe("2026-08-30");
  });

  it("more than eleven lines: eleven are kept, and the last line names how many were left and the narrower call", async () => {
    serve("getDrivingRules", rulesOf("speed", Array.from({ length: 13 }, (_, i) => rule(`speed.r${i + 1}`))));
    const r = await call("get_driving_rules", { topic: "speed", language: "en" });
    const lines = body(r).split("\n");
    expect(lines).toHaveLength(13);
    expect(lines[11]).toBe("• Text speed.r11. (§ speed.r11 StVO)");
    expect(lines[12]).toBe('… and 2 more rules on this topic — ask again with city="…" for the rest.');
    expect((r.structuredContent as { omittedLines: number }).omittedLines).toBe(2);
  });

  for (const language of LANGS) {
    it(`the zone topic with a city: the list's entry leads, the list caveat closes (${language})`, async () => {
      serve("getDrivingRules", rulesOf("lez", [rule("lez.1")], { zoneCity: { name: "Stuttgart", zone: "Ganzes Stadtgebiet.", plakette: "green", covered: true } }));
      const r = await call("get_driving_rules", { topic: "lez", city: "Stuttgart", language });
      expect(body(r).split("\n")).toEqual(language === "de" ? [
        "Umweltzone Stuttgart: Ja, Sie brauchen die grüne Feinstaubplakette.",
        "• Stuttgart: Ganzes Stadtgebiet. Erforderlich: die grüne Plakette (Schadstoffgruppe 4). Sie gibt es bei Zulassungsstellen, TÜV/DEKRA/GTÜ/KÜS und anerkannten Werkstätten gegen Vorlage der Zulassungsbescheinigung Teil I.",
        "• Text lez.1. (§ lez.1 StVO)",
        "• Diese Liste ist unsere Abschrift der Liste des Umweltbundesamts, nicht das amtliche Verzeichnis: Fehlt eine Stadt hier, heißt das nicht, dass sie keine Umweltzone hat. Die maßgebliche Liste führt das Umweltbundesamt.",
      ] : [
        "Low-emission zone Stuttgart: yes, you need the green Feinstaubplakette.",
        "• Stuttgart: Ganzes Stadtgebiet. Required: the green plaque (emission group 4). You can buy it at vehicle registration offices, TÜV/DEKRA/GTÜ/KÜS and approved garages on presentation of the vehicle registration document (part I).",
        "• Text lez.1. (§ lez.1 StVO)",
        "• This list is our copy of the Umweltbundesamt's list, not the official register: a city missing here is not a city without a zone. The authoritative list is kept by the Umweltbundesamt.",
      ]);
    });
  }

  it("a city under a closed licence: there is a zone, we may not say where; a city with no entry: no entry is not no zone", async () => {
    serve("getDrivingRules", rulesOf("lez", [rule("lez.1")], { zoneCity: { name: "Düsseldorf", zone: "Düsseldorf hat eine Umweltzone.", plakette: null, covered: false } }));
    const closed = body(await call("get_driving_rules", { topic: "lez", city: "Düsseldorf", language: "de" })).split("\n");
    expect(closed[0]).toBe("Umweltzone Düsseldorf: von uns nicht abgedeckt (geschlossene Lizenz) — es gibt dort eine Zone, also nicht ohne grüne Plakette hineinfahren.");
    expect(closed[1]).toBe("• Düsseldorf: Düsseldorf hat eine Umweltzone. Die Zonendaten für Düsseldorf stehen unter einer geschlossenen Lizenz, die uns die Weitergabe verbietet. Das heißt ausdrücklich nicht, dass es keine Zone gibt: ohne grüne Plakette besser nicht hineinfahren und die Angaben der Stadt Düsseldorf sowie die Liste des Umweltbundesamts prüfen.");
    serve("getDrivingRules", rulesOf("lez", [rule("lez.1")], { zoneCity: { name: "Atlantis", zone: null, plakette: null, covered: false } }));
    const none = body(await call("get_driving_rules", { topic: "lez", city: "Atlantis", language: "en" })).split("\n");
    expect(none[0]).toBe("Low-emission zone Atlantis: no entry with us — that does not mean there is no zone.");
    expect(none[1]?.startsWith('• We have no zone entry for "Atlantis" — that does not mean the city has no low-emission zone.')).toBe(true);
  });

  it("an electric car in a city: the city decides, said first; another topic in a city: the same nationwide rules, said last", async () => {
    serve("getDrivingRules", rulesOf("ev", [rule("ev.1")]));
    const ev = body(await call("get_driving_rules", { topic: "ev", city: "München", language: "de" })).split("\n");
    expect(ev[1]).toBe("• Für München gilt: Ob und wo dort mit E-Kennzeichen kostenlos oder ermäßigt geparkt werden darf, entscheidet die Stadt selbst — es zählt das Zusatzzeichen am Parkplatz, nicht das Kennzeichen allein.");
    serve("getDrivingRules", rulesOf("speed", [rule("speed.1")]));
    const speed = body(await call("get_driving_rules", { topic: "speed", city: "München", language: "en" })).split("\n");
    expect(speed.at(-1)).toBe('• The same nationwide rules apply in München; the only city-specific topic here is the low-emission zone (topic="lez").');
  });

  it("a place with no topic is the zone question at its position; a place with another topic is not looked up, and the answer says so", async () => {
    await call("get_driving_rules", { ...at, language: "en" });
    expect(query("getDrivingRules")).toEqual([{ topic: "lez", at: "52.52,13.405", lang: "en" }]);
    calls.length = 0;
    serve("getDrivingRules", rulesOf("speed", [rule("speed.1")]));
    const r = await call("get_driving_rules", { place: "Köln", topic: "speed", language: "en" });
    expect(ops()).toEqual(["getDrivingRules"]);
    expect(body(r).split("\n")[1]).toBe("Note: a place (place or lat/lon) is checked for low-emission zones only (topic=lez); these rules apply across Germany.");
  });

  it("an unknown place says so", async () => {
    serve("listPlaces", []);
    expect((await call("get_driving_rules", { place: "Nirgendwo", language: "en" })).isError).toBe(true);
    expect(ops()).toEqual(["listPlaces"]);
  });
});

describe("check_transit_disruption", () => {
  const alerts = [
    { header: "Bauarbeiten", lines: ["RE 1", "RB 2"], inForceFrom: null, inForceUntil: null },
    { header: null, lines: [], inForceFrom: null, inForceUntil: null },
  ];
  for (const language of LANGS) {
    it(`an official region code (${language}): asked as is; punctuality first, then the alerts`, async () => {
      serve("listTransitDisruptions", { ...ex<object>("listTransitDisruptions"), alerts, punctuality: { name: "VBB", level: "amber", late: 12, observed: 80 } });
      const r = await call("check_transit_disruption", { region: "05315", line: "RE 1", window_min: 30, language });
      expect(ops()).toEqual(["listTransitDisruptions"]);
      expect(query("listTransitDisruptions")).toEqual([{ area: "05315", line: "RE 1", window_min: "30", lang: language }]);
      await pinned("handlers", body(r));
    });
    it(`nothing to report (${language})`, async () => {
      serve("listTransitDisruptions", { ...ex<object>("listTransitDisruptions"), alerts: [], punctuality: null });
      expect(body(await call("check_transit_disruption", { region: "11", language }))).toBe(language === "de" ? "Keine Störungen gefunden." : "No disruptions found.");
    });
    it(`an unknown region (${language})`, async () => {
      serve("listPlaces", []);
      const r = await call("check_transit_disruption", { region: "Atlantis", language });
      expect(r).toEqual({ content: [{ type: "text", text: language === "de" ? '"Atlantis" kenne ich als Region nicht. Die Daten sind auf Kreisebene gemeldet — bitte ein Bundesland, eine kreisfreie Stadt oder den Kreis nennen (z. B. "Bayern", "Köln", "Landkreis Fulda").' : 'I do not know "Atlantis" as a region. The data is filed at Kreis level — name a Bundesland, a city or the Kreis (for example "Bayern", "Köln", "Landkreis Fulda").' }], isError: true });
      expect(ops()).toEqual(["listPlaces"]);
    });
  }
  it("a punctuality without a name", async () => {
    serve("listTransitDisruptions", { ...ex<object>("listTransitDisruptions"), alerts: [], punctuality: { name: null, level: "green", late: 0, observed: 5 } });
    expect(body(await call("check_transit_disruption", { region: "11", language: "en" }))).toBe("Punctuality : green (0 of 5 late)");
  });
  it("a region name: its district code through the place search", async () => {
    await call("check_transit_disruption", { region: "VBB", language: "en" });
    expect(query("listPlaces")).toEqual([{ q: "VBB", limit: "1", lang: "en" }]);
    expect(query("listTransitDisruptions")).toEqual([{ area: "01", lang: "en" }]);
  });
  it("a region name the place search has no code for, with a line: the line alone", async () => {
    serve("listPlaces", [{ ...ex<object[]>("listPlaces")[0], districtCode: null }]);
    await call("check_transit_disruption", { region: "Irgendwo", line: "S1", language: "en" });
    expect(query("listTransitDisruptions")).toEqual([{ line: "S1", lang: "en" }]);
  });
  it("a position: the district's code, else the Land's", async () => {
    serve("describeLocation", { ...ex<object>("describeLocation"), district: { name: "Köln", code: "05315" } });
    await call("check_transit_disruption", { ...at, language: "en" });
    expect(query("describeLocation")).toEqual([{ at: "52.52,13.405", lang: "en" }]);
    expect(query("listTransitDisruptions")).toEqual([{ area: "05315", lang: "en" }]);
    mockServer.resetHandlers();
    calls.length = 0;
    await call("check_transit_disruption", { ...at, language: "en" });
    expect(query("listTransitDisruptions")).toEqual([{ area: "01", lang: "en" }]);
  });
  it("a position with no code at all and no line: the region is unknown, its read credited", async () => {
    serve("describeLocation", { ...ex<object>("describeLocation"), state: { name: "X", code: null } });
    const r = await call("check_transit_disruption", { ...at, language: "en" });
    expect(body(r)).toBe("I do not know this region.");
    expect(meta(r)["sources"]).toEqual(["geonames", "osm"]);
  });
  it("only a latitude: no position, no region, so no place in today's words", async () => {
    const r = await call("check_transit_disruption", { lat: 52.5, language: "en" });
    expect(r).toEqual({
      content: [{ type: "text", text: 'No place given. Ask the person where: a town, a postcode or their position. Then pass the town (or postcode and town, "36037 Fulda") as region, or their position as lat+lon — for example {"region": "Fulda"} or {"lat": 50.55, "lon": 9.68}.' }],
      isError: true,
      _meta: { errorCode: "invalid_input", errorReason: "place_missing" },
    });
    expect(calls).toHaveLength(0);
  });
});

describe("check_weather_warnings", () => {
  for (const language of LANGS) {
    it(`warnings with their level and end (${language})`, async () => {
      const w = ex<{ warnings: Record<string, unknown>[] }>("getWeatherRisk").warnings[0]!;
      serve("getWeatherRisk", { warnings: [w, { ...w, headline: "Sturm", levelName: "Stufe 3", validity: { from: null, until: null } }] });
      const r = await call("check_weather_warnings", { ...at, min_level: 2, language });
      expect(query("getWeatherRisk")).toEqual([{ at: "52.52,13.405", min_level: "2", lang: language }]);
      await pinned("handlers", body(r));
    });
    it(`none (${language})`, async () => {
      serve("getWeatherRisk", { warnings: [] });
      expect(body(await call("check_weather_warnings", { ...at, language }))).toBe(language === "de" ? "Keine amtlichen Wetterwarnungen." : "No official weather warnings.");
    });
  }
});

describe("stations", () => {
  const dep = (o: Record<string, unknown>) => ({ line: "S1", category: "S", mode: "rail", destination: "Flughafen", plannedAt: "2026-03-30T06:05:00Z", delayMin: null, cancelled: false, platform: "3", platformChanged: false, ...o });
  const board = (departures: unknown[]) => ({ ...ex<object>("listStationDepartures"), departures });
  const deps = [
    dep({}),
    dep({ delayMin: 4, platformChanged: true }),
    dep({ delayMin: 0, platform: null, line: null }),
    dep({ cancelled: true, delayMin: 7, line: null, category: null, destination: null }),
  ];

  for (const language of LANGS) {
    it(`get_departures by name (${language}): the station's board with delays, cancellations and platforms`, async () => {
      serve("listStationDepartures", board(deps));
      const r = await call("get_departures", { stop: "Schömpingbach", when: "2026-03-30T08:00:00+02:00", duration_min: 30, modes: ["rail", "bus"], limit: 4, language });
      expect(query("listStations")).toEqual([{ q: "Schömpingbach", limit: "1", lang: language }]);
      expect(calls.find((c) => c.operationId === "listStationDepartures")!.url.pathname).toBe("/v1/stations/1%3Ade%3A01002%3A9001/departures");
      expect(query("listStationDepartures")).toEqual([{ from: "2026-03-30T08:00:00+02:00", duration_min: "30", modes: "rail,bus", limit: "4", lang: language }]);
      await pinned("handlers", body(r));
      expect(meta(r)["sources"]).toEqual(["bkg_gvisys", "delfi_static"]);
    });
    it(`get_departures with an empty window (${language})`, async () => {
      const r = await call("get_departures", { stop: "Schömpingbach", language });
      expect(body(r)).toBe(`Pienköckheim Nord: ${language === "de" ? "keine Abfahrten im Zeitfenster." : "no departures in the window."}`);
    });
    it(`get_departures, no such stop (${language})`, async () => {
      serve("listStations", []);
      expect(await call("get_departures", { stop: "Xy", language })).toEqual({ content: [{ type: "text", text: language === "de" ? 'Die Haltestelle "Xy" kenne ich nicht. Bitte den Namen so nennen, wie er am Schild steht, am besten mit Ort (z. B. "Fulda Bahnhof", "München, Marienplatz").' : 'I do not know a stop called "Xy". Please give the name as it appears on the sign, ideally with its town (e.g. "Fulda Bahnhof", "München, Marienplatz").' }], isError: true });
    });
  }

  it("get_departures by stop id asks the code, not the name", async () => {
    await call("get_departures", { stop_id: "8001001", stop: "Ignored", language: "en" });
    expect(query("listStations")).toEqual([{ code: "8001001", limit: "1", lang: "en" }]);
  });

  it("get_departures: no stop by name, but a place: the nearest stop to it", async () => {
    let n = 0;
    const list = exampleOf<Body>("listStations");
    mockServer.use(handlerFor("listStations", () => HttpResponse.json({ ...list, data: n++ === 0 ? [] : list.data })));
    await call("get_departures", { stop: "Nowhere", place: "Köln", language: "en" });
    expect(ops()).toEqual(["listStations", "listPlaces", "listStations", "listStationDepartures"]);
    expect(query("listStations")[1]).toEqual({ at: "48.24375,7.01625", limit: "1", lang: "en" });
    calls.length = 0;
    n = 0;
    await call("get_departures", { stop: "Nowhere", ...at, language: "en" });
    expect(query("listStations")[1]).toEqual({ at: "52.52,13.405", limit: "1", lang: "en" });
  });

  it("get_departures: no stop and a place nobody knows", async () => {
    serve("listStations", []);
    serve("listPlaces", []);
    const r = await call("get_departures", { stop: "Nowhere", place: "Nirgendwo", language: "en" });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain("Nirgendwo");
  });

  for (const language of LANGS) {
    it(`check_station_facilities (${language}): counts, then what is not working`, async () => {
      const d = ex<{ facilities: Record<string, unknown>[] }>("listStationFacilities");
      serve("listStationFacilities", { ...d, counts: { active: 3, inactive: 1, unknown: 1 }, facilities: [{ ...d.facilities[0], state: "active" }, { ...d.facilities[0], kind: "elevator", state: "inactive" }, { ...d.facilities[1], position: null }] });
      const r = await call("check_station_facilities", { eva_no: "8001001", facility: "elevator", limit: 5, language });
      expect(query("listStations")).toEqual([{ code: "8001001", limit: "1", lang: language }]);
      expect(query("listStationFacilities")).toEqual([{ kind: "elevator", limit: "5", lang: language }]);
      await pinned("handlers", body(r));
    });
    it(`check_station_facilities and describe_station, no such station (${language})`, async () => {
      serve("listStations", []);
      expect(await call("check_station_facilities", { station: "X", language })).toEqual({ content: [{ type: "text", text: language === "de" ? 'Einen Bahnhof oder eine Haltestelle "X" kenne ich nicht. Bitte den Namen so nennen, wie er am Bahnhof oder an der Haltestelle steht, mit der Stadt (z. B. "Köln Hbf", "Stuttgart Charlottenplatz").' : 'I do not know a station or stop called "X". Please give the name as it appears at the station or stop, with the city (e.g. "Köln Hbf", "Stuttgart Charlottenplatz").' }], isError: true });
      expect(await call("describe_station", { station: "X", language })).toEqual({ content: [{ type: "text", text: language === "de" ? 'Den Bahnhof "X" kenne ich nicht. Bitte den Namen so nennen, wie er am Bahnhof steht (z. B. "Köln Hbf").' : 'I do not know a station called "X". Please give the name as it appears at the station (e.g. "Köln Hbf").' }], isError: true });
      expect(await call("describe_station", { eva_no: "8000207", language })).toEqual({ content: [{ type: "text", text: language === "de" ? "Zu EVA 8000207 halten wir keinen Bahnhofseintrag. Aufzüge: check_station_facilities; Abfahrten: get_train_departures." : "We hold no station record for EVA 8000207. Lifts: check_station_facilities; departures: get_train_departures." }], isError: true });
    });
    it(`describe_station (${language}): position, lifts and escalators, the next departures`, async () => {
      serve("listStationDepartures", board(deps.slice(0, 2)));
      const r = await call("describe_station", { station: "Schömpingbach Hbf", language });
      expect(query("listStationDepartures")).toEqual([{ limit: "5", lang: language }]);
      await pinned("handlers", body(r));
    });
  }

  it("check_station_facilities with any facility asks every kind", async () => {
    await call("check_station_facilities", { station: "Schömpingbach Hbf", facility: "any", language: "en" });
    expect(query("listStationFacilities")).toEqual([{ lang: "en" }]);
  });

  it("describe_station with no departures asked reads no board", async () => {
    const r = await call("describe_station", { station: "Schömpingbach Hbf", departures: 0, language: "en" });
    expect(ops().sort()).toEqual(["listStationFacilities", "listStations"]);
    expect(body(r)).toBe("Schömpingbach Hbf · 48.38815, 7.51821\nLifts/escalators: 0 working, 0 out of service.");
    calls.length = 0;
    await call("describe_station", { station: "Schömpingbach Hbf", departures: 2, language: "en" });
    expect(query("listStationDepartures")).toEqual([{ limit: "2", lang: "en" }]);
  });
});

describe("watch_situation and stop_watch", () => {
  for (const language of LANGS) {
    it(`a watch (${language}): its id, its end, the API's note and the situations; the condition sent as JSON`, async () => {
      const w = ex<Record<string, unknown>>("getWatch");
      serve("getWatch", { ...w, note: "Beobachtung läuft.", situations: [situation({ road: "A1", headline: "Stau" }), ...Array.from({ length: 11 }, (_, i) => situation({ headline: `W${i}` }))] });
      const r = await call("watch_situation", { kind: "road", key: "A1", request: "jams", hours: 2, until: "2026-03-30T05:00:00+02:00", condition: { event: "any" }, language });
      expect(query("getWatch")).toEqual([{ kind: "road", target: "A1", request: "jams", hours: "2", until: "2026-03-30T05:00:00+02:00", condition: '{"event":"any"}', lang: language }]);
      await pinned("handlers", body(r));
    });
    it(`a watch without kind or key (${language}) is refused by the schema before the API is asked`, async () => {
      for (const [args, issue] of [
        [{ kind: "road" }, "Invalid input: expected string, received undefined at key"],
        [{ key: "A1" }, 'Invalid option: expected one of "road"|"station"|"region"|"place"|"weather"|"charger" at kind'],
      ] as const) {
        const r = await call("watch_situation", { ...args, language });
        expect(r.isError).toBe(true);
        expect(textOf(r)).toBe(`MCP error -32602: Input validation error: Invalid arguments for tool watch_situation: ${issue}`);
      }
      expect(calls).toHaveLength(0);
    });
  }

  it("stop_watch finds a watch by uri or by kind and key; an unknown one is an error", async () => {
    const { client, close } = await connect();
    try {
      const uri = ex<{ uri: string }>("getWatch").uri;
      await client.callTool({ name: "watch_situation", arguments: { kind: "road", key: "A1", language: "en" } });
      await client.callTool({ name: "watch_situation", arguments: { kind: "road", key: "A2", language: "de" } });
      const byUri = (await client.callTool({ name: "stop_watch", arguments: { uri, language: "de" } })) as CallToolResult;
      expect(textOf(byUri)).toBe("Beobachtung 1 beendet.");
      expect(byUri.isError).toBeUndefined();
      const byKey = (await client.callTool({ name: "stop_watch", arguments: { kind: "road", key: "A103", language: "en" } })) as CallToolResult;
      expect(textOf(byKey)).toBe("Watch 2 stopped.");
      for (const language of LANGS) {
        const gone = (await client.callTool({ name: "stop_watch", arguments: { watch_id: 1, language } })) as CallToolResult;
        expect(gone.isError).toBe(true);
        expect(textOf(gone)).toBe(language === "de" ? "Diese Beobachtung gibt es in dieser Unterhaltung nicht." : "There is no such watch in this conversation.");
      }
      const none = (await client.callTool({ name: "stop_watch", arguments: { kind: "road", key: "A9", language: "en" } })) as CallToolResult;
      expect(none.isError).toBe(true);
    } finally {
      await close();
    }
  });
});

describe("the credit footer and _meta of a tool answer", () => {
  it("names the sources, the licence and the data time in Berlin", async () => {
    const r = await call("find_cheapest_fuel", { ...at, language: "de" });
    expect(footer(r)).toBe("Quelle: Synthetic data from family gamma, licence CC BY 4.0. · Stand 30.03. 01:57");
    expect(meta(r)).toEqual({
      attribution: "Synthetic data from family gamma, licence CC BY 4.0.",
      license: "CC BY 4.0",
      licenses: { tankerkoenig_gamma: "CC BY 4.0" },
      asOf: "2026-03-29T23:57:30Z",
      asOfLocal: "30.03.2026, 01:57",
      sources: ["tankerkoenig_gamma"],
      purposeNote: "For consumer information only (synthetic).",
    });
  });

  it("the gap list names a tool, a case and the operation it needs, for each gap", () => {
    expect(GAPS.map((g) => g.tool)).toEqual(["*", "find_parking", "find_roadworks_ahead", "watch_situation"]);
    for (const g of GAPS) expect(g.case.length * g.needs.length).toBeGreaterThan(0);
  });
});

describe("a missing or unknown place, in today's words per tool", () => {
  it("weather (de) without a place and the fuel search (en) with an unknown one", async () => {
    expect(await call("check_weather_warnings", { language: "de" })).toEqual({
      content: [{ type: "text", text: 'Kein Ort angegeben. Bitte die Person fragen, wo: eine Stadt, eine Postleitzahl oder ihren Standort. Dann die Stadt (oder Postleitzahl und Stadt, "36037 Fulda") als place übergeben oder den Standort als lat+lon — zum Beispiel {"place": "Fulda"} oder {"lat": 50.55, "lon": 9.68}.' }],
      isError: true,
      _meta: { errorCode: "invalid_input", errorReason: "place_missing" },
    });
    serve("listPlaces", []);
    expect(await call("find_cheapest_fuel", { place: "Nirgendwo", language: "en" })).toEqual({
      content: [{ type: "text", text: 'I do not know "Nirgendwo". Name a town, a district or a stop — or pass lat/lon.' }],
      isError: true,
      _meta: { errorCode: "not_found" },
    });
  });

  it("a region-only tool takes no place: check_autobahn_traffic with a place is asked for a road, the API not at all", async () => {
    const r = await call("check_autobahn_traffic", { place: "Kassel", language: "en" });
    expect(r._meta).toEqual({ errorCode: "invalid_input", errorReason: "place_missing" });
    expect(calls).toHaveLength(0);
  });

  it("get_departures with nothing to go by asks for a stop, the API not at all", async () => {
    const r = await call("get_departures", { language: "en" });
    expect(textOf(r)).toBe('Give a stop name (free text) or a stop_id from an earlier result — or a place (or lat+lon) for the nearest stops around it. If the person named none, ask which stop, or where: a town or their position. For example {"stop": "Köln Hbf"} or {"place": "Fulda"}.');
    expect(calls).toHaveLength(0);
  });
});

describe("watch_situation: at most ten open watches a session", () => {
  it("the eleventh is refused in today's words, the API not asked", async () => {
    const { client, close } = await connect();
    const watch = async (key: string) => (await client.callTool({ name: "watch_situation", arguments: { kind: "road", key, language: "en" } })) as CallToolResult;
    for (let i = 0; i < 10; i++) expect((await watch("A8")).isError).toBeFalsy();
    const before = calls.length;
    const eleventh = await watch("A9");
    await close();
    expect(eleventh).toEqual({ content: [{ type: "text", text: "This session already has 10 open watches — the limit is 10. End one with stop_watch (viafrei://watches lists them) and try again." }], isError: true });
    expect(calls).toHaveLength(before);
  });
});

describe("motorway numbers no register knows, and the lamp in words", () => {
  const notFound = (road: string) =>
    mockServer.use(handlerFor("getMotorwayConditions", (url) => (url.pathname.endsWith(`/${road}/conditions`)
      ? problem(404, "not-found")
      : HttpResponse.json(exampleOf<Body>("getMotorwayConditions")))));
  const register = (roads: string[]) => serve("listMotorways", roads.map((road) => ({ ...(exampleOf<{ data: object[] }>("listMotorways").data[0] ?? {}), road })));

  it("every road asked unknown: today's refusal with the register's count and, for one road, the nearest numbers (de)", async () => {
    notFound("A8");
    register(["A3", "A9"]);
    expect(await call("check_autobahn_traffic", { roads: ["A8"], language: "de" })).toEqual({
      content: [{ type: "text", text: 'Für A8 liegen keine Daten vor — das ist keine mir bekannte Autobahnnummer, also keine Bundesautobahn, über die ich etwas sagen kann. 2 Autobahnen sind erfasst. Nächstliegende Nummern: A3, A9. Bitte prüfen Sie die Nummer (z. B. "A9", "A100").' }],
      isError: true,
    });
  });

  it("one road unknown beside a known one: its own line, the known road answered (en)", async () => {
    notFound("A8");
    register(["A3", "A9"]);
    const r = await call("check_autobahn_traffic", { roads: ["A8", "A9"], language: "en" });
    expect(r.isError).toBeFalsy();
    expect(body(r).split("\n\n")[0]).toEqual("A8: not a known motorway number — not a German motorway I can say anything about. Nearest real numbers: A3, A9.");
    expect(body(r).split("\n\n")[1]!.startsWith("A9 — traffic light ")).toBe(true);
  });

  it("the nearest numbers: the number without its last digit first, then the closest, in number order", () => {
    expect(nearestMotorways("A34", ["A3", "A33", "A36", "A7", "A340"])).toEqual(["A3", "A33", "A36"]);
    expect(nearestMotorways("A8", ["A8"])).toEqual([]);
  });

  it("limited sight and a green lamp are said in words, never as a code", () => {
    expect(lampText({ lamp: "amber", lampReason: "limited_sight" }, "de")).toEqual("Ampel Gelb: eingeschränkte Sicht — eine Quelle ist nicht aktuell oder nicht lesbar");
    expect(lampText({ lamp: "amber", lampReason: "limited_sight" }, "en")).toEqual("traffic light yellow: limited sight — a source is not current or could not be read");
    expect(lampText({ lamp: "green", lampReason: null }, "en")).toEqual("traffic light green: nothing reported by the Autobahn GmbH, the police/Länder or the DWD — no guarantee the road is clear");
    expect(lampText({ lamp: "red", lampReason: "road_closed" }, "de")).toEqual("Ampel Rot: Vollsperrung");
  });
});
