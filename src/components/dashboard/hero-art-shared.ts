/** Shared geometry for the glow circle behind both dashboard hero-card
 * illustrations (ImageHeroArt, BannerHeroArt). Both SVGs use the same
 * viewBox, so keeping cx/cy/r/opacity here — instead of duplicated magic
 * numbers in each component — is what keeps the two circles the same
 * size and in the same relative position (so their centers line up when
 * the two cards sit side by side) as either illustration evolves later. */
export const HERO_ART_VIEWBOX = "0 0 220 180";

export const HERO_ART_GLOW = {
  cx: 110,
  cy: 92,
  r: 66,
  gradientCx: 0.56,
  gradientCy: 0.42,
  gradientR: 0.6,
  stopOpacity: 0.55,
} as const;
