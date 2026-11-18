/**
 * Turning an API envelope into an MCP tool result: the body text, the credit footer built from the
 * contract's `meta.attribution`, and `_meta` carrying the attribution, licences, `asOf`, and the
 * `purposeNote` / `conditionNote` the API states in `meta.notes`. The notes are shown verbatim: they
 * are legal conditions of the data, not captions.
 */
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

export const km = (m: number | null | undefined, language: Language): string =>
  m === null || m === undefined ? "" : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", language === "de" ? "," : ".")} km`;

export const eur = (v: number, language: Language): string => `${v.toFixed(3).replace(".", language === "de" ? "," : ".")} €`;

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

/** Builds the result: body, footer, `_meta`. Several envelopes' metas may be merged (one answer from several reads). */
export function toolResult(body: string, metas: readonly DataMeta[], language: Language, extra: { conditionNote?: string; nextCursor?: string | null } = {}): CallToolResult {
  const attributions = uniqueAttributions(metas.flatMap((m) => m.attribution ?? []));
  const purpose = [...new Set(metas.flatMap((m) => m.notes?.purpose ?? []))];
  const condition = [...new Set([...metas.flatMap((m) => m.notes?.condition ?? []), ...(extra.conditionNote ? [extra.conditionNote] : [])])];
  const asOfs = metas.map((m) => m.asOf).filter((x): x is string => typeof x === "string").sort();
  const asOf = asOfs[0] ?? metas[0]?.generatedAt ?? new Date().toISOString();
  const attributionText = attributions.map((a) => a.text).join(" · ");
  const footer = `${attributions.length > 0 ? `${SOURCE_LABEL[language]}: ${attributionText} · ` : ""}${AS_OF_LABEL[language]}: ${berlinDateTime(asOf, language)}`;
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
  return { content: [{ type: "text", text }], _meta: meta };
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
