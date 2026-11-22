/**
 * A region asked in words, as today's server resolves it: a Land by its name first (the gazetteer's
 * Länder, getPlacesCoverage), else a Kreis by its name (listPlaces, kind district), else the Kreis a
 * town lies in (listPlaces, its districtCode; the answer says which town). A point is placed in the
 * Kreis describeLocation names. Every rule is national: no name is special-cased.
 */
import type { DataMeta } from "../api/client.js";
import type * as T from "../api/types.js";
import { atParam, num, str, type Args, type ToolContext } from "./context.js";

export type Region = {
  /** The official key: two digits a Land, five a Kreis; undefined when nothing was found. */
  readonly code: string | undefined;
  /** The region's own name, as the answer heads it. */
  readonly label: string | undefined;
  /** The town asked, when the region is the Kreis it lies in. */
  readonly town?: string;
  /** Whether the region came from a point rather than a name. */
  readonly fromPoint: boolean;
  /** The reads whose credit the answer carries (the place search, the point's location). */
  readonly metas: DataMeta[];
};

const fold = (s: string): string => s.normalize("NFC").toLocaleLowerCase("de").replace(/\s+/gu, " ").trim();

/** The Land a name is, by the gazetteer's Länder (getPlacesCoverage); undefined when it names none. */
export async function landOf(name: string, ctx: ToolContext): Promise<{ code: string; name: string } | undefined> {
  const cov = await ctx.api.get<T.PlacesCoverageData>("getPlacesCoverage", {});
  return cov.data.lands.find((l) => fold(l.name) === fold(name));
}

export async function regionOf(args: Args, ctx: ToolContext): Promise<Region> {
  const region = str(args["region"]);
  if (region !== undefined && /^[0-9]{2,12}$/u.test(region)) return { code: region, label: region, fromPoint: false, metas: [] };
  if (region !== undefined) {
    const land = await landOf(region, ctx);
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
  return { code: named?.code ?? undefined, label: named?.name ?? undefined, fromPoint: true, metas: [r.meta] };
}
