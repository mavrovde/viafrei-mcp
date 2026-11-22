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

/** The Land of a district by its key's first two digits, in the answer's language; else the API's Land row. */
function landName(d: T.LocationData, language: Language): string | null {
  const key = d.district?.code ?? d.state?.code ?? null;
  const land = key === null ? undefined : LANDS.find((l) => l.code === key.slice(0, 2));
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
  const lines: string[] = [c.head(lat, lon)];
  if (d.mayLieOutsideGermany) lines.push(`- ${c.abroad}`);
  if (d.address !== null) {
    lines.push(`- ${c.address(addressText(d.address), kmText(d.address.distanceM, language))}`);
  } else {
    // Today's server first asks whether any address is loaded at all; the contract's coverage names the Länder they cover.
    const cov = await ctx.api.get<T.PlacesCoverageData>("getPlacesCoverage", {});
    lines.push(`- ${cov.data.addresses.length === 0 ? c.addressNotLoaded : c.addressNone}`);
  }
  const away = (p: T.LocationPlace): string => kmText(haversineM(lat, lon, p.location.lat, p.location.lon), language);
  if (d.municipality !== null) lines.push(`- ${c.city}: ${d.municipality.name} (${away(d.municipality)})`);
  if (d.district !== null) lines.push(`- ${c.district}: ${d.district.name} (${away(d.district)})`);
  const land = landName(d, language);
  if (land !== null) lines.push(`- ${c.land}: ${land}`);
  if (d.lowEmissionZone !== null && !d.mayLieOutsideGermany) lines.push(`- ${c.zone}: ${zoneHead(d.lowEmissionZone, language)}`);
  if (d.address !== null && d.address.dataAsOf !== null) lines.push("", c.stand(d.address.dataAsOf));
  return toolResult(lines.join("\n"), [r.meta], language);
};
