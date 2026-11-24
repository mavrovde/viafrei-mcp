import { describe, expect, it } from "vitest";
import { drivingKeys, drivingNote, hazardLabel, levelLabel, windowText } from "../src/tools/weather-block.js";

const now = new Date("2026-11-24T21:00:00Z");
const v = (from: string | null, until: string | null, inForce?: boolean) => ({ validity: { from, until }, ...(inForce === undefined ? {} : { inForce }) });

describe("a DWD warning's words, as today's server says them", () => {
  it("the level names, ours marked as ours; an unknown level is a warning", () => {
    expect([1, 2, 3, 4].map((l) => levelLabel("de", l))).toEqual(["Stufe 1 von 4 — Wetterwarnung", "Stufe 2 von 4 — Markante Wetterwarnung", "Stufe 3 von 4 — Unwetterwarnung", "Stufe 4 von 4 — Warnung vor extremem Unwetter"]);
    expect(levelLabel("en", 4)).toBe("Level 4 of 4 — Warnung vor extremem Unwetter (the DWD's own name; our translation: warning of extreme severe weather)");
    expect(levelLabel("en", 7)).toBe("Level 7 of 4 — Warnung (the DWD's own name; our translation: warning)");
  });
  it("the hazard: English name and the DWD's word, folded; German and an unknown word as published", () => {
    expect(hazardLabel("en", " sturmböen ")).toBe("Storm gusts (sturmböen)");
    expect(hazardLabel("en", "VORABINFORMATION HEFTIGER/ERGIEBIGER REGEN")).toMatch(/^.+ \(VORABINFORMATION HEFTIGER\/ERGIEBIGER REGEN\)$/u);
    expect(hazardLabel("en", "NEUES WORT")).toBe("NEUES WORT");
    expect(hazardLabel("de", "FROST")).toBe("FROST");
    expect([hazardLabel("en", null), hazardLabel("en", undefined), hazardLabel("en", "  ")]).toEqual([null, null, null]);
  });
  it("the driving sentences by event word and level, in today's order", () => {
    expect(drivingKeys(1, "ORKANBÖEN")).toEqual(["gusts"]);
    expect(drivingKeys(2, "glatteis")).toEqual(["ice"]);
    expect(drivingKeys(1, "STRENGER FROST")).toEqual(["generic"]);
    expect(drivingKeys(3, "DAUERREGEN")).toEqual(["rain", "level3"]);
    expect(drivingKeys(4, "SCHWERES GEWITTER MIT HEFTIGEM STARKREGEN UND HAGEL")).toEqual(["rain", "thunder", "level4"]);
    expect(drivingKeys(1, "NEBEL")).toEqual(["fog"]);
    expect(drivingKeys(2, "STARKE HITZE")).toEqual(["heat"]);
    expect(drivingKeys(1, "UV-INDEX")).toEqual(["heat"]);
    expect(drivingKeys(0, null)).toEqual(["level0"]);
    expect(drivingKeys(1, "SCHNEEVERWEHUNG")).toEqual(["ice"]);
    expect(drivingKeys(1, "BOEEN")).toEqual(["gusts"]);
    expect(drivingKeys(1, "NIEDERSCHLAG")).toEqual(["rain"]);
    expect(drivingKeys(1, "SICHT")).toEqual(["fog"]);
    expect(drivingNote("de", 3, "STURM")).toBe("Böen können Fahrzeuge versetzen; auf Brücken, in Waldstücken und beim Überholen von Lkw besonders vorsichtig fahren. Fahrten möglichst verschieben oder zusätzliche Zeit einplanen.");
    expect(drivingNote("en", 0, null)).toBe("A DWD advance notice: severe weather is likely and the warning itself is still to come. Check again before setting off.");
  });
  it("the window: in force, not yet, no end, no start", () => {
    expect(windowText("en", v("2026-11-24T15:00:00Z", "2026-11-25T11:00:00Z", true), now)).toBe("until 2026-11-25 12:00 (since 16:00)");
    expect(windowText("de", v("2026-11-24T22:00:00Z", "2026-11-25T11:00:00Z"), now)).toBe("von 23:00 bis 25.11. 12:00");
    expect(windowText("en", v("2026-11-24T15:00:00Z", "2026-11-25T11:00:00Z", false), now)).toBe("from 16:00 until 2026-11-25 12:00");
    expect(windowText("de", v("2026-11-24T15:00:00Z", null, true), now)).toBe("seit 16:00, Ende offen");
    expect(windowText("en", v("2026-11-24T15:00:00Z", null), now)).toBe("since 16:00, no end given");
    expect(windowText("de", v("2026-11-24T22:00:00Z", null), now)).toBe("ab 23:00, Ende offen");
    expect(windowText("en", v("2026-11-24T22:00:00Z", null), now)).toBe("from 23:00, no end given");
    expect(windowText("de", v(null, "2026-11-25T11:00:00Z"), now)).toBe("bis 25.11. 12:00");
    expect(windowText("en", v(null, "2026-11-25T11:00:00Z"), now)).toBe("until 2026-11-25 12:00");
    expect([windowText("de", v(null, null), now), windowText("en", v(null, null), now)]).toEqual(["Ende offen", "no end given"]);
  });
});
