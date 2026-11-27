/**
 * find_place, in today's server's words (main packages/mcp/src/tools/find_place.ts, COPY; geo/distinguish.ts):
 * a head line, '"Essen" — 2 Treffer:', then one numbered line per place, "Essen — Stadt/Gemeinde,
 * Nordrhein-Westfalen, 51.45560, 7.01160". No match: '"Fulda" finde ich nicht im Ortsverzeichnis.', or,
 * when the places coverage lists no kind at all, that no place index is loaded.
 *
 * The Kreis is the API's own text (kreis), the English name beside the name in English (nameEn). What the contract
 * does not carry is not said: a place's population, the merge of one place's rows from several publishers.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DataMeta } from "../api/client.js";
import type * as T from "../api/types.js";
import { asOfDayLabel, toolResult, type Language } from "../presentation.js";
import { atParam, isResult, num, position, radiusM, str, type Handler } from "./context.js";
import { haversineM } from "./location.js";

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

/** Two rows of one name and kind this close are one place held twice (a GeoNames point beside the BKG Gemeinde). */
export const SAME_PLACE_M = 2_000;

function foldName(x: string): string {
  return x.normalize("NFC").toLocaleLowerCase("de").trim();
}

/** The names a row answers to: its own, its English one, and its own before a comma ("München, Landeshauptstadt"). */
function namesOf(p: T.PlaceItem): string[] {
  return [p.name, p.name.split(",")[0] ?? p.name, p.nameEn ?? ""].map(foldName).filter((n) => n !== "");
}

/** How much a row says of where it lies: its Land key and its Kreis. */
function adminContext(p: T.PlaceItem): number {
  return (p.districtCode == null ? 0 : 1) + (p.kreis === undefined || p.kreis.trim() === "" ? 0 : 1);
}

/**
 * The rows of a place search with a place held twice said once (round Q64 "Munich" twice, Q65 one Halle twice):
 * the same kind, a shared name, within SAME_PLACE_M. The first row's slot is kept, with the row that says more of
 * where it lies (its Land and Kreis), so the two Halle are told apart where either row can tell them.
 */
export function onePerPlace(rows: readonly T.PlaceItem[]): T.PlaceItem[] {
  const out: T.PlaceItem[] = [];
  for (const p of rows) {
    const names = namesOf(p);
    const i = out.findIndex((o) => o.kind === p.kind && namesOf(o).some((n) => names.includes(n))
      && haversineM(o.location.lat, o.location.lon, p.location.lat, p.location.lon) < SAME_PLACE_M);
    if (i < 0) out.push(p);
    else if (adminContext(p) > adminContext(out[i]!)) out[i] = { ...p, ...(out[i]!.distanceM === undefined ? {} : { distanceM: out[i]!.distanceM }) };
  }
  return out;
}

/** The answer's lines for an ambiguous name: at most this many candidates. */
export const NAMESAKES_SHOWN = 5;

/**
 * The towns (municipality, locality) of exactly the asked name, a place held twice said once (onePerPlace). Two or more: the name names no
 * one place, and the question must say which.
 */
export function namesakes(q: string, rows: readonly T.PlaceItem[]): T.PlaceItem[] {
  const asked = foldName(q);
  return onePerPlace(rows.filter((p) => (p.kind === "municipality" || p.kind === "locality") && namesOf(p).includes(asked)));
}

/**
 * The candidates answer for a name several towns share (round Q50 "Neustadt": the API's resolver names no one
 * place, and the tool took the search's first, a Hamburg district, without asking). The towns are listed with
 * Land, Kreis and coordinate, credited by the place search, and the assistant is told how to ask again.
 */
export function namesakeAnswer(q: string, towns: readonly T.PlaceItem[], meta: DataMeta, language: Language): CallToolResult {
  const shown = towns.slice(0, NAMESAKES_SHOWN);
  const head = language === "de"
    ? `„${q}“ heißen ${towns.length} Orte, ich rate nicht. Welcher ist gemeint? Bitte erneut fragen, mit dem Ort und seinem Kreis oder Land (z. B. „${q}, ${landOf(shown[0]!, language) ?? "Kreis"}“) oder mit lat und lon des gemeinten Orts:`
    : `${towns.length} places are called "${q}", so I do not guess. Which one is meant? Please ask again with the place and its Kreis or Land (for example "${q}, ${landOf(shown[0]!, language) ?? "district"}") or with the lat and lon of the one meant:`;
  const more = towns.length > shown.length ? [language === "de" ? `… und ${towns.length - shown.length} weitere (find_place listet sie).` : `… and ${towns.length - shown.length} more (find_place lists them).`] : [];
  return toolResult([head, ...shown.map((p, i) => `${i + 1}. ${line(p, language, false)}`), ...more].join("\n"), [meta], language, {
    asOf: null,
    structured: { ambiguous: true, query: q, candidates: shown.map((p) => ({ name: p.name, kind: p.kind, districtCode: p.districtCode ?? null, kreis: p.kreis ?? null, lat: p.location.lat, lon: p.location.lon })) },
  });
}

/** A row's Land, from the first two digits of its official key; null where the row has none. */
function landOf(p: T.PlaceItem, language: Language): string | null {
  const code = p.districtCode ?? null;
  return code !== null && /^\d{2,12}$/u.test(code) && !(p.kind === "region" && code.length === 2) ? LAENDER()[code.slice(0, 2)]?.[language] ?? null : null;
}

/** "Essen — Stadt/Gemeinde, Nordrhein-Westfalen, 306 km, 51.45560, 7.01160": kind, Land, distance, coordinate. */
function line(p: T.PlaceItem, language: Language, near: boolean): string {
  const land = landOf(p, language);
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
  // A place held twice is said once; with near, nearest first (round Q61 listed 1, 234, 49, 96, 105 km).
  const once = onePerPlace(r.data);
  const rows = at === undefined ? once : once.map((p, i) => ({ p, i })).sort((a, b) => (a.p.distanceM ?? Infinity) - (b.p.distanceM ?? Infinity) || a.i - b.i).map((x) => x.p);
  const n = rows.length;
  const head = r.meta.page?.hasMore === true ? c.more(query, n, MAX_RESULTS) : n === 1 ? c.one(query) : c.head(query, n);
  // The place index is reference data: its day, never the clock time of its load or of this read; no day known,
  // none said or sent (no _meta.asOf, asOfLocal or structured asOf, rather than the time of this read).
  const asOf = typeof r.meta.asOf === "string" ? r.meta.asOf : undefined;
  return toolResult([head, ...rows.map((p, i) => `${i + 1}. ${line(p, language, at !== undefined)}`)].join("\n"), [r.meta], language, asOf === undefined ? { asOf: null } : { asOfLabel: asOfDayLabel(asOf, language) });
};
