"use client";

import { Image as ImageIcon, Type, Shapes, Lock, Unlock, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResolvedLayer } from "@/types/design";

const LAYER_ICON = { background: ImageIcon, image: ImageIcon, logo: ImageIcon, text: Type, shape: Shapes } as const;
const LAYER_LABEL: Record<ResolvedLayer["type"], string> = {
  background: "Nền",
  image: "Ảnh",
  logo: "Logo",
  text: "Chữ",
  shape: "Hình khối",
};

export function LayerPanel({
  layers,
  selectedId,
  onSelect,
  onToggleLock,
  onToggleVisible,
  onDelete,
  onReorder,
}: {
  layers: ResolvedLayer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
}) {
  const sorted = [...layers].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div className="flex flex-col gap-1">
      {sorted.map((layer, i) => {
        const Icon = LAYER_ICON[layer.type];
        return (
          <div
            key={layer.id}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer",
              layer.id === selectedId ? "bg-accent" : "hover:bg-accent/50"
            )}
            onClick={() => onSelect(layer.id)}
          >
            <Icon className="size-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1 min-w-0 truncate">
              {layer.type === "text" ? layer.text || "Chữ" : LAYER_LABEL[layer.type]}
            </span>
            <Button
              size="icon-xs"
              variant="ghost"
              disabled={i === 0}
              onClick={(e) => {
                e.stopPropagation();
                onReorder(layer.id, "up");
              }}
            >
              <ChevronUp className="size-3" />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              disabled={i === sorted.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                onReorder(layer.id, "down");
              }}
            >
              <ChevronDown className="size-3" />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisible(layer.id);
              }}
            >
              {layer.visible === false ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(layer.id);
              }}
            >
              {layer.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
            </Button>
            {layer.type !== "background" && (
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(layer.id);
                }}
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        );
      })}
      {sorted.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1.5">Chưa có lớp nào.</p>}
    </div>
  );
}
