/**
 * describe_station from the proposed getStationPage: the page's sections in today's words (describe_station),
 * read first and skipped where the API does not offer it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as T from "../src/api/types.js";
import { ApiError } from "../src/api/client.js";
import { HANDLERS } from "../src/tools/handlers.js";
import { departureLine, liftLabel, pageFromApi, platformLabel, railReasonLine, shareAlikeSubjectOf, stationPageSectionsText, LIST_SHOWN } from "../src/tools/station-sections.js";

const NOW = new Date("2026-03-30T10:00:00Z");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

type Page = NonNullable<T.StationPage>;
const sec = (id: T.StationPageSection["id"], o: Partial<T.StationPageSection> = {}): T.StationPageSection => ({ id, asOf: "2026-03-30T09:58:00Z", sources: [], ...o });
const page = (sections: T.StationPageSection[]): Page => ({ station: { name: "Köln Hbf" }, pageUrl: "https://alpha.example/en/station/koeln-hbf", sections });
const dep = (o: Partial<T.StationPageDeparture> = {}): T.StationPageDeparture => ({ planned: "2026-03-30T10:05:00Z", line: "S11", destination: "Dormagen", platform: "11 B-C", plannedPlatform: null, delayMin: 0, cancelled: false, noForecast: false, replacementBus: false, ...o });
const lift = (o: Partial<T.StationPageLift> = {}): T.StationPageLift => ({ kind: "elevator", description: "zu Gleis 1", tracks: ["1"], state: "active", reason: null, resumeAt: null, ...o });
const text = (sections: T.StationPageSection[], language: "de" | "en" = "en"): string[] => stationPageSectionsText(page(sections), language, NOW).split("\n");

describe("the header and the rail lamp", () => {
  it("name, the page link, then address · Land · category · EVA; a missing fact left out", () => {
    expect(text([sec("header", { name: "Köln Hbf", street: "Trankgasse 11", zipcode: "50667", city: "Köln", land: "North Rhine-Westphalia", category: 1, evaNo: "101" })]))
      .toEqual(["Köln Hbf — Station page: https://alpha.example/en/station/koeln-hbf", "Trankgasse 11, 50667 Köln · North Rhine-Westphalia · station category 1 (Bahnhofskategorie) · EVA 101"]);
    expect(text([sec("header", { street: null, zipcode: null, city: "Köln", category: null, evaNo: null })], "de")).toEqual(["Köln Hbf — Bahnhofsseite: https://alpha.example/en/station/koeln-hbf", "Köln"]);
    expect(text([sec("header", {})])).toEqual(["Köln Hbf — Station page: https://alpha.example/en/station/koeln-hbf"]);
  });
  it("the lamp with its reasons and the lamp per line; green and too few said as today", () => {
    const t = text([sec("rail_ampel", { lamp: "red", reasons: [{ kind: "line", lamp: "red", line: "18", long: false }, { kind: "cancelled", n: 2, of: 17, side: "dep" }], lines: [{ line: "5", long: false, lamp: "unknown" }, { line: "ICE", long: true, lamp: "green" }] })]);
    expect(t).toEqual(["", "Rail lamp: Red — Line 18: Red · Cancelled: 2 of 17 (departures) (As of 11:58)", "Lamp per line: 5 Grey, Long-distance Green"]);
    expect(text([sec("rail_ampel", { lamp: "green" })])[1]).toBe("Rail lamp: Green — Nothing reported by our sources – no guarantee (As of 11:58)");
    expect(text([sec("rail_ampel", { lamp: "unknown", reasons: [] })], "de")[1]).toBe("Bahn-Ampel: Grau — Zu wenige Fahrten für eine Aussage (Stand 11:58)");
    expect(text([sec("rail_ampel", {})])).toHaveLength(2);
  });
  it("each reason", () => {
    expect(railReasonLine({ kind: "late", n: 3, of: 9, side: "arr" }, "en")).toBe("More than 5 min late: 3 of 9 (arrivals)");
    expect(railReasonLine({ kind: "late", n: 3, of: 9, side: "both" }, "de")).toBe("Mehr als 5 Min. verspätet: 3 von 9");
    expect(railReasonLine({ kind: "cancelled", n: 1, of: 4 }, "en")).toBe("Cancelled: 1 of 4");
    expect(railReasonLine({ kind: "median", min: 7 }, "en")).toBe("Median delay: 7 min");
    expect(railReasonLine({ kind: "platform", n: 2 }, "de")).toBe("Gleiswechsel: 2");
    expect(railReasonLine({ kind: "alert", n: 1 }, "en")).toBe("Disruption notices: 1");
    expect(railReasonLine({ kind: "sight" }, "en")).toBe("Limited view: real-time data may be out of date");
    expect(railReasonLine({ kind: "line", line: "RE1", lamp: "yellow" }, "de")).toBe("Linie RE1: Gelb");
    expect(railReasonLine({ kind: "line", long: true, lamp: "red" }, "en")).toBe("Line Long-distance: Red");
  });
});

describe("step-free now, the lifts, the platforms", () => {
  it("confirmed, unknown-lift and blocked platforms each on their own line; the heading claims nothing without a confirmed one", () => {
    const p = (tracks: string[], lift: "ok" | "unknown" | "none" | "out"): T.StationPagePlatform => ({ tracks, name: null, lift });
    expect(text([sec("step_free_now", { platforms: [p(["1"], "ok"), p(["2", "3"], "none"), p(["4"], "unknown")], blocked: [p(["5"], "out")] })]))
      .toEqual(["", "Step-free now (As of 11:58):", "- step-free: Platform 1, Platform 2/3", "- step-free per inventory, lift state unknown: Platform 4", "- not step-free right now, lift out of service: Platform 5"]);
    expect(text([sec("step_free_now", { platforms: [p(["4"], "unknown")] })])[1]).toBe("Step-free access (As of 11:58):");
    expect(text([sec("step_free_now", { platforms: [], blocked: [], steplessAccess: "partial" })], "de")).toEqual(["", "Stufenfreier Zugang (Stand 11:58):", "- Stufenfreier Zugang laut DB: teilweise"]);
    expect(text([sec("step_free_now", { platforms: [p(["1"], "ok")], steplessAccess: "no" })])).toHaveLength(3);
    expect(text([sec("step_free_now", { steplessAccess: "unknown" })])).toHaveLength(2);
  });
  it("a lift's line: its label, state, reason and when it is back; the list cut at twenty", () => {
    expect(text([sec("lifts", { units: [lift({ state: "inactive", reason: "Reparatur", resumeAt: "2026-03-30T14:00:00Z" }), lift({ kind: "escalator", state: "unknown", tracks: [] , description: null })] })]))
      .toEqual(["", "Lifts and escalators (As of 11:58):", "- Lift (Platform 1): out of service (reason: Reparatur; expected back 16:00)", "- Escalator (no location given): state unknown"]);
    expect(text([sec("lifts", { units: [lift({ resumeAt: "2026-03-30T14:00:00Z" })] })], "de")[2]).toBe("- Aufzug zu Gleis 1: in Betrieb (zurück voraussichtlich 16:00)");
    const many = text([sec("lifts", { units: Array.from({ length: LIST_SHOWN + 3 }, () => lift()) })]);
    expect(many).toHaveLength(LIST_SHOWN + 3);
    expect(many[LIST_SHOWN + 2]).toBe("… and 3 more");
    expect(text([sec("lifts", { units: [] })])).toEqual([""]);
  });
  it("labels: German words on a German answer, else tracks; an unknown kind is a unit", () => {
    expect(liftLabel(lift({ description: "" }), "de")).toBe("Aufzug (Gleis 1)");
    expect(liftLabel(lift({ kind: "travelator" }), "en")).toBe("Moving walkway (Platform 1)");
    expect(liftLabel(lift({ kind: "x" }), "en")).toBe("Unit (Platform 1)");
    expect(platformLabel({ tracks: [], name: "Bahnsteig Nord" }, "en")).toBe("Bahnsteig Nord");
    expect(platformLabel({ tracks: [], name: null }, "de")).toBe("Gleis");
  });
  it("a platform's step-free fact and its height", () => {
    expect(text([sec("platforms", { platforms: [{ tracks: ["1"], name: null, stepFree: "yes", heightCm: { min: 76, max: 76 } }, { tracks: ["2"], name: null, stepFree: "no", heightCm: { min: 38, max: 55 } }, { tracks: ["3"], name: null, heightCm: null }] })]))
      .toEqual(["", "Platforms (As of 11:58):", "- Platform 1: step-free, platform height 76 cm", "- Platform 2: not step-free, platform height 38–55 cm", "- Platform 3: step-free access unknown"]);
    expect(text([sec("platforms", { platforms: [{ tracks: ["1"], name: null, stepFree: "partial" }] })], "de")[2]).toBe("- Gleis 1: teilweise stufenfrei");
    expect(text([sec("platforms", {})])).toEqual([""]);
  });
});

describe("the board, the alerts, parking", () => {
  it("a departure's state, platform change and replacement bus", () => {
    expect(departureLine(dep(), NOW, "en")).toBe("- 12:05 S11 → Dormagen, Platform 11 B-C: on time");
    expect(departureLine(dep({ delayMin: 6 }), NOW, "en")).toMatch(/: \+6 min$/u);
    expect(departureLine(dep({ delayMin: -1 }), NOW, "en")).toMatch(/: -1 min$/u);
    expect(departureLine(dep({ cancelled: true, delayMin: 6 }), NOW, "de")).toMatch(/: fällt aus$/u);
    expect(departureLine(dep({ delayMin: null }), NOW, "en")).toMatch(/: timetable only$/u);
    expect(departureLine(dep({ delayMin: null, noForecast: true }), NOW, "en")).toMatch(/: no delay figure$/u);
    expect(departureLine(dep({ platform: "2", plannedPlatform: "3" }), NOW, "de")).toBe("- 12:05 S11 → Dormagen, Gleis 2 (statt 3): pünktlich");
    expect(departureLine(dep({ platform: null, destination: null, replacementBus: true, line: "S1" }), NOW, "en")).toBe("- 12:05 rail replacement S1: on time");
    expect(departureLine(dep({ line: null }), NOW, "en")).toBe("- 12:05  → Dormagen, Platform 11 B-C: on time");
    expect(text([sec("departures", { rows: [dep()] })])).toEqual(["", "Departures (As of 11:58):", "- 12:05 S11 → Dormagen, Platform 11 B-C: on time"]);
    expect(text([sec("departures", { rows: [] })])).toEqual([""]);
  });
  it("alerts at the station, on lines, with an end", () => {
    expect(text([sec("service_alerts", { alerts: [{ header: "Aufzug defekt", lines: [], atStation: true, until: "2026-03-30T15:00:00Z" }, { header: "Umleitung", lines: ["5", "16"], atStation: false, until: null }, { header: "Bauarbeiten", lines: [], atStation: false, until: null }] })]))
      .toEqual(["", "Service alerts (As of 11:58):", "- at the station: Aufzug defekt (until 17:00)", "- lines 5, 16: Umleitung", "- Bauarbeiten"]);
    expect(text([sec("service_alerts", { alerts: [] })])).toEqual([""]);
  });
  it("parking: DB's facts and the two tools at the point", () => {
    expect(text([sec("parking_charging", { facilities: ["has_parking", "has_taxi_rank"], point: { lat: 50.943031, lon: 6.958729 } })]))
      .toEqual(["", "Parking and charging:", "- per DB: car park, taxi rank", "- Car parks and charging points nearby: find_parking or find_charging_station with lat 50.94303, lon 6.95873."]);
    expect(text([sec("parking_charging", { facilities: ["has_bicycle_parking"], point: null })], "de")).toEqual(["", "Parken und Laden:", "- laut DB: Fahrradstellplätze"]);
    expect(text([sec("parking_charging", { facilities: [], point: null })])).toEqual([""]);
    expect(text([sec("parking_charging", { facilities: [], point: { lat: 1, lon: 2 } })])).toEqual(["", "Parking and charging:", "- Car parks and charging points nearby: find_parking or find_charging_station with lat 1.00000, lon 2.00000."]);
  });
  it("the share-alike subject is the share-alike sections shown", () => {
    const board = (sources: string[]): T.StationPageSection => sec("departures", { sources, rows: [dep()] });
    const alerts = sec("service_alerts", { alerts: [{ header: "x", lines: [], atStation: true, until: null }] });
    expect(shareAlikeSubjectOf(page([board(["delfi_rt_tu"])]), "en")).toBe("The DELFI GTFS-RT realtime entries");
    expect(shareAlikeSubjectOf(page([board(["delfi_siri_et"])]), "de")).toBe("Die Echtzeitangaben aus DELFI SIRI ET");
    expect(shareAlikeSubjectOf(page([board(["delfi_siri_et", "delfi_rt_tu"]), alerts]), "en")).toBe("The DELFI SIRI ET and DELFI GTFS-RT realtime entries and the DELFI service alerts");
    expect(shareAlikeSubjectOf(page([board(["delfi_rt_tu"]), alerts]), "de")).toBe("Die Echtzeitangaben aus DELFI GTFS-RT und die DELFI-Störungsmeldungen");
    expect(shareAlikeSubjectOf(page([board(["db_timetables"]), alerts]), "en")).toBe("The DELFI service alerts");
    expect(shareAlikeSubjectOf(page([board(["db_timetables"]), sec("service_alerts", { alerts: [] })]), "en")).toBeUndefined();
  });
});

/** The page as API 1.2.1 sends it (StationPageEnvelope.data): each section's content under its own key. */
const apiPage = (sections: T.ApiPageSection[]): NonNullable<T.ApiStationPage> => ({ pageUrl: "https://alpha.example/en/station/koeln-hbf", sections });
const apiSec = (id: T.ApiPageSection["id"], o: Partial<T.ApiPageSection> = {}): T.ApiPageSection => ({ id, asOf: "2026-03-30T09:58:00Z", sources: [], ...o });
const apiDep = (o: Partial<NonNullable<T.ApiPageSection["departures"]>[number]> = {}) => ({ plannedAt: "2026-03-30T10:05:00Z", line: "S11", destination: "Dormagen", platform: "11 B-C", plannedPlatform: "11", platformChanged: false, delayMin: 0, cancelled: false, noForecast: false, ...o });

describe("the page as the API sends it", () => {
  it("each section's own key read into the words above; what the API does not carry left out, never guessed", () => {
    const p = pageFromApi(apiPage([
      apiSec("header", { header: { name: "Köln Hbf", stationNo: "1", eva: "8000207", evaNumbers: ["8000207"], slug: "k", street: "Trankgasse 11", zipcode: "50667", city: "Köln", land: "Nordrhein-Westfalen", category: 1 } }),
      apiSec("rail_ampel", { railAmpel: { lamp: "yellow", trips: 9, reasons: [{ kind: "platform", n: 2 }], lines: [{ line: "S11", long: false, lamp: "green" }] } }),
      apiSec("step_free_now", { stepFreeNow: { platforms: [{ tracks: ["1"], name: null, lift: "ok" }], blocked: [], steplessAccess: "odd" } }),
      apiSec("lifts", { asOf: null, lifts: [{ id: "l", kind: "elevator", position: "zu Gleis 1", state: "inactive", equipmentNo: "10" }] }),
      apiSec("platforms", { platforms: { releasedOn: null, stations: [{ name: null, total: 2, list: [{ name: null, tracks: ["1"], stated: true, facts: { stepFree: "yes" }, heightCm: { min: 76, max: 76 } }, { name: "B", tracks: [], stated: false, facts: { stepFree: "no" }, heightCm: null }] }] } }),
      apiSec("departures", { departures: [apiDep(), apiDep({ platform: "12", plannedPlatform: "11", platformChanged: true, delayMin: null, noForecast: true })] }),
      apiSec("service_alerts", { alerts: [{ header: "Bauarbeiten", lines: [], atStation: true, until: null }] }),
      apiSec("parking_charging", { facilities: { flags: ["has_taxi_rank"], location: { lat: 50.9, lon: 6.9 } } }),
    ]), "Köln");
    expect(stationPageSectionsText(p, "en", NOW).split("\n")).toEqual([
      "Köln Hbf — Station page: https://alpha.example/en/station/koeln-hbf",
      "Trankgasse 11, 50667 Köln · Nordrhein-Westfalen · station category 1 (Bahnhofskategorie) · EVA 8000207",
      "", "Rail lamp: Amber — Platform changes: 2 (As of 11:58)", "Lamp per line: S11 Green",
      "", "Step-free now (As of 11:58):", "- step-free: Platform 1",
      "", "Lifts and escalators:", "- Lift to platform 1: out of service",
      "", "Platforms (As of 11:58):", "- Platform 1: step-free, platform height 76 cm", "- B: step-free access unknown",
      "", "Departures (As of 11:58):", "- 12:05 S11 → Dormagen, Platform 11 B-C: on time", "- 12:05 S11 → Dormagen, Platform 12 (instead of 11): no delay figure",
      "", "Service alerts (As of 11:58):", "- at the station: Bauarbeiten",
      "", "Parking and charging:", "- per DB: taxi rank", "- Car parks and charging points nearby: find_parking or find_charging_station with lat 50.90000, lon 6.90000.",
    ]);
    expect(stationPageSectionsText(p, "de", NOW).split("\n")[10]).toBe("- Aufzug zu Gleis 1: außer Betrieb");
    expect(p.sections.find((x) => x.id === "step_free_now")?.steplessAccess).toBeNull();
    expect(pageFromApi(apiPage([apiSec("header")]), "Köln Hbf").station.name).toBe("Köln Hbf");
  });
  it("a section without its own time keeps none: said undated, and the lamp and step-free now left out where nothing is held (never \"too few trips\")", () => {
    const said = (sections: T.ApiPageSection[]): string[] => stationPageSectionsText(pageFromApi(apiPage(sections), "Köln Hbf"), "en", NOW).split("\n");
    const empty = [
      apiSec("rail_ampel", { asOf: null, railAmpel: { lamp: "unknown", trips: 0, reasons: [], lines: [] } }),
      apiSec("step_free_now", { asOf: null, stepFreeNow: { platforms: [], blocked: [], steplessAccess: null } }),
      apiSec("rail_ampel", { asOf: null }), apiSec("step_free_now", { asOf: null }),
    ];
    expect(said(empty)).toEqual([""]);
    expect(said(empty).join("\n")).not.toMatch(/Too few trips|As of/u);
    expect(said([apiSec("rail_ampel", { asOf: null, railAmpel: { lamp: "red", trips: 9, reasons: [{ kind: "alert", n: 1 }], lines: [] } })]))
      .toEqual(["", "Rail lamp: Red — Disruption notices: 1"]);
    expect(said([apiSec("step_free_now", { asOf: null, stepFreeNow: { platforms: [{ tracks: ["2"], name: null, lift: "ok" }], blocked: [], steplessAccess: null } })]))
      .toEqual(["", "Step-free now:", "- step-free: Platform 2"]);
    expect(said([apiSec("departures", { asOf: null, departures: [apiDep()] })])).toEqual(["", "Departures:", "- 12:05 S11 → Dormagen, Platform 11 B-C: on time"]);
    // With its own time, an empty lamp is still today's "too few trips", dated.
    expect(said([apiSec("rail_ampel", { railAmpel: { lamp: "unknown", trips: 0, reasons: [], lines: [] } })])).toEqual(["", "Rail lamp: Grey — Too few trips to judge (As of 11:58)"]);
  });
  it("an English lift line says DB's position where no track is known; \"no location given\" only where DB gives none", () => {
    const unit = (position: string | null) => ({ id: "l", kind: "elevator", position, state: "active" as const, equipmentNo: null });
    const lines = (position: string | null, language: "de" | "en" = "en") => stationPageSectionsText(pageFromApi(apiPage([apiSec("lifts", { lifts: [unit(position)] })]), "K"), language, NOW).split("\n")[2];
    expect(lines("zu Gleis 3/4 - Südsteg")).toBe("- Lift to platform 3/4 - south footbridge: working");
    expect(lines("neben dem Kiosk")).toBe('- Lift Provider text (German): "neben dem Kiosk": working');
    expect(lines(null)).toBe("- Lift (no location given): working");
    expect(lines("")).toBe("- Lift (no location given): working");
    expect(lines("zu Gleis 1", "de")).toBe("- Aufzug zu Gleis 1: in Betrieb");
  });
});

describe("describe_station reads the page first", () => {
  const meta = { generatedAt: "2026-03-30T09:59:00Z", language: "en", asOf: "2026-03-30T09:58:00Z", freshness: [], attribution: [{ family: "db_stada", domain: "x", publisher: "Bahnhofsdaten", text: "Bahnhofsdaten", licence: "CC BY 4.0", licenceUrl: null, shareAlike: false, shareAlikeOffer: null, termsUrl: null, sourceUrl: null }] };
  const run = async (answer: (op: string, q: Record<string, unknown>) => unknown, args: Record<string, unknown> = {}) => {
    const seen: [string, Record<string, unknown>][] = [];
    const get = async (op: string, q: Record<string, unknown>) => {
      seen.push([op, q]);
      if (op === "listStations") return { data: [{ id: "1:k", name: "Köln Hbf", evaNo: "101", location: { lat: 50.9, lon: 6.9 } }], meta };
      return answer(op, q);
    };
    const r = await HANDLERS["describe_station"]!({ station: "Köln Hbf", language: "en", ...args }, { tool: "describe_station", language: "en", api: { get } } as never);
    return { text: (r.content[0] as { text: string }).text, seen, r };
  };
  it("the page's sections, credited by its meta, the board's default ten departures asked; nothing else read", async () => {
    const { text: t, seen } = await run((op) => (op === "getStationPage" ? { data: apiPage([apiSec("header", { header: { name: "Köln Hbf", stationNo: "1", eva: null, evaNumbers: [], slug: "k", street: null, zipcode: null, city: null, land: null, category: null } }), apiSec("departures", { sources: ["delfi_rt_tu"], departures: [apiDep()] })]), meta } : null));
    expect(seen.map(([op]) => op)).toEqual(["listStations", "getStationPage"]);
    expect(seen[1]![1]).toEqual({ stationId: "1:k", departures: 10 });
    expect(t.split("\n").slice(0, 4)).toEqual(["Köln Hbf — Station page: https://alpha.example/en/station/koeln-hbf", "", "Departures (As of 11:58):", "- 12:05 S11 → Dormagen, Platform 11 B-C: on time"]);
    expect(t).toContain("Source: Bahnhofsdaten");
    expect(t).toContain("As of 11:58");
  });
  it("the share-alike sentence names the board's live figures", async () => {
    const sa = { ...meta, attribution: [{ ...meta.attribution[0]!, family: "delfi_rt_tu", text: "Echtzeitdaten", licence: "CC BY-SA", shareAlike: true }] };
    const { text: t } = await run((op) => (op === "getStationPage" ? { data: apiPage([apiSec("departures", { sources: ["delfi_rt_tu"], departures: [apiDep()] })]), meta: sa } : null));
    expect(t).toContain("The DELFI GTFS-RT realtime entries are licensed CC BY-SA");
  });
  it("departures asked are passed on", async () => {
    const { seen } = await run((op) => (op === "getStationPage" ? { data: apiPage([]), meta } : null), { departures: 3 });
    expect(seen[1]![1]).toEqual({ stationId: "1:k", departures: 3 });
  });
  it("not offered (404) or no page (null): the facilities and board are read as before; another failure is the API's", async () => {
    const fallback = (op: string): unknown => {
      if (op === "listStationFacilities") return { data: { station: { name: "Köln Hbf" }, counts: { active: 0, inactive: 0, unknown: 0 }, facilities: [] }, meta };
      if (op === "listStationDepartures") return { data: { station: { name: "Köln Hbf" }, window: { from: "x", until: "y" }, departures: [] }, meta };
      throw new Error(op);
    };
    const a = await run((op) => { if (op === "getStationPage") throw new ApiError("not_found", "x", 404); return fallback(op); });
    expect(a.seen.map(([op]) => op).sort()).toEqual(["getStationPage", "listStationDepartures", "listStationFacilities", "listStations"]);
    const b = await run((op) => (op === "getStationPage" ? { data: null, meta } : fallback(op)));
    expect(b.seen.map(([op]) => op)).toContain("listStationFacilities");
    await expect(run((op) => { if (op === "getStationPage") throw new ApiError("unavailable", "x", 503); return fallback(op); })).rejects.toBeInstanceOf(ApiError);
  });
});
