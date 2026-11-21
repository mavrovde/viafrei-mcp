import { ApiClient, apiConfigFromEnv } from "./api/client.js";
import { loadCatalogue } from "./catalogue.js";
import type { ServerDeps } from "./server.js";

/** The process's dependencies, from the environment: one API client and the catalogue. */
export function depsFromEnv(env: Record<string, string | undefined> = process.env): ServerDeps {
  return { api: new ApiClient(apiConfigFromEnv(env)), catalogue: loadCatalogue() };
}
