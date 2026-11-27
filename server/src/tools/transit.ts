/**
 * check_transit_disruption: a region's realtime window and its service alerts (transit-words.ts), from what
 * API 2.0.4 carries; a line asked alone, its alerts anywhere. Never a bare "no disruptions" where trips are late
 * or where the alert feeds could not be asked.
 */function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type * as T from "../api/types.js";
import { toolError, toolResult, type Language } from "../presentation.js";
import { num, placeMissing, str, type Handler } from "./context.js";
import { kmText } from "./nearby.js";
import { regionOf, type Region } from "./region.js";
import { alertLines, regionAnswer } from "./transit-words.js";
const L = (language: Language, de: string, en: string): string => language === "de" ? de : en;

/** Verbatim from today's server (changeOnlyNote, perLineNote for DELFI, windowPhrase, townNote, alertBlock). */
export const TRANSIT_WORDS = {
  changeOnly: {
    de: "Die Quelle meldet nur Änderungen: die Zahlen beruhen auf den Fahrten, deren Verspätung sich im Zeitfenster bewegt hat, nicht auf allen Fahrten. Wenig Meldungen heißt daher nicht automatisch \"alles pünktlich\".",
    en: "The source reports changes only: these figures cover the trips whose delay moved during the window, not every trip. Few reports therefore does not by itself mean \"everything on time\"."
  },
  perLine: {
    de: "Einzelne Linien, Fahrten oder Haltestellen kann ich mit diesen Verspätungszahlen nicht beurteilen — die Echtzeitdaten kommen ohne Linienbezug, und ihre Lizenz erlaubt nur Summen über die Region.",
    en: "Individual lines, trips or stops cannot be judged from these delay figures — the realtime data arrives with no line reference, and its licence permits region-wide totals only."
  },
  window: (language: Language, minutes: number): string => L(language, `in den letzten ${minutes} Minuten`, `in the last ${minutes} minutes`),
  placed: (language: Language, m: number): string => L(language, ` (nächstgelegene Region zum Punkt, Mittelpunkt ${kmText(m, language)} entfernt)`, ` (nearest region to the point, centre ${kmText(m, language)} away)`),
  town: (language: Language, town: string): string => L(language, ` (der Kreis, in dem ${town} liegt — die Daten sind je Kreis erfasst)`, ` (the district ${town} lies in — the data is filed per district)`),
  alertsNotCurrent: (language: Language, label: string): string => L(language, `Störungsmeldungen für ${label}: Die Meldungsquellen sind gerade nicht aktuell, daher kann ich nicht sagen, ob Umleitungen oder Sperrungen gemeldet sind.`, `Service alerts for ${label}: the alert feeds are not current right now, so I cannot say whether any diversions or closures are published.`),
  unknownRegion: (language: Language, q: string): string => L(language, `"${q}" kenne ich als Region nicht. Die Daten sind auf Kreisebene gemeldet — bitte ein Bundesland, eine kreisfreie Stadt oder den Kreis nennen (z. B. "Bayern", "Köln", "Landkreis Fulda").`, `I do not know "${q}" as a region. The data is filed at Kreis level — name a Bundesland, a city or the Kreis (for example "Bayern", "Köln", "Landkreis Fulda").`)
} as const;
export const checkTransitDisruption: Handler = async (args, ctx): Promise<CallToolResult> => {
  const {
    language
  } = ctx;
  const line = str(args["line"]);
  if (line === undefined && str(args["region"]) === undefined && (num(args["lat"]) === undefined || num(args["lon"]) === undefined)) return placeMissing(ctx);
  const where = await regionOf(args, ctx);
  if (where.code === undefined && line === undefined) {
    const region = str(args["region"]);
    return region === undefined ? toolResult(L(language, "Diese Region kenne ich nicht.", "I do not know this region."), where.metas, language) : toolError(TRANSIT_WORDS.unknownRegion(language, region), "not_found", "region");
  }
  const r = await ctx.api.get<T.DisruptionData>("listTransitDisruptions", {
    area: where.code,
    line,
    window_min: num(args["window_min"])
  });
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
  if (stryMutAct_9fa48("861")) {
    {}
  } else {
    stryCov_9fa48("861");
    return stryMutAct_9fa48("862") ? [] : (stryCov_9fa48("862"), [...alertLines(language, label, data), ...timetableNote(language, label, data)]);
  }
}

/** The timetable's word on the line asked, only when it was there to ask and knows no such line. */
function timetableNote(language: Language, label: string, data: T.DisruptionData): string[] {
  if (stryMutAct_9fa48("863")) {
    {}
  } else {
    stryCov_9fa48("863");
    const t = stryMutAct_9fa48("864") ? data.line && null : (stryCov_9fa48("864"), data.line ?? null);
    if (stryMutAct_9fa48("867") ? (t === null || !t.checked) && t.inTimetable : stryMutAct_9fa48("866") ? false : stryMutAct_9fa48("865") ? true : (stryCov_9fa48("865", "866", "867"), (stryMutAct_9fa48("869") ? t === null && !t.checked : stryMutAct_9fa48("868") ? false : (stryCov_9fa48("868", "869"), (stryMutAct_9fa48("871") ? t !== null : stryMutAct_9fa48("870") ? false : (stryCov_9fa48("870", "871"), t === null)) || (stryMutAct_9fa48("872") ? t.checked : (stryCov_9fa48("872"), !t.checked)))) || t.inTimetable)) return stryMutAct_9fa48("873") ? ["Stryker was here"] : (stryCov_9fa48("873"), []);
    return stryMutAct_9fa48("874") ? [] : (stryCov_9fa48("874"), [L(language, stryMutAct_9fa48("875") ? `` : (stryCov_9fa48("875"), `Eine ${label} steht in keinem Fahrplan, den ich lese — bitte den Liniennamen prüfen.`), stryMutAct_9fa48("876") ? `` : (stryCov_9fa48("876"), `No ${label} is in any timetable I read — check the line name.`))]);
  }
}