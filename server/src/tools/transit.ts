/**
 * check_transit_disruption: a region's realtime window and its service alerts (transit-words.ts), from what
 * API 2.0.4 carries; a line asked alone, its alerts anywhere. Never a bare "no disruptions" where trips are late
 * or where the alert feeds could not be asked.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type * as T from "../api/types.js";
import { toolError, toolResult, type Language } from "../presentation.js";
import { num, placeMissing, str, type Handler } from "./context.js";
import { kmText } from "./nearby.js";
import { regionOf, type Region } from "./region.js";
import { alertLines, regionAnswer } from "./transit-words.js";

const L = (language: Language, de: string, en: string): string => (language === "de" ? de : en);

/** Verbatim from today's server (changeOnlyNote, perLineNote for DELFI, windowPhrase, townNote, alertBlock). */
export const TRANSIT_WORDS = {
  changeOnly: {
    de: "Die Quelle meldet nur Änderungen: die Zahlen beruhen auf den Fahrten, deren Verspätung sich im Zeitfenster bewegt hat, nicht auf allen Fahrten. Wenig Meldungen heißt daher nicht automatisch \"alles pünktlich\".",
    en: "The source reports changes only: these figures cover the trips whose delay moved during the window, not every trip. Few reports therefore does not by itself mean \"everything on time\".",
  },
  perLine: {
    de: "Einzelne Linien, Fahrten oder Haltestellen kann ich mit diesen Verspätungszahlen nicht beurteilen — die Echtzeitdaten kommen ohne Linienbezug, und ihre Lizenz erlaubt nur Summen über die Region.",
    en: "Individual lines, trips or stops cannot be judged from these delay figures — the realtime data arrives with no line reference, and its licence permits region-wide totals only.",
  },
  window: (language: Language, minutes: number): string => L(language, `in den letzten ${minutes} Minuten`, `in the last ${minutes} minutes`),
  placed: (language: Language, m: number): string => L(language, ` (nächstgelegene Region zum Punkt, Mittelpunkt ${kmText(m, language)} entfernt)`, ` (nearest region to the point, centre ${kmText(m, language)} away)`),
  town: (language: Language, town: string): string => L(language, ` (der Kreis, in dem ${town} liegt — die Daten sind je Kreis erfasst)`, ` (the district ${town} lies in — the data is filed per district)`),
  alertsNotCurrent: (language: Language, label: string): string => L(language,
    `Störungsmeldungen für ${label}: Die Meldungsquellen sind gerade nicht aktuell, daher kann ich nicht sagen, ob Umleitungen oder Sperrungen gemeldet sind.`,
    `Service alerts for ${label}: the alert feeds are not current right now, so I cannot say whether any diversions or closures are published.`),
  unknownRegion: (language: Language, q: string): string => L(language,
    `"${q}" kenne ich als Region nicht. Die Daten sind auf Kreisebene gemeldet — bitte ein Bundesland, eine kreisfreie Stadt oder den Kreis nennen (z. B. "Bayern", "Köln", "Landkreis Fulda").`,
    `I do not know "${q}" as a region. The data is filed at Kreis level — name a Bundesland, a city or the Kreis (for example "Bayern", "Köln", "Landkreis Fulda").`),
} as const;

export const checkTransitDisruption: Handler = async (args, ctx): Promise<CallToolResult> => {
  const { language } = ctx;
  const line = str(args["line"]);
  if (line === undefined && str(args["region"]) === undefined && (num(args["lat"]) === undefined || num(args["lon"]) === undefined)) return placeMissing(ctx);
  const where = await regionOf(args, ctx);
  if (where.code === undefined && line === undefined) {
    const region = str(args["region"]);
    return region === undefined ? toolResult(L(language, "Diese Region kenne ich nicht.", "I do not know this region."), where.metas, language) : toolError(TRANSIT_WORDS.unknownRegion(language, region));
  }
  const r = await ctx.api.get<T.DisruptionData>("listTransitDisruptions", { area: where.code, line, window_min: num(args["window_min"]) });
  const metas = [r.meta, ...where.metas];
  const lineLabel = line === undefined ? undefined : L(language, `Linie ${line}`, `line ${line}`);
  if (where.code === undefined) return toolResult(lineAnswer(language, lineLabel ?? "", r.data).join("\n"), metas, language);
  // A region asked by its bare code is said by the name the API gives it; a point's region with its centre's distance.
  const name = where.label === undefined || /^[0-9]+$/u.test(where.label) ? r.data.punctuality?.name ?? where.label ?? where.code : where.label;
  const label = `${name}${where.distanceM === undefined ? "" : TRANSIT_WORDS.placed(language, where.distanceM)}${where.town === undefined ? "" : TRANSIT_WORDS.town(language, where.town)}`;
  const alertsLabel = lineLabel === undefined ? label : `${name}, ${lineLabel}`;
  const answer = regionAnswer(language, label, alertsLabel, r.data);
  return toolResult(lineLabel === undefined ? answer : [answer, ...timetableNote(language, lineLabel, r.data)].join("\n"), metas, language);
};

/** A line asked with no area: its alerts anywhere, or why none is said, and whether the timetable knows it. */
function lineAnswer(language: Language, label: string, data: T.DisruptionData): string[] {
  return [...alertLines(language, label, data), ...timetableNote(language, label, data)];
}

/** The timetable's word on the line asked, only when it was there to ask and knows no such line. */
function timetableNote(language: Language, label: string, data: T.DisruptionData): string[] {
  const t = data.line ?? null;
  if (t === null || !t.checked || t.inTimetable) return [];
  return [L(language, `Eine ${label} steht in keinem Fahrplan, den ich lese — bitte den Liniennamen prüfen.`, `No ${label} is in any timetable I read — check the line name.`)];
}
