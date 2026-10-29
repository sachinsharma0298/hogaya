"use client";
import { useEffect, useRef, useState } from "react";

/** A dotted path that draws itself, in saffron, as the section scrolls past. Put it inside a `relative` box; it runs top to bottom. */
export function ScrollLine({ className = "" }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(1); // 0..1, how much of the path is drawn (fully drawn until the page has loaded in a browser that allows motion)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = box.current?.parentElement;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      setP(Math.min(1, Math.max(0, (vh * 0.65 - r.top) / r.height)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  const dots = (c: string) => ({ backgroundImage: `radial-gradient(circle, ${c} 2.2px, transparent 2.6px)`, backgroundSize: "8px 14px", backgroundRepeat: "repeat-y", backgroundPosition: "center top" });
  return (
    <div ref={box} aria-hidden="true" className={`pointer-events-none absolute inset-y-0 w-2 ${className}`}>
      <div className="absolute inset-0" style={dots("#e7dccf")} />
      <div className="absolute inset-x-0 top-0" style={{ height: `${p * 100}%`, ...dots("#d9600b") }} />
    </div>
  );
}
