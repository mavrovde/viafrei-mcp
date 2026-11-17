import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ApiClient, LatLon } from "../api/client.js";
import { atParam } from "../api/client.js";
import type { PlaceItem } from "../api/types.js";
import type { DbTimetablesClient } from "../vendor/db-timetables/client.js";
import { toolError, type Language } from "../presentation.js";
import type { ConsentOutcome } from "../sid-consent.js";

/** The watches of one MCP session: the catalogue's integer ids mapped to the API's watch ids, in memory. */
export class SessionWatches {
  private next = 1;
  private readonly byId = new Map<number, { watchId: string; uri: string; kind: string; key: string }>();
  add(w: { watchId: string; uri: string; kind: string; key: string }): number {
    const id = this.next++;
    this.byId.set(id, w);
    return id;
  }
  get(id: number) {
    return this.byId.get(id);
  }
  find(pred: (w: { watchId: string; uri: string; kind: string; key: string }) => boolean): number | undefined {
    for (const [id, w] of this.byId) if (pred(w)) return id;
    return undefined;
  }
  remove(id: number): boolean {
    return this.byId.delete(id);
  }
  list() {
    return [...this.byId].map(([id, w]) => ({ id, ...w }));
  }
}

export type ToolContext = {
  readonly api: ApiClient;
  readonly trains: DbTimetablesClient;
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

/** The position a tool asks about: lat/lon as given, else the place name resolved through the API's place search. */
export async function position(args: Args, ctx: ToolContext, placeKey = "place"): Promise<Position | CallToolResult> {
  const lat = num(args["lat"]);
  const lon = num(args["lon"]);
  if (lat !== undefined && lon !== undefined) return { at: { lat, lon }, label: null };
  const q = str(args[placeKey]);
  if (q === undefined) return toolError(NEED_PLACE[ctx.language]);
  const found = await ctx.api.get<PlaceItem[]>("listPlaces", { q, limit: 1 });
  const first = found.data[0];
  if (first === undefined) return toolError(NO_PLACE[ctx.language](q));
  return { at: first.location, label: first.name };
}

export const isResult = (v: unknown): v is CallToolResult => typeof v === "object" && v !== null && "content" in v;

export { atParam };
