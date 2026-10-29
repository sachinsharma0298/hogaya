"use client";
import { useEffect, useRef } from "react";

/** Fades and slides its content in once as it scrolls into view. Content is visible without JavaScript and for people who prefer reduced motion. */
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: 0 | 1 | 2 | 3 }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return; // already on screen: leave it
    el.classList.add("lp-pre");
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { el.classList.remove("lp-pre"); io.disconnect(); }
    }, { threshold: 0.12 });
    const id = requestAnimationFrame(() => el.classList.add("lp-reveal")); // switch the transition on after the hidden state is painted
    io.observe(el);
    return () => { cancelAnimationFrame(id); io.disconnect(); };
  }, []);
  return <div ref={ref} className={`${className} ${delay ? `lp-delay-${delay}` : ""}`}>{children}</div>;
}
