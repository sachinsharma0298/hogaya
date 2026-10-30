"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Circle, Loader2, Mic } from "lucide-react";
import { useT } from "@/lib/lang";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PARSE_MAX_CHARS, PARSE_MIN_CHARS, type ParsedBooking } from "@/lib/parse-types";

const WAIT_MS = 1500; // Wispr Flow types everything at once, so wait for the text to stop changing

/** The "Say it once" box on /book. It only suggests values (onParsed); it never moves the form forward or submits. */
export const CHECKLIST = ["problem", "address", "landmark", "area", "time"] as const;
export type Captured = Record<(typeof CHECKLIST)[number], boolean>;

export function QuickFill({ onParsed, note, got, onAdd }: { onParsed: (p: ParsedBooking) => void; note: React.ReactNode; got: Captured | null; onAdd: (k: (typeof CHECKLIST)[number]) => void }) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error" | "limit">("idle");
  const last = useRef(""); // the text we last sent, so the same text is not sent twice
  const ctl = useRef<AbortController | null>(null); // the one request in flight
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onParsedRef = useRef(onParsed);
  useEffect(() => { onParsedRef.current = onParsed; });

  /** One request at a time: a newer one aborts the older. One automatic retry for network errors, timeouts and 5xx. */
  async function fill(value: string) {
    const body = value.trim();
    if (body.length < PARSE_MIN_CHARS || body === last.current && state === "busy") return;
    if (timer.current) clearTimeout(timer.current); // the button and the auto-fill must never both fire
    last.current = body;
    ctl.current?.abort();
    const mine = new AbortController();
    ctl.current = mine;
    setState("busy");
    for (let tryNo = 0; tryNo < 2; tryNo++) {
      const stop = setTimeout(() => mine.abort(), 25_000); // at least 15 s: the model can take a few seconds
      try {
        const res = await fetch("/api/book/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: body }), signal: mine.signal });
        if (ctl.current !== mine) return; // a newer request took over
        if (res.status === 429) return setState("limit");
        if (res.ok) { onParsedRef.current((await res.json()) as ParsedBooking); return setState("done"); }
        if (res.status < 500) return setState("error");
      } catch {
        if (ctl.current !== mine) return;
      } finally {
        clearTimeout(stop);
      }
    }
    if (ctl.current === mine) setState("error");
  }

  useEffect(() => {
    const body = text.trim();
    if (body.length < PARSE_MIN_CHARS || body === last.current) return;
    timer.current = setTimeout(() => fill(body), WAIT_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section aria-labelledby="qf-h" className="mt-4 rounded-2xl border bg-accent/40 p-3.5">
      <Label htmlFor="qf" className="block text-base font-semibold leading-snug"><span id="qf-h" className="mb-0.5 flex items-center gap-1.5 text-primary"><Mic className="size-4" aria-hidden="true" /> {t("qf.title")}</span>{t("qf.label")}</Label>
      <p className="mt-2 text-sm font-semibold">{t("qf.say")}</p>
      <ol className="mt-1 space-y-0.5 text-sm">
        {CHECKLIST.map((k, i) => (
          <li key={k} className="flex min-h-7 flex-wrap items-center gap-x-2">
            {got ? (got[k] ? <Check className="size-4 text-green-800" aria-hidden="true" /> : <Circle className="size-4 text-foreground/50" aria-hidden="true" />) : <span className="w-4 text-center text-xs text-foreground/75" aria-hidden="true">{i + 1}</span>}
            <span>{t(`qf.c${i + 1}`)}</span>
            {got && got[k] && <span className="sr-only">{t("qf.got")}</span>}
            {got && !got[k] && <button type="button" onClick={() => onAdd(k)} className="min-h-7 rounded-md px-1 font-medium text-primary underline underline-offset-4">{t("qf.add")}</button>}
          </li>
        ))}
      </ol>
      <Textarea
        id="qf"
        rows={5}
        maxLength={PARSE_MAX_CHARS}
        value={text}
        onChange={(e) => { setText(e.target.value); if (state !== "busy") setState("idle"); }}
        placeholder={t("qf.ph")}
        aria-describedby="qf-status qf-help"
        className="mt-2 min-h-[132px] resize-none bg-background text-base"
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
