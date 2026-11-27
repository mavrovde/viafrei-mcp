/**
 * A region's realtime window and its service alerts, said from what API 2.0.4 carries (DisruptionData): the
 * share of observed trips late at least once with its counts and the source's own window, the trips skipping a
 * stop, the median worst delay, the untimed trips, the newest report, the counting and change-only notes, then
 * the alerts in force or why none can be said. Not said, because the contract does not carry it: a trend
 * against the window before, the delay reports behind the counts, the trips cancelled here, and the minutes a
 * trip must be late to count (the API counts "late" by its own rule).
 */
import type * as T from "../api/types.js";
import { standTime, type Language } from "../presentation.js";
import { TRANSIT_WORDS } from "./transit.js";

const L = (language: Language, de: string, en: string): string => (language === "de" ? de : en);
const count = (language: Language, n: number): string => Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/gu, language === "de" ? "." : ",");
const percent = (language: Language, f: number): string => `${Math.round(f * 100)}${language === "de" ? " %" : "%"}`;
const counted = (language: Language, n: number, one: string, many: string): string => `${count(language, n)} ${n === 1 ? one : many}`;

/** The trips skipping a stop, after the head's parenthesis; "" for none. */
export function skippedNote(language: Language, skipping: number): string {
  if (skipping <= 0) return "";
  return L(language,
    `; außerdem ${count(language, skipping)} ${skipping === 1 ? "Fahrt lässt" : "Fahrten lassen"} mindestens einen Halt aus (Umleitung, gesperrte Haltestelle oder vorzeitiges Ende)`,
    `; in addition, ${count(language, skipping)} ${skipping === 1 ? "trip skips" : "trips skip"} at least one stop (a detour, a closed stop or a trip ending early)`);
}

/** The licence half is DELFI's alone; any other realtime source counts trips over the region. */
export function perLineNote(language: Language, source: string): string {
  if (source === "delfi_rt_tu" || source === "tripupdates") return TRANSIT_WORDS.perLine[language];
  return L(language,
    "Einzelne Linien, Fahrten oder Haltestellen beurteile ich mit diesen Verspätungszahlen nicht — sie werden nur als Summe über die Region ausgewertet.",
    "Individual lines, trips or stops are not judged from these delay figures — they are evaluated as a region-wide total only.");
}

/** "2 min", "less than a minute": the median of each trip's worst delay. */
function delayText(language: Language, s: number): string {
  if (s < 60) return L(language, "unter einer Minute", "less than a minute");
  return `${Math.round(s / 60)} min`;
}

/** The window's figures: the share with its counts, or that the window holds no counted trip. */
function windowLines(language: Language, label: string, data: T.DisruptionData): string[] {
  const p = data.punctuality;
  if (p === null || p.observed === 0) {
    const window = TRANSIT_WORDS.window(language, p?.windowMin ?? data.windowMin);
    const untimed = p === null || p.untimed === 0 ? "" : L(language,
      ` ${counted(language, p.untimed, "Fahrt wurde", "Fahrten wurden")} ohne zählbare Verspätung gemeldet.`,
      ` ${counted(language, p.untimed, "trip was", "trips were")} reported without a delay to count.`);
    return [L(language,
      `${label}: ${window} keine Echtzeitmeldungen aus dem Nahverkehr dieser Region.${untimed}`,
      `${label}: no public-transport realtime reports from this region ${window}.${untimed}`),
    TRANSIT_WORDS.changeOnly[language], TRANSIT_WORDS.perLine[language]];
  }
  const window = TRANSIT_WORDS.window(language, p.windowMin);
  const late = count(language, p.late), observed = count(language, p.observed), pct = percent(language, p.late / p.observed);
  const stops = p.stopsReporting > 0 ? L(language, `, Meldungen von ${counted(language, p.stopsReporting, "Haltestelle", "Haltestellen")}`, `, reports from ${counted(language, p.stopsReporting, "stop", "stops")}`) : "";
  const out = [L(language,
    `${label}: ${pct} der beobachteten Fahrten mindestens einmal verspätet (${late} von ${observed} Fahrten ${window}${stops})${skippedNote(language, p.tripsSkippingStops)}.`,
    `${label}: ${pct} of observed trips late at least once (${late} of ${observed} trips ${window}${stops})${skippedNote(language, p.tripsSkippingStops)}.`)];
  const facts: string[] = [];
  if (p.medianWorstDelaySeconds !== null) facts.push(L(language, `Median der größten Verspätung je Fahrt: ${delayText(language, p.medianWorstDelaySeconds)}`, `Median of each trip's worst delay: ${delayText(language, p.medianWorstDelaySeconds)}`));
  if (p.untimed > 0) facts.push(L(language, `${counted(language, p.untimed, "weitere Fahrt", "weitere Fahrten")} ohne zählbare Verspätung gemeldet`, `${counted(language, p.untimed, "further trip", "further trips")} reported without a delay to count`));
  if (p.observedAt !== null) facts.push(L(language, `neueste gezählte Meldung ${standTime(p.observedAt, language)}`, `newest report counted ${standTime(p.observedAt, language)}`));
  if (facts.length > 0) out.push(`${facts.join("; ").replace(/^./u, (c) => c.toUpperCase())}.`);
  out.push(L(language,
    "Gezählt werden Fahrten, nicht Meldungen: eine Fahrt zählt als verspätet, wenn sie im Zeitfenster mindestens einmal verspätet gemeldet wurde — auch wenn sie danach wieder aufgeholt hat.",
    "Trips are counted, not reports: a trip counts as late if it was reported late at least once during the window, even if it caught up afterwards."));
  out.push(TRANSIT_WORDS.changeOnly[language], perLineNote(language, p.sourceFamily));
  return out;
}

/** "- RE 1, RB 2: Bauarbeiten (until 12.12., 18:00)": an alert's lines, its headline and when it ends. */
function alertLine(language: Language, a: T.DisruptionAlert): string {
  const head = a.header?.trim() || L(language, "(ohne veröffentlichte Überschrift)", "(no headline published)");
  const until = a.inForceUntil === null ? "" : L(language, ` (bis ${standTime(a.inForceUntil, language)})`, ` (until ${standTime(a.inForceUntil, language)})`);
  return `- ${a.lines.length > 0 ? `${a.lines.join(", ")}: ` : ""}${head}${until}`;
}

/** The alerts in force, with how many there are when the list is cut; or why none is said. */
export function alertLines(language: Language, label: string, data: T.DisruptionData): string[] {
  const none = noAlertBlock(language, label, data);
  if (none !== undefined) return [none];
  const total = Math.max(data.alertsTotal, data.alerts.length);
  const cut = total > data.alerts.length ? L(language, `, ${data.alerts.length} davon hier`, `, ${data.alerts.length} of them here`) : "";
  return [L(language, `${counted(language, total, "Störungsmeldung", "Störungsmeldungen")} in Kraft für ${label}${cut}:`, `${counted(language, total, "service alert", "service alerts")} in force for ${label}${cut}:`), ...data.alerts.map((a) => alertLine(language, a))];
}

/** A region's answer: the window's figures, a blank line, then the alerts. */
export function regionAnswer(language: Language, label: string, alertsLabel: string, data: T.DisruptionData): string {
  return [...windowLines(language, label, data), "", ...alertLines(language, alertsLabel, data)].join("\n");
}

/** No alert in force: the feeds not current, no source covering the area (with its last day), or none in force; undefined when alerts are listed. */
export function noAlertBlock(language: Language, label: string, data: T.DisruptionData): string | undefined {
  if (data.alerts.length > 0) return undefined;
  const de = language === "de";
  if (data.alertsChecked !== true) return TRANSIT_WORDS.alertsNotCurrent(language, label);
  const cov = data.alertsCoverage ?? null;
  if (cov !== null && !cov.covered) {
    const times = cov.lands.map((l) => l.newestAlertSeenAt).filter((t): t is string => t !== null).sort();
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
