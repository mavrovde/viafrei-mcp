<div align="center">

# ViaFrei

[![Smithery](https://img.shields.io/badge/Smithery-viafrei-ff5a1f)](https://smithery.ai/servers/viafrei/viafrei)
[![npm](https://img.shields.io/npm/v/viafrei)](https://www.npmjs.com/package/viafrei)
[![Glama](https://glama.ai/mcp/servers/mavrovde/viafrei-mcp/badge)](https://glama.ai/mcp/servers/mavrovde/viafrei-mcp)
[![ViaFrei MCP connector](https://glama.ai/mcp/connectors/de.viafrei.mcp/via-frei/badges/score.svg)](https://glama.ai/mcp/connectors/de.viafrei.mcp/via-frei)

### Germany's traffic, trains, charging and roads — in your AI assistant.

**Ask in plain words. Get the live answer, with its source.**

[![website](https://img.shields.io/badge/viafrei.de-live-0b5fff?logo=googlechrome&logoColor=white)](https://viafrei.de/en)
[![node](https://img.shields.io/node/v/viafrei?logo=node.js&logoColor=white)](https://nodejs.org)
[![licence](https://img.shields.io/npm/l/viafrei?color=blue)](LICENSE)
[![no API key](https://img.shields.io/badge/API%20key-none-brightgreen)](#-connect-in-one-minute)
[![MCP](https://img.shields.io/badge/MCP-Streamable%20HTTP-6f42c1)](https://modelcontextprotocol.io)

**[viafrei.de](https://viafrei.de/en)** · [Connect your assistant](https://viafrei.de/en/connect) · [For developers](https://viafrei.de/en/developers) · [For businesses](https://viafrei.de/en/business) · [All tools](#-everything-it-can-do) · [API reference](API.md)

</div>

---

```
claude mcp add --transport http viafrei https://mcp.viafrei.de/mcp
```

**Free. No account, no API key, no sign-up.** One line and your assistant knows
whether the A8 is jammed, whether your train, bus or tram is late, where the
nearest fast charger is (and whether it is free, where the operator publishes
that), which hydrogen station takes a lorry, whether the lift at your station
works and whether the road ahead is forecast to freeze — from official German open data, live, with the source named
in every answer. And every German motorway has a [live page of its own](#-motorway-pages)
on viafrei.de, with a map.

> **Beta.** ViaFrei is being stabilised: sources are still being added, and
> answers and coverage can change. The answers are written by an AI assistant
> from our data, and AI can make mistakes, so check anything important (a
> closure, a departure, a price) against the source each answer names.

> **New in 2.1.25: viafrei.de asks your assistant first.** The home opens on one
> live conversation (a question, the tool, today's answer with its time and sources)
> and a "Connect in one minute" button. Every example is back, with an
> [examples page](https://viafrei.de/en/examples) listing them all, under a
> road-sign design that keeps the information of every card. Since 2.1.19 the
> answers improved too: departures name a long-distance train by its number, an
> ambiguous station name offers the largest stations first, a road answer says which
> road classes nobody covers in that Land, charging availability no longer falls
> behind, `find_charging_station` counts places rather than records, fuel prices
> are fetched only when a person asks (every station within 25 km in one request),
> and a connector reconnects by itself after a server restart.
>
> **New in 2.1.18: the website shows the tools' live answers.** The figures on the
> [viafrei.de](https://viafrei.de/en) home page now stand beside the question you could ask
> your assistant and what ViaFrei's own tools answer to it right now, with the tool's
> name, the data's time and every source credited. A place's cards (warnings, roads,
> places nearby, charging, parking) carry the answer for that place. It is the
> same answer your assistant gets through this connector.
>
> **New since 2.1.13: a live page for every German motorway.** All 122 of them, in
> seven languages, at [viafrei.de/en/motorway](https://viafrei.de/en/motorway) and
> [viafrei.de/de/autobahn](https://viafrei.de/de/autobahn). Each page has a map of
> the road with its closures, jams and roadworks, a strip of its junctions you can
> filter by stretch and direction, the full closures planned for the next seven
> days with their signed detours, lorry parks with free spaces, chargers by power
> class and the longest stretch without a fast one, road weather and DWD warnings,
> traffic cameras, the dated lorry ban, and the interchanges with the motorways
> each one meets. Fuel prices load only when you click. The home page lists the
> ten worst motorways right now, and every place page has an **Autobahn card**
> with the motorways nearby. **2.1.17** made the pages easy to find: a search title
> and description per page in every language, an opening sentence an AI answer can
> quote, a redesigned motorway catalogue on the home page, and a robots.txt that
> names the AI training crawlers. More in [Motorway pages](#-motorway-pages).
>
> **The site's cards now say what the tools say.** The charging, transit, road and
> parking cards on viafrei.de answer from the same rules as `find_charging_station`,
> `check_transit_disruption`, `check_road_status` and `find_parking`: one charger
> listed once, a status judged by the same freshness rule everywhere, VBB's live
> feed for punctuality in Berlin and Brandenburg, shared bikes near a stop, the
> Land traffic feeds and Hamburg's cameras on the road card, and the share-alike
> lorry parks and P+R sites in blocks of their own. `get_driving_rules` now opens
> its lorry-ban answer with the next ban day, dated.
>
> **Earlier in 2.1:** hydrogen stations (`find_hydrogen_station`), company offices
> in `find_poi` and what is mapped at an address in `find_address`, more city roads
> (Bremen, Kassel, Leipzig, Rüsselsheim am Main, Schleswig-Holstein's large
> bridges), Kassel's car parks, 23 more charge-point operators, and a jam rule that
> no longer calls a lane narrowing a jam. Every source is listed, with what it feeds
> and what we hold back, in [SOURCES.md](SOURCES.md); the [CHANGELOG](CHANGELOG.md)
> has the whole list.

---

## 🧳 What you can ask

You don't need to know any tool names. Ask the way you'd ask a friend who
happens to have every German traffic feed open. German or English; the answer
comes back in the language you asked in.

| when you're… | ask |
|---|---|
| 🌅 **about to commute** | *Wann fährt die nächste Bahn ab Köln Neumarkt?* · *Fahren Busse und Bahnen in Bayern gerade pünktlich?* · *When does the next train leave Hamburg Hbf?* |
| 🚗 **about to drive** | *Gibt es Stau auf der A8?* · *Are there roadworks on the A7 next week?* · *Is the A1 closed anywhere?* · *Welche Vollsperrungen sind auf der A7 in den nächsten sieben Tagen geplant?* · *Welche Baustellen gibt es in Bremen?* · *Ist die Fehmarnsundbrücke wegen Wind gesperrt?* |
| 🚚 **driving a lorry** | *Wann ist der nächste Lkw-Fahrverbotstag?* · *Gilt am 31. Oktober in Niedersachsen Lkw-Fahrverbot?* |
| 🚧 **stuck in traffic** | *How much time is the jam on the A3 between Frankfurt and Würzburg costing right now?* · *Is traffic backed up on the Cologne motorway ring — A1, A3 or A4?* · *Ist der Elbtunnel auf der A7 heute Nacht gesperrt?* |
| ⚡ **driving electric or on hydrogen** | *Where can I charge with Type 2 near Leipzig?* · *Wo gibt es einen Schnelllader mit 150 kW bei Nürnberg?* · *Where can I fill up a hydrogen lorry near Hamburg?* |
| 🅿️ **parking** | *Is the P+R at Fröttmaning usually full in the morning?* · *Wie viele Plätze sind in den Kasseler Parkhäusern frei?* · *Find a rest area with lorry parking on the A9* |
| ⛽ **filling up** | *Where is diesel cheapest near Kassel?* · *Welche Tankstellen gibt es in Weimar?* |
| ♿ **travelling step-free** | *Funktioniert der Aufzug am Bahnhof Köln Messe/Deutz?* |
| 🌦️ **watching the weather** | *Gibt es eine Unwetterwarnung für Freiburg?* · *Is the road near Garmisch going to be icy this morning?* |
| 📍 **looking for a place** | *What is the address of the Elbphilharmonie in Hamburg?* · *Welche Apotheken gibt es in Fulda?* · *My satnav shows 50.1109, 8.6821 — what address is that?* |
| 🇩🇪 **new to German roads** | *Do I need an emission sticker for Stuttgart?* · *Is there a speed limit on the Autobahn?* |
| ⏳ **waiting for news** | *Tell me as soon as the closure on the A7 is lifted.* · *Sag mir Bescheid, wenn in Köln ein Viertel oder mehr der Bus- und Bahnfahrten verspätet ist.* · *Warn me when a DWD severe-weather warning comes into force for Cologne.* |

**What the answers cover, honestly.** Live traffic is the motorways. Closures
and roadworks also cover federal roads, Land roads in Niedersachsen, Sachsen,
Thüringen and Baden-Württemberg, the city streets of Hamburg and Bremen, the
traffic reports some Länder and cities publish (Baden-Württemberg,
Schleswig-Holstein, Berlin, Hamburg, Köln, Hannover, Kassel, Leipzig, Rüsselsheim
am Main), and the state of Schleswig-Holstein's large bridges; other city streets
are not covered. Departures cover
every German stop from the timetable; a live delay appears where a realtime feed
carries that trip, and otherwise the answer says the time is the plan. Live
parking and charging occupancy exist only where the operator publishes them, and
an answer never reads "no data" as free. Fuel prices cover the stations we watch,
not all of Germany. A charger's live status counts as current only while it is
younger than its feed's own window; older, it is shown with its time as possibly
out of date. Hydrogen stations are H2 Mobility's published list: pumps and
opening hours, but no availability, price or working state, so check before you
drive. Places and addresses come from OpenStreetMap, so what is not
mapped there cannot be found, and ratings are not part of it. A **watch** lives in
the conversation that opened it: the server keeps every change there, and your
assistant shows it when you ask, or on its own if your client supports MCP
notifications. Nothing is sent by e-mail or SMS. Up to 10 watches per
conversation, each for up to 24 hours (3 by default), and a road is watched as a
whole, not one section of it.

## 💬 Real answers

These came back from the production server at `https://mcp.viafrei.de/mcp`. They
are not mock-ups. The first two were asked of **server 2.1.25 on 2026-10-17 at
18:38 Berlin time**, an hour after it went live. The next three were asked of
server 2.1.17 on 2026-10-14, around 22:40 Berlin time, minutes after it went live. The next three were asked
of server 2.1.8 on 2026-10-13 around 22:40, three more of server 2.1.5 that
afternoon, between about 14:50 and 16:20, and the others of server 2.0.10 that morning around
06:41. Those were asked again of server 2.1.17 on 2026-10-14 around 22:43 and
answer in the same shape; their figures, and the frost warning, belong to the
moment they were captured.
Each one shows the first lines of what the tool returned, and the source line as
it was sent, shortened where marked.

<details open>
<summary><b>🚧 "Is there anything on the roads around Alsdorf?"</b> — <code>check_road_status</code></summary>

```text
Alsdorf (05334004): no jams reported, 1 closure, 12 restrictions, 0 planned roadworks sites — window until 2026-10-20.
I do not hold federal and Land roads (Bundes-, Landes-/Staatsstraßen) for North Rhine-Westphalia: for those, this answer is no all-clear.
• Roadworks (Baustelle) A4: Provider text (German): "Instandsetzung Grenze NL_D - AK Aachen · AK Aachen (aus Richtung Aachener Land) nach A4 — Zeitraum dieser Bauphase: Beginn: 25.08.26 um 09:00 Uhr, Ende: 01.12.26 um 15:00 Uhr, (Ende der Gesamtmaßnahme: 01.12.2…" (2026-08-25)
• Roadworks (Baustelle) A544: Provider text (German): "A544 | Aachen - Würselen · Autobahnkreuz Aachen -> Aachen (Europaplatz) — Zeitraum dieser Bauphase: Beginn: 17.10.26 um 05:00 Uhr, Ende: 16.10.27 um 05:00 Uhr, (Ende der Gesamtmaßnahme: 16.10.2…" (2026-10-17)
…
```
The second line is new in 2.1.23: where no source covers a road class in that Land,
the answer says so instead of letting "no jams" read as an all-clear. The same line
is on the place's road card on viafrei.de.
*Edited: the remaining entries and the source line omitted.*
</details>

<details>
<summary><b>🔌 "Where can I charge around Würselen?"</b> — <code>find_charging_station</code></summary>

```text
Charging around Würselen (05334036) (within 10 km), nearest first:
1. Würselen - Lehnstraße, Lehnstraße 27, 52146 Würselen (Ladenetz) — 0.1 km, Type 2, up to 22.1 kW, 0.50 €/kWh net, status from 2026-10-15 17:37 — possibly out of date (2 charging units)
2. Würselen Rathaus, Rathausstraße 2, 52146 Würselen (Ladenetz) — 0.2 km, Type 2, up to 22.1 kW, 0.41 €/kWh net, status from 13:19 — possibly out of date (2 charging units)
…
Only a few operators publish live occupancy; "no status data" means unknown, not free.

As of 18:38 · Source: Ladepunkte: e-clearing.net (smartlab Innovationsgesellschaft mbH) via Mobilithek, CC0 1.0 (…) · Ladepunkt-Verfügbarkeit: e-clearing.net (smartlab Innovationsgesellschaft mbH) via Mobilithek, CC0 1.0 (…) · …
```
One line per place, each saying how many charging units it holds; since 2.1.23 a
publisher's many records of one car park are one place. A status too old to vouch
for is said with its time, never as free.
*Edited: three of five lines, the site ids and most of the source line omitted.*
</details>

<details>
<summary><b>🛣️ "Which full closures are planned on the A7 in the next seven days?"</b> — <code>check_road_status</code></summary>

```text
A7: 27 closures, 188 restrictions, 1 planned roadworks site, 44 current roadworks sites per BASt — window until 2026-10-21.
• Closure (Sperrung): Provider text (German): "A7 | Langenau - Lonetal · Ulm -> Würzburg — Die Baustelle ist zu folgenden Zeiträumen gültig: 20.10.26 21:00 bis zum 21.10.26 05:30 Uhr., (Ende der Gesamtmaßnahme:…"
• Closure (Sperrung): Provider text (German): "A7 | Aalen/Westhausen - Aalen/Oberkochen · Würzburg -> Ulm — Die Baustelle ist zu folgenden Zeiträumen gültig: 14.10.26 22:00 bis zum 15.10.26 05:30 Uhr., 15.10.26 22:00 bis zum 16…" — signed detour (U 12) for AS Aalen/Westhausen – AS Aalen/Oberkochen, route as published by the Verkehrsministerium BW (German): "AS Aalen/Westhausen - B 29 - B 19 - L 1084 - AS Aalen/Oberkochen" — signage context, not a route recommendation
• Closure (Sperrung): Provider text (German): "A7 Hamburg-Marmstorf (AS) Sperrung wg. erforderlicher Gehölzarbeiten · Hamburg -> Hannover — Die Baustelle ist zu folgenden Zeiträumen gültig: 19.10.26 von 09:00 bis 15:00 Uhr, (Ende der Gesamtmaßnahme: 21.10.26)"
…
Sources that answered: Autobahn GmbH, BASt (roadworks), BAB traffic messages, Landesmeldestelle Schleswig-Holstein (police traffic messages), Verkehrsministerium BW (signed detours).

As of 22:38 · Source: Verkehrsdaten: Autobahn GmbH des Bundes (…) · Arbeitsstellen: Bundesanstalt für Straßen- und Verkehrswesen (BASt) via Mobilithek, CC BY 4.0, bearbeitet (…) · …
```
Each closure in its publisher's words with its night-time windows, and the signed
detour where Baden-Württemberg publishes one. The planned full closures on the
[A7 page](https://viafrei.de/en/motorway/a7) are the same question asked by the
page itself, so the two cannot disagree.
*Edited: seven of ten entries, the count of further entries, two notes and most of the source line omitted.*
</details>

<details>
<summary><b>🚚 "Wann ist der nächste Lkw-Fahrverbotstag?"</b> — <code>get_driving_rules</code></summary>

```text
Regeln in Deutschland — Sonntags- und Feiertagsfahrverbot für Lkw:
• Nächster Fahrverbotstag: Sonntag, 18. Oktober, 0–22 Uhr, bundesweit. (Kalender nach § 30 Abs. 3 und 4 StVO, Feiertage geprüft am 2026-10-08)
• Sonntags und an Feiertagen dürfen Lkw über 7,5 t sowie Lkw mit Anhänger von 0 bis 22 Uhr nicht fahren. (§ 30 Abs. 3 StVO)
• Für Pkw, Wohnmobile und Transporter unter 7,5 t gilt das Verbot nicht — der Sonntag ist für sie ein normaler Fahrtag. (§ 30 Abs. 3 StVO)
…
• Ein Feiertag nur einzelner Länder ist nur dort ein Fahrverbotstag: Am 31. Oktober gilt das Lkw-Verbot von 0 bis 22 Uhr in den neun genannten Ländern; in Baden-Württemberg, Bayern, Berlin, Hessen, Nordrhein-Westfalen, Rheinland-Pfalz und im Saarland ist der Tag kein Feiertag nach § 30 Abs. 4 — außer er fällt auf einen Sonntag. (§ 30 Abs. 3 und 4 StVO)
…
Stand 19.09.2026 · Quelle: Verkehrsregeln: ViaFrei, eigene Zusammenstellung aus amtlichen Quellen (StVO, StVZO, 35. BImSchV, StVG, EmoG, AFIR); jede Aussage mit Quelle und Prüfdatum — informativ, keine Rechtsberatung / … (…)
```
The answer now opens with the next ban day, dated, before the rule itself, and a
holiday kept only in some Länder names them. The motorway pages print the same
calendar for the Länder each motorway crosses.
*Edited: the list of holidays and four further rules omitted, and the English half of the source line cut.*
</details>

<details>
<summary><b>⚡ "Where is a charger with 150 kW or more in Kassel?"</b> — <code>find_charging_station</code></summary>

```text
Charging around Kassel (within 10 km, ≥ 150 kW), nearest first:
2. Kassel, Germany - Zentrum, Neue Fahrt 9, 34117 Kassel (Tesla, Inc.) — 0.2 km, CCS2, up to 250 kW, 0.48 €/kWh net, status from 10:01 — possibly out of date, 10 without status
4. Circle K I Kassel Leipziger Strasse 22, 34125 Kassel (Spirii) — 1.2 km, CCS2, up to 400 kW, 0.83 €/kWh, status from 09:30 — possibly out of date
…
Only a few operators publish live occupancy; "no status data" means unknown, not free.
Price per kWh: published for 3 of 5 only; for the others we hold no price.

As of 22:43 · Source: Ladesäulenregister: Bundesnetzagentur.de, CC BY 4.0, bearbeitet (…) · Ladepunkte: Tesla Germany GmbH via Mobilithek, CC0 1.0 (…) · …
```
A status is judged by its feed's own window: one read this morning is shown with
its time as possibly out of date, never as free now. The charging card and the
motorway pages use the same rule.
*Edited: a place key, three of five sites, the watch ids, the register note and most of the source line omitted.*
</details>

<details>
<summary><b>🏢 "Where are SAP's offices in Walldorf?"</b> — <code>find_poi</code></summary>

```text
"SAP" in Walldorf:
1. SAP SE — company, Hasso-Plattner-Ring 7, 69190 Walldorf, Baden-Württemberg, 49.29442, 8.63995
2. SAP WDF01 — commercial building, Dietmar-Hopp-Allee 16, 69190 Walldorf, Baden-Württemberg, 49.29368, 8.64166
3. SAP WDF02 — office building, Dietmar-Hopp-Allee 14, 69190 Walldorf, Baden-Württemberg, 49.29461, 8.64274
4. SAP WDF03 — office building, Robert-Bosch-Straße 34, 69190 Walldorf, Baden-Württemberg, 49.29296, 8.64373
5. SAP WDF04 — office building, Dietmar-Hopp-Allee 15a, 69190 Walldorf, Baden-Württemberg, 49.29421, 8.64443
…

23 matches, 1–10 shown — the next with cursor="10".

OpenStreetMap data as of 2026-10-06

As of 22:44 · Source: OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0 (…)
```
A company's buildings, each with its address and point, from OpenStreetMap,
which is also why the answer carries the ODbL line.
The answer says how many matched and how to fetch the next page.
*Edited: five of ten entries and the source URIs cut to `…`.*
</details>

<details>
<summary><b>📫 "What is at Hasso-Plattner-Ring 7 in Walldorf?"</b> — <code>find_address</code></summary>

```text
"Hasso-Plattner-Ring 7, Walldorf" — 2 mapped objects at this address:
1. Hasso-Plattner-Ring 7, 69190 Walldorf, Baden-Württemberg — 49.29448, 8.63670
   (2 OpenStreetMap objects of this address, up to 145 m apart, shown as one point: outline, usually the building (OSM way; point = its centre))
2. Hasso-Plattner-Ring 7, 69190 Walldorf, Baden-Württemberg — 49.29438, 8.63978 — outline, usually the building (OSM way; point = its centre) — 224 m from point 1
The 2 points lie up to 224 m apart — further than 150 m, so not one door mapped twice; probably several buildings under this house number.

Mapped at this address in OpenStreetMap:
- SAP WDF21 — office building
- SAP WDF19 — office building
- SAP SE — company

As of 22:44 · Source: OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0 (…)
```
The address, the buildings mapped under it (and how far apart they are, so
"two buildings" is not mistaken for "one door mapped twice"), and the companies
and buildings OpenStreetMap places there.
*Edited: the note on another Walldorf, the data date and the source URIs cut.*
</details>

<details>
<summary><b>🚦 "Is there a jam in Berlin right now?"</b> — <code>check_road_status</code></summary>

```text
Berlin (11000000): 1 jam report, 247 closures, 267 restrictions, 10 planned roadworks sites — window until 2026-10-16.
• Slow traffic (Stockender Verkehr): Provider text (German): "A100 Stadtring Berlin, Wilmersdorf Richtung Neukölln, zwischen Gradestraße und Tunnel Ortsteil Britz, 0,8 km stockender Verkehr" (since 12:35; 6.6 km away)
• Roadworks (Baustelle): Provider text (German): "Karl-Liebknecht-Straße (Mitte) — Richtung Brandenburger Tor in Höhe Spandauer Straße Baustellenfläche für eine Hochbaustelle, Fahrbahn auf einen verschwenkten…" (2026-03-26–2027-09-30)
• Roadworks (Baustelle): Provider text (German): "Gertraudenstraße (Mitte) — in beiden Richtungen zwischen Spittelmarkt und Fischerinsel Brückenprüfung, Fahrbahn auf zwei Fahrstreifen verengt, Gewichtsbeschrän…" (2023-04-27–2028-03-31)
• Closure (Sperrung): Provider text (German): "Rosenthaler Straße (Mitte) — in beiden Richtungen zwischen Hackescher Markt und Sophienstraße Gleisbauarbeiten, Vollsperrung für Kfz-Verkehr" (2026-09-18–2026-10-20)
…
Sources that answered: Autobahn GmbH, BASt (roadworks), VIZ.NRW / NMS, Senatsverwaltung Berlin (traffic messages).

As of 22:34 · Source: Verkehrsdaten: Autobahn GmbH des Bundes (…) · … · Verkehrsmeldungen Berlin: Senatsverwaltung für Mobilität, Verkehr, Klimaschutz und Umwelt Berlin via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert (…) · …
```
One jam, not dozens: a lane narrowed for a building site is roadworks, however
the police message is filed, and the one queue on the A100 is the jam.
*Edited: six of ten entries, the radius notes, the other sources of the source line and its URIs omitted.*
</details>

<details>
<summary><b>💧 "Where can I fill up a hydrogen lorry near Hamburg?"</b> — <code>find_hydrogen_station</code></summary>

```text
Hydrogen stations for trucks/buses near Hamburg (within 50 km), nearest first:
1. Hamburg - Schnackenburgallee — 5.5 km · Schnackenburgallee 12, 22525 Hamburg · 350 bar truck/bus, 700 bar car · opening hours: not published (unknown) · record last changed 2026-10-13 (today)
2. Hamburg - Flughafen — 7.9 km · Weg beim Jäger 193, 22335 Hamburg · 700 bar car, 350 bar truck/bus · opening hours: not published (unknown) · record last changed 2026-10-13 (today)
3. Hamburg - Großmoorbogen — 10.0 km · Großmoorbogen 1, 21079 Hamburg · 350 bar truck/bus, 700 bar car · opening hours: not published (unknown) · record last changed 2026-10-13 (today)
No live availability, price or operating status is published — check that the station is working before you drive.

As of 14:50 · Source: Wasserstofftankstellen: H2 Mobility Deutschland GmbH & Co. KG via Mobilithek, CC BY 4.0, bearbeitet (…) · Ortsdaten: © GeoNames (CC BY 4.0), bearbeitet (…)
```
Only the stations with a 350 bar pump for lorries and buses, because the question
was about a lorry. It names what the publisher does not say, opening hours
included, and never guesses that a station is working.
*Edited: the two source URIs cut to `…`.*
</details>

<details>
<summary><b>🚧 "Welche Baustellen gibt es in Bremen?"</b> — <code>check_road_status</code></summary>

```text
Bremen: 4 jam reports, 151 closures, 119 restrictions, 8 planned roadworks sites — window until 2026-10-16.
• Slow traffic (Stockender Verkehr): Provider text (German): "A1 Osnabrück Richtung Bremen, zwischen Dreieck Stuhr und Bremen-Arsten, 4 km stockender Verkehr im Baustellenbereich" (since 12:46; +16 min per Autobahn GmbH; 6.2 km away)
• Traffic restriction (Verkehrseinschränkung) (Bremen): Provider text (German): "Einengung der Fahrbahn; Einengung des Geh-/Radweges; Halteverbot;" (2026-06-01–2026-10-31)
• Closure (Sperrung) (Bremen): Provider text (German): "Vollsperrung; Einengung des Geh-/Radweges; Halteverbot;" (2026-08-17–2026-10-16)
…
Sources that answered: Autobahn GmbH, BASt (roadworks), VIZ.NRW / NMS, Bremen traffic management centre (roadworks).

As of 16:14, unchanged since 13:15 · Source: Verkehrsdaten: Autobahn GmbH des Bundes (…) · … · Baustellen Bremen: Verkehrsmanagementzentrale Bremen via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert (…) · …
```
The motorway jam and the city's own building sites in one answer, each in its
publisher's words and with its dates, and a line naming every source that answered.
*Edited: asked in English; a place key, seven of ten entries, the radius notes and three of five sources omitted.*
</details>

<details>
<summary><b>🅿️ "Wie viele Plätze sind in den Kasseler Parkhäusern frei?"</b> — <code>find_parking</code></summary>

```text
Parking around Kassel (within 10 km), nearest first:
1. Galeria — Car park (Parkhaus), 0.2 km, 210 spaces, 102 free (as of 16:06)
2. Friedrichsplatz — Car park (Parkhaus), 0.2 km, 980 spaces, 579 free (as of 16:06)
3. Kurfürsten Galerie — Car park (Parkhaus), 0.3 km, 560 spaces, 456 free (as of 16:06)
…
As of 16:06 · Source: Parkhäuser Kassel: Stadt Kassel, Straßenverkehrs- und Tiefbauamt via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert (…) · Parkhaus-Belegung Kassel: Stadt Kassel, Straßenverkehrs- und Tiefbauamt via Mobilithek, … (…) · …
Where no "free" count is shown the operator publishes no occupancy — it does not mean the site is full.
```
The city's live counts, each with the time of its reading.
*Edited: asked in English; a place key, two car parks, the separate OpenStreetMap list and two of four sources omitted.*
</details>

<details>
<summary><b>🚋 "Wann fährt die nächste Bahn ab Köln Neumarkt?"</b> — <code>get_departures</code></summary>

```text
Abfahrten ab Köln Neumarkt — Fahrplan mit Echtzeit, 06:41 bis 07:01:
06:42 Tram 3 → Köln Dellbrück Thielenbruch, Gleis 14, pünktlich
06:43 Tram 7 → Benzelrath Frechen-Benzelrath, Gleis 12, Plan
06:44 Tram 16 → Bonn Bad Godesberg Stadthalle, Gleis 14, +1 Min. (voraussichtlich 06:45)
06:45 Bus 146 → Köln Lindenthal Deckstein, Steig 25, pünktlich
06:47 Tram 18 → Köln Buchheim Herler Str., Gleis 16, +1 Min. (voraussichtlich 06:48)
… und 23 weitere im Fenster.

Stand 06:41 · Quelle: Fahrplandaten: DELFI e.V., CC BY 4.0, bearbeitet (…) · … · Echtzeitdaten: DELFI e.V. via Mobilithek, CC BY-SA, bearbeitet (…)
Die Echtzeitangaben aus DELFI GTFS-RT und DELFI SIRI ET stehen unter CC BY-SA (Share-alike), …
Verspätungen und Ausfälle aus den DELFI-Echtzeitdaten, wo sie vorliegen; mit „Plan“ markierte Zeiten sind Fahrplanzeiten ohne Echtzeitangabe. …
```
Trams and buses with their live delay, from the same national realtime feeds as
the trains. Where no live figure exists the row says **Plan**, never "on time".
*Edited: five of ten rows, the stop id line and two of three sources omitted.*
</details>

<details>
<summary><b>♿ "Are the lifts working at Berlin Hauptbahnhof?"</b> — <code>check_station_facilities</code></summary>

```text
7 of 62 reported facilities at Berlin Hauptbahnhof are out of service. Counted are the facilities DB reports for this station.
Escalator 1.UG - Tram Haltestelle 4: out of service
Lift Gleis 3/4 (C/D) - Gleis 11/12: out of service
Lift Gleis 5/6 (C/D) - Gleis 11/12: out of service
Lift Gleis 1/2 (C/D) - 1.UG - EG: in service
… and 54 more.

As of 06:41 · Source: Aufzüge und Fahrtreppen: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet (…) · …
```
Each lift and escalator, where it is and whether it works. For anyone with a
wheelchair, a pram or a heavy suitcase, this decides whether a station is usable.
*Edited: four escalator rows omitted, and one source cut to `…`.*
</details>

<details>
<summary><b>🚧 "Are there roadworks on the A7 this week?"</b> — <code>find_roadworks_ahead</code></summary>

```text
A7: 45 roadworks sites per BASt between 2026-10-13 and 2026-10-20: 44 current, 1 planned. 5 of them are in this answer — raise limit to 20 for the rest.
• Construction works (Baustelle): A7 (+15 more sections) — 1 of 2 lanes closed, hard shoulder closed, 80 km/h limit, phase 2026-06-23 until 2026-10-25 — 2023-03-23 until 2028-04-14 — Provider text (German): "A7 zw. Bad Brückenau-Volkers → Bad Brückenau/Wildflecken 1,602 km; Brückenneubau"
• Construction works (Baustelle): A7 (+3 more sections) — 1 of 3 lanes closed, 80 km/h limit — 2023-10-28 until 2026-12-31 — Provider text (German): "A7 zw. Hammelburg → Bad Kissingen/Oberthulba 1,007 km; Brückenneubau"
…
As of 06:17 · Source: Arbeitsstellen: Bundesanstalt für Straßen- und Verkehrswesen (BASt) via Mobilithek, CC BY 4.0, bearbeitet (…)
Planning data from BASt: road sections only, no coordinates and no live delay. For the situation right now, call check_autobahn_traffic.
```
Which junctions each site lies between, what is closed, and until when — and it
says plainly that this is planning data, pointing to the live tool for now.
*Edited: the first and the last two of five sites omitted, and the "unchanged since" note cut from the stand line.*
</details>

<details>
<summary><b>⛽ "Which filling stations are there in Weimar?"</b> — <code>find_fuel_station</code></summary>

```text
I know no filling station from our price data within 5 km of Weimar, … The nearest station with a diesel price is about 19.3 km away — radius_km 20 reaches it. … find_cheapest_fuel can ask the provider which ones are here — new areas one at a time and only a limited number per hour; its answer carries their prices, within about a minute.
More filling stations mapped by OpenStreetMap — we don't have a price for these stations yet:
1. Jet — 1.2 km
2. Star, Rießnerstraße 37, 99427 Weimar — 1.5 km
4. Shell, Rießnerstraße 14, 99427 Weimar — 1.5 km
…
As of 06:41 · Source: Tankstellenpreise: Tankerkönig.de — MTS-K, CC BY 4.0, bearbeitet (…) · OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0 (…) · …
Hinweis zu den Kraftstoffpreisdaten (MTS-K): Diese Daten dürfen ausschließlich zum Zweck der Verbraucherinformation verwendet werden; …
```
Where we hold no price, the answer says so, offers the next step, and lists the
OpenStreetMap stations nearby — never with an invented price. Where we do hold
prices, each priced station is listed with its price per litre and its open state;
this page shows none, because of the
[MTS-K condition](#-using-the-data-you-get-back).
*Edited: place keys and a second Weimar removed from the first line, two stations and one source omitted.*
</details>

<details>
<summary><b>🅿️ "Is the P+R at Fröttmaning usually full in the morning?"</b> — <code>find_parking</code></summary>

```text
Parking around Fröttmaning (within 10 km), nearest first:
1. P+R Fröttmaning — Park and ride (P+R), 0.3 km, 1259 spaces, no live occupancy — forecast for now (weekdays 06–07): usually free (more than 75 % free) – forecast from past experience, as of 12/2024
2. P+R Kieferngarten — Park and ride (P+R), 1.1 km, 235 spaces, no live occupancy — forecast for now (weekdays 06–07): usually free (more than 75 % free) – forecast from past experience, as of 12/2024
Munich's P+R sites are, per the dataset, as a rule only for public-transport passengers („grundsätzlich nur den ÖPNV-Fahrgästen“).
…
As of 06:41 · Source: Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de (bearbeitet) (…) · …
Where no "free" count is shown the operator publishes no occupancy — it does not mean the site is full.
```
No live count exists here, so it says so and gives the city's own forecast for this
weekday and hour, labelled as a forecast and dated.
*Edited: a place key, one P+R site, the separate OpenStreetMap list and four of five sources omitted.*
</details>

<details>
<summary><b>⚡ "Where can I charge with Type 2 near Leipzig?"</b> — <code>find_charging_station</code></summary>

```text
Charging around Leipzig (within 10 km, Type 2), nearest first:
1. Parkhaus Neumarkt, Neumarkt 30, 04109 Leipzig (Parkhaus Neumarkt) — 0.2 km, Type 2, up to 22 kW, no status data, per charging point register
2. Motel One Leipzig Nikolaikirche, Schuhmachergäßchen 5, 04109 Leipzig (Wirelane GmbH) — 0.3 km, Type 2, up to 11 kW, no status data, per charging point register
…
Only a few operators publish live occupancy; "no status data" means unknown, not free.
Price per kWh: not published for any of these sites (in the data we hold).
Charging point register as of 2026-09-01 — chargers as reported by their operators to the Bundesnetzagentur, with no live occupancy and no warranty of accuracy or completeness.
…
```
It says what it does not know: "no status data" is unknown, never free, and where
an operator publishes a price per kWh the answer shows it.
*Edited: a place key and the third site omitted, and the stand and source lines cut.*
</details>

<details>
<summary><b>📍 "What is at 52.5163, 13.3777?"</b> — <code>describe_location</code></summary>

```text
Description of 52.5163, 13.3777:
- Nearest address: Pariser Platz 1, 10117 Berlin (3 m)
- Settlement: Unter den Linden (0.7 km)
- Municipality: Berlin
- State (Land): Berlin
- Junction: Seestraße (4.2 km)

Address data as of 2026-10-06
As of 06:56 · Source: Ortsdaten: © GeoNames (CC BY 4.0), bearbeitet (…) · … · OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0 (…)
```
That's the Brandenburg Gate. *Edited: one of three sources cut to `…`.*
</details>

<details>
<summary><b>🌦️ "Is the road near Garmisch going to be icy this morning?"</b> — <code>check_weather_warnings</code></summary>

```text
One official notice for Garmisch-Partenkirchen, highest level 1 of 4:
1. Level 1 of 4 — Wetterwarnung (the DWD's own name; our translation: weather warning) — FROST
   Valid: until 2026-10-13 08:00 (since 2026-10-13 00:00)
   Official DWD wording, reproduced unaltered (German):
   „Amtliche WARNUNG vor FROST“
   For the drive: Expect ice and much longer braking distances; winter tyres are mandatory in these conditions (§ 2 (3a) StVO).

DWD road-surface forecast for the nearest road-weather stations (SWSMOS/METRo model forecast, run 05:00 — not a measurement and not an official warning):
- Station Farchant-Tunnel (open road, 5.3 km) — forecast 06:00: dry (Trocken), road surface 4.6 °C; no slippery class forecast until 2026-10-14 06:42.
…
Quelle: Deutscher Wetterdienst (…) · Quelle: Deutscher Wetterdienst. Datenquelle: BMVBS und Straßenbauverwaltungen der Länder (…) · …
The road-weather station data are unverified point measurements and do not reflect conditions on a road section; …
```
The official warning word for word, and beside it the forecast for the road
surface itself, with what that forecast is not.
*Edited: the area line, the CAP fields, part of the DWD text, two stations and one source omitted.*
</details>

On **[viafrei.de](https://viafrei.de/en)** the same data is on the page: the home
shows cards for one place, public transport first, then fuel, parking, roads, the
motorways nearby, charging, weather and what is nearby, and German towns and
cities have place pages under their full names, where each card row with its own
point links to OpenStreetMap's map. Since 2.1.9 the cards answer by the tools' own
rules, so a card and an assistant asked about the same place say the same thing:

- **charging**: one charger published by two feeds is one row, a site whose every
  point is closed is not listed, and each row says "1 of 2 free (as of 22:21)",
  "occupied", "out of service", "possibly out of date" or "no status data", which
  is unknown and never free;
- **transit**: Berlin and Brandenburg take their punctuality from VBB's own live
  feed, a railway station's realtime calls are matched through the national stop
  directory, and shared bikes within 1 km are listed with their stations;
- **roads**: the Land traffic feeds and roadworks registers answer a place as they
  do in `check_road_status`, every row says where it is, a city's own street
  messages are not crowded out by the motorways, Hamburg places name up to two
  traffic cameras (as links, never an image), and every source behind a row or a
  count is credited;
- **parking**: Trucklounge's lorry parks and the P+R NRW sites appear in blocks of
  their own, each with its licence's own sentence;
- **the place page** adds the low-emission-zone sentence `get_driving_rules`
  states for that Gemeinde, and lines suggesting what to ask your assistant to
  watch.

Each station on the transit card has a line of its own: how many of its lifts and
escalators run, each one out of service by name, the platforms the timetable marks
step-free, and the car parks and P+R sites within 300 m. The weather card shows
the nearest road-weather station's next six hours, and the fuel card names the two
nearest hydrogen stations within 25 km.

**Why the source line matters.** Every answer ends with one, and it is the
licence speaking: show it to whoever reads the answer. Copy the line the server
sends you, not the ones on this page, which are shortened. See
[Using the data you get back](#-using-the-data-you-get-back).

## 🛣️ Motorway pages

Every motorway in Germany has a page of its own, 122 of them, in seven languages:
the index is at **[viafrei.de/en/motorway](https://viafrei.de/en/motorway)**
(German: [viafrei.de/de/autobahn](https://viafrei.de/de/autobahn)), and a motorway
is its number in lower case — the A7 is
**[viafrei.de/en/motorway/a7](https://viafrei.de/en/motorway/a7)** and
[viafrei.de/de/autobahn/a7](https://viafrei.de/de/autobahn/a7). A spelling such as
`A 7`, `a07` or `BAB7` takes you to the same page.

What the A7's page holds, from top to bottom:

- **One sentence about the road**, built from its own data: from Füssen to
  Flensburg/Harrislee, about 928 km on the schematic line, the Länder it crosses in
  road order and how many junctions and interchanges it has, followed by what is
  reported now, with its time. On 2026-10-14 the English page read: "The A7 runs
  from Füssen junction to Flensburg/Harrislee junction, about 928 km long
  (schematic), through Bavaria, Baden-Württemberg, Hesse, Lower Saxony, Hamburg
  and Schleswig-Holstein, with 141 junctions and interchanges (24 of them
  interchanges). Reported on the A7 now: 21 closures, 0 jams, 118 roadworks (as
  of 22:37)."
- **A map**, drawn on the server: Germany's outline and the Länder from the BKG's
  VG2500, the motorway as a schematic line through the junctions of BASt's Location
  Code List, closures solid, roadworks hatched, jams with their delay. Where the
  list has no course for a stretch the line breaks, and the page names the break
  rather than drawing across it.
- **What is reported now**: closures, jams and roadworks under their own heading,
  then the **full closures planned for the next seven days**, soonest first, each
  with the signed detour where Baden-Württemberg publishes one.
- **The junction strip**: every junction, interchange and triangle in order, with
  its counts. A form filters the page by stretch (from, to), direction and layer,
  and works without JavaScript. Each interchange names and links the motorways it
  meets, and a chosen stretch gives its own length.
- **Parking and rest**: truck stops, lorry parks and service areas with live free
  spaces where the operator publishes them, and car parks; the share-alike
  sources (Trucklounge, P+R NRW, and OpenStreetMap's car parks at the junctions)
  in blocks of their own.
- **Charging**: the chargers along the road with their status, the sites by power
  class, and the **longest stretch with no charger of 150 kW or more**. It says
  where chargers are, never that one is free unless its operator says so.
- **Weather**: the DWD's official warnings along the road and the road-surface
  forecast of its road-weather stations.
- **Traffic cameras**, as links to the publisher's images.
- **Fuel prices**, only when you click: the page itself carries none, and the
  click loads at most ten stations, each price with its time and the MTS-K note.
- **On every motorway**: the lorry ban, dated for the Länder this road crosses
  (whether it holds now, until when, and the next ban days), the advisory speed,
  the rescue lane and the emergency numbers, in the same words `get_driving_rules`
  uses.
- **Ask your assistant**: how to connect, the address to copy, and two or three
  questions this page can answer, each answered from the page's own rows with its
  time and source.

The index lists every motorway with its live counts, has a search that takes a
number in any spelling, a "worst right now" order (closures and jams first, then
the longest delay), and an overview map of Germany with the motorways that have a
closure or a jam drawn apart. The home page lists the ten worst motorways right
now as cards, and every place card set has an **Autobahn card**: the motorways
near the place, nearest junction first, each linked to its page.

**Found by search, classic and AI.** Each motorway page has its own title and
description in every language ("A7 Germany: traffic jams, roadworks, map"), the
motorway sitemaps list every page in every language, and
[llms.txt](https://viafrei.de/llms.txt) and
[llms-full.txt](https://viafrei.de/llms-full.txt) describe the pages;
llms-full.txt also lists every motorway page in English and German. [robots.txt](https://viafrei.de/robots.txt) keeps the AI training and
corpus crawlers off the fuel and place pages, names them one by one, and leaves
the motorway pages open to every crawler. The fuel prices are a click no crawler
follows.

## 🔌 Connect in one minute

The product is a **hosted MCP server**. Point your client at it and the tools
appear. There is nothing to install, no key to request and no quota to
negotiate. Step-by-step guides for each assistant:
**[viafrei.de/en/connect](https://viafrei.de/en/connect)**.

**Claude Code**
```bash
claude mcp add --transport http viafrei https://mcp.viafrei.de/mcp
```

**Claude (desktop app and claude.ai), ChatGPT and other apps that take a connector URL** —
add a custom connector with this address (in Claude: Settings → Connectors → *Add custom connector*;
in ChatGPT the connector settings need developer mode):
```
https://mcp.viafrei.de/mcp
```

**Cursor, and any client with an `mcpServers` file that takes a `url`**, over HTTP:
```json
{ "mcpServers": { "viafrei": { "url": "https://mcp.viafrei.de/mcp" } } }
```

**VS Code** (`.vscode/mcp.json`, or *MCP: Add Server* from the command palette):
```json
{ "servers": { "viafrei": { "type": "http", "url": "https://mcp.viafrei.de/mcp" } } }
```

**Clients that speak only stdio** — for example Claude Desktop's config file
(`claude_desktop_config.json`, opened from Settings → Developer → *Edit Config*).
That is what this package is for:
```json
{ "mcpServers": { "viafrei": { "command": "npx", "args": ["-y", "viafrei"] } } }
```
Node 22 or newer. `npx` fetches the bridge when your client starts it. If the
file already has an `mcpServers` block, add the `"viafrei"` entry inside it
rather than pasting a second block.

**An older client on HTTP+SSE** is answered too, at `https://mcp.viafrei.de/sse`.
The transport is deprecated in the specification, so prefer the address above
when you can:
```bash
claude mcp add --transport sse viafrei https://mcp.viafrei.de/sse
```

Restart the client and ask one of the questions above.

### Where to find ViaFrei

- **npm — [`viafrei`](https://www.npmjs.com/package/viafrei).** This package:
  the stdio bridge, for the config line above. Its page shows the current
  version and this README.
- **Smithery — [smithery.ai/servers/viafrei/viafrei](https://smithery.ai/servers/viafrei/viafrei).**
  Connect through Smithery's hosted connection, with no local install.
- **Glama — [glama.ai/mcp/servers/mavrovde/viafrei-mcp](https://glama.ai/mcp/servers/mavrovde/viafrei-mcp).**
  The directory listing for this repository, with the tool list.
- **Official MCP Registry — `de.viafrei/mcp`.** The hosted endpoint, as MCP
  clients and directories that read the [registry](https://registry.modelcontextprotocol.io)
  find it; [`server.json`](server.json) is the entry. It is republished with every
  release of this package, after the npm publish, and only when the live server
  reports the same version.
- **For AI tools — [viafrei.de/llms.txt](https://viafrei.de/llms.txt)** and
  [llms-full.txt](https://viafrei.de/llms-full.txt): what ViaFrei is, how to
  connect, every tool in one line each, the example questions with the tool that
  answers each, and the live pages (the motorway index, an example motorway page,
  the place pages); llms-full.txt also lists every motorway page in English and
  German.

## 🧰 Everything it can do

<!-- catalogue:begin — generated by scripts/gen-readme-catalogue.mjs from catalogue.json; do not edit by hand -->

**22 tools, 9 prompts, 10 resources and 2 resource templates** — server 2.2.1, snapshot of 2026-10-18. Each line is the server's own words; the full parameters are in [API.md](API.md).

#### 🚗 On the road

| tool | what it answers |
|---|---|
| [`check_autobahn_traffic`](API.md#check_autobahn_traffic--autobahn-traffic) — Autobahn traffic | Jams, slow traffic, closures and roadworks in force this minute on up to 5 motorways, with delay/speed. |
| [`check_road_status`](API.md#check_road_status--road-status-and-closures) — Road status and closures | Whether a motorway, B or Land road (NI, SN, TH, BW: pass the Land/town as place) is open, closed, restricted, now or coming days; by place, jams, city/Land messages, Hamburg traffic cameras. |
| [`find_roadworks_ahead`](API.md#find_roadworks_ahead--planned-roadworks) — Planned roadworks | Returns roadworks PLANNED on one motorway, one Bundes-/Landesstraße in NI, SN, TH or BW, or Hamburg city streets by place, in a date window: section, restriction, dates. |
| [`find_parking`](API.md#find_parking--parking-nearby) — Parking nearby | Parking near a place, a coordinate or along one motorway: motorway lorry parks, car parks and P+R sites, with total spaces and, where published, free spaces now and the reading's age. |

#### 🚆 Public transport

| tool | what it answers |
|---|---|
| [`get_train_departures`](API.md#get_train_departures--train-departures) — Train departures | Next trains from a German railway station: platform, delay, cancellations. |
| [`get_departures`](API.md#get_departures--scheduled-departures-bus-tram-train) — Scheduled departures (bus, tram, train) | Scheduled departures from any German stop — bus, tram, U-Bahn, S-Bahn, train, ferry. |
| [`check_transit_disruption`](API.md#check_transit_disruption--public-transport-disruption-in-a-region) — Public-transport disruption in a region | How punctual public transport is now in one German region: the share of trips ever over 5 min late, trips with a cancelled stop, the trend, and the service alerts in force there (diversions, closed stops). |
| [`check_station_facilities`](API.md#check_station_facilities--station-lifts-and-escalators) — Station lifts and escalators | Report whether the lifts and escalators of a German railway station — or of a Köln Stadtbahn stop — are working now: each one, where it is, its state (in service / out of service / unknown) and the operator's explanation. |

#### ⚡ Charging and fuel

| tool | what it answers |
|---|---|
| [`find_charging_station`](API.md#find_charging_station--ev-charging-nearby) — EV charging nearby | Returns EV charging sites near a place or coordinate with operator, connector types, maximum power, price per kWh where published, and how many points are free right now where the operator publishes live status. |
| [`find_cheapest_fuel`](API.md#find_cheapest_fuel--cheapest-fuel-nearby) — Cheapest fuel nearby | Returns the cheapest stations for one fuel grade near a place or coordinate: price per litre, brand, address, distance, open state. |
| [`find_fuel_station`](API.md#find_fuel_station--find-a-filling-station) — Find a filling station | Finds filling stations around a place or coordinate under any combination of filters — grade, brand, name, open now, open at a time you name, open 24 h — sorted by distance, price or name. |
| [`find_hydrogen_station`](API.md#find_hydrogen_station--hydrogen-stations-nearby) — Hydrogen stations nearby | Returns hydrogen (H2) filling stations near a place or coordinate, nearest first, with operator, address, pumps (700 bar car, 350 bar truck/bus), opening hours where published and the age of the record. |

#### 📍 Places and addresses

| tool | what it answers |
|---|---|
| [`find_place`](API.md#find_place--look-up-a-place) — Look up a place | Looks up a place name and returns every place that matches, each with its kind, official key (AGS/RS), population, English name and coordinate. |
| [`find_poi`](API.md#find_poi--find-a-named-place) — Find a named place | Finds a business or landmark by name or kind — company, shop, clinic, hotel, hostel — with address, category and coordinate. |
| [`find_address`](API.md#find_address--look-up-a-street-address) — Look up a street address | Looks up a street address: its coordinate, and the named OpenStreetMap objects at it (company, shop, office) or that none are. |
| [`describe_location`](API.md#describe_location--describe-a-coordinate) — Describe a coordinate | Turns a coordinate into words: the nearest address, settlement and motorway junction with their distances, and the Gemeinde, Kreis and Land the point lies in. |
| [`find_nearby`](API.md#find_nearby--what-is-nearby) — What is nearby | Overview of what is around a place or coordinate: nearby fuel stations, EV charging, parking, the nearest railway station and motorway junction, each with its distance. |

#### 🚲 Sharing

| tool | what it answers |
|---|---|
| [`find_sharing`](API.md#find_sharing--shared-bikes-nearby) — Shared bikes nearby | Returns rentable shared bikes near a place or coordinate: bike-sharing stations with bikes and free docks now, and free-floating bikes around, with distance and data age (nextbike incl. KVB Rad, MyRadl, VAG_Rad; Donkey Republic). |

#### 🌦️ Weather and rules

| tool | what it answers |
|---|---|
| [`check_weather_warnings`](API.md#check_weather_warnings--weather-warnings-and-road-surface-forecast) — Weather warnings and road-surface forecast | Returns the official DWD weather warnings in force for a place — storm, snow, ice, heavy rain, thunderstorm, heat — with Warnstufe 1–4, area, validity and the official text unaltered. |
| [`get_driving_rules`](API.md#get_driving_rules--german-driving-rules) — German driving rules | Returns the German road rules a visitor needs: low-emission zones (Umweltzone) and which Feinstaubplakette a city requires, speed limits (advisory 130), winter tyres, alcohol, the Sunday lorry ban, tolls (no car toll), Rettungsgasse, what must be in the car, and electric cars (E-Kennzeichen, ad-hoc payment, plugs). |

#### 🔔 Watches

| tool | what it answers |
|---|---|
| [`watch_situation`](API.md#watch_situation--watch-for-a-change) — Watch for a change | Opens a watch so THIS conversation is told when something changes: a road reopening, a stop running late, a weather warning, a charge point turning free. |
| [`stop_watch`](API.md#stop_watch--stop-a-watch) — Stop a watch | Ends a watch this conversation opened with watch_situation, so no further notifications arrive for it. |

#### 🧭 Prompts — ready-made briefings

Pick one in your client's prompt menu and fill in the blanks; it calls the right tools in the right order.

| prompt | what it does |
|---|---|
| `plan_departure` — Trip briefing before departure — Reise-Briefing vor der Abfahrt | Briefs a drive that is about to start: the official weather warnings at both ends, whether each motorway is open, and the jams in force this minute, ending in one go/no-go sentence. |
| `compare_travel_options` — Drive or take the train? — Auto oder Bahn? | Weighs one trip by car against the same trip by rail: closures and live jams on the motorway side, the next departures and the region's punctuality on the rail side, as two paragraphs the traveller can compare. |
| `prepare_car_trip` — What you need before driving in Germany — Vorbereitung der Autofahrt | Collects what a driver must carry and know before driving in Germany and into one particular city: the low-emission-zone badge, speed limits, winter tyres, the alcohol limit, tolls, mandatory equipment and the rules for an electric car. |
| `plan_fuel_stop` — Refuel or charge on the way — Tank- oder Ladestopp unterwegs | Finds where this traveller fills up or charges on the way: the cheapest stations for one fuel grade around one place, or the charging points with the right connector and power, and the rest area beside them if they also need a break. |
| `plan_commute` — Plan today's commute by train — Pendelfahrt für heute planen | Plans one public-transport leg on the day itself: the next departures from the station with delays, platforms and cancellations, and whether the region's buses and trains are running normally at this hour. |
| `plan_arrival_parking` — Where to leave the car on arrival — Parken am Ziel | Finds where to leave the car at the end of the drive: the car park in town, the park-and-ride at the edge with the onward departures, or the rest area if the traveller is early. |
| `find_a_place` — Find out what a name refers to — Herausfinden, was ein Name meint | Resolves a bare name of unknown kind into a place, a named thing, or an address, trying each table in turn and stopping at the first that answers. |
| `plan_local_errand` — What is around this place? — Was ist hier in der Nähe? | Answers "what is around here" for one place: the nearest fuel, EV charging, parking, railway station and motorway junction in one glance, then — only if the traveller wants more than the nearest one — the depth tool for that one category. |
| `explain_this_coordinate` — Say where a coordinate is — Sagen, wo eine Koordinate liegt | Turns a bare lat/lon into a sentence a traveller understands: the nearest address, settlement and motorway junction with their distances, and the Gemeinde, Kreis and Land the point lies in. |

#### 📚 Resources — reference your assistant can read

| resource | what it holds |
|---|---|
| `viafrei://attribution` — Data sources & attribution | Licence and attribution text for every data source ViaFrei uses. |
| `viafrei://coverage` — Coverage | Which feeds, places and vehicles ViaFrei can answer for right now — licence, cadence and freshness per feed, which large cities hold no fuel price yet, plus what is deliberately not covered. |
| `viafrei://rules/driving-in-germany` — Driving in Germany — the rules a visitor needs (DE/EN) | Curated, sourced and dated: low-emission zones, speed, winter tyres, alcohol, tolls, the Sunday lorry ban, equipment, emergencies and electric driving. |
| `viafrei://rules/low-emission-zones` — Low-emission zones (Umweltzonen) — city, zone, plaque, where to buy it (DE/EN) | Which German cities run a low-emission zone, which Feinstaubplakette they require and where to buy it. |
| `viafrei://emergency` — Emergency in Germany — 112, 110, rescue lane, breakdown, crash (DE/EN) | What to dial, how to form the Rettungsgasse, what to do in a breakdown or after a crash, and what the law requires you to carry. |
| `viafrei://rules/electric-driving` — Electric driving in Germany — E plate, charging, payment, plugs (DE/EN) | What an electric car needs in Germany: the E-Kennzeichen and why its privileges differ per city, the green plaque, the right to ad-hoc card payment, plug standards, how prices are shown, etiquette and what to do in an emergency. |
| `viafrei://status/feeds` — Feed status | Per feed: is it still arriving? |
| `viafrei://watches` — My watches | The watches THIS conversation has open, with what each one is watching and when it expires. |
| `viafrei://gazetteer` — Gazetteer coverage | What the place index (gazetteer_places) holds: rows and last load per source and kind, how many carry an English name, and the sixteen Länder it can name — the coverage behind find_place/find_poi/find_nearby's place answers. |
| `viafrei://addresses` — Address coverage | What the OSM-derived address table (osm_addresses) holds per Bundesland — the Länder and each one's extract date read from the rows, the row counts estimated from the planner's statistics and labelled so — plus the ODbL § 4.6 offer owed to anyone who receives an address-derived result. |
| `viafrei://watch/{id}` — One watch | One watch of this conversation: what is being watched, what it has reported, and the attribution of the data behind each report. |
| `viafrei://place/{query}` — A resolved place | One place, poi or address resolved the same way every tool resolves `place` — a point, a short list of candidates, or an honest no — so a name can be pinned once and reused as lat/lon. |

<!-- catalogue:end -->

**The running server is the source of truth.** This list and [API.md](API.md)
are rendered from a dated snapshot of it, and CI fails if either drifts from that
snapshot. Ask any MCP client for `tools/list` to see what is live this minute.

### Worked use cases

Walkthroughs that chain several tools, each naming what comes back:

- 🛣️ [Driving Munich to Berlin](https://github.com/mavrovde/viafrei-mcp/wiki/Use-case-Driving-Munich-to-Berlin): several motorways in one call, roadworks ahead, a fuel or charging stop, and parking at the far end.
- 🚉 [The commute that broke](https://github.com/mavrovde/viafrei-mcp/wiki/Use-case-The-commute-that-broke): departures, regional disruption, and a station lift that is out.
- 🔋 [An EV on a long weekend](https://github.com/mavrovde/viafrei-mcp/wiki/Use-case-An-EV-on-a-long-weekend): charging by connector and power, low-emission-zone rules, and what is around a stop.
- 🚚 [Fleet and logistics briefings](https://github.com/mavrovde/viafrei-mcp/wiki/Use-case-Fleet-and-logistics-briefings): a dispatcher's morning brief, and watches that report a change instead of being polled.
- 🗺️ [Building a local guide agent](https://github.com/mavrovde/viafrei-mcp/wiki/Use-case-Building-a-local-guide-agent): a vague place to coordinates and back, and what OpenStreetMap's licence asks of you.

How well it answers, measured: [test rounds](https://github.com/mavrovde/viafrei-mcp/wiki/Test-rounds) of up to nearly 3,000 questions in German and English against production, with every finding published.

## 🛠️ For developers

**It's plain MCP over HTTP.** You can call it without an SDK:

```bash
# 1. open a session
curl -si https://mcp.viafrei.de/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"me","version":"0"}}}' \
  | grep -i mcp-session-id

# 1b. tell the server you are ready — the MCP lifecycle requires it before any request
curl -s https://mcp.viafrei.de/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -H 'mcp-session-id: <from step 1>' -H 'mcp-protocol-version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# 2. ask a question (put the session id from step 1 in the header)
curl -s https://mcp.viafrei.de/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -H 'mcp-session-id: <from step 1>' -H 'mcp-protocol-version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"check_weather_warnings","arguments":{"place":"Freiburg im Breisgau","language":"en"}}}'
```

- **One endpoint instead of a stack of integrations.** [SOURCES.md](SOURCES.md)
  lists the more than 140 sources behind it, among them Autobahn GmbH, Deutsche
  Bahn, DWD, DELFI, VBB, the national access point Mobilithek, MobiData BW, the
  Bundesnetzagentur, dozens of charge-point operators, H2 Mobility, city open-data portals, BKG, GeoNames, OpenStreetMap and
  MTS-K. Each has its own format, release rhythm and licence, and they arrive
  here as one protocol.
- **Results are written to be read aloud.** A tool answers in sentences an
  assistant can pass on, says what it does not know ("no status data means
  unknown, not free"), and ends with the source line.
- **Annotated honestly.** Twenty of the twenty-two tools are read-only and
  idempotent (`readOnlyHint`, `idempotentHint`), so a client can call them
  without a confirmation prompt. The two watch tools are not, because opening
  or stopping a watch changes what the server will tell you later, and their
  annotations say so.
- **Prompts and resources, not only tools.** Nine ready-made briefings, and a
  reference shelf (driving rules, emission zones, emergency numbers,
  attribution) your assistant can read directly.
- **Watches.** `watch_situation` turns polling into a notification for as long
  as the session lives: a road closure appearing or clearing, a stop's departures
  running late, a region's late share reaching a threshold (a quarter by
  default), a DWD warning coming into force, a charge point turning free. Three
  hours by default, 24 at most, and at most 10 per session. What a watch has
  reported is readable at `viafrei://watches` and `viafrei://watch/{id}`, and a
  client that subscribes to that resource is told when it reports something new.
  It reaches no inbox and no phone.
- **Machine-readable failures**, in the bridge too: one line on stderr and a
  distinct exit code per cause (see below).

### Bridge configuration

| option | what it does |
|---|---|
| `--url <url>` | endpoint to relay to. Default `https://mcp.viafrei.de/mcp`. See the note below |
| `--header "Name: value"` | extra HTTP header on every request, repeatable. For an API key, when there is one |
| `--timeout <ms>` | per-request timeout, default 30000. The event stream is never timed out |
| `--version`, `--help` | print and exit |

Many MCP clients can only pass an `env` block, not arguments, so every option
has an environment variable too:

| variable | same as |
|---|---|
| `VIAFREI_MCP_URL` | `--url` |
| `VIAFREI_MCP_HEADER` | `--header`. Separate several headers with a **newline**, which can never appear in a header name or value. That way nothing you might need to send is unrepresentable: a comma, a semicolon and a space all occur inside real header values |
| `VIAFREI_MCP_TIMEOUT_MS` | `--timeout` |

A flag wins over the variable, and the variable wins over the built-in default.
A `--header` of the same name replaces one from the variable; a `--header` of a
different name is added alongside it.

**There is no self-hosted ViaFrei.** The server is a hosted service. `--url` is
not a way to run your own: it exists for a proxy or gateway in front of the
service, and for the stub server this repository's test suite starts.

### When something is wrong

The bridge prints one line to stderr and exits with a code that says what
happened. No stack traces:

```
viafrei: cannot reach https://example.invalid/mcp: host not found (DNS) (ENOTFOUND) - check your network connection; --url only if you relay through a proxy
```

The same text also goes back to the client as a JSON-RPC error, so an assistant
can say what went wrong instead of going quiet.

| exit | meaning |
|---|---|
| `0` | clean shutdown (the client closed stdin, or sent SIGINT/SIGTERM) |
| `1` | something else went wrong; the line says what |
| `2` | bad usage: a flag or a value the bridge does not accept |
| `3` | the endpoint could not be reached, stopped answering, or never answered in time |
| `4` | the endpoint answered and the bridge cannot continue: it refused (the line names the HTTP status), forgot the session, answered with something that is not MCP, or redirected to another origin |
| `5` | protocol version mismatch; the line names the version the server speaks |

**A slow call may be a retried call.** A `429`, `502`, `503` or `504` is tried
again **once**, after the delay the server asked for in `Retry-After`, or 250 ms
when it asked for none. A connection that fails outright (reset, broken pipe,
socket or connect timeout) is tried once more after 250 ms. Two cases are not
retried, because waiting would be worse than answering: a `429` with no usable
`Retry-After`, and any requested delay longer than your timeout. An event stream
is never retried.

**Your timeout bounds each request, not the whole call.** Two attempts plus a
delay can add up to about **three times** the timeout, and more if the endpoint
redirects. If you need a hard ceiling, enforce it on your side.

An established session may wobble: a dropped event stream is a warning, and the
bridge reconnects. It may not stay dead in silence. Several failures in a row
with nothing succeeding in between end the process with the code above, so the
client that started it finds out.

### What the bridge does not do

- **No tracking.** No telemetry, no analytics, no usage counter, no update check.
- **No stored files or credentials.** It writes no file outside the OS temp
  directory. `--header` is passed through to the endpoint and is never persisted
  or logged.
- **No cross-origin redirects.** A redirect off the origin you pointed it at is
  refused with one line naming both ends, so a server cannot forward your API
  key somewhere you did not choose. Same-origin redirects are followed normally.

## 💼 For businesses

- **The licence work is done, and it travels with the answer.** Each result
  carries the attribution its sources require. Where a source attaches a
  condition, the result states it: share-alike is flagged, and the MTS-K purpose
  limit arrives as a sentence you are meant to show.
- **Built for answering people.** Live figures, sourced and dated, in the
  language of the question. Good for travel and mobility assistants,
  dispatchers' briefings, customer service and step-free station checks.
- **Read the business page:** [viafrei.de/en/business](https://viafrei.de/en/business).
  It covers six use cases and how to work with us.

## ⚖️ Using the data you get back

Every result carries an attribution line. **Show it to the person reading the
answer.** The full register is at the resource `viafrei://attribution`, and
**[SOURCES.md](SOURCES.md)** is the readable version: every publisher, what it
covers, its licence, and the exact line to reproduce.

Two constraints matter more than the rest, because getting them wrong is a
licence breach rather than a style problem:

- **MTS-K fuel prices are consumer information only.** Any other use is
  unlawful in any form, raw, reformatted or aggregated, and never for the fuel
  industry or its IT providers. On top of that we ask for no redistribution at
  all: answer the person who asked; do not build a product out of it. (This is
  also why this page shows no fuel price.)
- **DELFI's realtime and disruption feeds are Creative Commons
  Attribution-ShareAlike** (its static timetable and stop directory are CC BY 4.0,
  and so is VBB's Berlin-Brandenburg feed). Share-alike travels with anything you
  *derive* from it: recompute it, reshape it, rearrange it or build a delay table
  out of it, and that is Adapted Material you must license under BY-SA (art. 1(a)
  names material "translated, altered, arranged, transformed, or otherwise
  modified"). Merely **showing** it beside another source's data is an
  aggregation and puts no obligation on the other source. The realtime feeds'
  catalogue records name no licence version, so do not rely on one for a
  derivative; [SOURCES.md](SOURCES.md) has the detail, and also covers the two
  share-alike databases under the ODbL (OpenStreetMap and one lorry-park operator).

See also [NOTICE](NOTICE) and [LICENSE](LICENSE).

## 🗣️ Tell us when an answer is wrong

ViaFrei is live, free, and still growing. Some sources are thinner than they will
be, and a tool can be slow or wrong. **A tool that fails is something the server
sees. A tool that answers confidently with the wrong thing is not.** Use the
[*A tool answered badly, or not at all*](https://github.com/mavrovde/viafrei-mcp/issues/new?template=answer.yml)
issue template, saying what you asked and what came back. That report is the
one thing we cannot get any other way.

## The server itself

The MCP server is a **hosted service**, and its source is closed. It is not in
this repository and is not published. What is public is the part meant to be:
the tool names, descriptions, input schemas, result shapes and attribution
lines, which is everything a client reads from `tools/list`. We say this plainly
so nobody spends an evening looking for the server code.

## Contributing · Security · Licence

- **Contributing:** yes, please. See [CONTRIBUTING.md](https://github.com/mavrovde/viafrei-mcp/blob/main/CONTRIBUTING.md)
  and [CODE_OF_CONDUCT.md](https://github.com/mavrovde/viafrei-mcp/blob/main/CODE_OF_CONDUCT.md).
  The bridge is small and self-contained, which makes it a good place for a first patch.
- **Security:** never open a public issue for a key, a token or anything that
  looks like one. [SECURITY.md](https://github.com/mavrovde/viafrei-mcp/blob/main/SECURITY.md)
  has the private reporting path.
- **Licence:** [Apache-2.0](LICENSE) for this code. Data obtained through the
  server keeps its provider's licence; see [NOTICE](NOTICE).

<div align="center">

**[viafrei.de](https://viafrei.de/en)** — Deutsch · English · Русский · Български · Українська · Română · Türkçe

</div>
