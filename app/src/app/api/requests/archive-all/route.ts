import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { listRequests, updateRequest } from "@/lib/store";

// Hides every booking from the console without deleting anything ("Show archived" brings them back).
export async function POST() {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  let n = 0;
  for (const r of await listRequests()) {
    if (r.archived) continue;
    await updateRequest(r.id, (x) => { x.archived = true; });
    n++;
  }
  return NextResponse.json({ ok: true, archived: n });
}
