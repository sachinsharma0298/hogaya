// Shared by the quick-fill box (browser) and the parser (server), so the browser never loads the AI library.
import type { Category } from "./categories";

export const PARSE_MAX_CHARS = 1000;
export const PARSE_MIN_CHARS = 10;

export const MISSING = ["category", "problem", "day", "time", "area", "address"] as const;
export type MissingField = (typeof MISSING)[number];

export interface ParsedBooking {
  category: Category | null;
  problem: string | null; // cleaned, in the user's own language
  preferred_day: string | null; // as spoken, e.g. "kal"
  date: string | null; // YYYY-MM-DD in India time
  time: string | null; // HH:MM, 24 hour, start of the window
  time_window: string | null; // as spoken, e.g. "after 6 PM"
  area: string | null; // locality or sector
  address: string | null; // only if actually spoken
  missing_fields: MissingField[];
}
