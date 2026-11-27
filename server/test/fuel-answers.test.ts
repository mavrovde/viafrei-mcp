/**
 * find_cheapest_fuel and find_fuel_station on prices that are not current (#299): cheapest first is true with
 * current and stale rows mixed, the head says when no price is current and drops the "not in the ranking" line,
 * and a stale price is marked, in German and English. Built on the API contract's listFuelOptions example rows.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HttpResponse } from "msw";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { calls, exampleOf, handlerFor, mockServer } from "./api-mock.js";
import { connect, textOf } from "./harness.js";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  calls.length = 0;
});
afterAll(() => mockServer.close());

type Body = { data: unknown; meta: Record<string, unknown> };
const at = { lat: 52.52, lon: 13.405 };

async function call(tool: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const { client, close } = await connect();
  try {
    return (await client.callTool({ name: tool, arguments: args })) as CallToolResult;
  } finally {
    await close();
  }
}
const body = (r: CallToolResult): string => {
  const t = textOf(r);
  const i = t.lastIndexOf("\n\n");
  return i < 0 ? t : t.slice(0, i);
};
function serve(op: string, data: unknown, query?: Record<string, unknown>): void {
  mockServer.use(handlerFor(op, () => {
    const ex = exampleOf<Body>(op);
    const meta = query === undefined ? ex.meta : { ...ex.meta, query: { ...(ex.meta["query"] as Record<string, unknown>), ...query } };
    return HttpResponse.json({ data, meta });
  }));
}
const NOW = "2026-03-30T00:00:00Z";
const OLD = "2026-03-23T08:00:00Z";
/** The contract example's row with its name, distance and one e10 price (or none) changed. */
const row = (name: string, distanceM: number, price: number | null, current: boolean, reportedAt = NOW) => {
  const ex = exampleOf<{ data: { prices: Record<string, unknown>[] }[] }>("listFuelOptions").data[0]!;
  return { ...ex, name, brand: name, distanceM, prices: price === null ? [] : [{ ...ex.prices[0], fuel: "e10", priceEur: price, reportedAt, current }] };
};
const lines = (r: CallToolResult): string[] => body(r).split("\n").slice(1);
const LANGS = ["de", "en"] as const;

describe("find_cheapest_fuel, current and stale prices mixed", () => {
  // The API's price sort with stale rows in it: a stale, cheaper B and an unpriced D stand above current ones.
  const mixed = () => serve("listFuelOptions", [row("B", 500, 1.599, false, OLD), row("D", 100, null, false), row("A", 3000, 1.699, true), row("C", 900, 1.649, true), row("E", 950, 1.649, true)], { stationsWithoutCurrentPrice: 5, stationsInRadius: 9 });

  for (const language of LANGS) {
    it(`current prices first, each part by price, equal prices in the API's order, unpriced last (${language})`, async () => {
      mixed();
      const r = await call("find_cheapest_fuel", { ...at, language });
      expect(lines(r).slice(1, 6).map((l) => l.split(" — ")[0])).toEqual(["1. C", "2. E", "3. A", "4. B", "5. D"]);
    });

    it(`the head says current prices first, then older; a stale price is marked; the unranked line counts only the unlisted (${language})`, async () => {
      mixed();
      const r = await call("find_cheapest_fuel", { ...at, language });
      const de = language === "de";
      expect(lines(r)[0]).toBe(de ? "Super E10 um 52.520, 13.405 (Umkreis 5 km), aktuelle Preise günstigste zuerst, danach ältere:" : "Super E10 around 52.520, 13.405 (within 5 km), current prices cheapest first, then older prices:");
      expect(lines(r)[1]).toBe(de ? "1. C — 1,649 €/l, 0,9 km, zuletzt offen (Stand 30.03. 02:00)" : "1. C — 1.649 €/l, 0.9 km, open when last seen (as of 2026-03-30 02:00)");
      expect(lines(r)[4]).toBe(de ? "4. B — 1,599 €/l (nicht aktuell), 0,5 km, zuletzt offen (Stand 23.03. 09:00)" : "4. B — 1.599 €/l (not current), 0.5 km, open when last seen (as of 2026-03-23 09:00)");
      expect(lines(r)[5]).toBe(de ? "5. D — –, 0,1 km, zuletzt offen" : "5. D — –, 0.1 km, open when last seen");
      expect(lines(r).at(-1)).toBe(de
        ? "3 der 9 Tankstellen im Umkreis haben keinen Super E10-Preis aus den letzten 30 Minuten (älter oder noch keiner) und stehen nicht in der Rangfolge."
        : "3 of the 9 stations within the radius have no Super E10 price from the last 30 minutes (older, or none yet) and are not in the ranking.");
    });
  }
});

describe("find_cheapest_fuel, a count below the listed stale rows", () => {
  it("says no unranked line rather than a negative count", async () => {
    serve("listFuelOptions", [row("B", 500, 1.599, false, OLD), row("D", 100, null, false), row("C", 900, 1.649, true)], { stationsWithoutCurrentPrice: 1, stationsInRadius: 9 });
    const r = await call("find_cheapest_fuel", { ...at, language: "en" });
    expect(lines(r).at(-1)).toBe("I hold a Super E10 price for only 3 stations within 5 km (asked for: 5) — a wider radius (up to 25 km) may find more.");
  });
});

describe("find_cheapest_fuel, every listed price current", () => {
  for (const language of LANGS) {
    it(`the head says a plain cheapest first and the unranked line counts every station the API counts (${language})`, async () => {
      serve("listFuelOptions", [row("A", 3000, 1.699, true), row("C", 900, 1.649, true)], { stationsWithoutCurrentPrice: 2, stationsInRadius: 9 });
      const r = await call("find_cheapest_fuel", { ...at, language });
      const de = language === "de";
      expect(lines(r)[0]).toBe(de ? "Super E10 um 52.520, 13.405 (Umkreis 5 km), günstigste zuerst:" : "Super E10 around 52.520, 13.405 (within 5 km), cheapest first:");
      expect(lines(r).at(-1)).toBe(de
        ? "2 der 9 Tankstellen im Umkreis haben keinen Super E10-Preis aus den letzten 30 Minuten (älter oder noch keiner) und stehen nicht in der Rangfolge."
        : "2 of the 9 stations within the radius have no Super E10 price from the last 30 minutes (older, or none yet) and are not in the ranking.");
    });
  }
});

describe("find_cheapest_fuel, no current price", () => {
  for (const language of LANGS) {
    it(`the head says no price is current, the rows are the last prices cheapest first, no "not in the ranking" line (${language})`, async () => {
      // As on prod (34 of 34): the API counts more stations without a current price than it lists; no line about them.
      serve("listFuelOptions", [row("A", 3000, 1.699, false, OLD), row("B", 500, 1.599, false, OLD)], { stationsWithoutCurrentPrice: 5, stationsInRadius: 5 });
      const r = await call("find_cheapest_fuel", { ...at, language });
      const de = language === "de";
      expect(lines(r)).toEqual(de
        ? [
            "Super E10 um 52.520, 13.405 (Umkreis 5 km): Keine Tankstelle hat einen aktuellen Super E10-Preis. Hier die zuletzt gemeldeten Preise, günstigste zuerst; sie können sich seitdem geändert haben:",
            "1. B — 1,599 €/l (nicht aktuell), 0,5 km, zuletzt offen (Stand 23.03. 09:00)",
            "2. A — 1,699 €/l (nicht aktuell), 3,0 km, zuletzt offen (Stand 23.03. 09:00)",
            "Preise liegen mir nur für 2 Tankstellen im Umkreis von 5 km vor (Super E10, gewünscht: 5) — ein größerer Umkreis (bis 25 km) findet vielleicht mehr.",
          ]
        : [
            "Super E10 around 52.520, 13.405 (within 5 km): no station has a current Super E10 price. These are the last prices reported, cheapest first; they may have changed since:",
            "1. B — 1.599 €/l (not current), 0.5 km, open when last seen (as of 2026-03-23 09:00)",
            "2. A — 1.699 €/l (not current), 3.0 km, open when last seen (as of 2026-03-23 09:00)",
            "I hold a Super E10 price for only 2 stations within 5 km (asked for: 5) — a wider radius (up to 25 km) may find more.",
          ]);
    });
  }
});

describe("find_fuel_station, a stale price", () => {
  for (const language of LANGS) {
    it(`is marked not current with its as-of time; a current one is not (${language})`, async () => {
      serve("listFuelOptions", [row("A", 3000, 1.699, false, OLD), row("B", 500, 1.599, true)]);
      const r = await call("find_fuel_station", { ...at, language });
      expect(lines(r).slice(1)).toEqual(language === "de"
        ? ["1. A — Super E10 1,699 €/l (nicht aktuell, Stand 23.03. 09:00), 3,0 km, offen", "2. B — Super E10 1,599 €/l, 0,5 km, offen"]
        : ["1. A — Super E10 1.699 €/l (not current, as of 2026-03-23 09:00), 3.0 km, open", "2. B — Super E10 1.599 €/l, 0.5 km, open"]);
    });
  }
});

