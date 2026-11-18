/**
 * Static decorative tiles for the /register page's background gallery
 * (components/auth/auth-gallery.tsx). Original, locally-generated SVGs
 * under public/auth/gallery — never fetched from a reference site, never
 * produced by calling an image-generation provider at request time (that
 * would mean every visitor's page load re-triggers paid AI generation).
 * `w`/`h` are each SVG's own intrinsic viewBox size, used only to derive
 * its aspect ratio for the row layout — never rendered at that pixel size.
 */
export type GalleryTile = {
  src: string;
  w: number;
  h: number;
};

export const GALLERY_TILES: GalleryTile[] = [
  { src: "/auth/gallery/tile-01.svg", w: 360, h: 480 },
  { src: "/auth/gallery/tile-02.svg", w: 480, h: 360 },
  { src: "/auth/gallery/tile-03.svg", w: 360, h: 360 },
  { src: "/auth/gallery/tile-04.svg", w: 340, h: 460 },
  { src: "/auth/gallery/tile-05.svg", w: 420, h: 300 },
  { src: "/auth/gallery/tile-06.svg", w: 340, h: 340 },
  { src: "/auth/gallery/tile-07.svg", w: 360, h: 480 },
  { src: "/auth/gallery/tile-08.svg", w: 440, h: 330 },
  { src: "/auth/gallery/tile-09.svg", w: 340, h: 340 },
  { src: "/auth/gallery/tile-10.svg", w: 320, h: 420 },
  { src: "/auth/gallery/tile-11.svg", w: 460, h: 280 },
  { src: "/auth/gallery/tile-12.svg", w: 340, h: 420 },
];

/** Three rows with different, non-overlapping tile subsets + offsets so
 * consecutive rows never look like repeats of each other at a glance. */
export const GALLERY_ROWS: GalleryTile[][] = [
  [GALLERY_TILES[0], GALLERY_TILES[4], GALLERY_TILES[8], GALLERY_TILES[1], GALLERY_TILES[11]],
  [GALLERY_TILES[2], GALLERY_TILES[6], GALLERY_TILES[9], GALLERY_TILES[5], GALLERY_TILES[7]],
  [GALLERY_TILES[3], GALLERY_TILES[10], GALLERY_TILES[1], GALLERY_TILES[8], GALLERY_TILES[6]],
];
