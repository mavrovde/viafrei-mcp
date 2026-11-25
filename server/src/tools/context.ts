import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ApiClient, Attribution, LatLon } from "../api/client.js";
import { ApiError, atParam } from "../api/client.js";
import type { PlaceItem, PlacesCoverageData, ResolvedPlace } from "../api/types.js";
import { creditPlace, toolError, type Language } from "../presentation.js";
import type { ConsentOutcome } from "../sid-consent.js";
import { PLACE_WORDS } from "./place-words.js";
import type { RefreshWait } from "./trains.js";

/** The watches of one MCP session: the catalogue's integer ids mapped to the API's watch ids, in memory. */
export class SessionWatches {
  private next = 1;
  private readonly byId = new Map<number, { watchId: string; uri: string; kind: string; key: string }>();
  /** The words each watch was asked for in, for stop_watch's subject match; never in the resource list. */
  private readonly saidById = new Map<number, string>();
  add(w: { watchId: string; uri: string; kind: string; key: string }, said?: string): number {
    const id = this.next++;
    this.byId.set(id, w);
    if (said !== undefined) this.saidById.set(id, said);
    return id;
  }
  get(id: number) {
    return this.byId.get(id);
  }
  find(pred: (w: { watchId: string; uri: string; kind: string; key: string }) => boolean): number | undefined {
    for (const [id, w] of this.byId) if (pred(w)) return id;
    return undefined;
  }
  said(id: number): string | undefined {
    return this.saidById.get(id);
  }
  remove(id: number): boolean {
    this.saidById.delete(id);
    return this.byId.delete(id);
  }
  list() {
    return [...this.byId].map(([id, w]) => ({ id, ...w }));
  }
}

export type ToolContext = {
  /** The tool called: its own words for a missing or unknown place (place-words.ts). */
  readonly tool?: string;
  readonly api: ApiClient;
  /** How long a train board waits for the API's live refresh to settle. */
  readonly refreshWait: RefreshWait;
  readonly language: Language;
  readonly watches: SessionWatches;
  /** Asks the person to accept the truck-parking terms (MCP elicitation); undefined when the client cannot be asked. */
  readonly askSidConsent?: (language: Language) => Promise<ConsentOutcome>;
};

export type Args = Readonly<Record<string, unknown>>;
export type Handler = (args: Args, ctx: ToolContext) => Promise<CallToolResult>;

export const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
export const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
export const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
export const strs = (v: unknown): string[] | undefined => (Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : undefined);
export const radiusM = (km: unknown): number | undefined => (num(km) === undefined ? undefined : Math.round(num(km)! * 1000));

export type Position = { at: LatLon; label: string | null };

const NEED_PLACE: Record<Language, string> = {
  de: "Bitte einen Ort (place) oder Koordinaten (lat und lon) angeben.",
  en: "Please give a place (place) or coordinates (lat and lon).",
};
const NO_PLACE: Record<Language, (q: string) => string> = {
  de: (q) => `Den Ort „${q}“ kenne ich nicht. Bitte genauer angeben oder Koordinaten nennen.`,
  en: (q) => `I do not know the place "${q}". Please be more specific or give coordinates.`,
};

/** A missing place in the tool's own words, coded as today's server codes it. */
export function placeMissing(ctx: ToolContext): CallToolResult {
  const words = ctx.tool === undefined ? undefined : PLACE_WORDS[ctx.tool];
  if (words === undefined) return toolError(NEED_PLACE[ctx.language]);
  return { ...toolError(words.missing[ctx.language]), _meta: { errorCode: "invalid_input", errorReason: "place_missing" } };
}

export function placeUnknown(ctx: ToolContext, q: string): CallToolResult {
  const words = ctx.tool === undefined ? undefined : PLACE_WORDS[ctx.tool];
  const unknown = words?.unknown;
  if (unknown === undefined) return toolError(NO_PLACE[ctx.language](q));
  if (words?.uncoded === true) return toolError(unknown[ctx.language](q));
  return { ...toolError(unknown[ctx.language](q)), _meta: { errorCode: "not_found" } };
}

/** Verbatim from today's server (geo/place.ts HOUSE_NUMBER_COPY). */
const HOUSE_NUMBER_COPY = {
  de: "Ich finde Orte, Haltestellen und Autobahnen — keine Hausnummern. Bitte den Ort oder die Haltestelle nennen.",
  en: "I can find places, stations and motorways, not house numbers. Please name the place or the station.",
} as const;

/** "Hauptstraße 12, Fulda", "Marienplatz 8": a word, then a number of up to four digits; never a motorway ("A 7"). */
export function looksLikeHouseNumber(query: string): boolean {
  return /[a-zäöüß.]\s*\d{1,4}\s*[a-z]?\s*(,|$)/iu.test(query.trim()) && !/^\s*[ab]\s*\d{1,3}\s*$/iu.test(query.trim());
}

/** How many candidates a name is asked with: enough to hold the official Gemeinde beside its GeoNames namesake. */
export const PLACE_CANDIDATES = 10;

const fold = (x: string): string => x.normalize("NFC").toLocaleLowerCase("de");

/**
 * The place a name resolves to, as today's resolver (a Gemeinde of its official key first): of the
 * search's candidates the municipality of exactly that name from the BKG register, else the search's first. Its
 * credit is that row's source only.
 */
export function pickPlace(q: string, found: { data: readonly PlaceItem[]; meta: { attribution?: readonly Attribution[] } }): PlaceItem | undefined {
  const official = found.data.find((p) => p.kind === "municipality" && p.sourceFamily === "bkg_gvisys" && fold(p.name) === fold(q.trim()));
  const pick = official ?? found.data[0];
  if (pick !== undefined) creditPlace((found.meta.attribution ?? []).filter((a) => a.family === pick.sourceFamily));
  return pick;
}

/**
 * The proposed resolvePlace: the API says which one place the text names and how the answer calls it (today's
 * resolver, which is the API's job, not the MCP's). Undefined, and the place search read as before, when the API
 * does not offer the operation (404) or names no place for the text.
 */
export async function resolvePlace(q: string, ctx: ToolContext): Promise<Position | undefined> {
  try {
    const r = await ctx.api.get<ResolvedPlace>("resolvePlace", { q });
    if (r.data === null) return undefined;
    creditPlace(r.meta.attribution ?? []);
    return { at: r.data.location, label: r.data.label };
  } catch (err) {
    if (err instanceof ApiError && err.kind === "not_found") return undefined;
    throw err;
  }
}

/** The position a tool asks about: lat/lon as given, else the place name resolved through the API's place search. */
export async function position(args: Args, ctx: ToolContext, placeKey = "place", unknown?: (q: string) => CallToolResult): Promise<Position | CallToolResult> {
  const lat = num(args["lat"]);
  const lon = num(args["lon"]);
  if (lat !== undefined && lon !== undefined) return { at: { lat, lon }, label: null };
  const q = ctx.tool !== undefined && PLACE_WORDS[ctx.tool]?.ignorePlace === true ? undefined : str(args[placeKey]);
  if (q === undefined) return placeMissing(ctx);
  // Today's resolver (geo/place.ts looksLikeHouseNumber) refuses a street and house number in one sentence where
  // no address data is held, rather than calling the place unknown; where addresses are loaded, the search goes on.
  if (looksLikeHouseNumber(q) && (await ctx.api.get<PlacesCoverageData>("getPlacesCoverage", {})).data.addresses.length === 0) {
    return toolError(HOUSE_NUMBER_COPY[ctx.language]);
  }
  const resolved = await resolvePlace(q, ctx);
  if (resolved !== undefined) return resolved;
  const first = pickPlace(q, await ctx.api.get<PlaceItem[]>("listPlaces", { q, limit: PLACE_CANDIDATES }));
  if (first === undefined) return (await townCentre(q, ctx)) ?? (unknown === undefined ? placeUnknown(ctx, q) : unknown(q));
  return { at: first.location, label: first.name };
}

/** Verbatim from today's server (place.ts CENTRE_NOTE): what was measured from, and what was not found. */
export const CENTRE_NOTE: Record<Language, (thing: string) => string> = {
  de: (thing) => ` (gemessen ab der Ortsmitte — „${thing}“ finde ich dort nicht)`,
  en: (thing) => ` (measured from the town centre — I found no "${thing}" there)`,
};

/** Words that name a town's centre itself (today's CENTRE_WORDS): the centre is then the answer, nothing missed. */
const CENTRE_WORDS = /^(city|centre|center|city\s+centre|city\s+center|downtown|zentrum|innenstadt|stadtmitte|stadtzentrum|ortsmitte|ortskern|stadtkern)$/iu;

/**
 * "<town> <thing>" that the place search does not hold as a whole ("Köln Hbf" where no such stop is loaded):
 * the town's own point, the longest leading words first, its label saying it is the centre and what was not
 * found — as today's server answers it (#674). Undefined when no leading part is a place either.
 */
const TOWN_READINGS = 3;

export async function townCentre(q: string, ctx: ToolContext): Promise<Position | undefined> {
  const words = q.split(/\s+/u);
  // At most TOWN_READINGS searches: a town is its first few words, never a long sentence's.
  for (let n = Math.min(words.length - 1, TOWN_READINGS); n >= 1; n--) {
    const town = words.slice(0, n).join(" ");
    const thing = words.slice(n).join(" ");
    const first = pickPlace(town, await ctx.api.get<PlaceItem[]>("listPlaces", { q: town, limit: PLACE_CANDIDATES }));
    if (first === undefined) continue;
    return { at: first.location, label: CENTRE_WORDS.test(thing) ? first.name : `${first.name}${CENTRE_NOTE[ctx.language](thing)}` };
  }
  return undefined;
}

export const isResult = (v: unknown): v is CallToolResult => typeof v === "object" && v !== null && "content" in v;

export { atParam };
