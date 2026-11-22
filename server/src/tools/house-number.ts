/**
 * A place given as a street and house number, where the API holds no address data: today's server refuses it in
 * one sentence (main geo/place.ts looksLikeHouseNumber, HOUSE_NUMBER_COPY), rather than reporting the place as
 * unknown. Where addresses are loaded, the question goes on to the place search as before.
 *
 * Used by the lane A tools that take a place; the same rule belongs in context.ts position() for every tool,
 * which is a shared file (noted for lane C).
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type * as T from "../api/types.js";
import { toolError } from "../presentation.js";
import { num, str, type ToolContext } from "./context.js";

const HOUSE_NUMBER_COPY = {
  de: "Ich finde Orte, Haltestellen und Autobahnen — keine Hausnummern. Bitte den Ort oder die Haltestelle nennen.",
  en: "I can find places, stations and motorways, not house numbers. Please name the place or the station.",
} as const;

/** "Hauptstraße 12, Fulda", "Marienplatz 8": a word, then a number of up to four digits; never a motorway ("A 7"). */
export function looksLikeHouseNumber(query: string): boolean {
  return /[a-zäöüß.]\s*\d{1,4}\s*[a-z]?\s*(,|$)/iu.test(query.trim()) && !/^\s*[ab]\s*\d{1,3}\s*$/iu.test(query.trim());
}

/** Today's refusal when `args[key]` names a house number and no address data is held; otherwise undefined. */
export async function houseNumberRefusal(args: Record<string, unknown>, ctx: ToolContext, key = "place"): Promise<CallToolResult | undefined> {
  if (num(args["lat"]) !== undefined && num(args["lon"]) !== undefined) return undefined;
  const q = str(args[key]);
  if (q === undefined || !looksLikeHouseNumber(q)) return undefined;
  const cov = await ctx.api.get<T.PlacesCoverageData>("getPlacesCoverage", {});
  return cov.data.addresses.length === 0 ? toolError(HOUSE_NUMBER_COPY[ctx.language]) : undefined;
}
