/**
 * Who a request is from, as far as the per-address limit is willing to believe.
 *
 * Behind a proxy the socket peer is the proxy for EVERY request: one address for
 * the whole internet. A per-address limit keyed on the peer would therefore be one
 * global limit, and the first busy client would lock every other one out. So:
 *
 *  * a peer inside `MCP_TRUSTED_PROXY_CIDR` is believed when it names the
 *    client, and the client is the RIGHTMOST hop of `X-Forwarded-For` that is
 *    not itself inside `MCP_TRUSTED_PROXY_CIDR`. Behind one proxy that is its one
 *    overwritten hop; a second proxy (an ingress) APPENDS its own peer, so the
 *    last hop is then always a proxy, and reading it would put every client in one
 *    bucket. Never the first:
 *    the first is whatever the client wrote, and the walk stops at the first hop
 *    no trusted proxy vouches for, so a forged left hop is never reached. When
 *    every hop is a proxy the leftmost is the answer;
 *  * any other peer's header is never read, not one hop of it.
 *
 * The answer is used for ONE thing — which bucket a request is counted in — and
 * is never logged or served (the request log carries no address at all).
 *
 * The parser is `node:net`'s own `BlockList` rather than a hand-written one.
 */
import { BlockList, isIP } from "node:net";

/** `::ffff:172.18.0.1` is how a dual-stack socket reports an IPv4 peer. */
function unmapped(address: string): string {
  const m = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  return m?.[1] ?? address;
}

function family(address: string): "ipv4" | "ipv6" | null {
  const v = isIP(address);
  return v === 4 ? "ipv4" : v === 6 ? "ipv6" : null;
}

/**
 * `"172.16.0.0/12, fd00::/8"` → a `BlockList`. An entry that does not parse is
 * a THROW, not a skip: a trusted-proxy list that silently lost an entry turns
 * every request from that proxy into one shared bucket, which is the outage
 * this file exists to prevent, and a boot that refuses says so at once.
 */
export function parseTrustedProxies(raw: string, key = "MCP_TRUSTED_PROXY_CIDR"): BlockList {
  const list = new BlockList();
  for (const entry of raw.split(",").map((s) => s.trim()).filter((s) => s !== "")) {
    const [net, bits, extra] = entry.split("/");
    const fam = net === undefined ? null : family(net);
    const prefix = bits === undefined ? (fam === "ipv4" ? 32 : 128) : Number(bits);
    const max = fam === "ipv4" ? 32 : 128;
    if (fam === null || net === undefined || extra !== undefined || !Number.isInteger(prefix) || prefix < 0 || prefix > max) {
      throw new Error(`${key}: "${entry}" is not an address or CIDR block`);
    }
    list.addSubnet(net, prefix, fam);
  }
  return list;
}

export type ClientIp =
  /**
   * The address to count this request against. `forwardedIgnored` is true when
   * the peer was NOT trusted and yet sent `X-Forwarded-For`: the header was
   * (rightly) not read, and the caller says so once: that is the signature of a
   * proxy outside `MCP_TRUSTED_PROXY_CIDR`, where every request's peer is the same
   * address and the limit has become one global bucket.
   */
  | { readonly kind: "client"; readonly ip: string; readonly forwardedIgnored?: true }
  /**
   * A trusted proxy that did not name a client (no header, or an unparsable
   * last hop). Counting it would put everyone behind that proxy in one bucket,
   * so the caller does not limit it — and says so in the log.
   */
  | { readonly kind: "unattributed" };

export function clientIp(peer: string | undefined, forwardedFor: string | string[] | undefined, trusted: BlockList): ClientIp | null {
  if (peer === undefined || peer === "") return null;
  const p = unmapped(peer);
  const pf = family(p);
  if (pf === null) return null;
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(",") : (forwardedFor ?? "");
  if (!trusted.check(p, pf)) return header.trim() === "" ? { kind: "client", ip: p } : { kind: "client", ip: p, forwardedIgnored: true };
  const hops = header.split(",").map((h) => h.trim()).filter((h) => h !== "");
  if (hops.length === 0) return { kind: "unattributed" };
  for (let i = hops.length - 1; i >= 0; i--) {
    const hop = unmapped(hops[i]!);
    const hf = family(hop);
    if (hf === null) return { kind: "unattributed" };
    if (i === 0 || !trusted.check(hop, hf)) return { kind: "client", ip: hop };
  }
  return { kind: "unattributed" };
}

/**
 * Expand an IPv6 text form to its eight 16-bit groups, or null. Handles `::`
 * and a trailing dotted quad (`64:ff9b::192.0.2.1`).
 */
function ipv6Groups(address: string): number[] | null {
  let a = address;
  const dotted = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(a);
  if (dotted !== null) {
    const o = dotted[1]!.split(".").map(Number);
    a = `${a.slice(0, a.length - dotted[1]!.length)}${((o[0]! << 8) | o[1]!).toString(16)}:${((o[2]! << 8) | o[3]!).toString(16)}`;
  }
  const halves = a.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] === "" ? [] : halves[0]!.split(":");
  const tail = halves.length === 2 ? (halves[1] === "" ? [] : halves[1]!.split(":")) : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array<string>(fill).fill("0"), ...tail].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

/**
 * The key a client's bucket is filed under: an IPv4 address is
 * its own key, an IPv6 address is keyed on its /64 prefix. A /64 is what one
 * subscriber line or one host is handed — the smallest prefix an ISP or a
 * cloud assigns — and every address inside it is a free choice of its holder,
 * so a per-/128 bucket is a bucket per request for anyone who rotates
 * addresses. `mcp.viafrei.de` has an AAAA record, so this is not theoretical.
 * The key is used for counting only and is never logged.
 */
export function bucketKey(ip: string): string {
  if (family(ip) !== "ipv6") return ip;
  const g = ipv6Groups(ip);
  if (g === null) return ip;
  return `${g.slice(0, 4).map((x) => x.toString(16)).join(":")}::/64`;
}
