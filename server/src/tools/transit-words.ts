/**
 * A region's realtime window in today's server's words (headlineSentence,
 * countedNote, trendSentence, changeOnlyNote, cancellationNote, perLineNote, alertBlock), built from the
 * figures the API change list proposes for DisruptionPunctuality (reports, tripsCancelled, previous, trend)
 * and DisruptionData.alertsCoverage. Without them, or for a thin window, the answer keeps its short form.
 */
import type * as T from "../api/types.js";
import type { Language } from "../presentation.js";
import { TRANSIT_WORDS } from "./transit.js";

/** Today's LATE_AFTER_S / 60. */
const LATE_MINUTES = 5;

const count = (language: Language, n: number): string => Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/gu, language === "de" ? "." : ",");
const percent = (language: Language, f: number): string => `${Math.round(f * 100)}${language === "de" ? " %" : "%"}`;
const counted = (language: Language, n: number, one: string, many: string): string => `${count(language, n)} ${n === 1 ? one : many}`;

/** Today's skippedNote: the trips skipping a stop and the trips cancelled here, after the head's parenthesis. */
export function skippedNote(language: Language, skipping: number, cancelled: number): string {
  const de = language === "de";
  const parts: string[] = [];
  if (skipping > 0) parts.push(de
    ? `${count(language, skipping)} ${skipping === 1 ? "Fahrt lässt" : "Fahrten lassen"} mindestens einen Halt aus (Umleitung, gesperrte Haltestelle oder vorzeitiges Ende)`
    : `${count(language, skipping)} ${skipping === 1 ? "trip skips" : "trips skip"} at least one stop (a detour, a closed stop or a trip ending early)`);
  if (cancelled > 0) parts.push(de
    ? `${count(language, cancelled)} ${cancelled === 1 ? "Fahrt fällt" : "Fahrten fallen"} hier ganz aus (kein gemeldeter Halt in der Region bedient)`
    : `${count(language, cancelled)} ${cancelled === 1 ? "trip is" : "trips are"} cancelled here (none of the stops reported in the region served)`);
  if (parts.length === 0) return "";
  return de ? `; außerdem ${parts.join("; ")}` : `; in addition, ${parts.join("; ")}`;
}

/** Today's trendSentence, one sentence per trend. */
export function trendSentence(trend: string, language: Language, windowMin: number, before: string): string {
  const de = language === "de";
  if (trend === "better") return de ? `Trend: besser als in den ${windowMin} Minuten davor (${before}).` : `Trend: better than the ${windowMin} minutes before (${before}).`;
  if (trend === "worse") return de ? `Trend: schlechter als in den ${windowMin} Minuten davor (${before}).` : `Trend: worse than the ${windowMin} minutes before (${before}).`;
  if (trend === "unchanged") return de ? `Trend: etwa wie in den ${windowMin} Minuten davor (${before}).` : `Trend: about the same as the ${windowMin} minutes before (${before}).`;
  return de ? `Trend: nicht vergleichbar — für die ${windowMin} Minuten davor liegen zu wenige Fahrten vor.` : `Trend: not comparable — too few trips for the ${windowMin} minutes before.`;
}

/** Today's perLineNote: the licence half is DELFI's alone; any other realtime source counts trips over the region. */
export function perLineNote(language: Language, source: string): string {
  if (source === "delfi_rt_tu" || source === "tripupdates") return TRANSIT_WORDS.perLine[language];
  return language === "de"
    ? "Einzelne Linien, Fahrten oder Haltestellen beurteile ich mit diesen Verspätungszahlen nicht — sie werden nur als Summe über die Region ausgewertet."
    : "Individual lines, trips or stops are not judged from these delay figures — they are evaluated as a region-wide total only.";
}

/** Today's cancellationNote: SIRI ET (VBN) names cancelled journeys' stops; every other source reports them stopless. */
export function cancellationNote(language: Language, source: string): string {
  if (source === "vbn_siri_et") {
    return language === "de"
      ? "Komplett gestrichene Fahrten nennt diese Quelle mit ihren Haltestellen, aber ohne Prognose; sie fehlen in der Quote und sind als ganz ausgefallen gezählt."
      : "This source names fully cancelled trips with their stops but without a prediction; they are not in the share and are counted as cancelled.";
  }
  return language === "de"
    ? "Fahrten, die die Quelle als Ganzes streicht, meldet sie ohne Haltestelle; sie lassen sich keiner Region zuordnen und fehlen in dieser Zahl. Als ganz ausgefallen gezählt sind nur Fahrten, deren gemeldete Halte hier alle ausgelassen werden."
    : "Trips the source cancels as a whole are reported without a stop, cannot be placed in a region and are not in this figure. Counted as cancelled are only trips all of whose reported stops here are skipped.";
}

/** Today's alertBlock for a region with no alert in force; undefined when alerts are shown (the list keeps its form). */
export function noAlertBlock(language: Language, label: string, data: T.DisruptionData): string | undefined {
  if (data.alerts.length > 0) return undefined;
  const de = language === "de";
  if (data.alertsChecked !== true) return TRANSIT_WORDS.alertsNotCurrent(language, label);
  const cov = data.alertsCoverage;
  if (cov !== undefined && !cov.covered) {
    const times = cov.lastSeenAt.filter((t): t is string => t !== null).sort();
    const newest = times.at(-1);
    const day = newest === undefined ? null : new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(newest));
    const since = day === null
      ? de ? " — seit ich diese Quellen lese, kam für dieses Gebiet keine" : " — none for this area has reached me since I began reading these sources"
      : de ? ` — die letzte kam am ${day.split("-").reverse().join(".")}` : ` — the last one arrived on ${day}`;
    return de
      ? `Störungsmeldungen für ${label}: Keine der Meldungsquellen, die ich lese, hat in den letzten ${cov.lookbackDays} Tagen eine Meldung für dieses Gebiet veröffentlicht${since}. Dass keine in Kraft ist, heißt hier also nichts — Umleitungen oder Sperrungen können trotzdem bestehen.`
      : `Service alerts for ${label}: none of the alert sources I read has published an alert for this area in the last ${cov.lookbackDays} days${since}, so "none in force" means nothing here — diversions or closures may still exist.`;
  }
  return de
    ? `Veröffentlichte Störungsmeldungen für ${label} (Umleitungen, gesperrte Haltestellen): derzeit keine in Kraft.`
    : `Published service alerts for ${label} (diversions, closed stops): none in force now.`;
}

/**
 * Today's answer for a region's window with a reliable share: head, the counting rule, the trend, the change-only
 * and cancellation caveats, the per-line note, then the alerts. Undefined when the API does not carry the
 * proposed figures, or the window is thin (too few trips, too little coverage) or has untimed trips.
 */
export function windowAnswer(language: Language, label: string, data: T.DisruptionData): string | undefined {
  const p = data.punctuality;
  if (p === null || p.reports === undefined || p.trend === undefined || p.thin !== null && p.thin !== undefined || (p.untimed ?? 0) > 0 || p.observed === 0) return undefined;
  const alerts = noAlertBlock(language, label, data);
  if (alerts === undefined) return undefined;
  const de = language === "de";
  const window = TRANSIT_WORDS.window(language, data.windowMin);
  const cancelled = skippedNote(language, p.tripsSkippingStops ?? 0, p.tripsCancelled ?? 0);
  const late = count(language, p.late), observed = count(language, p.observed), pct = percent(language, p.late / p.observed);
  const stops = p.stopsReporting ?? 0;
  const basis = de
    ? `${counted(language, p.reports, "Verspätungsmeldung", "Verspätungsmeldungen")} zu diesen Fahrten; Meldungen im Zeitraum insgesamt von ${counted(language, stops, "Haltestelle", "Haltestellen")}`
    : `${counted(language, p.reports, "delay report", "delay reports")} on these trips; reports in the window from ${counted(language, stops, "stop", "stops")} in all`;
  const head = de
    ? `${label}: ${pct} der beobachteten Fahrten mehr als ${LATE_MINUTES} Minuten zu spät (${late} von ${observed} Fahrten ${window}, gestützt auf ${basis})${cancelled}.`
    : `${label}: ${pct} of observed trips more than ${LATE_MINUTES} minutes late (${late} of ${observed} trips ${window}, from ${basis})${cancelled}.`;
  const rule = de
    ? `Gezählt werden Fahrten, nicht Meldungen: eine Fahrt zählt als verspätet, wenn sie im Zeitfenster mindestens einmal mehr als ${LATE_MINUTES} Minuten zu spät gemeldet wurde — auch wenn sie danach wieder aufgeholt hat.`
    : `Trips are counted, not reports: a trip counts as late if it was reported more than ${LATE_MINUTES} minutes late at least once during the window, even if it caught up afterwards.`;
  const prev = p.previous;
  const before = prev === null || prev === undefined || prev.observed === 0 ? percent(language, 0) : percent(language, prev.late / prev.observed);
  const source = p.sourceFamily ?? "";
  return [head, rule, trendSentence(p.trend, language, data.windowMin, before), TRANSIT_WORDS.changeOnly[language], cancellationNote(language, source), perLineNote(language, source), "", alerts].join("\n");
}
