/**
 * The tool handlers: each maps its catalogue arguments to one API operation (or a few), and renders the
 * envelope. No handler reads a database or calls a provider; get_train_departures (in `trains.ts`) asks the
 * API's live refresher for a fresh board. A tool whose operation the API contract lacks answers `notAvailable` and is listed in GAPS.
 */
import { departuresRefusal } from "./departures-input.js";
import { anyLive, BOARD, boardLine, boardNote, LIVE_SHARE_ALIKE_SUBJECT, timeBeside } from "./departure-words.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ApiError, type DataMeta, type Envelope, type LatLon } from "../api/client.js";
import type * as T from "../api/types.js";
import { apiFailure, berlinDateTime, berlinTime, checkedStamp, creditPlace, datedTime, eur, km, standTime, toolError, toolResult, type Language } from "../presentation.js";
import { SID_CONDITION_NOTE } from "../sid-consent.js";
import { atParam, bool, isResult, looksLikeHouseNumber, num, placeMissing, placeUnknown, position, radiusM, str, strs, townCentre, type Args, type Handler, type ToolContext } from "./context.js";
import { getDrivingRules } from "./driving-rules.js";
import { findNearby, kmText } from "./nearby.js";
import { roadStatusText } from "./road-status-words.js";
import { findPlace, LAENDER } from "./find-place.js";
import { flixBlock } from "./flix-words.js";
import { findCheapestFuel, findFuelStation } from "./fuel.js";
import { findChargingStation } from "./charging.js";
import { findHydrogenStation } from "./hydrogen.js";
import { facilitiesText } from "./facilities.js";
import { stationPageText } from "./station-page.js";
import { shareAlikeSubjectOf, stationPageSectionsText } from "./station-sections.js";
import { stopWatchHandler } from "./stop-watch.js";
import { MAX_WATCHES, watchKeyError, watchOpened, type Resolved } from "./watch-words.js";
import { aroundText, asSummary, byLevel, DWD_SUMMARY_CREDIT, MIN_LEVEL, noWarning, warningsHead } from "./weather-words.js";
import { findSpeedCameras } from "./speed-cameras.js";
import { getTrainDepartures } from "./trains.js";
import { landOf, regionOf } from "./region.js";
import { checkTransitDisruption } from "./transit.js";
import { findSharing } from "./sharing.js";
import { describeLocation } from "./location.js";
import { findDisabledBays } from "./parking-bays.js";
import { NOT_FULL_NOTE, parkingHead, parkingLine } from "./parking-words.js";
import { poiCategoryWord } from "./osm-words.js";
import { addressAnswer } from "./address-words.js";
import { hasEnglish, VERBATIM_BUDGET_CHARS, warningsList } from "./weather-block.js";
import { roadFamilies, roadForecastAnswer } from "./road-forecast.js";

const L = (language: Language, de: string, en: string): string => (language === "de" ? de : en);

function none(language: Language, metas: readonly DataMeta[], what: string): CallToolResult {
  return toolResult(L(language, `Keine ${what} gefunden.`, `No ${what} found.`), metas, language);
}

/** Today's server's refusals of a station, stop or region it cannot find (#120 A1, 3.3): errors, verbatim. */
const NOT_KNOWN = {
  facilityStation: (q: string, language: Language) => toolError(L(language,
    `Einen Bahnhof oder eine Haltestelle "${q}" kenne ich nicht. Bitte den Namen so nennen, wie er am Bahnhof oder an der Haltestelle steht, mit der Stadt (z. B. "Köln Hbf", "Stuttgart Charlottenplatz").`,
    `I do not know a station or stop called "${q}". Please give the name as it appears at the station or stop, with the city (e.g. "Köln Hbf", "Stuttgart Charlottenplatz").`)),
  station: (q: string, language: Language) => toolError(L(language,
    `Den Bahnhof "${q}" kenne ich nicht. Bitte den Namen so nennen, wie er am Bahnhof steht (z. B. "Köln Hbf").`,
    `I do not know a station called "${q}". Please give the name as it appears at the station (e.g. "Köln Hbf").`)),
  eva: (eva: string, language: Language) => toolError(L(language,
    `Zu EVA ${eva} halten wir keinen Bahnhofseintrag. Aufzüge: check_station_facilities; Abfahrten: get_train_departures.`,
    `We hold no station record for EVA ${eva}. Lifts: check_station_facilities; departures: get_train_departures.`)),
  stop: (q: string, language: Language) => toolError(stopUnknown(q, language)),
};

function stopUnknown(q: string, language: Language): string {
  return L(language,
    `Die Haltestelle "${q}" kenne ich nicht. Bitte den Namen so nennen, wie er am Schild steht, am besten mit Ort (z. B. "Fulda Bahnhof", "München, Marienplatz").`,
    `I do not know a stop called "${q}". Please give the name as it appears on the sign, ideally with its town (e.g. "Fulda Bahnhof", "München, Marienplatz").`);
}

/** A session holds at most this many open watches, as today's server does. */
export { MAX_WATCHES };

function situationLine(s: T.RoadSituation, language: Language): string {
  const until = s.validity.until === null ? "" : L(language, ` bis ${berlinDateTime(s.validity.until, language)}`, ` until ${berlinDateTime(s.validity.until, language)}`);
  const delay = s.delayMin === null ? "" : L(language, ` (+${s.delayMin} min)`, ` (+${s.delayMin} min)`);
  const dir = s.directionText === null ? "" : ` ${s.directionText}`;
  return `- ${s.road ?? ""}${dir}: ${s.headline}${delay}${until}${s.distanceM === undefined ? "" : ` · ${km(s.distanceM, language)}`}`;
}

/** The lamp's colour and its reason in words, as today's server says them (autobahn-ampel.ts); the code is never read out. */
const LAMP: Record<Language, Record<string, string>> = {
  de: { red: "Rot", amber: "Gelb", green: "Grün" },
  en: { red: "red", amber: "yellow", green: "green" },
};
const REASON: Record<Language, Record<string, string>> = {
  de: {
    road_closed: "Vollsperrung", ramp_closed: "Anschlussstelle gesperrt", safety: "Gefahr auf der Fahrbahn", bridge_closed: "Brücke gesperrt",
    long_jam: "Stau", jam: "Stau", weather_warning: "DWD-Warnung", slippery: "Glättegefahr", warning: "Verkehrsmeldung",
    narrowing: "Baustelle, Fahrbahn eingeengt", limited_sight: "eingeschränkte Sicht — eine Quelle ist nicht aktuell oder nicht lesbar",
  },
  en: {
    road_closed: "full closure", ramp_closed: "a junction ramp closed", safety: "danger on the road", bridge_closed: "bridge closed",
    long_jam: "jam", jam: "jam", weather_warning: "DWD warning", slippery: "slippery road", warning: "traffic report",
    narrowing: "roadworks narrowing the carriageway", limited_sight: "limited sight — a source is not current or could not be read",
  },
};

export function lampText(d: Pick<T.RoadConditionsData, "lamp" | "lampReason" | "lampReasonsTotal">, language: Language): string {
  const lamp = LAMP[language][d.lamp] ?? d.lamp;
  if (d.lampReason === null || d.lamp === "green") {
    return L(language, `Ampel ${lamp}: von Autobahn GmbH, Polizei/Ländern und DWD nichts gemeldet — keine Garantie für freie Fahrt`, `traffic light ${lamp}: nothing reported by the Autobahn GmbH, the police/Länder or the DWD — no guarantee the road is clear`);
  }
  // Today's ampel adds "(und N weitere Gründe)" over its folded reasons. The API's lampReasons count every
  // situation unfolded, so the count is the proposed lampReasonsTotal, said only where the API sends it.
  const more = (d.lampReasonsTotal ?? 1) - 1;
  const tail = more <= 0 ? "" : L(language, ` (und ${more} ${more === 1 ? "weiterer Grund" : "weitere Gründe"})`, ` (and ${more} more ${more === 1 ? "reason" : "reasons"})`);
  return L(language, `Ampel ${lamp}: ${REASON.de[d.lampReason] ?? d.lampReason}${tail}`, `traffic light ${lamp}: ${REASON.en[d.lampReason] ?? d.lampReason}${tail}`);
}

/** Today's count words (check_autobahn_traffic's COPY). */
const N_WORDS: Record<Language, Record<"jams" | "warnings" | "closures" | "roadworks" | "reports" | "restrictions", (n: number) => string>> = {
  de: {
    jams: (n) => `${n} ${n === 1 ? "Stau" : "Staus"}`, warnings: (n) => `${n} ${n === 1 ? "Warnmeldung" : "Warnmeldungen"} (Unfall, Gefahr u. a.)`,
    closures: (n) => `${n} ${n === 1 ? "Sperrung" : "Sperrungen"}`, roadworks: (n) => `${n} ${n === 1 ? "Baustelle" : "Baustellen"}`,
    reports: (n) => `${n} ${n === 1 ? "Meldung" : "Meldungen"}`, restrictions: (n) => `${n} ${n === 1 ? "Einschränkung" : "Einschränkungen"}`,
  },
  en: {
    jams: (n) => `${n} ${n === 1 ? "jam" : "jams"}`, warnings: (n) => `${n} ${n === 1 ? "warning" : "warnings"} (accident, hazard etc.)`,
    closures: (n) => `${n} ${n === 1 ? "closure" : "closures"}`, roadworks: (n) => `${n} ${n === 1 ? "roadworks site" : "roadworks sites"}`,
    reports: (n) => `${n} ${n === 1 ? "report" : "reports"}`, restrictions: (n) => `${n} ${n === 1 ? "restriction" : "restrictions"}`,
  },
};

/**
 * Today's road-wide headline: the road's jams, other warnings, closures and roadworks; the police/Land messages
 * beside them; what is announced and from when; the time; and NRW's measured traffic state where it measures.
 */
export function roadWideLine(road: string, w: T.RoadWide, language: Language, now: Date = new Date()): string {
  const n = N_WORDS[language];
  const extra = w.warnings - w.jams;
  const counts = `${n.jams(w.jams)}${extra > 0 ? `, ${n.warnings(extra)}` : ""}, ${n.closures(w.closures)}, ${n.roadworks(w.roadworks)}`;
  const p = w.police;
  const police = [p.jams > 0 ? n.jams(p.jams) : null, p.closures > 0 ? n.closures(p.closures) : null, p.restrictions > 0 ? n.restrictions(p.restrictions) : null,
    p.roadworks > 0 ? n.roadworks(p.roadworks) : null, p.reports > 0 ? n.reports(p.reports) : null].filter((x): x is string => x !== null);
  const a = w.announced;
  const announced = [a.closures > 0 ? n.closures(a.closures) : null, a.roadworks > 0 ? n.roadworks(a.roadworks) : null, a.reports > 0 ? n.reports(a.reports) : null]
    .filter((x): x is string => x !== null);
  const from = a.from === null ? "" : L(language, ` ab ${standTime(a.from, language, now)}`, ` from ${standTime(a.from, language, now)}`);
  const m = w.measured;
  const measured = m === null ? "" : (() => {
    const at = m.measuredAt === null ? "" : `, ${L(language, "Stand", "as of")} ${standTime(m.measuredAt, language, now)}`;
    const words = L(language, "Stillstand|zähfließend|dicht|frei", "standstill|slow|heavy|free-flowing").split("|");
    const parts = [m.standstill > 0 ? `${m.standstill} ${words[0]}` : null, m.slow > 0 ? `${m.slow} ${words[1]}` : null, m.heavy > 0 ? `${m.heavy} ${words[2]}` : null, `${m.free} ${words[3]}`]
      .filter((x): x is string => x !== null).join(", ");
    const near = m.near.length === 0 ? "" : L(language, `; Stillstand oder zähfließend bei ${m.near.join(", ")}`, `; standstill or slow near ${m.near.join(", ")}`);
    const lanes = m.laneSites <= 0 ? "" : L(language, `; davon ${m.laneSites} ohne aktuellen Querschnittswert, nach dem langsamsten Fahrstreifen gezählt`, `; ${m.laneSites} of them without a current cross-section reading, counted by their slowest lane`);
    return L(language, ` Verkehrslage an ${m.sites} ${m.sites === 1 ? "Messstelle" : "Messstellen"} (NRW${at}): ${parts}${near}${lanes}.`, ` Traffic state at ${m.sites} measuring ${m.sites === 1 ? "site" : "sites"} (NRW${at}): ${parts}${near}${lanes}.`);
  })();
  return L(language, `${road}, gesamte Strecke: ${counts}`, `${road}, road-wide: ${counts}`)
    + (police.length === 0 ? "" : L(language, `; dazu Polizei-/Landesmeldungen: ${police.join(", ")}`, `; plus police/Land messages: ${police.join(", ")}`))
    + (announced.length === 0 ? "" : L(language, `; angekündigt${from}: ${announced.join(", ")}`, `; announced${from}: ${announced.join(", ")}`))
    + ` — ${L(language, "Stand", "As of")} ${standTime(w.asOf, language, now)}.${measured}`;
}

/** Today's plan lines: at most this many, never "+1 more" (today's linesShown). */
export const PLANS_NOW_LINES = 3;
const PLAN_LABEL: Record<Language, string> = { de: "Arbeitsstelle kürzerer Dauer (Planung der Autobahn GmbH)", en: "Short-duration roadworks (Autobahn GmbH plan)" };

/**
 * The short-duration roadworks planned now on a motorway, as today: the label, the road, the publisher's words,
 * the window "per the plan now" (never "closed"); its end without the day when it ends the day it starts.
 */
export function plannedNowLines(road: string, plans: NonNullable<T.RoadConditionsData["plannedNow"]>, language: Language): string[] {
  const shown = plans.slice(0, plans.length <= PLANS_NOW_LINES + 1 ? plans.length : PLANS_NOW_LINES).map((p) => {
    const { from, to } = p.window;
    const span = from === null ? "" : to === null ? L(language, `ab ${datedTime(from, language)}`, `from ${datedTime(from, language)}`)
      : `${datedTime(from, language)}–${standTime(to, language, new Date(from))}`;
    const window = span === "" ? "" : ` — ${L(language, "laut Planung jetzt", "per the plan now")} ${span}`;
    return `• ${PLAN_LABEL[language]} ${road}${p.where === null ? "" : `: ${p.where}`}${window}`;
  });
  const more = plans.length - shown.length;
  return more > 0 ? [...shown, L(language, `  +${more} weitere im strukturierten Ergebnis.`, `  +${more} more in the structured result.`)] : shown;
}

/** Today's last line of a page that has a next one. */
const NEXT_PAGE: Record<Language, string> = { de: "… weitere Einträge auf der nächsten Seite.", en: "… more entries on the next page." };

/** The lamp's weather reasons: a DWD warning and the road-weather forecast's slippery road. */
const WEATHER_REASONS = new Set(["weather_warning", "slippery"]);
/**
 * A road answer's weather credits, as today's ampel gives them: the lamp's weather part is our summary, so a
 * weather family is credited in its summary form ("Datenbasis: …, zusammengefasst") and only when a weather
 * reason is among the lamp's reasons; with none, or with no lamp shown, the weather families are not credited.
 */
export function roadWeatherCredits(metas: readonly DataMeta[], d: Pick<T.RoadConditionsData, "lampReasons"> | null): DataMeta[] {
  const weatherShown = d !== null && (d.lampReasons ?? []).some((r) => WEATHER_REASONS.has(r.reason));
  return metas.map((m) => ({
    ...m,
    attribution: (m.attribution ?? []).flatMap((a) => {
      if (a.domain !== "weather") return [a];
      if (!weatherShown) return [];
      return [{ ...a, text: a.text.includes("Datenquelle: BMVBS") ? `${DWD_SUMMARY_CREDIT}. Datenquelle: BMVBS und Straßenbauverwaltungen der Länder` : DWD_SUMMARY_CREDIT }];
    }),
  }));
}

/** Today's refusal of motorway numbers no register knows (check_autobahn_traffic.ts, motorway-known.ts). */
const UNKNOWN_ROAD = {
  all: (roads: string, count: number, near: string, language: Language) => L(language,
    `Für ${roads} liegen keine Daten vor — das ist keine mir bekannte Autobahnnummer, also keine Bundesautobahn, über die ich etwas sagen kann. ${count} Autobahnen sind erfasst.${near === "" ? "" : ` Nächstliegende Nummern: ${near}.`} Bitte prüfen Sie die Nummer (z. B. "A9", "A100").`,
    `No data for ${roads} — that is not a motorway number I know, so not a German motorway I can say anything about. ${count} motorways are on record.${near === "" ? "" : ` Nearest real numbers: ${near}.`} Please check the number (e.g. "A9", "A100").`),
  one: (road: string, near: string, language: Language) => L(language,
    `${road}: keine bekannte Autobahnnummer — keine Bundesautobahn, über die ich etwas sagen kann. ${near === "" ? 'Bitte prüfen Sie die Nummer (z. B. "A9", "A100").' : `Nächstliegende Nummern: ${near}.`}`,
    `${road}: not a known motorway number — not a German motorway I can say anything about. ${near === "" ? 'Please check the number (e.g. "A9", "A100").' : `Nearest real numbers: ${near}.`}`),
};

const motorwayNo = (road: string): number => Number(road.slice(1));

/** check_road_status's refusal of a number no register knows, in today's words (motorway-known.ts). */
export function unknownMotorwaySentence(language: Language, road: string, suggestions: readonly string[]): string {
  const near = suggestions.join(", ");
  return language === "de"
    ? `${road} ist keine Bundesautobahn, die ich kenne — weder die Autobahn GmbH noch unser Archiv führen diese Nummer, deshalb kann ich über sie nichts sagen.${near === "" ? "" : ` Nächstliegende Nummern: ${near}.`} Bitte prüfen Sie die Nummer.`
    : `${road} is not a German motorway (Bundesautobahn) I know — neither Autobahn GmbH nor our archive carries that number, so I cannot say anything about it.${near === "" ? "" : ` Nearest real numbers: ${near}.`} Please check the number.`;
}

/** The nearest real numbers to an unknown one, in number order: the number without its last digit first, then the closest (motorway-known.ts). */
export function nearestMotorways(road: string, registered: readonly string[], n = 3): string[] {
  const known = [...new Set(registered.filter((r) => /^A\d+$/u.test(r)))].filter((r) => r !== road);
  if (known.length === 0 || !/^A\d+$/u.test(road)) return [];
  const target = motorwayNo(road);
  const picked: string[] = [];
  const prefix = road.length > 2 ? road.slice(0, -1) : null;
  if (prefix !== null && known.includes(prefix)) picked.push(prefix);
  for (const r of known.filter((x) => !picked.includes(x)).sort((a, b) => Math.abs(motorwayNo(a) - target) - Math.abs(motorwayNo(b) - target) || motorwayNo(a) - motorwayNo(b))) {
    if (picked.length >= n) break;
    picked.push(r);
  }
  return picked.sort((a, b) => motorwayNo(a) - motorwayNo(b));
}

/** check_road_status's list: today's answer shows no lamp; nothing listed is never "the road is clear". */
/** How many situations a motorway's answer reads, so the cut comes after the dedupe and the closures-first sort. */
export const ROAD_READ = 100;

function roadStatusBody(d: T.RoadConditionsData, language: Language, limit: number | undefined, what: string, detail = false, hasMore = false): string {
  const all = detail ? roadEvents(d.situations) : d.situations;
  const rows = all.slice(0, limit ?? 20);
  if (rows.length === 0) {
    return L(language, `${what}: Es liegt keine Meldung vor — das heißt ausdrücklich nicht, dass die Straße frei ist.`, `${what}: there is no report — which explicitly does not mean the road is clear.`);
  }
  if (!detail) return rows.map((s) => situationLine(s, language)).join("\n");
  // A motorway asked by its number: today's counts head, one entry per event with its provider text, and the rest counted.
  // The road's own reports by reason; a source's limited sight and the DWD's warnings are no road event.
  const counts = (d.lampReasons ?? []).filter((r) => r.count > 0 && r.reason !== "limited_sight" && !WEATHER_REASONS.has(r.reason));
  const head = counts.length === 0 ? null : L(language,
    `${what}: ${counts.map((r) => `${r.count}× ${COUNT_WORDS.de[r.reason] ?? r.reason}`).join(", ")}.`,
    `${what}: ${counts.map((r) => `${r.count}× ${COUNT_WORDS.en[r.reason] ?? r.reason}`).join(", ")}.`);
  // The rest is counted over the deduplicated entries read, the closures among them named.
  const rest = all.slice(rows.length);
  const closures = rest.filter(isClosure).length;
  const beyond = hasMore ? L(language, ", und weitere über diese Lesung hinaus", ", and more beyond this read") : "";
  const count = rest.length === 0
    ? L(language, "weitere Meldungen über diese Lesung hinaus", "more entries beyond this read")
    : L(language, `${rest.length} weitere Meldungen${closures > 0 ? `, davon ${closures} Sperrungen` : ""}${beyond}`, `${rest.length} more${closures > 0 ? `, ${closures} of them closures` : ""}${beyond}`);
  const tail = rest.length === 0 && !hasMore ? null : L(language,
    `… ${count} — mit einem Ort (Straße und Ort zusammen) oder einem kürzeren Zeitfenster eingrenzen.`,
    `… ${count} — narrow it with a place (road and place together) or a shorter window.`);
  return [head, ...rows.map((s) => roadEventLine(s, language)), tail].filter((x): x is string => x !== null).join("\n");
}

/** A situation's kind in words, the German term beside the English one as today's answer names it. */
const KIND: Record<Language, Record<string, string>> = {
  de: { closure: "Sperrung", roadworks: "Baustelle", jam: "Stau", accident: "Unfall", hazard: "Gefahr", restriction: "Einschränkung", weather: "Wetter", other: "Meldung" },
  en: { closure: "Closure (Sperrung)", roadworks: "Roadworks (Baustelle)", jam: "Jam (Stau)", accident: "Accident (Unfall)", hazard: "Hazard (Gefahr)", restriction: "Restriction (Einschränkung)", weather: "Weather (Wetter)", other: "Report (Meldung)" },
};

const isClosure = (s: T.RoadSituation): boolean => s.kind === "closure" || s.severity === "road_closed";

/** The lamp reasons as counted nouns ("13× junction ramp closed"): no article, unlike the lamp's sentence. */
const COUNT_WORDS: Record<Language, Record<string, string>> = {
  de: { road_closed: "Vollsperrung", ramp_closed: "Anschlussstelle gesperrt", safety: "Gefahr auf der Fahrbahn", bridge_closed: "Brücke gesperrt", long_jam: "langer Stau", jam: "Stau", warning: "Verkehrsmeldung", narrowing: "Baustelle, Fahrbahn eingeengt" },
  en: { road_closed: "full closure", ramp_closed: "junction ramp closed", safety: "danger on the road", bridge_closed: "bridge closed", long_jam: "long jam", jam: "jam", warning: "traffic report", narrowing: "roadworks narrowing the carriageway" },
};

/** One entry per event: the same text from two records is read once; closures first, as today's list. */
export function roadEvents(situations: readonly T.RoadSituation[]): T.RoadSituation[] {
  const seen = new Set<string>();
  const out = situations.filter((s) => {
    const key = [s.kind, s.road, s.directionText, s.headline, s.subtitle ?? "", s.description ?? "", s.validity.from, s.validity.until].join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const closed = (s: T.RoadSituation): number => (isClosure(s) ? 0 : 1);
  return out.map((s, i) => ({ s, i })).sort((a, b) => closed(a.s) - closed(b.s) || a.i - b.i).map((x) => x.s);
}

/** The provider's text, one line, cut at a word near `max` characters. */
const excerpt = (t: string, max = 160): string => {
  const one = t.replace(/\s+/gu, " ").trim();
  if (one.length <= max) return one;
  const cut = one.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20))}…`;
};

/** A provider code with no words in it (a DATEX "abnormalTraffic") is said by its kind, never read out. */
const isCode = (t: string): boolean => /^[A-Za-z][a-z]+(?:[A-Z][a-z]+)+$/u.test(t);

function roadEventLine(s: T.RoadSituation, language: Language): string {
  const kind = KIND[language][s.kind] ?? s.kind;
  const head = isCode(s.headline) ? "" : s.headline;
  // The description repeats the headline at its end (the Autobahn GmbH's form); that copy is not read twice.
  const desc = s.description === null ? "" : head !== "" && s.description.trimEnd().endsWith(head) ? s.description.trimEnd().slice(0, -head.length) : s.description;
  const text = [[head, s.subtitle].filter((x) => x).join(" · "), desc.trim() === "" ? "" : excerpt(desc)].filter((x) => x).join(" — ");
  const quoted = text === "" ? "" : L(language, ` Meldungstext: "${text}"`, ` Provider text (German): "${text}"`);
  const dir = s.directionText === null ? "" : ` — ${s.directionText}`;
  const from = s.validity.from === null ? null : berlinDateTime(s.validity.from, language);
  const until = s.validity.until === null ? null : berlinDateTime(s.validity.until, language);
  const when = from !== null && until !== null ? ` (${from}–${until})`
    : from !== null ? L(language, ` (ab ${from})`, ` (from ${from})`)
    : until !== null ? L(language, ` (bis ${until})`, ` (until ${until})`) : "";
  const delay = s.delayMin === null ? "" : ` (+${s.delayMin} min)`;
  return `• ${kind}${s.road ? ` ${s.road}` : ""}:${quoted}${dir}${delay}${when}${s.distanceM === undefined ? "" : ` · ${km(s.distanceM, language)}`}`;
}

function situationsBody(d: T.RoadConditionsData, language: Language, limit: number | undefined): string {
  const rows = d.situations.slice(0, limit ?? 20);
  const head = `${lampText(d, language)}.`;
  return rows.length === 0 ? head : [head, ...rows.map((s) => situationLine(s, language))].join("\n");
}

/** Today's stampText: the Berlin day in full, and its time unless midnight ("2026-12-11 12:00", "11.12.2026"). */
export function stampText(iso: string, language: Language): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const time = berlinTime(iso);
  const date = language === "de" ? `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}` : day;
  return time === "00:00" ? date : `${date} ${time}`;
}

/** Today's phaseEndText: ", until <phase end>" and, when the whole measure ends later, its end beside it. */
export function phaseEndWords(phase: { end: string | null; measureEnd: string | null }, language: Language): string {
  const whole = (iso: string): string => L(language, `Gesamtmaßnahme bis ${stampText(iso, language)}`, `whole measure until ${stampText(iso, language)}`);
  if (phase.end === null) return phase.measureEnd === null ? "" : `, ${whole(phase.measureEnd)}`;
  const later = phase.measureEnd !== null && new Date(phase.end).getTime() < new Date(phase.measureEnd).getTime();
  return `, ${L(language, "bis", "until")} ${stampText(phase.end, language)}${later ? ` (${whole(phase.measureEnd!)})` : ""}`;
}

/** Today's terms for the Autobahn GmbH's traffic types (today's TERMS). */
const TRAFFIC_TYPE: Record<string, { de: string; en: string }> = {
  QUEUING_TRAFFIC: { de: "Stau", en: "Traffic jam" }, STATIONARY_TRAFFIC: { de: "Stau (stehend)", en: "Stationary traffic" },
  HEAVY_TRAFFIC: { de: "Dichter Verkehr", en: "Heavy traffic" }, SLOW_TRAFFIC: { de: "Stockender Verkehr", en: "Slow traffic" },
  UNSPECIFIED_ABNORMAL_TRAFFIC: { de: "Verkehrsstörung", en: "Traffic disruption" },
};
const WEEKDAY: Record<Language, readonly string[]> = {
  de: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};

/** Today's jamClauses: the jam's end, its length, its trend, the hour's usual, how long jams here last, the detour. */
export function jamWords(language: Language, j: T.RoadJam, now: Date): string {
  const de = language === "de";
  const k = (n: number): string => kmText(n * 1000, language);
  const quoted = (s: string): string => (de ? `„${s.trim()}“` : `"${s.trim()}"`);
  const parts: string[] = [];
  if (j.endText !== null) {
    const p = j.endPlace;
    parts.push(p === null ? L(language, `Stauende bei ${quoted(j.endText)}`, `end of the jam at ${quoted(j.endText)}`)
      : p.km === null ? L(language, `Stauende bei ${p.place}`, `end of the jam at ${p.place}`)
      : L(language, `Stauende ${k(p.km)} ${p.side === "past" ? "hinter" : "vor"} ${p.place}`, `end of the jam ${k(p.km)} ${p.side === "past" ? "past" : "before"} ${p.place}`));
  }
  if (j.lengthKm !== null && j.lengthKm >= 0.05) parts.push(L(language, `ca. ${k(j.lengthKm)} lang`, `about ${k(j.lengthKm)} long`));
  if (j.trend !== null) {
    const t = j.trend;
    const ago = Math.max(1, Math.round((now.getTime() - new Date(t.earlier.at).getTime()) / 60_000));
    const was = t.metric === "length" ? `${L(language, "ca.", "about")} ${k(t.earlier.value / 1000)}` : `${Math.round(t.earlier.value / 60) >= 0 ? "+" : ""}${Math.round(t.earlier.value / 60)} min`;
    const word = de ? { growing: "wächst", stable: "unverändert", shrinking: "geht zurück" }[t.direction] : { growing: "growing", stable: "steady", shrinking: "easing" }[t.direction];
    parts.push(de ? `${word} (vor ${ago} Min.: ${was})` : `${word} (${was} ${ago} min ago)`);
  }
  if (j.usual !== null) {
    const u = j.usual;
    const hours = `${String(u.hour).padStart(2, "0")}–${String((u.hour + 1) % 24).padStart(2, "0")}`;
    const day = WEEKDAY[language][u.weekday - 1] ?? "";
    const usual = u.verdict === "usual";
    parts.push(de ? `für ${day} ${hours} Uhr ${usual ? "üblich" : "ungewöhnlich"} (Stau in ${u.jamWeeks} von ${u.weeks} Wochen)` : `${usual ? "usual" : "unusual"} for ${day} ${hours} (jammed in ${u.jamWeeks} of ${u.weeks} weeks)`);
  }
  if (j.howLong !== null) {
    const h = j.howLong;
    const span = h.fromHours === h.toHours ? String(h.toHours) : `${h.fromHours}–${h.toHours}`;
    const weekend = h.dayKind === "weekend";
    parts.push(de ? `Staus an dieser Stelle lösten sich ${weekend ? "am Wochenende" : "werktags"} meist innerhalb von ${span} Std. auf (${h.cases} Fälle in ${h.weeks} Wochen)`
      : `jams here usually cleared within ${span} h ${weekend ? "at weekends" : "on weekdays"} (${h.cases} cases in ${h.weeks} weeks)`);
  }
  if (j.routeRecommendations.length > 0) {
    const recs = j.routeRecommendations.map(quoted).join("; ");
    parts.push(L(language, `Empfehlung der Autobahn GmbH: ${recs}`, `Autobahn GmbH recommends ${recs}`));
  }
  return parts.length === 0 ? "" : `, ${parts.join(", ")}`;
}

/** Today's gistDetails: the facts apart from the prose, in English. */
export function factWords(f: T.RoadFacts): string[] {
  const k = (n: number): string => kmText(n * 1000, "en");
  return [
    f.between === undefined ? (f.posts === undefined ? null : `from km ${f.posts.fromKm} to km ${f.posts.toKm}`) : `between ${f.between.from} and ${f.between.to}`,
    f.towards === undefined ? null : `towards ${f.towards}`,
    f.lengthKm !== undefined && f.lengthKm > 0 ? `over ${k(f.lengthKm)}` : null,
    f.lanes ?? null,
    f.hardShoulderClosed === true ? "hard shoulder closed" : null,
    f.maxSpeedKmh !== undefined && f.maxSpeedKmh > 0 ? `speed limit ${f.maxSpeedKmh} km/h` : null,
    f.maxWidthM !== undefined && f.maxWidthM > 0 ? `max. width ${Math.round(f.maxWidthM * 100) / 100} m` : null,
    f.queueKm !== undefined && f.queueKm > 0 ? `${k(f.queueKm)} long` : null,
  ].filter((x): x is string => x !== null && x !== "");
}

/**
 * check_autobahn_traffic's entry, as today's line (check_autobahn_traffic.ts `line`): the kind in words, the road
 * (English) or the provider's place words (German), since when and until when, the delay and the length in our
 * words, and the provider's own German quoted and labelled in English. A provider code ("abnormalTraffic") is
 * said by its kind, never read out. A start today is its clock time, one this year its day and time, an older one
 * its day (today's sinceLabel); one not begun yet says "from".
 */
export function autobahnLine(s: T.RoadSituation, language: Language, now: Date = new Date()): string {
  const de = language === "de";
  const typed = TRAFFIC_TYPE[s.trafficType ?? ""];
  const kind = typed === undefined ? (KIND[language][s.kind] ?? s.kind) : de ? typed.de : `${typed.en} (${typed.de})`;
  const head = isCode(s.headline) ? "" : s.headline;
  const desc = s.description === null ? "" : head !== "" && s.description.trimEnd().endsWith(head) ? s.description.trimEnd().slice(0, -head.length) : s.description;
  // The signed destination is the provider's words too: it stands with them, quoted in English.
  const where = [head, s.subtitle, s.directionText].filter((x) => x).join(" · ");
  const shown = s.descriptionShown === undefined ? (desc.trim() === "" ? "" : excerpt(desc)) : (s.descriptionShown ?? "");
  const words = [where, shown].filter((x) => x !== "").join(" — ");
  const from = s.validity.from;
  const started = from === null || new Date(from).getTime() <= now.getTime();
  const sameYear = from !== null && berlinDateTime(from, language).slice(6, 10) === berlinDateTime(now.toISOString(), language).slice(6, 10);
  const fromText = from === null ? null : !started || sameYear ? standTime(from, language, now) : language === "de" ? berlinDateTime(from, language).slice(0, 10) : standTime(from, language, now).slice(0, 10);
  const jam = s.jam === undefined || s.jam === null ? "" : jamWords(language, s.jam, now).slice(2);
  const parts = [
    de ? (where === "" ? s.road : where) : s.road,
    jam,
    fromText === null ? null : started ? L(language, `seit ${fromText}`, `since ${fromText}`) : L(language, `ab ${fromText}`, `from ${fromText}`),
    s.phase !== undefined && s.phase !== null ? phaseEndWords(s.phase, language).slice(2) : s.validity.until === null ? null : L(language, `bis ${standTime(s.validity.until, language, now)}`, `until ${standTime(s.validity.until, language, now)}`),
    s.delayMin === null || s.delayMin <= 0 ? null : `+${s.delayMin} min`,
    s.lengthM === null || s.lengthM === undefined || s.lengthM <= 0 ? null : L(language, `auf ${kmText(s.lengthM, language)}`, `over ${kmText(s.lengthM, language)}`),
    s.distanceM === undefined ? null : L(language, `ca. ${kmText(s.distanceM, language)} entfernt`, `about ${kmText(s.distanceM, language)} away`),
  ].filter((x): x is string => x !== null && x !== "");
  const quote = de ? (shown === "" ? "" : ` — ${shown}`) : words === "" ? "" : ` — Provider text (German): "${words}"`;
  const segments = (s.segments ?? 1) > 1 ? L(language, `, in ${s.segments} Teilabschnitten gemeldet`, `, reported as ${s.segments} sections`) : "";
  const facts = de || s.facts === undefined || s.facts === null ? [] : factWords(s.facts);
  return `• ${kind}: ${parts.join(", ")}${segments}${facts.length === 0 ? "" : ` — ${facts.join(", ")}`}${quote}`;
}

/** check_autobahn_traffic's body: the lamp's line, then each entry as today's line. */
function autobahnBody(d: T.RoadConditionsData, language: Language, limit: number | undefined, road?: string, nextPage = false): string {
  const rows = d.situations.slice(0, limit ?? 20);
  const now = new Date();
  const head = [`${lampText(d, language)}.`, road === undefined || d.roadWide === undefined || d.roadWide === null ? null : roadWideLine(road, d.roadWide, language, now)]
    .filter((x): x is string => x !== null).join("\n");
  const plans = road === undefined ? [] : plannedNowLines(road, d.plannedNow ?? [], language);
  return [head, ...rows.map((s) => autobahnLine(s, language, now)), ...plans, ...(nextPage ? [NEXT_PAGE[language]] : [])].join("\n");
}

const checkAutobahnTraffic: Handler = async (args, ctx) => {
  const { language } = ctx;
  const roads = strs(args["roads"]) ?? [];
  const kinds = strs(args["kinds"]);
  const limit = num(args["limit"]);
  if (roads.length > 0) {
    const asked = roads.slice(0, 5);
    const all = await Promise.all(asked.map((road) => ctx.api.get<T.RoadConditionsData>("getMotorwayConditions", { road, kinds, limit, cursor: str(args["cursor"]) })
      .catch((err: unknown) => { if (err instanceof ApiError && err.kind === "not_found") return null; throw err; })));
    const registered = all.includes(null) ? (await ctx.api.get<{ road: string }[]>("listMotorways", {})).data.map((m) => m.road) : [];
    const known = all.filter((r): r is NonNullable<typeof r> => r !== null);
    if (known.length === 0) {
      return toolError(UNKNOWN_ROAD.all(asked.join(", "), registered.length, asked.length === 1 ? nearestMotorways(asked[0]!, registered).join(", ") : "", language));
    }
    const body = all.map((r, i) => (r === null ? UNKNOWN_ROAD.one(asked[i]!, nearestMotorways(asked[i]!, registered).join(", "), language) : `${asked[i]} — ${autobahnBody(r.data, language, limit, asked[i], all.length === 1 && (r.meta.page?.nextCursor ?? null) !== null)}`)).join("\n\n");
    return toolResult(body, known.flatMap((r) => roadWeatherCredits([r.meta], r.data)), language, { nextCursor: all.length === 1 ? (known[0]!.meta.page?.nextCursor ?? null) : null });
  }
  const land = str(args["land"]);
  if (land !== undefined) {
    const r = await ctx.api.get<T.RoadConditionsData>("listStateRoadConditions", { state: LAND_CODES[land] ?? land, kinds, limit, road_class: ["motorway"] });
    return toolResult(autobahnBody(r.data, language, limit), roadWeatherCredits([r.meta], r.data), language);
  }
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const r = await ctx.api.get<T.RoadConditionsData>("listRoadConditions", { at: atParam(pos.at), radius_m: radiusM(args["radius_km"]), kinds, limit, road_class: ["motorway"] });
  return toolResult(autobahnBody(r.data, language, limit), roadWeatherCredits([r.meta], r.data), language);
};

const checkRoadStatus: Handler = async (args, ctx) => {
  const { language } = ctx;
  const road = str(args["road"]);
  const limit = num(args["limit"]);
  const horizon = num(args["horizon_days"]);
  const vehicle = str(args["vehicle"]);
  const place = str(args["place"]);
  let land: { code: string; name: string } | undefined;
  const metas: DataMeta[] = [];
  let body: string;
  let at: string | undefined;
  const asked = road?.replace(/\s/g, "").toUpperCase();
  if (road !== undefined && /^A\s?\d+$/i.test(road)) {
    const code = asked!;
    const r = await ctx.api.get<T.RoadConditionsData>("getMotorwayConditions", { road: code, horizon_days: horizon, limit: ROAD_READ })
      .catch((err: unknown) => { if (err instanceof ApiError && err.kind === "not_found") return null; throw err; });
    if (r === null) {
      const registered = (await ctx.api.get<{ road: string }[]>("listMotorways", {})).data.map((m) => m.road);
      return toolError(unknownMotorwaySentence(language, code, nearestMotorways(code, registered)));
    }
    metas.push(r.meta);
    const status = r.data.roadStatus ?? null;
    body = status === null ? roadStatusBody(r.data, language, limit, code, true, r.meta.page?.hasMore === true) : roadStatusText(code, status, language);
  } else if (asked !== undefined && /^[BLS]\d{1,4}$/u.test(asked) && args["place"] === undefined && args["lat"] === undefined) {
    // A federal or Land road asked by its number alone: the API reads the situations naming it (a Kreisstraße is no reference).
    const r = await ctx.api.get<T.RoadConditionsData>("getMotorwayConditions", { road: asked, horizon_days: horizon, limit });
    metas.push(r.meta);
    body = roadStatusBody(r.data, language, limit, asked);
  } else if (place !== undefined && args["lat"] === undefined && vehicle === undefined && (land = landOf(place, language)) !== undefined) {
    // A Land asked as the place: its situations, as today's server reads a Land (by its key, not a circle).
    // A lorry question keeps the place's point: its rules are read around a position.
    const r = await ctx.api.get<T.RoadConditionsData>("listStateRoadConditions", { state: land.code, horizon_days: horizon, limit });
    metas.push(r.meta);
    const rows = asked === undefined ? r.data.situations : r.data.situations.filter((s) => (s.road ?? "").replace(/\s/g, "").toUpperCase() === asked);
    body = roadStatusBody({ ...r.data, situations: rows }, language, limit, asked === undefined ? land.name : L(language, `${asked} in ${land.name}`, `${asked} in ${land.name}`));
  } else {
    // A lorry question is today's lorry answer (check_road_status.lorry.ts), which words a place it cannot find
    // in its own sentence.
    const pos = await position(args, ctx, "place", vehicle === undefined ? undefined : (q) => toolError(L(language,
      `Ort "${q}" nicht gefunden. Bitte genauer angeben, z. B. mit Postleitzahl.`,
      `Place "${q}" not found. Please be more specific, e.g. with a postcode.`)));
    if (isResult(pos)) return pos;
    at = atParam(pos.at);
    const r = await ctx.api.get<T.RoadConditionsData>("listRoadConditions", { at, horizon_days: horizon, limit });
    metas.push(r.meta);
    const rows = asked === undefined ? r.data.situations : r.data.situations.filter((s) => (s.road ?? "").replace(/\s/g, "").toUpperCase() === asked);
    body = roadStatusBody({ ...r.data, situations: rows }, language, limit, asked === undefined ? aroundText(pos.label, pos.at) : L(language, `${asked} bei ${aroundText(pos.label, pos.at)}`, `${asked} near ${aroundText(pos.label, pos.at)}`));
  }
  if (vehicle === "lorry" || vehicle === "long_lorry") {
    const rules = await ctx.api.get<T.LorryRule[]>("listLorryRules", { vehicle, road, at });
    metas.push(rules.meta);
    if (rules.data.length > 0) body += `\n\n${L(language, "Lkw-Regeln:", "Lorry rules:")}\n${rules.data.slice(0, 10).map((x) => `- ${[x.road, x.street, x.municipality].filter(Boolean).join(", ")}: ${x.publishedText ?? x.kind ?? x.layer}`).join("\n")}`;
  }
  return toolResult(body, roadWeatherCredits(metas, null), language);
};

/** The catalogue names a Land as today's server does (its slug); the API's path is the Land's two-digit AGS code. */
const LAND_CODES: Readonly<Record<string, string>> = {
  "schleswig-holstein": "01", hamburg: "02", niedersachsen: "03", bremen: "04", "nordrhein-westfalen": "05", hessen: "06",
  "rheinland-pfalz": "07", "baden-wuerttemberg": "08", bayern: "09", saarland: "10", berlin: "11", brandenburg: "12",
  "mecklenburg-vorpommern": "13", sachsen: "14", "sachsen-anhalt": "15", thueringen: "16",
};

const findRoadworksAhead: Handler = async (args, ctx) => {
  const { language } = ctx;
  const road = str(args["road"]);
  const limit = num(args["limit"]);
  if (road !== undefined) {
    const code = road.replace(/\s/g, "").toUpperCase();
    const r = await ctx.api.get<T.RoadConditionsData>("getMotorwayConditions", { road: code, kinds: ["roadworks"], horizon_days: 14, limit })
      .catch((err: unknown) => { if (err instanceof ApiError && err.kind === "not_found") return null; throw err; });
    // A number no register knows: today's refusal, with the nearest real numbers (as check_road_status).
    if (r === null) {
      const registered = (await ctx.api.get<{ road: string }[]>("listMotorways", {})).data.map((m) => m.road);
      return toolError(unknownMotorwaySentence(language, code, nearestMotorways(code, registered)));
    }
    return toolResult(situationsBody(r.data, language, limit), [r.meta], language);
  }
  // `from` and `to` are the window's days (YYYY-MM-DD, the schema's pattern), never a place.
  const pos = await position({ place: args["place"] }, ctx);
  if (isResult(pos)) return pos;
  const r = await ctx.api.get<T.RoadConditionsData>("listRoadConditions", { at: atParam(pos.at), kinds: ["roadworks"], horizon_days: 14, limit });
  return toolResult(situationsBody(r.data, language, limit), [r.meta], language);
};

async function parkingRead(ctx: ToolContext, op: "listParkingOptions" | "listMotorwayParking", params: Record<string, unknown>): Promise<{ r: Envelope<T.ParkingSite[]>; conditionNote?: string }> {
  const first = await ctx.api.get<T.ParkingSite[]>(op, params as never);
  const terms = first.meta.terms ?? [];
  if (terms.length === 0 || ctx.askSidConsent === undefined) return { r: first };
  const outcome = await ctx.askSidConsent(ctx.language);
  if (outcome !== "accepted") return { r: first };
  const accepted = await ctx.api.get<T.ParkingSite[]>(op, { ...params, accept_terms: terms.map((t) => t.accept).join(",") } as never);
  return { r: accepted, conditionNote: SID_CONDITION_NOTE[ctx.language] };
}

export const PARKING_DEFAULT_RADIUS_KM = 10;
const PARKING_MAX_RADIUS_KM = 25;
type ParkingWhere = { road: string } | { place: string; radiusKm: number };
const KEIN_DE: Record<string, string> = { rest_area: "keine Rastanlage", car_park: "kein Parkhaus", park_and_ride: "keine P+R-Anlage", truck: "keinen Lkw-Parkplatz", other: "keinen Parkplatz" };
const KIND_EN: Record<string, string> = { rest_area: "rest area (Rastanlage)", car_park: "car park (Parkhaus)", park_and_ride: "park and ride (P+R)", truck: "lorry parking (Lkw-Parkplatz)", other: "parking area (Parkplatz)" };

/**
 * Today's server's empty answer where it says "I know of no …": nothing of what was asked is held there.
 * A facility filter, or the free-spaces filter around a place, has its own sentence from counts the API
 * does not carry yet: those keep the short answer (null here) rather than a sentence that could be false.
 * Nothing was listed, so nothing is credited but the place search that found the place.
 */
const parkingWhereText = (language: Language, where: ParkingWhere): string => ("road" in where
  ? L(language, `an der ${where.road}`, `along the ${where.road}`)
  : L(language, `um ${where.place} (Umkreis ${where.radiusKm} km)`, `around ${where.place} (within ${where.radiusKm} km)`));

/** Today's answer to the free-spaces filter around a place where no site publishes an occupancy (find_parking.ts, verbatim). */
export function parkingNoOccupancy(language: Language, where: ParkingWhere): string {
  const whereText = parkingWhereText(language, where);
  return language === "de"
    ? `${whereText.charAt(0).toUpperCase()}${whereText.slice(1)} meldet keine Anlage, die ich führe, eine Belegung — ob gerade Plätze frei sind, kann ich nicht sagen. Ohne die Einschränkung auf freie Plätze nenne ich, was es dort gibt.`
    : `No site I hold ${whereText} publishes its occupancy, so I cannot say whether spaces are free right now. Asked without the free-spaces filter, I list what is there.`;
}

export function parkingEmpty(language: Language, where: ParkingWhere, kind: string | null, facilities: boolean, freeOnly: boolean, filter?: readonly string[]): ((meta: DataMeta) => CallToolResult) | null {
  if (facilities || ("place" in where && freeOnly)) return null;
  const whereText = parkingWhereText(language, where);
  const wider = "road" in where ? "" : L(language, ` — ein größerer Radius (bis ${PARKING_MAX_RADIUS_KM} km) hilft oft`, ` — a larger radius (up to ${PARKING_MAX_RADIUS_KM} km) often helps`);
  const text = language === "de"
    ? `Ich kenne ${whereText} ${kind === null ? "keine Parkmöglichkeiten" : (KEIN_DE[kind] ?? "keinen Parkplatz")}. Die Abdeckung ist bundesweit, aber nicht lückenlos${wider}.`
    : `I know of no ${kind === null ? "parking" : (KIND_EN[kind] ?? "parking area (Parkplatz)")} ${whereText}. Coverage is nationwide but not complete${wider}.`;
  const unfiltered = kind === null && !freeOnly;
  return (meta) => toolResult(text, [], language, {
    asOf: meta.generatedAt,
    structured: {
      place: "place" in where ? where.place : null, road: "road" in where ? where.road : null, kind: kind ?? "any", radiusKm: "place" in where ? where.radiusKm : null,
      facilities: [], ...(unfiltered ? { facilitiesInScope: 0, facilitiesAnyKind: 0, withoutOccupancy: 0 } : {}), onlyWithFreeSpaces: freeOnly,
      // The facilities filter asked where nothing at all is held: today's keys, every count 0.
      ...(filter === undefined ? {} : { facilitiesFilter: [...filter], facilitiesFilterScope: { sitesOfKind: 0, sitesStatingFacilities: 0 } }),
    },
  });
}

const findParking: Handler = async (args, ctx) => {
  const { language } = ctx;
  const kindArg = str(args["kind"]);
  // Today's server asks for the place before it looks at the kind.
  if (str(args["road"]) === undefined && str(args["place"]) === undefined && (num(args["lat"]) === undefined || num(args["lon"]) === undefined)) return placeMissing(ctx);
  if (kindArg === "disabled_badge") return findDisabledBays(args, ctx);
  const kind = kindArg === "any" ? undefined : kindArg;
  const common = { kind, free_min: bool(args["only_with_free_spaces"]) === true ? 1 : undefined, facilities: strs(args["facilities"]), limit: num(args["limit"]) };
  const road = str(args["road"]);
  let where: ParkingWhere;
  let scope: Record<string, unknown>;
  let op: "listParkingOptions" | "listMotorwayParking";
  if (road !== undefined) {
    const code = road.replace(/\s/g, "").toUpperCase();
    op = "listMotorwayParking";
    scope = { road: code };
    where = { road: code };
  } else {
    const pos = await position(args, ctx);
    if (isResult(pos)) return pos;
    const radiusKm = num(args["radius_km"]) ?? PARKING_DEFAULT_RADIUS_KM;
    op = "listParkingOptions";
    scope = { at: atParam(pos.at), radius_m: Math.round(radiusKm * 1000) };
    where = { place: pos.label ?? `${pos.at.lat.toFixed(3)}, ${pos.at.lon.toFixed(3)}`, radiusKm };
  }
  const read = await parkingRead(ctx, op, { ...scope, ...common });
  const { r } = read;
  if (r.data.length === 0) {
    const facilities = common.facilities !== undefined;
    const freeOnly = common.free_min !== undefined;
    const empty = parkingEmpty(language, where, kind ?? null, facilities, freeOnly);
    if (empty !== null) return empty(r.meta);
    // A filter emptied the answer. Where nothing at all is held, today's server says so, as it does without the
    // filter (free spaces around a place: no site publishes an occupancy); where sites are held, its sentence
    // counts them by kind and stated facility, which the API does not carry yet.
    const any = await ctx.api.get<T.ParkingSite[]>(op, { ...scope, limit: 1 } as never);
    if (any.data.length === 0) {
      if ("place" in where && freeOnly) return toolResult(parkingNoOccupancy(language, where), [], language, { asOf: r.meta.generatedAt });
      return parkingEmpty(language, where, kind ?? null, false, freeOnly, common.facilities)!(r.meta);
    }
    return none(language, [r.meta], L(language, "Parkplätze", "car parks"));
  }
  const now = new Date();
  const lines = [parkingHead(where, language), ...r.data.map((p, i) => parkingLine(p, i, language, now))];
  return toolResult(lines.join("\n"), [r.meta], language, { note: NOT_FULL_NOTE[language], ...(read.conditionNote === undefined ? {} : { conditionNote: read.conditionNote }) });
};

/** Today's find_poi words (main packages/mcp/src/tools/find_poi.ts COPY), verbatim. */
const POI_WORDS = {
  de: {
    head: (name: string, where: string): string => `"${name}"${where}:`,
    inTown: (t: string): string => ` in ${t}`,
    around: (t: string, km: number): string => ` im Umkreis von ${km} km um ${t}`,
    from: (km: string, t: string): string => `${km} von ${t}`,
    page: (total: number, a: number, b: number): string => `${total} Treffer, hier ${a}–${b}.`,
    pageNext: (total: number, a: number, b: number): string => `${total} Treffer, hier ${a}–${b} — die nächsten auf der nächsten Seite.`,
    stand: (d: string): string => `Stand der OpenStreetMap-Daten: ${d}`,
    nearest: (a: string, m: number): string => `nächste Adresse ${a} (${m} m)`,
  },
  en: {
    head: (name: string, where: string): string => `"${name}"${where}:`,
    inTown: (t: string): string => ` in ${t}`,
    around: (t: string, km: number): string => ` within ${km} km of ${t}`,
    from: (km: string, t: string): string => `${km} from ${t}`,
    page: (total: number, a: number, b: number): string => `${total} matches, ${a}–${b} shown.`,
    pageNext: (total: number, a: number, b: number): string => `${total} matches, ${a}–${b} shown — the next on the next page.`,
    stand: (d: string): string => `OpenStreetMap data as of ${d}`,
    nearest: (a: string, m: number): string => `nearest address ${a} (${m} m)`,
  },
} as const;

/**
 * One object, as today's line says where it is: what it is (never the OSM tag), its address, its distance from the
 * place it is measured from, and its point. The nearest address of an object without one (named as the nearest,
 * with its distance) and its Land (not where the address already ends with it) come from the proposed fields.
 */
export function poiLine(p: T.Poi, i: number, from: string | null, language: Language): string {
  const what = poiCategoryWord(p.category, p.kind ?? "", language);
  const addressOf = (a: Pick<T.Poi, "street" | "number" | "postcode" | "place">): string => [[a.street, a.number].filter((x) => x !== null && x !== "").join(" "), [a.postcode, a.place].filter((x) => x !== null && x !== "").join(" ")].filter((x) => x !== "").join(", ");
  const own = addressOf(p);
  const near = p.nearestAddress ?? null;
  const address = own !== "" || near === null ? own : POI_WORDS[language].nearest(addressOf(near), Math.round(near.distanceM));
  const land = p.landCode === undefined || p.landCode === null ? null : LAENDER[p.landCode]?.[language] ?? null;
  const landShown = land !== null && address.endsWith(` ${land}`) ? null : land;
  const kmShown = p.distanceM === null ? null : kmText(p.distanceM, language);
  const distance = kmShown === null ? null : from === null ? kmShown : POI_WORDS[language].from(kmShown, from);
  const brand = p.brand === null || p.brand === undefined || p.brand === p.name ? "" : ` (${p.brand})`;
  const point = `${p.location.lat.toFixed(5)}, ${p.location.lon.toFixed(5)}`;
  // A nameless object is headed by what it is, which is then not said twice.
  return `${i + 1}. ${p.name ?? what}${brand} — ${[p.name === null ? null : what, address === "" ? null : address, landShown, distance, point].filter((x): x is string => x !== null).join(", ")}`;
}

const findPoi: Handler = async (args, ctx) => {
  const { language } = ctx;
  const w = POI_WORDS[language];
  let at: string | undefined;
  let where = "";
  let from: string | null = null;
  const town = str(args["in"])?.trim();
  // Today's order (find_poi.ts): a town given is the scope and `near` is not resolved at all; else the position.
  if (town !== undefined && town !== "") {
    where = w.inTown(town);
    from = town;
  } else if (str(args["near"]) !== undefined || num(args["lat"]) !== undefined) {
    const pos = await position(args, ctx, "near");
    if (isResult(pos)) return pos;
    at = atParam(pos.at);
    const label = pos.label ?? `${pos.at.lat.toFixed(5)}, ${pos.at.lon.toFixed(5)}`;
    where = w.around(label, num(args["radius_km"]) ?? 10);
    from = pos.label ?? `(${label})`;
  }
  const inTown = town === "" ? undefined : town;
  const r = await ctx.api.get<T.Poi[]>("listPois", { name: str(args["name"]), in: inTown, at, radius_m: at === undefined ? undefined : radiusM(args["radius_km"]), category: str(args["category"]), limit: num(args["limit"]), cursor: str(args["cursor"]) });
  if (r.data.length === 0) return none(language, [r.meta], L(language, "Orte", "places"));
  const total = r.meta.page?.total;
  const next = r.meta.page?.nextCursor ?? null;
  // The page's first number is known on the first page only: a cursor's offset is the API's.
  const pageLine = total === undefined || str(args["cursor"]) !== undefined || total <= r.data.length ? null : next === null ? w.page(total, 1, r.data.length) : w.pageNext(total, 1, r.data.length);
  const days = r.data.map((p) => p.dataAsOf).filter((d): d is string => typeof d === "string").sort();
  const lines = [
    w.head(str(args["name"]) ?? "", where),
    ...r.data.map((p, i) => poiLine(p, i, from, language)),
    ...(pageLine === null ? [] : ["", pageLine]),
    ...(days[0] === undefined ? [] : ["", w.stand(days[0])]),
  ];
  return toolResult(lines.join("\n"), [r.meta], language, { nextCursor: next });
};

/** Today's server's find_address sentences (main packages/mcp/src/tools/find_address.ts, COPY), verbatim. */
const ADDRESS_WORDS = {
  de: { notLoaded: "Für diese Installation sind keine OpenStreetMap-Adressdaten geladen — ich kann nach Orten und Haltestellen suchen, aber nicht nach Hausnummern." },
  en: { notLoaded: "This installation holds no OpenStreetMap address data — I can look up towns and stations, but not house numbers." },
} as const;

const findAddress: Handler = async (args, ctx) => {
  const { language } = ctx;
  const r = await ctx.api.get<T.AddressData>("listAddresses", { q: str(args["query"]), limit: num(args["limit"]) });
  if (r.data.addresses.length === 0) {
    // Today's server first asks whether any address is loaded at all (osmAddressesLoaded): with none, it says so,
    // credits nothing and lists found 0. The contract's coverage names the Länder the addresses cover.
    const cov = await ctx.api.get<T.PlacesCoverageData>("getPlacesCoverage", {});
    if (cov.data.addresses.length === 0) return toolResult(ADDRESS_WORDS[language].notLoaded, [], language, { structured: { found: 0, query: str(args["query"]) } });
    return none(language, [r.meta], L(language, "Adressen", "addresses"));
  }
  return toolResult(addressAnswer(str(args["query"]) ?? "", r.data.addresses, language, r.data.objects), [r.meta], language);
};

/** The official region code the contract's `area` wants: given as one, a region name through listPlaces, or a position through describeLocation. */
async function areaCode(args: Args, ctx: ToolContext): Promise<{ code: string | undefined; metas: DataMeta[] }> {
  const { code, metas } = await regionOf(args, ctx);
  return { code, metas };
}

/**
 * A warning's own detail the API carries, as today's answer gives it per warning: the level of 4, the DWD's
 * event word, the warn area and its cell, and since when a warning in force holds.
 */
const checkWeatherWarnings: Handler = async (args, ctx) => {
  const { language } = ctx;
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  // Every warning the API holds for now and the look-ahead; the level is applied here, so the ones it
  // hides are counted and said, as today's server says them.
  const r = await ctx.api.get<T.WeatherRiskData>("getWeatherRisk", { at: atParam(pos.at) });
  const minLevel = num(args["min_level"]) ?? MIN_LEVEL;
  const around = aroundText(pos.label, pos.at);
  const { shown, hidden } = byLevel(r.data.warnings, minLevel);
  const now = new Date();
  // The road-surface forecast beside the warnings, as its own last block; a run older than 24 h is one sentence
  // and credits nothing of it.
  const road = roadForecastAnswer(language, r.data.roadForecast, now);
  const unused = new Set(road.shown ? [] : roadFamilies(r.data.roadForecast));
  const tail = road.text === null ? [] : ["", road.text];
  // Today's stamp (stampOf): the last DWD fetch, and the newest publication shown.
  const newest = shown.map((w) => w.published ?? null).filter((x): x is string => x !== null).sort().at(-1) ?? null;
  const checked = checkedStamp(r.meta, "dwd_warnings", newest, language, now);
  const stamp = checked ?? {};
  if (shown.length === 0) return toolResult([noWarning(language, around, minLevel, hidden), ...tail].join("\n"), withoutFamilies(asSummary([r.meta]), unused), language, stamp);
  // Each warning as today's block; one not yet in force says when it starts, so it is never read as in force now.
  const head = warningsHead(language, around, shown);
  const asOf = newest ?? checked?.asOf ?? r.meta.asOf ?? undefined;
  const list = warningsList(language, shown, now, { forecastSlippery: road.anySlippery, budgetChars: VERBATIM_BUDGET_CHARS - head.length - (road.text?.length ?? 0), ...(asOf === undefined ? {} : { asOf }) });
  // The DWD's English source is credited only when its words are shown (the family the API names, and the
  // register's name for it when no warning names one).
  if (list.mode !== "verbatim" || language !== "en" || !shown.some(hasEnglish)) {
    unused.add(DWD_ENGLISH_FAMILY);
    for (const w of shown) if (w.english) unused.add(w.english.sourceFamily);
  }
  const metas = withoutFamilies(list.mode === "verbatim" ? [r.meta] : asSummary([r.meta]), unused);
  const body = [head, "", list.text, ...(list.notice === null ? [] : ["", list.notice]), ...tail].join("\n");
  return toolResult(body, metas, language, stamp);
};

/** The API's family of the DWD's English warning texts. */
const DWD_ENGLISH_FAMILY = "dwd_warnings_en";

/** The metas without the credits of families the answer does not show. */
function withoutFamilies(metas: readonly DataMeta[], families: ReadonlySet<string>): DataMeta[] {
  return families.size === 0 ? [...metas] : metas.map((m) => ({ ...m, attribution: (m.attribution ?? []).filter((a) => !families.has(a.family)) }));
}

/**
 * The station a station tool asks about: an EVA number or a name, through the API's station search. `railway`
 * keeps the DB stations only, as today's station facilities check resolves a name (a bus stop of the same name
 * is no station with lifts DB reports); a stop board asks every stop.
 */
async function stationOf(args: Args, ctx: ToolContext, railway = false): Promise<Envelope<T.Station[]>> {
  const eva = str(args["eva_no"]) ?? str(args["stop_id"]);
  const q = str(args["station"]) ?? str(args["stop"]);
  return ctx.api.get<T.Station[]>("listStations", { code: eva, q: eva === undefined ? q : undefined, limit: 1, railway: railway ? "true" : undefined });
}

/**
 * The town a stop's name carries ("München, Marienplatz", "Hauptbahnhof München", "Köln Nippes"), as today's
 * server reads it (main get_departures.ts, the town out of the question): a part before a comma, else a word,
 * that the place search knows as a municipality of exactly that name. undefined when none is one.
 */
/** Verbatim from today's server (get_departures.ts unknownInTown). */
const STOP_IN_TOWN: Record<Language, (q: string, town: string) => string> = {
  de: (q, town) => `In ${town} finde ich keine Haltestelle "${q}". Bitte den Namen so nennen, wie er am Schild steht — eine gleichnamige Haltestelle in einem anderen Ort nenne ich nicht.`,
  en: (q, town) => `I do not know a stop called "${q}" in ${town}. Please give the name as it appears on the sign — I will not answer with a stop of that name in another town.`,
};

async function townIn(q: string, ctx: ToolContext): Promise<string | undefined> {
  return (await townPlace(q, ctx))?.name;
}

async function townPlace(q: string, ctx: ToolContext): Promise<T.PlaceItem | undefined> {
  const comma = q.split(",").map((p) => p.trim()).filter((p) => p !== "");
  const words = q.split(/[\s,]+/u).filter((w) => w.length >= 3 && !/\d/u.test(w));
  // At most four reads, on the not-found path only.
  for (const candidate of [...new Set([...(comma.length > 1 ? comma : []), ...words])].slice(0, 4)) {
    const r = await ctx.api.get<T.PlaceItem[]>("listPlaces", { q: candidate, kind: "municipality", limit: 1 });
    const p = r.data[0];
    if (p !== undefined && p.name.toLocaleLowerCase("de") === candidate.toLocaleLowerCase("de")) return p;
  }
  return undefined;
}

/** How far, how many stops and how many departures each the answer around a place gives, as today's. */
export const NEAR_RADIUS_M = 5000;
export const NEAR_STOPS = 8;
const NEAR_PER_STOP = 4;
const NEAR_WINDOW_MIN = 60;

/** The point a place names: the place search first, else a stop of that name, else today's town-centre reading. */
async function nearPoint(args: Args, ctx: ToolContext): Promise<{ at: LatLon; label: string; metas: DataMeta[] } | CallToolResult> {
  const { language } = ctx;
  const place = num(args["lat"]) === undefined ? str(args["place"]) : undefined;
  // A street and house number keeps today's resolver and its refusal where no address data is held.
  if (place === undefined || looksLikeHouseNumber(place)) {
    const pos = await position(args, ctx);
    if (isResult(pos)) return pos;
    return { at: pos.at, label: aroundText(pos.label, pos.at), metas: [] };
  }
  const p = await ctx.api.get<T.PlaceItem[]>("listPlaces", { q: place, limit: 1 });
  if (p.data[0] !== undefined) { creditPlace(p.meta.attribution); return { at: p.data[0].location, label: p.data[0].name, metas: [] }; }
  const s = await ctx.api.get<T.Station[]>("listStations", { q: place, limit: 1 });
  const stop = s.data[0];
  if (stop !== undefined) {
    // A place that names a town takes a stop of that name only in that town (today's get_departures rule);
    // a place naming no town says that its point is a stop.
    const town = await townPlace(place, ctx);
    if (town === undefined) return { at: stop.location, label: L(language, `${place} (Haltestelle ${stop.name})`, `${place} (the stop ${stop.name})`), metas: [s.meta] };
    if (inTown(stop, town)) return { at: stop.location, label: place, metas: [s.meta] };
  }
  // The place search already missed the whole place: its town centre, never a second read of the same words.
  const centre = await townCentre(place, ctx);
  if (centre === undefined) return placeUnknown(ctx, place);
  return { at: centre.at, label: aroundText(centre.label, centre.at), metas: [] };
}

/** A stop lies in a town: the same Kreis key where both carry one, else the town's name in the stop's. */
const inTown = (stop: T.Station, town: T.PlaceItem): boolean => (stop.districtCode && town.districtCode
  ? stop.districtCode === town.districtCode
  : stop.name.toLocaleLowerCase("de").includes(town.name.toLocaleLowerCase("de")));

/**
 * The proposed listStopBoards: the API chooses the stops around the place (today's choice, the API's job) and
 * reads their boards in one call. Undefined, and the stops read one by one as before, when the API does not
 * offer it (404) or names no place for the text; any other failure is the API's failure.
 */
async function stopBoards(args: Args, ctx: ToolContext): Promise<Envelope<NonNullable<T.StopBoards>> | undefined> {
  const lat = num(args["lat"]);
  const lon = num(args["lon"]);
  const q = lat === undefined || lon === undefined ? str(args["place"]) : undefined;
  if (q === undefined && (lat === undefined || lon === undefined)) return undefined;
  try {
    const r = await ctx.api.get<T.StopBoards>("listStopBoards", {
      q, at: q === undefined ? atParam({ lat: lat!, lon: lon! }) : undefined, radius_m: NEAR_RADIUS_M, limit: NEAR_STOPS, per_stop: num(args["limit"]) ?? NEAR_PER_STOP,
      from: str(args["when"]), duration_min: num(args["duration_min"]) ?? NEAR_WINDOW_MIN, modes: strs(args["modes"]),
    });
    return r.data === null ? undefined : { ...r, data: r.data };
  } catch (err) {
    if (err instanceof ApiError && err.kind === "not_found") return undefined;
    throw err;
  }
}

/** Today's answer around a place: the head with the window's end, each stop with its stop_id and departures, the hint. */
function nearAnswer(label: string, stops: readonly { name: string; stopId: string; distanceM: number | null | undefined; departures: readonly T.Departure[] | null }[], metas: DataMeta[], language: Language, longDistance?: T.LongDistance | null): CallToolResult {
  const now = new Date();
  // Today's window around a place: the next 60 minutes from now, one end for the head and every empty stop.
  const to = timeBeside(new Date(now.getTime() + NEAR_WINDOW_MIN * 60_000).toISOString(), now, language);
  const c = BOARD[language];
  const live = anyLive(stops.flatMap((s) => s.departures ?? []));
  const lines = [c.nearHead(label, NEAR_RADIUS_M / 1000, to)];
  for (const s of stops) {
    const dist = s.distanceM === null || s.distanceM === undefined ? "" : ` (${kmText(s.distanceM, language)})`;
    lines.push(`${s.name}${dist} — stop_id ${s.stopId}:`);
    if (s.departures === null) lines.push(`  ${L(language, "Abfahrten nicht gelesen.", "departures not read.")}`);
    else if (s.departures.length === 0) lines.push(c.nearNone(to));
    else for (const d of s.departures) lines.push(`  ${boardLine(d, live, now, language)}`);
  }
  lines.push(L(language, "Mehr Abfahrten einer Haltestelle: get_departures mit ihrer stop_id.", "More departures of one stop: get_departures with its stop_id."));
  lines.push(...flixBlock(longDistance, now, language));
  return toolResult(lines.join("\n"), metas, language, { asOf: now.toISOString(), note: c.nearNote(live), ...(live ? { shareAlikeSubject: LIVE_SHARE_ALIKE_SUBJECT[language] } : {}) });
}

/** With a place or a position: the nearest stops (one per stop code) with their next departures, as today's answer. */
async function departuresNear(args: Args, ctx: ToolContext): Promise<CallToolResult> {
  const { language } = ctx;
  const one = await stopBoards(args, ctx);
  if (one !== undefined) {
    if (one.data.stops.length === 0) return none(language, [one.meta], L(language, "Haltestellen", "stops"));
    return nearAnswer(one.data.place.label, one.data.stops, [one.meta], language, one.data.longDistance);
  }
  const pt = await nearPoint(args, ctx);
  if (isResult(pt)) return pt;
  const near = await ctx.api.get<T.Station[]>("listStations", { at: atParam(pt.at), radius_m: NEAR_RADIUS_M, limit: 40 });
  const seen = new Set<string>();
  const stops = near.data.filter((s) => { const k = s.stopCode ?? s.id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, NEAR_STOPS);
  if (stops.length === 0) return none(language, [...pt.metas, near.meta], L(language, "Haltestellen", "stops"));
  // One stop's board that fails is said for that stop; the others still answer.
  const boards = await Promise.allSettled(stops.map((s) => ctx.api.get<T.Board>("listStationDepartures", {
    stationId: s.id, from: str(args["when"]), duration_min: num(args["duration_min"]) ?? NEAR_WINDOW_MIN, modes: strs(args["modes"]), limit: num(args["limit"]) ?? NEAR_PER_STOP,
  })));
  // Only the API's own failure is said per stop; anything else is a fault here and is not hidden.
  for (const b of boards) if (b.status === "rejected" && !(b.reason instanceof ApiError)) throw b.reason;
  if (boards.every((b) => b.status === "rejected")) return apiFailure((boards[0] as PromiseRejectedResult).reason, language);
  const rows = stops.map((s, i) => { const b = boards[i]!; return { name: s.name, stopId: s.id, distanceM: s.distanceM, departures: b.status === "fulfilled" ? b.value.data.departures : null }; });
  const metas = [...pt.metas, near.meta, ...boards.flatMap((b) => (b.status === "fulfilled" ? [b.value.meta] : []))];
  return nearAnswer(pt.label, rows, metas, language);
}

/** The API's own station id ("1:de:11000:900100003"), as the answer around a place prints it as stop_id. */
export const STATION_ID = /^\d+:\S+$/u;

const getDepartures: Handler = async (args, ctx) => {
  const { language } = ctx;
  const refusal = departuresRefusal(args, language);
  if (refusal !== null) return refusal;
  const given = (k: string): boolean => str(args[k]) !== undefined;
  if (!given("stop") && !given("stop_id") && !given("place") && (num(args["lat"]) === undefined || num(args["lon"]) === undefined)) return placeMissing(ctx);
  // A stop named or given by id is searched first; with only a place or a position the search has no
  // q or code to send (the API refuses that), so the stop nearest the position answers.
  const id = str(args["stop_id"]);
  if (id !== undefined && STATION_ID.test(id)) {
    // A station id this tool printed goes straight to its board; no lookup by code.
    const r = await ctx.api.get<T.Board>("listStationDepartures", { stationId: id, from: str(args["when"]), duration_min: num(args["duration_min"]), modes: strs(args["modes"]), limit: num(args["limit"]) })
      .catch((err: unknown) => { if (err instanceof ApiError && err.kind === "not_found") return null; throw err; });
    if (r === null) return NOT_KNOWN.stop(id, language);
    return boardAnswer(r, [r.meta], language);
  }
  // One way in (departuresRefusal): without a stop or stop_id, a place or a position was given.
  if (!given("stop") && !given("stop_id")) return departuresNear(args, ctx);
  const stations = await stationOf(args, ctx);
  const station = stations.data[0];
  if (station === undefined) {
    const asked = str(args["stop"]) ?? str(args["stop_id"]);
    if (asked === undefined) return none(language, [stations.meta], L(language, "Haltestellen", "stops"));
    // Today's server reads a town out of the stop's name and says the stop is not in THAT town.
    const town = str(args["stop"]) === undefined ? undefined : await townIn(asked, ctx);
    return town === undefined ? NOT_KNOWN.stop(asked, language) : toolError(STOP_IN_TOWN[language](asked, town));
  }
  const r = await ctx.api.get<T.Board>("listStationDepartures", { stationId: station.id, from: str(args["when"]), duration_min: num(args["duration_min"]), modes: strs(args["modes"]), limit: num(args["limit"]) });
  return boardAnswer(r, [stations.meta, r.meta], language);
};

function boardAnswer(r: Envelope<T.Board>, metas: DataMeta[], language: Language): CallToolResult {
  const now = new Date();
  const { station, window, departures } = r.data;
  const from = timeBeside(window.from, now, language), to = timeBeside(window.until, now, language);
  // Today's board is dated by the call, not by the plan's load time (its asOf: now).
  const asOf = now.toISOString();
  const live = anyLive(departures);
  // Today's note on what the times are and how far the timetable reaches, when the API says its reach.
  const note = boardNote(window, live, language);
  const noted = note === undefined ? {} : { note };
  if (departures.length === 0) {
    return toolResult(L(language, `Ab ${station.name} fährt zwischen ${from} und ${to} planmäßig nichts ab.`, `Nothing is scheduled to leave ${station.name} between ${from} and ${to}.`), metas, language, { asOf, ...noted });
  }
  const c = BOARD[language];
  const lines = [c.head(station.name, from, to, live), ...departures.map((d) => boardLine(d, live, now, language))];
  const more = (window.matched ?? departures.length) - departures.length;
  if (more > 0) lines.push(c.more(more));
  if (station.stopCode) lines.push(c.stopId(station.stopCode));
  return toolResult(lines.join("\n"), metas, language, { asOf, ...noted, ...(live ? { shareAlikeSubject: LIVE_SHARE_ALIKE_SUBJECT[language] } : {}) });
}

/** Today's words when a station tool is called with no station at all: ask, never search for nothing. */
const NEED_STATION = (language: Language): CallToolResult => toolError(L(language,
  'Bitte station (Bahnhofsname als Freitext) oder eva_no angeben. Hat die Person keinen Bahnhof genannt, bitte fragen, welchen. Zum Beispiel {"station": "Hannover Hbf"}.',
  'Give a station name (free text) or an eva_no. If the person named no station, ask which one. For example {"station": "Hannover Hbf"}.'));
const noStation = (args: Args): boolean => str(args["station"]) === undefined && str(args["eva_no"]) === undefined;

/** check_station_facilities' default list length (today's schema). */
const FACILITIES_LIMIT = 20;

const checkStationFacilities: Handler = async (args, ctx) => {
  const { language } = ctx;
  if (noStation(args)) return NEED_STATION(language);
  const stations = await stationOf(args, ctx, true);
  const station = stations.data[0];
  if (station === undefined) {
    const asked = str(args["station"]) ?? str(args["eva_no"]);
    return asked === undefined ? none(language, [stations.meta], L(language, "Bahnhöfe", "stations")) : NOT_KNOWN.facilityStation(asked, language);
  }
  const facility = str(args["facility"]);
  const kind = facility === "any" ? undefined : facility;
  // Today's default list length, sent so the counts and the list agree on it.
  const limit = num(args["limit"]) ?? FACILITIES_LIMIT;
  const r = await ctx.api.get<T.StationFacilitiesData>("listStationFacilities", { stationId: station.id, kind, limit });
  const d = r.data;
  // None of the asked kind: one more read, on this path only, says what DB does list ("nur 6 Fahrtreppen").
  const empty = d.counts.active + d.counts.inactive + d.counts.unknown === 0;
  const others = kind !== undefined && empty ? await ctx.api.get<T.StationFacilitiesData>("listStationFacilities", { stationId: station.id, limit: 50 }) : null;
  // Credited as today: the facilities read names its own sources (DB's station data among them); the station
  // lookup only found the id the read is keyed by, and none of its timetable data is said.
  return toolResult(facilitiesText(language, d, kind, limit, others?.data.facilities ?? []), [r.meta, ...(others === null ? [] : [others.meta])], language);
};

/** Today's DEFAULT_STATION_DEPARTURES (BOARD_MIN_ROWS), the catalogue's default: as many as the station page shows. */
const STATION_DEPARTURES = 10;

/** The proposed getStationPage: the page's sections; undefined where the API does not offer it (404) or holds no page. */
async function stationPage(stationId: string, departures: number, ctx: ToolContext): Promise<{ data: NonNullable<T.StationPage>; meta: DataMeta } | undefined> {
  try {
    const r = await ctx.api.get<T.StationPage>("getStationPage", { stationId, departures });
    return r.data === null ? undefined : { data: r.data, meta: r.meta };
  } catch (err) {
    if (err instanceof ApiError && err.kind === "not_found") return undefined;
    throw err;
  }
}

const describeStation: Handler = async (args, ctx) => {
  const { language } = ctx;
  if (noStation(args)) return NEED_STATION(language);
  const stations = await stationOf(args, ctx);
  const station = stations.data[0];
  if (station === undefined) {
    const eva = str(args["eva_no"]);
    const name = str(args["station"]);
    if (eva !== undefined) return NOT_KNOWN.eva(eva, language);
    return name === undefined ? none(language, [stations.meta], L(language, "Bahnhöfe", "stations")) : NOT_KNOWN.station(name, language);
  }
  const n = num(args["departures"]) ?? STATION_DEPARTURES;
  const page = await stationPage(station.id, n, ctx);
  if (page !== undefined) {
    const subject = shareAlikeSubjectOf(page.data, language);
    return toolResult(stationPageSectionsText(page.data, language, new Date()), [page.meta], language, subject === undefined ? {} : { shareAlikeSubject: subject });
  }
  const [fac, board] = await Promise.all([
    ctx.api.get<T.StationFacilitiesData>("listStationFacilities", { stationId: station.id }),
    n > 0 ? ctx.api.get<T.Board>("listStationDepartures", { stationId: station.id, limit: n }) : Promise.resolve(null),
  ]);
  return toolResult(stationPageText(language, station, fac, board), [stations.meta, fac.meta, ...(board === null ? [] : [board.meta])], language);
};

const LAT_LON = /^-?\d{1,2}(\.\d+)?,\s*-?\d{1,3}(\.\d+)?$/u;

/**
 * The platform key a watch is opened on (getWatch's `target`), from the person's words the way today's
 * server resolved them (watch_situation.ts, resolvedWatchKey): a place or a weather watch on the place's
 * position, a station on the station the search finds, a region on its official key. A road number, a
 * position, a station id, an official key and a charging site id go through as given.
 */
export async function watchTarget(kind: string, key: string, ctx: ToolContext): Promise<string | CallToolResult> {
  const r = await resolveWatch(kind, key, ctx);
  return isResult(r) ? r : r.target;
}

/** find_charging_station's defaults: the site a place's charger watch takes is one that list would show. */
const CHARGER_RADIUS_KM = 10;
const CHARGER_LIST = 5;

/**
 * A charger watch on a place waits on the nearest site find_charging_station lists that reports a live
 * status: a site that never reports would make a watch that never fires, so none is opened then.
 */
async function chargerByPlace(key: string, ctx: ToolContext): Promise<{ target: string; resolved?: Resolved } | CallToolResult> {
  const { language } = ctx;
  const pos = await position({ place: key }, ctx);
  if (isResult(pos)) return pos;
  const r = await ctx.api.get<T.ChargingSite[]>("listChargingOptions", { at: atParam(pos.at), radius_m: CHARGER_RADIUS_KM * 1000, limit: CHARGER_LIST });
  const label = pos.label ?? key;
  const site = r.data.find((x) => x.summary.availableNow !== null);
  if (site === undefined) {
    const reason = r.data.length === 0 ? "no_site_near" : "no_live_site";
    const text = r.data.length === 0
      ? L(language, `Im Umkreis von ${CHARGER_RADIUS_KM} km um ${label} kenne ich keinen Ladestandort, deshalb öffne ich keine Lade-Beobachtung. Bitte einen anderen Ort nennen.`,
        `I know no charging site within ${CHARGER_RADIUS_KM} km of ${label}, so I am not opening a charger watch. Name another place.`)
      : L(language, `Im Umkreis von ${CHARGER_RADIUS_KM} km um ${label} meldet kein Ladestandort eine Live-Belegung — eine Beobachtung würde nie auslösen, deshalb öffne ich keine. Die Standorte dort zeigt find_charging_station.`,
        `No charging site within ${CHARGER_RADIUS_KM} km of ${label} reports live occupancy — a watch would never fire, so I am not opening one. find_charging_station shows the sites there.`);
    return toolResult(text, [r.meta], language, { structured: { watchOpened: false, reason } });
  }
  for (const a of r.meta.attribution ?? []) creditPlace([a]);
  const name = site.name ?? site.id;
  const away = kmText(site.distanceM ?? 0, language);
  return { target: site.id, resolved: { from: key, label: name, what: {
    de: `nächster Ladestandort mit Live-Belegung, ${name} (${away} entfernt), Standort-ID ${site.id}`,
    en: `the nearest charging site with live occupancy, ${name} (${away} away), site id ${site.id}`,
  } } };
}

/** Verbatim from today's server (watch_situation.ts weatherNoCell). */
const WEATHER_NO_CELL: Record<Language, (label: string) => string> = {
  de: (label) => `Für ${label} kenne ich noch keine Warnzelle des DWD — dort wurde bisher keine Warnung geführt —, deshalb öffne ich keine Wetter-Beobachtung, die womöglich nie auslöst. Bitte einen größeren Ort in der Nähe nennen.`,
  en: (label) => `I know no DWD warn cell for ${label} yet — no warning has been held there so far — so I am not opening a weather watch that might never fire. Name a larger town nearby.`,
};

/**
 * A stop name the stop search does not hold, in watch_situation: today's server reads it with get_departures'
 * resolver (watch_situation.ts stationKey), so the town in the name is found by the same rule (townIn), and the
 * refusal is get_departures' own sentence followed by "no watch was opened".
 */
const NOT_OPENED: Record<Language, string> = { de: "Es wurde keine Beobachtung geöffnet.", en: "No watch was opened." };

async function stopNotFound(key: string, ctx: ToolContext): Promise<CallToolResult> {
  const town = await townIn(key, ctx);
  return toolError(`${town === undefined ? stopUnknown(key, ctx.language) : STOP_IN_TOWN[ctx.language](key, town)} ${NOT_OPENED[ctx.language]}`);
}

/** watchTarget, with what a station or a region named in words became, for the answer to say it. */
async function resolveWatch(kind: string, key: string, ctx: ToolContext): Promise<{ target: string; resolved?: Resolved; label?: string } | CallToolResult> {
  if (kind === "road") return { target: key.replace(/\s/g, "").toUpperCase() };
  if ((kind === "place" || kind === "weather") && !LAT_LON.test(key)) {
    const pos = await position({ place: key }, ctx);
    return isResult(pos) ? pos : { target: atParam(pos.at), label: pos.label ?? key };
  }
  if (kind === "place" || kind === "weather") return { target: key.replace(/\s/g, "") };
  if (kind === "station" && !/^[\w:-]*\d[\w:-]*$/u.test(key)) {
    const found = await ctx.api.get<T.Station[]>("listStations", { q: key, limit: 1 });
    const first = found.data[0];
    if (first === undefined) return stopNotFound(key, ctx);
    return { target: first.id, resolved: { from: key, label: first.name, what: { de: `Haltestelle ${first.name}, DHID ${first.id}`, en: `the stop ${first.name}, DHID ${first.id}` } } };
  }
  if (kind === "charger" && !(/\d/u.test(key) && !/\s/u.test(key))) return chargerByPlace(key, ctx);
  if (kind === "region") {
    const { code, metas } = await areaCode({ region: key }, ctx);
    if (code === undefined) return toolError(L(ctx.language, `Die Region „${key}“ habe ich nicht gefunden. Es wurde keine Beobachtung geöffnet.`, `I could not find the region "${key}". No watch was opened.`));
    if (/^[0-9]{2,12}$/u.test(key)) return { target: code };
    for (const m of metas) creditPlace(m.attribution ?? []);
    return { target: code, resolved: { from: key, label: key, what: { de: `Region ${key}, AGS ${code}`, en: `the region ${key}, AGS ${code}` } } };
  }
  return { target: key };
}

const watchSituation: Handler = async (args, ctx) => {
  const { language } = ctx;
  const kind = str(args["kind"]);
  const key = str(args["key"]);
  if (kind === undefined || key === undefined) return toolError(L(language, "kind und key sind nötig.", "kind and key are required."));
  const keyError = watchKeyError(kind, key, args["condition"], language);
  if (keyError !== null) return { ...toolError(keyError), _meta: { errorCode: "invalid_input" } };
  if (ctx.watches.list().length >= MAX_WATCHES) {
    return toolError(L(language,
      `Diese Sitzung hat bereits ${MAX_WATCHES} offene Beobachtungen — das Maximum ist ${MAX_WATCHES}. Beende eine mit stop_watch (die Liste steht in viafrei://watches) und versuche es dann noch einmal.`,
      `This session already has ${MAX_WATCHES} open watches — the limit is ${MAX_WATCHES}. End one with stop_watch (viafrei://watches lists them) and try again.`));
  }
  const resolved = await resolveWatch(kind, key, ctx);
  if (isResult(resolved)) return resolved;
  const target = resolved.target;
  const condition = args["condition"];
  const asked = ctx.api.get<T.WatchData>("getWatch", {
    kind, target, request: str(args["request"]), hours: num(args["hours"]), until: str(args["until"]),
    condition: condition === undefined ? undefined : JSON.stringify(condition),
  });
  // A place with no DWD warn cell: a fact of the data, answered as today's server answers it, not an error.
  const r = kind === "weather" && resolved.label !== undefined
    ? await asked.catch((err: unknown) => { if (err instanceof ApiError && err.kind === "not_found") return null; throw err; })
    : await asked;
  if (r === null) return toolResult(WEATHER_NO_CELL[language](resolved.label!), [], language, { structured: { watchOpened: false, reason: "no_warn_cell" } });
  const id = ctx.watches.add({ watchId: r.data.watchId, uri: r.data.uri, kind: r.data.kind, key: r.data.key }, key);
  // A place is said by its name, as it was asked; every other kind by the key the platform watches.
  return watchOpened({
    language, id, kind: r.data.kind, key: r.data.kind === "place" ? key : r.data.key, condition: r.data.condition, until: r.data.until,
    open: ctx.watches.list().length, note: r.data.note, ...(resolved.resolved === undefined ? {} : { resolved: resolved.resolved }),
  });
};

const stopWatch = stopWatchHandler(watchTarget);

export const HANDLERS: Readonly<Record<string, Handler>> = {
  check_autobahn_traffic: checkAutobahnTraffic,
  find_cheapest_fuel: findCheapestFuel,
  find_fuel_station: findFuelStation,
  find_parking: findParking,
  check_road_status: checkRoadStatus,
  find_roadworks_ahead: findRoadworksAhead,
  find_charging_station: findChargingStation,
  find_hydrogen_station: findHydrogenStation,
  find_speed_cameras: findSpeedCameras,
  find_place: findPlace,
  find_poi: findPoi,
  find_address: findAddress,
  describe_location: describeLocation,
  find_nearby: findNearby,
  find_sharing: findSharing,
  get_driving_rules: getDrivingRules,
  check_transit_disruption: checkTransitDisruption,
  check_weather_warnings: checkWeatherWarnings,
  get_train_departures: getTrainDepartures,
  get_departures: getDepartures,
  check_station_facilities: checkStationFacilities,
  describe_station: describeStation,
  watch_situation: watchSituation,
  stop_watch: stopWatch,
};

/**
 * What the contract lacks for today's behaviour, tool by tool. Kept here so a test can hold the PR body's
 * gap list to the code: each entry names the tool, the case and the operation it needs.
 */
export const GAPS: readonly { tool: string; case: string; needs: string }[] = [
  { tool: "*", case: "answers in the caller's language (language=de|en)", needs: "a language parameter (or Accept-Language) on every operation" },
  { tool: "find_roadworks_ahead", case: "a route from → to", needs: "a route/corridor road-conditions operation" },
  { tool: "watch_situation", case: "notifications when a watch reports (resources/updated)", needs: "a push or since-poll contract for watches" },
];
