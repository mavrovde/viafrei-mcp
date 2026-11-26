/**
 * find_address's answer, as today's server words it (its find_address.ts COPY): the query as the head, the
 * address with its Land, its point, the same door mapped twice folded into one point, points further apart
 * said with their spread, and the day of the OpenStreetMap extract.
 *
 * What today's answer adds and the contract does not carry is not said: the kind of OSM object a point is
 * (node, way), the objects mapped at the address, the town's namesakes and the street's other stretches.
 */
import type * as T from "../api/types.js";
import type { Language } from "../presentation.js";
import { landOf } from "./region.js";
import { poiCategoryWord } from "./osm-words.js";

/** Today's fold: two points of one street and number, no contradicting postcode or town, this close are one door. */
export const SAME_OBJECT_M = 150;

const WORDS = {
  de: {
    head: (q: string, n: number): string => (n === 1 ? `"${q}":` : `"${q}" — ${n} kartierte Objekte an dieser Adresse:`),
    folded: (n: number, spread: number, what: string): string => `(${n} OpenStreetMap-Objekte dieser Adresse, bis ${spread} m auseinander, als ein Punkt gezeigt${what === "" ? "" : `: ${what}`})`,
    fromFirst: (m: number): string => `${m} m von Punkt 1`,
    spread: (n: number, m: number): string => `Die ${n} Punkte liegen bis zu ${m} m auseinander — weiter als ${SAME_OBJECT_M} m, also nicht dieselbe Tür doppelt kartiert; vermutlich mehrere Gebäude unter dieser Hausnummer.`,
    stand: (d: string): string => `Stand der OpenStreetMap-Daten: ${d}`,
  },
  en: {
    head: (q: string, n: number): string => (n === 1 ? `"${q}":` : `"${q}" — ${n} mapped objects at this address:`),
    folded: (n: number, spread: number, what: string): string => `(${n} OpenStreetMap objects of this address, up to ${spread} m apart, shown as one point${what === "" ? "" : `: ${what}`})`,
    fromFirst: (m: number): string => `${m} m from point 1`,
    spread: (n: number, m: number): string => `The ${n} points lie up to ${m} m apart — further than ${SAME_OBJECT_M} m, so not one door mapped twice; probably several buildings under this house number.`,
    stand: (d: string): string => `OpenStreetMap data as of ${d}`,
  },
} as const;

/** Today's osmTypeWord: what the loader stored, and nothing it did not. */
export function osmTypeWord(type: T.Address["osmType"], language: Language): string | null {
  if (type === undefined || type === null) return null;
  if (language === "de") return type === "node" ? "Adresspunkt (OSM-Knoten)" : type === "way" ? "Umriss, meist das Gebäude (OSM-Weg; Punkt = Mitte)" : "mehrteiliger Umriss (OSM-Relation; Punkt = Mitte)";
  return type === "node" ? "address point (OSM node)" : type === "way" ? "outline, usually the building (OSM way; point = its centre)" : "multipart outline (OSM relation; point = its centre)";
}

/** Today's AT_ADDRESS_SHOWN and AT_ADDRESS_M. */
export const AT_ADDRESS_SHOWN = 8;
const AT_ADDRESS_M = 30;

/** Verbatim from today's server (its at-address COPY). */
const AT_ADDRESS = {
  de: {
    head: "In OpenStreetMap an dieser Adresse kartiert:",
    loose: (m: number): string => `ohne eigene Adresse, ${m} m entfernt`,
    also: (names: string): string => `auch kartiert als ${names}`,
    more: (n: number, all: number): string => `… und ${n} weitere (${all} Objekte an dieser Adresse kartiert)`,
    none: `An dieser Adresse ist in OpenStreetMap kein benanntes Objekt kartiert — keines trägt diese Adresse, und keines ohne eigene Adresse liegt im Umkreis von ${AT_ADDRESS_M} m.`,
  },
  en: {
    head: "Mapped at this address in OpenStreetMap:",
    loose: (m: number): string => `no address of its own, ${m} m away`,
    also: (names: string): string => `also mapped as ${names}`,
    more: (n: number, all: number): string => `… and ${n} more (${all} objects mapped at this address)`,
    none: `OpenStreetMap maps no named object at this address — none carries this address, and none without an address of its own lies within ${AT_ADDRESS_M} m.`,
  },
} as const;

/** Today's objectsLines: a line per object (AT_ADDRESS_SHOWN at most), or the sentence that none is mapped; nothing while the API does not list them. */
export function objectsLines(objects: readonly T.AddressObject[] | undefined, language: Language): string[] {
  if (objects === undefined) return [];
  const c = AT_ADDRESS[language];
  if (objects.length === 0) return [c.none];
  const lines = objects.slice(0, AT_ADDRESS_SHOWN).map((o) => {
    const extra = [o.ownAddress ? null : c.loose(o.distanceM), o.alsoNamed.length === 0 ? null : c.also(o.alsoNamed.map((n) => `"${n}"`).join(", "))].filter((x): x is string => x !== null);
    const kinds = [...new Set(o.kinds.map((k) => poiCategoryWord(k.category, k.categoryValue, language)))].join(" / ");
    return `- ${o.name} — ${kinds}${extra.length === 0 ? "" : ` (${extra.join("; ")})`}`;
  });
  if (objects.length > AT_ADDRESS_SHOWN) lines.push(c.more(objects.length - AT_ADDRESS_SHOWN, objects.length));
  return [c.head, ...lines];
}

/** Today's distance (connectors/osm/same-object.ts `metres`): haversine on a 6 371 km sphere. */
function metres(a: T.Address, b: T.Address): number {
  const rad = Math.PI / 180;
  const dLat = (b.location.lat - a.location.lat) * rad;
  const dLon = (b.location.lon - a.location.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.location.lat * rad) * Math.cos(b.location.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Today's normalizeName (platform/name-fold.ts): lower case, ß as ss, no diacritics, every other run of non-letters a space. */
export function normalizeName(raw: string): string {
  return raw.toLowerCase().replaceAll(/ß/gu, "ss").normalize("NFD").replaceAll(/\p{Diacritic}/gu, "").replaceAll(/[^\p{L}\p{N}]+/gu, " ").trim();
}
/** A name as today's fold compares it: normalised, spaces removed ("12 a" is "12a"). */
const fold = (s: string | null): string => (s === null ? "" : normalizeName(s).replace(/\s+/gu, ""));
/** No contradiction: either side unknown (null or empty), or the same folded. */
const compatible = (a: string | null, b: string | null): boolean => a === null || b === null || a === "" || b === "" || fold(a) === fold(b);
const has = (s: string | null | undefined): number => (s === null || s === undefined || s.trim() === "" ? 0 : 1);

/** Today's isSameAddress: the same street and number, no postcode or town that contradicts, within SAME_OBJECT_M. */
export function sameDoor(a: T.Address, b: T.Address): boolean {
  return fold(a.street) === fold(b.street) && fold(a.number) === fold(b.number) && compatible(a.postcode, b.postcode) && compatible(a.place, b.place) && metres(a, b) <= SAME_OBJECT_M;
}

export type Folded = { hit: T.Address; members: T.Address[]; spreadM: number };
/**
 * Today's groupSameAddresses: a row joins the first group holding a member it is the same door as (a chain of
 * doors 140 m apart is one door); the kept row is the first that carries postcode and town where a member does;
 * the spread is the largest distance from the kept row to a member.
 */
export function foldAddresses(rows: readonly T.Address[]): Folded[] {
  const groups: T.Address[][] = [];
  for (const r of rows) {
    const g = groups.find((m) => m.some((x) => sameDoor(x, r)));
    if (g === undefined) groups.push([r]); else g.push(r);
  }
  return groups.map((members) => {
    const lead = members[0]!;
    const richness = (h: T.Address): number => has(h.postcode) + has(h.place);
    const hit = members.reduce((best, m) => (richness(m) > richness(best) ? m : best), lead);
    return { hit, members, spreadM: Math.max(0, ...members.map((m) => metres(hit, m))) };
  });
}

/** Street and number, postcode and town, and the Land in the answer's language. */
export function addressText(a: T.Address, language: Language): string {
  const town = [a.postcode, a.place].filter((x) => x !== null && x !== "").join(" ");
  const land = a.land === null || a.land === "" ? null : (landOf(a.land, language)?.name ?? a.land);
  return [[a.street, a.number].filter((x) => x !== null && x !== "").join(" "), town, land].filter((x): x is string => x !== null && x !== "").join(", ");
}

const point = (a: T.Address): string => `${a.location.lat.toFixed(5)}, ${a.location.lon.toFixed(5)}`;

/** The whole answer body for the addresses the API found. */
export function addressAnswer(query: string, rows: readonly T.Address[], language: Language, objects?: readonly T.AddressObject[]): string {
  const c = WORDS[language];
  const groups = foldAddresses(rows);
  // What each folded point was (today's typesOf): the OSM object types of its members, once each.
  const typesOf = (g: Folded): string => [...new Set(g.members.map((m) => osmTypeWord(m.osmType, language)).filter((w): w is string => w !== null))].join(", ");
  const foldNote = (g: Folded): string[] => (g.members.length < 2 ? [] : [c.folded(g.members.length, Math.round(g.spreadM), typesOf(g))]);
  const objectLines = objectsLines(objects, language);
  const first = groups[0]!;
  const listed = groups.length === 1
    ? [addressText(first.hit, language), point(first.hit), ...foldNote(first)]
    : groups.flatMap((g, i) => [
      [`${i + 1}. ${addressText(g.hit, language)} — ${point(g.hit)}`, i === 0 ? null : c.fromFirst(Math.round(metres(first.hit, g.hit)))].filter((x): x is string => x !== null).join(" — "),
      ...foldNote(g).map((l) => `   ${l}`),
    ]);
  // Points of one address that stay apart are said with their spread.
  const oneAddress = groups.every((g) => fold(g.hit.street) === fold(first.hit.street) && fold(g.hit.number) === fold(first.hit.number));
  const spread = groups.length < 2 || !oneAddress ? 0 : Math.max(...groups.flatMap((a) => groups.map((b) => metres(a.hit, b.hit))));
  const days = rows.map((r) => r.dataAsOf).filter((d): d is string => typeof d === "string" && d !== "").sort();
  return [
    c.head(query, groups.length),
    ...listed,
    ...(spread > 0 ? [c.spread(groups.length, Math.round(spread))] : []),
    ...(objectLines.length === 0 ? [] : ["", ...objectLines]),
    ...(days[0] === undefined ? [] : ["", c.stand(days[0])]),
  ].join("\n");
}
