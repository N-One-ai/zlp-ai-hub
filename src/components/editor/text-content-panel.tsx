"use client";

import { Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TextAlignColorControls } from "./text-align-color-controls";
import type { TextAlign, BrandColor } from "@/types/database";

/** "Nội dung chữ" — a dedicated Tagline/Subtitle panel, separate from the
 * generic "Thêm chữ" tool: typing here creates/updates exactly ONE text
 * layer per role (DesignLayer.role), so there's always a single, findable
 * tagline and a single subtitle rather than an arbitrary pile of text
 * layers. Each field has its OWN align + color controls right here
 * (patched straight onto that role's own layer — see editor-shell.tsx),
 * so adjusting the Tagline never touches the Subtitle's layer and vice
 * versa. Full styling (font/size/weight/line-height/letter-spacing) is
 * still done through the existing TextProperties panel once a layer here
 * is selected (pencil icon) — this panel only owns content + the two
 * quick properties the brief calls out, so they don't require selecting
 * the layer and scrolling to a different card first. */
export function TextContentPanel({
  taglineText,
  subtitleText,
  onChangeTagline,
  onChangeSubtitle,
  onSelectTagline,
  onSelectSubtitle,
  taglineExists,
  subtitleExists,
  taglineAlign,
  taglineColor,
  subtitleAlign,
  subtitleColor,
  onChangeTaglineAlign,
  onChangeTaglineColor,
  onChangeSubtitleAlign,
  onChangeSubtitleColor,
  guidelineColors = [],
}: {
  taglineText: string;
  subtitleText: string;
  onChangeTagline: (text: string) => void;
  onChangeSubtitle: (text: string) => void;
  onSelectTagline: () => void;
  onSelectSubtitle: () => void;
  taglineExists: boolean;
  subtitleExists: boolean;
  taglineAlign: TextAlign;
  taglineColor: string;
  subtitleAlign: TextAlign;
  subtitleColor: string;
  onChangeTaglineAlign: (align: TextAlign) => void;
  onChangeTaglineColor: (color: string) => void;
  onChangeSubtitleAlign: (align: TextAlign) => void;
  onChangeSubtitleColor: (color: string) => void;
  guidelineColors?: BrandColor[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Tagline</Label>
          {taglineExists && (
            <Button size="icon-xs" variant="ghost" onClick={onSelectTagline} aria-label="Chọn lớp Tagline để chỉnh kiểu chữ đầy đủ">
              <Pencil className="size-3" />
            </Button>
          )}
        </div>
        <Input value={taglineText} onChange={(e) => onChangeTagline(e.target.value)} placeholder="Nhập tagline..." />
        <TextAlignColorControls
          align={taglineAlign}
          color={taglineColor}
          onChangeAlign={onChangeTaglineAlign}
          onChangeColor={onChangeTaglineColor}
          guidelineColors={guidelineColors}
          disabled={!taglineExists}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Subtitle</Label>
          {subtitleExists && (
            <Button size="icon-xs" variant="ghost" onClick={onSelectSubtitle} aria-label="Chọn lớp Subtitle để chỉnh kiểu chữ đầy đủ">
              <Pencil className="size-3" />
            </Button>
          )}
        </div>
        <Input value={subtitleText} onChange={(e) => onChangeSubtitle(e.target.value)} placeholder="Nhập subtitle..." />
        <TextAlignColorControls
          align={subtitleAlign}
          color={subtitleColor}
          onChangeAlign={onChangeSubtitleAlign}
          onChangeColor={onChangeSubtitleColor}
          guidelineColors={guidelineColors}
          disabled={!subtitleExists}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Mỗi ô tạo một lớp chữ riêng trên canvas — căn lề/màu áp dụng ngay cho đúng lớp đó. Bấm biểu tượng bút để chọn
        lớp và chỉnh font, cỡ chữ, độ đậm, khoảng cách dòng ở mục &ldquo;Thuộc tính chữ&rdquo;. Kéo thả trực tiếp trên
        canvas để đổi vị trí.
      </p>
    </div>
  );
}
