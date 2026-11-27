/**
 * check_road_status's answer for a road asked by its number, in today's words (headLine,
 * itemLines, tailLines, the road-status COPY and strategyLine), from the proposed `roadStatus` the API is asked to
 * send: the tally of the window, the page's entries, the rest counted, the sources that answered with their
 * Stand, the Autobahn GmbH's traffic guidance, and why planned works are answered by road.
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
import type { Language } from "../presentation.js";
import { berlinTime } from "../presentation.js";
import type * as T from "../api/types.js";
import { excerpt, factWords, KIND } from "./handlers.js";
import type { DataMeta } from "../api/client.js";
const L = (language: Language, de: string, en: string): string => language === "de" ? de : en;
/** Today's MAX_LIMIT: one answer holds at most this many entries. */
export const ROAD_STATUS_MAX = 11;

/** Today's dayText: the Berlin day ("2026-11-26", "26.11.2026"). */
export function dayText(iso: string, language: Language): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(iso));
  return language === "de" ? `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}` : day;
}
const n = (k: number, one: string, many: string): string => `${k} ${k === 1 ? one : many}`;
const names = (language: Language, xs: readonly string[]): string => xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} ${L(language, "und", "and")} ${xs[xs.length - 1]!}`;

/** Today's head line: the tally, its publishers, the window. */
export function roadStatusHead(road: string, s: T.RoadStatus, language: Language): string {
  const c = s.counts;
  const list = language === "de" ? [n(c.closed, "Sperrung", "Sperrungen"), n(c.restricted, "Einschränkung", "Einschränkungen"), n(c.planned, "geplante Arbeitsstelle", "geplante Arbeitsstellen"), ...(c.current > 0 ? [`${n(c.current, "laufende Arbeitsstelle", "laufende Arbeitsstellen")} laut ${names(language, c.currentBy)}`] : [])] : [n(c.closed, "closure", "closures"), n(c.restricted, "restriction", "restrictions"), `${c.planned} planned roadworks ${c.planned === 1 ? "site" : "sites"}`, ...(c.current > 0 ? [`${c.current} current roadworks ${c.current === 1 ? "site" : "sites"} per ${names(language, c.currentBy)}`] : [])];
  const window = s.windowEnd === null ? L(language, "Zeitraum: jetzt", "window: right now") : L(language, `Zeitraum bis ${dayText(s.windowEnd, language)}`, `window until ${dayText(s.windowEnd, language)}`);
  return `${road}: ${list.join(", ")} — ${window}.`;
}

/** Today's entry line: the label, the road where it is named, the publisher's words, the facts, the span. */
export function roadStatusItem(i: T.RoadStatusItem, language: Language): string {
  const end = i.to;
  const backwards = i.from !== null && end !== null && new Date(end).getTime() < new Date(i.from).getTime();
  const span = [i.from === null ? "" : dayText(i.from, language), end === null || backwards ? "" : dayText(end, language)].filter(x => x !== "").join("–");
  const whole = i.measureTo === null ? "" : L(language, `Gesamtmaßnahme bis ${dayText(i.measureTo, language)}`, `whole measure until ${dayText(i.measureTo, language)}`);
  const dates = [span, whole].filter(x => x !== "").join(", ");
  const facts = language !== "en" || i.facts === null ? [] : factWords(i.facts);
  const shown = i.shown === "" ? "" : `: ${language === "en" ? `Provider text (German): "${i.shown}"` : i.shown}`;
  return `• ${i.label}${i.namedRoad ? ` ${i.road}` : ""}${shown}${facts.length === 0 ? "" : ` — ${facts.join(", ")}`}${dates === "" ? "" : ` (${dates})`}`;
}

/** Today's "… N more" line: by road, one answer holds at most ROAD_STATUS_MAX. */
export function roadStatusMore(hidden: number, closures: number, canRaise: boolean, language: Language): string | null {
  if (hidden <= 0) return null;
  const m = ROAD_STATUS_MAX;
  return L(language, `… ${hidden} ${hidden === 1 ? "weiterer Eintrag" : "weitere Einträge"}${closures > 0 ? `, davon ${n(closures, "Sperrung", "Sperrungen")}` : ""}; ` + (canRaise ? `mit einem höheren limit (max ${m}) abrufen oder mit place eingrenzen (road und place zusammen).` : `eine Antwort fasst höchstens ${m} — mit place eingrenzen (road und place zusammen), den Zeitraum verkürzen oder eine einzelne Straße abfragen.`), `… ${hidden} more ${hidden === 1 ? "entry" : "entries"}${closures > 0 ? `, ${closures} of them ${closures === 1 ? "a closure" : "closures"}` : ""}; ` + (canRaise ? `ask again with a higher limit (max ${m}) or narrow it with a place (road and place together).` : `one answer holds at most ${m} — narrow it with a place (road and place together), shorten the window or ask about a single road.`));
}

/** Today's strategyLine for guidance: the publisher's title and words, its own English on an English answer. */
export function guidanceLine(g: T.RoadGuidance, language: Language): string {
  const until = g.until === null ? "" : L(language, ` bis ${berlinTime(g.until)}`, ` until ${berlinTime(g.until)}`);
  const place = [g.from, g.to].filter((x): x is string => x !== null && x.trim() !== "").join(" – ");
  const where = `${until})${place === "" ? "" : L(language, ` bei ${place}`, ` at ${place}`)}${g.via === null ? "" : L(language, `: über ${g.via}`, `: via ${g.via}`)}`;
  const title = language === "de" ? g.title : g.titleEn;
  const words = language === "de" ? g.words : g.wordsEn;
  const quoted = [title, words === title ? null : words].filter((x): x is string => x !== null && x.trim() !== "").map(w => language === "de" ? `„${w}“` : `"${w}"`);
  return L(language, `• Verkehrslenkung der Autobahn GmbH (strategisches Routing, geschaltet${where}${quoted.length === 0 ? "" : `: ${quoted.join(" — ")}`}. Empfehlung der Autobahn GmbH, keine Routenempfehlung von ViaFrei.`, `• Traffic guidance by the Autobahn GmbH (strategic routing, switched on${where}${quoted.length === 0 ? "" : `: ${quoted.join(" — ")} (the Autobahn GmbH's own words)`}. The Autobahn GmbH's recommendation, not a route of ViaFrei's.`);
}

/** The whole answer's body: head, entries, the rest, the sources that answered, the guidance, the by-road note. */
export function roadStatusText(road: string, s: T.RoadStatus, language: Language, now: Date = new Date()): string {
  const answered = s.sourcesAnswered.map(x => x.asOf === null ? x.label : `${x.label} — ${L(language, "Stand", "As of")} ${standOf(x.asOf, language, now)}`).join("; ");
  return [roadStatusHead(road, s, language), ...s.items.map(i => roadStatusItem(i, language)), roadStatusMore(s.hidden, s.hiddenClosures, s.canRaise, language), L(language, `Geantwortet haben: ${answered}.`, `Sources that answered: ${answered}.`), ...s.guidance.map(g => guidanceLine(g, language)), s.plannedByRoad ? L(language, "Geplante Arbeitsstellen werden nach Straße und Abschnitt geführt — die Planungsdaten enthalten keine Koordinaten, deshalb wird hier nach Straße geantwortet und nicht nach Umkreis.", "Planned roadworks are filed by road and section — the planning data carries no coordinates at all, so this is answered by road rather than by radius.") : null].filter((x): x is string => x !== null).join("\n");
}

/** Today's asOfLabel time: the clock today, the day beside it otherwise. */
function standOf(iso: string, language: Language, now: Date): string {
  const same = dayText(iso, "en") === dayText(now.toISOString(), "en");
  return same ? berlinTime(iso) : `${language === "de" ? dayText(iso, "de").slice(0, 6) : dayText(iso, "en")} ${berlinTime(iso)}`;
}

/** A planned or current works entry is named by its bucket; any other by the term the API calls it. */
const BUCKET: Record<Language, Record<string, string>> = {
  de: {
    planned: "Geplante Arbeitsstelle",
    current: "Laufende Arbeitsstelle",
    programme: "Arbeitsstelle eines Bauprogramms"
  },
  en: {
    planned: "Planned roadworks (geplante Arbeitsstelle)",
    current: "Current roadworks (laufende Arbeitsstelle)",
    programme: "Works programme site (Bauprogramm)"
  }
};

/** A source's name as its attribution line opens ("Arbeitsstellen: Bundesanstalt für Straßen- und Verkehrswesen (BASt)"), its family when none. */
export function sourceName(family: string, meta: DataMeta): string {
  const text = meta.attribution?.find(a => a.family === family)?.text;
  if (text === undefined) return family;
  const cut = [" via ", " | ", ", ", " — "].map(m => text.indexOf(m)).filter(i => i > 0);
  return (cut.length === 0 ? text : text.slice(0, Math.min(...cut))).trim();
}

/** The publisher a source's name holds ("Arbeitsstellen: Bundesanstalt … (BASt)" → "Bundesanstalt … (BASt)"): the tally names who counted, not the dataset. */
export function publisherOf(name: string): string {
  const colon = name.indexOf(": ");
  // "Die Autobahn GmbH des Bundes" and "Autobahn GmbH des Bundes" are one publisher: a leading article is not its name.
  return (colon < 0 ? name : name.slice(colon + 2)).trim().replace(/^(?:Die|Der|Das)\s+/u, "");
}

/** A source named in the "answered" line, quoted: its name carries a colon of its own. */
const quoted = (name: string, language: Language): string => language === "de" ? `„${name}“` : `"${name}"`;

/** API 2.0.4's roadStatus read into the answer's words: the publishers named, each entry's label and provider text. */
export function roadStatusOf(s: T.ApiRoadStatus, meta: DataMeta, language: Language): T.RoadStatus {
  if (stryMutAct_9fa48("807")) {
    {}
  } else {
    stryCov_9fa48("807");
    const item = (i: T.ApiRoadStatusItem): T.RoadStatusItem => {
      if (stryMutAct_9fa48("808")) {
        {}
      } else {
        stryCov_9fa48("808");
        // The road operator's entry: its title, the junction, its description; another publisher's: its message as published.
        const words = (stryMutAct_9fa48("811") ? i.sourceFamily !== "autobahn" : stryMutAct_9fa48("810") ? false : stryMutAct_9fa48("809") ? true : (stryCov_9fa48("809", "810", "811"), i.sourceFamily === (stryMutAct_9fa48("812") ? "" : (stryCov_9fa48("812"), "autobahn")))) ? stryMutAct_9fa48("813") ? [[i.title, i.subtitle].filter((x): x is string => x !== null && x.trim() !== "").join(" · "), i.description.join(" ")].join(" — ") : (stryCov_9fa48("813"), (stryMutAct_9fa48("814") ? [] : (stryCov_9fa48("814"), [stryMutAct_9fa48("815") ? [i.title, i.subtitle].join(" · ") : (stryCov_9fa48("815"), (stryMutAct_9fa48("816") ? [] : (stryCov_9fa48("816"), [i.title, i.subtitle])).filter(stryMutAct_9fa48("817") ? () => undefined : (stryCov_9fa48("817"), (x): x is string => stryMutAct_9fa48("820") ? x !== null || x.trim() !== "" : stryMutAct_9fa48("819") ? false : stryMutAct_9fa48("818") ? true : (stryCov_9fa48("818", "819", "820"), (stryMutAct_9fa48("822") ? x === null : stryMutAct_9fa48("821") ? true : (stryCov_9fa48("821", "822"), x !== null)) && (stryMutAct_9fa48("824") ? x.trim() === "" : stryMutAct_9fa48("823") ? true : (stryCov_9fa48("823", "824"), (stryMutAct_9fa48("825") ? x : (stryCov_9fa48("825"), x.trim())) !== (stryMutAct_9fa48("826") ? "Stryker was here!" : (stryCov_9fa48("826"), ""))))))).join(stryMutAct_9fa48("827") ? "" : (stryCov_9fa48("827"), " · "))), i.description.join(stryMutAct_9fa48("828") ? "" : (stryCov_9fa48("828"), " "))])).filter(stryMutAct_9fa48("829") ? () => undefined : (stryCov_9fa48("829"), x => stryMutAct_9fa48("832") ? x.trim() === "" : stryMutAct_9fa48("831") ? false : stryMutAct_9fa48("830") ? true : (stryCov_9fa48("830", "831", "832"), (stryMutAct_9fa48("833") ? x : (stryCov_9fa48("833"), x.trim())) !== (stryMutAct_9fa48("834") ? "Stryker was here!" : (stryCov_9fa48("834"), ""))))).join(stryMutAct_9fa48("835") ? "" : (stryCov_9fa48("835"), " — "))) : stryMutAct_9fa48("836") ? (i.detail ?? i.place ?? i.title) && "" : (stryCov_9fa48("836"), (stryMutAct_9fa48("837") ? (i.detail ?? i.place) && i.title : (stryCov_9fa48("837"), (stryMutAct_9fa48("838") ? i.detail && i.place : (stryCov_9fa48("838"), i.detail ?? i.place)) ?? i.title)) ?? (stryMutAct_9fa48("839") ? "Stryker was here!" : (stryCov_9fa48("839"), "")));
        return stryMutAct_9fa48("840") ? {} : (stryCov_9fa48("840"), {
          label: stryMutAct_9fa48("841") ? (BUCKET[language][i.status] ?? KIND[language][i.term]) && i.term : (stryCov_9fa48("841"), (stryMutAct_9fa48("842") ? BUCKET[language][i.status] && KIND[language][i.term] : (stryCov_9fa48("842"), BUCKET[language][i.status] ?? KIND[language][i.term])) ?? i.term),
          road: i.road,
          namedRoad: stryMutAct_9fa48("845") ? i.sourceFamily === "autobahn" : stryMutAct_9fa48("844") ? false : stryMutAct_9fa48("843") ? true : (stryCov_9fa48("843", "844", "845"), i.sourceFamily !== (stryMutAct_9fa48("846") ? "" : (stryCov_9fa48("846"), "autobahn"))),
          shown: (stryMutAct_9fa48("849") ? words.trim() !== "" : stryMutAct_9fa48("848") ? false : stryMutAct_9fa48("847") ? true : (stryCov_9fa48("847", "848", "849"), (stryMutAct_9fa48("850") ? words : (stryCov_9fa48("850"), words.trim())) === (stryMutAct_9fa48("851") ? "Stryker was here!" : (stryCov_9fa48("851"), "")))) ? stryMutAct_9fa48("852") ? "Stryker was here!" : (stryCov_9fa48("852"), "") : excerpt(words),
          facts: null,
          from: i.from,
          to: i.to,
          measureTo: i.measureTo
        });
      }
    };
    return stryMutAct_9fa48("853") ? {} : (stryCov_9fa48("853"), {
      counts: stryMutAct_9fa48("854") ? {} : (stryCov_9fa48("854"), {
        closed: s.counts.closed,
        restricted: s.counts.restricted,
        planned: s.counts.planned,
        current: s.counts.current,
        currentBy: stryMutAct_9fa48("855") ? [] : (stryCov_9fa48("855"), [...new Set(s.counts.currentFamilies.map(stryMutAct_9fa48("856") ? () => undefined : (stryCov_9fa48("856"), f => publisherOf(sourceName(f, meta)))))])
      }),
      windowEnd: s.windowEnd,
      items: s.items.map(item),
      hidden: s.hidden,
      hiddenClosures: s.hiddenClosures,
      canRaise: s.canRaise,
      sourcesAnswered: s.sourcesAnswered.map(stryMutAct_9fa48("857") ? () => undefined : (stryCov_9fa48("857"), x => stryMutAct_9fa48("858") ? {} : (stryCov_9fa48("858"), {
        label: quoted(sourceName(x.sourceFamily, meta), language),
        asOf: x.asOf
      }))),
      guidance: s.guidance.map(stryMutAct_9fa48("859") ? () => undefined : (stryCov_9fa48("859"), g => stryMutAct_9fa48("860") ? {} : (stryCov_9fa48("860"), {
        title: g.title,
        titleEn: g.titleEnglish,
        words: g.words,
        wordsEn: g.wordsEnglish,
        from: g.from,
        to: g.to,
        via: g.via,
        until: g.until
      }))),
      plannedByRoad: s.plannedWorksHaveNoCoordinates
    });
  }
}