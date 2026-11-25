/**
 * check_autobahn_traffic's head for the fields the API is asked for: the lamp's folded reason count and the
 * road-wide headline (today's headline, policeCountsText, measuredLine), and the
 * page's last line.
 */
import { describe, expect, it } from "vitest";
import type * as T from "../src/api/types.js";
import { autobahnLine, factWords, HANDLERS, lampText, phaseEndWords, plannedNowLines, roadWideLine, stampText } from "../src/tools/handlers.js";

const now = new Date("2026-03-30T10:00:00Z");
const wide = (o: Partial<T.RoadWide> = {}): T.RoadWide => ({
  asOf: "2026-03-30T09:06:00Z", jams: 0, warnings: 0, closures: 2, roadworks: 23,
  police: { jams: 0, closures: 0, restrictions: 0, roadworks: 1, reports: 1 },
  announced: { from: "2026-03-30T13:00:00Z", closures: 0, roadworks: 22, reports: 0 }, measured: null, ...o,
});

describe("the lamp's folded reasons", () => {
  it("counts the reasons after the first, in each language", () => {
    expect(lampText({ lamp: "amber", lampReason: "ramp_closed", lampReasonsTotal: 46 }, "en")).toBe("traffic light yellow: a junction ramp closed (and 45 more reasons)");
    expect(lampText({ lamp: "red", lampReason: "road_closed", lampReasonsTotal: 2 }, "de")).toBe("Ampel Rot: Vollsperrung (und 1 weiterer Grund)");
    expect(lampText({ lamp: "red", lampReason: "road_closed", lampReasonsTotal: 3 }, "de")).toMatch(/\(und 2 weitere Gründe\)$/u);
    expect(lampText({ lamp: "amber", lampReason: "jam", lampReasonsTotal: 2 }, "en")).toMatch(/\(and 1 more reason\)$/u);
  });
  it("says nothing more for one reason or without the count", () => {
    expect(lampText({ lamp: "amber", lampReason: "jam", lampReasonsTotal: 1 }, "en")).toBe("traffic light yellow: jam");
    expect(lampText({ lamp: "amber", lampReason: "jam" }, "en")).toBe("traffic light yellow: jam");
  });
});

describe("the road-wide headline", () => {
  it("the road's counts, the police/Land messages, the announced ones from their time, the Stand", () => {
    expect(roadWideLine("A9", wide(), "en", now)).toBe("A9, road-wide: 0 jams, 2 closures, 23 roadworks sites; plus police/Land messages: 1 roadworks site, 1 report; announced from 15:00: 22 roadworks sites — As of 11:06.");
  });
  it("in German, the warnings beside the jams, every police kind, NRW's measured state", () => {
    const w = wide({
      jams: 4, warnings: 5, closures: 1, roadworks: 1,
      police: { jams: 1, closures: 1, restrictions: 7, roadworks: 18, reports: 3 },
      announced: { from: null, closures: 16, roadworks: 1, reports: 1 },
      measured: { sites: 71, standstill: 2, slow: 1, heavy: 1, free: 67, laneSites: 1, near: ["Köln-Nord"], measuredAt: "2026-03-30T09:24:00Z" },
    });
    expect(roadWideLine("A1", w, "de", now)).toBe("A1, gesamte Strecke: 4 Staus, 1 Warnmeldung (Unfall, Gefahr u. a.), 1 Sperrung, 1 Baustelle; dazu Polizei-/Landesmeldungen: 1 Stau, 1 Sperrung, 7 Einschränkungen, 18 Baustellen, 3 Meldungen; angekündigt: 16 Sperrungen, 1 Baustelle, 1 Meldung — Stand 11:06. Verkehrslage an 71 Messstellen (NRW, Stand 11:24): 2 Stillstand, 1 zähfließend, 1 dicht, 67 frei; Stillstand oder zähfließend bei Köln-Nord; davon 1 ohne aktuellen Querschnittswert, nach dem langsamsten Fahrstreifen gezählt.");
  });
  it("in English: one site, singular words, no police or announced part when none", () => {
    const w = wide({
      jams: 1, warnings: 3, closures: 1, roadworks: 1, police: { jams: 0, closures: 0, restrictions: 1, roadworks: 0, reports: 0 }, announced: { from: null, closures: 1, roadworks: 0, reports: 2 },
      measured: { sites: 1, standstill: 0, slow: 0, heavy: 0, free: 1, laneSites: 0, near: [], measuredAt: null },
    });
    expect(roadWideLine("A3", w, "en", now)).toBe("A3, road-wide: 1 jam, 2 warnings (accident, hazard etc.), 1 closure, 1 roadworks site; plus police/Land messages: 1 restriction; announced: 1 closure, 2 reports — As of 11:06. Traffic state at 1 measuring site (NRW): 1 free-flowing.");
    expect(roadWideLine("A3", wide({ police: { jams: 0, closures: 0, restrictions: 0, roadworks: 0, reports: 0 }, announced: { from: null, closures: 0, roadworks: 0, reports: 0 } }), "de", now))
      .toBe("A3, gesamte Strecke: 0 Staus, 2 Sperrungen, 23 Baustellen — Stand 11:06.");
    expect(roadWideLine("A3", wide({ police: { jams: 0, closures: 0, restrictions: 1, roadworks: 0, reports: 0 } }), "de", now)).toMatch(/; dazu Polizei-\/Landesmeldungen: 1 Einschränkung;/u);
  });
  it("English measured words, near and lanes", () => {
    const m = { sites: 3, standstill: 1, slow: 1, heavy: 1, free: 0, laneSites: 2, near: ["Kamen"], measuredAt: "2026-03-30T09:24:00Z" };
    expect(roadWideLine("A1", wide({ measured: m }), "en", now)).toMatch(/ Traffic state at 3 measuring sites \(NRW, as of 11:24\): 1 standstill, 1 slow, 1 heavy, 0 free-flowing; standstill or slow near Kamen; 2 of them without a current cross-section reading, counted by their slowest lane\.$/u);
    expect(roadWideLine("A1", wide({ measured: { ...m, sites: 1 } }), "de", now)).toMatch(/Verkehrslage an 1 Messstelle \(NRW/u);
  });
});

describe("check_autobahn_traffic's head and last line", () => {
  const meta = (next: string | null) => ({ generatedAt: "2026-03-30T09:59:00Z", language: "en", asOf: "2026-03-30T09:58:00Z", freshness: [], attribution: [], page: { limit: 5, hasMore: next !== null, nextCursor: next } });
  const run = async (data: Partial<T.RoadConditionsData>, next: string | null, roads = ["A9"]) => {
    const get = async (op: string) => {
      if (op === "getMotorwayConditions") return { data: { lamp: "amber", lampReason: "jam", situations: [], ...data }, meta: meta(next) };
      throw new Error(op);
    };
    const r = await HANDLERS["check_autobahn_traffic"]!({ roads, language: "en" }, { tool: "check_autobahn_traffic", language: "en", api: { get } } as never);
    return (r.content[0] as { text: string }).text.split("\n");
  };
  it("the road-wide line under the lamp, the next page said last", async () => {
    const lines = await run({ roadWide: wide() }, "5");
    expect(lines[0]).toBe("A9 — traffic light yellow: jam.");
    expect(lines[1]).toMatch(/^A9, road-wide: 0 jams/u);
    expect(lines[2]).toBe("… more entries on the next page.");
  });
  it("neither without the figures and a next page, nor for several roads", async () => {
    expect((await run({ roadWide: null }, null))[1]).toBe("");
    expect((await run({}, null))[1]).toBe("");
    expect((await run({}, "5", ["A9", "A7"])).filter((l) => l.startsWith("…"))).toEqual([]);
  });
});

describe("the short-duration roadworks planned now", () => {
  const plan = (where: string | null, from: string | null, to: string | null) => ({ where, window: { from, to } });
  it("label, road, the publisher's words and the window per the plan; the end's day only when it differs", () => {
    expect(plannedNowLines("A9", [plan("A9 von Ingolstadt-Süd (AS) nach Neuburg (AS) Grünpflege", "2026-03-29T17:00:00Z", "2026-03-30T04:00:00Z"), plan(null, "2026-03-30T06:00:00Z", "2026-03-30T14:00:00Z")], "en")).toEqual([
      "• Short-duration roadworks (Autobahn GmbH plan) A9: A9 von Ingolstadt-Süd (AS) nach Neuburg (AS) Grünpflege — per the plan now 2026-03-29 19:00–2026-03-30 06:00",
      "• Short-duration roadworks (Autobahn GmbH plan) A9 — per the plan now 2026-03-30 08:00–16:00",
    ]);
    expect(plannedNowLines("A1", [plan("Strecke", "2026-03-29T17:00:00Z", null), plan("B", null, null)], "de")).toEqual([
      "• Arbeitsstelle kürzerer Dauer (Planung der Autobahn GmbH) A1: Strecke — laut Planung jetzt ab 29.03. 19:00",
      "• Arbeitsstelle kürzerer Dauer (Planung der Autobahn GmbH) A1: B",
    ]);
    expect(plannedNowLines("A1", [plan("S", "2026-03-29T17:00:00Z", null)], "en")).toEqual(["• Short-duration roadworks (Autobahn GmbH plan) A1: S — per the plan now from 2026-03-29 19:00"]);
  });
  it("three lines and the rest counted, never '+1 more'", () => {
    const four = [1, 2, 3, 4].map((i) => plan(`W${i}`, null, null));
    expect(plannedNowLines("A1", four, "en")[3]).toBe("• Short-duration roadworks (Autobahn GmbH plan) A1: W4");
    expect(plannedNowLines("A1", [...four, plan("W5", null, null)], "de").slice(3)).toEqual(["  +2 weitere im strukturierten Ergebnis."]);
    expect(plannedNowLines("A1", [...four, plan("W5", null, null)], "en").slice(3)).toEqual(["  +2 more in the structured result."]);
    expect(plannedNowLines("A1", [], "en")).toEqual([]);
  });
  it("after the entries, before the next page", async () => {
    const get = async () => ({ data: { lamp: "amber", lampReason: "jam", situations: [], plannedNow: [plan("W", null, null)] }, meta: { generatedAt: "2026-03-30T09:59:00Z", language: "en", asOf: "2026-03-30T09:58:00Z", freshness: [], attribution: [], page: { limit: 5, hasMore: true, nextCursor: "5" } } });
    const r = await HANDLERS["check_autobahn_traffic"]!({ roads: ["A9"], language: "en" }, { tool: "check_autobahn_traffic", language: "en", api: { get } } as never);
    expect((r.content[0] as { text: string }).text.split("\n").slice(1, 3)).toEqual(["• Short-duration roadworks (Autobahn GmbH plan) A9: W", "… more entries on the next page."]);
  });
});

describe("an entry's merged sections, phase dates, cut description and facts", () => {
  const nowRow = new Date("2026-11-24T21:13:00Z");
  const sit = (o: Partial<T.RoadSituation>): T.RoadSituation => ({
    id: "s", kind: "roadworks", severity: "none", road: "A9", direction: null, directionText: null, validity: { from: "2026-08-02T03:00:00Z", until: "2026-08-03T03:00:00Z" },
    headline: "AS Alpha", description: "Zeitraum dieser Bauphase: Beginn Ende", delayMin: null, lengthM: 300, subtitle: null, ...o,
  });
  it("English: the phase's end in full, the sections, the facts, the description as cut", () => {
    const s = sit({ segments: 3, phase: { end: "2027-08-02T05:00+02:00", measureEnd: "2028-01-31T00:00+01:00" }, descriptionShown: "Zeitraum […] Ende …", facts: { between: { from: "junction A", to: "interchange B" }, towards: "Nürnberg", lengthKm: 0.4, maxWidthM: 3.254 } });
    expect(autobahnLine(s, "en", nowRow)).toBe("• Roadworks (Baustelle): A9, since 2026-08-02 05:00, until 2027-08-02 05:00 (whole measure until 2028-01-31), over 0.3 km, reported as 3 sections — between junction A and interchange B, towards Nürnberg, over 0.4 km, max. width 3.25 m — Provider text (German): \"AS Alpha — Zeitraum […] Ende …\"");
  });
  it("German: the phase in German dates, the sections, no facts, the cut description", () => {
    const s = sit({ segments: 2, lengthM: null, phase: { end: "2026-12-11T12:00+01:00", measureEnd: "2026-12-11T00:00+01:00" }, descriptionShown: "Zeitraum […]", facts: { towards: "X" } });
    expect(autobahnLine(s, "de", nowRow)).toBe("• Baustelle: AS Alpha, seit 02.08. 05:00, bis 11.12.2026 12:00, in 2 Teilabschnitten gemeldet — Zeitraum […]");
  });
  it("one section, no phase end, an empty cut description, no facts", () => {
    const s = sit({ segments: 1, lengthM: null, phase: { end: null, measureEnd: "2027-01-31T00:00+01:00" }, descriptionShown: "", facts: {} });
    expect(autobahnLine(s, "en", nowRow)).toBe("• Roadworks (Baustelle): A9, since 2026-08-02 05:00, whole measure until 2027-01-31 — Provider text (German): \"AS Alpha\"");
    expect(autobahnLine(sit({ lengthM: null, phase: null, validity: { from: null, until: null }, descriptionShown: "" }), "de", nowRow)).toBe("• Baustelle: AS Alpha");
    expect(autobahnLine(sit({ lengthM: null, phase: { end: null, measureEnd: null }, descriptionShown: null }), "en", nowRow)).toBe("• Roadworks (Baustelle): A9, since 2026-08-02 05:00 — Provider text (German): \"AS Alpha\"");
  });
  it("the facts in today's words", () => {
    expect(factWords({ posts: { fromKm: 12.3, toKm: 15 }, lanes: "1 lane closed", hardShoulderClosed: true, maxSpeedKmh: 60, queueKm: 2.5 })).toEqual(["from km 12.3 to km 15", "1 lane closed", "hard shoulder closed", "speed limit 60 km/h", "2.5 km long"]);
    expect(factWords({ lengthKm: 0, maxSpeedKmh: 0, maxWidthM: 0, queueKm: 0, hardShoulderClosed: false })).toEqual([]);
    expect(stampText("2026-12-11T00:00+01:00", "de")).toBe("11.12.2026");
    expect(phaseEndWords({ end: "2026-12-11T12:00+01:00", measureEnd: null }, "de")).toBe(", bis 11.12.2026 12:00");
    expect(phaseEndWords({ end: null, measureEnd: "2026-12-11T00:00+01:00" }, "de")).toBe(", Gesamtmaßnahme bis 11.12.2026");
    expect(phaseEndWords({ end: "2026-12-10T12:00+01:00", measureEnd: "2026-12-11T00:00+01:00" }, "de")).toBe(", bis 10.12.2026 12:00 (Gesamtmaßnahme bis 11.12.2026)");
  });
});
