/**
 * Turning an API envelope into an MCP tool result: the body text, the credit footer built from the
 * contract's `meta.attribution`, and `_meta` carrying the attribution, licences, `asOf`, and the
 * `purposeNote` / `conditionNote` the API states in `meta.notes`. The notes are shown verbatim: they
 * are legal conditions of the data, not captions.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Attribution, DataMeta } from "./api/client.js";
import { ApiError } from "./api/client.js";

export type Language = "de" | "en";

export const languageOf = (v: unknown): Language => (v === "en" ? "en" : "de");

const BERLIN = "Europe/Berlin";

/** `HH:MM` in Europe/Berlin. */
export function berlinTime(iso: string | null | undefined): string {
  if (iso === null || iso === undefined) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat("de-DE", { timeZone: BERLIN, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** `DD.MM.YYYY, HH:MM` in Europe/Berlin. */
export function berlinDateTime(iso: string | null | undefined, language: Language): string {
  if (iso === null || iso === undefined) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-GB", { timeZone: BERLIN, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

const berlinDay = (d: Date): string => new Intl.DateTimeFormat("en-CA", { timeZone: BERLIN, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/**
 * When the data stood, as today's server says it (presentation/format.ts): "08:05" on the same Berlin
 * day as `now`, else "18.09. 08:05" in German and "2026-09-18 08:05" in English.
 */
export function standTime(iso: string, language: Language, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  const time = berlinTime(iso);
  const day = berlinDay(d);
  if (day === berlinDay(now)) return time;
  return language === "de" ? `${day.slice(8, 10)}.${day.slice(5, 7)}. ${time}` : `${day} ${time}`;
}

/** A row that opens with a label supplies its own (the DWD's prescribed "Quelle: Deutscher Wetterdienst"). */
const OWN_LABELS = ["Quelle: ", "Source: "];
/** The DWD's changed-data lead: its row goes last, and alone it carries no "Quelle:". */
const CHANGED_DATA_LEAD = "Datenbasis: ";

/**
 * The credit line, in today's server's one shape (creditFooter, #906): "Quelle: <rows> · Stand <time>".
 * A row that opens with a label goes first and is the line's label; a changed-data row goes last;
 * no rows, no "Quelle:" — the Stand alone.
 */
export function creditFooter(language: Language, rows: readonly string[], stand: string): string {
  if (rows.length === 0) return stand;
  const labelled = (r: string): boolean => OWN_LABELS.some((l) => r.startsWith(l));
  const own = rows.filter(labelled);
  const basis = rows.filter((r) => !labelled(r) && r.startsWith(CHANGED_DATA_LEAD));
  const rest = rows.filter((r) => !labelled(r) && !r.startsWith(CHANGED_DATA_LEAD));
  const lead = own.length > 0 || rest.length === 0 ? "" : `${SOURCE_LABEL[language]}: `;
  return `${lead}${[...own, ...rest, ...basis].join(" · ")} · ${stand}`;
}

export const km = (m: number | null | undefined, language: Language): string =>
  m === null || m === undefined ? "" : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", language === "de" ? "," : ".")} km`;

export const eur = (v: number, language: Language): string => `${v.toFixed(3).replace(".", language === "de" ? "," : ".")} €`;

/**
 * The credits of the place search a tool call resolved its place through: today's server credits the
 * gazetteer row it read the place from ("Ortsdaten: © GeoNames …") after the answer's own sources. One
 * store per tool call, filled by `position()` and read by `toolResult`, so no handler can forget it.
 * Credit only: the place's read never moves the answer's data time.
 */
const placeCredits = new AsyncLocalStorage<Attribution[]>();
export const withPlaceCredits = <R>(fn: () => Promise<R>): Promise<R> => placeCredits.run([], fn);
export function creditPlace(list: readonly Attribution[] | undefined): void {
  placeCredits.getStore()?.push(...(list ?? []));
}

export type ToolMeta = {
  attribution: string;
  license: string;
  licenses: Record<string, string>;
  asOf: string;
  asOfLocal: string;
  sources: string[];
  purposeNote?: string;
  conditionNote?: string;
  shareAlike?: true;
  nextCursor?: string;
};

/** The most characters a tool result carries, footer included. */
export const TOOL_RESULT_CHARS = 8_000;

const SOURCE_LABEL: Record<Language, string> = { de: "Quelle", en: "Source" };
const AS_OF_LABEL: Record<Language, string> = { de: "Stand", en: "As of" };

function uniqueAttributions(list: readonly Attribution[]): Attribution[] {
  const seen = new Set<string>();
  return list.filter((a) => (seen.has(a.family) ? false : (seen.add(a.family), true)));
}

/**
 * Builds the result: body, footer, `_meta`. Several envelopes' metas may be merged (one answer from several
 * reads). When the handler gives `structured`, `structuredContent` carries those fields plus the same asOf,
 * attribution, licence and notes, as the server before the move sent them.
 */
export function toolResult(body: string, metas: readonly DataMeta[], language: Language, extra: {
  conditionNote?: string; nextCursor?: string | null; structured?: Record<string, unknown>;
  /** The data time when it is not the reads' (the driving rules: the review date). */
  asOf?: string;
  /** The Stand when it is not a clock time (the driving rules: "Stand 19.09.2026"). */
  asOfLabel?: string;
  /** A sentence AFTER the credit line, the last thing read aloud (the rules' disclaimer). */
  note?: string;
} = {}): CallToolResult {
  const attributions = uniqueAttributions([...metas.flatMap((m) => m.attribution ?? []), ...(placeCredits.getStore() ?? [])]);
  const purpose = [...new Set(metas.flatMap((m) => m.notes?.purpose ?? []))];
  const condition = [...new Set([...metas.flatMap((m) => m.notes?.condition ?? []), ...(extra.conditionNote ? [extra.conditionNote] : [])])];
  const asOfs = metas.map((m) => m.asOf).filter((x): x is string => typeof x === "string").sort();
  const asOf = extra.asOf ?? asOfs[0] ?? metas[0]?.generatedAt ?? new Date().toISOString();
  const attributionText = attributions.map((a) => a.text).join(" · ");
  const footer = creditFooter(language, attributions.map((a) => a.text), extra.asOfLabel ?? `${AS_OF_LABEL[language]} ${standTime(asOf, language)}`) + (extra.note === undefined ? "" : `\n${extra.note}`);
  const lines = [...purpose, ...condition];
  const room = TOOL_RESULT_CHARS - footer.length - lines.join("\n").length - 4;
  const text = [...lines, body.length > room ? `${body.slice(0, Math.max(0, room - 1))}…` : body, "", footer].join("\n");
  const licenses: Record<string, string> = {};
  for (const a of attributions) if (a.licence !== undefined) licenses[a.family] = a.licence;
  const meta: ToolMeta = {
    attribution: attributionText,
    license: [...new Set(Object.values(licenses))].join(", "),
    licenses,
    asOf,
    asOfLocal: berlinDateTime(asOf, language),
    sources: attributions.map((a) => a.family),
  };
  if (purpose.length > 0) meta.purposeNote = purpose.join(" ");
  if (condition.length > 0) meta.conditionNote = condition.join(" ");
  if (attributions.some((a) => a.shareAlike === true)) meta.shareAlike = true;
  if (extra.nextCursor) meta.nextCursor = extra.nextCursor;
  const result: CallToolResult = { content: [{ type: "text", text }], _meta: meta };
  if (extra.structured !== undefined) {
    result.structuredContent = {
      ...extra.structured,
      asOf: meta.asOf,
      attribution: meta.attribution,
      license: meta.license,
      ...(meta.purposeNote === undefined ? {} : { purposeNote: meta.purposeNote }),
      ...(meta.conditionNote === undefined ? {} : { conditionNote: meta.conditionNote }),
      ...(meta.shareAlike === undefined ? {} : { shareAlike: true }),
    };
  }
  return result;
}

/** A tool error the assistant can act on. */
export function toolError(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

const NOT_AVAILABLE: Record<Language, string> = {
  de: "Diese Auskunft ist über die ViaFrei-API derzeit nicht verfügbar.",
  en: "This answer is not available through the ViaFrei API yet.",
};

/** The answer of a handler whose API operation the contract does not have yet. */
export function notAvailable(language: Language, what?: string): CallToolResult {
  return toolError(what === undefined ? NOT_AVAILABLE[language] : `${NOT_AVAILABLE[language]} (${what})`);
}

/** An API failure, worded for the person. Never carries a key or a URL. */
export function apiFailure(err: unknown, language: Language): CallToolResult {
  if (!(err instanceof ApiError)) throw err;
  const de = language === "de";
  switch (err.kind) {
    case "not_found":
      return toolError(de ? "Dazu hat die ViaFrei-API nichts gefunden." : "The ViaFrei API found nothing for this.");
    case "invalid":
      return toolError(de ? `Die Anfrage passt nicht: ${err.problem?.detail ?? err.message}` : `The request does not fit: ${err.problem?.detail ?? err.message}`);
    case "rate_limited":
      return toolError(de ? "Gerade zu viele Anfragen – bitte in einer Minute noch einmal fragen." : "Too many requests right now – please ask again in a minute.");
    case "not_configured":
    case "refused":
      return notAvailable(language);
    default:
      return toolError(de ? "Die ViaFrei-API antwortet gerade nicht – bitte gleich noch einmal fragen." : "The ViaFrei API is not answering right now – please ask again shortly.");
  }
}
