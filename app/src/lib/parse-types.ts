// Shared by the quick-fill box (browser) and the parser (server), so the browser never loads the AI library.
import type { Category } from "./categories";

export const PARSE_MAX_CHARS = 1000;
export const PARSE_MIN_CHARS = 10;

export const MISSING = ["category", "problem", "day", "time", "area", "address", "landmark"] as const;
export type MissingField = (typeof MISSING)[number];

export interface ParsedBooking {
  category: Category | null;
  problem: string | null; // the full description in the user's own words and script, without the place and the booking time
  preferred_day: string | null; // as spoken, e.g. "kal"
  date: string | null; // YYYY-MM-DD in India time
  time: string | null; // HH:MM, 24 hour, start of the window
  time_window: string | null; // as spoken, e.g. "after 6 PM"
  area: string | null; // locality or sector
  address: string | null; // house, flat or plot number, floor, building: only if actually spoken
  landmark: string | null; // "near the metro", "Fortis ke paas"
  missing_fields: MissingField[];
}
