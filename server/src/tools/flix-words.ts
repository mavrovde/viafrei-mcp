/**
 * The FlixBus/FlixTrain block beside the stops around a place, in today's server's words
 * (its COPY and flixLine), from the proposed StopBoards.longDistance.
 */
import type * as T from "../api/types.js";
import type { Language } from "../presentation.js";
import { timeBeside } from "./departure-words.js";

/** Verbatim from today's server (its FlixBus/FlixTrain COPY). */
const COPY = {
  de: {
    head: (n: number, m: number): string => `FlixBus/FlixTrain im Umkreis von ${new Intl.NumberFormat("de-DE").format(m / 1000)} km (${n}):`,
    coach: "Fernbus", train: "FlixTrain", to: "nach", from: "ab", cancelled: "fällt aus",
    delay: (min: number): string => (min > 0 ? `+${min} min` : min < 0 ? `${min} min` : "pünktlich"),
    expected: "erwartet", timetable: "Fahrplanzeit",
    note: "Buchung und Preise nur bei FlixBus selbst; die Echtzeit ist FlixBus' eigene Prognose.",
    noRealtime: "Ohne aktuelle Echtzeit von FlixBus: Fahrplanzeiten.",
  },
  en: {
    head: (n: number, m: number): string => `FlixBus/FlixTrain within ${new Intl.NumberFormat("en-GB").format(m / 1000)} km (${n}):`,
    coach: "coach", train: "FlixTrain", to: "to", from: "from", cancelled: "cancelled",
    delay: (min: number): string => (min > 0 ? `+${min} min` : min < 0 ? `${min} min` : "on time"),
    expected: "expected", timetable: "timetable time",
    note: "Booking and fares only with FlixBus itself; the realtime is FlixBus' own prediction.",
    noRealtime: "No current realtime from FlixBus: timetable times.",
  },
} as const;

/** Today's flixLine: time, vehicle with its line, destination, stop with its distance, then the state. */
export function flixLine(d: T.LongDistanceDeparture, live: boolean, now: Date, language: Language): string {
  const c = COPY[language];
  const vehicle = d.mode === "train" ? c.train : `${c.coach}${d.line === "" ? "" : ` ${d.line}`}`;
  const where = d.destination === null ? "" : ` ${c.to} ${d.destination}`;
  const state = d.cancelled
    ? ` — ${c.cancelled}`
    : d.delayMin !== null && d.expectedAt !== null
      ? ` — ${c.delay(d.delayMin)}${d.delayMin === 0 ? "" : ` (${c.expected} ${timeBeside(d.expectedAt, now, language)})`}`
      : live ? ` — ${c.timetable}` : "";
  return `- ${timeBeside(d.at, now, language)} ${vehicle}${where}, ${c.from} ${d.stop.name} (${d.stop.distanceM} m)${state}`;
}

/** Today's block: nothing where no Flix departure is near (no claim that no coach stops there). */
export function flixBlock(block: T.LongDistance | null | undefined, now: Date, language: Language): string[] {
  if (block === null || block === undefined || block.departures.length === 0) return [];
  const c = COPY[language];
  return [c.head(block.departures.length, block.radiusM), ...block.departures.map((d) => flixLine(d, block.realtime, now, language)), block.realtime ? c.note : `${c.noRealtime} ${c.note}`];
}
