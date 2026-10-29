export type TrustIconName = "ai" | "consent" | "address" | "reconfirm" | "code" | "approved";

/** Six small custom icons for the Trust by design cards. Rounded shapes, brand colours, no text. */
export function TrustIcon({ name, className = "size-12" }: { name: TrustIconName; className?: string }) {
  const S = { stroke: "#231a12", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false" fill="none">
      <rect width="48" height="48" rx="14" fill="#fde9d6" />
      {name === "ai" && (<><rect x="12" y="15" width="24" height="20" rx="7" fill="#fff" {...S} /><circle cx="19" cy="25" r="2.6" fill="#d9600b" /><circle cx="29" cy="25" r="2.6" fill="#d9600b" /><path d="M24 15v-5M20 30.5h8" {...S} /><circle cx="24" cy="9" r="2" fill="#d9600b" /></>)}
      {name === "consent" && (<><path d="M24 9l12 4.5v9.5c0 8-5.5 13-12 16-6.5-3-12-8-12-16v-9.5z" fill="#fff" {...S} /><path d="M18.5 24.5l4 4 7.5-8.5" stroke="#2f9e63" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>)}
      {name === "address" && (<><path d="M10 23L24 11l14 12v14a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z" fill="#fff" {...S} /><rect x="19.5" y="26" width="9" height="8" rx="2" fill="#d9600b" /><path d="M21.5 26v-2.5a2.5 2.5 0 0 1 5 0V26" {...S} /></>)}
      {name === "reconfirm" && (<><circle cx="24" cy="25" r="13" fill="#fff" {...S} /><path d="M24 17v8l5 3" {...S} /><circle cx="36" cy="13" r="6" fill="#2f9e63" /><path d="M33.2 13.2l2 2 3.4-3.8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>)}
      {name === "code" && (<><rect x="9" y="17" width="30" height="16" rx="5" fill="#fff" {...S} />{[0, 1, 2, 3].map((i) => <circle key={i} cx={16 + i * 5.3} cy="25" r="1.9" fill="#d9600b" />)}<path d="M15 17v-3a9 9 0 0 1 18 0v3" {...S} /></>)}
      {name === "approved" && (<><rect x="15" y="8" width="18" height="32" rx="5" fill="#fff" {...S} /><path d="M21 13h6" {...S} /><circle cx="24" cy="29" r="6" fill="#2f9e63" /><path d="M21.2 29.2l2 2 3.6-4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>)}
    </svg>
  );
}
