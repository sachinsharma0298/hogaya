/** A door, a phone showing a code (abstract shapes, no digits), and a tick. Flat vector, brand colours, no text. */
export function DoorCodeScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 240" className={`h-auto w-full ${className}`} role="img" aria-hidden="true" focusable="false">
      <rect width="360" height="240" rx="28" fill="#fde9d6" />
      <rect x="0" y="206" width="360" height="34" fill="#cfe9d6" />
      {/* door */}
      <rect x="46" y="34" width="112" height="176" rx="8" fill="#231a12" />
      <rect x="56" y="44" width="92" height="166" rx="5" fill="#d9600b" />
      <rect x="66" y="56" width="30" height="50" rx="4" fill="#b84e06" /><rect x="108" y="56" width="30" height="50" rx="4" fill="#b84e06" />
      <rect x="66" y="118" width="30" height="62" rx="4" fill="#b84e06" /><rect x="108" y="118" width="30" height="62" rx="4" fill="#b84e06" />
      <circle cx="136" cy="150" r="5" fill="#fffaf5" />
      {/* phone with code shapes */}
      <g transform="translate(200 40)" className="lp-float">
        <rect width="96" height="164" rx="16" fill="#231a12" />
        <rect x="6" y="8" width="84" height="148" rx="11" fill="#fbf7f2" />
        <rect x="18" y="26" width="60" height="8" rx="4" fill="#231a12" opacity="0.3" />
        {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={14 + i * 12.5} y="48" width="10" height="26" rx="4" fill="#fff" stroke="#d9600b" strokeWidth="2" />)}
        {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={19 + i * 12.5} cy="61" r="2.6" fill="#d9600b" />)}
        <rect x="18" y="88" width="60" height="6" rx="3" fill="#231a12" opacity="0.2" /><rect x="28" y="100" width="40" height="6" rx="3" fill="#231a12" opacity="0.2" />
        <circle cx="48" cy="132" r="14" fill="#2f9e63" />
        <path className="lp-tick-loop" d="M41 132l5 5 10-11" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* hand-over arrow */}
      <path d="M164 118c12-14 24-14 32 0" fill="none" stroke="#231a12" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
    </svg>
  );
}
