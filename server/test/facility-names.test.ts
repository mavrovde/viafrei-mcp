import { describe, it } from "vitest";
import { explanationIn, facilityNameIn } from "../src/tools/facilities.js";
import { pinned } from "./pinned.js";

// One unit name per glossary entry and per spelling it takes (DB's German, as the station data writes it), and
// names the glossary does not finish, so a changed pattern or word shows as a changed line.
const NAMES = [
  "Bahnsteig Gleis 3", "S-Bstg. 1", "S-Bstg 2", "Bstg. 4", "Bstg 5", "Bahnsteig 6", "Gepäckbahnsteig", "Lastenaufzug", "Aufzug", "aufzug",
  "Fahrtreppe", "Kein Halt", "Gleise 1/2", "Gleis 7", "Gl. 8", "Gl.", "Gl.x", "zum Gleis 1", "zur Unterführung", "zu Gleis 2", "nach Nord",
  "vom Vorplatz", "von Gleis 3", "ab EG", "aufwärts", "Fahrtreppe aufw.", "aufw.x", "abwärts", "Fahrtreppe abw.", "Ausgang", "Eingang",
  "Nord und Süd", "Südsteg", "Nordsteg", "Mittelsteg", "Steg", "Süd", "Nord", "Ost", "West", "1. UG", "2.UG", "UG", "EG", "1. OG", "3.OG",
  "OG", "Unterführung", "Empfangsgebäude", "Vorplatz", "Aufzug zum Parkhaus", "Ausgang  Ost ", "Gleis 1 - 2", "",
];
const STATES = ["available", "not available", "under construction", "under maintenance", "not monitored", "monitoring disrupted", "monitoring not available", "Reparatur"];

describe("a unit's name and an operator's state word, in English and German", () => {
  it("every glossary entry: the English name, or DB's German quoted", async () => {
    await pinned("facilities", [
      ...NAMES.map((n) => `${JSON.stringify(n)} => ${JSON.stringify(facilityNameIn("en", n))} | de ${JSON.stringify(facilityNameIn("de", n))}`),
      ...STATES.map((s) => `state ${JSON.stringify(s)} => de ${JSON.stringify(explanationIn("de", s))} | en ${JSON.stringify(explanationIn("en", s))}`),
    ].join("\n"));
  });
});
