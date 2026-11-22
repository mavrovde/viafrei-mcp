/**
 * find_charging_station, in today's server's words (main tools/find_charging_station.ts): the head "Laden um
 * Hannover (Umkreis 20 km, CCS2), nächste zuerst, Standorte ganz außer Betrieb zuletzt:", one numbered line per
 * site, the note that "keine Statusdaten" is unknown and not free; with nothing matching, the sites the circle
 * holds without the filter ("kenne ich 4 Ladestandorte, aber keinen (CCS2, ≥ 50 kW)").
 *
 * Not in the contract, so not said (scratchpad api-gap.md, lane A): a site's street address and its plugs (the
 * line names the site and its operator instead), its price per kWh, the charging register's release date, and
 * which sites come from the register ("laut Ladesäulenregister").
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type * as T from "../api/types.js";
import { toolResult, type Language } from "../presentation.js";
import { atParam, bool, isResult, num, position, str, strs, type Args, type Handler } from "./context.js";
import { kmText } from "./nearby.js";
import { aroundText } from "./weather-words.js";

/** Today's default and largest radius. */
const CHARGING_RADIUS_KM = 10;
const CHARGING_MAX_RADIUS_KM = 25;

const CONNECTOR_WORD: Readonly<Record<string, Readonly<Record<Language, string>>>> = {
  ccs2: { de: "CCS2", en: "CCS2" }, type2: { de: "Typ 2", en: "Type 2" }, chademo: { de: "CHAdeMO", en: "CHAdeMO" }, mcs: { de: "MCS", en: "MCS" },
};
const TERM_WORDS: Readonly<Record<Language, Readonly<Record<string, string>>>> = {
  de: { open247: "rund um die Uhr", card: "Kartenzahlung am Gerät", free: "kostenlos", public: "öffentlich zugänglich" },
  en: { open247: "open 24/7", card: "card at the charger", free: "free of charge", public: "open to the public" },
};

/** "50 kW", "7,4 kW" (main fmtKw). */
const kw = (n: number, language: Language): string => `${language === "de" ? String(n).replace(".", ",") : String(n)} kW`;

/** The asked filters as today's head and sentences name them (main filterWordsOf). */
function filterWordsOf(args: Args, language: Language): string[] {
  const words: string[] = [];
  const connector = str(args["connector"]);
  if (connector !== undefined) words.push(CONNECTOR_WORD[connector]?.[language] ?? connector);
  const min = num(args["min_power_kw"]);
  if (min !== undefined) words.push(`≥ ${kw(min, language)}`);
  const max = num(args["max_power_kw"]);
  if (max !== undefined) words.push(`≤ ${kw(max, language)}`);
  const operator = str(args["operator"]);
  if (operator !== undefined) words.push(language === "de" ? `Betreiber ${operator.trim()}` : `operator ${operator.trim()}`);
  for (const t of strs(args["conditions"]) ?? []) words.push(TERM_WORDS[language][t] ?? t);
  return words;
}

type Tally = { available: number; occupied: number; outOfOrder: number; unknown: number; stale: number };
function tally(s: T.ChargingSite): Tally {
  const t: Tally = { available: 0, occupied: 0, outOfOrder: 0, unknown: 0, stale: 0 };
  for (const p of s.chargePoints ?? []) {
    const st = p.availability?.state;
    if (st === "available") t.available++;
    else if (st === "occupied" || st === "reserved") t.occupied++;
    else if (st === "out_of_order") t.outOfOrder++;
    else if (st === "stale") t.stale++;
    else t.unknown++;
  }
  return t;
}

/** A site's status (main availabilityText, its live cases): "1 von 3 frei, 2 ohne Status", "belegt", "keine Statusdaten". */
function statusText(t: Tally, language: Language): string {
  const de = language === "de";
  const unknownTail = t.unknown === 0 ? "" : de ? `, ${t.unknown} ohne Status` : `, ${t.unknown} without status`;
  if (t.available > 0) return `${de ? `${t.available} von ${t.available + t.occupied + t.outOfOrder} frei` : `${t.available} of ${t.available + t.occupied + t.outOfOrder} free`}${unknownTail}`;
  if (t.occupied > 0) return `${de ? "belegt" : "occupied"}${unknownTail}`;
  if (t.outOfOrder > 0) return `${de ? "außer Betrieb" : "out of order"}${unknownTail}`;
  return de ? "keine Statusdaten" : "no status data";
}

const wholeOutOfOrder = (t: Tally): boolean => t.outOfOrder > 0 && t.available + t.occupied + t.unknown + t.stale === 0;

export const findChargingStation: Handler = async (args, ctx): Promise<CallToolResult> => {
  const { language } = ctx;
  const de = language === "de";
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  // Today's default radius, always sent and said: the API's own default is not the one the answer names.
  const radiusKm = num(args["radius_km"]) ?? CHARGING_RADIUS_KM;
  const around = aroundText(pos.label, pos.at);
  const r = await ctx.api.get<T.ChargingSite[]>("listChargingOptions", {
    at: atParam(pos.at), radius_m: radiusKm * 1000, connector: str(args["connector"]), min_kw: num(args["min_power_kw"]), max_kw: num(args["max_power_kw"]),
    operator: str(args["operator"]), conditions: strs(args["conditions"]), only_available: bool(args["only_available"]), limit: num(args["limit"]),
  });
  const words = filterWordsOf(args, language);
  const filterText = words.length === 0 ? "" : ` (${words.join(", ")})`;
  if (r.data.length === 0) {
    const filtered = words.length > 0 || bool(args["only_available"]) === true;
    // The sites of the circle with every filter dropped (today's sitesInRadius): one more read, on this path only.
    const all = filtered ? await ctx.api.get<T.ChargingSite[]>("listChargingOptions", { at: atParam(pos.at), radius_m: radiusKm * 1000, limit: 100 }) : r;
    const held = all.data.length;
    if (held === 0) {
      return toolResult(de
        ? `Im Umkreis von ${radiusKm} km um ${around} kenne ich keine Ladestandorte. Die Abdeckung ist bundesweit, aber nicht lückenlos — ein größerer Radius (bis ${CHARGING_MAX_RADIUS_KM} km) hilft oft.`
        : `I hold no charging sites within ${radiusKm} km of ${around}. Coverage is nationwide but not complete — a larger radius (up to ${CHARGING_MAX_RADIUS_KM} km) often helps.`, [r.meta], language);
    }
    // More than a page held: the count is a floor.
    const n = all.meta.page?.hasMore === true ? (de ? `mindestens ${held}` : `at least ${held}`) : String(held);
    return toolResult(de
      ? `Im Umkreis von ${radiusKm} km um ${around} kenne ich ${n} Ladestandorte, aber keinen${filterText}. Ohne Filter oder mit größerem Radius finden Sie mehr.`
      : `Within ${radiusKm} km of ${around} I know ${n} charging sites, but none${filterText}. Widen the radius or drop the filter.`, [r.meta], language);
  }
  // A site whose every point is out of order goes last, still listed (a stable sort keeps the nearest first).
  const rows = r.data.map((s) => ({ s, t: tally(s) })).sort((a, b) => Number(wholeOutOfOrder(a.t)) - Number(wholeOutOfOrder(b.t)));
  const head = de
    ? `Laden um ${around} (Umkreis ${radiusKm} km${words.length === 0 ? "" : `, ${words.join(", ")}`}), nächste zuerst, Standorte ganz außer Betrieb zuletzt:`
    : `Charging around ${around} (within ${radiusKm} km${words.length === 0 ? "" : `, ${words.join(", ")}`}), nearest first, sites wholly out of order last:`;
  const lines = rows.map(({ s, t }, i) => {
    const label = s.name?.trim() || s.operator?.trim() || s.id;
    const operator = s.name?.trim() && s.operator?.trim() ? ` (${s.operator.trim()})` : "";
    const bits = [kmText(s.distanceM ?? 0, language), ...(s.summary.maxPowerKw === null ? [] : [`${de ? "bis" : "up to"} ${kw(s.summary.maxPowerKw, language)}`]), statusText(t, language)];
    return `${i + 1}. ${label}${operator} — ${bits.join(", ")}`;
  });
  const anyUnknown = rows.some(({ t }) => t.unknown > 0);
  const notes = anyUnknown ? [de ? 'Nur wenige Betreiber veröffentlichen Live-Belegung; "keine Statusdaten" heißt unbekannt, nicht frei.' : 'Only a few operators publish live occupancy; "no status data" means unknown, not free.'] : [];
  return toolResult([head, ...lines, ...notes].join("\n"), [r.meta], language);
};
