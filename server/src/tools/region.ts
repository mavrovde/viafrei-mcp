/**
 * A region asked in words, as today's server resolves it: a Land by its name first (LANDS), else a Kreis by its name (listPlaces, kind district), else the Kreis a
 * town lies in (listPlaces, its districtCode; the answer says which town). A point is placed in the
 * Kreis describeLocation names. Every rule is national: no name is special-cased.
 */
import type { DataMeta } from "../api/client.js";
import type * as T from "../api/types.js";
import type { Language } from "../presentation.js";
import { atParam, num, str, type Args, type ToolContext } from "./context.js";
import { haversineM } from "./location.js";

export type Region = {
  /** The official key: two digits a Land, five a Kreis; undefined when nothing was found. */
  readonly code: string | undefined;
  /** The region's own name, as the answer heads it. */
  readonly label: string | undefined;
  /** The town asked, when the region is the Kreis it lies in. */
  readonly town?: string;
  /** Whether the region came from a point rather than a name. */
  readonly fromPoint: boolean;
  /** From a point: metres from it to the region's own point (today's "Mittelpunkt … entfernt"). */
  readonly distanceM?: number;
  /** The reads whose credit the answer carries (the place search, the point's location). */
  readonly metas: DataMeta[];
};

const fold = (s: string): string => s.normalize("NFC").toLocaleLowerCase("de").replace(/\s+/gu, " ").trim();

/**
 * The 16 Länder: the official two-digit key, the German name and the English one, as today's server holds
 * them (its region map, Destatis). Fixed by the constitution, not data that ages, and the API's gazetteer
 * does not hold the Länder as places (getPlacesCoverage lists only the Länder its places carry). Built per call,
 * never held at module level, so Stryker mutates it per test rather than statically against the whole suite.
 */
export function LANDS(): readonly { readonly code: string; readonly de: string; readonly en: string }[] {
  return [
    { code: "01", de: "Schleswig-Holstein", en: "Schleswig-Holstein" }, { code: "02", de: "Hamburg", en: "Hamburg" },
    { code: "03", de: "Niedersachsen", en: "Lower Saxony" }, { code: "04", de: "Bremen", en: "Bremen" },
    { code: "05", de: "Nordrhein-Westfalen", en: "North Rhine-Westphalia" }, { code: "06", de: "Hessen", en: "Hesse" },
    { code: "07", de: "Rheinland-Pfalz", en: "Rhineland-Palatinate" }, { code: "08", de: "Baden-Württemberg", en: "Baden-Württemberg" },
    { code: "09", de: "Bayern", en: "Bavaria" }, { code: "10", de: "Saarland", en: "Saarland" }, { code: "11", de: "Berlin", en: "Berlin" },
    { code: "12", de: "Brandenburg", en: "Brandenburg" }, { code: "13", de: "Mecklenburg-Vorpommern", en: "Mecklenburg-Western Pomerania" },
    { code: "14", de: "Sachsen", en: "Saxony" }, { code: "15", de: "Sachsen-Anhalt", en: "Saxony-Anhalt" }, { code: "16", de: "Thüringen", en: "Thuringia" },
  ];
}

/** The Land a name is, in either language, named in the answer's language; undefined when it names none. */
export function landOf(name: string, language: Language): { code: string; name: string } | undefined {
  const land = LANDS().find((l) => fold(l.de) === fold(name) || fold(l.en) === fold(name));
  return land === undefined ? undefined : { code: land.code, name: land[language] };
}

export async function regionOf(args: Args, ctx: ToolContext): Promise<Region> {
  const region = str(args["region"]);
  if (region !== undefined && /^[0-9]{2,12}$/u.test(region)) return { code: region, label: region, fromPoint: false, metas: [] };
  if (region !== undefined) {
    const land = landOf(region, ctx.language);
    if (land !== undefined) return { code: land.code, label: land.name, fromPoint: false, metas: [] };
    const kreis = await ctx.api.get<T.PlaceItem[]>("listPlaces", { q: region, kind: "district", limit: 1 });
    const k = kreis.data[0];
    if (k !== undefined && k.districtCode !== null && fold(k.name) === fold(region)) return { code: k.districtCode, label: k.name, fromPoint: false, metas: [kreis.meta] };
    const r = await ctx.api.get<T.PlaceItem[]>("listPlaces", { q: region, limit: 1 });
    const first = r.data[0];
    const code = first?.districtCode ?? undefined;
    if (first === undefined || code === undefined) return { code: undefined, label: undefined, fromPoint: false, metas: [r.meta] };
    // The town's Kreis by its own name, when the gazetteer holds it; the town's name otherwise.
    const named = await ctx.api.get<T.PlaceItem[]>("listPlaces", { q: first.name, kind: "district", limit: 5 });
    const own = named.data.find((p) => p.districtCode === code.slice(0, 5));
    return { code, label: own?.name ?? first.name, town: first.name, fromPoint: false, metas: [r.meta] };
  }
  const lat = num(args["lat"]);
  const lon = num(args["lon"]);
  if (lat === undefined || lon === undefined) return { code: undefined, label: undefined, fromPoint: false, metas: [] };
  const r = await ctx.api.get<T.LocationData>("describeLocation", { at: atParam({ lat, lon }) });
  const named = r.data.district ?? r.data.state;
  return {
    code: named?.code ?? undefined, label: named?.name ?? undefined, fromPoint: true, metas: [r.meta],
    ...(named === null ? {} : { distanceM: Math.round(haversineM(lat, lon, named.location.lat, named.location.lon)) }),
  };
}
