/**
 * MSW handlers for every operation of the API contract (test/fixtures/api-openapi.json), each answering
 * the contract's first 200 example. A test overrides one only for its special case (empty, 404, 429,
 * terms not accepted). Unmatched requests fail the test (`onUnhandledRequest: "error"`), so a handler
 * that asks an operation the contract lacks shows up at once.
 */
import { readFileSync } from "node:fs";
import { http, HttpResponse, type RequestHandler } from "msw";
import { setupServer } from "msw/node";

export const API_BASE = "http://127.0.0.1";

type Op = { operationId: string; method: string; path: string; example: unknown; responses: Record<string, unknown> };

export const SPEC = JSON.parse(readFileSync(new URL("./fixtures/api-openapi.json", import.meta.url), "utf8")) as {
  paths: Record<string, Record<string, { operationId?: string; responses?: Record<string, { content?: Record<string, { examples?: Record<string, { value: unknown }>; example?: unknown }> }> }>>;
};

export const OPS: Op[] = Object.entries(SPEC.paths).flatMap(([path, item]) =>
  Object.entries(item)
    .filter(([, op]) => typeof op === "object" && op !== null && typeof op.operationId === "string")
    .map(([method, op]) => {
      const content = op.responses?.["200"]?.content?.["application/json"];
      const example = content?.example ?? (content?.examples === undefined ? undefined : Object.values(content.examples)[0]?.value);
      return { operationId: op.operationId!, method, path, example, responses: op.responses ?? {} };
    }),
);

export const opById = (id: string): Op => {
  const op = OPS.find((o) => o.operationId === id);
  if (op === undefined) throw new Error(`no operation ${id} in the contract`);
  return op;
};

export const mswPath = (p: string): string => `${API_BASE}${p.replace(/\{([^}]+)\}/g, ":$1")}`;

/** The example body of an operation, deep-copied so a test may change it. */
export const exampleOf = <T = { data: unknown; meta: Record<string, unknown> }>(id: string): T => structuredClone(opById(id).example) as T;

/** Every request the mock answered, for assertions on which operation was asked with which query. */
export const calls: { operationId: string; url: URL; headers: Headers }[] = [];

export function handlerFor(id: string, respond?: (url: URL) => Response | Promise<Response>): RequestHandler {
  const op = opById(id);
  const method = op.method as "get" | "post";
  return http[method](mswPath(op.path), ({ request }) => {
    const url = new URL(request.url);
    calls.push({ operationId: id, url, headers: request.headers });
    if (respond !== undefined) return respond(url);
    if (op.example === undefined) return HttpResponse.json({ status: 500, title: "no example" }, { status: 500 });
    return HttpResponse.json(structuredClone(op.example) as Record<string, unknown>);
  });
}

export const problem = (status: number, code: string, detail = code): Response =>
  HttpResponse.json({ type: `https://api.viafrei.de/problems/${code}`, title: code, status, detail, code, retryable: status === 429 || status >= 500 }, { status, headers: { "content-type": "application/problem+json" } });

export const mockServer = setupServer(...OPS.map((o) => handlerFor(o.operationId)));
