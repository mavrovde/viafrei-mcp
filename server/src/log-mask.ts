/**
 * The mask a client-chosen name passes through before it is written to a log line: an unknown JSON-RPC
 * method or tool name may carry anything a client typed. In this order, and before any cut (a value cut
 * across the bound would survive as a fragment no mask recognises):
 *
 *   1. IPv6 (a candidate with `::` or seven colons) and IPv4 → `<ip>`;
 *   2. a UUID → `<uuid>`;
 *   3. `Bearer …`, a cookie value, URL userinfo, a run of 32 or more token characters (a path is judged
 *      segment by segment) and a hex run of 24 or more → `<token>`;
 *   4. a query string → `?<q>`, a fragment → `#<f>`;
 *   5. a place key `pt:<n>,<n>` → `<place>`, a pair of decimals → `<coord>`, a decimal with two or more
 *      fractional digits → `<num>`;
 *   6. a DHID → `<stop>`, a run of five or more digits → `<n>`;
 *   7. every quoted substring → `<q>`; an opening quote with no closing one masks to the end;
 *   8. an e-mail address → `<email>`.
 */

/** A key is at most this many characters. */
export const KEY_MAX_CHARS = 64;

const IPV6_CANDIDATE = /[0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*(?:%[A-Za-z0-9_.-]+)?/g;
const IPV4 = /\d{1,3}(?:\.\d{1,3}){3}/g;
const UUID = /[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/g;
const BEARER = /\b(Bearer)\s+\S+/gi;
const COOKIE = /\b(Set-Cookie|Cookie):[^\n]*/gi;
const USERINFO = /([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^/\s@]+@/g;
const TOKEN_RUN = /[A-Za-z0-9_+/=.-]{32,}/g;
/** One segment of a path, as the token rule reads it. */
const PATH_SEGMENT = /[^/]+/g;
const HEX_RUN = /[0-9A-Fa-f]{24,}/g;
const QUERY = /([^\s?])\?[^\s"'`]+/g;
const FRAGMENT = /([^\s#])#[^\s"'`]+/g;
// A place key whole or cut: every `pt:` followed by a digit.
const PLACE_KEY = /pt:-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?)?/g;
const COORD_PAIR = /-?\d+\.\d+(?:\s*,\s*|\s+)-?\d+\.\d+/g;
const DECIMAL = /-?\d+\.\d{2,}/g;
const DHID = /\bde:\d+:\d+(?::\d+)*/gi;
const DIGIT_RUN = /\d{5,}/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** Opening quote → the closing quotes that end it. */
const QUOTES: ReadonlyMap<string, readonly string[]> = new Map([
  ["'", ["'"]],
  ['"', ['"']],
  ["`", ["`"]],
  ["„", ["“", "”"]],
  ["“", ["”", "“"]],
  ["‘", ["’"]],
  ["«", ["»"]],
  ["»", ["«"]],
]);

/**
 * Step 3's run rule: a run of 32 or more token characters is a `<token>`, unless it is a PATH: a run that
 * starts with `/` and carries no `+` or `=` (base64's marks). Each of its segments is then judged alone: a segment
 * of 32 or more characters, of 16 or more that mixes upper case, lower case and digits, or of 16 or more that mixes
 * letters and digits and carries no `-` (a random value split by a `/`; slugs join their words with `-`), is a
 * `<token>`; every other segment is kept.
 */
function maskTokenRun(run: string): string {
  if (!run.startsWith("/") || /[+=]/.test(run)) return "<token>";
  return run.replace(PATH_SEGMENT, (seg) => (seg.length >= 32 || (seg.length >= 16 && /[A-Z]/.test(seg) && /[a-z]/.test(seg) && /[0-9]/.test(seg)) || (seg.length >= 16 && /[A-Za-z]/.test(seg) && /[0-9]/.test(seg) && !seg.includes("-")) ? "<token>" : seg));
}

/** Step 0: our own deploy paths, shortened; nothing else is touched. */
function shortenPaths(s: string): string {
  return s.replaceAll("file:///app/", "").replaceAll("/app/node_modules/", "node_modules/").replaceAll("/dist/", "/");
}

/** Step 7: every quoted substring, scanned left to right; an unclosed quote masks to the end. */
function maskQuotes(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i] ?? "";
    const closers = QUOTES.get(ch);
    if (closers === undefined) {
      out += ch;
      i += 1;
      continue;
    }
    let end = -1;
    for (let j = i + 1; j < s.length; j += 1) {
      if (closers.includes(s[j] ?? "")) {
        end = j;
        break;
      }
    }
    out += "<q>";
    if (end === -1) return out;
    i = end + 1;
  }
  return out;
}

/** Steps 1–8, in order, with no truncation. */
export function maskLogText(input: string): string {
  let s = shortenPaths(input);
  // 1. addresses — IPv6 first, so an IPv4-mapped one goes whole.
  s = s.replace(IPV6_CANDIDATE, (m) => (m.includes("::") || (m.match(/:/g)?.length ?? 0) >= 7 ? "<ip>" : m));
  s = s.replace(IPV4, "<ip>");
  // 2.
  s = s.replace(UUID, "<uuid>");
  // 3.
  s = s.replace(BEARER, "$1 <token>").replace(COOKIE, "$1: <token>").replace(USERINFO, "$1<token>@").replace(TOKEN_RUN, maskTokenRun).replace(HEX_RUN, "<token>");
  // 4.
  s = s.replace(QUERY, "$1?<q>").replace(FRAGMENT, "$1#<f>");
  // 5.
  s = s.replace(PLACE_KEY, "<place>").replace(COORD_PAIR, "<coord>").replace(DECIMAL, "<num>");
  // 6.
  s = s.replace(DHID, "<stop>").replace(DIGIT_RUN, "<n>");
  // 7.
  s = maskQuotes(s);
  // 8.
  return s.replace(EMAIL, "<email>");
}
/** The final shape of a key. */
export const KEY_SHAPE = /^[A-Za-z0-9/_.:<>-]{1,64}$/;

/**
 * A name the CLIENT chose (an unknown method or tool name): masked, then `[A-Za-z0-9/_.-]` only, at most
 * 64 characters, then the masks again. A result not of the key's shape is no key at all.
 */
export function clientKey(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const kept = maskLogText(input).replace(/[^A-Za-z0-9/_.-]/g, "").slice(0, KEY_MAX_CHARS);
  if (kept === "") return null;
  const masked = maskLogText(kept).slice(0, KEY_MAX_CHARS);
  return KEY_SHAPE.test(masked) ? masked : null;
}
