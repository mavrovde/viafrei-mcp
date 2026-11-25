/**
 * A departure board in today's words (departureLine, liveSuffix and the board's COPY;
 * lineLabel, modeWord, platformWord; isReplacementBus,
 * lineShown, shownDestination). One line per departure, read aloud:
 * "14:24 Bus 2 → Fulda Galerie, Steig C, +3 Min. (voraussichtlich 14:27)".
 */
import type * as T from "../api/types.js";
import { berlinTime, datedTime, sameBerlinDay, type Language } from "../presentation.js";

type Mode = "rail" | "subway" | "tram" | "bus" | "ferry" | "other";

const MODE_WORDS: Record<Mode, Record<Language, string>> = {
  rail: { de: "Zug", en: "train" },
  subway: { de: "U-Bahn", en: "metro" },
  tram: { de: "Tram", en: "tram" },
  bus: { de: "Bus", en: "bus" },
  ferry: { de: "Fähre", en: "ferry" },
  other: { de: "Fahrt", en: "service" },
};

const modeOf = (m: string | null | undefined): Mode =>
  m === "sbahn" ? "rail" : m === "rail" || m === "subway" || m === "tram" || m === "bus" || m === "ferry" ? m : "other";

/** The word for a row, finer than the mode where the extended route type says more (today's modeWord). */
function modeWord(mode: Mode, routeType: number | null | undefined, language: Language): string {
  const t = routeType ?? Number.NaN;
  const de = language === "de";
  if (t === 101 || t === 102) return de ? "Fernzug" : "long-distance train";
  if (t === 103 || t === 106) return de ? "Regionalzug" : "regional train";
  if (t === 109) return "S-Bahn";
  if (t >= 200 && t <= 209) return de ? "Fernbus" : "coach";
  if (t === 715) return de ? "Rufbus" : "on-demand bus";
  if (t === 1_501) return de ? "Ruftaxi" : "shared taxi";
  if (t >= 1_500 && t <= 1_599) return de ? "Taxi" : "taxi";
  return MODE_WORDS[mode][language];
}

const RAIL_LINE_NAME = /^(?:S|RE|RB|IRE|ICE|IC|EC|ECE|RJ|RJX|NJ|EN|FLX|MEX|TGV)\s?\d/u;
const REPLACEMENT_WORD = /(?:^|[^A-Za-z])(?:SEV(?:[^A-Za-z]|$)|Ersatz|Schienenersatz)/iu;
const EV_LINE = /^EV\s?\d/u;
const isBusRouteType = (t: number): boolean => t === 3 || t === 11 || (t >= 200 && t <= 209) || (t >= 700 && t <= 716) || t === 800;
const bare = (line: string): string => line.trim().replace(/^Bus\s+/u, "");

/** A rail replacement bus by the national rule (isReplacementBus, as lineLabel calls it). */
export function isReplacementRow(line: string, mode: Mode, routeType: number | null | undefined): boolean {
  if (routeType === 714) return true;
  const name = bare(line);
  const bus = mode === "bus";
  const otherwise = !bus;
  if (!otherwise && (REPLACEMENT_WORD.test(name) || EV_LINE.test(name))) return true;
  return bus && RAIL_LINE_NAME.test(name);
}

function replacementLineName(line: string): string {
  const name = bare(line);
  if (/^(?:SEV|Ersatzverkehr|Schienenersatzverkehr)$/iu.test(name)) return "";
  return name.replace(/^(?:SEV|Ersatzverkehr|Schienenersatzverkehr)[\s-]+(?=\S)/iu, "");
}

/** The line as a board prints it: the mode word in front unless the name already says that mode (today's lineLabel). */
export function lineLabel(line: string, mode: Mode, routeType: number | null | undefined, language: Language): string {
  const name = line.trim();
  const claims = RAIL_LINE_NAME.test(name) ? "rail" : /^U\s?\d/u.test(name) ? "subway" : null;
  if (name !== "" && isReplacementRow(name, mode, routeType)) {
    const word = language === "de" ? "SEV-Bus" : "rail replacement bus";
    const n = replacementLineName(name);
    return n === "" ? word : `${word} ${n}`;
  }
  if (!/\d/u.test(name)) return mode !== "other" && /^\p{L}{1,3}$/u.test(name) ? `${modeWord(mode, routeType, language)} ${name}` : name;
  if (mode !== "other" && claims === mode) return name;
  if (claims === "subway" && (mode === "tram" || mode === "rail")) return name;
  return `${modeWord(mode, routeType, language)} ${name}`;
}

/** `Gleis` or `Steig`, by mode (today's platformWord). */
const platformWord = (mode: Mode, language: Language): string => {
  const rails = mode === "rail" || mode === "subway" || mode === "tram";
  return language === "en" ? (rails ? "platform" : "stand") : rails ? "Gleis" : "Steig";
};

/** A long-distance trip's train number without DELFI's zero padding, else the line (today's lineShown). */
function lineShown(d: T.Departure): string {
  const t = d.trainNumber?.trim() ?? "";
  const n = /^\d+$/u.test(t) ? t.replace(/^0+/u, "") : t;
  if (n !== "" && (d.routeType === 101 || d.routeType === 102)) return n;
  return d.line ?? d.category ?? "";
}

/** A replacement stop named by a code says it is one (today's shownDestination). */
function shownDestination(name: string, language: Language): string {
  if (!/^\s*Ersatz(?:\s+\d+)+\s*$/u.test(name)) return name;
  return language === "de" ? `Ersatzhaltestelle „${name.trim()}“` : `replacement stop "${name.trim()}"`;
}

/** A time beside now: with the day when it is another Berlin day (today's berlinTime(d, now)). */
export function timeBeside(iso: string, now: Date, language: Language): string {
  return sameBerlinDay(new Date(iso), now) ? berlinTime(iso) : datedTime(iso, language);
}

/** A board carries a live figure when one row has realtime or a no-forecast mark (today's anyLive). */
export const anyLive = (ds: readonly T.Departure[]): boolean => ds.some((d) => isLive(d) || d.noForecast === true || d.cancelled);

/** A row with a live figure: the API's flag, else a delay it carries. */
const isLive = (d: T.Departure): boolean => d.realtime ?? d.delayMin !== null;

/** The realtime state after a row, on a board with a live figure (today's liveSuffix). */
function liveSuffix(d: T.Departure, now: Date, language: Language): string {
  const de = language === "de";
  if (d.cancelled) return de ? "fällt aus" : "cancelled";
  if (!isLive(d)) return d.noForecast === true ? (de ? "ohne Prognose" : "no forecast") : de ? "Plan" : "timetable";
  if (d.delayMin === null) return de ? "ohne Prognose" : "no forecast";
  if (d.delayMin === 0) return de ? "pünktlich" : "on time";
  const expected = timeBeside(new Date(new Date(d.plannedAt).getTime() + d.delayMin * 60_000).toISOString(), now, language);
  if (d.delayMin > 0) return de ? `+${d.delayMin} Min. (voraussichtlich ${expected})` : `+${d.delayMin} min (expected ${expected})`;
  return de ? `${-d.delayMin} Min. früher (voraussichtlich ${expected})` : `${-d.delayMin} min early (expected ${expected})`;
}

/** One departure (today's departureLine). `live` is the board's anyLive: a timetable-only board says no state. */
export function boardLine(d: T.Departure, live: boolean, now: Date, language: Language): string {
  const mode = modeOf(d.mode);
  const shown = lineShown(d);
  const label = shown.trim() === "" ? modeWord(mode, d.routeType, language) : lineLabel(shown, mode, d.routeType, language);
  const named = d.destination === null || d.destination.trim() === "" ? null : shownDestination(d.destination, language);
  const head = `${timeBeside(d.plannedAt, now, language)} ${label} → ${named ?? (language === "de" ? "Ziel nicht angegeben" : "destination not given")}`;
  const platform = d.platform === null || d.platform.trim() === "" ? null : d.platform.trim();
  const at = platform !== null ? `${head}, ${platformWord(mode, language)} ${platform}`
    : isReplacementRow(shown, mode, d.routeType) ? `${head}, ${language === "de" ? "ab der Ersatzhaltestelle" : "from the replacement bus stop"}` : head;
  return live ? `${at}, ${liveSuffix(d, now, language)}` : at;
}

/** The board's words (today's COPY of the board by stop and of the board around a place). */
export const BOARD = {
  de: {
    head: (stop: string, from: string, to: string, live: boolean) => `Abfahrten ab ${stop} — ${live ? "Fahrplan mit Echtzeit" : "Plandaten"}, ${from} bis ${to}:`,
    more: (n: number) => `… und ${n} weitere im Fenster.`,
    stopId: (id: string) => `Haltestellen-ID (für watch_situation, kind "station"): ${id}`,
    nearHead: (where: string, km: number, to: string) => `Die nächsten Haltestellen um ${where} (Umkreis ${km} km) mit ihren nächsten Abfahrten bis ${to}:`,
    nearNone: (to: string) => `  keine Abfahrt bis ${to}`,
    nearNote: (live: boolean) => live
      ? "Fahrplan mit Verspätungen und Ausfällen aus den Echtzeitdaten, wo sie vorliegen; „Plan“ ist eine Fahrplanzeit ohne Echtzeitangabe. Dieselben Haltestellen und Abfahrten zeigt die Ortsseite auf viafrei.de."
      : "Fahrplanzeiten (Plandaten). Dieselben Haltestellen und Abfahrten zeigt die Ortsseite auf viafrei.de.",
  },
  en: {
    head: (stop: string, from: string, to: string, live: boolean) => `Departures from ${stop} — ${live ? "timetable with realtime" : "timetable"}, ${from} to ${to}:`,
    more: (n: number) => `… and ${n} more in the window.`,
    stopId: (id: string) => `Stop id (for watch_situation, kind "station"): ${id}`,
    nearHead: (where: string, km: number, to: string) => `The nearest stops around ${where} (within ${km} km) with their next departures until ${to}:`,
    nearNone: (to: string) => `  no departure until ${to}`,
    nearNote: (live: boolean) => live
      ? "Timetable with delays and cancellations from the realtime data where held; \"timetable\" marks a planned time with no realtime figure. viafrei.de's place page shows the same stops and departures."
      : "Planned times (timetable). viafrei.de's place page shows the same stops and departures.",
  },
} as const;

/** Today's berlinStamp: the Berlin date with the year, then the clock ("28.11.2026 00:00", "2026-11-28 00:00"). */
export function berlinStamp(iso: string, language: Language): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${language === "de" ? `${p["day"]}.${p["month"]}.${p["year"]}` : `${p["year"]}-${p["month"]}-${p["day"]}`} ${p["hour"]}:${p["minute"]}`;
}

/**
 * Today's board note (its COPY note and noteLive): what the times are, and how far the loaded
 * timetable reaches, with its load time. Undefined while the API does not say the timetable's reach.
 */
export function boardNote(window: { timetableUntil?: string | null; timetableLoadedAt?: string | null }, live: boolean, language: Language): string | undefined {
  if (window.timetableUntil === undefined || window.timetableUntil === null) return undefined;
  const until = berlinStamp(window.timetableUntil, language);
  const loaded = window.timetableLoadedAt === undefined || window.timetableLoadedAt === null ? null : berlinStamp(window.timetableLoadedAt, language);
  if (language === "de") {
    const reach = `Der Fahrplan reicht derzeit bis ${until}${loaded === null ? "" : ` (Fahrplan geladen ${loaded})`}.`;
    return live
      ? `Verspätungen und Ausfälle aus den DELFI-Echtzeitdaten, wo sie vorliegen; mit „Plan“ markierte Zeiten sind Fahrplanzeiten ohne Echtzeitangabe. ${reach}`
      : `Nur Fahrplan, keine Echtzeit: Verspätungen, Ausfälle und Gleiswechsel sind hier nicht enthalten. ${reach}`;
  }
  const reach = `The timetable currently reaches ${until}${loaded === null ? "" : ` (timetable loaded ${loaded})`}.`;
  return live
    ? `Delays and cancellations from DELFI realtime data where held; times marked "timetable" are planned times with no realtime figure. ${reach}`
    : `Timetable only, no realtime: delays, cancellations and platform changes are not included here. ${reach}`;
}

/** The share-alike sentence's subject on a board with a live figure (today's LIVE_SHARE_ALIKE_SUBJECT). */
export const LIVE_SHARE_ALIKE_SUBJECT: Record<Language, string> = {
  de: "Die Echtzeitangaben aus DELFI GTFS-RT und DELFI SIRI ET",
  en: "The realtime figures from DELFI GTFS-RT and DELFI SIRI ET",
};
