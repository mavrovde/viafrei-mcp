/**
 * describe_location: a coordinate in words, in today's server's words (packages/mcp describe_location.ts COPY,
 * verbatim, and the low-emission head lines of lez-answer-text.ts). The API names one nearest municipality, the
 * nearest district and its Land; today's server also names the Gemeinde the point lies in by its key (and so a
 * kreisfreie Stadt), the nearest junction and the border notes, which the API does not carry yet. The answer
 * therefore takes today's shape for a point without a Gemeinde: the place, the district, the Land, each place
 * with its distance as today measures it (a sphere from the asked point to the place's point).
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type * as T from "../api/types.js";
import { toolResult, type Language } from "../presentation.js";
import { atParam, num, type Handler } from "./context.js";
import { kmText } from "./nearby.js";
import { LANDS } from "./region.js";

/** Verbatim from today's server (describe_location.ts COPY, KIND_LABEL, LAND_LABEL). */
export const LOCATION_WORDS = {
  de: {
    head: (lat: number, lon: number): string => `Beschreibung für ${lat.toFixed(4)}, ${lon.toFixed(4)}:`,
    address: (a: string, km: string): string => `Nächste Adresse: ${a} (${km})`,
    addressNone: "Keine Adresse in der Nähe bekannt.",
    addressNotLoaded: "Für diese Installation sind keine OpenStreetMap-Adressdaten geladen.",
    abroad: "Dieser Punkt liegt möglicherweise außerhalb Deutschlands, vor der Küste oder nahe der Grenze: die deutschen Adressen in der Nähe liegen alle auf einer Seite. Die Angaben unten sind die nächsten Punkte in Deutschland und beschreiben den Punkt selbst womöglich nicht.",
    stand: (d: string): string => `Adressdaten Stand: ${d}`,
    zone: "Umweltzone",
    here: "Der Punkt",
    city: "Ort",
    district: "Kreis",
    land: "Bundesland",
    gemeinde: "Gemeinde",
    nearestGemeinde: (name: string): string => `Gemeinde (nächster Gemeindepunkt): ${name}`,
    bezirk: "Regierungsbezirk",
    kreisfrei: "kreisfreie Stadt",
    junction: "Anschlussstelle",
    interchange: "Autobahnkreuz/-dreieck",
    junctionFar: "Das Verzeichnis kennt nur Anschlussstellen, die in aktuellen Verkehrsmeldungen genannt wurden — eine nähere kann fehlen.",
    unverified: (doubt: string): string => `nicht bestätigt: ${doubt} — bitte an der Quelle nachlesen`,
  },
  en: {
    head: (lat: number, lon: number): string => `Description of ${lat.toFixed(4)}, ${lon.toFixed(4)}:`,
    address: (a: string, km: string): string => `Nearest address: ${a} (${km})`,
    addressNone: "No address known nearby.",
    addressNotLoaded: "This installation holds no OpenStreetMap address data.",
    abroad: "This point may lie outside Germany, off the coast or near the border: the German addresses near it all lie to one side. The facts below are the nearest points in Germany and may not describe the point itself.",
    stand: (d: string): string => `Address data as of ${d}`,
    zone: "Low-emission zone",
    here: "The point",
    city: "Settlement",
    district: "District",
    land: "State (Land)",
    gemeinde: "Municipality",
    nearestGemeinde: (name: string): string => `Municipality (nearest municipality point): ${name}`,
    bezirk: "Government region",
    kreisfrei: "independent city",
    junction: "Junction",
    interchange: "Interchange",
    junctionFar: "The index holds only junctions named in recent traffic reports — a closer one may be missing.",
    unverified: (doubt: string): string => `not confirmed: ${doubt} — check the source`,
  },
} as const;

/** Today's distance (geo/distance.ts haversineM): a sphere of the mean Earth radius. */
export function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6_371_008.8;
  const rad = (d: number): number => (d * Math.PI) / 180;
  const h = Math.sin(rad(bLat - aLat) / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLon - aLon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Today's zone distance (lez-answer-text.ts lezDistance): tens of metres under 1 km, at least 10 m. */
const lezDistance = (m: number, language: Language): string => {
  if (m < 1000) return `${String(Math.max(10, Math.round(m / 10) * 10))} m`;
  const k = (Math.round(m / 100) / 10).toFixed(1);
  return `${language === "de" ? k.replace(".", ",") : k} km`;
};

/** The zone's head line, as today's lezAnswerLines opens it for "the point". */
export function zoneHead(z: T.LowEmissionZone, language: Language): string {
  const de = language === "de";
  const where = LOCATION_WORDS[language].here;
  if (z.liftedOn !== null && z.liftedOn !== undefined) {
    return de
      ? `${where}: Die ${z.zone ?? "Umweltzone"} wurde laut Umweltbundesamt am ${z.liftedOn} aufgehoben; eine Plakette ist dort nicht mehr nötig — maßgeblich bleibt die Beschilderung vor Ort.`
      : `${where}: the ${z.zone ?? "low-emission zone"} was lifted on ${z.liftedOn} according to the Umweltbundesamt; no plaque is needed there any more — the signs on the spot still decide.`;
  }
  switch (z.verdict) {
    case "inside":
      return de ? `${where} liegt in der ${z.zone ?? "Umweltzone"}.` : `${where} lies inside the ${z.zone ?? "low-emission zone"} (Umweltzone).`;
    case "transfer":
      return de ? `${where} liegt in der freigegebenen Fläche „${z.zone ?? ""}“ am Rand der Umweltzone.` : `${where} lies in the released area “${z.zone ?? ""}” at the edge of the low-emission zone.`;
    case "outside":
      return de
        ? `${where} liegt außerhalb der ${z.zone ?? "Umweltzone"}; ihre Grenze ist ${lezDistance(z.distanceM ?? 0, language)} entfernt.`
        : `${where} lies outside the ${z.zone ?? "low-emission zone"}; its boundary is ${lezDistance(z.distanceM ?? 0, language)} away.`;
    default:
      return de
        ? "In der Nähe liegt uns keine Umweltzonen-Grenze vor — das heißt nicht, dass es dort keine Zone gibt; maßgeblich ist die Beschilderung (Zeichen 270.1)."
        : "We hold no low-emission-zone boundary nearby — that does not mean there is no zone; the signs (sign 270.1) decide.";
  }
}

/** Verbatim from today's server (ingest domain/roads/lez-zones.ts LEZ_GREEN_PLAQUE, LEZ_NATIONAL_PLAQUE, UNVERIFIED_NOTE). */
const PLAQUE = {
  green: {
    de: "Erforderlich: die grüne Plakette (Schadstoffgruppe 4). Sie gibt es bei Zulassungsstellen, TÜV/DEKRA/GTÜ/KÜS und anerkannten Werkstätten gegen Vorlage der Zulassungsbescheinigung Teil I.",
    en: "Required: the green plaque (emission group 4). You can buy it at vehicle registration offices, TÜV/DEKRA/GTÜ/KÜS and approved garages on presentation of the vehicle registration document (part I).",
  },
  national: {
    de: "Praktisch alle ausgeschilderten Umweltzonen verlangen heute die grüne Plakette (Schadstoffgruppe 4). Das Zusatzzeichen unter dem Schild sagt verbindlich, welche Plakette gilt. (Umweltbundesamt, Umweltzonen in Deutschland; nicht bestätigt: ob irgendwo noch eine einzelne Zone gelbe oder rote Plaketten zulässt — im Zweifel gilt das Zusatzzeichen — bitte an der Quelle nachlesen)",
    en: "In practice every signposted Umweltzone today requires the green plaque (emission group 4). The supplementary sign under the zone sign is what actually decides which plaque applies. (Umweltbundesamt, Umweltzonen in Deutschland; not confirmed: whether any single zone still admits yellow or red plaques — if in doubt, the supplementary sign decides — check the source)",
  },
} as const;

/** Today's lezZoneSentence source part: " (source; not confirmed: doubt — check the source)", nothing without the proposed source. */
export function plaqueSource(p: T.ZonePlaque, language: Language): string {
  const source = p.sourceName ?? null;
  if (source === null) return "";
  return ` (${p.toVerify === undefined || p.toVerify === null ? source : `${source}; ${LOCATION_WORDS[language].unverified(p.toVerify)}`})`;
}

/** Today's JUNCTION_HONEST_M: past this a junction from the traffic reports' index is said to be a floor. */
const JUNCTION_HONEST_M = 15_000;
/** Today's INTERCHANGE_NAME. */
const INTERCHANGE_NAME = /^(autobahn)?(kreuz|dreieck)\b|^a[kd]\s/iu;

/** Today's junction line: the label (an interchange said as one), the name with its road, the distance; the floor note for a far index row. */
export function junctionLines(j: NonNullable<T.LocationData["junction"]>, lat: number, lon: number, language: Language): string[] {
  const c = LOCATION_WORDS[language];
  const m = haversineM(lat, lon, j.location.lat, j.location.lon);
  const name = j.road === null || j.name.includes(j.road) ? j.name : `${j.name} (${j.road})`;
  const out = [`- ${INTERCHANGE_NAME.test(j.name) ? c.interchange : c.junction}: ${name} (${kmText(m, language)})`];
  if (j.from === "gazetteer" && m > JUNCTION_HONEST_M) out.push(`  ${c.junctionFar}`);
  return out;
}

/** Today's areas for a point with its Gemeinde by key: the Gemeinde (no distance), its Kreis (a kreisfreie Stadt said so; a city-state none), the Regierungsbezirk. */
export function gemeindeLines(g: NonNullable<T.LocationData["gemeinde"]>, language: Language): string[] {
  const c = LOCATION_WORDS[language];
  const out = [`- ${g.inside ? `${c.gemeinde}: ${g.name}` : c.nearestGemeinde(g.name)}`];
  if (g.code.slice(2) !== "000000" && g.kreis !== null) out.push(`- ${c.district}: ${g.code.endsWith("000") ? `${g.kreis} (${c.kreisfrei})` : g.kreis}`);
  if (g.bezirk !== null) out.push(`- ${c.bezirk}: ${g.bezirk}`);
  return out;
}

/** A calendar day in Berlin: "2026-11-18" / "18.11.2026" (lez-answer-text.ts lezDay). */
function zoneDay(iso: string, language: Language): string {
  const day = /^\d{4}-\d{2}-\d{2}$/u.test(iso) ? iso : new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  if (language === "en") return day;
  const [y, m, d] = day.split("-");
  return `${d ?? ""}.${m ?? ""}.${y ?? ""}`;
}

/**
 * The lines today's lezAnswerLines adds under the head for a zone in force: the exempt road and the released area
 * inside it, the plaque, and the data's date. A curated entry's own source name and open doubt are not in the
 * contract, so its plaque sentence stands without them.
 */
export function zoneDetail(z: T.LowEmissionZone, language: Language): string[] {
  if (z.liftedOn !== null && z.liftedOn !== undefined) return [];
  const de = language === "de";
  const out: string[] = [];
  if (z.verdict === "inside") {
    if (z.exemptRoad) out.push(de ? `Der Punkt liegt auf der ${z.exemptRoad}, die laut Herausgeber nicht zur Umweltzone gehört.` : `The point is on the ${z.exemptRoad}, which the publisher lists as not part of the zone.`);
    if (z.releasedArea) out.push(de ? `Er liegt in der freigegebenen Fläche „${z.releasedArea}“.` : `It lies in the released area “${z.releasedArea}”.`);
  }
  const p = z.plaque ?? null;
  if (p !== null) {
    if (p.from === "national_fact") out.push(PLAQUE.national[language]);
    else if (p.plakette === "green") out.push(`${PLAQUE.green[language]}${plaqueSource(p, language)}`);
  }
  if (z.dataDate) out.push(de ? `Stand der Zonendaten: ${zoneDay(z.dataDate, language)} (Angabe des Herausgebers).` : `Zone data as of ${zoneDay(z.dataDate, language)} (the publisher's date).`);
  else if (z.boundaryReadAt) out.push(de ? `Zonengrenze zuletzt abgerufen am ${zoneDay(z.boundaryReadAt, language)}.` : `Zone boundary last read on ${zoneDay(z.boundaryReadAt, language)}.`);
  return out;
}

/** The Land of a district by its key's first two digits, in the answer's language; else the API's Land row. */
function landName(d: T.LocationData, language: Language): string | null {
  const key = d.district?.code ?? d.state?.code ?? null;
  const land = key === null ? undefined : LANDS().find((l) => l.code === key.slice(0, 2));
  return land?.[language] ?? d.state?.name ?? null;
}

const addressText = (a: T.LocationAddress): string =>
  [[a.street, a.number].filter((x) => x !== null && x !== "").join(" "), [a.postcode, a.place].filter((x) => x !== null && x !== "").join(" ")].filter((x) => x !== "").join(", ");

export const describeLocation: Handler = async (args, ctx): Promise<CallToolResult> => {
  const { language } = ctx;
  const c = LOCATION_WORDS[language];
  const lat = num(args["lat"])!;
  const lon = num(args["lon"])!;
  const r = await ctx.api.get<T.LocationData>("describeLocation", { at: atParam({ lat, lon }) });
  const d = r.data;
  // Today's server first asks whether any address is loaded at all (the contract's coverage names the Länder
  // they cover), and says a point may lie abroad only from loaded addresses: with none, every side is empty.
  const loaded = d.address !== null || (await ctx.api.get<T.PlacesCoverageData>("getPlacesCoverage", {})).data.addresses.length > 0;
  const abroad = loaded && d.mayLieOutsideGermany;
  const lines: string[] = [c.head(lat, lon)];
  if (abroad) lines.push(`- ${c.abroad}`);
  if (d.address !== null) lines.push(`- ${c.address(addressText(d.address), kmText(d.address.distanceM, language))}`);
  else lines.push(`- ${loaded ? c.addressNone : c.addressNotLoaded}`);
  const away = (p: T.LocationPlace): string => kmText(haversineM(lat, lon, p.location.lat, p.location.lon), language);
  if (d.municipality !== null) lines.push(`- ${c.city}: ${d.municipality.name} (${away(d.municipality)})`);
  const g = d.gemeinde ?? null;
  if (g !== null) lines.push(...gemeindeLines(g, language));
  else if (d.district !== null) lines.push(`- ${c.district}: ${d.district.name} (${away(d.district)})`);
  const land = landName(d, language);
  if (land !== null) lines.push(`- ${c.land}: ${land}`);
  if (d.junction !== undefined && d.junction !== null) lines.push(...junctionLines(d.junction, lat, lon, language));
  if (d.lowEmissionZone !== null && !abroad) lines.push(`- ${c.zone}: ${zoneHead(d.lowEmissionZone, language)}`, ...zoneDetail(d.lowEmissionZone, language).map((l) => `  ${l}`));
  if (d.address !== null && d.address.dataAsOf !== null) lines.push("", c.stand(d.address.dataAsOf));
  return toolResult(lines.join("\n"), [r.meta], language);
};
