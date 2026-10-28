"use client";

import { useEffect, useState } from "react";
import { useHtmlImage } from "./use-html-image";
import { loadImageData, extractAlphaMask, featherMask } from "@/lib/image-processing/background-removal";

/**
 * Renders an AI-cutout "image" layer with its Feather value applied LIVE
 * — re-derives the soft alpha from the stored image's OWN (hard-edge)
 * alpha channel every time `featherPx` changes, instead of baking one
 * feather value into the stored file. That's what makes "chỉnh Feather
 * sau khi đặt" (PRD ask) actually work: moving the slider re-renders
 * immediately, and Export (Stage.toDataURL) captures whatever is
 * currently drawn, so it always matches the live preview.
 *
 * featherPx undefined/0 skips all of this and returns the plain decoded
 * image (same as every other image/background/logo layer) — cheaper, and
 * correct since a hard edge IS the stored file's own alpha already.
 */
export function useFeatheredImage(
  url: string | null | undefined,
  featherPx: number | undefined
): HTMLImageElement | HTMLCanvasElement | null {
  const needsFeather = Boolean(featherPx && featherPx > 0);
  const rawImage = useHtmlImage(needsFeather ? null : url);
  const [feathered, setFeathered] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!url || !needsFeather) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing to match url/featherPx going inactive, not a derived recompute
      setFeathered(null);
      return;
    }
    let cancelled = false;
    loadImageData(url)
      .then(({ imageData, canvas }) => {
        if (cancelled) return;
        const baseMask = extractAlphaMask(imageData);
        const softened = featherMask(baseMask, imageData.width, imageData.height, featherPx!);
        for (let i = 0; i < softened.length; i++) imageData.data[i * 4 + 3] = softened[i];
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.putImageData(imageData, 0, 0);
        setFeathered(canvas);
      })
      .catch(() => {
        if (!cancelled) setFeathered(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, featherPx, needsFeather]);

  return needsFeather ? feathered : rawImage;
}
