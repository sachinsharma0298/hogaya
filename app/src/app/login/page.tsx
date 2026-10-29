"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, MailCheck, ShieldAlert } from "lucide-react";
import { CustomerShell, StateBox } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PhoneField } from "@/components/phone-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LegalLinks } from "@/components/legal-links";
import { CallLangPicker, defaultCallLang } from "@/components/call-lang-picker";
import type { CallLang } from "@/lib/call-scripts/hogaya-context";
import { useT } from "@/lib/lang";
import { supabaseBrowser } from "@/lib/supabase/client";
import { usePoll } from "@/lib/use-poll";
import type { Role } from "@/lib/types";

const HOME: Record<Role, string> = { customer: "/me", pro: "/pro", operator: "/operator" };
// Google sign-in is switched on later by setting NEXT_PUBLIC_GOOGLE_LOGIN=1 (after Google is set up in Supabase).
const GOOGLE = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";
const safeNext = (n: string | null) => (n && /^\/(?![/\\])/.test(n) ? n : "");

function LoginForm() {
  const { t, lang } = useT();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const cfg = usePoll<{ supabase: boolean; dev: boolean }>("/api/auth/config", 600000).data;
  const [mode, setMode] = useState<"signin" | "create" | "forgot">(params.get("tab") === "create" ? "create" : "signin");
  const [forgotDone, setForgotDone] = useState(false);
  const [created, setCreated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [pickedLang, setCallLang] = useState<CallLang | null>(null);
  const callLang = pickedLang ?? defaultCallLang(lang);
  const [busy, setBusy] = useState<"google" | "pw" | null>(null);
  const [error, setError] = useState(params.get("error") ? t("login.err.callback") : "");
  const redirectTo = () => `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  /** Where to go once signed in. A customer heading to the booking form keeps going there, even before approval (the booking runs as a preview). */
  async function afterSession(toBooking = false) {
    const me = (await (await fetch("/api/auth/me", { cache: "no-store" })).json().catch(() => ({}))) as { user?: { role: Role; review?: string; must_change_password?: boolean } };
    if (me.user?.must_change_password) return window.location.assign("/set-password"); // the operator reset the password: choose a new one first
    const approved = !me.user || me.user.role === "operator" || me.user.review === "approved";
    const customerBooking = (toBooking || me.user?.role === "customer") && next.startsWith("/book");
    window.location.assign(approved || customerBooking ? next || (me.user ? HOME[me.user.role] : "/me") : "/me");
  }
  /** Any request can fail (no internet, server down): say so, and what to do. */
  const safe = (fn: (e: React.FormEvent) => Promise<void>) => async (e: React.FormEvent) => {
    try { await fn(e); } catch { setBusy(null); setError(t("err.network")); }
  };
  async function passwordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy("pw");
    const { error: err } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    if (err) { setBusy(null); return setError(t("login.err.creds")); }
    await afterSession();
  }
  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!consent) return setError(t("login.err.consent"));
    setBusy("pw");
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, phone, password, consent, call_lang: callLang }) });
    if (!res.ok) { setBusy(null); return setError(res.status === 409 ? t("login.err.exists") : res.status === 403 ? t("login.err.reserved") : res.status === 400 ? (password.length < 8 || password.length > 72 ? t("login.err.pw") : t("login.err.fields")) : t("login.err.generic")); }
    const { error: err } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(null);
    if (err) return setError(t("login.err.generic"));
    setCreated(true); // show the "waiting for approval" notice first; "Continue" goes on to the booking form (or My bookings)
  }
  async function forgot(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError(t("login.err.fields"));
    setBusy("pw");
    const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: email.trim() }) });
    setBusy(null);
    if (!res.ok) return setError(t("login.err.generic"));
    setForgotDone(true);
  }
  async function google() {
    setError("");
    setBusy("google");
    const { error: err } = await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (err) { setBusy(null); setError(t("login.err.send")); }
  }

  return (
    <CustomerShell>
      <h1 className="text-2xl font-bold tracking-tight">{t("login.title")}</h1>
      <p className="mt-1 text-sm text-foreground/85">{t("login.sub")}</p>

      {!cfg && <div className="mt-6"><StateBox title="…" /></div>}
      {cfg && !cfg.supabase && !cfg.dev && <div className="mt-6"><StateBox title={t("login.notconfigured")} /></div>}

      {cfg?.supabase && (created ? (
        <div className="mt-6 rounded-2xl border bg-card p-5 text-center" role="status">
          <CheckCircle2 className="mx-auto size-8 text-primary" />
          <p className="mt-2 text-lg font-semibold">{t("login.created.title")}</p>
          <p className="mt-1 text-sm text-foreground/85">{t("login.created.body")}</p>
          <Button type="button" onClick={() => afterSession(true)} className="mt-4 h-12 w-full rounded-2xl text-base">{t("login.created.btn")}</Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {mode !== "forgot" && (
            <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl border bg-card p-1 text-sm font-medium">
              {(["signin", "create"] as const).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} type="button" onClick={() => { setMode(m); setError(""); }} className={`rounded-xl px-2 py-2.5 transition ${mode === m ? "bg-primary text-primary-foreground" : "text-foreground/75"}`}>{t(`login.tab.${m}`)}</button>
              ))}
            </div>
          )}
          {GOOGLE && mode !== "forgot" && (
            <>
              <Button type="button" disabled={busy !== null} onClick={google} className="h-12 w-full rounded-2xl text-base">
                {busy === "google" ? <Loader2 className="size-4 animate-spin" /> : t("login.google")}
              </Button>
              <p className="text-center text-xs text-foreground/70">{t("login.or")}</p>
            </>
          )}
          {mode === "forgot" ? (
            forgotDone ? (
              <div className="rounded-2xl border bg-card p-5 text-center" role="status">
                <MailCheck className="mx-auto size-8 text-primary" />
                <p className="mt-2 text-sm text-foreground/85">{t("login.forgot.sent")}</p>
                <button type="button" onClick={() => { setMode("signin"); setForgotDone(false); setError(""); }} className="mt-3 text-sm font-medium text-primary underline underline-offset-4">{t("login.forgot.back")}</button>
              </div>
            ) : (
              <form onSubmit={safe(forgot)} noValidate className="space-y-3">
                <div className="space-y-1.5"><Label htmlFor="forgot-id">{t("login.forgot.label")}</Label><Input id="forgot-id" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 text-base" /></div>
                <Button type="submit" disabled={busy !== null} className="h-12 w-full rounded-2xl text-base">{busy ? <Loader2 className="size-4 animate-spin" /> : t("login.forgot.btn")}</Button>
                <button type="button" onClick={() => { setMode("signin"); setError(""); }} className="block w-full text-center text-sm font-medium text-primary underline underline-offset-4">{t("login.forgot.back")}</button>
              </form>
            )
          ) : (
            <>
              <form onSubmit={safe(mode === "signin" ? passwordSignIn : createAccount)} noValidate className="space-y-3">
                {mode === "create" && <div className="space-y-1.5"><Label htmlFor="name">{t("login.name")}</Label><Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 text-base" /></div>}
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("login.email")}</Label>
                  <Input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 text-base" />
                </div>
                {mode === "create" && <div className="space-y-1.5"><Label htmlFor="phone">{t("login.phone")}</Label><PhoneField id="phone" value={phone} onChange={setPhone} className="h-11 text-base" /><p className="text-xs text-foreground/70">{t("login.phone.note")}</p></div>}
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("login.password")}</Label>
                  <Input id="password" type="password" autoComplete={mode === "create" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 text-base" />
                </div>
                {mode === "create" && <CallLangPicker value={callLang} onChange={setCallLang} />}
                {mode === "create" && (
                  <label className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm leading-snug">
                    <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                    <span>{t("login.consent")}</span>
                  </label>
                )}
                {mode === "create" && <LegalLinks />}
                <Button type="submit" disabled={busy !== null} className="h-12 w-full rounded-2xl text-base">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : mode === "signin" ? t("login.signin.btn") : t("login.create.btn")}
                </Button>
              </form>
              {mode === "signin" && <button type="button" onClick={() => { setMode("forgot"); setError(""); }} className="block w-full text-center text-sm font-medium text-primary underline underline-offset-4">{t("login.forgot")}</button>}
              <p className="text-xs text-foreground/75">{t("login.pro.note")} <Link href="/pro/join" className="font-medium text-primary underline underline-offset-4">{t("login.pro.join")}</Link></p>
            </>
          )}
        </div>
      ))}
      {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</p>}

      {cfg?.dev && <DevLogin next={next} />}
    </CustomerShell>
  );
}

/** Local development only: shown when DEV_LOGIN=1 and no real database is connected. Never present on the live site. */
function DevLogin({ next }: { next: string }) {
  const [role, setRole] = useState<Role>("customer");
  const [name, setName] = useState("Test person");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const pros = usePoll<{ providers: { id: string; name: string }[] }>("/api/auth/dev-pros", 600000).data?.providers ?? [];
  async function go(body: Record<string, unknown>, r: Role) {
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "123456", ...body }) });
    if (!res.ok) return setErr(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Failed");
    window.location.assign(next || HOME[r]);
  }
  return (
    <div className="mt-8 rounded-2xl border-2 border-dashed border-primary/50 bg-accent/50 p-4">
      <p className="flex items-center gap-2 text-sm font-bold"><ShieldAlert className="size-4 text-primary" /> Local test login (this Mac only)</p>
      <div className="mt-3 flex gap-1 rounded-xl border bg-card p-1 text-sm">
        {(["customer", "pro", "operator"] as Role[]).map((r) => (
          <button key={r} type="button" onClick={() => setRole(r)} className={`flex-1 rounded-lg px-2 py-1.5 capitalize ${role === r ? "bg-primary text-primary-foreground" : ""}`}>{r}</button>
        ))}
      </div>
      {role === "customer" && (
        <div className="mt-3 space-y-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" aria-label="Phone" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" aria-label="Email" />
          <Button type="button" className="w-full" onClick={() => go({ role, name, phone, email }, role)}>Log in</Button>
        </div>
      )}
      {role === "operator" && <Button type="button" className="mt-3 w-full" onClick={() => go({ role, name: "Operator" }, role)}>Log in as operator</Button>}
      {role === "pro" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {pros.map((p) => <button key={p.id} type="button" onClick={() => go({ role, provider_id: p.id }, role)} className="rounded-full border bg-background px-3 py-1.5 text-xs">{p.name}</button>)}
          {pros.length === 0 && <p className="text-xs">No Pros yet. Add one in the operator console first.</p>}
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<CustomerShell><StateBox title="…" /></CustomerShell>}>
      <LoginForm />
    </Suspense>
  );
}
