"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { useT } from "@/lib/lang";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PARSE_MAX_CHARS, PARSE_MIN_CHARS, type ParsedBooking } from "@/lib/parse-types";

const WAIT_MS = 1500; // Wispr Flow types everything at once, so wait for the text to stop changing

/** The "Say it once" box on /book. It only suggests values (onParsed); it never moves the form forward or submits. */
export function QuickFill({ onParsed, note }: { onParsed: (p: ParsedBooking) => void; note: React.ReactNode }) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error" | "limit">("idle");
  const last = useRef(""); // the text we last sent, so the same text is not sent twice
  const run = useRef(0); // a newer run makes an older answer stale
  const onParsedRef = useRef(onParsed);
  useEffect(() => { onParsedRef.current = onParsed; });

  async function fill(value: string) {
    const body = value.trim();
    if (body.length < PARSE_MIN_CHARS) return;
    last.current = body;
    const id = ++run.current;
    setState("busy");
    try {
      const res = await fetch("/api/book/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: body }) });
      if (id !== run.current) return;
      if (res.status === 429) return setState("limit");
      if (!res.ok) return setState("error");
      onParsedRef.current((await res.json()) as ParsedBooking);
      setState("done");
    } catch {
      if (id === run.current) setState("error");
    }
  }

  useEffect(() => {
    const body = text.trim();
    if (body.length < PARSE_MIN_CHARS || body === last.current) return;
    const timer = setTimeout(() => fill(body), WAIT_MS);
    return () => clearTimeout(timer);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section aria-labelledby="qf-h" className="mt-4 rounded-2xl border bg-accent/40 p-3.5">
      <Label htmlFor="qf" className="block text-base font-semibold leading-snug"><span id="qf-h" className="mb-0.5 flex items-center gap-1.5 text-primary"><Mic className="size-4" aria-hidden="true" /> {t("qf.title")}</span>{t("qf.label")}</Label>
      <Textarea
        id="qf"
        rows={4}
        maxLength={PARSE_MAX_CHARS}
        value={text}
        onChange={(e) => { setText(e.target.value); if (state !== "busy") setState("idle"); }}
        placeholder={t("qf.ph")}
        aria-describedby="qf-status qf-help"
        className="mt-2 min-h-[112px] resize-none bg-background text-base"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => fill(text)} disabled={state === "busy" || text.trim().length < PARSE_MIN_CHARS} className="min-h-11 rounded-xl">
          {state === "busy" ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}{t("qf.btn")}
        </Button>
        <span className="text-xs text-foreground/75">{t("qf.count", { n: text.length })}</span>
      </div>
      <div id="qf-status" role="status" aria-live="polite" className="mt-2 text-sm font-medium">
        {state === "busy" && <p className="text-primary">{t("qf.busy")}</p>}
        {state === "done" && <p className="text-primary">{t("qf.done")}</p>}
        {state === "error" && <p className="text-destructive">{t("qf.err")}</p>}
        {state === "limit" && <p className="text-destructive">{t("qf.limit")}</p>}
        {state === "done" && note}
      </div>
      <p id="qf-help" className="mt-1.5 text-xs leading-snug text-foreground/80">{t("qf.privacy")} <a href="/voice" className="font-medium text-primary underline underline-offset-4">{t("qf.link")}</a></p>
    </section>
  );
}
