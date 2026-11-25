/**
 * Fuel words of today's server: the openness sentence with its hours stamp (opennessText)
 * and the unpriced OpenStreetMap stations block (osmFuelLines).
 */
import type { Language } from "../presentation.js";
import { standTime } from "../presentation.js";
import type * as T from "../api/types.js";
import { kmText } from "./nearby.js";

/** Today's berlinTime(when, now): the clock alone today, the date beside it on another day. */
const stampTime = (iso: string, now: Date, language: Language): string => standTime(iso, language, now);

/**
 * WHAT the schedule says and WHEN it was read (today's opennessText): "open 24 h (opening hours from …)". Undefined
 * while the API does not say when the hours were read (the station's detail carries no hoursFreshness).
 */
export function hoursOpenness(d: T.FuelStationData | null, language: Language, now: Date): string | undefined {
  if (d === null || d.hoursFreshness === undefined) return undefined;
  const de = language === "de";
  const when = d.hoursRefreshedAt ?? null;
  const stamp = when === null
    ? de ? "Öffnungszeiten nie abgerufen" : "opening hours never fetched"
    : d.hoursFreshness === "stale"
      ? de ? `Öffnungszeiten zuletzt am ${stampTime(when, now, language)} geprüft` : `opening hours last checked ${stampTime(when, now, language)}`
      : de ? `Öffnungszeiten vom ${stampTime(when, now, language)}` : `opening hours from ${stampTime(when, now, language)}`;
  if (d.aroundTheClock && when !== null) return `${de ? "durchgehend offen" : "open 24 h"} (${stamp})`;
  if (d.openingState === "open") return `${de ? "offen" : "open"} (${stamp})`;
  if (d.openingState === "closed") return `${de ? "geschlossen" : "closed"} (${stamp})`;
  return de ? `Öffnung unbekannt (${stamp})` : `opening state unknown (${stamp})`;
}

/** Verbatim from today's OSM_FUEL_HEADING. */
export const OSM_FUEL_HEADING: Readonly<Record<Language, string>> = {
  de: "Weitere Tankstellen laut OpenStreetMap — Preis liegt uns noch nicht vor:",
  en: "More filling stations mapped by OpenStreetMap — we don't have a price for these stations yet:",
};

/** One station's label (today's osmLabel): name, the brand when the name does not say it, the address. */
function osmLabel(s: T.OsmFuelStation): string {
  const brand = s.brand !== null && !s.name.toLowerCase().includes(s.brand.toLowerCase()) ? ` (${s.brand})` : "";
  const a = s.address;
  const street = a === null || a.street === null ? null : [a.street, a.number].filter((x) => x !== null && x !== "").join(" ");
  const town = a === null ? null : [a.postcode, a.place].filter((x) => x !== null && x !== "").join(" ") || null;
  const address = [street, town].filter((x) => x !== null).join(", ");
  return `${s.name}${brand}${address === "" ? "" : `, ${address}`}`;
}

/** Today's block of stations OpenStreetMap maps and the price feed does not hold; nothing when none. */
export function osmFuelLines(language: Language, stations: readonly T.OsmFuelStation[]): string[] {
  if (stations.length === 0) return [];
  return [OSM_FUEL_HEADING[language], ...stations.map((s, i) => `${i + 1}. ${osmLabel(s)} — ${kmText(s.distanceM, language)}`)];
}

/** find_nearby's one-line form (today's osmFuelInline): the heading, then the stations numbered on the same line. */
export function osmFuelInline(language: Language, stations: readonly T.OsmFuelStation[]): string | null {
  if (stations.length === 0) return null;
  return `${OSM_FUEL_HEADING[language]} ${stations.map((s, i) => `${String(i + 1)}) ${osmLabel(s)} (${kmText(s.distanceM, language)})`).join("; ")}`;
}

/**
 * A station open around the clock by its read hours (today's cheapest-fuel priceText): "open 24 h (opening hours
 * from …)", the schedule's date beside it. Undefined otherwise, or while the API does not say when hours were read.
 */
export function wholeDayOpen(d: T.FuelStationData | null, s: T.FuelStation, language: Language, now: Date = new Date()): string | undefined {
  if (d === null || !d.aroundTheClock || s.openingState !== "open" || d.hoursRefreshedAt === null || d.hoursRefreshedAt === undefined) return undefined;
  return language === "de" ? `durchgehend offen (Öffnungszeiten vom ${stampTime(d.hoursRefreshedAt, now, language)})` : `open 24 h (opening hours from ${stampTime(d.hoursRefreshedAt, now, language)})`;
}

/** Today's price window in words (cacheWindowSeconds 1800). */
const WINDOW: Record<Language, string> = { de: "30 Minuten", en: "30 minutes" };

/** Today's sentence on the held stations the ranking leaves out; "" when none. */
export function unrankedLine(language: Language, noCurrent: number, inRadius: number, grade: string): string {
  if (noCurrent === 0) return "";
  const win = WINDOW[language];
  return language === "de"
    ? `\n${noCurrent === 1 ? "Eine" : String(noCurrent)} der ${inRadius} Tankstellen im Umkreis ${noCurrent === 1 ? "hat" : "haben"} keinen ${grade}-Preis aus den letzten ${win} (älter oder noch keiner) und ${noCurrent === 1 ? "steht" : "stehen"} nicht in der Rangfolge.`
    : `\n${noCurrent === 1 ? "One" : String(noCurrent)} of the ${inRadius} stations within the radius ${noCurrent === 1 ? "has" : "have"} no ${grade} price from the last ${win} (older, or none yet) and ${noCurrent === 1 ? "is" : "are"} not in the ranking.`;
}
