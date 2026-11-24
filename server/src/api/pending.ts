/**
 * Query parameters the next API release adds and the pinned contract copy (test/fixtures/api-openapi.json, the
 * release `api.pin` names) does not carry yet. The client sends them after the contract's own; an API release
 * without one ignores it, as the API ignores every query parameter it does not take.
 *
 * Each entry leaves when the contract copy is bumped to the release that carries it: the client test fails
 * while a pending parameter is already in the contract, so none outstays its release.
 */
export const PENDING_QUERY: Readonly<Record<string, readonly string[]>> = {
  // Only the stations of the DB station register (with an EVA number), as today's server resolves a train
  // station: without it "Frankfurt (Main) Hauptbahnhof" resolves to the bus stop of that name.
  listStations: ["railway"],
};
