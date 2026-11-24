import { describe, expect, it } from "vitest";
import type * as T from "../src/api/types.js";
import { addressAnswer, foldAddresses, sameDoor } from "../src/tools/address-words.js";

const a = (o: Partial<T.Address> = {}): T.Address => ({
  street: "Unter den Linden", number: "1", postcode: "10117", place: "Berlin", land: "Berlin", location: { lat: 52.5172781, lon: 13.3978248 }, dataAsOf: "2026-10-27", ...o,
});
const way = a({ postcode: null, land: null, location: { lat: 52.51720, lon: 13.39782 }, dataAsOf: "2026-10-28" });

describe("find_address, as today's answer", () => {
  it("the same door mapped twice is one point: the fuller row, the fold said, the oldest extract day", () => {
    expect(addressAnswer("Unter den Linden 1, Berlin", [way, a()], "en")).toBe([
      "\"Unter den Linden 1, Berlin\":",
      "Unter den Linden 1, 10117 Berlin, Berlin",
      "52.51728, 13.39782",
      "(2 OpenStreetMap objects of this address, up to 9 m apart, shown as one point)",
      "",
      "OpenStreetMap data as of 2026-10-27",
    ].join("\n"));
    expect(addressAnswer("x", [a({ land: "Bayern", place: "München", postcode: "20000", dataAsOf: null })], "en")).toBe("\"x\":\nUnter den Linden 1, 20000 München, Bavaria\n52.51728, 13.39782");
    expect(addressAnswer("x", [a({ land: "Bayern" })], "de").split("\n")[1]).toBe("Unter den Linden 1, 10117 Berlin, Bayern");
  });
  it("not one door: another number, a contradicting postcode, or further than 150 m", () => {
    expect(sameDoor(a(), way)).toBe(true);
    expect(sameDoor(a(), a({ number: "2" }))).toBe(false);
    expect(sameDoor(a(), a({ postcode: "20000" }))).toBe(false);
    expect(sameDoor(a(), a({ place: "Potsdam" }))).toBe(false);
    expect(sameDoor(a(), a({ location: { lat: 52.5172781, lon: 13.4005 } }))).toBe(false);
    expect(foldAddresses([a(), way, a({ number: "2" })]).map((g) => g.members.length)).toEqual([2, 1]);
  });
  it("points of one address apart are numbered, measured from point 1, and their spread said", () => {
    const far = a({ location: { lat: 52.5172781, lon: 13.4005 } });
    expect(addressAnswer("q", [a({ dataAsOf: null }), far], "de").split("\n")).toEqual([
      "\"q\" — 2 kartierte Objekte an dieser Adresse:",
      "1. Unter den Linden 1, 10117 Berlin, Berlin — 52.51728, 13.39782",
      "2. Unter den Linden 1, 10117 Berlin, Berlin — 52.51728, 13.40050 — 181 m von Punkt 1",
      "Die 2 Punkte liegen bis zu 181 m auseinander — weiter als 150 m, also nicht dieselbe Tür doppelt kartiert; vermutlich mehrere Gebäude unter dieser Hausnummer.",
      "",
      "Stand der OpenStreetMap-Daten: 2026-10-27",
    ]);
    expect(addressAnswer("q", [a(), way, a({ number: "3" })], "en").split("\n").slice(1, 4)).toEqual([
      "1. Unter den Linden 1, 10117 Berlin, Berlin — 52.51728, 13.39782",
      "   (2 OpenStreetMap objects of this address, up to 9 m apart, shown as one point)",
      expect.stringMatching(/^2\. Unter den Linden 3, 10117 Berlin, Berlin — 52\.51728, 13\.39782 — 0 m from point 1$/u),
    ]);
  });
  it("today's fold exactly: a chain is one door, names folded, an empty postcode no contradiction, the spread from the kept row", () => {
    // A–B 140 m, B–C 140 m, A–C 280 m: C joins through B, as today's g.some.
    const A = a({ location: { lat: 52.5, lon: 13.4 } });
    const B = a({ location: { lat: 52.5 + 140 / 111_195, lon: 13.4 } });
    const C = a({ location: { lat: 52.5 + 280 / 111_195, lon: 13.4 } });
    const chain = foldAddresses([A, B, C]);
    expect(chain.map((g) => g.members.length)).toEqual([3]);
    // The kept row is the lead on a tie; the spread is the farthest member from it, not the widest pair alone by chance.
    expect(chain[0]!.hit).toBe(A);
    expect(Math.round(chain[0]!.spreadM)).toBe(280);
    // The spread is measured from the kept row: B kept (the only one with a postcode), A and C each 140 m from it.
    const mid = foldAddresses([a({ postcode: null, location: A.location }), a({ location: B.location }), a({ postcode: null, location: C.location })]);
    expect(mid[0]!.hit.location).toEqual(B.location);
    expect(Math.round(mid[0]!.spreadM)).toBe(140);
    // Richness is postcode and town only: a row with a Land and nothing else is no richer than the lead.
    const lead = a({ land: null });
    expect(foldAddresses([lead, a({ land: "Berlin" })])[0]!.hit).toBe(lead);
    // Folded names: "12 a" is "12a", "Straße" is "strasse", "Müller-Weg" is "Muller Weg".
    expect(sameDoor(a({ number: "12 a" }), a({ number: "12a" }))).toBe(true);
    expect(sameDoor(a({ street: "Hauptstraße" }), a({ street: "Hauptstrasse" }))).toBe(true);
    expect(sameDoor(a({ street: "Müller-Weg" }), a({ street: "Muller Weg" }))).toBe(true);
    // An empty postcode or town contradicts nothing.
    expect(sameDoor(a({ postcode: "" }), a())).toBe(true);
    expect(sameDoor(a({ place: "" }), a({ place: "Potsdam" }))).toBe(true);
  });
});
