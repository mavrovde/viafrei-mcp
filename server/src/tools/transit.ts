/**
 * check_transit_disruption: a region's realtime window and its service alerts, in today's server's words
 * (packages/mcp check_transit_disruption.ts, verbatim). The window with no report at all and no current
 * alert feed is rendered here as today; any other answer keeps the short form until the API carries the
 * figures it is built from (the trend, the alert coverage, the regional feeds).
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type * as T from "../api/types.js";
import { toolError, toolResult, type Language } from "../presentation.js";
import { num, placeMissing, str, type Handler } from "./context.js";
import { kmText } from "./nearby.js";
import { regionOf, type Region } from "./region.js";

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

/** The window held no report at all: no counted trip, no reporting stop, no untimed trip. */
const emptyWindow = (p: T.DisruptionData["punctuality"]): boolean => p === null || (p.observed === 0 && (p.stopsReporting ?? 0) === 0 && (p.untimed ?? 0) === 0);

function emptyAnswer(language: Language, where: Region & { label: string }, windowMin: number): string {
  const label = `${where.label}${where.distanceM === undefined ? "" : TRANSIT_WORDS.placed(language, where.distanceM)}${where.town === undefined ? "" : TRANSIT_WORDS.town(language, where.town)}`;
  const window = TRANSIT_WORDS.window(language, windowMin);
  const head = L(language,
    `${label}: ${window} keine Echtzeitmeldungen aus dem Nahverkehr dieser Region.`,
    `${label}: no public-transport realtime reports from this region ${window}.`);
  return `${head}\n${TRANSIT_WORDS.changeOnly[language]}\n${TRANSIT_WORDS.perLine[language]}\n\n${TRANSIT_WORDS.alertsNotCurrent(language, label)}`;
}

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
  // Today's words for a window with nothing in it; a point's region is said with its centre's distance.
  if (line === undefined && where.label !== undefined && emptyWindow(r.data.punctuality) && r.data.alerts.length === 0 && r.data.alertsChecked === false) {
    return toolResult(emptyAnswer(language, { ...where, label: where.label }, r.data.windowMin), metas, language);
  }
  const lines = r.data.alerts.map((a) => `- ${a.lines.length > 0 ? `${a.lines.join(", ")}: ` : ""}${a.header ?? ""}`);
  if (r.data.punctuality !== null) lines.unshift(L(language, `Pünktlichkeit ${r.data.punctuality.name ?? ""}: ${r.data.punctuality.level} (${r.data.punctuality.late} von ${r.data.punctuality.observed} verspätet)`, `Punctuality ${r.data.punctuality.name ?? ""}: ${r.data.punctuality.level} (${r.data.punctuality.late} of ${r.data.punctuality.observed} late)`));
  if (lines.length === 0) return toolResult(L(language, "Keine Störungen gefunden.", "No disruptions found."), metas, language);
  return toolResult(lines.join("\n"), metas, language);
};
