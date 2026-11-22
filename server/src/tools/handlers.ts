/**
 * The tool handlers: each maps its catalogue arguments to one API operation (or a few), and renders the
 * envelope. No handler reads a database or calls a provider; get_train_departures (in `trains.ts`) asks the
 * API's live refresher for a fresh board. A tool whose operation the API contract lacks answers `notAvailable` and is listed in GAPS.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DataMeta, Envelope } from "../api/client.js";
import type * as T from "../api/types.js";
import { berlinDateTime, berlinTime, eur, km, notAvailable, toolError, toolResult, type Language } from "../presentation.js";
import { SID_CONDITION_NOTE } from "../sid-consent.js";
import { atParam, bool, isResult, num, placeMissing, position, radiusM, str, strs, type Args, type Handler, type ToolContext } from "./context.js";
import { getTrainDepartures } from "./trains.js";

const L = (language: Language, de: string, en: string): string => (language === "de" ? de : en);

function none(language: Language, metas: readonly DataMeta[], what: string): CallToolResult {
  return toolResult(L(language, `Keine ${what} gefunden.`, `No ${what} found.`), metas, language);
}

/** Today's server's refusals of a station, stop or region it cannot find (#120 A1, 3.3): errors, verbatim. */
const NOT_KNOWN = {
  facilityStation: (q: string, language: Language) => toolError(L(language,
    `Einen Bahnhof oder eine Haltestelle "${q}" kenne ich nicht. Bitte den Namen so nennen, wie er am Bahnhof oder an der Haltestelle steht, mit der Stadt (z. B. "Köln Hbf", "Stuttgart Charlottenplatz").`,
    `I do not know a station or stop called "${q}". Please give the name as it appears at the station or stop, with the city (e.g. "Köln Hbf", "Stuttgart Charlottenplatz").`)),
  station: (q: string, language: Language) => toolError(L(language,
    `Den Bahnhof "${q}" kenne ich nicht. Bitte den Namen so nennen, wie er am Bahnhof steht (z. B. "Köln Hbf").`,
    `I do not know a station called "${q}". Please give the name as it appears at the station (e.g. "Köln Hbf").`)),
  eva: (eva: string, language: Language) => toolError(L(language,
    `Zu EVA ${eva} halten wir keinen Bahnhofseintrag. Aufzüge: check_station_facilities; Abfahrten: get_train_departures.`,
    `We hold no station record for EVA ${eva}. Lifts: check_station_facilities; departures: get_train_departures.`)),
  stop: (q: string, language: Language) => toolError(L(language,
    `Die Haltestelle "${q}" kenne ich nicht. Bitte den Namen so nennen, wie er am Schild steht, am besten mit Ort (z. B. "Fulda Bahnhof", "München, Marienplatz").`,
    `I do not know a stop called "${q}". Please give the name as it appears on the sign, ideally with its town (e.g. "Fulda Bahnhof", "München, Marienplatz").`)),
  region: (q: string, language: Language) => toolError(L(language,
    `"${q}" kenne ich als Region nicht. Die Daten sind auf Kreisebene gemeldet — bitte ein Bundesland, eine kreisfreie Stadt oder den Kreis nennen (z. B. "Bayern", "Köln", "Landkreis Fulda").`,
    `I do not know "${q}" as a region. The data is filed at Kreis level — name a Bundesland, a city or the Kreis (for example "Bayern", "Köln", "Landkreis Fulda").`)),
};

/** A session holds at most this many open watches, as today's server does. */
export const MAX_WATCHES = 10;

function situationLine(s: T.RoadSituation, language: Language): string {
  const until = s.validity.until === null ? "" : L(language, ` bis ${berlinDateTime(s.validity.until, language)}`, ` until ${berlinDateTime(s.validity.until, language)}`);
  const delay = s.delayMin === null ? "" : L(language, ` (+${s.delayMin} min)`, ` (+${s.delayMin} min)`);
  const dir = s.directionText === null ? "" : ` ${s.directionText}`;
  return `- ${s.road ?? ""}${dir}: ${s.headline}${delay}${until}${s.distanceM === undefined ? "" : ` · ${km(s.distanceM, language)}`}`;
}

function situationsBody(d: T.RoadConditionsData, language: Language, limit: number | undefined): string {
  const rows = d.situations.slice(0, limit ?? 20);
  const head = `${d.lampReason}`;
  return rows.length === 0 ? head : [head, ...rows.map((s) => situationLine(s, language))].join("\n");
}

const checkAutobahnTraffic: Handler = async (args, ctx) => {
  const { language } = ctx;
  const roads = strs(args["roads"]) ?? [];
  const kinds = strs(args["kinds"]);
  const limit = num(args["limit"]);
  if (roads.length > 0) {
    const reads = await Promise.all(roads.slice(0, 5).map((road) => ctx.api.get<T.RoadConditionsData>("getMotorwayConditions", { road, kinds, limit, cursor: str(args["cursor"]) })));
    const body = reads.map((r, i) => `${roads[i]}: ${situationsBody(r.data, language, limit)}`).join("\n\n");
    return toolResult(body, reads.map((r) => r.meta), language, { nextCursor: reads.length === 1 ? (reads[0]!.meta.page?.nextCursor ?? null) : null });
  }
  const land = str(args["land"]);
  if (land !== undefined) {
    const r = await ctx.api.get<T.RoadConditionsData>("listStateRoadConditions", { state: LAND_CODES[land] ?? land, kinds, limit, road_class: ["motorway"] });
    return toolResult(situationsBody(r.data, language, limit), [r.meta], language);
  }
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const r = await ctx.api.get<T.RoadConditionsData>("listRoadConditions", { at: atParam(pos.at), radius_m: radiusM(args["radius_km"]), kinds, limit, road_class: ["motorway"] });
  return toolResult(situationsBody(r.data, language, limit), [r.meta], language);
};

const checkRoadStatus: Handler = async (args, ctx) => {
  const { language } = ctx;
  const road = str(args["road"]);
  const limit = num(args["limit"]);
  const horizon = num(args["horizon_days"]);
  const vehicle = str(args["vehicle"]);
  const metas: DataMeta[] = [];
  let body: string;
  let at: string | undefined;
  if (road !== undefined && /^A\s?\d+$/i.test(road)) {
    const r = await ctx.api.get<T.RoadConditionsData>("getMotorwayConditions", { road: road.replace(/\s/g, "").toUpperCase(), horizon_days: horizon, limit });
    metas.push(r.meta);
    body = situationsBody(r.data, language, limit);
  } else {
    const pos = await position(args, ctx);
    if (isResult(pos)) return pos;
    at = atParam(pos.at);
    const r = await ctx.api.get<T.RoadConditionsData>("listRoadConditions", { at, horizon_days: horizon, limit });
    metas.push(r.meta);
    const rows = road === undefined ? r.data.situations : r.data.situations.filter((s) => (s.road ?? "").replace(/\s/g, "").toUpperCase() === road.replace(/\s/g, "").toUpperCase());
    body = situationsBody({ ...r.data, situations: rows }, language, limit);
  }
  if (vehicle === "lorry" || vehicle === "long_lorry") {
    const rules = await ctx.api.get<T.LorryRule[]>("listLorryRules", { vehicle, road, at });
    metas.push(rules.meta);
    if (rules.data.length > 0) body += `\n\n${L(language, "Lkw-Regeln:", "Lorry rules:")}\n${rules.data.slice(0, 10).map((x) => `- ${[x.road, x.street, x.municipality].filter(Boolean).join(", ")}: ${x.publishedText ?? x.kind ?? x.layer}`).join("\n")}`;
  }
  return toolResult(body, metas, language);
};

/** The catalogue names a Land as today's server does (its slug); the API's path is the Land's two-digit AGS code. */
const LAND_CODES: Readonly<Record<string, string>> = {
  "schleswig-holstein": "01", hamburg: "02", niedersachsen: "03", bremen: "04", "nordrhein-westfalen": "05", hessen: "06",
  "rheinland-pfalz": "07", "baden-wuerttemberg": "08", bayern: "09", saarland: "10", berlin: "11", brandenburg: "12",
  "mecklenburg-vorpommern": "13", sachsen: "14", "sachsen-anhalt": "15", thueringen: "16",
};

const findRoadworksAhead: Handler = async (args, ctx) => {
  const { language } = ctx;
  const road = str(args["road"]);
  const limit = num(args["limit"]);
  if (road !== undefined) {
    const r = await ctx.api.get<T.RoadConditionsData>("getMotorwayConditions", { road: road.replace(/\s/g, "").toUpperCase(), kinds: ["roadworks"], horizon_days: 14, limit });
    return toolResult(situationsBody(r.data, language, limit), [r.meta], language);
  }
  // `from` and `to` are the window's days (YYYY-MM-DD, the schema's pattern), never a place.
  const pos = await position({ place: args["place"] }, ctx);
  if (isResult(pos)) return pos;
  const r = await ctx.api.get<T.RoadConditionsData>("listRoadConditions", { at: atParam(pos.at), kinds: ["roadworks"], horizon_days: 14, limit });
  return toolResult(situationsBody(r.data, language, limit), [r.meta], language);
};

const fuelLine = (s: T.FuelStation, fuel: string | undefined, language: Language): string => {
  const prices = s.prices.filter((p) => fuel === undefined || p.fuel === fuel).map((p) => `${p.fuel.toUpperCase()} ${eur(p.priceEur, language)}`).join(", ");
  return `- ${s.name}${s.brand ? ` (${s.brand})` : ""} · ${km(s.distanceM, language)} · ${prices || "–"}${s.openingState === "closed" ? L(language, " · geschlossen", " · closed") : ""}`;
};

const fuelSearch = (sortDefault: "price" | "distance"): Handler => async (args, ctx) => {
  const { language } = ctx;
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const fuel = str(args["fuel"]) ?? (sortDefault === "price" ? "e10" : undefined);
  const r = await ctx.api.get<T.FuelStation[]>("listFuelOptions", {
    at: atParam(pos.at), radius_m: radiusM(args["radius_km"]), fuel, brand: str(args["brand"]), name: str(args["name"]),
    open_now: bool(args["open_now"]), open_at: str(args["open_at"]), whole_day: bool(args["whole_day"]), sort: str(args["sort"]) ?? sortDefault, limit: num(args["limit"]),
  });
  if (r.data.length === 0) return none(language, [r.meta], L(language, "Tankstellen", "filling stations"));
  return toolResult(r.data.map((s) => fuelLine(s, fuel, language)).join("\n"), [r.meta], language);
};

const findChargingStation: Handler = async (args, ctx) => {
  const { language } = ctx;
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const r = await ctx.api.get<T.ChargingSite[]>("listChargingOptions", {
    at: atParam(pos.at), radius_m: radiusM(args["radius_km"]), connector: str(args["connector"]), min_kw: num(args["min_power_kw"]), max_kw: num(args["max_power_kw"]),
    operator: str(args["operator"]), conditions: strs(args["conditions"]), only_available: bool(args["only_available"]), limit: num(args["limit"]),
  });
  if (r.data.length === 0) return none(language, [r.meta], L(language, "Ladestationen", "charging stations"));
  const lines = r.data.map((s) => `- ${s.name ?? s.operator ?? s.id} · ${km(s.distanceM, language)} · ${s.summary.chargePoints} ${L(language, "Ladepunkte", "points")}${s.summary.maxPowerKw === null ? "" : `, max ${s.summary.maxPowerKw} kW`}${s.summary.availableNow === null ? "" : L(language, `, ${s.summary.availableNow} frei`, `, ${s.summary.availableNow} free`)}`);
  return toolResult(lines.join("\n"), [r.meta], language);
};

const findHydrogenStation: Handler = async (args, ctx) => {
  const { language } = ctx;
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const r = await ctx.api.get<T.HydrogenData>("listHydrogenOptions", { at: atParam(pos.at), radius_m: radiusM(args["radius_km"]), vehicle: str(args["vehicle"]), limit: num(args["limit"]) });
  const rows = r.data.stations.length > 0 ? r.data.stations : r.data.nearest === null ? [] : [r.data.nearest];
  if (rows.length === 0) return none(language, [r.meta], L(language, "Wasserstofftankstellen", "hydrogen stations"));
  return toolResult(rows.map((s) => `- ${s.name ?? s.operator ?? s.brand ?? "H2"} · ${km(s.distanceM, language)}`).join("\n"), [r.meta], language);
};

async function parkingRead(ctx: ToolContext, op: "listParkingOptions" | "listMotorwayParking", params: Record<string, unknown>): Promise<{ r: Envelope<T.ParkingSite[]>; conditionNote?: string }> {
  const first = await ctx.api.get<T.ParkingSite[]>(op, params as never);
  const terms = first.meta.terms ?? [];
  if (terms.length === 0 || ctx.askSidConsent === undefined) return { r: first };
  const outcome = await ctx.askSidConsent(ctx.language);
  if (outcome !== "accepted") return { r: first };
  const accepted = await ctx.api.get<T.ParkingSite[]>(op, { ...params, accept_terms: terms.map((t) => t.accept).join(",") } as never);
  return { r: accepted, conditionNote: SID_CONDITION_NOTE[ctx.language] };
}

const findParking: Handler = async (args, ctx) => {
  const { language } = ctx;
  const kindArg = str(args["kind"]);
  if (kindArg === "disabled_badge") return notAvailable(language, "kind=disabled_badge");
  const kind = kindArg === "any" ? undefined : kindArg;
  const common = { kind, free_min: bool(args["only_with_free_spaces"]) === true ? 1 : undefined, facilities: strs(args["facilities"]), limit: num(args["limit"]) };
  const road = str(args["road"]);
  let read;
  if (road !== undefined) read = await parkingRead(ctx, "listMotorwayParking", { road: road.replace(/\s/g, "").toUpperCase(), ...common });
  else {
    const pos = await position(args, ctx);
    if (isResult(pos)) return pos;
    read = await parkingRead(ctx, "listParkingOptions", { at: atParam(pos.at), radius_m: radiusM(args["radius_km"]), ...common });
  }
  const { r } = read;
  if (r.data.length === 0) return none(language, [r.meta], L(language, "Parkplätze", "car parks"));
  const lines = r.data.map((p) => {
    const occ = p.occupancy === null || p.occupancy.free === null ? "" : L(language, ` · ${p.occupancy.free} frei${p.occupancy.total === null ? "" : ` von ${p.occupancy.total}`}`, ` · ${p.occupancy.free} free${p.occupancy.total === null ? "" : ` of ${p.occupancy.total}`}`);
    return `- ${p.name ?? p.operator ?? p.id} (${p.kind})${p.distanceM === null || p.distanceM === undefined ? "" : ` · ${km(p.distanceM, language)}`}${occ}`;
  });
  return toolResult(lines.join("\n"), [r.meta], language, read.conditionNote === undefined ? {} : { conditionNote: read.conditionNote });
};

const findSpeedCameras: Handler = async (args, ctx) => {
  const { language } = ctx;
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const r = await ctx.api.get<T.SpeedData>("listSpeedCameras", { at: atParam(pos.at), radius_m: radiusM(args["radius_km"]), limit: num(args["limit"]) });
  const rows = [...r.data.official, ...r.data.osm];
  if (rows.length === 0) return none(language, [r.meta], L(language, "Blitzer", "speed cameras"));
  return toolResult(rows.map((c) => `- ${[c.street, c.municipality].filter(Boolean).join(", ") || c.locationLabel || c.id} (${c.kind})${c.limitKmh === null ? "" : ` · ${c.limitKmh} km/h`}`).join("\n"), [r.meta], language);
};

const PLACE_KIND: Record<string, string> = { city: "municipality", district: "district", admin: "region", station: "station_area", stop: "station_area", motorway: "motorway", junction: "junction" };

const findPlace: Handler = async (args, ctx) => {
  const { language } = ctx;
  const kindArg = str(args["kind"]);
  let at: string | undefined;
  if (str(args["near"]) !== undefined || num(args["lat"]) !== undefined) {
    const pos = await position(args, ctx, "near");
    if (isResult(pos)) return pos;
    at = atParam(pos.at);
  }
  const r = await ctx.api.get<T.PlaceItem[]>("listPlaces", { q: str(args["query"]), kind: kindArg === undefined ? undefined : PLACE_KIND[kindArg], at, radius_m: radiusM(args["radius_km"]), limit: num(args["limit"]) });
  if (r.data.length === 0) return none(language, [r.meta], L(language, "Orte", "places"));
  return toolResult(r.data.map((p) => `- ${p.name} (${p.kind}) · ${p.location.lat.toFixed(5)}, ${p.location.lon.toFixed(5)}`).join("\n"), [r.meta], language);
};

const findPoi: Handler = async (args, ctx) => {
  const { language } = ctx;
  let at: string | undefined;
  if (str(args["near"]) !== undefined || num(args["lat"]) !== undefined) {
    const pos = await position(args, ctx, "near");
    if (isResult(pos)) return pos;
    at = atParam(pos.at);
  }
  const r = await ctx.api.get<T.Poi[]>("listPois", { name: str(args["name"]), in: str(args["in"]), at, radius_m: radiusM(args["radius_km"]), category: str(args["category"]), limit: num(args["limit"]), cursor: str(args["cursor"]) });
  if (r.data.length === 0) return none(language, [r.meta], L(language, "Orte", "places"));
  const lines = r.data.map((p) => `- ${p.name ?? p.kind ?? p.category} · ${[[p.street, p.number].filter(Boolean).join(" "), [p.postcode, p.place].filter(Boolean).join(" ")].filter(Boolean).join(", ")}${p.distanceM === null ? "" : ` · ${km(p.distanceM, language)}`}`);
  return toolResult(lines.join("\n"), [r.meta], language, { nextCursor: r.meta.page?.nextCursor ?? null });
};

const findAddress: Handler = async (args, ctx) => {
  const { language } = ctx;
  const r = await ctx.api.get<T.AddressData>("listAddresses", { q: str(args["query"]), limit: num(args["limit"]) });
  if (r.data.addresses.length === 0) return none(language, [r.meta], L(language, "Adressen", "addresses"));
  return toolResult(r.data.addresses.map((a) => `- ${[[a.street, a.number].filter(Boolean).join(" "), [a.postcode, a.place].filter(Boolean).join(" ")].filter(Boolean).join(", ")} · ${a.location.lat.toFixed(5)}, ${a.location.lon.toFixed(5)}`).join("\n"), [r.meta], language);
};

const nameOf = (n: T.Named): string | null => (n === null ? null : (n.name ?? null));

/** The low-emission zone line: the zone the position is in, or the nearest one and how far; none without a zone. */
function zoneLine(z: T.LowEmissionZone | null, language: Language): string | null {
  if (z === null || z.zone === null || z.verdict === "unknown") return null;
  if (z.verdict === "inside") return L(language, `Umweltzone: ${z.zone} (innerhalb)`, `Low-emission zone: ${z.zone} (inside)`);
  if (z.verdict === "transfer") return L(language, `Umweltzone: ${z.zone} (freigegebener Randbereich)`, `Low-emission zone: ${z.zone} (released area at its edge)`);
  const away = z.distanceM === null ? "" : L(language, ` (${km(z.distanceM, language)} entfernt)`, ` (${km(z.distanceM, language)} away)`);
  return L(language, `Umweltzone: ${z.zone}${away}`, `Low-emission zone: ${z.zone}${away}`);
}

const describeLocation: Handler = async (args, ctx) => {
  const { language } = ctx;
  const lat = num(args["lat"]);
  const lon = num(args["lon"]);
  if (lat === undefined || lon === undefined) return toolError(L(language, "Bitte lat und lon angeben.", "Please give lat and lon."));
  const r = await ctx.api.get<T.LocationData>("describeLocation", { at: atParam({ lat, lon }) });
  const d = r.data;
  const lines = [nameOf(d.municipality), nameOf(d.district), nameOf(d.state)].filter((x): x is string => x !== null);
  const zone = zoneLine(d.lowEmissionZone, language);
  if (zone !== null) lines.push(zone);
  return toolResult(lines.join("\n") || L(language, "Zu dieser Position ist nichts bekannt.", "Nothing is known about this position."), [r.meta], language);
};

const findNearby: Handler = async (args, ctx) => {
  const { language } = ctx;
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const r = await ctx.api.get<T.NearbyData>("listNearby", { at: atParam(pos.at), radius_m: radiusM(args["radius_km"]), categories: strs(args["categories"]) });
  const d = r.data;
  const title = (part: T.NearbyPart): string =>
    ({
      fuel: L(language, "Tankstellen", "Fuel"),
      charging: L(language, "Laden", "Charging"),
      parking: L(language, "Parken", "Parking"),
      station: L(language, "Bahnhöfe", "Stations"),
      junction: L(language, "Autobahn-Anschlussstellen", "Motorway junctions"),
      needs: L(language, "Orte des Alltags", "Everyday places"),
    })[part];
  const block = <X>(heading: string, rows: readonly X[] | undefined, line: (x: X) => string, max: number): string[] =>
    rows === undefined ? [] : [`${heading}:\n${rows.length === 0 ? "- –" : rows.slice(0, max).map((x) => `- ${line(x)}`).join("\n")}`];
  const at = (m: number | null | undefined): string => (m === null || m === undefined ? "" : ` · ${km(m, language)}`);
  const price = (p: T.FuelPrice): string =>
    ` · ${p.fuel.toUpperCase()} ${eur(p.priceEur, language)}${p.current ? "" : L(language, ` (nicht aktuell, gemeldet ${berlinDateTime(p.reportedAt, language)})`, ` (not current, reported ${berlinDateTime(p.reportedAt, language)})`)}`;
  const blocks = [
    ...block(title("fuel"), d.fuel, (s) => `${s.name ?? s.brand ?? "–"}${s.prices.map(price).join("")}${at(s.distanceM)}`, 3),
    ...block(title("charging"), d.charging, (s) => `${s.name ?? s.operator ?? "–"}${s.summary.maxPowerKw === null ? "" : ` · ${s.summary.maxPowerKw} kW`}${at(s.distanceM)}`, 3),
    ...block(title("parking"), d.parking, (s) => `${s.name ?? s.operator ?? "–"}${at(s.distanceM)}`, 3),
    ...block(title("station"), d.stations, (s) => `${s.name}${at(s.distanceM)}`, 3),
    ...block(title("junction"), d.junctions, (j) => `${j.name}${j.road === null ? "" : ` (${[j.road, j.number].filter((x) => x !== null).join(" ")})`}${at(j.distanceM)}`, 3),
    ...(d.needs ?? []).flatMap((n) => block(n.need, n.places, (p) => `${p.name}${p.street ? `, ${p.street}${p.houseNo ? ` ${p.houseNo}` : ""}` : ""}${at(p.distanceM)}`, 5)),
  ];
  // A category that is not ok is absent from data and named in meta.parts: it is said, not dropped.
  const why: Record<Exclude<T.NearbyPartStatus["status"], "ok" | "not_requested">, string> = {
    timeout: L(language, "hat nicht rechtzeitig geantwortet – bitte gleich noch einmal fragen.", "did not answer in time – please ask again shortly."),
    unavailable: L(language, "gerade nicht verfügbar.", "not available right now."),
    not_permitted: L(language, "mit diesem Zugang nicht freigegeben.", "not included in this access."),
  };
  const failed = ((r.meta["parts"] as readonly T.NearbyPartStatus[] | undefined) ?? []).flatMap((p) => (p.status === "ok" || p.status === "not_requested" ? [] : [`${title(p.part)}: ${why[p.status]}`]));
  const body = [...blocks, ...(failed.length === 0 ? [] : [failed.join("\n")])].join("\n\n");
  return toolResult(body || L(language, "In diesem Umkreis ist nichts bekannt.", "Nothing is known within this radius."), [r.meta], language);
};

const findSharing: Handler = async (args, ctx) => {
  const { language } = ctx;
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const only = bool(args["only_available"]);
  const r = await ctx.api.get<T.SharingData>("listSharingOptions", { at: atParam(pos.at), radius_m: radiusM(args["radius_km"]), limit: num(args["limit"]), only_available: only === undefined ? undefined : String(only) });
  const lines = r.data.stations.map((s) => `- ${s.name ?? s.systemLabel ?? s.system} · ${km(s.distanceM, language)}${s.bikes === null ? "" : L(language, ` · ${s.bikes} Räder`, ` · ${s.bikes} bikes`)}`);
  lines.push(L(language, `Freie Fahrzeuge im Umkreis: ${r.data.vehicles.count}`, `Free vehicles nearby: ${r.data.vehicles.count}`));
  return toolResult(lines.join("\n"), [r.meta], language);
};

const getDrivingRules: Handler = async (args, ctx) => {
  const { language } = ctx;
  let at: string | undefined;
  if (str(args["place"]) !== undefined || num(args["lat"]) !== undefined) {
    const pos = await position(args, ctx);
    if (isResult(pos)) return pos;
    at = atParam(pos.at);
  }
  const r = await ctx.api.get<T.DrivingRulesData>("getDrivingRules", { topic: str(args["topic"]) ?? "speed", city: str(args["city"]), at });
  const d = r.data;
  const body = [d.title, ...d.rules.map((x) => `- ${x.text}${x.legalBasis === null ? "" : ` (${x.legalBasis})`}`), L(language, `Geprüft am ${d.reviewedOn}.`, `Reviewed on ${d.reviewedOn}.`), d.disclaimer].join("\n");
  return toolResult(body, [r.meta], language);
};

/** The official region code the contract's `area` wants: given as one, a region name through listPlaces, or a position through describeLocation. */
async function areaCode(args: Args, ctx: ToolContext): Promise<{ code: string | undefined; metas: DataMeta[] }> {
  const region = str(args["region"]);
  if (region !== undefined && /^[0-9]{2,12}$/.test(region)) return { code: region, metas: [] };
  if (region !== undefined) {
    const r = await ctx.api.get<T.PlaceItem[]>("listPlaces", { q: region, limit: 1 });
    return { code: r.data[0]?.districtCode ?? undefined, metas: [r.meta] };
  }
  const lat = num(args["lat"]);
  const lon = num(args["lon"]);
  if (lat === undefined || lon === undefined) return { code: undefined, metas: [] };
  const r = await ctx.api.get<T.LocationData>("describeLocation", { at: atParam({ lat, lon }) });
  return { code: r.data.district?.code ?? r.data.state?.code ?? undefined, metas: [r.meta] };
}

const checkTransitDisruption: Handler = async (args, ctx) => {
  const { language } = ctx;
  const line = str(args["line"]);
  if (line === undefined && str(args["region"]) === undefined && (num(args["lat"]) === undefined || num(args["lon"]) === undefined)) return placeMissing(ctx);
  const area = await areaCode(args, ctx);
  if (area.code === undefined && line === undefined) {
    const region = str(args["region"]);
    return region === undefined ? toolResult(L(language, "Diese Region kenne ich nicht.", "I do not know this region."), area.metas, language) : NOT_KNOWN.region(region, language);
  }
  const r = await ctx.api.get<T.DisruptionData>("listTransitDisruptions", { area: area.code, line, window_min: num(args["window_min"]) });
  const lines = r.data.alerts.map((a) => `- ${a.lines.length > 0 ? `${a.lines.join(", ")}: ` : ""}${a.header ?? ""}`);
  if (r.data.punctuality !== null) lines.unshift(L(language, `Pünktlichkeit ${r.data.punctuality.name ?? ""}: ${r.data.punctuality.level} (${r.data.punctuality.late} von ${r.data.punctuality.observed} verspätet)`, `Punctuality ${r.data.punctuality.name ?? ""}: ${r.data.punctuality.level} (${r.data.punctuality.late} of ${r.data.punctuality.observed} late)`));
  if (lines.length === 0) return none(language, [r.meta], L(language, "Störungen", "disruptions"));
  return toolResult(lines.join("\n"), [r.meta], language);
};

const checkWeatherWarnings: Handler = async (args, ctx) => {
  const { language } = ctx;
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const r = await ctx.api.get<T.WeatherRiskData>("getWeatherRisk", { at: atParam(pos.at), min_level: num(args["min_level"]) });
  if (r.data.warnings.length === 0) return toolResult(L(language, "Keine amtlichen Wetterwarnungen.", "No official weather warnings."), [r.meta], language);
  return toolResult(r.data.warnings.map((w) => `- ${w.headline} (${w.levelName})${w.validity.until === null ? "" : L(language, ` bis ${berlinDateTime(w.validity.until, language)}`, ` until ${berlinDateTime(w.validity.until, language)}`)}`).join("\n"), [r.meta], language);
};

/** The station a station tool asks about: an EVA number or a name, through the API's station search. */
async function stationOf(args: Args, ctx: ToolContext): Promise<Envelope<T.Station[]>> {
  const eva = str(args["eva_no"]) ?? str(args["stop_id"]);
  const q = str(args["station"]) ?? str(args["stop"]);
  return ctx.api.get<T.Station[]>("listStations", { code: eva, q: eva === undefined ? q : undefined, limit: 1 });
}

const departureLine = (d: T.Departure, language: Language): string => {
  const delay = d.cancelled ? L(language, " · fällt aus", " · cancelled") : d.delayMin === null ? "" : d.delayMin === 0 ? "" : ` · +${d.delayMin}`;
  const platform = d.platform === null ? "" : `${L(language, " · Gl. ", " · pl. ")}${d.platform}${d.platformChanged ? "!" : ""}`;
  return `- ${berlinTime(d.plannedAt)} ${d.line ?? d.category ?? d.mode} → ${d.destination ?? "?"}${delay}${platform}`;
};

const getDepartures: Handler = async (args, ctx) => {
  const { language } = ctx;
  const given = (k: string): boolean => str(args[k]) !== undefined;
  if (!given("stop") && !given("stop_id") && !given("place") && (num(args["lat"]) === undefined || num(args["lon"]) === undefined)) return placeMissing(ctx);
  let stations = await stationOf(args, ctx);
  if (stations.data.length === 0 && (str(args["place"]) !== undefined || num(args["lat"]) !== undefined)) {
    const pos = await position(args, ctx);
    if (isResult(pos)) return pos;
    stations = await ctx.api.get<T.Station[]>("listStations", { at: atParam(pos.at), limit: 1 });
  }
  const station = stations.data[0];
  if (station === undefined) {
    const asked = str(args["stop"]) ?? str(args["stop_id"]);
    return asked === undefined ? none(language, [stations.meta], L(language, "Haltestellen", "stops")) : NOT_KNOWN.stop(asked, language);
  }
  const r = await ctx.api.get<T.Board>("listStationDepartures", { stationId: station.id, from: str(args["when"]), duration_min: num(args["duration_min"]), modes: strs(args["modes"]), limit: num(args["limit"]) });
  const head = `${r.data.station.name}:`;
  if (r.data.departures.length === 0) return toolResult(`${head} ${L(language, "keine Abfahrten im Zeitfenster.", "no departures in the window.")}`, [r.meta], language);
  return toolResult([head, ...r.data.departures.map((d) => departureLine(d, language))].join("\n"), [stations.meta, r.meta], language);
};

const checkStationFacilities: Handler = async (args, ctx) => {
  const { language } = ctx;
  const stations = await stationOf(args, ctx);
  const station = stations.data[0];
  if (station === undefined) {
    const asked = str(args["station"]) ?? str(args["eva_no"]);
    return asked === undefined ? none(language, [stations.meta], L(language, "Bahnhöfe", "stations")) : NOT_KNOWN.facilityStation(asked, language);
  }
  const facility = str(args["facility"]);
  const r = await ctx.api.get<T.StationFacilitiesData>("listStationFacilities", { stationId: station.id, kind: facility === "any" ? undefined : facility, limit: num(args["limit"]) });
  const d = r.data;
  const head = L(language, `${d.station.name}: ${d.counts.active} in Betrieb, ${d.counts.inactive} außer Betrieb, ${d.counts.unknown} unbekannt.`, `${d.station.name}: ${d.counts.active} working, ${d.counts.inactive} out of service, ${d.counts.unknown} unknown.`);
  return toolResult([head, ...d.facilities.filter((f) => f.state !== "active").map((f) => `- ${f.kind}${f.position === null ? "" : ` ${f.position}`}: ${f.state}`)].join("\n"), [stations.meta, r.meta], language);
};

const describeStation: Handler = async (args, ctx) => {
  const { language } = ctx;
  const stations = await stationOf(args, ctx);
  const station = stations.data[0];
  if (station === undefined) {
    const eva = str(args["eva_no"]);
    const name = str(args["station"]);
    if (eva !== undefined) return NOT_KNOWN.eva(eva, language);
    return name === undefined ? none(language, [stations.meta], L(language, "Bahnhöfe", "stations")) : NOT_KNOWN.station(name, language);
  }
  const n = num(args["departures"]) ?? 5;
  const [fac, board] = await Promise.all([
    ctx.api.get<T.StationFacilitiesData>("listStationFacilities", { stationId: station.id }),
    n > 0 ? ctx.api.get<T.Board>("listStationDepartures", { stationId: station.id, limit: n }) : Promise.resolve(null),
  ]);
  const lines = [`${station.name} · ${station.location.lat.toFixed(5)}, ${station.location.lon.toFixed(5)}`];
  lines.push(L(language, `Aufzüge/Rolltreppen: ${fac.data.counts.active} in Betrieb, ${fac.data.counts.inactive} außer Betrieb.`, `Lifts/escalators: ${fac.data.counts.active} working, ${fac.data.counts.inactive} out of service.`));
  if (board !== null) lines.push(...board.data.departures.map((d) => departureLine(d, language)));
  return toolResult(lines.join("\n"), [stations.meta, fac.meta, ...(board === null ? [] : [board.meta])], language);
};

const watchSituation: Handler = async (args, ctx) => {
  const { language } = ctx;
  const kind = str(args["kind"]);
  const key = str(args["key"]);
  if (kind === undefined || key === undefined) return toolError(L(language, "kind und key sind nötig.", "kind and key are required."));
  if (ctx.watches.list().length >= MAX_WATCHES) {
    return toolError(L(language,
      `Diese Sitzung hat bereits ${MAX_WATCHES} offene Beobachtungen — das Maximum ist ${MAX_WATCHES}. Beende eine mit stop_watch (die Liste steht in viafrei://watches) und versuche es dann noch einmal.`,
      `This session already has ${MAX_WATCHES} open watches — the limit is ${MAX_WATCHES}. End one with stop_watch (viafrei://watches lists them) and try again.`));
  }
  const condition = args["condition"];
  const r = await ctx.api.get<T.WatchData>("getWatch", {
    kind, target: key, request: str(args["request"]), hours: num(args["hours"]), until: str(args["until"]),
    condition: condition === undefined ? undefined : JSON.stringify(condition),
  });
  const id = ctx.watches.add({ watchId: r.data.watchId, uri: r.data.uri, kind: r.data.kind, key: r.data.key });
  const lines = [L(language, `Beobachtung ${id} läuft bis ${berlinDateTime(r.data.until, language)}.`, `Watch ${id} runs until ${berlinDateTime(r.data.until, language)}.`)];
  if (r.data.note !== null) lines.push(r.data.note);
  lines.push(...r.data.situations.slice(0, 10).map((s) => situationLine(s, language)));
  return toolResult(lines.join("\n"), [r.meta], language);
};

const stopWatch: Handler = async (args, ctx) => {
  const { language } = ctx;
  const id = num(args["watch_id"]) ?? ctx.watches.find((w) => w.uri === str(args["uri"]) || (w.kind === str(args["kind"]) && w.key === str(args["key"])));
  if (id === undefined || !ctx.watches.remove(id)) return toolError(L(language, "Diese Beobachtung gibt es in dieser Unterhaltung nicht.", "There is no such watch in this conversation."));
  return { content: [{ type: "text", text: L(language, `Beobachtung ${id} beendet.`, `Watch ${id} stopped.`) }] };
};

export const HANDLERS: Readonly<Record<string, Handler>> = {
  check_autobahn_traffic: checkAutobahnTraffic,
  find_cheapest_fuel: fuelSearch("price"),
  find_fuel_station: fuelSearch("distance"),
  find_parking: findParking,
  check_road_status: checkRoadStatus,
  find_roadworks_ahead: findRoadworksAhead,
  find_charging_station: findChargingStation,
  find_hydrogen_station: findHydrogenStation,
  find_speed_cameras: findSpeedCameras,
  find_place: findPlace,
  find_poi: findPoi,
  find_address: findAddress,
  describe_location: describeLocation,
  find_nearby: findNearby,
  find_sharing: findSharing,
  get_driving_rules: getDrivingRules,
  check_transit_disruption: checkTransitDisruption,
  check_weather_warnings: checkWeatherWarnings,
  get_train_departures: getTrainDepartures,
  get_departures: getDepartures,
  check_station_facilities: checkStationFacilities,
  describe_station: describeStation,
  watch_situation: watchSituation,
  stop_watch: stopWatch,
};

/**
 * What the contract lacks for today's behaviour, tool by tool. Kept here so a test can hold the PR body's
 * gap list to the code: each entry names the tool, the case and the operation it needs.
 */
export const GAPS: readonly { tool: string; case: string; needs: string }[] = [
  { tool: "*", case: "answers in the caller's language (language=de|en)", needs: "a language parameter (or Accept-Language) on every operation" },
  { tool: "find_parking", case: "kind=disabled_badge", needs: "a disabled-badge kind on listParkingOptions" },
  { tool: "find_roadworks_ahead", case: "a route from → to", needs: "a route/corridor road-conditions operation" },
  { tool: "watch_situation", case: "notifications when a watch reports (resources/updated)", needs: "a push or since-poll contract for watches" },
];
