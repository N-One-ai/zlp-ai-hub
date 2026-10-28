/** Decorative illustration for the Dashboard hero panel — concentric
 * orbit rings + sparkle accents blending both brand colors (#0033C9 blue,
 * #00CF6A green), evoking AI-driven creative output without depicting
 * any specific asset. Pure inline SVG (no external asset). */
export function DashboardHeroArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="dha-ring" x1="0" y1="0" x2="400" y2="300" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5b85ff" />
          <stop offset="1" stopColor="#5eedb0" />
        </linearGradient>
        <radialGradient id="dha-glow" cx="0.62" cy="0.45" r="0.65">
          <stop offset="0" stopColor="#2a56e8" stopOpacity="0.45" />
          <stop offset="0.55" stopColor="#00CF6A" stopOpacity="0.16" />
          <stop offset="1" stopColor="#00CF6A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="250" cy="150" r="120" fill="url(#dha-glow)" />
      <circle cx="250" cy="150" r="88" stroke="url(#dha-ring)" strokeOpacity="0.5" strokeWidth="1.5" />
      <circle cx="250" cy="150" r="58" stroke="url(#dha-ring)" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="292" cy="98" r="5" fill="#8aa4ff" />
      <circle cx="204" cy="200" r="4" fill="#7af0bd" />
      <path d="M322 182l3.2 7.6 7.6 3.2-7.6 3.2-3.2 7.6-3.2-7.6-7.6-3.2 7.6-3.2z" fill="#9db4ff" />
      <path d="M186 96l2.4 5.8 5.8 2.4-5.8 2.4-2.4 5.8-2.4-5.8-5.8-2.4 5.8-2.4z" fill="#7af0bd" />
    </svg>
  );
}
