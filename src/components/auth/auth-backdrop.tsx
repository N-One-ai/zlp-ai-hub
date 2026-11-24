/**
 * Decorative page background for /login and /register (shared, via
 * AuthPageLayout) — large, soft radial-gradient color fields that fade
 * to transparent well before their own edge (not a hard-edged blurred
 * circle), so they blend into the page's near-black background rather
 * than reading as a flat colored shape. No grid/texture layer — just
 * the color fields, per explicit "bỏ hoạ tiết lưới" feedback.
 *
 * Rendered once on AuthPageLayout's OUTERMOST wrapper, `absolute
 * inset-0 -z-10` — spans the full page height, including behind the
 * gallery band, not just the area above it. An earlier version
 * confined this to the content area above the gallery, which left
 * nothing but flat `--background` behind the gallery itself and
 * produced a visible seam where the gradient-lit top met the plain
 * black bottom; letting it span the whole page removes that seam so
 * the page's gradient reads as one continuous field, visible through
 * the gaps between gallery tiles and around the band the same way it
 * shows behind the form. `pointer-events-none` so it never intercepts
 * clicks, and `-z-10` keeps it behind both the form and the gallery
 * regardless of DOM order — the form's own `bg-card` surface and the
 * gallery's own opaque tiles both sit on top, so contrast and the
 * gallery's look are unaffected by what color is behind them.
 */
export function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Green field — left */}
      <div
        className="absolute -left-40 -top-40 size-[42rem] rounded-full opacity-35 blur-3xl max-sm:size-[26rem] max-sm:opacity-20"
        style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
      />
      {/* Teal/jade field — top center */}
      <div
        className="absolute left-1/2 -top-56 size-[36rem] -translate-x-1/2 rounded-full opacity-30 blur-3xl max-sm:size-[22rem] max-sm:opacity-15"
        style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
      />
      {/* Lime/neon field — right */}
      <div
        className="absolute -right-44 -top-24 size-[40rem] rounded-full opacity-30 blur-3xl max-sm:-right-24 max-sm:size-[24rem] max-sm:opacity-15"
        style={{ background: "radial-gradient(circle, #a3e635 0%, transparent 70%)" }}
      />
    </div>
  );
}
