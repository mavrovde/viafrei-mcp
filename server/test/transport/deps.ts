/**
 * The dependencies the transport tests give the route table: the real catalogue and an API client whose fetch
 * the test owns. By default every API request is answered 503 at once, so a tool call ends quickly as the tool's
 * own error; `gate()` holds every request until it is opened, for the tests of what an address has running.
 */
import { ApiClient } from "../../src/api/client.js";
import { loadCatalogue } from "../../src/catalogue.js";
import type { ServerDeps } from "../../src/server.js";

const catalogue = loadCatalogue();

export type ApiStub = { readonly deps: ServerDeps; readonly asked: string[]; readonly release: () => void };

/** An API that records every request path and answers 503, or holds each request until `release` when `hang`. */
export function apiStub(hang = false): ApiStub {
  const asked: string[] = [];
  const waiting: (() => void)[] = [];
  let open = !hang;
  const answer = (): Response => new Response(JSON.stringify({ title: "Service Unavailable", status: 503 }), { status: 503, headers: { "content-type": "application/problem+json" } });
  const fetchImpl = ((input: string | URL | Request) => {
    asked.push(new URL(input instanceof Request ? input.url : String(input)).pathname);
    if (open) return Promise.resolve(answer());
    return new Promise<Response>((resolve) => { waiting.push(() => { resolve(answer()); }); });
  }) as typeof fetch;
  const deps: ServerDeps = { api: new ApiClient({ baseUrl: "http://example.invalid", key: "transport-test", fetch: fetchImpl }), catalogue };
  // Once released, it stays open: every later request answers at once.
  return { deps, asked, release: () => { open = true; for (const w of waiting.splice(0)) w(); } };
}

/** The default: an API that answers 503 at once. */
export const transportDeps = (): ServerDeps => apiStub().deps;
