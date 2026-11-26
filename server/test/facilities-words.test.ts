/**
 * check_station_facilities in today's words for the fields the API is asked for (scratch spec): one row per unit with
 * the operator's explanation of its state, a unit named by its number where another shares its name, the platform
 * block from DB OpenStation's inventory, and the credit of the facilities read alone.
 */
import { describe, expect, it } from "vitest";
import type * as T from "../src/api/types.js";
import { HANDLERS } from "../src/tools/handlers.js";
import { explanationIn, facilitiesText, facilityLine, platformAccessSays, platformLine, platformText, PLATFORMS_MAX } from "../src/tools/facilities.js";

type Station = T.PlatformAccess["stations"][number];
type Platform = Station["list"][number];
const unit = (o: Partial<T.StationFacilitiesData["facilities"][number]> = {}): T.StationFacilitiesData["facilities"][number] =>
  ({ id: "fasta:101", kind: "escalator", position: "zur Wandelhalle", state: "unknown", ...o });
const platform = (o: Partial<Platform> = {}): Platform => ({
  name: "Bahnsteig Gleis 1/2", tracks: ["1", "2"], stepFree: "yes", wheelchair: "yes", tactileGuidance: "yes", levelBoarding: "unknown", stated: true, heightCm: { min: 96, max: 96 }, ...o,
});
const station = (o: Partial<Station> = {}): Station => ({
  name: "Hamburg Hbf", station: { stepFree: "yes", wheelchair: "yes" }, stepFreeCounts: { yes: 2, partial: 0, no: 0, unknown: 0 }, total: 2, list: [platform(), platform({ name: null, tracks: ["3"] })], ...o,
});
const data = (o: Partial<T.StationFacilitiesData> = {}): T.StationFacilitiesData =>
  ({ station: { name: "Hamburg Hbf" }, counts: { active: 0, inactive: 1, unknown: 1 }, facilities: [unit({ state: "inactive", stateExplanation: "not available" }), unit({ id: "fasta:102", position: "zu Gleis 5", stateExplanation: "not monitored", nameShared: true })], ...o });

describe("a unit's line: the operator's explanation, its number where the name is shared", () => {
  it("a known word in the answer's language, a word that repeats the state left out, other words quoted as DB's", () => {
    expect(explanationIn("de", "Not Monitored ")).toBe("wird nicht überwacht");
    expect(explanationIn("en", "under maintenance")).toBe("under maintenance");
    expect(explanationIn("en", "not available")).toBeNull();
    expect(explanationIn("de", "Reparaturarbeiten")).toBe("Meldung der Bahn: „Reparaturarbeiten“");
    expect(explanationIn("en", "Reparaturarbeiten")).toBe('DB\'s report: "Reparaturarbeiten"');
  });
  it("said beside an unknown or broken unit, never beside a working one", () => {
    expect(facilityLine("en", unit({ stateExplanation: "not monitored" }), false)).toBe("Escalator to Wandelhalle: status unknown — not monitored");
    expect(facilityLine("de", unit({ state: "inactive", stateExplanation: "under construction" }), false)).toBe("Fahrtreppe zur Wandelhalle: außer Betrieb — im Umbau");
    expect(facilityLine("en", unit({ state: "active", stateExplanation: "under maintenance" }), false)).toBe("Escalator to Wandelhalle: in service");
    expect(facilityLine("en", unit({ stateExplanation: null }), false)).toBe("Escalator to Wandelhalle: status unknown");
    expect(facilityLine("en", unit(), false)).toBe("Escalator to Wandelhalle: status unknown");
  });
  it("the unit's number where the API says another unit shares its name, though that one is not in the list", () => {
    const lines = facilitiesText("en", data({ platforms: null }), undefined, 5).split("\n");
    expect(lines[1]).toBe("Escalator to Wandelhalle: out of service");
    expect(lines[2]).toBe("Escalator to platform 5 (unit 102): status unknown — not monitored");
    expect(lines).toHaveLength(3);
  });
});

describe("the platform block (today's platformText)", () => {
  it("after the units, its scope with DB's publication day in the head, the day in each language", () => {
    const en = facilitiesText("en", data({ platforms: { releasedOn: "2026-11-24", stations: [station()] } }), undefined, 5);
    expect(en.split("\n")[0]).toContain("Counted are the facilities DB reports for this station. The platform details are from DB's station data, as of 2026-11-24. Lifts at stops");
    expect(en.split("\n\n")[1]).toBe(platformText("en", station(), "Hamburg Hbf"));
    const de = facilitiesText("de", data({ platforms: { releasedOn: "2026-11-24", stations: [station()] } }), undefined, 5);
    expect(de.split("\n")[0]).toContain("Die Angaben zu den Bahnsteigen stammen aus den Stationsdaten der Bahn, Stand 24.11.2026.");
    expect(facilitiesText("en", data({ platforms: { releasedOn: null, stations: [station()] } }), undefined, 5).split("\n")[0]).toContain("from DB's station data. Lifts");
  });
  it("no block and no scope where the inventory states nothing", () => {
    const silent = station({ station: null, list: [platform({ stated: false, heightCm: null })] });
    expect(platformAccessSays(silent)).toBe(false);
    expect(platformAccessSays(station({ station: null, list: [platform({ stated: false })] }))).toBe(true);
    expect(platformAccessSays(station({ station: null, list: [platform({ heightCm: null })] }))).toBe(true);
    expect(platformAccessSays(station({ list: [] }))).toBe(true);
    const t = facilitiesText("en", data({ platforms: { releasedOn: "2026-11-24", stations: [silent] } }), undefined, 5);
    expect(t).not.toContain("platform details");
    expect(t).not.toContain("\n\n");
  });
  it("the head counts by step-free state in order, the station's own facts beside it", () => {
    const lines = platformText("en", station({ stepFreeCounts: { yes: 1, partial: 0, no: 2, unknown: 1 }, total: 4 }), "X").split("\n");
    expect(lines[0]).toBe("Platforms at Hamburg Hbf per DB's station data: 1 of 4 step-free, 2 not step-free, 1 not stated. The station as a whole: step-free, wheelchair accessible.");
    expect(platformText("de", station({ name: null, station: null, stepFreeCounts: { yes: 0, partial: 3, no: 0, unknown: 0 } }), "Köln Hbf").split("\n")[0]).toBe("Bahnsteige in Köln Hbf laut Stationsdaten der Bahn: 3 teilweise stufenfrei.");
    expect(platformText("en", station({ station: null, stepFreeCounts: { yes: 0, partial: 0, no: 0, unknown: 0 } }), "X").split("\n")[0]).toBe("Platforms at Hamburg Hbf per DB's station data: accessibility: not stated by DB.");
  });
  it("one line per platform up to the cap, the rest counted", () => {
    const many = Array.from({ length: PLATFORMS_MAX + 2 }, (_, i) => platform({ tracks: [String(i + 1)], name: null }));
    const lines = platformText("en", station({ list: many, total: PLATFORMS_MAX + 2 }), "X").split("\n");
    expect(lines).toHaveLength(PLATFORMS_MAX + 2);
    expect(lines[PLATFORMS_MAX + 1]).toBe("… and 2 more platforms.");
    expect(platformText("de", station({ list: [platform()], total: 1 }), "X").split("\n")).toHaveLength(2);
  });
  it("a platform's line: tracks, a name only where it says more than the tracks, its facts or none stated", () => {
    expect(platformLine("en", platform())).toBe("Platforms 1, 2: step-free · wheelchair accessible · platform height 96 cm · tactile guidance · level boarding into the train: unknown");
    expect(platformLine("de", platform())).toBe("Gleis 1, 2 (Bahnsteig Gleis 1/2): stufenfrei · rollstuhlgerecht · Bahnsteighöhe 96 cm · Blindenleitsystem · stufenloser Einstieg in den Zug: unbekannt");
    expect(platformLine("en", platform({ name: "Gepäckbahnsteig", tracks: ["Gleis 7"], heightCm: { min: 55, max: 76 }, stepFree: "partial", wheelchair: "no", tactileGuidance: "no", levelBoarding: "yes" })))
      .toBe("Platform 7 (luggage platform): partly step-free · not wheelchair accessible · platform height 55–76 cm · no tactile guidance · level boarding into the train");
    expect(platformLine("en", platform({ stated: false }))).toBe("Platforms 1, 2: platform height 96 cm · accessibility: not stated by DB");
    expect(platformLine("en", platform({ tracks: [], name: null, heightCm: null, stated: false }))).toBe("Platform: accessibility: not stated by DB");
    expect(platformLine("de", platform({ tracks: ["1"], name: "Platform 1" }))).toMatch(/^Gleis 1 \(Platform 1\): /u);
    expect(platformLine("de", platform({ tracks: [], name: "Bahnsteig Nord" }))).toMatch(/^Bahnsteig Nord: stufenfrei/u);
  });
});

describe("the credit of the facilities answer", () => {
  it("is the facilities read's own sources; the station lookup that found the id is not credited", async () => {
    const credit = (family: string, text: string) => ({ family, domain: "x", publisher: text, text, licence: "CC0 1.0", licenceUrl: null, shareAlike: false, shareAlikeOffer: null, termsUrl: null, sourceUrl: null });
    const meta = (family: string, text: string) => ({ generatedAt: "2026-03-30T00:00:00Z", language: "en", asOf: "2026-03-30T00:00:00Z", freshness: [], attribution: [credit(family, text)] });
    const get = async (op: string) => {
      if (op === "listStations") return { data: [{ id: "1:a", name: "Hamburg Hbf", evaNo: "101" }], meta: meta("delfi_static", "Fahrplandaten") };
      if (op === "listStationFacilities") return { data: data({ platforms: null }), meta: meta("db_fasta", "Aufzüge und Fahrtreppen") };
      throw new Error(op);
    };
    const r = await HANDLERS["check_station_facilities"]!({ station: "Hamburg Hbf", language: "en" }, { tool: "check_station_facilities", language: "en", api: { get } } as never);
    const text = (r.content[0] as { text: string }).text;
    expect(text).toContain("Aufzüge und Fahrtreppen");
    expect(text).not.toContain("Fahrplandaten");
  });
});
