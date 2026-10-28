import { HERO_ART_GLOW, HERO_ART_VIEWBOX } from "./hero-art-shared";

/** Decorative illustration for the "Tạo ảnh" hero card — layered photo
 * frames + a mountain/sun glyph and sparkle accents, evoking AI image
 * generation. Pure inline SVG (no external asset), brand blue family. The
 * glow circle's geometry comes from hero-art-shared so it stays identical
 * to BannerHeroArt's — only the color differs. */
export function ImageHeroArt({ className }: { className?: string }) {
  return (
    <svg viewBox={HERO_ART_VIEWBOX} fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="iha-stroke" x1="40" y1="30" x2="190" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8aa4ff" />
          <stop offset="1" stopColor="#0033C9" />
        </linearGradient>
        <radialGradient
          id="iha-glow"
          cx={HERO_ART_GLOW.gradientCx}
          cy={HERO_ART_GLOW.gradientCy}
          r={HERO_ART_GLOW.gradientR}
        >
          <stop offset="0" stopColor="#2a56e8" stopOpacity={HERO_ART_GLOW.stopOpacity} />
          <stop offset="1" stopColor="#2a56e8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={HERO_ART_GLOW.cx} cy={HERO_ART_GLOW.cy} r={HERO_ART_GLOW.r} fill="url(#iha-glow)" />
      <rect
        x="38"
        y="72"
        width="112"
        height="84"
        rx="14"
        transform="rotate(-9 94 114)"
        fill="#0b1230"
        stroke="#0033C9"
        strokeOpacity="0.45"
      />
      <rect
        x="58"
        y="40"
        width="122"
        height="94"
        rx="16"
        fill="#2a56e8"
        fillOpacity="0.14"
        stroke="url(#iha-stroke)"
        strokeWidth="2"
      />
      <path
        d="M72 114l25-29 18 20 15-17 25 25"
        stroke="#aebfff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="150" cy="62" r="8" fill="#aebfff" />
      <path d="M184 32l3.4 8.6 8.6 3.4-8.6 3.4-3.4 8.6-3.4-8.6-8.6-3.4 8.6-3.4z" fill="#9db4ff" />
      <path d="M52 150l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#9db4ff" fillOpacity="0.8" />
    </svg>
  );
}
