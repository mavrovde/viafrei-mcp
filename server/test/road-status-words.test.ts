/**
 * check_road_status's answer for a road asked by its number, from the proposed roadStatus (today's headLine,
 * itemLines, tailLines and strategyLine).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { DataMeta } from "../src/api/client.js";
import type * as T from "../src/api/types.js";
import { HANDLERS } from "../src/tools/handlers.js";
import { dayText, guidanceLine, roadStatusHead, roadStatusItem, roadStatusMore, publisherOf, roadStatusOf, roadStatusText, sourceName } from "../src/tools/road-status-words.js";

const now = new Date("2026-11-25T00:10:00Z");
const item = (o: Partial<T.RoadStatusItem> = {}): T.RoadStatusItem => ({
  label: "Closure (Sperrung)", road: "A7", namedRoad: false, shown: "AS Alpha — Bauphase", facts: null, from: "2026-11-23T08:00:00Z", to: "2026-11-25T17:00:00Z", measureTo: null, ...o,
});
const status = (o: Partial<T.RoadStatus> = {}): T.RoadStatus => ({
  counts: { closed: 24, restricted: 141, planned: 38, current: 41, currentBy: ["BASt", "Autobahn GmbH"] }, windowEnd: "2026-11-28T00:08:00Z",
  items: [item()], hidden: 239, hiddenClosures: 19, canRaise: false,
  sourcesAnswered: [{ label: "Autobahn GmbH", asOf: "2026-11-25T00:06:00Z" }, { label: "BASt (roadworks)", asOf: "2026-11-24T22:44:00Z" }, { label: "BAB traffic messages", asOf: null }],
  guidance: [], plannedByRoad: true, ...o,
});

describe("the head line", () => {
  it("the tally, who counted the current roadworks, the window", () => {
    expect(roadStatusHead("A7", status(), "en")).toBe("A7: 24 closures, 141 restrictions, 38 planned roadworks sites, 41 current roadworks sites per BASt and Autobahn GmbH — window until 2026-11-28.");
    expect(roadStatusHead("A7", status({ counts: { closed: 1, restricted: 1, planned: 1, current: 1, currentBy: ["BASt"] }, windowEnd: null }), "de"))
      .toBe("A7: 1 Sperrung, 1 Einschränkung, 1 geplante Arbeitsstelle, 1 laufende Arbeitsstelle laut BASt — Zeitraum: jetzt.");
    expect(roadStatusHead("A7", status({ counts: { closed: 2, restricted: 0, planned: 2, current: 0, currentBy: [] } }), "de")).toBe("A7: 2 Sperrungen, 0 Einschränkungen, 2 geplante Arbeitsstellen — Zeitraum bis 28.11.2026.");
    expect(roadStatusHead("A7", status({ counts: { closed: 1, restricted: 1, planned: 1, current: 2, currentBy: ["A", "B", "C"] }, windowEnd: null }), "en"))
      .toBe("A7: 1 closure, 1 restriction, 1 planned roadworks site, 2 current roadworks sites per A, B and C — window: right now.");
    expect(roadStatusHead("A7", status({ counts: { closed: 0, restricted: 0, planned: 0, current: 1, currentBy: ["A", "B"] } }), "de")).toMatch(/1 laufende Arbeitsstelle laut A und B — /u);
    expect(roadStatusHead("A7", status({ counts: { closed: 0, restricted: 0, planned: 0, current: 3, currentBy: ["A"] } }), "de")).toMatch(/3 laufende Arbeitsstellen laut A — /u);
    expect(roadStatusHead("A7", status({ counts: { closed: 0, restricted: 0, planned: 0, current: 0, currentBy: [] } }), "en")).toBe("A7: 0 closures, 0 restrictions, 0 planned roadworks sites — window until 2026-11-28.");
    expect(roadStatusHead("A7", status({ counts: { closed: 0, restricted: 0, planned: 0, current: 1, currentBy: ["A"] } }), "en")).toMatch(/, 1 current roadworks site per A — /u);
  });
});

describe("an entry", () => {
  it("English: the publisher's words quoted, the facts, the span by day", () => {
    expect(roadStatusItem(item({ facts: { towards: "Hamburg" } }), "en")).toBe('• Closure (Sperrung): Provider text (German): "AS Alpha — Bauphase" — towards Hamburg (2026-11-23–2026-11-25)');
  });
  it("the road named for a Land publisher; the whole measure; only an end; nothing stated", () => {
    expect(roadStatusItem(item({ namedRoad: true, from: "2025-02-28T21:00:00Z", to: "2027-10-31T05:00+01:00", measureTo: "2030-04-30T00:00:00+02:00" }), "en"))
      .toBe('• Closure (Sperrung) A7: Provider text (German): "AS Alpha — Bauphase" (2025-02-28–2027-10-31, whole measure until 2030-04-30)');
    expect(roadStatusItem(item({ from: null }), "de")).toBe("• Closure (Sperrung): AS Alpha — Bauphase (25.11.2026)");
    expect(roadStatusItem(item({ from: null, to: null, measureTo: "2030-04-30T00:00:00+02:00", facts: { towards: "X" } }), "de")).toBe("• Closure (Sperrung): AS Alpha — Bauphase (Gesamtmaßnahme bis 30.04.2030)");
    expect(roadStatusItem(item({ from: null, to: null, shown: "" }), "en")).toBe("• Closure (Sperrung)");
    expect(roadStatusItem(item({ from: null, to: null, facts: {} }), "en")).toBe('• Closure (Sperrung): Provider text (German): "AS Alpha — Bauphase"');
  });
  it("an end before its start: the start alone", () => {
    expect(roadStatusItem(item({ from: "2026-11-10T08:00:00Z", to: "2026-10-29T08:00:00Z" }), "en")).toMatch(/ \(2026-11-10\)$/u);
  });
});

describe("the rest, the sources, the guidance, the by-road note", () => {
  it("the rest counted, with the closures among them; a higher limit where it would show all", () => {
    expect(roadStatusMore(239, 19, false, "en")).toBe("… 239 more entries, 19 of them closures; one answer holds at most 11 — narrow it with a place (road and place together), shorten the window or ask about a single road.");
    expect(roadStatusMore(1, 1, true, "en")).toBe("… 1 more entry, 1 of them a closure; ask again with a higher limit (max 11) or narrow it with a place (road and place together).");
    expect(roadStatusMore(1, 0, true, "de")).toBe("… 1 weiterer Eintrag; mit einem höheren limit (max 11) abrufen oder mit place eingrenzen (road und place zusammen).");
    expect(roadStatusMore(3, 1, false, "de")).toBe("… 3 weitere Einträge, davon 1 Sperrung; eine Antwort fasst höchstens 11 — mit place eingrenzen (road und place zusammen), den Zeitraum verkürzen oder eine einzelne Straße abfragen.");
    expect(roadStatusMore(3, 2, false, "de")).toMatch(/, davon 2 Sperrungen;/u);
    expect(roadStatusMore(0, 0, false, "en")).toBeNull();
  });
  it("the guidance in the publisher's words, its own English on an English answer", () => {
    const g: T.RoadGuidance = { title: "optimierte Zielführung", titleEn: "Improved routing", words: "A7.Süd", wordsEn: "A7.South", from: null, to: null, via: null, until: null };
    expect(guidanceLine(g, "en")).toBe("• Traffic guidance by the Autobahn GmbH (strategic routing, switched on): \"Improved routing\" — \"A7.South\" (the Autobahn GmbH's own words). The Autobahn GmbH's recommendation, not a route of ViaFrei's.");
    expect(guidanceLine({ ...g, words: "optimierte Zielführung", from: "Alpha", to: "Beta", via: "A9", until: "2026-11-25T05:00:00Z" }, "de"))
      .toBe("• Verkehrslenkung der Autobahn GmbH (strategisches Routing, geschaltet bis 06:00) bei Alpha – Beta: über A9: „optimierte Zielführung“. Empfehlung der Autobahn GmbH, keine Routenempfehlung von ViaFrei.");
    expect(guidanceLine({ ...g, title: null, titleEn: " ", wordsEn: null, from: "Alpha", to: " ", until: "2026-11-25T05:00:00Z", via: "A9" }, "en"))
      .toBe("• Traffic guidance by the Autobahn GmbH (strategic routing, switched on until 06:00) at Alpha: via A9. The Autobahn GmbH's recommendation, not a route of ViaFrei's.");
  });
  it("the whole answer: the sources with their Stand, the by-road note", () => {
    const lines = roadStatusText("A7", status(), "en", now).split("\n");
    expect(lines[3]).toBe("Sources that answered: Autobahn GmbH — As of 01:06; BASt (roadworks) — As of 2026-11-24 23:44; BAB traffic messages.");
    expect(lines[4]).toBe("Planned roadworks are filed by road and section — the planning data carries no coordinates at all, so this is answered by road rather than by radius.");
    const de = roadStatusText("A7", status({ hidden: 0, plannedByRoad: false, sourcesAnswered: [{ label: "BASt", asOf: "2026-11-24T22:44:00Z" }] }), "de", now).split("\n");
    expect(de.slice(2)).toEqual(["Geantwortet haben: BASt — Stand 24.11. 23:44."]);
    expect(roadStatusText("A7", status({ plannedByRoad: true, guidance: [] }), "de", now).split("\n").at(-1)).toBe("Geplante Arbeitsstellen werden nach Straße und Abschnitt geführt — die Planungsdaten enthalten keine Koordinaten, deshalb wird hier nach Straße geantwortet und nicht nach Umkreis.");
    expect(dayText("2026-11-24T23:30:00Z", "de")).toBe("25.11.2026");
    const g: T.RoadGuidance = { title: null, titleEn: "R", words: null, wordsEn: null, from: null, to: null, via: null, until: null };
    expect(roadStatusText("A7", status({ guidance: [g] }), "en", now).split("\n")[4]).toMatch(/^• Traffic guidance by the Autobahn GmbH /u);
  });
});

describe("API 2.0.4's roadStatus, as prod sent it for the A7", () => {
  // The answer of getMotorwayConditions for A7, trimmed: the roadStatus the contract's example leaves null.
  const a7 = JSON.parse(readFileSync(new URL("./fixtures/road-status-a7.json", import.meta.url), "utf8")) as { data: { roadStatus: T.ApiRoadStatus }; meta: DataMeta };
  const run = async (roadStatus: T.ApiRoadStatus | null, args: Record<string, unknown> = { road: "A7" }) => {
    const asked: string[] = [];
    const get = async (op: string) => {
      asked.push(op);
      if (op === "getMotorwayConditions") return { data: { lamp: "amber", lampReason: "narrowing", situations: [], roadStatus }, meta: a7.meta };
      if (op === "listRoadConditions") return { data: { lamp: "amber", lampReason: "narrowing", situations: [] }, meta: a7.meta };
      if (op === "resolvePlace") return { data: { name: "Seesen", label: "Seesen", kind: "municipality", location: { lat: 51.89, lon: 10.18 } }, meta: a7.meta };
      throw new Error(op);
    };
    const r = await HANDLERS["check_road_status"]!({ language: "en", ...args }, { tool: "check_road_status", language: "en", api: { get } } as never);
    return { text: (r.content[0] as { text: string }).text, isError: r.isError === true, asked };
  };
  it("is read, not crashed on: the tally names its publishers, each entry its provider text", async () => {
    const { text, isError } = await run(a7.data.roadStatus);
    expect(isError).toBe(false);
    const lines = text.split("\n");
    // The tally names who counted (the publisher), not the dataset's "title: holder" line.
    expect(lines).toContain("A7: 20 closures, 137 restrictions, 22 planned roadworks sites, 38 current roadworks sites per Die Autobahn GmbH des Bundes and Bundesanstalt für Straßen- und Verkehrswesen (BASt) — window until 2026-11-28.");
    // The road operator's entry: title · junction — description; another publisher's: its message, the road named.
    expect(lines).toContain('• Closure (Sperrung): Provider text (German): "Via Erhalt A7 von Harz (Raststaette) nach Schwalenberg (Parkplatz) Fahrbahninstandsetzung · AS Seesen (Harz) (aus Richtung Harz) nach A7 — Die Baustelle ist zu…" (2026-11-28, whole measure until 2026-11-28)');
    expect(lines.some((l) => l.startsWith('• Closure (Sperrung) A7: Provider text (German): "A7 Hamburg Richtung Flensburg Einfahrt Neumünster-Mitte gesperrt,'))).toBe(true);
    // The clock decides whether the day stands beside the time (standOf), so the day is optional here.
    expect(text).toMatch(/^Sources that answered: "Verkehrsdaten: Autobahn GmbH des Bundes" — As of (2026-11-27 )?06:32; "Arbeitsstellen: Bundesanstalt für Straßen- und Verkehrswesen \(BASt\)" — As of (2026-11-27 )?05:54; "Arbeitsstellen auf Autobahnen \(14 Tage\): Die Autobahn GmbH des Bundes"\.$/mu);
    expect(text).toMatch(/^Planned roadworks are filed by road and section/mu);
  });
  it("names a source by its family when the answer credits none, and says a planned entry by its bucket", async () => {
    const s = roadStatusOf({ ...a7.data.roadStatus, items: [{ ...a7.data.roadStatus.items[0]!, status: "planned", term: "roadworks" }] }, { ...a7.meta, attribution: [] }, "de");
    expect(s.counts.currentBy).toEqual(["ald_14d", "roadworks_bast"]);
    expect(s.sourcesAnswered[0]!.label).toBe("„autobahn“");
    // Two datasets of one publisher are one name in the tally.
    const both = roadStatusOf({ ...a7.data.roadStatus, counts: { ...a7.data.roadStatus.counts, currentFamilies: ["ald_14d", "autobahn", "x"] } }, a7.meta, "en");
    expect(both.counts.currentBy).toEqual(["Die Autobahn GmbH des Bundes", "Autobahn GmbH des Bundes", "x"]);
    expect(roadStatusOf({ ...a7.data.roadStatus, counts: { ...a7.data.roadStatus.counts, currentFamilies: ["ald_14d", "ald_14d"] } }, a7.meta, "en").counts.currentBy).toEqual(["Die Autobahn GmbH des Bundes"]);
    expect(publisherOf("Nur ein Name")).toBe("Nur ein Name");
    expect(s.items[0]!.label).toBe("Geplante Arbeitsstelle");
    expect(s.items[0]!.namedRoad).toBe(false);
    expect(sourceName("x", { ...a7.meta, attribution: [{ family: "x", text: "Nur ein Name" }] })).toBe("Nur ein Name");
  });
  it("every status × every term has a label in words, in both languages, never the raw value", () => {
    const statuses = ["closed", "restricted", "current", "programme", "planned"];
    const terms = ["closure", "roadworks", "restriction"];
    const raw = [...statuses, ...terms];
    for (const language of ["de", "en"] as const) {
      for (const status of statuses) {
        for (const term of terms) {
          const label = roadStatusOf({ ...a7.data.roadStatus, items: [{ ...a7.data.roadStatus.items[0]!, status, term }] }, a7.meta, language).items[0]!.label;
          expect(raw).not.toContain(label);
          expect(label).toMatch(/^\p{Lu}/u);
          // German says no English value at all.
          if (language === "de") for (const r of raw) expect(label.toLowerCase()).not.toContain(r);
        }
      }
      // A works bucket (planned, current, programme) is told apart from what the entry is called, and from each other.
      const labelOf = (status: string, term: string) => roadStatusOf({ ...a7.data.roadStatus, items: [{ ...a7.data.roadStatus.items[0]!, status, term }] }, a7.meta, language).items[0]!.label;
      const buckets = ["planned", "current", "programme"].map((b) => labelOf(b, "roadworks"));
      expect(new Set(buckets).size).toBe(3);
      for (const b of buckets) expect(b).not.toBe(labelOf("closed", "roadworks"));
    }
  });
  it("a motorway with a place is the place's situations on it, as the more line offers", async () => {
    const { asked, text } = await run(a7.data.roadStatus, { road: "A7", place: "Seesen" });
    expect(asked).toContain("listRoadConditions");
    expect(asked).not.toContain("getMotorwayConditions");
    expect(text).toMatch(/^A7 near Seesen/u);
  });
  it("today's list without it", async () => {
    expect((await run(null)).text.split("\n")[0]).toBe("A7: there is no report — which explicitly does not mean the road is clear.");
  });
});
