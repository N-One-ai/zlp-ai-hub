"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUTO_MODEL_ID, type ModelMeta } from "@/lib/generation/model-meta";

const STORAGE_KEY = "creative-hub:last-image-model";

/** AI model select for the image-generation flows (Tạo ảnh, and the new
 * "Tạo bằng AI" background step in Tạo banner). `models` is the server-
 * resolved list of CONFIGURED models only (via listAvailableModels() —
 * env vars are never read client-side); "Tự động chọn model" is always
 * offered and means "let the fallback chain decide". Remembers the last
 * explicit pick per browser via localStorage — a per-viewer convenience,
 * never relied on for anything the server needs to know authoritatively. */
export function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: ModelMeta[];
  value: string;
  onChange: (modelId: string) => void;
}) {
  const triedHydration = useRef(false);

  useEffect(() => {
    if (triedHydration.current) return;
    triedHydration.current = true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === AUTO_MODEL_ID || models.some((m) => m.id === saved))) {
        onChange(saved);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — fall back silently to the default value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  function handleChange(id: string) {
    onChange(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore — remembering the choice is a convenience, not a requirement
    }
  }

  const selected = value === AUTO_MODEL_ID ? null : models.find((m) => m.id === value);

  return (
    <Select value={value} onValueChange={(v) => v && handleChange(v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Chọn model">
          {() =>
            selected ? (
              <span className="flex items-center gap-1.5 truncate">{selected.label}</span>
            ) : (
              <span className="flex items-center gap-1.5 truncate">
                <Sparkles className="size-3.5 text-muted-foreground" />
                Tự động chọn model
              </span>
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={AUTO_MODEL_ID}>
          <span className="flex flex-col py-0.5">
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              Tự động chọn model
            </span>
            <span className="text-xs text-muted-foreground">Hệ thống tự chọn model phù hợp, có dự phòng khi lỗi.</span>
          </span>
        </SelectItem>
        {models.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            <span className="flex flex-col py-0.5">
              <span>{m.label}</span>
              <span className="text-xs text-muted-foreground">{m.description}</span>
            </span>
          </SelectItem>
        ))}
        {models.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Chưa có model AI nào được cấu hình — đang dùng ảnh minh hoạ (Demo).
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
