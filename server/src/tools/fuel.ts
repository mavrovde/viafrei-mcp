/**
 * The fuel tools in today's server's words: find_cheapest_fuel (main tools/find_cheapest_fuel.ts),
 * find_fuel_station (tools/find_fuel_station.ts), and the area sentence find_nearby's empty fuel line
 * carries (presentation/fuel-area.ts). Every sentence is main's, verbatim.
 *
 * The coverage of an area (fuel-area.ts, #522) is read from the contract: the stations held in the radius are
 * listFuelOptions' meta.query.matched with no filter but the circle, and the nearest priced station within
 * the provider's ceiling is the nearest row with a price in a 25 km read. find_cheapest_fuel asks the API's
 * live refresher (createRefresh, source fuel-prices-de) where today's server asks the provider: where no
 * station is held near the place (fuelDiscoverable). What the contract does not carry is not said
 * (scratchpad api-gap.md, lane A): the watch state of held stations, when a station's opening hours were read.
 */
import { hoursOpenness, osmFuelLines, unrankedLine, wholeDayOpen } from "./fuel-words.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ApiError, type DataMeta, type Envelope, type LatLon } from "../api/client.js";
import type * as T from "../api/types.js";
import { standTime, toolResult, type Language } from "../presentation.js";
import { atParam, bool, isResult, num, position, str, type Args, type Handler, type ToolContext } from "./context.js";
import { kmText } from "./nearby.js";

/** The provider's radius ceiling (MAX_RADIUS_KM) and the default radius of a fuel question. */
export const FUEL_MAX_RADIUS_KM = 25;
export const FUEL_DEFAULT_RADIUS_KM = 5;
/** The circle in which holding no station makes a place unknown (FUEL_SPARSE_RADIUS_KM). */
const FUEL_SPARSE_RADIUS_KM = 5;
/** find_cheapest_fuel's default list length. */
const CHEAPEST_LIMIT = 5;
/** The live source that asks the provider about an area. */
const FUEL_SOURCE = "fuel-prices-de";

const FUEL_LABEL: Readonly<Record<string, Readonly<Record<Language, string>>>> = {
  e5: { de: "Super E5", en: "Super E5" },
  e10: { de: "Super E10", en: "Super E10" },
  diesel: { de: "Diesel", en: "diesel" },
};
const GRADE_ORDER = ["diesel", "e10", "e5"];
const gradeWord = (fuel: string, language: Language): string => FUEL_LABEL[fuel]?.[language] ?? fuel;

export type FuelAreaWording = "discovering" | "fetching" | "refused" | "unconfigured" | "elsewhere" | "none_here";

/** presentation/fuel-area.ts FUEL_AREA_TEXT, verbatim (the states this server can tell). */
const FUEL_AREA_TEXT: Readonly<Record<FuelAreaWording, Readonly<Record<Language, string>>>> = {
  discovering: {
    de: "Wir haben den Anbieter gerade gefragt, welche Tankstellen es hier gibt; seine Antwort bringt ihre Preise mit, sie liegen in etwa einer Minute vor. Bitte dann noch einmal fragen.",
    en: "We have just asked the provider which filling stations are here; its answer carries their prices, which will be in within about a minute. Please ask again then.",
  },
  fetching: {
    de: "Die Preise für diese Gegend sind beim Anbieter angefordert, für eine Frage wie diese und nicht im Hintergrund; die Anfrage wartet in der Warteschlange, bis sie an der Reihe ist. Bitte danach noch einmal fragen.",
    en: "Prices for this area have been requested from the provider, for a question like this one and not in the background; the request waits in the queue until its turn comes. Please ask again after that.",
  },
  none_here: {
    de: "Wir haben für diese Gegend bereits beim Anbieter nachgefragt: Er führt hier keine Tankstelle. Dieselbe Gegend fragen wir so bald nicht noch einmal ab.",
    en: "We have already asked the provider about this area: it lists no filling station here. We will not ask about the same area again for a while.",
  },
  refused: {
    de: "Diese Gegend beobachten wir noch nicht, und gerade können wir sie nicht beim Anbieter abfragen — neue Gegenden fragen wir nacheinander ab, höchstens eine Anfrage je Minute, und eine schon abgefragte so bald nicht noch einmal. Bitte später noch einmal fragen.",
    en: "We do not watch this area yet, and we cannot ask the provider about it right now — new areas are asked about one at a time, at most one request a minute, and one already asked about not again for a while. Please ask again later.",
  },
  unconfigured: {
    de: "Diese Gegend beobachten wir noch nicht, und diese Installation fragt keine neuen Gegenden beim Anbieter ab.",
    en: "We do not watch this area yet, and this installation does not ask the provider about new areas.",
  },
  elsewhere: {
    de: "In unseren Preisdaten ist für diese Gegend noch keine Tankstelle. find_cheapest_fuel kann den Anbieter fragen, welche es hier gibt — neue Gegenden nur nacheinander, höchstens eine Anfrage je Minute; seine Antwort bringt ihre Preise mit, in etwa einer Minute.",
    en: "Our price data holds no filling station in this area yet. find_cheapest_fuel can ask the provider which ones are here — new areas one at a time, at most one request a minute; its answer carries their prices, within about a minute.",
  },
};

export const fuelAreaText = (language: Language, state: FuelAreaWording): string => FUEL_AREA_TEXT[state][language];

type Coverage = { coverage: "unknown" | "priced_beyond" | "held"; stationsInRadius: number; nearestPricedM: number | null; metas: DataMeta[] };

const matchedOf = (r: Envelope<T.FuelStation[]>): number => {
  const q = (r.meta as { query?: { matched?: number } }).query;
  return typeof q?.matched === "number" ? q.matched : r.data.length;
};

/** readFuelCoverage over the contract: what we hold around a point, by no filter but the grade. */
export async function fuelCoverage(ctx: ToolContext, at: LatLon, radiusM: number, fuel: string | undefined): Promise<Coverage> {
  const [inRadius, ceiling] = await Promise.all([
    ctx.api.get<T.FuelStation[]>("listFuelOptions", { at: atParam(at), radius_m: radiusM, sort: "distance", limit: 1 }),
    ctx.api.get<T.FuelStation[]>("listFuelOptions", { at: atParam(at), radius_m: FUEL_MAX_RADIUS_KM * 1000, fuel, sort: "distance", limit: 10 }),
  ]);
  const stationsInRadius = matchedOf(inRadius);
  const priced = ceiling.data.find((s) => s.prices.some((p) => fuel === undefined || p.fuel === fuel));
  const nearestPricedM = priced?.distanceM ?? null;
  const coverage = stationsInRadius > 0 ? "held" : nearestPricedM === null ? "unknown" : "priced_beyond";
  return { coverage, stationsInRadius, nearestPricedM, metas: [] };
}

function fuelDiscoverable(c: Coverage, radiusKm: number, heldWithinSparse?: number): boolean {
  if (c.coverage === "unknown") return true;
  if (c.coverage !== "priced_beyond") return false;
  return radiusKm >= FUEL_SPARSE_RADIUS_KM || heldWithinSparse === 0;
}

/**
 * readOnlyAreaWording: the area sentence of a tool that may not ask the provider. A held area's watch state
 * is not in the contract, so a held area gets none (today's unwatched/fetching sentences are an API gap).
 */
export function readOnlyAreaWording(c: Coverage, radiusKm: number): FuelAreaWording | undefined {
  if (c.coverage === "unknown") return "elsewhere";
  if (c.coverage === "priced_beyond" && fuelDiscoverable(c, radiusKm)) return "elsewhere";
  return undefined;
}

/** "Im Umkreis von 10 km um Leipzig kenne ich 34 Tankstellen" (fuelHeldText). */
const heldText = (language: Language, around: string, radiusKm: number, n: number): string =>
  language === "de"
    ? `Im Umkreis von ${radiusKm} km um ${around} kenne ich ${n} ${n === 1 ? "Tankstelle" : "Tankstellen"}`
    : `Within ${radiusKm} km of ${around} I know ${n} ${n === 1 ? "filling station" : "filling stations"}`;

const fmtPrice = (eur: number, language: Language): string => `${language === "de" ? eur.toFixed(3).replace(".", ",") : eur.toFixed(3)} €/l`;

/** "2026-11-23T02:00+01:00": a Berlin wall-clock instant with its offset (format.ts berlinIso). */
function berlinIso(iso: string): string {
  const d = new Date(iso);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "longOffset" }).formatToParts(d).map((p) => [p.type, p.value]));
  const offset = (parts["timeZoneName"] ?? "GMT+00:00").replace("GMT", "") || "+00:00";
  return `${parts["year"]}-${parts["month"]}-${parts["day"]}T${parts["hour"] === "24" ? "00" : parts["hour"]}:${parts["minute"]}${offset}`;
}

/** "Aral, Marktweg 1, 10001 Kansilkamp" (stationLabel): brand or name, street and town. */
function stationLabel(s: T.FuelStation, a: T.FuelAddress | null): string {
  const has = (x: string | null | undefined): x is string => typeof x === "string" && x.trim() !== "";
  const who = [s.brand, s.name].filter(has)[0] ?? "Tankstelle";
  const street = a !== null && has(a.street) ? [a.street, a.number].filter(has).join(" ") : null;
  const town = a === null ? null : [a.postcode, a.place].filter(has).join(" ");
  const where = [street, town].filter(has).join(", ");
  return where === "" ? who : `${who}, ${where}`;
}

/**
 * The listed stations' addresses. The contract's list item (FuelStation, listFuelOptions) carries no
 * address; only getFuelStation's FuelStationData does, and today's server names each station by its street
 * and place. So every listed station costs one more read, as many as the list's limit, in parallel; an API
 * error reads as "no address". The reads go when the list item carries the address (an API-side change).
 */
async function addressesOf(ctx: ToolContext, rows: readonly T.FuelStation[]): Promise<(T.FuelAddress | null)[]> {
  return (await detailsOf(ctx, rows)).map((d) => d?.address ?? null);
}

/** Each listed station's detail (getFuelStation), null on an API error. */
async function detailsOf(ctx: ToolContext, rows: readonly T.FuelStation[]): Promise<(T.FuelStationData | null)[]> {
  return Promise.all(rows.map(async (s) => {
    try {
      return (await ctx.api.get<T.FuelStationData>("getFuelStation", { fuelId: s.id })).data;
    } catch (err) {
      if (err instanceof ApiError) return null;
      throw err;
    }
  }));
}

/** The open state as observed with the price (openText): past tense, with the price's time. */
function observedOpen(s: T.FuelStation, p: T.FuelPrice | undefined, language: Language): string {
  const de = language === "de";
  if (s.openingState !== "open" && s.openingState !== "closed") return de ? "Öffnungszeit unbekannt" : "opening hours unknown";
  const seen = p === undefined ? "" : de ? ` (Stand ${standTime(p.reportedAt, language)})` : ` (as of ${standTime(p.reportedAt, language)})`;
  return s.openingState === "open" ? `${de ? "zuletzt offen" : "open when last seen"}${seen}` : `${de ? "zuletzt geschlossen" : "closed when last seen"}${seen}`;
}

/** pending: this call's ask is under way; joined: an earlier call's ask, still under way, was joined (reused). */
type DiscoveryOutcome = "settled" | "pending" | "joined" | "refused" | "not_asked";

/** Asks the live refresher about the area, as today's server asks the provider; waits as a train board does. */
async function discover(ctx: ToolContext, at: LatLon): Promise<DiscoveryOutcome> {
  let data: T.RefreshData;
  try {
    data = (await ctx.api.post<T.RefreshData>("createRefresh", { source: FUEL_SOURCE, subject: { at: `pt:${at.lat},${at.lon}` } })).data;
  } catch (err) {
    if (err instanceof ApiError && err.kind === "rate_limited") return "refused";
    if (err instanceof ApiError) return "not_asked";
    throw err;
  }
  const deadline = Date.now() + ctx.refreshWait.totalMs;
  while (data.state === "pending" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, Math.min(ctx.refreshWait.pollMs, Math.max(0, deadline - Date.now()))));
    try {
      data = (await ctx.api.get<T.RefreshData>("getRefresh", { id: data.id })).data;
    } catch (err) {
      if (err instanceof ApiError) return data.reused ? "joined" : "pending";
      throw err;
    }
  }
  if (data.state === "pending") return data.reused ? "joined" : "pending";
  if (data.state === "refused") return "refused";
  return "settled";
}

/** emptyAnswerText: what an empty cheapest-fuel answer may say, from the two numbers and the area state. */
function emptyAnswerText(language: Language, around: string, grade: string, radiusKm: number, c: Coverage, area: FuelAreaWording | undefined): string {
  const de = language === "de";
  const head = c.stationsInRadius === 0
    ? de ? `Für ${around} liegen im Umkreis von ${radiusKm} km keine Tankstellenpreise vor.` : `No fuel prices are held within ${radiusKm} km of ${around}.`
    : de ? `${heldText(language, around, radiusKm, c.stationsInRadius)}, aber keine mit einem Preis für ${grade}.` : `${heldText(language, around, radiusKm, c.stationsInRadius)}, but none with a ${grade} price.`;
  if (c.nearestPricedM === null) {
    const noRadiusHelp = de
      ? `${head} Auch im größtmöglichen Umkreis von ${FUEL_MAX_RADIUS_KM} km beobachten wir dort keine Tankstelle mit ${grade}-Preis — ein größerer Radius hilft hier also nicht.`
      : `${head} Within the largest radius the provider allows (${FUEL_MAX_RADIUS_KM} km) we watch no station there with a ${grade} price either, so a larger radius will not help.`;
    const part = de ? "Wir beobachten nur einen Teil der Tankstellen in Deutschland" : "We watch only part of Germany's filling stations";
    if (area !== undefined) return `${noRadiusHelp} ${part}. ${fuelAreaText(language, area)}`;
    return c.stationsInRadius > 0
      ? de ? `${noRadiusHelp} ${part}; die hier bekannten melden derzeit keinen ${grade}-Preis.` : `${noRadiusHelp} ${part}; the ones known here report no ${grade} price at the moment.`
      : de ? `${noRadiusHelp} ${part}, und diese Gegend gehört noch nicht dazu.` : `${noRadiusHelp} ${part}, and this area is not among them yet.`;
  }
  if (c.nearestPricedM <= radiusKm * 1000) return head;
  const km = c.nearestPricedM / 1000;
  const suggest = Math.min(FUEL_MAX_RADIUS_KM, Math.ceil(km));
  const advice = de
    ? `${head} Die nächste Tankstelle mit einem ${grade}-Preis liegt etwa ${kmText(c.nearestPricedM, language)} entfernt — mit einem Umkreis von ${suggest} km ist sie dabei.`
    : `${head} The nearest station with a ${grade} price is about ${kmText(c.nearestPricedM, language)} away — a radius of ${suggest} km reaches it.`;
  return area === undefined ? advice : `${advice} ${fuelAreaText(language, area)}`;
}

const aroundOf = (label: string | null, at: LatLon): string => label ?? `${at.lat.toFixed(3)}, ${at.lon.toFixed(3)}`;

const cheapestRead = (ctx: ToolContext, args: Args, at: LatLon, radiusKm: number, fuel: string, limit: number) =>
  ctx.api.get<T.FuelStation[]>("listFuelOptions", { at: atParam(at), radius_m: radiusKm * 1000, fuel, sort: "price", limit, brand: str(args["brand"]), name: str(args["name"]) });

export const findCheapestFuel: Handler = async (args, ctx): Promise<CallToolResult> => {
  const { language } = ctx;
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const radiusKm = num(args["radius_km"]) ?? FUEL_DEFAULT_RADIUS_KM;
  const fuel = str(args["fuel"]) ?? "e10";
  const limit = num(args["limit"]) ?? CHEAPEST_LIMIT;
  const grade = gradeWord(fuel, language);
  const around = aroundOf(pos.label, pos.at);
  let r = await cheapestRead(ctx, args, pos.at, radiusKm, fuel, limit);
  if (r.data.length === 0) {
    const cover = await fuelCoverage(ctx, pos.at, radiusKm * 1000, fuel);
    const heldWithinSparse = cover.coverage === "priced_beyond" && radiusKm < FUEL_SPARSE_RADIUS_KM ? (await fuelCoverage(ctx, pos.at, FUEL_SPARSE_RADIUS_KM * 1000, fuel)).stationsInRadius : undefined;
    let area: FuelAreaWording | undefined;
    if (fuelDiscoverable(cover, radiusKm, heldWithinSparse)) {
      const outcome = await discover(ctx, pos.at);
      if (outcome === "settled") r = await cheapestRead(ctx, args, pos.at, radiusKm, fuel, limit);
      // A discovery THIS call started says so; one an earlier call started, still under way, is "fetching".
      area = outcome === "not_asked" ? (cover.coverage === "unknown" ? "unconfigured" : undefined) : outcome === "refused" ? "refused" : outcome === "joined" ? "fetching" : "discovering";
    }
    if (r.data.length === 0) {
      return toolResult(emptyAnswerText(language, around, grade, radiusKm, cover, area), [r.meta], language, {
        structured: { place: around, fuel, radiusKm, stations: [], stationsInRadius: cover.stationsInRadius, nearestPricedKm: cover.nearestPricedM === null ? null : Math.round(cover.nearestPricedM) / 1000, maxRadiusKm: FUEL_MAX_RADIUS_KM, areaState: area ?? null, areaCoverage: cover.coverage },
      });
    }
  }
  // Cheapest first is said, so it is made true here (round 2.7.9 Q18, Q20: with no current price the API's rows
  // came in distance order): current prices first, each part by the asked grade's price, ties in the API's order.
  const rows = cheapestOrder(r.data, fuel);
  const details = await detailsOf(ctx, rows);
  const addresses = details.map((d) => d?.address ?? null);
  const de = language === "de";
  const noneCurrent = !rows.some((s) => s.prices.some((x) => x.fuel === fuel && x.current));
  const head = noneCurrent
    ? de
      ? `${grade} um ${around} (Umkreis ${radiusKm} km): Keine Tankstelle hat einen aktuellen ${grade}-Preis. Hier die zuletzt gemeldeten Preise, günstigste zuerst; sie können sich seitdem geändert haben:`
      : `${grade} around ${around} (within ${radiusKm} km): no station has a current ${grade} price. These are the last prices reported, cheapest first; they may have changed since:`
    : de ? `${grade} um ${around} (Umkreis ${radiusKm} km), günstigste zuerst:` : `${grade} around ${around} (within ${radiusKm} km), cheapest first:`;
  const lines = rows.map((s, i) => {
    const p = s.prices.find((x) => x.fuel === fuel);
    const stale = p !== undefined && !p.current ? (de ? " (nicht aktuell)" : " (not current)") : "";
    return `${i + 1}. ${stationLabel(s, addresses[i] ?? null)} — ${p === undefined ? "–" : fmtPrice(p.priceEur, language)}${stale}, ${kmText(s.distanceM ?? 0, language)}, ${wholeDayOpen(details[i] ?? null, s, language) ?? observedOpen(s, p, language)}`;
  });
  const short = rows.length >= limit
    ? ""
    : de
      ? `\nPreise liegen mir nur für ${rows.length === 1 ? "eine Tankstelle" : `${rows.length} Tankstellen`} im Umkreis von ${radiusKm} km vor (${grade}, gewünscht: ${limit})${radiusKm < FUEL_MAX_RADIUS_KM ? ` — ein größerer Umkreis (bis ${FUEL_MAX_RADIUS_KM} km) findet vielleicht mehr` : ""}.`
      : `\nI hold a ${grade} price for only ${rows.length === 1 ? "one station" : `${rows.length} stations`} within ${radiusKm} km (asked for: ${limit})${radiusKm < FUEL_MAX_RADIUS_KM ? ` — a wider radius (up to ${FUEL_MAX_RADIUS_KM} km) may find more` : ""}.`;
  // Today's sentence on the held stations the ranking leaves out for want of a current price; then the
  // unpriced OpenStreetMap stations, when the API lists them.
  const q = ((r.meta as { query?: Record<string, unknown> }).query ?? {}) as { stationsWithoutCurrentPrice?: number; stationsInRadius?: number; osmUnpriced?: readonly T.OsmFuelStation[] };
  // With no current price at all the head says so; "not in the ranking" would contradict the list below it.
  const uncovered = noneCurrent ? "" : unrankedLine(language, q.stationsWithoutCurrentPrice ?? 0, q.stationsInRadius ?? 0, grade);
  const osm = osmFuelLines(language, q.osmUnpriced ?? []);
  const observed = rows.flatMap((s) => s.prices.filter((p) => p.fuel === fuel).map((p) => p.reportedAt)).sort();
  // Today's stamp: the oldest price observation ranked (oldestObservedAt), not the feed's last write.
  const stamp = observed.length === 0 ? {} : { asOf: observed[0]! };
  return toolResult(`${head}\n${lines.join("\n")}${short}${uncovered}${osm.length === 0 ? "" : `\n${osm.join("\n")}`}`, [r.meta], language, stamp);
};

/** The rows cheapest first by `fuel`: current prices before older ones, unpriced last, equal prices in the API's order (the sort is stable). */
export function cheapestOrder(rows: readonly T.FuelStation[], fuel: string): T.FuelStation[] {
  const key = (s: T.FuelStation): [number, number] => {
    const p = s.prices.find((x) => x.fuel === fuel);
    return p === undefined ? [2, 0] : [p.current ? 0 : 1, p.priceEur];
  };
  return rows.map((s) => ({ s, k: key(s) })).sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1]).map((x) => x.s);
}

/** "Diesel 2,509 €/l, Super E10 2,349 €/l, Super E5 2,409 €/l": the asked grade, else every grade held. */
function pricesText(s: T.FuelStation, fuel: string | undefined, language: Language): string {
  const ps = s.prices.filter((p) => fuel === undefined || p.fuel === fuel).sort((a, b) => GRADE_ORDER.indexOf(a.fuel) - GRADE_ORDER.indexOf(b.fuel));
  if (ps.length === 0) return language === "de" ? "noch kein Preis" : "no price yet";
  // A price older than the provider's window is marked (round 2.7.9 Q25: prices of 23.11. read as current).
  const stale = (p: T.FuelPrice): string => (p.current ? "" : language === "de" ? ` (nicht aktuell, Stand ${standTime(p.reportedAt, language)})` : ` (not current, as of ${standTime(p.reportedAt, language)})`);
  return ps.map((p) => `${gradeWord(p.fuel, language)} ${fmtPrice(p.priceEur, language)}${stale(p)}`).join(", ");
}

/** opennessText without the hours' date, which the contract does not carry. */
function openness(s: T.FuelStation, language: Language): string {
  const de = language === "de";
  if (s.openingState === "open") return de ? "offen" : "open";
  if (s.openingState === "closed") return de ? "geschlossen" : "closed";
  return de ? "Öffnung unbekannt" : "opening state unknown";
}

const STATIONS = { de: ["Tankstelle", "Tankstellen"], en: ["station", "stations"] } as const;
const counted = (language: Language, n: number): string => `${n} ${STATIONS[language][n === 1 ? 0 : 1]}`;

export const findFuelStation: Handler = async (args, ctx): Promise<CallToolResult> => {
  const { language } = ctx;
  const de = language === "de";
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const radiusKm = num(args["radius_km"]) ?? FUEL_DEFAULT_RADIUS_KM;
  const fuel = str(args["fuel"]);
  const r = await ctx.api.get<T.FuelStation[]>("listFuelOptions", {
    at: atParam(pos.at), radius_m: radiusKm * 1000, fuel, brand: str(args["brand"]), name: str(args["name"]),
    open_now: bool(args["open_now"]), open_at: str(args["open_at"]), whole_day: bool(args["whole_day"]), sort: str(args["sort"]) ?? "distance", limit: num(args["limit"]),
  });
  const around = aroundOf(pos.label, pos.at);
  const q = ((r.meta as { query?: Record<string, unknown> }).query ?? {}) as { droppedClosed?: number; droppedUnknown?: number; droppedNotWholeDay?: number; openAt?: string | null };
  const filterWords: string[] = [];
  if (fuel !== undefined) filterWords.push(gradeWord(fuel, language));
  if (str(args["brand"]) !== undefined) filterWords.push(de ? `Marke ${str(args["brand"])}` : `brand ${str(args["brand"])}`);
  if (str(args["name"]) !== undefined) filterWords.push(de ? `Name enthält "${str(args["name"])}"` : `name contains "${str(args["name"])}"`);
  if (args["whole_day"] === true) filterWords.push(de ? "durchgehend geöffnet" : "open 24 h");
  if (args["open_now"] === true) filterWords.push(de ? "jetzt geöffnet" : "open now");
  if (str(args["open_at"]) !== undefined && typeof q.openAt === "string") filterWords.push(de ? `geöffnet am ${berlinIso(q.openAt)}` : `open at ${berlinIso(q.openAt)}`);
  const filters = filterWords.length === 0 ? "" : ` — ${filterWords.join(", ")}`;
  const notes: string[] = [];
  const unknown = q.droppedUnknown ?? 0;
  if (unknown > 0) {
    notes.push(de
      ? `${counted(language, unknown)} in der Nähe habe ich weggelassen, weil ihre Öffnungszeiten hier nicht bekannt sind — ${unknown === 1 ? "sie kann" : "sie können"} trotzdem offen sein.`
      : `${counted(language, unknown)} nearby ${unknown === 1 ? "was" : "were"} left out because ${unknown === 1 ? "its" : "their"} opening hours are not known here — ${unknown === 1 ? "it" : "they"} may well be open.`);
  }
  const closed = q.droppedClosed ?? 0;
  if (closed > 0) notes.push(de ? `${closed} weitere sind zu dieser Zeit laut Öffnungszeiten geschlossen.` : `${closed} more are closed at that time according to their opening hours.`);
  const notWholeDay = q.droppedNotWholeDay ?? 0;
  if (notWholeDay > 0) {
    notes.push(de
      ? `${counted(language, notWholeDay)} ${notWholeDay === 1 ? "ist" : "sind"} nicht als durchgehend geöffnet gemeldet.`
      : `${counted(language, notWholeDay)} ${notWholeDay === 1 ? "is" : "are"} not reported as open around the clock.`);
  }
  if (r.data.length === 0) {
    const matching = filters === "" ? "" : ` (${filterWords.join(", ")})`;
    const cover = await fuelCoverage(ctx, pos.at, radiusKm * 1000, fuel);
    const area = readOnlyAreaWording(cover, radiusKm);
    let empty: string;
    if (cover.coverage === "held") {
      const held = heldText(language, around, radiusKm, cover.stationsInRadius);
      empty = filters === "" ? `${held}.` : de ? `${held}, aber keine, auf die das zutrifft${matching}.` : `${held}, but none matching that${matching}.`;
    } else {
      empty = filters === ""
        ? de ? `Ich finde um ${around} im Umkreis von ${radiusKm} km keine Tankstelle.` : `I find no filling station within ${radiusKm} km of ${around}.`
        : de ? `Ich finde um ${around} im Umkreis von ${radiusKm} km keine Tankstelle, auf die das zutrifft${matching}.` : `I find no filling station within ${radiusKm} km of ${around} matching that${matching}.`;
    }
    if (cover.coverage === "priced_beyond" && cover.nearestPricedM !== null) {
      const suggest = Math.min(FUEL_MAX_RADIUS_KM, Math.ceil(cover.nearestPricedM / 1000));
      const g = fuel === undefined ? "" : de ? ` für ${gradeWord(fuel, "de")}` : ` ${gradeWord(fuel, "en")}`;
      const filtered = filterWords.length > (fuel === undefined ? 0 : 1);
      empty += de
        ? ` Die nächste Tankstelle mit einem Preis${g} liegt etwa ${kmText(cover.nearestPricedM, language)} entfernt — mit einem Umkreis von ${suggest} km ist sie dabei${filtered ? "; ob sie zu den übrigen Angaben passt, ist damit nicht gesagt" : ""}.`
        : ` The nearest station with a${g} price is about ${kmText(cover.nearestPricedM, language)} away — a radius of ${suggest} km reaches it${filtered ? "; whether it matches the other filters is not said by that" : ""}.`;
    }
    const advice = area === undefined ? "" : ` ${fuelAreaText(language, area)}`;
    return toolResult([empty + advice, ...notes].join("\n"), [r.meta], language, {
      structured: { place: around, stations: [], radiusKm, fuel: fuel ?? null, sort: str(args["sort"]) ?? "distance", areaCoverage: cover.coverage, stationsInRadius: cover.stationsInRadius, areaState: area ?? null },
    });
  }
  const details = await detailsOf(ctx, r.data);
  const now = new Date();
  const head = de ? `Tankstellen um ${around} (Umkreis ${radiusKm} km)${filters}:` : `Filling stations around ${around} (within ${radiusKm} km)${filters}:`;
  const lines = r.data.map((s, i) => {
    const d = details[i] ?? null;
    return `${i + 1}. ${stationLabel(s, d?.address ?? null)} — ${[pricesText(s, fuel, language), kmText(s.distanceM ?? 0, language), hoursOpenness(d, language, now) ?? openness(s, language)].join(", ")}`;
  });
  // Today's block of the stations OpenStreetMap maps without a price, when the API lists them.
  const osm = osmFuelLines(language, (q as { osmUnpriced?: readonly T.OsmFuelStation[] }).osmUnpriced ?? []);
  // Today's stamp: the newest price observation among the stations shown, not the feed's last write.
  const newest = r.data.flatMap((s) => s.prices.filter((p) => fuel === undefined || p.fuel === fuel).map((p) => p.reportedAt)).sort().at(-1);
  return toolResult([head, ...lines, ...notes, ...osm].join("\n"), [r.meta], language, newest === undefined ? {} : { asOf: newest });
};
