import { describe, expect, it } from "vitest";
import type * as T from "../src/api/types.js";
import { occupiedPct, parkingHead, parkingKindText, parkingLine, parkingOccupancyText } from "../src/tools/parking-words.js";
import { HANDLERS } from "../src/tools/handlers.js";

const at = "2026-11-24T20:56:00Z";
const now = new Date("2026-11-24T21:01:00Z");
const site = (o: Partial<T.ParkingSite>): T.ParkingSite => ({ id: "p", name: "Alsterhaus", operator: null, kind: "garage", location: { lat: 53.55, lon: 10 }, distanceM: 231, occupancy: null, termsRequired: false, ...o });
const occ = (free: number | null, total: number | null, state: string): T.ParkingSite["occupancy"] => ({ free, total, state, observedAt: at });

describe("find_parking's words, as today's server says them", () => {
  it("a line: kind, distance, spaces, free, occupied share, the operator's status and its time", () => {
    expect(parkingLine(site({ occupancy: occ(84, 87, "free") }), 1, "en", now)).toBe("2. Alsterhaus — Car park (Parkhaus), 0.2 km, 87 spaces, 84 free, 3 % occupied, operator's status: spaces available (as of 21:56)");
    expect(parkingLine(site({ occupancy: occ(84, 87, "free") }), 0, "de", now)).toBe("1. Alsterhaus — Parkhaus, 0,2 km, 87 Plätze, 84 frei, zu 3 % belegt, Status laut Betreiber: Plätze frei (Stand 21:56)");
  });
  it("a German name that says its kind is not told it again; an English one is", () => {
    expect(parkingLine(site({ name: "Parkhaus Gänsemarkt" }), 0, "de", now)).toBe("1. Parkhaus Gänsemarkt — 0,2 km, keine Belegungsdaten veröffentlicht");
    expect(parkingLine(site({ name: "Parkhaus Gänsemarkt" }), 0, "en", now)).toBe("1. Parkhaus Gänsemarkt — Car park (Parkhaus), 0.2 km, no occupancy published");
  });
  it("no name: the operator, else the kind as the head; no distance, none said", () => {
    expect(parkingLine(site({ name: null, operator: "Q-Park", distanceM: null }), 0, "en", now)).toBe("1. Q-Park — Car park (Parkhaus), no occupancy published");
    expect(parkingLine(site({ name: null, kind: "lot" }), 0, "en", now)).toBe("1. Parking area (Parkplatz) — 0.2 km, no occupancy published");
  });
  it("a total smaller than the free count is never printed", () => {
    expect(parkingLine(site({ occupancy: occ(90, 80, "unknown") }), 0, "en", now)).toBe("1. Alsterhaus — Car park (Parkhaus), 0.2 km, 90 free (as of 21:56)");
  });
  it("every kind's term; an unknown kind is a parking area", () => {
    expect(["park_and_ride", "rest_area", "truck_parking", "other", "on_street"].map((k) => parkingKindText(k, "en"))).toEqual(["Park and ride (P+R)", "Rest area (Rastanlage)", "Lorry parking (Lkw-Parkplatz)", "Parking area (Parkplatz)", "Parking area (Parkplatz)"]);
    expect(parkingKindText("truck_parking", "de")).toBe("Lkw-Parkplatz");
  });
  it("the occupancy: closed, full with no count, almost full, a status that says nothing, no report", () => {
    expect(parkingOccupancyText(occ(12, 100, "closed"), "en", now)).toBe("reported closed (as of 21:56)");
    expect(parkingOccupancyText(occ(12, 100, "closed"), "de", now)).toBe("als geschlossen gemeldet (Stand 21:56)");
    expect(parkingOccupancyText(occ(null, null, "full"), "en", now)).toBe("reported full (as of 21:56)");
    expect(parkingOccupancyText(occ(null, null, "full"), "de", now)).toBe("als voll gemeldet (Stand 21:56)");
    expect(parkingOccupancyText(occ(0, 50, "full"), "en", now)).toBe("0 free, 100 % occupied, operator's status: full (as of 21:56)");
    expect(parkingOccupancyText(occ(null, 50, "filling"), "de", now)).toBe("Status laut Betreiber: fast voll (Stand 21:56)");
    expect(parkingOccupancyText(occ(null, null, "unknown"), "en", now)).toBe("no occupancy published");
    expect(parkingOccupancyText({ free: 3, total: null, state: "other", observedAt: null as never }, "en", now)).toBe("3 free");
    expect(parkingOccupancyText(null, "de", now)).toBe("keine Belegungsdaten veröffentlicht");
  });
  it("the occupied share: whole percent from both counts, none without them or past the total", () => {
    expect([occupiedPct(78, 210), occupiedPct(null, 10), occupiedPct(1, null), occupiedPct(1, 0), occupiedPct(11, 10), occupiedPct(10, 10)]).toEqual([63, null, null, null, null, 0]);
  });
  it("the head: a place nearest first, a road in its own order", () => {
    expect(parkingHead({ place: "Hamburg", radiusKm: 10 }, "en")).toBe("Parking around Hamburg (within 10 km), nearest first:");
    expect(parkingHead({ place: "Hamburg", radiusKm: 10 }, "de")).toBe("Parken um Hamburg (Umkreis 10 km), nächste zuerst:");
    expect(parkingHead({ road: "A7" }, "de")).toBe("Parken an der A7:");
  });
  it("a reading from another Berlin day says its day; a stale one says its age and its first figure in the past", () => {
    const night = (free: number | null, total: number | null, state: string): T.ParkingSite["occupancy"] => ({ free, total, state, observedAt: "2026-11-24T22:50:00Z" });
    // 23:50 on the 24th, read at 00:10 on the 25th Berlin: another day, 20 min old, not stale.
    const next = new Date("2026-11-24T23:10:00Z");
    expect(parkingOccupancyText(night(12, 100, "free"), "en", next)).toBe("12 free, 88 % occupied, operator's status: spaces available (as of 2026-11-24 23:50)");
    expect(parkingOccupancyText(night(12, 100, "free"), "de", next)).toBe("12 frei, zu 88 % belegt, Status laut Betreiber: Plätze frei (Stand 24.11. 23:50)");
    const later = new Date("2026-11-24T23:32:00Z");
    expect(parkingOccupancyText(night(12, 100, "free"), "en", later)).toBe("last reported 12 free, 88 % occupied, operator's status: spaces available (as of 2026-11-24 23:50, 42 min ago)");
    expect(parkingOccupancyText(night(null, 100, "filling"), "de", later)).toBe("zuletzt gemeldeter Status laut Betreiber: fast voll (Stand 24.11. 23:50, vor 42 min)");
    expect(parkingOccupancyText(night(null, null, "closed"), "en", new Date("2026-11-25T01:55:00Z"))).toBe("reported closed (as of 2026-11-24 23:50, 3 h 5 min ago)");
    // Exactly three cadences is not stale yet; a second more is.
    expect(parkingOccupancyText(night(5, null, "unknown"), "en", new Date("2026-11-24T23:20:00Z"))).toBe("5 free (as of 2026-11-24 23:50)");
    expect(parkingOccupancyText(night(5, null, "unknown"), "en", new Date("2026-11-24T23:20:01Z"))).toBe("last reported 5 free (as of 2026-11-24 23:50, 30 min ago)");
    expect(parkingOccupancyText(night(5, null, "unknown"), "de", new Date("2026-11-25T00:50:00Z"))).toBe("zuletzt 5 frei gemeldet (Stand 24.11. 23:50, vor 2 h)");
  });
});

describe("find_parking lists OpenStreetMap's car parks the API gives in meta.around", () => {
  const credit = { family: "osm", domain: "places", publisher: "OSM", text: "OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0", licence: "ODbL 1.0", licenceUrl: null, shareAlike: true, shareAlikeOffer: null, termsUrl: null };
  const park = (name: string | null, distanceM: number, o: Partial<T.OsmCarPark> = {}): T.OsmCarPark =>
    ({ id: `way/${distanceM}`, name, operator: null, street: null, houseNo: null, zip: null, town: null, location: { lat: 52.52, lon: 13.4 }, distanceM, ...o });
  // Central Berlin: no publisher reports a site there; five OpenStreetMap car parks, in the API's order and cap.
  const berlin = [
    park("Parkhaus Rathauspassagen", 419, { operator: "Contipark", street: "Rathausstraße", houseNo: "5", zip: "10117", town: "Berlin" }),
    park("Friedrichstadt-Passagen (Q 207)", 650, { street: "Jägerstraße", houseNo: "0" }),
    park(null, 800), park("Alexa", 870, { operator: "Alexa" }), park("Spittelmarkt", 960),
  ];
  const run = async (data: T.ParkingSite[], parks: T.OsmCarPark[] | null, args: Record<string, unknown> = {}, language: "de" | "en" = "en") => {
    const seen: string[] = [];
    const meta = { generatedAt: "2026-11-26T10:00:00Z", language, asOf: "2026-11-26T09:58:00Z", freshness: [], attribution: parks === null || parks.length === 0 ? [] : [credit],
      around: { osmCarParks: parks, osmDataAsOf: parks === null ? null : "2026-11-20", roadContext: [] } };
    const get = async (op: string) => { seen.push(op); return { data: op === "listParkingOptions" ? data : [], meta }; };
    const r = await HANDLERS["find_parking"]!({ lat: 52.52, lon: 13.405, language, ...args }, { tool: "find_parking", language, api: { get } } as never);
    return { r, text: (r.content[0] as { text: string }).text, seen };
  };

  it("no publisher site: the five car parks are the answer, numbered with operator, distance and address, dated, ODbL credited", async () => {
    const { r, text } = await run([], berlin);
    expect(r.isError).not.toBe(true);
    expect(text.split("\n").slice(0, 7)).toEqual([
      "Around 52.520, 13.405 (within 10 km) we hold no car park or P+R data from an operator or a city. OpenStreetMap (ODbL, held separately) lists these car parks there — with no capacity and no occupancy:",
      "1. Parkhaus Rathauspassagen (Contipark) — 0.4 km, Rathausstraße 5, 10117 Berlin",
      "2. Friedrichstadt-Passagen (Q 207) — 0.7 km, Jägerstraße",
      "3. Car park — 0.8 km",
      "4. Alexa — 0.9 km",
      "5. Spittelmarkt — 1.0 km",
      "OpenStreetMap data as of 2026-11-20",
    ]);
    expect(text).not.toMatch(/I know of no parking/u);
    expect((r._meta as { attribution: string }).attribution).toContain("OpenStreetMap-Mitwirkende, ODbL 1.0");
    const facilities = (r.structuredContent as { osmFacilities: Record<string, unknown>[] }).osmFacilities;
    expect(facilities).toHaveLength(5);
    expect(facilities[0]).toEqual({ id: "way/419", name: "Parkhaus Rathauspassagen", operator: "Contipark", address: "Rathausstraße 5, 10117 Berlin", lat: 52.52, lon: 13.4, distanceM: 419, distanceKm: 0.4, capacityTotal: null, spacesFree: null, extractDate: "2026-11-20", license: "ODbL 1.0" });
  });

  it("in German, the extract day as a German date", async () => {
    const { text } = await run([], berlin.slice(0, 1), {}, "de");
    expect(text.split("\n").slice(0, 3)).toEqual([
      "Um 52.520, 13.405 (Umkreis 10 km) führen wir keine Parkhaus- oder P+R-Daten eines Betreibers oder einer Stadt. Laut OpenStreetMap (ODbL, separat geführt) gibt es dort diese Parkplätze und Parkhäuser — ohne Platzzahl und ohne Belegung:",
      "1. Parkhaus Rathauspassagen (Contipark) — 0,4 km, Rathausstraße 5, 10117 Berlin",
      "Stand der OpenStreetMap-Daten: 20.11.2026",
    ]);
  });

  it("beside the publishers' sites, as a block of its own after them", async () => {
    const { text, r } = await run([site({ distanceM: 100 })], berlin.slice(0, 2));
    const lines = text.split("\n");
    expect(lines[1]).toBe("1. Alsterhaus — Car park (Parkhaus), 0.1 km, no occupancy published");
    expect(lines.slice(2, 6)).toEqual(["", "Also, from OpenStreetMap (ODbL, held separately; what is listed above is left out) — car parks, with no capacity and no occupancy:", "1. Parkhaus Rathauspassagen (Contipark) — 0.4 km, Rathausstraße 5, 10117 Berlin", "2. Friedrichstadt-Passagen (Q 207) — 0.7 km, Jägerstraße"]);
    expect((r.structuredContent as { osmFacilities: unknown[] }).osmFacilities).toHaveLength(2);
  });

  it("a free-spaces filter OpenStreetMap cannot judge is said first, never read as no free spaces", async () => {
    const { text } = await run([], berlin.slice(0, 1), { only_with_free_spaces: true });
    const amenities = await run([], berlin.slice(0, 1), { facilities: ["ev_charging"] });
    expect(amenities.text.split("\n")[0]).toBe("The facilities asked for I cannot check for the car parks below — OpenStreetMap holds no such data; they are listed without that filter. OpenStreetMap (ODbL, held separately) lists these car parks there — with no capacity and no occupancy:");
    expect(text.split("\n")[0]).toBe("Whether spaces are free I cannot check for the car parks below — OpenStreetMap holds no occupancy; they are listed without that filter, not as \"no free spaces\". OpenStreetMap (ODbL, held separately) lists these car parks there — with no capacity and no occupancy:");
  });

  it("none listed, or not read (null): today's answer, no OpenStreetMap block, no osmFacilities", async () => {
    for (const parks of [[], null]) {
      const { text, r } = await run([], parks);
      expect(text).toMatch(/^I know of no parking around 52\.520, 13\.405/u);
      expect(text).not.toContain("OpenStreetMap");
      expect(r.structuredContent?.["osmFacilities"]).toBeUndefined();
    }
    const held = await run([site({})], null);
    expect(held.text).not.toContain("OpenStreetMap");
  });
});
