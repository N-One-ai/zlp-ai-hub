/** Shared chrome for /login and /register — logo + card, with a soft
 * brand-gradient glow behind it. Consolidates what used to be duplicated
 * markup on both pages. The logo lockup here is the SAME mark as the
 * app shell's sidebar header (/brand/zalopay-logo.svg + "AI" badge) —
 * reused as-is, not redrawn, so the brand identity is consistent
 * between "logged out" and "logged in" chrome. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden="true"
        className="absolute -top-32 left-1/2 -translate-x-1/2 size-[32rem] rounded-full bg-gradient-to-br from-primary/25 via-accent/10 to-transparent blur-3xl"
      />
      <div className="relative w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG, no optimization needed */}
              <img src="/brand/zalopay-logo.svg" alt="Zalopay" className="h-6 w-auto" />
              <span className="inline-flex items-center rounded-md bg-gradient-to-r from-primary to-accent px-1.5 py-[1px] text-[11px] font-bold text-primary-foreground">
                AI
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground/70">Creative Platform</span>
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>

        <div className="rounded-xl ring-1 ring-border bg-card p-6">{children}</div>

        {footer}
      </div>
    </div>
  );
}
