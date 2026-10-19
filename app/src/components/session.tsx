"use client";
import { useCallback, useEffect, useState } from "react";
import type { Provider, Role } from "@/lib/types";

export interface SessionUser {
  id: string;
  role: Role;
  name: string;
  phone: string; // the person's own number (empty for the operator and demo Pros)
  provider_id?: string;
  review: "pending" | "approved" | "rejected"; // the operator's decision about this person
  approval_notice: boolean; // true until they have seen "Approved by Hogaya"
  must_change_password: boolean; // the operator reset their password: they must choose a new one
}

/** The demo session: who is logged in. `loading` is true until the first answer arrives. */
export function useSession() {
  const [state, setState] = useState<{ loading: boolean; user: SessionUser | null; provider?: Provider }>({ loading: true, user: null });
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const b = await res.json();
      setState({ loading: false, user: b.user, provider: b.provider ?? undefined });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => alive && setState({ loading: false, user: b.user, provider: b.provider ?? undefined }))
      .catch(() => alive && setState((s) => ({ ...s, loading: false })));
    return () => { alive = false; };
  }, []);
  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setState({ loading: false, user: null });
  }, []);
  return { ...state, refresh, logout };
}
