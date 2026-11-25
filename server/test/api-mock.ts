/**
 * MSW handlers for every operation of the API contract (test/fixtures/api-openapi.json, with the proposed operations of
 * api-proposed.json merged in), each answering
 * the contract's first 200 example (201 for a write that has no 200, createRefresh). A test overrides one only for its special case (empty, 404, 429,
 * terms not accepted). Unmatched requests fail the test (`onUnhandledRequest: "error"`), so a handler
 * that asks an operation the contract lacks shows up at once. A query parameter the operation does not declare
 * is refused with 400, as the API's own parameter check answers it ("unknown parameter"), before any handler runs.
 */
import { readFileSync } from "node:fs";
import { http, HttpResponse, type RequestHandler } from "msw";
import { setupServer } from "msw/node";

export const API_BASE = "http://127.0.0.1";

type Op = { operationId: string; method: string; path: string; status: number; example: unknown; responses: Record<string, unknown>; query: readonly string[]; proposed: boolean };
type Param = { name?: string; in?: string; $ref?: string };

type Spec = {
  components?: { parameters?: Record<string, Param> };
  paths: Record<string, Record<string, { operationId?: string; parameters?: Param[]; responses?: Record<string, { content?: Record<string, { examples?: Record<string, { value: unknown }>; example?: unknown }> }> }>>;
};
/** The API's own document, as the API serves it at /v1/openapi.json. */
const API_SPEC = JSON.parse(readFileSync(new URL("./fixtures/api-openapi.json", import.meta.url), "utf8")) as Spec;
/** The proposed operations (x-proposed): in no released API yet. */
const PROPOSED = JSON.parse(readFileSync(new URL("./fixtures/api-proposed.json", import.meta.url), "utf8")) as Pick<Spec, "paths">;
/** The contract the mock answers: the API's document with the proposed operations merged in, as gen-operations.mjs merges them. */
export const SPEC: Spec = { ...API_SPEC, paths: { ...API_SPEC.paths, ...PROPOSED.paths } };

const resolve = (p: Param): Param => (p.$ref === undefined ? p : (SPEC.components?.parameters?.[p.$ref.split("/").pop() ?? ""] ?? p));
const queryOf = (...lists: (Param[] | undefined)[]): string[] => lists.flatMap((l) => l ?? []).map(resolve).filter((p) => p.in === "query").map((p) => p.name ?? "");

export const OPS: Op[] = Object.entries(SPEC.paths).flatMap(([path, item]) =>
  Object.entries(item)
    .filter(([, op]) => typeof op === "object" && op !== null && typeof op.operationId === "string")
    .map(([method, op]) => {
      const status = op.responses?.["200"] === undefined && op.responses?.["201"] !== undefined ? 201 : 200;
      const content = op.responses?.[String(status)]?.content?.["application/json"];
      const example = content?.example ?? (content?.examples === undefined ? undefined : Object.values(content.examples)[0]?.value);
      const shared = (item as { parameters?: Param[] }).parameters;
      return { operationId: op.operationId!, method, path, status, example, responses: op.responses ?? {}, query: queryOf(shared, op.parameters), proposed: (op as { "x-proposed"?: boolean })["x-proposed"] === true };
    }),
);

export const opById = (id: string): Op => {
  const op = OPS.find((o) => o.operationId === id);
  if (op === undefined) throw new Error(`no operation ${id} in the contract`);
  return op;
};

export const mswPath = (p: string): string => `${API_BASE}${p.replace(/\{([^}]+)\}/g, ":$1")}`;

/** Today's API on a path it does not offer: 404, a problem body. */
export const notOffered = (path: string) => HttpResponse.json({ type: "about:blank", status: 404, title: "Not Found", detail: `no operation at ${path}` }, { status: 404, headers: { "content-type": "application/problem+json" } });

/** The example body of an operation, deep-copied so a test may change it. */
export const exampleOf = <T = { data: unknown; meta: Record<string, unknown> }>(id: string): T => {
  const ex = structuredClone(opById(id).example) as { data: unknown[] };
  return (id === "listStations" ? { ...ex, data: [structuredClone(DB_STATION), ...ex.data.slice(1)] } : ex) as T;
};

/** Every request the mock answered, for assertions on which operation was asked with which query. */
export const calls: { operationId: string; url: URL; headers: Headers }[] = [];
/** Every read of the API's OpenAPI document (kept apart from `calls`: it is read once per process and API). */
export const documentReads: URL[] = [];

/**
 * The API's OpenAPI document listing the proposed operations `offered` (none by default, as today's API), or a
 * failure of that read (`respond`).
 */
export function offering(offered: readonly string[] = [], respond?: () => Response): RequestHandler {
  return http.get(`${API_BASE}/v1/openapi.json`, ({ request }) => {
    documentReads.push(new URL(request.url));
    return respond === undefined ? apiDocument(offered) : respond();
  });
}

/** The API's /v1/openapi.json answer: its own document, with the proposed operations `offered` as a later API would list them. */
export function apiDocument(offered: readonly string[]): Response {
  const proposed = Object.fromEntries(Object.entries(PROPOSED.paths).filter(([, item]) => Object.values(item).some((op) => offered.includes(op.operationId ?? ""))));
  return HttpResponse.json({ ...API_SPEC, paths: { ...API_SPEC.paths, ...proposed } }, { headers: { "content-type": "application/vnd.oai.openapi+json;version=3.1" } });
}

export function handlerFor(id: string, respond?: (url: URL) => Response | Promise<Response>): RequestHandler {
  const op = opById(id);
  const method = op.method as "get" | "post";
  return http[method](mswPath(op.path), ({ request }) => {
    const url = new URL(request.url);
    calls.push({ operationId: id, url, headers: request.headers });
    const unknown = [...new Set(url.searchParams.keys())].filter((k) => !op.query.includes(k));
    if (unknown.length > 0) return unknownParameters(url.pathname, unknown);
    if (respond !== undefined) return respond(url);
    // A proposed operation is answered as today's API answers it: not offered (404); its document does not list it.
    if (op.proposed) return notOffered(op.path);
    if (op.example === undefined) return HttpResponse.json({ status: 500, title: "no example" }, { status: 500 });
    return HttpResponse.json(structuredClone(op.example) as Record<string, unknown>, { status: op.status });
  });
}

/** The API's answer to a query parameter its operation does not declare (params.go): one error per such parameter. */
export const unknownParameters = (instance: string, names: readonly string[]): Response =>
  HttpResponse.json(
    { type: "https://api.viafrei.de/problems/invalid-parameter", title: "Invalid parameter", status: 400, detail: "One or more parameters are invalid.", instance, retryable: false, errors: names.map((n) => ({ parameter: `query.${n}`, code: "invalid", detail: "unknown parameter" })) },
    { status: 400, headers: { "content-type": "application/problem+json" } },
  );

export const problem = (status: number, code: string, detail = code): Response =>
  HttpResponse.json({ type: `https://api.viafrei.de/problems/${code}`, title: code, status, detail, code, retryable: status === 429 || status >= 500 }, { status, headers: { "content-type": "application/problem+json" } });

/**
 * The contract's listStations example (API 1.1.x) holds two bus stops and no DB station. The test world (the default
 * handler and exampleOf) keeps the DB station the earlier contract's example led with, so a station name resolves to
 * one with EVA numbers as on prod; every other field is the contract's example.
 */
export const DB_STATION = {
  id: "1:de:01002:9001", name: "Schömpingbach Hbf", location: { lat: 48.388148, lon: 7.518214 }, stopCode: "de:01002:9001",
  eva: "8001001", evaNumbers: ["8001001", "8001002", "8001003"], districtCode: "01002", modes: [], distanceM: null, sourceFamily: "delfi_static",
};
const stationsWorld = handlerFor("listStations", () => HttpResponse.json(exampleOf<Record<string, unknown>>("listStations")));

export const mockServer = setupServer(offering(), ...OPS.map((o) => (o.operationId === "listStations" ? stationsWorld : handlerFor(o.operationId))));
