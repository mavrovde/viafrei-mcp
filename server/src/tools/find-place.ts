/**
 * find_place, in today's server's words (main packages/mcp/src/tools/find_place.ts, COPY; geo/distinguish.ts):
 * a head line, '"Essen" — 2 Treffer:', then one numbered line per place, "Essen — Stadt/Gemeinde,
 * Nordrhein-Westfalen, 51.45560, 7.01160". No match: '"Fulda" finde ich nicht im Ortsverzeichnis.', or,
 * when the places coverage lists no kind at all, that no place index is loaded.
 *
 * The Kreis is the API's own text (kreis), the English name beside the name in English (nameEn). What the contract
 * does not carry is not said: a place's population, the merge of one place's rows from several publishers.
 */
import type * as T from "../api/types.js";
import { asOfDayLabel, toolResult, type Language } from "../presentation.js";
import { atParam, isResult, num, position, radiusM, str, type Handler } from "./context.js";

const COPY = {
  de: {
    none: (q: string): string => `"${q}" finde ich nicht im Ortsverzeichnis.`,
    head: (q: string, n: number): string => `"${q}" — ${n} Treffer:`,
    one: (q: string): string => `"${q}" — ein Treffer:`,
    more: (q: string, n: number, max: number): string => `"${q}" — ${n === 1 ? "der erste Treffer" : `die ersten ${n} Treffer`}; es gibt weitere, das ist also keine Zählung aller Orte dieses Namens (eingrenzen mit near oder kind, limit bis ${max}):`,
    empty: "Für diese Installation ist kein Ortsverzeichnis geladen.",
  },
  en: {
    none: (q: string): string => `I do not find "${q}" in the place index.`,
    head: (q: string, n: number): string => `"${q}" — ${n} matches:`,
    one: (q: string): string => `"${q}" — one match:`,
    more: (q: string, n: number, max: number): string => `"${q}" — ${n === 1 ? "the first match" : `the first ${n} matches`}; more exist, so this is not a count of every place with that name (narrow with near or kind, limit up to ${max}):`,
    empty: "This installation holds no place index.",
  },
} as const;

/** Today's find_place limit cap (MAX_RESULTS). */
const MAX_RESULTS = 10;

/** The API's place kinds in today's words (geo/distinguish.ts KIND_WORD, by the kind each maps from). */
export function KIND_WORD(): Readonly<Record<string, Readonly<Record<Language, string>>>> {
  return {
    municipality: { de: "Stadt/Gemeinde", en: "town" },
    district: { de: "Kreis", en: "district" },
    region: { de: "Verwaltungseinheit", en: "administrative area" },
    station_area: { de: "Bahnhof", en: "station" },
    stop: { de: "Haltestelle", en: "stop" },
    motorway: { de: "Autobahn", en: "motorway" },
    junction: { de: "Anschlussstelle", en: "junction" },
    island: { de: "Insel", en: "island" },
  };
}

/** The Länder by their AGS key (Statistisches Bundesamt; main packages/ingest/src/platform/ags.ts). */
export function LAENDER(): Readonly<Record<string, Readonly<Record<Language, string>>>> {
  return {
    "01": { de: "Schleswig-Holstein", en: "Schleswig-Holstein" }, "02": { de: "Hamburg", en: "Hamburg" },
    "03": { de: "Niedersachsen", en: "Lower Saxony" }, "04": { de: "Bremen", en: "Bremen" },
    "05": { de: "Nordrhein-Westfalen", en: "North Rhine-Westphalia" }, "06": { de: "Hessen", en: "Hesse" },
    "07": { de: "Rheinland-Pfalz", en: "Rhineland-Palatinate" }, "08": { de: "Baden-Württemberg", en: "Baden-Württemberg" },
    "09": { de: "Bayern", en: "Bavaria" }, "10": { de: "Saarland", en: "Saarland" }, "11": { de: "Berlin", en: "Berlin" },
    "12": { de: "Brandenburg", en: "Brandenburg" }, "13": { de: "Mecklenburg-Vorpommern", en: "Mecklenburg-Western Pomerania" },
    "14": { de: "Sachsen", en: "Saxony" }, "15": { de: "Sachsen-Anhalt", en: "Saxony-Anhalt" }, "16": { de: "Thüringen", en: "Thuringia" },
  };
}

export function PLACE_KIND(): Readonly<Record<string, string>> {
  return { city: "municipality", district: "district", admin: "region", station: "station_area", stop: "station_area", motorway: "motorway", junction: "junction" };
}

/**
 * The Kreis a place lies in, as the API's place search states it in German (PlaceItem.kreis): said as given in a
 * German answer; in an English one "kreisfreie Stadt" is "independent city", "Kreis X" is "district X", and a name
 * that says its kind itself ("Vogtlandkreis", "Region Hannover") is "district" and that name. None given, none said.
 */
export function kreisWord(kreis: string | null | undefined, language: Language): string | null {
  const k = kreis?.trim() ?? "";
  if (k === "") return null;
  if (language === "de") return k;
  const free = /^kreisfreie Stadt(?: (.+))?$/u.exec(k);
  if (free !== null) return free[1] === undefined ? "independent city" : `independent city ${free[1]}`;
  return `district ${/^Kreis (.+)$/u.exec(k)?.[1] ?? k}`;
}

/** "Essen — Stadt/Gemeinde, Nordrhein-Westfalen, 306 km, 51.45560, 7.01160": kind, Land, distance, coordinate. */
function line(p: T.PlaceItem, language: Language, near: boolean): string {
  const code = p.districtCode ?? null;
  const land = code !== null && /^\d{2,12}$/u.test(code) && !(p.kind === "region" && code.length === 2) ? LAENDER()[code.slice(0, 2)]?.[language] ?? null : null;
  const parts = [
    KIND_WORD()[p.kind]?.[language] ?? p.kind,
    land,
    kreisWord(p.kreis, language),
    near && p.distanceM !== undefined ? `${(p.distanceM / 1000).toFixed(0)} km` : null,
    `${p.location.lat.toFixed(5)}, ${p.location.lon.toFixed(5)}`,
  ];
  // An English answer gives the English name beside the German one, which signs and local apps use.
  const name = language === "en" && p.nameEn !== undefined && p.nameEn.trim() !== "" && p.nameEn !== p.name ? `${p.name} (${p.nameEn.trim()})` : p.name;
  return `${name} — ${parts.filter((x): x is string => x !== null).join(", ")}`;
}

export const findPlace: Handler = async (args, ctx) => {
  const { language } = ctx;
  const c = COPY[language];
  const query = str(args["query"]) ?? "";
  const kindArg = str(args["kind"]);
  let at: string | undefined;
  if (str(args["near"]) !== undefined || num(args["lat"]) !== undefined) {
    const pos = await position(args, ctx, "near");
    if (isResult(pos)) return pos;
    at = atParam(pos.at);
  }
  const r = await ctx.api.get<T.PlaceItem[]>("listPlaces", { q: str(args["query"]), kind: kindArg === undefined ? undefined : PLACE_KIND()[kindArg], at, radius_m: radiusM(args["radius_km"]), limit: num(args["limit"]) });
  if (r.data.length === 0) {
    // Today's server tells "this name is not in the index" from "no index is loaded" (placeGazetteerLoaded).
    const cov = await ctx.api.get<T.PlacesCoverageData>("getPlacesCoverage", {});
    return toolResult(cov.data.kinds.length === 0 ? c.empty : c.none(query), [r.meta], language, { structured: { found: 0, query } });
  }
  const n = r.data.length;
  const head = r.meta.page?.hasMore === true ? c.more(query, n, MAX_RESULTS) : n === 1 ? c.one(query) : c.head(query, n);
  // The place index is reference data: its day, never the clock time of its load or of this read; no day known, none said.
  const asOf = typeof r.meta.asOf === "string" ? r.meta.asOf : undefined;
  return toolResult([head, ...r.data.map((p, i) => `${i + 1}. ${line(p, language, at !== undefined)}`)].join("\n"), [r.meta], language, { asOfLabel: asOf === undefined ? "" : asOfDayLabel(asOf, language) });
};
