/** The process logger: one pino instance, JSON lines on stderr (stdout carries the stdio transport). */
import pino from "pino";

export const log = pino({ level: process.env["LOG_LEVEL"] ?? "info", base: { service: "viafrei-mcp" } }, pino.destination(2));

/** Strips query strings and credentials from a URL inside a message before it is logged. */
export function redact(message: string): string {
  return message.replace(/(https?:\/\/)[^/\s@]+@/g, "$1***@").replace(/([?&][^=\s&]*(?:key|token|secret|id)[^=\s&]*=)[^&\s]+/gi, "$1***");
}
