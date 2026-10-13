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
stale: tell us and we will fix it. **Every row of the catalogue below was generated
from that resource as served by server 2.0.10 on 2026-10-13**: 104 sources, of which
91 are held, 12 are planned (licence read, nothing ingested yet) and one is
discontinued. Whatever the surfaces say, the answer you hold is the thing to read:
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
own, to show beside the price. Since server 2.0 a fuel answer can also list
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
the same feeds and carry the same lines.

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
below), and two of them are share-alike:

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
tables, stated in `viafrei://attribution`: its complete contents and our
alterations, under ODbL 1.0, free of charge on request to the contact address in
the Impressum on viafrei.de. The same request also gets the P+R NRW data under
CC BY-SA 4.0 — not an ODbL duty, the register says, but the same channel.

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

**Status is the register's, not a measurement.** The last time each source's
status was measured from answers was a round of 1,000 questions against server
1.8.17 on 2026-10-06, before most of the 2.0 sources existed; the
[test rounds](https://github.com/mavrovde/viafrei-mcp/wiki/Test-rounds) are published
in the wiki. As of the capture shipped alongside this page (server 2.0.10,
2026-10-13), it exposes twenty-one tools, nineteen of them read-only. A routine
re-check of which sources answer leaves both fuel tools out — **`find_cheapest_fuel`
and `find_fuel_station`** — because Tankerkönig limits how often its interface may
be asked, and its terms say plainly that bulk retrieval is blocked and the key
deactivated. That would now mean **seventeen** live calls, the read-only tools
minus the two fuel tools, and it would measure less than a full round does.

Publication rhythm and freshness are not in the table: the server reports them per
feed, live, in the resource `viafrei://coverage`.

| Source id | Attribution line | Licence | Status |
|---|---|---|---|
| **Roads, traffic messages and roadworks** — feeds `check_autobahn_traffic`, `check_road_status`, `find_roadworks_ahead`, `watch_situation`; site: the road card (closures, jams, Hamburg roadworks, BW detours) and long closures on the News page | | | |
| `autobahn` | Verkehrsdaten: Autobahn GmbH des Bundes | open, no licence text published | held |
| `mobilithek_bab_messages` | Verkehrsmeldungen: Die Autobahn GmbH des Bundes (Mobilithek), Nutzungsbestimmungen nach GeoNutzV, Daten verändert; Ortsangaben: TMC Location Code List der Bundesanstalt für Straßenwesen (BASt), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), bearbeitet | GeoNutzV | held |
| `bast_lcl` | TMC Location Code List (LCL 22.0): Bundesanstalt für Straßenwesen (BASt), CC BY 4.0, bearbeitet | CC BY 4.0 | held |
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
| `mobilithek_traffic_koeln_static` | Verkehrslage Köln (Streckenabschnitte): Stadt Köln via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| `mobilithek_traffic_koeln_dyn` | Verkehrslage Köln: Stadt Köln via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| `mobilithek_traffic_nrw` | Verkehrsinformationen NRW: Landesbetrieb Straßenbau NRW (VIZ.NRW) via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| `mobilithek_traffic_nrw_einzel` | Verkehrsinformationen NRW (Einzelmeldungen): Landesbetrieb Straßenbau NRW (VIZ.NRW) via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| `mobilithek_traffic_hamburg` | Verkehrsmeldungen Hamburg: Polizei Hamburg – Landesmeldestelle via Mobilithek, Open Data (freie Nutzung) | "Open Data (freie Nutzung)" — see below | planned |
| `mobilithek_roadweather_sh_static` | Straßenwetter Schleswig-Holstein (Messstellen): Landesbetrieb Straßenbau und Verkehr Schleswig-Holstein (LBV.SH) via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| `mobilithek_roadweather_sh_dyn` | Straßenwetter Schleswig-Holstein: Landesbetrieb Straßenbau und Verkehr Schleswig-Holstein (LBV.SH) via Mobilithek, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0 | planned |
| **Rail and public transport** — feeds `get_train_departures`, `get_departures`, `check_transit_disruption`, `watch_situation`; site: live departures on the place cards | | | |
| `db_timetables` | Fahrplandaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `delfi_static` | Fahrplandaten: DELFI e.V., CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `delfi_rt_tu` | Echtzeitdaten: DELFI e.V. via Mobilithek, CC BY-SA, bearbeitet | **CC BY-SA**, no version stated | held |
| `delfi_siri_et` | Echtzeitdaten Schiene: DELFI e.V. via Mobilithek, Datensatz „DELFI-Realtime SIRI ET Bahndaten“, CC BY-SA, bearbeitet | **CC BY-SA**, no version stated | held |
| `vbb_rt` | Echtzeitdaten: VBB Verkehrsverbund Berlin-Brandenburg GmbH, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `delfi_rt_sa` | Störungsmeldungen: DELFI e.V. via Mobilithek, Datensatz „DELFI-Datensatz GTFS-RT Service Alerts“, CC BY-SA 4.0, bearbeitet | **CC BY-SA 4.0** | held |
| `delfi_siri_sx` | Störungsmeldungen: DELFI e.V. via Mobilithek, Datensatz „DELFI-Datensatz SIRI SX“, CC BY-SA 4.0, bearbeitet | **CC BY-SA 4.0** | held |
| `delfi_zhv` | Haltestellendaten: DELFI e.V. (zentrales Haltestellenverzeichnis), CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `db_stada` | Bahnhofsdaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| **Station lifts and escalators** — feeds `check_station_facilities`; site: the station card | | | |
| `db_fasta` | Aufzüge und Fahrtreppen: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet | CC BY 4.0 | held |
| `mobilithek_openstation_netex` | Aufzüge und Fahrtreppen (Bestand): Deutsche Bahn AG / DB InfraGO AG (OpenStation) via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `mobilithek_openstation_siri_fm` | Aufzüge und Fahrtreppen (Status): Deutsche Bahn AG / DB InfraGO AG (OpenStation) via Mobilithek, CC0 1.0 | CC0 1.0 | held |
| `kvb_lifts` | Aufzugsdaten: Kölner Verkehrs-Betriebe AG, Datenlizenz Deutschland – Zero – Version 2.0 | dl-de/zero-2-0, no warranty | held |
| **Fuel** — feeds `find_cheapest_fuel`, `find_fuel_station`, `find_nearby`; site: the fuel card and the fuel page | | | |
| `tankerkoenig` | Tankstellenpreise: Tankerkönig.de — MTS-K, CC BY 4.0, bearbeitet | CC BY 4.0 **plus the MTS-K purpose limit** | held |
| **Charging** — feeds `find_charging_station`, `find_nearby`, `watch_situation`; site: the charging card | | | |
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
| `ocpdb_chargecloud` | Ladepunkte und Verfügbarkeit: chargecloud (CC0 1.0) via MobiData BW (NVBW), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten geändert | dl-de/by-2-0 | held |
| `ocpdb_taubert` | Ladepunkte und Verfügbarkeit: Taubert Consulting (CC0 1.0) via MobiData BW (NVBW), Datenlizenz Deutschland – Namensnennung – Version 2.0 (www.govdata.de/dl-de/by-2-0), Daten geändert | dl-de/by-2-0 | held |
| **Parking** — feeds `find_parking`, `find_nearby`; site: the parking card, München forecast included | | | |
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
| **Bike sharing** — feeds `find_sharing`; no site card | | | |
| `gbfs_nextbike` | Bikesharing: nextbike GmbH (GBFS), CC0 1.0 | CC0 1.0 | held |
| `gbfs_donkey` | Bikesharing: Donkey Republic (GBFS), CC0 1.0 | CC0 1.0 | held |
| **Weather** — feeds `check_weather_warnings`, `watch_situation`; site: the weather card, road-surface forecast included | | | |
| `dwd` | Quelle: Deutscher Wetterdienst | CC BY 4.0 | held |
| `dwd_road` | Quelle: Deutscher Wetterdienst. Datenquelle: BMVBS und Straßenbauverwaltungen der Länder | CC BY 4.0 **plus a condition of use** | held |
| **Places and addresses** — feeds every tool that takes a `place`, and `find_place`, `find_poi`, `find_address`, `describe_location`, `find_nearby`; site: the place search, the place pages and the place name in the place bar | | | |
| `bkg_gvisys` | Verwaltungseinheiten: © BKG (2026) dl-de/by-2-0, Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_gn250.pdf (Daten verändert) | dl-de/by-2-0 | held |
| `geonames` | Ortsdaten: © GeoNames (CC BY 4.0), bearbeitet | CC BY 4.0 | held |
| `osm` | OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0 | **ODbL 1.0** | held |
| **Our own** — feeds `get_driving_rules` and the rules resources; the watch tools | | | |
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
  read ("between X and Y").

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

Publisher: <https://www.autobahn.de>

### Roadworks and traffic messages beyond the motorway interface

- **Roadworks.** BASt for the Bundesautobahnen; the Land authorities of
  Niedersachsen, Sachsen and Thüringen for federal and state roads; the
  Baden-Württemberg transport ministry's roadworks register (BEMaS) through
  MobiData BW; and **Hamburg's Bauweiser** for the city's own streets, answered by
  `check_road_status` and `find_roadworks_ahead` when you name a place in Hamburg.
  From the Bauweiser only sites the city has released for publication are ever
  shown, and "planned" means a start after today in Berlin time.
- **Detours.** Baden-Württemberg's signed demand detours (Bedarfsumleitungen,
  dl-de/zero-2-0) are quoted in a road answer as the signed route ("signed detour
  U …"), never as a route recommendation.
- **Traffic messages.** The police reports relayed by VIZ.NRW (including those of
  the Hamburg Landesmeldestelle), and the messages of Baden-Württemberg, Berlin,
  Schleswig-Holstein, Köln and Hannover.
- **Hamburg traffic cameras** (dl-de/by-2-0) appear in `check_road_status`. The
  register carries the publisher's condition: the Verkehrsleitzentrale stops the
  internet transmission from time to time for data-protection reasons, so the
  images are not reliably available around the clock.

Four things about them are not in the table:

- **Baden-Württemberg's messages carry a condition of use.** They are official
  traffic-warning-service (Verkehrswarndienst) messages, published under the
  Rahmenrichtlinie für den Verkehrswarndienst (RVWD), and the server's register
  states the condition it applies: *"The message text is shown unabridged and
  only while current."* If you pass such a message on, do the same.
- **Schleswig-Holstein and Hannover** are published under the access point's term
  "Open Data (freie Nutzung)", and the register names no licence text behind it.
  We name the publisher on every answer and claim no more than the label says.
- **A record its publisher marks confidential is never shown.** In DATEX II, the
  format most of these feeds use, a publisher marks each record with a
  confidentiality level; a record marked anything other than `noRestriction` is
  stored and never returned — not in a tool answer, a watch notice, a site card or
  an export.
- **GeoNutzV lines carry a year.** The motorway lorry-parking file and the
  Thüringen roadworks require a source note *and* a note that the data was
  changed; the year in the line is the year of the last download:

```
LKW-Parken: © Lkw-Parken BAB Deutschland / Bundesministerium für Verkehr (BMV) <Jahr des letzten Datenbezugs> — GeoNutzV, Daten verändert
Arbeitsstellen Thüringen: © Thüringer Landesamt für Bau und Verkehr (TLBV) <Jahr des letzten Datenbezugs> — GeoNutzV, Daten verändert
```

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
  (NeTEx) and the live status (SIRI FM), both **CC0 1.0**;
- **DB FaSta**, the DB API Marketplace product above, CC BY 4.0;
- the **Kölner Verkehrs-Betriebe**, for the Stadtbahn stops in Köln, under
  Datenlizenz Deutschland – Zero 2.0, with one condition the register carries:
  "Kölner Verkehrs-Betriebe AG provides the data without any warranty". KVB's
  open-data page says the same ("Die KVB stellt Daten und sonstige Inhalte ohne
  jede Gewähr bereit").

A railway station and the Stadtbahn stop below it can come back in one answer, each
with its own line. The lookup depends on the station directory, so a station
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
measurement and not an official warning, and the answer says so.

Licence: <https://www.dwd.de/copyright>

### Charging data — CC BY 4.0, CC0 1.0 and dl-de/by-2-0

Charge points reach us from three kinds of publisher, and the licences are **not
uniform**, so they are listed one by one in the table: the AFIR publications of
operators and platforms on the national access point (Eco-Movement, EnBW, Tesla,
Volkswagen, e-clearing.net), the Bundesnetzagentur's Ladesäulenregister, and two
operators' data passed on by MobiData BW. **The licence follows the publisher, not
the kind of data**: Tesla's and Volkswagen's master data are CC0, while EnBW's and
Eco-Movement's availability feeds are CC BY 4.0.

- **Bundesnetzagentur** asks for a specific name: *"Als Namensnennung für Daten
  dieser Internetseite ist Bundesnetzagentur.de zu verwenden"*, and the line uses
  exactly that.
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

### OpenStreetMap — addresses, points of interest, the national boundary · ODbL 1.0

```
OSM-Standortdaten: © OpenStreetMap-Mitwirkende, ODbL 1.0
```

**Which answers carry it**, in the platform's own words as of server 2.0.10:
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
  Zero), the NRW bundle, Hamburg and Münster (dl-de/by-2-0), and fifteen cities and
  operators in Baden-Württemberg through MobiData BW's ParkAPI (Karlsruhe CC BY 4.0,
  the others dl-de/by-2-0). A Wuppertal answer carries two lines, because its live
  counts are matched to the NRW bundle's facility rows.
- **Park and ride**: P+R NRW (CC BY-SA, see the top of the page), Hamburg, and
  **Leipzig**, where the city publishes live free spaces per site (dl-de/by-2-0).
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
kept: each refresh replaces the last one.

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

The watch tools name a source of their own, `viafrei_watch`, which carries no
provider data: every report a watch makes names the source of the data that
triggered it.

## The website's own source

viafrei.de reads the same data as the server: its cards and place pages are
built from the sources above and carry their lines. It uses one source the server
does not:

- **DB-IP "IP to City Lite"** (CC BY 4.0), for the approximate place of a home-page
  visitor who has not chosen one. The site uses only our own coarse extract of it
  (a German address range maps to a point rounded to about a kilometre), stores no
  lookup, and credits DB-IP with a link where it uses the result, as the licence
  asks. It is not in any tool answer and has no row in `viafrei://attribution`.

## What we hold back, and why

Leaving a dataset out is as much a part of using open data lawfully as using one.

**Planned, not ingested.** The twelve `planned` rows above have had their licence
read and hold no data: Köln's traffic situation (two feeds), Schleswig-Holstein's
road weather (two feeds) and its lorry parks (two feeds), the two NRW
traffic-information feeds and the Hamburg police feed on the access point (the
Hamburg messages already reach us through the NRW bundle), Dortmund's
access-point occupancy feed (the city's own portal answers instead), the lorry park
at the Thiersheim truck stop, and Kiel's old-town car parks.

**Discontinued.** DB BahnPark, above.

**Decided against:**

- **Motorway datasets on the national access point published as "restricted use,
  free of charge" with no terms behind the label** — among them the occupancy of
  lorry spaces at selected motorway rest areas. No readable terms means no grant to
  interpret, and the access point's own terms supply no fallback licence, so
  nothing is ingested or shown from them, even if a contract is approved. The
  lorry parks along the motorways are still listed, from the lorry-parking file
  and the operators above.
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
- The catalogue above was **generated** from that register as served on
  2026-10-13, not typed: every id it lists is here, once, with its line and
  licence as served.
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
