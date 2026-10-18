import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { getFoConversation } from "@/lib/fo-mcp";
import { getRequest } from "@/lib/store";

// Dev helper (read-only, disabled in production): read back the turns of one live call so briefs can be compared.
// Phone numbers are masked. The Fo conversation id never leaves the server.
export async function GET(req: Request) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not available" }, { status: 404 });
  const u = new URL(req.url);
  const c = (await getRequest(u.searchParams.get("request") ?? ""))?.calls.find((x) => x.id === u.searchParams.get("call"));
  if (!c?.fo_conversation_id) return NextResponse.json({ error: "No such live call" }, { status: 404 });
  const { turns } = await getFoConversation(c.fo_conversation_id);
  const mask = (s: string) => s.replace(/\+?\d[\d ]{9,}\d/g, (m) => "+•••• " + m.replace(/\D/g, "").slice(-4));
  return NextResponse.json({ provider: c.provider_name, turns: turns.map((t) => ({ role: t.role, at: t.at, text: mask(t.text) })) });
}
