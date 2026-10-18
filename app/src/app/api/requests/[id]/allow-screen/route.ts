import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { getRequest, updateRequest } from "@/lib/store";

// Operator choice: let the customer confirm on screen instead of (or after) the Fo call.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!await getRequest(id)) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  await updateRequest(id, (x) => {
    x.screen_confirm_open = true;
    x.events.push({ at: new Date().toISOString(), text: "Operator allowed the customer to confirm on screen" });
  });
  return NextResponse.json({ ok: true });
}
