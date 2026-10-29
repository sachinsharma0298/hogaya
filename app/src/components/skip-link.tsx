"use client";
import { useT } from "@/lib/lang";

/** First thing a keyboard user tabs to: jumps past the header to the page's main content. */
export function SkipLink() {
  const { t } = useT();
  return (
    <a
      href="#main"
      onClick={(e) => {
        const main = document.querySelector("main");
        if (!main) return;
        e.preventDefault();
        main.setAttribute("tabindex", "-1");
        main.focus();
        main.scrollIntoView();
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-foreground focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-background"
    >
      {t("a11y.skip")}
    </a>
  );
}
