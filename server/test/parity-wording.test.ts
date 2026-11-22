/**
 * Lane A's wording parity: each case is today's server's answer to one call, copied from the parity run
 * (fixtures/parity-wording.json, by a script): isError and the text's body, the part before the credit line
 * (creditFooter's, held by its own tests). STATE below is the API state each case is answered from. A line
 * of today's answer that needs a field the API contract does not carry is named in GAP_LINES, with the field;
 * every other line, and the line count, must be today's.
 */
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { HttpResponse } from "msw";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { calls, exampleOf, handlerFor, mockServer } from "./api-mock.js";
import { connect, textOf } from "./harness.js";

type Case = { tool: string; args: Record<string, unknown>; isError: boolean; body: string };
const golden = JSON.parse(readFileSync(new URL("./fixtures/parity-wording.json", import.meta.url), "utf8")) as { cases: Case[] };

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => { mockServer.resetHandlers(); calls.length = 0; vi.useRealTimers(); });
afterAll(() => mockServer.close());

type Meta = Record<string, unknown>;
/** Answers `op` with its contract example, `data` replaced and the meta members given replaced. */
function serve(op: string, data: unknown | ((url: URL) => unknown), meta: Meta | ((url: URL) => Meta) = {}): void {
  mockServer.use(handlerFor(op, (url) => {
    const ex = exampleOf<{ data: unknown; meta: Meta }>(op);
    const d = typeof data === "function" ? (data as (u: URL) => unknown)(url) : data;
    const m = typeof meta === "function" ? meta(url) : meta;
    return HttpResponse.json({ data: d, meta: { ...ex.meta, attribution: [], notes: { purpose: [], condition: [] }, ...m } });
  }));
}

const place = (name: string, kind: string, lat: number, lon: number, districtCode: string | null = null, distanceM?: number) =>
  ({ id: `p-${name}`, name, kind, location: { lat, lon }, districtCode, sourceFamily: "geonames", ...(distanceM === undefined ? {} : { distanceM }) });

/** The MTS-K purpose note the fuel answers open with: API data, read from a copied answer, never typed. */
const MTS_PURPOSE = golden.cases.find((c) => c.tool === "find_cheapest_fuel")?.body.split("\n")[0] ?? "";

/**
 * A place where no station is held and none is priced within 25 km: every fuel read answers nothing, and the
 * live refresher's ask is still pending when the call's wait ends: this call's own, or (joined) one asked before.
 */
function fuelEmpty(at: ReturnType<typeof place> | null, joined: boolean): void {
  if (at !== null) serve("listPlaces", [at]);
  serve("listFuelOptions", [], { query: { at: { lat: 0, lon: 0 }, radiusM: 5000, sort: "price", matched: 0, droppedClosed: 0, droppedUnknown: 0, droppedNotWholeDay: 0, openAt: null }, notes: { purpose: [MTS_PURPOSE], condition: [] } });
  const pending = { id: "1", source: "fuel-prices-de", state: "pending", createdAt: "2026-11-22T16:40:00Z", settledAt: null, reason: null, reused: joined, queue: { position: 1 } };
  serve("createRefresh", pending);
  serve("getRefresh", pending);
}

/**
 * find_fuel_station's reads: the filtered search finds nothing (its meta saying how many stations an unknown
 * opening state left out and the instant open_at named), the circle holds `held` stations, none priced in 25 km.
 */
function fuelStations(at: ReturnType<typeof place>, o: { openAt?: string; held?: number; droppedUnknown?: number } = {}): void {
  serve("listPlaces", [at]);
  serve("listFuelOptions", [], (u: URL) => ({
    query: { at: at.location, radiusM: Number(u.searchParams.get("radius_m")), sort: u.searchParams.get("sort"), matched: u.searchParams.get("limit") === "1" ? (o.held ?? 0) : 0, droppedClosed: 0, droppedUnknown: u.searchParams.get("limit") === null ? (o.droppedUnknown ?? 0) : 0, droppedNotWholeDay: 0, openAt: o.openAt ?? null },
    notes: { purpose: [MTS_PURPOSE], condition: [] },
  }));
}

const FUEL_OF: Readonly<Record<string, string>> = { diesel: "diesel", "Super E10": "e10", "Super E5": "e5" };

/**
 * The API rows behind a copied fuel list, read back from its English lines ("1. ARAL, Levetzowstraße 9,
 * NNNNN Berlin — diesel 2.459 €/l, Super E10 …, 1.5 km, open when last seen"), so no address is typed
 * here: brand, street, town, every price (a bare one is `fuel`'s), the distance and the opening state.
 */
function fuelListed(at: ReturnType<typeof place>, key: string, fuel: string): void {
  serve("listPlaces", [at]);
  const now = new Date().toISOString();
  const lines = golden.cases.find((c) => keyOf(c) === key && c.args["language"] === "en")!.body.split("\n").filter((l) => /^\d+\. /u.test(l));
  const rows = lines.map((l, i) => {
    const m = /^\d+\. ([^,]+), (.+), (\S+) (.+?) — (.*), ([\d.]+) km, (.*)$/u.exec(l)!;
    const prices = [...m[5]!.matchAll(/(?:(diesel|Super E10|Super E5) )?([\d.]+) €\/l/gu)].map((p) => ({ fuel: p[1] === undefined ? fuel : FUEL_OF[p[1]], priceEur: Number(p[2]), reportedAt: now, current: true }));
    const station = { id: `f${i}`, name: null, brand: m[1], location: at.location, distanceM: Number(m[6]) * 1000, openingState: m[7]!.startsWith("open when") ? "open" : "unknown", sourceFamily: "tankerkoenig", prices };
    return { station, address: { street: m[2], number: null, postcode: m[3], place: m[4] } };
  });
  serve("listFuelOptions", rows.map((r) => r.station), { query: { at: at.location, radiusM: 10_000, sort: "distance", matched: rows.length, droppedClosed: 0, droppedUnknown: 0, droppedNotWholeDay: 0, openAt: null }, notes: { purpose: [MTS_PURPOSE], condition: [] } });
  serve("getFuelStation", (u: URL) => {
    const r = rows[Number(u.pathname.split("/").at(-1)!.slice(1))]!;
    return { ...r.station, address: r.address, aroundTheClock: false };
  });
}

/** A station `km` away (written in km, as the answer says it). */
const station = (name: string, km: number) => ({ id: `s-${name}`, name, location: { lat: 0, lon: 0 }, stopCode: null, eva: null, evaNumbers: [], distanceM: km * 1000 });

/**
 * listNearby with the given rows (every other asked category empty); no fuel station held or priced in 25 km,
 * so the empty fuel line carries the area sentence. A fuel row brings the MTS-K purpose note, as the API does.
 */
function nearby(at: ReturnType<typeof place> | null, d: Record<string, unknown[]>): void {
  if (at !== null) serve("listPlaces", [at]);
  serve("listNearby", { fuel: [], charging: [], parking: [], stations: [], junctions: [], ...d }, { parts: [], notes: { purpose: (d["fuel"]?.length ?? 0) > 0 ? [MTS_PURPOSE] : [], condition: [] } });
  serve("listFuelOptions", [], { query: { at: { lat: 0, lon: 0 }, radiusM: 5000, sort: "distance", matched: 0, droppedClosed: 0, droppedUnknown: 0, droppedNotWholeDay: 0, openAt: null } });
}

/** Berlin wall time hh:mm on the parity run's day (2026-11-22, CET) as an instant. */
const PARITY_DAY = "2026-11-22";
const cet = (hhmm: string, plusMin = 0): string => new Date(new Date(`${PARITY_DAY}T${hhmm}:00+01:00`).getTime() + plusMin * 60_000).toISOString();

/**
 * get_train_departures: the API rows behind a copied answer, read back from its own lines ("18:28 ICE 606 →
 * Hamburg-Altona, Gleis 11, +13 min (ca. 18:41)"), so no train is typed here. The clock is set to the run's
 * minute: a capped board's "bis 19:17" less the window, else one minute before the first train. A capped board
 * gets as many trains after the last one shown as it says are left; an empty one names its number.
 */
function trainState(c: Case): void {
  const lines = c.body.split("\n");
  const station = /^(?:Abfahrten ab|Departures from) (.+) \(/u.exec(lines[0]!)?.[1] ?? /(?:Abgefragt habe ich den Bahnhof|Station asked:) (.+) \((?:Bahnhofsnummer|station number) (\d+)\)\.$/u.exec(lines.at(-1)!)?.[1];
  if (station === undefined) {
    serve("listStations", []); // a name the station search does not find, or no station at all (nothing is asked)
    return;
  }
  const eva = /(?:Bahnhofsnummer|station number) (\d+)\)\.$/u.exec(lines.at(-1)!)?.[1] ?? "8000001";
  const window = Number(c.args["duration_min"] ?? 60);
  const row = /^(\d\d:\d\d) (.+?) → (.+), (?:Gleis|platform) (\S+)(?: \((?:statt|instead of) (\S+)\))?, (.+)$/u;
  const deps = lines.flatMap((l) => {
    const m = row.exec(l);
    if (m === null) return [];
    const [, at, line, destination, platform, was, state] = m as unknown as [string, string, string, string, string, string | undefined, string];
    const delay = /^\+(\d+) min/u.exec(state);
    const delayMin = delay === null ? 0 : Number(delay[1]);
    return [{ line, category: line.split(" ")[0]!.replace(/\d+$/u, ""), number: null, destination, plannedAt: cet(at), expectedAt: cet(at, delayMin), delayMin, platform, plannedPlatform: was ?? platform, platformChanged: was !== undefined, cancelled: false }];
  });
  const capped = /(?:mindestens|at least) (\d+) (?:weitere bis|more until) (\d\d:\d\d)/u.exec(lines.at(-1)!);
  const now = capped !== null ? cet(capped[2]!, -window) : deps.length > 0 ? cet(berlinOf(deps[0]!.plannedAt), -1) : cet("18:10");
  const extra = Array.from({ length: Number(capped?.[1] ?? 0) }, (_, i) => ({ ...deps.at(-1)!, line: `RB ${90 + i}`, plannedAt: cet(capped![2]!, -1), expectedAt: cet(capped![2]!, -1) }));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(now));
  const categories = c.args["categories"] as string[] | undefined;
  // The asked type filter applies to the copied rows too: a type-filtered empty board holds a train of another type.
  const other = categories === undefined ? [] : [{ line: "RE 1", category: "RE", number: null, destination: "Kiel", plannedAt: now, expectedAt: now, delayMin: 0, platform: "1", plannedPlatform: "1", platformChanged: false, cancelled: false }];
  serve("listStations", [{ id: `s-${station}`, name: station, location: { lat: 0, lon: 0 }, stopCode: null, eva, evaNumbers: [eva] }]);
  serve("createRefresh", { id: "1", source: "train-board-de", state: "refreshed", createdAt: now, settledAt: now, reason: null, reused: false, queue: null });
  serve("getTrainBoard", { eva, fresh: true, fetchedAt: now, ageSeconds: 0, departures: [...deps, ...extra, ...other] });
}
const berlinOf = (iso: string): string => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

const COVERAGE = { kinds: [{ kind: "municipality", count: 1 }], lands: [], addresses: [] };

/** The API state per case, by tool and the call's main argument. */
const STATE: Record<string, (args: Record<string, unknown>) => void> = {
  "find_place Fulda": () => { serve("listPlaces", []); serve("getPlacesCoverage", COVERAGE); },
  "find_place Bad Homburg vor der Höhe": () => { serve("listPlaces", []); serve("getPlacesCoverage", COVERAGE); },
  "find_place A9": () => { serve("listPlaces", []); serve("getPlacesCoverage", COVERAGE); },
  "find_place Bergheim": () => { serve("listPlaces", []); serve("getPlacesCoverage", COVERAGE); },
  "find_place Bad Schandau": () => { serve("listPlaces", []); serve("getPlacesCoverage", COVERAGE); },
  "find_place Eisenach": () => { serve("listPlaces", []); serve("getPlacesCoverage", COVERAGE); },
  "find_place Halle": () => { serve("listPlaces", []); serve("getPlacesCoverage", COVERAGE); },
  "find_place Quedlinburg": () => { serve("listPlaces", []); serve("getPlacesCoverage", COVERAGE); },
  // near resolves Ingolstadt first; the search then finds no Neuburg.
  "find_place Neuburg": () => {
    serve("listPlaces", (u: URL) => (u.searchParams.get("q") === "Ingolstadt" ? [place("Ingolstadt", "municipality", 48.7665, 11.4258, "09161000")] : []));
    serve("getPlacesCoverage", COVERAGE);
  },
  "find_place Essen": () => serve("listPlaces", [place("Essen", "municipality", 51.4556, 7.0116, "05113000"), place("Essen Hbf", "station_area", 51.45135, 6.95882, "05113000")]),
  "find_place Hannover": () => serve("listPlaces", [place("Hannover", "municipality", 52.3759, 9.732)]),
  "find_place Neustadt": () => serve("listPlaces", (u: URL) => (u.searchParams.get("q") === "Hamburg"
    ? [place("Hamburg", "municipality", 53.5511, 9.9937, "02000000")]
    : [place("Neustadt (Hessen)", "municipality", 50.85, 9.1167, "06534019", 306_000), place("Neustadt b.Coburg", "municipality", 50.3297, 11.1167, "09473152", 366_000), place("Neustadt an der Weinstraße", "municipality", 49.3501, 8.1361, "07316000", 484_000)])),
  "find_cheapest_fuel Leipzig": (a) => fuelEmpty(place("Leipzig", "municipality", 51.3397, 12.3731, "14713000"), a["fuel"] !== "e5" || a["language"] !== "de"),
  "find_cheapest_fuel Dresden": (a) => fuelEmpty(place("Dresden", "municipality", 51.0509, 13.7383, "14612000"), a["language"] !== "de"),
  "find_cheapest_fuel 48.137,11.576": (a) => fuelEmpty(null, a["language"] !== "de"),
  "find_fuel_station Hamburg Hbf": () => fuelStations(place("Hamburg Hbf", "station_area", 53.5528, 10.0067, "02000000")),
  "find_fuel_station Leipzig": () => fuelStations(place("Leipzig", "municipality", 51.3397, 12.3731, "14713000")),
  "find_fuel_station Bad Hersfeld": () => fuelStations(place("Bad Hersfeld", "municipality", 50.8683, 9.7068, "06632002")),
  "find_fuel_station Regensburg": () => fuelStations(place("Regensburg", "municipality", 49.0134, 12.1016, "09362000"), { openAt: "2026-11-23T01:00:00Z" }),
  "find_fuel_station Magdeburg": () => fuelStations(place("Magdeburg", "municipality", 52.1205, 11.6276, "15003000")),
  "find_fuel_station Passau": () => fuelStations(place("Passau", "municipality", 48.5665, 13.4312, "09262000"), { openAt: "2026-11-23T05:00:00Z" }),
  "find_fuel_station Trier": () => fuelStations(place("Trier", "municipality", 49.7499, 6.6371, "07211000")),
  "find_fuel_station Kassel": () => fuelStations(place("Kassel", "municipality", 51.3127, 9.4797, "06611000"), { openAt: "2026-11-22T22:30:00Z", held: 12, droppedUnknown: 5 }),
  "find_fuel_station Ingolstadt": () => fuelListed(place("Ingolstadt", "municipality", 48.7665, 11.4258, "09161000"), "find_fuel_station Ingolstadt", "e10"),
  "find_nearby Leipzig": () => nearby(place("Leipzig", "municipality", 51.3397, 12.3731, "14713000"), { stations: [station("Leipzig Hbf", 0.9)] }),
  "find_nearby Kassel": () => nearby(place("Kassel", "municipality", 51.3127, 9.4797, "06611000"), {
    fuel: [["TotalEnergies", 1.9], ["Shell", 2.0], ["ARAL", 3.2]].map(([brand, k]) => ({ name: null, brand, distanceM: Number(k) * 1000, prices: [{ fuel: "e5", priceEur: 2.369, reportedAt: new Date().toISOString(), current: true }] })),
    stations: [station("Kassel-Wilhelmshöhe", 2.3)],
  }),
  "find_nearby 53.5511,9.9937": () => nearby(null, {
    charging: [{ id: "c1", name: null, operator: "HEnW-Mobil", location: { lat: 53.58, lon: 9.97 }, distanceM: 3.6 * 1000, access: "public", summary: { chargePoints: 2, availableNow: null, maxPowerKw: 22 } }],
    stations: [station("Hamburg Hbf", 0.9)],
  }),
  "find_nearby 52.52,13.405": () => nearby(null, { stations: [station("Berlin Hbf", 2.5)] }),
  "find_cheapest_fuel Kassel": () => fuelListed(place("Kassel", "municipality", 51.3127, 9.4797, "06611000"), "find_cheapest_fuel Kassel", "diesel"),
  // A street and house number where the API holds no address data (the coverage lists none).
  "find_cheapest_fuel Marienplatz 8, München": () => serve("getPlacesCoverage", COVERAGE),
  "get_departures Bahnhofstraße 12, Fulda": () => serve("getPlacesCoverage", COVERAGE),
};

/**
 * get_departures for a stop the search does not find: the place search knows the town the copied answer names
 * ("In München finde ich keine Haltestelle …") as a municipality, and nothing else.
 */
function unknownStop(c: Case): void {
  const town = /^(?:In (.+?) finde ich keine Haltestelle|I do not know a stop called ".+" in (.+?)\. )/u.exec(c.body);
  const name = town?.[1] ?? town?.[2];
  serve("listStations", []);
  serve("listPlaces", (u: URL) => (name !== undefined && u.searchParams.get("q") === name ? [place(name, "municipality", 50, 10, "09162000")] : []));
}

/** Lines of today's answer (0 = the first) that need a field the contract lacks: api-gap.md, lane A. */
const GAP_LINES: Record<string, { lines: number[]; absent?: number[]; needs: string; prefix?: true }> = {
  "find_fuel_station Ingolstadt": { lines: [2, 3], needs: "when a station's opening hours were last fetched", prefix: true },
  "find_nearby 53.5511,9.9937": { lines: [2], absent: [3], needs: "a charging site's street address on listNearby, and the charging register's Stand date" },
  "find_place Essen": { lines: [1], needs: "a place's population" },
  "find_place Hannover": { lines: [1], needs: "a place's population" },
  "find_place Neustadt": { lines: [1, 2, 3], needs: "a place's population and its Kreis by name" },
};

/** The same gaps, by the lines' own shape, for every case of a tool. */
const GAP_BY_TOOL: Record<string, { gap?: RegExp; absent?: RegExp; tail?: string; needs: string }> = {
  // DB's own explanation of a state rides after the state; the line up to it is today's, word for word.
  check_station_facilities: { gap: / — (Meldung der Bahn|DB's report)/u, tail: " — ", needs: "DB's explanation of a facility's state (stateExplanation)" },
  // A site's line names its street address and plugs; the price and the register's release date are not held.
  find_charging_station: { gap: /^\d+\. /u, absent: /^(Preis pro kWh|Price per kWh|Stand des Ladesäulenregisters|Charging point register as of)/u, needs: "a charging site's address and plugs, its price per kWh, the register's release date" },
};

/**
 * find_charging_station: as many sites as the copied list numbers, none reporting a status; with "kenne ich N
 * Ladestandorte, aber keinen", the filtered read finds none and the unfiltered one N.
 */
function chargingState(c: Case): void {
  const name = String(c.args["place"]);
  serve("listPlaces", [place(name, "municipality", 50, 10, "09162000")]);
  const site = (i: number) => ({ id: `cs-${i}`, name: `Laden ${i}`, operator: null, location: { lat: 50, lon: 10 }, distanceM: 1000, access: "public", sourceFamily: "register",
    summary: { chargePoints: 1, availableNow: null, maxPowerKw: 22 }, chargePoints: [{ id: `p-${i}`, current: "ac", maxPowerKw: 22, availability: null }] });
  const listed = c.body.split("\n").filter((l) => /^\d+\. /u.test(l)).length;
  const held = Number(/(?:kenne ich|I know) (\d+) (?:Ladestandorte|charging sites), (?:aber keinen|but none)/u.exec(c.body)?.[1] ?? 0);
  serve("listChargingOptions", (u: URL) => {
    const unfiltered = !["connector", "min_kw", "max_kw", "operator", "conditions", "only_available"].some((k) => u.searchParams.has(k));
    return Array.from({ length: held > 0 ? (unfiltered ? held : 0) : listed }, (_, i) => site(i));
  }, { page: { limit: 100, hasMore: false } });
}

/** check_station_facilities: the station as today names it, and each copied unit line read back into a unit. */
function facilitiesState(c: Case): void {
  const name = /^(?:In den Aufzugs- und Fahrtreppendaten der Bahn ist für (.+?) (?:weder|kein|keine) |In (.+?) (?:ist|sind|kann) |DB's lift and escalator data lists .+? for (.+?)(?:\.|, only) |\d+ of \d+ reported facilities .*? at (.+?) (?:is|are) )/u.exec(c.body);
  const station = name?.slice(1).find((x) => x !== undefined) ?? String(c.args["station"]);
  serve("listStations", [{ id: "st-1", name: station, location: { lat: 50, lon: 10 }, stopCode: null, eva: "8000001", evaNumbers: ["8000001"] }]);
  const kinds: Record<string, string> = { Aufzug: "elevator", Lift: "elevator", Fahrtreppe: "escalator", Escalator: "escalator", Anlage: "other", Facility: "other" };
  const states: Record<string, string> = { "in Betrieb": "active", "in service": "active", "außer Betrieb": "inactive", "out of service": "inactive", "Status unbekannt": "unknown", "status unknown": "unknown" };
  const units = c.body.split("\n").slice(1).flatMap((l, i) => {
    const m = /^(Aufzug|Fahrtreppe|Anlage|Lift|Escalator|Facility)(?: (.+?))?: (in Betrieb|außer Betrieb|Status unbekannt|in service|out of service|status unknown)(?: — |$)/u.exec(l);
    return m === null ? [] : [{ id: `f-${i}`, kind: kinds[m[1]!]!, position: m[2] ?? null, state: states[m[3]!]!, sourceFamily: "fasta" }];
  });
  const n = (st: string): number => units.filter((u) => u.state === st).length;
  serve("listStationFacilities", { station: { name: station }, facilities: units, counts: { active: n("active"), inactive: n("inactive"), unknown: n("unknown") } });
}

/**
 * find_hydrogen_station: each copied station line read back into the API's station (name, distance, address,
 * pumps, operator, opening periods, record date), and the clock set to the run's day so the record's age is
 * today's.
 */
function hydrogenState(c: Case): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-22T17:00:00Z"));
  if (c.args["place"] !== undefined) serve("listPlaces", [place(String(c.args["place"]), "municipality", 50, 10, "09162000")]);
  const pumps: Record<string, string> = {
    "700 bar Pkw": "gaseousHydrogen700barCar", "350 bar Pkw": "gaseousHydrogen350barCar", "350 bar Lkw/Bus": "gaseousHydrogen350barTruck",
    "700 bar car": "gaseousHydrogen700barCar", "350 bar car": "gaseousHydrogen350barCar", "350 bar truck/bus": "gaseousHydrogen350barTruck",
  };
  const days: Record<string, string> = { Mo: "monday", Di: "tuesday", Mi: "wednesday", Do: "thursday", Fr: "friday", Sa: "saturday", So: "sunday", Feiertage: "publicholidays",
    Mon: "monday", Tue: "tuesday", Wed: "wednesday", Thu: "thursday", Fri: "friday", Sat: "saturday", Sun: "sunday", "public holidays": "publicholidays" };
  const order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const opening = (text: string): { day: string; from: string; to: string }[] | null => {
    if (/nicht veröffentlicht|not published/u.test(text)) return null;
    const out: { day: string; from: string; to: string }[] = [];
    let last: string[] = [];
    for (const seg of text.replace(/^(Öffnungszeiten|opening hours): /u, "").split(", ")) {
      const m = /^(?:(.+) )?(\d\d:\d\d)–(\d\d:\d\d)$/u.exec(seg);
      if (m === null) throw new Error(`opening hours not read: ${seg}`);
      if (m[1] !== undefined) {
        const [a, b] = m[1].split("–").map((w) => days[w]!);
        last = b === undefined ? [a!] : order.slice(order.indexOf(a!), order.indexOf(b) + 1);
      }
      for (const day of last) out.push({ day, from: m[2]!, to: m[3]! });
    }
    return out;
  };
  const station = (line: string) => {
    const [name, rest] = line.split(" — ");
    const parts = rest!.split(" · ");
    const km = parts.shift()!;
    const updated = parts.pop()!;
    const hours = parts.pop()!;
    const operator = /^(Betreiber|operator): /u.test(parts[parts.length - 1] ?? "") ? parts.pop()!.replace(/^(Betreiber|operator): /u, "") : null;
    const refill = parts.pop()!.split(", ").flatMap((p) => { const m = /^(?:(\d+)× )?(.+)$/u.exec(p)!; return Array.from({ length: Number(m[1] ?? 1) }, () => ({ solution: pumps[m[2]!] ?? m[2]! })); });
    const addr = parts.pop();
    const cut = addr?.lastIndexOf(", ") ?? -1;
    const [street, town] = addr === undefined ? [null, null] : cut >= 0 ? [addr.slice(0, cut), addr.slice(cut + 2)] : /^NNNNN /u.test(addr) ? [null, addr] : [addr, null];
    const date = /(\d\d)\.(\d\d)\.(\d{4})|(\d{4})-(\d\d)-(\d\d)/u.exec(updated);
    const m = /^([\d.,]+) (km|m)$/u.exec(km)!;
    return {
      name: /^(Wasserstofftankstelle|Hydrogen station)$/u.test(name!) ? null : name!, operator, brand: null, location: { lat: 50, lon: 10 },
      distanceM: m[2] === "m" ? Number(m[1]) : Math.round(Number(m[1]!.replace(",", ".")) * 1000),
      address: street === null && town === null ? null : { street, house_number: null, postcode: town?.split(" ")[0] ?? null, city: town?.split(" ").slice(1).join(" ") ?? null },
      refill, opening: opening(hours), sourceFamily: "h2",
      providerUpdatedAt: date === null ? null : `${date[3] ?? date[4]!}-${date[2] ?? date[5]!}-${date[1] ?? date[6]!}T10:00:00Z`,
    };
  };
  const lines = c.body.split("\n");
  const listed = lines.filter((l) => /^\d+\. /u.test(l)).map((l) => station(l.replace(/^\d+\. /u, "")));
  const beyond = lines.find((l) => /^(Die nächste liegt außerhalb des Umkreises|The nearest one is outside the radius): /u.test(l));
  serve("listHydrogenOptions", { stations: listed, nearest: beyond === undefined ? null : station(beyond.replace(/^[^:]+: /u, "")) });
}

const keyOf = (c: Case): string => `${c.tool} ${String(c.args["query"] ?? c.args["place"] ?? c.args["station"] ?? c.args["stop"] ?? c.args["topic"] ?? (c.args["lat"] === undefined ? "" : `${String(c.args["lat"])},${String(c.args["lon"])}`))}`;
const bodyOf = (r: CallToolResult): string => {
  const t = textOf(r).replace(/(Stand|As of|as of) \d{2}:\d{2}/gu, "$1 HH:MM").replace(/\b\d{5}\b/gu, "NNNNN").replace(/(?<![\d.:-])\d{4}(?![\d.:-])/gu, "NNNN");
  if (r.isError === true) return t;
  const i = t.lastIndexOf("\n\n");
  return i < 0 ? t : t.slice(0, i);
};

describe("today's wording, from the parity run (lane A)", () => {
  for (const c of golden.cases) {
    const key = keyOf(c);
    it(`${c.tool} ${JSON.stringify(c.args)}`, async () => {
      const state = c.tool === "get_train_departures" ? () => trainState(c) : c.tool === "get_departures" && c.args["stop"] !== undefined ? () => unknownStop(c)
        : c.tool === "find_charging_station" ? () => chargingState(c) : c.tool === "find_hydrogen_station" ? () => hydrogenState(c)
        : c.tool === "check_station_facilities" ? () => facilitiesState(c) : STATE[key];
      if (state === undefined) throw new Error(`no API state for ${key}`);
      state(c.args);
      const { client, close } = await connect({ refreshWait: { totalMs: 20, pollMs: 5 } });
      try {
        const r = (await client.callTool({ name: c.tool, arguments: c.args })) as CallToolResult;
        expect(r.isError === true).toBe(c.isError);
        // A line today's answer has and the contract cannot give (absent) is left out of the comparison.
        const rule = GAP_BY_TOOL[c.tool];
        const byRule = (re: RegExp | undefined): number[] => (re === undefined ? [] : c.body.split("\n").flatMap((l, i) => (re.test(l) ? [i] : [])));
        const absent = new Set([...(GAP_LINES[key]?.absent ?? []), ...byRule(rule?.absent)]);
        const lines = c.body.split("\n").map((l, i) => ({ l, i })).filter((x) => !absent.has(x.i));
        const want = lines.map((x) => x.l);
        const got = bodyOf(r).split("\n");
        const gapAt = new Set([...(GAP_LINES[key]?.lines ?? []), ...byRule(rule?.gap)]);
        const gap = new Set(lines.flatMap((x, k) => (gapAt.has(x.i) ? [k] : [])));
        expect(got.length).toBe(want.length);
        expect(got.filter((_, i) => !gap.has(i))).toEqual(want.filter((_, i) => !gap.has(i)));
        // A gap that only drops a tail (prefix): the line says everything up to it, word for word.
        if (GAP_LINES[key]?.prefix === true) for (const i of gap) expect(want[i]!.startsWith(`${got[i]!} (`)).toBe(true);
        if (rule?.tail !== undefined) for (const i of gap) expect(want[i]!.startsWith(`${got[i]!}${rule.tail}`)).toBe(true);
      } finally {
        await close();
      }
    });
  }
});
