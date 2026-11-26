/**
 * check_station_facilities' answer for a station the API knows, in today's server's words (main
 * tools/check_station_facilities.ts): one summary line that gives the answer first ("In Hamburg Hbf ist 1 von 3
 * gemeldeten Anlagen mit bekanntem Status außer Betrieb."), what the count covers, then one line per unit, out of
 * service first. A list with none says that DB's data lists none, never that the station has none.
 *
 * Not in the contract, so not said (scratchpad api-gap.md, lane A): DB's own explanation of a state
 * ("Meldung der Bahn: „Reparaturarbeiten“"), a city operator's lifts beside DB's, and a station whose DB
 * station number is missing or stale.
 */
import type * as T from "../api/types.js";
import type { Language } from "../presentation.js";

type Facility = StationFacilitiesData["facilities"][number];
type StationFacilitiesData = T.StationFacilitiesData;

const COPY = {
  de: {
    none: (s: string) => `In den Aufzugs- und Fahrtreppendaten der Bahn ist für ${s} weder ein Aufzug noch eine Fahrtreppe verzeichnet. Ob es dort Anlagen gibt, die die Bahn nicht führt, kann ich daraus nicht sagen.`,
    noneFiltered: (s: string, kind: string, others: string) => kind === "elevator"
      ? `In den Aufzugs- und Fahrtreppendaten der Bahn ist für ${s} kein Aufzug verzeichnet${others === "" ? "" : `, nur ${others}`}. Ob es dort einen Aufzug gibt, den die Bahn nicht führt, kann ich daraus nicht sagen.`
      : `In den Aufzugs- und Fahrtreppendaten der Bahn ist für ${s} keine Fahrtreppe verzeichnet${others === "" ? "" : `, nur ${others}`}. Ob es dort eine Fahrtreppe gibt, die die Bahn nicht führt, kann ich daraus nicht sagen.`,
    count: (kind: string, n: number) => kind === "elevator" ? (n === 1 ? "1 Aufzug" : `${n} Aufzüge`) : kind === "escalator" ? (n === 1 ? "1 Fahrtreppe" : `${n} Fahrtreppen`) : n === 1 ? "1 andere Anlage" : `${n} andere Anlagen`,
    and: " und ",
    allActive: (s: string, n: number) => `In ${s} ${n === 1 ? "ist die gemeldete Anlage" : `sind alle ${n} gemeldeten Anlagen`} in Betrieb.`,
    someActive: (s: string, active: number, known: number, unknown: number) => known === 0
      ? `In ${s} kann ich nicht sagen, ob ${unknown === 1 ? "die gemeldete Anlage in Betrieb ist" : `die ${unknown} gemeldeten Anlagen in Betrieb sind`} — das heißt nicht, dass ${unknown === 1 ? "sie außer Betrieb ist" : "sie außer Betrieb sind"}.`
      : `In ${s} ${active === 1 ? "ist 1 von" : `sind ${active} von`} ${known} gemeldeten Anlagen mit bekanntem Status in Betrieb.`,
    someBroken: (s: string, broken: number, known: number, unknown: number) =>
      `In ${s} ${broken === 1 ? "ist 1 von" : `sind ${broken} von`} ${known} gemeldeten Anlagen${unknown > 0 ? " mit bekanntem Status" : ""} außer Betrieb.`,
    someUnknown: (n: number) => `${n === 1 ? "Bei 1 Anlage" : `Bei ${n} Anlagen`} meldet die Bahn keinen Status.`,
    scope: "Gezählt sind die Anlagen, die die Bahn für diesen Bahnhof meldet.",
    noCityOperator: "Aufzüge an Haltestellen städtischer Verkehrsbetriebe (Straßenbahn, Stadtbahn, U-Bahn) sind darin nicht enthalten — dazu liegen mir für diesen Bahnhof keine Live-Daten vor.",
    unit: (no: string) => `Anlage ${no}`,
    elevator: "Aufzug", escalator: "Fahrtreppe", other: "Anlage", active: "in Betrieb", inactive: "außer Betrieb", unknownState: "Status unbekannt",
    more: (n: number) => `… und ${n} weitere.`,
  },
  en: {
    none: (s: string) => `DB's lift and escalator data lists neither a lift nor an escalator for ${s}. Whether the station has equipment DB does not list, I cannot tell from this.`,
    noneFiltered: (s: string, kind: string, others: string) => kind === "elevator"
      ? `DB's lift and escalator data lists no lift for ${s}${others === "" ? "" : `, only ${others}`}. Whether the station has a lift DB does not list, I cannot tell from this.`
      : `DB's lift and escalator data lists no escalator for ${s}${others === "" ? "" : `, only ${others}`}. Whether the station has an escalator DB does not list, I cannot tell from this.`,
    count: (kind: string, n: number) => kind === "elevator" ? (n === 1 ? "1 lift" : `${n} lifts`) : kind === "escalator" ? (n === 1 ? "1 escalator" : `${n} escalators`) : n === 1 ? "1 other facility" : `${n} other facilities`,
    and: " and ",
    allActive: (s: string, n: number) => `${n === 1 ? "The one reported facility" : `All ${n} reported facilities`} at ${s} ${n === 1 ? "is" : "are"} in service.`,
    someActive: (s: string, active: number, known: number, unknown: number) => known === 0
      ? `I cannot say whether ${unknown === 1 ? "the one reported facility" : `the ${unknown} reported facilities`} at ${s} ${unknown === 1 ? "is" : "are"} in service — that does not mean ${unknown === 1 ? "it is" : "they are"} out of service.`
      : `${active} of ${known} reported facilities with a known status at ${s} ${active === 1 ? "is" : "are"} in service.`,
    someBroken: (s: string, broken: number, known: number, unknown: number) =>
      `${broken} of ${known} reported facilities${unknown > 0 ? " with a known status" : ""} at ${s} ${broken === 1 ? "is" : "are"} out of service.`,
    someUnknown: (n: number) => `DB reports no status for ${n === 1 ? "1 facility" : `${n} facilities`}.`,
    scope: "Counted are the facilities DB reports for this station.",
    noCityOperator: "Lifts at stops of the city's transport operator (tram, light rail, underground) are not included — I hold no live data on them for this station.",
    unit: (no: string) => `unit ${no}`,
    elevator: "Lift", escalator: "Escalator", other: "Facility", active: "in service", inactive: "out of service", unknownState: "status unknown",
    more: (n: number) => `… and ${n} more.`,
  },
} as const;

/**
 * Phrases first, then words (main presentation/facility-names.ts): DB's German unit names, in English. This
 * table and EXPLANATION are built per call, never held at module level: Stryker mutated them statically, each
 * mutant against the whole suite (63 timed out at ~9.5 s each); in a function only the tests that read them run.
 */
function GLOSSARY(): readonly (readonly [RegExp, string])[] {
  return [
    [/\bBahnsteig\s+Gleis\b/giu, "platform"], [/\bS-Bstg\.?\s*/giu, "S-Bahn platform "], [/\bBstg\.?\s*/giu, "platform "], [/\bBahnsteig\b/giu, "platform"],
    [/\bGepäckbahnsteig\b/giu, "luggage platform"], [/\bLastenaufzug\b/giu, "goods lift"], [/\bAufzug\b/giu, "lift"], [/\bFahrtreppe\b/giu, "escalator"],
    [/\bKein\s+Halt\b/giu, "no stop"], [/\bGleise\b/giu, "platforms"], [/\bGleis\b/giu, "platform"], [/\bGl\.\s*(?=\d|$)/giu, "platform "],
    [/\b(?:zum|zur|zu|nach)\b/giu, "to"], [/\b(?:vom|von|ab)\b/giu, "from"], [/\baufwärts\b|\baufw\.(?=\s|$)/giu, "up"], [/\babwärts\b|\babw\.(?=\s|$)/giu, "down"],
    [/\bAusgang\b/giu, "exit"], [/\bEingang\b/giu, "entrance"], [/\bund\b/giu, "and"], [/\bSüdsteg\b/giu, "south footbridge"], [/\bNordsteg\b/giu, "north footbridge"],
    [/\bMittelsteg\b/giu, "middle footbridge"], [/\bSteg\b/giu, "footbridge"], [/\bSüd\b/giu, "south"], [/\bNord\b/giu, "north"], [/\bOst\b/giu, "east"], [/\bWest\b/giu, "west"],
    [/\b(\d)\.\s?UG\b/gu, "basement $1"], [/\bUG\b/gu, "basement"], [/\bEG\b/gu, "ground floor"], [/\b(\d)\.\s?OG\b/gu, "floor $1"], [/\bOG\b/gu, "upper floor"],
    [/\bUnterführung\b/giu, "underpass"], [/\bEmpfangsgebäude\b/giu, "station building"], [/\bVorplatz\b/giu, "forecourt"],
  ];
}
/** The English words the glossary writes: a lower-case word outside them is German left over. */
function englishOf(glossary: ReturnType<typeof GLOSSARY>): ReadonlySet<string> {
  return new Set(glossary.flatMap(([, to]) => to.toLowerCase().split(/\s+/u)).filter((w) => /^\p{Ll}+$/u.test(w)));
}

/** A unit's name as an English answer may print it: translated where the glossary finishes it, else quoted as DB's German. */
export function facilityNameIn(language: Language, name: string): string {
  const raw = name.replace(/\s+/gu, " ").trim();
  if (language === "de" || raw === "") return raw;
  const glossary = GLOSSARY();
  let out = raw;
  for (const [from, to] of glossary) out = out.replace(from, to);
  out = out.replace(/\s+/gu, " ").trim();
  const english = englishOf(glossary);
  const leftover = (out.match(/\p{L}+/gu) ?? []).some((w) => /^\p{Ll}{2,}$/u.test(w) && !english.has(w));
  return leftover ? `Provider text (German): "${raw}"` : out;
}

/** Today's EXPLANATION: an operator's state word in the answer's language; null where it only repeats the state. */
function EXPLANATION(): Readonly<Record<string, { de: string; en: string } | null>> {
  return {
    "available": null,
    "not available": null,
    "under construction": { de: "im Umbau", en: "under construction" },
    "under maintenance": { de: "in Wartung", en: "under maintenance" },
    "not monitored": { de: "wird nicht überwacht", en: "not monitored" },
    "monitoring disrupted": { de: "Überwachung gestört", en: "monitoring disrupted" },
    "monitoring not available": { de: "Überwachung nicht verfügbar", en: "monitoring not available" },
  };
}

/** Today's explanationIn: a known word translated, else the operator's own words quoted as theirs. */
export function explanationIn(language: Language, raw: string): string | null {
  const key = raw.trim().toLowerCase();
  const explanation = EXPLANATION();
  if (key in explanation) return explanation[key]?.[language] ?? null;
  return language === "de" ? `Meldung der Bahn: „${raw}“` : `DB's report: "${raw}"`;
}

const STATE_ORDER: Readonly<Record<string, number>> = { inactive: 0, unknown: 1, active: 2 };

function kindCounts(language: Language, facilities: readonly Facility[]): string {
  const c = COPY[language];
  const parts = ["elevator", "escalator", "other"].map((k) => [k, facilities.filter((f) => (k === "other" ? f.kind !== "elevator" && f.kind !== "escalator" : f.kind === k)).length] as const)
    .filter(([, n]) => n > 0).map(([k, n]) => c.count(k, n));
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")}${c.and}${parts[parts.length - 1]!}`;
}

/** The unit's number as today prints it: the operator's equipment number, without the API's id prefix. */
export const unitNumber = (id: string): string => id.replace(/^(?:fasta|equipment):/u, "");

export function facilityLine(language: Language, f: Facility, withUnit: boolean): string {
  const c = COPY[language];
  const kind = f.kind === "elevator" ? c.elevator : f.kind === "escalator" ? c.escalator : c.other;
  const unit = withUnit ? ` (${c.unit(unitNumber(f.id))})` : "";
  const where = f.position === null ? unit : ` ${facilityNameIn(language, f.position)}${unit}`;
  const state = f.state === "active" ? c.active : f.state === "inactive" ? c.inactive : c.unknownState;
  const raw = f.stateExplanation ?? null;
  const said = raw !== null && f.state !== "active" ? explanationIn(language, raw) : null;
  return `${kind}${where}: ${state}${said === null ? "" : ` — ${said}`}`;
}

/**
 * The answer's text. `d` is the read the answer is about (filtered when a kind was asked); `others` the unfiltered
 * read when that came back empty, so the sentence can say what DB does list ("nur 6 Fahrtreppen").
 */
export function facilitiesText(language: Language, d: StationFacilitiesData, kind: string | undefined, limit: number, others: readonly Facility[] = []): string {
  const c = COPY[language];
  const s = d.station.name;
  const total = d.counts.active + d.counts.inactive + d.counts.unknown;
  if (total === 0) return kind === undefined ? c.none(s) : c.noneFiltered(s, kind, kindCounts(language, others.filter((f) => f.kind !== kind)));
  const { active, inactive, unknown } = d.counts;
  const known = total - unknown;
  const head = inactive > 0 ? c.someBroken(s, inactive, known, unknown) : unknown > 0 ? c.someActive(s, active, known, unknown) : c.allActive(s, total);
  const platforms = (d.platforms?.stations ?? []).filter(platformAccessSays);
  const day = d.platforms?.releasedOn ?? null;
  const platformsScope = platforms.length === 0 ? "" : PLATFORM_COPY[language].scope(day === null ? null : dayIn(language, day));
  const summary = [head, unknown > 0 ? c.someUnknown(unknown) : "", c.scope, platformsScope, c.noCityOperator].filter((x) => x !== "").join(" ");
  const sorted = [...d.facilities].sort((a, b) => (STATE_ORDER[a.state] ?? 1) - (STATE_ORDER[b.state] ?? 1) || (a.position ?? "").localeCompare(b.position ?? ""));
  const key = (f: Facility): string => `${f.kind}\u0000${f.position ?? ""}`;
  const same = new Map<string, number>();
  for (const f of sorted) same.set(key(f), (same.get(key(f)) ?? 0) + 1);
  const shown = sorted.slice(0, limit);
  const lines = [summary, ...shown.map((f) => facilityLine(language, f, f.nameShared === true || (same.get(key(f)) ?? 0) > 1))];
  if (total > shown.length) lines.push(c.more(total - shown.length));
  return [lines.join("\n"), ...platforms.map((p) => platformText(language, p, s))].join("\n\n");
}

// ---------------------------------------------------------------------------
// Platforms: today's platform block (DB OpenStation's inventory)
// ---------------------------------------------------------------------------

type PlatformStation = T.PlatformAccess["stations"][number];
type Platform = PlatformStation["list"][number];

/** Today's PLATFORM_COPY. */
const PLATFORM_COPY = {
  de: {
    head: (station: string, counts: string) => `Bahnsteige in ${station} laut Stationsdaten der Bahn: ${counts}.`,
    countStepFree: (k: T.Limitation, n: number, total: number) =>
      k === "yes" ? `${n} von ${total} stufenfrei` : k === "partial" ? `${n} teilweise stufenfrei` : k === "no" ? `${n} nicht stufenfrei` : `${n} ohne Angabe`,
    station: (facts: string) => `Der Bahnhof insgesamt: ${facts}.`,
    stepFree: { yes: "stufenfrei", partial: "teilweise stufenfrei", no: "nicht stufenfrei", unknown: "stufenfrei: unbekannt" },
    wheelchair: { yes: "rollstuhlgerecht", partial: "eingeschränkt rollstuhlgerecht", no: "nicht rollstuhlgerecht", unknown: "rollstuhlgerecht: unbekannt" },
    tactileGuidance: { yes: "Blindenleitsystem", partial: "Blindenleitsystem teilweise", no: "kein Blindenleitsystem", unknown: "Blindenleitsystem: unbekannt" },
    levelBoarding: { yes: "stufenloser Einstieg in den Zug", partial: "stufenloser Einstieg teilweise", no: "kein stufenloser Einstieg in den Zug", unknown: "stufenloser Einstieg in den Zug: unbekannt" },
    height: (min: number, max: number) => (min === max ? `Bahnsteighöhe ${min} cm` : `Bahnsteighöhe ${min}–${max} cm`),
    noFacts: "Barrierefreiheit: keine Angabe der Bahn",
    tracks: (codes: readonly string[]) => `Gleis ${codes.map((x) => x.replace(/^Gleis\s+/iu, "")).join(", ")}`,
    platform: "Bahnsteig",
    more: (n: number) => `… und ${n} weitere Bahnsteige.`,
    scope: (stand: string | null) => `Die Angaben zu den Bahnsteigen stammen aus den Stationsdaten der Bahn${stand === null ? "" : `, Stand ${stand}`}.`,
  },
  en: {
    head: (station: string, counts: string) => `Platforms at ${station} per DB's station data: ${counts}.`,
    countStepFree: (k: T.Limitation, n: number, total: number) =>
      k === "yes" ? `${n} of ${total} step-free` : k === "partial" ? `${n} partly step-free` : k === "no" ? `${n} not step-free` : `${n} not stated`,
    station: (facts: string) => `The station as a whole: ${facts}.`,
    stepFree: { yes: "step-free", partial: "partly step-free", no: "not step-free", unknown: "step-free: unknown" },
    wheelchair: { yes: "wheelchair accessible", partial: "partly wheelchair accessible", no: "not wheelchair accessible", unknown: "wheelchair access: unknown" },
    tactileGuidance: { yes: "tactile guidance", partial: "tactile guidance in part", no: "no tactile guidance", unknown: "tactile guidance: unknown" },
    levelBoarding: { yes: "level boarding into the train", partial: "level boarding in part", no: "no level boarding into the train", unknown: "level boarding into the train: unknown" },
    height: (min: number, max: number) => (min === max ? `platform height ${min} cm` : `platform height ${min}–${max} cm`),
    noFacts: "accessibility: not stated by DB",
    tracks: (codes: readonly string[]) => `${codes.length === 1 ? "Platform" : "Platforms"} ${codes.map((x) => x.replace(/^Gleis\s+/iu, "")).join(", ")}`,
    platform: "Platform",
    more: (n: number) => `… and ${n} more platforms.`,
    scope: (stand: string | null) => `The platform details are from DB's station data${stand === null ? "" : `, as of ${stand}`}.`,
  },
} as const;

/** Today's PLATFORMS_MAX. */
export const PLATFORMS_MAX = 24;

/** A Berlin calendar day (YYYY-MM-DD) as today's berlinDateIn says it. */
const dayIn = (language: Language, day: string): string => (language === "de" ? day.split("-").reverse().join(".") : day);

/** Today's platformAccessSays: the inventory states something there. */
export const platformAccessSays = (s: PlatformStation): boolean => s.station !== null || s.list.some((p) => p.stated || p.heightCm !== null);

/** Today's platformLine: "Platforms 1, 2: step-free · wheelchair accessible · platform height 96 cm · …". */
export function platformLine(language: Language, p: Platform): string {
  const c = PLATFORM_COPY[language];
  const named = p.name === null ? null : facilityNameIn(language, p.name);
  const name = named !== null && language !== "de" && p.tracks.length > 0 && /^platforms? [\d\s/a-z,]*$/iu.test(named) ? null : named;
  const label = p.tracks.length > 0 ? `${c.tracks(p.tracks)}${name === null ? "" : ` (${name})`}` : (name ?? c.platform);
  const height = p.heightCm === null ? null : c.height(p.heightCm.min, p.heightCm.max);
  const facts = p.stated ? [c.stepFree[p.stepFree], c.wheelchair[p.wheelchair], height, c.tactileGuidance[p.tactileGuidance], c.levelBoarding[p.levelBoarding]] : [height, c.noFacts];
  return `${label}: ${facts.filter((x): x is string => x !== null).join(" · ")}`;
}

/** Today's platformText: the head with the step-free counts and the station's own facts, one line per platform. */
export function platformText(language: Language, s: PlatformStation, fallbackName: string): string {
  const c = PLATFORM_COPY[language];
  const order: readonly T.Limitation[] = ["yes", "partial", "no", "unknown"];
  const counts = order.filter((k) => s.stepFreeCounts[k] > 0).map((k) => c.countStepFree(k, s.stepFreeCounts[k], s.total)).join(", ");
  const head = c.head(s.name ?? fallbackName, counts === "" ? c.noFacts : counts);
  const station = s.station === null ? null : c.station(`${c.stepFree[s.station.stepFree]}, ${c.wheelchair[s.station.wheelchair]}`);
  const shown = s.list.slice(0, PLATFORMS_MAX);
  const lines = [[head, station].filter((x): x is string => x !== null).join(" "), ...shown.map((p) => platformLine(language, p))];
  if (s.total > shown.length) lines.push(c.more(s.total - shown.length));
  return lines.join("\n");
}
