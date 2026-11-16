"use client";

import { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { EditorCanvas } from "./canvas";
import type { ResolvedLayer } from "@/types/design";

function noopSelect() {}
function noopChange() {}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve();
    // Never block the whole render on one broken image — the stage
    // still renders everything else, same as the real editor would.
    img.onerror = () => resolve();
    img.src = url;
  });
}

function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    function tick(remaining: number) {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => tick(remaining - 1));
    }
    tick(n);
  });
}

/**
 * Renders a banner layout OFF-SCREEN — absolutely positioned far outside
 * the viewport, never visible to the user — using the SAME `<EditorCanvas>`
 * + Konva `Stage.toDataURL()` the real editor's own "Xuất" button already
 * uses. Reused here (see adapt-sizes-dialog.tsx / banner-variants-panel.tsx)
 * to produce size-variant thumbnails and per-variant exports WITHOUT ever
 * opening that variant's own editor page.
 *
 * Every referenced image is preloaded first (so EditorCanvas's own
 * `useHtmlImage` hook resolves from the browser cache instead of racing a
 * fresh network fetch) and a few animation frames are awaited afterward
 * for Konva to actually paint — only THEN is the live Stage handed to
 * `onReady`, exactly once. The caller must read whatever it needs from
 * the Stage (toDataURL()) synchronously inside `onReady`, since this
 * component does not keep rendering forever — the parent is expected to
 * stop rendering it once `onReady` fires.
 */
export function OffscreenBannerStage({
  layers,
  width,
  height,
  scale = 1,
  onReady,
}: {
  layers: ResolvedLayer[];
  width: number;
  height: number;
  /** Display scale passed straight to EditorCanvas — 1 for a full-
   * resolution export render, a smaller fraction (e.g. 0.3) for a cheap
   * list thumbnail. */
  scale?: number;
  onReady: (stage: Konva.Stage) => void;
}) {
  const stageRef = useRef<Konva.Stage>(null);
  const [ready, setReady] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const urls = [...new Set(layers.map((l) => l.imageUrl).filter((u): u is string => Boolean(u)))];
    Promise.all(urls.map(preloadImage))
      .then(() => waitFrames(4))
      .then(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [layers]);

  useEffect(() => {
    if (!ready || firedRef.current || !stageRef.current) return;
    firedRef.current = true;
    onReady(stageRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires exactly once, the moment `ready` flips true
  }, [ready]);

  return (
    <div style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }} aria-hidden="true">
      <EditorCanvas
        layers={layers}
        width={width}
        height={height}
        displayScale={scale}
        selectedId={null}
        onSelect={noopSelect}
        onChangeLayer={noopChange}
        showGrid={false}
        showSafeZone={false}
        safeZone={{}}
        stageRef={stageRef}
      />
    </div>
  );
}
