/**
 * check_weather_warnings' head line and empty answers in today's server's words
 * (tools/check_weather_warnings.ts): how many official notices hold for the place and the highest level,
 * or, when none, that this is no all-clear, and when the caller's level hid some, how many it hid.
 * The level filter is applied here, over every warning the API holds for now and the look-ahead, so the
 * hidden ones can be counted. The body of each warning (the DWD's own wording) waits for the API's fields.
 */
import type { LatLon } from "../api/client.js";
import type { WeatherWarning } from "../api/types.js";
import type { Language } from "../presentation.js";

/** Today's look-ahead: warnings in force now and those starting within these hours. */
export const LOOKAHEAD_HOURS = 24;
/** The lowest level asked by default (0 = the DWD's advance notices too). */
export const MIN_LEVEL = 0;

/** The place as today's server names it: its label, else the position to three decimals. */
export function aroundText(label: string | null, at: LatLon): string {
  return label ?? `${at.lat.toFixed(3)}, ${at.lon.toFixed(3)}`;
}

const warningsWord = (n: number, language: Language): string =>
  `${n} ${language === "de" ? (n === 1 ? "Warnung" : "Warnungen") : n === 1 ? "warning" : "warnings"}`;

/** The warnings at or above the level asked, highest level first, and how many the level hid. */
export function byLevel(all: readonly WeatherWarning[], minLevel: number): { shown: WeatherWarning[]; hidden: number } {
  const shown = all.filter((w) => w.level >= minLevel).sort((a, b) => b.level - a.level);
  return { shown, hidden: all.length - shown.length };
}

/** The sentence an answer with no warning at the level asked gives: never an all-clear. */
export function noWarning(language: Language, around: string, minLevel: number, hidden: number): string {
  const de = language === "de";
  if (hidden > 0) {
    return de
      ? `Für ${around} liegen keine amtlichen Warnungen ab Stufe ${minLevel} vor. Es ${hidden === 1 ? "gilt" : "gelten"} aber ${warningsWord(hidden, language)} unterhalb dieser Stufe — ab Stufe ${MIN_LEVEL} gefragt, ${hidden === 1 ? "wird sie" : "werden sie"} angezeigt.`
      : `No official warnings at level ${minLevel} or above are in force for ${around}. ${warningsWord(hidden, language)} below that level ${hidden === 1 ? "is" : "are"} in force — asked from level ${MIN_LEVEL}, ${hidden === 1 ? "it is" : "they are"} shown.`;
  }
  return de
    ? `Für ${around} liegt derzeit keine amtliche Wetterwarnung des DWD vor (geprüft für jetzt und die nächsten ${LOOKAHEAD_HOURS} Stunden). Das ist keine Entwarnung für die weitere Strecke: Warnungen gelten je Gebiet und können kurzfristig neu herausgegeben werden.`
    : `No official DWD weather warning is currently in force for ${around} (checked for now and the next ${LOOKAHEAD_HOURS} hours). That is not an all-clear for the rest of the route: warnings are issued per area and can be published at short notice.`;
}

/** "2 amtliche Meldungen für Dresden, höchste Stufe 3 von 4:"; a level 0 alone is an advance notice. */
export function warningsHead(language: Language, around: string, shown: readonly WeatherWarning[]): string {
  const n = shown.length;
  const worst = shown[0]?.level ?? MIN_LEVEL;
  return language === "de"
    ? `${n === 1 ? "Eine amtliche Meldung" : `${n} amtliche Meldungen`} für ${around}${worst === 0 ? ", nur eine Vorabinformation" : `, höchste Stufe ${worst} von 4`}:`
    : `${n === 1 ? "One official notice" : `${n} official notices`} for ${around}${worst === 0 ? ", an advance notice only" : `, highest level ${worst} of 4`}:`;
}
