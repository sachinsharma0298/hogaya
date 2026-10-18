// The 10 service categories (also seeded in the database).
export const CATEGORIES = [
  "electrician", "plumber", "ac", "pump", "washing_machine", "ro", "fridge", "geyser", "inverter", "carpenter",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const isCategory = (c: unknown): c is Category => (CATEGORIES as readonly unknown[]).includes(c);
