<div align="center">

# ViaFrei

[![Smithery](https://img.shields.io/badge/Smithery-viafrei-ff5a1f)](https://smithery.ai/servers/viafrei/viafrei)
[![npm](https://img.shields.io/npm/v/viafrei)](https://www.npmjs.com/package/viafrei)
[![Glama](https://glama.ai/mcp/servers/mavrovde/viafrei-mcp/badges/score.svg)](https://glama.ai/mcp/servers/mavrovde/viafrei-mcp)
[![ViaFrei MCP connector](https://glama.ai/mcp/connectors/de.viafrei.mcp/via-frei/badges/score.svg)](https://glama.ai/mcp/connectors/de.viafrei.mcp/via-frei)
[![Listed on mcpservers.org](https://mcpservers.org/badge.svg)](https://mcpservers.org/servers/mavrovde/viafrei-mcp)

### The German Real-Time Mobility Context Platform for AI

**ViaFrei gives AI assistants real-time awareness of Germany.** Trains and buses,
traffic and roadworks, fuel, charging, parking and weather. One MCP. No API key. No sign-up.

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
on viafrei.de, with a map and a traffic light.

> **Beta.** ViaFrei is being stabilised: sources are still being added, and
> answers and coverage can change. The answers are written by an AI assistant
> from our data, and AI can make mistakes, so check anything important (a
> closure, a departure, a price) against the source each answer names.

> **New in the 2.5 line (server 2.5.0): bug fixes only.** No tool, prompt or
> resource was added, removed or renamed.
>
> - **A sectioned track is that track.** Hamburg Hbf's "7A-D" is Gleis 7 in
>   `get_train_departures` (`"place": "track"`) and on the station board, where it
>   used to fall through as plain text ([example](#-real-answers)).
> - **A departure keeps its own destination and delay.** It no longer takes another
>   departure's destination or delay, and a town's station stays apart from a
>   district of it.
> - **Translated maps speak their own language**: a mark's name is the row's own
>   name, never a German label, and the position on a motorway page's "around you"
>   map can be tapped.
> - **The header of a translated page keeps a place's name untranslated**, and the
>   connect pages in Russian, Ukrainian, Bulgarian and Serbian no longer leave the
>   word "ID" in English.
> - **Pages without a script keep their styles.**
>
> **Before that, since server 2.4.3 (server 2.4.4 to 2.4.9): live times for buses, trams and
> the U-Bahn in fourteen more regions, a traffic light and a street map for every
> place, a site search that finds a shop or a house number, and station pages that
> load in place.**
>
> - **Live departures in fourteen more regions.** DELFI's fourteen regional SIRI ET
>   feeds (Berlin-Brandenburg, Bayern, Hessen, Rhein-Ruhr, Baden-Württemberg,
>   Bremen/Niedersachsen/Hamburg/Rostock-VVW, Oberelbe, Rhein-Neckar-Dreieck, Rhein-Sieg,
>   Sachsen-Anhalt, Mecklenburg-Vorpommern, Schleswig-Holstein, Saarland and
>   Mittelthüringen) now give `get_departures` and the departure cards on
>   viafrei.de a live figure for buses, trams and the U-Bahn as well as trains, and
>   VBN's Connect timetable and realtime answer in Niedersachsen and Bremen. One figure per
>   departure, the one that agrees with where the departure is going, and every
>   feed that carried it credited ([example](#-real-answers)).
> - **Traffic strategies.** Lower Saxony's traffic strategies (DVL-NI, since 2.4.4)
>   and the Autobahn GmbH's strategic routes for Bayern (shown since 2.4.7) join its
>   national strategic routing in `check_autobahn_traffic`, `check_road_status` and
>   on the road card, each called what its publisher calls it: a guidance to the
>   trade-fair car parks is never said as a detour.
> - **Road entries name their junctions in the direction of travel**, and a lorry
>   park whose publisher gives a placeholder for a name is not given that as its
>   name.
> - **A traffic light and a map for every place** on viafrei.de: the motorway
>   page's rule applied to the place's own cards, every reason linked to its row and
>   drawn on a map of the place, one light per place. The map marks parking,
>   charging, stations and the weather ring by kind, and each mark links to its row.
> - **Streets on the maps.** The place, station and motorway maps draw
>   OpenStreetMap's streets as thin lines under their marks, with the line
>   "Streets: © OpenStreetMap contributors, ODbL 1.0" and our offer of the street
>   database beside it ([SOURCES.md](SOURCES.md#and-the-streets-on-viafreides-maps)).
> - **A search that finds what you type.** The place search on viafrei.de finds
>   districts, postcodes, streets, a street and house number typed without a town
>   ("Wilhelmshöher Allee 100") and points of interest by name. An address you pick
>   heads the page with the address, never with a shop at its door, and a point of
>   interest you pick is the place, under its own name.
> - **Station pages for every railway station**, 6,513 of them, including those
>   DB's directory does not list, with filters for the board (mode, departures or
>   arrivals, platform, destination, time, disruptions, step-free), every lift and
>   escalator listed, the place cards and the place traffic light for the
>   station's surroundings, and a home-page block of the stations most affected now.
>   A slow part of a station page loads in place; the page itself never fails for it.
> - **Police and Land traffic messages in your language** on viafrei.de's
>   translated pages, machine-translated on our own server and labelled as ours,
>   with the German original beside them. Baden-Württemberg's messages stay German
>   only, because its terms bind them to the traffic-warning service's rules.
> - **Your language, once.** A visitor who arrives on a German page is sent to the
>   same page in their browser's language, and a choice in the language menu ends
>   the switching for good. The [connect page](https://viafrei.de/en/connect) gives
>   every assistant its steps, links its official guide and says how each was
>   checked.
>
> No tool, prompt or resource was added, removed or renamed since 2.4.3. The 2.4.0
> to 2.4.3 releases brought the five-question `entry` on every road item, charging
> by operator and power band, truck-parking occupancy behind the user's acceptance,
> and the [station and exit pages](#-station-and-exit-pages); the
> [CHANGELOG](CHANGELOG.md) has the whole list. Every source is listed, with what it
> feeds and what we hold back, in [SOURCES.md](SOURCES.md).

---

## 🧳 What you can ask

You don't need to know any tool names. Ask the way you'd ask a friend who
happens to have every German traffic feed open. German or English; the answer
comes back in the language you asked in.

| when you're… | ask |
|---|---|
| 🌅 **about to commute** | *Wann fährt die nächste Bahn ab Köln Neumarkt?* · *Does an ICE leave Tübingen Hbf in the next hour?* · *Fahren Busse und Bahnen in Bayern gerade pünktlich?* · *When does the next train leave Hamburg Hbf?* · *Which U-Bahn and trams leave Berlin Alexanderplatz in the next minutes?* · *Wann fährt die nächste Stadtbahn ab Hannover Kröpcke?* |
| 🚗 **about to drive** | *Is the A7 clear right now?* · *Gibt es Stau auf der A8?* · *Are there roadworks on the A7 next week?* · *Is the A1 closed anywhere?* · *Welche Vollsperrungen sind auf der A7 in den nächsten sieben Tagen geplant?* · *Welche Baustellen gibt es in München?* · *How is the traffic on the A3 around Köln?* · *Ist die Fehmarnsundbrücke wegen Wind gesperrt?* · *Which detours are signed near Hamburg Hbf?* |
| 🚚 **driving a lorry** | *Darf der Lang-Lkw auf die A7?* · *Which height limits are there for lorries in Bremen?* · *Gibt es Lkw-Durchfahrtsverbote bei Bielefeld?* · *Wann ist der nächste Lkw-Fahrverbotstag?* · *Gilt am 31. Oktober in Niedersachsen Lkw-Fahrverbot?* · *Welche Durchfahrtshöhen gibt es am Kölner Dom?* · *Where are the lorry bans in Dresden?* |
| 🚧 **stuck in traffic** | *How much time is the jam on the A3 between Frankfurt and Würzburg costing right now?* · *Is traffic backed up on the Cologne motorway ring — A1, A3 or A4?* · *Ist der Elbtunnel auf der A7 heute Nacht gesperrt?* |
| ⚡ **driving electric or on hydrogen** | *Where can I charge with Type 2 near Leipzig?* · *Wo gibt es einen Schnelllader mit 150 kW bei Nürnberg?* · *Is there an EnBW charger with 150 kW or more in Stuttgart?* · *Where can I fill up a hydrogen lorry near Hamburg?* |
| 🅿️ **parking** | *Is the P+R at Fröttmaning usually full in the morning?* · *Wie viele Plätze sind in den Kasseler Parkhäusern frei?* · *Which car parks in Konstanz still have spaces?* · *How full are the lorry parks along the A9?* · *Is there a free disabled parking bay near Dortmund's Hansastraße?* · *Find a rest area with lorry parking on the A9* · *Rastplatz mit Dusche an der A7?* · *Where can I park on the street near Hamburg Rathaus?* |
| ⛽ **filling up** | *Where is diesel cheapest near Kassel?* · *Welche Tankstellen gibt es in Weimar?* |
| ♿ **travelling step-free** | *Funktioniert der Aufzug am Bahnhof Köln Messe/Deutz?* · *Is Tübingen Hbf step-free?* · *Ist die Bushaltestelle Ludgeriplatz in Münster barrierefrei?* · *Which platforms at Leipzig Hbf are step-free?* |
| 🌦️ **watching the weather** | *Gibt es eine Unwetterwarnung für Freiburg?* · *Is the road near Garmisch going to be icy this morning?* |
| 📍 **looking for a place** | *What is the address of the Elbphilharmonie in Hamburg?* · *Welche Apotheken gibt es in Fulda?* · *My satnav shows 50.1109, 8.6821 — what address is that?* |
| 🇩🇪 **new to German roads** | *Do I need an emission sticker for Stuttgart?* · *Is Marienplatz in Munich inside the low-emission zone?* · *Liegt Essen Hbf in der Umweltzone?* · *Is there a speed limit on the Autobahn?* |
| ⏳ **waiting for news** | *Tell me as soon as the closure on the A7 is lifted.* · *Tell me when a jam builds up on the A7.* · *Sag mir Bescheid, wenn in Köln ein Viertel oder mehr der Bus- und Bahnfahrten verspätet ist.* · *Warn me when a DWD severe-weather warning comes into force for Cologne.* |

**What the answers cover, honestly.** Live traffic is the motorways, plus the
measured traffic state of Hamburg's and Bonn's streets and the quarter-hour counts
of Hamburg's counting sites (a count is a volume, never a jam). Closures and
roadworks also cover Land roads in Niedersachsen, Nordrhein-Westfalen, Hessen,
Baden-Württemberg, Mecklenburg-Vorpommern, Sachsen and Thüringen, federal roads
there and in Schleswig-Holstein, Bayern and Berlin, the Autobahn GmbH's planned
short-duration works on the motorways (a plan with its own window, never a closure
before it begins), the city streets of Hamburg and Bremen, the
works the city and Land portals publish (Kiel, Schleswig-Holstein, Brandenburg,
Freiburg, Karlsruhe, Frankfurt, Berlin, Duisburg, Aachen, Ingolstadt, Köln,
Münster, Dortmund, Stuttgart, München), the traffic reports some Länder and cities
publish (Baden-Württemberg, Schleswig-Holstein, Berlin, Hamburg, Köln, Hannover,
Kassel, Leipzig, Rüsselsheim am Main), and the state of Schleswig-Holstein's large
bridges, and the traffic strategies the Autobahn GmbH (nationally and in Bayern)
and Lower Saxony's NLStBV switch on, as their recommendation and only while switched; other city streets are
not covered. Street detail around a place
(signed detours, signal installations, on-street bays, loading bays, border
crossings, winter service, pedestrian-zone entrances) exists only where a city or
Land publishes it, and the answer names which. Lorry restrictions by place cover
North Rhine-Westphalia's towns (SEVAS), Köln, Dresden, the Frankfurt RheinMain
region (ivm) and Bremen; elsewhere the answer says it holds no data, which is never
a clearance, and the long-lorry network covers the whole country. Departures cover
every German stop from the timetable; a live delay appears where a realtime feed
carries that trip (DELFI's national rail feed and, since 2.4.5, its fourteen
regional feeds for every mode, its GTFS-RT, and VBB, VRN and VBN, with VBN's Connect
in Niedersachsen and Bremen), and otherwise the answer says the time is the plan; a railway
station's board also lists its U-Bahn and trams from the timetable. Live
parking and charging occupancy exist only where the operator publishes them, and
an answer never reads "no data" as free. A parking figure is shown as published,
with the operator's status beside it; a reading the publisher stopped updating says
when it was last reported, and one that cannot be right is called implausible.
Truck-parking occupancy at the motorway rest areas (Toll Collect's SID) is shown
only after the user accepts ViaFrei's terms of use, section 2, in the question the
client asks; a client that cannot ask gets the lorry parks without it. A parking
site's amenities (WC, shower,
restaurant and more) are the ones its own publisher states; many state none, and an
amenity nobody stated is unknown, not absent. A motorway's traffic light is green
only when every source it reads is current and reports nothing, and even then it is
no guarantee of a clear road. Fuel prices cover the stations we watch,
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
whole, not one section of it. On a motorway a watch can also report jams; on other
roads and around a place it watches closures and restrictions only, and says so.

## 💬 Real answers

These came back from the production server at `https://mcp.viafrei.de/mcp`. They
are not mock-ups. The first was asked of **server 2.5.0 on 2026-10-29 at 17:48
Berlin time**, the day it went live. The next was asked of server 2.4.9 that
morning at 06:55. The next five were asked of server
2.4.3 on 2026-10-27 between 16:00 and 16:02 Berlin time, the day it went live, and
were asked again of server 2.4.9 on 2026-10-29 at 06:54: they answer in the same
shape, and their figures belong to the moment they were first captured. An "As of"
time earlier than a capture is the time the source was last read. The next four were asked of server
2.3.23 on 2026-10-25 between 15:04 and 15:06 Berlin time, the day it went live.
The next three were asked of server
2.3.18 on 2026-10-24 at 00:20 Berlin time. The next five were asked of server 2.3.12 on 2026-10-22
between 08:50 and 09:20 Berlin time; an "As of" time earlier than that is the
time the source was last read. The next nine were asked of server 2.2.14 on
2026-10-20 between 06:00 and 06:16 Berlin time. The next seven were asked of server 2.2.6 on
2026-10-19 between 07:34 and 07:45 Berlin time, the day it went live. The next two were asked of
server 2.1.25 on 2026-10-17 at 18:38 Berlin time, an hour after it went live. The next three were asked of
server 2.1.17 on 2026-10-14, around 22:40 Berlin time, minutes after it went live. The next three were asked
of server 2.1.8 on 2026-10-13 around 22:40, three more of server 2.1.5 that
afternoon, between about 14:50 and 16:20, and the others of server 2.0.10 that morning around
06:41. Those were asked again of server 2.1.17 on 2026-10-14 around 22:43 and
answer in the same shape; their figures, and the frost warning, belong to the
moment they were captured.
Each one shows the first lines of what the tool returned, and the source line as
it was sent, shortened where marked.

<details open>
<summary><b>🚆 "When does the next train leave Hamburg Hbf?"</b> — <code>get_train_departures</code> with <code>station: "Hamburg Hbf"</code>, <code>language: "en"</code></summary>

```text
{"line":"ICE 200","destination":"Hamburg-Altona","plannedAt":"…T16:22:00Z","delayMin":30,"platform":"13","place":"track"}
{"line":"S3","destination":"Hamburg-Neugraben","plannedAt":"…T16:46:00Z","delayMin":4,"platform":"3","place":"track"}
{"line":"ICE 1275","destination":"Berlin Gesundbrunnen","plannedAt":"…T16:51:00Z","delayMin":0,"platform":"8","place":"track"}
{"line":"RE1","destination":"Büchen","plannedAt":"…T16:55:00Z","delayMin":0,"platform":"7A-D","place":"track"}
"capped": {"shown":10,"more":13}, "interchange": U1, U2, U3, U4 and the buses, with their own departures
…
Source: Fahrplandaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet (…) · Bahnhofsdaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet (…) · … · Echtzeitdaten: DELFI e.V. via Mobilithek, CC BY-SA, bearbeitet (…)
The DELFI GTFS-RT realtime entries are licensed CC BY-SA (share-alike) by their source; we release our adaptation under CC BY-SA 4.0 (…): anyone who passes them on, or builds something on them, must release the result under the same licence and with this attribution.
```
New in 2.5.0: the RE1's platform "7A-D" — track 7, sections A to D, written without
a space — is read as a track (`"place": "track"`), so the English answer says "platform
7A-D" and the German one "Gleis 7A-D". Before 2.5.0 such a row fell through as
plain text. Times are UTC in the structured result: the ICE 200, planned at 17:22
Berlin, was expected at 17:52, 30 minutes late. The U-Bahn departures of the
interchange come in a list of their own, and because the realtime is DELFI's, the
answer carries the share-alike sentence.
*Edited: four of the ten departures shown, one line each, the station's other
fields and the full attribution omitted.*
</details>

<details>
<summary><b>🚊 "Wann fährt die nächste Stadtbahn ab Hannover Kröpcke?"</b> — <code>get_departures</code> with <code>stop: "Hannover Kröpcke"</code>, <code>limit: 8</code>, <code>language: "en"</code></summary>

```text
Departures from Hannover Kröpcke — timetable with realtime, 06:55 to 07:55:
06:56 metro 1 → Laatzen, platform #3/SB, on time
06:56 metro 4 → Hannover Roderbruch, platform #5/SB, on time
06:56 metro 7 → Hannover Wettbergen, platform #1/SB, on time
06:57 metro 1 → Langenhagen, platform #4/SB, +2 min (expected 06:59)
06:57 bus 100 → Hannover August-Holweg-Platz, stand Bus18, on time
06:57 bus 120 → Hannover Ahlem, stand Bus17, on time
06:57 metro 4 → Garbsen, platform SB6, on time
06:57 metro 7 → Hannover Misburg, platform #2/SB, +1 min (expected 06:58)
… and 148 more in the window.
…
Source: Fahrplandaten: DELFI e.V., CC BY 4.0, bearbeitet (…) · … · Echtzeitdaten: DELFI e.V. via Mobilithek, CC BY-SA, bearbeitet (…) · Echtzeitdaten: DELFI e.V. via Mobilithek, Datensätze „DELFI-Realtime SIRI ET“ (Bahndaten und 14 Regionen), CC BY-SA, bearbeitet (…) · As of 06:55
The realtime figures from DELFI GTFS-RT and DELFI SIRI ET are licensed CC BY-SA (share-alike) by their source; we release our adaptation under CC BY-SA 4.0 (…): anyone who passes them on, or builds something on them, must release the result under the same licence and with this attribution.
```
New in 2.4.5: the Stadtbahn and the buses carry a live figure. In the structured
result seven of these eight departures have `"source": "delfi_siri_et"`, DELFI's SIRI ET,
which since 2.4.5 includes fourteen regional feeds that carry buses, trams and the
Stadtbahn as well as trains, and one has
`"source": "delfi_rt_tu"`, the GTFS-RT Trip Updates. Each departure gets one figure,
from the feed whose call agrees with where it is going; a departure no live feed
covers says "timetable". The same question about Bremen Hauptbahnhof also credits
VBN's Connect timetable and realtime, which answer for Niedersachsen and Bremen since
2.4.5. Live figures from DELFI are share-alike, and the answer says so in a sentence
of its own.
*Edited: the stop id for `watch_situation` and the stops read with it, the
administrative-units credit, the line on where the realtime comes from and how far
the timetable reaches, and the URIs omitted.*
</details>

<details>
<summary><b>🚦 "How is the A3 right now?"</b> — <code>check_autobahn_traffic</code> with <code>roads: ["A3"]</code>, <code>language: "en"</code></summary>

```text
A3 — traffic light red: full closure (and 109 more reasons).
A3, road-wide: 11 jams, 4 closures, 104 roadworks sites; plus police/Land messages: 3 jams, 6 restrictions, 8 roadworks sites, 6 reports; announced from 18:00: 49 closures, 110 roadworks sites — As of 16:01. Traffic state at 127 measuring sites (NRW, as of 15:58): 29 standstill, 5 slow, 29 heavy, 64 free-flowing; standstill or slow near Bonn/Siegburg, Duisburg-Wedau, Köln-Dellbrück; …
• Traffic jam (Stau): A3, end of the jam 2.7 km past AS Leverkusen-Zentrum, about 10.0 km long, growing (about 8.9 km 17 min ago), since 15:39, +57 min — between junction Leverkusen-Zentrum and junction Königsforst, towards Frankfurt — Provider text (German): "A3 | Leverkusen-Zentrum - Königsforst · Oberhausen -> Frankfurt — […] Angespannte Verkehrslage […] …"
• Traffic jam (Stau): A3, end of the jam 0.8 km past AS Iggensbach, about 6.6 km long, since 15:25, +18 min — between junction Iggensbach and junction Hengersberg, towards Nürnberg — …
…
Source: Verkehrsdaten: Autobahn GmbH des Bundes (https://verkehr.autobahn.de) · Verkehrslage Nordrhein-Westfalen: © Die Autobahn GmbH des Bundes 2026 — GeoNutzV, Daten verändert (…) · TMC Location Code List (LCL 22.0): Bundesanstalt für Straßenwesen (BASt), CC BY 4.0 (…), bearbeitet (…) · …
```
And the first jam's `entry` in the structured result, new in 2.4.1 (the map links
shortened):

```json
"entry": {
  "where": { "kind": "pair",
    "from": { "name": "Köln-Mülheim", "number": "25", "type": "AS" },
    "to": { "name": "Leverkusen-Zentrum", "number": "24", "type": "AS" },
    "town": { "name": "Leverkusen", "ags": "05316000" },
    "land": { "ags": "05", "name": "North Rhine-Westphalia" },
    "placedBy": "ViaFrei" },
  "direction": { "kind": "toward", "toward": "Frankfurt" },
  "when": { "from": "2026-10-27T15:39+01:00", "to": null, "running": true, "moreWindows": 0 },
  "impact": [ { "code": "jam" } ],
  "what": { "kind": "Traffic jam (Stau)", "measure": null, "terms": [] },
  "at": { "lat": 51.00005, "lon": 7.01323 },
  "maps": { "osm": "https://www.openstreetmap.org/?mlat=51.00005&mlon=7.01323…", "google": "…" }
}
```
Every jam, closure and works site of the three road tools carries the same five
answers: where (the junction pair, the town and the Land), which way, when, what it
means for a driver and what the work is. `where` places the entry's own point (`at`,
here the end of the jam, 2.7 km past Leverkusen-Zentrum) between the two junctions
around it, while the publisher's title above names the whole stretch the jam covers.
An assistant can say where, which way and since when without parsing the publisher's
text, and link the map.
*Edited: the condition notes that open the answer, the rest of the first jam's
provider text, the third jam, the short-duration works listed after it, and most of
the source line omitted.*
</details>

<details>
<summary><b>⚡ "Is there an EnBW charger with 150 kW or more in Stuttgart?"</b> — <code>find_charging_station</code> with <code>place: "Stuttgart"</code>, <code>operator: "EnBW"</code>, <code>min_power_kw: 150</code>, <code>language: "en"</code></summary>

```text
Charging around Stuttgart (within 10 km, ≥ 150 kW, operator EnBW), nearest first, sites wholly out of order last:
1. Rotebühlstr. 30, 70178 Stuttgart (ENBW) — 0.7 km, CCS2, up to 300 kW, 0.79 €/kWh, status from 2026-10-24 02:22 — possibly out of date
2. Keplerstraße 7, 70174 Stuttgart (ENBW) — 0.7 km, CCS2, up to 300 kW, 0.79 €/kWh, status from 2026-10-24 04:47 — possibly out of date
3. Am Neckartor 2, 70190 Stuttgart (ENBW) — 1.5 km, CCS2, up to 300 kW, 0.79 €/kWh, no status data
…
Only a few operators publish live occupancy; "no status data" means unknown, not free.

Source: Ladepunkte: EnBW AG via Mobilithek, CC BY 4.0, bearbeitet (…) · Ladepunkt-Verfügbarkeit: EnBW AG via Mobilithek, CC BY 4.0, bearbeitet (…) · …
```
New in 2.4.3: `operator` and `max_power_kw`. Spellings of one brand match together
(the register's "ENBW" above), and the structured result says how many of the radius's
sites the filter kept (`sitesMatching` 10 of `sitesInRadius` 1,580 here). Where no
site matches, the answer says how many it looked at and suggests widening the radius
or dropping the filter. A status older than its feed's own window is shown with its
time, never as free.
*Edited: two more sites, the site ids for `watch_situation` and most of the source
line omitted.*
</details>

<details>
<summary><b>🚇 "What leaves Berlin Alexanderplatz now?"</b> — <code>get_train_departures</code> with <code>station: "Berlin Alexanderplatz"</code>, <code>language: "en"</code></summary>

```text
Departures from Berlin Alexanderplatz (next 60 minutes):
16:02 S9 → Flughafen BER (S-Bahn), platform 3, on time
16:03 S9 → Berlin-Spandau (S), platform 4, on time
16:05 S3 → Berlin Charlottenburg (S), platform 4, on time
…
U-Bahn, Stadtbahn and tram at this station (DELFI timetable; realtime where DELFI GTFS-RT reports it):
16:01 tram M4 → S Hackescher Markt (Berlin) (per timetable, platform Pos. 11)
16:01 U5 → U Hönow (Berlin) (per timetable, platform 2 (U5))
16:02 U2 → S+U Pankow (Berlin) (per timetable, platform 2 (U2))
…
Lines here: metro: U2, U5, U8 · tram: M4, M5, M6 · bus: 025, 060, 065, 070, 100, 157, 170, 200, …

Source: Fahrplandaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet (…) · Bahnhofsdaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet (…) · Fahrplandaten: DELFI e.V., CC BY 4.0, bearbeitet (…) · Haltestellendaten: DELFI e.V. (zentrales Haltestellenverzeichnis), CC BY 4.0, bearbeitet (…) · As of 16:00
```
New in 2.4.3: a railway station that is also an interchange lists its U-Bahn,
Stadtbahn and trams below the trains, from the timetable with realtime where the feed
reports it, and names every line that calls there. One question about the station
answers for all of it.
*Edited: seven more trains, seven more U-Bahn and tram departures and most of the bus
lines omitted.*
</details>

<details>
<summary><b>🅿️ "Which car parks in Konstanz still have spaces?"</b> — <code>find_parking</code> with <code>place: "Konstanz"</code>, <code>kind: "car_park"</code>, <code>language: "en"</code></summary>

```text
Parking around Konstanz (within 10 km), nearest first:
1. Fischmarkt — Car park (Parkhaus), 0.2 km, 161 spaces, 15 free, 90.68 % occupied, operator's status: almost full (as of 15:52), Facilities: not reported
   Nearby per OpenStreetMap (straight line): restaurant 30 m · shop 30 m · café 40 m · snack bar 120 m · toilet 210 m
2. Altstadt — Car park (Parkhaus), 0.3 km, 359 spaces, 15 free, 95.82 % occupied, operator's status: almost full (as of 15:52), Facilities: not reported
3. Marktstätte — Car park (Parkhaus), 0.4 km, 277 spaces, 93 free, 66.43 % occupied, operator's status: spaces available (as of 15:52), Facilities: not reported
4. Augustiner / Karstadt — Car park (Parkhaus), 0.4 km, reported closed (as of 2026-10-22 14:12, 122 h 48 min ago), Facilities: not reported
5. Benediktinerplatz — Car park (Parkhaus), 0.7 km, 40 spaces, last reported 16 free, 60 % occupied, operator's status: spaces available (as of 2026-10-22 14:12, 122 h 48 min ago), Facilities: not reported
…
Source: Parkhäuser Konstanz: Stadt Konstanz via Mobilithek, Datensatz „Parkdaten Stadt Konstanz statisch“, CC BY 4.0, bearbeitet (…) · Parkhaus-Belegung Konstanz: Stadt Konstanz via Mobilithek, Datensatz „Parkdaten Stadt Konstanz dynamisch“, CC BY 4.0, bearbeitet (…) · OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0 (…) · …
Where no "free" count is shown the operator publishes no occupancy — it does not mean the site is full.
```
New in 2.4.2 and 2.4.3: the city of Konstanz's own car-park feed (Wiesbaden's joined
in the same release), and every figure as the operator publishes it, with the
operator's status beside it. Rows 4 and 5 show the honest part: their last reading is
five days old, so they say "reported closed" and "last reported" with the time, and
are never presented as current. MobiData BW's bundle carries some of the same lots;
a lot both publish is listed once.
*Edited: the nearby lines of rows 2 to 5, the chargers near each site, the
OpenStreetMap notice and car-park list, and most of the source line omitted.*
</details>

<details>
<summary><b>🚚 "How full are the lorry parks along the A9?"</b> — <code>find_parking</code> with <code>road: "A9"</code>, <code>kind: "truck"</code>, <code>language: "en"</code></summary>

```text
Parking along the A9:
…
2. 24-TOTAL Autohof Leipzig Flughafen — Lorry parking (Lkw-Parkplatz), 151 spaces, 151 of them for lorries, no occupancy published, Facilities: not reported
3. Aral Autohof Bad Berneck — Lorry parking (Lkw-Parkplatz), 220 spaces, 120 of them for lorries, no occupancy published, Facilities: not reported
…
Truck-parking occupancy (Toll Collect, SID) is given only after accepting ViaFrei's terms of use, section 2 (https://viafrei.de/en/terms#sid); this client cannot ask for acceptance (MCP elicitation); it is available in a client that can, or on viafrei.de with "Show occupancy". The lorry parks above are therefore listed without it.

Source: Verkehrsdaten: Autobahn GmbH des Bundes (https://verkehr.autobahn.de) · LKW-Parken: © Lkw-Parken BAB Deutschland / Bundesministerium für Verkehr (BMV) 2026 — GeoNutzV, Daten verändert (…) · …
```
New in 2.4.3. The Toll Collect Stellplatz-Informationsdienst publishes the occupancy
of the motorway rest areas, and its terms require that everyone who receives the
figures is bound by them. So the server asks first: a client that supports MCP
elicitation shows the user the question, and the figures follow only on an explicit
yes. This capture came from a client that cannot ask, so the answer lists the lorry
parks without the figures and says where to get them. An assistant must never accept
for the user.
*Edited: three more lorry parks, the nearby lines, the OpenStreetMap notice, the
line saying the list is in name order, most of the source line and the closing
sentence on missing free counts omitted.*
</details>

<details>
<summary><b>🚦 "Is the A7 clear right now?"</b> — <code>check_autobahn_traffic</code> with <code>roads: ["A7"]</code>, <code>language: "en"</code></summary>

```text
A7 — traffic light red: full closure (and 146 more reasons).
A7, road-wide: 6 jams, 12 closures, 101 roadworks sites; plus police/Land messages: 18 restrictions, 3 roadworks sites, 2 reports; announced from 2026-10-26 07:00: 28 closures, 132 roadworks sites — As of 15:04. Delay per direction: Fulda → Würzburg +23 min (1 jam); Hamburg → Hannover +32 min (2 jams); Hannover → Hamburg +21 min (2 jams); Würzburg → Fulda +7 min (1 jam). +1 more in the structured result.
• Traffic jam (Stau): A7, end of the jam 0.6 km past Am Forsthaus, about 3.6 km long, growing (about 3.1 km 27 min ago), since 13:01, +23 min — between Am Forsthaus and Speicherz, towards Würzburg — Provider text (German): "A7 | Am Forsthaus - Speicherz · Fulda -> Würzburg — […] Angespannte Verkehrslage […]"
• Traffic jam (Stau): A7, end of the jam 0.9 km past Maschener Kreuz/A39, about 2.6 km long, steady (about 2.4 km 27 min ago), since 13:40, +10 min — between Maschener Kreuz/A39 and Harburger Berge, towards Hamburg — …
…
Source: Verkehrsdaten: Autobahn GmbH des Bundes (https://verkehr.autobahn.de) · Verkehrsmeldungen der Polizei: Landesbetrieb Straßenbau NRW (VIZ.NRW) via Mobilithek, … · Arbeitsstellen kürzerer Dauer auf Autobahnen (geplant): Die Autobahn GmbH des Bundes | MIA via Mobilithek, eingeschränkte Nutzung, kostenfrei (…) · Datenbasis: Deutscher Wetterdienst, zusammengefasst (…) · As of 15:04
```
The traffic light (since 2.3.9) is one national rule: red for a closure of the
carriageway, a jam of 30 minutes or more, a safety message or a DWD warning of level 3
or above; green only when every source it reads is current and reports nothing. A jam
says where it ends, how long it is, since when and whether it is growing. The short-notice
works of the Autobahn GmbH are listed beside the live situation only while their planned
window holds, and never count towards the light.
*Edited: the condition notes that open the answer (road-weather stations, the
Baden-Württemberg traffic-warning service, the short-duration works), four more jams, the
closures and planned works, and most of the source line omitted.*
</details>

<details>
<summary><b>🚧 "Which roadworks are planned on the A3 this week?"</b> — <code>find_roadworks_ahead</code> with <code>road: "A3"</code>, <code>language: "en"</code></summary>

```text
Planned short-duration roadworks are planned at short notice and often changed; they replace neither a permit for oversize and heavy transports nor the route check before setting off (our translation of the publisher's note).
A3: 28 planned roadworks sites between 2026-10-25 and 2026-11-01. 10 of them are in this answer — raise limit to 20 for the rest. Not current and therefore not used: BASt (roadworks), Autobahn GmbH (roadworks, next 14 days).
• Construction works (Baustelle): A3 — nearest junction: Oberhausen-Lirich (placed by ViaFrei) — 2 of 3 lanes closed, hard shoulder closed — planned 2026-10-24 20:00–2026-10-25 05:00; 2026-10-25 20:00–2026-10-26 05:00; 2026-10-26 20:00–2026-10-27 05:00 (+3 more dates) — Provider text (German): "A3 DB BW Längsfugenabdichtung - A3 DB BW Längsfugenabdichtung; Bauwerksarbeiten"
• Maintenance works (Instandsetzung): A3 — nearest junction: Frankfurt am Main-Flughafen (placed by ViaFrei) — 1 of 3 lanes closed, others restricted — per the plan now 2026-10-25 08:00–18:00 — Provider text (German): "A3 von Kelsterbach (AS) nach Frankfurter Kreuz (AK) Fahrbahninstandsetzung - …"
…
Source: Arbeitsstellen kürzerer Dauer auf Autobahnen (geplant): Die Autobahn GmbH des Bundes | MIA via Mobilithek, eingeschränkte Nutzung, kostenfrei (…) · TMC Location Code List (LCL 22.0): Bundesanstalt für Straßenwesen (BASt), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), bearbeitet (…) · As of 14:53, unchanged since 14:37
```
New in 2.3.21: the Autobahn GmbH's short-duration works (AkD), the night and day
closures it plans at short notice. Each is listed with the windows the publisher states,
a series of nights as separate windows, "planned" until a window opens and "per the plan
now" inside it, and never as a closure that has begun. The publisher's note goes with
every answer that carries one. This answer also shows the honest gap: two other
roadworks sources were not current at that moment, so the answer names them and does
not use them.
*Edited: eight more sites and the planning-data note at the end omitted.*
</details>

<details>
<summary><b>🏗️ "Roadworks on the B49 this week?"</b> — <code>find_roadworks_ahead</code> with <code>road: "B49"</code>, <code>language: "en"</code></summary>

```text
B49: 14 roadworks sites between 2026-10-25 and 2026-11-01, 5 of them already begun. None in Niedersachsen, Sachsen, Thüringen, Baden-Württemberg, Bayern, Mecklenburg-Vorpommern or Nordrhein-Westfalen — all 14 in Hessen. 10 of them are in this answer — raise limit to 20 for the rest.
• Construction works (Baustelle) (Hessen): B49 — 1 of 2 lanes closed, phase 2026-08-24 until 2026-11-27 — 2026-08-21 until 2026-11-27 — Provider text (German): "Limburg a.d. Lahn-Linden; Bauwerksarbeiten"
• Lane management (Verkehrsführung) (Hessen): B49 — 1 of 1 lanes restricted, all open, phase 2026-10-13 until 2026-11-09 — 2026-10-12 until 2026-11-10 — Provider text (German): "Limburg-Gießen; Auf-/Abbau Verkehrsführung"
• Maintenance works (Instandsetzung) (Hessen): B49 — planned 2026-10-26 08:00–17:00 — Provider text (German): "Limburg a.d. Lahn-Leun; Arbeiten an Schutzeinrichtungen"
…
Source: Arbeitsstellen Hessen: Hessen Mobil (Daten verändert) via Mobilithek, GeoNutzV (https://mobilithek.info/) · As of 14:35
```
New in 2.3.21: Hessen Mobil's works on Bundes-, Landes- and Kreisstraßen, and the
Landesbetrieb Straßenbau NRW's works off the motorways. The credit is the source note
GeoNutzV prescribes, "Hessen Mobil (Daten verändert)", with its link.
*Edited: seven more sites and the closing note naming the covered Länder omitted.*
</details>

<details>
<summary><b>⚡ "Where can I charge in Krautheim?"</b> — <code>find_charging_station</code> with <code>place: "Krautheim, Hohenlohekreis"</code>, <code>language: "en"</code></summary>

```text
Charging around Krautheim (within 10 km), nearest first, sites wholly out of order last:
1. Krautheim - Ladesäule Krautheim, Götzstraße  47, 74238 Krautheim (Regioladen+ GmbH & Co. KG) — 0.6 km, Type 2, up to 22 kW, 0.62 €/kWh net, 2 of 2 free (as of 15:04)
2. Uferweg 12, 74238 Krautheim (Rüdinger Spedition GmbH) — 0.8 km, CCS2, up to 400 kW, no status data, per charging point register (4 charging units)
3. Krautheim — 0.8 km, CCS2/Type 2, up to 400 kW, 0.48 €/kWh, occupied, 18 without status (as of 14:39)
…
Only a few operators publish live occupancy; "no status data" means unknown, not free.
…
Source: Ladepunkte: chargecloud GmbH via Mobilithek, CC0 1.0 (…) · … · Ladepunkte: ELU Mobility via Mobilithek, Open Data (freie Nutzung) (…) · Ladepunkt-Verfügbarkeit: ELU Mobility via Mobilithek, Open Data (freie Nutzung) (…) · …
```
New in 2.3.23: ELU Mobility's charging park at Krautheim, up to 400 kW, answers with its
live status: row 3, the park's 26 points, with the status the operator publishes. Row 2
is the Bundesnetzagentur's register at the same spot, which never carries a status. eliso, TC-Backend and Chargepool joined in the same release.
A "Krautheim" alone asks which one: there are three.
*Edited: two more sites, the site ids for `watch_situation`, the price and register
notes and most of the source line omitted.*
</details>

<details>
<summary><b>🌬️ "Is there a weather warning for Kiel?"</b> — <code>check_weather_warnings</code> with <code>language: "en"</code></summary>

```text
2 official notices for Kiel, highest level 1 of 4:

1. Level 1 of 4 — Wetterwarnung (the DWD's own name; our translation: weather warning) — Wind gusts (WINDBÖEN)
   Area: Stadt Kiel (warn cell 801002000)
   Valid: from 2026-10-24 04:00 until 2026-10-24 12:00
   Official DWD wording in English (the DWD's own text), reproduced unaltered:
   „Official WARNING of WIND GUSTS“
   „There is a risk of wind gusts (level 1 of 4).
Max. gusts: < 60 km/h; Wind direction: south then south-west“
   For the drive: Gusts can push vehicles sideways; take particular care on bridges, in woodland and when overtaking lorries.
…
Quelle: Deutscher Wetterdienst (https://www.dwd.de/copyright; Lizenz: CC BY 4.0, …) · …
```
New in 2.3.17 and 2.3.18. The warning text is the DWD's own English, unaltered, so it
keeps the DWD's Quellenvermerk. The level name stays German ("Wetterwarnung") with our
gloss beside it, because a German official level has no official English name. The
driving sentence is ours. On viafrei.de, where the DWD has no English text and in the
other twenty languages, the card shows the German original as the binding text beside
our labelled translation.
*Edited: the road-weather condition note that opens the answer, two DWD lines on the
level and its CAP fields, the hazard text, the second warning, the road-surface
forecast and most of the source line omitted.*
</details>

<details>
<summary><b>🔌 "Where can I charge near Hamburg Hbf?"</b> — <code>find_charging_station</code> with <code>language: "en"</code></summary>

```text
Charging around Hamburg Hbf (within 10 km), nearest first, sites wholly out of order last:
1. Heidi-Kabel-Platz, 20099 Hamburg — 0.2 km, Type 2, up to 22 kW, 0.50 €/kWh, 3 of 4 free (as of 00:19) (2 charging units)
2. Mönckebergstr. 1, 20095 Hamburg (E.ON Drive Infrastructure) — 0.3 km, CCS2, up to 150 kW, no status data, per charging point register
3. Borgesch 1, 20099 Hamburg (Hamburger Energiewerke) — 0.3 km, Type 2, up to 22 kW, no status data, per charging point register; CCS2/Type 2, up to 50 kW, no status data, per charging point register (2 charging units)
4. Hühnerposten 14, 20097 Hamburg — 0.4 km, Type 2, up to 22 kW, 0.50 €/kWh, status from 2026-10-23 20:01 (4 h 19 min ago) — possibly out of date
…
```
New in 2.3.15: the charge points of one site that differ only in their momentary status
are one line ("3 of 4 free"), and a site that its operator names only by a code is named
by its address. A status older than its feed's own window is shown with its time and
"possibly out of date", never as free.
*Edited: two more sites, the site ids for `watch_situation` and the source line
omitted.*
</details>

<details>
<summary><b>🌿 "Do I need an emission sticker for Hannover?"</b> — <code>get_driving_rules</code> with <code>topic: "lez"</code>, <code>language: "en"</code></summary>

```text
Low-emission zone and plaque — Hannover:
Hannover: the Umweltzone Hannover was lifted on 22.02.2024 according to the Umweltbundesamt; no plaque is needed there any more — the signs on the spot still decide.
…
Source: Verkehrsregeln: ViaFrei, eigene Zusammenstellung aus amtlichen Quellen (…) · Umweltzonen in Deutschland: Umweltbundesamt, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet (…)
Reviewed 2026-09-19 · Informational, not legal advice.
```
New in 2.3.14: the zone list follows the Umweltbundesamt's list of 2026-10-22, with 35
zones in force and 23 lifted. A lifted zone is said as lifted, with its date, instead of
"no zone".
*Edited: the general rules on plaques and fines and the links in the source line
omitted.*
</details>

<details>
<summary><b>🚦 "Is the A7 clear right now?"</b> — <code>check_autobahn_traffic</code> with <code>roads: ["A7"]</code>, <code>language: "en"</code></summary>

```text
A7 — traffic light red: full closure (and 156 more reasons).
A7, road-wide: 3 jams, 1 warning (accident, hazard etc.), 13 closures, 128 roadworks sites; announced from 09:00: 26 closures, 125 roadworks sites — As of 08:47. Delay per direction: Flensburg → Hamburg +72 min (2 jams); Hannover → Hamburg +11 min (1 jam). +1 more in the structured result.
• Traffic jam (Stau): A7, end of the jam 2.0 km past AS Bad Bramstedt, about 3.9 km long, steady (about 3.9 km 13 min ago), since 07:03, +47 min — between junction Bad Bramstedt and junction Kaltenkirchen, towards Hamburg — Provider text (German): "A7 | Bad Bramstedt - Kaltenkirchen · Flensburg -> Hamburg — […] Angespannte Verkehrslage […]"
…
```
New in 2.3.9 (the traffic light) and 2.3.5 (the jam's end, length, trend and the
delay per direction). The light follows one national rule: red for a closure of the
carriageway, a jam of 30 minutes or more, a safety message, a DWD warning of level 3
or above or a closed bridge; yellow for a shorter jam, roadworks, a closed ramp, a
lower warning or a source we cannot see right now; green only when every source is
current and reports nothing, and even then the answer says it is no guarantee of a
clear road. The structured result lists each reason with its source, and groups
roadworks and closed ramps ("11 × a junction ramp closed").
*Edited: the end of the provider text, the other entries and the source line
omitted.*
</details>

<details>
<summary><b>🚿 "Rastplatz mit Dusche an der A7?"</b> — <code>find_parking</code> with <code>road: "A7"</code>, <code>facilities: ["shower"]</code></summary>

```text
Parken an der A7:
1. Aalbek — Lkw-Parkplatz, 207 Plätze, davon 89 für Lkw, keine Belegungsdaten veröffentlicht, Ausstattung laut Herausgeber: WC · Dusche · Tankstelle · Picknickplatz · Spielplatz
   In der Nähe laut OpenStreetMap (Luftlinie, Erreichbarkeit nicht geprüft): Imbiss 110 m · Restaurant 120 m · Café 130 m
   In der Nähe (Luftlinie, Erreichbarkeit nicht geprüft): Ladesäule 350 kW, 50 m (IONITY)
2. Allgäuer Tor Ost — Lkw-Parkplatz, 95 Plätze, davon 28 für Lkw, keine Belegungsdaten veröffentlicht, Ausstattung laut Herausgeber: WC · Dusche · Trinkwasser · Picknickplatz
   In der Nähe laut OpenStreetMap (Luftlinie, Erreichbarkeit nicht geprüft): Restaurant 30 m · Café 40 m
…
Nur Anlagen, deren Herausgeber Dusche angibt. 194 von 447 Anlagen hier nennen überhaupt eine Ausstattung — bei den übrigen ist sie unbekannt, nicht ausgeschlossen.
```
New in 2.3.10. "Ausstattung laut Herausgeber" is what the site's own publisher
states, and only that answers the filter. The two "In der Nähe" lines are what
OpenStreetMap and the charging register show close by, in a straight line and with
access not checked: they are listed for the driver and never counted as the site's
own. The last line says how many sites state any amenity at all, so a short list is
not mistaken for "no showers on the A7". An OpenStreetMap row carries the ODbL offer
(see [SOURCES.md](SOURCES.md#and-one-that-applies-if-you-get-an-openstreetmap-derived-result-back)).
*Edited: three of five sites, the ODbL lines, a note on the order of the list and the
source line omitted.*
</details>

<details>
<summary><b>🚆 "Does an ICE leave Tübingen Hbf in the next hour?"</b> — <code>get_train_departures</code> with <code>categories: ["ICE"]</code>, <code>language: "en"</code></summary>

```text
No ICE train leaves Tübingen Hbf in the next 60 minutes.
12 other trains of another type leave in the window and are not listed.
The DELFI timetable names no product for long-distance trains, so it cannot tell whether any ICE train runs.
Station asked: Tübingen Hbf (station number 8000141).
```
New in 2.3.11 and 2.3.12. An empty board now says what it checked: how many trains
of other types leave, whether the DELFI timetable lists a train either, and here
that the timetable cannot tell an ICE from another train, so it is not asked to.
Where the timetable files a rail replacement bus near the station, the answer names
it. When DB's board cannot be read at all, the next planned train answers instead of
an error, marked as planned.
*Edited: the source line omitted.*
</details>

<details>
<summary><b>🅿️ "Park and ride near Berlin-Wannsee?"</b> — <code>find_parking</code> with <code>kind: "park_and_ride"</code>, <code>language: "en"</code></summary>

```text
Parking around Berlin-Wannsee (within 10 km), nearest first:
1. Wannsee P1 — Park and ride (P+R), 0.2 km, 33 spaces, free of charge, no occupancy published, Facilities: not reported
   Nearby per OpenStreetMap (straight line): shop 190 m · restaurant 210 m · snack bar 230 m
   Nearby (straight line): EV charger 3.7 kW, 10 m (Ubitricity)
2. Potsdam Hauptbahnhof - Parkhaus Bahnhofspassagen — Park and ride (P+R), 8.2 km, 1392 spaces, no occupancy published, Facilities: not reported
…
```
Berlin's park-and-ride register (Land Berlin, with the surrounding area from VBB)
answers now. It had had no successful read when SOURCES.md was last compared, at
server 2.2.14. "Facilities: not reported" is said as unknown.
*Edited: the remaining sites, the ODbL lines and the source line omitted.*
</details>

<details>
<summary><b>🏠 "Heisfeldr Straße 10, Leer"</b> (a typo) — <code>find_address</code>, <code>language: "en"</code></summary>

```text
I do not find "Heisfeldr Straße 10, Leer" in the OpenStreetMap address data: addresses are mapped in Leer (Ostfriesland), Lower Saxony, but none on a street of this name.
Streets there with a similar name: Heisfelder Straße (26789 Leer (Ostfriesland)) — 114 mapped addresses.
```
New in 2.3.2. A near miss says whether the town or only the street is missing from
the map, and suggests the similar streets nearby with how many addresses each holds.
*Edited: the source line omitted.*
</details>

<details>
<summary><b>🛣️ "Which detours are signed near Hamburg Hbf?"</b> — <code>check_road_status</code> with <code>place</code>, <code>limit: 3</code>, <code>horizon_days: 1</code></summary>

```text
Hamburg Hbf: 1 jam report, 176 closures, 291 restrictions, 2 planned roadworks sites, 13 current roadworks sites per BASt — window until 2026-10-21.
I do not hold federal and Land roads (Bundes-, Landes-/Staatsstraßen) for Hamburg: for those, this answer is no all-clear.
Measured traffic state (Hamburg, BVM (traffic state), as of 06:00) within 10 km: 952 segments: jammed traffic: 3, slow traffic: 35, dense traffic: 914 — nearest segment (jammed traffic or slow traffic) 1.1 km away, main road; the source does not list free-flowing segments — a segment it does not list is flowing or not measured.
Counted traffic within 1.0 km (BVM counting sites (Hamburg)): counting site 0330, cross-section 4 (0.1 km), 05:30–05:45: no cross-section total (not every direction counted); by direction: west to east 37 · counting site 0331, cross-section 3 (0.2 km), 05:30–05:45: 53 motor vehicles; by direction: northeast to southwest 34, southwest to northeast 19. Further cross-sections in reach: 2. A count is a volume per quarter hour, not a statement about congestion or free flow.
• Traffic jam (Stau) A1: Provider text (German): "A1 | Tunnel Moorfleet - Norderelbbrücke · Lübeck -> Hamburg" (since 05:26; +10 min; 7.6 km away)
…
Signed motorway detours nearby (signs 460/455): U 26 (nearest section: Bürgerweide; 1.3 km); U 85 (nearest section: Heidenkampsweg; 1.3 km) — signage context, not a route recommendation
Signal installations nearby (16 within 500 m): 11 at junctions, 5 at pedestrian crossings; nearest: Mönckebergstraße/Steintorwall (0.1 km)
```
New in 2.2.12 (the counts) and 2.2.13 (the detours and the signal installations).
A detour is named by its number and its nearest street, and always as the signs
you will see, never as a route we recommend. A bus registration at a signal is
counted only where the city records one, and a zero is never said.
*Edited: the first line (a note that one roadworks source is 13 days old), two of
three entries, the sources that answered and the source line omitted.*
</details>

<details>
<summary><b>🅿️ "Where can I park on the street near Hamburg Rathaus?"</b> — <code>find_parking</code></summary>

```text
Parking around Hamburg, Rathaus (within 10 km), nearest first:
1. Europa-Passage — Car park (Parkhaus), 0.2 km, 690 spaces, no occupancy published
2. Alter Wall / BUCERIUS-Passage — Car park (Parkhaus), 0.3 km, 210 spaces, 95 free (as of 06:00)
3. Große Reichenstraße — Car park (Parkhaus), 0.3 km, 850 spaces, 488 free (as of 06:06)
…
On-street parking bays nearby (the city's register) (168 bays within 300 m): Rathausstraße (for disabled badge holders; 1 bay; 0.1 km); Rathausstraße (electric vehicles charging only Mon–Sat 09:00–20:00; at most 180 min; 1 bay; 0.1 km); Rathausstraße (pay and display; 2 bays; 0.1 km) — the city publishes no occupancy — whether a bay is free is not known; the signs on site apply
```
New in 2.2.13. The bays come from the Landesbetrieb Verkehr's register of public
parking space: a street's bays under one rule set are one line, with the rule, the
hours and the maximum stay. Stopping bans and personal disabled bays are never
counted or offered. The same answer also lists the city's coach places, with the
city's own remark quoted, and the OpenStreetMap car parks in a block of their own.
*Edited: two car parks, the OpenStreetMap and coach blocks and the source line
omitted.*
</details>

<details>
<summary><b>🚛 "Which height limits are there for lorries at Köln Dom?"</b> — <code>check_road_status</code> with <code>vehicle: "lorry"</code></summary>

```text
Lorry restrictions within 5 km of Dom, Köln (NRW.Mobidrom (SEVAS)): 387 — No lorries 177, Height limit 121, Cycle street 46, Weight limit 38, No hazardous goods 2, Length limit 2, No vehicles 1. Nearest:
- No lorries — Marzellenstraße, Köln (0 km)
- Cycle street — Trankgasse, Köln (0.1 km)
- Height limit 4 m — Tunisstraße, Köln (0.2 km)
Lorry priority routes: 4 in range, the nearest 0.2 km away.
Lorry restrictions within 5 km of Dom, Köln (Stadt Köln): 26 — Height limit 21, Weight limit 3, No lorries 2. Nearest:
- Height limit 4 m — Tunisstraße, Unterführung Komödienstraße, direction “Norden” (0.2 km)
- Height limit 3.8 m — Nord-Süd-Fahrt, Unterführung Schildergasse, direction “Süden” (0.7 km)
- Height limit 4 m — Nord-Süd-Fahrt, Unterführung Cäcilienstraße, direction “Norden” (0.8 km)
Lorry route network (Stadt Köln, as of 2014-01-01), nearest section: secondary lorry connection for deliveries 0.2 km (Tunisstr., Ursulastr., Victoriastr.); primary lorry connection 1.3 km (Holzmarkt, Zu-/Abfahrt Severinsbrücke, Severinsbrücke); …
These lorry entries come from our database derived from “SEVAS (NRW.Mobidrom)” (ODbL 1.0; its geometry comes from OpenStreetMap). We send a complete machine-readable copy (CSV) under the ODbL 1.0 free of charge on request – contact details in the Impressum on viafrei.de.
```
New in 2.2.9 and 2.2.10. Each publisher gets its own nearest lines, so the city's
per-direction heights are no longer crowded out by SEVAS's. A SEVAS restriction
drawn on several road segments is counted and named once.
*Edited: the end of the network line, the closing line and the source line omitted.*
</details>

<details>
<summary><b>🚫 "Where are the lorry bans in Dresden?"</b> — <code>check_road_status</code> with <code>vehicle: "lorry"</code></summary>

```text
Lorry restrictions within 5 km of Dresden Altmarkt (Landeshauptstadt Dresden): 1 — No lorries 1. Nearest:
- No lorries over 3.5 t (sign 253) (0 km); additional sign „Dienstleister, Anlieferer und Wohnmobile frei“
Lorry route network (Landeshauptstadt Dresden), nearest section: lorry priority route 1.6 km. This is the network the city routes lorry traffic over; later rules, such as through-traffic bans, are not shown in it — not an all-clear: the signs on site apply.
Current closures and roadworks: the same question without vehicle.

As of 03:41 · Source: Lkw-Verbotszonen: Landeshauptstadt Dresden (Quelle: Geodaten Sachsen), Datenlizenz Deutschland – Namensnennung – Version 2.0 (…), bearbeitet (…) · Lkw-Vorrangroutennetz: Landeshauptstadt Dresden (Quelle: Geodaten Sachsen), … · …
Lorry bans are shown here as information, not legal advice: only the signs on site say whom and when a ban binds.
```
New in 2.2.10. The city's ban zone is one ban, stated as the city's record states
it; the additional sign is quoted in German, as it is signed. The last line is the
condition note that travels with every such answer as `_meta.conditionNote`.
*Edited: the source URIs shortened to (…).*
</details>

<details>
<summary><b>🏗️ "Can my heavy transport go through Hamburg Hbf?"</b> — <code>check_road_status</code> with <code>vehicle: "lorry"</code></summary>

```text
Lorry restrictions around Hamburg Hbf: no data. We hold them only where a publisher publishes them (so far NRW.Mobidrom for North Rhine-Westphalia, ivm for the Frankfurt RheinMain region, VMZ Bremen for Bremen and Stadt Köln and Landeshauptstadt Dresden, each for its own city area) — this is not an all-clear.
Oversize and heavy transport network (Landesbetrieb Verkehr Hamburg), nearest section 0.4 km (Kreuzweg, Steindamm, Deichtorplatz) — an aid for the application in VEMAGS, no permit.
Current closures and roadworks: the same question without vehicle.
…
The oversize and heavy transport network helps with an application in VEMAGS and is no permit: an oversize or heavy transport needs its own permit or authorisation (§ 29(3), § 46(1) StVO), and the signs on site apply. The network is the LBV's compilation of the routes most often needed; it names no permitted dimensions, weights or axle loads, and the route a transport may take is the one its permit sets.
```
New in 2.2.10. "No data" for the restrictions is said as what it is, and the
network is never presented as a permission.
*Edited: the source line omitted.*
</details>

<details>
<summary><b>♿ "Is Frankfurt Konstablerwache step-free?"</b> — <code>check_station_facilities</code></summary>

```text
2 of 14 reported facilities at Frankfurt (Main) Konstablerwache are out of service. Counted are the facilities DB reports for this station. The platform details are from DB's station data, as of 2026-10-19. …
…
Platforms at Frankfurt (Main) Konstablerwache per DB's station data: 2 of 2 step-free. The station as a whole: step-free, wheelchair accessible.
Platform 2 (Bahnsteig Gleis 2): step-free · wheelchair accessible · platform height 96 cm · tactile guidance · level boarding into the train: unknown
Platform 3 (Bahnsteig Gleis 3): step-free · wheelchair accessible · platform height 96 cm · tactile guidance · level boarding into the train: unknown

Traffic signals within 300 m: 6, 3 of them with an acoustic signal for blind pedestrians: Konstabler Wache/Kurt-Schumacher-Straße (60 m); Berliner Straße/Battonstraße/Kurt-Schumacher-Straße (240 m); Battonstr./Klingerstr./Stoltzestr. (270 m)
```
New in 2.2.9 (the platforms, from DB InfraGO's station inventory) and 2.2.10 (the
acoustic signals, from Stadt Frankfurt am Main). "Unknown" is said as unknown, never
as no. A tram or U-Bahn stop named with its city, such as "Stuttgart
Charlottenplatz", is answered as that stop, with the sentence that we hold no lift
status and no survey for it where that is so.
*Edited: the rest of the first line, the fourteen escalator lines and the source
line omitted.*
</details>

<details>
<summary><b>🌿 "Is Essen Hbf inside the low-emission zone?"</b> — <code>get_driving_rules</code> with <code>place</code></summary>

```text
Low-emission zone and plaque — Essen Hbf:
Essen Hbf lies inside the Umweltzone Essen (Umweltzone).
Required: the green plaque (emission group 4). You can buy it at vehicle registration offices, TÜV/DEKRA/GTÜ/KÜS and approved garages on presentation of the vehicle registration document (part I). (Umweltbundesamt, Umweltzonen in Deutschland; not confirmed: exactly which cities belong to the Ruhr zone today — check the source)
Zone boundary last read on 2026-10-19.
…
```
New in 2.2.10, for Essen and Bochum. The point is checked against the city's own
polygon, credited "Umweltzone: Datenquelle: Stadt Essen – opendata.essen.de,
Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet", with the
Umweltbundesamt's agreeing zone credited beside it.
*Edited: the general rules that follow and the source line omitted.*
</details>

<details>
<summary><b>🇬🇧 "Is the A59 closed anywhere?"</b> — <code>check_autobahn_traffic</code> with <code>language: "en"</code>, and the <code>gist</code> of each entry</summary>

```text
A59, road-wide: 0 jams, 12 closures, 22 roadworks sites; announced from 10:00: 3 closures, 17 roadworks sites — As of 06:09. Traffic state at 53 measuring sites (NRW, as of 06:08): 4 slow, 5 heavy, 44 free-flowing; standstill or slow near Düsseldorf-Garath, Monheim, Richrath.
• Closure (Sperrung): A59, since 2026-10-05 00:00, until 2026-10-23 12:00 (whole measure until 2031-12-23) — Provider text (German): "A59 6-streifiger Ausbau AK DU - AS DU-Marxloh · AK Duisburg (aus Richtung Duisburg-Häfen) — Zeitraum dieser Bauphase: […] Ende: 23.10.26 um 12:00 Uhr …"
…

structuredContent.events[0].gist:
Closure on the A59; since 2026-10-05, until 2026-10-23 12:00, whole measure until 2031-12-23.
```
New in 2.2.8 and 2.2.9. The gist is built only from fields we already parse (kind,
road, junctions, direction, length, limits, dates, distance), so it never
translates the publisher's words. For a works in phases it ends with the current
phase and names the whole measure's end as such. A German answer carries no gist.
*Edited: two entries and the source line omitted; the gist is quoted from the
structured result.*
</details>

<details>
<summary><b>🧯 A call that fails says why — <code>_meta.errorCode</code></b></summary>

```text
find_parking {place: "Xyzzyqwertstadt"}
→ isError: true · _meta.errorCode: "not_found"
  I do not know "Xyzzyqwertstadt". Name a town, a district or a stop — or pass lat/lon.

check_autobahn_traffic {road: "A59"}   (the argument is "roads", a list)
→ isError: true · _meta.errorCode: "invalid_input"
  MCP error -32602: Input validation error: Invalid arguments for tool check_autobahn_traffic: Invalid input: expected array, received undefined at roads
```
New in 2.2.13. Every error result carries one code from a closed list of seven
(`invalid_input`, `not_found`, `out_of_coverage`, `unavailable`, `limit_reached`,
`timeout`, `internal`), so a client can tell "ask differently" from "try later"
without reading the sentence.
*Edited: shown as the two results' fields, not as the raw JSON-RPC frames.*
</details>

<details>
<summary><b>🚚 "Darf der Lang-Lkw auf die A7?"</b> — <code>check_road_status</code> with <code>vehicle: "long_lorry"</code></summary>

```text
The A7 is listed in the long-lorry positive network:
- BASt extract, amending ordinance no. 13, network as of uebw. 2025q2: 180 sections, 965.8 km
- Hamburg's field-trial network, as of 2015: 29 sections, 39.5 km
What binds is the Annex to § 2(1) of the LKWÜberlStVAusnV, not this extract.
Current closures and roadworks: the same question without vehicle.

As of 06:43 · Source: Lang-Lkw-Netz: Bundesanstalt für Straßen- und Verkehrswesen (BASt), Positivnetz Lang-LKW (Auszug Bundesfernstraßen), CC BY 4.0 (…), bearbeitet (…) · Lang-Lkw-Netz Hamburg (Feldversuch 2015): Freie und Hansestadt Hamburg, Behörde für Verkehr und Mobilitätswende, (BVM), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert (…)
The data make no claim to be complete or correct. They have no legal or official meaning either. The data are not suitable for navigation or similar purposes (our translation of the publisher's notice).
```
New in 2.2.6. The "As of" time is when the files were last read: the network is
published as a release, not live. The last line is BASt's own notice. It travels
with every such answer as `_meta.conditionNote`, and your assistant should show it.
*Edited: the source URIs shortened to (…).*
</details>

<details>
<summary><b>🌉 "Which height limits are there for lorries in Bremen?"</b> — <code>check_road_status</code> with <code>vehicle: "lorry"</code></summary>

```text
Lorry restrictions within 5 km of Bremen (VMZ Bremen): 31 — Height limit 19, Weight limit 12. Nearest:
- Height limit “Tiefer 4,0m” (0.3 km)
- Weight limit “aktuell nicht für die Nutzung schwerer Lkw empfohlen” (no value stated, the signs on site apply) (0.3 km)
- Weight limit “Wilhelm-Kaisen-Brücke: >16t” (0.4 km)
- Weight limit “Bgm.-Smidt-Brücke-Brücke: >30t” (0.7 km)
- Height limit “Gustav-Deetjen-Tunnel: 3,1m” (0.9 km)
- Height limit “Parkallee (Remberti-Tunnel): 3,5m” (0.9 km)
…
VMZ Bremen's heights and weights are shown as published (read on 2026-10-19). Only the signs on site are binding; the data is not for route guidance. A missing entry does not mean there is no restriction.
```
Every height and weight is quoted in the publisher's own words and never turned
into a number of ours. Where the words give no figure, the answer says that no
value is stated.
*Edited: the source line omitted.*
</details>

<details>
<summary><b>🚛 "Gibt es Lkw-Durchfahrtsverbote bei Bielefeld?"</b> — <code>check_road_status</code> with <code>vehicle: "lorry"</code></summary>

```text
Lkw-Beschränkungen im Umkreis von 5 km um Bielefeld (NRW.Mobidrom (SEVAS)): keine verzeichnet. Das ist keine Freigabe: es gilt die Beschilderung vor Ort.
Lkw-Vorrangrouten: 1 im Umkreis, die nächste in 0,1 km.
Diese Lkw-Einträge stammen aus unserer aus „SEVAS (NRW.Mobidrom)“ abgeleiteten Datenbank (ODbL 1.0; die Geometrie stammt aus OpenStreetMap). Eine vollständige, maschinenlesbare Kopie (CSV) unter der ODbL 1.0 senden wir auf Anfrage kostenlos – Kontakt im Impressum auf viafrei.de.
Aktuelle Sperrungen und Baustellen: dieselbe Frage ohne vehicle.

Stand 06:45 · Quelle: Lkw-Navigationsdaten NRW: NRW.Mobidrom GmbH (SEVAS), Datenlizenz Deutschland – Zero – Version 2.0; Geometrie: © OpenStreetMap-Mitwirkende, Open Database License 1.0 (opendatacommons.org/licenses/odbl/1-0/) (…) · Ortsdaten: © GeoNames (CC BY 4.0), bearbeitet (…)
```
"None listed" is said as what it is: no restriction is recorded, which does not
clear the road. The third line is the ODbL offer for the SEVAS rows (see
[SOURCES.md](SOURCES.md#and-the-share-alike-lorry-and-stop-access-databases)).
*Edited: the source URIs shortened to (…).*
</details>

<details>
<summary><b>🌿 "Is Marienplatz in Munich inside the low-emission zone?"</b> — <code>get_driving_rules</code></summary>

```text
Low-emission zone and plaque — München Marienplatz:
München Marienplatz lies inside the Umweltzone München (Umweltzone).
Required: the green plaque (emission group 4). You can buy it at vehicle registration offices, TÜV/DEKRA/GTÜ/KÜS and approved garages on presentation of the vehicle registration document (part I). (Umweltbundesamt, Umweltzonen in Deutschland; not confirmed: whether an additional diesel ban applies and to which Euro classes — check the source)
Zone boundary last read on 2026-10-19.
…
```
The point is checked against the city's own zone polygon. München's line,
"Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de
(bearbeitet)", is credited beside our rules text.
*Edited: the general rules that follow and the source line omitted.*
</details>

<details>
<summary><b>🚦 "How is the traffic around Bonn right now?"</b> — <code>check_road_status</code></summary>

```text
Note: the source "Arbeitsstellen auf deutschen Autobahnen (BASt)" has not republished since 2026-10-06 (12 days) — information from it may be out of date.
Bonn: 5 jam reports, 46 closures, 844 restrictions, 0 planned roadworks sites, 14 current roadworks sites per BASt — window: right now.
I do not hold federal and Land roads (Bundes-, Landes-/Staatsstraßen) for North Rhine-Westphalia: for those, this answer is no all-clear.
Measured traffic state (City of Bonn, Amt 66 (traffic state), as of 07:25) within 10 km: 111 segments: risk of congestion: 2, increased traffic load: 10, normal traffic volume: 68, not measured: 31 — nearest segment (risk of congestion) 1.3 km away.
• Traffic jam (Stau): Provider text (German): "A555 Bonn Richtung Köln, zwischen Rodenkirchen und Kreuz Köln-Süd, 1 km Stau" (since 06:26; 18.5 km away)
…
```
The fourth line is the city's own measurement, new in 2.2.6, in the city's own
class names. "Not measured" is never counted as free. The first line comes from
2.2.4: a source that has stopped republishing is named in the answer instead of
being passed off as current.
*Edited: the remaining entries and the source line omitted.*
</details>

<details>
<summary><b>♿ "Is there a free disabled parking bay near Dortmund's Hansastraße?"</b> — <code>find_parking</code> with <code>kind: "disabled_badge"</code></summary>

```text
Disabled-badge bays on the street around Dortmund (within 10 km), nearest first:
1. Hansastraße 9, 44137 Dortmund — 0.2 km, free (sensor, 06:45)
2. Hansastraße 20-22, 44137 Dortmund — 0.2 km, free (sensor, 06:54)
3. Gerberstraße 5, 44135 Dortmund — 0.2 km, no current sensor reading (last 2026-10-18 19:12)
…
Within the radius: 175 disabled-badge bays with a sensor, 62 reported free and 19 occupied; the rest have no current reading.
For holders of a disabled parking permit only. "No current sensor reading" means unknown, not free.

As of 06:54 · Source: Parksensoren Dortmund: Stadt Dortmund (Dortmunder Systemhaus – Smart City), Open Data Dortmund, Datenlizenz Deutschland – Zero – Version 2.0 (…) · …
```
New in 2.2.4. A sensor's state counts for three hours after the city's newest
message. After that it is unknown, and unknown is never free.
*Edited: two of five lines and most of the source line omitted.*
</details>

<details>
<summary><b>🛗 "Is Tübingen Hbf step-free?"</b> — <code>check_station_facilities</code></summary>

```text
2 of 2 reported facilities at Tübingen Hbf are out of service. Counted are the facilities DB reports for this station. Lifts at stops of the city's transport operator (tram, light rail, underground) are not included — I hold no live data on them for this station.
Lift zu Gleis 1/13: out of service — under construction
Lift zu Gleis 2/3/12: out of service — under construction

Step-free access, from the Baden-Württemberg survey (BFRK, Tübingen Hbf): 7 platforms, 1 with a tactile guidance strip; 3 lifts, narrowest door 99 cm, cabins at least 94 cm wide and 220 cm deep; 5 ramps, steepest 6.1 %; 11 staircases. Unchecked raw survey data, file dated 2026-09-18. It says nothing about whether a lift is working now.
…
```
DB's live lift states come first. The survey block is new in 2.2.5, and it says
what is built, not what works.
*Edited: the source line omitted.*
</details>

<details>
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

Since 2.4.2 every card refreshes in place (the ↻ on its heading, and the live
cards on their own at the pace of their data) without reloading the page, long
cards page through to their end, and a topic filter with *All* and *None* chooses
which cards the home shows; it works without JavaScript and never hides a warning
silently. A visitor outside Germany is shown the nearest German town near the
border, or Germany as a whole when too far away.

Since 2.4.5 the first screen says which place it shows ("Live for Kassel ▾", with
*All of Germany* beside it), and the place search finds districts, postcodes and
streets, since 2.4.8 points of interest by name, and since 2.4.9 a street with a
house number typed without a town. A place page carries a **traffic light for the place**:
the motorway pages' rule applied to the place's own cards, with each reason linked
to its row and drawn on a map of the place. The map marks parking, charging,
stations and the DWD warning ring by kind, each mark a link to its row, and since
2.4.7 it draws OpenStreetMap's streets under the marks. When the topic filter hides
a card, its marks leave the map and the light says it took a reason from a hidden
card. On 2026-10-29 the page for Kassel read "Traffic light: Yellow", with a DWD
level-1 fog warning and roadworks narrowing the road as its reasons, and a 5 km map
with 17 marks. The light is one per place: the Autobahn card on a place page no
longer shows one of its own.

Each station on the transit card has a line of its own, linking its station page: how many of its lifts and
escalators run, each one out of service by name, the platforms the timetable marks
step-free, and the car parks and P+R sites within 300 m. The weather card shows
the nearest road-weather station's next six hours, and the fuel card names the two
nearest hydrogen stations within 25 km.

**Why the source line matters.** Every answer ends with one, and it is the
licence speaking: show it to whoever reads the answer. Copy the line the server
sends you, not the ones on this page, which are shortened. See
[Using the data you get back](#-using-the-data-you-get-back).

## 🛣️ Motorway pages

Every motorway in Germany has a page of its own, 122 of them, in 22 languages: the
index is at **[viafrei.de/en/autobahn](https://viafrei.de/en/autobahn)** (German:
[viafrei.de/de/autobahn](https://viafrei.de/de/autobahn)), and a motorway is its
number in lower case — the A7 is
**[viafrei.de/en/autobahn/a7](https://viafrei.de/en/autobahn/a7)**, and
[viafrei.de/fr/autobahn/a7](https://viafrei.de/fr/autobahn/a7) in French. The route
words are the same in every language and only the language token changes;
"autobahn" is used everywhere, and the older `/en/motorway/…` addresses redirect. A
spelling such as `A 7`, `a07` or `BAB7` takes you to the same page.

What the A7's page holds, from top to bottom:

- **A traffic light** for the whole road, by the same rule `check_autobahn_traffic`
  uses, with its reasons listed and linked to their rows ("Jam, 47 min delay ·
  Bad Bramstedt - Kaltenkirchen · Flensburg → Hamburg"), and a short "how the
  traffic light is set" that names what it reads and what gives no colour (detours,
  border crossings, lorry networks, parking and charging).
- **Around you**, when you share your position (rounded to about 500 m on your
  device), choose a place or one is guessed from the network: what lies within a
  radius you choose (1 to 100 km), nearest first, the nearest junction with its
  number, distance and a map link, "you are here" between two junctions with
  ahead/behind badges, and the traffic light for that stretch. The radius is kept
  in the address, never on the device.
- **Cards you choose**: one card per kind — closures, jams, other warnings,
  roadworks, planned closures, police and Land messages, bridges, detours, border
  crossings, DWD warnings, the road-surface forecast, parking, charging, cameras and
  fuel — with checkboxes. The cards, their counts and the map follow without a
  reload, and the choice can stand in the address (`?show=`). The traffic light
  still judges everything and says when the choice hides some of its reasons.
  The panels stand in order of usefulness, each with an icon, and the empty ones fold
  into one line.
- **How fresh each panel is**, as a shape and a word, never colour alone: live,
  delayed, stale (the panel keeps its data and says it may be out of date) or
  reference data with its date, beside the Berlin time of the source's last good
  read. A panel whose read failed says so, never "nothing reported".
- **Search**, as you type: junctions, Länder and every panel row by row, with umlauts,
  case and the usual abbreviations (AS, AK, AD, Kreuz, Dreieck) folded, each hit
  linking to its row. Without JavaScript the same search is a plain form. The index
  search also takes a town or a junction: "Kassel" lists the A7, the A44 and the A49
  with the matching junctions.
- **The towns along the route**: every town within reach of an exit, in road order,
  at its nearest exit, the large ones first, each linking to its exit and to its place
  page on viafrei.de, and to its official website where Wikidata states one.
- **The crossing motorways**: each interchange and triangle names the motorways it
  meets, each linked to that motorway's page centred on the same junction, with the
  traffic light that page shows there. Since 2.4.3 the page also names the related
  motorways it does not cross, such as a spur or the road that bridges a gap in it.

- **One sentence about the road**, built from its own data: from Füssen to
  Flensburg/Harrislee, about 928 km on the schematic line, the Länder it crosses in
  road order and how many junctions and interchanges it has, followed by what is
  reported now, with its time. Every figure in it links to its panel. On 2026-10-14 the English page read: "The A7 runs
  from Füssen junction to Flensburg/Harrislee junction, about 928 km long
  (schematic), through Bavaria, Baden-Württemberg, Hesse, Lower Saxony, Hamburg
  and Schleswig-Holstein, with 141 junctions and interchanges (24 of them
  interchanges). Reported on the A7 now: 21 closures, 0 jams, 118 roadworks (as
  of 22:37)."
- **A map**, drawn on the server: Germany's outline and the Länder from the BKG's
  VG2500, the motorway as a schematic line through the junctions of BASt's Location
  Code List, closures solid, roadworks hatched, jams with their delay. A map zoomed
  below 25 km also draws the Land and Kreis borders from the BKG's VG250. Where the
  list has no course for a stretch the line breaks, and the page names the break
  rather than drawing across it. Since 2.4.7 the map also draws OpenStreetMap's
  streets as thin lines under its marks (never an OpenStreetMap motorway: the
  motorway is BASt's line), with the streets' own credit and our offer of the street
  database beside it; no mark is placed on or measured along a street.
- **What is reported now**: closures, jams and roadworks under their own heading,
  then the **full closures planned for the next seven days**, soonest first, each
  with the signed detour where Baden-Württemberg publishes one. Since 2.4 every
  entry says where it is (the stretch between two junctions, the nearest town and
  Land, each a link), in which direction, when (with the weekday and "runs now" or
  "in 6 days"), what it means for a driver and what the work is in plain words, with
  a map link. Long cards show twelve entries and fetch the rest when you open the
  fold; without JavaScript the same fold is a link.
- **The junction strip**: every junction, interchange and triangle in order, with
  its counts. A form filters the page by stretch (from, to), direction and layer,
  and works without JavaScript. Each interchange names and links the motorways it
  meets, and a chosen stretch gives its own length.
- **Parking and rest**: truck stops, lorry parks and service areas with live free
  spaces where the operator publishes them, and car parks; the share-alike sources
  (Trucklounge, P+R NRW, and OpenStreetMap's car parks at the junctions) in blocks
  of their own. Each site shows the amenities its own publisher states ("Facilities
  per the publisher: toilet · shower · restaurant · fuel station"), and the card can
  be narrowed to sites with lorry spaces, free spaces now, or a stated amenity; it
  says how many sites state any ("34 of 50 sites state any facilities — for the rest
  they are unknown, not ruled out"). A second group of filters uses what
  OpenStreetMap shows near a site, with its licence line, and never counts it as
  the site's own. The occupancy of the rest areas from Toll Collect's
  Stellplatz-Informationsdienst appears only after you press "Show occupancy" and
  so accept the [terms of use](https://viafrei.de/en/terms#sid), section 2.
- **Along the road**: the police and Land traffic messages for the Länder that
  publish them, Schleswig-Holstein's bridge states, the signed detours of North
  Rhine-Westphalia, Baden-Württemberg and Hamburg, Brandenburg's border crossings,
  and the lorry networks of SEVAS (NRW) and ivm (Frankfurt RheinMain) with their
  database licence offer, each with a line saying where it is covered. A message
  carried by several sources is shown once, with all of them.
- **Charging**: the chargers along the road with their status, the sites by power
  class, and the **longest stretch with no charger of 150 kW or more**. It says
  where chargers are, never that one is free unless its operator says so. Since
  2.4.3 a filter bar narrows the card by operator, plug, power band and "free now",
  with counts, the same rule `find_charging_station` uses.
- **Weather**: the DWD's official warnings along the road and the road-surface
  forecast of its road-weather stations.
- **Traffic cameras**, as links to the publisher's images.
- **Fuel prices**, loaded by your browser when the fuel card comes into view: the
  page's HTML carries none, a crawler never sees one, and the card shows at most ten
  stations, each price with its time and the MTS-K note.
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
description in each of the 22 languages ("A7 Germany: traffic jams, roadworks, map"), the
motorway sitemaps list every page in every language, and
[llms.txt](https://viafrei.de/llms.txt) and
[llms-full.txt](https://viafrei.de/llms-full.txt) describe the pages;
llms-full.txt also lists every motorway page in English and German. [robots.txt](https://viafrei.de/robots.txt) keeps the AI training and
corpus crawlers off the fuel page, names them one by one, and leaves the motorway
pages open to every crawler, the place pages since 2.4.0, and the station and exit
pages from their first release. No fuel price is in
any page's HTML: a reader's browser asks for the prices when the card comes into
view, and that address is closed to every crawler.

## 🚉 Station and exit pages

**Every railway station has a page**, 6,513 of them on 2026-10-29, in the same 22
languages: the stations in DB's station directory and, since 2.4.5, the ones it does
not list, found in the timetable. The index is at
**[viafrei.de/en/station](https://viafrei.de/en/station)**, and a station is its name
as an address, so Berlin Alexanderplatz is
**[viafrei.de/en/station/berlin-alexanderplatz](https://viafrei.de/en/station/berlin-alexanderplatz)**.
A station page shows, from the same data the tools read:

- **the departure board and the arrivals**, with platform, delay and cancellations,
  and since 2.4.5 filters for mode, departures or arrivals, platform or stand,
  destination, time, disruptions only and step-free only, which since 2.4.6 apply as
  you choose them. Only a real track number stands under "platform", a train that
  splits is one row, and every station a row names links to its page. The live part
  refreshes in place;
- **at an interchange, its U-Bahn, Stadtbahn and trams**, and every line that calls
  there;
- **the lifts and escalators**, every one of them, each joined to the platforms it
  serves, with the ones out of service named;
- **the service alerts** that concern it;
- **parking and charging at its door**, with the same filters as the charging card;
- **around the station**: since 2.4.5 the place cards of the station's own
  position and the place traffic light with its map, and pharmacies, food, cash
  machines and hotels nearby, the motorways and the other stations near it.

Every block says how fresh it is, with the same sign as the motorway panels. A part
that is slow to answer loads in place, and the page is never an error because of
it. The home page has a block of the **stations most affected right now**, with a
station search beside it. Each page's title names departures, platforms, lifts and
disruptions in its language, and its heading names the station with its town.

**Every motorway exit has a page of its own** since 2.4.1, under its motorway: the A3's
junction Breitscheid is
[viafrei.de/en/autobahn/a3/exit-16-breitscheid](https://viafrei.de/en/autobahn/a3/exit-16-breitscheid).
It is the motorway's page opened at that junction, with its title and a map above
the fold: the traffic light, what is reported, the junction's surroundings, parking,
charging, the towns along the route and the questions your assistant can answer
there. The exits
with enough to say are listed in their own sitemaps, about 1,700 per language.

## 🔌 Connect in one minute

The product is a **hosted MCP server**. Point your client at it and the tools
appear. There is nothing to install, no key to request and no quota to
negotiate. Step-by-step guides for each assistant:
**[viafrei.de/en/connect](https://viafrei.de/en/connect)**.

**Claude Code**
```bash
claude mcp add --transport http viafrei https://mcp.viafrei.de/mcp
```

**claude.ai and the Claude desktop app** — Customize → Connectors → "+ Add" → *Add
custom connector*, name it ViaFrei and paste this address as the server URL. The
connector lives in your Claude account, so the desktop app has it too:
```
https://mcp.viafrei.de/mcp
```

**ChatGPT** — Plugins → "+" → *Add custom MCP server*, name it ViaFrei, paste the
address under "Connection", authentication none, then *Create as a plugin*; in a new
chat type @ and pick ViaFrei. Custom MCP servers work in ChatGPT on the web, for Pro
users and in Business and Enterprise/Edu workspaces, not in the mobile apps and not
on Free or Plus.

**Cursor, and any client with an `mcpServers` file that takes a `url`**, over HTTP:
```json
{ "mcpServers": { "viafrei": { "url": "https://mcp.viafrei.de/mcp" } } }
```

**VS Code** (`.vscode/mcp.json`, or *MCP: Add Server* from the command palette):
```json
{ "servers": { "viafrei": { "type": "http", "url": "https://mcp.viafrei.de/mcp" } } }
```
For **GitHub Copilot** in VS Code, *MCP: Add Server* → HTTP → the address → server
ID `viafrei` → *Global* → *Copilot Global* writes the same entry to Copilot's own
configuration.

**Gemini CLI**, **OpenAI Codex**, **Windsurf** and **Mistral Le Chat**:
```bash
gemini mcp add --scope user --transport http viafrei https://mcp.viafrei.de/mcp
codex mcp add viafrei --url https://mcp.viafrei.de/mcp
```
Windsurf takes `{ "mcpServers": { "viafrei": { "serverUrl": "https://mcp.viafrei.de/mcp" } } }`
in its `mcp_config.json`, and Le Chat a *Custom MCP Connector* with the address and
no authentication. The [connect page](https://viafrei.de/en/connect) has the steps
for each, a link to each client's official guide and how each was checked: on
2026-10-28 claude.ai, Claude Code, Gemini CLI, the MCP Inspector and this bridge were
connected for real, and the others were checked against their official guides.

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
- **Glama connector — [glama.ai/mcp/connectors/de.viafrei.mcp/via-frei](https://glama.ai/mcp/connectors/de.viafrei.mcp/via-frei).**
  The hosted endpoint as a Glama connector, ownership verified, with its health check.
- **mcpservers.org — [mcpservers.org/servers/mavrovde/viafrei-mcp](https://mcpservers.org/servers/mavrovde/viafrei-mcp).**
  The directory listing for this repository, in several languages.
- **Official MCP Registry — `de.viafrei/mcp`.** The hosted endpoint, as MCP
  clients and directories that read the [registry](https://registry.modelcontextprotocol.io)
  find it; [`server.json`](server.json) is the entry. It is republished with every
  release of this package, after the npm publish, and only when the live server
  reports the same version.
- **awesome-mcp-servers — [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers).**
  The largest curated list of MCP servers; ViaFrei is listed under Travel & Transportation.
- **awesome-remote-mcp-servers — [punkpeye/awesome-remote-mcp-servers](https://github.com/punkpeye/awesome-remote-mcp-servers).**
  The curated list of remote MCP servers; ViaFrei is listed with its hosted endpoint.
- **TensorBlock MCP Index — [tensorblock.co/mcp/servers/…](https://tensorblock.co/mcp/servers/github-mavrovde-viafrei-mcp-e9117452).**
  TensorBlock's searchable index of MCP servers, with a profile page for this repository.
- **TensorBlock awesome-mcp-servers — [TensorBlock/awesome-mcp-servers](https://github.com/TensorBlock/awesome-mcp-servers).**
  TensorBlock's curated list on GitHub; ViaFrei is listed under Travel & Transportation.
- **For AI tools — [viafrei.de/llms.txt](https://viafrei.de/llms.txt)** and
  [llms-full.txt](https://viafrei.de/llms-full.txt): what ViaFrei is, how to
  connect, every tool in one line each, the example questions with the tool that
  answers each, and the live pages (the motorway index, an example motorway page,
  the place pages); llms-full.txt also lists every motorway page in English and
  German.

## 🧰 Everything it can do

<!-- catalogue:begin — generated by scripts/gen-readme-catalogue.mjs from catalogue.json; do not edit by hand -->

**22 tools, 9 prompts, 10 resources and 2 resource templates** — server 2.5.1, snapshot of 2026-10-30. Each line is the server's own words; the full parameters are in [API.md](API.md).

#### 🚗 On the road

| tool | what it answers |
|---|---|
| [`check_autobahn_traffic`](API.md#check_autobahn_traffic--autobahn-traffic) — Autobahn traffic | Per motorway (≤ 5): an Ampel verdict, then jams, closures, roadworks in force now, with place/delay/speed/map. |
| [`check_road_status`](API.md#check_road_status--road-status-and-closures) — Road status and closures | If a motorway/B/Land road (NI, NW, HE, BW, MV, SN, TH; B also SH, BY, BE; pass Land/town as place) is open/closed/restricted now/soon; by place, jams, city/Land messages, Hamburg traffic cameras; lorry limits, Lang-Lkw (vehicle). |
| [`find_roadworks_ahead`](API.md#find_roadworks_ahead--planned-roadworks) — Planned roadworks | Returns roadworks PLANNED on one motorway, one Bundes-/Landesstraße in NI, NW, HE, BW, MV, SN or TH (BY: B only), or city streets by place, in a date window: where, impact, dates, map links. |
| [`find_parking`](API.md#find_parking--parking-nearby) — Parking nearby | Parking near a place, a coordinate or along one motorway: lorry parks, car parks, P+R and disabled-badge bays, with total spaces, stated amenities (WC, shower) and published free spaces. |

#### 🚆 Public transport

| tool | what it answers |
|---|---|
| [`get_train_departures`](API.md#get_train_departures--train-departures) — Train departures | Next trains from a German railway station: platform, delay, cancellations. |
| [`get_departures`](API.md#get_departures--scheduled-departures-bus-tram-train) — Scheduled departures (bus, tram, train) | Scheduled departures from any German stop — bus, tram, U-Bahn, S-Bahn, train, ferry. |
| [`check_transit_disruption`](API.md#check_transit_disruption--public-transport-disruption-in-a-region) — Public-transport disruption in a region | How punctual public transport is now in one German region: the share of trips ever >5 min late, trips skipping a stop, trips cancelled, the trend and the service alerts in force there (diversions, closed stops). |
| [`check_station_facilities`](API.md#check_station_facilities--station-lifts-and-escalators) — Station lifts and escalators | Whether the lifts and escalators of a railway station or Köln Stadtbahn stop work now: each one, its place, state and reason. |

#### ⚡ Charging and fuel

| tool | what it answers |
|---|---|
| [`find_charging_station`](API.md#find_charging_station--ev-charging-nearby) — EV charging nearby | Returns EV charging sites near a place or coordinate: operator, plugs, max power, price per kWh where published, and how many points are free now where the operator publishes live status. |
| [`find_cheapest_fuel`](API.md#find_cheapest_fuel--cheapest-fuel-nearby) — Cheapest fuel nearby | Returns the cheapest stations for one fuel grade near a place or coordinate: price per litre, brand, address, distance, open state. |
| [`find_fuel_station`](API.md#find_fuel_station--find-a-filling-station) — Find a filling station | Finds filling stations around a place or coordinate under any combination of filters — grade, brand, name, open now, open at a time you name, open 24 h — sorted by distance, price or name. |
| [`find_hydrogen_station`](API.md#find_hydrogen_station--hydrogen-stations-nearby) — Hydrogen stations nearby | Returns hydrogen (H2) filling stations near a place or coordinate, nearest first, with operator, address, pumps (700 bar car, 350 bar truck/bus), opening hours where published and the age of the record. |

#### 📍 Places and addresses

| tool | what it answers |
|---|---|
| [`find_place`](API.md#find_place--look-up-a-place) — Look up a place | Looks up a place name and returns every match, each with its kind, population, English name and coordinate; the official key (AGS/RS) only in the structured result. |
| [`find_poi`](API.md#find_poi--find-a-named-place) — Find a named place | Finds a business or landmark by name or kind — company, shop, clinic, hotel, hostel — with address, category and coordinate. |
| [`find_address`](API.md#find_address--look-up-a-street-address) — Look up a street address | Looks up a street address: its coordinate, and the named OpenStreetMap objects at it (company, shop, office) or that none are. |
| [`describe_location`](API.md#describe_location--describe-a-coordinate) — Describe a coordinate | Turns a coordinate into words: the nearest address, settlement and motorway junction with their distances, and the Gemeinde, Kreis and Land the point lies in; also any low-emission zone. |
| [`find_nearby`](API.md#find_nearby--what-is-nearby) — What is nearby | Overview of what is around a place or coordinate: nearby fuel stations, EV charging, parking, the nearest railway station and motorway junction, each with its distance. |

#### 🚲 Sharing

| tool | what it answers |
|---|---|
| [`find_sharing`](API.md#find_sharing--shared-bikes-nearby) — Shared bikes nearby | Returns rentable shared bikes near a place or coordinate: bike-sharing stations with bikes and free docks now, and free-floating bikes around, with distance and data age (nextbike incl. KVB Rad, MyRadl, VAG_Rad; Donkey Republic). |

#### 🌦️ Weather and rules

| tool | what it answers |
|---|---|
| [`check_weather_warnings`](API.md#check_weather_warnings--weather-warnings-and-road-surface-forecast) — Weather warnings and road-surface forecast | Returns the official DWD weather warnings in force for a place — storm, snow, ice, heavy rain, thunderstorm, heat — with Warnstufe 1–4, area, validity and the official text unaltered. |
| [`get_driving_rules`](API.md#get_driving_rules--german-driving-rules) — German driving rules | Returns the German road rules a visitor needs: low-emission zones (Umweltzone) and the Feinstaubplakette, speed limits (advisory 130), winter tyres, alcohol, the Sunday lorry ban, tolls, Rettungsgasse, what must be in the car, electric cars. |

#### 🔔 Watches

| tool | what it answers |
|---|---|
| [`watch_situation`](API.md#watch_situation--watch-for-a-change) — Watch for a change | Opens a watch so THIS conversation is told when something changes: a road closed or restricted, a motorway jam, a stop running late, a weather warning, a charger freeing up. |
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

A third condition applies to one source only. **Truck-parking occupancy from Toll
Collect's Stellplatz-Informationsdienst (SID)** comes with terms that bind everyone
who receives the figures: they may be inaccurate, incomplete or out of date, there
is no warranty, and nobody may use them to identify a vehicle or a person. ViaFrei
passes them on only to a user who has accepted
[its terms of use, section 2](https://viafrei.de/en/terms#sid), which carry those
conditions. If you build on ViaFrei, let the user answer that question, never answer
it for them, and show the condition sentence the result carries with every figure.

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
