"use client";

import { useEffect, useRef } from "react";
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Rect, Ellipse, Transformer, Line } from "react-konva";
import type Konva from "konva";
import { useHtmlImage } from "./use-html-image";
import type { ResolvedLayer } from "@/types/design";
import type { SafeZone } from "@/types/database";

const GRID_STEP = 40;

function LayerNode({
  layer,
  registerRef,
  onSelect,
  onChange,
}: {
  layer: ResolvedLayer;
  registerRef: (id: string, node: Konva.Node | null) => void;
  onSelect: () => void;
  onChange: (patch: Partial<ResolvedLayer>) => void;
}) {
  const image = useHtmlImage(layer.imageUrl);

  const common = {
    id: layer.id,
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    draggable: !layer.locked,
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
        fontFamily={layer.fontFamily ?? "Inter"}
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
}) {
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const transformerRef = useRef<Konva.Transformer>(null);

  function registerRef(id: string, node: Konva.Node | null) {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const node = selectedId ? nodeRefs.current.get(selectedId) : null;
    transformer.nodes(node ? [node] : []);
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

  return (
    <Stage
      ref={stageRef}
      width={width * displayScale}
      height={height * displayScale}
      scaleX={displayScale}
      scaleY={displayScale}
      onMouseDown={(e) => {
        if (e.target === e.target.getStage()) onSelect(null);
      }}
      className="bg-white"
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
          />
        ))}
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
