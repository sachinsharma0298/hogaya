"use client";
import { useEffect, useState } from "react";

/** Re-fetch a URL every `ms` milliseconds. Keeps the last good data if one fetch fails. `error` is a translation key. */
export function usePoll<T>(url: string, ms = 1500) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const body = await res.json();
        if (!stop) {
          if (res.status === 401 && !window.location.pathname.startsWith("/login")) {
            window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`); // signed out: go and sign in
            return;
          }
          if (!res.ok) setError(res.status === 404 ? "err.notfound" : "err.generic");
          else {
            setData(body);
            setError(null);
          }
        }
      } catch {
        if (!stop) setError("err.conn");
      }
    };
    tick();
    const t = setInterval(tick, ms);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [url, ms]);
  return { data, error };
}
