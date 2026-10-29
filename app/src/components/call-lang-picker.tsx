"use client";
import type { CallLang } from "@/lib/call-scripts/hogaya-context";
import { useT } from "@/lib/lang";

/** The screen language they are using now decides the starting choice: English screens -> English calls, Hinglish or Hindi screens -> Hindi calls. */
export const defaultCallLang = (ui: string): CallLang => (ui === "en" ? "english" : "hindi");

/** "Call language": English or हिंदी. */
export function CallLangPicker({ value, onChange }: { value: CallLang; onChange: (v: CallLang) => void }) {
  const { t } = useT();
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5 text-sm font-medium">{t("calllang.label")}</legend>
      <div className="flex gap-2">
        {(["english", "hindi"] as const).map((l) => (
          <button key={l} type="button" aria-pressed={value === l} onClick={() => onChange(l)} className={`h-11 flex-1 rounded-xl border text-base ${value === l ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>
            {l === "english" ? "English" : "हिंदी"}
          </button>
        ))}
      </div>
      <p className="text-xs text-foreground/70">{t("calllang.note")}</p>
    </fieldset>
  );
}
