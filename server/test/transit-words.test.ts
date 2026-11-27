import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as T from "../src/api/types.js";
import { alertLines, noAlertBlock, perLineNote, regionAnswer, skippedNote } from "../src/tools/transit-words.js";

// A Berlin window as API 2.0.4 gives it (DisruptionPunctuality), read at 04:20 Berlin.
const p = (o: Partial<T.DisruptionPunctuality> = {}): T.DisruptionPunctuality => ({
  code: "11", name: "Berlin", level: "state", windowMin: 60, observed: 4_437, late: 1_007, stopsReporting: 672, untimed: 0, tripsSkippingStops: 512,
  medianWorstDelaySeconds: 150, observedAt: "2026-11-27T03:20:00Z", sourceFamily: "delfi_rt_tu", ...o,
});
const lands = (...seen: (string | null)[]) => seen.map((s, i) => ({ land: String(i + 1).padStart(2, "0"), alertsSeen: s === null ? 0 : 1, newestAlertSeenAt: s }));
const data = (o: Partial<T.DisruptionData> = {}): T.DisruptionData => ({
  alerts: [], alertsTotal: 0, alertsChecked: true, windowMin: 60, punctuality: p(), alertsCoverage: { covered: true, lookbackDays: 14, lands: lands("2026-11-26T10:00:00Z") }, line: null, ...o,
});
const alert = (o: Partial<T.DisruptionAlert> = {}): T.DisruptionAlert => ({ header: "Bauarbeiten", lines: ["RE 1"], inForceFrom: null, inForceUntil: null, ...o });

beforeEach(() => { vi.useFakeTimers({ now: new Date("2026-11-27T03:21:00Z"), toFake: ["Date"] }); });
afterEach(() => { vi.useRealTimers(); });

describe("regionAnswer (check_transit_disruption) on API 2.0.4's figures", () => {
  it("the share of late trips with its counts, the source's window, the stops, the skipping trips, then the facts and notes (en)", () => {
    const lines = regionAnswer("en", "Berlin", "Berlin", data({ windowMin: 30 })).split("\n");
    expect(lines[0]).toBe("Berlin: 23% of observed trips late at least once (1,007 of 4,437 trips in the last 60 minutes, reports from 672 stops); in addition, 512 trips skip at least one stop (a detour, a closed stop or a trip ending early).");
    expect(lines[1]).toBe("Median of each trip's worst delay: 3 min; newest report counted 04:20.");
    expect(lines[2]).toBe("Trips are counted, not reports: a trip counts as late if it was reported late at least once during the window, even if it caught up afterwards.");
    expect(lines[3]).toContain("The source reports changes only");
    expect(lines[4]).toContain("its licence permits region-wide totals only");
    expect(lines[5]).toBe("");
    expect(lines[6]).toBe("Published service alerts for Berlin (diversions, closed stops): none in force now.");
    expect(lines).toHaveLength(7);
  });
  it("in German, with its own number and percent forms", () => {
    const lines = regionAnswer("de", "Berlin", "Berlin", data()).split("\n");
    expect(lines[0]).toBe("Berlin: 23 % der beobachteten Fahrten mindestens einmal verspätet (1.007 von 4.437 Fahrten in den letzten 60 Minuten, Meldungen von 672 Haltestellen); außerdem 512 Fahrten lassen mindestens einen Halt aus (Umleitung, gesperrte Haltestelle oder vorzeitiges Ende).");
    expect(lines[1]).toBe("Median der größten Verspätung je Fahrt: 3 min; neueste gezählte Meldung 04:20.");
    expect(lines[6]).toBe("Veröffentlichte Störungsmeldungen für Berlin (Umleitungen, gesperrte Haltestellen): derzeit keine in Kraft.");
  });
  it("one of each, no skip, no stop count, a sub-minute median, untimed trips, no time", () => {
    const lines = regionAnswer("en", "B", "B", data({ punctuality: p({ observed: 1, late: 1, stopsReporting: 0, tripsSkippingStops: 0, medianWorstDelaySeconds: 40, untimed: 1, observedAt: null }) })).split("\n");
    expect(lines[0]).toBe("B: 100% of observed trips late at least once (1 of 1 trips in the last 60 minutes).");
    expect(lines[1]).toBe("Median of each trip's worst delay: less than a minute; 1 further trip reported without a delay to count.");
    expect(skippedNote("en", 1)).toBe("; in addition, 1 trip skips at least one stop (a detour, a closed stop or a trip ending early)");
    expect(skippedNote("de", 1)).toContain("1 Fahrt lässt");
  });
  it("no median, no untimed, no time: no facts line", () => {
    const lines = regionAnswer("en", "B", "B", data({ punctuality: p({ medianWorstDelaySeconds: null, observedAt: null }) })).split("\n");
    expect(lines[1]).toMatch(/^Trips are counted, not reports/u);
  });
  it("no counted trip: says no reports in the window (its own, else the asked one), never a share, and still the alerts", () => {
    const none = regionAnswer("en", "B", "B", data({ punctuality: null, windowMin: 30 })).split("\n");
    expect(none[0]).toBe("B: no public-transport realtime reports from this region in the last 30 minutes.");
    expect(none.at(-1)).toBe("Published service alerts for B (diversions, closed stops): none in force now.");
    const untimed = regionAnswer("de", "B", "B", data({ punctuality: p({ observed: 0, late: 0, untimed: 2, windowMin: 45 }) })).split("\n");
    expect(untimed[0]).toBe("B: in den letzten 45 Minuten keine Echtzeitmeldungen aus dem Nahverkehr dieser Region. 2 Fahrten wurden ohne zählbare Verspätung gemeldet.");
    expect(regionAnswer("en", "B", "B", data({ punctuality: p({ observed: 0, late: 0, untimed: 1 }) }))).toContain(" 1 trip was reported without a delay to count.");
  });
});

describe("the alerts", () => {
  it("listed with lines, headline, end, and how many are in force when the list is cut", () => {
    expect(alertLines("en", "Köln", data({ alerts: [alert({ inForceUntil: "2026-11-27T17:00:00Z" }), alert({ header: null, lines: [] })], alertsTotal: 5 }))).toEqual([
      "5 service alerts in force for Köln, 2 of them here:", "- RE 1: Bauarbeiten (until 18:00)", "- (no headline published)",
    ]);
    expect(alertLines("de", "Köln", data({ alerts: [alert({ header: "  " })], alertsTotal: 1 }))).toEqual(["1 Störungsmeldung in Kraft für Köln:", "- RE 1: (ohne veröffentlichte Überschrift)"]);
    expect(alertLines("de", "Köln", data({ alerts: [alert(), alert()], alertsTotal: 3 }))[0]).toBe("3 Störungsmeldungen in Kraft für Köln, 2 davon hier:");
  });
  it("the licence half is DELFI's alone", () => {
    expect(perLineNote("en", "delfi_rt_tu")).toContain("its licence permits region-wide totals only");
    expect(perLineNote("en", "tripupdates")).toContain("its licence permits region-wide totals only");
    expect(perLineNote("en", "vbb_rt")).not.toContain("licence");
  });
  it("no alert in force: not current, not covered (with the newest Land's day), or none in force", () => {
    // An API that does not say whether an alert feed was alive is not read as a checked "none".
    expect(noAlertBlock("en", "B", (({ alertsChecked: _c, ...rest }) => rest)(data()))).toContain("not current right now");
    expect(noAlertBlock("en", "B", data({ alertsChecked: false }))).toBe("Service alerts for B: the alert feeds are not current right now, so I cannot say whether any diversions or closures are published.");
    expect(noAlertBlock("de", "B", data({ alertsCoverage: { covered: false, lookbackDays: 14, lands: lands(null, "2026-11-01T23:30:00Z", "2026-10-01T10:00:00Z") } }))).toContain("in den letzten 14 Tagen eine Meldung für dieses Gebiet veröffentlicht — die letzte kam am 02.11.2026. Dass keine");
    expect(noAlertBlock("en", "B", data({ alertsCoverage: { covered: false, lookbackDays: 7, lands: lands("2026-11-01T23:30:00Z") } }))).toContain("in the last 7 days — the last one arrived on 2026-11-02, so");
    expect(noAlertBlock("en", "B", data({ alertsCoverage: { covered: false, lookbackDays: 14, lands: lands(null) } }))).toContain("— none for this area has reached me since I began reading these sources");
    expect(noAlertBlock("en", "B", data({ alertsCoverage: null }))).toBe("Published service alerts for B (diversions, closed stops): none in force now.");
    expect(noAlertBlock("en", "B", data({ alerts: [alert()] }))).toBeUndefined();
  });
});
