/**
 * describe_station's answer, in today's server's words and sections (main tools/describe_station.ts): the station
 * and its facts, the lifts and escalators (out of service first), the next departures, and where to look for parking
 * and charging, each section after a blank line and with its own "Stand".
 *
 * Not in the contract, so not said (scratchpad api-gap.md, lane A): the station page's address (its slug), the
 * street address and DB's station category, the rail Ampel, step-free access and platforms, the service alerts,
 * and DB's own parking facts ("laut DB: Parkplatz, Taxistand").
 */
import type { DataMeta } from "../api/client.js";
import type * as T from "../api/types.js";
import { berlinTime, standTime, type Language } from "../presentation.js";

const W = {
  de: {
    lifts: "Aufzüge und Fahrtreppen", kind: { elevator: "Aufzug", escalator: "Fahrtreppe", travelator: "Fahrsteig", other: "Anlage" } as Record<string, string>,
    track: "Gleis", noLocation: "keine Ortsangabe", state: { inactive: "außer Betrieb", active: "in Betrieb", unknown: "Zustand unbekannt" } as Record<string, string>,
    departures: "Abfahrten", cancelled: "fällt aus", onTime: "pünktlich", plan: "nach Fahrplan", instead: "statt",
    parking: "Parken und Laden",
    nearby: (lat: string, lon: string) => `Parkhäuser und Ladesäulen in der Nähe: find_parking bzw. find_charging_station mit lat ${lat}, lon ${lon}.`,
    stand: (t: string) => `Stand ${t}`, more: (n: number) => `… und ${n} weitere`,
  },
  en: {
    lifts: "Lifts and escalators", kind: { elevator: "Lift", escalator: "Escalator", travelator: "Moving walkway", other: "Unit" } as Record<string, string>,
    track: "Platform", noLocation: "no location given", state: { inactive: "out of service", active: "in service", unknown: "state unknown" } as Record<string, string>,
    departures: "Departures", cancelled: "cancelled", onTime: "on time", plan: "timetable only", instead: "instead of",
    parking: "Parking and charging",
    nearby: (lat: string, lon: string) => `Car parks and charging points nearby: find_parking or find_charging_station with lat ${lat}, lon ${lon}.`,
    stand: (t: string) => `As of ${t}`, more: (n: number) => `… and ${n} more`,
  },
} as const;

/** At most this many lifts are listed (today's LIST_SHOWN). */
const LIST_SHOWN = 20;

/** The Land by the first two digits of the official district code (main AGS_LAENDER). */
const LAENDER: Readonly<Record<string, readonly [string, string]>> = {
  "01": ["Schleswig-Holstein", "Schleswig-Holstein"], "02": ["Hamburg", "Hamburg"], "03": ["Niedersachsen", "Lower Saxony"], "04": ["Bremen", "Bremen"],
  "05": ["Nordrhein-Westfalen", "North Rhine-Westphalia"], "06": ["Hessen", "Hesse"], "07": ["Rheinland-Pfalz", "Rhineland-Palatinate"],
  "08": ["Baden-Württemberg", "Baden-Württemberg"], "09": ["Bayern", "Bavaria"], "10": ["Saarland", "Saarland"], "11": ["Berlin", "Berlin"],
  "12": ["Brandenburg", "Brandenburg"], "13": ["Mecklenburg-Vorpommern", "Mecklenburg-Western Pomerania"], "14": ["Sachsen", "Saxony"],
  "15": ["Sachsen-Anhalt", "Saxony-Anhalt"], "16": ["Thüringen", "Thuringia"],
};

/** The tracks a unit's description names ("zu Gleis 4/5" → ["4", "5"], "Gleis 1-3" → ["1", "2", "3"]; main unitTracksOf). */
export function unitTracksOf(description: string | null): string[] {
  const m = description === null ? null : /\bGleis(?:e|en)?\s+(\d{1,3}[a-z]?(?:\s*(?:\/|-|,|und|u\.)\s*\d{1,3}[a-z]?)*)/iu.exec(description);
  if (m === null || m === undefined) return [];
  const out: string[] = [];
  for (const part of m[1]!.replace(/\s*(?:und|u\.)\s*/giu, "/").replace(/\s+/gu, "").split(/[/,]/u)) {
    const range = /^(\d{1,3})-(\d{1,3})$/u.exec(part);
    if (range !== null) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (b >= a && b - a <= 12) for (let t = a; t <= b; t++) out.push(String(t));
      continue;
    }
    if (/^\d{1,3}[a-z]?$/iu.test(part)) out.push(part.toLowerCase());
  }
  return [...new Set(out)];
}

type Unit = T.StationFacilitiesData["facilities"][number] & { tracks: string[] };
const KINDS = ["elevator", "escalator", "travelator", "other"];
const rank = (u: Unit): number => (u.state === "inactive" ? 0 : u.state === "active" ? 2 : 1);
const firstTrack = (u: Unit): number => (u.tracks.length === 0 ? Number.POSITIVE_INFINITY : Number.parseInt(u.tracks[0]!, 10));
const kindIndex = (k: string): number => (KINDS.includes(k) ? KINDS.indexOf(k) : KINDS.length - 1);
/** Out of service first, then by kind, first track and name (main liftOrder). */
const liftOrder = (a: Unit, b: Unit): number => rank(a) - rank(b) || kindIndex(a.kind) - kindIndex(b.kind) || firstTrack(a) - firstTrack(b)
  || (a.position ?? "").localeCompare(b.position ?? "", "de", { numeric: true }) || a.id.localeCompare(b.id);

/** A German answer names the unit by DB's words; an English one by its kind and tracks. */
function liftLabel(u: Unit, language: Language): string {
  const w = W[language];
  const kind = w.kind[u.kind] ?? w.kind["other"]!;
  if (language === "de" && u.position !== null && u.position !== "") return `${kind} ${u.position}`;
  if (u.tracks.length > 0) return `${kind} (${w.track} ${u.tracks.join("/")})`;
  return `${kind} (${w.noLocation})`;
}

function departureLine(d: T.Departure, language: Language): string {
  const w = W[language];
  const state = d.cancelled ? w.cancelled : d.delayMin !== null && d.delayMin !== 0 ? `${d.delayMin > 0 ? "+" : ""}${d.delayMin} min` : d.delayMin === 0 ? w.onTime : w.plan;
  const moved = d.platformChanged && typeof d.plannedPlatform === "string" && d.plannedPlatform !== d.platform ? ` (${w.instead} ${d.plannedPlatform})` : "";
  const platform = d.platform === null ? "" : `, ${w.track} ${d.platform}${moved}`;
  // A row without a live figure is the timetable's ("nach Fahrplan"); the contract does not tell a live row without a forecast apart.
  return `- ${[berlinTime(d.plannedAt), d.line ?? ""].filter((x) => x !== "").join(" ")}${d.destination === null ? "" : ` → ${d.destination}`}${platform}: ${state}`;
}

const standOf = (meta: DataMeta, language: Language, now: Date): string => standTime(meta.asOf ?? meta.generatedAt, language, now);

export function stationPageText(language: Language, station: T.Station & { districtCode?: string | null },
  fac: { data: T.StationFacilitiesData; meta: DataMeta } | null, board: { data: T.Board; meta: DataMeta } | null, now: Date = new Date()): string {
  const w = W[language];
  const text: string[] = [station.name];
  const land = station.districtCode === null || station.districtCode === undefined ? undefined : LAENDER[station.districtCode.slice(0, 2)];
  const facts = [land === undefined ? null : land[language === "de" ? 0 : 1], station.eva === null ? null : `EVA ${station.eva}`].filter((x): x is string => x !== null);
  if (facts.length > 0) text.push(facts.join(" · "));
  const units = (fac?.data.facilities ?? []).map((f) => ({ ...f, tracks: unitTracksOf(f.position) })).sort(liftOrder);
  if (fac !== null && units.length > 0) {
    const shown = units.slice(0, LIST_SHOWN).map((u) => `- ${liftLabel(u, language)}: ${w.state[u.state] ?? w.state["unknown"]!}`);
    text.push("", `${w.lifts} (${w.stand(standOf(fac.meta, language, now))}):`, ...shown, ...(units.length > LIST_SHOWN ? [w.more(units.length - LIST_SHOWN)] : []));
  }
  if (board !== null && board.data.departures.length > 0) {
    text.push("", `${w.departures} (${w.stand(standOf(board.meta, language, now))}):`, ...board.data.departures.map((d) => departureLine(d, language)));
  }
  text.push("", `${w.parking}:`, `- ${w.nearby(station.location.lat.toFixed(5), station.location.lon.toFixed(5))}`);
  return text.join("\n");
}
