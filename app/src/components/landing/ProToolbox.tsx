/** A pro with a toolbox, and a phone receiving a job. Flat vector, brand colours, no text. */
export function ProToolbox({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 280" className={`h-auto w-full ${className}`} role="img" aria-hidden="true" focusable="false">
      <rect width="360" height="280" rx="28" fill="#fde9d6" />
      <circle cx="48" cy="48" r="22" fill="#f6a35a" opacity="0.5" />
      <rect x="0" y="236" width="360" height="44" fill="#cfe9d6" />
      {/* pro */}
      <g className="lp-float">
        <circle cx="128" cy="92" r="22" fill="#f0b88a" />
        <path d="M105 88a23 23 0 0 1 46 0z" fill="#d9600b" /><rect x="100" y="86" width="56" height="7" rx="3.5" fill="#b84e06" />
        <rect x="100" y="118" width="56" height="74" rx="18" fill="#2f9e63" />
        <rect x="108" y="186" width="14" height="54" rx="6" fill="#231a12" /><rect x="134" y="186" width="14" height="54" rx="6" fill="#231a12" />
        <path d="M104 130l-20 36" stroke="#f0b88a" strokeWidth="11" strokeLinecap="round" />
        <path d="M152 130l28 -14" stroke="#f0b88a" strokeWidth="11" strokeLinecap="round" />
        <rect x="58" y="162" width="50" height="38" rx="6" fill="#231a12" /><rect x="72" y="150" width="22" height="14" rx="5" fill="none" stroke="#231a12" strokeWidth="4" />
        <rect x="58" y="177" width="50" height="5" fill="#d9600b" /><rect x="78" y="172" width="10" height="14" rx="2" fill="#f6a35a" />
      </g>
      {/* phone receiving a job */}
      <g transform="translate(196 40)">
        <rect width="104" height="190" rx="18" fill="#231a12" />
        <rect x="6" y="8" width="92" height="174" rx="13" fill="#fbf7f2" />
        <rect x="14" y="20" width="76" height="14" rx="7" fill="#d9600b" />
        <rect x="14" y="44" width="76" height="62" rx="10" fill="#fff" stroke="#e7dccf" />
        <circle cx="30" cy="62" r="9" fill="#fde9d6" /><path d="M26 63l3 3 6-7" fill="none" stroke="#d9600b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="46" y="57" width="36" height="6" rx="3" fill="#231a12" opacity="0.8" /><rect x="46" y="68" width="24" height="5" rx="2.5" fill="#231a12" opacity="0.35" />
        <rect x="22" y="84" width="60" height="6" rx="3" fill="#231a12" opacity="0.25" /><rect x="22" y="94" width="40" height="6" rx="3" fill="#231a12" opacity="0.25" />
        <rect x="14" y="116" width="76" height="26" rx="13" fill="#2f9e63" />
        <path className="lp-tick-loop" d="M42 129l6 6 12-13" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <g className="lp-wave"><rect x="30" y="156" width="6" height="14" rx="3" fill="#d9600b" /></g>
        <g className="lp-wave" style={{ animationDelay: "0.2s" }}><rect x="42" y="156" width="6" height="14" rx="3" fill="#d9600b" /></g>
        <g className="lp-wave" style={{ animationDelay: "0.4s" }}><rect x="54" y="156" width="6" height="14" rx="3" fill="#d9600b" /></g>
        <g className="lp-wave" style={{ animationDelay: "0.6s" }}><rect x="66" y="156" width="6" height="14" rx="3" fill="#d9600b" /></g>
      </g>
      <g className="lp-ring"><circle cx="248" cy="40" r="14" fill="none" stroke="#d9600b" strokeWidth="3" /></g>
    </svg>
  );
}
