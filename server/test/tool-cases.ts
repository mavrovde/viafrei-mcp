/** One call per tool (stop_watch follows watch_situation) and the API operations it must ask; shared by the unit tests and the e2e runs. */
const at = { lat: 52.52, lon: 13.405 };

export const TOOL_CASES: readonly { tool: string; args: Record<string, unknown>; ops: string[] }[] = [
  { tool: "check_autobahn_traffic", args: { roads: ["A1"], language: "en" }, ops: ["getMotorwayConditions"] },
  { tool: "find_cheapest_fuel", args: { ...at, fuel: "e10", language: "en" }, ops: ["listFuelOptions"] },
  { tool: "find_fuel_station", args: { ...at, language: "en" }, ops: ["listFuelOptions"] },
  { tool: "find_parking", args: { ...at, language: "en" }, ops: ["listParkingOptions"] },
  { tool: "check_road_status", args: { ...at, language: "en" }, ops: ["listRoadConditions"] },
  { tool: "find_roadworks_ahead", args: { road: "A3", language: "en" }, ops: ["getMotorwayConditions"] },
  { tool: "find_charging_station", args: { ...at, language: "en" }, ops: ["listChargingOptions"] },
  { tool: "find_hydrogen_station", args: { ...at, language: "en" }, ops: ["listHydrogenOptions"] },
  { tool: "find_speed_cameras", args: { ...at, language: "en" }, ops: ["listSpeedCameras"] },
  { tool: "find_place", args: { query: "Köln", language: "en" }, ops: ["listPlaces"] },
  { tool: "find_poi", args: { name: "Rathaus", language: "en" }, ops: ["listPois"] },
  { tool: "find_address", args: { query: "Hauptstraße 1, Köln", language: "en" }, ops: ["listAddresses"] },
  { tool: "describe_location", args: { ...at, language: "en" }, ops: ["describeLocation"] },
  { tool: "find_nearby", args: { ...at, language: "en" }, ops: ["listNearby"] },
  { tool: "find_sharing", args: { ...at, language: "en" }, ops: ["listSharingOptions"] },
  { tool: "get_driving_rules", args: { topic: "speed", language: "en" }, ops: ["getDrivingRules"] },
  { tool: "check_transit_disruption", args: { region: "VBB", language: "en" }, ops: ["listPlaces", "listTransitDisruptions"] },
  { tool: "check_weather_warnings", args: { ...at, language: "en" }, ops: ["getWeatherRisk"] },
  { tool: "get_train_departures", args: { station: "Köln Hbf", language: "en" }, ops: ["listStations", "listStationDepartures"] },
  { tool: "get_departures", args: { stop: "Köln Hbf", language: "en" }, ops: ["listStations", "listStationDepartures"] },
  { tool: "check_station_facilities", args: { station: "Köln Hbf", language: "en" }, ops: ["listStations", "listStationFacilities"] },
  { tool: "describe_station", args: { station: "Köln Hbf", language: "en" }, ops: ["listStations", "listStationFacilities", "listStationDepartures"] },
  { tool: "watch_situation", args: { kind: "road", key: "A1", language: "en" }, ops: ["getWatch"] },
];
