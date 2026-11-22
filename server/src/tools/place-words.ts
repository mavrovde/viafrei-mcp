/**
 * What today's server says when a tool is given no place, or a place it cannot find: per tool and
 * language, verbatim (captured from its answers in the MCP parity run, #120 A1, 3.3), with the error
 * code its `_meta` carries. A tool listed with ignorePlace takes no `place` (its own argument is
 * another), so a place given to it is answered as no place at all.
 */
import type { Language } from "../presentation.js";

export type PlaceWords = {
  readonly missing: Readonly<Record<Language, string>>;
  readonly unknown?: Readonly<Record<Language, (q: string) => string>>;
  readonly ignorePlace?: true;
  /** Today's server answers this tool's unknown place with no error code in `_meta`. */
  readonly uncoded?: true;
};

export const PLACE_WORDS: Readonly<Record<string, PlaceWords>> = {
  get_driving_rules: {
    // A place is optional here: only a place given and not found is answered.
    missing: { de: "Bitte einen Ort (place) oder Koordinaten (lat und lon) angeben.", en: "Please give a place (place) or coordinates (lat and lon)." },
    unknown: {
      de: (q) => `„${q}“ habe ich als Ort nicht gefunden.`,
      en: (q) => `I could not find "${q}" as a place.`,
    },
    uncoded: true,
  },
  check_autobahn_traffic: {
    missing: {
      de: "Bitte roads (Autobahnnummern, z. B. [\"A9\"]) oder land (ein Bundesland, z. B. \"bayern\") angeben. Hat die Person nichts davon genannt, bitte fragen, welche Autobahn oder welches Bundesland; für den Verkehr in einer Stadt check_road_status. Zum Beispiel {\"roads\": [\"A9\"]} oder {\"land\": \"bayern\"}.",
      en: "Give roads (motorway numbers, e.g. [\"A9\"]) or land (one Bundesland, e.g. \"bayern\"). If the person named neither, ask which motorway or which Land; for a town's own traffic use check_road_status. For example {\"roads\": [\"A9\"]} or {\"land\": \"bayern\"}.",
    },
    ignorePlace: true,
  },
  check_road_status: {
    missing: {
      de: "Bitte road (\"A8\"), place (\"Kassel\") oder lat+lon angeben. Hat die Person nichts davon genannt, bitte fragen, welche Straße oder wo: eine Stadt, eine Postleitzahl oder ihren Standort. Zum Beispiel {\"place\": \"Kassel\"} oder {\"road\": \"A8\"}.",
      en: "Give a road (\"A8\"), a place (\"Kassel\"), or lat+lon. If the person named none, ask which road, or where: a town, a postcode or their position. For example {\"place\": \"Kassel\"} or {\"road\": \"A8\"}.",
    },
    unknown: {
      de: (q) => `"${q}" kenne ich nicht. Bitte eine Stadt, einen Kreis — oder die Straße selbst (z. B. "A8") nennen.`,
      en: (q) => `I do not know "${q}". Name a town, a district — or the road itself (e.g. "A8").`,
    },
  },
  check_transit_disruption: {
    missing: {
      de: "Kein Ort angegeben. Bitte die Person fragen, wo: eine Stadt, eine Postleitzahl oder ihren Standort. Dann die Stadt (oder Postleitzahl und Stadt, \"36037 Fulda\") als region übergeben oder den Standort als lat+lon — zum Beispiel {\"region\": \"Fulda\"} oder {\"lat\": 50.55, \"lon\": 9.68}.",
      en: "No place given. Ask the person where: a town, a postcode or their position. Then pass the town (or postcode and town, \"36037 Fulda\") as region, or their position as lat+lon — for example {\"region\": \"Fulda\"} or {\"lat\": 50.55, \"lon\": 9.68}.",
    },
    ignorePlace: true,
  },
  check_weather_warnings: {
    missing: {
      de: "Kein Ort angegeben. Bitte die Person fragen, wo: eine Stadt, eine Postleitzahl oder ihren Standort. Dann die Stadt (oder Postleitzahl und Stadt, \"36037 Fulda\") als place übergeben oder den Standort als lat+lon — zum Beispiel {\"place\": \"Fulda\"} oder {\"lat\": 50.55, \"lon\": 9.68}.",
      en: "No place given. Ask the person where: a town, a postcode or their position. Then pass the town (or postcode and town, \"36037 Fulda\") as place, or their position as lat+lon — for example {\"place\": \"Fulda\"} or {\"lat\": 50.55, \"lon\": 9.68}.",
    },
    unknown: {
      de: (q) => `"${q}" kenne ich nicht. Bitte eine Stadt, einen Kreis oder eine Haltestelle nennen — oder lat/lon angeben.`,
      en: (q) => `I do not know "${q}". Name a town, a district or a stop — or pass lat/lon.`,
    },
  },
  find_charging_station: {
    missing: {
      de: "Kein Ort angegeben. Bitte die Person fragen, wo: eine Stadt, eine Postleitzahl oder ihren Standort. Dann die Stadt (oder Postleitzahl und Stadt, \"36037 Fulda\") als place übergeben oder den Standort als lat+lon — zum Beispiel {\"place\": \"Fulda\"} oder {\"lat\": 50.55, \"lon\": 9.68}.",
      en: "No place given. Ask the person where: a town, a postcode or their position. Then pass the town (or postcode and town, \"36037 Fulda\") as place, or their position as lat+lon — for example {\"place\": \"Fulda\"} or {\"lat\": 50.55, \"lon\": 9.68}.",
    },
    unknown: {
      de: (q) => `"${q}" kenne ich nicht. Bitte eine Stadt, einen Kreis oder eine Haltestelle nennen — oder lat/lon angeben.`,
      en: (q) => `I do not know "${q}". Name a town, a district or a stop — or pass lat/lon.`,
    },
  },
  find_cheapest_fuel: {
    missing: {
      de: "Kein Ort angegeben. Bitte die Person fragen, wo: eine Stadt, eine Postleitzahl oder ihren Standort. Dann die Stadt (oder Postleitzahl und Stadt, \"36037 Fulda\") als place übergeben oder den Standort als lat+lon — zum Beispiel {\"place\": \"Fulda\"} oder {\"lat\": 50.55, \"lon\": 9.68}.",
      en: "No place given. Ask the person where: a town, a postcode or their position. Then pass the town (or postcode and town, \"36037 Fulda\") as place, or their position as lat+lon — for example {\"place\": \"Fulda\"} or {\"lat\": 50.55, \"lon\": 9.68}.",
    },
    unknown: {
      de: (q) => `"${q}" kenne ich nicht. Bitte eine Stadt, einen Kreis oder eine Haltestelle nennen — oder lat/lon angeben.`,
      en: (q) => `I do not know "${q}". Name a town, a district or a stop — or pass lat/lon.`,
    },
  },
  find_fuel_station: {
    missing: {
      de: "Kein Ort angegeben. Bitte die Person fragen, wo: eine Stadt, eine Postleitzahl oder ihren Standort. Dann die Stadt (oder Postleitzahl und Stadt, \"36037 Fulda\") als place übergeben oder den Standort als lat+lon — zum Beispiel {\"place\": \"Fulda\"} oder {\"lat\": 50.55, \"lon\": 9.68}.",
      en: "No place given. Ask the person where: a town, a postcode or their position. Then pass the town (or postcode and town, \"36037 Fulda\") as place, or their position as lat+lon — for example {\"place\": \"Fulda\"} or {\"lat\": 50.55, \"lon\": 9.68}.",
    },
    unknown: {
      de: (q) => `"${q}" kenne ich nicht. Bitte eine Stadt, einen Kreis oder eine Haltestelle nennen — oder lat/lon angeben.`,
      en: (q) => `I do not know "${q}". Name a town, a district or a stop — or pass lat/lon.`,
    },
  },
  find_hydrogen_station: {
    missing: {
      de: "Kein Ort angegeben. Bitte die Person fragen, wo: eine Stadt, eine Postleitzahl oder ihren Standort. Dann die Stadt (oder Postleitzahl und Stadt, \"36037 Fulda\") als place übergeben oder den Standort als lat+lon — zum Beispiel {\"place\": \"Fulda\"} oder {\"lat\": 50.55, \"lon\": 9.68}.",
      en: "No place given. Ask the person where: a town, a postcode or their position. Then pass the town (or postcode and town, \"36037 Fulda\") as place, or their position as lat+lon — for example {\"place\": \"Fulda\"} or {\"lat\": 50.55, \"lon\": 9.68}.",
    },
    unknown: {
      de: (q) => `"${q}" kenne ich nicht. Bitte eine Stadt, eine Haltestelle oder eine Adresse nennen — oder lat/lon angeben.`,
      en: (q) => `I do not know "${q}". Name a town, a stop or an address — or pass lat/lon.`,
    },
  },
  find_nearby: {
    missing: {
      de: "Kein Ort angegeben. Bitte die Person fragen, wo: eine Stadt, eine Postleitzahl oder ihren Standort. Dann die Stadt (oder Postleitzahl und Stadt, \"36037 Fulda\") als place übergeben oder den Standort als lat+lon — zum Beispiel {\"place\": \"Fulda\"} oder {\"lat\": 50.55, \"lon\": 9.68}.",
      en: "No place given. Ask the person where: a town, a postcode or their position. Then pass the town (or postcode and town, \"36037 Fulda\") as place, or their position as lat+lon — for example {\"place\": \"Fulda\"} or {\"lat\": 50.55, \"lon\": 9.68}.",
    },
    unknown: {
      de: (q) => `"${q}" kenne ich nicht. Bitte eine Stadt, einen Kreis oder eine Haltestelle nennen — oder lat/lon angeben.`,
      en: (q) => `I do not know "${q}". Name a town, a district or a stop — or pass lat/lon.`,
    },
  },
  find_parking: {
    missing: {
      de: "Bitte place (Freitext), lat+lon oder road (z. B. \"A3\") angeben. Hat die Person nichts davon genannt, bitte fragen, wo: eine Stadt, eine Postleitzahl, ihren Standort oder die Autobahn. Zum Beispiel {\"place\": \"Fulda\"} oder {\"road\": \"A3\"}.",
      en: "Give a place (free text), or lat+lon, or a road like \"A3\". If the person named none, ask where: a town, a postcode, their position or the motorway. For example {\"place\": \"Fulda\"} or {\"road\": \"A3\"}.",
    },
    unknown: {
      de: (q) => `"${q}" kenne ich nicht. Bitte eine Stadt, einen Kreis oder eine Haltestelle nennen — oder lat/lon angeben.`,
      en: (q) => `I do not know "${q}". Name a town, a district or a stop — or pass lat/lon.`,
    },
  },
  find_roadworks_ahead: {
    missing: {
      de: "Bitte road (\"A7\") oder einen Ort (place, \"Hamburg-Altona\") angeben. Hat die Person keins von beiden genannt, bitte fragen, welche Straße oder wo: eine Stadt, eine Postleitzahl oder ihren Standort. Zum Beispiel {\"road\": \"A7\"} oder {\"place\": \"Hamburg-Altona\"}.",
      en: "Give a road (\"A7\") or a place (\"Hamburg-Altona\"). If the person named neither, ask which road, or where: a town, a postcode or their position. For example {\"road\": \"A7\"} or {\"place\": \"Hamburg-Altona\"}.",
    },
    unknown: {
      de: (q) => `„${q}“ habe ich als Ort nicht gefunden.`,
      en: (q) => `I could not find "${q}" as a place.`,
    },
  },
  find_sharing: {
    missing: {
      de: "Kein Ort angegeben. Bitte die Person fragen, wo: eine Stadt, eine Postleitzahl oder ihren Standort. Dann die Stadt (oder Postleitzahl und Stadt, \"36037 Fulda\") als place übergeben oder den Standort als lat+lon — zum Beispiel {\"place\": \"Fulda\"} oder {\"lat\": 50.55, \"lon\": 9.68}.",
      en: "No place given. Ask the person where: a town, a postcode or their position. Then pass the town (or postcode and town, \"36037 Fulda\") as place, or their position as lat+lon — for example {\"place\": \"Fulda\"} or {\"lat\": 50.55, \"lon\": 9.68}.",
    },
    unknown: {
      de: (q) => `"${q}" kenne ich nicht. Bitte eine Stadt, eine Haltestelle oder eine Adresse nennen — oder lat/lon angeben.`,
      en: (q) => `I do not know "${q}". Name a town, a stop or an address — or pass lat/lon.`,
    },
  },
  find_speed_cameras: {
    missing: {
      de: "Kein Ort angegeben. Bitte die Person fragen, wo: eine Stadt, eine Postleitzahl oder ihren Standort. Dann die Stadt (oder Postleitzahl und Stadt, \"36037 Fulda\") als place übergeben oder den Standort als lat+lon — zum Beispiel {\"place\": \"Fulda\"} oder {\"lat\": 50.55, \"lon\": 9.68}.",
      en: "No place given. Ask the person where: a town, a postcode or their position. Then pass the town (or postcode and town, \"36037 Fulda\") as place, or their position as lat+lon — for example {\"place\": \"Fulda\"} or {\"lat\": 50.55, \"lon\": 9.68}.",
    },
    unknown: {
      de: (q) => `Hinweis zur Nutzung (§ 23 Abs. 1c StVO): Wer ein Fahrzeug führt, darf während der Fahrt kein technisches Gerät und keine App-Funktion betreiben oder nutzen, die Verkehrsüberwachungsmaßnahmen anzeigt oder stört. Das gilt auch für das Smartphone eines Beifahrers, wenn der Fahrer davon profitiert (OLG Karlsruhe). Verstöße kosten 75 € und einen Punkt in Flensburg. Diese Angaben sind nur zur Planung vor Fahrtantritt oder während eines Halts bestimmt. Die Standorte stammen aus amtlichen und offenen Quellen und können unvollständig oder veraltet sein; mobile Kontrollen sind jederzeit und überall möglich. Halten Sie sich immer an die geltende Höchstgeschwindigkeit. Keine Rechtsberatung.

"${q}" kenne ich nicht. Bitte eine Stadt oder eine Adresse nennen — oder lat/lon angeben.`,
      en: (q) => `Note on use (§ 23 Abs. 1c StVO): a person driving a vehicle may not, while driving, operate or use any technical device or app function that shows or disrupts traffic enforcement. This also applies to a passenger's smartphone if the driver benefits from it (OLG Karlsruhe). A violation costs €75 and one point in Flensburg. This information is meant only for planning before setting off or during a stop. The locations come from official and open sources and may be incomplete or out of date; mobile checks are possible at any time and anywhere. Always keep to the speed limit in force. Not legal advice.
The notice in its original wording (German):
Hinweis zur Nutzung (§ 23 Abs. 1c StVO): Wer ein Fahrzeug führt, darf während der Fahrt kein technisches Gerät und keine App-Funktion betreiben oder nutzen, die Verkehrsüberwachungsmaßnahmen anzeigt oder stört. Das gilt auch für das Smartphone eines Beifahrers, wenn der Fahrer davon profitiert (OLG Karlsruhe). Verstöße kosten 75 € und einen Punkt in Flensburg. Diese Angaben sind nur zur Planung vor Fahrtantritt oder während eines Halts bestimmt. Die Standorte stammen aus amtlichen und offenen Quellen und können unvollständig oder veraltet sein; mobile Kontrollen sind jederzeit und überall möglich. Halten Sie sich immer an die geltende Höchstgeschwindigkeit. Keine Rechtsberatung.


I do not know "${q}". Name a town or an address — or pass lat/lon.`,
    },
  },
  get_departures: {
    missing: {
      de: "Bitte stop (Haltestellenname als Freitext) oder stop_id aus einem früheren Ergebnis angeben — oder place (oder lat+lon) für die nächsten Haltestellen dort. Hat die Person nichts davon genannt, bitte fragen, welche Haltestelle oder wo: eine Stadt oder ihren Standort. Zum Beispiel {\"stop\": \"Köln Hbf\"} oder {\"place\": \"Fulda\"}.",
      en: "Give a stop name (free text) or a stop_id from an earlier result — or a place (or lat+lon) for the nearest stops around it. If the person named none, ask which stop, or where: a town or their position. For example {\"stop\": \"Köln Hbf\"} or {\"place\": \"Fulda\"}.",
    },
    unknown: {
      de: (q) => `"${q}" kenne ich nicht. Bitte eine Stadt, einen Stadtteil oder eine Adresse nennen — oder lat/lon angeben, oder mit stop nach einer Haltestelle fragen.`,
      en: (q) => `I do not know "${q}". Name a town, a district or an address — or pass lat/lon, or ask about one stop with stop.`,
    },
  },
};
