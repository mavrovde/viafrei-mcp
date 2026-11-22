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

const COVERAGE = { kinds: [{ kind: "municipality", count: 1 }], lands: [], addresses: [] };

/** The API state per case, by tool and the call's main argument. */
const STATE: Record<string, () => void> = {
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
};

/** Lines of today's answer (0 = the first) that need a field the contract lacks: api-gap.md, lane A. */
const GAP_LINES: Record<string, { lines: number[]; needs: string }> = {
  "find_place Essen": { lines: [1], needs: "a place's population" },
  "find_place Hannover": { lines: [1], needs: "a place's population" },
  "find_place Neustadt": { lines: [1, 2, 3], needs: "a place's population and its Kreis by name" },
};

const keyOf = (c: Case): string => `${c.tool} ${String(c.args["query"] ?? c.args["place"] ?? c.args["station"] ?? c.args["stop"] ?? c.args["topic"] ?? "")}`;
const bodyOf = (r: CallToolResult): string => {
  const t = textOf(r).replace(/(Stand|As of) \d{2}:\d{2}/gu, "$1 HH:MM");
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
      state();
      const { client, close } = await connect({});
      try {
        const r = (await client.callTool({ name: c.tool, arguments: c.args })) as CallToolResult;
        expect(r.isError === true).toBe(c.isError);
        const want = c.body.split("\n");
        const got = bodyOf(r).split("\n");
        const gap = new Set(GAP_LINES[key]?.lines ?? []);
        expect(got.length).toBe(want.length);
        expect(got.filter((_, i) => !gap.has(i))).toEqual(want.filter((_, i) => !gap.has(i)));
      } finally {
        await close();
      }
    });
  }
});
