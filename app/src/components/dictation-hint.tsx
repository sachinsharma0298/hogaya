"use client";
import { useT } from "@/lib/lang";

/** The lang attribute for a text the person types or dictates: Devanagari is Hindi, otherwise the page language. */
export function useFieldLang(value: string): string {
  const { lang } = useT();
  if (/[ऀ-ॿ]/.test(value)) return "hi";
  return lang === "hi" ? "hi" : lang === "hing" ? "hi-Latn" : "en";
}

/** A small line under a free-text field: dictation apps such as Wispr Flow type into it. Not used on phone, email or password fields. */
export function DictationHint({ id }: { id?: string }) {
  const { t } = useT();
  return <p id={id} className="mt-1 text-xs text-foreground/75">{t("dict.hint")}</p>;
}
