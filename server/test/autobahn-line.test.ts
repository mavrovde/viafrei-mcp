import { describe, expect, it } from "vitest";
import type * as T from "../src/api/types.js";
import { autobahnLine } from "../src/tools/handlers.js";

const now = new Date("2026-11-24T21:13:00Z");
const sit = (o: Partial<T.RoadSituation>): T.RoadSituation => ({
  id: "s", kind: "closure", severity: "road_closed", road: "A9", direction: "south", directionText: null, validity: { from: "2026-11-03T15:00:00Z", until: "2026-12-11T11:00:00Z" },
  headline: "AS Weißenfels", description: null, delayMin: null, lengthM: null, ...o,
});

describe("check_autobahn_traffic's entry, as today's line", () => {
  it("English: kind, road, since and until, then the provider's German quoted and labelled", () => {
    expect(autobahnLine(sit({ description: "Zeitraum dieser Bauphase: Ende: 11.12.26 um 12:00 Uhr AS Weißenfels" }), "en", now)).toBe(
      "• Closure (Sperrung): A9, since 2026-11-03 16:00, until 2026-12-11 12:00 — Provider text (German): \"AS Weißenfels — Zeitraum dieser Bauphase: Ende: 11.12.26 um 12:00 Uhr\"");
  });
  it("German: the provider's place words lead, the description after the dash", () => {
    expect(autobahnLine(sit({ subtitle: "Halle/Leipzig -> Nürnberg", directionText: "Nürnberg", description: "Vollsperrung" }), "de", now)).toBe(
      "• Sperrung: AS Weißenfels · Halle/Leipzig -> Nürnberg · Nürnberg, seit 03.11. 16:00, bis 11.12. 12:00 — Vollsperrung");
  });
  it("the length and the delay in our words; a delay of 0 is not said; a start today is its time", () => {
    expect(autobahnLine(sit({ kind: "roadworks", lengthM: 400, delayMin: 0, validity: { from: "2026-11-24T05:00:00Z", until: null } }), "en", now)).toBe(
      "• Roadworks (Baustelle): A9, since 06:00, over 0.4 km — Provider text (German): \"AS Weißenfels\"");
    expect(autobahnLine(sit({ kind: "jam", delayMin: 20, lengthM: 900, validity: { from: null, until: null } }), "de", now)).toBe("• Stau: AS Weißenfels, +20 min, auf 0,9 km");
  });
  it("one not begun yet says from; one begun in an earlier year says its day", () => {
    expect(autobahnLine(sit({ validity: { from: "2026-11-25T06:00:00Z", until: null } }), "en", now)).toBe("• Closure (Sperrung): A9, from 2026-11-25 07:00 — Provider text (German): \"AS Weißenfels\"");
    expect(autobahnLine(sit({ validity: { from: "2026-11-25T06:00:00Z", until: null } }), "de", now)).toBe("• Sperrung: AS Weißenfels, ab 25.11. 07:00");
    expect(autobahnLine(sit({ validity: { from: "2025-02-28T21:00:00Z", until: null } }), "en", now)).toBe("• Closure (Sperrung): A9, since 2025-02-28 — Provider text (German): \"AS Weißenfels\"");
    expect(autobahnLine(sit({ validity: { from: "2025-02-28T21:00:00Z", until: null } }), "de", now)).toBe("• Sperrung: AS Weißenfels, seit 28.02.2025");
  });
  it("a provider code is said by its kind; nothing quoted, no road, the road stands in German", () => {
    expect(autobahnLine(sit({ kind: "jam", headline: "abnormalTraffic", validity: { from: null, until: null } }), "en", now)).toBe("• Jam (Stau): A9");
    expect(autobahnLine(sit({ kind: "jam", headline: "abnormalTraffic", validity: { from: null, until: null } }), "de", now)).toBe("• Stau: A9");
    expect(autobahnLine(sit({ kind: "other", road: null, headline: "Meldung", distanceM: 2500, validity: { from: null, until: null } }), "en", now)).toBe("• Report (Meldung): about 2.5 km away — Provider text (German): \"Meldung\"");
  });
});
