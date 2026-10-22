"use client";

import { useEffect, useState } from "react";

/** Minimal "load a URL into an HTMLImageElement for Konva" hook — avoids
 * adding the `use-image` npm package for what's a ~15-line browser API
 * call. Konva.Image needs a real loaded HTMLImageElement, not just a URL
 * string. */
export function useHtmlImage(url: string | null | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing to match the url prop going null; no external subscription applies here
      setImage(null);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setImage(null);
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  return image;
}
