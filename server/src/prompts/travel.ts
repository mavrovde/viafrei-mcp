// The MCP prompts, moved from the ViaFrei platform; comments removed in the move.
import { z } from "zod";
import { TOPICS } from "../content/rules/types.js";
import { ATTRIBUTION_RULE, COVERAGE_RULE, FUEL_ANSWER_SHAPE, MTSK_RULE, NO_INVENTION_RULE, NO_ROUTING_RULE, RULES_ADVICE_RULE, SHARE_ALIKE_RULE, TIME_RULE, answerIn, definePrompt, joinLines, languageArg, languageOf, rulesBlock, } from "./types.js";
function roadsOrAsk(roads: string | undefined): string {
    return roads !== undefined && roads.trim() !== ""
        ? roads
        : "no road was named — name the obvious motorways for this pair yourself, say in one clause that you assumed them, and ask only if the pair is genuinely ambiguous";
}
function whenOr(when: string | undefined, fallback: string): string {
    return when !== undefined && when.trim() !== "" ? when : fallback;
}
export const planDeparture = definePrompt({
    name: "plan_departure",
    title: "Trip briefing before departure — Reise-Briefing vor der Abfahrt",
    description: "Briefs a drive that is about to start: the official weather warnings at both ends, whether each motorway is open, and the jams in force this minute, ending in one go/no-go sentence. Use when the traveller asks whether to set off now, how the route looks today, or what is waiting on the A-roads. Do NOT use to weigh car against train — that is compare_travel_options; for a refuelling stop use plan_fuel_stop, for parking on arrival plan_arrival_parking. Show every result's attribution line.",
    shape: {
        origin: z.string().describe("Where the drive starts, as the traveller wrote it. Example: \"München\" or \"Bahnhofstraße 12, 36037 Fulda\"."),
        destination: z.string().describe("Where the drive ends, as the traveller wrote it. Example: \"Berlin\"."),
        roads: z
            .string()
            .optional()
            .describe("The motorways the route uses, comma-separated, at most five. Example: \"A9, A4\". Leave it out and the recipe names the obvious ones and says so."),
        departure: z
            .string()
            .optional()
            .describe("When the drive starts, in local words or as an ISO-8601 time with offset. Example: \"now\", \"tomorrow 06:30\", \"2026-09-21T06:30+02:00\". Defaults to now."),
        ...languageArg,
    },
    render: (a) => {
        const language = languageOf(a);
        return joinLines([
            `Trip briefing: ${a.origin} → ${a.destination}, departing ${whenOr(a.departure, "now")}.`,
            "",
            "Call these tools in this order, and stop as soon as the picture is clear:",
            `1. check_weather_warnings for ${a.origin}, then a second call for ${a.destination}, with min_level=0 — a Vorabinformation is exactly what changes a departure time.`,
            `2. check_road_status once per motorway (${roadsOrAsk(a.roads)}), with horizon_days=1 for a departure today and horizon_days=3 when they are leaving tomorrow.`,
            "3. check_autobahn_traffic with ALL of those roads in ONE call — it takes up to five — for what is in force this minute.",
            "",
            "Then answer in at most twelve lines:",
            "- first line: the verdict — set off now, wait, or take another route — and the single reason for it;",
            "- the warnings in force, each with its DWD Warnstufe and the window it is valid for;",
            "- per road: closures first, then the worst jam with its delay in minutes;",
            "- last: the attribution lines and the Stand / As of time.",
            "",
            ...rulesBlock([ATTRIBUTION_RULE, TIME_RULE, NO_INVENTION_RULE, NO_ROUTING_RULE]),
            "",
            answerIn(language),
        ]);
    },
});
export const compareTravelOptions = definePrompt({
    name: "compare_travel_options",
    title: "Drive or take the train? — Auto oder Bahn?",
    description: "Weighs one trip by car against the same trip by rail: closures and live jams on the motorway side, the next departures and the region's punctuality on the rail side, as two paragraphs the traveller can compare. Use when the traveller has not decided how to travel. Do NOT use once the decision is made — brief the drive with plan_departure, the rail leg with plan_commute. The punctuality figures keep their own attribution (share-alike unless VBB answered); show every attribution line.",
    shape: {
        origin: z.string().describe("Where the trip starts, as the traveller wrote it. Example: \"Köln\"."),
        destination: z.string().describe("Where the trip ends, as the traveller wrote it. Example: \"Frankfurt\"."),
        when: z
            .string()
            .optional()
            .describe("When they want to travel, in local words or as an ISO-8601 time with offset. Example: \"this evening\". Defaults to now."),
        roads: z
            .string()
            .optional()
            .describe("The motorways the drive would use, comma-separated, at most five. Example: \"A3\". Leave it out and the recipe names the obvious ones and says so."),
        ...languageArg,
    },
    render: (a) => {
        const language = languageOf(a);
        return joinLines([
            `Compare driving against taking the train: ${a.origin} → ${a.destination}, ${whenOr(a.when, "leaving now")}.`,
            "",
            "The car side, two calls:",
            `1. check_road_status for each motorway (${roadsOrAsk(a.roads)}) — a closure decides this question on its own.`,
            "2. check_autobahn_traffic with all of those roads in one call, for the delay in minutes right now.",
            "",
            "The rail side, two calls, and they stay separate from the car side:",
            `3. get_train_departures from the main station at ${a.origin}, with duration_min=120 and limit=10 — the trains that actually leave, with delays and cancellations.`,
            `4. check_transit_disruption for the region around ${a.origin}, as its own call, for how reliable the network is at this hour.`,
            "",
            "Then write two short paragraphs — Car, Rail — and one closing sentence that recommends one of them and says what would change the recommendation. Do not compute a combined score, a total travel time or a reliability percentage across the two: we hold no journey planner and no road travel time, so any such number would be invented.",
            "",
            ...rulesBlock([SHARE_ALIKE_RULE, ATTRIBUTION_RULE, TIME_RULE, NO_INVENTION_RULE, NO_ROUTING_RULE]),
            "",
            answerIn(language),
        ]);
    },
});
export const prepareCarTrip = definePrompt({
    name: "prepare_car_trip",
    title: "What you need before driving in Germany — Vorbereitung der Autofahrt",
    description: "Collects what a driver must carry and know before driving in Germany and into one particular city: the low-emission-zone badge, speed limits, winter tyres, the alcohol limit, tolls, mandatory equipment and the rules for an electric car. Use when the traveller is a visitor, is renting a car, or asks whether a city needs a sticker. Do NOT use for the live road situation — that is plan_departure — or for where to leave the car, which is plan_arrival_parking. Show the attribution and the review date.",
    shape: {
        destination_city: z.string().describe("The city the driver will actually drive INTO, because the low-emission zone is a city rule. Example: \"Stuttgart\"."),
        vehicle: z
            .enum(["car", "electric", "lorry", "motorhome"])
            .optional()
            .describe("What they are driving, when it changes the answer: \"electric\" adds the charging and badge rules, \"lorry\" the Sunday driving ban. Defaults to a petrol or diesel car."),
        topic: z
            .enum(TOPICS)
            .optional()
            .describe("One rule topic, if they asked about exactly one — the same nine values get_driving_rules takes. Map what they said: Umweltplakette/Feinstaubplakette/low-emission zone → \"lez\", Winterreifen → \"winter\", Tempolimit → \"speed\", Promillegrenze → \"alcohol\", Maut → \"toll\", Sonntagsfahrverbot → \"truck_ban\", Warnweste/Verbandkasten → \"equipment\", Rettungsgasse/Panne → \"emergency\", E-Auto/Laden → \"ev\". Leave it out for the overview of all nine."),
        ...languageArg,
    },
    render: (a) => {
        const language = languageOf(a);
        const vehicle = a.vehicle ?? "car";
        const evCall = vehicle === "electric" && a.topic !== "ev";
        return joinLines([
            `Prepare a driver for a trip into ${a.destination_city}${vehicle === "car" ? "" : ` with a vehicle of type: ${vehicle}`}.`,
            "",
            evCall ? "Three calls, at most:" : "Two calls, at most:",
            `1. get_driving_rules with city="${a.destination_city}"${a.topic !== undefined ? ` and topic="${a.topic}"` : " and no topic at all, for the overview of all nine"}.`,
            ...(evCall
                ? [`2. get_driving_rules again with city="${a.destination_city}" and topic="ev" — the E-Kennzeichen, what charging costs and which plugs are here. No other topic answers it, and it carries the caveat that these are city rules.`]
                : []),
            vehicle === "electric"
                ? `${evCall ? "3" : "2"}. Read viafrei://rules/electric-driving for the long form of the charging and parking rules, and viafrei://rules/low-emission-zones for the badge.`
                : "2. Read viafrei://rules/low-emission-zones when a badge is in question, or viafrei://rules/driving-in-germany for the long form of a rule the tool answered in one line.",
            "",
            "Then answer in at most ten lines: the badge first, because it is the one that turns a driver back at the city boundary, then the rules that carry a fine, then the equipment list. Name the city by name in every sentence that is about that city only — a rule that holds in Stuttgart and not in Leipzig must never be written as a German rule.",
            "",
            "If the trip is about to start, offer the plan_departure prompt for the live road and weather picture, and plan_arrival_parking for where to leave the car. Do not call those tools yourself here.",
            "",
            ...rulesBlock([RULES_ADVICE_RULE, ATTRIBUTION_RULE, NO_INVENTION_RULE, NO_ROUTING_RULE]),
            "",
            answerIn(language),
        ]);
    },
});
export const planFuelStop = definePrompt({
    name: "plan_fuel_stop",
    title: "Refuel or charge on the way — Tank- oder Ladestopp unterwegs",
    description: "Finds where this traveller fills up or charges on the way: the cheapest stations for one fuel grade around one place, or the charging points with the right connector and power, and the rest area beside them if they also need a break. Use when the tank or the battery is the question. Do NOT use to brief the whole route — that is plan_departure — and not for parking at the destination, which is plan_arrival_parking. Prices are consumer information for this traveller alone; show every attribution line and any purpose note verbatim.",
    shape: {
        place: z
            .string()
            .describe("Where the traveller will be when they need the stop — a town, a junction, a station or a street address with its postcode. One place per call. Example: \"Ingolstadt\" or \"A9 Anschlussstelle Allershausen\"."),
        energy: z
            .enum(["e5", "e10", "diesel", "electric"])
            .optional()
            .describe("What the vehicle takes. \"electric\" switches the recipe to charging points; the three fuel grades go to the fuel stations. Set it whenever they named a grade — the fallback is \"e10\", the standard German petrol and find_cheapest_fuel's own default, and the recipe then says out loud that it was assumed."),
        radius_km: z
            .string()
            .optional()
            .describe("How far they are willing to detour, in kilometres, at most 25 (the provider's limit). Example: \"10\". Defaults to 5."),
        break_too: z
            .enum(["yes", "no"])
            .optional()
            .describe("\"yes\" if they also want somewhere to stop and rest, which adds one parking call on the same road. Defaults to \"no\"."),
        ...languageArg,
    },
    render: (a) => {
        const language = languageOf(a);
        const electric = a.energy === "electric";
        const radius = whenOr(a.radius_km, "5");
        const gradeAssumed = a.energy === undefined;
        const grade = a.energy === undefined || a.energy === "electric" ? "e10" : a.energy;
        return joinLines([
            `Find one ${electric ? "charging" : "refuelling"} stop near ${a.place}.`,
            "",
            "One call answers this, two at most:",
            electric
                ? `1. find_charging_station at ${a.place} with radius_km=${radius} (at most 25) and limit=10. Pass the connector and min_power_kw only if the traveller named them, and only_available=true only if they said they want one that is free now — the result then tells you how many sites that filter hid, and you pass that number on.`
                : `1. find_cheapest_fuel at ${a.place} with radius_km=${radius} (at most 25), fuel="${grade}" and limit=10.${gradeAssumed ? " Nobody named a grade: e10 is the standard German petrol and the tool's own default, so say in one clause that you assumed it, and ask which grade only if the answer would change." : ""}`,
            a.break_too === "yes"
                ? "2. find_parking on the same road or around the same place, with limit=5 and NO kind filter — so the stop and the break are the same stop. Do not ask for a Rastanlage by kind: no feed we ingest classifies that category, so the filter would hide the lorry parking and the car parks we do hold."
                : "2. Nothing else. Do not call a second tool to widen the answer; say instead how the traveller could widen it.",
            "",
            electric
                ? "Then answer in at most eight lines: the nearest usable site first with its power and connector, then the alternatives, and for each one its live state — frei, belegt, außer Betrieb, or keine Statusdaten. Silence is never \"free\": a site with no status data is reported as having none."
                : `Then answer in at most eight lines: ${FUEL_ANSWER_SHAPE}. One stop for this traveller, this journey — that is the whole answer.`,
            "",
            ...rulesBlock(electric
                ? [COVERAGE_RULE, ATTRIBUTION_RULE, TIME_RULE, NO_INVENTION_RULE, NO_ROUTING_RULE]
                : [MTSK_RULE, ATTRIBUTION_RULE, TIME_RULE, NO_INVENTION_RULE, NO_ROUTING_RULE]),
            "",
            answerIn(language),
        ]);
    },
});
export const planCommute = definePrompt({
    name: "plan_commute",
    title: "Plan today's commute by train — Pendelfahrt für heute planen",
    description: "Plans one public-transport leg on the day itself: the next departures from the station with delays, platforms and cancellations, and whether the region's buses and trains are running normally at this hour. Use when the train is already the decision — a daily commute, or any leg where they need the next departures and nothing else. Do NOT use to weigh rail against driving — that is compare_travel_options — and not for motorway traffic, which is plan_departure. The punctuality figures (share-alike unless VBB answered) stay in their own paragraph; show every attribution line.",
    shape: {
        from_station: z.string().describe("The station they leave from, as they say it. Example: \"Köln Hbf\", \"Munich Central\"."),
        to_station: z
            .string()
            .optional()
            .describe("Where they are heading, used only to pick the right departures out of the board. Example: \"Düsseldorf\". We hold no journey planner, so this never becomes a route."),
        when: z
            .string()
            .optional()
            .describe("When they want to leave, in local words or as an ISO-8601 time with offset. Example: \"in 20 minutes\". Defaults to now."),
        ...languageArg,
    },
    render: (a) => {
        const language = languageOf(a);
        return joinLines([
            `Plan one public-transport leg from ${a.from_station}${a.to_station !== undefined && a.to_station.trim() !== "" ? ` towards ${a.to_station}` : ""}, ${whenOr(a.when, "leaving now")}.`,
            "",
            "Two calls, and they must stay two:",
            `1. get_train_departures from ${a.from_station} with duration_min=60 and limit=10.`,
            `2. check_transit_disruption for the region around ${a.from_station}, as a separate call, for how the network is running at this hour.`,
            "",
            "Then answer in at most ten lines:",
            "- first line: the next departure that suits them — time, line, destination, platform, and the delay as 08:05 (+3 min);",
            "- a cancellation or a platform change is named before any alternative, because it is the thing that makes them miss the train;",
            "- then, in a paragraph of its own, how the region's network is running, with its own attribution line;",
            "- say plainly that realtime per line is not available: check_transit_disruption answers for the REGION as a whole over the last hour, never for one line, one bus or one vehicle, so \"is my S6 running?\" is a question we cannot answer and must not appear to;",
            "- we hold no journey planner and no fares: if they ask for a connection with changes or for a ticket price, say that we do not have it and point them at the operator.",
            "",
            ...rulesBlock([SHARE_ALIKE_RULE, ATTRIBUTION_RULE, TIME_RULE, NO_INVENTION_RULE, NO_ROUTING_RULE]),
            "",
            answerIn(language),
        ]);
    },
});
export const planArrivalParking = definePrompt({
    name: "plan_arrival_parking",
    title: "Where to leave the car on arrival — Parken am Ziel",
    description: "Finds where to leave the car at the end of the drive: the car park in town, the park-and-ride at the edge with the onward departures, or the rest area if the traveller is early. Use when the drive is ending, or whenever someone asks where to put the car. Do NOT use for a refuelling or charging stop — that is plan_fuel_stop — and not for the live road situation, which is plan_departure. A facility that publishes no occupancy is reported as such, never as zero free spaces; show every attribution line.",
    shape: {
        destination: z
            .string()
            .describe("Where they want to park — a town, a district, a station or a street address with its postcode. Example: \"Köln Innenstadt\", \"Freiburg Hbf\"."),
        kind: z
            .enum(["any", "car_park", "park_and_ride", "rest_area", "truck"])
            .optional()
            .describe("Which kind of parking: \"car_park\" is the enclosed Parkhaus in town, \"park_and_ride\" the P+R at the edge, \"rest_area\" the Rastanlage beside a motorway, \"truck\" a lorry site. Defaults to \"any\"."),
        arrival: z
            .string()
            .optional()
            .describe("When they arrive, in local words or as an ISO-8601 time with offset. Example: \"in 40 minutes\". Defaults to now."),
        ...languageArg,
    },
    render: (a) => {
        const language = languageOf(a);
        const kind = a.kind ?? "any";
        return joinLines([
            `Find parking at ${a.destination}, arriving ${whenOr(a.arrival, "shortly")}.`,
            "",
            "One call finds the parking; the rest are about being allowed to arrive at all:",
            `1. find_parking at ${a.destination}${kind === "any" ? "" : ` with kind="${kind}"`}, radius_km=5 (at most 25) and limit=10. Pass only_with_free_spaces=true only if they said they need a space that is free right now — most German operators publish no occupancy at all, and the filter would hide the sites that simply say nothing.`,
            kind === "park_and_ride"
                ? "2. get_train_departures from the station that P+R site serves, so they know the onward connection before they park."
                : "2. Only if they said they are parking in order to travel on: get_train_departures from the nearest station.",
            `3. get_driving_rules with city="${a.destination}" and topic="lez", unless this conversation has already covered it — the Umweltplakette decides whether they may drive into the city at all, and parking they cannot legally reach is not parking. Use the city name out of the destination; skip this call when the destination is a motorway or a place with no city around it.`,
            "4. If they named the motorway they arrive on, check_road_status for it once: a closure on the last stretch changes where the car goes. Offer the prepare_car_trip prompt when the badge or the rules turn out to be the real question, and plan_departure when the road is.",
            "",
            "Then answer in at most eight lines: the nearest suitable facility first with its kind, distance and capacity, then the alternatives. For each one, free spaces ONLY where the operator publishes them — a facility with no occupancy data is reported as \"keine Belegungsdaten veröffentlicht\" / \"no occupancy published\", never as 0 free, and a reading that is old is given with its age rather than as \"now\".",
            "",
            ...rulesBlock([COVERAGE_RULE, ATTRIBUTION_RULE, TIME_RULE, NO_INVENTION_RULE, NO_ROUTING_RULE]),
            "",
            answerIn(language),
        ]);
    },
});
export const TRAVEL_PROMPTS = [
    planDeparture,
    compareTravelOptions,
    prepareCarTrip,
    planFuelStop,
    planCommute,
    planArrivalParking,
] as const;
