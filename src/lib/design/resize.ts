import type { DesignLayer } from "@/types/database";

/**
 * Derives a never-before-saved size variant by proportionally remapping
 * every layer's position/size (and a text layer's fontSize) from the OLD
 * canvas dimensions to the NEW ones. This is a relative-coordinate
 * remap, not a hand-authored per-size layout table: a layer keeps the
 * same fractional position/size on the canvas, which is what keeps a
 * logo inside its safe margin and a tagline's hierarchy (size relative
 * to the subtitle) consistent across sizes without a second layout
 * system to maintain.
 *
 * The background layer is handled differently: its destination box is
 * simply resized to the new canvas — it has no "position" of its own to
 * rescale, since its fill is a live cover-fit crop recomputed from the
 * natural image size + focalX/focalY every render (see
 * computeCoverCrop below and canvas.tsx), not stored pixel-cropped data.
 */
export function scaleLayersToSize<T extends DesignLayer>(
  layers: T[],
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number
): T[] {
  if (fromWidth <= 0 || fromHeight <= 0) return layers;
  const scaleX = toWidth / fromWidth;
  const scaleY = toHeight / fromHeight;
  const scaleFont = Math.sqrt(scaleX * scaleY);

  return layers.map((layer) => {
    if (layer.type === "background") {
      return { ...layer, x: 0, y: 0, width: toWidth, height: toHeight };
    }
    return {
      ...layer,
      x: Math.round(layer.x * scaleX),
      y: Math.round(layer.y * scaleY),
      width: Math.max(8, Math.round(layer.width * scaleX)),
      height: Math.max(8, Math.round(layer.height * scaleY)),
      fontSize: layer.fontSize !== undefined ? Math.max(8, Math.round(layer.fontSize * scaleFont)) : layer.fontSize,
    };
  });
}

/**
 * "Cover fit" crop rect (source-pixel coordinates) that fills a
 * `boxWidth`×`boxHeight` destination without ever stretching the source
 * image — the same semantics as CSS `object-fit: cover; object-position`.
 * `focalX`/`focalY` (0..1, default centered) pick WHICH part of the
 * longer axis gets kept once the shorter axis is matched exactly.
 */
export function computeCoverCrop(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
  focalX = 0.5,
  focalY = 0.5
): { x: number; y: number; width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return { x: 0, y: 0, width: naturalWidth, height: naturalHeight };
  }
  const boxRatio = boxWidth / boxHeight;
  const naturalRatio = naturalWidth / naturalHeight;

  let cropWidth: number;
  let cropHeight: number;
  if (naturalRatio > boxRatio) {
    cropHeight = naturalHeight;
    cropWidth = naturalHeight * boxRatio;
  } else {
    cropWidth = naturalWidth;
    cropHeight = naturalWidth / boxRatio;
  }

  const maxX = Math.max(0, naturalWidth - cropWidth);
  const maxY = Math.max(0, naturalHeight - cropHeight);
  return {
    x: clamp(maxX * focalX, 0, maxX),
    y: clamp(maxY * focalY, 0, maxY),
    width: cropWidth,
    height: cropHeight,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
