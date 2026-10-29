import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isCategory, type Category } from "@/lib/categories";
import { getProviders, listRequests, updateProfileDetails, updateProvider } from "@/lib/store";
import type { PendingProfileChange } from "@/lib/types";

// The signed-in Pro's own profile. Name, working hours and bio save straight away. Categories, service area and visit charge
// are what Hogaya matches and quotes on, so a change waits as "Pending change" until the operator approves it. The phone is read-only.
async function me() {
  const u = await getSessionUser();
  if (u?.role !== "pro" || !u.provider_id) return null;
  const p = (await getProviders()).find((x) => x.id === u.provider_id);
  return p ? { u, p } : null;
}

export async function GET() {
  const m = await me();
  if (!m) return NextResponse.json({ error: "Please log in as a Pro." }, { status: 401 });
  const ratings = (await listRequests()).filter((r) => r.booking?.provider_id === m.p.id && r.booking.rating).map((r) => r.booking!.rating!.stars);
  return NextResponse.json({
    provider: m.p,
    review: m.u.review ?? "approved",
    stats: { jobs: m.p.jobs, rating_count: ratings.length, avg_rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null },
  });
}

export async function PUT(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ error: "Please log in as a Pro." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 80);
  const bio = String(b.bio ?? "").trim().slice(0, 300);
  const hours = String(b.working_hours ?? "").trim().slice(0, 80);
  const area = String(b.area ?? "").trim().slice(0, 60);
  const visitNum = Number(String(b.visit_charge ?? "").replace(/[^\d.]/g, ""));
  const categories = (Array.isArray(b.categories) ? b.categories : []).filter(isCategory) as Category[];
  if (name.length < 2 || !area || !(visitNum > 0) || categories.length === 0) return NextResponse.json({ error: "Enter your name, at least one category, your service area and your visit charge." }, { status: 400 });
  const visit = `₹${visitNum}`;
  const cur = m.p;
  const curCats = (cur.categories ?? [cur.category]) as Category[];
  const sameCats = categories.length === curCats.length && categories.every((c) => curCats.includes(c));
  const pending: PendingProfileChange = { requested_at: new Date().toISOString() };
  if (!sameCats) pending.categories = categories;
  if (area !== (cur.area ?? "")) pending.area = area;
  if (visit !== (cur.visit_charge ?? "")) pending.visit_charge = visit;
  const has = Boolean(pending.categories || pending.area || pending.visit_charge);
  const previous = cur.pending_changes && has && JSON.stringify({ ...pending, requested_at: "" }) === JSON.stringify({ ...cur.pending_changes, requested_at: "" }) ? cur.pending_changes : undefined;
  await updateProvider(cur.id, (z) => { z.name = name; z.bio = bio || undefined; z.working_hours = hours || undefined; z.pending_changes = has ? previous ?? pending : undefined; });
  if (name !== m.u.name) await updateProfileDetails(m.u.id, name);
  return NextResponse.json({ ok: true, pending: has });
}
