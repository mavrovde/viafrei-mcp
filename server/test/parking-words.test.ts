import { describe, expect, it } from "vitest";
import type * as T from "../src/api/types.js";
import { occupiedPct, parkingHead, parkingKindText, parkingLine, parkingOccupancyText } from "../src/tools/parking-words.js";

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
