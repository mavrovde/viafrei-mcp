/**
 * The response shapes the handlers read, as `openapi/openapi.json` declares them (schema name in each
 * comment). Only the fields a renderer reads are listed; every name here is the contract's own.
 */
import type { LatLon } from "./client.js";

/** PlaceItem */
export type PlaceItem = { id: string; name: string; kind: string; location: LatLon; distanceM?: number; districtCode?: string | null; sourceFamily: string;
  /** The Kreis the place lies in, in German, as the platform's place search states it ("kreisfreie Stadt", "Kreis Borken", "kreisfreie Stadt München", "Vogtlandkreis"); absent when none can be named. */
  kreis?: string;
  /** The place's English name where it differs (Munich for München); absent else. */
  nameEn?: string;
  /** The place's own AGS where it has one. */
  ags?: string;
};
/** resolvePlace: the one place a text names, as today's resolver says it (label), with its alternatives. */
export type ResolvedPlace = { name: string; label: string; kind: string; location: LatLon; districtCode?: string | null; alternatives?: { name: string; kind: string }[] } | null;
/** StopBoardsData (listStopBoards): the stops around the position asked, chosen as today's server chooses them, each with its next departures. */
export type StopBoards = {
  location: LatLon; window: { from: string; until: string };
  stops: { id: string; name: string; stopId: string; distanceM: number; departures: Departure[] }[];
  /** Today's FlixBus/FlixTrain block near the point (its own feed, not DELFI's twins); null where none is near. Not in StopBoardsData of API 2.0.4. */
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
  /** Only with group=place: the place the item stands for (its name is then the place's label: name and address). */
  place?: ChargingPlace;
};
export type ChargingAddress = { street: string | null; number: string | null; postcode: string | null; city: string | null };
/** ChargingPlace: the records of one place folded into one item (listChargingOptions group=place). */
export type ChargingPlace = {
  siteId: string; siteIds: string[];
  address: ChargingAddress | null; reportedAddress?: ChargingAddress; reportedLocation?: LatLon; locatedNear?: string;
  connectors: { type: string; count: number; powerKw: number | null }[];
  /** null: no record publishes a price per kWh (never 0). */
  price: { amount: number; basis: "net" | "gross"; currency: "EUR" } | null;
  /** null: no point has a status (unknown, never 0). stale: no point is current; the counts are the last known, as of observedAt. */
  status: { free: number; occupied: number; outOfOrder: number; total: number; observedAt: string; stale: boolean } | null;
  fromRegister: boolean; registerReleasedOn: string | null; sourceEnded: boolean;
};
/** HydrogenData */
export type HydrogenStation = {
  name: string | null; operator: string | null; brand: string | null; distanceM: number; location: LatLon;
  /** The publisher's address, refill solutions and opening periods, verbatim; null when not published. */
  address?: unknown; refill?: unknown; opening?: unknown; providerUpdatedAt: string | null;
};
export type HydrogenData = { stations: HydrogenStation[]; nearest: HydrogenStation | null };
/** ParkingSite */
/** OSMCarPark (ParkingMeta.around.osmCarParks): an OpenStreetMap car park (ODbL), no capacity, no occupancy. */
export type OsmCarPark = {
  id: string; name: string | null; operator: string | null; street: string | null; houseNo: string | null; zip: string | null; town: string | null;
  location: LatLon; distanceM: number;
};
/** ParkingMeta.around: null fields where not read (a lorry or rest-area question, a key without OpenStreetMap). */
export type ParkingAround = { osmCarParks: OsmCarPark[] | null; osmDataAsOf: string | null; roadContext: unknown[] | null } | null;
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
  /** With fuel (API 2.0.4): OpenStreetMap's filling stations (ODbL) in the radius with no priced station within 300 m, nearest first, three at most; credited in meta.attribution. */
  osmFuel?: OsmFuelStation[];
  /** Proposed (today's): the charging point register's release where a register row is among the charging rows shown. */
  chargingRegister?: { releasedOn: string | null } | null;
  /** Proposed (today's PARKING_OSM_NEAR): car parks OpenStreetMap maps near the point (ODbL, no capacity or occupancy). */
  osmParking?: { id: string; name: string; distanceM: number }[];
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
  /** Proposed (today's segments): the sections the Autobahn GmbH publishes this one site as, merged into this entry. */
  segments?: number;
  /** Proposed (today's phase dates): the phase's end and the whole measure's, as the description states them (Berlin stamps). */
  phase?: { end: string | null; measureEnd: string | null } | null;
  /** Proposed (today's descriptionShown): the description's first two kept lines, cut as today cuts them. */
  descriptionShown?: string | null;
  /** Proposed (today's GistFacts): what the description and subtitle state apart from their prose, said in English. */
  facts?: RoadFacts | null;
  /** Proposed (today's abnormal traffic type): the Autobahn GmbH's type of a jam, said as today's term. */
  trafficType?: string | null;
  /** Proposed (today's jamStructured): a jam's end and length, its trend, the hour's usual and how long jams here last. */
  jam?: RoadJam | null;
};
/** Proposed (today's check_road_status by road number): the window's tally, the page's entries, the rest, the sources that answered, the guidance. */
export type RoadStatus = {
  counts: { closed: number; restricted: number; planned: number; current: number; currentBy: string[] };
  /** The window's end; null for "right now" (horizon 0). */
  windowEnd: string | null;
  items: RoadStatusItem[];
  hidden: number; hiddenClosures: number;
  /** A higher limit would show every entry (today: limit below the most and the tally within it). */
  canRaise: boolean;
  sourcesAnswered: { label: string; asOf: string | null }[];
  guidance: RoadGuidance[];
  /** Planned or current roadworks are among the tally: they carry no coordinates, so the answer is by road. */
  plannedByRoad: boolean;
};
/** API 2.0.4's MotorwayData.roadStatus, as the contract sends it; check_road_status reads it into RoadStatus. */
export type ApiRoadStatus = {
  windowEnd: string;
  counts: { closed: number; restricted: number; planned: number; programme: number; current: number; total: number; currentFamilies: string[] };
  items: ApiRoadStatusItem[];
  hidden: number; hiddenClosures: number; canRaise: boolean;
  sourcesAnswered: { sourceFamily: string; asOf: string | null }[];
  guidance: { title: string | null; titleEnglish: string | null; words: string | null; wordsEnglish: string | null; from: string | null; to: string | null; via: string | null; until: string | null }[];
  plannedWorksHaveNoCoordinates: boolean;
};
/** API 2.0.4's RoadStatusItem: the fields check_road_status says. */
export type ApiRoadStatusItem = {
  status: string; term: string; sourceFamily: string; road: string; kind: string | null;
  title: string | null; subtitle: string | null; description: string[]; place: string | null; detail: string | null;
  from: string | null; to: string | null; measureTo: string | null;
};
/** One entry of a road's page: today's label, whether the road is named (a Land or local publisher), the publisher's words, the facts, the span. */
export type RoadStatusItem = { label: string; road: string; namedRoad: boolean; shown: string; facts: RoadFacts | null; from: string | null; to: string | null; measureTo: string | null };
/** The Autobahn GmbH's traffic guidance (strategic routing) switched on for the road. */
export type RoadGuidance = { title: string | null; titleEn: string | null; words: string | null; wordsEn: string | null; from: string | null; to: string | null; via: string | null; until: string | null };
/** Proposed: today's jam detail (JamDetail, as jamStructured sends it). */
export type RoadJam = {
  lengthKm: number | null; endText: string | null; endPlace: { km: number | null; side: string; place: string } | null;
  trend: { direction: "growing" | "stable" | "shrinking"; metric: "length" | "delay"; earlier: { at: string; value: number } } | null;
  usual: { verdict: string; weeks: number; jamWeeks: number; weekday: number; hour: number } | null;
  howLong: { cases: number; fromHours: number; toHours: number; dayKind: string; weeks: number } | null;
  routeRecommendations: string[];
};
/** Proposed: today's facts of a road entry (GistFacts), the points already named in English. */
export type RoadFacts = {
  between?: { from: string; to: string }; posts?: { fromKm: number; toKm: number }; towards?: string; lengthKm?: number;
  lanes?: string; hardShoulderClosed?: boolean; maxSpeedKmh?: number; maxWidthM?: number; queueKm?: number;
};
export type LampReason = { reason: string; lamp: string; count: number };
export type FamilyCount = { sourceFamily: string; situations: number };
export type RoadCoverage = { registered: boolean; roadType: string; families: string[] };
export type RoadConditionsData = {
  lamp: string; lampReason: string | null; lampReasons?: LampReason[]; counts?: FamilyCount[]; coverage?: RoadCoverage | null; situations: RoadSituation[];
  /** Proposed (today's ampel reasonsTotal): the lamp's reasons after the fold, the first one said among them. */
  lampReasonsTotal?: number;
  /** Proposed (today's road-wide headline): the road's figures, the police/Land messages and the announced ones beside them. */
  roadWide?: RoadWide | null;
  /** Proposed (today's planned-now lines): the short-duration roadworks the Autobahn GmbH plans in force now, in the publisher's words. */
  plannedNow?: { where: string | null; window: { from: string | null; to: string | null } }[];
  /** API 2.0.4: the road status by road number (MotorwayData.roadStatus); null when the key may read none of its sources. */
  roadStatus?: ApiRoadStatus | null;
};
/** Proposed: today's road-wide figures (check_autobahn_traffic's Counts, policeCountsText and the NRW traffic state). */
export type RoadWide = {
  asOf: string;
  jams: number; warnings: number; closures: number; roadworks: number;
  police: { jams: number; closures: number; restrictions: number; roadworks: number; reports: number };
  announced: { from: string | null; closures: number; roadworks: number; reports: number };
  /** The measuring sites on the road (NRW's traffic state), null where none measures it. */
  measured: { sites: number; standstill: number; slow: number; heavy: number; free: number; laneSites: number; near: string[]; measuredAt: string | null } | null;
};
/** LorryRule */
export type LorryRule = { layer: string; kind: string | null; road: string | null; street: string | null; municipality: string | null; publishedText: string | null; value: number | null; unit: string | null; direction?: string | null };
/** DrivingRulesData */
export type DrivingRule = { id: string; text: string; legalBasis: string | null; sourceUrl: string | null; reviewedOn: string; unconfirmed: string | null };
/** With topic lez and a city: the curated list's entry, or the asked city uncovered (zone null). */
export type ZoneCity = { name: string; zone: string | null; plakette: string | null; covered: boolean };
/** With topic lez and a position: the platform's verdict. */
export type ZoneVerdict = { kind: "inside" | "transfer" | "outside" | "unknown"; distanceM: number | null };
export type DrivingRulesData = { topic: string; title: string; rules: DrivingRule[]; reviewedOn: string; disclaimer: string; zoneCity?: ZoneCity; zoneVerdict?: ZoneVerdict };
/** DisruptionData */
export type DisruptionAlert = { header: string | null; lines: string[]; inForceFrom: string | null; inForceUntil: string | null };
/** DisruptionPunctuality (API 2.0.4): the trips with a delay report in the source's own window, those late at least once. */
export type DisruptionPunctuality = {
  code?: string; name: string | null; level: string; windowMin: number; observed: number; late: number; tripsSkippingStops: number; untimed: number;
  medianWorstDelaySeconds: number | null; stopsReporting: number; observedAt: string | null; sourceFamily: string;
};
export type DisruptionData = {
  alerts: DisruptionAlert[]; alertsTotal: number; alertsChecked?: boolean; windowMin: number;
  punctuality: DisruptionPunctuality | null;
  /** Whether any alert source read covers the area's Länder, and when each last published one; null without an area. */
  alertsCoverage?: { covered: boolean; lookbackDays: number; lands: { land: string; alertsSeen: number; newestAlertSeenAt: string | null }[] } | null;
  /** What the static timetable says of the line asked; null without line. */
  line?: { key: string; checked: boolean; inTimetable: boolean } | null;
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
export type Station = { id: string; name: string; location: LatLon; stopCode: string | null; eva: string | null; evaNumbers: string[]; modes?: string[]; distanceM?: number | null; districtCode?: string | null };
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
export type StationFacilitiesData = {
  station: { name: string }; counts: { active: number; inactive: number; unknown: number };
  facilities: {
    id: string; kind: string; position: string | null; state: string;
    /** Proposed (today's): the operator's own explanation of the state ("not monitored", "under maintenance"). */
    stateExplanation?: string | null;
    /** Proposed (today's): another unit at the station has the same kind and name, so the answer names its number. */
    nameShared?: boolean;
  }[];
  /** Proposed (today's platform block, DB OpenStation's inventory): per station, its platforms' accessibility. */
  platforms?: PlatformAccess | null;
};
export type Limitation = "yes" | "partial" | "no" | "unknown";
export type PlatformAccess = {
  /** DB's newest publication day of the rows used, a Berlin calendar date (YYYY-MM-DD). */
  releasedOn: string | null;
  stations: {
    name: string | null; station: { stepFree: Limitation; wheelchair: Limitation } | null;
    stepFreeCounts: Record<Limitation, number>; total: number;
    list: { name: string | null; tracks: string[]; stepFree: Limitation; wheelchair: Limitation; tactileGuidance: Limitation; levelBoarding: Limitation; stated: boolean; heightCm: { min: number; max: number } | null }[];
  }[];
};
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

/** getStationPage, as describe_station says it (pageFromApi reads the API's StationPageEnvelope.data into it): today's station page, its sections built by the page's own rules. */
export type RailLamp = "red" | "yellow" | "green" | "unknown";
export type RailReason = { kind: "late" | "cancelled" | "median" | "platform" | "alert" | "sight" | "line"; n?: number; of?: number; side?: "dep" | "arr" | "both"; min?: number; line?: string; long?: boolean; lamp?: RailLamp };
export type StationPageLift = { kind: string; description: string | null; tracks: string[]; state: "active" | "inactive" | "unknown"; reason: string | null; resumeAt: string | null };
export type StationPageDeparture = { planned: string; line: string | null; destination: string | null; platform: string | null; plannedPlatform: string | null; delayMin: number | null; cancelled: boolean; noForecast: boolean; replacementBus: boolean };
export type StationPageAlert = { header: string; lines: string[]; atStation: boolean; until: string | null };
export type StationPagePlatform = { tracks: string[]; name: string | null; lift?: "ok" | "unknown" | "none" | "out"; stepFree?: Limitation; heightCm?: { min: number; max: number } | null };
export type StationPageSection = {
  id: "header" | "rail_ampel" | "step_free_now" | "lifts" | "platforms" | "departures" | "service_alerts" | "parking_charging";
  /** Null where the API gives the section no time of its own. */
  asOf: string | null; sources: string[];
  name?: string; street?: string | null; zipcode?: string | null; city?: string | null; land?: string | null; category?: number | null; evaNo?: string | null;
  lamp?: RailLamp; reasons?: RailReason[]; lines?: { line: string; long: boolean; lamp: RailLamp }[];
  platforms?: StationPagePlatform[]; blocked?: StationPagePlatform[]; steplessAccess?: "yes" | "partial" | "no" | "unknown" | null;
  units?: StationPageLift[]; rows?: StationPageDeparture[]; alerts?: StationPageAlert[];
  facilities?: string[]; point?: LatLon | null;
};
/** pageUrl: null for a stop DB's register does not hold that no station page lists (API 2.0.4). */
export type StationPage = { station: { name: string }; pageUrl: string | null; sections: StationPageSection[] } | null;

/** StationPageEnvelope.data, as API 2.0.4 sends it: each section's content under its own key (PageSection, PageLift, PlatformAccess). */
type Access = "yes" | "partial" | "no" | "unknown";
export type ApiPagePlatform = { tracks: string[]; name: string | null; lift: "ok" | "out" | "unknown" | "none" };
export type ApiPageSection = {
  id: StationPageSection["id"]; asOf: string | null; sources: string[];
  header?: { name: string; stationNo: string | null; eva: string | null; evaNumbers: string[]; slug: string | null; street: string | null; zipcode: string | null; city: string | null; land: string | null; category: number | null };
  railAmpel?: { lamp: RailLamp; trips: number; reasons: RailReason[]; lines: { line: string; long: boolean; lamp: RailLamp }[] };
  stepFreeNow?: { platforms: ApiPagePlatform[]; blocked: ApiPagePlatform[]; steplessAccess: string | null };
  lifts?: { id: string; kind: string; position: string | null; state: "active" | "inactive" | "unknown"; equipmentNo: string | null }[];
  platforms?: { releasedOn: string | null; stations: { name: string | null; total: number; list: { name: string | null; tracks: string[]; stated: boolean; facts: { stepFree: Access }; heightCm: { min: number; max: number } | null }[] }[] };
  departures?: { plannedAt: string; line: string | null; destination: string | null; platform: string | null; plannedPlatform: string | null; platformChanged: boolean; delayMin: number | null; cancelled: boolean; noForecast: boolean }[];
  alerts?: StationPageAlert[];
  facilities?: { flags: string[]; location: LatLon | null };
};
/**
 * pageUrl: a register station's page; for a stop the register does not hold, its page under the nearest station page
 * that lists it (…/station/<slug>/stop/<key>), or null where none lists it (API 2.0.4). An unknown id answers 404.
 */
export type ApiStationPage = { pageUrl: string | null; sections: ApiPageSection[] } | null;
