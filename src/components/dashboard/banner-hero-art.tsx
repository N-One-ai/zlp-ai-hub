import { HERO_ART_GLOW, HERO_ART_VIEWBOX } from "./hero-art-shared";

/** Decorative illustration for the "Tạo banner" hero card — a layout
 * wireframe (logo block, text lines, CTA pill) on a banner canvas, evoking
 * marketing banner design. Pure inline SVG (no external asset), brand
 * green family. The glow circle's geometry comes from hero-art-shared so
 * it stays identical to ImageHeroArt's — only the color differs. */
export function BannerHeroArt({ className }: { className?: string }) {
  return (
    <svg viewBox={HERO_ART_VIEWBOX} fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bha-stroke" x1="40" y1="30" x2="200" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7af0bd" />
          <stop offset="1" stopColor="#00CF6A" />
        </linearGradient>
        <radialGradient
          id="bha-glow"
          cx={HERO_ART_GLOW.gradientCx}
          cy={HERO_ART_GLOW.gradientCy}
          r={HERO_ART_GLOW.gradientR}
        >
          <stop offset="0" stopColor="#00CF6A" stopOpacity={HERO_ART_GLOW.stopOpacity} />
          <stop offset="1" stopColor="#00CF6A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={HERO_ART_GLOW.cx} cy={HERO_ART_GLOW.cy} r={HERO_ART_GLOW.r} fill="url(#bha-glow)" />
      <rect
        x="34"
        y="88"
        width="142"
        height="66"
        rx="12"
        transform="rotate(5 105 121)"
        fill="#06201a"
        stroke="#00CF6A"
        strokeOpacity="0.4"
      />
      <rect
        x="46"
        y="44"
        width="150"
        height="80"
        rx="14"
        fill="#00CF6A"
        fillOpacity="0.12"
        stroke="url(#bha-stroke)"
        strokeWidth="2"
      />
      <rect x="60" y="58" width="28" height="28" rx="7" fill="#8ff0c5" fillOpacity="0.85" />
      <rect x="98" y="60" width="76" height="8" rx="4" fill="#8ff0c5" fillOpacity="0.7" />
      <rect x="98" y="75" width="50" height="6" rx="3" fill="#8ff0c5" fillOpacity="0.4" />
      <rect x="60" y="98" width="54" height="14" rx="7" fill="#00CF6A" />
    </svg>
  );
}
