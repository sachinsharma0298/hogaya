import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { ParseError, parseBooking } from "@/lib/parse-booking";
import { PARSE_MAX_CHARS, PARSE_MIN_CHARS } from "@/lib/parse-types";

// "Say it once": suggests booking fields from one sentence. It never creates a booking. The text is not stored or logged.

// Small in-memory limiter (per server instance). Best effort on serverless; the real cap on bookings is unchanged.
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60_000;
function tooMany(key: string, max: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= max) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

export async function POST(req: Request) {
  const auth = await requireRole("customer", "operator");
  if ("error" in auth) return auth.error;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (tooMany(`u:${auth.user.id}`, 30) || tooMany(`ip:${ip}`, 60)) return NextResponse.json({ error: "Too many tries. Please fill the form by hand." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < PARSE_MIN_CHARS) return NextResponse.json({ error: "Please say a little more." }, { status: 400 });
  if (text.length > PARSE_MAX_CHARS) return NextResponse.json({ error: `Please keep it under ${PARSE_MAX_CHARS} characters.` }, { status: 400 });
  try {
    return NextResponse.json(await parseBooking(text));
  } catch (e) {
    const err = e as ParseError;
    console.error("book/parse: failed", { kind: err.kind ?? "unknown", status: err.status }); // reason only, never the text
    return NextResponse.json({ error: "Could not read that right now. Please fill the form by hand." }, { status: 502 });
  }
}
