/**
 * The response shapes the handlers read, as `openapi/openapi.json` declares them (schema name in each
 * comment). Only the fields a renderer reads are listed; every name here is the contract's own.
 */
import type { LatLon } from "./client.js";

/** PlaceItem */
export type PlaceItem = { id: string; name: string; kind: string; location: LatLon; distanceM?: number; districtCode?: string | null; sourceFamily: string };
/** Address */
export type Address = { street: string | null; number: string | null; postcode: string | null; place: string | null; land: string | null; location: LatLon };
export type AddressData = { addresses: Address[] };
/** FuelStation */
export type FuelPrice = { fuel: string; priceEur: number; reportedAt: string; current: boolean };
export type FuelStation = { id: string; name: string; brand: string | null; location: LatLon; distanceM?: number; openingState: string; prices: FuelPrice[] };
/** ChargingSite */
export type ChargingSite = {
  id: string; name: string | null; operator: string | null; location: LatLon; distanceM?: number; access: string;
  summary: { chargePoints: number; availableNow: number | null; maxPowerKw: number | null };
};
/** HydrogenData */
export type HydrogenStation = { name: string | null; operator: string | null; brand: string | null; distanceM: number; location: LatLon };
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
export type Poi = { name: string | null; category: string; kind: string | null; street: string | null; number: string | null; postcode: string | null; place: string | null; distanceM: number | null };
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
export type SharingStation = { name: string | null; systemLabel: string | null; system: string; distanceM: number; bikes: number | null; freeDocks: number | null; available: boolean };
export type SharingData = { stations: SharingStation[]; stationsInRadius: number; vehicles: { count: number; electric: number; atLeast: boolean } };
/** RoadSituation */
export type RoadSituation = {
  id: string; kind: string; severity: string; road: string | null; direction: string | null; directionText: string | null;
  validity: { from: string | null; until: string | null }; headline: string; description: string | null; delayMin: number | null; lengthM: number | null; distanceM?: number;
};
export type RoadConditionsData = { lamp: string; lampReason: string | null; situations: RoadSituation[] };
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
export type DisruptionData = { alerts: DisruptionAlert[]; alertsTotal: number; punctuality: { name: string | null; level: string; late: number; observed: number } | null; windowMin: number };
/** WeatherRiskData */
export type WeatherWarning = { headline: string; levelName: string; level: number; hazard: string; validity: { from: string | null; until: string | null }; inForce?: boolean };
export type WeatherRiskData = { warnings: WeatherWarning[] };
/** LocationData */
export type Named = { name?: string | null; code?: string | null } | null;
/** LocationData.lowEmissionZone: the verdict, and the zone it is in (inside, transfer) or the nearest (outside). */
export type LowEmissionZone = { verdict: "inside" | "transfer" | "outside" | "unknown"; zone: string | null; distanceM: number | null };
export type LocationData = { address: Record<string, unknown> | null; municipality: Named; district: Named; state: Named; lowEmissionZone: LowEmissionZone | null };
/** Station */
export type Station = { id: string; name: string; location: LatLon; stopCode: string | null; eva: string | null; evaNumbers: string[]; distanceM?: number | null };
/** Board */
export type Departure = {
  line: string | null; category: string | null; destination: string | null; plannedAt: string; expectedAt: string | null; delayMin: number | null;
  platform: string | null; plannedPlatform: string | null; platformChanged: boolean; cancelled: boolean; mode: string;
};
export type Board = { station: { id: string; name: string }; window: { from: string; until: string }; departures: Departure[] };
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
