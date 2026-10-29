"use client";
import { Phone } from "lucide-react";
import { useT } from "@/lib/lang";
import { PhoneFrame } from "./PhoneFrame";

const WAVE = [0.2, 0.6, 0.35, 0.85, 0.5, 1, 0.4, 0.7, 0.3, 0.9, 0.45, 0.6, 0.25];

/** A phone ringing with a saffron voice waveform and a speech bubble from the AI assistant; the pro answers. */
export function StepCall() {
  const { t } = useT();
  return (
    <PhoneFrame label={t("lp.s2.alt")}>
      <div className="absolute inset-0 flex flex-col items-center gap-3 p-4 pt-9">
        <div className="relative grid size-24 place-items-center">
          <svg viewBox="0 0 96 96" className="absolute inset-0 size-full" aria-hidden="true"><g className="lp-ring"><circle cx="48" cy="48" r="34" fill="none" stroke="#d9600b" strokeWidth="2.5" /></g><g className="lp-ring" style={{ animationDelay: "0.9s" }}><circle cx="48" cy="48" r="34" fill="none" stroke="#d9600b" strokeWidth="2.5" /></g></svg>
          <svg viewBox="0 0 60 60" className="relative size-16" aria-hidden="true"><circle cx="30" cy="30" r="28" fill="#fde9d6" /><circle cx="30" cy="25" r="9" fill="#f0b88a" /><path d="M13 49a17 17 0 0 1 34 0z" fill="#2f9e63" /><path d="M21 22a9 9 0 0 1 18 0z" fill="#d9600b" /></svg>
        </div>
        <svg viewBox="0 0 130 36" className="h-9 w-32" aria-hidden="true">{WAVE.map((h, i) => <g key={i} className="lp-wave" style={{ animationDelay: `${(i % 7) * 0.12}s` }}><rect x={i * 10 + 2} y={18 - h * 17} width="6" height={h * 34} rx="3" fill="#d9600b" /></g>)}</svg>
        <p className="rounded-2xl rounded-tl-sm bg-accent px-3 py-2 text-center text-[11.5px] font-medium leading-snug text-accent-foreground">“{t("lp.m.ai")}”</p>
        <p className="mt-auto flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800"><span className="lp-pop grid size-7 place-items-center rounded-full bg-emerald-600 text-white"><Phone className="size-3.5" /></span>{t("lp.m.answers")}</p>
      </div>
    </PhoneFrame>
  );
}
