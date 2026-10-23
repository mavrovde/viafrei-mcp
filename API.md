# API reference

**This file is generated. Do not edit it by hand.**

It is a rendering of what the production ViaFrei MCP server answered when it
was asked to describe itself — `initialize`, `tools/list`, `resources/list`,
`resources/templates/list` and `prompts/list`. Every tool description below is
the server's own text, reproduced verbatim, because that text is what an
assistant reads when it decides which tool to call; paraphrasing it here would
document a different server.

**It is a dated snapshot, taken on 2026-10-23.** Generating this file makes
it impossible for the document and the snapshot to disagree — CI regenerates and
compares — but it cannot keep the snapshot from ageing against the live server,
because a capture is a point in time. **The source of truth is the running
server:** connect any MCP client and call `tools/list`.

| | |
| --- | --- |
| Server | `viafrei` 2.3.17 |
| MCP protocol | `2025-06-18` |
| Streamable HTTP | https://mcp.viafrei.de/mcp |
| Legacy HTTP+SSE | https://mcp.viafrei.de/sse |
| Captured from | `https://mcp.viafrei.de/mcp` on 2026-10-23 |
| Surface | 22 tools, 10 resources, 2 resource templates, 9 prompts |
| Parameter schemas | JSON Schema draft-07 |
| Capabilities | `tools`, `resources`, `prompts`, `logging` |

No API key. No account. No sign-up.

## Contents

- [How to read a result](#how-to-read-a-result)
- [Tools](#tools) — 22
- [Resources](#resources) — 10
- [Resource templates](#resource-templates) — 2
- [Prompts](#prompts) — 9

## How to read a result

Every tool returns MCP content blocks. The text block is written to be read
aloud to a person; structured detail travels in `_meta`.

Three things are conditions of use rather than presentation, and they are the
same for every tool here:

1. **Show the attribution line a result carries.** It is a licence condition of
   the data, not a credit you may drop for brevity.
2. **If a result carries `_meta.purposeNote`, reproduce that sentence verbatim.**
   It states a limit the publisher places on what the data may be used for.
3. **Do not redistribute what the licence does not allow you to.** Fuel prices in
   particular are consumer information only. The per-source terms, and the two
   conditions that are licence breaches rather than style problems, are in
   [SOURCES.md](SOURCES.md).

Times are Europe/Berlin. Every tool takes a `language` parameter; set it to the
language the person is writing in rather than relying on the default.

The server's own instructions to a connecting client, verbatim:

> ViaFrei gives AI assistants real-time awareness of Germany: live motorway traffic, closures and roadworks (plus Land and city traffic messages where a feed carries them), fuel prices, EV charging, parking, train and public-transport departures, regional public-transport punctuality and service alerts, station lifts and escalators and DWD weather warnings; and, as reference data, places and addresses and the curated German driving rules. Every tool takes a `language` argument that defaults to German ("de"): set it on every call to the language the user writes in — "en" for English — or an English question is answered in German. Always show the attribution line of a result to the user, and when a result carries `_meta.purposeNote` or `_meta.conditionNote`, show that sentence verbatim as well — it is a legal condition of the data, not a caption. Times are Europe/Berlin; the rules answers carry a review date and are informational, not legal advice. ViaFrei is in beta: sources are still being added and answers and coverage can change, so when a decision depends on a closure, a departure or a price, tell the user to confirm it with the source the attribution line names.

## Tools

### `check_autobahn_traffic` — Autobahn traffic

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> Per motorway (≤ 5): an Ampel verdict, then jams, closures and roadworks in force now, with delay/speed. Use when asked about a named motorway now: frei/clear (Ampel), Stau, a delay, how it looks, or a LIST of closures; name every motorway (Munich→Berlin: A9). Do NOT use for open/closed/gesperrt/passable, even now, a closure with no time word or a later one (tonight, weekend), or a town, no motorway — check_road_status; Baustellen dated or geplant — find_roadworks_ahead; a named city street: not held; fuel (find_cheapest_fuel), trains (get_train_departures). ~5 min old. Show attribution.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `roads` | array of string | **yes** | — | min 1 item(s); max 5 item(s); each item: pattern `^[Aa] ?\d{1,3}$` |
| `cursor` | string | no | — | max length 256 |
| `kinds` | array of string | no | `["warning","closure","roadworks"]` | min 1 item(s); each item: one of `"warning"`, `"roadworks"`, `"closure"` |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `lat` | number | no | — | min -90; max 90 |
| `limit` | integer | no | `10` | min 1; max 50 |
| `lon` | number | no | — | min -180; max 180 |
| `place` | string | no | — | min length 1; max length 120 |
| `radius_km` | integer | no | `25` | min 1; max 100 |

- **`roads`** — Autobahn numbers, e.g. ["A9"] or ["A8", "A99", "A9"] (1–5 per call). Name every motorway on the route so the whole drive is briefed in one call — "A9", "A 9" and "a9" are the same road. Results are grouped per road, in the order you list them.
- **`cursor`** — Pagination cursor from a previous result's _meta.nextCursor. Omit for the first page.
- **`kinds`** — Which event kinds to return: warning = live traffic (jams, slow traffic, hazards), closure = full closures, roadworks = construction sites. Set it when the SUBJECT of the question is one of those categories by name: "Baustellen auf der A8?" is ["roadworks"], "welche Sperrungen sind in diesem Moment gemeldet?" is ["closure"]. Omit it when the question is how the road IS — Stau, frei, a delay, "wie sieht es aus", "everything"; the German "Stau?" is the idiom for the whole picture, and a filter nobody asked for hides the closure on the same stretch. Whether a closure question is this tool's at all is decided by two things, and the noun (Sperrung, Vollsperrung, closure) is neither. FIRST THE CLOCK: only a question about this minute (jetzt, gerade, in diesem Moment, right now, at this very minute) can be this tool's — with no time word at all, or for a later window (tonight, heute Abend, am Wochenende, the coming days), it is check_road_status. SECOND, WHAT IS ASKED, which the clock cannot see: what is REPORTED or in force on a named motorway is this tool ("which closures are in force on the A100 at this very minute?"), while whether the road is OPEN or passable is check_road_status AT ANY CLOCK — "ist die A8 offen", "ist die A3 in diesem Moment gesperrt?", "komme ich da durch?" — and so is a closure asked around a town instead of on a motorway number. Baustellen with a date or the word geplant are find_roadworks_ahead. Default: all three.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`lat`** — Latitude in WGS 84, e.g. 48.137. Use with lon when the caller already holds coordinates; otherwise use place.
- **`limit`** — Maximum events to return across all roads (1–50, default 10). Each road's most important item comes first, in the order you listed the roads, so every road with something in force is on the first page when limit is at least the number of roads; after that jams, then closures, other reports, then roadworks, the roads taking turns within each. Only what is in force now is listed — closures announced for later are counted apart in the headline.
- **`lon`** — Longitude in WGS 84, e.g. 11.576. Use with lat; otherwise use place.
- **`place`** — Optional: the town, junction or address the person is at or asks about ("A1 bei Köln", "A3 near Frankfurt"). Then each road's events within radius_km come first, nearest first, and the headline counts them with the road-wide total beside it. Omit it for the whole road. Give either place OR lat+lon, never both.
- **`radius_km`** — Radius around place or lat+lon in km (1–100, default 25). Ignored without a place.

### `find_cheapest_fuel` — Cheapest fuel nearby

**Read-only** — it changes nothing. Reaches a third-party source (open world). Idempotent: true. Destructive: false.

> Returns the cheapest stations for one fuel grade near a place or coordinate: price per litre, brand, address, distance, open state. Use when the user asks where to fill up or what fuel costs. Do NOT use for charging an electric car (call find_charging_station), price history, or traffic (call check_autobahn_traffic). Radius ≤ 25 km, at most 10 stations. For a brand, a name, open now or at a named time, or nearest-first, call find_fuel_station. Each line names the age of its price and opening-hours claim. Prices are consumer information only; the attribution line and MTS-K note must be shown.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `fuel` | string | no | `"e10"` | one of `"e5"`, `"e10"`, `"diesel"` |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `lat` | number | no | — | min -90; max 90 |
| `limit` | integer | no | `5` | min 1; max 10 |
| `lon` | number | no | — | min -180; max 180 |
| `place` | string | no | — | min length 1; max length 120 |
| `radius_km` | number | no | `5` | min 1; max 25 |

- **`fuel`** — Fuel grade: "e5" (Super E5), "e10" (Super E10, the standard German petrol) or "diesel" — LPG/Autogas and CNG are not held by any source here: say so, never substitute a petrol grade. Default "e10". Pass the grade the person named — a diesel driver is not helped by a petrol price.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`lat`** — Latitude in WGS 84, e.g. 48.137. Use with lon when the caller already holds coordinates; otherwise use place.
- **`limit`** — How many stations to return, cheapest first (1–10, default 5). The provider's terms cap it at 10.
- **`lon`** — Longitude in WGS 84, e.g. 11.576. Use with lat; otherwise use place.
- **`place`** — Where to look, as free text: a city ("München", "Munich"), a district or Kreis ("Kreis Fulda"), a Bundesland, a station or stop ("Hamburg Hbf"), a motorway junction ("AK Neufahrn"), or a street address with a house number ("Bahnhofstraße 12, 36037 Fulda"). A motorway number alone ("A7") resolves to the road, which has no single point — name a town or junction on it instead. Use this instead of coordinates whenever the person named a place. An address needs its town or postcode — a street and a number alone exist in many towns. Give either place OR lat+lon, never both.
- **`radius_km`** — Search radius around the place in kilometres (1–25, default 5). The provider's terms cap it at 25 km — a larger circle is a dataset request, not a consumer question.

### `find_fuel_station` — Find a filling station

**Read-only** — it changes nothing. Reaches a third-party source (open world). Idempotent: true. Destructive: false.

> Finds filling stations around a place or coordinate under any combination of filters — grade, brand, name, open now, open at a time you name, open 24 h — sorted by distance, price or name. Use when the question is WHICH station: the closest diesel to a stop, an ARAL open tonight, what one forecourt sells. Do NOT use for the plain "where is fuel cheapest" question (call find_cheapest_fuel) or for charging an electric car (call find_charging_station). Every result carries the attribution and the MTS-K note, and says how old each price and opening-hours claim is.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `brand` | string | no | — | min length 1; max length 60 |
| `fuel` | string | no | — | one of `"e5"`, `"e10"`, `"diesel"` |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `lat` | number | no | — | min -90; max 90 |
| `limit` | integer | no | `5` | min 1; max 10 |
| `lon` | number | no | — | min -180; max 180 |
| `name` | string | no | — | min length 1; max length 120 |
| `open_at` | string | no | — | pattern `^(?:\d{1,2}:\d{2}\|\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2})$` |
| `open_now` | boolean | no | `false` | — |
| `place` | string | no | — | min length 1; max length 120 |
| `radius_km` | number | no | `5` | min 1; max 25 |
| `sort` | string | no | `"distance"` | one of `"distance"`, `"price"`, `"name"` |
| `whole_day` | boolean | no | `false` | — |

- **`brand`** — Only stations of this brand, matched case-insensitively anywhere in the brand field: "ARAL", "Shell", "TotalEnergies", "JET". Use it when the person named a chain ("die ARAL an der B1"). Free stations often carry no brand at all and are then not matched by any brand.
- **`fuel`** — Only stations with a current price for this grade: "e5" (Super E5), "e10" (Super E10) or "diesel" — LPG/Autogas and CNG are not held by any source here, so say so rather than call for them. Omit to get every station near the place whatever it sells — the answer then lists all the grades it holds a price for. Required when sort is "price", because a price ordering needs a grade.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`lat`** — Latitude in WGS 84, e.g. 48.137. Use with lon when the caller already holds coordinates; otherwise use place.
- **`limit`** — How many stations to return (1–10, default 5).
- **`lon`** — Longitude in WGS 84, e.g. 11.576. Use with lat; otherwise use place.
- **`name`** — Part of the station's own name or brand, case-insensitive: "Autohof", "Raststätte Fulda". Use it when the person named a specific forecourt rather than a chain. Combine with place to keep the search local.
- **`open_at`** — Only stations open at that time in Germany (Europe/Berlin): "23:30" means the next time the clock shows 23:30, and "2026-09-30 06:15" a specific local date and time. Use it for "is it still open tonight". Do not pass it together with open_now — they ask the same question about two different clocks.
- **`open_now`** — When true, only stations the published opening hours say are open at this moment. Default false. A station whose hours we have never read is NOT returned by this filter and is counted in the answer instead — the result never guesses that an unknown station is open.
- **`place`** — Where to look, as free text: a city ("München", "Munich"), a district or Kreis ("Kreis Fulda"), a Bundesland, a station or stop ("Hamburg Hbf"), a motorway junction ("AK Neufahrn"), or a street address with a house number ("Bahnhofstraße 12, 36037 Fulda"). A motorway number alone ("A7") resolves to the road, which has no single point — name a town or junction on it instead. Use this instead of coordinates whenever the person named a place. An address needs its town or postcode — a street and a number alone exist in many towns. Give either place OR lat+lon, never both.
- **`radius_km`** — Search radius around the place in kilometres (1–25, default 5). 25 km is the provider's own ceiling — a larger circle is a dataset request, not a consumer question.
- **`sort`** — Order of the answer: "distance" (nearest first, the default — use it for "closest diesel to Hamburg Hbf"), "price" (cheapest first, needs fuel), or "name" (alphabetical, for a person scanning a list of a brand's forecourts).
- **`whole_day`** — When true, only stations the provider flags as open around the clock (24/7). Default false. Use it when asked whether a station never closes ("durchgehend geöffnet", "around the clock") and for a night drive; it is a stricter filter than open_now, which is satisfied by a station that closes at 22:00.

### `find_parking` — Parking nearby

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> Parking near a place, a coordinate or along one motorway: lorry parks, car parks, P+R and disabled-badge bays, with total spaces, stated amenities (WC, shower) and published free spaces. Use when asked where to park or leave the car for the train ("Parkhaus in Köln", "Rastplatz A3", "P+R"). Do NOT use for fuel (find_cheapest_fuel) or EV charging (find_charging_station). Radius ≤ 25 km, ≤ 10 sites per list; ODbL and CC BY-SA sources are separate lists (up to three). No "free now" means no published count, not full. No prices: for "was kostet" say so, no call. Show each source's attribution.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `facilities` | array of string | no | — | min 1 item(s); max 5 item(s); each item: one of `"toilet"`, `"accessible_toilet"`, `"shower"`, `"restaurant"`, `"snack"`, `"cafe"`, `"shop"`, `"fuel"`, `"charging"`, `"drinking_water"`, `"picnic"`, `"playground"`, `"wifi"`, `"security"` |
| `kind` | string | no | `"any"` | one of `"any"`, `"rest_area"`, `"car_park"`, `"park_and_ride"`, `"truck"`, `"disabled_badge"` |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `lat` | number | no | — | min -90; max 90 |
| `limit` | integer | no | `5` | min 1; max 10 |
| `lon` | number | no | — | min -180; max 180 |
| `only_with_free_spaces` | boolean | no | `false` | — |
| `place` | string | no | — | min length 1; max length 120 |
| `radius_km` | number | no | `10` | min 1; max 25 |
| `road` | string | no | — | max length 16 |

- **`facilities`** — Keep only sites whose own publisher states ALL of these amenities: "toilet", "shower", "restaurant", "snack", "cafe", "shop", "fuel", "charging", "drinking_water", "picnic", "playground", "wifi", "security", "accessible_toilet". Pass it only when the person asks for one — "Rastplatz mit Dusche an der A7" → road "A7", facilities ["shower"]; "car park with a toilet near Köln Hbf" → facilities ["toilet"]. Many publishers state no amenities, so the filter can narrow the answer to little; an amenity nobody stated is unknown, not absent, and the answer says how many sites state any. A toilet, restaurant or charger merely NEAR a site (listed beside it, from OpenStreetMap or the charging register) never satisfies the filter. Leave it out otherwise: every listed site already carries its amenity line.
- **`kind`** — Which kind of parking: "car_park" = public car park (Parkhaus/Parkplatz), "park_and_ride" = P+R beside a station, "truck" = lorry parking, "any" = all of them. Default "any". "disabled_badge" = on-street bays reserved for a disabled parking permit (Behindertenparkplatz, Schwerbehindertenparkplatz), where a municipality publishes them, with a sensor's free/occupied where one is fitted — pass it only when such a bay was asked for; it is never part of "any" and takes place or lat+lon, not road. Rest areas are NOT a kind we can filter: no source we hold classifies them, so for "Rastanlage"/"Raststätte"/"rest area" leave kind out ("truck" when lorry spaces were asked for); "rest_area" is still accepted and answered as "any", with a sentence saying why. Pass a kind only when the person named one — a lorry driver asking for a break wants "truck", someone leaving the car for the train wants "park_and_ride". A camper, a caravan or a coach is none of these: leave the argument out rather than filtering a tourist into lorry bays.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`lat`** — Latitude in WGS 84, e.g. 48.137. Use with lon when the caller already holds coordinates; otherwise use place.
- **`limit`** — How many facilities to return, nearest first (1–10, default 5).
- **`lon`** — Longitude in WGS 84, e.g. 11.576. Use with lat; otherwise use place.
- **`only_with_free_spaces`** — Set true only when the person asks whether spaces are free right now. It keeps just the facilities whose operator publishes live occupancy AND currently reports a space, and the result says how many were dropped for publishing nothing — most German parking publishes no occupancy at all, so true usually narrows the answer to very little. Default false.
- **`place`** — Where to look, as free text: a city ("München", "Munich"), a district or Kreis ("Kreis Fulda"), a Bundesland, a station or stop ("Hamburg Hbf"), a motorway junction ("AK Neufahrn"), or a street address with a house number ("Bahnhofstraße 12, 36037 Fulda"). A motorway number alone ("A7") resolves to the road, which has no single point — name a town or junction on it instead. Use this instead of coordinates whenever the person named a place. An address needs its town or postcode — a street and a number alone exist in many towns. Give either place OR lat+lon, never both.
- **`radius_km`** — Search radius around place or lat+lon in kilometres (1–25, default 10). Ignored when you pass road, which covers the whole motorway. Start small in a city and widen if the answer is empty.
- **`road`** — A single motorway number to list parking along, e.g. "A3" ("A 3" and "a3" are the same road). Use this when the person named a road and no town — "Rastplatz auf der A7". Give road OR place OR lat+lon, never two of them: a road is a 900 km line and a place is a point, so the two answer different questions. When the question names BOTH — "Parkhaus in Köln an der A3" — use the place: a person parks at a point, and the radius already covers the motorway beside it. A road list is in name order and cannot follow a direction of travel: for "A4 Richtung Görlitz" ask with place for the destination or the next town on the way instead, which answers nearest first.

### `check_road_status` — Road status and closures

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> If a motorway, B/Land road (NI, BW, MV, SN, TH; B also SH, BY, BE; pass Land/town as place) is open/closed/restricted now/next days; by place, jams, city/Land messages, Hamburg traffic cameras; lorry limits, Lang-Lkw (vehicle). Use when asked if a road is open/closed/gesperrt/passable, even now — "A8 in diesem Moment gesperrt?" — closures tonight/weekend, or Stau in a town (Köln). Do NOT use for a named motorway frei/clear (Ampel) or its jams/delays — check_autobahn_traffic; dated roadworks — find_roadworks_ahead; a named city street: not held, no call. ≤ 14 days/11 entries. Show attribution.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `horizon_days` | integer | no | `3` | min 0; max 14 |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `lat` | number | no | — | min -90; max 90 |
| `limit` | integer | no | `10` | min 1; max 11 |
| `lon` | number | no | — | min -180; max 180 |
| `place` | string | no | — | min length 1; max length 120 |
| `road` | string | no | — | pattern `^(?:[ABab] ?\d{1,3}\|[LlSs] ?\d{1,4})$` |
| `vehicle` | string | no | — | one of `"lorry"`, `"long_lorry"` |

- **`horizon_days`** — Days ahead from now (0 = right now only, max 14, default 3). Only what was asked; count the days from today to the last day meant, both included: 0 for right now / jetzt / gerade; 1 for today, tonight, heute Abend; 2 for tomorrow; a weekday ("am Freitag") the days through it; "this weekend" the days through Sunday (Monday 7, Friday 3, Sunday 1); "next week" through next Sunday. A bare "is the A8 open?" asks for no window: omit it, never 0. Live closures, and by place the jams reported now, are always included.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`lat`** — Latitude in WGS 84, e.g. 48.137. Use with lon when the caller already holds coordinates; otherwise use place.
- **`limit`** — Maximum entries to return (1–11, default 10). By road, closures come first, then restrictions in force, then planned works; by place, nearest first.
- **`lon`** — Longitude in WGS 84, e.g. 11.576. Use with lat; otherwise use place.
- **`place`** — Where to look, as free text: a city ("München", "Munich"), a district or Kreis ("Kreis Fulda"), a Bundesland, a station or stop ("Hamburg Hbf"), a motorway junction ("AK Neufahrn"), or a street address with a house number ("Bahnhofstraße 12, 36037 Fulda"). A motorway number alone ("A7") resolves to the road, which has no single point — name a town or junction on it instead. Use this instead of coordinates whenever the person named a place. An address needs its town or postcode — a street and a number alone exist in many towns. Give either place OR lat+lon, never both.
- **`road`** — One road: a German motorway, e.g. "A8"; a Bundesstraße in Schleswig-Holstein, Niedersachsen, Baden-Württemberg, Bayern, Berlin, Mecklenburg-Vorpommern, Sachsen or Thüringen, e.g. "B27"; or a Landes- or Staatsstraße in Niedersachsen, Baden-Württemberg, Mecklenburg-Vorpommern, Sachsen or Thüringen, e.g. "L1025" or "S296". "A8", "A 8" and "a8" are the same road. Use this whenever the person named a road — it is the only input that reaches the planned-works data, which is filed by road and section and carries no coordinates. When the person also says WHERE — a town or a Bundesland ("die B2 bei Potsdam", "L1025 in Niedersachsen") — pass that as place too: only sources for that Land answer, and a Land no source covers is named. L and S numbers repeat in every Land, so give the Land with them. Otherwise give exactly one of road, place, or lat+lon.
- **`vehicle`** — Set ONLY when the person asks for a lorry (Lkw, truck, HGV) or a long lorry (Lang-Lkw, EuroCombi, Gigaliner): then the answer is where that vehicle may go, instead of closures. "long_lorry" with a road ("darf der Lang-Lkw auf die A7?") answers whether the road is in the long-lorry positive network; with a place, the network roads near it. "lorry" or "long_lorry" with a place ("Durchfahrtshöhe in Haan", "Lkw-Vorrangroute in Frankfurt", "Gewichtsgrenze in Bremen") answers the height, weight, width and lorry-ban signs near it, and the lorry priority routes, where a publisher holds them (NRW, Frankfurt RheinMain, Bremen). Omit for cars and for closures.

### `find_roadworks_ahead` — Planned roadworks

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> Returns roadworks PLANNED on one motorway, one Bundes-/Landesstraße in NI, BW, MV, SN or TH (BY: B only), or city streets by place, in a date window: section, restriction, dates. Use when a date or window is named, it says geplant, or how long a site lasts ("Baustellen auf der A7 in den Sommerferien?"). ONE road/place per call. Do NOT use when more than one motorway is named, for the situation this minute, or for Baustellen with neither date nor geplant — all three are check_autobahn_traffic; whether a road is open — check_road_status. ≤ 92 days, max 20 sites. Show attribution.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `from` | string | no | — | pattern `^\d{4}-\d{2}-\d{2}$` |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `limit` | integer | no | `10` | min 1; max 20 |
| `place` | string | no | — | min length 2; max length 120 |
| `road` | string | no | — | pattern `^(?:[AaBb] ?\d{1,3}\|[LlSs] ?\d{1,4})$` |
| `to` | string | no | — | pattern `^\d{4}-\d{2}-\d{2}$` |

- **`from`** — First day of the window, as YYYY-MM-DD in German local time. Omit for today. Resolve relative wording ("next Friday", "in den Sommerferien", "nächsten Monat") into real dates yourself, counted from today's date; this argument never takes words, and it never takes a fixed example date — the window a person means moves with the calendar.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`limit`** — Maximum sites to return (1–20, default 10), ordered by planned start. Every returned site is in the structured result; the readable text prints the first 10 and says how many more of them are in the structured half. The answer always names how many sites the window holds in total, so a small limit never hides the size of the problem.
- **`place`** — A place — a district, street or address, e.g. "Hamburg-Altona", "Berlin-Mitte", "Kiel" — for the city and Land roadworks held by point within 3 km of it. Where no such source covers the place, the answer says so. Give road OR place.
- **`road`** — The road to look at, one per call: an Autobahn, e.g. "A7" or "A100"; a Bundesstraße in Niedersachsen, Baden-Württemberg, Bayern, Mecklenburg-Vorpommern, Sachsen or Thüringen, e.g. "B6"; a Landesstraße in Niedersachsen, Baden-Württemberg, Mecklenburg-Vorpommern or Thüringen, e.g. "L1025"; or a Staatsstraße in Sachsen, e.g. "S296" — "A7", "A 7" and "a7" are the same road. B and L roads in other Länder and Kreisstraßen are not covered. Ask again for a second road. Give road OR place.
- **`to`** — Last day of the window, inclusive, as YYYY-MM-DD. Omit for 7 days after `from`, which is the right window for "am I going to hit roadworks on this drive". The window may span at most 92 days. For "how long will this last" / "wie lange dauert die Baustelle noch", leave both dates out: the default 7 days already returns the site's planned end date. Only widen — 28 days is the sensible step — when the person asked about a period that long.

### `find_charging_station` — EV charging nearby

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> Returns EV charging sites near a place or coordinate with operator, connector types, maximum power, price per kWh where published, and how many points are free right now where the operator publishes live status. Use when an EV driver asks where to charge ("Wo kann ich laden?", "CCS 150 kW near Leipzig", "ist gerade eine Säule frei?"). Do NOT use for petrol or diesel — call find_cheapest_fuel; for E-Kennzeichen or Ladekarte rules — call get_driving_rules. Radius ≤ 25 km, ≤ 10 sites; availability is missing for most operators and is then unknown, never free. Show the attribution line.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `connector` | string | no | — | one of `"ccs2"`, `"type2"`, `"chademo"` |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `lat` | number | no | — | min -90; max 90 |
| `limit` | integer | no | `5` | min 1; max 10 |
| `lon` | number | no | — | min -180; max 180 |
| `min_power_kw` | number | no | — | min 1; max 1000 |
| `only_available` | boolean | no | `false` | — |
| `place` | string | no | — | min length 1; max length 120 |
| `radius_km` | number | no | `10` | min 1; max 25 |

- **`connector`** — Plug the car needs: "ccs2" (CCS Combo 2 — the DC fast-charging standard on almost every European EV), "type2" (Typ 2 / Mennekes, the AC socket) or "chademo" (older Japanese DC, e.g. Nissan Leaf). Omit unless the person named their plug or their car model — filtering on a guess hides chargers they could have used.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`lat`** — Latitude in WGS 84, e.g. 48.137. Use with lon when the caller already holds coordinates; otherwise use place.
- **`limit`** — How many lines to return, nearest first (1–10, default 5). Places within 50 m that read alike are folded into one line that says how many units it holds; structuredContent.sites has one entry per place of the lines shown, with siteIds naming every record of that place, so it can be longer than limit.
- **`lon`** — Longitude in WGS 84, e.g. 11.576. Use with lat; otherwise use place.
- **`min_power_kw`** — Only charging points of at least this many kW (1–1000). Use when the person names a number or asks for fast charging: 50 = DC fast (a bare "fast"/"schnell"/"Schnelllader"), 150 = HPC ("HPC", "ultra", "ultraschnell"), 300 = the fastest posts in Germany. Omit for "where can I charge" — 11 kW overnight is a valid answer to that question.
- **`only_available`** — When true, return only sites with at least one point reported FREE right now. Default false. Use it when the person asks what is free at this moment. Note that only some operators publish live status: the result always says how many nearby sites were dropped because their status is unknown, so the filter never silently hides a charger that may well be free.
- **`place`** — Where to look, as free text: a city ("München", "Munich"), a district or Kreis ("Kreis Fulda"), a Bundesland, a station or stop ("Hamburg Hbf"), a motorway junction ("AK Neufahrn"), or a street address with a house number ("Bahnhofstraße 12, 36037 Fulda"). A motorway number alone ("A7") resolves to the road, which has no single point — name a town or junction on it instead. Use this instead of coordinates whenever the person named a place. An address needs its town or postcode — a street and a number alone exist in many towns. Give either place OR lat+lon, never both.
- **`radius_km`** — Search radius around the place in kilometres (1–25, default 10). A charging stop is worth a detour, so this is wider than the fuel radius — but 25 km is the cap, and a larger circle is a dataset request rather than a driver's question.

### `find_hydrogen_station` — Hydrogen stations nearby

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> Returns hydrogen (H2) filling stations near a place or coordinate, nearest first, with operator, address, pumps (700 bar car, 350 bar truck/bus), opening hours where published and the age of the record. Use when someone asks where to refuel a fuel-cell car, lorry or bus ("Wasserstofftankstelle", "H2 tanken", "hydrogen station near me"). Do NOT use for petrol or diesel (call find_fuel_station) or EV charging (call find_charging_station); LPG/Autogas and CNG are not held — say so. Radius ≤ 150 km, ≤ 10 stations; no live availability or price is published. Shows the attribution line.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `lat` | number | no | — | min -90; max 90 |
| `limit` | integer | no | `5` | min 1; max 10 |
| `lon` | number | no | — | min -180; max 180 |
| `place` | string | no | — | min length 1; max length 120 |
| `radius_km` | number | no | `50` | min 1; max 150 |
| `vehicle` | string | no | — | one of `"car"`, `"truck"` |

- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`lat`** — Latitude in WGS 84, e.g. 48.137. Use with lon when the caller already holds coordinates; otherwise use place.
- **`limit`** — How many stations to list, nearest first (1–10, default 5).
- **`lon`** — Longitude in WGS 84, e.g. 11.576. Use with lat; otherwise use place.
- **`place`** — Where to look, as free text: a city ("München", "Munich"), a district or Kreis ("Kreis Fulda"), a Bundesland, a station or stop ("Hamburg Hbf"), a motorway junction ("AK Neufahrn"), or a street address with a house number ("Bahnhofstraße 12, 36037 Fulda"). A motorway number alone ("A7") resolves to the road, which has no single point — name a town or junction on it instead. Use this instead of coordinates whenever the person named a place. An address needs its town or postcode — a street and a number alone exist in many towns. Give either place OR lat+lon, never both.
- **`radius_km`** — Search radius around place or lat+lon in kilometres (1–150, default 50). Hydrogen stations are few, so the default is wide; when none is inside, the answer still names the nearest one beyond. Example: 50
- **`vehicle`** — Which pump the vehicle needs: "car" (Pkw — 700 bar, e.g. Toyota Mirai, Hyundai Nexo; a few sites also offer 350 bar for cars) or "truck" (Lkw or bus — 350 bar). Omit unless the person said what they drive.

### `find_place` — Look up a place

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> Looks up a place name and returns every match, each with its kind, population, English name and coordinate; the official key (AGS/RS) only in the structured result. Use when the person asks where somewhere is, when you need a coordinate for another tool, and above all to RECOVER after a tool reported a name as ambiguous — this is where you find out which Neustadt is which. Pass `near` to rank and separate same-named places by distance. Do NOT use to find a company, shop or landmark: call find_poi. At most 10 results, radius <= 200 km. Every result carries an attribution line to show the user.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `query` | string | **yes** | — | min length 2; max length 120 |
| `kind` | string | no | — | one of `"city"`, `"district"`, `"admin"`, `"station"`, `"stop"`, `"motorway"`, `"junction"` |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `lat` | number | no | — | min -90; max 90 |
| `limit` | integer | no | `5` | min 1; max 10 |
| `lon` | number | no | — | min -180; max 180 |
| `near` | string | no | — | max length 120 |
| `radius_km` | number | no | — | min 1; max 200 |

- **`query`** — The place name to look up, as the person said it — "Neustadt", "Munich", "Kreis Fulda", "Köln Hbf". English names and spellings without umlauts both work.
- **`kind`** — Narrow to one kind: "city", "district" (Kreis), "admin" (Land or Regierungsbezirk), "station", "stop", "motorway" or "junction". Omit unless the person was specific.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`lat`** — Latitude to measure from, instead of `near`.
- **`limit`** — How many candidates to return, best match first (1–10, default 5).
- **`lon`** — Longitude to measure from, instead of `near`.
- **`near`** — A second place to measure from, used to tell same-named candidates apart: "Neustadt" near "Hamburg" is one of twenty Neustadts. Every result then carries its distance from this point.
- **`radius_km`** — When near/lat+lon is given, keep only candidates within this many kilometres (1–200). Omit to rank by distance without dropping any.

### `find_poi` — Find a named place

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> Finds a business or landmark by name or kind — company, shop, clinic, hotel, hostel — with address, category and coordinate. Use when the person names a THING rather than a town: "the adesso office in Dortmund", "the nearest Aldi", "a hotel in Weimar". The coordinate passes to any other tool as lat/lon. Do NOT use for a town, district or station (every tool's `place` resolves those), nor for fuel, charging or parking (own tools). Give "in" (a town) when you can: far faster than nationwide. 25 per page, 50 via cursor; radius <= 50 km. OpenStreetMap under ODbL 1.0; show the attribution line.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `name` | string | **yes** | — | min length 2; max length 120 |
| `category` | string | no | — | one of `"office"`, `"amenity"`, `"shop"`, `"tourism"`, `"healthcare"`, `"leisure"`, `"industrial"`, `"historic"`, `"natural"`, `"building"` |
| `cursor` | string | no | — | max length 256 |
| `in` | string | no | — | max length 120 |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `lat` | number | no | — | min -90; max 90 |
| `limit` | integer | no | `10` | min 1; max 25 |
| `lon` | number | no | — | min -180; max 180 |
| `near` | string | no | — | max length 120 |
| `radius_km` | number | no | `10` | min 1; max 50 |

- **`name`** — The name of the thing to find — a company, shop, clinic, hotel, office or landmark. Part of the name is enough: "adesso" finds "adesso SE". A chain name works too, because brands are matched as well as names. A kind word alone, German or English ("Apotheke", "pharmacy", "trade fair"), lists that kind nearest first. When the person names a company AND a type ("the Bosch office"), put the company here and the type in category. Never for fuel, charging or parking, even near a named company or landmark ("a charger by the Allianz Arena"): those have their own tools, asked with the place.
- **`category`** — Narrow to one OpenStreetMap family: "office" (companies, agencies), "shop", "amenity" (fuel, pharmacy, school, restaurant, town hall), "healthcare" (hospitals, clinics, doctors, pharmacies), "tourism" (hotels, attractions), "leisure", "industrial" (factories, plants), "historic" (castles, monuments, city gates), "natural" (mountain peaks) or "building". Set it whenever the person names the type ("Bosch office" → office, "Hotel Adler" → tourism); omit it when they name no type.
- **`cursor`** — Pagination cursor from a previous result's _meta.nextCursor. Omit for the first page.
- **`in`** — A town to search in — "Dortmund", "Fulda". Strongly preferred: it is both far faster and far less ambiguous than a nationwide search. Use this OR near/lat+lon, not both.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`lat`** — Latitude of the point to search around, when the caller already holds a coordinate.
- **`limit`** — How many to return per page, best match first (1–25, default 10). The answer says when more matched; fetch them with cursor, up to 50 in all.
- **`lon`** — Longitude of the point to search around.
- **`near`** — A place to search around, when the question is "the nearest X" rather than "X in Y". Use with radius_km.
- **`radius_km`** — Search radius in kilometres around near/lat+lon (1–50, default 10). Ignored when "in" is used.

### `find_address` — Look up a street address

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> Looks up a street address: its coordinate, and the named OpenStreetMap objects at it (company, shop, office) or that none are. Use when the person gives a STREET AND NUMBER — "Bahnhofstraße 12, Fulda" — for the point or the business there, never who lives there. The coordinate passes to any other tool as lat/lon. Do NOT use for a town/district/station name alone (find_place) or a company/shop/landmark by name (find_poi). At most 5 points; a door mapped twice is folded, points far apart say how far; several towns are a question. OpenStreetMap ODbL 1.0; show the attribution line.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `query` | string | **yes** | — | min length 3; max length 160 |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `limit` | integer | no | `3` | min 1; max 5 |

- **`query`** — A street address, as a person writes one: street and house number, plus a town or postcode — "Bahnhofstraße 12, 36037 Fulda" or "Bahnhofstraße 12, Fulda". Both orders work. A street and number with neither a town nor a postcode cannot be placed (the same street name exists in about two thousand German towns) and is refused.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`limit`** — How many results to return (1–5, default 3) — more than one means the same address carries more than one OpenStreetMap object.

### `describe_location` — Describe a coordinate

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> Turns a coordinate into words: the nearest address, settlement and motorway junction with their distances, and the Gemeinde, Kreis and Land the point lies in; also any low-emission zone. Use when you already HAVE a lat/lon and need to say where that is. Do NOT use to look up a place or address BY NAME — that is find_place, find_poi or find_address; this only goes coordinate to words. Those come from the municipality the point lies in (its key), not the nearest Kreis point; near the border the answer says so. OpenStreetMap ODbL 1.0 for the address; show the attribution line.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `lat` | number | **yes** | — | min -90; max 90 |
| `lon` | number | **yes** | — | min -180; max 180 |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |

- **`lat`** — Latitude of the point to describe (WGS84).
- **`lon`** — Longitude of the point to describe (WGS84).
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.

### `find_nearby` — What is nearby

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> Overview of what is around a place or coordinate: nearby fuel stations, EV charging, parking, the nearest railway station and motorway junction, each with its distance. Use when someone asks "what is around me" or "what is near <place>" — a broad look, not one category in depth. Do NOT use for a fuel grade's price (find_cheapest_fuel), charger/connector status (find_charging_station), parking kind/occupancy (find_parking), a NAME lookup (find_place/find_poi/find_address), or a coordinate's address (describe_location). Radius ≤ 15 km, up to 3 per category. Shows each source's attribution.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `categories` | array of string | no | — | min 1 item(s); each item: one of `"fuel"`, `"charging"`, `"parking"`, `"station"`, `"junction"` |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `lat` | number | no | — | min -90; max 90 |
| `lon` | number | no | — | min -180; max 180 |
| `place` | string | no | — | min length 1; max length 120 |
| `radius_km` | number | no | `5` | min 1; max 15 |

- **`categories`** — Which categories to include: "fuel", "charging", "parking", "station" (railway station), "junction" (motorway junction). Omit for all five. Pass a subset only when the person named one — otherwise the full picture is the point of this tool.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`lat`** — Latitude in WGS 84, e.g. 48.137. Use with lon when the caller already holds coordinates; otherwise use place.
- **`lon`** — Longitude in WGS 84, e.g. 11.576. Use with lat; otherwise use place.
- **`place`** — Where to look, as free text: a city ("München", "Munich"), a district or Kreis ("Kreis Fulda"), a Bundesland, a station or stop ("Hamburg Hbf"), a motorway junction ("AK Neufahrn"), or a street address with a house number ("Bahnhofstraße 12, 36037 Fulda"). A motorway number alone ("A7") resolves to the road, which has no single point — name a town or junction on it instead. Use this instead of coordinates whenever the person named a place. An address needs its town or postcode — a street and a number alone exist in many towns. Give either place OR lat+lon, never both.
- **`radius_km`** — Search radius around place or lat+lon in kilometres (1–15, default 5). This tool answers "what is around me", not "search a wide area" — for that, use the specific tool with its own wider radius.

### `find_sharing` — Shared bikes nearby

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> Returns rentable shared bikes near a place or coordinate: bike-sharing stations with bikes and free docks now, and free-floating bikes around, with distance and data age (nextbike incl. KVB Rad, MyRadl, VAG_Rad; Donkey Republic). Use when someone asks for a rental or shared bike ("Leihrad", "Fahrradverleih", "nächstes nextbike", "bike share near me"). Do NOT use for parking (find_parking) or a general look around a place (find_nearby). Radius ≤ 5 km, ≤ 20 stations; e-scooters are not covered. Shows each source's attribution.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `lat` | number | no | — | min -90; max 90 |
| `limit` | integer | no | `8` | min 1; max 20 |
| `lon` | number | no | — | min -180; max 180 |
| `only_available` | boolean | no | `true` | — |
| `place` | string | no | — | min length 1; max length 120 |
| `radius_km` | number | no | `1` | min 0.1; max 5 |

- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`lat`** — Latitude in WGS 84, e.g. 48.137. Use with lon when the caller already holds coordinates; otherwise use place.
- **`limit`** — How many stations to list, nearest first (1–20, default 8). Free-floating bikes are summarised, not listed one by one.
- **`lon`** — Longitude in WGS 84, e.g. 11.576. Use with lat; otherwise use place.
- **`only_available`** — true (default): list only stations with at least one bike to rent right now. false: also list empty stations, e.g. to find a free dock to return a bike.
- **`place`** — Where to look, as free text: a city ("München", "Munich"), a district or Kreis ("Kreis Fulda"), a Bundesland, a station or stop ("Hamburg Hbf"), a motorway junction ("AK Neufahrn"), or a street address with a house number ("Bahnhofstraße 12, 36037 Fulda"). A motorway number alone ("A7") resolves to the road, which has no single point — name a town or junction on it instead. Use this instead of coordinates whenever the person named a place. An address needs its town or postcode — a street and a number alone exist in many towns. Give either place OR lat+lon, never both.
- **`radius_km`** — Search radius around place or lat+lon in kilometres (0.1–5, default 1). Example: 1

### `get_driving_rules` — German driving rules

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> Returns the German road rules a visitor needs: low-emission zones (Umweltzone) and the Feinstaubplakette, speed limits (advisory 130), winter tyres, alcohol, the Sunday lorry ban, tolls, Rettungsgasse, what must be in the car, electric cars. Use when someone drives through Germany or asks whether they may enter a city or street. Do NOT use for live traffic or closures: check_autobahn_traffic; to FIND a charger: find_charging_station. city narrows to its zone; place or lat+lon checks a point against the published zone boundaries. Sourced, dated; show the attribution. Not legal advice.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `city` | string | no | — | min length 2; max length 60 |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `lat` | number | no | — | min -90; max 90 |
| `lon` | number | no | — | min -180; max 180 |
| `place` | string | no | — | min length 1; max length 120 |
| `topic` | string | no | — | one of `"lez"`, `"speed"`, `"winter"`, `"alcohol"`, `"toll"`, `"truck_ban"`, `"equipment"`, `"emergency"`, `"ev"` |

- **`city`** — City the question is about, e.g. "Stuttgart", "München", "Munich". Narrows "lez" to that city's zone and adds the per-city caveat for "ev". Other topics are nationwide. Omit when the question is not about one city.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`lat`** — Latitude (WGS 84) of the point to check against the zone boundaries. Use with lon; otherwise use place.
- **`lon`** — Longitude (WGS 84) of the point to check against the zone boundaries. Use with lat; otherwise use place.
- **`place`** — A street address, district, station or other point ("Alexanderplatz, Berlin", "Kölner Dom") to check against the published low-emission-zone boundaries: inside, outside with the distance, or unknown. Give either place OR lat+lon, never both.
- **`topic`** — Which rule to answer. "lez" = low-emission zone and Feinstaubplakette, "speed" = speed limits including the Autobahn advisory 130, "winter" = winter-tyre duty, "alcohol" = alcohol and drugs, "toll" = car and lorry toll, "truck_ban" = Sunday and holiday lorry ban, "equipment" = what the law requires in the car, "emergency" = 112/110, rescue lane, breakdown, crash, "ev" = electric car (E-Kennzeichen, charging payment, plugs). Omit for a one-line overview of all nine; with place or lat+lon, omitted means "lez".

### `check_transit_disruption` — Public-transport disruption in a region

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> How punctual public transport is now in one German region: the share of trips ever >5 min late, trips skipping a stop, trips cancelled, the trend and the service alerts in force there (diversions, closed stops). Use when asked whether buses and trains run normally, or a strike, storm or works disrupt them. Do NOT use for a station's departures or a line from a named DEPARTURE station ("RE1 ab Köln Hbf verspätet?"; a destination, "nach …"/"zum …", is not one) — get_train_departures. No per-line figures. Window ≤ 120 min. CC BY-SA (DELFI) or CC BY 4.0 (VBB, Berlin/Brandenburg): show attribution.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `lat` | number | no | — | min -90; max 90 |
| `lon` | number | no | — | min -180; max 180 |
| `region` | string | no | — | min length 1; max length 120 |
| `window_min` | integer | no | `60` | min 5; max 120 |

- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`lat`** — Latitude in WGS 84, e.g. 48.137. Use with lon when the caller already holds coordinates; otherwise use region.
- **`lon`** — Longitude in WGS 84, e.g. 11.576. Use with lat; otherwise use region.
- **`region`** — The German region to report on, as free text: a Bundesland ("Bayern", "Bavaria", "Nordrhein-Westfalen"), a city ("Hamburg", "Köln"), a Kreis ("Landkreis Fulda") or one of the conurbations Ruhrgebiet, Rhein-Ruhr and Rhein-Main. A town inside a Kreis is reported as that Kreis and the answer says so, because the data is filed at Kreis level. Not a stop, not a street, not an address. Give either region OR lat+lon, never both.
- **`window_min`** — How many minutes back to look, 5–120 (default 60). The trend compares this window with the equally long one before it, so 60 means "the last hour against the hour before". Use a short window for "right now" and a long one for "has it been bad all morning".

### `check_weather_warnings` — Weather warnings and road-surface forecast

**Read-only** — it changes nothing. Reaches a third-party source (open world). Idempotent: true. Destructive: false.

> Returns the official DWD weather warnings in force for a place — storm, snow, ice, heavy rain, thunderstorm, heat — with Warnstufe 1–4, area, validity and the official text unaltered. At a town or coordinate it adds the DWD road-surface forecast (Straßenwetter-Prognose: dry to black ice, road temperature) for the nearest road-weather stations. Use when asked about weather on a trip, safe driving, storm or snow warnings, or icy roads (Glätte, Glatteis). Do NOT use for a general forecast (not offered) or jams (check_autobahn_traffic). Show the attribution line.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `lat` | number | no | — | min -90; max 90 |
| `lon` | number | no | — | min -180; max 180 |
| `min_level` | integer | no | `0` | min 0; max 4 |
| `place` | string | no | — | min length 1; max length 120 |

- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`lat`** — Latitude in WGS 84, e.g. 48.137. Use with lon when the caller already holds coordinates; otherwise use place.
- **`lon`** — Longitude in WGS 84, e.g. 11.576. Use with lat; otherwise use place.
- **`min_level`** — Lowest official DWD level to report, 0–4 (default 0, i.e. everything). The DWD's own names: 1 = Wetterwarnung, 2 = Markante Wetterwarnung, 3 = Unwetterwarnung, 4 = Warnung vor extremem Unwetter; 0 = Vorabinformation Unwetter, an advance notice that is not yet a Warnstufe. Raise it ONLY when the question names a level or a Warnstufe in so many words ("ab Stufe 3", "level 3 or higher", "nur Stufe 4"). Unwetter, Unwetterwarnung, severe and storm are the ordinary way to ask about bad weather, not a filter: leave it at 0 there — a level the caller filtered away is a warning the person is never told about.
- **`place`** — Where to look, as free text: a city ("München", "Munich"), a district or Kreis ("Kreis Fulda"), a Bundesland, a station or stop ("Hamburg Hbf"), a motorway junction ("AK Neufahrn"), or a street address with a house number ("Bahnhofstraße 12, 36037 Fulda"). A motorway number alone ("A7") resolves to the road, which has no single point — name a town or junction on it instead. Use this instead of coordinates whenever the person named a place. An address needs its town or postcode — a street and a number alone exist in many towns. Give either place OR lat+lon, never both.

### `get_train_departures` — Train departures

**Read-only** — it changes nothing. Reaches a third-party source (open world). Idempotent: true. Destructive: false.

> Next trains from a German railway station: platform, delay, cancellations. Use when asked when a train, S-Bahn or ICE leaves a named station, or if a train or line from it is late ("RE1 from Köln Hbf late?"); later today ("heute Abend") stays here. A line with no DEPARTURE station ("ist die S1 pünktlich?"; a destination, "nach …"/"zum …", is not one) — check_transit_disruption. Do NOT use for buses, trams, a non-railway stop, another day or a time over 2 h away — get_departures. Train type: categories (ICE/IC/RE/RB/S); no destination filter. ≤ 15 rows, ≤ 120 min. Show the attribution line.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `categories` | array of string | no | — | min 1 item(s); max 5 item(s); each item: one of `"ICE"`, `"IC"`, `"RE"`, `"RB"`, `"S"` |
| `duration_min` | integer | no | `60` | min 5; max 120 |
| `eva_no` | string | no | — | pattern `^\d{6,8}$` |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `limit` | integer | no | `10` | min 1; max 15 |
| `station` | string | no | — | min length 1; max length 120 |
| `when` | string | no | — | format `date-time`; pattern (288 characters — see the description; the `format` above is the short answer) |

- **`categories`** — Keep only these train types, when the person named one: "ICE", "IC" (also EC, ECE, Railjet, Nightjet), "RE" (also IRE), "RB" or "S" (S-Bahn). "next ICE to …" is ["ICE"], "Fernzug" is ["ICE", "IC"], "Regionalzug" is ["RE", "RB"]. The board then lists only those, so pair it with a longer duration_min. Omit it for "which trains leave". A replacement bus is never a train type.
- **`duration_min`** — How far ahead to look, in minutes (5–120, default 60). Use a small window for "what leaves now" and a larger one for "this evening". Above 120 is refused: a departure board is not a timetable search.
- **`eva_no`** — The station's EVA number (6–8 digits, e.g. 8002549 for Hamburg Hbf), when a previous result gave you one. It skips the name lookup and is exact — use it to answer a follow-up about a station this tool has already named.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`limit`** — How many departures to return, earliest first (1–15, default 10). More than 15 is refused — that is a board a person can read, not a dataset.
- **`station`** — The railway station, as the person says it: "Hamburg Hbf", "Köln Hbf", "Munich Central", "Frankfurt (Main) Hbf". Pass their words — English names and "central station" are understood. If the name fits several stations (a bare "Hauptbahnhof"), call anyway: the result lists them and asks which; do not guess one yourself. Give either station OR eva_no, never both.
- **`when`** — Start of the window as an ISO-8601 instant with an offset ("2026-09-20T18:30:00+02:00"). Leave it out for "now", which is what almost every question means. Times in the answer are Europe/Berlin whatever you pass.

### `get_departures` — Scheduled departures (bus, tram, train)

**Read-only** — it changes nothing. Answers from data this service already holds (closed world). Idempotent: true. Destructive: false.

> Scheduled departures from any German stop — bus, tram, U-Bahn, S-Bahn, train, ferry. Use when asked when a bus, tram, U-/Stadtbahn or ferry goes ("welche Bahnen" at a Hbf too), or for another DAY or a time over 2 h away: "Wann fährt der nächste Bus ab Fulda Bahnhof?" Do NOT use for a railway station's trains now or later today — get_train_departures. Plan times, with a live delay or cancellation per row where held; regional punctuality check_transit_disruption. No A-to-B journeys: say so, no call. Holds ≥ 48 h ahead, ≤ 3 days; further out, say so. 15 per call. Show the attribution line.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `duration_min` | integer | no | `60` | min 5; max 1440 |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `limit` | integer | no | `10` | min 1; max 15 |
| `modes` | array of string | no | — | min 1 item(s); each item: one of `"rail"`, `"subway"`, `"tram"`, `"bus"`, `"ferry"` |
| `stop` | string | no | — | min length 2; max length 120 |
| `stop_id` | string | no | — | min length 3; max length 64 |
| `when` | string | no | — | format `date-time`; pattern (288 characters — see the description; the `format` above is the short answer) |

- **`duration_min`** — How far past that moment to look, in minutes (5–1440, default 60). Small for "what goes now", a few hours for an evening. To look further ahead (the timetable reaches at least 48 h), move `when` instead of widening this: a window of a whole day returns at most 15 rows and would answer about the wrong half of it.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`limit`** — How many departures to return, earliest first (1–15, default 10). The result always says how many more were in the window.
- **`modes`** — Keep only these kinds of service: "bus", "tram", "subway" (U-Bahn), "rail" (every train, including S-Bahn and regional) or "ferry". Omit it unless the person named a kind — "nur Busse", "welche Tram". Several are allowed, which is what "die Busse und Bahnen vor dem Hbf" means. An S-Bahn is "rail": the feed does not always distinguish it, and the line name ("S 6") says which it is.
- **`stop`** — The stop, as the person says it: "Fulda, Bahnhof", "München, Marienplatz", "Köln, Hbf", "Hamburg, Rathausmarkt" (town first). Include the town when the person did — half the names in Germany exist in twenty towns, and a bare "Bahnhof" or "Hauptbahnhof" comes back as a list of candidates to choose from, so call it and let the result ask. Pass their words; do not guess an id. Give either stop OR the stop id, never both.
- **`stop_id`** — The stop's timetable id, exactly as a previous result of this tool gave it ("de:06631:1234"). It skips the name lookup and is exact — use it for a follow-up about a stop this tool has already named, and for one the person picked out of a candidate list.
- **`when`** — Start of the window as an ISO-8601 instant with an offset ("2026-10-02T07:30:00+02:00"). Leave it out for "now". Convert the person's words yourself — "morgen früh", "tonight" — and pass the instant; the answer is always rendered in Europe/Berlin.

### `check_station_facilities` — Station lifts and escalators

**Read-only** — it changes nothing. Reaches a third-party source (open world). Idempotent: true. Destructive: false.

> Whether the lifts and escalators of a railway station or Köln Stadtbahn stop work now: each one, its place, state and reason. Another tram, U-Bahn or bus stop (named with its city: "Stuttgart Charlottenplatz") gets its step-free survey where one exists. Use when asked about step-free access, broken lifts, wheelchair or pram: "Funktioniert der Aufzug am Kölner Hbf?", "is the lift at Hamburg Hbf working?". Do NOT use for departures, platforms or delays — call get_train_departures (trains) or get_departures (bus, tram, U-Bahn). At most 50, broken first. Results carry their attribution line.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `eva_no` | string | no | — | pattern `^\d{6,8}$` |
| `facility` | string | no | `"any"` | one of `"any"`, `"elevator"`, `"escalator"` |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `limit` | integer | no | `20` | min 1; max 50 |
| `station` | string | no | — | min length 1; max length 120 |

- **`eva_no`** — The station's EVA number (6–8 digits, e.g. 8000207 for Köln Hbf), when a previous result — a departure board, for instance — already gave you one. It skips the name lookup and is exact.
- **`facility`** — Which equipment to report: "elevator" for lifts only, "escalator" for escalators only, "any" for both (default). Pass a value only when the person named the equipment itself ("Aufzug", "Rolltreppe", "lift", "escalator"): a question about a wheelchair, a pram, heavy luggage or step-free access keeps the default — an escalator carries a suitcase too, and a filter there hides half of what the traveller needs. Filtering does not change how a broken one is reported, only which ones are listed.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`limit`** — How many facilities to list (1–50, default 20). Out-of-service equipment is listed first and the counts in the summary always cover ALL of them, so a shorter list never hides a broken lift.
- **`station`** — The railway station — or Köln Stadtbahn stop — as the person says it: "Köln Hbf", "Hamburg Hbf", "Munich Central", "Neumarkt Köln". Pass their words — English names and "central station" are understood. If the name fits several stations the result lists them and asks which; do not guess one yourself. Give either station OR eva_no, never both.

### `watch_situation` — Watch for a change

**Not read-only** — it creates or removes state. Answers from data this service already holds (closed world). Idempotent: false. Destructive: false.

> Opens a watch so THIS conversation is told when something changes: a road closed or restricted, a motorway jam, a stop running late, a weather warning, a charger freeing up. Use when asked to be told later: "sag mir Bescheid, wenn die A8 wieder frei ist", "tell me when a warning comes for Kiel". A name is enough as key; no lookup first. Do NOT use to look up now, nor for e-mail, SMS or alerts outside this chat — we cannot send one; say so. Set hours (≤ 24, default 3) for the time asked; condition narrows it (only the reopening, one charge point). Session-scoped, ≤ 10 watches. Show attribution.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `key` | string | **yes** | — | min length 1; max length 200 |
| `kind` | string | **yes** | — | one of `"road"`, `"station"`, `"region"`, `"place"`, `"weather"`, `"charger"` |
| `condition` | object | no | — | keys: `delay_min`, `late_share`, `min_trips`, `radius_km`, `min_level`, `event`, `events`, `point_id` (each described below); `additionalProperties` |
| `hours` | number | no | — | min 0.25; max 24 |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `request` | string | no | — | max length 200 |
| `until` | string | no | — | format `date-time`; pattern (288 characters — see the description; the `format` above is the short answer) |

- **`key`** — The thing to watch, in the person's own words — a name is enough and no read tool is needed first; the server resolves it and the answer names the key it resolved to. `road`: a road number ("A8", "B27"). `place`: a town or address ("Fulda"). `weather`: a place name ("Kiel"), resolved to the DWD warn cell it lies in — or a warn cell id ("801002000"); a Land or Kreis is an area and takes no single cell. `station`: a stop or station name ("Köln Hbf", "München, Marienplatz"), resolved to its DHID the way get_departures resolves a stop — or a DHID ("de:14612:28"); an EVA number from get_train_departures ("8000207") is not a DHID and is refused. `charger`: a place ("Würzburg"), resolved to the nearest charging site that reports live occupancy — or a site id from find_charging_station. `region`: a city, district or Land ("Hamburg", "Landkreis Fulda"), resolved to its AGS key the way check_transit_disruption resolves its region — or an AGS key ("14612"). A name that fits several places or stops gets a which-one list and opens no watch; call again with the chosen line.
- **`kind`** — What kind of thing to watch. `road` = one motorway or federal road (key: "A8", "B27") — reports a closure or restriction appearing or clearing, and on a motorway a jam (condition events) appearing or clearing; `station` = one public-transport stop (key: its name, "Köln Hbf", or its DHID) — reports departures running late past the threshold; `region` = a city, district or Land (key: its name, "Hamburg", or its AGS key, "14612") — reports the share of late trips crossing the threshold; `place` = a town or address (key: "Fulda") — reports road restrictions appearing within the radius, not a jam; `weather` = one DWD warn cell (key: a place name, "Kiel", or the cell id) — reports an official warning coming into force; `charger` = one charging site (key: a place, "Würzburg", or the site id) — reports a point turning free.
- **`condition`** — Optional threshold; the keys of each kind, with an example: road {"event": "reopen"} (only the reopening), {"events": ["jams"]} (jams on a motorway); station {"delay_min": 20}; region {"late_share": 0.3, "delay_min": 5, "min_trips": 20}; place {"radius_km": 10}; weather {"min_level": 3}; charger {"point_id": "2"} (one charge point). Any other key, or a key of another kind, is refused by name; leave it out for the default. The answer repeats the condition it applies.
  - `delay_min` (integer, min 1; max 600) — station: minutes of delay that count as a disruption (default 10).
  - `late_share` (number, min 0.01; max 1) — region: share of observed trips running late that trips the watch (default 0.25).
  - `min_trips` (integer, min 1; max 10000) — region: below this many observed trips the share is noise (default 10).
  - `radius_km` (number, min 0.1; max 200) — place: how far around the place to look (default 25).
  - `min_level` (integer, min 0; max 4) — weather: lowest DWD warning level worth reporting (default 2).
  - `event` (string, one of `"reopen"`, `"any"`) — road: 'reopen' reports only a restriction (or jam) clearing; 'any' reports both (default).
  - `events` (array of string, min 1 item(s); max 4 item(s); each item: one of `"restrictions"`, `"jams"`) — road: what to report — 'restrictions' (closures, roadworks, restrictions; the default) and/or 'jams' (a jam the Autobahn GmbH or the police report on the motorway, motorways only). A jam watch: ["jams"]; both: ["restrictions", "jams"].
  - `point_id` (string, min length 1; max length 200) — charger: one charge point of the site instead of any of them.
- **`hours`** — How long to watch, in hours (default 3, maximum 24). Prefer this over `until`: it needs no knowledge of the current time. Give one of `hours` or `until`, never both.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`request`** — The person's request in their own words ("sag mir Bescheid, wenn sich auf der A7 ein Stau bildet"). Pass it on every call: a jam asked for on a motorway is watched (the Autobahn GmbH's and the police's jam reports); on another road, and for a `place` watch, closures and restrictions only, never a jam or slow traffic, and the answer says so.
- **`until`** — An explicit end instant as ISO-8601 with an offset ("2026-09-20T18:40:00+02:00"), at most 24 hours ahead. Use only when the person named a time; otherwise use `hours`. Give one of `hours` or `until`, never both.

### `stop_watch` — Stop a watch

**Not read-only** — it creates or removes state. Answers from data this service already holds (closed world). Idempotent: false. Destructive: false.

> Ends a watch this conversation opened with watch_situation, so no further notifications arrive for it. Use when the person no longer needs to be told — "du musst mir nichts mehr zur A8 sagen", "stop watching that charger". No id at hand: pass kind ("weather") and key in the person's words ("A8", "Bamberg", "Kiel"); one match is stopped, several are listed. Do NOT use to look a situation up (call check_road_status), to list what is running (read viafrei://watches), or to cancel anything outside this chat. Another session's watch is never found. Results carry their attribution line.

| parameter | type | required | default | constraints |
| --- | --- | --- | --- | --- |
| `key` | string | no | — | min length 1; max length 200 |
| `kind` | string | no | — | one of `"road"`, `"station"`, `"region"`, `"place"`, `"weather"`, `"charger"` |
| `language` | string | no | `"de"` | one of `"de"`, `"en"` |
| `uri` | string | no | — | max length 64 |
| `watch_id` | integer | no | — | min 1; max 9007199254740991 |

- **`key`** — Instead of an id: the watched subject in the person's words, as it was given to watch_situation — a road or place ("A8", "Bamberg"), and with `kind` a place for a weather or charger watch or a stop name for a station watch ("Kiel", "Köln Hbf"), which is resolved the way watch_situation resolved it. The id the watch carries works too. For a station, region, weather or charger watch a key that matches none of them falls back to `kind` alone. Matched against this session's open watches, case and spaces ignored. One match is stopped; several are listed and none is stopped.
- **`kind`** — Instead of an id: the kind of watch the person means, as watch_situation took it ("road", "station", "region", "place", "weather", "charger"). "Turn off the charging alert" is kind "charger" alone.
- **`language`** — Set this on every call to the language the person is writing in: "en" if they wrote English, "de" if they wrote German. Do not leave it out: it defaults to German ("de"), which is only the fallback when the language is genuinely unclear, so an English question sent without it is answered in German — a wrong answer. Place names, station names and road numbers are never translated in either language; in English the German term is kept in parentheses so the person recognises it on signs and in local apps.
- **`uri`** — The watch's resource uri, e.g. "viafrei://watch/12". Give either this or `watch_id`, not both.
- **`watch_id`** — The numeric id of the watch to stop, as `watch_situation` returned it (the 12 in viafrei://watch/12).

## Resources

| URI | name | type |
| --- | --- | --- |
| `viafrei://attribution` | attribution | `text/plain` |
| `viafrei://coverage` | coverage | `application/json` |
| `viafrei://rules/driving-in-germany` | rules-driving-in-germany | `text/markdown` |
| `viafrei://rules/low-emission-zones` | rules-low-emission-zones | `text/markdown` |
| `viafrei://emergency` | emergency | `text/markdown` |
| `viafrei://rules/electric-driving` | rules-electric-driving | `text/markdown` |
| `viafrei://status/feeds` | feed-status | `application/json` |
| `viafrei://watches` | watches | `application/json` |
| `viafrei://gazetteer` | gazetteer | `application/json` |
| `viafrei://addresses` | addresses | `application/json` |

- **`viafrei://attribution`** — Licence and attribution text for every data source ViaFrei uses.
- **`viafrei://coverage`** — Which feeds, places and vehicles ViaFrei can answer for right now — licence, cadence and freshness per feed, which large cities hold no fuel price yet, plus what is deliberately not covered. Generated from the feed catalogue.
- **`viafrei://rules/driving-in-germany`** — Curated, sourced and dated: low-emission zones, speed, winter tyres, alcohol, tolls, the Sunday lorry ban, equipment, emergencies and electric driving. German and English in one document.
- **`viafrei://rules/low-emission-zones`** — Which German cities run a low-emission zone, which Feinstaubplakette they require and where to buy it. Düsseldorf is named but excluded: its zone data is under a closed licence.
- **`viafrei://emergency`** — What to dial, how to form the Rettungsgasse, what to do in a breakdown or after a crash, and what the law requires you to carry. German and English.
- **`viafrei://rules/electric-driving`** — What an electric car needs in Germany: the E-Kennzeichen and why its privileges differ per city, the green plaque, the right to ad-hoc card payment, plug standards, how prices are shown, etiquette and what to do in an emergency.
- **`viafrei://status/feeds`** — Per feed: is it still arriving? green (a cycle inside the feed's own freshness window), red (stale or errored) or grey (never ran here). Subscribe to be told when a feed changes colour.
- **`viafrei://watches`** — The watches THIS conversation has open, with what each one is watching and when it expires. Session-scoped: another conversation's watches are not listed and cannot be reached.
- **`viafrei://gazetteer`** — What the place index (gazetteer_places) holds: rows and last load per source and kind, how many carry an English name, and the sixteen Länder it can name — the coverage behind find_place/find_poi/find_nearby's place answers.
- **`viafrei://addresses`** — What the OSM-derived address table (osm_addresses) holds per Bundesland — the Länder and each one's extract date read from the rows, the row counts estimated from the planner's statistics and labelled so — plus the ODbL § 4.6 offer owed to anyone who receives an address-derived result.

## Resource templates

| URI template | name | type |
| --- | --- | --- |
| `viafrei://watch/{id}` | watch | `application/json` |
| `viafrei://place/{query}` | place | `application/json` |

- **`viafrei://watch/{id}`** — One watch of this conversation: what is being watched, what it has reported, and the attribution of the data behind each report. Subscribe to be told when it reports something new.
- **`viafrei://place/{query}`** — One place, poi or address resolved the same way every tool resolves `place` — a point, a short list of candidates, or an honest no — so a name can be pinned once and reused as lat/lon.

## Prompts

Prompts are ready-made requests a client can offer as a menu entry. Each one
orchestrates several tools, so it is usually a better starting point than a
single call.

### `plan_departure`

*Trip briefing before departure — Reise-Briefing vor der Abfahrt*

> Briefs a drive that is about to start: the official weather warnings at both ends, whether each motorway is open, and the jams in force this minute, ending in one go/no-go sentence. Use when the traveller asks whether to set off now, how the route looks today, or what is waiting on the A-roads. Do NOT use to weigh car against train — that is compare_travel_options; for a refuelling stop use plan_fuel_stop, for parking on arrival plan_arrival_parking. Show every result's attribution line.

| argument | required | description |
| --- | --- | --- |
| `origin` | **yes** | Where the drive starts, as the traveller wrote it. Example: "München" or "Bahnhofstraße 12, 36037 Fulda". |
| `destination` | **yes** | Where the drive ends, as the traveller wrote it. Example: "Berlin". |
| `roads` | no | The motorways the route uses, comma-separated, at most five. Example: "A9, A4". Leave it out and the recipe names the obvious ones and says so. |
| `departure` | no | When the drive starts, in local words or as an ISO-8601 time with offset. Example: "now", "tomorrow 06:30", "2026-09-21T06:30+02:00". Defaults to now. |
| `language` | no | Set this to the language the traveller is writing in: "en" for English, "de" for German. It decides both the language you answer in and the language argument you pass to every tool call in the recipe. Leave it out only when the language is genuinely unclear — the fallback is German, because the road is German. |

### `compare_travel_options`

*Drive or take the train? — Auto oder Bahn?*

> Weighs one trip by car against the same trip by rail: closures and live jams on the motorway side, the next departures and the region's punctuality on the rail side, as two paragraphs the traveller can compare. Use when the traveller has not decided how to travel. Do NOT use once the decision is made — brief the drive with plan_departure, the rail leg with plan_commute. The punctuality figures keep their own attribution (share-alike unless VBB answered); show every attribution line.

| argument | required | description |
| --- | --- | --- |
| `origin` | **yes** | Where the trip starts, as the traveller wrote it. Example: "Köln". |
| `destination` | **yes** | Where the trip ends, as the traveller wrote it. Example: "Frankfurt". |
| `when` | no | When they want to travel, in local words or as an ISO-8601 time with offset. Example: "this evening". Defaults to now. |
| `roads` | no | The motorways the drive would use, comma-separated, at most five. Example: "A3". Leave it out and the recipe names the obvious ones and says so. |
| `language` | no | Set this to the language the traveller is writing in: "en" for English, "de" for German. It decides both the language you answer in and the language argument you pass to every tool call in the recipe. Leave it out only when the language is genuinely unclear — the fallback is German, because the road is German. |

### `prepare_car_trip`

*What you need before driving in Germany — Vorbereitung der Autofahrt*

> Collects what a driver must carry and know before driving in Germany and into one particular city: the low-emission-zone badge, speed limits, winter tyres, the alcohol limit, tolls, mandatory equipment and the rules for an electric car. Use when the traveller is a visitor, is renting a car, or asks whether a city needs a sticker. Do NOT use for the live road situation — that is plan_departure — or for where to leave the car, which is plan_arrival_parking. Show the attribution and the review date.

| argument | required | description |
| --- | --- | --- |
| `destination_city` | **yes** | The city the driver will actually drive INTO, because the low-emission zone is a city rule. Example: "Stuttgart". |
| `vehicle` | no | What they are driving, when it changes the answer: "electric" adds the charging and badge rules, "lorry" the Sunday driving ban. Defaults to a petrol or diesel car. |
| `topic` | no | One rule topic, if they asked about exactly one — the same nine values get_driving_rules takes. Map what they said: Umweltplakette/Feinstaubplakette/low-emission zone → "lez", Winterreifen → "winter", Tempolimit → "speed", Promillegrenze → "alcohol", Maut → "toll", Sonntagsfahrverbot → "truck_ban", Warnweste/Verbandkasten → "equipment", Rettungsgasse/Panne → "emergency", E-Auto/Laden → "ev". Leave it out for the overview of all nine. |
| `language` | no | Set this to the language the traveller is writing in: "en" for English, "de" for German. It decides both the language you answer in and the language argument you pass to every tool call in the recipe. Leave it out only when the language is genuinely unclear — the fallback is German, because the road is German. |

### `plan_fuel_stop`

*Refuel or charge on the way — Tank- oder Ladestopp unterwegs*

> Finds where this traveller fills up or charges on the way: the cheapest stations for one fuel grade around one place, or the charging points with the right connector and power, and the rest area beside them if they also need a break. Use when the tank or the battery is the question. Do NOT use to brief the whole route — that is plan_departure — and not for parking at the destination, which is plan_arrival_parking. Prices are consumer information for this traveller alone; show every attribution line and any purpose note verbatim.

| argument | required | description |
| --- | --- | --- |
| `place` | **yes** | Where the traveller will be when they need the stop — a town, a junction, a station or a street address with its postcode. One place per call. Example: "Ingolstadt" or "A9 Anschlussstelle Allershausen". |
| `energy` | no | What the vehicle takes. "electric" switches the recipe to charging points; the three fuel grades go to the fuel stations. Set it whenever they named a grade — the fallback is "e10", the standard German petrol and find_cheapest_fuel's own default, and the recipe then says out loud that it was assumed. |
| `radius_km` | no | How far they are willing to detour, in kilometres, at most 25 (the provider's limit). Example: "10". Defaults to 5. |
| `break_too` | no | "yes" if they also want somewhere to stop and rest, which adds one parking call on the same road. Defaults to "no". |
| `language` | no | Set this to the language the traveller is writing in: "en" for English, "de" for German. It decides both the language you answer in and the language argument you pass to every tool call in the recipe. Leave it out only when the language is genuinely unclear — the fallback is German, because the road is German. |

### `plan_commute`

*Plan today's commute by train — Pendelfahrt für heute planen*

> Plans one public-transport leg on the day itself: the next departures from the station with delays, platforms and cancellations, and whether the region's buses and trains are running normally at this hour. Use when the train is already the decision — a daily commute, or any leg where they need the next departures and nothing else. Do NOT use to weigh rail against driving — that is compare_travel_options — and not for motorway traffic, which is plan_departure. The punctuality figures (share-alike unless VBB answered) stay in their own paragraph; show every attribution line.

| argument | required | description |
| --- | --- | --- |
| `from_station` | **yes** | The station they leave from, as they say it. Example: "Köln Hbf", "Munich Central". |
| `to_station` | no | Where they are heading, used only to pick the right departures out of the board. Example: "Düsseldorf". We hold no journey planner, so this never becomes a route. |
| `when` | no | When they want to leave, in local words or as an ISO-8601 time with offset. Example: "in 20 minutes". Defaults to now. |
| `language` | no | Set this to the language the traveller is writing in: "en" for English, "de" for German. It decides both the language you answer in and the language argument you pass to every tool call in the recipe. Leave it out only when the language is genuinely unclear — the fallback is German, because the road is German. |

### `plan_arrival_parking`

*Where to leave the car on arrival — Parken am Ziel*

> Finds where to leave the car at the end of the drive: the car park in town, the park-and-ride at the edge with the onward departures, or the rest area if the traveller is early. Use when the drive is ending, or whenever someone asks where to put the car. Do NOT use for a refuelling or charging stop — that is plan_fuel_stop — and not for the live road situation, which is plan_departure. A facility that publishes no occupancy is reported as such, never as zero free spaces; show every attribution line.

| argument | required | description |
| --- | --- | --- |
| `destination` | **yes** | Where they want to park — a town, a district, a station or a street address with its postcode. Example: "Köln Innenstadt", "Freiburg Hbf". |
| `kind` | no | Which kind of parking: "car_park" is the enclosed Parkhaus in town, "park_and_ride" the P+R at the edge, "rest_area" the Rastanlage beside a motorway, "truck" a lorry site. Defaults to "any". |
| `arrival` | no | When they arrive, in local words or as an ISO-8601 time with offset. Example: "in 40 minutes". Defaults to now. |
| `language` | no | Set this to the language the traveller is writing in: "en" for English, "de" for German. It decides both the language you answer in and the language argument you pass to every tool call in the recipe. Leave it out only when the language is genuinely unclear — the fallback is German, because the road is German. |

### `find_a_place`

*Find out what a name refers to — Herausfinden, was ein Name meint*

> Resolves a bare name of unknown kind into a place, a named thing, or an address, trying each table in turn and stopping at the first that answers. Use when the traveller names something and you do not yet know whether it is a town, a company, or a street address — or to recover after a tool reported a name as ambiguous. Do NOT use once the kind is already known: a settlement name goes straight to find_place, a company or landmark to find_poi, a street address to find_address. Show every attribution line.

| argument | required | description |
| --- | --- | --- |
| `query` | **yes** | The name to resolve, exactly as the traveller wrote it. Example: "Neustadt", "adesso", "Bahnhofstraße 12, 36037 Fulda". |
| `near` | no | A second place to measure from, used only if find_place answers with more than one candidate for a common name. Example: "Hamburg". |
| `language` | no | Set this to the language the traveller is writing in: "en" for English, "de" for German. It decides both the language you answer in and the language argument you pass to every tool call in the recipe. Leave it out only when the language is genuinely unclear — the fallback is German, because the road is German. |

### `plan_local_errand`

*What is around this place? — Was ist hier in der Nähe?*

> Answers "what is around here" for one place: the nearest fuel, EV charging, parking, railway station and motorway junction in one glance, then — only if the traveller wants more than the nearest one — the depth tool for that one category. Use when it is a quick local stop with nothing decided yet. Do NOT use once the traveller already knows what they need: a fuel grade's price is plan_fuel_stop or find_cheapest_fuel directly, a specific connector or live status is find_charging_station, parking kind or occupancy is find_parking. Show every attribution line.

| argument | required | description |
| --- | --- | --- |
| `place` | **yes** | Where the errand happens — a town, junction, station or street address with its postcode. Example: "Fulda". |
| `need` | no | Narrow the glance to one category when the traveller named one. Defaults to "everything", the full glance across all five categories find_nearby covers. |
| `language` | no | Set this to the language the traveller is writing in: "en" for English, "de" for German. It decides both the language you answer in and the language argument you pass to every tool call in the recipe. Leave it out only when the language is genuinely unclear — the fallback is German, because the road is German. |

### `explain_this_coordinate`

*Say where a coordinate is — Sagen, wo eine Koordinate liegt*

> Turns a bare lat/lon into a sentence a traveller understands: the nearest address, settlement and motorway junction with their distances, and the Gemeinde, Kreis and Land the point lies in. Use whenever you already hold a coordinate — from the traveller, or from another tool's result — and need to say where it is. Do NOT use to look a place up BY NAME: that is find_a_place, find_place, find_poi or find_address. The Gemeinde, Kreis and Land are read off the municipality's official key (#683), not the nearest gazetteer point. OpenStreetMap ODbL 1.0 for the address; show the attribution line.

| argument | required | description |
| --- | --- | --- |
| `lat` | **yes** | Latitude of the point, as a decimal degree. Example: "50.5546". |
| `lon` | **yes** | Longitude of the point, as a decimal degree. Example: "9.6773". |
| `language` | no | Set this to the language the traveller is writing in: "en" for English, "de" for German. It decides both the language you answer in and the language argument you pass to every tool call in the recipe. Leave it out only when the language is genuinely unclear — the fallback is German, because the road is German. |

---

Generated from `catalogue.json` by `scripts/gen-api-doc.mjs`. The snapshot was
read from `https://mcp.viafrei.de/mcp` on 2026-10-23; no tool was invoked to
produce it, so no data provider was contacted.
