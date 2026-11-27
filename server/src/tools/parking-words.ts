/**
 * find_parking's list in today's server's words (main packages/mcp/src/tools/find_parking.ts `facilityHead`,
 * `capacityText`, `occupancyText`, `NOT_FULL_NOTE`; presentation/parking-status.ts): a numbered line per site with
 * its kind, its distance, its spaces, the free count, the occupied share and the operator's status word, dated by
 * the report's time (its day too when it is not today's Berlin day). A reading older than three of the cadences
 * meant to replace it is stale and said as a past statement with its age ("last reported 12 free", "as of 21:56,
 * 42 min ago"); the API carries no feed, so the cadence is today's for an unknown feed (reading.ts
 * UNKNOWN_CADENCE_S), and a feed's own cadence is the API lane's. What the API does not carry (the publisher's own
 * percentage, the stated facilities, the OpenStreetMap neighbours) is left out, never invented.
 */function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
import type * as T from "../api/types.js";
import { standTime, type Language } from "../presentation.js";
import { kmText } from "./nearby.js";

/** The API's kinds as today's terms (presentation/language.ts TERMS): the English term carries the German sign word. */
const KIND_TERM: Record<string, {
  de: string;
  en: string;
}> = {
  garage: {
    de: "Parkhaus",
    en: "Car park"
  },
  park_and_ride: {
    de: "P+R",
    en: "Park and ride"
  },
  rest_area: {
    de: "Rastanlage",
    en: "Rest area"
  },
  truck_parking: {
    de: "Lkw-Parkplatz",
    en: "Lorry parking"
  },
  other: {
    de: "Parkplatz",
    en: "Parking area"
  }
};
export function parkingKindText(kind: string, language: Language): string {
  const t = KIND_TERM[kind] ?? KIND_TERM["other"]!;
  return language === "de" ? t.de : `${t.en} (${t.de})`;
}

/** The API's occupancy states as today's operator's status words (PARKING_STATUS_TEXT); unknown and other say nothing. */
const STATE_TEXT: Record<string, {
  de: string;
  en: string;
}> = {
  free: {
    de: "Plätze frei",
    en: "spaces available"
  },
  filling: {
    de: "fast voll",
    en: "almost full"
  },
  full: {
    de: "voll",
    en: "full"
  }
};

/** The occupied share from the reported counts, whole percent; null without both counts. */
export function occupiedPct(free: number | null, total: number | null): number | null {
  if (free === null || total === null || total <= 0 || free > total) return null;
  return Math.round((total - free) / total * 100);
}

/** Today's stale rule (domain/parking/reading.ts): three cadences, a feed of unknown cadence 600 s. */
export const STALE_CADENCES = 3;
export const UNKNOWN_CADENCE_S = 600;
export function isStale(observedAt: string, now: Date): boolean {
  if (stryMutAct_9fa48("769")) {
    {}
  } else {
    stryCov_9fa48("769");
    return stryMutAct_9fa48("773") ? now.getTime() - new Date(observedAt).getTime() <= STALE_CADENCES * UNKNOWN_CADENCE_S * 1000 : stryMutAct_9fa48("772") ? now.getTime() - new Date(observedAt).getTime() >= STALE_CADENCES * UNKNOWN_CADENCE_S * 1000 : stryMutAct_9fa48("771") ? false : stryMutAct_9fa48("770") ? true : (stryCov_9fa48("770", "771", "772", "773"), (stryMutAct_9fa48("774") ? now.getTime() + new Date(observedAt).getTime() : (stryCov_9fa48("774"), now.getTime() - new Date(observedAt).getTime())) > (stryMutAct_9fa48("775") ? STALE_CADENCES * UNKNOWN_CADENCE_S / 1000 : (stryCov_9fa48("775"), (stryMutAct_9fa48("776") ? STALE_CADENCES / UNKNOWN_CADENCE_S : (stryCov_9fa48("776"), STALE_CADENCES * UNKNOWN_CADENCE_S)) * 1000)));
  }
}

/** Today's fmtAgeIn: "gerade eben"/"just now", "vor 42 min"/"42 min ago", "1 h 5 min ago". */
export function ageText(language: Language, ms: number): string {
  if (stryMutAct_9fa48("777")) {
    {}
  } else {
    stryCov_9fa48("777");
    const minutes = stryMutAct_9fa48("778") ? Math.min(0, Math.round(ms / 60_000)) : (stryCov_9fa48("778"), Math.max(0, Math.round(stryMutAct_9fa48("779") ? ms * 60_000 : (stryCov_9fa48("779"), ms / 60_000))));
    if (stryMutAct_9fa48("783") ? minutes >= 1 : stryMutAct_9fa48("782") ? minutes <= 1 : stryMutAct_9fa48("781") ? false : stryMutAct_9fa48("780") ? true : (stryCov_9fa48("780", "781", "782", "783"), minutes < 1)) return (stryMutAct_9fa48("786") ? language !== "de" : stryMutAct_9fa48("785") ? false : stryMutAct_9fa48("784") ? true : (stryCov_9fa48("784", "785", "786"), language === (stryMutAct_9fa48("787") ? "" : (stryCov_9fa48("787"), "de")))) ? stryMutAct_9fa48("788") ? "" : (stryCov_9fa48("788"), "gerade eben") : stryMutAct_9fa48("789") ? "" : (stryCov_9fa48("789"), "just now");
    const hours = Math.floor(stryMutAct_9fa48("790") ? minutes * 60 : (stryCov_9fa48("790"), minutes / 60));
    const rest = stryMutAct_9fa48("791") ? minutes * 60 : (stryCov_9fa48("791"), minutes % 60);
    const span = (stryMutAct_9fa48("794") ? hours !== 0 : stryMutAct_9fa48("793") ? false : stryMutAct_9fa48("792") ? true : (stryCov_9fa48("792", "793", "794"), hours === 0)) ? stryMutAct_9fa48("795") ? `` : (stryCov_9fa48("795"), `${rest} min`) : (stryMutAct_9fa48("798") ? rest !== 0 : stryMutAct_9fa48("797") ? false : stryMutAct_9fa48("796") ? true : (stryCov_9fa48("796", "797", "798"), rest === 0)) ? stryMutAct_9fa48("799") ? `` : (stryCov_9fa48("799"), `${hours} h`) : stryMutAct_9fa48("800") ? `` : (stryCov_9fa48("800"), `${hours} h ${rest} min`);
    return (stryMutAct_9fa48("803") ? language !== "de" : stryMutAct_9fa48("802") ? false : stryMutAct_9fa48("801") ? true : (stryCov_9fa48("801", "802", "803"), language === (stryMutAct_9fa48("804") ? "" : (stryCov_9fa48("804"), "de")))) ? stryMutAct_9fa48("805") ? `` : (stryCov_9fa48("805"), `vor ${span}`) : stryMutAct_9fa48("806") ? `` : (stryCov_9fa48("806"), `${span} ago`);
  }
}

/** The occupancy half of a line: what the report says, then its time; "no occupancy published" when it says nothing. */
export function parkingOccupancyText(o: T.ParkingSite["occupancy"], language: Language, now: Date = new Date()): string {
  const de = language === "de";
  const nothing = de ? "keine Belegungsdaten veröffentlicht" : "no occupancy published";
  if (o === null) return nothing;
  const at = o.observedAt === null || o.observedAt === undefined ? null : o.observedAt;
  const stale = at !== null && isStale(at, now);
  const stamp = at === null ? "" : `${de ? "Stand" : "as of"} ${standTime(at, language, now)}${stale ? `, ${ageText(language, now.getTime() - new Date(at).getTime())}` : ""}`;
  const when = stamp === "" ? "" : ` (${stamp})`;
  if (o.state === "closed") return `${de ? "als geschlossen gemeldet" : "reported closed"}${when}`;
  // A stale reading is a past statement: its first figure is said as one, as today's.
  const parts: string[] = [];
  let figureSaid = false;
  if (o.free !== null && o.free !== undefined) {
    figureSaid = true;
    parts.push(stale ? de ? `zuletzt ${o.free} frei gemeldet` : `last reported ${o.free} free` : de ? `${o.free} frei` : `${o.free} free`);
  }
  const pct = occupiedPct(o.free ?? null, o.total ?? null);
  if (pct !== null) {
    const first = stale && !figureSaid;
    figureSaid = true;
    parts.push(de ? first ? `zuletzt zu ${pct} % belegt gemeldet` : `zu ${pct} % belegt` : first ? `last reported ${pct} % occupied` : `${pct} % occupied`);
  }
  const word = STATE_TEXT[o.state];
  if (word !== undefined) {
    const past = stale && !figureSaid;
    if (parts.length === 0 && o.state === "full") parts.push(de ? "als voll gemeldet" : "reported full");else parts.push(de ? `${past ? "zuletzt gemeldeter " : ""}Status laut Betreiber: ${word.de}` : `${past ? "last reported " : ""}operator's status: ${word.en}`);
  }
  return parts.length === 0 ? nothing : `${parts.join(", ")}${when}`;
}

/** One site: "1. Alsterhaus — Car park (Parkhaus), 0.2 km, 87 spaces, 84 free, 3 % occupied, operator's status: spaces available (as of 21:56)". */
export function parkingLine(p: T.ParkingSite, i: number, language: Language, now: Date = new Date()): string {
  const de = language === "de";
  const name = p.name ?? p.operator ?? null;
  const kind = parkingKindText(p.kind, language);
  // A German name that already says its kind ("Parkhaus Gänsemarkt") is not told it again.
  const kindShown = name !== null && de && name.toLowerCase().includes(kind.toLowerCase()) ? null : kind;
  const total = p.occupancy?.total ?? null;
  const free = p.occupancy?.free ?? null;
  // A total smaller than the free count beside it is never printed: a line may not contradict itself.
  const spaces = total === null || free !== null && total < free ? null : de ? `${total} Plätze` : `${total} spaces`;
  const parts = [name === null ? null : kindShown, p.distanceM === null || p.distanceM === undefined ? null : kmText(p.distanceM, language), spaces, parkingOccupancyText(p.occupancy, language, now)].filter((x): x is string => x !== null);
  return `${i + 1}. ${name ?? kind} — ${parts.join(", ")}`;
}

/** The list's head line, as today's: a place is nearest first, a road list is in its own order. */
export function parkingHead(where: {
  road: string;
} | {
  place: string;
  radiusKm: number;
}, language: Language): string {
  const de = language === "de";
  if ("road" in where) return de ? `Parken an der ${where.road}:` : `Parking along the ${where.road}:`;
  return de ? `Parken um ${where.place} (Umkreis ${where.radiusKm} km), nächste zuerst:` : `Parking around ${where.place} (within ${where.radiusKm} km), nearest first:`;
}

/** Today's closing sentence under a list (find_parking.ts NOT_FULL_NOTE, verbatim). */
export const NOT_FULL_NOTE: Record<Language, string> = {
  de: "Fehlt eine Angabe „frei“, veröffentlicht der Betreiber keine Belegung — das heißt nicht, dass die Anlage voll ist.",
  en: "Where no \"free\" count is shown the operator publishes no occupancy — it does not mean the site is full."
};

/** What the question asked that no OpenStreetMap car park can be judged by: said before the list, never read as "none". */
export type OsmNotJudged = "free" | "amenities" | null;
const OSM_PARK = {
  de: {
    notHeld: (where: string) => `${where} führen wir keine Parkhaus- oder P+R-Daten eines Betreibers oder einer Stadt.`,
    alone: "Laut OpenStreetMap (ODbL, separat geführt) gibt es dort diese Parkplätze und Parkhäuser — ohne Platzzahl und ohne Belegung:",
    also: "Außerdem laut OpenStreetMap (ODbL, separat geführt; was oben schon steht, ist ausgelassen) — Parkplätze und Parkhäuser, ohne Platzzahl und ohne Belegung:",
    free: "Ob dort Plätze frei sind, kann ich bei den folgenden Parkplätzen nicht prüfen — OpenStreetMap führt keine Belegung; sie stehen deshalb ohne diese Einschränkung hier, nicht als „keine freien Plätze“.",
    amenities: "Die gefragte Ausstattung kann ich bei den folgenden Parkplätzen nicht prüfen — OpenStreetMap führt dazu keine Angaben; sie stehen deshalb ohne diese Einschränkung hier.",
    unnamed: "Parkplatz",
    stand: (d: string) => `Stand der OpenStreetMap-Daten: ${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`
  },
  en: {
    notHeld: (where: string) => `${where} we hold no car park or P+R data from an operator or a city.`,
    alone: "OpenStreetMap (ODbL, held separately) lists these car parks there — with no capacity and no occupancy:",
    also: "Also, from OpenStreetMap (ODbL, held separately; what is listed above is left out) — car parks, with no capacity and no occupancy:",
    free: "Whether spaces are free I cannot check for the car parks below — OpenStreetMap holds no occupancy; they are listed without that filter, not as \"no free spaces\".",
    amenities: "The facilities asked for I cannot check for the car parks below — OpenStreetMap holds no such data; they are listed without that filter.",
    unnamed: "Car park",
    stand: (d: string) => `OpenStreetMap data as of ${d}`
  }
} as const;

/** "Bahnhofstraße 5, 10117 Berlin": as much of the address as OpenStreetMap maps; a house number "0" is its placeholder, never said. */
export function osmCarParkAddress(c: T.OsmCarPark): string | null {
  const no = c.houseNo === null || c.houseNo.trim() === "" || c.houseNo.trim() === "0" ? null : c.houseNo.trim();
  const street = [c.street?.trim() || null, c.street?.trim() ? no : null].filter(x => x !== null).join(" ");
  const town = [c.zip?.trim() || null, c.town?.trim() || null].filter(x => x !== null).join(" ");
  const out = [street, town].filter(x => x !== "").join(", ");
  return out === "" ? null : out;
}

/**
 * The OpenStreetMap car parks the API lists beside the publishers' sites (ParkingMeta.around.osmCarParks), in the
 * API's order and cap: their own heading and numbering, name (operator), distance and address, and the extract's
 * day. `where` is "around X (within N km)"; `held` says the publishers' list is above, so the block is "also".
 * "" when the API lists none.
 */
export function osmCarParkBlock(language: Language, parks: readonly T.OsmCarPark[], asOf: string | null, where: string, held: boolean, notJudged: OsmNotJudged): string {
  if (parks.length === 0) return "";
  const w = OSM_PARK[language];
  const lead = notJudged !== null ? `${w[notJudged]} ${held ? w.also : w.alone}` : held ? w.also : `${w.notHeld(`${where.charAt(0).toUpperCase()}${where.slice(1)}`)} ${w.alone}`;
  const lines = parks.map((c, i) => {
    const name = c.name?.trim() || w.unnamed;
    const op = c.operator?.trim() ?? "";
    const operator = op !== "" && op !== name ? ` (${op})` : "";
    const address = osmCarParkAddress(c);
    return `${i + 1}. ${name}${operator} — ${[kmText(c.distanceM, language), address].filter((x): x is string => x !== null).join(", ")}`;
  });
  return [lead, ...lines, ...(asOf === null ? [] : [w.stand(asOf)])].join("\n");
}

/** One OpenStreetMap car park as structured JSON: capacity and free spaces null, never read as zero or full. */
export function osmCarParkFacility(c: T.OsmCarPark, asOf: string | null, licence: string | null): Record<string, unknown> {
  return {
    id: c.id,
    name: c.name,
    operator: c.operator,
    address: osmCarParkAddress(c),
    lat: c.location.lat,
    lon: c.location.lon,
    distanceM: Math.round(c.distanceM),
    distanceKm: Math.round(c.distanceM / 100) / 10,
    capacityTotal: null,
    spacesFree: null,
    extractDate: asOf,
    license: licence
  };
}