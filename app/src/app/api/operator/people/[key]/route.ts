import { NextResponse } from "next/server";
import { findAuthUserIdByEmail, setAuthPassword, validPassword } from "@/lib/accounts";
import { requireRole } from "@/lib/guard";
import { approvePerson, deletePerson, editPerson, getPerson, rejectPerson, resolvePerson } from "@/lib/people";
import { resolvePasswordResets, savePersonNotes, setMustChangePassword } from "@/lib/store";

// Operator only: one person (customer or Pro) with everything we know, and the actions on them.
const keyOf = async (p: Promise<{ key: string }>) => decodeURIComponent((await p).key);

export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const person = await getPerson(await keyOf(params));
  return person ? NextResponse.json({ person }) : NextResponse.json({ error: "Not found." }, { status: 404 });
}

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const key = await keyOf(params);
  const b = await req.json().catch(() => ({}));
  const by = auth.user.email ?? auth.user.name;
  const done = (r: { ok: true } | { ok: false; error: string; status: number }) => (r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status }));
  switch (b.action) {
    case "approve": return done(await approvePerson(key, by));
    case "reject": return done(await rejectPerson(key, by));
    case "edit": return done(await editPerson(key, b));
    case "notes": {
      const f = await resolvePerson(key);
      if (!f?.email) return NextResponse.json({ error: "This person has no email to attach notes to." }, { status: 400 });
      await savePersonNotes(f.email, String(b.notes ?? "").slice(0, 4000));
      return NextResponse.json({ ok: true });
    }
    case "reset_password": {
      const f = await resolvePerson(key);
      if (!f?.email) return NextResponse.json({ error: "Not found." }, { status: 404 });
      if (!validPassword(b.password)) return NextResponse.json({ error: "The temporary password needs 8 to 72 characters." }, { status: 400 });
      const id = f.profile?.id ?? (await findAuthUserIdByEmail(f.email));
      if (!id) return NextResponse.json({ error: "This person has no login to reset." }, { status: 404 });
      const err = await setAuthPassword(id, b.password, true); // the password goes to Supabase Auth only: never stored or logged by us
      if (err) return NextResponse.json({ error: err }, { status: 503 });
      if (f.profile) await setMustChangePassword(f.profile.id, true);
      await resolvePasswordResets(f.email);
      return NextResponse.json({ ok: true });
    }
    default: return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireRole("operator");
  if ("error" in auth) return auth.error;
  const r = await deletePerson(await keyOf(params), auth.user.id);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}
