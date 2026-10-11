<div align="center">

# ViaFrei

[![Smithery](https://img.shields.io/badge/Smithery-viafrei-ff5a1f)](https://smithery.ai/servers/viafrei/viafrei)
[![npm](https://img.shields.io/npm/v/viafrei)](https://www.npmjs.com/package/viafrei)
[![Glama](https://glama.ai/mcp/servers/mavrovde/viafrei-mcp/badge)](https://glama.ai/mcp/servers/mavrovde/viafrei-mcp)

### Germany's traffic, trains, charging and roads — in your AI assistant.

**Ask in plain words. Get the live answer, with its source.**

[![website](https://img.shields.io/badge/viafrei.de-live-0b5fff?logo=googlechrome&logoColor=white)](https://viafrei.de/en)
[![node](https://img.shields.io/node/v/viafrei?logo=node.js&logoColor=white)](https://nodejs.org)
[![licence](https://img.shields.io/npm/l/viafrei?color=blue)](LICENSE)
[![no API key](https://img.shields.io/badge/API%20key-none-brightgreen)](#-connect-in-one-minute)
[![MCP](https://img.shields.io/badge/MCP-Streamable%20HTTP-6f42c1)](https://modelcontextprotocol.io)

**[viafrei.de](https://viafrei.de/en)** · [Connect your assistant](https://viafrei.de/en/connect) · [For developers](https://viafrei.de/en/developers) · [For businesses](https://viafrei.de/en/business) · [All tools](#-everything-it-can-do) · [Sources](#where-the-data-comes-from) · [Test results](#-tested-in-public) · [API reference](API.md)

</div>

---

```
claude mcp add --transport http viafrei https://mcp.viafrei.de/mcp
```

**Free. No account, no API key, no sign-up.** One line, and your assistant can
tell you whether the A8 is closed tonight, which Hamburg car park still has
space, whether the 23:29 ICE to München is on time, where the nearest 150 kW
charger is, whether the road over the pass will be icy, and whether the lift at
your station works. It all comes from official German open data, live, and every
answer names its source.

<div align="center">

**80+ open-data sources** · **21 tools** · **motorways, trains and weather in all 16 Länder** · **German and English** · **tested in public on 2,995 questions**

</div>

> **Beta.** ViaFrei is being stabilised: sources are still being added, and
> answers and coverage can change. The answers are written by an AI assistant
> from our data, and AI can make mistakes, so check anything important (a
> closure, a departure, a price) against the source each answer names.

> **New in 1.9: city traffic.** Ask about a town and you get the jams around it,
> the police traffic reports of its Land and, in Berlin and Hamburg, the works on
> its streets. **Hamburg's city roadworks** are listed by district, street or
> bridge. **Baden-Württemberg** adds roadworks on Bundes- and Landesstraßen and its
> signed motorway detours. **Icy roads:** weather answers now carry the DWD
> road-surface forecast, from dry to black ice, with the road temperature.
> **Parking** adds live free spaces across Baden-Württemberg, Dortmund and
> Wuppertal. **Fuel** prices are fetched fresh the moment someone asks. **Watches**
> open by name ("tell me when a warning comes for Kiel"). English questions get
> English answers. Every source is listed in [SOURCES.md](SOURCES.md).

> **Coming in 2.0: a redesign around where you are.** Better place lookup first,
> then a viafrei.de home that shows everything we hold for your own place, a news
> section, and a public status page with a page per source. The address you
> connect to stays the same. [Read the announcement](https://github.com/mavrovde/viafrei-mcp/discussions/88).

---

## ✨ Why ViaFrei

- **One connection instead of a hundred integrations.** Autobahn GmbH, Deutsche
  Bahn, DELFI, the DWD, the Bundesnetzagentur, the national access point
  Mobilithek, MobiData BW, a dozen cities and the Länder police reporting offices
  all publish in their own formats, on their own schedules, under their own
  licences. ViaFrei reads them and gives your assistant one protocol.
- **Answers you can read aloud.** Every tool replies in plain sentences in the
  language you asked in, dated to the minute, with the platform, delay, free
  spaces or road temperature wherever the publisher gives them.
- **Honest about what it does not know.** "No status data" means unknown, never
  free. A car park that publishes no occupancy is not called full. A forecast is
  called a forecast. When a source did not answer, the answer says which one.
- **The licence work is done for you.** Each answer carries the credit line its
  sources require and any condition attached to them, such as share-alike or the
  fuel-price purpose limit.
- **Tested in public.** Before and during the beta we ask the production server
  thousands of real questions and publish what each round found. In the latest round, 2,995
  new questions in German and English, it picked the right tool **98.9 %** of the
  time and carried the credit line on **100 %** of answers with data, at a median
  of **413 ms** per call. [The results](#-tested-in-public) are below.

## 🧳 What you can ask

You don't need to know any tool names. Ask the way you'd ask a friend who
happens to have every German traffic feed open. German or English; the answer
comes back in the language you asked in.

| when you're… | ask |
|---|---|
| 🌅 **about to commute** | *Fahren Busse und Bahnen in Bayern gerade pünktlich?* · *When does the next train leave Hamburg Hbf?* · *Was fährt als Nächstes ab Marienplatz?* |
| 🚗 **about to drive** | *Gibt es Stau auf der A8?* · *Are there roadworks on the A7 next week?* · *Is the A1 closed anywhere?* |
| 🏙️ **driving into a city** | *Wie ist der Verkehr in Berlin gerade?* · *Which roadworks are there in Hamburg-Altona this week?* · *Is anything closed in Stuttgart tonight?* |
| 🚧 **stuck in traffic** | *How much time is the jam on the A3 between Frankfurt and Würzburg costing right now?* · *Ist der Elbtunnel auf der A7 heute Nacht gesperrt?* |
| ❄️ **watching the weather** | *Will the roads be icy near Garmisch tonight?* · *Gibt es eine Unwetterwarnung für Freiburg?* |
| 🅿️ **looking for a space** | *Where can I park in Hamburg right now?* · *Welches Parkhaus in Stuttgart hat noch Plätze frei?* · *Find lorry parking on the A9* |
| ⚡ **driving electric** | *Where is a 150 kW charger near Stuttgart?* · *Wo kann ich mit Typ 2 in Leipzig laden?* |
| ♿ **travelling step-free** | *Funktioniert der Aufzug am Bahnhof Köln Messe/Deutz?* · *Are the escalators at Hamburg Hbf working?* |
| 📍 **looking for a place** | *What is the address of the Elbphilharmonie in Hamburg?* · *Welche Apotheken gibt es in Fulda?* · *My satnav shows 50.1109, 8.6821 — what address is that?* |
| 🇩🇪 **new to German roads** | *Do I need an emission sticker for Stuttgart?* · *Is there a speed limit on the Autobahn?* |
| ⏳ **waiting for news** | *Tell me as soon as the closure on the A7 is lifted.* · *Sag mir Bescheid, wenn in Köln ein Viertel oder mehr der Bus- und Bahnfahrten verspätet ist.* · *Warn me when a severe-weather warning comes into force for Kiel.* |

**What the answers cover, honestly.** Live traffic is the motorways, plus the
jams and police traffic reports the Länder publish and the reports of some
cities (Berlin, Köln and Hannover among them). Closures and roadworks cover the
motorways, the federal and Land roads of Niedersachsen, Sachsen, Thüringen and
Baden-Württemberg, and the city streets of Berlin and Hamburg; other roads and
other cities' streets are not covered yet. Places and addresses come from OpenStreetMap, so
what is not mapped there cannot be found, and opening hours and ratings are not
part of it. A **watch** lives in the conversation that opened it: the server
keeps every change there, and your assistant shows it when you ask, or on its own
if your client supports MCP notifications. Nothing is sent by e-mail or SMS. Up
to 10 watches per conversation, each for up to 24 hours (3 by default), and a
road is watched as a whole, not one section of it.

## 💬 Real answers

These came back from the production server at `https://mcp.viafrei.de/mcp`
(server **1.9.17**) on **Sunday 2026-10-11, between 23:23 and 23:31 Berlin
time**. They are not mock-ups. Each one shows the first lines of what the tool
returned and the source line as it was sent, shortened where marked. Ids that
are only useful for the next tool call were removed.

<details open>
<summary><b>🏙️ "Wie ist der Verkehr in Berlin gerade?"</b> — <code>check_road_status</code></summary>

```text
Berlin: 1 Staumeldung, 19 Sperrungen, 477 Einschränkungen, 16 geplante Arbeitsstellen — Zeitraum bis 14.10.2026.
• Stockender Verkehr: A100 Stadtring Berlin, Wilmersdorf Richtung Neukölln, zwischen Gradestraße und Tunnel Ortsteil Britz, 0,8 km stockender Verkehr (seit 16:41; 6,6 km entfernt)
• Baustelle: Rosenthaler Straße (Mitte) — in beiden Richtungen zwischen Hackescher Markt und Sophienstraße Gleisbauarbeiten, Vollsperrung für Kfz-Verkehr (18.09.2026–20.10.2026)
• Baustelle: Leipziger Straße (Mitte) — in beiden Richtungen zwischen Charlottenstraße und Friedrichstraße Kraneinsatz, Fahrbahn auf einen Fahrstreifen je Richtung verengt… (12.10.2026–15.10.2026)
…
Geantwortet haben: Autobahn GmbH, BASt (Arbeitsstellen), VIZ.NRW / NMS, Senatsverwaltung Berlin (Verkehrsmeldungen).
…
Stand 23:15 · Quelle: Verkehrsdaten: Autobahn GmbH des Bundes (https://verkehr.autobahn.de) · Arbeitsstellen: Bundesanstalt für Straßen- und Verkehrswesen (BASt) via Mobilithek, CC BY 4.0, bearbeitet (…) · …
```
The motorway jam and the city's own street works in one answer, and the list of
sources that answered.
*Edited: seven of ten entries and the notes after the list omitted, a municipality key removed from the heading, and the sources cut to `…`.*
</details>

<details>
<summary><b>🛣️ "Is the A8 closed anywhere?"</b> — <code>check_autobahn_traffic</code></summary>

```text
A8: 0 jams/incidents, 7 closures, 63 roadworks sites; announced from 2026-10-12 00:00: 8 closures, 58 roadworks sites — As of 23:20.
• Closure (Sperrung): A8, since 00:00, reported as 4 sections — Provider text (German): "A8 Vollsperrung AS Flughafen-Messe FR München - Sanierung Rampen — Die Baustelle ist zu folgenden Zeiträumen gültig: 11.10.26 00:00 bis zum 12.10.26 05:00 Uhr. …"
• Closure (Sperrung): A8, since 2026-09-21 08:00 — Provider text (German): "A8 Ost Sickerschacht bei Piding und Kabelhaus Bad Reichenhall · AS Bad Reichenhall (aus Richtung Bad Reichenhall) nach A8 — Zeitraum dieser Bauphase: […] Ende: 19.10.26 um 08:00 Uhr …"
…
As of 23:20 · Source: Verkehrsdaten: Autobahn GmbH des Bundes (https://verkehr.autobahn.de)
```
Asked in English, answered in English. The provider's own wording is quoted in
German and labelled as such, so nothing is lost in translation.
*Edited: five of seven closures and all roadworks omitted; the two closures shown are the fourth and sixth of the list.*
</details>

<details>
<summary><b>🚧 "Welche Baustellen gibt es diese Woche in Hamburg?"</b> — <code>find_roadworks_ahead</code></summary>

```text
Hamburg: 18 Stadtbaustellen zwischen 11.10.2026 und 18.10.2026 im Umkreis von 3 km. Weitere 8 nicht abgerufen — limit erhöhen.
• Steinstraße, Speersort / Straßenumbau — Autoverkehr: Die Steinstraße bleibt bis auf die Vollsperrung (voraussichtlich im Frühjahr 2027) durchgehend a… (laufend, 31.08.2026–31.05.2028; 0,6 km)
• Reimarusstraße, Karpfangerstraße  / Sanierung Asphaltdecke (Deckschicht) — Für die oben genannten Arbeiten wird die Reimarusstraße im Abschnitt zwischen Eichholz und Karpfangerstraße v… (laufend, 05.10.2026–19.10.2026; 1,3 km)
• Hamburger Berg, Seilerstraße / Erneuerung der Asphaltdecke — … (laufend, 05.10.2026–16.10.2026; 2,1 km)
…
Stand 23:09, unverändert seit 16:42 · Quelle: Baustellen (Bauweiser): Freie und Hansestadt Hamburg, Behörde für Verkehr und Mobilitätswende, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet (…) · …
```
Hamburg's city roadworks, the ones the city itself has released, nearest first.
*Edited: seven of ten entries omitted, one description shortened, and the source line cut to `…`.*
</details>

<details>
<summary><b>🅿️ "Where can I park in Hamburg right now?"</b> — <code>find_parking</code></summary>

```text
Parking around Hamburg (within 10 km), nearest first:
1. Alter Wall / BUCERIUS-Passage — Car park (Parkhaus), 0.1 km, 210 spaces, 90 free (as of 23:22)
2. Alsterhaus — Car park (Parkhaus), 0.2 km, 87 spaces, 83 free (as of 23:22)
3. Große Reichenstraße — Car park (Parkhaus), 0.3 km, 850 spaces, 488 free (as of 23:22)
4. Hanse-Viertel — Car park (Parkhaus), 0.5 km, 421 spaces, 361 free (as of 23:22)
73 further site(s) are not listed because they publish no occupancy — not because they are full.
Free spaces of the Hamburg car parks: the publisher states „Diese Echtzeitdaten sind ungeprüft.“ — these real-time figures are unverified.

As of 23:22 · Source: Parkhäuser: Freie und Hansestadt Hamburg, Behörde für Verkehr und Mobilitätswende, Datenlizenz Deutschland – Namensnennung – Version 2.0 (…), Daten geändert (bearbeitet) (…) · …
```
Free spaces now, each reading dated, and the publisher's own caveat passed on.
The same question about Stuttgart answers from MobiData BW: *Schillerplatz — Parkhaus, 0,2 km, 136 Plätze, 121 frei (Stand 23:24)*.
*Edited: one line and the closing note omitted, and the sources cut to `…`.*
</details>

<details>
<summary><b>⚡ "Where is a 150 kW charger near Stuttgart?"</b> — <code>find_charging_station</code></summary>

```text
Charging around Stuttgart (within 10 km, ≥ 150 kW), nearest first:
1. Rotebühlstr. 30, 70178 Stuttgart (ENBW) — 0.7 km, CCS2, up to 300 kW, 0.79 €/kWh, status from 01:05 — possibly out of date, 11 without status
2. Keplerstraße 7, 70174 Stuttgart (ENBW) — 0.7 km, CCS2, up to 300 kW, 0.79 €/kWh, no status data
3. Schloßstr 112 / LADE / DC, 70176 Stuttgart (Stadtwerke Stuttgart GmbH) — 1.4 km, CCS2, up to 200 kW, out of order (as of 23:23)
…
Only a few operators publish live occupancy; "no status data" means unknown, not free.
Price per kWh: published for 3 of 5 only; for the others we hold no price.
…
As of 23:23 · Source: Ladepunkte: EnBW AG via Mobilithek, CC BY 4.0, bearbeitet (…) · … · Ladesäulenregister: Bundesnetzagentur.de, CC BY 4.0, bearbeitet (…) · …
```
Operator, connector, power and price per kWh. A charger that is out of order says
so before you drive there, and a status that may be stale is flagged as stale.
*Edited: entries 4–5, the site ids for watches and the register note omitted, a municipality key removed from the heading, and the sources cut to `…`.*
</details>

<details>
<summary><b>❄️ "Will the roads be icy near Garmisch tonight?"</b> — <code>check_weather_warnings</code></summary>

```text
No official DWD weather warning is currently in force for Garmisch-Partenkirchen (checked for now and the next 24 hours). That is not an all-clear for the rest of the route: warnings are issued per area and can be published at short notice.

DWD road-surface forecast for the nearest road-weather stations (SWSMOS/METRo model forecast, run 22:00 — not a measurement and not an official warning):
- Station Farchant-Tunnel (open road, 5.3 km) — forecast 23:00: dry (Trocken), road surface 11.2 °C; no slippery class forecast until 2026-10-12 23:30.
- Station Griesen (open road, 10.8 km) — forecast 23:00: dry (Trocken), road surface 10.7 °C; no slippery class forecast until 2026-10-12 23:30.
…
As of 23:30 · Datenbasis: Deutscher Wetterdienst, zusammengefasst (…) · Quelle: Deutscher Wetterdienst. Datenquelle: BMVBS und Straßenbauverwaltungen der Länder (…) · …
The road-weather station data are unverified point measurements and do not reflect conditions on a road section; …
```
New in 1.9: the official warnings and the forecast for the DWD's road-weather
stations in one answer, each labelled for what it is.
*Edited: a warn-cell id, a municipality key and one station omitted, and the sources cut to `…`.*
</details>

<details>
<summary><b>🚆 "When does the next train leave Berlin Hbf?"</b> — <code>get_train_departures</code></summary>

```text
Departures from Berlin Hauptbahnhof (next 60 minutes):
23:24 RE RE3 → Eberswalde Hbf, from Berlin Hbf, platform 6, on time
23:26 S S3 → Erkner (S), from Berlin Hbf (S-Bahn), platform 15, on time
23:28 ICE 945 → Berlin Südkreuz, from Berlin Hbf, platform 1, on time
23:29 ICE 905 → München Hbf, from Berlin Hbf, platform 2, on time
23:36 S S9 → Flughafen BER (S-Bahn), from Berlin Hbf (S-Bahn), platform 15, on time
… and 24 more until 2026-10-12 00:23 — the board shows the first 10; raise limit up to 15 for more, or set when to a later time.

As of 23:23 · Source: Fahrplandaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet (…) · …
```
Platform and punctuality, one line each; a late train shows its delay.
*Edited: five of ten departures omitted, and the sources cut to `…`.*
</details>

<details>
<summary><b>🚋 "Was fährt als Nächstes ab Marienplatz?"</b> — <code>get_departures</code></summary>

```text
Abfahrten ab Marienplatz — Plandaten, 23:23 bis 12.10. 00:23:
23:24 S2 → Petershausen
23:24 U3 → Sendlinger Tor, Gleis 52
23:27 Bus 132 → Forstenrieder Park, Steig 4
23:27 Tram 19 → Berg am Laim Bf. S, Gleis 2, ab Marienplatz (Theatinerstraße)
23:27 S6 → Tutzing
… und 61 weitere im Fenster.

Stand 23:23 · Quelle: Fahrplandaten: DELFI e.V., CC BY 4.0, bearbeitet (…) · …
Plandaten ohne Echtzeit: Verspätungen, Ausfälle und Gleiswechsel sind hier nicht enthalten. …
```
Any stop in Germany, every mode: S-Bahn, U-Bahn, tram and bus on one board. It
says plainly that this board is the timetable, not realtime.
*Edited: five of ten departures and the stop ids for watches omitted, and the sources cut to `…`.*
</details>

<details>
<summary><b>🚦 "Fahren Busse und Bahnen in Bayern gerade pünktlich?"</b> — <code>check_transit_disruption</code></summary>

```text
Bayern: 4 % der beobachteten Fahrten mehr als 5 Minuten zu spät (108 von 2.424 Fahrten in den letzten 60 Minuten, gestützt auf 16.869 Meldungen an 5.958 Haltestellen); außerdem 19 Fahrten mit mindestens einem ausgefallenen Halt.
…
Trend: etwa wie in den 60 Minuten davor (5 %).
…
Stand 23:20 · Quelle: Echtzeitdaten: DELFI e.V. via Mobilithek, CC BY-SA, bearbeitet (…) · …
Diese Angaben stehen unter CC BY-SA / CC BY-SA 4.0 (Share-alike), so lizenziert sie die Quelle; …
```
A whole Land's punctuality in one figure, with the method stated and the trend
beside it. The share-alike condition arrives as part of the answer, because it is
part of the data.
*Edited: the method paragraphs and the service-alert block omitted, and the sources cut to `…`.*
</details>

<details>
<summary><b>♿ "Are the escalators at Hamburg Hbf working?"</b> — <code>check_station_facilities</code></summary>

```text
8 of 28 reported facilities at Hamburg Hbf are out of service. DB reports no status for 1 facility. Counted are the facilities DB reports for this station.
Escalator Gleis 3/4 (S-Bahn) - Südsteg: out of service
Escalator von Gleis 5/6 zu Wandelhalle: out of service — under construction
Escalator von Gleis 13/14 zu Südsteg: status unknown — monitoring disrupted
Lift DB Lounge: in service
…
As of 23:23 · Source: Aufzüge und Fahrtreppen: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet (…) · …
```
For anyone with a wheelchair, a pram or a heavy suitcase, this is the difference
between a station being usable and not. Where a Köln station has a Stadtbahn stop
below it, the KVB's own lift list is in the same answer.
*Edited: most facilities omitted, a unit number removed, and the sources cut to `…`.*
</details>

Two more from an earlier capture, server **1.8.18** on **2026-10-06, 23:00 Berlin time**:

<details>
<summary><b>⚡ "Where can I charge with Type 2 near Leipzig?"</b> — <code>find_charging_station</code></summary>

```text
Charging around Leipzig (within 10 km, Type 2), nearest first:
1. Parkhaus Neumarkt, Neumarkt 30, 04109 Leipzig (Parkhaus Neumarkt) — 0.2 km, Type 2, up to 22 kW, no status data, per charging point register
2. Motel One Leipzig Nikolaikirche, Schuhmachergäßchen 5, 04109 Leipzig (Wirelane GmbH) — 0.3 km, Type 2, up to 11 kW, no status data, per charging point register
…
Only a few operators publish live occupancy; "no status data" means unknown, not free.
Charging point register as of 2026-09-01 — chargers as reported by their operators to the Bundesnetzagentur, with no live occupancy and no warranty of accuracy or completeness.

As of 23:00 · Source: Ladesäulenregister: Bundesnetzagentur.de, CC BY 4.0, bearbeitet (…) · …
```
It says what it does not know: "no status data" is unknown, never free.
*Edited: entries 3–5 omitted, a municipality key removed from the heading, and the sources cut to `…`.*
</details>

<details>
<summary><b>📍 "What is at 52.5163, 13.3777?"</b> — <code>describe_location</code></summary>

```text
Description of 52.5163, 13.3777:
- Nearest address: Pariser Platz 1, 10117 Berlin (3 m)
- Settlement: Unter den Linden (0.7 km)
- District: Berlin (1.9 km)
- Administrative area: Berlin (2.3 km)
- Junction: AS Sachsendamm (A100) (5.0 km)

Address data as of 2026-10-04
As of 23:00 · Source: Ortsdaten: © GeoNames (CC BY 4.0), bearbeitet (…) · … · OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0 (https://www.openstreetmap.org/copyright; …)
```
That's the Brandenburg Gate. *Edited: two of four sources cut to `…`.*
</details>

**Why the source line matters.** Every answer ends with one, and it is the
licence speaking: show it to whoever reads the answer. Copy the line the server
sends you, not the ones on this page, which are shortened. See
[Using the data you get back](#using-the-data-you-get-back).

<a id="where-the-data-comes-from"></a>
## 🗂️ Where the data comes from

**100 sources in the register: 98 official or openly licensed datasets, plus
our own rules compilation and watch service, and every one credited in the
answer it helped with.** In the latest test round, **66** of them answered at
least one question. **21** more are loaded but no question in that round needed
them, and **13** have their licence read and their data not loaded yet.
[SOURCES.md](SOURCES.md) lists all 100 with the exact credit line, the licence,
and how often each one answered.

| | domain | who publishes it | licences |
|---|---|---|---|
| 🛣️ | **Motorways** | Autobahn GmbH des Bundes (traffic, closures, roadworks, lorry parks); BASt (roadworks) | open data, CC BY 4.0 |
| 🏙️ | **Land roads and cities** | the road authorities of Niedersachsen, Sachsen, Thüringen and Baden-Württemberg; the Länder police reporting offices via VIZ.NRW; traffic reports from Baden-Württemberg, Schleswig-Holstein, Berlin, Köln and Hannover; Hamburg's city roadworks and traffic-camera locations; Baden-Württemberg's signed detours | dl-de/zero, dl-de/by, CC BY 4.0, GeoNutzV |
| 🚆 | **Trains and public transport** | Deutsche Bahn (timetables, stations); DELFI (the national timetable, realtime, service alerts, stop directory); VBB (Berlin-Brandenburg realtime) | CC BY 4.0, **CC BY-SA** |
| ♿ | **Station lifts and escalators** | Deutsche Bahn and DB InfraGO (FaSta, OpenStation); Kölner Verkehrs-Betriebe | CC BY 4.0, CC0, dl-de/zero |
| ⚡ | **EV charging** | the Bundesnetzagentur's charging register; charge points and live status from EnBW, Tesla, Volkswagen, Eco-Movement and e-clearing.net via Mobilithek; chargecloud and Taubert via MobiData BW | CC BY 4.0, CC0, dl-de/by |
| ⛽ | **Fuel** | Tankerkönig, from the Bundeskartellamt's MTS-K | CC BY 4.0, **consumer information only** |
| 🅿️ | **Parking** | motorway lorry parks (BMV, Bosch, Christophorus, Trucklounge); car parks and P+R in Hamburg, Köln, NRW, Münster, Dortmund and Wuppertal; 15 publishers across Baden-Württemberg via MobiData BW | GeoNutzV, CC BY 4.0, dl-de, **ODbL**, **CC BY-SA** |
| 🌦️ | **Weather** | Deutscher Wetterdienst (official warnings, road-surface forecast) | CC BY 4.0 |
| 📍 | **Places and addresses** | BKG (administrative areas); GeoNames; OpenStreetMap (addresses, points of interest) | dl-de/by, CC BY 4.0, **ODbL** |
| 🚲 | **Shared bikes** | nextbike, Donkey Republic | CC0 |
| 📘 | **Driving rules** | our own compilation from the StVO, StVZO, the emission-zone rules and AFIR, every statement sourced and dated | informational, not legal advice |

Licences in **bold** put a condition on you, not only a credit line. See
[Using the data you get back](#using-the-data-you-get-back).

## 📊 Tested in public

We ask the **production** server large batches of real questions, the way
people ask an assistant, and read every answer. Every round, and the cause of
every server finding, is published in the [wiki](https://github.com/mavrovde/viafrei-mcp/wiki/Test-rounds).

| round | server | questions | right tool | correct and complete answer | credit line | median per call |
|---|---|---:|---:|---:|---:|---:|
| [2026-09-21](https://github.com/mavrovde/viafrei-mcp/wiki/Test-round-2026-09-21-v0.1.1) | 0.1.1 | 1,266 | – | – | 94.0 % | 149 ms |
| [2026-10-04](https://github.com/mavrovde/viafrei-mcp/wiki/Test-round-2026-10-04-v1.7.0) | 1.7.0 | 3,000 | 99.9 % | – | 99.2 % | 332 ms |
| [2026-10-06](https://github.com/mavrovde/viafrei-mcp/wiki/Test-round-2026-10-06-v1.8.17) | 1.8.17 | 1,000 | 99.1 % | 73.9 % | 99.9 % | 394 ms |
| [2026-10-07](https://github.com/mavrovde/viafrei-mcp/wiki/Test-round-2026-10-07-v1.8.29) | 1.8.29 | the same 1,000 | 99.6 % | 91.6 % | 100 % | 455 ms |
| [2026-10-09](https://github.com/mavrovde/viafrei-mcp/wiki/Test-round-2026-10-09-v1.9.6) | 1.9.6 | 300 of them | 99.7 % | 96.1 % | 100 % | 529 ms |
| [2026-10-11](https://github.com/mavrovde/viafrei-mcp/wiki/Test-round-2026-10-11-v1.9.13) | 1.9.13 | 300 | 99.0 % | 99.6 % | 100 % | 447 ms |
| [**2026-10-11**](https://github.com/mavrovde/viafrei-mcp/wiki/Test-round-2026-10-11-v1.9.17) | **1.9.17** | **2,995 new** | **98.9 %** | **94.8 %** | **100 %** | **413 ms** |

- **The latest round was built to be hard.** It asked 2,995 new questions over
  every tool except fuel and shared bikes, and over all 16 Länder, half in
  German and half in English, full of the
  cases that break place lookup: typos, missing umlauts, villages, landmarks,
  street addresses and border points. One model asked and a different model
  graded. Its 94.8 % does not compare with 1.9.13's 99.6 %, which re-asked
  questions already known.
- **The live data is strong.** Motorway traffic, weather, station lifts, driving
  rules, chargers and trains answered correctly in 97–100 % of their questions.
- **The weak spot is free text.** The largest causes are points of interest
  asked by kind ("a vet near me"), house numbers OpenStreetMap does not hold, and
  landmarks with a namesake elsewhere. Every cause is published, and each is
  planned for 2.0.
- **No server error and no crash** in any round. In the latest round 95 % of
  calls answered within 1.77 s.

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
  release, after the live server is seen to report the new version.
- **For AI tools — [viafrei.de/llms.txt](https://viafrei.de/llms.txt)** and
  [llms-full.txt](https://viafrei.de/llms-full.txt): what ViaFrei is, how to
  connect, and every tool in one line each.

## 🧰 Everything it can do

<!-- catalogue:begin — generated by scripts/gen-readme-catalogue.mjs from catalogue.json; do not edit by hand -->

**21 tools, 9 prompts, 10 resources and 2 resource templates** — server 1.9.17, snapshot of 2026-10-11. Each line is the server's own words; the full parameters are in [API.md](API.md).

#### 🚗 On the road

| tool | what it answers |
|---|---|
| [`check_autobahn_traffic`](API.md#check_autobahn_traffic--autobahn-traffic) — Autobahn traffic | Jams, slow traffic, closures and roadworks in force this minute on up to 5 motorways, with delay/speed. |
| [`check_road_status`](API.md#check_road_status--road-status-and-closures) — Road status and closures | Whether a motorway, B road or Land road (NI, SN, TH, BW: pass the Land/town as place) is open, closed, restricted, now or coming days; by place, jams and city/Land messages. |
| [`find_roadworks_ahead`](API.md#find_roadworks_ahead--planned-roadworks) — Planned roadworks | Returns roadworks PLANNED on one motorway, one Bundes-/Landesstraße in NI, SN, TH or BW, or Hamburg city streets by place, in a date window: section, restriction, dates. |
| [`find_parking`](API.md#find_parking--parking-nearby) — Parking nearby | Returns parking near a place, a coordinate or along one motorway: motorway lorry parks, car parks and P+R sites, with total spaces and, where published, free spaces now and the reading's age. |

#### 🚆 Public transport

| tool | what it answers |
|---|---|
| [`get_train_departures`](API.md#get_train_departures--train-departures) — Train departures | Next trains from a German railway station: platform, delay, cancellations. |
| [`get_departures`](API.md#get_departures--scheduled-departures-bus-tram-train) — Scheduled departures (bus, tram, train) | Scheduled departures from any German stop — bus, tram, U-Bahn, S-Bahn, train, ferry — with line, destination, platform. |
| [`check_transit_disruption`](API.md#check_transit_disruption--public-transport-disruption-in-a-region) — Public-transport disruption in a region | How punctual public transport is now in one German region: the share of trips ever over 5 min late, trips with a cancelled stop, the trend, and the service alerts in force there (diversions, closed stops). |
| [`check_station_facilities`](API.md#check_station_facilities--station-lifts-and-escalators) — Station lifts and escalators | Report whether the lifts and escalators of a German railway station — or of a Köln Stadtbahn stop — are working now: each one, where it is, its state (in service / out of service / unknown) and the operator's explanation. |

#### ⚡ Charging and fuel

| tool | what it answers |
|---|---|
| [`find_charging_station`](API.md#find_charging_station--ev-charging-nearby) — EV charging nearby | Returns EV charging sites near a place or coordinate with operator, connector types, maximum power, price per kWh where published, and how many points are free right now where the operator publishes live status. |
| [`find_cheapest_fuel`](API.md#find_cheapest_fuel--cheapest-fuel-nearby) — Cheapest fuel nearby | Returns the cheapest stations for one fuel grade near a place or coordinate: price per litre, brand, address, distance, open state. |
| [`find_fuel_station`](API.md#find_fuel_station--find-a-filling-station) — Find a filling station | Finds filling stations around a place or coordinate under any combination of filters — grade, brand, name, open now, open at a time you name, open 24 h — sorted by distance, price or name. |

#### 📍 Places and addresses

| tool | what it answers |
|---|---|
| [`find_place`](API.md#find_place--look-up-a-place) — Look up a place | Looks up a place name and returns every place that matches, each with its kind, official key (AGS/RS), population, English name and coordinate. |
| [`find_poi`](API.md#find_poi--find-a-named-place) — Find a named place | Finds a named business or landmark — company, shop, clinic, hotel — and returns its address, category and coordinate. |
| [`find_address`](API.md#find_address--look-up-a-street-address) — Look up a street address | Looks up a street address and returns its coordinate, plus what OpenStreetMap holds under it. |
| [`describe_location`](API.md#describe_location--describe-a-coordinate) — Describe a coordinate | Turns a coordinate into words: the nearest address, settlement, Kreis, administrative area and motorway junction, each with its own distance. |
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
| [`watch_situation`](API.md#watch_situation--watch-for-a-change) — Watch for a change | Opens a watch so THIS conversation is told when something changes: a road reopening, a stop running late, a weather warning starting, a charge point turning free. |
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
| `explain_this_coordinate` — Say where a coordinate is — Sagen, wo eine Koordinate liegt | Turns a bare lat/lon into a sentence a traveller understands: the nearest address, settlement, Kreis, administrative area and motorway junction, each with its own distance. |

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

How well it answers, measured: [Tested in public](#-tested-in-public) above, and every round in full in the [wiki](https://github.com/mavrovde/viafrei-mcp/wiki/Test-rounds).

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
  lists the 100 sources behind it, among them Autobahn GmbH, Deutsche Bahn, DWD,
  DELFI, the national access point Mobilithek, MobiData BW, BKG, GeoNames,
  OpenStreetMap and MTS-K. They come in GTFS, GTFS-RT, DATEX II, SIRI, NeTEx,
  GBFS and a dozen home-grown formats, each with its own release rhythm and
  licence, and they arrive here as one protocol.
- **Results are written to be read aloud.** A tool answers in sentences an
  assistant can pass on, says what it does not know ("no status data means
  unknown, not free"), and ends with the source line.
- **Annotated honestly.** Nineteen of the twenty-one tools are read-only and
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
  dispatchers' briefings, fleet and logistics, customer service and step-free
  station checks.
- **Germany in one place.** Motorways, Land roads and city streets, trains and
  every bus and tram stop, chargers, car parks and lorry parks, weather and road
  ice, across all 16 Länder, from 100 official and open sources that you would
  otherwise contract, parse and keep alive one by one.
- **Quality you can check.** Every test round against production is published
  with its findings, so you can judge the answers before you build on them.
- **Read the business page:** [viafrei.de/en/business](https://viafrei.de/en/business).
  It covers six use cases and how to work with us.

<a id="using-the-data-you-get-back"></a>
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
