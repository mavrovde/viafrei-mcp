/**
 * find_charging_station, in today's server's words (main tools/find_charging_station.ts): the head "Laden um
 * Hannover (Umkreis 20 km, CCS2), nächste zuerst, Standorte ganz außer Betrieb zuletzt:", one numbered line per
 * site, the note that "keine Statusdaten" is unknown and not free; with nothing matching, the sites the circle
 * holds without the filter ("kenne ich 4 Ladestandorte, aber keinen (CCS2, ≥ 50 kW)").
 *
 * Asked without max_power_kw, operator or conditions (which the API's place grouping does not take), the API folds
 * one place's records into one item (group=place): its label is its name and address, never a record id, with its
 * plugs, price per kWh, live counts and their time, the register flag and release, and the site id a charger watch
 * takes. With those filters each record is a line, named by its name or operator, else "charging site", never by
 * its id.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type * as T from "../api/types.js";
import { toolResult, type Language } from "../presentation.js";
import { atParam, bool, isResult, num, position, str, strs, type Args, type Handler } from "./context.js";
import { clock, kmText, registerCaveat } from "./nearby.js";
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

/** "8 h 17 min ago", "42 min ago", "under 1 min ago": how long ago a status was confirmed. */
function ageText(ms: number, language: Language): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return language === "de" ? "vor weniger als 1 min" : "under 1 min ago";
  const h = Math.floor(min / 60);
  const span = h === 0 ? `${min} min` : `${h} h${min % 60 === 0 ? "" : ` ${min % 60} min`}`;
  return language === "de" ? `vor ${span}` : `${span} ago`;
}

type PlaceStatus = NonNullable<T.ChargingPlace["status"]>;
/**
 * A place's live counts (ChargingPlace.status): "2 of 3 free, 1 without status (as of 09:36)"; a status no point
 * confirms now (stale) leads with its last counts and says how old it is: "7 free, 1 occupied, status from 09:36
 * (8 h 17 min ago) — possibly out of date". null: no point has a status, "no status data", never 0.
 */
export function placeStatusText(st: PlaceStatus | null, language: Language, now: Date): string {
  const de = language === "de";
  if (st === null) return de ? "keine Statusdaten" : "no status data";
  const unknown = Math.max(0, st.total - st.free - st.occupied - st.outOfOrder);
  const unknownTail = unknown === 0 ? "" : de ? `, ${unknown} ohne Status` : `, ${unknown} without status`;
  const at = clock(st.observedAt, language, now);
  if (st.stale) {
    const ms = now.getTime() - new Date(st.observedAt).getTime();
    const when = ms >= 0 && ms < 86_400_000 ? `${at} (${ageText(ms, language)})` : at;
    const counts = [
      st.free > 0 ? `${st.free} ${de ? "frei" : "free"}` : null,
      st.occupied > 0 ? `${st.occupied} ${de ? "belegt" : "occupied"}` : null,
      st.outOfOrder > 0 ? `${st.outOfOrder} ${de ? "außer Betrieb" : "out of order"}` : null,
    ].filter((x): x is string => x !== null);
    return `${counts.length === 0 ? "" : `${counts.join(", ")}, `}${de ? `Status von ${when} — möglicherweise veraltet` : `status from ${when} — possibly out of date`}${unknownTail}`;
  }
  const stamp = de ? ` (Stand ${at})` : ` (as of ${at})`;
  const known = st.free + st.occupied + st.outOfOrder;
  if (st.free > 0) return `${de ? `${st.free} von ${known} frei` : `${st.free} of ${known} free`}${unknownTail}${stamp}`;
  const broken = st.outOfOrder > 0 ? (de ? `, ${st.outOfOrder} außer Betrieb` : `, ${st.outOfOrder} out of order`) : "";
  if (st.occupied > 0) return `${de ? "belegt" : "occupied"}${broken}${unknownTail}${stamp}`;
  if (st.outOfOrder > 0) return `${de ? "außer Betrieb" : "out of order"}${unknownTail}${stamp}`;
  return de ? "keine Statusdaten" : "no status data";
}

/**
 * "0.57 €/kWh net", "0,489 €/kWh brutto": the price as the API publishes it, to its three decimals with trailing zeros
 * trimmed (0.590 is "0,59"), never rounded to cents; its basis said; null for an absent price, never 0.
 */
export function priceText(price: T.ChargingPlace["price"], language: Language): string | null {
  if (price === null) return null;
  const n = price.amount.toFixed(3).replace(/\.?0+$/u, "");
  const basis = price.basis === "net" ? (language === "de" ? "netto" : "net") : language === "de" ? "brutto" : "gross";
  return `${language === "de" ? n.replace(".", ",") : n} €/kWh ${basis}`;
}

/** The place's facts after its distance: plugs, power, price, live status, the register flag, the address-located point. */
function placeFacts(s: T.ChargingSite, p: T.ChargingPlace, language: Language, now: Date): string[] {
  const de = language === "de";
  const plugs = [...new Set(p.connectors.map((c) => c.type.trim()).filter((x) => x !== ""))];
  const price = priceText(p.price, language);
  return [
    ...(plugs.length === 0 ? [] : [plugs.join("/")]),
    ...(s.summary.maxPowerKw === null ? [] : [`${de ? "bis" : "up to"} ${kw(s.summary.maxPowerKw, language)}`]),
    ...(price === null ? [] : [price]),
    p.sourceEnded ? (de ? "Quelle vom Betreiber eingestellt, ohne Status" : "source ended by its publisher, no status") : placeStatusText(p.status, language, now),
    ...(p.fromRegister ? [de ? "laut Ladesäulenregister" : "per charging point register"] : []),
    ...(p.reportedLocation === undefined ? [] : [de ? "Lage nach Anschrift" : "located by its address"]),
  ];
}

/** A record's label: its name, else its operator, else what it is; never its id (a register row's id is its point and a hash). */
const recordLabel = (s: T.ChargingSite, language: Language): string => s.name?.trim() || s.operator?.trim() || (language === "de" ? "Ladestandort" : "Charging site");

/** The API's place grouping takes neither an upper power limit, an operator nor the conditions. */
const placeGrouping = (args: Args): boolean => num(args["max_power_kw"]) === undefined && str(args["operator"]) === undefined && (strs(args["conditions"]) ?? []).length === 0;

const placeWhollyOutOfOrder = (p: T.ChargingPlace): boolean => p.status !== null && !p.status.stale && p.status.outOfOrder > 0 && p.status.outOfOrder === p.status.total;
const lastOne = (s: T.ChargingSite, t: Tally): number => Number(s.place === undefined ? wholeOutOfOrder(t) : placeWhollyOutOfOrder(s.place));
const placeHasUnknown = (p: T.ChargingPlace): boolean => p.status === null || p.status.total > p.status.free + p.status.occupied + p.status.outOfOrder;

/** The sentences under a list: unknown status, the register's release, the prices published, the hidden sites, the watch ids. */
function chargingNotes(rows: readonly { s: T.ChargingSite; t: Tally }[], meta: Record<string, unknown>, onlyAvailable: boolean, language: Language): string[] {
  const de = language === "de";
  const places = rows.map(({ s }) => s.place).filter((p): p is T.ChargingPlace => p !== undefined);
  const notes: string[] = [];
  if (rows.some(({ s, t }) => (s.place === undefined ? t.unknown > 0 : placeHasUnknown(s.place)))) {
    notes.push(de ? 'Nur wenige Betreiber veröffentlichen Live-Belegung; "keine Statusdaten" heißt unbekannt, nicht frei.' : 'Only a few operators publish live occupancy; "no status data" means unknown, not free.');
  }
  // The register's release, once, where a register row is among the places shown.
  if (places.some((p) => p.fromRegister)) notes.push(registerCaveat(language, places.find((p) => p.fromRegister && p.registerReleasedOn !== null)?.registerReleasedOn ?? null));
  // How many places publish a price (meta.pricesPublished, group=place).
  const prices = meta["pricesPublished"] as { places: number; priced: number } | undefined;
  if (prices !== undefined && prices.places > 0 && prices.priced < prices.places) {
    notes.push(prices.priced === 0
      ? de ? "Preis pro kWh: für keinen dieser Standorte veröffentlicht (in den Daten, die wir halten)." : "Price per kWh: not published for any of these sites (in the data we hold)."
      : de ? `Preis pro kWh: nur für ${prices.priced} von ${prices.places} veröffentlicht; für die übrigen liegt uns kein Preis vor.` : `Price per kWh: published for ${prices.priced} of ${prices.places} only; for the others we hold no price.`);
  }
  // only_available: the examined sites left out, by reason (meta.dropped), so an unknown status is never silently hidden.
  const dropped = meta["dropped"] as { noStatus: number; notFree: number; stale: number } | undefined;
  if (onlyAvailable && dropped !== undefined && dropped.noStatus + dropped.notFree + dropped.stale > 0) {
    notes.push(de
      ? `Von den nächstgelegenen Standorten wurden ${dropped.notFree} als belegt oder außer Betrieb, ${dropped.stale} wegen veralteter Statusdaten und ${dropped.noStatus} mangels Statusdaten ausgeblendet — die beiden Letzteren können frei sein.`
      : `Of the nearest sites, ${dropped.notFree} were hidden as occupied or out of order, ${dropped.stale} for an out-of-date status and ${dropped.noStatus} for having no status data — the last two may well be free.`);
  }
  // The id a charger watch takes, for the lines whose place reports a live status (a watch on one that never reports never fires).
  const watchable = rows.map(({ s }, i) => ({ n: i + 1, p: s.place })).filter((x): x is { n: number; p: T.ChargingPlace } => x.p !== undefined && x.p.status !== null && !x.p.sourceEnded);
  if (watchable.length > 0) notes.push(`${de ? 'Standort-ID für watch_situation (kind "charger")' : 'Site id for watch_situation (kind "charger")'}: ${watchable.map((x) => `${x.n} = ${x.p.siteId}`).join("; ")}`);
  return notes;
}

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
    group: placeGrouping(args) ? "place" : undefined,
  });
  const words = filterWordsOf(args, language);
  const filterText = words.length === 0 ? "" : ` (${words.join(", ")})`;
  if (r.data.length === 0) {
    const filtered = words.length > 0 || bool(args["only_available"]) === true;
    // The sites of the circle with every filter dropped: the API's count where it gives one (meta.inRadius), else
    // one more read, on this path only.
    const inRadius = r.meta["inRadius"];
    const counted = typeof inRadius === "number";
    const all = !filtered || counted ? r : await ctx.api.get<T.ChargingSite[]>("listChargingOptions", { at: atParam(pos.at), radius_m: radiusKm * 1000, limit: 100 });
    const held = counted ? inRadius : all.data.length;
    if (held === 0 || !filtered) {
      return toolResult(de
        ? `Im Umkreis von ${radiusKm} km um ${around} kenne ich keine Ladestandorte. Die Abdeckung ist bundesweit, aber nicht lückenlos — ein größerer Radius (bis ${CHARGING_MAX_RADIUS_KM} km) hilft oft.`
        : `I hold no charging sites within ${radiusKm} km of ${around}. Coverage is nationwide but not complete — a larger radius (up to ${CHARGING_MAX_RADIUS_KM} km) often helps.`, [r.meta], language);
    }
    // More than a page held: the count is a floor.
    const n = !counted && all.meta.page?.hasMore === true ? (de ? `mindestens ${held}` : `at least ${held}`) : String(held);
    return toolResult(de
      ? `Im Umkreis von ${radiusKm} km um ${around} kenne ich ${n} Ladestandorte, aber keinen${filterText}. Ohne Filter oder mit größerem Radius finden Sie mehr.`
      : `Within ${radiusKm} km of ${around} I know ${n} charging sites, but none${filterText}. Widen the radius or drop the filter.`, [r.meta], language);
  }
  const now = new Date();
  // A site whose every point is out of order goes last, still listed (a stable sort keeps the nearest first).
  const rows = r.data.map((s) => ({ s, t: tally(s) })).sort((a, b) => lastOne(a.s, a.t) - lastOne(b.s, b.t));
  const head = de
    ? `Laden um ${around} (Umkreis ${radiusKm} km${words.length === 0 ? "" : `, ${words.join(", ")}`}), nächste zuerst, Standorte ganz außer Betrieb zuletzt:`
    : `Charging around ${around} (within ${radiusKm} km${words.length === 0 ? "" : `, ${words.join(", ")}`}), nearest first, sites wholly out of order last:`;
  const lines = rows.map(({ s, t }, i) => {
    const label = recordLabel(s, language);
    const op = s.operator?.trim() ?? "";
    const operator = s.name?.trim() && op !== "" && !label.includes(op) ? ` (${op})` : "";
    const facts = s.place === undefined
      ? [...(s.summary.maxPowerKw === null ? [] : [`${de ? "bis" : "up to"} ${kw(s.summary.maxPowerKw, language)}`]), statusText(t, language)]
      : placeFacts(s, s.place, language, now);
    return `${i + 1}. ${label}${operator} — ${[kmText(s.distanceM ?? 0, language), ...facts].join(", ")}`;
  });
  const notes = chargingNotes(rows, r.meta, bool(args["only_available"]) === true, language);
  return toolResult([head, ...lines, ...notes].join("\n"), [r.meta], language, {
    structured: {
      place: around, radiusKm,
      sites: rows.map(({ s }) => ({
        name: recordLabel(s, language), operator: s.operator, distanceM: s.distanceM ?? null, lat: s.location.lat, lon: s.location.lon, maxPowerKw: s.summary.maxPowerKw,
        ...(s.place === undefined
          ? { siteId: s.id }
          : { siteId: s.place.siteId, siteIds: s.place.siteIds, address: s.place.address, connectors: s.place.connectors, price: s.place.price, status: s.place.status, fromRegister: s.place.fromRegister }),
      })),
    },
  });
};
