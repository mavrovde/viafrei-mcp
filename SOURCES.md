# Where the answers come from

Every answer the ViaFrei MCP server gives is built from **official open data**,
and every result says which source it came from. This page is the readable copy
of that list: who publishes each dataset, under which licence, what it feeds (which
tools, and which cards on [viafrei.de](https://viafrei.de/en)), what we hold back and
why, and the **attribution line** that has to travel with the answer. The lines are
shortened by one part here, for a reason given where they are printed.

It is not only a credits page. Several of these licences put obligations on
**you**, the person or product that receives a tool result, and two of them can be
breached without noticing. Those two come first, before the catalogue.

The authoritative, always-current register is the resource
**`viafrei://attribution`** on the server itself. Any MCP client can read it. If
this page and that resource ever disagree, the resource is right and this page is
stale: tell us and we will fix it. **Every row of the catalogue below was compared
with that resource as served by server 2.2.14 on 2026-10-20**: 237 sources. 219 of
them are held and answering, 12 are planned (licence read, nothing ingested yet),
five are discontinued and one, Berlin's park-and-ride sites, has **no data yet**.
The page was last compared at server 2.2.6, and 25 rows are new since then:
Hamburg's signed detours, signal installations, traffic counts, on-street bays and
coach places, its heavy-transport network, Köln's and Dresden's lorry data,
Frankfurt's acoustic traffic signals and disabled-badge bays, Kiel's car parks,
Essen's and Bochum's zone boundaries, and road context from Brandenburg,
Schleswig-Holstein, Karlsruhe, Aachen, München and Berlin. Of the rows that were
already here, eight changed status: ivm's two lorry feeds for Frankfurt RheinMain
are no longer held back and answer, Dresden's step-free stops and TU Chemnitz's
stop-accessibility export now answer, and smartlab's four charging publications
(ladenetz.de and ladebusiness) were ended by their publisher and are discontinued.
Four lines changed: both ivm lines now carry the dataset reference and change
notice ivm's terms prescribe, DB InfraGO's inventory line names the platforms it
now also feeds, and Duisburg's zone line names the city's portal. The website also
uses two sources the server's register does not list, named
[near the end](#the-websites-own-sources). Whatever the surfaces say, the answer you hold is the thing to read:
`_meta.sources` and the attribution lines on it are produced from the same result
you are looking at.

---

## Two obligations that bind the reader

### Fuel prices are consumer information only

Fuel prices come from **MTS-K**, the Markttransparenzstelle für Kraftstoffe at
the Bundeskartellamt, through Tankerkönig. German competition law
(§ 47k GWB) lets a consumer-information service receive them **for one purpose
only**: telling consumers what fuel costs right now.

What that means for you, in plain words:

- **Use a price to inform the person who asked, and for nothing else.** The
  MTS-K's own guidance (*Informationen der Markttransparenzstelle für
  Kraftstoffe zur Verwendung der von ihr zur Verfügung gestellten Daten*, Stand
  26 February 2025, read 2026-10-06) calls any other use unlawful and says the
  form makes no difference — "ob es sich um Echtzeit-Daten oder ältere Daten, um
  Rohdaten, umformatierte Daten oder aggregierte Daten handelt". Products built
  from the data, "beispielsweise Analysen", are caught too, and a third party
  that receives the data may use it "ebenfalls ausschließlich zu Zwecken der
  Verbraucherinformation".
- **Do not redistribute it.** Not the raw price, not a table, not a comparison,
  not an average, not a chart. That is **our** condition, and it is stricter than
  the guidance's wording on purpose: the guidance holds the supplier responsible
  for how its recipients use the data, and a copy passed on is a use nobody
  upstream can see any more.
- **Never let it reach the fuel industry.** Not mineral-oil companies, station
  operators, their trade bodies, and not the IT providers working for them
  (price reporters, till-system and fuel-card vendors, station IT) — the
  guidance names each of these. If your recipient might pass it on to that
  sector, you may not supply them either. Tankerkönig's own terms say the same
  of the data it hands out: it may be neither obtained by those companies "noch
  … an diese weitergegeben werden".
- The consequence of getting this wrong is not a style complaint: the guidance
  says misuse "kann zum Widerruf der Zulassung als VID-Anbieter führen" — the
  approved service loses its admission, and every service downstream of it,
  ours included, loses the data.

Every fuel answer that lists a price carries the MTS-K note as a sentence of its
own, to show beside the price. **On viafrei.de's motorway pages** the page itself
carries no fuel datum: a button loads at most ten stations along the road when a
person clicks it, each price with the time it was read and the MTS-K note
verbatim, and that request is closed to crawlers and kept out of every search
index. Since server 2.0 a fuel answer can also list
filling stations **we hold no price for**, from OpenStreetMap; those rows never
carry a price, so the MTS-K limit does not reach them, and the OpenStreetMap
section below does.

### Public-transport realtime is share-alike

Realtime public-transport data from **DELFI e.V.** is published under a Creative
Commons **Attribution-ShareAlike** licence, and there are **four** such feeds
behind the answers:

- the GTFS-RT Trip Updates (the live forecast per trip) — **CC BY-SA, no version stated**;
- the SIRI ET rail realtime — **CC BY-SA, no version stated**;
- the two disruption feeds, GTFS-RT Service Alerts and SIRI SX — **CC BY-SA 4.0**.

Not all public-transport data is share-alike. DELFI's static timetable and its
stop directory are **CC BY 4.0**, and so is VBB's own realtime feed, which answers
for Berlin and Brandenburg. The line on the answer says which one you have.

**Where the version is unstated, this page does not invent one** — see the
section on the realtime feeds below for what the catalogue and the access point
actually state. Treat the share-alike as applying; do not rely on a particular
version for a derivative. The server, for its part, licenses **its own**
adaptation of each of these feeds under CC BY-SA 4.0 and says so on the answer;
that is its choice for what it passes on, not a statement of the source's
version. Share-alike means the obligation travels:

- anything you derive from it — a table of delays, a punctuality figure, a
  screen that reuses the numbers — has to be offered under BY-SA too;
- **share-alike reaches adaptations, not aggregations.** If you *modify* the
  data — recompute it, reshape it, **rearrange** it, build a delay table or a
  punctuality series out of it — what you made is Adapted Material under
  art. 1(a), which names material "translated, altered, **arranged**,
  transformed, or otherwise modified", and you must license it under BY-SA
  (art. 3(b)(1)) and pass the licence URI on (art. 3(b)(2)). If you merely
  **show** it next to data from another source, that is an aggregation and no
  ShareAlike obligation touches the other source. Creative Commons' own position,
  on its wiki page *ShareAlike interpretation*: "The ShareAlike condition applies
  only for works considered adaptations under copyright law, not simply in
  collections with other works". The words quoted come from the **4.0** text,
  because 4.0 is the text we read (re-read 2026-10-06);
- the attribution line stays with it, either way.

**Where these feeds appear.** Since server 2.0.9 each departure in
`get_departures` carries **one live figure** where a live feed holds one — a delay,
"on time" or a cancellation — so buses, trams and the U-Bahn show live delays.
SIRI ET is used first, then the GTFS-RT Trip Updates; otherwise the row shows the
timetable time and says it is the plan. `get_train_departures` shows the same two
feeds in a block of their own when DB Timetables has no realtime for the station.
The timetable decides which departure a figure is about: a figure and the plan
meet in the answer and are never stored together. The Trip Updates also feed the
regional punctuality figure in `check_transit_disruption`, and the alerts are shown
only there, beside it. On viafrei.de, the live departures on a place card come from
the same feeds and carry the same lines; since server 2.1.10 the transit card's
punctuality figure for a place in Berlin or Brandenburg comes from VBB's CC BY feed
instead, by the tool's own rule, and then carries no share-alike sentence. The two
are never mixed into one figure.

**Our side.** The server keeps the SIRI ET calls and the service alerts as two
separate share-alike databases, joined to nothing else, and offers both, as CSV
with a note of our alterations, under CC BY-SA 4.0 and free of charge, on request
to the contact address in the Impressum on viafrei.de.

If that is not what you want for your product, ask for the same answer from a
source that is not BY-SA, or keep the two apart.

### And one that applies if you get an OpenStreetMap-derived result back

Some answers are built from **OpenStreetMap**, under the **ODbL 1.0**. Address and
point-of-interest lookups always are; so is any answer whose place our own
gazetteer could not resolve, because place resolution falls through to the OSM
tables; and so, since server 2.0, is a fuel answer that lists the nearest
OpenStreetMap filling stations we hold no price for.

You can tell which answers are affected without guessing, and the test is the
answer rather than the question: the result carries
`OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0` and names `osm` in
`_meta.sources`. What decides it is **which table answered**, not which tool you
called and not what your input looked like. A place the server resolved from its
own gazetteer does not carry the line, and neither does a station or a motorway;
a place it resolved from OpenStreetMap does — so **any** tool that takes a
`place` can come back with an OSM-derived answer. **Read `_meta.sources` and the
attribution line on the answer you actually got.**

ODbL's share-alike is on the *database*, not on the sentence: if you build your
own database out of address or point-of-interest results and use it publicly, you
owe your recipients the same offer we make. **Our side of that offer stands** —
ODbL § 4.6 — and the server states it in `viafrei://attribution`: ask, and you get
the complete contents of the OpenStreetMap tables we hold and our alterations to
them, under ODbL 1.0, free of charge, from the contact address in the Impressum on
viafrei.de. An issue on this repository reaches us too.

### And two parking sources that are share-alike

`find_parking` answers from many publishers (the full list is in the catalogue
below), and two of them are share-alike. Since server 2.1.12 the parking card on
viafrei.de shows them too, and since 2.1.15 so does every motorway page, always in
a block of their own:

- **P+R NRW** (NRW.Mobidrom, the bundled Park+Ride data for North
  Rhine-Westphalia) is **CC BY-SA**, with no version stated — the same
  share-alike reasoning as the DELFI realtime feeds applies;
- **Trucklounge Ecopark** (ENMO GmbH & Co.KG, lorry parking) is **ODbL 1.0** — a
  second share-alike *database*, separate from OpenStreetMap and never joined to
  it or to any other source.

The server keeps both apart from everything else rather than mixing them into one
list: the tool's own description says "ODbL and CC BY-SA sources are separate
lists (up to three)". Read `_meta.sources` and the attribution line on the answer
you got — `mobilithek_park_nrw_pr`, `mobilithek_park_trucklounge` and
`mobilithek_park_trucklounge_occ` are the ids to look for. If you keep those rows,
keep them apart too, and carry their licence with them.

For the ODbL database the server makes the same § 4.6 offer as for the OSM
tables, stated in `viafrei://attribution`: the database we use publicly — every
row and the full occupancy history, except the rows the publisher marks
confidential, which no answer uses either — and our alterations, under ODbL 1.0,
free of charge on request to the contact address in the Impressum on viafrei.de. The same request also gets the P+R NRW data under
CC BY-SA 4.0 — not an ODbL duty, the register says, but the same channel.

### And the share-alike lorry and stop-access databases

Three more sources are ODbL 1.0 *databases* of their own, because their geometry
is taken from OpenStreetMap. Each is kept apart: it is never joined to another
source, and its rows are listed per publisher.

- **SEVAS** (NRW.Mobidrom, lorry restrictions and priority routes in North
  Rhine-Westphalia's towns), live since server 2.2.6. Its attributes are
  Datenlizenz Deutschland – Zero 2.0, and its segments are OpenStreetMap ways.
  Wherever a SEVAS row answered, `check_road_status` with `vehicle` says that the
  rows come from our derived ODbL database and that a complete CSV copy is sent
  free of charge on request. The road card on viafrei.de says the same under its
  lorry block.
- **TU Chemnitz's VDV-462 export** (stop accessibility mapped in OpenStreetMap,
  project OPENER next). Since server 2.2.14's comparison it answers: its rows
  appear in a block of their own in `check_station_facilities`, and the same offer
  applies.
- **ivm Frankfurt RheinMain's lorry priority network**, live since server 2.2.7.
  Its sections are referenced on OpenStreetMap, so it is an ODbL database of its
  own, and an answer that used it names the offer, as a SEVAS answer does. ivm's
  lorry signs are dl-de/by-2-0 and are not part of that database.

Our side of the offer is the same as for the OpenStreetMap tables: the complete
contents of the database and our alterations, under ODbL 1.0, free of charge, from
the contact address in the Impressum on viafrei.de. If you keep such rows in a
database you use publicly, you owe your recipients the same.

---

## The catalogue

One row per id in `viafrei://attribution`, in the order of the groups below. The id
in the first column is the one that appears in `_meta.sources`; the line in the
second is the attribution line the answer carries, without the URI that follows it
in parentheses (why is explained [below](#the-sources-in-detail)). Each group's
heading row names what the group feeds: the tools, and the cards on viafrei.de. A
tool or a card shows a source only where that source holds something for the place
or road asked about, so a group's list is where it **can** appear, not a promise
that every answer carries it.

- **held** — the register lists the source as held: the data is collected and the
  tools named in its group can answer from it.
- **planned** — the register says "licence read, data not ingested yet". No answer
  can name it today; the row is here because a licence that has been read is part
  of the record.
- **discontinued** — the licence was read and the publisher has since closed the
  route to the data; nothing is held.
- **held back** — the data is collected or ready to be, and we keep it out of every
  answer, card and credit until a condition of its terms is met. Nothing of it
  reaches you.
- **no data yet** — switched on, but no read has succeeded yet, so nothing
  answers from it.

**Status is the register's, not a measurement**, with one exception: the row
marked no data yet was read from the server's own coverage resource,
`viafrei://coverage`, on 2026-10-20, because the register lists it like any other
source. The last time each source's
status was measured from answers was a round of 1,000 questions against server
1.8.17 on 2026-10-06, before most of the 2.0 sources existed; the
[test rounds](https://github.com/mavrovde/viafrei-mcp/wiki/Test-rounds) are published
in the wiki. As of the capture shipped alongside this page (server 2.2.14,
2026-10-20), it exposes twenty-two tools, twenty of them read-only. A routine
re-check of which sources answer leaves both fuel tools out — **`find_cheapest_fuel`
and `find_fuel_station`** — because Tankerkönig limits how often its interface may
be asked, and its terms say plainly that bulk retrieval is blocked and the key
deactivated. That would now mean **eighteen** live calls, the read-only tools
minus the two fuel tools, and it would measure less than a full round does.

Publication rhythm and freshness are not in the table: the server reports them per
feed, live, in the resource `viafrei://coverage`.

| Source id | Attribution line | Licence | Status |
|---|---|---|---|
| **Roads, traffic messages and roadworks** — feeds `check_autobahn_traffic`, `check_road_status`, `find_roadworks_ahead`, `watch_situation`; site: the road card (closures, jams, city and Land messages and works, Hamburg roadworks and cameras, BW detours, measured and counted traffic, and the street context of a place), the Autobahn card, the motorway pages (lists, map, junction strip, planned full closures with BW detours, the home's ten worst motorways) and long closures on the News page | | | |
| `autobahn` | Verkehrsdaten: Autobahn GmbH des Bundes | open, no licence text published | held |
| `mobilithek_bab_messages` | Verkehrsmeldungen: Die Autobahn GmbH des Bundes (Mobilithek), Nutzungsbestimmungen nach GeoNutzV, Daten verändert; Ortsangaben: TMC Location Code List der Bundesanstalt für Straßenwesen (BASt), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), bearbeitet | GeoNutzV | held |
| `bast_lcl` | TMC Location Code List (LCL 22.0): Bundesanstalt für Straßenwesen (BASt), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), bearbeitet | CC BY 4.0 | held |
| `mobilithek_roadworks_bast` | Arbeitsstellen: Bundesanstalt für Straßen- und Verkehrswesen (BASt) via Mobilithek, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `mobilithek_roadworks_ald_ni` | Arbeitsstellen Niedersachsen: Niedersächsische Landesbehörde für Straßenbau und Verkehr via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `mobilithek_roadworks_ald_sn` | Arbeitsstellen Sachsen: Landesamt für Straßenbau und Verkehr des Freistaates Sachsen (LASuV) via Mobilithek, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `mobilithek_roadworks_ald_th` | Arbeitsstellen Thüringen: © Thüringer Landesamt für Bau und Verkehr (TLBV) 2026 — GeoNutzV, Daten verändert | GeoNutzV | held |
| `bemas_bw` | Baustellen: Verkehrsministerium Baden-Württemberg (BEMaS) via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 | held |
| `bw_bedarfsumleitungen` | Bedarfsumleitungen: Verkehrsministerium Baden-Württemberg via MobiData BW, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `hh_bauweiser` | Baustellen (Bauweiser): Freie und Hansestadt Hamburg, Behörde für Verkehr und Mobilitätswende, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `hh_verkehrskameras` | Verkehrskameras: Freie und Hansestadt Hamburg, Behörde für Verkehr und Mobilitätswende, (BVM), Datenlizenz Deutschland – Namensnennung – Version 2.0 | dl-de/by-2-0 **plus a condition of use** | held |
| `mobilithek_nms_events` | Verkehrsmeldungen der Polizei: Landesbetrieb Straßenbau NRW (VIZ.NRW) via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `polizei_hamburg_lms` | Verkehrsmeldungen Hamburg: Polizei Hamburg – Landesmeldestelle, übermittelt im NMS-Gesamtdatensatz der VIZ.NRW via Mobilithek | dl-de/zero-2-0 | held |
| `mobilithek_traffic_bw` | Verkehrsmeldungen Baden-Württemberg: Landesmeldestelle für den Verkehrswarndienst Baden-Württemberg (Innenministerium Baden-Württemberg) via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 **plus a condition of use** | held |
| `mobilithek_traffic_berlin` | Verkehrsmeldungen Berlin: Senatsverwaltung für Mobilität, Verkehr, Klimaschutz und Umwelt Berlin via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `mobilithek_traffic_koeln_events` | Verkehrsereignisse Köln: Stadt Köln via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `mobilithek_traffic_sh` | Verkehrsmeldungen Schleswig-Holstein: Landesmeldestelle Polizei Schleswig-Holstein via Mobilithek, Open Data (freie Nutzung) | "Open Data (freie Nutzung)" — see below | held |
| `mobilithek_traffic_hannover` | Verkehrsmeldungen Hannover: Landeshauptstadt Hannover – Fachbereich Tiefbau via Mobilithek, Open Data (freie Nutzung) | "Open Data (freie Nutzung)" — see below | held |
| `mobilithek_roadworks_nlstbv` | Arbeitsstellen und Sperrungen Niedersachsen (außerhalb der Autobahnen): Niedersächsische Landesbehörde für Straßenbau und Verkehr via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `mobilithek_roadworks_bremen` | Baustellen Bremen: Verkehrsmanagementzentrale Bremen via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `mobilithek_traffic_kassel` | Verkehrsmeldungen Kassel: Stadt Kassel, Straßenverkehrs- und Tiefbauamt via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0, by the city's terms of use — see below | held |
| `mobilithek_traffic_leipzig` | Verkehrsmeldungen Leipzig: Stadt Leipzig, Verkehrs- und Tiefbauamt via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0, by the city's terms of use — see below | held |
| `mobilithek_traffic_ruesselsheim` | Verkehrsmeldungen Rüsselsheim am Main: © Stadt Rüsselsheim am Main 2026 — GeoNutzV, Daten verändert | GeoNutzV | held |
| `mobilithek_bridges_sh` | Brückenzustände Schleswig-Holstein: Landesbetrieb Straßenbau und Verkehr Schleswig-Holstein (LBV.SH) via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `mobilithek_traffic_koeln_static` | Verkehrslage Köln (Streckenabschnitte): Stadt Köln via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| `mobilithek_traffic_koeln_dyn` | Verkehrslage Köln: Stadt Köln via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| `mobilithek_traffic_nrw` | Verkehrsinformationen NRW: Landesbetrieb Straßenbau NRW (VIZ.NRW) via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| `mobilithek_traffic_nrw_einzel` | Verkehrsinformationen NRW (Einzelmeldungen): Landesbetrieb Straßenbau NRW (VIZ.NRW) via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| `mobilithek_traffic_hamburg` | Verkehrsmeldungen Hamburg: Polizei Hamburg – Landesmeldestelle via Mobilithek, Open Data (freie Nutzung) | "Open Data (freie Nutzung)" — see below | planned |
| `mobilithek_roadweather_sh_static` | Straßenwetter Schleswig-Holstein (Messstellen): Landesbetrieb Straßenbau und Verkehr Schleswig-Holstein (LBV.SH) via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| `mobilithek_roadweather_sh_dyn` | Straßenwetter Schleswig-Holstein: Landesbetrieb Straßenbau und Verkehr Schleswig-Holstein (LBV.SH) via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| `mobilithek_viz_berlin` | Baustellen und Sperrungen Berlin: Digitale Plattform Stadtverkehr Berlin / Baustellen, Sperrungen und sonstige Störungen von besonderem verkehrlichem Interesse, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `mobilithek_traffic_lms_berlin` | Verkehrsmeldungen Berlin: Landesmeldestelle Berlin (LMST BE) via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `berlin_planb` | Ereignisse im Straßenland: Land Berlin, Senatsverwaltung für Mobilität, Verkehr, Klimaschutz und Umwelt, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `mobilithek_roadworks_bayern` | Baustellen Bayern: © Bayerische Straßenbauverwaltung – Zentralstelle für Verkehrsmanagement 2026 — GeoNutzV, Daten verändert | GeoNutzV | held |
| `mobilithek_roadworks_mv` | Arbeitsstellen Mecklenburg-Vorpommern: © Landesamt für Straßenbau und Verkehr Mecklenburg-Vorpommern 2026 — GeoNutzV, Daten verändert | GeoNutzV | held |
| `mobilithek_sperrinfosys_sn` | Sperrungen und Umleitungen Sachsen — Quelle: Baustelleninformationssystem Freistaat Sachsen, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `mobilithek_detours_nrw` | Umleitungen Nordrhein-Westfalen: Landesbetrieb Straßenbau Nordrhein-Westfalen via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `mobilithek_los_nrw` | Verkehrslage Nordrhein-Westfalen: © Die Autobahn GmbH des Bundes 2026 — GeoNutzV, Daten verändert | GeoNutzV | held |
| `mobilithek_ald_14d` | Arbeitsstellen auf Autobahnen (14 Tage): Die Autobahn GmbH des Bundes | MIA via Mobilithek, eingeschränkte Nutzung, kostenfrei | "eingeschränkte Nutzung, kostenfrei", no licence text — see below | held |
| `kiel_baustellen` | Baustellen: © Landeshauptstadt Kiel, Amt für Bauordnung, Vermessung und Geoinformation, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `sh_baustellen` | Baustellen Schleswig-Holstein: © LBV.SH/CC BY 4.0; © Geokompetenz/LVermGeo SH/CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `bb_baustellen` | Baustelleninformationen: Landesbetrieb Straßenwesen Brandenburg, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `freiburg_baustellen` | Verkehrsrelevante Baustellen Freiburg — Datengrundlage: Stadt Freiburg, www.freiburg.de (Geodaten © Stadt Freiburg, geoportal.freiburg.de), Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `karlsruhe_tba` | Baustellen und Veranstaltungen: Stadt Karlsruhe, Tiefbauamt – Digitale Mobilität, über MobiData BW, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `frankfurt_verkehr` | Baustellen und Verkehrsmeldungen: Stadt Frankfurt am Main – Straßenverkehrsamt, www.frankfurt.de, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `duisburg_baustellen` | Baustellen: Daten der Stadt Duisburg, WBD, DVG, Nerra, Netze-Duisburg (© Stadt Duisburg; Amt für Bodenordnung, Geomanagement und Kataster), CC BY 3.0 DE, bearbeitet | CC BY 3.0 DE | held |
| `aachen_baustellen` | Baustellen: Stadt Aachen (2026), Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `ingolstadt_baustellen` | Baustellen: Stadt Ingolstadt, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `koeln_baustellen` | Genehmigte Baustellen: Stadt Köln, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `stuttgart_baustellen` | Baustellen: Landeshauptstadt Stuttgart, Stadtmessungsamt, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `muenster_baustellen` | Baustellen Münster — Datenquelle: Stadt Münster, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `dortmund_baustellen` | Baustellen Dortmund: Stadt Dortmund (Tiefbauamt), Open Data Dortmund, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `muenchen_baustellen` | Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de (bearbeitet) | dl-de/by-2-0 | held |
| `hh_verkehrslage` | Verkehrslage: Freie und Hansestadt Hamburg, Behörde für Verkehr und Mobilitätswende, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 | held |
| `bonn_verkehrslage` | Verkehrslage Bonn — Datenquelle: Bundesstadt Bonn, Amt 66, https://opendata.bonn.de (Daten verändert), CC BY | CC BY (version unstated) | held |
| `hh_verkehrszaehlung` | Verkehrszählung: Freie und Hansestadt Hamburg, Behörde für Verkehr und Mobilitätswende, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 | held |
| `berlin_verkehrsdetektion` | Digitale Plattform Stadtverkehr Berlin / Verkehrsdetektion Berlin, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 | held |
| `hh_bedarfsumleitungen` | Bedarfsumleitungen: Freie und Hansestadt Hamburg, Behörde für Verkehr und Mobilitätswende, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 | held |
| `hh_lichtsignalanlagen` | Lichtsignalanlagen: Freie und Hansestadt Hamburg, Landesbetrieb Straßen, Brücken und Gewässer, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 | held |
| `hh_tld` | Traffic Lights Data Hamburg: Freie und Hansestadt Hamburg, zuständige Behörde, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 | held |
| `sh_umleitungsstrecken` | Umleitungsstrecken Schleswig-Holstein: © LBV.SH/CC BY 4.0; © Geokompetenz/LVermGeo SH/CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `bb_grenzuebergaenge` | Grenzübergänge: © Landesbetrieb Straßenwesen Brandenburg, © Die Autobahn GmbH des Bundes, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `karlsruhe_winterdienst` | Winterdienst: Stadt Karlsruhe, Tiefbauamt – Digitale Mobilität, über MobiData BW, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `aachen_fussgaengerzonen` | Zugang Fußgängerzonen: Stadt Aachen (2026), Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `muenchen_lieferzonen` | Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de (bearbeitet) | dl-de/by-2-0 | held |
| `muenchen_3l_zonen` | Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de (bearbeitet) | dl-de/by-2-0 | held |
| **Lorry routes** — feeds `check_road_status` with `vehicle`; site: the lorry block on the road card | | | |
| `lorry_bast_langlkw` | Lang-Lkw-Netz: Bundesanstalt für Straßen- und Verkehrswesen (BASt), Positivnetz Lang-LKW (Auszug Bundesfernstraßen), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), bearbeitet | CC BY 4.0 **plus a condition of use** | held |
| `lorry_hh_langlkw` | Lang-Lkw-Netz Hamburg (Feldversuch 2015): Freie und Hansestadt Hamburg, Behörde für Verkehr und Mobilitätswende, (BVM), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `lorry_sevas_nrw` | Lkw-Navigationsdaten NRW: NRW.Mobidrom GmbH (SEVAS), Datenlizenz Deutschland – Zero – Version 2.0; Geometrie: © OpenStreetMap-Mitwirkende, Open Database License 1.0 (opendatacommons.org/licenses/odbl/1-0/) | **ODbL 1.0** (attributes dl-de/zero-2-0) | held |
| `lorry_hb_durchfahrtshoehen` | Daten: Verkehrsmanagementzentrale Bremen (ASV Bremen), dl-de/by-2-0, bearbeitet | dl-de/by-2-0 **plus a condition of use** | held |
| `lorry_hb_fuehrungshoehen` | Daten: Verkehrsmanagementzentrale Bremen (ASV Bremen), dl-de/by-2-0, bearbeitet | dl-de/by-2-0 **plus a condition of use** | held |
| `lorry_ivm_vorrangnetz` | Lkw-Vorrangnetz Frankfurt RheinMain: ivm Region Frankfurt RheinMain, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Lkw-Lotse Region Frankfurt RheinMain – Lkw-Vorrangnetz (Mobilithek-Datensatz …), Februar 2021: Darstellung für ViaFrei angepasst; Geometrie: © OpenStreetMap-Mitwirkende, Open Database License 1.0 (opendatacommons.org/licenses/odbl/1-0/) | **ODbL 1.0** (attributes dl-de/by-2-0) | held |
| `lorry_ivm_beschilderung` | Lkw-Beschilderung Frankfurt RheinMain: ivm Region Frankfurt RheinMain, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Lkw-relevante Beschilderung Region Frankfurt RheinMain (Mobilithek-Datensatz …), Dezember 2021: Darstellung für ViaFrei angepasst | dl-de/by-2-0 | held |
| `lorry_koeln_verbindungen` | Lkw-Verbindungen Köln: Stadt Köln, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `lorry_koeln_beschraenkungen` | Straßenbeschränkungen Köln: Stadt Köln, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `lorry_dresden_verbotszonen` | Lkw-Verbotszonen: Landeshauptstadt Dresden (Quelle: Geodaten Sachsen), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 **plus a condition of use** | held |
| `lorry_dresden_vorrangrouten` | Lkw-Vorrangroutennetz: Landeshauptstadt Dresden (Quelle: Geodaten Sachsen), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 | held |
| `lorry_hh_gst_netz` | Großraum- und Schwertransport-Netz Hamburg: Freie und Hansestadt Hamburg, Landesbetrieb Verkehr (LBV), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 **plus a condition of use** | held |
| **Rail and public transport** — feeds `get_train_departures`, `get_departures`, `check_transit_disruption`, `watch_situation`; site: the transit card (live departures, the district's punctuality, VBB's in Berlin and Brandenburg) | | | |
| `db_timetables` | Fahrplandaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `delfi_static` | Fahrplandaten: DELFI e.V., CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `delfi_rt_tu` | Echtzeitdaten: DELFI e.V. via Mobilithek, CC BY-SA, bearbeitet | **CC BY-SA**, no version stated | held |
| `delfi_siri_et` | Echtzeitdaten Schiene: DELFI e.V. via Mobilithek, Datensatz „DELFI-Realtime SIRI ET Bahndaten“, CC BY-SA, bearbeitet | **CC BY-SA**, no version stated | held |
| `vbb_rt` | Echtzeitdaten: VBB Verkehrsverbund Berlin-Brandenburg GmbH, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `delfi_rt_sa` | Störungsmeldungen: DELFI e.V. via Mobilithek, Datensatz „DELFI-Datensatz GTFS-RT Service Alerts“, CC BY-SA 4.0, bearbeitet | **CC BY-SA 4.0** | held |
| `delfi_siri_sx` | Störungsmeldungen: DELFI e.V. via Mobilithek, Datensatz „DELFI-Datensatz SIRI SX“, CC BY-SA 4.0, bearbeitet | **CC BY-SA 4.0** | held |
| `delfi_zhv` | Haltestellendaten: DELFI e.V. (zentrales Haltestellenverzeichnis), CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `db_stada` | Bahnhofsdaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `vrn_rt` | Echtzeitdaten: Verkehrsverbund Rhein-Neckar GmbH (VRN), CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `vbn_siri_et` | Echtzeitdaten: Verkehrsverbund Bremen/Niedersachsen GmbH (VBN) via Mobilithek, Datensatz „SIRI-ET Niedersachsen und Bremen“, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `mvv_bus_load` | Auslastung Regionalbus: Münchner Verkehrs- und Tarifverbund GmbH (MVV) via opendata-oepnv.de, CC BY, bearbeitet | CC BY (version unstated) | held |
| **Station lifts, escalators and step-free access** — feeds `check_station_facilities` (lifts, escalators, platforms, surveys, acoustic signals nearby) and the step-free line that ends a `get_departures` board; site: the station lines on the transit card | | | |
| `db_fasta` | Aufzüge und Fahrtreppen: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `mobilithek_openstation_netex` | Aufzüge, Fahrtreppen und Bahnsteige (Bestand): Deutsche Bahn AG / DB InfraGO AG (OpenStation) via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_openstation_siri_fm` | Aufzüge und Fahrtreppen (Status): Deutsche Bahn AG / DB InfraGO AG (OpenStation) via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `kvb_lifts` | Aufzugsdaten: Kölner Verkehrs-Betriebe AG, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0, no warranty | held |
| `bfrk_spnv` | Barrierefreiheit: NVBW Nahverkehrsgesellschaft Baden-Württemberg mbH (BFRK, Bahnhöfe) via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 | held |
| `bfrk_oepnv` | Barrierefreiheit: NVBW Nahverkehrsgesellschaft Baden-Württemberg mbH (BFRK, Haltestellen) via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 | held |
| `dresden_bf_haltestellen` | Barrierefreiheit: Landeshauptstadt Dresden (Haltestellen Dresden – Barrierefreiheit), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 | held |
| `muenster_bf_haltestellen` | Barrierefreie Bushaltestellen Münster — Datenquelle: Stadt Münster, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `tuc_vdv462` | Barrierefreiheit (aus OpenStreetMap): TU Chemnitz (OPENER next, osm2vdv462) via Mobilithek — © OpenStreetMap-Mitwirkende, Open Database License 1.0 (opendatacommons.org/licenses/odbl/1-0/), bearbeitet | **ODbL 1.0** | held |
| `frankfurt_lsa` | Ampeln (Lichtsignalanlagen, mit Akustik): Stadt Frankfurt am Main – Straßenverkehrsamt, www.frankfurt.de, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| **Fuel** — feeds `find_cheapest_fuel`, `find_fuel_station`, `find_nearby`; site: the fuel card, the fuel page, and the fuel button on a motorway page (loaded only on a click) | | | |
| `tankerkoenig` | Tankstellenpreise: Tankerkönig.de — MTS-K, CC BY 4.0, bearbeitet | CC BY 4.0 **plus the MTS-K purpose limit** | held |
| **Hydrogen** — feeds `find_hydrogen_station`; site: the fuel card (the two nearest hydrogen stations within 25 km) | | | |
| `mobilithek_h2_stations` | Wasserstofftankstellen: H2 Mobility Deutschland GmbH & Co. KG via Mobilithek, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| **Charging** — feeds `find_charging_station`, `find_nearby`, `watch_situation`; site: the charging card and the motorway pages (chargers along the road, power classes, the longest stretch without a fast charger) | | | |
| `bnetza_lsr` | Ladesäulenregister: Bundesnetzagentur.de, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `mobilithek_afir_ecomovement` | Ladepunkte: Eco-Movement via Mobilithek, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `mobilithek_afir_ecomovement_dyn` | Ladepunkt-Verfügbarkeit: Eco-Movement via Mobilithek, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `mobilithek_afir_enbw_stat` | Ladepunkte: EnBW AG via Mobilithek, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `mobilithek_afir_enbw_dyn` | Ladepunkt-Verfügbarkeit: EnBW AG via Mobilithek, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `mobilithek_afir_tesla_stat` | Ladepunkte: Tesla Germany GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_tesla_dyn` | Ladepunkt-Verfügbarkeit: Tesla Germany GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_vw_stat` | Ladepunkte: Volkswagen Group Charging GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_vw_dyn` | Ladepunkt-Verfügbarkeit: Volkswagen Group Charging GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_eclearing_stat` | Ladepunkte: e-clearing.net (smartlab Innovationsgesellschaft mbH) via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_eclearing_dyn` | Ladepunkt-Verfügbarkeit: e-clearing.net (smartlab Innovationsgesellschaft mbH) via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_pump_stat` | Ladepunkte: 800 Volt Technologies GmbH (PUMP) via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_edri_stat` | Ladepunkte: Ampeco Ltd. (EDRI) via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_edri_dyn` | Ladepunkt-Verfügbarkeit: Ampeco Ltd. (EDRI) via Mobilithek, Open Data (freie Nutzung) | "Open Data (freie Nutzung)" — see below | held |
| `mobilithek_afir_audi_stat` | Ladepunkte: Audi AG (Audi charging hub) via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_audi_dyn` | Ladepunkt-Verfügbarkeit: Audi AG (Audi charging hub) via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_enerando_dyn` | Ladepunkt-Verfügbarkeit: ENERANDO Technologies GmbH via Mobilithek, Open Data (freie Nutzung) | "Open Data (freie Nutzung)" — see below | held |
| `mobilithek_afir_enio_stat` | Ladepunkte: ENIO GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_enio_dyn` | Ladepunkt-Verfügbarkeit: ENIO GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_evprice_stat` | Ladepunkte: EW Pricing GmbH (EV Price) via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_evprice_dyn` | Ladepunkt-Verfügbarkeit: EW Pricing GmbH (EV Price) via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_ewe_stat` | Ladepunkte: EWE via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_ewe_dyn` | Ladepunkt-Verfügbarkeit: EWE via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_gls_stat` | Ladepunkte: GLS Mobility GmbH via Mobilithek, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `mobilithek_afir_gls_dyn` | Ladepunkt-Verfügbarkeit: GLS Mobility GmbH via Mobilithek, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `mobilithek_afir_gpjoule_stat` | Ladepunkte: GP JOULE Connect GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_gpjoule_dyn` | Ladepunkt-Verfügbarkeit: GP JOULE Connect GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_gridco_stat` | Ladepunkte: Grid & Co. GmbH via Mobilithek, Open Data (freie Nutzung) | "Open Data (freie Nutzung)" — see below | held |
| `mobilithek_afir_gridco_dyn` | Ladepunkt-Verfügbarkeit: Grid & Co. GmbH via Mobilithek, Open Data (freie Nutzung) | "Open Data (freie Nutzung)" — see below | held |
| `mobilithek_afir_eround_stat` | Ladepunkte: Hamburger Energienetze GmbH (eRound) via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_eround_dyn` | Ladepunkt-Verfügbarkeit: Hamburger Energienetze GmbH (eRound) via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_inergia_stat` | Ladepunkte: INERGIA GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_inergia_dyn` | Ladepunkt-Verfügbarkeit: INERGIA GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_rudnick_stat` | Ladepunkte: K.u.L. Rudnick Bau und Bauträger GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_lichtblick_stat` | Ladepunkte: LichtBlick eMobility GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_lichtblick_dyn` | Ladepunkt-Verfügbarkeit: LichtBlick eMobility GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_monta_stat` | Ladepunkte: Monta ApS via Mobilithek, Open Data (freie Nutzung) | "Open Data (freie Nutzung)" — see below | held |
| `mobilithek_afir_monta_dyn` | Ladepunkt-Verfügbarkeit: Monta ApS via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_qwello_stat` | Ladepunkte: Qwello Deutschland GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_qwello_dyn` | Ladepunkt-Verfügbarkeit: Qwello Deutschland GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_road_stat` | Ladepunkte: Road B.V. (Road Public Network) via Mobilithek, Open Data (freie Nutzung) | "Open Data (freie Nutzung)" — see below | held |
| `mobilithek_afir_road_dyn` | Ladepunkt-Verfügbarkeit: Road B.V. (Road Public Network) via Mobilithek, Open Data (freie Nutzung) | "Open Data (freie Nutzung)" — see below | held |
| `mobilithek_afir_smatrics_stat` | Ladepunkte: SMATRICS GmbH & Co KG via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_smatrics_dyn` | Ladepunkt-Verfügbarkeit: SMATRICS GmbH & Co KG via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_wirelane_stat` | Ladepunkte: Wirelane GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_wirelane_dyn` | Ladepunkt-Verfügbarkeit: Wirelane GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_chargecloud_stat` | Ladepunkte: chargecloud GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_chargecloud_dyn` | Ladepunkt-Verfügbarkeit: chargecloud GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_vaylens_stat` | Ladepunkte: vaylens GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_vaylens_dyn` | Ladepunkt-Verfügbarkeit: vaylens GmbH via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_afir_ladenetz_stat` | Ladepunkte: Smartlab Innovationsgesellschaft mbH (ladenetz.de) via Mobilithek, CC0 1.0 | CC0 1.0 | discontinued |
| `mobilithek_afir_ladenetz_dyn` | Ladepunkt-Verfügbarkeit: Smartlab Innovationsgesellschaft mbH (ladenetz.de) via Mobilithek, CC0 1.0 | CC0 1.0 | discontinued |
| `mobilithek_afir_ladebusiness_stat` | Ladepunkte: Smartlab Innovationsgesellschaft mbH (ladebusiness) via Mobilithek, CC0 1.0 | CC0 1.0 | discontinued |
| `mobilithek_afir_ladebusiness_dyn` | Ladepunkt-Verfügbarkeit: Smartlab Innovationsgesellschaft mbH (ladebusiness) via Mobilithek, CC0 1.0 | CC0 1.0 | discontinued |
| `ocpdb_chargecloud` | Ladepunkte und Verfügbarkeit: chargecloud (CC0 1.0) via MobiData BW (NVBW), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten geändert | dl-de/by-2-0 | held |
| `ocpdb_taubert` | Ladepunkte und Verfügbarkeit: Taubert Consulting (CC0 1.0) via MobiData BW (NVBW), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten geändert | dl-de/by-2-0 | held |
| `hh_emobility` | Ladestatus: Freie und Hansestadt Hamburg, Behörde für Wirtschaft und Innovation, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 | held |
| **Parking** — feeds `find_parking`, `find_nearby`; site: the parking card (München forecast included; the share-alike lorry parks and P+R sites, Hamburg's coach places and on-street bays in blocks of their own) and the motorway pages (parking and rest) | | | |
| `mobilithek_truckpark_static_geonutzv` | LKW-Parken: © Lkw-Parken BAB Deutschland / Bundesministerium für Verkehr (BMV) 2026 — GeoNutzV, Daten verändert | GeoNutzV | held |
| `mobilithek_park_bosch_static` | Lkw-Parken: Bosch Service Solutions via Mobilithek, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `mobilithek_park_bosch_dyn` | Lkw-Parken (Belegung): Bosch Service Solutions via Mobilithek, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `mobilithek_park_christophorus` | Lkw-Parken: Florence Knuellwald GmbH (Christophorus Parking) via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `mobilithek_park_christophorus_occ` | Lkw-Parken (Belegung): Florence Knuellwald GmbH (Christophorus Parking) via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `mobilithek_park_trucklounge` | Lkw-Parken: ENMO GmbH & Co.KG (Trucklounge Ecopark) via Mobilithek — enthält Daten aus „Trucklounge Ecopark“, Open Database License 1.0 (opendatacommons.org/licenses/odbl/1-0/), bearbeitet | **ODbL 1.0** | held |
| `mobilithek_park_trucklounge_occ` | Lkw-Parken (Belegung): ENMO GmbH & Co.KG (Trucklounge Ecopark) via Mobilithek — enthält Daten aus „Trucklounge Ecopark (dynamisch)“, Open Database License 1.0 (opendatacommons.org/licenses/odbl/1-0/), bearbeitet | **ODbL 1.0** | held |
| `mobilithek_park_koeln_static` | Parkhäuser: Stadt Köln via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `mobilithek_park_koeln_dyn` | Parkhaus-Belegung: Stadt Köln via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `mobilithek_park_nrw_parken` | Parkhäuser NRW: NRW.Mobidrom via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `mobilithek_park_nrw_pr` | P+R NRW: NRW.Mobidrom via Mobilithek, Datensatz „Gebündelte Daten Park+Ride NRW“, CC BY-SA, bearbeitet | **CC BY-SA**, no version stated | held |
| `mobilithek_park_wuppertal_dyn` | Parkhaus-Belegung: Stadt Wuppertal via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `mobilithek_park_dortmund_static` | Parkhäuser: Stadt Dortmund via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `dortmund_parkhauser` | Parkhaus-Belegung Dortmund: Stadt Dortmund (Tiefbauamt), Open Data Dortmund, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `hamburg_parkhaeuser` | Parkhäuser: Freie und Hansestadt Hamburg, Behörde für Verkehr und Mobilitätswende, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten geändert (bearbeitet) | dl-de/by-2-0 | held |
| `hamburg_park_ride` | P+R-Anlagen: Freie und Hansestadt Hamburg, Behörde für Verkehr und Mobilitätswende, (BVM), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten geändert (bearbeitet) | dl-de/by-2-0 | held |
| `muenster_pls` | Parkhausbelegung Münster — Datenquelle: Stadt Münster, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `leipzig_pr_standorte` | Park+Ride-Standorte Leipzig — Parkdaten: Stadt Leipzig, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `leipzig_pr_belegung` | Park+Ride-Belegung Leipzig — Parkdaten: Stadt Leipzig, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `mobilithek_park_kassel_static` | Parkhäuser Kassel: Stadt Kassel, Straßenverkehrs- und Tiefbauamt via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0, by the city's terms of use — see below | held |
| `mobilithek_park_kassel_dyn` | Parkhaus-Belegung Kassel: Stadt Kassel, Straßenverkehrs- und Tiefbauamt via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0, by the city's terms of use — see below | held |
| `muc_parken_parkhaeuser` | Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de (bearbeitet) | dl-de/by-2-0 | held |
| `muc_parken_pr` | Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de (bearbeitet) | dl-de/by-2-0 | held |
| `muc_parken_prognosen` | Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de (bearbeitet) | dl-de/by-2-0 | held |
| `parkapi_bw_karlsruhe` | Parkdaten: Stadt Karlsruhe via MobiData BW, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `parkapi_bw_freiburg` | Parkdaten: Stadt Freiburg via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `parkapi_bw_vrs` | Parkdaten: Verband Region Stuttgart via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `parkapi_bw_mannheim` | Parkdaten: Stadt Mannheim via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `parkapi_bw_stuttgart` | Parkdaten: Stadt Stuttgart via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `parkapi_bw_heidelberg` | Parkdaten: Stadt Heidelberg via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `parkapi_bw_konstanz` | Parkdaten: Stadt Konstanz via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `parkapi_bw_buchen` | Parkdaten: Stadt Buchen via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `parkapi_bw_aalen` | Parkdaten: Stadt Aalen via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `parkapi_bw_ulm` | Parkdaten: Stadt Ulm via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `parkapi_bw_friedrichshafen` | Parkdaten: Stadt Friedrichshafen via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `parkapi_bw_herrenberg` | Parkdaten: Stadt Herrenberg via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `parkapi_bw_vrn` | Parkdaten: Verkehrsverbund Rhein-Neckar via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `parkapi_bw_pbw` | Parkdaten: Parkraumgesellschaft Baden-Württemberg mbh (PBW) via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `parkapi_bw_p_m_bw` | Parkdaten: Parken und Mitfahren via MobiData BW, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `mobilithek_park_dortmund_dyn` | Parkhaus-Belegung: Stadt Dortmund via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| `mobilithek_park_thiersheim_dyn` | Lkw-Parken (Belegung): Bosch Service Solutions (Autohof Thiersheim) via Mobilithek, CC BY 4.0, bearbeitet | CC BY 4.0 | planned |
| `mobilithek_park_sh_truck` | Lkw-Parken: Landesbetrieb Straßenbau und Verkehr Schleswig-Holstein (LBV.SH) via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| `mobilithek_park_sh_truck_dyn` | Lkw-Parken (Belegung): Landesbetrieb Straßenbau und Verkehr Schleswig-Holstein (LBV.SH) via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| `mobilithek_park_kiel_dyn` | Parkplätze Kieler Altstadt (Belegung): KielRegion GmbH via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | planned |
| `mobilithek_db_bahnpark` | Parking Information Daten der DB BahnPark – API über den DB API Marketplace | dl-de/by-2-0 | discontinued |
| `dortmund_parksensoren` | Parksensoren Dortmund: Stadt Dortmund (Dortmunder Systemhaus – Smart City), Open Data Dortmund, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `mobilithek_park_wuppertal_static` | Parkhäuser Wuppertal: Stadt Wuppertal via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `mobilithek_park_leipzig_pr_static` | P+R-Anlagen Leipzig: Stadt Leipzig, Verkehrs- und Tiefbauamt via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `mobilithek_park_leipzig_pr_dyn` | P+R-Belegung Leipzig: Stadt Leipzig, Verkehrs- und Tiefbauamt via Mobilithek, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `freiburg_parkleitsystem` | Parkleitsystem Freiburg — Datengrundlage: Stadt Freiburg, www.freiburg.de, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `freiburg_park_ride` | P+R-Belegung Freiburg — Datengrundlage: Stadt Freiburg, www.freiburg.de, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `herrenberg_parkapi` | Parkplätze Herrenberg: Stadt Herrenberg (stadtnavi), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten verändert | dl-de/by-2-0 | held |
| `jena_parkdaten` | Parkdaten Jena: Kommunalservice Jena, CC BY 3.0 DE, bearbeitet | CC BY 3.0 DE | held |
| `vrr_park_ride` | Park&Ride-Anlagen: VRR AöR via opendata-oepnv.de, CC BY, bearbeitet | CC BY (version unstated) | held |
| `trk_lkw_parken` | Lkw-Parkplätze: Digitale Mobilität (TechnologieRegion Karlsruhe), CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `kiel_parkplaetze` | Parkplätze und -häuser: © Landeshauptstadt Kiel, Amt für Bauordnung, Vermessung und Geoinformation, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `kiel_park_ride` | Park & Ride: © Landeshauptstadt Kiel, Amt für Bauordnung, Vermessung und Geoinformation, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `frankfurt_behindertenparkplaetze` | Behindertenparkplätze: Stadt Frankfurt am Main – Straßenverkehrsamt, www.frankfurt.de, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `hh_reisebusparkplaetze` | Reisebusparkplätze: Freie und Hansestadt Hamburg, Behörde für Verkehr und Mobilitätswende (BVM), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 | held |
| `hh_parkraum` | Öffentlicher Parkraum: Freie und Hansestadt Hamburg, Landesbetrieb Verkehr, Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), bearbeitet | dl-de/by-2-0 | held |
| `berlin_park_ride` | Park-and-Ride-Anlagen: Land Berlin, Senatsverwaltung für Mobilität, Verkehr, Klimaschutz und Umwelt (Umland: Verkehrsverbund Berlin-Brandenburg), Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | no data yet |
| **Bike sharing** — feeds `find_sharing`; site: shared bikes within 1 km on the transit card | | | |
| `gbfs_nextbike` | Bikesharing: nextbike GmbH (GBFS), CC0 1.0 | CC0 1.0 | held |
| `gbfs_donkey` | Bikesharing: Donkey Republic (GBFS), CC0 1.0 | CC0 1.0 | held |
| **Weather** — feeds `check_weather_warnings`, `watch_situation`; site: the weather card, road-surface forecast included, and the motorway pages (warnings along the road, the road-surface forecast per station) | | | |
| `dwd` | Quelle: Deutscher Wetterdienst | CC BY 4.0 | held |
| `dwd_road` | Quelle: Deutscher Wetterdienst. Datenquelle: BMVBS und Straßenbauverwaltungen der Länder | CC BY 4.0 **plus a condition of use** | held |
| **Places and addresses** — feeds every tool that takes a `place`, and `find_place`, `find_poi`, `find_address`, `describe_location`, `find_nearby`; site: the place search, the place pages and the place name in the place bar | | | |
| `bkg_gvisys` | Verwaltungseinheiten: © BKG (2026) dl-de/by-2-0, Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_gn250.pdf (Daten verändert) | dl-de/by-2-0 | held |
| `geonames` | Ortsdaten: © GeoNames (CC BY 4.0), bearbeitet | CC BY 4.0 | held |
| `osm` | OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0 | **ODbL 1.0** | held |
| **Low-emission zones** — feeds `get_driving_rules` (with a place or a coordinate) and `describe_location`; site: the low-emission-zone line in the rules block of the place pages | | | |
| `berlin_umweltzone` | Umweltzone: Land Berlin, Senatsverwaltung für Mobilität, Verkehr, Klimaschutz und Umwelt, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | held |
| `aachen_umweltzone` | Umweltzone: Stadt Aachen (2026), Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `duisburg_umweltzone` | Umweltzonen Duisburg — Datenquelle: Stadt Duisburg – opendata-duisburg.de, CC BY 3.0 DE, bearbeitet | CC BY 3.0 DE | held |
| `muenchen_umweltzone` | Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de (bearbeitet) | dl-de/by-2-0 | held |
| `bochum_umweltzone` | Umweltzone: Stadt Bochum, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `essen_umweltzone` | Umweltzone: Datenquelle: Stadt Essen – opendata.essen.de, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| `uba_umweltzonen` | Umweltzonen in Deutschland: Umweltbundesamt, Datenlizenz Deutschland – Namensnennung – Version 2.0, bearbeitet | dl-de/by-2-0 | held |
| **Our own** — feeds `get_driving_rules` and the rules resources; the watch tools; site: the low-emission-zone sentence and the watch suggestions on the place pages, and the dated lorry ban and the rules on every motorway page | | | |
| `viafrei_rules` | Verkehrsregeln: ViaFrei, eigene Zusammenstellung aus amtlichen Quellen (StVO, StVZO, 35. BImSchV, StVG, EmoG, AFIR); jede Aussage mit Quelle und Prüfdatum — informativ, keine Rechtsberatung / Road rules: ViaFrei, our own compilation from official sources; every statement carries its source and the date it was read — informational, not legal advice | our own text | held |
| `viafrei_watch` | Beobachtung: ViaFrei, eigener Dienst — jede Meldung nennt die Quelle der Daten, die sie ausgelöst haben / Watch: ViaFrei, our own service — every report names the source of the data behind it | no provider data | held |

What the table cannot say in a cell:

- **Fuel coverage is not nationwide.** We watch a limited set of stations, on the
  terms the publisher sets, and ask the provider about a new area only when
  somebody actually asks, a limited number of areas per hour. Where we hold no
  price, a fuel answer says so and lists the nearest OpenStreetMap filling
  stations instead, without a price. That is a consequence of the MTS-K rules,
  not a gap we are hiding.
- **Live occupancy exists only where an operator publishes it.** A parking or
  charging row without a "free" count means the operator publishes none, never
  that the site is full or free. München's P+R sites carry a **forecast** from the
  city's own dataset instead (for example "usually free"), labelled as a forecast
  from past experience.
- **`polizei_hamburg_lms`** has no feed of its own: the Hamburg police traffic
  messages reach us inside the NRW traffic-information bundle (`mobilithek_nms_events`)
  and are credited to the Hamburg Landesmeldestelle, which published them.
- **`bast_lcl`** is a reference table, not a feed: BASt's TMC location list turns
  the location codes in the motorway traffic messages into the junction names you
  read ("between X and Y"). On viafrei.de it is also the skeleton of every
  motorway page: the junctions in road order, the junction strip, the schematic
  line on the map and its length, the interchanges, and the charging gap are all
  measured along its points, and every page credits it.
- **A charger's status is judged by one rule everywhere.** The tool, the charging
  card and the motorway pages use the same per-feed windows: a status younger
  than its feed's window is current, an older one is shown with its time as
  possibly out of date, and no status at all is "unknown", never free.

## The sources in detail

Each block gives the licence in the publisher's own words where we have it, and
the attribution line that belongs to that source. Sources whose licence asks
nothing beyond the line in the table above — CC BY 4.0, Datenlizenz Deutschland
(Zero or Namensnennung), GeoNutzV, CC0 — have no block of their own unless
something else about them matters to you.

**Reproduce the line as you received it from the server, not as it is printed
here.** The lines on this page are shortened: every attribution line in a real
tool result ends with the source URI in parentheses, and this page leaves that URI
off on purpose — a public page in this repository does not carry deep links into
the catalogues we fetch through. CC BY 4.0 § 3(a)(1)(A)(iv) makes you retain a
URI the licensor supplied, and dl-de/by-2-0 asks for "einen Verweis auf den
Datensatz (URI)", so the copy in the tool result is the one that discharges the
obligation and the copies here are for reading, not for pasting. If you have the
result, use the result; `viafrei://attribution` carries every line in full.

The obligation itself is not a suggestion: CC BY 4.0 § 3 and its equivalents
terminate the grant when the condition is not met.

Why several lines end in `bearbeitet`, `Daten verändert` or `Daten geändert`
("edited", "data changed"): CC BY 4.0 § 3(a)(1)(B) makes you indicate that you
changed the material, and dl-de/by-2-0 requires changes to be marked "mit dem
Hinweis …, dass die Daten geändert wurden". An answer is always a derived form —
a parsed timetable, a summarised warning, a shortened list — so the indication is
owed, and it is part of the string rather than an afterthought.

### Die Autobahn GmbH des Bundes — motorway traffic

Roadworks, warnings, closures, webcams, lorry parking and charging points on the
Bundesautobahnen, from the company's open interface: no key, no account.

```
Verkehrsdaten: Autobahn GmbH des Bundes
```

**Read this before you redistribute.** Autobahn GmbH publishes this interface
openly but publishes **no reuse licence text** alongside it — we checked the
traffic portal and the company's Impressum again, and found none. We therefore do
not claim a grant we cannot quote: we name the source on every answer, and we
treat redistribution beyond showing the answer as an open question with the
publisher rather than as something the absence of a licence permits. If you intend
to republish it, ask them.

The company's **traffic messages on the national access point** are a different
matter: they are published under GeoNutzV, and their locations are TMC codes that
BASt's location list (CC BY 4.0) turns into junction names. One line carries both:

```
Verkehrsmeldungen: Die Autobahn GmbH des Bundes (Mobilithek), Nutzungsbestimmungen nach GeoNutzV, Daten verändert; Ortsangaben: TMC Location Code List der Bundesanstalt für Straßenwesen (BASt), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), bearbeitet
```

On viafrei.de the motorway rows near a place are on the **Autobahn card**, and
each motorway's page lists its closures, jams, warnings and roadworks from the
same statement `check_road_status` answers a road from, draws them on the map,
and shows its parking, chargers and cameras. Since server 2.1.16 the page's
**planned full closures for the next seven days** are exactly what
`check_road_status` returns for that road with `horizon_days: 7`.

Publisher: <https://www.autobahn.de>

### Roadworks and traffic messages beyond the motorway interface

- **Roadworks.** BASt for the Bundesautobahnen; the Land authorities of
  Niedersachsen, Sachsen and Thüringen for federal and state roads; the
  Baden-Württemberg transport ministry's roadworks register (BEMaS) through
  MobiData BW; **Hamburg's Bauweiser** for the city's own streets, answered by
  `check_road_status` and `find_roadworks_ahead` when you name a place in Hamburg;
  since server 2.1, the **works and building sites of the Verkehrsmanagementzentrale
  Bremen**, answered by place, and the NLStBV's second publication, **works and
  closures in Niedersachsen outside the motorways** (DL-DE Zero), answered by road,
  since it locates a site by its road reference only. A site both Niedersachsen
  publications carry is one item with both lines.
  From the Bauweiser only sites the city has released for publication are ever
  shown, and "planned" means a start after today in Berlin time.
- **Detours.** Baden-Württemberg's signed demand detours (Bedarfsumleitungen,
  dl-de/zero-2-0) are quoted in a road answer as the signed route ("signed detour
  U …"), never as a route recommendation.
- **Traffic messages.** The police reports relayed by VIZ.NRW (including those of
  the Hamburg Landesmeldestelle), the messages of Baden-Württemberg, Berlin,
  Schleswig-Holstein, Köln and Hannover, and since server 2.1 those of the cities of
  **Kassel**, **Leipzig** and **Rüsselsheim am Main**, answered by place. On viafrei.de a place card's road
  section reads the city feeds too, never the Land police relays, which the NRW
  bundle already carries.
- **Bridges.** Since server 2.1, the state of Schleswig-Holstein's large bridges
  from the LBV.SH (DL-DE Zero), answered by place in `check_road_status`, one item
  per bridge in the publisher's words. The publisher types every record as a
  closure; we do not take that type, so only words that close the bridge make a
  closure. A suspended record, and one whose state is "undefiniert", is shown as
  nothing.
- **Hamburg traffic cameras** (dl-de/by-2-0) appear in `check_road_status`, and
  since server 2.1.11 on the road card of a Hamburg place (up to two within 5 km)
  and on the motorway pages, always as a link and never as an image. The
  register carries the publisher's condition: the Verkehrsleitzentrale stops the
  internet transmission from time to time for data-protection reasons, so the
  images are not reliably available around the clock.

Five things about them are not in the table:

- **Baden-Württemberg's messages carry a condition of use.** They are official
  traffic-warning-service (Verkehrswarndienst) messages, published under the
  Rahmenrichtlinie für den Verkehrswarndienst (RVWD), and the server's register
  states the condition it applies: *"The message text is shown unabridged and
  only while current."* If you pass such a message on, do the same.
- **Schleswig-Holstein and Hannover** are published under the access point's term
  "Open Data (freie Nutzung)", and the register names no licence text behind it.
  We name the publisher on every answer and claim no more than the label says.
- **Kassel and Leipzig: the licence is in the city's terms of use.** On the access
  point both cities' offers carry the label "restricted use, free of charge" and no
  standard licence. Unlike the motorway datasets [we leave out](#what-we-hold-back-and-why),
  they have terms behind the label: each city attaches its own terms of use for its
  open data on that portal, and those name Datenlizenz Deutschland – Namensnennung
  2.0 for the datasets they cover; Kassel's offer description says the same, and
  that subscribing accepts those terms. Both terms exclude the city's coat of arms,
  and Kassel's excludes personal data, so no contact person is kept. The line is the
  dl-de/by-2-0 line with the source note each city asks for.
- **A record its publisher marks confidential is never shown.** In DATEX II, the
  format most of these feeds use, a publisher marks each record with a
  confidentiality level; a record marked anything other than `noRestriction` is
  stored and never returned — not in a tool answer, a watch notice, a site card or
  an export.
- **GeoNutzV lines carry a year.** Six sources are under the GeoNutzV: the
  motorway lorry-parking file, the roadworks of Thüringen, Bayern and
  Mecklenburg-Vorpommern, the NRW motorway traffic state, and the Rüsselsheim
  messages. Each requires a source note *and* a note that the data was changed.
  Since server 2.2.6 the year in the line is the current year in Berlin when the
  answer is made, so a line printed on 1 January names the new year:

```
LKW-Parken: © Lkw-Parken BAB Deutschland / Bundesministerium für Verkehr (BMV) <Jahr> — GeoNutzV, Daten verändert
Arbeitsstellen Thüringen: © Thüringer Landesamt für Bau und Verkehr (TLBV) <Jahr> — GeoNutzV, Daten verändert
Baustellen Bayern: © Bayerische Straßenbauverwaltung – Zentralstelle für Verkehrsmanagement <Jahr> — GeoNutzV, Daten verändert
Arbeitsstellen Mecklenburg-Vorpommern: © Landesamt für Straßenbau und Verkehr Mecklenburg-Vorpommern <Jahr> — GeoNutzV, Daten verändert
Verkehrslage Nordrhein-Westfalen: © Die Autobahn GmbH des Bundes <Jahr> — GeoNutzV, Daten verändert
Verkehrsmeldungen Rüsselsheim am Main: © Stadt Rüsselsheim am Main <Jahr> — GeoNutzV, Daten verändert
```
- **The 14-day motorway roadworks feed has a label and no terms.** Die Autobahn
  GmbH publishes its feed of long-running motorway works (current, and starting in
  the next 14 days) on the access point as "eingeschränkte Nutzung, kostenfrei"
  (restricted use, free of charge), with no licence text. We use it only inside
  answers, one item at a time, with that label in its line, and never in an export
  or a bulk copy. Where BASt's file carries the same works, it is shown once under
  BASt's line with this one beside it. Do not redistribute it either. If the
  publisher states terms or objects, it is withdrawn.

Datenlizenz Deutschland – Zero – 2.0, the licence of several rows in the table,
attaches **no** condition at all: "Jede Nutzung ist ohne Einschränkungen oder
Bedingungen zulässig". We name the publisher anyway, as for the CC0 feeds.

### DELFI e.V. — public-transport realtime · CC BY-SA (version unstated)

```
Echtzeitdaten: DELFI e.V. via Mobilithek, CC BY-SA, bearbeitet
Echtzeitdaten Schiene: DELFI e.V. via Mobilithek, Datensatz „DELFI-Realtime SIRI ET Bahndaten“, CC BY-SA, bearbeitet
```

**The version is an open question, and this page will not invent one.** The
GovData catalogue record for the Trip Updates carries the *unversioned* licence URI
`http://dcat-ap.de/def/licenses/cc-by-sa` on its only resource, and the national
access point's own metadata carries the same term with no custom licence and no
source note. Per the dcat-ap.de vocabulary that is a distinct term from
`…/cc-by-sa/4.0`, and it is not a habit of the publisher's: DELFI's sibling
records *are* versioned — the Service Alerts record carries `cc-by-sa/4.0` and the
static timetable `cc-by/4.0`. The SIRI ET feed is in the same position.

Why it is not pedantry: art. 3(b)(1) of the 4.0 text sets the Adapter's Licence
to "the same License Elements, this version or later, or a BY-SA Compatible
License", so the version decides what a recipient may put on a derivative.
**Treat it as CC BY-SA and assume the share-alike applies; do not rely on a
specific version for a derivative.** What you may do with it is set out
[at the top of this page](#public-transport-realtime-is-share-alike).

The two **disruption feeds** state their version, 4.0, and are share-alike all
the same:

```
Störungsmeldungen: DELFI e.V. via Mobilithek, Datensatz „DELFI-Datensatz GTFS-RT Service Alerts“, CC BY-SA 4.0, bearbeitet
Störungsmeldungen: DELFI e.V. via Mobilithek, Datensatz „DELFI-Datensatz SIRI SX“, CC BY-SA 4.0, bearbeitet
```

GTFS-RT Service Alerts is the primary alert source: a SIRI SX alert with the same
headline and start, or the same message number, is not shown twice, and both
feeds are credited where both carried it.

The **static timetable** and the **stop directory** are CC BY 4.0, not
share-alike. `get_departures` reads the timetable for every German stop, and the
stop directory resolves stop names for it and for the place lookups:

```
Fahrplandaten: DELFI e.V., CC BY 4.0, bearbeitet
Haltestellendaten: DELFI e.V. (zentrales Haltestellenverzeichnis), CC BY 4.0, bearbeitet
```

**Berlin and Brandenburg** punctuality comes from VBB's own realtime feed, which
VBB publishes under CC BY 4.0. A Berlin or Brandenburg punctuality answer
therefore carries no share-alike:

```
Echtzeitdaten: VBB Verkehrsverbund Berlin-Brandenburg GmbH, CC BY 4.0, bearbeitet
```

Licence family: Creative Commons Attribution-ShareAlike — for the two unversioned
feeds no version URL is given here on purpose. The 4.0 text, for reference and
for the two alert feeds: <https://creativecommons.org/licenses/by-sa/4.0/> ·
publisher: <https://www.opendata-oepnv.de>

### Tankerkönig / MTS-K — fuel prices · CC BY 4.0 **plus a purpose limit**

```
Tankstellenpreise: Tankerkönig.de — MTS-K, CC BY 4.0, bearbeitet
```

Tankerkönig states the licence and the attribution in one sentence: *"Die Daten
stehen unter der Creative-Commons-Lizenz "CC BY 4.0" …, insbesondere ist eine
Namensnennung nötig (z.B. ein Link auf www.tankerkoenig.de)"*. The link is the
publisher's example of how to name it, and we treat it as required: the line the
server emits always carries <https://creativecommons.tankerkoenig.de>, and a copy
of the line should too.

The CC BY licence is **not** the binding constraint here. The MTS-K purpose
limitation sits on top of it and is stricter; the full statement is
[at the top of this page](#fuel-prices-are-consumer-information-only).
Tankerkönig's terms are blunt about bulk use: attempts to pull the data in bulk
"werden geblockt (und API-Keys deaktiviert)".

**How the server asks it (since 2.1.19–2.1.22).** Every request follows a person's
question: nothing is fetched for a place nobody asked about, and a crawler never
triggers one. One request a
minute, the key's limit, through one queue that loses no ask. One request answers
every station within 25 km of the asked place (a public point, never the person's
own position), so a second question nearby is
answered from it at once. While a new price is being fetched, the last known price
is shown with its time, never as current. No Tankerkönig answer is archived, and no
log line carries the asked coordinate.

Terms: <https://creativecommons.tankerkoenig.de> · MTS-K guidance for consumer
services: <https://www.bundeskartellamt.de>

### Deutsche Bahn AG — timetables, stations, facilities

Three products on the DB API Marketplace are served, all CC BY 4.0:

```
Fahrplandaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet
Bahnhofsdaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet
Aufzüge und Fahrtreppen: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet
```

The product pages say it in one sentence: *"Dieser Datensatz wird bereitgestellt
unter der Lizenz Creative Commons Attribution 4.0 International (CC BY 4.0)."* DB
adds one carve-out, and it is narrower than it looks: once the data has become
part of OpenStreetMap, "genügt eine Nennung der Deutschen Bahn AG in der Liste der
Beitragenden". That is a relaxation **for OSM**, not permission to drop the line
from your own results.

A fourth, **DB BahnPark** (station car parks, Datenlizenz Deutschland –
Namensnennung 2.0), is **discontinued**: its licence was read, and the publisher
closed the route to the data on 2026-09-22. Nothing is held, and no answer names it.

Publisher: <https://developers.deutschebahn.com>

### Station lifts and escalators — three publishers

`check_station_facilities` reports each lift and escalator of a station with its
state. Three publishers stand behind it:

- **DB InfraGO's OpenStation** feeds on the national access point — the inventory
  (NeTEx) and the live status (SIRI FM), both **CC0 1.0**. Since server 2.2.9 the
  inventory also feeds the platform lines of a DB station: each platform's
  numbers, whether it is step-free, wheelchair access, the platform height, tactile
  guidance and level boarding. "Unknown" is said as unknown, never as no, and the
  inventory's line is credited only where a platform fact is shown;
- **DB FaSta**, the DB API Marketplace product above, CC BY 4.0;
- the **Kölner Verkehrs-Betriebe**, for the Stadtbahn stops in Köln, under
  Datenlizenz Deutschland – Zero 2.0, with one condition the register carries:
  "Kölner Verkehrs-Betriebe AG provides the data without any warranty". KVB's
  open-data page says the same ("Die KVB stellt Daten und sonstige Inhalte ohne
  jede Gewähr bereit").

A railway station and the Stadtbahn stop below it can come back in one answer, each
with its own line. On viafrei.de, since server 2.1, each station on the transit
card has a line of its own from the same feeds: how many lifts and escalators run,
each unit out of service by name (a Köln Stadtbahn unit by its number, the only
name its publisher gives), the platforms the timetable marks step-free (DELFI's
static timetable, CC BY 4.0; only a marked platform is a statement), and the car
parks and P+R sites within 300 m under their own lines. The lookup depends on the station directory, so a station
missing from it produces "I cannot resolve that station" rather than an empty
facility list — the distinction matters if you are deciding whether to retry.

### Deutscher Wetterdienst — warnings and the road-surface forecast · CC BY 4.0

```
Quelle: Deutscher Wetterdienst
```

The DWD's copyright page: *"Alle frei zugänglichen Geodaten und Geodatendienste
sowie die als hochwertige Datensätze / high value datasets (HVD) festgelegten
Leistungen des DWD dürfen unter den Bedingungen der Lizenz Creative Commons BY 4.0
(CC BY 4.0) unter Beigabe eines Quellenvermerks weiterverwendet werden."*

§ 7 DWD-Gesetz — headed *Quellenschutz* — makes the source note a legal **duty**:
distribution of DWD data, warnings in particular, "ist nur unter Angabe der Quelle
zulässig". The **wording** is set by the DWD in *Vorgaben für die Gestaltung des
DWD-Quellenvermerks*: either the text form `Quelle: Deutscher Wetterdienst` or the
DWD logo, placed "unmittelbar an der verwendeten DWD-Information".

There is a second line for warnings, and the difference matters:

```
Datenbasis: Deutscher Wetterdienst, zusammengefasst
```

An **amtliche Wetterwarnung** is official text. Where an answer reproduces the
warning as issued, it carries `Quelle: Deutscher Wetterdienst`. Where it shows our
summary instead, the DWD requires the Quellenvermerk to be **removed** and a
changed-data note put in its place — an altered warning must not look official.
If you rewrite a warning further, the same rule applies to you.

**New in server 2.0: the road-surface forecast.** `check_weather_warnings` adds the
DWD's model forecast for the nearest road-weather stations — road-surface
temperature and whether slipperiness is forecast — with its own line:

```
Quelle: Deutscher Wetterdienst. Datenquelle: BMVBS und Straßenbauverwaltungen der Länder
```

It carries a condition of use, which every such answer shows, in German as the
binding original: *"Die Daten der Glättemeldeanlagen stellen ungeprüfte
Punktmessungen dar und spiegeln nicht die Verhältnisse auf einem Straßenabschnitt
wider. Es besteht kein Anspruch auf regelmäßige und vollständige
Datenlieferungen."* It is a forecast for a station's own location, not a
measurement and not an official warning, and the answer says so. Since server 2.1
the site's weather card shows the nearest station's next six hours as the DWD
publishes them, hour by hour and never averaged: air temperature, road-surface
temperature and class, and the hour's rain or snow where forecast.

On a motorway page the official warnings along the road are listed with the
DWD's own Warnstufe name, and a translated page adds our gloss and links to the
complete warning on the German page. On the map a warning is only a mark on our
own line, never the DWD's warning area, and those marks are a summary, so they are
credited `Datenbasis: Deutscher Wetterdienst, zusammengefasst` and never with the
Quellenvermerk. The road-surface forecast per station carries the condition above.

Licence: <https://www.dwd.de/copyright>

### Charging data — CC BY 4.0, CC0 1.0 and dl-de/by-2-0

Charge points reach us from three kinds of publisher, and the licences are **not
uniform**, so they are listed one by one in the table: the AFIR publications of
operators and platforms on the national access point (Eco-Movement, EnBW, Tesla,
Volkswagen, e-clearing.net, and since server 2.1 twenty-three more: PUMP, EDRI,
Audi charging hub, ENERANDO, ENIO, EV Price, EWE, GLS Mobility, GP JOULE, Grid & Co.,
eRound, INERGIA, K.u.L. Rudnick, LichtBlick, Monta, Qwello, Road, SMATRICS,
Wirelane, chargecloud, vaylens, and smartlab's roaming hubs ladenetz.de and
ladebusiness), the Bundesnetzagentur's Ladesäulenregister, and two operators' data
passed on by MobiData BW. Most operators publish a master file and a separate
availability feed, and the two can carry different licences: Monta's master file
is "Open Data (freie Nutzung)" and its availability CC0. **The licence follows the publisher, not
the kind of data**: Tesla's and Volkswagen's master data are CC0, while EnBW's and
Eco-Movement's availability feeds are CC BY 4.0.

- **Bundesnetzagentur** asks for a specific name: *"Als Namensnennung für Daten
  dieser Internetseite ist Bundesnetzagentur.de zu verwenden"*, and the line uses
  exactly that.
- **"Open Data (freie Nutzung)"** is the access point's label on some operators'
  feeds (EDRI's and ENERANDO's availability, Grid & Co.'s and Road's both feeds,
  Monta's master file), with no licence text behind it, as for the two message
  feeds above. We name the operator on every answer and claim no more than that.
- **smartlab's ladenetz.de and ladebusiness publications are discontinued.** The
  publisher ended all four (master data and availability) on 2026-10-19; the data
  is now published through e-clearing.net, which we read. A site that no other feed
  carries answers through 17 Nov 2026 (the last day, Berlin time) with its place,
  plugs and power and its own credit line, dated "last published", and never with
  an availability. After that day it no longer answers. The rows are kept, closed,
  so a credit already given can still be traced.
- **A frozen availability feed is not shown as current.** An availability feed that
  has answered only "unchanged" for far longer than its own rhythm is reported as
  such, and a status is judged by its own time, so an old one never reads as "free
  now".
- **One site, one row.** When an operator's own feed and the Ladesäulenregister
  describe the same site, the answer and the site's charging card list it once,
  from the operator. Since server 2.1.9 the card also folds one point that two
  operator feeds publish (an operator's own feed and a republication of it) into
  the better-ranked feed's row — the operator's own feed before a roaming hub
  before an aggregator — and credits the other feed on that row, as the tool does.
- **The motorway pages** list the chargers along the road by the same rules, sort
  the sites into power classes (under 50 kW, 50–149 kW, from 150 kW, not stated)
  and name the longest stretch between two junctions with no site of at least
  150 kW. That is our derivation, it states where chargers are and never that one
  is free, and the page credits every site it counts.
- **chargecloud and Taubert Consulting** come through MobiData BW, which publishes
  the dataset under dl-de/by-2-0; the register records the operators' own data as
  CC0 1.0 and names both in the line, with the dl-de/by-2-0 note of change.

CC0 waives copyright and database rights and attaches **no** condition; we name
those publishers anyway, because an answer should say where it came from. CC0
does not waive trade marks: a name there identifies the source of the data and
nothing else.

**Live availability does not exist for most of Germany**, because only some
operators publish it. A result marks every such site "no status data" and says
that this means unknown, not free. A price per kWh is shown where the operator
publishes one, and the answer says for how many sites it holds none.

### H2 Mobility — hydrogen stations · CC BY 4.0

```
Wasserstofftankstellen: H2 Mobility Deutschland GmbH & Co. KG via Mobilithek, CC BY 4.0, bearbeitet
```

New in server 2.1. H2 Mobility's list of hydrogen filling stations on the national
access point, under CC BY 4.0, answered by `find_hydrogen_station` and named on the
site's fuel card (the two nearest within 25 km). Each station carries its pumps —
700 bar for cars, 350 bar for lorries and buses, and at a few sites 350 bar for
cars — its address and, where published, its opening hours. A site in the
publication with no refill point is not shown as a station.

**What it does not say.** The publication has no availability, no price and no
working state, and every answer says so: check that a station is working before
you drive. The publisher's free-text comment, which carries technical contacts'
phone numbers and e-mail addresses, is never stored, because CC BY 4.0 licenses no
privacy rights (§ 2(b)(1)); neither are its photo links.

### OpenStreetMap — addresses, points of interest, the national boundary · ODbL 1.0

```
OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0
```

**Which answers carry it**, in the platform's own words as of server 2.1.8 (unchanged since 2.1.5):
*"Only results that contain a row of one of these two OSM tables carry this line —
an input that resolved through them, a landmark offered beside a town of the same
name, an OpenStreetMap car park listed in an answer, an OpenStreetMap motorway
junction named in one, a charging site placed at its OpenStreetMap address, a
Bundesland decided by an OpenStreetMap address, or an OpenStreetMap fuel station
listed without a price. A result about a place **from our own gazetteer**, a
station or a motorway as a whole, or a parking answer from our other parking
sources alone, is not built from OpenStreetMap and carries neither the ODbL
attribution nor the obligation."*

The two tables are the addresses and the points of interest. Since server 2.0 we
hold a third, derived from the same extracts: **Germany's national boundary**. It
is an alteration of OpenStreetMap data and is covered by the same § 4.6 offer. It
decides that an unpriced fuel station is inside Germany, so a fuel answer never
lists a station across the border, and it is never itself part of an answer.

Address data is imported **per deployment**, all sixteen Länder, every row scoped
to the Land it came from. A single address that does not resolve says nothing
about its Land: it may simply not be in OpenStreetMap under the spelling asked
for. On viafrei.de the place bar's name for a chosen point ("Köln Hbf, Köln") is
derived on our server from the same tables, and the map links on the site's cards
point to openstreetmap.org — a link, not data.

Since server 2.1.7 the same points of interest also answer **company offices**
in `find_poi` and **what is mapped at an address** in `find_address`, and the
site's parking card lists up to five named OpenStreetMap car parks beside the
car parks whose operators publish free spaces, under the same ODbL line. Since
2.1.15 every motorway page lists the OpenStreetMap car parks at its junctions (at
most three per junction, within 1 km) in a block of its own with the ODbL notice
and the offer. **The motorway map draws no OpenStreetMap data at all**: its base
is the BKG's VG2500, [below](#the-websites-own-sources), and not the national
boundary we hold from OpenStreetMap, because drawing that boundary would make it
part of an answer and the map a Produced Work from our ODbL database. The boundary
stays what it was: a filter, never shown.

Our ODbL § 4.6 offer is [above](#and-one-that-applies-if-you-get-an-openstreetmap-derived-result-back).

Licence: <https://opendatacommons.org/licenses/odbl/1-0/> ·
copyright: <https://www.openstreetmap.org/copyright>

### BKG — administrative units · dl-de/by-2-0

The Bundesamt für Kartographie und Geodäsie publishes GN250 ("Geographische Namen
1:250 000") free of charge under **Datenlizenz Deutschland – Namensnennung 2.0**.
Openness at the BKG is decided **per product**, so this covers that one file and
nothing else in their catalogue. It is the gazetteer most place questions are
resolved through, and the index behind the place pages on viafrei.de.

The source note is printed on the product's own terms and must be reproduced with
the year of the last download filled in — plus a note that the data was changed,
which we owe twice over, because we keep a fraction of the rows and reproject
every point:

```
Verwaltungseinheiten: © BKG (Jahr des letzten Datenbezugs) dl-de/by-2-0, Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_gn250.pdf (Daten verändert)
```

Licence: <https://www.govdata.de/dl-de/by-2-0> ·
product: <https://gdz.bkg.bund.de>

### GeoNames — place gazetteer · CC BY 4.0

```
Ortsdaten: © GeoNames (CC BY 4.0), bearbeitet
```

*"This work is licensed under a Creative Commons Attribution 4.0 License"* — the
project's own statement. Places and administrative units, with multilingual
alternate names; **no streets and no house numbers**, so it can never answer an
address question. It is what turns "Munich" or "Kreis Fulda" into the coordinates
the other sources are queried with, which is why the line turns up under answers
that are otherwise about weather, fuel or charging.

Licence: <https://www.geonames.org>

### Parking — many publishers · six licences

The licences are **not uniform** — DL-DE Zero, dl-de/by-2-0, CC BY 4.0, GeoNutzV,
CC BY-SA and ODbL all occur — so each source has its own row, and each answer
carries the line of every publisher it lists.

- **Lorry parking**: the motorway lorry-parking file (GeoNutzV, line above), Bosch
  Service Solutions (CC BY 4.0, with occupancy), Christophorus Parking
  (dl-de/by-2-0) and Trucklounge Ecopark (ODbL, see the top of the page).
- **City car parks with live occupancy**: Köln, Dortmund and Wuppertal (DL-DE
  Zero), the NRW bundle, Hamburg and Münster (dl-de/by-2-0), since server 2.1
  **Kassel**'s ten car parks (dl-de/by-2-0 by the city's terms of use, as for its
  traffic messages; the city's area totals, the sum of several car parks, are not
  listed as a car park), and fifteen cities and
  operators in Baden-Württemberg through MobiData BW's ParkAPI (Karlsruhe CC BY 4.0,
  the others dl-de/by-2-0). A Wuppertal answer carries two lines, because its live
  counts are matched to the NRW bundle's facility rows.
- **Park and ride**: P+R NRW (CC BY-SA, see the top of the page), Hamburg,
  **Leipzig**, where the city publishes live free spaces per site (dl-de/by-2-0),
  and since server 2.2.9 **Kiel** (below). **Berlin's park-and-ride sites** (the
  Senatsverwaltung's dataset with the VBB's sites around the city, DL-DE Zero 2.0)
  are switched on and have **no data yet**: the first reads ended in an error, so
  nothing answers from them.
- **Kiel** (Landeshauptstadt Kiel, CC BY 4.0), since server 2.2.9: the city's car
  parks, open lots, underground car parks and P+R sites. The city publishes a point
  and a type word only, so no capacity or free count is shown, and a site named
  only by its type ("Parkplatz") is located by its direction from the place you
  asked about.
- **Frankfurt am Main's disabled-badge bays** (the Straßenverkehrsamt,
  dl-de/by-2-0), since server 2.2.9, with the number of reserved spaces and the
  publisher's reservation times. No sensor, no occupancy: such a bay is never
  called free.
- **Hamburg's on-street bays and coach places**, since server 2.2.12 and 2.2.13,
  each in a block of its own. The Landesbetrieb Verkehr's register of public
  parking space (dl-de/by-2-0) gives each street's bays with their rule, hours,
  maximum stay and count within 300 m, never an occupancy; stopping bans, personal
  disabled bays and the remainder areas the publisher warns would inflate a count
  are never counted or offered. The Behörde für Verkehr und Mobilitätswende's coach
  places (dl-de/by-2-0) say whether a place is for parking or for setting down
  only, in the city's own remark, and only for a question that names no kind.
- **Lorry bays in the Karlsruhe region** (TechnologieRegion Karlsruhe, CC BY 4.0)
  now carry the published fee, parking hours and maximum stay.
- **On viafrei.de**: the parking card and, since server 2.1.15, the motorway pages
  (truck stops, lorry parks and service areas with live free spaces where the
  operator publishes them, then car parks) read the same sources, the
  share-alike ones in blocks of their own; a motorway page draws only the sources
  whose licence lets a map carry them.
- **München**: the city's car parks, its P+R sites and — new in 2.0 — the city's
  **occupancy forecast** for each P+R site by weekday and hour, all three under
  dl-de/by-2-0 with the line the city prescribes. A forecast is shown as a
  forecast ("usually free … forecast from past experience"), with its dataset's
  date. The city's dataset also says its P+R sites are, as a rule, only for
  public-transport passengers, and the answer repeats that.

A missing "free now" in an answer means the operator publishes no count for that
site, not that it is full — the tool's own description says so.

### Bike sharing — CC0 1.0

`find_sharing` answers from nextbike's and Donkey Republic's public GBFS feeds,
both CC0 1.0 (nextbike's feed declares `CC0-1.0` itself). No condition attaches;
the publishers are named anyway. No history of individual free-floating bikes is
kept: each refresh replaces the last one. Since server 2.1.10 the transit card on
viafrei.de shows the shared bikes within 1 km by the tool's rule — a station counts
only while it is renting, has a bike and its count is at most 15 minutes old — and
credits each publisher it shows.

### German road rules — our own text

```
Verkehrsregeln: ViaFrei, eigene Zusammenstellung aus amtlichen Quellen (StVO, StVZO, 35. BImSchV, StVG, EmoG, AFIR); jede Aussage mit Quelle und Prüfdatum — informativ, keine Rechtsberatung
```

Environmental zones, tolls, equipment duties and charging rules are not a feed —
they are a compilation we write ourselves from the statutes, EU law, the
Umweltbundesamt's own lists and the Court of Justice. German statutes are
amtliche Werke and free of copyright; we summarise rather than reproduce, so no
provider licence attaches and we claim none. Every statement carries its official
source and the date it was last read, and a statement that lacks either fails our
build rather than reaching you. It is information, never legal advice.

Since server 2.1.16 the lorry-ban answer of `get_driving_rules` (`topic:
"truck_ban"`) opens with the next ban day, dated, from a calendar we derive from
the same entries: § 30 Abs. 3 and 4 StVO with the public holidays per Land, and
the Saturdays of the Ferienreiseverordnung in summer. The motorway pages print the
same calendar for the Länder each motorway crosses, and the advisory speed, the
rescue lane and the emergency numbers in the same words as the tool. We hold no
list of the roads the Ferienreiseverordnung names, so a page says when its
Saturday rule applies and never that a motorway is on that list. The place pages
show the low-emission-zone sentence the tool states for that Gemeinde, and nothing
where the zone table names no zone, because a missing entry is not a missing
zone.

The watch tools name a source of their own, `viafrei_watch`, which carries no
provider data: every report a watch makes names the source of the data that
triggered it.

### City and Land roadworks from the open portals

Since server 2.2.4, the roadworks the cities and Länder publish on their own open
data portals answer `check_road_status` and `find_roadworks_ahead` when you name a
place, and appear on the road card: Kiel, Schleswig-Holstein (LBV.SH), Brandenburg,
Freiburg, Karlsruhe, Frankfurt am Main, Berlin's planned street events, Duisburg,
Aachen, Ingolstadt, Köln, Münster, Dortmund and Stuttgart, and since 2.2.6
**München**. Through the national access point also come the roadworks of Bayern and
Mecklenburg-Vorpommern, Sachsen's closures and detours (SPERRINFOSYS), NRW's
detours for works off the motorways, the Berlin traffic-information centre's works
and closures, and the Berlin Landesmeldestelle's traffic messages.

- **One works, one item.** When several feeds carry the same works, it is shown
  once and every feed that carries it is credited.
- **Köln's rows are permits**, and the answer says so: a permitted works is not
  proof that work is under way.
- **München records works mainly in the inner districts and on main roads**, and
  only sporadically elsewhere. Every answer the city's feed speaks for carries that
  sentence, including an answer that found nothing. A temporary no-stopping zone
  and a footway-only works are never answered as a road restriction.
- **No personal data.** A publisher's personal fields (names, telephone numbers,
  contact desks) are dropped when the data is read, and are not kept in our copy
  of the publisher's file either.

### Measured and counted city traffic — Hamburg, Bonn and Berlin

Since server 2.2.6, `check_road_status` with a place counts the segments of a
city's own traffic-state measurement within 10 km. Two cities publish one:
**Hamburg** (the Behörde für Verkehr und Mobilitätswende, dl-de/by-2-0) and
**Bonn** (the Bundesstadt Bonn, CC BY with no version stated). Both are read every
five minutes, as each publisher updates them.

- A city answers only while its own time stamp is younger than 30 minutes, and
  only where one of its segments lies within 2 km of the place.
- The classes are the cities' own ("zäher Verkehr", "gestauter Verkehr",
  "Staugefahr", …), translated into the language you asked in. Hamburg lists only
  segments that are not flowing, and the answer says so. Bonn's "aktuell nicht
  ermittelbar" is reported as not measured, never as free.
- The Hamburg forecast (Verkehrslageprognose) is not used: its host did not answer
  when we built this.

Since server 2.2.12 the same answer and the road card add **counts**:

- **Hamburg's counting sites** (the Behörde für Verkehr und Mobilitätswende's
  infrared counts, dl-de/by-2-0): the vehicles counted in the last quarter hour
  near the place, per cross-section and by direction, from the publisher's own
  15-minute aggregates and never a single detector. A quarter hour that ended more
  than 45 minutes ago is no count.
- **Berlin's counting sites** (Verkehrsinformationszentrale Berlin,
  "Digitale Plattform Stadtverkehr Berlin / Verkehrsdetektion Berlin",
  dl-de/by-2-0): how many vehicles a site **usually** counts in this hour of this
  kind of day, as the median of a past month the city has published, with that
  month named. It is never said as a present count, and a profile older than 24
  months is not called usual.
- A count is a volume, and every such answer says it is not a statement about
  congestion or free flow.

### Lorry routes — BASt, Hamburg, SEVAS, Köln, Dresden, ivm and VMZ Bremen

Since server 2.2.6, `check_road_status` answers where a lorry may go when you set
`vehicle`. Each publisher's rows are listed apart, with its own line, and since
server 2.2.10 every publisher gets its own nearest lines, so one cannot crowd out
another.

- **The long-lorry positive network** (`vehicle: "long_lorry"`). BASt's extract of
  the federal network (CC BY 4.0) answers for any road or place, with the release it
  was built from. It carries a **condition of use**: BASt states that the extract is
  not complete, not binding and not for navigation. That notice rides on every
  such answer as `_meta.conditionNote`, verbatim in German and as a marked
  translation in English, and the answer names the ordinance as what binds.
  Hamburg's 2015 field-trial network (dl-de/by-2-0) is always shown with its date.
- **Height, weight and width limits and lorry bans near a place**
  (`vehicle: "lorry"`). NRW.Mobidrom's **SEVAS** data covers the towns of North
  Rhine-Westphalia: its attributes are DL-DE Zero 2.0 and its geometry is
  OpenStreetMap, so it is an ODbL database ([above](#and-the-share-alike-lorry-and-stop-access-databases)).
  One SEVAS restriction drawn on several road segments is counted and named once.
  **VMZ Bremen** (ASV Bremen, dl-de/by-2-0) publishes Bremen's clearance heights and
  weight limits. These are quoted in the publisher's own words and never turned
  into a number of ours. Every Bremen answer carries the **condition of use** that
  only the signs on site bind, that the data is not for route guidance, and the
  date the files were read.
- **Stadt Köln** (DL-DE Zero 2.0), since server 2.2.9: the city's lorry network in
  its four classes, with the network's release date, and its weight limits,
  clearance heights and other restrictions, with the direction of travel where the
  city publishes one. The city's 2014 inner-city ban zones are stored and never
  shown.
- **Landeshauptstadt Dresden** (dl-de/by-2-0, "Quelle: Geodaten Sachsen"), since
  server 2.2.10: the city's lorry ban zone, stated as the city's record states it
  (over 3.5 t, sign 253, with the additional sign quoted), and its lorry priority
  routes. The ban carries a **condition of use** on every answer: lorry bans are
  shown as information, not legal advice, and only the signs on site bind.
- **Hamburg's network for oversize and heavy transport** (Landesbetrieb Verkehr,
  dl-de/by-2-0), since server 2.2.10, as a line of its own. It carries a
  **condition of use**: the network is an aid for the permit application and no
  permit, it names no permitted dimension or weight, and the route a transport may
  take is the one its permit sets.
- **ivm Frankfurt RheinMain** (the lorry priority network and the lorry signs),
  live since server 2.2.7. Each line is the credit ivm's terms prescribe: the
  provider, the DL-DE BY 2.0 notice, the dataset by its offer page and the change
  notice in the terms' own form. A release dated another month than the one the
  line names is not loaded until the terms are read again. The priority network is
  an ODbL database ([above](#and-the-share-alike-lorry-and-stop-access-databases)).
- **"No data" is not a clearance.** A place no publisher covers is answered as
  such and credited to nobody. A covered place with nothing near says "none listed,
  which is not a clearance". A restriction whose value the publisher does not
  state is said as "value not stated".

### Street context around a place

Since server 2.2.10, `check_road_status` with a place and the road card add what a
city or Land publishes about the streets around it. Each is credited only where it
answered, each is read weekly or daily, and none is a route recommendation.

- **Hamburg** (since server 2.2.13): the numbered motorway detours the Behörde für
  Verkehr und Mobilitätswende signs (signs 460/455) within 1.5 km, each by its
  number and nearest street, always as signage context; and the signal
  installations of the Landesbetrieb Straßen, Brücken und Gewässer within 500 m,
  counted at junctions and at pedestrian crossings. Where the city's Traffic Lights
  Data service records a bus registration at a junction, the answer counts those
  junctions; it reads no signal state and no live observation, and a zero is never
  said. All dl-de/by-2-0.
- **Schleswig-Holstein** (LBV.SH, CC BY 4.0): the detour routes signed around road
  works, with their traffic, extra distance, extra time and last day; a detour
  whose works have ended is not offered.
- **Brandenburg** (Landesbetrieb Straßenwesen Brandenburg with Die Autobahn GmbH,
  dl-de/by-2-0): the road border crossings to Poland within 25 km, with the road,
  both place names and the country. The source publishes no waiting times.
- **Karlsruhe** (Stadt Karlsruhe via MobiData BW, CC BY 4.0): the streets the
  winter service clears, with their priority, each street once.
- **Aachen** (Stadt Aachen, dl-de/by-2-0): the entrances to a pedestrian zone, with
  their sign and the delivery hours the city states; no stated hours is never read
  as no deliveries.
- **München** (the Mobilitätsreferat, dl-de/by-2-0), since server 2.2.12: the
  loading and delivery bays with the rule the city signs there. Some carry an
  occupancy sensor; the city states that the sensors' reading is not part of the
  data, so the answer says a sensor is fitted and never calls a bay free.

### Low-emission zones — the cities and the Umweltbundesamt

Since server 2.2.4, `get_driving_rules` and `describe_location` check a place or a
coordinate against the zone boundary a city publishes: Berlin (dl-de/zero-2-0),
Aachen (dl-de/by-2-0), Duisburg (CC BY 3.0 DE, credited as its portal prescribes),
since 2.2.6 München (dl-de/by-2-0), and since 2.2.10 **Bochum** and **Essen** (both
dl-de/by-2-0). The answer is inside, inside a released area, outside with the
distance, or unknown. A road the zone does not apply to is named as the city lists
it. Two publishers' polygons are taken as the same zone only when they share at
least half of the smaller one's area, so a sliver where a neighbour's zone crosses
a city's boundary does not decide the answer.

The **Umweltbundesamt's** register of all 73 German zones (dl-de/by-2-0) answers
where no city publishes a boundary, or when the city's file is out of date. Its
answers state the register's own date (24.06.2025). Where a city publishes its
boundary, the city decides, and the register is credited beside it when it
agrees.

### Step-free access — surveys and OpenStreetMap

Since server 2.2.5, `check_station_facilities` adds what a survey records about a
station or stop, after DB's live lift states, and a `get_departures` board ends
with the stop's step-free line.

- **Baden-Württemberg's BFRK survey** (NVBW via MobiData BW, dl-de/by-2-0): 1 104
  railway stations and 14 065 bus and tram stops, with platform heights, guidance
  strips, lifts (the narrowest door, the smallest cabin), ramps (the steepest
  slope), stairs and escalators. It is the survey's unchecked raw data, and the
  answer says so.
- **Münster's step-free bus stops** (Stadt Münster, dl-de/by-2-0). A stop the
  list does not name is unknown, never "not step-free".
- **Dresden's register of its stops** (Landeshauptstadt Dresden, dl-de/by-2-0),
  answering since server 2.2.7.
- **TU Chemnitz's VDV-462 export** of what OpenStreetMap maps at stops (ODbL 1.0),
  answering at server 2.2.14; it is a share-alike database
  ([above](#and-the-share-alike-lorry-and-stop-access-databases)).
- **Acoustic signals in Frankfurt am Main** (Stadt Frankfurt am Main, the
  Straßenverkehrsamt, dl-de/by-2-0), since server 2.2.10: after a station's or a
  stop's answer, how many traffic signals within 300 m the city lists, and which of
  them have an acoustic signal for blind pedestrians. It is the city's list, never a
  claim that a signal has none.
- **DB's platforms** come from DB InfraGO's inventory, [above](#station-lifts-and-escalators--three-publishers).

A tram, U-Bahn or bus stop named with its city ("Stuttgart Charlottenplatz") is
that stop, since server 2.2.8: it is answered from its survey where one exists, or
with the sentence that we hold no lift status and no survey for it.

One survey answers per stop, and every survey that carries it is credited. A
survey states what is built, not whether a lift is working now.

### More realtime and more context for public transport

- **VRN** (Verkehrsverbund Rhein-Neckar, CC BY 4.0) and **VBN** (Verkehrsverbund
  Bremen/Niedersachsen, CC BY 4.0, through the access point) publish realtime feeds
  of their own. Since server 2.2.5 they answer `check_transit_disruption` and the
  punctuality on the transit card **as a failover**: only where DELFI reported
  nothing for the region or DELFI's feed is stale. Their figures are never added
  to DELFI's. Such an answer carries their line and no share-alike sentence,
  because they are CC BY and not CC BY-SA. If you store them, keep them apart from
  DELFI's rows.
- **How full an MVV regional bus usually is** (Münchner Verkehrs- und Tarifverbund
  via opendata-oepnv.de, CC BY with no version stated), beside a departure in
  `get_departures` and on the transit card. These are typical values from MVV's
  passenger counts, with the counting year, not a live reading. The line is shown
  only where a load is shown.

### Hamburg's charge-point status and Dortmund's street sensors

- **Hamburg** (Behörde für Wirtschaft und Innovation, dl-de/by-2-0) publishes the
  live state of its public charge points. Since server 2.2.5 it is a second source
  of **status only** for points we already hold from the operators' own files.
  `find_charging_station` and the charging card credit the city beside the
  operator only where a Hamburg status answered.
- **Dortmund's street sensors** (Stadt Dortmund, dl-de/zero-2-0), since server
  2.2.4: `find_parking {kind: "disabled_badge"}` names the nearest disabled-badge
  bays with free or occupied and the time of the sensor's last message, and
  `find_charging_station` says whether the bay beside a charge point is free. A
  state counts for three hours after the city's newest message and is then
  unknown. Loading zones are stored and answered by no tool yet.

## The website's own sources

viafrei.de reads the same data as the server: its cards, place pages and motorway
pages are built from the sources above and carry their lines. It uses two sources
the server does not, and neither is in any tool answer or has a row in
`viafrei://attribution`:

- **BKG VG2500** ("Verwaltungsgebiete 1 : 2 500 000", Produktstand 31.12.2025),
  under **Datenlizenz Deutschland – Namensnennung 2.0**, new with the motorway
  pages in server 2.1.15. It is the base of every motorway map and of the
  index's overview map — Germany's outline and the sixteen Länder, and nothing
  else — kept as a simplified, reprojected drawing that is generated once from
  the BKG's download. It is a picture underneath the other layers: it never
  places, filters or counts another source's row. The BKG's terms ask for a
  clearly visible source note and a change note on every public display, and on
  a web page for "BKG" and "dl-de/by-2-0" to be links; every map carries this line
  directly under it, verbatim:

  ```
  Kartengrundlage: © BKG (2026) dl-de/by-2-0, Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf (Daten verändert)
  ```

  The year is the year of the download the drawing was built from, not the year
  you read the page. "Kartengrundlage:" is our label and "(Daten verändert)" our
  change note, because the shapes are simplified and reprojected. The motorway
  line on the same map is BASt's Location Code List (`bast_lcl`, CC BY 4.0), whose
  own line sits beside it:

  ```
  TMC Location Code List (LCL 22.0): Bundesanstalt für Straßenwesen (BASt), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), bearbeitet
  ```

  BASt states that neither it nor the ministry warrants that the list is correct
  or complete, which is one reason the line is drawn schematically and every
  break in it is named rather than bridged. The map draws only the sources whose
  licence lets a map carry them: never OpenStreetMap, Trucklounge, P+R NRW or a
  fuel price. Licence: <https://www.govdata.de/dl-de/by-2-0> · product:
  <https://gdz.bkg.bund.de>
- **DB-IP "IP to City Lite"** (CC BY 4.0), for the approximate place of a home-page
  visitor who has not chosen one. The site uses only our own coarse extract of it
  (a German address range maps to a point rounded to about a kilometre), stores no
  lookup, and credits DB-IP with a link where it uses the result, as the licence
  asks.

## What we hold back, and why

Leaving a dataset out is as much a part of using open data lawfully as using one.

**Planned, not ingested.** The twelve `planned` rows above have had their licence
read and hold no data: Köln's traffic situation (two feeds), Schleswig-Holstein's
road weather (two feeds) and its lorry parks (two feeds), the two NRW
traffic-information feeds and the Hamburg police feed on the access point (the
Hamburg messages already reach us through the NRW bundle), Dortmund's
access-point occupancy feed (the city's own portal answers instead), the lorry park
at the Thiersheim truck stop, and Kiel's old-town car parks.

**Discontinued.** DB BahnPark, above, and smartlab's four charging publications
(ladenetz.de and ladebusiness), whose publisher ended them on 2026-10-19; see the
charging section for the dated grace window.

**Held back.** Nothing at server 2.2.14. ivm's two lorry feeds, held back at 2.2.6,
answer since 2.2.7 under the credit their terms prescribe.

**No data yet.** Berlin's park-and-ride sites are switched on, and no read had
succeeded when this page was compared.

**Not built:**

- **Hamburg's traffic forecast** (Verkehrslageprognose): its host did not answer
  when the measured traffic state was built.
- **Hamburg's diesel through-traffic restrictions**: the publisher withdrew them in
  September 2023, and the service no longer answers.
- **Tram-stop lifts of city operators other than KVB in Köln.** A station's lift
  count is DB's own list, and the answer says that lifts at tram, light-rail and
  underground stops are not included.

- **Typical traffic per motorway** ("usually jammed on Friday afternoons"). The
  history we hold is far too short to say it, and an aggregate of that kind is a
  new derivation that would need its own licence review first. The motorway
  pages show what is reported now and what is planned, nothing more.
- **DB Timetables on the site.** It is asked once per question, under the
  provider's rate limit, and nothing of it is stored; showing it on a card would
  mean calling the provider whenever any visitor or crawler opened a page. It
  answers in `get_train_departures` only.

**Decided against:**

- **Motorway datasets on the national access point published as "restricted use,
  free of charge" with no terms behind the label** — among them the occupancy of
  lorry spaces at selected motorway rest areas. No readable terms means no grant to
  interpret, and the access point's own terms supply no fallback licence, so
  nothing is ingested or shown from them, even if a contract is approved. The
  lorry parks along the motorways are still listed, from the lorry-parking file
  and the operators above. **One exception**, decided on purpose: Die Autobahn
  GmbH's 14-day roadworks feed, used in answers only and on the conditions
  [described above](#roadworks-and-traffic-messages-beyond-the-motorway-interface).
- **Two charge-point offers the access point marks non-public**: not polled,
  stored or shown, although the same operator's public offers are read.
- **A charge-point operator republished by MobiData BW** whose origin offer could
  not be read when we checked: held back until the origin's licence can be read
  again.
- **Eight of the nine DB RIS products** publish no licence at all; their terms
  arrive as a contract after screening. They are not used.
- **The Tankerkönig historical archive** is CC BY-**NC**-SA. Non-commercial is
  incompatible with a commercial service, so it is not in any answer path.
- **A third-party realtime relay** that publishes every German feed under one
  CC BY-SA licence: some of its inputs are under special agreements that a blanket
  licence cannot relicense, and the open parts are already ours from their
  original publishers.
- **Shared scooters and the private car- and bike-sharing feeds**: their public
  feeds carry no licence, or terms that allow internal or display-only use. Only
  nextbike, which states CC0 in its own feeds, and Donkey Republic's own feed are
  used.

## How this page is kept honest

- The attribution lines live **in the server**, not in this document. Every tool
  result carries the one that belongs to the data that answered it, and the
  register at `viafrei://attribution` is generated from the same place. A line
  that existed only in documentation would be a line nobody emits.
- The catalogue above was **generated** from that register and **compared** line
  by line with it as served by server 2.2.14 on 2026-10-20, not typed: every id it
  lists is here, once, with its line and licence as served. Two lines are printed
  shorter than served, and marked (…): ivm's lines carry their dataset's offer
  link inside the line, and this page carries no deep links into the catalogues we
  fetch through. The 25 rows added then were taken from the same resource.
- Every row in our internal register records the licence, the operative sentence,
  the date it was read and who may do what with the data. Rows are re-verified
  **quarterly** and whenever a provider announces a change.
- Where a source's terms are unknown or unreadable, this page says so instead of
  rounding it up to "open data" — the motorway interface and the two "Open Data
  (freie Nutzung)" message feeds are named on every answer for exactly that
  reason, and the datasets in the section before this one are left alone.

Found something wrong here — a licence that changed, a line that is no longer
what the provider asks for? Open an issue. Getting this right matters more to us
than getting it quickly.
