import { describe, expect, it } from "vitest";
import type * as T from "../src/api/types.js";
import { hoursOpenness, osmFuelLines, unrankedLine, wholeDayOpen } from "../src/tools/fuel-words.js";

/** Today's fuel words (find_fuel_station opennessText, find_cheapest_fuel priceText and its unranked note, osm-fuel osmFuelLines). */
const now = new Date("2026-11-25T00:00:00Z");
const detail = (o: Partial<T.FuelStationData>): T.FuelStationData => ({ id: "x", name: "n", brand: null, location: { lat: 50, lon: 7 }, address: null, aroundTheClock: false, openingState: "open", prices: [], ...o });
const row = (openingState: string): T.FuelStation => ({ id: "x", name: "n", brand: null, location: { lat: 50, lon: 7 }, openingState, prices: [] });

describe("hoursOpenness", () => {
  it("says what the schedule says and when it was read, stale as 'last checked'", () => {
    expect(hoursOpenness(detail({ aroundTheClock: true, hoursRefreshedAt: "2026-11-10T22:15:07Z", hoursFreshness: "stale" }), "en", now)).toBe("open 24 h (opening hours last checked 2026-11-10 23:15)");
    expect(hoursOpenness(detail({ aroundTheClock: true, hoursRefreshedAt: "2026-11-10T22:15:07Z", hoursFreshness: "fresh" }), "de", now)).toBe("durchgehend offen (Öffnungszeiten vom 10.11. 23:15)");
    expect(hoursOpenness(detail({ hoursRefreshedAt: "2026-11-24T23:30:00Z", hoursFreshness: "fresh" }), "en", now)).toBe("open (opening hours from 00:30)");
    // Only "stale" says "last checked"; a freshness the API does not judge is the read's date.
    expect(hoursOpenness(detail({ hoursRefreshedAt: "2026-11-24T23:30:00Z", hoursFreshness: null }), "en", now)).toBe("open (opening hours from 00:30)");
    expect(hoursOpenness(detail({ openingState: "closed", hoursRefreshedAt: "2026-11-24T23:30:00Z", hoursFreshness: "stale" }), "de", now)).toBe("geschlossen (Öffnungszeiten zuletzt am 00:30 geprüft)");
  });
  it("never says 'open 24 h' off hours never read", () => {
    expect(hoursOpenness(detail({ aroundTheClock: true, openingState: "unknown", hoursRefreshedAt: null, hoursFreshness: null }), "en", now)).toBe("opening state unknown (opening hours never fetched)");
    expect(hoursOpenness(detail({ aroundTheClock: true, openingState: "open", hoursRefreshedAt: null, hoursFreshness: null }), "de", now)).toBe("offen (Öffnungszeiten nie abgerufen)");
  });
  it("is undefined while the API does not say when the hours were read", () => {
    expect(hoursOpenness(detail({ aroundTheClock: true }), "en", now)).toBeUndefined();
    expect(hoursOpenness(null, "en", now)).toBeUndefined();
  });
});

describe("wholeDayOpen", () => {
  it("dates an around-the-clock station by its hours, only when open and read", () => {
    expect(wholeDayOpen(detail({ aroundTheClock: true, hoursRefreshedAt: "2026-11-13T20:42:25Z" }), row("open"), "en", now)).toBe("open 24 h (opening hours from 2026-11-13 21:42)");
    expect(wholeDayOpen(detail({ aroundTheClock: true, hoursRefreshedAt: "2026-11-13T20:42:25Z" }), row("open"), "de", now)).toBe("durchgehend offen (Öffnungszeiten vom 13.11. 21:42)");
    expect(wholeDayOpen(detail({ aroundTheClock: true, hoursRefreshedAt: "2026-11-13T20:42:25Z" }), row("closed"), "en", now)).toBeUndefined();
    expect(wholeDayOpen(detail({ aroundTheClock: false, hoursRefreshedAt: "2026-11-13T20:42:25Z" }), row("open"), "en", now)).toBeUndefined();
    expect(wholeDayOpen(detail({ aroundTheClock: true, hoursRefreshedAt: null }), row("open"), "en", now)).toBeUndefined();
    expect(wholeDayOpen(null, row("open"), "en", now)).toBeUndefined();
  });
});

describe("unrankedLine", () => {
  it("counts the held stations left out of the ranking, one and many", () => {
    expect(unrankedLine("en", 23, 34, "Super E5")).toBe("\n23 of the 34 stations within the radius have no Super E5 price from the last 30 minutes (older, or none yet) and are not in the ranking.");
    expect(unrankedLine("en", 1, 4, "diesel")).toBe("\nOne of the 4 stations within the radius has no diesel price from the last 30 minutes (older, or none yet) and is not in the ranking.");
    expect(unrankedLine("de", 2, 9, "Diesel")).toBe("\n2 der 9 Tankstellen im Umkreis haben keinen Diesel-Preis aus den letzten 30 Minuten (älter oder noch keiner) und stehen nicht in der Rangfolge.");
    expect(unrankedLine("de", 1, 9, "Diesel")).toBe("\nEine der 9 Tankstellen im Umkreis hat keinen Diesel-Preis aus den letzten 30 Minuten (älter oder noch keiner) und steht nicht in der Rangfolge.");
    expect(unrankedLine("en", 0, 9, "diesel")).toBe("");
  });
});

describe("osmFuelLines", () => {
  const osm = (name: string, brand: string | null, address: T.FuelAddress | null, distanceM: number): T.OsmFuelStation => ({ name, brand, address, location: { lat: 51, lon: 12 }, distanceM, sourceFamily: "osm_fuel" });
  it("heads the unpriced OpenStreetMap stations and numbers them, the brand only when the name lacks it", () => {
    expect(osmFuelLines("en", [osm("Shell Automaten Tankstation", "Shell", null, 900), osm("Supol", "Agip", { street: "Schanzäckerstraße", number: "7", postcode: null, place: "Nürnberg" }, 800)])).toEqual([
      "More filling stations mapped by OpenStreetMap — we don't have a price for these stations yet:",
      "1. Shell Automaten Tankstation — 0.9 km",
      "2. Supol (Agip), Schanzäckerstraße 7, Nürnberg — 0.8 km",
    ]);
    expect(osmFuelLines("de", [osm("Gas", null, { street: null, number: null, postcode: "123", place: "Leipzig" }, 700)])).toEqual(["Weitere Tankstellen laut OpenStreetMap — Preis liegt uns noch nicht vor:", "1. Gas, 123 Leipzig — 0,7 km"]);
    expect(osmFuelLines("en", [])).toEqual([]);
  });
});
