/**
 * stop_watch, in today's server's words (tools/stop_watch.ts, stop_watch.schema.ts): a watch is named by
 * its number, its uri, or its subject (kind and/or key) among this session's open watches only. One match
 * is stopped; several are listed and none is stopped; none says what is open. Nothing here reads the API
 * but the subject's resolution, the way watch_situation resolved it.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DataMeta } from "../api/client.js";
import { toolError, toolResult, type Language } from "../presentation.js";
import { isResult, num, str, type Handler, type ToolContext } from "./context.js";

/** The watch service's own credit: no provider data, every report names the source behind it. */
export const WATCH_CREDIT = {
  family: "viafrei_watch",
  text: "Beobachtung: ViaFrei, eigener Dienst — jede Meldung nennt die Quelle der Daten, die sie ausgelöst haben / Watch: ViaFrei, our own service — every report names the source of the data behind it",
  licence: "ViaFrei service metadata (no provider data)",
  // today's register row (own-content viafrei_watch) gives the service's own address, printed after the line
  termsUrl: "https://viafrei.de",
} as const;

export const watchUri = (id: number): string => `viafrei://watch/${id}`;

/** German in the accusative, after "für" (watch_situation.ts KIND_LABEL). */
export const KIND_LABEL: Record<string, Record<Language, string>> = {
  road: { de: "die Straße", en: "road" },
  station: { de: "die Haltestelle", en: "stop" },
  region: { de: "die Region", en: "region" },
  place: { de: "den Ort", en: "place" },
  weather: { de: "die Wetterlage für", en: "the weather warning cell" },
  charger: { de: "den Ladestandort", en: "charging site" },
};

const COPY = {
  de: {
    name: "Bitte die Beobachtung nennen, die beendet werden soll: `watch_id` (die Nummer), `uri` (\"viafrei://watch/12\") oder ihren Gegenstand als `kind` und/oder `key` (\"A8\"). viafrei://watches listet die offenen Beobachtungen dieser Sitzung.",
    idAndSubject: "Bitte entweder die Nummer der Beobachtung (`watch_id` oder `uri`) oder ihren Gegenstand (`kind`/`key`) angeben, nicht beides — widersprechen sich die beiden, würde eine Beobachtung beendet, die niemand genannt hat.",
    idAndUri: "Bitte entweder `watch_id` oder `uri` angeben, nicht beides — widersprechen sich die beiden, würde eine Beobachtung beendet, die niemand genannt hat.",
    stopped: (uri: string) => `Beobachtung beendet: ${uri}. Ich melde mich dazu nicht mehr.`,
    absent: (uri: string) => `Zu ${uri} läuft in dieser Sitzung keine Beobachtung — entweder ist sie schon beendet oder abgelaufen, oder diese Nummer gehört nicht zu diesem Gespräch. Die offenen Beobachtungen stehen in viafrei://watches.`,
    badUri: "Das ist keine Beobachtungs-Adresse. Erwartet wird \"viafrei://watch/12\" oder die Nummer in `watch_id`.",
    stoppedSubject: (what: string, uri: string) => `Beobachtung für ${what} beendet (${uri}). Ich melde mich dazu nicht mehr.`,
    noMatch: (open: string) => open === ""
      ? "Dazu läuft in dieser Sitzung keine Beobachtung — es ist gerade keine offen, also gibt es nichts zu beenden. Eine Beobachtung gehört zu der Sitzung, in der sie geöffnet wurde: Wurde die Verbindung seitdem neu aufgebaut, ist sie mit der alten Sitzung abgelaufen und meldet nichts mehr."
      : `Dazu läuft in dieser Sitzung keine Beobachtung. Offen sind: ${open}. Zum Beenden einer davon: stop_watch mit ihrer watch_id.`,
    several: (list: string) => `Dazu passen mehrere Beobachtungen, deshalb habe ich keine beendet: ${list}. Bitte eine wählen und stop_watch mit ihrer watch_id aufrufen.`,
    byKindOnly: (key: string, what: string, uri: string) => `Keine offene Beobachtung trägt den Schlüssel "${key}"; die einzige offene dieser Art ist die Beobachtung für ${what} (${uri}), deshalb habe ich sie beendet. Ich melde mich dazu nicht mehr.`,
    severalByKind: (key: string, list: string) => `Keine offene Beobachtung trägt den Schlüssel "${key}", und von dieser Art sind mehrere offen, deshalb habe ich keine beendet: ${list}. Bitte eine wählen und stop_watch mit ihrer watch_id aufrufen.`,
    on: "für",
  },
  en: {
    name: "Name the watch to stop: `watch_id` (the number), `uri` (\"viafrei://watch/12\"), or its subject as `kind` and/or `key` (\"A8\"). Read viafrei://watches to see this session's open watches.",
    idAndSubject: "Give either the watch's id (`watch_id` or `uri`) or its subject (`kind`/`key`), not both — if they disagree I would be stopping a watch nobody named.",
    idAndUri: "Give either `watch_id` or `uri`, not both — if they disagree I would be stopping a watch nobody named.",
    stopped: (uri: string) => `Watch ended: ${uri}. You will hear nothing further about it.`,
    absent: (uri: string) => `There is no watch at ${uri} in this session — it has already been stopped or has expired, or that number belongs to a different conversation. viafrei://watches lists the open ones.`,
    badUri: "That is not a watch address. Expected \"viafrei://watch/12\", or the number in `watch_id`.",
    stoppedSubject: (what: string, uri: string) => `Watch ended: ${what} (${uri}). You will hear nothing further about it.`,
    noMatch: (open: string) => open === ""
      ? "No watch on that is running in this session — none is open at all, so there is nothing to stop. A watch belongs to the session it was opened in: if the connection has been re-opened since, it expired with the old session and reports nothing more."
      : `No watch on that is running in this session. Open are: ${open}. To end one of them: stop_watch with its watch_id.`,
    several: (list: string) => `Several watches match, so I have stopped none: ${list}. Choose one and call stop_watch with its watch_id.`,
    byKindOnly: (key: string, what: string, uri: string) => `No open watch has the key "${key}"; the only open one of that kind is ${what} (${uri}), so I ended that. You will hear nothing further about it.`,
    severalByKind: (key: string, list: string) => `No open watch has the key "${key}", and several of that kind are open, so I have stopped none: ${list}. Choose one and call stop_watch with its watch_id.`,
    on: "on",
  },
} as const;

/** "A 8", "a8" and "A8" are one subject; so are "Fulda" and "fulda". Nothing looser. */
export const subjectKey = (s: string): string => s.normalize("NFC").toLocaleLowerCase("de-DE").replace(/\s+/g, "");
/** A road in any spelling watch_situation took: "A 7", "a7", "A07". */
const roadKey = (s: string): string => subjectKey(s).replace(/^([a-z])0+(\d)/u, "$1$2");

/** The kinds whose stored key is an identifier the platform resolved, not the person's words. */
const ID_KEYED = new Set(["station", "region", "weather", "charger"]);

type Open = { id: number; kind: string; key: string; said: string | undefined };

const parseUri = (uri: string): number | null => {
  const m = /^viafrei:\/\/watch\/(\d+)$/u.exec(uri.trim());
  return m === null ? null : Number(m[1]);
};

/** A watch's subject in a list or a sentence: "die Straße A8". */
const describe = (w: Open, language: Language): string => `${KIND_LABEL[w.kind]?.[language] ?? w.kind} ${w.key}`;
const listOf = (rows: readonly Open[], language: Language): string =>
  rows.map((w) => `watch_id ${w.id} (${watchUri(w.id)}) ${COPY[language].on} ${describe(w, language)}`).join("; ");
const brief = (w: Open): Record<string, unknown> => ({ uri: watchUri(w.id), watchId: w.id, kind: w.kind, key: w.key });

export function stopWatchHandler(resolve: (kind: string, key: string, ctx: ToolContext) => Promise<string | CallToolResult>): Handler {
  return async (args, ctx) => {
    const { language } = ctx;
    const c = COPY[language];
    const watchId = num(args["watch_id"]);
    const uriArg = str(args["uri"]);
    const kind = str(args["kind"]);
    const key = str(args["key"]);
    const bySubject = kind !== undefined || key !== undefined;
    if (watchId === undefined && uriArg === undefined && !bySubject) return toolError(c.name);
    if (bySubject && (watchId !== undefined || uriArg !== undefined)) return toolError(c.idAndSubject);
    if (watchId !== undefined && uriArg !== undefined) return toolError(c.idAndUri);
    const credit = (structured: Record<string, unknown>, text: string): CallToolResult => {
      const meta: DataMeta = { requestId: "", generatedAt: new Date().toISOString(), language, attribution: [WATCH_CREDIT] };
      return toolResult(text, [meta], language, { structured });
    };
    if (!bySubject) {
      // The session's own uri, or the platform's uri the watch was opened with.
      const id = watchId ?? parseUri(uriArg!) ?? ctx.watches.find((w) => w.uri === uriArg) ?? null;
      if (id === null) return toolError(c.badUri);
      const uri = watchUri(id);
      const stopped = ctx.watches.remove(id);
      return credit({ uri, watchId: id, stopped, scope: "session" }, stopped ? c.stopped(uri) : c.absent(uri));
    }
    const open: Open[] = ctx.watches.list().map((w) => ({ id: w.id, kind: w.kind, key: w.key, said: ctx.watches.said(w.id) }));
    const ofKind = open.filter((w) => kind === undefined || w.kind === kind);
    const same = (w: Open): boolean => key === undefined
      || [w.key, w.said].some((k) => k !== undefined && (subjectKey(k) === subjectKey(key) || (w.kind === "road" && roadKey(k) === roadKey(key))));
    let matches = ofKind.filter(same);
    let resolved = false;
    // A name the watch was opened on is resolved the same way and matched on what it resolves to.
    const resolveKind = kind ?? (ofKind.some((w) => w.kind === "place") ? "place" : undefined);
    if (matches.length === 0 && key !== undefined && resolveKind !== undefined && resolveKind !== "road" && ofKind.length > 0) {
      const r = await resolve(resolveKind, key, ctx);
      if (!isResult(r)) {
        matches = ofKind.filter((w) => w.kind === resolveKind && subjectKey(w.key) === subjectKey(r));
        resolved = matches.length > 0;
      }
    }
    // An id-keyed watch is named by its kind alone; never a road or a place, where the key IS the subject.
    const byKindOnly = matches.length === 0 && kind !== undefined && ID_KEYED.has(kind) && key !== undefined && ofKind.length > 0;
    if (byKindOnly) matches = ofKind;
    const only = matches.length === 1 ? matches[0] : undefined;
    if (only === undefined) {
      const text = matches.length === 0 ? c.noMatch(listOf(open, language)) : byKindOnly ? c.severalByKind(key ?? "", listOf(matches, language)) : c.several(listOf(matches, language));
      return credit({ stopped: false, scope: "session", matched: matches.length, ...(byKindOnly ? { matchedBy: "kind" } : {}), candidates: (matches.length === 0 ? open : matches).map(brief) }, text);
    }
    const uri = watchUri(only.id);
    const stopped = ctx.watches.remove(only.id);
    const text = !stopped ? c.absent(uri) : byKindOnly ? c.byKindOnly(key ?? "", describe(only, language), uri) : c.stoppedSubject(describe(only, language), uri);
    return credit({ ...brief(only), stopped, scope: "session", matched: 1, matchedBy: byKindOnly ? "kind" : resolved ? "resolved" : "subject" }, text);
  };
}
