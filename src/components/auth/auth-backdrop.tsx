/**
 * Decorative page background for /login and /register (shared, via
 * AuthPageLayout) — per the latest reference, a single large, soft
 * green radial glow (not the previous three-color green/teal/lime
 * composition) centered right-of-middle, with a bright saturated core
 * that holds for a while before fading to the page's own near-black
 * background — matching the reference's single dominant "moon glow"
 * rather than several separate color fields. No grid/texture layer.
 *
 * Rendered once on AuthPageLayout's OUTERMOST wrapper, `absolute
 * inset-0 -z-10` — spans the full page height, including behind the
 * gallery band, not just the area above it, so the page's gradient
 * reads as one continuous field with no seam at the gallery boundary.
 * `pointer-events-none` so it never intercepts clicks, and `-z-10`
 * keeps it behind both the form and the gallery regardless of DOM
 * order. The form's own `bg-card` surface is a SOLID (alpha-free)
 * color, so brightness here never reduces text/input contrast inside
 * the card. On mobile the glow re-centers (`max-sm:left-1/2`) and
 * shrinks/dims so it doesn't dominate a narrow viewport.
 */
export function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute left-[62%] top-1/2 size-[56rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-75 blur-3xl max-sm:left-1/2 max-sm:size-[34rem] max-sm:opacity-45"
        style={{ background: "radial-gradient(circle, var(--primary) 0%, var(--primary) 28%, transparent 65%)" }}
      />
    </div>
  );
}
