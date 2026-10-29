"use client";
import { useEffect, useState } from "react";
import type { Category } from "./categories";

let cached: Promise<Category[]> | null = null;
const load = () => (cached ??= fetch("/api/live-categories").then((r) => r.json()).then((b) => (Array.isArray(b.categories) ? b.categories : [])).catch(() => { cached = null; return []; }));

/** The categories that run with real calls ("Live calls"). `null` until the answer arrives. */
export function useLiveCategories(): Set<Category> | null {
  const [live, setLive] = useState<Set<Category> | null>(null);
  useEffect(() => { let alive = true; load().then((c) => alive && setLive(new Set(c))); return () => { alive = false; }; }, []);
  return live;
}
