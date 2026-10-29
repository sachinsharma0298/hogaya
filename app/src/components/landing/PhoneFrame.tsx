/** A simple phone outline. The screen has a fixed shape, so nothing moves while the animation inside plays. */
export function PhoneFrame({ children, className = "", label }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <div role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`relative mx-auto w-full max-w-[230px] rounded-[2.2rem] border-[7px] border-foreground bg-foreground shadow-xl ${className}`}>
      <span className="absolute left-1/2 top-1.5 z-10 h-1.5 w-12 -translate-x-1/2 rounded-full bg-foreground/80" />
      <div className="relative aspect-[9/17] overflow-hidden rounded-[1.6rem] bg-background">{children}</div>
    </div>
  );
}
