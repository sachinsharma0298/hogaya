/** A home with a spinning ceiling fan, and a pro with a toolbox arriving at the door. Flat vector, brand colours, no text. */
export function HomeScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={`h-auto w-full ${className}`} role="img" aria-hidden="true" focusable="false">
      <rect width="400" height="300" rx="28" fill="#fde9d6" />
      <circle cx="338" cy="52" r="24" fill="#f6a35a" opacity="0.55" />
      <ellipse cx="90" cy="46" rx="34" ry="11" fill="#fff" opacity="0.7" />
      <ellipse cx="116" cy="40" rx="22" ry="9" fill="#fff" opacity="0.7" />
      {/* ground */}
      <rect x="0" y="262" width="400" height="38" fill="#cfe9d6" />
      <rect x="0" y="262" width="400" height="5" fill="#9fd3b0" />
      {/* house */}
      <polygon points="18,104 150,34 282,104" fill="#d9600b" />
      <polygon points="150,34 282,104 262,104 150,46" fill="#b84e06" />
      <rect x="32" y="104" width="236" height="158" rx="6" fill="#fffaf5" stroke="#231a12" strokeWidth="3" />
      {/* inside: ceiling fan */}
      <rect x="40" y="112" width="220" height="6" rx="3" fill="#f4ede5" />
      <rect x="147" y="118" width="6" height="22" rx="3" fill="#231a12" />
      <g className="lp-fan"><circle cx="150" cy="146" r="6" fill="#231a12" />
        <ellipse cx="150" cy="146" rx="46" ry="6" fill="#d9600b" /><ellipse cx="150" cy="146" rx="6" ry="46" fill="#f6a35a" /></g>
      {/* window */}
      <rect x="50" y="150" width="58" height="48" rx="6" fill="#dff1fb" stroke="#231a12" strokeWidth="3" />
      <path d="M79 150v48M50 174h58" stroke="#231a12" strokeWidth="2" />
      {/* sofa */}
      <rect x="54" y="222" width="86" height="30" rx="10" fill="#f6a35a" />
      <rect x="48" y="214" width="16" height="38" rx="8" fill="#d9600b" /><rect x="130" y="214" width="16" height="38" rx="8" fill="#d9600b" />
      {/* lamp */}
      <path d="M176 226l8-22h16l8 22z" fill="#fde9d6" stroke="#231a12" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="190" y="226" width="4" height="26" fill="#231a12" /><rect x="182" y="250" width="20" height="4" rx="2" fill="#231a12" />
      {/* door */}
      <rect x="214" y="168" width="46" height="94" rx="5" fill="#231a12" />
      <rect x="220" y="174" width="34" height="84" rx="3" fill="#d9600b" />
      <circle cx="246" cy="218" r="3.5" fill="#fffaf5" />
      {/* the pro */}
      <g className="lp-float">
        <circle cx="334" cy="168" r="14" fill="#f0b88a" />
        <path d="M319 165a15 15 0 0 1 30 0z" fill="#d9600b" /><rect x="316" y="163" width="36" height="5" rx="2.5" fill="#b84e06" />
        <rect x="318" y="184" width="32" height="46" rx="12" fill="#2f9e63" />
        <rect x="324" y="226" width="9" height="36" rx="4" fill="#231a12" /><rect x="337" y="226" width="9" height="36" rx="4" fill="#231a12" />
        <path d="M320 192l-12 22" stroke="#f0b88a" strokeWidth="7" strokeLinecap="round" />
        <path d="M348 192l14 20" stroke="#f0b88a" strokeWidth="7" strokeLinecap="round" />
        <rect x="352" y="210" width="30" height="22" rx="4" fill="#231a12" /><rect x="360" y="204" width="14" height="8" rx="3" fill="none" stroke="#231a12" strokeWidth="3" />
        <rect x="352" y="219" width="30" height="3" fill="#d9600b" />
      </g>
      {/* arrived tick */}
      <g className="lp-pop"><circle cx="296" cy="146" r="15" fill="#2f9e63" /><path className="lp-tick-loop" d="M289 146l5 5 9-10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></g>
      {/* plant */}
      <rect x="282" y="246" width="14" height="16" rx="3" fill="#b84e06" /><path d="M289 246c-12-10-10-24-4-30 4 8 8 14 4 30zM289 246c12-10 10-24 4-30-4 8-8 14-4 30z" fill="#4fb383" />
    </svg>
  );
}
