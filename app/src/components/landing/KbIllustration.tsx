export type KbKind = "customers" | "pros" | "judges";

/** A small illustration for each guide card: a customer with a phone, a pro with a toolbox, a tester with a checklist. No text. */
export function KbIllustration({ kind, className = "" }: { kind: KbKind; className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={`h-auto w-full ${className}`} aria-hidden="true" focusable="false">
      <rect width="120" height="80" rx="16" fill="#fde9d6" />
      <rect y="66" width="120" height="14" fill="#cfe9d6" />
      {kind === "customers" && (<>
        <circle cx="40" cy="30" r="10" fill="#f0b88a" /><path d="M29 28a11 11 0 0 1 22 0z" fill="#231a12" /><rect x="29" y="42" width="22" height="26" rx="9" fill="#d9600b" />
        <rect x="62" y="16" width="34" height="56" rx="7" fill="#231a12" /><rect x="65" y="20" width="28" height="48" rx="5" fill="#fbf7f2" />
        <rect x="68" y="25" width="22" height="5" rx="2.5" fill="#d9600b" /><rect x="68" y="34" width="22" height="9" rx="3" fill="#fff" stroke="#e7dccf" /><rect x="68" y="46" width="22" height="9" rx="3" fill="#fff" stroke="#e7dccf" />
        <circle cx="86" cy="60" r="5" fill="#2f9e63" /><path d="M83.6 60l1.7 1.7 3-3.4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>)}
      {kind === "pros" && (<>
        <circle cx="44" cy="26" r="10" fill="#f0b88a" /><path d="M33 24a11 11 0 0 1 22 0z" fill="#d9600b" /><rect x="32" y="38" width="24" height="28" rx="9" fill="#2f9e63" />
        <rect x="62" y="46" width="30" height="22" rx="4" fill="#231a12" /><rect x="70" y="40" width="14" height="8" rx="3" fill="none" stroke="#231a12" strokeWidth="3" /><rect x="62" y="55" width="30" height="3" fill="#d9600b" />
        <circle cx="94" cy="22" r="10" fill="#fff" stroke="#231a12" strokeWidth="2" /><path d="M89.5 22l3 3 5.5-6" stroke="#2f9e63" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>)}
      {kind === "judges" && (<>
        <rect x="34" y="10" width="52" height="62" rx="8" fill="#fff" stroke="#231a12" strokeWidth="2.4" /><rect x="50" y="6" width="20" height="9" rx="4" fill="#d9600b" />
        {[0, 1, 2].map((i) => (<g key={i}><rect x="42" y={24 + i * 15} width="9" height="9" rx="3" fill="#d6f0e0" stroke="#2f9e63" strokeWidth="1.8" /><path d={`M44 ${28.5 + i * 15}l2 2 3-3.6`} stroke="#2f9e63" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /><rect x="56" y={26 + i * 15} width="22" height="5" rx="2.5" fill="#231a12" opacity="0.25" /></g>))}
        <circle cx="92" cy="52" r="10" fill="#fff" stroke="#231a12" strokeWidth="2.4" /><path d="M99 59l9 9" stroke="#231a12" strokeWidth="3.4" strokeLinecap="round" />
      </>)}
    </svg>
  );
}
