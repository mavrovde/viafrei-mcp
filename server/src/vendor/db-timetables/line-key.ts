// Vendored from the ViaFrei platform (DB Timetables board, its parser and helpers); comments removed in the move.
export const lineKey = (line: string | null): string | null => (line === null ? null : line.replace(/\s+/gu, "").toUpperCase() || null);
