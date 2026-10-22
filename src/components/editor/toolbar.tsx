"use client";

import { Type, Square, Circle, Undo2, Redo2, Grid3x3, ShieldCheck, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function EditorToolbar({
  onAddText,
  onAddShape,
  onReplaceBackground,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  showGrid,
  onToggleGrid,
  showSafeZone,
  onToggleSafeZone,
}: {
  onAddText: () => void;
  onAddShape: (kind: "rect" | "ellipse") => void;
  onReplaceBackground: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  showGrid: boolean;
  onToggleGrid: () => void;
  showSafeZone: boolean;
  onToggleSafeZone: () => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap rounded-lg border bg-card p-1.5">
      <Button size="icon-sm" variant="ghost" onClick={onAddText} aria-label="Thêm chữ">
        <Type className="size-4" />
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={() => onAddShape("rect")} aria-label="Thêm hình chữ nhật">
        <Square className="size-4" />
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={() => onAddShape("ellipse")} aria-label="Thêm hình tròn">
        <Circle className="size-4" />
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={onReplaceBackground} aria-label="Thay ảnh nền">
        <ImageIcon className="size-4" />
      </Button>

      <Separator orientation="vertical" className="h-5 mx-1" />

      <Button size="icon-sm" variant="ghost" disabled={!canUndo} onClick={onUndo} aria-label="Hoàn tác">
        <Undo2 className="size-4" />
      </Button>
      <Button size="icon-sm" variant="ghost" disabled={!canRedo} onClick={onRedo} aria-label="Làm lại">
        <Redo2 className="size-4" />
      </Button>

      <Separator orientation="vertical" className="h-5 mx-1" />

      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onToggleGrid}
        aria-label="Hiện/ẩn lưới"
        className={cn(showGrid && "bg-accent text-accent-foreground")}
      >
        <Grid3x3 className="size-4" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onToggleSafeZone}
        aria-label="Hiện/ẩn vùng an toàn"
        className={cn(showSafeZone && "bg-accent text-accent-foreground")}
      >
        <ShieldCheck className="size-4" />
      </Button>
    </div>
  );
}
