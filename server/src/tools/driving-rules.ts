/**
 * get_driving_rules, in today's server's words (content/rules/render.ts, tools/get_driving_rules.ts): a
 * headline, one bullet per rule with its citation and any open doubt, at most eleven body lines and a
 * line naming what was left out, the review date as the Stand and the disclaimer as the last line.
 * The rules, their order, the zone list's entry and the review dates are the API's; the words are ours.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DataMeta } from "../api/client.js";
import type * as T from "../api/types.js";
import { toolResult, type Language } from "../presentation.js";
import { atParam, isResult, num, position, str, type Handler } from "./context.js";

/** The nine topics, in the order the overview names them. */
export const RULE_TOPICS = ["lez", "speed", "winter", "alcohol", "toll", "truck_ban", "equipment", "emergency", "ev"] as const;

/** At most eleven lines of body; the headline stands on top. */
export const MAX_BODY_LINES = 11;

const L = (language: Language, de: string, en: string): string => (language === "de" ? de : en);
const bullet = (s: string): string => `• ${s}`;

type Line = { key: string; text: string };

const OVERVIEW_HEAD: Record<Language, string> = {
  de: "Autofahren in Deutschland — das Wichtigste in neun Themen (topic=… für Details):",
  en: "Driving in Germany — the essentials in nine topics (topic=… for detail):",
};

/** A doubt is named, never dropped: which detail, and where to read it. */
export const UNVERIFIED_NOTE: Record<Language, (doubt: string) => string> = {
  de: (doubt) => `nicht bestätigt: ${doubt} — bitte an der Quelle nachlesen`,
  en: (doubt) => `not confirmed: ${doubt} — check the source`,
};

export const LEZ_GREEN_PLAQUE: Record<Language, string> = {
  de: "Erforderlich: die grüne Plakette (Schadstoffgruppe 4). Sie gibt es bei Zulassungsstellen, TÜV/DEKRA/GTÜ/KÜS und anerkannten Werkstätten gegen Vorlage der Zulassungsbescheinigung Teil I.",
  en: "Required: the green plaque (emission group 4). You can buy it at vehicle registration offices, TÜV/DEKRA/GTÜ/KÜS and approved garages on presentation of the vehicle registration document (part I).",
};

export const LEZ_LIST_CAVEAT: Record<Language, string> = {
  de: "Diese Liste ist unsere Abschrift der Liste des Umweltbundesamts, nicht das amtliche Verzeichnis: Fehlt eine Stadt hier, heißt das nicht, dass sie keine Umweltzone hat. Die maßgebliche Liste führt das Umweltbundesamt.",
  en: "This list is our copy of the Umweltbundesamt's list, not the official register: a city missing here is not a city without a zone. The authoritative list is kept by the Umweltbundesamt.",
};

/** An entry whose zone data is under a closed licence: there is a zone, and we may not say where. */
const closedLicence = (name: string, language: Language): string => L(language,
  `Die Zonendaten für ${name} stehen unter einer geschlossenen Lizenz, die uns die Weitergabe verbietet. Das heißt ausdrücklich nicht, dass es keine Zone gibt: ohne grüne Plakette besser nicht hineinfahren und die Angaben der Stadt ${name} sowie die Liste des Umweltbundesamts prüfen.`,
  `The zone data for ${name} is under a closed licence that forbids us to pass it on. This expressly does not mean there is no zone: without a green plaque do not drive in, and check the City of ${name}'s own information and the Umweltbundesamt list.`);

/** "19.09.2026" in German, the ISO date in English. */
export const reviewDate = (iso: string, language: Language): string => (language === "en" ? iso : `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`);

export const disclaimer = (reviewedAt: string, language: Language): string => L(language,
  `Geprüft am ${reviewDate(reviewedAt, "de")} · Informativ, keine Rechtsberatung (informational, not legal advice).`,
  `Reviewed ${reviewDate(reviewedAt, "en")} · Informational, not legal advice.`);

/** The line saying what the bound left out, and the narrower call that brings it; null when nothing was. */
export function moreLine(omitted: number, language: Language, topic: string | undefined): string | null {
  if (omitted <= 0) return null;
  const narrow = topic ? 'city="…"' : 'topic="…"';
  return L(language,
    `… und ${omitted} weitere ${omitted === 1 ? "Regel" : "Regeln"} ${topic ? "zu diesem Thema" : "zu den übrigen Themen"} — mit ${narrow} gezielt nachfragen.`,
    `… and ${omitted} more rule${omitted === 1 ? "" : "s"} ${topic ? "on this topic" : "on the other topics"} — ask again with ${narrow} for the rest.`);
}

const citation = (r: T.DrivingRule, language: Language): string | null => {
  const parts = [r.legalBasis, r.unconfirmed === null ? null : UNVERIFIED_NOTE[language](r.unconfirmed)].filter((x): x is string => x !== null);
  return parts.length === 0 ? null : parts.join("; ");
};

const ruleLine = (r: T.DrivingRule, language: Language): Line => {
  const c = citation(r, language);
  return { key: r.id, text: bullet(c === null ? r.text : `${r.text} (${c})`) };
};

/** The zone list's entry for a city: the line, and the headline it gives the answer. */
function zoneCityLines(z: T.ZoneCity, language: Language): { head: string; line: Line } {
  if (!z.covered && z.zone === null) {
    return {
      head: L(language, `Umweltzone ${z.name}: kein Eintrag bei uns — das heißt nicht, dass es keine Zone gibt.`, `Low-emission zone ${z.name}: no entry with us — that does not mean there is no zone.`),
      line: { key: "lez.city.unknown", text: bullet(L(language, `Zu „${z.name}“ liegt uns kein Zoneneintrag vor — das heißt nicht, dass es dort keine Umweltzone gibt. ${LEZ_LIST_CAVEAT.de}`, `We have no zone entry for "${z.name}" — that does not mean the city has no low-emission zone. ${LEZ_LIST_CAVEAT.en}`)) },
    };
  }
  if (!z.covered) {
    return {
      head: L(language, `Umweltzone ${z.name}: von uns nicht abgedeckt (geschlossene Lizenz) — es gibt dort eine Zone, also nicht ohne grüne Plakette hineinfahren.`, `Low-emission zone ${z.name}: not covered by us (closed licence) — the city does have a zone, so do not drive in without a green plaque.`),
      line: { key: "lez.city", text: bullet(`${z.name}: ${z.zone} ${closedLicence(z.name, language)}`) },
    };
  }
  const green = z.plakette === "green";
  return {
    head: green ? L(language, `Umweltzone ${z.name}: Ja, Sie brauchen die grüne Feinstaubplakette.`, `Low-emission zone ${z.name}: yes, you need the green Feinstaubplakette.`) : `${z.name}: ${z.zone}`,
    line: { key: "lez.city", text: bullet(`${z.name}: ${[z.zone, green ? LEZ_GREEN_PLAQUE[language] : null].filter((x): x is string => x !== null).join(" ")}`) },
  };
}

const factJson = (r: T.DrivingRule, topic: string): Record<string, unknown> => ({
  key: r.id, topic, text: r.text, source: r.sourceUrl, sourceName: r.legalBasis, lastReviewed: r.reviewedOn, ...(r.unconfirmed === null ? {} : { toVerify: r.unconfirmed }),
});

/** A point we hold no zone boundary for: no boundary is no all-clear. */
export const lezNoBoundaryCaveat = (where: string, language: Language): string => L(language,
  `Achtung: Für ${where} liegt uns keine Umweltzonen-Grenze vor. Daraus folgt NICHT, dass Sie dort ohne Plakette fahren dürfen — es kann dort eine Umweltzone geben; maßgeblich ist die Beschilderung (Zeichen 270.1), die vollständige Liste der Zonen führt das Umweltbundesamt.`,
  `Caution: we hold no low-emission-zone boundary for ${where}. That does NOT mean you may drive there without a plaque — there may be a zone; the signs (sign 270.1) decide, and the Umweltbundesamt keeps the complete list of zones.`);

const oldest = (dates: readonly string[]): string => [...dates].sort()[0] ?? "";

export const getDrivingRules: Handler = async (args, ctx): Promise<CallToolResult> => {
  const { language } = ctx;
  const city = str(args["city"]);
  const hasPoint = str(args["place"]) !== undefined || (num(args["lat"]) !== undefined && num(args["lon"]) !== undefined);
  // A point with no topic is a zone question: the one rule that depends on where.
  const topic = str(args["topic"]) ?? (hasPoint ? "lez" : undefined);
  let at: string | undefined;
  let placeLabel: string | null = null;
  if (hasPoint && topic === "lez") {
    const pos = await position(args, ctx);
    if (isResult(pos)) return pos;
    at = atParam(pos.at);
    placeLabel = pos.label ?? `${pos.at.lat.toFixed(3)}, ${pos.at.lon.toFixed(3)}`;
  }
  const metas: DataMeta[] = [];
  const lines: Line[] = [];
  const used: { rule: T.DrivingRule; topic: string }[] = [];
  let head: string;
  let zoneCity: T.ZoneCity | undefined;
  let zoneVerdict: T.ZoneVerdict | undefined;
  if (topic === undefined) {
    // The overview: the first rule of every topic, under the topic's title.
    const reads = await Promise.all(RULE_TOPICS.map((t) => ctx.api.get<T.DrivingRulesData>("getDrivingRules", { topic: t, city: t === "lez" ? city : undefined })));
    for (const r of reads) {
      metas.push(r.meta);
      const first = r.data.rules[0];
      if (first === undefined) continue;
      used.push({ rule: first, topic: r.data.topic });
      const c = citation({ ...first, unconfirmed: null }, language);
      lines.push({ key: first.id, text: bullet(`${r.data.title} (topic="${r.data.topic}"): ${first.text}${c === null ? "" : ` (${c})`}`) });
    }
    zoneCity = reads[0]?.data.zoneCity;
    if (city !== undefined && zoneCity !== undefined) lines.unshift(zoneCityLines(zoneCity, language).line);
    head = OVERVIEW_HEAD[language];
  } else {
    const r = await ctx.api.get<T.DrivingRulesData>("getDrivingRules", { topic, city, at });
    metas.push(r.meta);
    const d = r.data;
    zoneCity = d.zoneCity;
    zoneVerdict = d.zoneVerdict;
    const z = topic === "lez" && city !== undefined && zoneCity !== undefined ? zoneCityLines(zoneCity, language) : null;
    if (z !== null) lines.push(z.line);
    lines.push(...d.rules.map((x) => ruleLine(x, language)));
    used.push(...d.rules.map((rule) => ({ rule, topic: d.topic })));
    if (topic === "lez") lines.push({ key: "lez.list_caveat", text: bullet(LEZ_LIST_CAVEAT[language]) });
    // First, not last: "may I park free with an E plate" is the question, and "the city decides" must survive the bound.
    if (topic === "ev" && city !== undefined) {
      lines.unshift({ key: "ev.city_caveat", text: bullet(L(language,
        `Für ${city} gilt: Ob und wo dort mit E-Kennzeichen kostenlos oder ermäßigt geparkt werden darf, entscheidet die Stadt selbst — es zählt das Zusatzzeichen am Parkplatz, nicht das Kennzeichen allein.`,
        `For ${city}: whether and where an E plate parks free or at a reduced rate is the city's own decision — the supplementary sign at the parking space decides, not the plate.`)) });
    }
    if (topic !== "lez" && topic !== "ev" && city !== undefined) {
      lines.push({ key: "city.no_local_rule", text: bullet(L(language,
        `Für ${city} gelten dieselben bundesweiten Regeln; stadtspezifisch ist hier nur die Umweltzone (topic="lez").`,
        `The same nationwide rules apply in ${city}; the only city-specific topic here is the low-emission zone (topic="lez").`)) });
    }
    head = placeLabel !== null ? L(language, `Umweltzone und Plakette — ${placeLabel}:`, `Low-emission zone and plaque — ${placeLabel}:`)
      : z !== null ? z.head
        : L(language, `Regeln in Deutschland — ${d.title}:`, `Driving in Germany — ${d.title}:`);
  }
  const kept = lines.slice(0, MAX_BODY_LINES);
  const omitted = lines.length - kept.length;
  const keptKeys = new Set(kept.map((l) => l.key));
  const usedFacts = used.filter((u) => keptKeys.has(u.rule.id));
  const reviewedAt = oldest(usedFacts.length > 0 ? usedFacts.map((u) => u.rule.reviewedOn) : used.map((u) => u.rule.reviewedOn));
  const pointNote = hasPoint && topic !== "lez" ? L(language,
    "Hinweis: Ein Ort (place oder lat/lon) wird nur für Umweltzonen geprüft (topic=lez); diese Regeln gelten bundesweit.",
    "Note: a place (place or lat/lon) is checked for low-emission zones only (topic=lez); these rules apply across Germany.") : null;
  const more = moreLine(omitted, language, topic);
  // No boundary held for the point: the caveat leads the answer and rides as its condition, since a late, soft
  // sentence was read as "no plaque needed"; the zone block is then empty, a blank line before the rules.
  const verdict = zoneVerdict;
  const caveat = placeLabel !== null && verdict?.kind === "unknown" ? lezNoBoundaryCaveat(placeLabel, language) : null;
  const zoneLines = placeLabel === null ? [] : [""];
  const text = [head, ...(pointNote === null ? [] : [pointNote]), ...zoneLines, ...kept.map((l) => l.text), ...(more === null ? [] : [more])].join("\n");
  const structured: Record<string, unknown> = {
    topic: topic ?? null,
    city: city ?? null,
    language,
    reviewedAt,
    omittedLines: omitted,
    facts: usedFacts.map((u) => factJson(u.rule, u.topic)),
    lines: kept,
    ...(city !== undefined && zoneCity !== undefined
      ? { lezCity: { name: zoneCity.name, ...(zoneCity.zone === null ? {} : { zone: zoneCity.zone }), ...(zoneCity.plakette === null ? {} : { plakette: zoneCity.plakette }), covered: zoneCity.covered } }
      : {}),
    ...(pointNote === null ? {} : { pointNote }),
    toVerify: usedFacts.flatMap((u) => (u.rule.unconfirmed === null ? [] : [{ key: u.rule.id, note: u.rule.unconfirmed }])),
    disclaimer: disclaimer(reviewedAt, language),
  };
  return toolResult(text, metas, language, {
    structured,
    asOf: new Date(`${reviewedAt}T00:00:00Z`).toISOString(),
    asOfLabel: L(language, `Stand ${reviewDate(reviewedAt, "de")}`, `As of ${reviewDate(reviewedAt, "en")}`),
    note: disclaimer(reviewedAt, language),
    ...(caveat === null ? {} : { conditionNote: caveat }),
  });
};
