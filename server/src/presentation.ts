/**
 * Turning an API envelope into an MCP tool result: the body text, the credit footer built from the
 * contract's `meta.attribution`, and `_meta` carrying the attribution, licences, `asOf`, and the
 * `purposeNote` / `conditionNote` the API states in `meta.notes`. The notes are shown verbatim: they
 * are legal conditions of the data, not captions.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Attribution, DataMeta } from "./api/client.js";
import { ApiError, problemCode } from "./api/client.js";
import type { ToolErrorCode, ToolErrorReason } from "./usage-names.js";

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
  if (berlinDay(d) === berlinDay(now)) return berlinTime(iso);
  return datedTime(iso, language);
}

/** Always with the day (today's berlinDatedTime): "18.09. 08:05", "2026-09-18 08:05". */
export function datedTime(iso: string, language: Language): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  const time = berlinTime(iso);
  const day = berlinDay(d);
  return language === "de" ? `${day.slice(8, 10)}.${day.slice(5, 7)}. ${time}` : `${day} ${time}`;
}

/**
 * The stamp of an answer whose source is asked on a schedule (today's checkedAsOfLabel): "As of <the last check>",
 * and ", unchanged since <t>" when the data shown last changed a minute or more before that check. Undefined
 * while the API does not say when the family was last checked.
 */
export function checkedStamp(meta: DataMeta, family: string, changedAt: string | null, language: Language, now: Date = new Date()): { asOf: string; asOfLabel: string } | undefined {
  const checked = meta.freshness?.find((f) => f.family === family)?.lastCheckedAt;
  if (checked === null || checked === undefined) return undefined;
  const head = `${AS_OF_LABEL[language]} ${standTime(checked, language, now)}`;
  if (changedAt === null || new Date(checked).getTime() - new Date(changedAt).getTime() < 60_000) return { asOf: checked, asOfLabel: head };
  return { asOf: checked, asOfLabel: `${head}, ${language === "de" ? "unverändert seit" : "unchanged since"} ${standTime(changedAt, language, now)}` };
}

/** Same Berlin calendar day (today's sameBerlinDay). */
export const sameBerlinDay = (a: Date, b: Date): boolean => berlinDay(a) === berlinDay(b);

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
  // An answer whose data carries no time of its own says none (stand ""), never the time it was read.
  return `${lead}${[...own, ...rest, ...basis].join(" · ")}${stand === "" ? "" : ` · ${stand}`}`;
}

/** "Stand 23.11.2026" / "As of 2026-11-23": the Berlin day of a reference data set's time, never its clock time. */
export function asOfDayLabel(iso: string, language: Language): string {
  const day = berlinDay(new Date(iso));
  return language === "de" ? `${AS_OF_LABEL.de} ${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}` : `${AS_OF_LABEL.en} ${day}`;
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

/**
 * One credit row as today's server prints it (creditWithLinks): the line, then "(<terms url>; Lizenz:
 * <licence>, <licence url>)". A part the line already carries is left out (a prescribed string that spells
 * its own address), and so is a part the API does not give; no part left, no bracket.
 */
export function creditWithLinks(a: Attribution): string {
  const line = a.text;
  const bare = a.licenceUrl?.replace(/^https?:\/\//u, "").replace(/\/$/u, "");
  // A licence with no text of its own (the API points it at the publisher's terms page, as the Autobahn GmbH's
  // open data) gets no reference: today's register links no licence text for it.
  const ownText = a.licenceUrl !== a.termsUrl;
  const ref = ownText && a.licence !== undefined && a.licenceUrl !== undefined && bare !== undefined && !line.includes(bare) ? `Lizenz: ${a.licence}, ${a.licenceUrl}` : null;
  const links = [...(typeof a.termsUrl === "string" && a.termsUrl !== "" && !line.includes(a.termsUrl) ? [a.termsUrl] : []), ...(ref === null ? [] : [ref])];
  return links.length === 0 ? line : `${line} (${links.join("; ")})`;
}

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
  /** What the share-alike sentence is about, when it is not "these figures" (a board's realtime figures). */
  shareAlikeSubject?: string;
} = {}): CallToolResult {
  const attributions = uniqueAttributions([...metas.flatMap((m) => m.attribution ?? []), ...(placeCredits.getStore() ?? [])]);
  const purpose = [...new Set(metas.flatMap((m) => m.notes?.purpose ?? []))];
  const condition = [...new Set([...metas.flatMap((m) => m.notes?.condition ?? []), ...(extra.conditionNote ? [extra.conditionNote] : [])])];
  const asOfs = metas.map((m) => m.asOf).filter((x): x is string => typeof x === "string").sort();
  const asOf = extra.asOf ?? asOfs[0] ?? metas[0]?.generatedAt ?? new Date().toISOString();
  const credits = attributions.map(creditWithLinks);
  const attributionText = credits.join(" · ");
  const shareAlike = shareAlikeNote(attributions, language, extra.shareAlikeSubject);
  const footer = creditFooter(language, credits, extra.asOfLabel ?? `${AS_OF_LABEL[language]} ${standTime(asOf, language)}`)
    + (shareAlike === undefined ? "" : `\n${shareAlike}`) + (extra.note === undefined ? "" : `\n${extra.note}`);
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

/** The licence we release our adaptation of share-alike rows under (CC BY-SA 4.0 § 3(b)(2)). */
const SHARE_ALIKE_ADAPTER = { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" } as const;

/**
 * The share-alike sentence after the credit, verbatim from today's server (shareAlikeNoteFor): the licence
 * the rows carry, read from their credits, and ours beside it when the two differ. Undefined when no credit
 * of the answer is share-alike.
 */
export function shareAlikeNote(attributions: readonly Attribution[], language: Language, subject?: string): string | undefined {
  // The Creative Commons share-alike terms only: an ODbL database's share-alike is its own clause, not this sentence.
  const licences = [...new Set(attributions.filter((a) => a.shareAlike === true && /^CC BY-SA\b/u.test(a.licence ?? "")).map((a) => a.licence!))];
  if (licences.length === 0) return undefined;
  const named = licences.join(" / ");
  const ours = `${SHARE_ALIKE_ADAPTER.name} (${SHARE_ALIKE_ADAPTER.url})`;
  const same = licences.length === 1 && licences[0] === SHARE_ALIKE_ADAPTER.name;
  return language === "de"
    ? same
      ? `${subject ?? "Diese Angaben"} stehen unter ${ours} (Share-alike): wer sie weitergibt oder daraus etwas Neues ableitet, muss das Ergebnis unter derselben Lizenz und mit dieser Quellenangabe weitergeben.`
      : `${subject ?? "Diese Angaben"} stehen unter ${named} (Share-alike), so lizenziert sie die Quelle; unsere Bearbeitung geben wir unter ${ours} weiter: wer sie weitergibt oder daraus etwas Neues ableitet, muss das Ergebnis unter derselben Lizenz und mit dieser Quellenangabe weitergeben.`
    : same
      ? `${subject ?? "These figures"} are licensed ${ours} (share-alike): anyone who passes them on, or builds something on them, must release the result under the same licence and with this attribution.`
      : `${subject ?? "These figures"} are licensed ${named} (share-alike) by their source; we release our adaptation under ${ours}: anyone who passes them on, or builds something on them, must release the result under the same licence and with this attribution.`;
}

/**
 * A tool error the assistant can act on, with the reason code the usage counters and the request log count it by
 * (`_meta.errorCode`) and, for a refused argument clause, which one (`_meta.errorReason`). Every handler error
 * names its code here; none is left for the server to guess.
 */
export function toolError(text: string, code: ToolErrorCode, reason?: ToolErrorReason): CallToolResult {
  return { content: [{ type: "text", text }], isError: true, _meta: { errorCode: code, ...(reason === undefined ? {} : { errorReason: reason }) } };
}

const NOT_AVAILABLE: Record<Language, string> = {
  de: "Diese Auskunft ist über die ViaFrei-API derzeit nicht verfügbar.",
  en: "This answer is not available through the ViaFrei API yet.",
};

/** The answer of a handler whose API operation the contract does not have yet. */
export function notAvailable(language: Language, what?: string): CallToolResult {
  return toolError(what === undefined ? NOT_AVAILABLE[language] : `${NOT_AVAILABLE[language]} (${what})`, "unavailable");
}

/** An API failure, worded for the person. Never carries a key or a URL. */
export function apiFailure(err: unknown, language: Language): CallToolResult {
  if (!(err instanceof ApiError)) throw err;
  const de = language === "de";
  switch (err.kind) {
    case "not_found":
      return toolError(de ? "Dazu hat die ViaFrei-API nichts gefunden." : "The ViaFrei API found nothing for this.", "not_found");
    case "invalid":
      return toolError(de ? `Die Anfrage passt nicht: ${err.problem?.detail ?? err.message}` : `The request does not fit: ${err.problem?.detail ?? err.message}`, "invalid_input");
    case "rate_limited":
      if (problemCode(err.problem) === "quota-exceeded") {
        return toolError(de ? `Das Anfragekontingent dieses ViaFrei-Zugangs ist aufgebraucht – bitte ${retryWhen(err, de) ?? "später"} noch einmal fragen.` : `This ViaFrei access has used up its request quota – please ask again ${retryWhen(err, de) ?? "later"}.`, "limit_reached");
      }
      return toolError(de ? `Gerade zu viele Anfragen – bitte ${retryWhen(err, de) ?? "in einer Minute"} noch einmal fragen.` : `Too many requests right now – please ask again ${retryWhen(err, de) ?? "in a minute"}.`, "limit_reached");
    case "not_configured":
    case "refused":
      return notAvailable(language);
    default:
      if (problemCode(err.problem) === "overloaded") {
        return toolError(de ? `Die ViaFrei-API ist gerade ausgelastet – bitte ${retryWhen(err, de) ?? "gleich"} noch einmal fragen.` : `The ViaFrei API is busy right now – please ask again ${retryWhen(err, de) ?? "shortly"}.`, "unavailable");
      }
      return toolError(de ? "Die ViaFrei-API antwortet gerade nicht – bitte gleich noch einmal fragen." : "The ViaFrei API is not answering right now – please ask again shortly.", "unavailable");
  }
}

/** "in 30 seconds" / "in 5 minutes" from the problem's retryAfter (equal to Retry-After); undefined without one. */
function retryWhen(err: ApiError, de: boolean): string | undefined {
  const s = err.problem?.retryAfter;
  if (typeof s !== "number" || !Number.isFinite(s) || s <= 0) return undefined;
  if (s < 90) return de ? `in ${Math.ceil(s)} Sekunden` : `in ${Math.ceil(s)} seconds`;
  if (s < 90 * 60) return de ? `in ${Math.round(s / 60)} Minuten` : `in ${Math.round(s / 60)} minutes`;
  return de ? `in ${Math.round(s / 3600)} Stunden` : `in ${Math.round(s / 3600)} hours`;
}
