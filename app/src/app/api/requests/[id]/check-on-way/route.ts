import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { demoOnTheWay } from "@/lib/agent-service";
import { getProviders, getRequest, updateRequest } from "@/lib/store";

// Demo only: the operator button triggers one "on the way?" check call to the booked provider.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const r = await getRequest(id);
  if (!r?.booking) return NextResponse.json({ error: "Not booked yet." }, { status: 400 });
  const p = (await getProviders()).find((x) => x.id === r.booking!.provider_id)!;
  const res = demoOnTheWay(p); // simulated only: no real call exists for this check
  await updateRequest(id, (x) => {
    const now = new Date().toISOString();
    x.booking!.on_the_way_at = now;
    x.calls.push({ id: "c-" + Math.random().toString(36).slice(2, 8), kind: "on_the_way", provider_id: p.id, provider_name: p.name, status: "done", started_at: now, demo: true, summary_text: res.summary, json: res.json as Record<string, unknown> });
    x.events.push({ at: now, text: p.name + " is on the way" });
  });
  return NextResponse.json({ ok: true, summary: res.summary });
}
