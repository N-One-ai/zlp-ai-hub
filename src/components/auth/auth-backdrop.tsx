/**
 * Decorative page background for /login and /register (shared, via
 * AuthPageLayout) — large, soft radial-gradient color fields with a
 * clearly bright, saturated core that holds for a while before fading
 * to transparent (the gradient has a flat "bright" stop, e.g.
 * `var(--primary) 32%`, not just a single center point immediately
 * tapering off) — this is what gives each field a visible bright zone
 * like the reference, rather than reading as a faint ambient tint. No
 * grid/texture layer — just the color fields, per explicit "bỏ hoạ
 * tiết lưới" feedback from a prior pass.
 *
 * Rendered once on AuthPageLayout's OUTERMOST wrapper, `absolute
 * inset-0 -z-10` — spans the full page height, including behind the
 * gallery band, not just the area above it, so the page's gradient
 * reads as one continuous field with no seam at the gallery boundary.
 * `pointer-events-none` so it never intercepts clicks, and `-z-10`
 * keeps it behind both the form and the gallery regardless of DOM
 * order. The form's own `bg-card` surface is a SOLID (alpha-free)
 * color, so no amount of brightness here can ever reduce text/input
 * contrast inside the card — legibility is guaranteed structurally,
 * not by keeping this backdrop dim. The brightest points are still
 * kept toward the edges/top (not centered directly behind where the
 * form's own input fields sit) so there's no distracting hot spot
 * right under the fields, matching the reference's own layout where
 * the glow peaks near the hero text and fades out by the time it
 * reaches the CTA button.
 */
export function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Green field — left */}
      <div
        className="absolute -left-32 -top-56 size-[44rem] rounded-full opacity-60 blur-2xl max-sm:-left-16 max-sm:-top-32 max-sm:size-[26rem] max-sm:opacity-40"
        style={{ background: "radial-gradient(circle, var(--primary) 0%, var(--primary) 20%, transparent 55%)" }}
      />
      {/* Teal/jade field — top center, the brightest/widest field. Pushed
       * well above the viewport (-top-80) so its hot core sits above the
       * header/title text instead of directly behind it — by the time it
       * reaches the logo/subtitle it has already faded most of the way. */}
      <div
        className="absolute left-1/2 -top-80 size-[46rem] -translate-x-1/2 rounded-full opacity-65 blur-2xl max-sm:-top-44 max-sm:size-[28rem] max-sm:opacity-40"
        style={{ background: "radial-gradient(circle, var(--accent) 0%, var(--accent) 20%, transparent 58%)" }}
      />
      {/* Lime/neon field — right */}
      <div
        className="absolute -right-36 -top-44 size-[42rem] rounded-full opacity-60 blur-2xl max-sm:-right-16 max-sm:-top-24 max-sm:size-[26rem] max-sm:opacity-40"
        style={{ background: "radial-gradient(circle, #a3e635 0%, #a3e635 20%, transparent 55%)" }}
      />
    </div>
  );
}
