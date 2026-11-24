/**
 * One official DWD warning as today's server lists it (main packages/mcp/src/presentation/dwd.ts `oneWarning`,
 * `levelLabel`, `windowLabel`, `areaLabel`; ingest analysis/dwd-text `dwdHazardLabel`, `dwdDrivingNote`; COPY):
 * the level in the DWD's own name, the hazard, the area with its warn cell, the window, and what it means for the
 * drive in our words; then, when the API gives the official text (its next release), the DWD's own words verbatim:
 * the German original, or in English the DWD's own English text, or where it gave none the German original under
 * an English label (today's translation of it from the template table is not ported, so not shown); and the CAP
 * fields. Whether the level was derived is not in the contract and is not said. An API without the text gets the
 * block before it: the headline quoted, our words, the summary credit.
 */
import type * as T from "../api/types.js";
import { standTime, type Language } from "../presentation.js";

/** The DWD's own level names, and our English gloss, marked as ours. */
const LEVEL_WORD: Record<number, { de: string; gloss: string }> = {
  0: { de: "Vorabinformation Unwetter", gloss: "advance notice of severe weather" },
  1: { de: "Wetterwarnung", gloss: "weather warning" },
  2: { de: "Markante Wetterwarnung", gloss: "marked weather warning" },
  3: { de: "Unwetterwarnung", gloss: "severe weather warning" },
  4: { de: "Warnung vor extremem Unwetter", gloss: "warning of extreme severe weather" },
};

export function levelLabel(language: Language, level: number): string {
  const word = LEVEL_WORD[level] ?? { de: "Warnung", gloss: "warning" };
  if (level === 0) return language === "de" ? `${word.de} (noch keine Warnstufe)` : `${word.de} — the DWD's own term for an advance notice; not yet a Warnstufe`;
  return language === "de" ? `Stufe ${level} von 4 — ${word.de}` : `Level ${level} of 4 — ${word.de} (the DWD's own name; our translation: ${word.gloss})`;
}

/** The DWD's event words (folded) and their English names (dwd-text events.ts and packs/en.ts). */
const EVENT_EN: Record<string, string> = {
  "BÖEN": "Gusts",
  "WIND": "Wind",
  "STURM": "Gale",
  "STARKWIND": "Strong wind",
  "SCHWERER STURM": "Severe gale",
  "FROST": "Frost",
  "GLÄTTE": "Slippery roads",
  "STRENGER FROST": "Severe frost",
  "GLATTEIS": "Black ice",
  "TAUWETTER": "Thaw",
  "STARKES TAUWETTER": "Strong thaw",
  "GEWITTER": "Thunderstorms",
  "STARKES GEWITTER": "Strong thunderstorms",
  "SCHWERES GEWITTER": "Severe thunderstorms",
  "EXTREMES GEWITTER": "Extreme thunderstorms",
  "SCHWERES GEWITTER MIT ORKANBÖEN": "Severe thunderstorms with hurricane-force gusts",
  "SCHWERES GEWITTER MIT EXTREMEN ORKANBÖEN": "Severe thunderstorms with extreme hurricane-force gusts",
  "SCHWERES GEWITTER MIT HEFTIGEM STARKREGEN": "Severe thunderstorms with very heavy rain",
  "SCHWERES GEWITTER MIT ORKANBÖEN UND HEFTIGEM STARKREGEN": "Severe thunderstorms with hurricane-force gusts and very heavy rain",
  "SCHWERES GEWITTER MIT EXTREMEN ORKANBÖEN UND HEFTIGEM STARKREGEN": "Severe thunderstorms with extreme hurricane-force gusts and very heavy rain",
  "SCHWERES GEWITTER MIT HEFTIGEM STARKREGEN UND HAGEL": "Severe thunderstorms with very heavy rain and hail",
  "SCHWERES GEWITTER MIT ORKANBÖEN, HEFTIGEM STARKREGEN UND HAGEL": "Severe thunderstorms with hurricane-force gusts, very heavy rain and hail",
  "SCHWERES GEWITTER MIT EXTREMEN ORKANBÖEN, HEFTIGEM STARKREGEN UND HAGEL": "Severe thunderstorms with extreme hurricane-force gusts, very heavy rain and hail",
  "SCHWERES GEWITTER MIT EXTREM HEFTIGEM STARKREGEN UND HAGEL": "Severe thunderstorms with extremely heavy rain and hail",
  "EXTREMES GEWITTER MIT ORKANBÖEN, EXTREM HEFTIGEM STARKREGEN UND HAGEL": "Extreme thunderstorms with hurricane-force gusts, extremely heavy rain and hail",
  "WINDBÖEN": "Wind gusts",
  "STURMBÖEN": "Storm gusts",
  "SCHWERE STURMBÖEN": "Severe storm gusts",
  "ORKANARTIGE BÖEN": "Violent storm gusts",
  "ORKANBÖEN": "Hurricane-force gusts",
  "EXTREME ORKANBÖEN": "Extreme hurricane-force gusts",
  "NEBEL": "Fog",
  "STARKREGEN": "Heavy rain",
  "HEFTIGER STARKREGEN": "Very heavy rain",
  "DAUERREGEN": "Persistent rain",
  "ERGIEBIGER DAUERREGEN": "Heavy persistent rain",
  "EXTREM ERGIEBIGER DAUERREGEN": "Extremely heavy persistent rain",
  "EXTREM HEFTIGER STARKREGEN": "Extremely heavy rain",
  "LEICHTER SCHNEEFALL": "Light snowfall",
  "SCHNEEFALL": "Snowfall",
  "STARKER SCHNEEFALL": "Heavy snowfall",
  "EXTREM STARKER SCHNEEFALL": "Extremely heavy snowfall",
  "SCHNEEVERWEHUNG": "Snow drifts",
  "STARKE SCHNEEVERWEHUNG": "Heavy snow drifts",
  "EXTREM STARKE SCHNEEVERWEHUNG": "Extreme snow drifts",
  "LEITERSEILSCHWINGUNGEN": "Power-line oscillation",
  "TEST-WARNUNG": "Test warning",
  "TEST-UNWETTERWARNUNG": "Test severe weather warning",
  "UV-INDEX": "UV index",
  "STARKE HITZE": "Strong heat",
  "EXTREME HITZE": "Extreme heat",
  "VORABINFORMATION SCHWERES GEWITTER": "Advance information: severe thunderstorms",
  "VORABINFORMATION ORKANBÖEN": "Advance information: hurricane-force gusts",
  "VORABINFORMATION HEFTIGER / ERGIEBIGER REGEN": "Advance information: very heavy or persistent rain",
  "VORABINFORMATION STARKER SCHNEEFALL / SCHNEEVERWEHUNG": "Advance information: heavy snowfall or snow drifts",
  "VORABINFORMATION GLATTEIS": "Advance information: black ice",
  "VORABINFORMATION STARKES TAUWETTER": "Advance information: strong thaw",
  "TEST-VORABINFORMATION UNWETTER": "Test advance information of severe weather",
};

const foldEventWord = (word: string): string => word.toLocaleUpperCase("de-DE").replace(/\s*\/\s*/gu, " / ").replace(/\s+/gu, " ").trim();

/** "Frost (FROST)" in English, the DWD's word alone in German and for a word the table does not hold. */
export function hazardLabel(language: Language, event: string | null | undefined): string | null {
  if (event === null || event === undefined || event.trim() === "") return null;
  const word = event.trim();
  if (language === "de") return word;
  const name = EVENT_EN[foldEventWord(word)];
  return name === undefined ? word : `${name} (${word})`;
}

const DRIVE = {
  de: {
    gusts: "Böen können Fahrzeuge versetzen; auf Brücken, in Waldstücken und beim Überholen von Lkw besonders vorsichtig fahren.",
    ice: "Mit Glätte und deutlich längeren Bremswegen rechnen; Winterausrüstung ist bei diesen Verhältnissen Pflicht (§ 2 Abs. 3a StVO).",
    rain: "Aquaplaning und überflutete Fahrbahnen sind möglich; Tempo deutlich zurücknehmen.",
    thunder: "Blitzschlag, Hagelschlag und plötzliche Sichtverluste sind möglich; eine sichere Unterstellmöglichkeit einplanen.",
    fog: "Bei Sicht unter 50 m durch Nebel, Schneefall oder Regen gilt höchstens 50 km/h (§ 3 Abs. 1 StVO); die Nebelschlussleuchte nur bei Nebel mit Sicht unter 50 m (§ 17 Abs. 3 StVO).",
    heat: "Lange Fahrten in der Mittagshitze meiden, ausreichend Wasser mitnehmen.",
    level4: "Bei dieser Stufe rät der DWD dringend von nicht notwendigen Fahrten ab.",
    level3: "Fahrten möglichst verschieben oder zusätzliche Zeit einplanen.",
    level0: "Vorabinformation des DWD: Unwetter ist wahrscheinlich, die eigentliche Warnung folgt. Vor der Abfahrt erneut prüfen.",
    generic: "Auf die amtlichen Hinweise achten und die Fahrweise den Verhältnissen anpassen.",
  },
  en: {
    gusts: "Gusts can push vehicles sideways; take particular care on bridges, in woodland and when overtaking lorries.",
    ice: "Expect ice and much longer braking distances; winter tyres are mandatory in these conditions (§ 2 (3a) StVO).",
    rain: "Aquaplaning and flooded carriageways are possible; reduce speed substantially.",
    thunder: "Lightning, hail and sudden loss of visibility are possible; plan a safe place to stop.",
    fog: "With visibility below 50 m in fog, snow or rain the limit is 50 km/h (§ 3 (1) StVO); the rear fog light only in fog with visibility below 50 m (§ 17 (3) StVO).",
    heat: "Avoid long drives in the midday heat and carry enough water.",
    level4: "At this level the DWD strongly advises against journeys that are not necessary.",
    level3: "Postpone the drive where possible, or allow extra time.",
    level0: "A DWD advance notice: severe weather is likely and the warning itself is still to come. Check again before setting off.",
    generic: "Follow the official advice and adapt your driving to the conditions.",
  },
} as const;
type DriveKey = keyof (typeof DRIVE)["en"];

/**
 * Which driving sentences an event word and level call for, in today's order (dwd-text drivingKeys). A plain FROST
 * warning earns the winter-tyre line only with a slippery road-surface forecast near the point.
 */
export function drivingKeys(level: number, event: string | null | undefined, forecastSlippery = false): DriveKey[] {
  const e = (event ?? "").toUpperCase();
  const keys: DriveKey[] = [];
  if (/STURM|ORKAN|BÖEN|BOEEN/u.test(e)) keys.push("gusts");
  // A FROST warning (air temperature) earns the winter-tyre line only when a road-weather station near the point
  // forecasts a slippery class (today's gate).
  if (/SCHNEE|GLÄTTE|GLAETTE|EIS|GLATTEIS/u.test(e) || (forecastSlippery && /FROST/u.test(e))) keys.push("ice");
  if (/REGEN|NIEDERSCHLAG|HOCHWASSER/u.test(e)) keys.push("rain");
  if (/GEWITTER|HAGEL/u.test(e)) keys.push("thunder");
  if (/NEBEL|SICHT/u.test(e)) keys.push("fog");
  if (/HITZE|UV/u.test(e)) keys.push("heat");
  if (level >= 4) keys.push("level4");
  else if (level === 3) keys.push("level3");
  else if (level === 0) keys.push("level0");
  if (keys.length === 0) keys.push("generic");
  return keys;
}

export const drivingNote = (language: Language, level: number, event: string | null | undefined, forecastSlippery = false): string =>
  drivingKeys(level, event, forecastSlippery).map((k) => DRIVE[language][k]).join(" ");

/** "until 2026-11-25 12:00 (since 16:00)"; a warning not yet in force "from … until …". */
export function windowText(language: Language, w: Pick<T.WeatherWarning, "validity" | "inForce">, now: Date): string {
  const from = w.validity.from;
  const start = from === null ? null : standTime(from, language, now);
  const end = w.validity.until === null ? null : standTime(w.validity.until, language, now);
  const future = w.inForce === false || (from !== null && new Date(from).getTime() > now.getTime());
  const de = language === "de";
  if (start === null) return end === null ? (de ? "Ende offen" : "no end given") : de ? `bis ${end}` : `until ${end}`;
  if (end === null) return de ? (future ? `ab ${start}, Ende offen` : `seit ${start}, Ende offen`) : future ? `from ${start}, no end given` : `since ${start}, no end given`;
  return de ? (future ? `von ${start} bis ${end}` : `bis ${end} (seit ${start})`) : future ? `from ${start} until ${end}` : `until ${end} (since ${start})`;
}

function areaText(language: Language, a: T.WeatherWarning["area"]): string {
  const name = a?.name ?? (language === "de" ? "Warnzelle" : "warn cell");
  const cell = a?.cellId ?? null;
  return cell === null ? name : language === "de" ? `${name} (Warnzelle ${cell})` : `${name} (warn cell ${cell})`;
}

/** How a list is rendered: the DWD's own words (verbatim), our words only (summary), or the block before the API gave the text (legacy). */
export type WarningMode = "verbatim" | "summary" | "legacy";

/** Today's VERBATIM_BUDGET_CHARS: the official text of the whole list must fit, or the list is a summary. */
export const VERBATIM_BUDGET_CHARS = 6_500;

const quoted = (x: string | null | undefined): string[] => (x === null || x === undefined || x === "" ? [] : [`   „${x}“`]);

/** The DWD's own English text is used when it says anything. */
export const hasEnglish = (w: T.WeatherWarning): boolean =>
  w.english !== null && w.english !== undefined && [w.english.headline, w.english.description, w.english.instruction].some((x) => x !== null && x !== "");

/** The DWD's CAP fields, as published, under our label (today's capLine). */
function capLine(language: Language, w: T.WeatherWarning): string | null {
  const parts: string[] = [];
  if (w.urgency) parts.push(`urgency=${w.urgency}`);
  if (w.certainty) parts.push(`certainty=${w.certainty}`);
  return parts.length === 0 ? null : `   ${language === "de" ? "CAP-Angaben des DWD" : "The DWD's own CAP fields"}: ${parts.join(", ")}`;
}

/** The official words: the German original, the DWD's English, or the German original under an English label. */
function officialLines(language: Language, w: T.WeatherWarning): string[] {
  if (language === "en" && hasEnglish(w)) {
    return ["   Official DWD wording in English (the DWD's own text), reproduced unaltered:", ...quoted(w.english?.headline), ...quoted(w.english?.description), ...quoted(w.english?.instruction)];
  }
  const label = language === "de" ? "Amtlicher Wortlaut des DWD, unverändert:" : "Official text of the DWD (German original, binding), reproduced unaltered:";
  return [`   ${label}`, ...quoted(w.headline), ...quoted(w.description), ...quoted(w.instruction)];
}

/** Whether the API gave the official text (its next release): the description key is there, null or not. */
export const carriesText = (ws: readonly T.WeatherWarning[]): boolean => ws.length > 0 && ws.every((w) => w.description !== undefined);

/** One warning, numbered, as today's block: head, area, window, the CAP fields, the official words (verbatim), the drive. */
export function warningBlock(language: Language, w: T.WeatherWarning, index: number, now: Date, mode: WarningMode = "legacy", forecastSlippery = false): string {
  const de = language === "de";
  const hazard = hazardLabel(language, w.event);
  const lines = [
    `${index}. ${levelLabel(language, w.level)}${hazard === null ? "" : ` — ${hazard}`}`,
    `   ${de ? "Gebiet" : "Area"}: ${areaText(language, w.area)}`,
    `   ${de ? "Gültig" : "Valid"}: ${windowText(language, w, now)}`,
  ];
  if (mode === "legacy") {
    if (w.headline.trim() !== "") lines.push(`   „${w.headline}“`);
  } else {
    const cap = capLine(language, w);
    if (cap !== null) lines.push(cap);
    if (mode === "verbatim") lines.push(...officialLines(language, w));
  }
  lines.push(`   ${de ? "Für die Fahrt" : "For the drive"}: ${drivingNote(language, w.level, w.event, forecastSlippery)}`);
  return lines.join("\n");
}

/** Today's sentence a summary carries in place of the quotation. */
export function summaryNotice(language: Language, reason: string): string {
  const where = "https://www.dwd.de/warnungen";
  return language === "de"
    ? `Der amtliche Wortlaut wird hier nicht wiedergegeben (${reason}). Eine veränderte amtliche Warnung darf den Quellenvermerk des DWD nicht tragen — die Warnungen im Wortlaut stehen unter ${where}.`
    : `The official wording is not reproduced here (${reason}). An altered official warning may not carry the DWD source note — the warnings in full are at ${where}.`;
}

/** The list in one mode for the whole answer (one credit line): verbatim when the API gave the text and it fits. */
export function warningsList(language: Language, shown: readonly T.WeatherWarning[], now: Date, o: { budgetChars?: number; forecastSlippery?: boolean } = {}): { mode: WarningMode; text: string; notice: string | null } {
  const render = (mode: WarningMode): string => shown.map((w, i) => warningBlock(language, w, i + 1, now, mode, o.forecastSlippery ?? false)).join("\n\n");
  if (!carriesText(shown)) return { mode: "legacy", text: render("legacy"), notice: null };
  const text = render("verbatim");
  if (text.length <= (o.budgetChars ?? VERBATIM_BUDGET_CHARS)) return { mode: "verbatim", text, notice: null };
  return { mode: "summary", text: render("summary"), notice: summaryNotice(language, "the official wording does not fit in one answer") };
}
