/**
 * find_nearby's lines for the fields the API is asked for: the OpenStreetMap filling stations without a price,
 * the charging point register's caveat beside a register row, OpenStreetMap's car parks (today's find_nearby).
 */
import { describe, expect, it } from "vitest";
import type * as T from "../src/api/types.js";
import { HANDLERS } from "../src/tools/handlers.js";
import { registerCaveat } from "../src/tools/nearby.js";
import { osmFuelInline } from "../src/tools/fuel-words.js";

const meta = { generatedAt: "2026-03-30T09:59:00Z", language: "en", asOf: "2026-03-30T09:58:00Z", freshness: [], attribution: [] };
const osmFuel = (o: Partial<T.OsmFuelStation> = {}): T.OsmFuelStation =>
  ({ name: "Supol", brand: null, address: { street: "Hauptstraße", number: "7", postcode: "123", place: "Alpha" }, location: { lat: 1, lon: 2 }, distanceM: 800, sourceFamily: "osm", ...o } as T.OsmFuelStation);
const site = (name: string): T.ChargingSite => ({ id: name, name, operator: null, location: { lat: 1, lon: 2 }, distanceM: 200, access: "public", summary: { chargePoints: 1, availableNow: null, maxPowerKw: 11 } });
const fuelRow: T.NearbyFuelStation = { name: "AVIA", brand: "AVIA", distanceM: 100, prices: [] };

async function nearby(data: T.NearbyData, categories: string[], language: "de" | "en" = "en"): Promise<string[]> {
  const get = async (op: string) => {
    if (op === "listNearby") return { data, meta };
    if (op === "listFuelOptions") return { data: [], meta };
    throw new Error(op);
  };
  const r = await HANDLERS["find_nearby"]!({ lat: 1, lon: 2, categories, language }, { tool: "find_nearby", language, api: { get } } as never);
  return (r.content[0] as { text: string }).text.split("\n");
}

describe("the OpenStreetMap filling stations without a price", () => {
  it("one line after the priced stations: numbered, with the address where OSM has one", async () => {
    const lines = await nearby({ fuel: [fuelRow], osmFuel: [osmFuel(), osmFuel({ name: "Gas & More", address: null, distanceM: 3000 })] }, ["fuel"]);
    expect(lines[2]).toBe("- More filling stations mapped by OpenStreetMap — we don't have a price for these stations yet: 1) Supol, Hauptstraße 7, 123 Alpha (0.8 km); 2) Gas & More (3.0 km)");
  });
  it("also where no station has a price", async () => {
    const lines = await nearby({ fuel: [], osmFuel: [osmFuel()] }, ["fuel"], "de");
    expect(lines[2]).toBe("- Weitere Tankstellen laut OpenStreetMap — Preis liegt uns noch nicht vor: 1) Supol, Hauptstraße 7, 123 Alpha (0,8 km)");
  });
  it("credited by the OpenStreetMap line meta.attribution carries, its share-alike licence flagged", async () => {
    const osmCredit = { family: "osm", domain: "places", publisher: "OSM", text: "OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0", licence: "ODbL 1.0", licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/", shareAlike: true, shareAlikeOffer: null, termsUrl: null };
    const get = async (op: string) => {
      if (op === "listNearby") return { data: { fuel: [], osmFuel: [osmFuel()] }, meta: { ...meta, attribution: [osmCredit] } };
      if (op === "listFuelOptions") return { data: [], meta };
      throw new Error(op);
    };
    const r = await HANDLERS["find_nearby"]!({ lat: 1, lon: 2, categories: ["fuel"], language: "en" }, { tool: "find_nearby", language: "en", api: { get } } as never);
    expect((r.content[0] as { text: string }).text).toContain("1) Supol, Hauptstraße 7, 123 Alpha (0.8 km)");
    expect((r._meta as { attribution: string }).attribution).toContain("OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0");
    expect(JSON.stringify((r._meta as { license: unknown }).license)).toContain("ODbL 1.0");
    expect((r._meta as { shareAlike?: boolean }).shareAlike).toBe(true);
  });
  it("nothing where OSM maps none", async () => {
    expect(osmFuelInline("en", [])).toBeNull();
    expect(await nearby({ fuel: [fuelRow] }, ["fuel"])).toHaveLength(4);
  });
});

describe("the charging point register's caveat", () => {
  it("beside the charging rows when one is the register's, with its release", async () => {
    const lines = await nearby({ charging: [site("Adlerstraße 4")], chargingRegister: { releasedOn: "2026-09-01" } }, ["charging"]);
    expect(lines.slice(1, 3)).toEqual(["- charging: Adlerstraße 4 (0.2 km)", "  Charging point register as of 2026-09-01 — chargers as reported by their operators to the Bundesnetzagentur, with no live occupancy and no warranty of accuracy or completeness."]);
  });
  it("not without a register row, and never under 'nothing nearby'", async () => {
    expect(await nearby({ charging: [site("A")], chargingRegister: null }, ["charging"])).toHaveLength(4);
    expect(await nearby({ charging: [site("A")] }, ["charging"])).toHaveLength(4);
    expect((await nearby({ charging: [], chargingRegister: { releasedOn: null } }, ["charging"])).slice(1, 3)).toEqual(["- charging: nothing nearby", ""]);
  });
  it("in each language, with or without a release", () => {
    expect(registerCaveat("de", "2026-09-01")).toBe("Stand des Ladesäulenregisters: 01.09.2026 — von den Betreibern an die Bundesnetzagentur gemeldete Ladepunkte, ohne Live-Belegung und ohne Gewähr für Richtigkeit und Vollständigkeit.");
    expect(registerCaveat("de", null)).toMatch(/^Ladesäulenregister — von den Betreibern/u);
    expect(registerCaveat("en", null)).toMatch(/^Charging point register — chargers/u);
  });
});

describe("OpenStreetMap's car parks", () => {
  const osm = [{ id: "node/1", name: " Parkhaus Frauengasse ", distanceM: 100 }];
  it("in place of 'nothing nearby' where no operator or city car park is held", async () => {
    expect((await nearby({ parking: [], osmParking: osm }, ["parking"])).slice(1, 3))
      .toEqual(["- car parks per OpenStreetMap (ODbL, no capacity or occupancy; we hold no car park or P+R data from an operator or a city here): Parkhaus Frauengasse (0.1 km)", ""]);
  });
  it("beside a held list, said as more", async () => {
    const held = { id: "p", name: "Alter Wall", distanceM: 300 } as unknown as T.ParkingSite;
    expect((await nearby({ parking: [held], osmParking: osm }, ["parking"], "de")).slice(1, 3))
      .toEqual(["- Parkplätze: Alter Wall (0,3 km)", "- weitere Parkplätze laut OpenStreetMap (ODbL, ohne Platzzahl und Belegung): Parkhaus Frauengasse (0,1 km)"]);
  });
  it("nothing nearby where neither is", async () => {
    expect((await nearby({ parking: [], osmParking: [] }, ["parking"]))[1]).toBe("- parking: nothing nearby");
  });
});
