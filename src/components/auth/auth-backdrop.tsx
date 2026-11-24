/**
 * Decorative page background for /login and /register (shared, via
 * AuthPageLayout) — large, soft radial-gradient color fields that fade
 * to transparent well before their own edge (not a hard-edged blurred
 * circle), so they blend into the page's near-black background rather
 * than reading as a flat colored shape. Confined to the content area
 * ABOVE the gallery band (AuthPageLayout renders this inside that
 * area's own wrapper, not the gallery's), so it never overlaps or
 * alters the gallery's own look/animation. `pointer-events-none` and
 * behind everything (`-z-10`) — purely visual, the form's own
 * `bg-card` surface sits on top and keeps its full contrast regardless
 * of what color is behind it.
 */
export function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Faint grid texture for depth — opacity kept low enough that it
       * never competes with text contrast. */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
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
