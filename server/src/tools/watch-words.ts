/**
 * watch_situation's opened-watch answer in today's server's words (tools/watch_situation.ts): what is
 * watched, what the person's words became, the condition applied with its defaults said back, the end,
 * the slots in use, that it lives in this chat only, and how to end it. A watch shows no provider data,
 * so it credits the watch service alone (and the place search where a name was resolved).
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DataMeta } from "../api/client.js";
import { standTime, toolResult, type Language } from "../presentation.js";
import { KIND_LABEL, WATCH_CREDIT, watchUri } from "./stop-watch.js";

export const MAX_WATCHES = 10;

/** The condition keys each kind takes (today's WATCH_CONDITION_KEYS). */
const CONDITION_KEYS: Record<string, readonly string[]> = {
  road: ["event", "events"], station: ["delay_min"], region: ["late_share", "delay_min", "min_trips"],
  place: ["radius_km"], weather: ["min_level"], charger: ["point_id"],
};

/**
 * A watch refused before anything is read, in today's words (conditionKeyError, roadKeyError):
 * a condition key the kind does not take; a road watch keyed on a word with no digit (every road number has one,
 * "A7", "B 5", "L1001"), which is a town and could never fire.
 */
export function watchKeyError(kind: string, key: string, condition: unknown, language: Language): string | null {
  const de = language === "de";
  const allowed = CONDITION_KEYS[kind];
  const given = condition !== null && typeof condition === "object" ? Object.keys(condition) : [];
  const wrong = allowed === undefined ? [] : given.filter((k) => !allowed.includes(k));
  if (allowed !== undefined && wrong.length > 0) {
    const list = allowed.length === 0 ? (de ? "keine" : "none") : allowed.join(", ");
    return de
      ? `condition ${wrong.map((w) => `„${w}“`).join(", ")} passt nicht zu einer Beobachtung der Art „${kind}“ — diese Art nimmt: ${list}. Keine Beobachtung geöffnet.`
      : `condition ${wrong.map((w) => `"${w}"`).join(", ")} does not fit a "${kind}" watch — that kind takes: ${list}. No watch was opened.`;
  }
  if (kind !== "road" || /\d/u.test(key)) return null;
  return de
    ? `„${key}“ ist keine Straßennummer — eine road-Beobachtung braucht eine wie „A7“ oder „B5“. Für einen Ort: kind „place“ mit key „${key}“. Keine Beobachtung geöffnet.`
    : `"${key}" is not a road number — a road watch needs one such as "A7" or "B5". For a town use kind "place" with key "${key}". No watch was opened.`;
}

/** The condition the platform applies when the request sets none (getWatch's `condition`). */
const DEFAULTS: Record<string, Record<string, unknown>> = {
  road: { event: "any", events: ["restrictions"] },
  place: { radius_km: 25 },
  station: { delay_min: 10 },
  region: { late_share: 0.25, delay_min: 5, min_trips: 10 },
  weather: { min_level: 2 },
  charger: {},
};

/** The condition the watch applies, said back with its defaults filled in, never a promise wider than it. */
export function conditionSentence(kind: string, stored: Readonly<Record<string, unknown>> | null | undefined, language: Language): string {
  const c: Record<string, unknown> = { ...(DEFAULTS[kind] ?? {}), ...(stored ?? {}) };
  const de = language === "de";
  const n = (v: unknown): string => (de ? String(v).replace(".", ",") : String(v));
  const pct = (x: unknown): string => `${n(Math.round(Number(x) * 1000) / 10)} %`;
  switch (kind) {
    case "road": {
      const reopen = c["event"] === "reopen";
      const events = Array.isArray(c["events"]) ? (c["events"] as unknown[]) : [];
      const restrictions = events.includes("restrictions");
      const jams = events.includes("jams");
      const what = de
        ? [restrictions ? "eine Sperrung oder Einschränkung" : null, jams ? "ein Stau (gemeldet von der Autobahn GmbH oder der Polizei)" : null].filter((x) => x !== null).join(" oder ")
        : [restrictions ? "a closure or restriction" : null, jams ? "a jam (reported by the Autobahn GmbH or the police)" : null].filter((x) => x !== null).join(" or ");
      if (!jams) {
        return reopen
          ? de ? "Bedingung: nur wenn eine Sperrung oder Einschränkung aufgehoben wird." : "Condition: only when a closure or restriction is lifted."
          : de ? "Bedingung: wenn eine Sperrung oder Einschränkung neu auftritt oder aufgehoben wird." : "Condition: when a closure or restriction appears or is lifted.";
      }
      if (reopen) return de ? `Bedingung: nur wenn ${what} aufgehoben wird oder sich auflöst.` : `Condition: only when ${what} is lifted or clears.`;
      return de ? `Bedingung: wenn ${what} neu auftritt, aufgehoben wird oder sich auflöst.` : `Condition: when ${what} appears, is lifted or clears.`;
    }
    case "station":
      return de ? `Bedingung: Abfahrten mit ${n(c["delay_min"])} Minuten Verspätung oder mehr.` : `Condition: departures running ${n(c["delay_min"])} minutes late or more.`;
    case "region":
      return de
        ? `Bedingung: mindestens ${pct(c["late_share"])} der beobachteten Fahrten mit ${n(c["delay_min"])} Minuten Verspätung oder mehr, bei mindestens ${n(c["min_trips"])} Fahrten.`
        : `Condition: at least ${pct(c["late_share"])} of observed trips running ${n(c["delay_min"])} minutes late or more, over at least ${n(c["min_trips"])} trips.`;
    case "place":
      return de ? `Bedingung: neue Sperrungen oder Einschränkungen im Umkreis von ${n(c["radius_km"])} km.` : `Condition: new closures or restrictions within ${n(c["radius_km"])} km.`;
    case "weather":
      return de ? `Bedingung: amtliche DWD-Warnungen ab Warnstufe ${n(c["min_level"])}.` : `Condition: official DWD warnings of level ${n(c["min_level"])} or higher.`;
    default:
      return typeof c["point_id"] === "string"
        ? de ? `Bedingung: wenn der Ladepunkt ${c["point_id"]} frei wird.` : `Condition: when charge point ${c["point_id"]} becomes free.`
        : de ? "Bedingung: wenn ein Ladepunkt des Standorts frei wird." : "Condition: when a charge point of the site becomes free.";
  }
}

const COPY = {
  de: {
    head: (kind: string, key: string) => `Ich beobachte ${kind} ${key} und melde mich hier.`,
    until: (t: string) => `Läuft bis ${t}.`,
    slots: (open: number) => `${open} von ${MAX_WATCHES} Beobachtungen dieser Sitzung belegt.`,
    scope: "Nur in diesem Chat: Ich kann keine E-Mail, keine Nachricht und keinen Alarm außerhalb dieses Gesprächs schicken. Wenn die Sitzung endet, endet die Beobachtung.",
    stop: (uri: string) => `Zum Beenden: stop_watch mit ${uri}.`,
    resolved: (from: string, what: string) => `Aus "${from}" aufgelöst: ${what}.`,
  },
  en: {
    head: (kind: string, key: string) => `I am watching ${kind} ${key} and will tell you here.`,
    until: (t: string) => `It runs until ${t}.`,
    slots: (open: number) => `${open} of ${MAX_WATCHES} watches in use for this session.`,
    scope: "In this chat only: I cannot send an e-mail, a message or any alert outside this conversation. When the session ends, the watch ends with it.",
    stop: (uri: string) => `To end it: stop_watch with ${uri}.`,
    resolved: (from: string, what: string) => `Resolved from "${from}": ${what}.`,
  },
} as const;

/** What the person's words became, said as today's server says it; absent when they were the key. */
export type Resolved = { from: string; label: string; what: Record<Language, string> };

export function watchOpened(o: {
  language: Language; id: number; kind: string; key: string; condition: Readonly<Record<string, unknown>> | null | undefined;
  until: string; open: number; resolved?: Resolved; note: string | null;
  /** How the head names what is watched when it is not the key (a station by its name); structuredContent.key stays the key. */
  label?: string;
}): CallToolResult {
  const { language } = o;
  const c = COPY[language];
  const uri = watchUri(o.id);
  const now = new Date();
  const text = [
    o.note,
    c.head(KIND_LABEL[o.kind]?.[language] ?? o.kind, o.label ?? o.key),
    o.resolved === undefined ? null : c.resolved(o.resolved.from, o.resolved.what[language]),
    conditionSentence(o.kind, o.condition, language),
    c.until(standTime(o.until, language, now)),
    c.slots(o.open),
    c.scope,
    c.stop(uri),
  ].filter((l): l is string => l !== null).join(" ");
  const meta: DataMeta = { requestId: "", generatedAt: now.toISOString(), language, attribution: [WATCH_CREDIT] };
  const result = toolResult(text, [meta], language, {
    structured: {
      uri, watchId: o.id, kind: o.kind, key: o.key, condition: { ...(DEFAULTS[o.kind] ?? {}), ...(o.condition ?? {}) },
      expiresAt: new Date(o.until).toISOString(), openWatches: o.open, maxWatches: MAX_WATCHES, scope: "session", externalChannels: false,
      ...(o.resolved === undefined ? {} : { resolvedFrom: o.resolved.from, resolvedLabel: o.resolved.label }),
    },
  });
  // A thing asked for that this watch does not report is said first, inline, and carried as the condition note.
  if (o.note !== null) result._meta = { ...result._meta, conditionNote: o.note };
  return result;
}
