/**
 * find_place, in today's server's words (main packages/mcp/src/tools/find_place.ts, COPY; geo/distinguish.ts):
 * a head line, '"Essen" — 2 Treffer:', then one numbered line per place, "Essen — Stadt/Gemeinde,
 * Nordrhein-Westfalen, 51.45560, 7.01160". No match: '"Fulda" finde ich nicht im Ortsverzeichnis.', or,
 * when the places coverage lists no kind at all, that no place index is loaded.
 *
 * What the contract does not carry is not said (scratchpad api-gap.md, lane A): a place's population, its
 * Kreis by name, its English name, the merge of one place's rows from several publishers.
 */
import type * as T from "../api/types.js";
import { toolResult, type Language } from "../presentation.js";
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
const KIND_WORD: Readonly<Record<string, Readonly<Record<Language, string>>>> = {
  municipality: { de: "Stadt/Gemeinde", en: "town" },
  district: { de: "Kreis", en: "district" },
  region: { de: "Verwaltungseinheit", en: "administrative area" },
  station_area: { de: "Bahnhof", en: "station" },
  stop: { de: "Haltestelle", en: "stop" },
  motorway: { de: "Autobahn", en: "motorway" },
  junction: { de: "Anschlussstelle", en: "junction" },
  island: { de: "Insel", en: "island" },
};

/** The Länder by their AGS key (Statistisches Bundesamt; main packages/ingest/src/platform/ags.ts). */
export const LAENDER: Readonly<Record<string, Readonly<Record<Language, string>>>> = {
  "01": { de: "Schleswig-Holstein", en: "Schleswig-Holstein" }, "02": { de: "Hamburg", en: "Hamburg" },
  "03": { de: "Niedersachsen", en: "Lower Saxony" }, "04": { de: "Bremen", en: "Bremen" },
  "05": { de: "Nordrhein-Westfalen", en: "North Rhine-Westphalia" }, "06": { de: "Hessen", en: "Hesse" },
  "07": { de: "Rheinland-Pfalz", en: "Rhineland-Palatinate" }, "08": { de: "Baden-Württemberg", en: "Baden-Württemberg" },
  "09": { de: "Bayern", en: "Bavaria" }, "10": { de: "Saarland", en: "Saarland" }, "11": { de: "Berlin", en: "Berlin" },
  "12": { de: "Brandenburg", en: "Brandenburg" }, "13": { de: "Mecklenburg-Vorpommern", en: "Mecklenburg-Western Pomerania" },
  "14": { de: "Sachsen", en: "Saxony" }, "15": { de: "Sachsen-Anhalt", en: "Saxony-Anhalt" }, "16": { de: "Thüringen", en: "Thuringia" },
};

const PLACE_KIND: Readonly<Record<string, string>> = { city: "municipality", district: "district", admin: "region", station: "station_area", stop: "station_area", motorway: "motorway", junction: "junction" };

/** The kinds that lie in a Kreis (today's IN_A_KREIS). */
const IN_A_KREIS: ReadonlySet<string> = new Set(["municipality", "island", "station_area", "stop", "junction"]);

/** Today's KREIS_WORD: a name that already says what it is ("Vogtlandkreis", "Region Hannover") is not prefixed. */
const KREIS_WORD = {
  de: { kreis: (n: string): string => (/kreis|^region |^stadtverband |^stadtregion |^stadteregion /iu.test(n.toLowerCase()) ? n : `Kreis ${n}`), free: "kreisfreie Stadt", freeNamed: (n: string): string => `kreisfreie Stadt ${n}` },
  en: { kreis: (n: string): string => `district ${n}`, free: "independent city", freeNamed: (n: string): string => `independent city ${n}` },
} as const;

/**
 * Today's kreisWord: the Kreis a row lies in, from its own eight-digit Gemeinde key. A key ending in 000 is a
 * kreisfreie Stadt (said bare of the town itself, with its name of a stop inside it); a city-state names none;
 * without the proposed districtName nothing is said rather than a guess.
 */
export function kreisWord(p: Pick<T.PlaceItem, "kind" | "districtCode" | "districtName">, language: Language): string | null {
  const key = p.districtCode ?? null;
  if (!IN_A_KREIS.has(p.kind) || key === null || !/^\d{8}$/u.test(key) || key.slice(2) === "000000") return null;
  if (key.endsWith("000") && p.kind === "municipality") return KREIS_WORD[language].free;
  const name = p.districtName ?? null;
  if (name === null) return null;
  return key.endsWith("000") ? KREIS_WORD[language].freeNamed(name) : KREIS_WORD[language].kreis(name);
}

/** "Essen — Stadt/Gemeinde, Nordrhein-Westfalen, 306 km, 51.45560, 7.01160": kind, Land, distance, coordinate. */
function line(p: T.PlaceItem, language: Language, near: boolean): string {
  const code = p.districtCode ?? null;
  const land = code !== null && /^\d{2,12}$/u.test(code) && !(p.kind === "region" && code.length === 2) ? LAENDER[code.slice(0, 2)]?.[language] ?? null : null;
  const parts = [
    KIND_WORD[p.kind]?.[language] ?? p.kind,
    land,
    kreisWord(p, language),
    near && p.distanceM !== undefined ? `${(p.distanceM / 1000).toFixed(0)} km` : null,
    `${p.location.lat.toFixed(5)}, ${p.location.lon.toFixed(5)}`,
  ];
  return `${p.name} — ${parts.filter((x): x is string => x !== null).join(", ")}`;
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
  const r = await ctx.api.get<T.PlaceItem[]>("listPlaces", { q: str(args["query"]), kind: kindArg === undefined ? undefined : PLACE_KIND[kindArg], at, radius_m: radiusM(args["radius_km"]), limit: num(args["limit"]) });
  if (r.data.length === 0) {
    // Today's server tells "this name is not in the index" from "no index is loaded" (placeGazetteerLoaded).
    const cov = await ctx.api.get<T.PlacesCoverageData>("getPlacesCoverage", {});
    return toolResult(cov.data.kinds.length === 0 ? c.empty : c.none(query), [r.meta], language, { structured: { found: 0, query } });
  }
  const n = r.data.length;
  const head = r.meta.page?.hasMore === true ? c.more(query, n, MAX_RESULTS) : n === 1 ? c.one(query) : c.head(query, n);
  return toolResult([head, ...r.data.map((p, i) => `${i + 1}. ${line(p, language, at !== undefined)}`)].join("\n"), [r.meta], language);
};
