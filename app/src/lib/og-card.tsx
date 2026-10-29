import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = "Hogaya. Home repairs, booked and confirmed. Someone actually shows up.";

/** The share image (Open Graph and X): name, English headline, and a phone with a tick, in brand colours. Drawn in code, no image files. */
export function ogCard() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#fbf7f2", padding: 64, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 700 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "#d9600b", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="38" height="38" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fffaf5" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div style={{ marginLeft: 20, fontSize: 56, fontWeight: 800, color: "#231a12" }}>Hogaya</div>
          </div>
          <div style={{ marginTop: 44, fontSize: 64, fontWeight: 800, lineHeight: 1.1, color: "#231a12" }}>Home repairs, booked and confirmed. Someone actually shows up.</div>
          <div style={{ marginTop: 28, fontSize: 32, fontWeight: 600, color: "#d9600b" }}>Done. Guaranteed.</div>
        </div>
        <div style={{ display: "flex", width: 320, height: 500, borderRadius: 56, background: "#231a12", padding: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", borderRadius: 42, background: "#fde9d6" }}>
            <svg width="190" height="190" viewBox="0 0 80 80"><circle cx="40" cy="40" r="38" fill="#d6f0e0" /><circle cx="40" cy="40" r="28" fill="#2f9e63" /><path d="M28 41l9 9 16-18" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div style={{ display: "flex", marginTop: 28, width: 170, height: 18, borderRadius: 9, background: "#d9600b" }} />
            <div style={{ display: "flex", marginTop: 14, width: 120, height: 14, borderRadius: 7, background: "#231a12", opacity: 0.25 }} />
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
