import { ApiClient, apiConfigFromEnv } from "./api/client.js";
import { loadCatalogue } from "./catalogue.js";
import type { ServerDeps } from "./server.js";
import { DbTimetablesClient } from "./vendor/db-timetables/client.js";

/** The process's dependencies, from the environment: one API client, one DB Timetables client (one limiter). */
export function depsFromEnv(env: Record<string, string | undefined> = process.env): ServerDeps {
  return { api: new ApiClient(apiConfigFromEnv(env)), trains: new DbTimetablesClient(), catalogue: loadCatalogue() };
}
