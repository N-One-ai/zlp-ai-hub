/**
 * Decorative page background for /login and /register (shared, via
 * AuthPageLayout) — per the latest reference, a single green radial
 * glow centered behind the form (not right-of-center like a prior
 * pass), with a bright saturated core, a muted dark-green-to-black
 * transition band, and a soft natural fade to the page's own
 * near-black background at the edges/corners — no hard ring or
 * banding. The gradient has three color stops, not just "color then
 * transparent": a bright core (0-18%), an intermediate dark
 * green-black blend (out to 42%) for the "xanh lá -> xanh đen -> đen"
 * transition the reference shows, then transparent (revealing the
 * page's own near-black bg) by 62%. No grid/texture layer.
 *
 * Rendered once on AuthPageLayout's OUTERMOST wrapper, `absolute
 * inset-0 -z-10` — spans the full page height, including behind the
 * gallery band, not just the area above it, so the page's gradient
 * reads as one continuous field with no seam at the gallery boundary
 * (the gallery itself renders no background of its own, so this shows
 * through its gaps exactly as before). `pointer-events-none` so it
 * never intercepts clicks, and `-z-10` keeps it behind both the form
 * and the gallery regardless of DOM order. The form's own `bg-card`
 * surface is a SOLID (alpha-free) color, so brightness here never
 * reduces text/input contrast inside the card; opacity and the
 * gradient's own fade are still kept moderate so the header text
 * above the card (logo/title/subtitle, which sits in the transparent
 * area) isn't washed out either. On mobile the glow shrinks/dims
 * (stays centered) so it doesn't dominate a narrow viewport.
 */
export function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2 size-[50rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl max-sm:size-[30rem] max-sm:opacity-45"
        style={{
          background:
            "radial-gradient(circle, var(--primary) 0%, var(--primary) 18%, color-mix(in oklch, var(--primary) 35%, black) 42%, transparent 62%)",
        }}
      />
    </div>
  );
}
