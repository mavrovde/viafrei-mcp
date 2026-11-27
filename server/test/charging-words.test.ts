/**
 * find_charging_station on the API's place grouping (listChargingOptions group=place): one line a place, named by
 * its name and address, never by a record id; its plugs, price per kWh, live counts and their age, the register flag
 * and release, the prices published, the hidden sites under only_available and the ids a charger watch takes.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as T from "../src/api/types.js";
import { HANDLERS } from "../src/tools/handlers.js";
import { placeStatusText, priceText } from "../src/tools/charging.js";

afterEach(() => vi.useRealTimers());

const NOW = new Date("2026-11-23T17:53:00Z");
const status = (o: Partial<NonNullable<T.ChargingPlace["status"]>> = {}): NonNullable<T.ChargingPlace["status"]> =>
  ({ free: 2, occupied: 1, outOfOrder: 0, total: 3, observedAt: "2026-11-23T17:48:00Z", stale: false, ...o });
const place = (o: Partial<T.ChargingPlace> = {}): T.ChargingPlace => ({
  siteId: "afir_alpha:cs-01-0001", siteIds: ["afir_alpha:cs-01-0001"], address: { street: "Herborner Str.", number: "52", postcode: "10117", city: "Berlin" },
  connectors: [{ type: "CCS2", count: 2, powerKw: 150 }, { type: "Type 2", count: 1, powerKw: 22 }], price: { amount: 0.57, basis: "net", currency: "EUR" },
  status: status(), fromRegister: false, registerReleasedOn: null, sourceEnded: false, ...o,
});
const site = (name: string | null, p: T.ChargingPlace | undefined, o: Partial<T.ChargingSite> = {}): T.ChargingSite => ({
  id: "bnetza_lsr:52.520007,13.404954:1a6a82f4cba3", name, operator: "Löckbrau Strom", location: { lat: 52.52, lon: 13.405 }, distanceM: 300, access: "public",
  summary: { chargePoints: 3, availableNow: 2, maxPowerKw: 150 }, ...(p === undefined ? {} : { place: p }), ...o,
});

async function run(data: T.ChargingSite[], meta: Record<string, unknown> = {}, args: Record<string, unknown> = {}, language: "de" | "en" = "en") {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  const seen: Record<string, unknown>[] = [];
  const get = async (op: string, q: Record<string, unknown>) => {
    if (op !== "listChargingOptions") throw new Error(op);
    seen.push(q);
    return { data, meta: { generatedAt: NOW.toISOString(), language, asOf: NOW.toISOString(), freshness: [], attribution: [], ...meta } };
  };
  const r = await HANDLERS["find_charging_station"]!({ lat: 52.52, lon: 13.405, language, ...args }, { tool: "find_charging_station", language, api: { get } } as never);
  return { text: (r.content[0] as { text: string }).text, lines: (r.content[0] as { text: string }).text.split("\n"), seen, r };
}

describe("find_charging_station asks the place grouping where it may", () => {
  it("group=place without max_power_kw, operator or conditions; the records otherwise", async () => {
    expect((await run([])).seen[0]).toMatchObject({ group: "place" });
    expect((await run([], {}, { connector: "ccs2", min_power_kw: 50, only_available: true })).seen[0]).toMatchObject({ group: "place" });
    for (const a of [{ max_power_kw: 22 }, { operator: "EnBW" }, { conditions: ["free"] }]) expect((await run([], {}, a)).seen[0]!["group"]).toBeUndefined();
  });
});

describe("N1/N2: a place is named by its name and address, its operator after it; never a raw id", () => {
  it("the API's label, then the operator, then the facts in today's order", async () => {
    const { lines } = await run([site("Laden am Markt, Herborner Str. 52, 10117 Berlin", place())]);
    expect(lines[1]).toBe("1. Laden am Markt, Herborner Str. 52, 10117 Berlin (Löckbrau Strom) — 0.3 km, CCS2/Type 2, up to 150 kW, 0.57 €/kWh net, 2 of 3 free (as of 18:48)");
  });
  it("a record without name and operator says what it is; no line carries the record id", async () => {
    const { text, lines } = await run([site(null, undefined, { operator: null })], {}, { operator: "x" });
    expect(lines[1]).toBe("1. Charging site — 0.3 km, up to 150 kW, no status data");
    expect(text).not.toContain("bnetza_lsr:");
    const de = await run([site(null, undefined, { operator: null })], {}, { operator: "x" }, "de");
    expect(de.lines[1]).toBe("1. Ladestandort — 0,3 km, bis 150 kW, keine Statusdaten");
    // A nameless record with an operator is named by it, not repeated after it.
    expect((await run([site(null, undefined)], {}, { operator: "x" })).lines[1]).toBe("1. Löckbrau Strom — 0.3 km, up to 150 kW, no status data");
  });
  it("an operator the label already names is not said twice", async () => {
    expect((await run([site("Löckbrau Strom Laden, Hauptstr. 1", place({ connectors: [], price: null }))])).lines[1]).toBe("1. Löckbrau Strom Laden, Hauptstr. 1 — 0.3 km, up to 150 kW, 2 of 3 free (as of 18:48)");
  });
});

describe("N3: the price per kWh as published, and how many places publish one", () => {
  it("net or gross, in each language's decimal sign; no price, no price word (never 0)", () => {
    expect(priceText({ amount: 0.57, basis: "net", currency: "EUR" }, "en")).toBe("0.57 €/kWh net");
    expect(priceText({ amount: 0.489, basis: "gross", currency: "EUR" }, "de")).toBe("0,49 €/kWh brutto");
    expect(priceText({ amount: 0.49, basis: "gross", currency: "EUR" }, "en")).toBe("0.49 €/kWh gross");
    expect(priceText({ amount: 0.49, basis: "net", currency: "EUR" }, "de")).toBe("0,49 €/kWh netto");
    expect(priceText(null, "en")).toBeNull();
  });
  it("'published for k of n only' where some publish one; 'for none' where none does; nothing where all do", async () => {
    const two = [site("A", place()), site("B", place({ price: null }))];
    expect((await run(two, { pricesPublished: { places: 2, priced: 1 } })).text).toContain("Price per kWh: published for 1 of 2 only; for the others we hold no price.");
    expect((await run(two, { pricesPublished: { places: 2, priced: 1 } }, {}, "de")).text).toContain("Preis pro kWh: nur für 1 von 2 veröffentlicht; für die übrigen liegt uns kein Preis vor.");
    const none = await run([site("B", place({ price: null }))], { pricesPublished: { places: 1, priced: 0 } });
    expect(none.text).toContain("Price per kWh: not published for any of these sites (in the data we hold).");
    expect(none.lines[1]).not.toMatch(/€/u);
    expect((await run([site("A", place())], { pricesPublished: { places: 1, priced: 1 } })).text).not.toContain("Price per kWh");
  });
});

describe("N4: every state the API counts, per place, and the age of a status no point confirms now", () => {
  it("free, occupied, out of order, unknown points; as of its time", () => {
    expect(placeStatusText(status(), "en", NOW)).toBe("2 of 3 free (as of 18:48)");
    expect(placeStatusText(status({ free: 1, occupied: 1, total: 4 }), "en", NOW)).toBe("1 of 2 free, 2 without status (as of 18:48)");
    expect(placeStatusText(status({ free: 0, occupied: 2, outOfOrder: 1 }), "de", NOW)).toBe("belegt, 1 außer Betrieb (Stand 18:48)");
    expect(placeStatusText(status({ free: 0, occupied: 2, outOfOrder: 0, total: 2 }), "en", NOW)).toBe("occupied (as of 18:48)");
    expect(placeStatusText(status({ free: 0, occupied: 0, outOfOrder: 3 }), "en", NOW)).toBe("out of order (as of 18:48)");
    expect(placeStatusText(status({ free: 0, occupied: 0, outOfOrder: 0 }), "en", NOW)).toBe("no status data");
    expect(placeStatusText(null, "de", NOW)).toBe("keine Statusdaten");
  });
  it("stale: the last counts, then 'status from HH:MM (n h m min ago) — possibly out of date'; a day or more: the date alone", () => {
    expect(placeStatusText(status({ free: 7, occupied: 1, total: 8, stale: true, observedAt: "2026-11-23T08:36:00Z" }), "en", NOW)).toBe("7 free, 1 occupied, status from 09:36 (9 h 17 min ago) — possibly out of date");
    expect(placeStatusText(status({ free: 7, occupied: 1, total: 8, stale: true, observedAt: "2026-11-23T08:36:00Z" }), "de", NOW)).toBe("7 frei, 1 belegt, Status von 09:36 (vor 9 h 17 min) — möglicherweise veraltet");
    expect(placeStatusText(status({ free: 0, occupied: 0, outOfOrder: 2, total: 3, stale: true, observedAt: "2026-11-23T17:11:00Z" }), "en", NOW)).toBe("2 out of order, status from 18:11 (42 min ago) — possibly out of date, 1 without status");
    expect(placeStatusText(status({ free: 0, occupied: 0, stale: true, observedAt: "2026-11-23T17:00:00Z" }), "en", NOW)).toBe("status from 18:00 (53 min ago) — possibly out of date, 3 without status");
    expect(placeStatusText(status({ stale: true, observedAt: "2026-11-23T16:53:00Z" }), "en", NOW)).toBe("2 free, 1 occupied, status from 17:53 (1 h ago) — possibly out of date");
    expect(placeStatusText(status({ stale: true, observedAt: "2026-11-23T17:52:30Z" }), "en", NOW)).toBe("2 free, 1 occupied, status from 18:52 (under 1 min ago) — possibly out of date");
    expect(placeStatusText(status({ stale: true, observedAt: "2026-11-20T08:36:00Z" }), "en", NOW)).toBe("2 free, 1 occupied, status from 2026-11-20 09:36 — possibly out of date");
  });
  it("a place wholly out of order goes last; an ended source says so, with no status and no watch id", async () => {
    const { lines } = await run([site("Kaputt", place({ status: status({ free: 0, occupied: 0, outOfOrder: 3 }) })), site("Gut", place({ siteId: "s-2" }))]);
    expect(lines[1]).toMatch(/^1\. Gut /u);
    expect(lines[2]).toMatch(/^2\. Kaputt .*out of order \(as of 18:48\)$/u);
    const ended = await run([site("Alt", place({ sourceEnded: true }))]);
    expect(ended.lines[1]).toContain("source ended by its publisher, no status");
    expect(ended.text).not.toContain("watch_situation");
  });
  it("the unknown-is-not-free note where a place has points without status", async () => {
    expect((await run([site("A", place({ status: null }))])).text).toContain('"no status data" means unknown, not free.');
    expect((await run([site("A", place())])).text).not.toContain("means unknown");
  });
});

describe("N5: the register's places say so, and its release once", () => {
  it("'per charging point register' per place, the release-date sentence exactly once", async () => {
    const reg = place({ fromRegister: true, registerReleasedOn: "2026-11-01", price: null, status: null });
    const { text, lines } = await run([site("Reg 1", reg), site("Reg 2", { ...reg, siteId: "r2" }), site("Live", place({ fromRegister: false }))]);
    expect(lines[1]).toContain(", no status data, per charging point register");
    expect(lines[3]).not.toContain("per charging point register");
    expect(text.split("Charging point register as of 2026-11-01").length - 1).toBe(1);
    expect((await run([site("Reg", reg)], {}, {}, "de")).text).toContain("laut Ladesäulenregister");
    expect((await run([site("Live", place())])).text).not.toContain("Charging point register");
  });
  it("a place located by its address says so", async () => {
    expect((await run([site("A", place({ reportedLocation: { lat: 50, lon: 8 } }))])).lines[1]).toMatch(/, located by its address$/u);
  });
});

describe("N6: the site ids a charger watch takes, for the numbered places that report a status", () => {
  it("one line, by line number; a place with no status is not offered", async () => {
    const { text } = await run([site("A", place({ siteId: "afir_alpha:cs-1" })), site("B", place({ siteId: "x", status: null })), site("C", place({ siteId: "afir_beta:cs-3" }))]);
    expect(text).toContain('Site id for watch_situation (kind "charger"): 1 = afir_alpha:cs-1; 3 = afir_beta:cs-3');
    expect((await run([site("A", place({ siteId: "s" }))], {}, {}, "de")).text).toContain('Standort-ID für watch_situation (kind "charger"): 1 = s');
    expect((await run([site("B", place({ status: null }))])).text).not.toContain("watch_situation");
  });
  it("structuredContent gives each place its id, address, plugs, price and status", async () => {
    const { r } = await run([site("A", place())]);
    expect((r.structuredContent as { sites: Record<string, unknown>[] }).sites[0]).toMatchObject({ name: "A", siteId: "afir_alpha:cs-01-0001", address: { street: "Herborner Str." }, price: { amount: 0.57 }, status: { free: 2 }, fromRegister: false });
  });
});

describe("only_available: the examined sites left out, by reason", () => {
  it("said under the list, never silent", async () => {
    const { text } = await run([site("A", place())], { dropped: { noStatus: 4, notFree: 2, stale: 1 } }, { only_available: true });
    expect(text).toContain("Of the nearest sites, 2 were hidden as occupied or out of order, 1 for an out-of-date status and 4 for having no status data — the last two may well be free.");
    expect((await run([site("A", place())], { dropped: { noStatus: 0, notFree: 0, stale: 0 } }, { only_available: true })).text).not.toContain("were hidden");
    expect((await run([site("A", place())], { dropped: { noStatus: 1, notFree: 0, stale: 0 } })).text).not.toContain("were hidden");
  });
});

describe("N7: the empty answers", () => {
  it("nothing in the circle: today's sentence; a filter with the API's own count (meta.inRadius): no second read", async () => {
    expect((await run([])).text).toMatch(/^I hold no charging sites within 10 km of 52\.520, 13\.405\./u);
    const counted = await run([], { inRadius: 12 }, { connector: "ccs2" });
    expect(counted.text).toMatch(/^Within 10 km of 52\.520, 13\.405 I know 12 charging sites, but none \(CCS2\)\./u);
    expect(counted.seen).toHaveLength(1);
    expect((await run([], { inRadius: 0 }, { connector: "ccs2" })).text).toMatch(/^I hold no charging sites/u);
  });
});
