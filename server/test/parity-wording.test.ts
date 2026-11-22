/**
 * Lane A's wording parity: each case is today's server's answer to one call, copied from the parity run
 * (fixtures/parity-wording.json, by a script): isError and the text's body, the part before the credit line
 * (creditFooter's, held by its own tests). STATE below is the API state each case is answered from. A line
 * of today's answer that needs a field the API contract does not carry is named in GAP_LINES, with the field;
 * every other line, and the line count, must be today's.
 */
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HttpResponse } from "msw";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { calls, exampleOf, handlerFor, mockServer } from "./api-mock.js";
import { connect, textOf } from "./harness.js";

type Case = { tool: string; args: Record<string, unknown>; isError: boolean; body: string };
const golden = JSON.parse(readFileSync(new URL("./fixtures/parity-wording.json", import.meta.url), "utf8")) as { cases: Case[] };

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => { mockServer.resetHandlers(); calls.length = 0; });
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
};

/** Lines of today's answer (0 = the first) that need a field the contract lacks: api-gap.md, lane A. */
const GAP_LINES: Record<string, { lines: number[]; absent?: number[]; needs: string; prefix?: true }> = {
  "find_fuel_station Ingolstadt": { lines: [2, 3], needs: "when a station's opening hours were last fetched", prefix: true },
  "find_nearby 53.5511,9.9937": { lines: [2], absent: [3], needs: "a charging site's street address on listNearby, and the charging register's Stand date" },
  "find_place Essen": { lines: [1], needs: "a place's population" },
  "find_place Hannover": { lines: [1], needs: "a place's population" },
  "find_place Neustadt": { lines: [1, 2, 3], needs: "a place's population and its Kreis by name" },
};

const keyOf = (c: Case): string => `${c.tool} ${String(c.args["query"] ?? c.args["place"] ?? c.args["station"] ?? c.args["stop"] ?? c.args["topic"] ?? (c.args["lat"] === undefined ? "" : `${String(c.args["lat"])},${String(c.args["lon"])}`))}`;
const bodyOf = (r: CallToolResult): string => {
  const t = textOf(r).replace(/(Stand|As of|as of) \d{2}:\d{2}/gu, "$1 HH:MM").replace(/\b\d{5}\b/gu, "NNNNN");
  if (r.isError === true) return t;
  const i = t.lastIndexOf("\n\n");
  return i < 0 ? t : t.slice(0, i);
};

describe("today's wording, from the parity run (lane A)", () => {
  for (const c of golden.cases) {
    const key = keyOf(c);
    it(`${c.tool} ${JSON.stringify(c.args)}`, async () => {
      const state = STATE[key];
      if (state === undefined) throw new Error(`no API state for ${key}`);
      state(c.args);
      const { client, close } = await connect({ refreshWait: { totalMs: 20, pollMs: 5 } });
      try {
        const r = (await client.callTool({ name: c.tool, arguments: c.args })) as CallToolResult;
        expect(r.isError === true).toBe(c.isError);
        // A line today's answer has and the contract cannot give (absent) is left out of the comparison.
        const absent = new Set(GAP_LINES[key]?.absent ?? []);
        const lines = c.body.split("\n").map((l, i) => ({ l, i })).filter((x) => !absent.has(x.i));
        const want = lines.map((x) => x.l);
        const got = bodyOf(r).split("\n");
        const gapAt = new Set(GAP_LINES[key]?.lines ?? []);
        const gap = new Set(lines.flatMap((x, k) => (gapAt.has(x.i) ? [k] : [])));
        expect(got.length).toBe(want.length);
        expect(got.filter((_, i) => !gap.has(i))).toEqual(want.filter((_, i) => !gap.has(i)));
        // A gap that only drops a tail (prefix): the line says everything up to it, word for word.
        if (GAP_LINES[key]?.prefix === true) for (const i of gap) expect(want[i]!.startsWith(`${got[i]!} (`)).toBe(true);
      } finally {
        await close();
      }
    });
  }
});
