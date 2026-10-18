"use client";
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { DICTS, type Lang } from "./translations";

const KEY = "hogaya-lang";
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, vars?: Record<string, string | number>) => string };
const LangCtx = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => k });

const EVENT = "hogaya-lang";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
};
const getSnapshot = (): Lang => {
  const v = localStorage.getItem(KEY);
  return v === "hing" || v === "hi" || v === "en" ? v : "en"; // English is the default
};
const getServerSnapshot = (): Lang => "en";

/** Remembers the language choice in the browser (localStorage). */
export function LangProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    document.documentElement.lang = lang === "hi" ? "hi" : lang === "hing" ? "hi-Latn" : "en";
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(KEY, l);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = DICTS[lang][key] ?? DICTS.en[key] ?? DICTS.hing[key] ?? key;
      for (const [k, v] of Object.entries(vars ?? {})) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [lang],
  );
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export const useT = () => useContext(LangCtx);
