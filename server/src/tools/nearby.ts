/**
 * find_nearby, in today's server's words (tools/find_nearby.ts): "In der Nähe von <place> (Umkreis N km):",
 * then one line per category asked, in the fixed order, its places "name (0,2 km)" joined by "; ", or what
 * the category holds when it holds nothing. The rows, their order and their limits are the API's.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type * as T from "../api/types.js";
import { toolResult, type Language } from "../presentation.js";
import { atParam, isResult, num, position, strs, type Handler } from "./context.js";

export const DEFAULT_RADIUS_KM = 5;
const HOUR_MS = 60 * 60 * 1000;

const VEHICLE_ORDER = ["fuel", "charging", "parking", "station", "junction"] as const;

const LABEL: Record<string, Record<Language, string>> = {
  fuel: { de: "Tankstellen", en: "fuel stations" },
  charging: { de: "Ladepunkte", en: "charging" },
  parking: { de: "Parkplätze", en: "parking" },
  station: { de: "Bahnhöfe", en: "stations" },
  junction: { de: "Autobahnanschlüsse", en: "motorway junctions" },
  groceries: { de: "Lebensmittel", en: "groceries" },
  health: { de: "Gesundheit", en: "health" },
  money: { de: "Geld & Post", en: "cash & post" },
  food: { de: "Essen", en: "food" },
  lodging: { de: "Unterkunft", en: "lodging" },
  garage: { de: "Auto-Service", en: "car service" },
  police: { de: "Polizei", en: "police" },
  toilets: { de: "Öffentliche Toiletten", en: "public toilets" },
};

const COPY = {
  de: {
    head: (around: string, km: number) => `In der Nähe von ${around} (Umkreis ${km} km):`,
    none: "nichts im Umkreis", noPrice: "keine Preise im Umkreis",
    otherJunctions: "Weitere Anschlussstellen (keiner Autobahn zugeordnet, z. B. autobahnähnliche Bundesstraßen)",
    needNone: (d: string) => `nichts im Umkreis von ${d} in den OpenStreetMap-Daten`,
    needRadius: (d: string, wide: boolean) => (wide ? `wenige in der Nähe, Umkreis ${d}` : `Umkreis ${d}`),
    priceFrom: (t: string, current: boolean) => (current ? `, Preis von ${t}` : `, nicht aktuell: Preis von ${t}`),
  },
  en: {
    head: (around: string, km: number) => `Near ${around} (within ${km} km):`,
    none: "nothing nearby", noPrice: "no prices nearby",
    otherJunctions: "Other junctions (not on a motorway we can name, e.g. dual-carriageway federal roads)",
    needNone: (d: string) => `nothing within ${d} in the OpenStreetMap data`,
    needRadius: (d: string, wide: boolean) => (wide ? `few nearby, within ${d}` : `within ${d}`),
    priceFrom: (t: string, current: boolean) => (current ? `, price from ${t}` : `, not current: price from ${t}`),
  },
} as const;

/** "0,2 km", "35 m" under 50 m: metres are what a driver says that close. */
export function kmText(m: number, language: Language): string {
  if (m < 50) return `${Math.max(0, Math.round(m))} m`;
  const s = (Math.round(m / 100) / 10).toFixed(1);
  return `${language === "de" ? s.replace(".", ",") : s} km`;
}

const priceText = (eur: number, language: Language): string => `${language === "de" ? eur.toFixed(3).replace(".", ",") : eur.toFixed(3)} €/l`;

/** "08:05" today, "18.09. 08:05" (en "2026-09-18 08:05") another day, Berlin time. */
function clock(iso: string, language: Language, now: Date): string {
  const day = (d: Date): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  const dd = day(d);
  if (dd === day(now)) return time;
  return language === "de" ? `${dd.slice(8, 10)}.${dd.slice(5, 7)}. ${time}` : `${dd} ${time}`;
}

/** A junction on a motorway: its road is an "A" number. */
const onMotorway = (j: T.NearbyJunction): boolean => j.road !== null && /^A\s?\d/u.test(j.road);
const junctionName = (j: T.NearbyJunction): string => (j.road === null || j.name.includes(j.road) ? j.name : `${j.name} (${j.road})`);

export const findNearby: Handler = async (args, ctx): Promise<CallToolResult> => {
  const { language } = ctx;
  const c = COPY[language];
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const radiusKm = num(args["radius_km"]) ?? DEFAULT_RADIUS_KM;
  const asked = strs(args["categories"]);
  const r = await ctx.api.get<T.NearbyData>("listNearby", { at: atParam(pos.at), radius_m: num(args["radius_km"]) === undefined ? undefined : Math.round(radiusKm * 1000), categories: asked });
  const d = r.data;
  const now = new Date();
  const wanted = asked ?? [...VEHICLE_ORDER];
  const needs = new Map((d.needs ?? []).map((n) => [n.need, n]));
  const order = [...VEHICLE_ORDER.filter((x) => wanted.includes(x)), ...wanted.filter((x) => !(VEHICLE_ORDER as readonly string[]).includes(x))];
  const around = pos.label ?? `${pos.at.lat.toFixed(3)}, ${pos.at.lon.toFixed(3)}`;
  const lines: string[] = [c.head(around, radiusKm)];
  const list = <X>(rows: readonly X[], one: (x: X) => string): string => rows.map(one).join("; ");
  const parts = (r.meta["parts"] as readonly T.NearbyPartStatus[] | undefined) ?? [];
  const failed = new Set(parts.filter((p) => p.status !== "ok" && p.status !== "not_requested").map((p) => p.part));
  for (const cat of order) {
    // A category that did not answer is never "nothing nearby": it is said below, by its status.
    if (failed.has(((VEHICLE_ORDER as readonly string[]).includes(cat) ? cat : "needs") as T.NearbyPart)) continue;
    const label = LABEL[cat]?.[language] ?? cat;
    if (cat === "fuel") {
      const rows = d.fuel ?? [];
      if (rows.length === 0) { lines.push(`- ${label}: ${c.noPrice}`); continue; }
      lines.push(`- ${label}, Super E5: ${list(rows, (s) => {
        const p = s.prices[0];
        const age = p === undefined || now.getTime() - new Date(p.reportedAt).getTime() <= HOUR_MS ? "" : c.priceFrom(clock(p.reportedAt, language, now), p.current);
        return `${s.brand?.trim() || s.name?.trim() || "Tankstelle"}${p === undefined ? "" : `, ${priceText(p.priceEur, language)}`} (${kmText(s.distanceM, language)}${age})`;
      })}`);
    } else if (cat === "charging") {
      const rows = d.charging ?? [];
      lines.push(`- ${label}: ${rows.length === 0 ? c.none : list(rows, (s) => `${s.name ?? s.operator ?? "Ladestation"} (${kmText(s.distanceM ?? 0, language)})`)}`);
    } else if (cat === "parking") {
      const rows = d.parking ?? [];
      lines.push(`- ${label}: ${rows.length === 0 ? c.none : list(rows, (s) => `${s.name?.trim() || (language === "de" ? "Parkplatz" : "parking")} (${kmText(s.distanceM ?? 0, language)})`)}`);
    } else if (cat === "station") {
      const rows = d.stations ?? [];
      lines.push(`- ${label}: ${rows.length === 0 ? c.none : list(rows, (s) => `${s.name} (${kmText(s.distanceM ?? 0, language)})`)}`);
    } else if (cat === "junction") {
      const rows = d.junctions ?? [];
      const motorway = rows.filter(onMotorway);
      const other = rows.filter((j) => !onMotorway(j));
      lines.push(`- ${label}: ${motorway.length === 0 ? c.none : list(motorway, (j) => `${junctionName(j)} (${kmText(j.distanceM, language)})`)}`);
      if (other.length > 0) lines.push(`- ${c.otherJunctions}: ${list(other, (j) => `${junctionName(j)} (${kmText(j.distanceM, language)})`)}`);
    } else {
      const n = needs.get(cat);
      if (n === undefined) continue;
      if (n.places.length === 0) { lines.push(`- ${label}: ${c.needNone(kmText(n.radiusM, language))}`); continue; }
      lines.push(`- ${label} (${c.needRadius(kmText(n.radiusM, language), n.widened)}): ${list(n.places, (p) => `${p.name} (${kmText(p.distanceM, language)})`)}`);
    }
  }
  // A category that did not answer is said, never dropped (meta.parts).
  const why: Record<string, Record<Language, string>> = {
    timeout: { de: "hat nicht rechtzeitig geantwortet – bitte gleich noch einmal fragen.", en: "did not answer in time – please ask again shortly." },
    unavailable: { de: "gerade nicht verfügbar.", en: "not available right now." },
    not_permitted: { de: "mit diesem Zugang nicht freigegeben.", en: "not included in this access." },
  };
  const PART_LABEL: Record<string, Record<Language, string>> = { ...LABEL, needs: { de: "Orte des Alltags", en: "everyday places" } };
  for (const p of parts) {
    const w = why[p.status];
    if (w !== undefined) lines.push(`- ${PART_LABEL[p.part]?.[language] ?? p.part}: ${w[language]}`);
  }
  const km1 = (m: number | null | undefined): number => Math.round((m ?? 0) / 100) / 10;
  return toolResult(lines.join("\n"), [r.meta], language, {
    asOf: r.meta.generatedAt,
    structured: {
      place: around,
      radiusKm,
      categories: wanted,
      fuel: (d.fuel ?? []).map((s) => ({ name: s.brand?.trim() || s.name?.trim() || "Tankstelle", distanceKm: km1(s.distanceM), price: s.prices[0]?.priceEur ?? null, fuel: "e5", observedAt: s.prices[0]?.reportedAt ?? null, priceOlderThan24h: s.prices[0]?.current === false })),
      charging: (d.charging ?? []).map((s) => ({ name: s.name ?? s.operator ?? "Ladestation", distanceKm: km1(s.distanceM) })),
      parking: (d.parking ?? []).map((s) => ({ name: s.name?.trim() || (language === "de" ? "Parkplatz" : "parking"), kind: s.kind, distanceKm: km1(s.distanceM) })),
      station: (d.stations ?? []).map((s) => ({ name: s.name, lat: s.location.lat, lon: s.location.lon })),
      junction: (d.junctions ?? []).map((j) => ({ name: j.name, road: j.road, onMotorway: onMotorway(j), lat: j.location.lat, lon: j.location.lon })),
    },
  });
};
