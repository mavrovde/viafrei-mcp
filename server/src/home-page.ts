// The page at GET / for a browser (owner order). A browser asks for text/html and gets the page; every other GET
// or HEAD of `/` (an MCP client probing the base URL, curl's */*) keeps the empty 404 it always had. The page is
// compiled in (`content/home-page.ts`), and the CSP admits its one inline script by the hash computed here from
// that same text, so an edited script can never run under a stale hash. Nothing is held at module level: the
// policy is built in a function (Stryker would mutate a module-level table statically).
import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { HOME_PAGE_HTML } from "./content/home-page.js";

/** The text of every inline `<script>` in the page, in order. */
export function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? "");
}

/** The page's Content-Security-Policy: nothing by default, its own inline script by hash, images from viafrei.de. */
export function homePageCsp(html: string = HOME_PAGE_HTML): string {
  const hashes = inlineScripts(html).map((s) => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`);
  return [
    "default-src 'none'",
    "img-src data: https://viafrei.de",
    "style-src 'unsafe-inline'",
    `script-src ${hashes.join(" ")}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * True when the Accept header names text/html as one of its media ranges (a browser's navigation) with a
 * non-zero weight: `text/html;q=0` is RFC 9110's "not acceptable" (§12.4.2), so it keeps the 404.
 */
export function wantsHtml(accept: string | undefined): boolean {
  return (accept ?? "").split(",").some((range) => {
    const [type, ...params] = range.split(";");
    if (type?.trim().toLowerCase() !== "text/html") return false;
    const q = params.map((p) => p.trim().toLowerCase()).find((p) => p.startsWith("q="));
    return q === undefined || Number(q.slice(2)) > 0;
  });
}

export function homePage(req: Request, res: Response): void {
  // One URL, two answers chosen by Accept: a shared cache must key on it.
  res.setHeader("Vary", "Accept");
  if (!wantsHtml(req.get("accept"))) {
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy", homePageCsp());
  res.status(200).send(HOME_PAGE_HTML);
}
