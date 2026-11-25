import { describe, expect, it } from "vitest";
import type * as T from "../src/api/types.js";
import { cancellationNote, noAlertBlock, perLineNote, skippedNote, trendSentence, windowAnswer } from "../src/tools/transit-words.js";

/** Today's region window answer (check_transit_disruption), from the proposed punctuality figures. */
const p = (o: Partial<NonNullable<T.DisruptionData["punctuality"]>> = {}): NonNullable<T.DisruptionData["punctuality"]> => ({
  name: "Berlin", level: "state", observed: 579, late: 27, stopsReporting: 672, untimed: 0, tripsSkippingStops: 243, sourceFamily: "vbb_rt",
  reports: 929, tripsCancelled: 0, previous: { observed: 303, late: 50 }, trend: "unchanged", thin: null, ...o,
});
const data = (o: Partial<T.DisruptionData> = {}): T.DisruptionData => ({
  alerts: [], alertsTotal: 0, alertsChecked: true, windowMin: 60, punctuality: p(), alertsCoverage: { covered: false, lookbackDays: 14, lastSeenAt: [null] }, ...o,
});

describe("windowAnswer", () => {
  it("is today's answer: head with its basis, rule, trend, caveats, per-line note, then the alerts", () => {
    expect(windowAnswer("en", "Berlin", data())).toBe([
      "Berlin: 5% of observed trips more than 5 minutes late (27 of 579 trips in the last 60 minutes, from 929 delay reports on these trips; reports in the window from 672 stops in all); in addition, 243 trips skip at least one stop (a detour, a closed stop or a trip ending early).",
      "Trips are counted, not reports: a trip counts as late if it was reported more than 5 minutes late at least once during the window, even if it caught up afterwards.",
      "Trend: about the same as the 60 minutes before (17%).",
      "The source reports changes only: these figures cover the trips whose delay moved during the window, not every trip. Few reports therefore does not by itself mean \"everything on time\".",
      "Trips the source cancels as a whole are reported without a stop, cannot be placed in a region and are not in this figure. Counted as cancelled are only trips all of whose reported stops here are skipped.",
      "Individual lines, trips or stops are not judged from these delay figures — they are evaluated as a region-wide total only.",
      "",
      "Service alerts for Berlin: none of the alert sources I read has published an alert for this area in the last 14 days — none for this area has reached me since I began reading these sources, so \"none in force\" means nothing here — diversions or closures may still exist.",
    ].join("\n"));
    expect(windowAnswer("de", "Berlin", data({ punctuality: p({ observed: 1_179, reports: 29_129 }) }))?.split("\n")[0]).toBe("Berlin: 2 % der beobachteten Fahrten mehr als 5 Minuten zu spät (27 von 1.179 Fahrten in den letzten 60 Minuten, gestützt auf 29.129 Verspätungsmeldungen zu diesen Fahrten; Meldungen im Zeitraum insgesamt von 672 Haltestellen); außerdem 243 Fahrten lassen mindestens einen Halt aus (Umleitung, gesperrte Haltestelle oder vorzeitiges Ende).");
  });
  it("keeps the short form without the proposed figures, for a thin or untimed window, or with alerts shown", () => {
    const { reports: _r, ...noReports } = p();
    expect(windowAnswer("en", "B", data({ punctuality: noReports }))).toBeUndefined();
    const { trend: _t, ...noTrend } = p();
    expect(windowAnswer("en", "B", data({ punctuality: noTrend }))).toBeUndefined();
    expect(windowAnswer("en", "B", data({ punctuality: p({ thin: "few_trips" }) }))).toBeUndefined();
    expect(windowAnswer("en", "B", data({ punctuality: p({ untimed: 1 }) }))).toBeUndefined();
    expect(windowAnswer("en", "B", data({ punctuality: p({ observed: 0, late: 0 }) }))).toBeUndefined();
    expect(windowAnswer("en", "B", data({ punctuality: null }))).toBeUndefined();
    expect(windowAnswer("en", "B", data({ alerts: [{ id: "a", header: "h", lines: [], attachedTo: "network", sourceFamily: "x" } as unknown as T.DisruptionAlert] }))).toBeUndefined();
    expect(windowAnswer("en", "B", data({ punctuality: p({ previous: null }) }))).toContain("(0%).");
  });
});

describe("the window's sentences", () => {
  it("skipped and cancelled trips, one and many", () => {
    expect(skippedNote("en", 1, 1)).toBe("; in addition, 1 trip skips at least one stop (a detour, a closed stop or a trip ending early); 1 trip is cancelled here (none of the stops reported in the region served)");
    expect(skippedNote("de", 0, 2)).toBe("; außerdem 2 Fahrten fallen hier ganz aus (kein gemeldeter Halt in der Region bedient)");
    expect(skippedNote("de", 1, 0)).toBe("; außerdem 1 Fahrt lässt mindestens einen Halt aus (Umleitung, gesperrte Haltestelle oder vorzeitiges Ende)");
    expect(skippedNote("en", 0, 0)).toBe("");
  });
  it("each trend in its own words", () => {
    expect(trendSentence("better", "en", 60, "4%")).toBe("Trend: better than the 60 minutes before (4%).");
    expect(trendSentence("worse", "de", 30, "4 %")).toBe("Trend: schlechter als in den 30 Minuten davor (4 %).");
    expect(trendSentence("unchanged", "de", 60, "4 %")).toBe("Trend: etwa wie in den 60 Minuten davor (4 %).");
    expect(trendSentence("unknown", "en", 60, "")).toBe("Trend: not comparable — too few trips for the 60 minutes before.");
  });
  it("the licence half is DELFI's alone; VBN's SIRI ET names cancelled journeys", () => {
    expect(perLineNote("en", "delfi_rt_tu")).toContain("its licence permits region-wide totals only");
    expect(perLineNote("en", "vbb_rt")).not.toContain("licence");
    expect(cancellationNote("en", "vbn_siri_et")).toBe("This source names fully cancelled trips with their stops but without a prediction; they are not in the share and are counted as cancelled.");
    expect(cancellationNote("de", "vbb_rt")).toContain("ohne Haltestelle");
  });
  it("no alert in force: not current, not covered (with the last day), or none in force", () => {
    // An API that does not say whether an alert feed was alive is not read as a checked "none".
    expect(noAlertBlock("en", "B", (({ alertsChecked: _c, ...rest }) => rest)(data()))).toContain("not current right now");
    expect(noAlertBlock("en", "B", data({ alertsChecked: false }))).toBe("Service alerts for B: the alert feeds are not current right now, so I cannot say whether any diversions or closures are published.");
    expect(noAlertBlock("de", "B", data({ alertsCoverage: { covered: false, lookbackDays: 14, lastSeenAt: [null, "2026-11-01T23:30:00Z", "2026-10-01T10:00:00Z"] } }))).toContain("— die letzte kam am 02.11.2026. Dass keine");
    expect(noAlertBlock("en", "B", data({ alertsCoverage: { covered: false, lookbackDays: 14, lastSeenAt: ["2026-11-01T23:30:00Z"] } }))).toContain("— the last one arrived on 2026-11-02, so");
    expect(noAlertBlock("en", "B", data({ alertsCoverage: { covered: true, lookbackDays: 14, lastSeenAt: [] } }))).toBe("Published service alerts for B (diversions, closed stops): none in force now.");
    expect(noAlertBlock("de", "B", (({ alertsCoverage: _v, ...rest }) => rest)(data()))).toBe("Veröffentlichte Störungsmeldungen für B (Umleitungen, gesperrte Haltestellen): derzeit keine in Kraft.");
  });
});
