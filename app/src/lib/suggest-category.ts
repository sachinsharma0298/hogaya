import type { Category } from "./categories";

// Demo-mode category suggestion by keyword (English, Hinglish and Hindi). Claude can replace this in real mode.
const KEYWORDS: Record<Category, string[]> = {
  electrician: ["fan", "pankha", "पंखा", "wiring", "switch", "bijli", "बिजली", "light", "mcb", "short circuit", "socket", "bulb", "electric", "tubelight", "board"],
  plumber: ["nal", "नल", "tap", "leak", "leakage", "pipe", "पाइप", "plumb", "flush", "basin", "drain", "tanki leak", "seepage", "toilet", "commode"],
  ac: ["ac", "a.c", "एसी", "air conditioner", "air-conditioner", "split ac", "window ac"],
  pump: ["motor", "मोटर", "pump", "पंप", "submersible", "overhead tank", "paani chadh", "tanki", "tank"],
  washing_machine: ["washing", "वॉशिंग", "washer", "kapde", "कपड़े", "spin", "dryer"],
  ro: ["ro", "आरओ", "purifier", "प्यूरीफ", "water filter", "aquaguard", "kent", "tds", "filter"],
  fridge: ["fridge", "फ्रिज", "refrigerator", "freezer", "frij", "deep freezer"],
  geyser: ["geyser", "गीज़र", "gyser", "water heater", "hot water", "garam paani", "गरम पानी"],
  inverter: ["inverter", "इन्वर्टर", "battery", "बैटरी", "ups", "backup"],
  carpenter: ["carpenter", "कारपेंटर", "door", "darwaza", "दरवाज़ा", "bed", "furniture", "almirah", "wardrobe", "wood", "table", "chair", "sofa", "cupboard"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Returns the best-matching category for the text, or null if nothing matches. */
export function suggestCategory(text: string): Category | null {
  const lower = text.toLowerCase();
  if (lower.trim().length < 2) return null;
  let best: Category | null = null;
  let bestScore = 0;
  for (const [cat, words] of Object.entries(KEYWORDS) as [Category, string[]][]) {
    let score = 0;
    for (const w of words) {
      // Latin words must match as whole words ("ac" must not match "cable"); Devanagari matches as a substring.
      const re = /^[\x00-\x7f]+$/.test(w) ? new RegExp(`(^|[^a-z])${escape(w)}([^a-z]|$)`, "i") : new RegExp(escape(w));
      if (re.test(lower)) score += w.includes(" ") ? 2 : 1;
    }
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  return best;
}
