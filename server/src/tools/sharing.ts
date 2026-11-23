/**
 * find_sharing: the bike-sharing stations and free-floating bikes around a position, in today's server's
 * words (packages/mcp find_sharing.ts, COPY, verbatim). The station rules (current, available) are the API's.
 * One sentence is not given: today's "no station within 100 km either" needs a read past the API's 5 km
 * radius; within 5 km the nearest station is named as today names it.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Attribution } from "../api/client.js";
import type * as T from "../api/types.js";
import { standTime, toolResult, type Language } from "../presentation.js";
import { atParam, bool, isResult, num, position, type Handler } from "./context.js";
import { kmText } from "./nearby.js";

/** Today's default radius and its ceiling, in kilometres (find_sharing.schema.ts). */
export const DEFAULT_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 5;

const kmWord = (km: number, language: Language): string => (language === "de" ? String(km).replace(".", ",") : String(km));
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/** Verbatim from today's server (find_sharing.ts COPY). */
export const SHARING_WORDS = {
  de: {
    head: (where: string, km: number) => `Leihräder nahe ${where} (Umkreis ${kmWord(km, "de")} km):`,
    none: (where: string, km: number) => `Keine Leihräder im Umkreis von ${kmWord(km, "de")} km um ${where} gefunden — weder an einer Station noch frei abgestellt. Radius bis ${MAX_RADIUS_KM} km möglich. Abgedeckt sind nextbike und Donkey Republic; E-Scooter und Anbieter ohne offene Lizenz nicht.`,
    nearest: (km: string, name: string) => `Die nächste Leihrad-Station in unseren Daten ist ${km} entfernt: ${name}.`,
    noneAvailable: (n: number) => `${n} ${plural(n, "Station", "Stationen")} im Umkreis, aber ${plural(n, "ohne ausleihbares Rad", "keine mit einem ausleihbaren Rad")} laut aktueller Zählung; ohne die Einschränkung auf ausleihbare Räder gefragt, nenne ich ${plural(n, "sie", "sie alle")}.`,
    bikes: (n: number, e: number | null) => `${n} ${plural(n, "Rad", "Räder")} frei${e !== null && e > 0 ? `, davon ${e} E-${plural(e, "Rad", "Räder")}` : ""}`,
    docks: (n: number) => `${n} freie Plätze`,
    stale: (n: number, at: string) => `zuletzt ${n} ${plural(n, "Rad", "Räder")} gemeldet (Stand ${at})`,
    noCount: "keine aktuelle Zählung",
    notRenting: "verleiht gerade nicht",
    docksVirtual: (n: number, of: number) => `Freie Plätze: ${n === of ? "keine Angabe" : `für ${n} von ${of} Stationen keine Angabe`} — ${plural(n, "das ist eine virtuelle Station", "das sind virtuelle Stationen")} ohne Docks (eine Abstellzone), dort gibt es keine Dock-Zählung.`,
    docksUnpublished: (n: number) => `Freie Plätze: für ${n} ${plural(n, "Station", "Stationen")} meldet der Betreiber keine Zahl.`,
    floating: (n: number, more: boolean, nearest: string, e: number) => `Ohne Station: ${more ? "mindestens " : ""}${n} frei abgestellte${plural(n, "s Rad", " Räder")} im Umkreis, das nächste ${nearest} entfernt${e > 0 ? ` (davon ${e} E-${plural(e, "Rad", "Räder")})` : ""}.`,
  },
  en: {
    head: (where: string, km: number) => `Shared bikes near ${where} (within ${km} km):`,
    none: (where: string, km: number) => `No shared bikes found within ${km} km of ${where} — neither at a station nor free-floating. Radius up to ${MAX_RADIUS_KM} km possible. Covered are nextbike and Donkey Republic; e-scooters and operators without an open licence are not.`,
    nearest: (km: string, name: string) => `The nearest shared-bike station in our data is ${km} away: ${name}.`,
    noneAvailable: (n: number) => `${n} ${plural(n, "station", "stations")} within the radius, but ${plural(n, "it has no", "none with a")} bike to rent by the current count; asked without the available-only filter, I list ${plural(n, "it", "them")}.`,
    bikes: (n: number, e: number | null) => `${n} ${plural(n, "bike", "bikes")} available${e !== null && e > 0 ? `, ${e} of them e-bikes` : ""}`,
    docks: (n: number) => `${n} free docks`,
    stale: (n: number, at: string) => `last reported ${n} ${plural(n, "bike", "bikes")} (as of ${at})`,
    noCount: "no current count",
    notRenting: "not renting right now",
    docksVirtual: (n: number, of: number) => `Free docks: ${n === of ? "no count" : `no count for ${n} of ${of} stations`} — ${plural(n, "it is a virtual station", "they are virtual stations")} without docks (a parking zone), so there is no dock count to give.`,
    docksUnpublished: (n: number) => `Free docks: the operator publishes no count for ${n} ${plural(n, "station", "stations")}.`,
    floating: (n: number, more: boolean, nearest: string, e: number) => `Free-floating: ${more ? "at least " : ""}${n} ${plural(n, "bike", "bikes")} parked within the radius, the nearest ${nearest} away${e > 0 ? ` (${e} of them e-bikes)` : ""}.`,
  },
} as const;

const label = (s: T.SharingStation): string => `${s.name ?? s.id}${s.systemLabel === null ? "" : ` (${s.systemLabel})`}`;

function stationLine(s: T.SharingStation, language: Language): string {
  const c = SHARING_WORDS[language];
  const parts: string[] = [];
  if (s.bikes === null) parts.push(c.noCount);
  else if (!s.current) parts.push(c.stale(s.bikes, standTime(s.countedAt ?? s.reportedAt ?? new Date().toISOString(), language)));
  else {
    parts.push(s.renting === false ? c.notRenting : c.bikes(s.bikes, s.electricBikes));
    if (s.freeDocks !== null && s.virtual !== true) parts.push(c.docks(s.freeDocks));
  }
  parts.push(kmText(s.distanceM, language));
  return `- ${label(s)} — ${parts.join(" · ")}`;
}

export const findSharing: Handler = async (args, ctx): Promise<CallToolResult> => {
  const { language } = ctx;
  const c = SHARING_WORDS[language];
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const radiusKm = num(args["radius_km"]) ?? DEFAULT_RADIUS_KM;
  const only = bool(args["only_available"]);
  const where = pos.label ?? `${pos.at.lat.toFixed(3)}, ${pos.at.lon.toFixed(3)}`;
  const r = await ctx.api.get<T.SharingData>("listSharingOptions", {
    at: atParam(pos.at), radius_m: args["radius_km"] === undefined ? undefined : Math.round(radiusKm * 1000), limit: num(args["limit"]),
    only_available: only === undefined ? undefined : String(only),
  });
  const { stations, vehicles, stationsInRadius } = r.data;
  // Nothing listed is nothing credited (today's server): only the place search, and the nearest station's publisher.
  const metas = stations.length === 0 && vehicles.count === 0 ? [] : [r.meta];
  const counted = stations.filter((s) => s.current && s.renting !== false);
  const docksVirtual = counted.filter((s) => s.virtual === true).length;
  const docksUnpublished = counted.filter((s) => s.virtual !== true && s.freeDocks === null).length;
  const availableOnly = only !== false;
  const text: string[] = [];
  if (stations.length === 0 && vehicles.count === 0) {
    text.push(c.none(where, radiusKm));
    if (availableOnly && stationsInRadius > 0) text.push(c.noneAvailable(stationsInRadius));
    if (stationsInRadius === 0 && radiusKm < MAX_RADIUS_KM) {
      // The nearest station past the radius, as far as the API reads (5 km): the nearest there is the nearest.
      const wide = await ctx.api.get<T.SharingData>("listSharingOptions", { at: atParam(pos.at), radius_m: MAX_RADIUS_KM * 1000, limit: 1, only_available: "false" });
      const nearest = wide.data.stations[0];
      if (nearest !== undefined) {
        text.push(c.nearest(kmText(nearest.distanceM, language), label(nearest)));
        metas.push({ ...wide.meta, attribution: (wide.meta.attribution ?? []).filter((a: Attribution) => a.family === nearest.sourceFamily) });
      }
    }
  } else {
    text.push(c.head(where, radiusKm), ...stations.map((s) => stationLine(s, language)));
    if (docksVirtual > 0) text.push(c.docksVirtual(docksVirtual, counted.length));
    if (docksUnpublished > 0) text.push(c.docksUnpublished(docksUnpublished));
    if (stations.length === 0 && stationsInRadius > 0 && availableOnly) text.push(c.noneAvailable(stationsInRadius));
    if (vehicles.count > 0) text.push(c.floating(vehicles.count, vehicles.atLeast, kmText(vehicles.nearest[0]?.distanceM ?? 0, language), vehicles.electric));
  }
  const credit = (family: string): string | null => r.meta.attribution?.find((a: Attribution) => a.family === family)?.text ?? null;
  return toolResult(text.join("\n"), metas, language, {
    ...(metas.length === 0 ? { asOf: r.meta.generatedAt } : {}),
    structured: {
      place: where,
      radiusKm,
      stations: stations.map((s) => ({
        name: s.name, system: s.systemLabel, distanceM: s.distanceM, lat: s.location.lat, lon: s.location.lon,
        vehiclesAvailable: s.bikes, electricAvailable: s.electricBikes, docksAvailable: s.virtual === true ? null : s.freeDocks,
        isVirtual: s.virtual === true, isRenting: s.renting, countedAt: s.countedAt === null ? null : new Date(s.countedAt).toISOString(),
        stale: s.bikes === null ? null : !s.current, attribution: credit(s.sourceFamily),
      })),
      freeFloating: {
        count: vehicles.count, atLeast: vehicles.atLeast, electric: vehicles.electric,
        nearest: vehicles.nearest.map((v) => ({ distanceM: v.distanceM, formFactor: v.vehicleType, propulsion: v.propulsion, rangeM: v.rangeLeftM, attribution: credit(v.sourceFamily) })),
      },
    },
  });
};
