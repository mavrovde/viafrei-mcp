/**
 * What each tool answers, case by case: the body text in German and English (pinned as text files under
 * test/__snapshots__/handlers, reviewed like code), the operation asked with which query, the credit and the notes
 * in `_meta`, and the model-actionable errors. Every answer starts from the API contract's v0.3.0 example
 * (test/fixtures/api-openapi.json), changed only in the fields a case is about.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { HttpResponse } from "msw";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { calls, exampleOf, handlerFor, mockServer, problem } from "./api-mock.js";
import { pinned } from "./pinned.js";
import { haversineM } from "../src/tools/location.js";
import { connect, textOf } from "./harness.js";
import { GAPS, lampText, nearestMotorways } from "../src/tools/handlers.js";
import { SPEED_NOTICE_DE } from "../src/tools/speed-cameras.js";
import { kmText } from "../src/tools/nearby.js";
import { conditionSentence } from "../src/tools/watch-words.js";

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
  it("a Land as the place: the Land's situations by its key, the road kept", async () => {
    serve("listStateRoadConditions", roads([]));
    const r = await call("check_road_status", { road: "L1025", place: "niedersachsen", language: "de" });
    expect(paths("listStateRoadConditions")).toEqual(["/v1/states/03/road-conditions"]);
    expect(ops()).not.toContain("listPlaces");
    expect(body(r)).toBe("L1025 in Niedersachsen: Es liegt keine Meldung vor — das heißt ausdrücklich nicht, dass die Straße frei ist.");
  });
  it("a lorry question about a city that is also a Land keeps the place's point", async () => {
    serve("listRoadConditions", roads([]));
    serve("listLorryRules", []);
    await call("check_road_status", { place: "Bremen", vehicle: "lorry", language: "de" });
    expect(ops()).not.toContain("listStateRoadConditions");
    expect(query("listLorryRules")[0]?.["at"]).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/u);
  });
  it("a Land by its English name, named in the answer's language", async () => {
    serve("listStateRoadConditions", roads([]));
    const de = await call("check_road_status", { road: "L1025", place: "Lower Saxony", language: "de" });
    expect(body(de)).toBe("L1025 in Niedersachsen: Es liegt keine Meldung vor — das heißt ausdrücklich nicht, dass die Straße frei ist.");
    const en = await call("check_road_status", { road: "L1025", place: "Lower Saxony", language: "en" });
    expect(body(en)).toBe("L1025 in Lower Saxony: there is no report — which explicitly does not mean the road is clear.");
    expect(paths("listStateRoadConditions")).toEqual(["/v1/states/03/road-conditions", "/v1/states/03/road-conditions"]);
  });

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
    expect(body(r)).toBe("- B 27: Baustelle");
  });

  it("no road at a position keeps every situation", async () => {
    serve("listRoadConditions", roads(rich, "narrowing"));
    const r = await call("check_road_status", { ...at, language: "en" });
    expect(body(r).split("\n")).toHaveLength(3);
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
    expect(body(r)).toBe(`${String(meta(r)["conditionNote"])}\n- A103: MaintenanceWorks · 500 m`);
    expect(meta(r)["sources"]).toEqual(["roads_alpha", "lorry_bast_langlkw"]);
  });

  it("no vehicle asks no lorry rules", async () => {
    await call("check_road_status", { road: "A1", language: "en" });
    expect(ops()).toEqual(["getMotorwayConditions"]);
  });

  it("no road and no position: asks for a place", async () => {
    const r = await call("check_road_status", { language: "en" });
    expect(r.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  for (const road of ["b 27", "L1025", "S296"]) {
    it(`a ${road} by its number alone asks the road's own conditions`, async () => {
      serve("getMotorwayConditions", roads(rich.slice(2)));
      const r = await call("check_road_status", { road, horizon_days: 2, language: "de" });
      expect(paths("getMotorwayConditions")).toEqual([`/v1/motorways/${road.replace(" ", "").toUpperCase()}/conditions`]);
      expect(query("getMotorwayConditions")).toEqual([{ horizon_days: "2", lang: "de" }]);
      expect(body(r)).toBe("- B 27: Baustelle");
    });
  }

  for (const language of LANGS) {
    it(`nothing listed is never a clear road (${language}); a road at a place is named with the place`, async () => {
      serve("getMotorwayConditions", roads([]));
      expect(body(await call("check_road_status", { road: "b 27", language }))).toBe(language === "de"
        ? "B27: Es liegt keine Meldung vor — das heißt ausdrücklich nicht, dass die Straße frei ist."
        : "B27: there is no report — which explicitly does not mean the road is clear.");
      serve("listRoadConditions", roads([]));
      expect(body(await call("check_road_status", { ...at, road: "s 177", language }))).toBe(language === "de"
        ? "S177 bei 52.520, 13.405: Es liegt keine Meldung vor — das heißt ausdrücklich nicht, dass die Straße frei ist."
        : "S177 near 52.520, 13.405: there is no report — which explicitly does not mean the road is clear.");
    });
  }

  it("shows no lamp, so it credits no weather family", async () => {
    serve("getMotorwayConditions", { ...roads(rich), lampReason: "weather_warning", lampReasons: [{ reason: "weather_warning", lamp: "red", count: 1 }] }, { attribution: [WX, ROADS, LORRY] });
    const r = await call("check_road_status", { road: "A1", language: "de" });
    expect((r._meta as { attribution: string }).attribution).toBe(`${ROADS.text} · ${LORRY.text}`);
  });
});

const WX = { family: "dwd_warnings", domain: "weather", text: "Quelle: Deutscher Wetterdienst", licence: "CC BY 4.0" };
const WX_ROAD = { family: "dwd_road_forecast", domain: "weather", text: "Quelle: Deutscher Wetterdienst. Datenquelle: BMVBS und Straßenbauverwaltungen der Länder", licence: "CC BY 4.0" };
const LORRY = { family: "lorry_bast_langlkw", domain: "rules", text: "Lang-Lkw-Netz: BASt", licence: "dl-de/by-2-0" };
const ROADS = { family: "autobahn", domain: "roads", text: "Verkehrsdaten: Autobahn GmbH des Bundes", licence: "open data" };

describe("check_autobahn_traffic's lamp, as today's ampel says it", () => {
  for (const language of LANGS) {
    it(`names the first reason, and no count until the API folds the reasons as today's ampel does (${language})`, async () => {
      serve("getMotorwayConditions", { ...roads([]), lamp: "red", lampReason: "road_closed", lampReasons: [{ reason: "road_closed", lamp: "red", count: 5 }, { reason: "jam", lamp: "amber", count: 3 }] });
      expect(body(await call("check_autobahn_traffic", { roads: ["A9"], language }))).toBe(language === "de" ? "A9 — Ampel Rot: Vollsperrung." : "A9 — traffic light red: full closure.");
    });
  }

  it("credits the weather families only for a weather reason, in the summary form", async () => {
    const credit = async (reasons: { reason: string; lamp: string; count: number }[]) => {
      serve("getMotorwayConditions", { ...roads([]), lamp: "red", lampReason: reasons[0]?.reason ?? null, lampReasons: reasons }, { attribution: [ROADS, WX, WX_ROAD] });
      return ((await call("check_autobahn_traffic", { roads: ["A9"], language: "de" }))._meta as { attribution: string }).attribution;
    };
    expect(await credit([{ reason: "road_closed", lamp: "red", count: 1 }])).toBe(ROADS.text);
    const summary = `${ROADS.text} · Datenbasis: Deutscher Wetterdienst, zusammengefasst · Datenbasis: Deutscher Wetterdienst, zusammengefasst. Datenquelle: BMVBS und Straßenbauverwaltungen der Länder`;
    expect(await credit([{ reason: "road_closed", lamp: "red", count: 1 }, { reason: "weather_warning", lamp: "red", count: 1 }])).toBe(summary);
    expect(await credit([{ reason: "slippery", lamp: "amber", count: 1 }])).toBe(summary);
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

  const address = { street: "Marktweg", number: "1", postcode: "10001", place: "Kansilkamp" };
  const withAddress = () => serve("getFuelStation", { ...ex<Record<string, unknown>>("getFuelStation"), address });

  for (const language of LANGS) {
    it(`find_cheapest_fuel (${language}): e10 by price unless asked otherwise, only the asked fuel's price`, async () => {
      serve("listFuelOptions", stations);
      withAddress();
      const r = await call("find_cheapest_fuel", { ...at, language });
      expect(query("listFuelOptions")).toEqual([{ at: "52.52,13.405", radius_m: "5000", fuel: "e10", sort: "price", limit: "5", lang: language }]);
      await pinned("handlers", body(r));
      expect(meta(r)["purposeNote"]).toBe("For consumer information only (synthetic).");
      expect(textOf(r).startsWith("For consumer information only (synthetic).\n")).toBe(true);
    });
  }

  it("find_fuel_station: by distance, every fuel's price; each filter passed on", async () => {
    serve("listFuelOptions", stations, { query: { at: { lat: 52.52, lon: 13.405 }, radiusM: 3000, sort: "price", matched: 2, droppedClosed: 0, droppedUnknown: 0, droppedNotWholeDay: 0, openAt: "2026-03-30T06:00:00Z" } });
    withAddress();
    const r = await call("find_fuel_station", { ...at, radius_km: 3, brand: "Aral", name: "Mitte", open_now: true, open_at: "2026-03-30T08:00", whole_day: false, sort: "price", limit: 2, language: "en" });
    expect(query("listFuelOptions")).toEqual([{ at: "52.52,13.405", radius_m: "3000", brand: "Aral", name: "Mitte", open_now: "true", open_at: "2026-03-30T08:00", whole_day: "false", sort: "price", limit: "2", lang: "en" }]);
    expect(body(r).split("\n").slice(1)).toEqual([
      'Filling stations around 52.520, 13.405 (within 3 km) — brand Aral, name contains "Mitte", open now, open at 2026-03-30T08:00+02:00:',
      "1. Aral, Marktweg 1, 10001 Kansilkamp — diesel 1.589 €/l, Super E10 1.699 €/l, 1.2 km, open",
      "2. Freie Tankstelle, Marktweg 1, 10001 Kansilkamp — no price yet, 0.6 km, closed",
    ]);
  });

  it("find_fuel_station without a sort sorts by distance and sends today's 5 km default", async () => {
    await call("find_fuel_station", { ...at, fuel: "diesel", language: "en" });
    expect(query("listFuelOptions")).toEqual([{ at: "52.52,13.405", radius_m: "5000", fuel: "diesel", sort: "distance", lang: "en" }]);
  });

  for (const language of LANGS) {
    it(`no station held and none priced in reach (${language}): today's sentence, and the refresher is asked`, async () => {
      serve("listFuelOptions", [], { query: { at: { lat: 52.52, lon: 13.405 }, radiusM: 5000, sort: "price", matched: 0, droppedClosed: 0, droppedUnknown: 0, droppedNotWholeDay: 0, openAt: null } });
      serve("createRefresh", { id: "7", source: "fuel-prices-de", state: "refused", createdAt: "2026-03-30T00:00:00Z", settledAt: "2026-03-30T00:00:00Z", reason: "spacing", reused: false, queue: null });
      const r = await call("find_cheapest_fuel", { ...at, language });
      expect(body(r).split("\n").at(-1)).toBe(language === "de"
        ? "Für 52.520, 13.405 liegen im Umkreis von 5 km keine Tankstellenpreise vor. Auch im größtmöglichen Umkreis von 25 km beobachten wir dort keine Tankstelle mit Super E10-Preis — ein größerer Radius hilft hier also nicht. Wir beobachten nur einen Teil der Tankstellen in Deutschland. Diese Gegend beobachten wir noch nicht, und gerade können wir sie nicht beim Anbieter abfragen — neue Gegenden fragen wir nacheinander ab, höchstens eine Anfrage je Minute, und eine schon abgefragte so bald nicht noch einmal. Bitte später noch einmal fragen."
        : "No fuel prices are held within 5 km of 52.520, 13.405. Within the largest radius the provider allows (25 km) we watch no station there with a Super E10 price either, so a larger radius will not help. We watch only part of Germany's filling stations. We do not watch this area yet, and we cannot ask the provider about it right now — new areas are asked about one at a time, at most one request a minute, and one already asked about not again for a while. Please ask again later.");
      expect(ops()).toContain("createRefresh");
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
    it(`none held in the radius (${language}): today's sentence, the 10 km default sent and said`, async () => {
      serve("listChargingOptions", []);
      expect(body(await call("find_charging_station", { ...at, language }))).toBe(language === "de"
        ? "Im Umkreis von 10 km um 52.520, 13.405 kenne ich keine Ladestandorte. Die Abdeckung ist bundesweit, aber nicht lückenlos — ein größerer Radius (bis 25 km) hilft oft."
        : "I hold no charging sites within 10 km of 52.520, 13.405. Coverage is nationwide but not complete — a larger radius (up to 25 km) often helps.");
      expect(query("listChargingOptions")).toEqual([{ at: "52.52,13.405", radius_m: "10000", lang: language }]);
    });
    it(`a filter in a circle with no site at all (${language}): today's sentence, the filter notwithstanding`, async () => {
      serve("listChargingOptions", []);
      expect(body(await call("find_charging_station", { ...at, min_power_kw: 150, language }))).toBe(language === "de"
        ? "Im Umkreis von 10 km um 52.520, 13.405 kenne ich keine Ladestandorte. Die Abdeckung ist bundesweit, aber nicht lückenlos — ein größerer Radius (bis 25 km) hilft oft."
        : "I hold no charging sites within 10 km of 52.520, 13.405. Coverage is nationwide but not complete — a larger radius (up to 25 km) often helps.");
      // The circle is read a second time without the filter, to count what it holds.
      expect(query("listChargingOptions")).toEqual([
        { at: "52.52,13.405", radius_m: "10000", min_kw: "150", lang: language },
        { at: "52.52,13.405", radius_m: "10000", limit: "100", lang: language },
      ]);
    });
    it(`none matching a filter (${language}): the sites the circle holds without it, and the filter named`, async () => {
      const sites = ex<Record<string, unknown>[]>("listChargingOptions");
      mockServer.use(handlerFor("listChargingOptions", (url) => {
        const e = exampleOf<Body>("listChargingOptions");
        return HttpResponse.json({ ...e, data: url.searchParams.get("connector") === null ? [...sites, ...sites] : [], meta: { ...e.meta, page: { limit: 100, hasMore: false } } });
      }));
      expect(body(await call("find_charging_station", { ...at, radius_km: 5, connector: "ccs2", min_power_kw: 50, language }))).toBe(language === "de"
        ? "Im Umkreis von 5 km um 52.520, 13.405 kenne ich 4 Ladestandorte, aber keinen (CCS2, ≥ 50 kW). Ohne Filter oder mit größerem Radius finden Sie mehr."
        : "Within 5 km of 52.520, 13.405 I know 4 charging sites, but none (CCS2, ≥ 50 kW). Widen the radius or drop the filter.");
      expect(query("listChargingOptions")[0]).toMatchObject({ radius_m: "5000" });
    });
  }
});

describe("find_hydrogen_station", () => {
  const h2 = (o: Record<string, unknown>) => ({ ...ex<{ stations: Record<string, unknown>[] }>("listHydrogenOptions").stations[0], ...o });
  it("lists the stations in the radius: name or brand, address, pumps, operator, hours, the record's age", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-22T17:00:00Z"));
    serve("listHydrogenOptions", { stations: [
      h2({ address: { street: "Hafenweg", house_number: "3", postcode: "10001", city: "Kansilkamp" }, refill: [{ solution: "gaseousHydrogen700barCar" }, { solution: "gaseousHydrogen700barCar" }, { solution: "gaseousHydrogen350barTruck" }],
        opening: [...["monday", "tuesday", "wednesday", "thursday", "friday"].map((day) => ({ day, from: "06:00", to: "22:00" })), { day: "sunday", from: "08:00", to: "20:00" }], providerUpdatedAt: "2026-10-13T08:00:00Z" }),
      h2({ name: null, operator: null, brand: "Shell", refill: [{ solution: "liquidHydrogen" }], providerUpdatedAt: "2026-11-21T08:00:00Z" }),
      h2({ name: null, operator: null, brand: null, distanceM: 950 }),
    ], nearest: null });
    const r = await call("find_hydrogen_station", { ...at, radius_km: 100, vehicle: "car", limit: 4, language: "de" });
    vi.useRealTimers();
    expect(query("listHydrogenOptions")).toEqual([{ at: "52.52,13.405", radius_m: "100000", vehicle: "car", limit: "4", lang: "de" }]);
    expect(body(r)).toBe([
      "Wasserstofftankstellen für Pkw nahe 52.520, 13.405 (Umkreis 100 km), nächste zuerst:",
      "1. H2 Schömpingbach — 62,4 km · Hafenweg 3, 10001 Kansilkamp · 2× 700 bar Pkw, 350 bar Lkw/Bus · Betreiber: H2 Synthetic · Öffnungszeiten: Mo–Fr 06:00–22:00, So 08:00–20:00 · Eintrag zuletzt geändert 13.10.2026 (vor 40 Tagen)",
      "2. Shell — 62,4 km · Wasserstoff (liquidHydrogen) · Öffnungszeiten: nicht veröffentlicht (unbekannt) · Eintrag zuletzt geändert 21.11.2026 (gestern)",
      "3. Wasserstofftankstelle — 1,0 km · 700 bar Pkw · Öffnungszeiten: nicht veröffentlicht (unbekannt) · Änderungsdatum des Eintrags unbekannt",
      "Verfügbarkeit, Preis und Betriebsstatus veröffentlicht der Betreiber nicht — vor der Fahrt prüfen, ob die Station in Betrieb ist.",
    ].join("\n"));
  });
  it("none in the radius: the nearest one beyond it, and the wider radius when it reaches", async () => {
    serve("listHydrogenOptions", { stations: [], nearest: h2({ name: "H2 Fern", distanceM: 120_000 }) });
    expect(body(await call("find_hydrogen_station", { ...at, language: "en" }))).toBe([
      "No hydrogen station within 50 km of 52.520, 13.405.",
      "The nearest one is outside the radius: H2 Fern — 120.0 km · 700 bar car · operator: H2 Synthetic · opening hours: not published (unknown) · record date unknown",
      "Radius up to 150 km possible.",
      "No live availability, price or operating status is published — check that the station is working before you drive.",
    ].join("\n"));
    expect(query("listHydrogenOptions")).toEqual([{ at: "52.52,13.405", radius_m: "50000", limit: "5", lang: "en" }]);
    serve("listHydrogenOptions", { stations: [], nearest: h2({ name: "H2 Fern", distanceM: 160_000 }) });
    expect(body(await call("find_hydrogen_station", { ...at, language: "en" }))).not.toContain("Radius up to");
  });
  for (const language of LANGS) {
    it(`none at all (${language})`, async () => {
      serve("listHydrogenOptions", { stations: [], nearest: null });
      expect(body(await call("find_hydrogen_station", { ...at, vehicle: "truck", language }))).toBe(language === "de"
        ? "Keine Wasserstofftankstelle für Lkw/Bus im Umkreis von 50 km um 52.520, 13.405.\nIn unseren Daten gibt es keine Wasserstofftankstelle mit Lkw/Bus-Zapfpunkt."
        : "No hydrogen station for trucks/buses within 50 km of 52.520, 13.405.\nOur data holds no hydrogen station with a truck/bus pump.");
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
    it(`a filter that emptied the answer where sites are held keeps the short answer: its sentence counts them (${language})`, async () => {
      mockServer.use(handlerFor("listParkingOptions", (url) => Response.json({ ...exampleOf("listParkingOptions"), data: url.searchParams.get("limit") === "1" ? exampleOf<{ data: unknown[] }>("listParkingOptions").data : [] })));
      expect(body(await call("find_parking", { ...at, facilities: ["shower"], language }))).toBe(language === "de" ? "Keine Parkplätze gefunden." : "No car parks found.");
      expect(query("listParkingOptions")[1]).toEqual({ at: "52.52,13.405", radius_m: "10000", limit: "1", lang: language });
      expect(body(await call("find_parking", { ...at, only_with_free_spaces: true, language }))).toBe(language === "de" ? "Keine Parkplätze gefunden." : "No car parks found.");
    });
    it(`a filter that emptied the answer where nothing is held at all: today's sentences (${language})`, async () => {
      serve("listParkingOptions", []);
      const shower = await call("find_parking", { ...at, kind: "truck", facilities: ["shower"], language });
      expect(body(shower)).toBe(language === "de"
        ? "Ich kenne um 52.520, 13.405 (Umkreis 10 km) keinen Lkw-Parkplatz. Die Abdeckung ist bundesweit, aber nicht lückenlos — ein größerer Radius (bis 25 km) hilft oft."
        : "I know of no lorry parking (Lkw-Parkplatz) around 52.520, 13.405 (within 10 km). Coverage is nationwide but not complete — a larger radius (up to 25 km) often helps.");
      expect(body(await call("find_parking", { ...at, only_with_free_spaces: true, language }))).toBe(language === "de"
        ? "Um 52.520, 13.405 (Umkreis 10 km) meldet keine Anlage, die ich führe, eine Belegung — ob gerade Plätze frei sind, kann ich nicht sagen. Ohne die Einschränkung auf freie Plätze nenne ich, was es dort gibt."
        : "No site I hold around 52.520, 13.405 (within 10 km) publishes its occupancy, so I cannot say whether spaces are free right now. Asked without the free-spaces filter, I list what is there.");
      serve("listMotorwayParking", []);
      expect(body(await call("find_parking", { road: "A7", facilities: ["toilet"], only_with_free_spaces: true, language }))).toBe(language === "de"
        ? "Ich kenne an der A7 keine Parkmöglichkeiten. Die Abdeckung ist bundesweit, aber nicht lückenlos."
        : "I know of no parking along the A7. Coverage is nationwide but not complete.");
    });
    it(`disabled-badge parking without a place asks for the place first (${language})`, async () => {
      const r = await call("find_parking", { kind: "disabled_badge", language });
      expect(textOf(r)).toBe(language === "de"
        ? "Bitte place (Freitext), lat+lon oder road (z. B. \"A3\") angeben. Hat die Person nichts davon genannt, bitte fragen, wo: eine Stadt, eine Postleitzahl, ihren Standort oder die Autobahn. Zum Beispiel {\"place\": \"Fulda\"} oder {\"road\": \"A3\"}."
        : "Give a place (free text), or lat+lon, or a road like \"A3\". If the person named none, ask where: a town, a postcode, their position or the motorway. For example {\"place\": \"Fulda\"} or {\"road\": \"A3\"}.");
      expect(calls).toHaveLength(0);
      expect(textOf(await call("find_parking", { kind: "disabled_badge", road: "A7", language }))).toContain("kind=disabled_badge");
    });
  }

  it("none held around a place: today's sentence, the 10 km default sent and said, the wider radius offered", async () => {
    serve("listParkingOptions", []);
    const r = await call("find_parking", { ...at, language: "de" });
    expect(query("listParkingOptions")).toEqual([{ at: "52.52,13.405", radius_m: "10000", lang: "de" }]);
    expect(textOf(r).split("\n")[0]).toBe("Ich kenne um 52.520, 13.405 (Umkreis 10 km) keine Parkmöglichkeiten. Die Abdeckung ist bundesweit, aber nicht lückenlos — ein größerer Radius (bis 25 km) hilft oft.");
    expect(r.structuredContent).toMatchObject({ place: "52.520, 13.405", road: null, kind: "any", radiusKm: 10, facilities: [], facilitiesInScope: 0, facilitiesAnyKind: 0, withoutOccupancy: 0, onlyWithFreeSpaces: false });
    serve("listParkingOptions", []);
    const en = await call("find_parking", { place: "Kassel", kind: "car_park", radius_km: 2, language: "en" });
    expect(textOf(en).split("\n")[0]).toBe("I know of no car park (Parkhaus) around Matfienland (within 2 km). Coverage is nationwide but not complete — a larger radius (up to 25 km) often helps.");
    expect(en.structuredContent).not.toHaveProperty("facilitiesAnyKind");
  });

  it("none held along a motorway: the kind named, no radius offered, nothing credited", async () => {
    serve("listMotorwayParking", []);
    const r = await call("find_parking", { road: "A7", kind: "truck", only_with_free_spaces: true, language: "de" });
    expect(textOf(r)).toMatch(/^Ich kenne an der A7 keinen Lkw-Parkplatz\. Die Abdeckung ist bundesweit, aber nicht lückenlos\.\n\nStand [\d. :]+$/u);
    serve("listMotorwayParking", []);
    expect(textOf(await call("find_parking", { road: "A2", language: "en" })).split("\n")[0]).toBe("I know of no parking along the A2. Coverage is nationwide but not complete.");
  });

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
  const OFFICIAL_ATTR = { family: "city_x_speed", text: "Geschwindigkeitsüberwachung X: Stadt X, dl-de/by-2-0", licence: "dl-de/by-2-0" };
  const withOfficial = (attr: Record<string, unknown>[]) => ({
    attribution: [...attr, ...(exampleOf<Body>("listSpeedCameras").meta["attribution"] as Record<string, unknown>[])],
    freshness: [{ family: "city_x_speed", dataAsOf: "2026-03-28T08:00:00Z", ageS: 1, staleAfterS: 9, stale: false }, ...(exampleOf<Body>("listSpeedCameras").meta["freshness"] as Record<string, unknown>[])],
  });
  for (const language of LANGS) {
    it(`the official lists by kind, then OpenStreetMap's block, each with its own more-count, one Stand per source (${language})`, async () => {
      serve("listSpeedCameras", {
        official: [
          cam({ id: "x:1", kind: "fixed", street: "Ringstraße", municipality: "Köln", enforces: "speed_red_light", limitKmh: 50, lorryLimitKmh: 40, direction: "Nord", sourceFamily: "city_x_speed", dataAsOf: "2026-03-01" }),
          cam({ id: "x:3", kind: "fixed", street: "Hauptstraße", municipality: "Köln", limitKmh: null, sourceFamily: "city_x_speed", dataAsOf: null }),
          cam({ id: "x:2", kind: "mobile_announced", street: "Allee", municipality: "Köln", limitKmh: 30, firstDay: "2026-03-30", lastDay: "2026-03-31", staleYear: 2024, sourceFamily: "city_x_speed", dataAsOf: "2026-03-02" }),
        ],
        officialTotal: 4,
        osm: [cam({ locationLabel: null, location: { lat: 49.001349, lon: 8.3450512 }, limitKmh: null }), cam({ locationLabel: null, location: null, limitKmh: null, enforces: null })],
        osmTotal: 3,
      }, withOfficial([OFFICIAL_ATTR]));
      const r = await call("find_speed_cameras", { place: "Köln", radius_km: 2.5, limit: 2, language });
      expect(query("listSpeedCameras")).toEqual([{ at: "48.24375,7.01625", radius_m: "2500", limit: "2", lang: language }]);
      const lines = body(r).split("\n");
      const head = language === "de" ? lines.slice(1) : lines.slice(4);
      if (language === "en") expect(lines.slice(1, 4)).toEqual(["The notice in its original wording (German):", SPEED_NOTICE_DE, ""]);
      expect(head).toEqual(language === "de" ? [
        "Geschwindigkeitsüberwachung — veröffentlichte Standorte für Matfienland (Umkreis 2,5 km), nach Art und Straße:",
        "Feste Anlagen:",
        "- Ringstraße, Köln — Geschwindigkeit und Rotlicht · 50 km/h · Lkw 40 km/h · Richtung Nord",
        "- Hauptstraße, Köln — Geschwindigkeit",
        "Angekündigte mobile Kontrollen:",
        "- Allee, Köln — Geschwindigkeit · 30 km/h · 2026-03-30 bis 2026-03-31 · Datenstand 2024, älter als ein Jahr",
        "… und 1 weitere Standorte in diesem Gebiet.",
        "Feste Anlagen (OpenStreetMap):",
        "- 49.00135, 8.34505 — Geschwindigkeit",
        "- Ort ohne Straßenangabe — ",
        "… und 1 weitere in OpenStreetMap eingetragene Anlagen in diesem Gebiet.",
        "Stand Geschwindigkeitsüberwachung X: gelesen 28.03.2026, Datenstand 02.03.2026",
        "Stand Blitzer (OpenStreetMap): gelesen 29.03.2026, Datenstand 28.02.2026",
      ] : [
        "Speed enforcement — published locations for Matfienland (radius 2.5 km), by kind and street:",
        "Fixed cameras:",
        "- Ringstraße, Köln — speed and red light · 50 km/h · HGV 40 km/h · direction Nord",
        "- Hauptstraße, Köln — speed",
        "Announced mobile checks:",
        "- Allee, Köln — speed · 30 km/h · 2026-03-30 to 2026-03-31 · data from 2024, over a year old",
        "… and 1 more locations in this area.",
        "Fixed cameras (OpenStreetMap):",
        "- 49.00135, 8.34505 — speed",
        "- place without a street — ",
        "… and 1 more cameras mapped in OpenStreetMap in this area.",
        "Stand Geschwindigkeitsüberwachung X: read 2026-03-28, data as of 2026-03-02",
        "Stand Blitzer (OpenStreetMap): read 2026-03-29, data as of 2026-02-28",
      ]);
      const sc = r.structuredContent as Record<string, unknown>;
      expect(sc["asOf"]).toBe("2026-03-29T12:00:00Z");
      expect(sc["stand"]).toEqual([
        { source: "city_x_speed", name: "Geschwindigkeitsüberwachung X", readAt: "2026-03-28T08:00:00Z", dataAsOf: "2026-03-02" },
        { source: "osm_speed_cameras", name: "Blitzer (OpenStreetMap)", readAt: "2026-03-29T12:00:00Z", dataAsOf: "2026-02-28" },
      ]);
      expect({ place: sc["place"], radiusKm: sc["radiusKm"], total: sc["total"], osmTotal: sc["osmTotal"], planningOnly: sc["planningOnly"], noticeDe: sc["noticeDe"] })
        .toEqual({ place: "Matfienland", radiusKm: 2.5, total: 4, osmTotal: 3, planningOnly: true, noticeDe: SPEED_NOTICE_DE });
      expect((sc["locations"] as Record<string, unknown>[])[0]).toEqual({
        kind: "fixed", kindLabel: language === "de" ? "Feste Anlagen" : "Fixed cameras", enforces: "speed_red_light", enforcesLabel: language === "de" ? "Geschwindigkeit und Rotlicht" : "speed and red light",
        street: "Ringstraße", locationText: "Blitzer Kansilkamp", municipality: "Köln", direction: "Nord", maxSpeedKmh: 50, maxSpeedHgvKmh: 40,
        validFrom: null, validTo: null, dataAsOf: "2026-03-01", staleYear: null, lat: 47.655653, lon: 7.799556, source: "city_x_speed",
      });
    });
  }
  for (const language of LANGS) {
    it(`none: nothing published is not no checks; coordinates name the point; the Stand is the time we looked (${language})`, async () => {
      serve("listSpeedCameras", { official: [], officialTotal: 0, osm: [], osmTotal: 0 });
      const r = await call("find_speed_cameras", { ...at, language });
      expect(body(r).split("\n").at(-1)).toBe(language === "de"
        ? "Für 52.520, 13.405 (Umkreis 5 km) ist in unseren Quellen kein Standort veröffentlicht. Das heißt nicht, dass dort nicht kontrolliert wird."
        : "No location is published in our sources for 52.520, 13.405 (radius 5 km). That does not mean there are no checks there.");
      expect(query("listSpeedCameras")).toEqual([{ at: "52.52,13.405", radius_m: "5000", lang: language }]);
      expect((r.structuredContent as Record<string, unknown>)["asOf"]).toBe("2026-03-30T00:00:00Z");
    });
  }
});

describe("find_place, find_poi, find_address", () => {
  it("find_place maps the catalogue's kind to the contract's and lists coordinates to five places", async () => {
    serve("listPlaces", [{ ...ex<object[]>("listPlaces")[0], name: "Köln", kind: "municipality", location: { lat: 50.9375123, lon: 6.9602789 } }]);
    const r = await call("find_place", { query: "Köln", kind: "city", radius_km: 10, limit: 3, language: "en" });
    expect(query("listPlaces")).toEqual([{ q: "Köln", kind: "municipality", radius_m: "10000", limit: "3", lang: "en" }]);
    expect(body(r)).toBe('"Köln" — one match:\n1. Köln — town, Schleswig-Holstein, 50.93751, 6.96028');
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
      serve("getPlacesCoverage", { kinds: [{ kind: "municipality", count: 1 }], lands: [], addresses: [] });
      const want = language === "de" ? "Keine Orte gefunden." : "No places found.";
      expect(body(await call("find_place", { query: "Xy", language }))).toBe(language === "de" ? '"Xy" finde ich nicht im Ortsverzeichnis.' : 'I do not find "Xy" in the place index.');
      expect(body(await call("find_poi", { name: "Xy", language }))).toBe(want);
    });

    it(`find_place with no place index loaded says so (${language})`, async () => {
      serve("listPlaces", []);
      serve("getPlacesCoverage", { kinds: [], lands: [], addresses: [] });
      expect(body(await call("find_place", { query: "Xy", language }))).toBe(language === "de" ? "Für diese Installation ist kein Ortsverzeichnis geladen." : "This installation holds no place index.");
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
  const place = (name: string, lat: number, lon: number, code?: string) => ({ id: name, name, location: { lat, lon }, distanceM: null, sourceFamily: "x", ...(code === undefined ? {} : { code }) });
  const loc = (o: Record<string, unknown>) => ({
    address: null, municipality: place("Ort A", 52.53, 13.405), district: place("Kreis B", 52.6, 13.5, "12"), state: null, mayLieOutsideGermany: false,
    lowEmissionZone: { verdict: "unknown", zone: null, distanceM: null, liftedOn: null }, ...o,
  });
  const lez = { verdict: "outside", zone: "Umweltzone Köln", distanceM: 2_345, liftedOn: null };
  const noAddresses = () => serve("getPlacesCoverage", { kinds: [], lands: [], addresses: [] });
  for (const language of LANGS) {
    for (const [name, zone] of [
      ["inside", { ...lez, verdict: "inside" }],
      ["transfer", { ...lez, verdict: "transfer", zone: "Randbereich Nord" }],
      ["outside", lez],
      ["outside, under a kilometre", { ...lez, distanceM: 4 }],
      ["lifted", { ...lez, verdict: "inside", liftedOn: "01.01.2025" }],
      ["unknown", { ...lez, verdict: "unknown", zone: null }],
    ] as const) {
      it(`place, district, Land and the low-emission zone ${name} (${language})`, async () => {
        noAddresses();
        serve("describeLocation", loc({ lowEmissionZone: zone }));
        const r = await call("describe_location", { ...at, language });
        expect(query("describeLocation")).toEqual([{ at: "52.52,13.405", lang: language }]);
        await pinned("handlers", body(r));
      });
    }
    it(`an address, the point maybe abroad (no zone said there), no place (${language})`, async () => {
      serve("describeLocation", loc({
        address: { street: "Hauptstraße", number: "5", postcode: null, place: "Berlin", land: "Berlin", distanceM: 30, dataAsOf: "2026-11-01", sourceFamily: "osm", location: at },
        municipality: null, district: null, state: place("Brandenburg", 52.4, 13.0, "12"), mayLieOutsideGermany: true,
      }));
      const r = await call("describe_location", { ...at, language });
      expect(ops()).toEqual(["describeLocation"]);
      await pinned("handlers", body(r));
    });
    it(`addresses loaded but none near (${language})`, async () => {
      serve("getPlacesCoverage", { kinds: [], lands: [], addresses: [{ land: "Berlin", dataAsOf: "2026-11-01" }] });
      serve("describeLocation", loc({ municipality: null, district: null, lowEmissionZone: null }));
      expect(body(await call("describe_location", { ...at, language }))).toBe(language === "de"
        ? "Beschreibung für 52.5200, 13.4050:\n- Keine Adresse in der Nähe bekannt."
        : "Description of 52.5200, 13.4050:\n- No address known nearby.");
    });
    it(`without lon (${language}): the schema's refusal, as today's server words it`, async () => {
      const r = await call("describe_location", { lat: 52.5, language });
      expect(r.isError).toBe(true);
      expect(textOf(r)).toBe("MCP error -32602: Input validation error: Invalid arguments for tool describe_location: Invalid input: expected number, received undefined at lon");
      expect(calls).toHaveLength(0);
    });
  }
  it("the Land is named from the district's key in the answer's language, before the API's Land row", async () => {
    noAddresses();
    serve("describeLocation", loc({ state: place("Irgendwo", 0, 0, "09") }));
    expect(body(await call("describe_location", { ...at, language: "en" }))).toContain("\n- State (Land): Brandenburg\n");
  });
  it("distances are today's: a sphere from the asked point to the place's point, not the API's rounded distance", async () => {
    expect(Math.round(haversineM(50.5546, 9.6773, 50.4509, 9.9157))).toBe(20_427);
    noAddresses();
    serve("describeLocation", loc({ municipality: { ...place("Ort A", 52.53, 13.405), distanceM: 99_000 } }));
    expect(body(await call("describe_location", { ...at, language: "de" }))).toContain("\n- Ort: Ort A (1,1 km)\n");
  });
});

describe("find_nearby and find_sharing", () => {
  const nbFuel = (name: string | null, brand: string | null, distanceM: number, reportedAt: string, current = true) => ({ id: "f", name, brand, location: at, distanceM, prices: [{ fuel: "e5", priceEur: 1.789, reportedAt, reportedAtLocal: reportedAt, current }], sourceFamily: "tk" });
  const nbStation = { id: "s", name: "Musterstadt Hbf", location: at, stopCode: null, eva: null, evaNumbers: [], districtCode: null, modes: [], distanceM: 2500, sourceFamily: "s" };
  const nbJunction = (name: string, road: string | null, distanceM = 3000) => ({ id: "j", name, road, number: null, location: at, distanceM, sourceFamily: "r" });

  it("find_nearby: the needs asked, each on its line with its radius, or what it holds when it holds nothing", async () => {
    const p = (name: string, distanceM = 120) => ({ name, kind: "shop=supermarket", street: null, houseNo: null, location: at, distanceM, sourceFamily: "osm" });
    serve("listNearby", { needs: [{ need: "groceries", radiusM: 5000, widened: false, places: [p("A"), p("B", 2000)] }, { need: "food", radiusM: 8000, widened: true, places: [p("C", 30)] }, { need: "money", radiusM: 2000, widened: false, places: [] }] });
    const r = await call("find_nearby", { place: "Kassel", radius_km: 5, categories: ["groceries", "food", "money"], language: "de" });
    expect(query("listNearby")).toEqual([{ at: "48.24375,7.01625", radius_m: "5000", categories: "groceries,food,money", lang: "de" }]);
    expect(body(r).split("\n")).toEqual([
      "In der Nähe von Matfienland (Umkreis 5 km):",
      "- Lebensmittel (Umkreis 5,0 km): A (0,1 km); B (2,0 km)",
      "- Essen (wenige in der Nähe, Umkreis 8,0 km): C (30 m)",
      "- Geld & Post: nichts im Umkreis von 2,0 km in den OpenStreetMap-Daten",
    ]);
  });

  for (const language of LANGS) {
    it(`find_nearby without categories: one line per vehicle category, in the fixed order, places joined, the price's time when over an hour (${language})`, async () => {
      const now = Date.now();
      const old = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      const fresh = new Date(now - 10 * 60 * 1000).toISOString();
      const charging = { id: "c", name: null, operator: "EnBW", location: at, distanceM: 1800, access: "public", summary: { chargePoints: 4, availableNow: null, maxPowerKw: 150 } };
      serve("listNearby", { fuel: [nbFuel("Tank A", "Aral", 300, fresh), nbFuel(null, null, 400, old, false)], charging: [charging], parking: [], stations: [nbStation], junctions: [nbJunction("Musterstadt-Nord", "A101"), nbJunction("Musterstadt A101-Süd", "A101", 3500), nbJunction("Ortsumgehung", "B2", 40)] });
      const r = await call("find_nearby", { ...at, language });
      expect(query("listNearby")).toEqual([{ at: "52.52,13.405", lang: language }]);
      const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(old));
      const sameDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(old)) === new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(now));
      if (!sameDay) return; // the dated form is asserted by the clock's own test, not across midnight
      expect(body(r).split("\n")).toEqual(language === "de" ? [
        "In der Nähe von 52.520, 13.405 (Umkreis 5 km):",
        `- Tankstellen, Super E5: Aral, 1,789 €/l (0,3 km); Tankstelle, 1,789 €/l (0,4 km, nicht aktuell: Preis von ${t})`,
        "- Ladepunkte: EnBW (1,8 km)",
        "- Parkplätze: nichts im Umkreis",
        "- Bahnhöfe: Musterstadt Hbf (2,5 km)",
        "- Autobahnanschlüsse: Musterstadt-Nord (A101) (3,0 km); Musterstadt A101-Süd (3,5 km)",
        "- Weitere Anschlussstellen (keiner Autobahn zugeordnet, z. B. autobahnähnliche Bundesstraßen): Ortsumgehung (B2) (40 m)",
      ] : [
        "Near 52.520, 13.405 (within 5 km):",
        `- fuel stations, Super E5: Aral, 1.789 €/l (0.3 km); Tankstelle, 1.789 €/l (0.4 km, not current: price from ${t})`,
        "- charging: EnBW (1.8 km)",
        "- parking: nothing nearby",
        "- stations: Musterstadt Hbf (2.5 km)",
        "- motorway junctions: Musterstadt-Nord (A101) (3.0 km); Musterstadt A101-Süd (3.5 km)",
        "- Other junctions (not on a motorway we can name, e.g. dual-carriageway federal roads): Ortsumgehung (B2) (40 m)",
      ]);
      expect((r.structuredContent as { fuel: unknown[] }).fuel[1]).toEqual({ name: "Tankstelle", distanceKm: 0.4, price: 1.789, fuel: "e5", observedAt: old, priceOlderThan24h: true });
    });
  }

  it("find_nearby: no price nearby is said as such; a category that did not answer is said by its status, never as nothing nearby", async () => {
    const parts = (s: Record<string, string>) => ({ parts: Object.entries(s).map(([part, status]) => ({ part, status })) });
    serve("listNearby", { fuel: [], stations: [nbStation] }, parts({ fuel: "ok", charging: "timeout", parking: "unavailable", station: "ok", junction: "not_permitted", needs: "not_requested" }));
    expect(body(await call("find_nearby", { ...at, language: "en" })).split("\n")).toEqual([
      "Near 52.520, 13.405 (within 5 km):",
      "- fuel stations: no prices nearby",
      "- stations: Musterstadt Hbf (2.5 km)",
      "- charging: did not answer in time – please ask again shortly.",
      "- parking: not available right now.",
      "- motorway junctions: not included in this access.",
    ]);
    serve("listNearby", {}, parts({ needs: "timeout" }));
    expect(body(await call("find_nearby", { ...at, categories: ["food"], language: "de" })).split("\n").slice(1)).toEqual(["- Orte des Alltags: hat nicht rechtzeitig geantwortet – bitte gleich noch einmal fragen."]);
  });

  it("find_nearby: categories asked out of order are said in the fixed order, the needs after the vehicle ones", async () => {
    serve("listNearby", { stations: [nbStation], parking: [], needs: [{ need: "toilets", radiusM: 1000, widened: false, places: [] }] });
    const lines = body(await call("find_nearby", { ...at, categories: ["toilets", "station", "parking"], language: "en" })).split("\n");
    expect(lines.slice(1)).toEqual(["- parking: nothing nearby", "- stations: Musterstadt Hbf (2.5 km)", "- public toilets: nothing within 1.0 km in the OpenStreetMap data"]);
  });

  it("find_nearby's distance: metres under 50 m, else a tenth of a kilometre", () => {
    expect([kmText(49, "de"), kmText(50, "de"), kmText(1849, "en"), kmText(0, "en")]).toEqual(["49 m", "0,1 km", "1.8 km", "0 m"]);
  });

  const bike = (over: Record<string, unknown> = {}) => ({
    id: "st-1", name: "Station 1", systemLabel: "Nextbike", system: "nextbike_de", distanceM: 300, location: at, sourceFamily: "gbfs_nextbike",
    bikes: 4, electricBikes: 1, freeDocks: 2, available: true, current: true, renting: true, virtual: false,
    countedAt: "2026-03-30T08:00:00Z", reportedAt: "2026-03-30T08:00:00Z", ...over,
  });
  const fleet = (count = 0, over: Record<string, unknown> = {}) => ({ count, electric: 0, atLeast: false, nearest: count === 0 ? [] : [{ distanceM: 420, propulsion: "human", rangeLeftM: null, vehicleType: "bicycle", sourceFamily: "gbfs_donkey" }], ...over });
  for (const language of LANGS) {
    it(`find_sharing (${language}): each station in today's words, its docks, the free-floating bikes`, async () => {
      serve("listSharingOptions", {
        stations: [
          bike(), bike({ id: "st-2", name: null, systemLabel: null, bikes: null, current: false }), bike({ name: "Zone", virtual: true, freeDocks: 3, electricBikes: 0, distanceM: 1234 }),
          bike({ name: "Alt", current: false, virtual: true, bikes: 1, countedAt: "2026-03-29T06:00:00Z" }), bike({ name: "Zu", renting: false }), bike({ name: "Ohne Zahl", freeDocks: null, bikes: 1, electricBikes: null }),
        ],
        stationsInRadius: 6, vehicles: fleet(201, { atLeast: true, electric: 3 }),
      });
      const r = await call("find_sharing", { ...at, radius_km: 1.5, limit: 6, only_available: false, language });
      expect(query("listSharingOptions")).toEqual([{ at: "52.52,13.405", radius_m: String(1.5 * 1000), limit: "6", only_available: "false", lang: language }]);
      await pinned("handlers", body(r));
      expect(r.structuredContent).toMatchObject({
        place: "52.520, 13.405", radiusKm: 1.5,
        stations: [{ name: "Station 1", system: "Nextbike", distanceM: 300, lat: 52.52, lon: 13.405, vehiclesAvailable: 4, electricAvailable: 1, docksAvailable: 2, isVirtual: false, isRenting: true, countedAt: "2026-03-30T08:00:00.000Z", stale: false }, { stale: null }, { docksAvailable: null, isVirtual: true }, { stale: true }, {}, {}],
        freeFloating: { count: 201, atLeast: true, electric: 3, nearest: [{ distanceM: 420, formFactor: "bicycle", propulsion: "human", rangeM: null }] },
      });
    });
    it(`find_sharing (${language}): nothing in the radius, the nearest station within 5 km named`, async () => {
      mockServer.use(handlerFor("listSharingOptions", (url) => Response.json({ ...exampleOf("listSharingOptions"), data: url.searchParams.get("radius_m") === "5000"
        ? { stations: [bike({ distanceM: 3_400 })], stationsInRadius: 1, vehicles: fleet() }
        : { stations: [], stationsInRadius: 0, vehicles: fleet() } })));
      const r = await call("find_sharing", { ...at, language });
      expect(query("listSharingOptions")).toEqual([{ at: "52.52,13.405", lang: language }, { at: "52.52,13.405", radius_m: "5000", limit: "1", only_available: "false", lang: language }]);
      await pinned("handlers", body(r));
    });
  }
  it("find_sharing: stations in the radius but none to rent, and no wider read; nothing within 5 km says nothing more", async () => {
    serve("listSharingOptions", { stations: [], stationsInRadius: 2, vehicles: fleet() });
    const two = body(await call("find_sharing", { ...at, language: "de" }));
    expect(two).toContain("2 Stationen im Umkreis, aber keine mit einem ausleihbaren Rad laut aktueller Zählung; ohne die Einschränkung auf ausleihbare Räder gefragt, nenne ich sie alle.");
    expect(ops()).toEqual(["listSharingOptions"]);
    serve("listSharingOptions", { stations: [], stationsInRadius: 0, vehicles: fleet() });
    const none = body(await call("find_sharing", { ...at, radius_km: 5, only_available: false, language: "en" }));
    expect(none).toBe("No shared bikes found within 5 km of 52.520, 13.405 — neither at a station nor free-floating. Radius up to 5 km possible. Covered are nextbike and Donkey Republic; e-scooters and operators without an open licence are not.");
    expect(ops()).toEqual(["listSharingOptions", "listSharingOptions"]);
  });
  it("find_sharing: only free-floating bikes still head the answer", async () => {
    serve("listSharingOptions", { stations: [], stationsInRadius: 0, vehicles: fleet(1) });
    expect(body(await call("find_sharing", { ...at, language: "de" }))).toBe("Leihräder nahe 52.520, 13.405 (Umkreis 1 km):\nOhne Station: 1 frei abgestelltes Rad im Umkreis, das nächste 0,4 km entfernt.");
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

  for (const language of LANGS) {
    it(`an unknown place in today's words, with no error code (${language})`, async () => {
      serve("listPlaces", []);
      expect(await call("get_driving_rules", { place: "Nirgendwo", language })).toEqual({
        content: [{ type: "text", text: language === "de" ? "„Nirgendwo“ habe ich als Ort nicht gefunden." : 'I could not find "Nirgendwo" as a place.' }],
        isError: true,
      });
      expect(ops()).toEqual(["listPlaces"]);
    });
  }

  it("a point we hold no boundary for: the caveat opens the answer and is its condition; the zone block is a blank line", async () => {
    serve("getDrivingRules", rulesOf("lez", [rule("lez.1")], { zoneVerdict: { kind: "unknown", distanceM: null } }), { notes: { purpose: [], condition: [] } });
    const r = await call("get_driving_rules", { lat: 50.9413, lon: 6.9583, language: "de" });
    const caveat = "Achtung: Für 50.941, 6.958 liegt uns keine Umweltzonen-Grenze vor. Daraus folgt NICHT, dass Sie dort ohne Plakette fahren dürfen — es kann dort eine Umweltzone geben; maßgeblich ist die Beschilderung (Zeichen 270.1), die vollständige Liste der Zonen führt das Umweltbundesamt.";
    expect(body(r).split("\n").slice(0, 4)).toEqual([caveat, "Umweltzone und Plakette — 50.941, 6.958:", "", "• Text lez.1. (§ lez.1 StVO)"]);
    expect(meta(r)["conditionNote"]).toBe(caveat);
    serve("getDrivingRules", rulesOf("lez", [rule("lez.1")], { zoneVerdict: { kind: "outside", distanceM: 4000 } }), { notes: { purpose: [], condition: [] } });
    const inside = await call("get_driving_rules", { lat: 50.9413, lon: 6.9583, language: "en" });
    expect(body(inside).split("\n")[0]).toBe("Low-emission zone and plaque — 50.941, 6.958:");
    expect(meta(inside)["conditionNote"]).toBeUndefined();
  });

  it("a list entry that carries no description yet is still an entry: green plaque, not 'no entry'", async () => {
    serve("getDrivingRules", rulesOf("lez", [rule("lez.1")], { zoneCity: { name: "Berlin", zone: null, plakette: "green", covered: true } }));
    const lines = body(await call("get_driving_rules", { topic: "lez", city: "Berlin", language: "en" })).split("\n");
    expect(lines[0]).toBe("Low-emission zone Berlin: yes, you need the green Feinstaubplakette.");
    expect(lines[1]).toBe("• Berlin: Required: the green plaque (emission group 4). You can buy it at vehicle registration offices, TÜV/DEKRA/GTÜ/KÜS and approved garages on presentation of the vehicle registration document (part I).");
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
      expect(ops()).toEqual(["listPlaces", "listPlaces"]);
    });
  }
  it("a punctuality without a name", async () => {
    serve("listTransitDisruptions", { ...ex<object>("listTransitDisruptions"), alerts: [], punctuality: { name: null, level: "green", late: 0, observed: 5 } });
    expect(body(await call("check_transit_disruption", { region: "11", language: "en" }))).toBe("Punctuality : green (0 of 5 late)");
  });
  it("a region name: its district code through the place search", async () => {
    await call("check_transit_disruption", { region: "VBB", language: "en" });
    expect(query("listPlaces")).toEqual([{ q: "VBB", kind: "district", limit: "1", lang: "en" }, { q: "VBB", limit: "1", lang: "en" }, { q: ex<{ name: string }[]>("listPlaces")[0]!.name, kind: "district", limit: "5", lang: "en" }]);
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

describe("a town and a thing the place search does not hold", () => {
  const placesOnly = (known: string) => mockServer.use(handlerFor("listPlaces", (url) => {
    const e = ex<Record<string, unknown>[]>("listPlaces");
    return HttpResponse.json({ ...exampleOf<object>("listPlaces"), data: url.searchParams.get("q") === known ? [{ ...e[0], name: known }] : [] });
  }));
  for (const language of LANGS) {
    it(`the town's centre, saying what was not found (${language})`, async () => {
      placesOnly("Köln");
      serve("getWeatherRisk", { warnings: [] });
      const r = await call("check_weather_warnings", { place: "Köln Hbf", language });
      expect(query("listPlaces").map((q) => q["q"])).toEqual(["Köln Hbf", "Köln"]);
      expect(body(r)).toContain(language === "de" ? "Köln (gemessen ab der Ortsmitte — „Hbf“ finde ich dort nicht)" : 'Köln (measured from the town centre — I found no "Hbf" there)');
    });
  }
  it("a centre word: the centre is the answer, no note", async () => {
    placesOnly("Kiel");
    serve("getWeatherRisk", { warnings: [] });
    const r = await call("check_weather_warnings", { place: "Kiel Zentrum", language: "de" });
    expect(body(r)).toContain("Kiel");
    expect(body(r)).not.toContain("Ortsmitte");
  });
  it("the longest leading words first, at most three", async () => {
    placesOnly("Frankfurt am Main");
    serve("getWeatherRisk", { warnings: [] });
    await call("check_weather_warnings", { place: "Frankfurt am Main Hbf", language: "de" });
    expect(query("listPlaces").map((q) => q["q"])).toEqual(["Frankfurt am Main Hbf", "Frankfurt am Main"]);
    calls.length = 0;
    await call("check_weather_warnings", { place: "a b c d e", language: "de" });
    expect(query("listPlaces").map((q) => q["q"])).toEqual(["a b c d e", "a b c", "a b", "a"]);
  });
});

describe("check_weather_warnings", () => {
  const w = () => ex<{ warnings: Record<string, unknown>[] }>("getWeatherRisk").warnings[0]!;
  for (const language of LANGS) {
    it(`warnings (${language}): today's head with the count and the highest level, highest first; the level applied here, not asked of the API`, async () => {
      serve("getWeatherRisk", { warnings: [w(), { ...w(), headline: "Sturm", level: 3, levelName: "Stufe 3", validity: { from: null, until: null } }, { ...w(), headline: "Frost", level: 1 }] });
      const r = await call("check_weather_warnings", { ...at, min_level: 2, language });
      expect(query("getWeatherRisk")).toEqual([{ at: "52.52,13.405", lang: language }]);
      const lines = body(r).split("\n");
      expect(lines.slice(0, 3)).toEqual(language === "de"
        ? ["2 amtliche Meldungen für 52.520, 13.405, höchste Stufe 3 von 4:", "", "- Sturm (Stufe 3)"]
        : ["2 official notices for 52.520, 13.405, highest level 3 of 4:", "", "- Sturm (Stufe 3)"]);
      expect(lines[3]).toMatch(/^- Warnung vor uv \(Stufe 2\) \(Stufe 2\) (bis|until) /u);
      expect(lines).toHaveLength(4);
    });
    it(`none (${language}): no all-clear, the look-ahead said`, async () => {
      serve("getWeatherRisk", { warnings: [] });
      expect(body(await call("check_weather_warnings", { ...at, language }))).toBe(language === "de"
        ? "Für 52.520, 13.405 liegt derzeit keine amtliche Wetterwarnung des DWD vor (geprüft für jetzt und die nächsten 24 Stunden). Das ist keine Entwarnung für die weitere Strecke: Warnungen gelten je Gebiet und können kurzfristig neu herausgegeben werden."
        : "No official DWD weather warning is currently in force for 52.520, 13.405 (checked for now and the next 24 hours). That is not an all-clear for the rest of the route: warnings are issued per area and can be published at short notice.");
    });
    it(`below the level asked (${language}): how many it hid, never "none"`, async () => {
      serve("getWeatherRisk", { warnings: [{ ...w(), level: 1 }] });
      expect(body(await call("check_weather_warnings", { ...at, min_level: 3, language }))).toBe(language === "de"
        ? "Für 52.520, 13.405 liegen keine amtlichen Warnungen ab Stufe 3 vor. Es gilt aber 1 Warnung unterhalb dieser Stufe — ab Stufe 0 gefragt, wird sie angezeigt."
        : "No official warnings at level 3 or above are in force for 52.520, 13.405. 1 warning below that level is in force — asked from level 0, it is shown.");
    });
  }
  it("a DWD warnings credit is given in its summary form, once: the official text is never shown, so its Quellvermerk is not either", async () => {
    const dwd = (family: string) => ({ family, domain: "weather", text: "Quelle: Deutscher Wetterdienst", licence: "CC BY 4.0" });
    const other = { family: "dwd_road_forecast", domain: "weather", text: "Quelle: Deutscher Wetterdienst. Datenquelle: BMVBS und Straßenbauverwaltungen der Länder", licence: "CC BY 4.0" };
    for (const warnings of [[w()], []]) {
      serve("getWeatherRisk", { warnings }, { attribution: [dwd("dwd_warnings"), dwd("dwd_warnings_en"), other] });
      const r = await call("check_weather_warnings", { ...at, language: "de" });
      expect((r._meta as { attribution: string }).attribution).toBe("Datenbasis: Deutscher Wetterdienst, zusammengefasst · Quelle: Deutscher Wetterdienst. Datenquelle: BMVBS und Straßenbauverwaltungen der Länder");
      expect(textOf(r).match(/Deutscher Wetterdienst, zusammengefasst/gu)).toHaveLength(1);
    }
  });
  it("a warning that starts within the look-ahead says when it starts; one in force does not", async () => {
    for (const language of ["de", "en"] as const) {
      serve("getWeatherRisk", { warnings: [{ ...w(), inForce: false, validity: { from: "2026-11-22T21:16:00Z", until: "2026-11-23T05:16:00Z" } }, { ...w(), inForce: true, validity: { from: "2026-11-22T10:00:00Z", until: "2026-11-23T05:16:00Z" } }] });
      const lines = body(await call("check_weather_warnings", { ...at, language })).split("\n");
      expect(lines[2]).toMatch(language === "de" ? / von 22\.11\.2026, 22:16 bis 23\.11\.2026, 06:16$/u : / from .*22:16 until .*06:16$/u);
      expect(lines[3]).not.toMatch(/ von | from /u);
    }
  });
  it("a level-0 advance notice (the API's minimum is 0) is listed at min_level 0 and hidden, and counted, from level 1", async () => {
    for (const language of LANGS) {
      serve("getWeatherRisk", { warnings: [{ ...w(), level: 0, levelName: "Vorabinformation Unwetter", headline: "Vorabinformation UNWETTER vor STURM" }] });
      const r = await call("check_weather_warnings", { ...at, min_level: 0, language });
      expect(query("getWeatherRisk").at(-1)).toEqual({ at: "52.52,13.405", lang: language });
      expect(body(r).split("\n").slice(0, 3)).toEqual([
        language === "de" ? "Eine amtliche Meldung für 52.520, 13.405, nur eine Vorabinformation:" : "One official notice for 52.520, 13.405, an advance notice only:",
        "",
        expect.stringMatching(/^- Vorabinformation UNWETTER vor STURM \(Vorabinformation Unwetter\)/u),
      ]);
      expect(body(await call("check_weather_warnings", { ...at, min_level: 1, language }))).toBe(language === "de"
        ? "Für 52.520, 13.405 liegen keine amtlichen Warnungen ab Stufe 1 vor. Es gilt aber 1 Warnung unterhalb dieser Stufe — ab Stufe 0 gefragt, wird sie angezeigt."
        : "No official warnings at level 1 or above are in force for 52.520, 13.405. 1 warning below that level is in force — asked from level 0, it is shown.");
    }
  });
  it("a place is said by its name; a lone advance notice says so", async () => {
    serve("getWeatherRisk", { warnings: [{ ...w(), level: 0 }] });
    expect(body(await call("check_weather_warnings", { place: "Leipzig", language: "de" })).split("\n")[0]).toBe("Eine amtliche Meldung für Matfienland, nur eine Vorabinformation:");
  });
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

  for (const tool of ["check_station_facilities", "describe_station"]) {
    it(`${tool} with no station asks which one, in today's words, and searches nothing`, async () => {
      const de = await call(tool, { language: "de" });
      expect(de).toEqual({ content: [{ type: "text", text: 'Bitte station (Bahnhofsname als Freitext) oder eva_no angeben. Hat die Person keinen Bahnhof genannt, bitte fragen, welchen. Zum Beispiel {"station": "Hannover Hbf"}.' }], isError: true });
      const en = await call(tool, { language: "en" });
      expect(textOf(en)).toBe('Give a station name (free text) or an eva_no. If the person named no station, ask which one. For example {"station": "Hannover Hbf"}.');
      expect(query("listStations")).toEqual([]);
    });
  }

  it("get_departures with only a place or a position: no empty station search (the API refuses one), the stop nearest it", async () => {
    const r = await call("get_departures", { place: "Leipzig", language: "de" });
    expect(r.isError).not.toBe(true);
    expect(query("listStations")).toEqual([{ at: expect.stringMatching(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/u) as string, limit: "1", lang: "de" }]);
    await call("get_departures", { lat: 52.5, lon: 13.4, language: "en" });
    expect(query("listStations").slice(-1)).toEqual([{ at: "52.5,13.4", limit: "1", lang: "en" }]);
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
    expect(query("listStationFacilities")).toEqual([{ limit: "20", lang: "en" }]);
  });

  describe("check_station_facilities in today's words", () => {
    const unit = (id: string, kind: string, position: string | null, state: string) => ({ id, kind, position, state, sourceFamily: "fasta" });
    const facilities = (list: ReturnType<typeof unit>[]) => ({ station: { name: "Schömpingbach Hbf" }, facilities: list,
      counts: { active: list.filter((f) => f.state === "active").length, inactive: list.filter((f) => f.state === "inactive").length, unknown: list.filter((f) => f.state !== "active" && f.state !== "inactive").length } });
    const text = async (args: Record<string, unknown>) => body(await call("check_station_facilities", { station: "Schömpingbach Hbf", ...args }));
    it("every unit in service, one name twice told apart by its number, and a list cut at the limit", async () => {
      serve("listStationFacilities", facilities([unit("10", "elevator", "zu Gleis 1", "active"), unit("11", "elevator", "zu Gleis 1", "active"), unit("12", "escalator", "Westseite", "active")]));
      expect(await text({ limit: 2, language: "de" })).toBe([
        "In Schömpingbach Hbf sind alle 3 gemeldeten Anlagen in Betrieb. Gezählt sind die Anlagen, die die Bahn für diesen Bahnhof meldet. Aufzüge an Haltestellen städtischer Verkehrsbetriebe (Straßenbahn, Stadtbahn, U-Bahn) sind darin nicht enthalten — dazu liegen mir für diesen Bahnhof keine Live-Daten vor.",
        "Fahrtreppe Westseite: in Betrieb", "Aufzug zu Gleis 1 (Anlage 10): in Betrieb", "… und 1 weitere.",
      ].join("\n"));
    });
    it("none with a known status: not that they are out of service; DB's German names in English, or quoted", async () => {
      serve("listStationFacilities", facilities([unit("10", "elevator", "zu Gleis 3/4 - Südsteg", "unknown"), unit("11", "escalator", "neben dem Kiosk", "unknown")]));
      expect(await text({ language: "en" })).toBe([
        "I cannot say whether the 2 reported facilities at Schömpingbach Hbf are in service — that does not mean they are out of service. DB reports no status for 2 facilities. Counted are the facilities DB reports for this station. Lifts at stops of the city's transport operator (tram, light rail, underground) are not included — I hold no live data on them for this station.",
        'Escalator Provider text (German): "neben dem Kiosk": status unknown', "Lift to platform 3/4 - south footbridge: status unknown",
      ].join("\n"));
    });
    it("some in service and the rest unknown: of the known ones", async () => {
      serve("listStationFacilities", facilities([unit("10", "elevator", null, "active"), unit("11", "elevator", null, "unknown")]));
      expect((await text({ language: "de" })).split("\n")[0]).toMatch(/^In Schömpingbach Hbf ist 1 von 1 gemeldeten Anlagen mit bekanntem Status in Betrieb\. Bei 1 Anlage meldet die Bahn keinen Status\. /u);
    });
    for (const language of LANGS) {
      it(`DB lists none (${language}): what the data lists, never what the station has; a kind asked names the others`, async () => {
        serve("listStationFacilities", facilities([]));
        expect(await text({ language })).toBe(language === "de"
          ? "In den Aufzugs- und Fahrtreppendaten der Bahn ist für Schömpingbach Hbf weder ein Aufzug noch eine Fahrtreppe verzeichnet. Ob es dort Anlagen gibt, die die Bahn nicht führt, kann ich daraus nicht sagen."
          : "DB's lift and escalator data lists neither a lift nor an escalator for Schömpingbach Hbf. Whether the station has equipment DB does not list, I cannot tell from this.");
        mockServer.use(handlerFor("listStationFacilities", (u) => HttpResponse.json({ ...exampleOf<Body>("listStationFacilities"),
          data: facilities(u.searchParams.get("kind") === null ? [unit("1", "escalator", null, "active"), unit("2", "escalator", null, "active")] : []) })));
        expect(await text({ facility: "elevator", language })).toBe(language === "de"
          ? "In den Aufzugs- und Fahrtreppendaten der Bahn ist für Schömpingbach Hbf kein Aufzug verzeichnet, nur 2 Fahrtreppen. Ob es dort einen Aufzug gibt, den die Bahn nicht führt, kann ich daraus nicht sagen."
          : "DB's lift and escalator data lists no lift for Schömpingbach Hbf, only 2 escalators. Whether the station has a lift DB does not list, I cannot tell from this.");
        expect(query("listStationFacilities").slice(-2)).toEqual([{ kind: "elevator", limit: "20", lang: language }, { limit: "50", lang: language }]);
      });
    }
  });

  it("describe_station lists the lifts out of service first, then by kind and track, a unit without a place said so", async () => {
    const f = (id: string, kind: string, position: string | null, state: string) => ({ id, kind, position, state, sourceFamily: "fasta" });
    serve("listStationFacilities", { station: { name: "Schömpingbach Hbf" }, counts: { active: 2, inactive: 1, unknown: 1 },
      facilities: [f("1", "elevator", "zu Gleis 2", "active"), f("2", "escalator", "Westseite", "unknown"), f("3", "elevator", "zu Gleis 1", "active"), f("4", "escalator", "zu Gleis 9", "inactive")] });
    const text = body(await call("describe_station", { station: "Schömpingbach Hbf", departures: 0, language: "en" })).split("\n");
    expect(text.slice(4, 8)).toEqual(["- Escalator (Platform 9): out of service", "- Escalator (no location given): state unknown", "- Lift (Platform 1): in service", "- Lift (Platform 2): in service"]);
  });

  it("describe_station with no departures asked reads no board", async () => {
    const r = await call("describe_station", { station: "Schömpingbach Hbf", departures: 0, language: "en" });
    expect(ops().sort()).toEqual(["listStationFacilities", "listStations"]);
    expect(body(r)).toBe([
      "Schömpingbach Hbf", "Schleswig-Holstein · EVA 8001001", "",
      "Lifts and escalators (As of 2026-03-29 14:00):", "- Escalator (Platform 1): state unknown", "- Escalator (Platform 2): state unknown", "",
      "Parking and charging:", "- Car parks and charging points nearby: find_parking or find_charging_station with lat 48.38815, lon 7.51821.",
    ].join("\n"));
    calls.length = 0;
    await call("describe_station", { station: "Schömpingbach Hbf", departures: 2, language: "en" });
    expect(query("listStationDepartures")).toEqual([{ limit: "2", lang: "en" }]);
  });
});

describe("watch_situation and stop_watch", () => {
  for (const language of LANGS) {
    it(`a watch (${language}): today's sentence, the condition sent as JSON and said back with its defaults, the watch service's credit`, async () => {
      const w = ex<Record<string, unknown>>("getWatch");
      serve("getWatch", { ...w, kind: "road", key: "A1", condition: { event: "any", events: ["restrictions", "jams"] }, note: null, situations: [situation({ road: "A1", headline: "Stau" })] });
      const r = await call("watch_situation", { kind: "road", key: "A1", request: "jams", hours: 2, until: "2026-03-30T05:00:00+02:00", condition: { event: "any" }, language });
      expect(query("getWatch")).toEqual([{ kind: "road", target: "A1", request: "jams", hours: "2", until: "2026-03-30T05:00:00+02:00", condition: '{"event":"any"}', lang: language }]);
      const [line, , credit] = textOf(r).split("\n");
      expect(line).toBe(language === "de"
        ? "Ich beobachte die Straße A1 und melde mich hier. Bedingung: wenn eine Sperrung oder Einschränkung oder ein Stau (gemeldet von der Autobahn GmbH oder der Polizei) neu auftritt, aufgehoben wird oder sich auflöst. Läuft bis 30.03. 05:00. 1 von 10 Beobachtungen dieser Sitzung belegt. Nur in diesem Chat: Ich kann keine E-Mail, keine Nachricht und keinen Alarm außerhalb dieses Gesprächs schicken. Wenn die Sitzung endet, endet die Beobachtung. Zum Beenden: stop_watch mit viafrei://watch/1."
        : "I am watching road A1 and will tell you here. Condition: when a closure or restriction or a jam (reported by the Autobahn GmbH or the police) appears, is lifted or clears. It runs until 2026-03-30 05:00. 1 of 10 watches in use for this session. In this chat only: I cannot send an e-mail, a message or any alert outside this conversation. When the session ends, the watch ends with it. To end it: stop_watch with viafrei://watch/1.");
      expect(credit).toMatch(new RegExp(`^${language === "de" ? "Quelle" : "Source"}: Beobachtung: ViaFrei, eigener Dienst`, "u"));
      expect(r.structuredContent).toMatchObject({ uri: "viafrei://watch/1", watchId: 1, kind: "road", key: "A1", condition: { event: "any", events: ["restrictions", "jams"] }, expiresAt: "2026-03-30T03:00:00.000Z", openWatches: 1, maxWatches: 10, scope: "session", externalChannels: false });
      expect((r._meta as Record<string, unknown>)["conditionNote"]).toBeUndefined();
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

  it("the slots count the watches open now, not the id; the condition the platform applied is given with its defaults", async () => {
    const { client, close } = await connect();
    try {
      serve("getWatch", { ...ex<Record<string, unknown>>("getWatch"), condition: { event: "any" }, note: null });
      await client.callTool({ name: "watch_situation", arguments: { kind: "road", key: "A1", language: "de" } });
      await client.callTool({ name: "watch_situation", arguments: { kind: "road", key: "A2", language: "de" } });
      await client.callTool({ name: "stop_watch", arguments: { watch_id: 1, language: "de" } });
      const r = (await client.callTool({ name: "watch_situation", arguments: { kind: "road", key: "A3", language: "de" } })) as CallToolResult;
      expect(textOf(r)).toContain(" 2 von 10 Beobachtungen dieser Sitzung belegt. ");
      expect(textOf(r)).toContain("Zum Beenden: stop_watch mit viafrei://watch/3.");
      expect(r.structuredContent).toMatchObject({ watchId: 3, openWatches: 2, condition: { event: "any", events: ["restrictions"] } });
    } finally {
      await close();
    }
  });

  it("stop_watch finds a watch by uri or by kind and key; an unknown one is an error", async () => {
    const { client, close } = await connect();
    try {
      const uri = ex<{ uri: string }>("getWatch").uri;
      await client.callTool({ name: "watch_situation", arguments: { kind: "road", key: "A1", language: "en" } });
      await client.callTool({ name: "watch_situation", arguments: { kind: "road", key: "A2", language: "de" } });
      const byUri = (await client.callTool({ name: "stop_watch", arguments: { uri, language: "de" } })) as CallToolResult;
      expect(textOf(byUri).split("\n")[0]).toBe("Beobachtung beendet: viafrei://watch/1. Ich melde mich dazu nicht mehr.");
      expect(byUri.isError).toBeUndefined();
      const byKey = (await client.callTool({ name: "stop_watch", arguments: { kind: "road", key: "A103", language: "en" } })) as CallToolResult;
      expect(textOf(byKey).split("\n")[0]).toBe("Watch ended: road A103 (viafrei://watch/2). You will hear nothing further about it.");
      for (const language of LANGS) {
        const gone = (await client.callTool({ name: "stop_watch", arguments: { watch_id: 1, language } })) as CallToolResult;
        expect(gone.isError).toBeUndefined();
        expect(textOf(gone).split("\n")[0]).toBe(language === "de"
          ? "Zu viafrei://watch/1 läuft in dieser Sitzung keine Beobachtung — entweder ist sie schon beendet oder abgelaufen, oder diese Nummer gehört nicht zu diesem Gespräch. Die offenen Beobachtungen stehen in viafrei://watches."
          : "There is no watch at viafrei://watch/1 in this session — it has already been stopped or has expired, or that number belongs to a different conversation. viafrei://watches lists the open ones.");
      }
      const none = (await client.callTool({ name: "stop_watch", arguments: { kind: "road", key: "A9", language: "en" } })) as CallToolResult;
      expect(none.isError).toBeUndefined();
      expect(textOf(none).split("\n")[0]).toBe("No watch on that is running in this session — none is open at all, so there is nothing to stop. A watch belongs to the session it was opened in: if the connection has been re-opened since, it expired with the old session and reports nothing more.");
      expect(none.structuredContent).toMatchObject({ stopped: false, scope: "session", matched: 0, candidates: [] });
    } finally {
      await close();
    }
  });
});

describe("the credit footer and _meta of a tool answer", () => {
  it("names the sources, the licence and the data time in Berlin", async () => {
    const r = await call("find_cheapest_fuel", { ...at, language: "de" });
    expect(footer(r)).toBe("Quelle: Synthetic data from family gamma, licence CC BY 4.0. (https://gamma.example/terms/tankerkoenig_gamma; Lizenz: CC BY 4.0, https://licences.example/cc-by-4-0) · Stand 30.03. 01:57");
    expect(meta(r)).toEqual({
      attribution: "Synthetic data from family gamma, licence CC BY 4.0. (https://gamma.example/terms/tankerkoenig_gamma; Lizenz: CC BY 4.0, https://licences.example/cc-by-4-0)",
      license: "CC BY 4.0",
      licenses: { tankerkoenig_gamma: "CC BY 4.0" },
      asOf: "2026-03-29T23:57:30Z",
      asOfLocal: "30.03.2026, 01:57",
      sources: ["tankerkoenig_gamma"],
      purposeNote: "For consumer information only (synthetic).",
    });
  });

  it("a place found by name credits the place search's row after the answer's own, and never moves the data time; coordinates credit nothing more", async () => {
    const place = { family: "gazetteer_x", text: "Ortsdaten: Gazetteer X", licence: "CC BY 4.0", shareAlike: false };
    serve("listPlaces", ex<unknown[]>("listPlaces"), { attribution: [place], asOf: "2020-01-01T00:00:00Z" });
    const named = await call("find_cheapest_fuel", { place: "Köln", language: "de" });
    expect(footer(named)).toBe("Quelle: Synthetic data from family gamma, licence CC BY 4.0. (https://gamma.example/terms/tankerkoenig_gamma; Lizenz: CC BY 4.0, https://licences.example/cc-by-4-0) · Ortsdaten: Gazetteer X · Stand 30.03. 01:57");
    expect(meta(named)["sources"]).toEqual(["tankerkoenig_gamma", "gazetteer_x"]);
    expect(meta(named)["asOf"]).toBe("2026-03-29T23:57:30Z");
    expect(footer(await call("find_cheapest_fuel", { ...at, language: "de" }))).toBe("Quelle: Synthetic data from family gamma, licence CC BY 4.0. (https://gamma.example/terms/tankerkoenig_gamma; Lizenz: CC BY 4.0, https://licences.example/cc-by-4-0) · Stand 30.03. 01:57");
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

describe("stop_watch in today's words: by number, uri or subject, among this session's watches only", () => {
  const first = (r: unknown): string => textOf(r as CallToolResult).split("\n")[0]!;
  const open = async (client: Awaited<ReturnType<typeof connect>>["client"], kind: string, key: string, stored: string) => {
    serve("getWatch", { ...ex<Record<string, unknown>>("getWatch"), kind, key: stored });
    await client.callTool({ name: "watch_situation", arguments: { kind, key, language: "de" } });
  };
  const stop = async (client: Awaited<ReturnType<typeof connect>>["client"], args: Record<string, unknown>) =>
    (await client.callTool({ name: "stop_watch", arguments: args })) as CallToolResult;

  it("names nothing, both an id and a subject, both an id and a uri, or no watch address: refused as before, nothing stopped", async () => {
    const { client, close } = await connect();
    try {
      await open(client, "road", "A1", "A1");
      for (const [args, text] of [
        [{ language: "de" }, "Bitte die Beobachtung nennen, die beendet werden soll: `watch_id` (die Nummer), `uri` (\"viafrei://watch/12\") oder ihren Gegenstand als `kind` und/oder `key` (\"A8\"). viafrei://watches listet die offenen Beobachtungen dieser Sitzung."],
        [{ watch_id: 1, key: "A1", language: "en" }, "Give either the watch's id (`watch_id` or `uri`) or its subject (`kind`/`key`), not both — if they disagree I would be stopping a watch nobody named."],
        [{ watch_id: 1, uri: "viafrei://watch/1", language: "en" }, "Give either `watch_id` or `uri`, not both — if they disagree I would be stopping a watch nobody named."],
        [{ uri: "https://alpha.example/1", language: "de" }, "Das ist keine Beobachtungs-Adresse. Erwartet wird \"viafrei://watch/12\" oder die Nummer in `watch_id`."],
      ] as const) {
        const r = await stop(client, args);
        expect(r.isError).toBe(true);
        expect(textOf(r)).toBe(text);
      }
      expect(JSON.parse(((await client.readResource({ uri: "viafrei://watches" })).contents[0] as { text: string }).text)).toHaveLength(1);
    } finally {
      await close();
    }
  });

  it("a road in another spelling is the same subject; nothing matching lists what is open, with its credit", async () => {
    const { client, close } = await connect();
    try {
      await open(client, "road", "A7", "A7");
      await open(client, "place", "Fulda", "48.24375,7.01625");
      const none = await stop(client, { kind: "road", key: "A9", language: "de" });
      expect(first(none)).toBe("Dazu läuft in dieser Sitzung keine Beobachtung. Offen sind: watch_id 1 (viafrei://watch/1) für die Straße A7; watch_id 2 (viafrei://watch/2) für den Ort 48.24375,7.01625. Zum Beenden einer davon: stop_watch mit ihrer watch_id.");
      expect(textOf(none)).toMatch(/\n\nQuelle: Beobachtung: ViaFrei, eigener Dienst — jede Meldung nennt die Quelle der Daten, die sie ausgelöst haben \/ Watch: ViaFrei, our own service — every report names the source of the data behind it \(https:\/\/viafrei\.de\) · Stand /u);
      expect(none.structuredContent).toMatchObject({ stopped: false, matched: 0, candidates: [{ watchId: 1, kind: "road", key: "A7" }, { watchId: 2, kind: "place" }], license: "ViaFrei service metadata (no provider data)" });
      const road = await stop(client, { key: "a 07", language: "de" });
      expect(first(road)).toBe("Beobachtung für die Straße A7 beendet (viafrei://watch/1). Ich melde mich dazu nicht mehr.");
      expect(road.structuredContent).toMatchObject({ watchId: 1, stopped: true, matched: 1, matchedBy: "subject" });
      const place = await stop(client, { key: "fulda", language: "en" });
      expect(first(place)).toBe("Watch ended: place 48.24375,7.01625 (viafrei://watch/2). You will hear nothing further about it.");
      await open(client, "weather", "Dresden", "805083000");
      expect(first(await stop(client, { key: "dresden", language: "de" }))).toBe("Beobachtung für die Wetterlage für 805083000 beendet (viafrei://watch/3). Ich melde mich dazu nicht mehr.");
    } finally {
      await close();
    }
  });

  it("a station named another way is resolved as watch_situation resolved it; an id-keyed kind alone stops the only one, never one of several", async () => {
    const { client, close } = await connect();
    try {
      await open(client, "station", "8001001", "1:de:01002:9001");
      const resolved = await stop(client, { kind: "station", key: "Schömpingbach Hauptbahnhof", language: "en" });
      expect(first(resolved)).toBe("Watch ended: stop 1:de:01002:9001 (viafrei://watch/1). You will hear nothing further about it.");
      expect(resolved.structuredContent).toMatchObject({ matchedBy: "resolved" });
      await open(client, "charger", "site-1", "site-1");
      serve("listStations", []);
      const kindOnly = await stop(client, { kind: "charger", key: "Regensburg", language: "de" });
      expect(first(kindOnly)).toBe('Keine offene Beobachtung trägt den Schlüssel "Regensburg"; die einzige offene dieser Art ist die Beobachtung für den Ladestandort site-1 (viafrei://watch/2), deshalb habe ich sie beendet. Ich melde mich dazu nicht mehr.');
      expect(kindOnly.structuredContent).toMatchObject({ matchedBy: "kind" });
      await open(client, "charger", "site-3", "site-3");
      await open(client, "charger", "site-4", "site-4");
      const several = await stop(client, { kind: "charger", key: "Ulm", language: "en" });
      expect(first(several)).toBe('No open watch has the key "Ulm", and several of that kind are open, so I have stopped none: watch_id 3 (viafrei://watch/3) on charging site site-3; watch_id 4 (viafrei://watch/4) on charging site site-4. Choose one and call stop_watch with its watch_id.');
      const both = await stop(client, { kind: "charger", language: "de" });
      expect(first(both)).toBe("Dazu passen mehrere Beobachtungen, deshalb habe ich keine beendet: watch_id 3 (viafrei://watch/3) für den Ladestandort site-3; watch_id 4 (viafrei://watch/4) für den Ladestandort site-4. Bitte eine wählen und stop_watch mit ihrer watch_id aufrufen.");
      await open(client, "road", "A8", "A8");
      expect(first(await stop(client, { kind: "road", key: "A9", language: "en" }))).toMatch(/^No watch on that is running in this session\. Open are: /u);
    } finally {
      await close();
    }
  });
});

describe("watch_situation's answer: the condition said back, what a name became, a note said first", () => {
  it("each kind's condition with its defaults filled in; a number in German with a comma", () => {
    const de = (kind: string, c?: Record<string, unknown>) => conditionSentence(kind, c, "de");
    expect([
      de("road"), de("road", { event: "reopen" }), de("road", { event: "reopen", events: ["jams"] }), de("station"), de("region", { late_share: 0.125 }), de("place", { radius_km: 2.5 }), de("weather", { min_level: 3 }), de("charger"), de("charger", { point_id: "7" }),
    ]).toEqual([
      "Bedingung: wenn eine Sperrung oder Einschränkung neu auftritt oder aufgehoben wird.",
      "Bedingung: nur wenn eine Sperrung oder Einschränkung aufgehoben wird.",
      "Bedingung: nur wenn ein Stau (gemeldet von der Autobahn GmbH oder der Polizei) aufgehoben wird oder sich auflöst.",
      "Bedingung: Abfahrten mit 10 Minuten Verspätung oder mehr.",
      "Bedingung: mindestens 12,5 % der beobachteten Fahrten mit 5 Minuten Verspätung oder mehr, bei mindestens 10 Fahrten.",
      "Bedingung: neue Sperrungen oder Einschränkungen im Umkreis von 2,5 km.",
      "Bedingung: amtliche DWD-Warnungen ab Warnstufe 3.",
      "Bedingung: wenn ein Ladepunkt des Standorts frei wird.",
      "Bedingung: wenn der Ladepunkt 7 frei wird.",
    ]);
    expect([conditionSentence("weather", { min_level: 0 }, "de"), conditionSentence("weather", { min_level: 0 }, "en")]).toEqual([
      "Bedingung: amtliche DWD-Warnungen ab Warnstufe 0.", "Condition: official DWD warnings of level 0 or higher.",
    ]);
    expect([conditionSentence("region", undefined, "en"), conditionSentence("weather", null, "en")]).toEqual([
      "Condition: at least 25 % of observed trips running 5 minutes late or more, over at least 10 trips.",
      "Condition: official DWD warnings of level 2 or higher.",
    ]);
  });

  it("a station named in words says what it became; a place is said by its name; the API's note is said first and carried as the condition note", async () => {
    const w = ex<Record<string, unknown>>("getWatch");
    serve("getWatch", { ...w, kind: "station", key: "1:de:01002:9001", condition: { delay_min: 10 }, note: null });
    const st = await call("watch_situation", { kind: "station", key: "Leipzig Hbf", language: "de" });
    expect(textOf(st).split("\n")[0]).toMatch(/^Ich beobachte die Haltestelle 1:de:01002:9001 und melde mich hier\. Aus "Leipzig Hbf" aufgelöst: Haltestelle Schömpingbach Hbf, DHID 1:de:01002:9001\. Bedingung: Abfahrten mit 10 Minuten/u);
    expect(st.structuredContent).toMatchObject({ resolvedFrom: "Leipzig Hbf", resolvedLabel: "Schömpingbach Hbf" });
    serve("getWatch", { ...w, kind: "place", key: "48.24375,7.01625", condition: { radius_km: 25 }, note: "Ein Stau wird bei einer Orts-Beobachtung nicht gemeldet." });
    const pl = await call("watch_situation", { kind: "place", key: "Fulda", request: "Stau", language: "de" });
    expect(textOf(pl).split("\n")[0]).toMatch(/^Ein Stau wird bei einer Orts-Beobachtung nicht gemeldet\. Ich beobachte den Ort Fulda und melde mich hier\. Bedingung: neue Sperrungen oder Einschränkungen im Umkreis von 25 km\./u);
    expect((pl._meta as Record<string, unknown>)["conditionNote"]).toBe("Ein Stau wird bei einer Orts-Beobachtung nicht gemeldet.");
    expect(st.structuredContent).not.toHaveProperty("conditionNote");
  });
});

describe("watch_situation on a charger named by a place: the nearest listed site that reports live", () => {
  const site = (id: string, availableNow: number | null, distanceM = 2985) => ({ ...ex<Record<string, unknown>[]>("listChargingOptions")[0], id, name: `Site ${id}`, distanceM, summary: { chargePoints: 2, availableNow, maxPowerKw: 50 } });
  it("skips a site with no live status, asks find_charging_station's defaults, says what the place became", async () => {
    serve("listChargingOptions", [site("a", null, 500), site("b", 0, 2985)]);
    serve("getWatch", { ...ex<Record<string, unknown>>("getWatch"), kind: "charger", key: "b", condition: {}, note: null });
    const r = await call("watch_situation", { kind: "charger", key: "Leipzig", language: "de" });
    expect(query("listChargingOptions")).toEqual([{ at: expect.any(String) as string, radius_m: "10000", limit: "5", lang: "de" }]);
    expect(query("getWatch")[0]).toMatchObject({ kind: "charger", target: "b" });
    expect(textOf(r).split("\n")[0]).toContain('Aus "Leipzig" aufgelöst: nächster Ladestandort mit Live-Belegung, Site b (3,0 km entfernt), Standort-ID b. ');
  });
  for (const [sites, reason, words] of [
    [[], "no_site_near", "Im Umkreis von 10 km um "],
    [[site("a", null)], "no_live_site", "meldet kein Ladestandort eine Live-Belegung"],
  ] as const) {
    it(`opens nothing when ${reason}`, async () => {
      serve("listChargingOptions", [...sites]);
      const r = await call("watch_situation", { kind: "charger", key: "Leipzig", language: "de" });
      expect(textOf(r)).toContain(words);
      expect(r.structuredContent).toMatchObject({ watchOpened: false, reason });
      expect(r.isError).not.toBe(true);
      expect(query("getWatch")).toEqual([]);
    });
  }
  it("a site id is the key as given, with no search", async () => {
    serve("getWatch", { ...ex<Record<string, unknown>>("getWatch"), kind: "charger", key: "afir_alpha:cs-01-0001", condition: {}, note: null });
    await call("watch_situation", { kind: "charger", key: "afir_alpha:cs-01-0001", language: "en" });
    expect(query("listChargingOptions")).toEqual([]);
    expect(query("getWatch")[0]).toMatchObject({ target: "afir_alpha:cs-01-0001" });
  });
});

describe("watch_situation: the target is the platform's key, resolved from the person's words", () => {
  const target = async (kind: string, key: string): Promise<string | undefined> => {
    calls.length = 0;
    await call("watch_situation", { kind, key, language: "de" });
    return query("getWatch")[0]?.["target"];
  };
  it("a road as its number; a place and a weather watch on the place's position; a position as given", async () => {
    expect(await target("road", "a 8")).toBe("A8");
    expect(await target("place", "Leipzig")).toBe("48.24375,7.01625");
    expect(query("listPlaces")).toEqual([{ q: "Leipzig", limit: "1", lang: "de" }]);
    expect(await target("weather", "Dresden")).toBe("48.24375,7.01625");
    expect(await target("place", "51.34, 12.37")).toBe("51.34,12.37");
    expect(query("listPlaces")).toEqual([]);
  });
  it("a station on the station the search finds, a station id as given; a region on its official key, a key as given", async () => {
    expect(await target("station", "Leipzig Hbf")).toBe("1:de:01002:9001");
    expect(query("listStations")).toEqual([{ q: "Leipzig Hbf", limit: "1", lang: "de" }]);
    expect(await target("station", "8010205")).toBe("8010205");
    expect(await target("region", "Sachsen")).toBe("14");
    expect(await target("region", "14")).toBe("14");
    expect(await target("charger", "site-7")).toBe("site-7");
  });
  it("a stop or a region not found opens nothing, and says so", async () => {
    serve("listStations", []);
    calls.length = 0;
    const r = await call("watch_situation", { kind: "station", key: "Nirgendwo", language: "de" });
    expect(r).toMatchObject({ isError: true, content: [{ type: "text", text: 'Die Haltestelle "Nirgendwo" kenne ich nicht. Bitte den Namen so nennen, wie er am Schild steht, am besten mit Ort (z. B. "Fulda Bahnhof", "München, Marienplatz"). Es wurde keine Beobachtung geöffnet.' }] });
    expect(query("getWatch")).toEqual([]);
    // A name that carries a town (get_departures' rule): no such stop in that town.
    mockServer.use(handlerFor("listPlaces", (url) => Response.json({ ...exampleOf("listPlaces"), data: url.searchParams.get("q") === "Berlin" ? [{ ...exampleOf<{ data: object[] }>("listPlaces").data[0], name: "Berlin" }] : [] })));
    calls.length = 0;
    const town = await call("watch_situation", { kind: "station", key: "Berlin Alexanderplatz", language: "en" });
    expect(textOf(town)).toBe('I do not know a stop called "Berlin Alexanderplatz" in Berlin. Please give the name as it appears on the sign — I will not answer with a stop of that name in another town. No watch was opened.');
    expect(town.isError).toBe(true);
    const de = await call("watch_situation", { kind: "station", key: "Berlin Alexanderplatz", language: "de" });
    expect(textOf(de)).toBe('In Berlin finde ich keine Haltestelle "Berlin Alexanderplatz". Bitte den Namen so nennen, wie er am Schild steht — eine gleichnamige Haltestelle in einem anderen Ort nenne ich nicht. Es wurde keine Beobachtung geöffnet.');
    expect(query("getWatch")).toEqual([]);
    serve("listPlaces", []);
    const g = await call("watch_situation", { kind: "region", key: "Atlantis", language: "en" });
    expect(textOf(g)).toBe('I could not find the region "Atlantis". No watch was opened.');
    expect(query("getWatch")).toEqual([]);
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

describe("a weather watch where the DWD holds no warn cell", () => {
  for (const language of LANGS) {
    it(`today's answer, no watch opened, not an error (${language})`, async () => {
      mockServer.use(handlerFor("getWatch", () => problem(404, "not-found")));
      const name = ex<{ name: string }[]>("listPlaces")[0]!.name;
      const r = await call("watch_situation", { kind: "weather", key: "Hamburg", language });
      expect(r.isError).toBeUndefined();
      expect(body(r)).toBe(language === "de"
        ? `Für ${name} kenne ich noch keine Warnzelle des DWD — dort wurde bisher keine Warnung geführt —, deshalb öffne ich keine Wetter-Beobachtung, die womöglich nie auslöst. Bitte einen größeren Ort in der Nähe nennen.`
        : `I know no DWD warn cell for ${name} yet — no warning has been held there so far — so I am not opening a weather watch that might never fire. Name a larger town nearby.`);
      expect(r.structuredContent).toMatchObject({ watchOpened: false, reason: "no_warn_cell" });
    });
  }
  it("a road the platform does not know stays the API's refusal", async () => {
    mockServer.use(handlerFor("getWatch", () => problem(404, "not-found")));
    const r = await call("watch_situation", { kind: "road", key: "A999", language: "en" });
    expect(r.isError).toBe(true);
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

  it("check_road_status on a number no register knows: today's road-status refusal, the nearest numbers, nothing else read", async () => {
    notFound("A8");
    register(["A3", "A9"]);
    expect(await call("check_road_status", { road: "a 8", language: "de" })).toEqual({
      content: [{ type: "text", text: "A8 ist keine Bundesautobahn, die ich kenne — weder die Autobahn GmbH noch unser Archiv führen diese Nummer, deshalb kann ich über sie nichts sagen. Nächstliegende Nummern: A3, A9. Bitte prüfen Sie die Nummer." }],
      isError: true,
    });
    notFound("A8");
    register(["A3", "A9"]);
    expect(textOf(await call("check_road_status", { road: "A8", language: "en" }))).toBe("A8 is not a German motorway (Bundesautobahn) I know — neither Autobahn GmbH nor our archive carries that number, so I cannot say anything about it. Nearest real numbers: A3, A9. Please check the number.");
    notFound("A8");
    register([]);
    expect(textOf(await call("check_road_status", { road: "A8", language: "de" }))).toBe("A8 ist keine Bundesautobahn, die ich kenne — weder die Autobahn GmbH noch unser Archiv führen diese Nummer, deshalb kann ich über sie nichts sagen. Bitte prüfen Sie die Nummer.");
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

describe("a place given as a street and house number", () => {
  for (const language of LANGS) {
    it(`is refused in one sentence where no address is held, and searched where addresses are loaded (${language})`, async () => {
      serve("getPlacesCoverage", { kinds: [], lands: [], addresses: [] });
      const refused = await call("find_parking", { place: "Hauptstraße 12, Fulda", language });
      expect(refused.isError).toBe(true);
      expect(textOf(refused)).toBe(language === "de"
        ? "Ich finde Orte, Haltestellen und Autobahnen — keine Hausnummern. Bitte den Ort oder die Haltestelle nennen."
        : "I can find places, stations and motorways, not house numbers. Please name the place or the station.");
      expect(ops()).toEqual(["getPlacesCoverage"]);
      calls.length = 0;
      serve("getPlacesCoverage", { kinds: [], lands: [], addresses: [{ land: "Hessen", dataAsOf: "2026-11-01" }] });
      serve("listPlaces", []);
      await call("find_parking", { place: "Hauptstraße 12, Fulda", language });
      expect(ops().slice(0, 2)).toEqual(["getPlacesCoverage", "listPlaces"]);
    });
  }
});
