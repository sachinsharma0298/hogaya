import { NextResponse } from "next/server";
import { DEMO_CODE, devLoginEnabled, isRole, setDevSession, validPhone } from "@/lib/auth";
import { ensureLocalAuthUser, findUserByPhone, listProviders, saveUser } from "@/lib/store";
import type { User } from "@/lib/types";

const OPERATOR_ID = "00000000-0000-4000-8000-000000000001";
const mk = async (u: User) => { await ensureLocalAuthUser(u.id, u.email ?? `${u.id}@local.test`); return saveUser(u); };

// LOCAL DEVELOPMENT ONLY. Switched on by DEV_LOGIN=1 and refused whenever DATABASE_URL (a real database) is set.
export async function POST(req: Request) {
  if (!devLoginEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  if (!isRole(b.role)) return NextResponse.json({ error: "Pick Customer, Pro or Operator." }, { status: 400 });
  if (String(b.code ?? "").trim() !== DEMO_CODE) return NextResponse.json({ error: "wrong_code" }, { status: 401 });
  const name = String(b.name ?? "").trim().slice(0, 80);
  const phone = String(b.phone ?? "").trim();
  let user: User | undefined;
  if (b.role === "customer") {
    if (!name || !validPhone(phone)) return NextResponse.json({ error: "Enter a name and a 10-digit phone." }, { status: 400 });
    user = (await findUserByPhone("customer", phone)) ?? { id: crypto.randomUUID(), role: "customer", name, phone, created_at: new Date().toISOString() };
    const email = String(b.email ?? "").trim().toLowerCase() || user.email || `${user.id}@local.test`;
    user = await mk({ ...user, name, email });
  } else if (b.role === "pro") {
    const p = (await listProviders()).find((x) => x.id === b.provider_id);
    if (!p) return NextResponse.json({ error: "No such Pro." }, { status: 404 });
    user = (await findUserByPhone("pro", `dev-${p.id}`)) ?? { id: crypto.randomUUID(), role: "pro", name: p.name, phone: `dev-${p.id}`, provider_id: p.id, created_at: new Date().toISOString() };
    user = await mk(user);
  } else {
    user = await mk({ id: OPERATOR_ID, role: "operator", name: name || "Operator", phone: "", created_at: new Date().toISOString() });
  }
  await setDevSession(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, role: user.role, name: user.name } });
}
