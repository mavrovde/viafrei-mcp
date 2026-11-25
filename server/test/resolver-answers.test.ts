/**
 * The answers built from the proposed place resolver and the fields it brings (scratch spec §17, §18): the one
 * place the API names (resolvePlace, read before the place search and skipped where the API does not offer it),
 * a place's Kreis by name, a POI's nearest address and Land, a coordinate's Gemeinde, junction and plaque source.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { HttpResponse } from "msw";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { calls, documentReads, exampleOf, handlerFor, mockServer, offering, problem } from "./api-mock.js";
import { connect, textOf } from "./harness.js";
import { OPERATIONS } from "../src/api/operations.js";
import { log } from "../src/log.js";
import type * as T from "../src/api/types.js";
import { creditWithLinks } from "../src/presentation.js";
import { kreisWord } from "../src/tools/find-place.js";
import { poiLine } from "../src/tools/handlers.js";
import { gemeindeLines, junctionLines, plaqueSource } from "../src/tools/location.js";
import { flixBlock, flixLine } from "../src/tools/flix-words.js";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  calls.length = 0;
  documentReads.length = 0;
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
const geonames = { family: "geonames_x", domain: "places", publisher: "Ortsdaten X", text: "Ortsdaten: X", licence: "CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/", termsUrl: "https://alpha.example/x" };
const resolved = (data: T.ResolvedPlace, status = 200) => mockServer.use(offering(["resolvePlace"]), handlerFor("resolvePlace", () => HttpResponse.json({ data, meta: { ...exampleOf<{ meta: Record<string, unknown> }>("listPlaces").meta, attribution: [geonames] } }, { status })));

describe("resolvePlace", () => {
  it("is a proposed operation: generated with its flag, not in the API's own document", () => {
    expect(OPERATIONS.resolvePlace).toMatchObject({ method: "GET", path: "/v1/places/resolve", query: ["q", "lang"], proposed: true });
    expect("proposed" in OPERATIONS.listPlaces).toBe(false);
  });
  it("names the place: its label and point are the answer's, its sources credited, the place search not read", async () => {
    resolved({ name: "Sylt", label: "Sylt (town), also: Sylt (island)", kind: "municipality", location: { lat: 54.9, lon: 8.3 }, alternatives: [{ name: "Sylt", kind: "island" }] });
    const r = await call("find_hydrogen_station", { place: "Sylt", language: "en" });
    expect(ops()).toEqual(["resolvePlace", "listHydrogenOptions"]);
    expect(calls[0]!.url.searchParams.get("q")).toBe("Sylt");
    expect(calls[1]!.url.searchParams.get("at")).toBe("54.9,8.3");
    expect(textOf(r)).toContain("near Sylt (town), also: Sylt (island) (within");
    expect(textOf(r)).toContain("Ortsdaten: X (https://alpha.example/x; Lizenz: CC BY 4.0");
  });
  it("names no place (null) or is not offered (not in its document, so not asked): the place search is read as before", async () => {
    resolved(null);
    await call("find_hydrogen_station", { place: "Köln", language: "en" });
    expect(ops()).toEqual(["resolvePlace", "listPlaces", "listHydrogenOptions"]);
    calls.length = 0;
    mockServer.resetHandlers();
    await call("find_hydrogen_station", { place: "Köln", language: "en" });
    expect(ops()).toEqual(["listPlaces", "listHydrogenOptions"]);
  });
  it("two place calls on one server against an API without it: one read of its document, no request for it", async () => {
    const { client, close } = await connect();
    try {
      for (const place of ["Köln", "Bonn"]) await client.callTool({ name: "find_hydrogen_station", arguments: { place, language: "en" } });
    } finally {
      await close();
    }
    expect(documentReads.map((u) => u.pathname)).toEqual(["/v1/openapi.json"]);
    expect(ops()).toEqual(["listPlaces", "listHydrogenOptions", "listPlaces", "listHydrogenOptions"]);
  });
  it("a 429 on that read: the place tool answers from the released operations, one warn line, no request for the proposed one", async () => {
    mockServer.use(offering([], () => problem(429, "rate_limited")));
    const warn = vi.spyOn(log, "warn").mockImplementation(() => undefined);
    const { client, close } = await connect();
    try {
      for (let i = 0; i < 2; i++) {
        const r = (await client.callTool({ name: "find_hydrogen_station", arguments: { place: "Köln", language: "en" } })) as CallToolResult;
        expect(r.isError, textOf(r)).not.toBe(true);
      }
    } finally {
      await close();
    }
    const warned = warn.mock.calls.map(([fields]) => fields);
    warn.mockRestore();
    expect(documentReads).toHaveLength(1);
    expect(ops()).toEqual(["listPlaces", "listHydrogenOptions", "listPlaces", "listHydrogenOptions"]);
    expect(warned).toEqual([{ kind: "rate_limited", status: 429, document: "/v1/openapi.json" }]);
  });
  it("any other failure is the API's failure, not a quiet fallback", async () => {
    mockServer.use(offering(["resolvePlace"]), handlerFor("resolvePlace", () => problem(503, "unavailable")));
    const r = await call("find_hydrogen_station", { place: "Köln", language: "en" });
    expect(r.isError).toBe(true);
    expect(ops()).toEqual(["resolvePlace"]);
  });
});

describe("kreisWord (find_place)", () => {
  const row = (o: Partial<T.PlaceItem>): Pick<T.PlaceItem, "kind" | "districtCode" | "districtName"> => ({ kind: "stop", districtCode: "05554004", districtName: "Borken", ...o });
  it("the Kreis by name, a kreisfreie Stadt said so, in both languages", () => {
    expect(kreisWord(row({}), "en")).toBe("district Borken");
    expect(kreisWord(row({}), "de")).toBe("Kreis Borken");
    expect(kreisWord(row({ districtName: "Vogtlandkreis" }), "de")).toBe("Vogtlandkreis");
    expect(kreisWord(row({ districtName: "Region Hannover" }), "de")).toBe("Region Hannover");
    expect(kreisWord(row({ kind: "station_area", districtCode: "09162000", districtName: "München" }), "en")).toBe("independent city München");
    expect(kreisWord(row({ kind: "station_area", districtCode: "09162000", districtName: "München" }), "de")).toBe("kreisfreie Stadt München");
    expect(kreisWord(row({ kind: "municipality", districtCode: "09162000", districtName: null }), "en")).toBe("independent city");
  });
  it("nothing for a city-state, a short key, a kind not in a Kreis, or no name", () => {
    expect(kreisWord(row({ districtCode: "11000000" }), "en")).toBeNull();
    expect(kreisWord(row({ districtCode: "055" }), "en")).toBeNull();
    expect(kreisWord(row({ kind: "district" }), "en")).toBeNull();
    expect(kreisWord(row({ districtName: null }), "en")).toBeNull();
    expect(kreisWord(row({ districtCode: null }), "en")).toBeNull();
    const { districtName: _n, ...noName } = row({});
    expect(kreisWord(noName, "en")).toBeNull();
  });
  it("is said in the find_place line", async () => {
    mockServer.use(handlerFor("listPlaces", () => HttpResponse.json({ ...exampleOf<Record<string, unknown>>("listPlaces"), data: [{ id: "1", name: "Ahaus, Marienplatz", kind: "stop", location: { lat: 52, lon: 7 }, sourceFamily: "x", districtCode: "05554004", districtName: "Borken" }] })));
    expect(textOf(await call("find_place", { query: "Marienplatz", language: "en" }))).toContain("1. Ahaus, Marienplatz — stop, North Rhine-Westphalia, district Borken, 52.");
  });
});

describe("poiLine: nearest address and Land", () => {
  const p = (o: Partial<T.Poi>): T.Poi => ({ name: "Hauptbahnhof", category: "amenity", kind: "bus_station", street: null, number: null, postcode: null, place: null, location: { lat: 53, lon: 8 }, distanceM: 733, ...o });
  // The point (always five decimals) is cut to its start: the line before it is what is tested.
  const cut = (line: string): string => line.replace(/ 53\.0+, 8\.0+$/u, " 53.");
  const near = { street: "Bahnhofsplatz", number: "41", postcode: "281", place: "Bremen", distanceM: 23.4 };
  it("an object without an address: the nearest one, named so, then the Land", () => {
    expect(cut(poiLine(p({ nearestAddress: near, landCode: "04" }), 0, "Bremen", "en"))).toBe("1. Hauptbahnhof — bus station, nearest address Bahnhofsplatz 41, 281 Bremen (23 m), Bremen, 0.7 km from Bremen, 53.");
    expect(poiLine(p({ nearestAddress: near }), 0, null, "de")).toContain("nächste Adresse Bahnhofsplatz 41, 281 Bremen (23 m)");
  });
  it("its own address wins; a Land the address ends with, or one not known, is not said", () => {
    expect(cut(poiLine(p({ street: "Bahnhofsplatz", number: "15", postcode: "281", place: "Bremen", nearestAddress: near, landCode: "04" }), 1, null, "en"))).toBe("2. Hauptbahnhof — bus station, Bahnhofsplatz 15, 281 Bremen, 0.7 km, 53.");
    expect(cut(poiLine(p({ landCode: "99" }), 0, null, "en"))).toBe("1. Hauptbahnhof — bus station, 0.7 km, 53.");
    expect(poiLine(p({ landCode: "09" }), 0, null, "de")).toContain("Busbahnhof, Bayern, 0,7 km");
  });
});

describe("describe_location: Gemeinde, junction, plaque source", () => {
  it("the Gemeinde by key, its Kreis (kreisfrei said so, none for a city-state), the Regierungsbezirk", () => {
    expect(gemeindeLines({ name: "München", code: "09162000", inside: true, kreis: "München", bezirk: "Oberbayern" }, "en")).toEqual(["- Municipality: München", "- District: München (independent city)", "- Government region: Oberbayern"]);
    expect(gemeindeLines({ name: "Ahaus", code: "05554004", inside: false, kreis: "Borken", bezirk: null }, "de")).toEqual(["- Gemeinde (nächster Gemeindepunkt): Ahaus", "- Kreis: Borken"]);
    expect(gemeindeLines({ name: "Berlin", code: "11000000", inside: true, kreis: "Berlin", bezirk: null }, "en")).toEqual(["- Municipality: Berlin"]);
    expect(gemeindeLines({ name: "X", code: "05554004", inside: true, kreis: null, bezirk: null }, "en")).toEqual(["- Municipality: X"]);
  });
  it("the junction with its road and distance; an interchange said as one; a far index row is a floor", () => {
    const j = { name: "München-Steinhausen", road: "A94", location: { lat: 48.1382874, lon: 11.6254465 }, from: "osm" as const };
    expect(junctionLines(j, 48.137, 11.575, "en")).toEqual(["- Junction: München-Steinhausen (A94) (3.7 km)"]);
    expect(junctionLines({ ...j, name: "Kreuz A94", road: "A94" }, 48.137, 11.575, "de")).toEqual(["- Autobahnkreuz/-dreieck: Kreuz A94 (3,7 km)"]);
    expect(junctionLines({ ...j, road: null, from: "gazetteer" }, 48.137, 11.375, "en")).toEqual(["- Junction: München-Steinhausen (18.6 km)", "  The index holds only junctions named in recent traffic reports — a closer one may be missing."]);
    expect(junctionLines({ ...j, from: "gazetteer" }, 48.137, 11.575, "en")).toHaveLength(1);
    // An OpenStreetMap junction is where it is, however far.
    expect(junctionLines(j, 48.137, 11.375, "en")).toHaveLength(1);
  });
  it("the curated entry's source and its open doubt after the plaque", () => {
    const plaque: T.ZonePlaque = { from: "curated_entry", entry: "München", plakette: "green", covered: true };
    expect(plaqueSource(plaque, "en")).toBe("");
    expect(plaqueSource({ ...plaque, sourceName: "UBA list" }, "en")).toBe(" (UBA list)");
    expect(plaqueSource({ ...plaque, sourceName: "UBA list", toVerify: null }, "en")).toBe(" (UBA list)");
    expect(plaqueSource({ ...plaque, sourceName: "UBA list", toVerify: "a diesel ban" }, "en")).toBe(" (UBA list; not confirmed: a diesel ban — check the source)");
    expect(plaqueSource({ ...plaque, sourceName: "UBA-Liste", toVerify: "ein Dieselverbot" }, "de")).toBe(" (UBA-Liste; nicht bestätigt: ein Dieselverbot — bitte an der Quelle nachlesen)");
  });
});

describe("a credit whose register links no licence text", () => {
  it("carries its terms only", () => {
    expect(creditWithLinks({ family: "gbfs_x", text: "Bikesharing: X, CC0 1.0", licence: "CC0 1.0", licenceUrl: null, termsUrl: "https://alpha.example" })).toBe("Bikesharing: X, CC0 1.0 (https://alpha.example)");
  });
});

describe("listStopBoards: the stops around a place in one read", () => {
  const soon = new Date(Date.now() + 10 * 60_000).toISOString();
  const dep = (o: Partial<T.Departure> = {}): T.Departure => ({
    id: "d", journeyId: "j", line: "RB30", mode: "rail", routeType: 2, trainNumber: null, category: null, destination: "Remagen", plannedAt: soon, plannedAtLocal: soon, platform: null, plannedPlatform: null,
    platformChanged: false, realtime: false, realtimeSource: null, cancelled: false, delayMin: null, expectedAt: null, noForecast: false, sourceFamily: "delfi_static", ...o,
  } as T.Departure);
  const boards = (data: T.StopBoards) => mockServer.use(offering(["listStopBoards"]), handlerFor("listStopBoards", () => HttpResponse.json({ data, meta: { ...exampleOf<{ meta: Record<string, unknown> }>("listPlaces").meta, attribution: [geonames] } })));
  const place = { label: "Köln", location: { lat: 50.9, lon: 6.9 } };
  it("the API's stops, its stop_id as the timetable spells it, their departures; nothing else read", async () => {
    boards({ place, window: { from: soon, until: soon }, stops: [{ id: "1:de:1:2", name: "Köln Hbf", stopId: "000009", distanceM: 552, departures: [dep({ plannedAt: soon, line: "RB30", destination: "Remagen" })] }, { id: "1:de:3", name: "Köln Rathaus", stopId: "de:3_G", distanceM: 200, departures: [] }] });
    const r = await call("get_departures", { place: "Köln", language: "en" });
    expect(ops()).toEqual(["listStopBoards"]);
    expect(Object.fromEntries(calls[0]!.url.searchParams)).toEqual({ q: "Köln", radius_m: "5000", limit: "8", per_stop: "4", duration_min: "60", lang: "en" });
    const t = textOf(r);
    expect(t).toMatch(/^The nearest stops around Köln \(within 5 km\)/u);
    expect(t).toContain("Köln Hbf (0.6 km) — stop_id 000009:\n  ");
    expect(t).toContain("RB30 → Remagen");
    expect(t).toMatch(/Köln Rathaus \(0\.2 km\) — stop_id de:3_G:\n {2}no departure until/u);
    expect(t).toContain("More departures of one stop: get_departures with its stop_id.");
    expect(t).toContain("Ortsdaten: X");
  });
  it("a position is sent as at; no stop near is said as none", async () => {
    boards({ place, window: { from: soon, until: soon }, stops: [] });
    const r = await call("get_departures", { lat: 50.9, lon: 6.9, limit: 10, language: "en" });
    expect(calls[0]!.url.searchParams.get("at")).toBe("50.9,6.9");
    expect(calls[0]!.url.searchParams.get("q")).toBeNull();
    expect(calls[0]!.url.searchParams.get("per_stop")).toBe("4");
    expect(ops()).toEqual(["listStopBoards"]);
    expect(textOf(r)).not.toContain("stop_id");
  });
  it("read one by one, each stop's board holds today's 4 departures whatever limit the client sends (its default 10)", async () => {
    await call("get_departures", { place: "Köln", limit: 10, language: "en" });
    const boards = calls.filter((c) => c.operationId === "listStationDepartures");
    expect(boards.length).toBeGreaterThan(0);
    expect(boards.map((c) => c.url.searchParams.get("limit"))).toEqual(boards.map(() => "4"));
  });
  it("not offered (not asked) or no place named (null): the stops are read one by one as before; another failure is the API's", async () => {
    await call("get_departures", { place: "Köln", language: "en" });
    expect(ops()[0]).toBe("listPlaces");
    expect(ops()).not.toContain("listStopBoards");
    calls.length = 0;
    boards(null);
    await call("get_departures", { place: "Köln", language: "en" });
    expect(ops().slice(0, 2)).toEqual(["listStopBoards", "listPlaces"]);
    calls.length = 0;
    mockServer.use(offering(["listStopBoards"]), handlerFor("listStopBoards", () => problem(503, "unavailable")));
    const r = await call("get_departures", { place: "Köln", language: "en" });
    expect(r.isError).toBe(true);
    expect(ops()).toEqual(["listStopBoards"]);
  });
  it("with the FlixBus/FlixTrain block after the stops", async () => {
    const flix: T.LongDistance = { operator: "FlixBus/FlixTrain", realtime: true, radiusM: 5000, departures: [{ at: soon, line: "FlixBus N86", mode: "coach", destination: null, operator: "x", stop: { id: "s", name: "Leipzig central", distanceM: 191 }, cancelled: false, delayMin: 0, expectedAt: soon }] };
    boards({ place, window: { from: soon, until: soon }, stops: [{ id: "1:a", name: "A", stopId: "a", distanceM: 5, departures: [] }], longDistance: flix });
    const lines = textOf(await call("get_departures", { place: "Leipzig", language: "de" })).split("\n");
    const i = lines.indexOf("Mehr Abfahrten einer Haltestelle: get_departures mit ihrer stop_id.");
    expect(lines[i + 1]).toBe("FlixBus/FlixTrain im Umkreis von 5 km (1):");
    expect(lines[i + 2]).toMatch(/^- \d\d:\d\d Fernbus FlixBus N86, ab Leipzig central \(191 m\) — pünktlich$/u);
    expect(lines[i + 3]).toBe("Buchung und Preise nur bei FlixBus selbst; die Echtzeit ist FlixBus' eigene Prognose.");
  });
});

describe("flixLine and flixBlock (today's FlixBus/FlixTrain block)", () => {
  const now = new Date("2026-03-30T10:00:00Z");
  const d: T.LongDistanceDeparture = { at: "2026-03-30T11:05:00Z", line: "FlixBus N86", mode: "coach", destination: "Berlin", operator: null, stop: { id: "s", name: "ZOB", distanceM: 191 }, cancelled: false, delayMin: 3, expectedAt: "2026-03-30T11:08:00Z" };
  it("delay with the expected time, early, on time, cancelled, timetable time, a train, no line", () => {
    expect(flixLine(d, true, now, "en")).toBe("- 13:05 coach FlixBus N86 to Berlin, from ZOB (191 m) — +3 min (expected 13:08)");
    expect(flixLine({ ...d, delayMin: -2 }, true, now, "en")).toBe("- 13:05 coach FlixBus N86 to Berlin, from ZOB (191 m) — -2 min (expected 13:08)");
    expect(flixLine({ ...d, delayMin: -2 }, true, now, "de")).toBe("- 13:05 Fernbus FlixBus N86 nach Berlin, ab ZOB (191 m) — -2 min (erwartet 13:08)");
    expect(flixLine({ ...d, delayMin: 0 }, true, now, "en")).toBe("- 13:05 coach FlixBus N86 to Berlin, from ZOB (191 m) — on time");
    expect(flixLine({ ...d, cancelled: true }, true, now, "de")).toBe("- 13:05 Fernbus FlixBus N86 nach Berlin, ab ZOB (191 m) — fällt aus");
    expect(flixLine({ ...d, delayMin: null }, true, now, "en")).toBe("- 13:05 coach FlixBus N86 to Berlin, from ZOB (191 m) — timetable time");
    expect(flixLine({ ...d, delayMin: null }, false, now, "en")).toBe("- 13:05 coach FlixBus N86 to Berlin, from ZOB (191 m)");
    expect(flixLine({ ...d, expectedAt: null }, false, now, "en")).toBe("- 13:05 coach FlixBus N86 to Berlin, from ZOB (191 m)");
    expect(flixLine({ ...d, mode: "train", destination: null }, true, now, "en")).toContain("- 13:05 FlixTrain, from ZOB");
    expect(flixLine({ ...d, line: "" }, true, now, "en")).toContain("- 13:05 coach to Berlin");
  });
  it("the block: head with count and radius, the note by realtime; nothing where none is near", () => {
    const b: T.LongDistance = { operator: "FlixBus/FlixTrain", realtime: false, radiusM: 2500, departures: [d] };
    expect(flixBlock(b, now, "en")).toEqual(["FlixBus/FlixTrain within 2.5 km (1):", flixLine(d, false, now, "en"), "No current realtime from FlixBus: timetable times. Booking and fares only with FlixBus itself; the realtime is FlixBus' own prediction."]);
    expect(flixBlock({ ...b, radiusM: 2500 }, now, "de")[0]).toBe("FlixBus/FlixTrain im Umkreis von 2,5 km (1):");
    expect(flixBlock({ ...b, departures: [] }, now, "en")).toEqual([]);
    expect(flixBlock(null, now, "en")).toEqual([]);
    expect(flixBlock(undefined, now, "en")).toEqual([]);
  });
});
