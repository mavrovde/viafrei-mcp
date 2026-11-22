/**
 * Each case is today's server's answer to one call, copied from the parity run (fixtures/parity-golden.json),
 * and the API state that run had for it (STATE below). The answer here must be the same: text with the Stand
 * time masked, structuredContent without asOf, and _meta attribution and license.
 */
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HttpResponse } from "msw";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { calls, exampleOf, handlerFor, mockServer } from "./api-mock.js";
import { connect, textOf } from "./harness.js";

/**
 * `pending` names what the API does not carry yet (api-gap): "structuredContent" leaves the payload out of
 * the comparison, "credit" the credit lines (the answer's tail from its source line on) and _meta. Every
 * other byte of the text is compared.
 */
type Pending = "structuredContent" | "credit";
type Case = { tool: string; args: Record<string, unknown>; isError: boolean; text: string; structuredContent: Record<string, unknown> | null; meta: Record<string, unknown>; pending?: Pending[] };
const golden = JSON.parse(readFileSync(new URL("./fixtures/parity-golden.json", import.meta.url), "utf8")) as { cases: Case[] };

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => { mockServer.resetHandlers(); calls.length = 0; });
afterAll(() => mockServer.close());

/** Answers `op` with its contract example, `data` replaced and the attribution cleared where given. */
function serve(op: string, data: unknown, meta: Record<string, unknown> = {}): void {
  mockServer.use(handlerFor(op, () => {
    const ex = exampleOf<{ data: unknown; meta: Record<string, unknown> }>(op);
    return HttpResponse.json({ data, meta: { ...ex.meta, ...meta } });
  }));
}

const LANDS: readonly (readonly [string, string])[] = [
  ["01", "Schleswig-Holstein"], ["02", "Hamburg"], ["03", "Niedersachsen"], ["04", "Bremen"], ["05", "Nordrhein-Westfalen"], ["06", "Hessen"],
  ["07", "Rheinland-Pfalz"], ["08", "Baden-Württemberg"], ["09", "Bayern"], ["10", "Saarland"], ["11", "Berlin"], ["12", "Brandenburg"],
  ["13", "Mecklenburg-Vorpommern"], ["14", "Sachsen"], ["15", "Sachsen-Anhalt"], ["16", "Thüringen"],
];

/** The API state of the parity run, per tool: what its reads answered. */
const STATE: Record<string, () => void> = {
  // The harness loads no OpenStreetMap addresses: the search finds none and the coverage lists no Land.
  find_address: () => {
    serve("listAddresses", { addresses: [] }, { attribution: [] });
    serve("getPlacesCoverage", { kinds: [], lands: [], addresses: [] });
  },
  // The harness's gazetteer holds the 16 Länder and, of the Kreise asked here, Frankfurt am Main; its
  // realtime window is empty and its alert feeds are not current. A Kreis keeps the example's key: no answer here prints it.
  check_transit_disruption: () => {
    serve("getPlacesCoverage", { kinds: [], lands: LANDS.map(([code, name]) => ({ code, name, sourceFamily: "destatis_gv" })), addresses: [] });
    mockServer.use(handlerFor("listPlaces", (url) => {
      const ex = exampleOf<{ data: Record<string, unknown>[]; meta: Record<string, unknown> }>("listPlaces");
      const hit = url.searchParams.get("q") === "Frankfurt am Main" ? [{ ...ex.data[0], name: "Frankfurt am Main", kind: "district" }] : [];
      return HttpResponse.json({ ...ex, data: hit, meta: { ...ex.meta, attribution: [] } });
    }));
    mockServer.use(handlerFor("listTransitDisruptions", (url) => {
      const ex = exampleOf<{ data: unknown; meta: Record<string, unknown> }>("listTransitDisruptions");
      const windowMin = Number(url.searchParams.get("window_min") ?? 60);
      return HttpResponse.json({ ...ex, data: { alerts: [], alertsTotal: 0, alertsChecked: false, duplicatesOmitted: 0, punctuality: null, windowMin }, meta: { ...ex.meta, attribution: [] } });
    }));
  },
};

/** The text without its credit tail: from the blank line before "Quelle:", "Source:" or the bare Stand on. */
const withoutCredit = (t: string): string => t.replace(/\n\n(Quellen?:|Sources?:|Stand |As of )[\s\S]*$/u, "");

const masked = (r: CallToolResult) => {
  const sc = r.structuredContent === undefined ? null : Object.fromEntries(Object.entries(r.structuredContent).filter(([k]) => k !== "asOf"));
  const m = (r._meta ?? {}) as Record<string, unknown>;
  return { isError: r.isError === true, text: textOf(r).replace(/(Stand|As of) \d{2}:\d{2}/gu, "$1 HH:MM"), structuredContent: sc, meta: { attribution: m["attribution"], license: m["license"] } };
};

describe("today's answer, from the parity run", () => {
  for (const c of golden.cases) {
    it(`${c.tool} ${JSON.stringify(c.args)}`, async () => {
      const state = STATE[c.tool];
      if (state === undefined) throw new Error(`no API state for ${c.tool}`);
      state();
      const { client, close } = await connect({});
      try {
        const r = (await client.callTool({ name: c.tool, arguments: c.args })) as CallToolResult;
        const got = masked(r);
        const pending = new Set(c.pending ?? []);
        const want = { isError: c.isError, text: c.text, structuredContent: c.structuredContent, meta: c.meta };
        if (pending.has("structuredContent")) { got.structuredContent = null; want.structuredContent = null; }
        if (pending.has("credit")) { got.text = withoutCredit(got.text); want.text = withoutCredit(want.text); got.meta = { attribution: undefined, license: undefined }; want.meta = { ...got.meta }; }
        expect(got).toEqual(want);
      } finally {
        await close();
      }
    });
  }
});
