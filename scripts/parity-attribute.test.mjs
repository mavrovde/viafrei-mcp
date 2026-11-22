#!/usr/bin/env node
// Self-test of parity-attribute.mjs: planted rows, one per rule. No network, no database.
import { attribute } from "./parity-attribute.mjs";

let failed = 0, passed = 0;
const check = (name, got, want) => {
  if (got === want) { passed++; console.log(`  PASS  ${name}`); } else { failed++; console.log(`  FAIL  ${name} — got "${got}", want "${want}"`); }
};
const ans = (text, s = null, meta = {}, isError = false) => ({ isError, text, structuredContent: s, meta });
const row = (tool, old, neu) => ({ tool, verdict: "differing", views: { old, new: neu } });

check("an identical row stays identical", attribute({ tool: "x", verdict: "identical", views: {} }), "identical");
check("only the credit line differs",
  attribute(row("get_driving_rules", ans("A\nQuelle: X (https://alpha.example)", null, { attribution: "X (https://alpha.example)" }), ans("A\nQuelle: X", null, { attribution: "X" }))), "credit");
check("credit and structuredContent together",
  attribute(row("stop_watch", ans("A\nQuelle: X (u)", { a: 1 }), ans("A\nQuelle: X"))), "structuredContent + credit");
check("db#72 needs the no-open-source line on the old side only",
  attribute(row("check_road_status", ans("Keine offene Quelle für diesen Abschnitt: …\nStand 1"), ans("Kiel: Es liegt keine Meldung vor — …\nStand 1"))), "db#72");
check("db#72 with the empty-road credit is db#72 + db#84",
  attribute(row("check_road_status", ans("Keine offene Quelle für diesen Abschnitt: …\nQuelle: GeoNames"), ans("Kiel: Es liegt keine Meldung vor\nQuelle: Autobahn GmbH"))), "db#72 + db#84");
check("db#84 does not cover a road answer that is not empty",
  attribute(row("check_road_status", ans("A3: 2 Sperrungen\nQuelle: A"), ans("A3: 2 Sperrungen\nQuelle: B"))), "credit");
check("db#83 removes the warning body only",
  attribute(row("check_weather_warnings", ans("Kiel:\n1. Stufe 3 von 4 — Sturm\n   Gebiet: Kiel\nEnde"), ans("Kiel:\n- Amtliche WARNUNG vor STURM\nEnde"))), "db#83");
check("db#83 does not hide a different headline",
  attribute(row("check_weather_warnings", ans("Kiel:\n1. Stufe 3 von 4 — Sturm\nEnde"), ans("Kiel heute:\n- Amtliche WARNUNG\nEnde"))), "unexplained");
check("db#85 removes the fold of reasons and the count line",
  attribute(row("check_autobahn_traffic", ans("A3 — Ampel Gelb: Baustelle (und 4 weitere Gründe).\nA3, gesamte Strecke: 0 Staus"), ans("A3 — Ampel Gelb: Baustelle."))), "db#85");
check("db#85 does not cover a different item list",
  attribute(row("check_autobahn_traffic", ans("A3 — Ampel Gelb: Baustelle (und 4 weitere Gründe).\n• Baustelle: A3 | X"), ans("A3 — Ampel Gelb: Baustelle.\n- A3: X"))), "unexplained");
check("a structuredContent key the API contract lacks is parity pending the API",
  attribute(row("find_charging_station", ans("A", { place: "X", registerCaveat: "c" }), ans("A", { place: "X" }))), "structuredContent outside the API");
check("a key the contract carries is not pending",
  attribute(row("find_charging_station", ans("A", { place: "X" }), ans("A", { place: "Y" }))), "structuredContent");
check("an error today, an answer here", attribute(row("find_parking", ans("Bitte place angeben.", null, {}, true), ans("Keine Parkplätze gefunden."))), "isError: an error today, an answer here");
check("an answer today, an error here", attribute(row("find_parking", ans("Parken an der A9:"), ans("Nicht verfügbar.", null, {}, true))), "isError: an answer today, an error here");
check("a wording difference is unexplained", attribute(row("find_address", ans("Keine OSM-Adressdaten geladen."), ans("Keine Adressen gefunden."))), "unexplained");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
