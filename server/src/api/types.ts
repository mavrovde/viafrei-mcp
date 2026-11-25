/**
 * The response shapes the handlers read, as `openapi/openapi.json` declares them (schema name in each
 * comment). Only the fields a renderer reads are listed; every name here is the contract's own.
 */
import type { LatLon } from "./client.js";

/** PlaceItem */
export type PlaceItem = { id: string; name: string; kind: string; location: LatLon; distanceM?: number; districtCode?: string | null; sourceFamily: string;
  /** Proposed: the Kreis the row lies in, by name (BKG), with districtCode its eight-digit Gemeinde key. */
  districtName?: string | null;
};
/** Proposed resolvePlace: the one place a text names, as today's resolver says it (label), with its alternatives. */
export type ResolvedPlace = { name: string; label: string; kind: string; location: LatLon; districtCode?: string | null; alternatives?: { name: string; kind: string }[] } | null;
/** Proposed listStopBoards: the stops around a place, chosen as today's server chooses them, each with its next departures. */
export type StopBoards = {
  place: { label: string; location: LatLon }; window: { from: string; until: string };
  stops: { id: string; name: string; stopId: string; distanceM: number; departures: Departure[] }[];
  /** Today's FlixBus/FlixTrain block near the point (its own feed, not DELFI's twins); null where none is near. */
  longDistance?: LongDistance | null;
} | null;
export type LongDistanceDeparture = {
  at: string; line: string; mode: "coach" | "train"; destination: string | null; operator: string | null;
  stop: { id: string; name: string; distanceM: number }; cancelled: boolean; delayMin: number | null; expectedAt: string | null;
};
export type LongDistance = { operator: string; realtime: boolean; radiusM: number; departures: LongDistanceDeparture[] };
/** Address */
export type Address = {
  street: string | null; number: string | null; postcode: string | null; place: string | null; land: string | null; location: LatLon; dataAsOf?: string | null;
  /** Proposed: the OSM object the row came from (today's osmType). */
  osmType?: "node" | "way" | "relation" | null;
};
/** Proposed (today's objectsAtAddress): a named OSM object at the address, the one that is the address first. */
export type AddressObject = { name: string; alsoNamed: string[]; kinds: { category: string; categoryValue: string }[]; distanceM: number; ownAddress: boolean };
export type AddressData = { addresses: Address[]; objects?: AddressObject[] };
/** FuelStation */
export type FuelPrice = { fuel: string; priceEur: number; reportedAt: string; current: boolean };
export type FuelStation = { id: string; name: string; brand: string | null; location: LatLon; distanceM?: number; openingState: string; prices: FuelPrice[] };
/** FuelStationData (getFuelStation): one station with its postal address. */
export type FuelAddress = { street: string | null; number: string | null; postcode: string | null; place: string | null };
export type FuelStationData = { id: string; name: string | null; brand: string | null; location: LatLon; address: FuelAddress | null; aroundTheClock: boolean; openingState: string; prices: FuelPrice[] ;
  /** Proposed (today's detail_refreshed_at and its freshness): when the station's opening hours were last read. */
  hoursRefreshedAt?: string | null; hoursFreshness?: "fresh" | "stale" | null;
};
/** Proposed (listFuelOptions meta.query.osmUnpriced): a station OpenStreetMap maps and the price feed does not hold. */
export type OsmFuelStation = { name: string; brand: string | null; address: FuelAddress | null; location: LatLon; distanceM: number; sourceFamily: string };
/** ChargingSite */
export type ChargingSite = {
  id: string; name: string | null; operator: string | null; location: LatLon; distanceM?: number; access: string;
  summary: { chargePoints: number; availableNow: number | null; maxPowerKw: number | null };
  /** Each point and its last report (null: none published, or one that says nothing). */
  chargePoints?: { id: string; current: string | null; maxPowerKw: number | null; availability: { state: string; observedAt: string } | null }[];
};
/** HydrogenData */
export type HydrogenStation = {
  name: string | null; operator: string | null; brand: string | null; distanceM: number; location: LatLon;
  /** The publisher's address, refill solutions and opening periods, verbatim; null when not published. */
  address?: unknown; refill?: unknown; opening?: unknown; providerUpdatedAt: string | null;
};
export type HydrogenData = { stations: HydrogenStation[]; nearest: HydrogenStation | null };
/** ParkingSite */
export type ParkingSite = {
  id: string; name: string | null; operator: string | null; kind: string; location: LatLon; distanceM?: number | null;
  occupancy: { free: number | null; total: number | null; state: string; observedAt: string | null } | null; termsRequired: boolean;
};
/** SpeedData */
export type SpeedCamera = { id: string; kind: string; enforces: string | null; street: string | null; locationLabel: string | null; municipality: string | null; direction: string | null; limitKmh: number | null; lorryLimitKmh: number | null; firstDay: string | null; lastDay: string | null; dataAsOf: string | null; staleYear: number | null; location: LatLon | null; sourceFamily: string };
export type SpeedData = { official: SpeedCamera[]; officialTotal: number; osm: SpeedCamera[]; osmTotal: number };
/** Poi, PoiPage */
export type Poi = {
  name: string | null; brand?: string | null; location: LatLon; dataAsOf?: string | null; category: string; kind: string | null; street: string | null; number: string | null; postcode: string | null; place: string | null; distanceM: number | null;
  /** Proposed (today's): the nearest address of an object without one (another OSM object's, said as such), and the Land of its extract (AGS key) where it vouches for it. */
  nearestAddress?: { street: string | null; number: string | null; postcode: string | null; place: string | null; distanceM: number } | null;
  landCode?: string | null;
};
/** NearbyData */
export type NeedPlace = { name: string; kind: string; street: string | null; houseNo: string | null; distanceM: number };
export type NearbyFuelStation = { name: string | null; brand: string | null; distanceM: number; prices: FuelPrice[] };
export type NearbyJunction = { name: string; road: string | null; number: string | null; distanceM: number; location: LatLon };
/** NearbyPartStatus (NearbyMeta.parts) */
export type NearbyPart = "fuel" | "charging" | "parking" | "station" | "junction" | "needs";
export type NearbyPartStatus = { part: NearbyPart; status: "ok" | "timeout" | "not_permitted" | "unavailable" | "not_requested"; problemType?: string };
/** Every category is optional: a category that is not ok (or not asked) is absent, and named in meta.parts. */
export type NearbyData = {
  fuel?: NearbyFuelStation[]; charging?: ChargingSite[]; parking?: ParkingSite[]; stations?: Station[]; junctions?: NearbyJunction[];
  needs?: { need: string; radiusM: number; widened: boolean; places: NeedPlace[] }[];
};
/** SharingData */
export type SharingStation = {
  id: string; name: string | null; systemLabel: string | null; system: string; distanceM: number; location: { lat: number; lon: number }; sourceFamily: string;
  bikes: number | null; electricBikes: number | null; freeDocks: number | null; available: boolean; current: boolean;
  renting: boolean | null; virtual: boolean | null; countedAt: string | null; reportedAt: string | null;
};
export type SharingVehicle = { distanceM: number; propulsion: string | null; rangeLeftM: number | null; vehicleType: string | null; sourceFamily: string };
export type SharingData = { stations: SharingStation[]; stationsInRadius: number; vehicles: { count: number; electric: number; atLeast: boolean; nearest: SharingVehicle[] } };
/** RoadSituation */
export type RoadSituation = {
  id: string; kind: string; severity: string; road: string | null; direction: string | null; directionText: string | null;
  validity: { from: string | null; until: string | null }; headline: string; description: string | null; delayMin: number | null; lengthM: number | null; distanceM?: number;
  subtitle?: string | null; sourceFamily?: string;
};
export type LampReason = { reason: string; lamp: string; count: number };
export type FamilyCount = { sourceFamily: string; situations: number };
export type RoadCoverage = { registered: boolean; roadType: string; families: string[] };
export type RoadConditionsData = { lamp: string; lampReason: string | null; lampReasons?: LampReason[]; counts?: FamilyCount[]; coverage?: RoadCoverage | null; situations: RoadSituation[] };
/** LorryRule */
export type LorryRule = { layer: string; kind: string | null; road: string | null; street: string | null; municipality: string | null; publishedText: string | null; value: number | null; unit: string | null };
/** DrivingRulesData */
export type DrivingRule = { id: string; text: string; legalBasis: string | null; sourceUrl: string | null; reviewedOn: string; unconfirmed: string | null };
/** With topic lez and a city: the curated list's entry, or the asked city uncovered (zone null). */
export type ZoneCity = { name: string; zone: string | null; plakette: string | null; covered: boolean };
/** With topic lez and a position: the platform's verdict. */
export type ZoneVerdict = { kind: "inside" | "transfer" | "outside" | "unknown"; distanceM: number | null };
export type DrivingRulesData = { topic: string; title: string; rules: DrivingRule[]; reviewedOn: string; disclaimer: string; zoneCity?: ZoneCity; zoneVerdict?: ZoneVerdict };
/** DisruptionData */
export type DisruptionAlert = { header: string | null; lines: string[]; inForceFrom: string | null; inForceUntil: string | null };
export type DisruptionData = {
  alerts: DisruptionAlert[]; alertsTotal: number; alertsChecked?: boolean; windowMin: number;
  punctuality: {
    name: string | null; level: string; late: number; observed: number; stopsReporting?: number; untimed?: number; tripsSkippingStops?: number; sourceFamily?: string;
    /** Proposed (today's aggregate): the counted trips' delay reports, the trips cancelled here, the window before and its trend, thin. */
    reports?: number; tripsCancelled?: number; previous?: { observed: number; late: number } | null; trend?: "better" | "worse" | "unchanged" | "unknown"; thin?: "few_trips" | "low_coverage" | null;
  } | null;
  /** Proposed (today's alertsCoverage): whether any alert source covers the area, and when each of its Länder last published. */
  alertsCoverage?: { covered: boolean; lookbackDays: number; lastSeenAt: (string | null)[] };
};
/** WeatherRiskData */
/** The issuer's own English text of a warning (the next API release; absent before it). */
export type WarningText = { headline: string | null; description: string | null; instruction: string | null; sourceFamily: string; unaltered?: boolean };
export type WeatherWarning = {
  headline: string; levelName: string; level: number; hazard: string; validity: { from: string | null; until: string | null }; inForce?: boolean;
  event?: string | null; area?: { name: string | null; cellId: string | null } | null; sourceFamily?: string; published?: string | null;
  /** The next API release's official text and CAP fields; undefined while the API does not send them. */
  description?: string | null; instruction?: string | null; urgency?: string | null; certainty?: string | null; english?: WarningText | null;
  /** The API's word that headline, description and instruction are the issuer's text as published (today's officialSha256 check). */
  unaltered?: boolean;
  /** Proposed (API change list): "derived_from_severity" when the DWD published no level number and the level is mapped from its CAP severity word. */
  levelSource?: string | null;
};
/** One forecast hour of a road-weather station (the next API release). */
export type RoadForecastHour = { validAt: string; runAt: string; roadCondition: number | null; surfaceTempC: number | null };
export type RoadForecastStation = {
  id: string; name: string; segmentType: number | null; positionSource: string | null; location: LatLon; distanceM: number;
  hours: RoadForecastHour[]; sourceFamily: string; forecastFamily: string;
};
export type WeatherRiskData = { warnings: WeatherWarning[]; roadForecast?: RoadForecastStation[] };
/** LocationData's places: the nearest municipality, the nearest district, the district's Land. */
export type LocationPlace = { id: string; name: string; code?: string | null; location: { lat: number; lon: number }; distanceM: number | null; sourceFamily: string };
/** LocationData.lowEmissionZone: the verdict, and the zone it is in (inside, transfer) or the nearest (outside). */
export type ZonePlaque = {
  from: "curated_entry" | "national_fact"; entry: string | null; plakette: string | null; covered: boolean | null;
  /** Proposed (today's curated entry): the source it was read from and its open doubt, in the answer's language. */
  sourceName?: string | null; toVerify?: string | null;
};
export type LowEmissionZone = {
  verdict: "inside" | "transfer" | "outside" | "unknown"; zone: string | null; distanceM: number | null; liftedOn?: string | null;
  exemptRoad?: string | null; releasedArea?: string | null; plaque?: ZonePlaque | null; dataDate?: string | null; boundaryReadAt?: string | null;
};
export type LocationAddress = { street: string | null; number: string | null; postcode: string | null; place: string | null; land: string | null; distanceM: number; dataAsOf: string | null };
export type LocationData = {
  address: LocationAddress | null; municipality: LocationPlace | null; district: LocationPlace | null; state: LocationPlace | null;
  lowEmissionZone: LowEmissionZone | null; mayLieOutsideGermany: boolean;
  /** Proposed (today's): the Gemeinde the point lies in (inside) or the nearest Gemeinde point, by its key, with its Kreis and Regierungsbezirk. */
  gemeinde?: { name: string; code: string; inside: boolean; kreis: string | null; bezirk: string | null } | null;
  /** Proposed (today's): the nearest motorway junction, from OpenStreetMap or the traffic reports' index (gazetteer). */
  junction?: { name: string; road: string | null; location: LatLon; from: "osm" | "gazetteer" } | null;
};
/** Station */
export type Station = { id: string; name: string; location: LatLon; stopCode: string | null; eva: string | null; evaNumbers: string[]; distanceM?: number | null; districtCode?: string | null };
/** Board */
export type Departure = {
  line: string | null; category: string | null; destination: string | null; plannedAt: string; expectedAt: string | null; delayMin: number | null;
  platform: string | null; plannedPlatform: string | null; platformChanged: boolean; cancelled: boolean; mode: string;
  realtime?: boolean; noForecast?: boolean; routeType?: number | null; trainNumber?: string | null;
};
export type Board = { station: { id: string; name: string; stopCode?: string | null }; window: { from: string; until: string; matched?: number; /** Proposed: how far the loaded timetable reaches, and when it was loaded (today's horizon). */ timetableUntil?: string | null; timetableLoadedAt?: string | null }; departures: Departure[] };
/** TrainBoardData, TrainBoardDeparture */
export type TrainBoardDeparture = {
  line: string | null; category: string | null; number: string | null; destination: string | null; plannedAt: string; expectedAt: string; delayMin: number;
  platform: string | null; plannedPlatform: string | null; platformChanged: boolean; cancelled: boolean;
};
export type TrainBoardData = { eva: string; fresh: boolean; fetchedAt: string | null; ageSeconds: number | null; departures: TrainBoardDeparture[] };
/** RefreshData */
export type RefreshState = "pending" | "refreshed" | "none_due" | "refused" | "failed";
export type RefreshData = { id: string; source: string; state: RefreshState; settledAt: string | null; reason: string | null; reused: boolean };
/** StationFacilitiesData */
export type StationFacilitiesData = { station: { name: string }; counts: { active: number; inactive: number; unknown: number }; facilities: { id: string; kind: string; position: string | null; state: string }[] };
/** WatchData */
export type WatchData = { watchId: string; uri: string; kind: string; key: string; condition?: Record<string, unknown>; from: string; until: string; ended: boolean; note: string | null; situations: RoadSituation[] };
/** SourceRow */
export type SourceRow = { family: string; domain: string; publisher: string; attribution: string; licence: string; licenceUrl: string; status: string };
/** PlacesCoverageData */
export type PlacesCoverageData = { kinds: { kind: string; count: number }[]; lands: { code: string; name: string }[]; addresses: { land: string | null; dataAsOf: string | null }[] };
/** ParkingBaysData (listParkingBays) */
export type ParkingBay = {
  id: string; kind: string; publisherKind: string | null; street: string | null; houseNumber: string | null; postcode: string | null; city: string | null;
  lat: number; lon: number; distanceM: number; sensor: boolean; state: string | null; messageAt: string | null; spaces: number | null; reservedWhen: string | null; sourceFamily: string;
};
export type ParkingBayCounts = { total: number; sensors: number; free: number; occupied: number; unknown: number; staticSites: number; staticSpaces: number };
export type ParkingBaysData = { kind: string; counts: ParkingBayCounts; bays: ParkingBay[] };
