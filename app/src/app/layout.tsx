import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/lib/lang";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://hogaya-sandy.vercel.app"),
  title: "Hogaya — Done. Guaranteed.",
  description: "Home repairs, booked and confirmed. Someone actually shows up. Hogaya's AI assistant calls local pros, you pick one, and a service code at the door proves they came.",
  openGraph: { title: "Hogaya — Done. Guaranteed.", description: "Home repairs, booked and confirmed. Someone actually shows up.", siteName: "Hogaya", type: "website" },
  twitter: { card: "summary_large_image", title: "Hogaya — Done. Guaranteed.", description: "Home repairs, booked and confirmed. Someone actually shows up." },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning><LangProvider>{children}</LangProvider></body>
    </html>
  );
}
