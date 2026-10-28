"use client";

import { Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** "Nội dung chữ" — a dedicated Tagline/Subtitle panel, separate from the
 * generic "Thêm chữ" tool: typing here creates/updates exactly ONE text
 * layer per role (DesignLayer.role), so there's always a single, findable
 * tagline and a single subtitle rather than an arbitrary pile of text
 * layers. Per-layer styling (font/size/color/weight/align/spacing) is
 * still done through the existing TextProperties panel once a layer here
 * is selected — this panel only owns content + which layer is "the
 * tagline" vs "the subtitle". */
export function TextContentPanel({
  taglineText,
  subtitleText,
  onChangeTagline,
  onChangeSubtitle,
  onSelectTagline,
  onSelectSubtitle,
  taglineExists,
  subtitleExists,
}: {
  taglineText: string;
  subtitleText: string;
  onChangeTagline: (text: string) => void;
  onChangeSubtitle: (text: string) => void;
  onSelectTagline: () => void;
  onSelectSubtitle: () => void;
  taglineExists: boolean;
  subtitleExists: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Tagline</Label>
          {taglineExists && (
            <Button size="icon-xs" variant="ghost" onClick={onSelectTagline} aria-label="Chọn lớp Tagline để chỉnh kiểu chữ">
              <Pencil className="size-3" />
            </Button>
          )}
        </div>
        <Input value={taglineText} onChange={(e) => onChangeTagline(e.target.value)} placeholder="Nhập tagline..." />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Subtitle</Label>
          {subtitleExists && (
            <Button size="icon-xs" variant="ghost" onClick={onSelectSubtitle} aria-label="Chọn lớp Subtitle để chỉnh kiểu chữ">
              <Pencil className="size-3" />
            </Button>
          )}
        </div>
        <Input value={subtitleText} onChange={(e) => onChangeSubtitle(e.target.value)} placeholder="Nhập subtitle..." />
      </div>

      <p className="text-xs text-muted-foreground">
        Mỗi ô tạo một lớp chữ riêng trên canvas — bấm biểu tượng bút để chọn lớp và chỉnh font, cỡ chữ, màu, độ đậm, căn
        lề, khoảng cách dòng ở mục &ldquo;Thuộc tính chữ&rdquo;. Kéo thả trực tiếp trên canvas để đổi vị trí.
      </p>
    </div>
  );
}
