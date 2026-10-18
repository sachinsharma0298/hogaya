import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { kick } from "@/lib/kick";
import { getRequest, updateRequest } from "@/lib/store";

// Operator button "Skip to shortlist": stop calling more providers.
export const maxDuration = 300;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!await getRequest(id)) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  await updateRequest(id, (x) => {
    x.skip_rest = true;
    x.events.push({ at: new Date().toISOString(), text: "Operator skipped the remaining providers" });
  });
  kick(id);
  return NextResponse.json({ ok: true });
}
