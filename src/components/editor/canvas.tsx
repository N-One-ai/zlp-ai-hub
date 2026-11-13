"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Rect, Ellipse, Transformer, Line } from "react-konva";
import type Konva from "konva";
import { useFeatheredImage, useFrameFeatheredImage } from "./use-feathered-image";
import { computeCoverCrop } from "@/lib/design/resize";
import type { ResolvedLayer } from "@/types/design";
import type { SafeZone } from "@/types/database";

const GRID_STEP = 40;

function LayerNode({
  layer,
  registerRef,
  onSelect,
  onChange,
  interactionDisabled,
}: {
  layer: ResolvedLayer;
  registerRef: (id: string, node: Konva.Node | null) => void;
  onSelect: () => void;
  onChange: (patch: Partial<ResolvedLayer>) => void;
  /** True while the "Vùng tạo ảnh AI" draw tool is active — existing
   * layers must not be draggable then, or starting a drag gesture over
   * one would move it instead of drawing a new region. */
  interactionDisabled: boolean;
}) {
  const isAiRegion = layer.type === "ai-region";
  const alphaFeathered = useFeatheredImage(isAiRegion ? null : layer.imageUrl, layer.featherPx);
  const frameFeathered = useFrameFeatheredImage(isAiRegion ? layer.imageUrl : null, layer.featherPx);
  const image = isAiRegion ? frameFeathered : alphaFeathered;
  if (layer.visible === false) return null;

  const common = {
    id: layer.id,
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    draggable: !layer.locked && !interactionDisabled,
    onClick: onSelect,
    onTap: onSelect,
    ref: (node: Konva.Node | null) => registerRef(layer.id, node),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      onChange({ x: e.target.x(), y: e.target.y() });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Node;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onChange({
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: Math.max(8, layer.width * scaleX),
        height: Math.max(8, layer.height * scaleY),
      });
    },
  };

  if (layer.type === "text") {
    return (
      <KonvaText
        {...common}
        width={layer.width}
        height={layer.height}
        text={layer.text ?? ""}
        fontFamily={`${layer.fontFamily ?? "Aeonik Pro"}, ${layer.fontFallback ?? "sans-serif"}`}
        fontSize={layer.fontSize ?? 24}
        fontStyle={layer.fontWeight && layer.fontWeight >= 600 ? "bold" : "normal"}
        fill={layer.color ?? "#000000"}
        align={layer.align ?? "left"}
        lineHeight={layer.lineHeight ?? 1.2}
        letterSpacing={layer.letterSpacing ?? 0}
      />
    );
  }

  if (layer.type === "shape") {
    if (layer.shapeKind === "ellipse") {
      return (
        <Ellipse
          {...common}
          radiusX={layer.width / 2}
          radiusY={layer.height / 2}
          offsetX={-layer.width / 2}
          offsetY={-layer.height / 2}
          fill={layer.fill ?? "#cccccc"}
        />
      );
    }
    return <Rect {...common} width={layer.width} height={layer.height} fill={layer.fill ?? "#cccccc"} />;
  }

  // background / image / logo — all render as an image if loaded, else a
  // neutral placeholder rect so an empty background/logo slot is still
  // visible and selectable.
  if (image) {
    // The background layer's destination box is whatever the current
    // size preset is — it must never stretch the source image to fit a
    // different aspect ratio, so it's drawn with a live "cover fit" crop
    // (CSS object-fit: cover equivalent) computed from the image's real
    // decoded size every render, not a stretch. image.width/height equal
    // the natural pixel size here since this <img>/<canvas> never has
    // its width/height attributes set (see use-html-image.ts).
    if (layer.type === "background" || isAiRegion) {
      // Same "cover fit, never stretched" crop as the background layer —
      // for an ai-region, the box IS the clip boundary (see this
      // function's doc comment in use-feathered-image.ts): drawing at
      // exactly layer.width×layer.height already guarantees the image
      // never spills past the region, independent of the feather above.
      const crop = computeCoverCrop(image.width, image.height, layer.width, layer.height, layer.focalX ?? 0.5, layer.focalY ?? 0.5);
      return <KonvaImage {...common} image={image} width={layer.width} height={layer.height} crop={crop} />;
    }
    return <KonvaImage {...common} image={image} width={layer.width} height={layer.height} />;
  }
  return (
    <Rect
      {...common}
      width={layer.width}
      height={layer.height}
      fill={layer.type === "background" ? "#f5f5f4" : "#e7e5e4"}
      stroke="#d6d3d1"
      dash={[6, 4]}
    />
  );
}

export function EditorCanvas({
  layers,
  width,
  height,
  displayScale,
  selectedId,
  onSelect,
  onChangeLayer,
  showGrid,
  showSafeZone,
  safeZone,
  stageRef,
  drawingAiRegion = false,
  onDrawAiRegion,
}: {
  layers: ResolvedLayer[];
  width: number;
  height: number;
  displayScale: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChangeLayer: (id: string, patch: Partial<ResolvedLayer>) => void;
  showGrid: boolean;
  showSafeZone: boolean;
  safeZone: SafeZone;
  stageRef: React.RefObject<Konva.Stage | null>;
  /** True while the "Vùng tạo ảnh AI" tool is active — the next
   * drag-on-empty-canvas draws a new region instead of panning/selecting. */
  drawingAiRegion?: boolean;
  onDrawAiRegion?: (rect: { x: number; y: number; width: number; height: number }) => void;
}) {
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const transformerRef = useRef<Konva.Transformer>(null);
  const draftStartRef = useRef<{ x: number; y: number } | null>(null);
  const [draftRect, setDraftRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  function registerRef(id: string, node: Konva.Node | null) {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const node = selectedId ? nodeRefs.current.get(selectedId) : null;
    transformer.nodes(node ? [node] : []);
    // The logo must never come out stretched, including from a manual
    // drag-resize: lock it to corner anchors only and force
    // scaleX === scaleY (keepRatio), so independently resizing just the
    // width or just the height is not possible for this layer type.
    const layer = selectedId ? layers.find((l) => l.id === selectedId) : null;
    if (layer?.type === "logo") {
      transformer.keepRatio(true);
      transformer.enabledAnchors(["top-left", "top-right", "bottom-left", "bottom-right"]);
    } else {
      transformer.keepRatio(false);
      transformer.enabledAnchors(["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"]);
    }
    transformer.getLayer()?.batchDraw();
  }, [selectedId, layers]);

  const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
  const { topPx = 0, rightPx = 0, bottomPx = 0, leftPx = 0 } = safeZone;

  const gridLines = [];
  if (showGrid) {
    for (let x = GRID_STEP; x < width; x += GRID_STEP) {
      gridLines.push(<Line key={`v${x}`} points={[x, 0, x, height]} stroke="#e7e5e4" strokeWidth={1} />);
    }
    for (let y = GRID_STEP; y < height; y += GRID_STEP) {
      gridLines.push(<Line key={`h${y}`} points={[0, y, width, y]} stroke="#e7e5e4" strokeWidth={1} />);
    }
  }

  function clampPoint(x: number, y: number) {
    return { x: Math.min(Math.max(x, 0), width), y: Math.min(Math.max(y, 0), height) };
  }

  return (
    <Stage
      ref={stageRef}
      width={width * displayScale}
      height={height * displayScale}
      scaleX={displayScale}
      scaleY={displayScale}
      className={drawingAiRegion ? "bg-white cursor-crosshair" : "bg-white"}
      onMouseDown={(e) => {
        if (drawingAiRegion) {
          const pos = e.target.getStage()?.getPointerPosition();
          if (!pos) return;
          const start = clampPoint(pos.x, pos.y);
          draftStartRef.current = start;
          setDraftRect({ x: start.x, y: start.y, width: 0, height: 0 });
          return;
        }
        if (e.target === e.target.getStage()) onSelect(null);
      }}
      onMouseMove={(e) => {
        if (!drawingAiRegion || !draftStartRef.current) return;
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;
        const current = clampPoint(pos.x, pos.y);
        const start = draftStartRef.current;
        setDraftRect({
          x: Math.min(start.x, current.x),
          y: Math.min(start.y, current.y),
          width: Math.abs(current.x - start.x),
          height: Math.abs(current.y - start.y),
        });
      }}
      onMouseUp={() => {
        if (!drawingAiRegion || !draftStartRef.current) return;
        draftStartRef.current = null;
        const rect = draftRect;
        setDraftRect(null);
        if (rect && rect.width >= 16 && rect.height >= 16) {
          onDrawAiRegion?.({
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      }}
    >
      <Layer>
        <Rect x={0} y={0} width={width} height={height} fill="#ffffff" listening={false} />
        {gridLines}
        {sorted.map((layer) => (
          <LayerNode
            key={layer.id}
            layer={layer}
            registerRef={registerRef}
            onSelect={() => onSelect(layer.id)}
            onChange={(patch) => onChangeLayer(layer.id, patch)}
            interactionDisabled={drawingAiRegion}
          />
        ))}
        {draftRect && (
          <Rect
            x={draftRect.x}
            y={draftRect.y}
            width={draftRect.width}
            height={draftRect.height}
            stroke="#f97316"
            strokeWidth={2}
            dash={[8, 6]}
            fill="rgba(249,115,22,0.1)"
            listening={false}
          />
        )}
        {showSafeZone && (
          <Rect
            x={leftPx}
            y={topPx}
            width={width - leftPx - rightPx}
            height={height - topPx - bottomPx}
            stroke="#f59e0b"
            strokeWidth={2}
            dash={[8, 6]}
            listening={false}
          />
        )}
        <Transformer ref={transformerRef} rotateEnabled flipEnabled={false} />
      </Layer>
    </Stage>
  );
}
