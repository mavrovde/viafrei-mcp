/**
 * A departure in today's words: the cases of today's server's own tests (the board's, its mode words, its
 * replacement buses and liveSuffix), on the API's departure rows.
 */
import { describe, expect, it } from "vitest";
import type * as T from "../src/api/types.js";
import { anyLive, boardLine } from "../src/tools/departure-words.js";

const now = new Date("2026-11-24T20:30:00Z");
const row = (line: string | null, mode: string, routeType: number | null, o: Partial<T.Departure> = {}): T.Departure => ({
  line, category: null, destination: "X", plannedAt: "2026-11-24T21:00:00Z", expectedAt: null, delayMin: null, platform: null, plannedPlatform: null,
  platformChanged: false, cancelled: false, mode, realtime: false, noForecast: false, routeType, ...o,
});
const plain = (language: "de" | "en", d: T.Departure): string => boardLine(d, false, now, language);

describe("a departure in today's words", () => {
  it("the mode word comes from route_type; a name that says its mode stays bare; a bus with a rail name is the replacement bus", () => {
    expect(plain("en", row("S7", "bus", 700))).toBe("22:00 rail replacement bus S7 → X, from the replacement bus stop");
    expect(plain("de", row("RE7", "bus", 700))).toBe("22:00 SEV-Bus RE7 → X, ab der Ersatzhaltestelle");
    expect(plain("de", row("E", "bus", 714))).toBe("22:00 SEV-Bus E → X, ab der Ersatzhaltestelle");
    expect(plain("de", row("SEV RE 1", "bus", 3))).toBe("22:00 SEV-Bus RE 1 → X, ab der Ersatzhaltestelle");
    expect(plain("de", row("K", "bus", 700))).toBe("22:00 Bus K → X");
    expect(plain("en", row("AH", "bus", 3))).toBe("22:00 bus AH → X");
    expect(plain("de", row("Chiemseebahn", "rail", 2))).toBe("22:00 Chiemseebahn → X");
    expect(plain("en", row("N1387", "bus", 200))).toBe("22:00 coach N1387 → X");
    expect(plain("en", row("42", "rail", 101))).toBe("22:00 long-distance train 42 → X");
    expect(plain("en", row("U2", "bus", 700))).toBe("22:00 bus U2 → X");
    expect(plain("de", row("2N", "bus", 700))).toBe("22:00 Bus 2N → X");
    expect(plain("de", row("M10", "tram", 900))).toBe("22:00 Tram M10 → X");
    expect(plain("de", row("49", "rail", 101))).toBe("22:00 Fernzug 49 → X");
    expect(plain("de", row("N1387", "bus", 201))).toBe("22:00 Fernbus N1387 → X");
    expect(plain("de", row("S7", "sbahn", 109))).toBe("22:00 S7 → X");
    expect(plain("de", row("RE 50", "rail", 106))).toBe("22:00 RE 50 → X");
    expect(plain("de", row("U2", "subway", 400))).toBe("22:00 U2 → X");
    expect(plain("de", row("U71", "tram", 0))).toBe("22:00 U71 → X");
    expect(plain("de", row("U28", "rail", 106))).toBe("22:00 U28 → X");
    expect(plain("de", row("2", "tram", 0))).toBe("22:00 Tram 2 → X");
    expect(plain("de", row("2", "bus", 3))).toBe("22:00 Bus 2 → X");
    expect(plain("en", row("5", "ferry", 4))).toBe("22:00 ferry 5 → X");
    expect(plain("en", row("7", "other", null))).toBe("22:00 service 7 → X");
  });
  it("a long-distance trip shows its train number without the padding; a platform by its noun; no destination said so", () => {
    expect(plain("de", row("ICE 28", "rail", 101, { trainNumber: "082" }))).toBe("22:00 Fernzug 82 → X");
    expect(plain("de", row("RE7", "rail", 106, { trainNumber: "011" }))).toBe("22:00 RE7 → X");
    expect(plain("en", row("IC 2", "rail", 102, { trainNumber: "07" }))).toBe("22:00 long-distance train 7 → X");
    expect(plain("de", row("2", "bus", 3, { platform: "C" }))).toBe("22:00 Bus 2 → X, Steig C");
    expect(plain("en", row("2", "tram", 0, { platform: " 4 " }))).toBe("22:00 tram 2 → X, platform 4");
    expect(plain("de", row("2", "bus", 3, { platform: " " }))).toBe("22:00 Bus 2 → X");
    expect(plain("en", row("S1", "sbahn", 109, { destination: null }))).toBe("22:00 S1 → destination not given");
    expect(plain("de", row("S1", "sbahn", 109, { destination: "Ersatz 1 2" }))).toBe("22:00 S1 → Ersatzhaltestelle „Ersatz 1 2“");
    expect(plain("de", row(null, "bus", 3))).toBe("22:00 Bus → X");
  });
  it("on a board with a live figure every row says its state; a timetable board says none", () => {
    const live = (o: Partial<T.Departure>, language: "de" | "en" = "de"): string => boardLine(row("S1", "sbahn", 109, o), true, now, language);
    expect(live({ realtime: true, delayMin: 3 })).toBe("22:00 S1 → X, +3 Min. (voraussichtlich 22:03)");
    expect(live({ realtime: true, delayMin: 3 }, "en")).toBe("22:00 S1 → X, +3 min (expected 22:03)");
    expect(live({ realtime: true, delayMin: -2 })).toBe("22:00 S1 → X, 2 Min. früher (voraussichtlich 21:58)");
    expect(live({ realtime: true, delayMin: 0 }, "en")).toBe("22:00 S1 → X, on time");
    expect(live({ realtime: true, delayMin: null })).toBe("22:00 S1 → X, ohne Prognose");
    expect(live({ realtime: false })).toBe("22:00 S1 → X, Plan");
    expect(live({ realtime: false, noForecast: true }, "en")).toBe("22:00 S1 → X, no forecast");
    expect(live({ cancelled: true, realtime: true, delayMin: 5 })).toBe("22:00 S1 → X, fällt aus");
    // A time on another Berlin day carries its date.
    expect(boardLine(row("S1", "sbahn", 109, { plannedAt: "2026-11-25T23:30:00Z" }), false, now, "de")).toBe("26.11. 00:30 S1 → X");
    expect(anyLive([row("S1", "sbahn", 109)])).toBe(false);
    expect(anyLive([row("S1", "sbahn", 109), row("S1", "sbahn", 109, { realtime: true, delayMin: 0 })])).toBe(true);
    expect(anyLive([row("S1", "sbahn", 109, { cancelled: true })])).toBe(true);
    expect(anyLive([row("S1", "sbahn", 109, { noForecast: true })])).toBe(true);
  });
});
