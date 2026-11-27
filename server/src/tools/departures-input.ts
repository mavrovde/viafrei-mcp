/**
 * get_departures' one way in, as today's server refuses it (departuresInputError):
 * lat and lon together; exactly one of stop, stop_id, place or lat+lon; and around a place only the
 * nearest stops now, so a when, a duration, modes or a limit other than the default is refused with what to do.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { toolError, type Language } from "../presentation.js";
import type { ToolErrorReason } from "../usage-names.js";

/** The catalogue's defaults: a default the client fills in is not the caller's own. */
const DEFAULT_DURATION_MIN = 60;
const DEFAULT_LIMIT = 10;

const refused = (text: string, reason?: ToolErrorReason): CallToolResult => toolError(text, "invalid_input", reason);

export function departuresRefusal(args: Record<string, unknown>, language: Language): CallToolResult | null {
  const en = language === "en";
  const has = (k: string): boolean => args[k] !== undefined && args[k] !== null;
  const hasName = has("stop"), hasId = has("stop_id"), hasPlace = has("place"), hasLat = has("lat");
  if (hasLat !== has("lon")) return refused(en ? "lat and lon go together: give both, or give place instead." : "lat und lon gehören zusammen: bitte beide angeben oder stattdessen place.", "half_coordinate");
  const near = hasPlace || hasLat;
  if (near && (hasName || hasId || (hasPlace && hasLat))) {
    return refused(en ? "Give exactly one of stop, stop_id, place or lat+lon, not several — they can disagree."
      : "Bitte genau eines von stop, stop_id, place oder lat+lon angeben, nicht mehrere — sie können sich widersprechen.", hasPlace && hasLat && !hasName && !hasId ? "place_and_coords" : "two_ways_in");
  }
  if (near) {
    const given = { when: has("when"), duration_min: has("duration_min") && args["duration_min"] !== DEFAULT_DURATION_MIN, modes: has("modes"), limit: has("limit") && args["limit"] !== DEFAULT_LIMIT };
    const fixed = (Object.keys(given) as (keyof typeof given)[]).filter((k) => given[k]).join(", ");
    if (fixed === "") return null;
    return refused(en
      ? `${fixed} apply to one named stop. Around a place the answer is the nearest stops now with their next departures, as viafrei.de's place page shows them — leave ${fixed} out, or ask about one stop with stop or stop_id.`
      : `${fixed} gelten für eine benannte Haltestelle. Um einen Ort herum sind es die nächsten Haltestellen jetzt mit ihren nächsten Abfahrten, wie die Ortsseite von viafrei.de sie zeigt — ${fixed} bitte weglassen, oder mit stop oder stop_id nach einer Haltestelle fragen.`);
  }
  if (hasName && hasId) return refused(en ? "Give either stop or stop_id, not both — they can disagree." : "Bitte entweder stop oder stop_id angeben, nicht beides — die beiden können sich widersprechen.", "two_ways_in");
  return null;
}
