/**
 * find_parking's list in today's server's words (main packages/mcp/src/tools/find_parking.ts `facilityHead`,
 * `capacityText`, `occupancyText`, `NOT_FULL_NOTE`; presentation/parking-status.ts): a numbered line per site with
 * its kind, its distance, its spaces, the free count, the occupied share and the operator's status word, dated by
 * the report's time (its day too when it is not today's Berlin day). A reading older than three of the cadences
 * meant to replace it is stale and said as a past statement with its age ("last reported 12 free", "as of 21:56,
 * 42 min ago"); the API carries no feed, so the cadence is today's for an unknown feed (reading.ts
 * UNKNOWN_CADENCE_S), and a feed's own cadence is the API lane's. What the API does not carry (the publisher's own
 * percentage, the stated facilities, the OpenStreetMap neighbours) is left out, never invented.
 */
import type * as T from "../api/types.js";
import { standTime, type Language } from "../presentation.js";
import { kmText } from "./nearby.js";

/** The API's kinds as today's terms (presentation/language.ts TERMS): the English term carries the German sign word. */
const KIND_TERM: Record<string, { de: string; en: string }> = {
  garage: { de: "Parkhaus", en: "Car park" },
  park_and_ride: { de: "P+R", en: "Park and ride" },
  rest_area: { de: "Rastanlage", en: "Rest area" },
  truck_parking: { de: "Lkw-Parkplatz", en: "Lorry parking" },
  other: { de: "Parkplatz", en: "Parking area" },
};

export function parkingKindText(kind: string, language: Language): string {
  const t = KIND_TERM[kind] ?? KIND_TERM["other"]!;
  return language === "de" ? t.de : `${t.en} (${t.de})`;
}

/** The API's occupancy states as today's operator's status words (PARKING_STATUS_TEXT); unknown and other say nothing. */
const STATE_TEXT: Record<string, { de: string; en: string }> = {
  free: { de: "Plätze frei", en: "spaces available" },
  filling: { de: "fast voll", en: "almost full" },
  full: { de: "voll", en: "full" },
};

/** The occupied share from the reported counts, whole percent; null without both counts. */
export function occupiedPct(free: number | null, total: number | null): number | null {
  if (free === null || total === null || total <= 0 || free > total) return null;
  return Math.round(((total - free) / total) * 100);
}

/** Today's stale rule (domain/parking/reading.ts): three cadences, a feed of unknown cadence 600 s. */
export const STALE_CADENCES = 3;
export const UNKNOWN_CADENCE_S = 600;
export function isStale(observedAt: string, now: Date): boolean {
  return now.getTime() - new Date(observedAt).getTime() > STALE_CADENCES * UNKNOWN_CADENCE_S * 1000;
}

/** Today's fmtAgeIn: "gerade eben"/"just now", "vor 42 min"/"42 min ago", "1 h 5 min ago". */
export function ageText(language: Language, ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return language === "de" ? "gerade eben" : "just now";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const span = hours === 0 ? `${rest} min` : rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  return language === "de" ? `vor ${span}` : `${span} ago`;
}

/** The occupancy half of a line: what the report says, then its time; "no occupancy published" when it says nothing. */
export function parkingOccupancyText(o: T.ParkingSite["occupancy"], language: Language, now: Date = new Date()): string {
  const de = language === "de";
  const nothing = de ? "keine Belegungsdaten veröffentlicht" : "no occupancy published";
  if (o === null) return nothing;
  const at = o.observedAt === null || o.observedAt === undefined ? null : o.observedAt;
  const stale = at !== null && isStale(at, now);
  const stamp = at === null ? "" : `${de ? "Stand" : "as of"} ${standTime(at, language, now)}${stale ? `, ${ageText(language, now.getTime() - new Date(at).getTime())}` : ""}`;
  const when = stamp === "" ? "" : ` (${stamp})`;
  if (o.state === "closed") return `${de ? "als geschlossen gemeldet" : "reported closed"}${when}`;
  // A stale reading is a past statement: its first figure is said as one, as today's.
  const parts: string[] = [];
  let figureSaid = false;
  if (o.free !== null && o.free !== undefined) {
    figureSaid = true;
    parts.push(stale ? (de ? `zuletzt ${o.free} frei gemeldet` : `last reported ${o.free} free`) : de ? `${o.free} frei` : `${o.free} free`);
  }
  const pct = occupiedPct(o.free ?? null, o.total ?? null);
  if (pct !== null) {
    const first = stale && !figureSaid;
    figureSaid = true;
    parts.push(de ? (first ? `zuletzt zu ${pct} % belegt gemeldet` : `zu ${pct} % belegt`) : first ? `last reported ${pct} % occupied` : `${pct} % occupied`);
  }
  const word = STATE_TEXT[o.state];
  if (word !== undefined) {
    const past = stale && !figureSaid;
    if (parts.length === 0 && o.state === "full") parts.push(de ? "als voll gemeldet" : "reported full");
    else parts.push(de ? `${past ? "zuletzt gemeldeter " : ""}Status laut Betreiber: ${word.de}` : `${past ? "last reported " : ""}operator's status: ${word.en}`);
  }
  return parts.length === 0 ? nothing : `${parts.join(", ")}${when}`;
}

/** One site: "1. Alsterhaus — Car park (Parkhaus), 0.2 km, 87 spaces, 84 free, 3 % occupied, operator's status: spaces available (as of 21:56)". */
export function parkingLine(p: T.ParkingSite, i: number, language: Language, now: Date = new Date()): string {
  const de = language === "de";
  const name = p.name ?? p.operator ?? null;
  const kind = parkingKindText(p.kind, language);
  // A German name that already says its kind ("Parkhaus Gänsemarkt") is not told it again.
  const kindShown = name !== null && de && name.toLowerCase().includes(kind.toLowerCase()) ? null : kind;
  const total = p.occupancy?.total ?? null;
  const free = p.occupancy?.free ?? null;
  // A total smaller than the free count beside it is never printed: a line may not contradict itself.
  const spaces = total === null || (free !== null && total < free) ? null : de ? `${total} Plätze` : `${total} spaces`;
  const parts = [
    name === null ? null : kindShown,
    p.distanceM === null || p.distanceM === undefined ? null : kmText(p.distanceM, language),
    spaces,
    parkingOccupancyText(p.occupancy, language, now),
  ].filter((x): x is string => x !== null);
  return `${i + 1}. ${name ?? kind} — ${parts.join(", ")}`;
}

/** The list's head line, as today's: a place is nearest first, a road list is in its own order. */
export function parkingHead(where: { road: string } | { place: string; radiusKm: number }, language: Language): string {
  const de = language === "de";
  if ("road" in where) return de ? `Parken an der ${where.road}:` : `Parking along the ${where.road}:`;
  return de ? `Parken um ${where.place} (Umkreis ${where.radiusKm} km), nächste zuerst:` : `Parking around ${where.place} (within ${where.radiusKm} km), nearest first:`;
}

/** Today's closing sentence under a list (find_parking.ts NOT_FULL_NOTE, verbatim). */
export const NOT_FULL_NOTE: Record<Language, string> = {
  de: "Fehlt eine Angabe „frei“, veröffentlicht der Betreiber keine Belegung — das heißt nicht, dass die Anlage voll ist.",
  en: "Where no \"free\" count is shown the operator publishes no occupancy — it does not mean the site is full.",
};
