/**
 * check_road_status's answer for a road asked by its number, in today's words (headLine,
 * itemLines, tailLines, the road-status COPY and strategyLine), from the proposed `roadStatus` the API is asked to
 * send: the tally of the window, the page's entries, the rest counted, the sources that answered with their
 * Stand, the Autobahn GmbH's traffic guidance, and why planned works are answered by road.
 */
import type { Language } from "../presentation.js";
import { berlinTime } from "../presentation.js";
import type * as T from "../api/types.js";
import { factWords } from "./handlers.js";

const L = (language: Language, de: string, en: string): string => (language === "de" ? de : en);
/** Today's MAX_LIMIT: one answer holds at most this many entries. */
export const ROAD_STATUS_MAX = 11;

/** Today's dayText: the Berlin day ("2026-11-26", "26.11.2026"). */
export function dayText(iso: string, language: Language): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  return language === "de" ? `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}` : day;
}

const n = (k: number, one: string, many: string): string => `${k} ${k === 1 ? one : many}`;
const names = (language: Language, xs: readonly string[]): string =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} ${L(language, "und", "and")} ${xs[xs.length - 1]!}`;

/** Today's head line: the tally, its publishers, the window. */
export function roadStatusHead(road: string, s: T.RoadStatus, language: Language): string {
  const c = s.counts;
  const list = language === "de"
    ? [n(c.closed, "Sperrung", "Sperrungen"), n(c.restricted, "Einschränkung", "Einschränkungen"), n(c.planned, "geplante Arbeitsstelle", "geplante Arbeitsstellen"),
      ...(c.current > 0 ? [`${n(c.current, "laufende Arbeitsstelle", "laufende Arbeitsstellen")} laut ${names(language, c.currentBy)}`] : [])]
    : [n(c.closed, "closure", "closures"), n(c.restricted, "restriction", "restrictions"), `${c.planned} planned roadworks ${c.planned === 1 ? "site" : "sites"}`,
      ...(c.current > 0 ? [`${c.current} current roadworks ${c.current === 1 ? "site" : "sites"} per ${names(language, c.currentBy)}`] : [])];
  const window = s.windowEnd === null ? L(language, "Zeitraum: jetzt", "window: right now") : L(language, `Zeitraum bis ${dayText(s.windowEnd, language)}`, `window until ${dayText(s.windowEnd, language)}`);
  return `${road}: ${list.join(", ")} — ${window}.`;
}

/** Today's entry line: the label, the road where it is named, the publisher's words, the facts, the span. */
export function roadStatusItem(i: T.RoadStatusItem, language: Language): string {
  const end = i.to;
  const backwards = i.from !== null && end !== null && new Date(end).getTime() < new Date(i.from).getTime();
  const span = [i.from === null ? "" : dayText(i.from, language), end === null || backwards ? "" : dayText(end, language)].filter((x) => x !== "").join("–");
  const whole = i.measureTo === null ? "" : L(language, `Gesamtmaßnahme bis ${dayText(i.measureTo, language)}`, `whole measure until ${dayText(i.measureTo, language)}`);
  const dates = [span, whole].filter((x) => x !== "").join(", ");
  const facts = language !== "en" || i.facts === null ? [] : factWords(i.facts);
  const shown = i.shown === "" ? "" : `: ${language === "en" ? `Provider text (German): "${i.shown}"` : i.shown}`;
  return `• ${i.label}${i.namedRoad ? ` ${i.road}` : ""}${shown}${facts.length === 0 ? "" : ` — ${facts.join(", ")}`}${dates === "" ? "" : ` (${dates})`}`;
}

/** Today's "… N more" line: by road, one answer holds at most ROAD_STATUS_MAX. */
export function roadStatusMore(hidden: number, closures: number, canRaise: boolean, language: Language): string | null {
  if (hidden <= 0) return null;
  const m = ROAD_STATUS_MAX;
  return L(language,
    `… ${hidden} ${hidden === 1 ? "weiterer Eintrag" : "weitere Einträge"}${closures > 0 ? `, davon ${n(closures, "Sperrung", "Sperrungen")}` : ""}; `
      + (canRaise ? `mit einem höheren limit (max ${m}) abrufen oder mit place eingrenzen (road und place zusammen).` : `eine Antwort fasst höchstens ${m} — mit place eingrenzen (road und place zusammen), den Zeitraum verkürzen oder eine einzelne Straße abfragen.`),
    `… ${hidden} more ${hidden === 1 ? "entry" : "entries"}${closures > 0 ? `, ${closures} of them ${closures === 1 ? "a closure" : "closures"}` : ""}; `
      + (canRaise ? `ask again with a higher limit (max ${m}) or narrow it with a place (road and place together).` : `one answer holds at most ${m} — narrow it with a place (road and place together), shorten the window or ask about a single road.`));
}

/** Today's strategyLine for guidance: the publisher's title and words, its own English on an English answer. */
export function guidanceLine(g: T.RoadGuidance, language: Language): string {
  const until = g.until === null ? "" : L(language, ` bis ${berlinTime(g.until)}`, ` until ${berlinTime(g.until)}`);
  const place = [g.from, g.to].filter((x): x is string => x !== null && x.trim() !== "").join(" – ");
  const where = `${until})${place === "" ? "" : L(language, ` bei ${place}`, ` at ${place}`)}${g.via === null ? "" : L(language, `: über ${g.via}`, `: via ${g.via}`)}`;
  const title = language === "de" ? g.title : g.titleEn;
  const words = language === "de" ? g.words : g.wordsEn;
  const quoted = [title, words === title ? null : words].filter((x): x is string => x !== null && x.trim() !== "").map((w) => (language === "de" ? `„${w}“` : `"${w}"`));
  return L(language,
    `• Verkehrslenkung der Autobahn GmbH (strategisches Routing, geschaltet${where}${quoted.length === 0 ? "" : `: ${quoted.join(" — ")}`}. Empfehlung der Autobahn GmbH, keine Routenempfehlung von ViaFrei.`,
    `• Traffic guidance by the Autobahn GmbH (strategic routing, switched on${where}${quoted.length === 0 ? "" : `: ${quoted.join(" — ")} (the Autobahn GmbH's own words)`}. The Autobahn GmbH's recommendation, not a route of ViaFrei's.`);
}

/** The whole answer's body: head, entries, the rest, the sources that answered, the guidance, the by-road note. */
export function roadStatusText(road: string, s: T.RoadStatus, language: Language, now: Date = new Date()): string {
  const answered = s.sourcesAnswered.map((x) => (x.asOf === null ? x.label : `${x.label} — ${L(language, "Stand", "As of")} ${standOf(x.asOf, language, now)}`)).join("; ");
  return [
    roadStatusHead(road, s, language),
    ...s.items.map((i) => roadStatusItem(i, language)),
    roadStatusMore(s.hidden, s.hiddenClosures, s.canRaise, language),
    L(language, `Geantwortet haben: ${answered}.`, `Sources that answered: ${answered}.`),
    ...s.guidance.map((g) => guidanceLine(g, language)),
    s.plannedByRoad ? L(language,
      "Geplante Arbeitsstellen werden nach Straße und Abschnitt geführt — die Planungsdaten enthalten keine Koordinaten, deshalb wird hier nach Straße geantwortet und nicht nach Umkreis.",
      "Planned roadworks are filed by road and section — the planning data carries no coordinates at all, so this is answered by road rather than by radius.") : null,
  ].filter((x): x is string => x !== null).join("\n");
}

/** Today's asOfLabel time: the clock today, the day beside it otherwise. */
function standOf(iso: string, language: Language, now: Date): string {
  const same = dayText(iso, "en") === dayText(now.toISOString(), "en");
  return same ? berlinTime(iso) : `${language === "de" ? dayText(iso, "de").slice(0, 6) : dayText(iso, "en")} ${berlinTime(iso)}`;
}
