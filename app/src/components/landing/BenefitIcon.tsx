export type BenefitIconName = "signup" | "consent" | "approval" | "calls" | "jobs" | "trips" | "score";

/** Small icons for how pros join and why. Rounded shapes, brand colours, no text. */
export function BenefitIcon({ name, className = "size-10" }: { name: BenefitIconName; className?: string }) {
  const S = { stroke: "#231a12", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false" fill="none">
      <rect width="40" height="40" rx="12" fill="#fde9d6" />
      {name === "signup" && (<><circle cx="20" cy="15" r="5" fill="#fff" {...S} /><path d="M10 31a10 10 0 0 1 20 0z" fill="#fff" {...S} /><path d="M29 9v6M26 12h6" stroke="#d9600b" strokeWidth="2.6" strokeLinecap="round" /></>)}
      {name === "consent" && (<><rect x="10" y="10" width="20" height="20" rx="6" fill="#fff" {...S} /><path d="M15 20.5l4 4 7-8" stroke="#2f9e63" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>)}
      {name === "approval" && (<><path d="M20 8l10 4v8c0 6.5-4.5 10.5-10 13-5.5-2.5-10-6.5-10-13v-8z" fill="#fff" {...S} /><path d="M15.5 20l3.5 3.5 6-7" stroke="#2f9e63" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>)}
      {name === "calls" && (<><path d="M13 9h6l2 6-3 2a14 14 0 0 0 5 5l2-3 6 2v6a3 3 0 0 1-3 3C18 30 10 22 10 12a3 3 0 0 1 3-3z" fill="#fff" {...S} /><path d="M26 10a6 6 0 0 1 4 4M26 5a11 11 0 0 1 9 9" stroke="#d9600b" strokeWidth="2.4" strokeLinecap="round" fill="none" /></>)}
      {name === "jobs" && (<><rect x="9" y="14" width="22" height="16" rx="4" fill="#fff" {...S} /><path d="M16 14v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M9 22h22" {...S} /><circle cx="29" cy="12" r="5" fill="#2f9e63" /><path d="M26.8 12.2l1.7 1.7 3-3.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>)}
      {name === "trips" && (<><path d="M12 29c0-8 16-4 16-12" {...S} strokeDasharray="1 5" /><circle cx="12" cy="29" r="3.5" fill="#d9600b" /><circle cx="28" cy="13" r="4.5" fill="#fff" {...S} /><path d="M26 13l1.5 1.5 3-3.5" stroke="#2f9e63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>)}
      {name === "score" && (<><path d="M20 9l3.4 7 7.6 1-5.5 5.3 1.3 7.7L20 26.3 13.2 30l1.3-7.7L9 17l7.6-1z" fill="#f6a35a" {...S} /></>)}
    </svg>
  );
}
