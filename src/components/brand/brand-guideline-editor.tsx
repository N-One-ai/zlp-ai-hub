"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoUploader, EMPTY_LOGO_FIELD, type LogoFieldValue } from "./logo-uploader";
import { ColorListEditor } from "./color-list-editor";
import { AVAILABLE_FONTS } from "@/lib/brand/fonts";
import { saveGuideline } from "@/lib/brand/actions";
import type { GuidelineVersion } from "@/types/brand";
import type { BrandColor, FontChoice, LogoBackground } from "@/types/database";

function toFontValue(f?: FontChoice): string {
  return f ? f.family : "";
}
function fromFontValue(family: string): FontChoice | undefined {
  if (!family) return undefined;
  const found = AVAILABLE_FONTS.find((f) => f.family === family);
  return found ? { family: found.family, fallback: found.fallback } : undefined;
}

export function BrandGuidelineEditor({
  workspaceId,
  brandId,
  guideline,
}: {
  workspaceId: string;
  brandId: string;
  guideline: GuidelineVersion | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [logoPrimary, setLogoPrimary] = useState<LogoFieldValue>(
    guideline?.logos.primaryUrl
      ? { path: guideline.logos.primaryPath, previewUrl: guideline.logos.primaryUrl, isNew: false }
      : EMPTY_LOGO_FIELD
  );
  const [logoSecondary, setLogoSecondary] = useState<LogoFieldValue>(
    guideline?.logos.secondaryUrl
      ? { path: guideline.logos.secondaryPath, previewUrl: guideline.logos.secondaryUrl, isNew: false }
      : EMPTY_LOGO_FIELD
  );
  const [logoLight, setLogoLight] = useState<LogoFieldValue>(
    guideline?.logos.lightUrl
      ? { path: guideline.logos.lightPath, previewUrl: guideline.logos.lightUrl, isNew: false }
      : EMPTY_LOGO_FIELD
  );
  const [logoDark, setLogoDark] = useState<LogoFieldValue>(
    guideline?.logos.darkUrl
      ? { path: guideline.logos.darkPath, previewUrl: guideline.logos.darkUrl, isNew: false }
      : EMPTY_LOGO_FIELD
  );

  const [colors, setColors] = useState<BrandColor[]>(guideline?.colors ?? []);
  const [headingFont, setHeadingFont] = useState(toFontValue(guideline?.fonts.heading) || "Aeonik Pro");
  const [bodyFont, setBodyFont] = useState(toFontValue(guideline?.fonts.body) || "Aeonik Pro");

  const [safeTop, setSafeTop] = useState(guideline?.safeZone.topPx?.toString() ?? "");
  const [safeRight, setSafeRight] = useState(guideline?.safeZone.rightPx?.toString() ?? "");
  const [safeBottom, setSafeBottom] = useState(guideline?.safeZone.bottomPx?.toString() ?? "");
  const [safeLeft, setSafeLeft] = useState(guideline?.safeZone.leftPx?.toString() ?? "");
  const [safeNotes, setSafeNotes] = useState(guideline?.safeZone.notes ?? "");

  const [minSize, setMinSize] = useState(guideline?.logoRules.minSizePx?.toString() ?? "");
  const [clearSpace, setClearSpace] = useState(guideline?.logoRules.clearSpacePx?.toString() ?? "");
  const [backgrounds, setBackgrounds] = useState<LogoBackground>(guideline?.logoRules.acceptableBackgrounds ?? "either");

  const [layoutNotes, setLayoutNotes] = useState(guideline?.layoutNotes ?? "");

  function toNumberOrUndefined(v: string): number | undefined {
    const n = Number(v);
    return v.trim() !== "" && Number.isFinite(n) ? n : undefined;
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;

    startTransition(async () => {
      const result = await saveGuideline(brandId, {
        logoPrimaryPath: logoPrimary.previewUrl ? logoPrimary.path : null,
        logoSecondaryPath: logoSecondary.previewUrl ? logoSecondary.path : null,
        logoLightPath: logoLight.previewUrl ? logoLight.path : null,
        logoDarkPath: logoDark.previewUrl ? logoDark.path : null,
        colors,
        fonts: { heading: fromFontValue(headingFont), body: fromFontValue(bodyFont) },
        safeZone: {
          topPx: toNumberOrUndefined(safeTop),
          rightPx: toNumberOrUndefined(safeRight),
          bottomPx: toNumberOrUndefined(safeBottom),
          leftPx: toNumberOrUndefined(safeLeft),
          notes: safeNotes,
        },
        logoRules: {
          minSizePx: toNumberOrUndefined(minSize),
          clearSpacePx: toNumberOrUndefined(clearSpace),
          acceptableBackgrounds: backgrounds,
        },
        layoutNotes,
      });

      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Đã lưu guideline (phiên bản mới).");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <LogoUploader workspaceId={workspaceId} brandId={brandId} variant="primary" value={logoPrimary} onChange={setLogoPrimary} />
          <LogoUploader workspaceId={workspaceId} brandId={brandId} variant="secondary" value={logoSecondary} onChange={setLogoSecondary} />
          <LogoUploader workspaceId={workspaceId} brandId={brandId} variant="light" value={logoLight} onChange={setLogoLight} />
          <LogoUploader workspaceId={workspaceId} brandId={brandId} variant="dark" value={logoDark} onChange={setLogoDark} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bảng màu</CardTitle>
        </CardHeader>
        <CardContent>
          <ColorListEditor colors={colors} onChange={setColors} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Font</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Font tiêu đề (heading)</Label>
            <Select value={headingFont} onValueChange={(v) => setHeadingFont(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn font" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_FONTS.map((f) => (
                  <SelectItem key={f.family} value={f.family}>
                    {f.family}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Font nội dung (body)</Label>
            <Select value={bodyFont} onValueChange={(v) => setBodyFont(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn font" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_FONTS.map((f) => (
                  <SelectItem key={f.family} value={f.family}>
                    {f.family}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vùng an toàn & quy tắc logo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Trên (px)</Label>
              <Input type="number" min={0} value={safeTop} onChange={(e) => setSafeTop(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Phải (px)</Label>
              <Input type="number" min={0} value={safeRight} onChange={(e) => setSafeRight(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Dưới (px)</Label>
              <Input type="number" min={0} value={safeBottom} onChange={(e) => setSafeBottom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Trái (px)</Label>
              <Input type="number" min={0} value={safeLeft} onChange={(e) => setSafeLeft(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Ghi chú vùng an toàn</Label>
            <Textarea rows={2} value={safeNotes} onChange={(e) => setSafeNotes(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Kích thước tối thiểu logo (px)</Label>
              <Input type="number" min={0} value={minSize} onChange={(e) => setMinSize(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Khoảng an toàn quanh logo (px)</Label>
              <Input type="number" min={0} value={clearSpace} onChange={(e) => setClearSpace(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Nền phù hợp</Label>
              <Select value={backgrounds} onValueChange={(v) => setBackgrounds(v as LogoBackground)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Nền sáng</SelectItem>
                  <SelectItem value="dark">Nền tối</SelectItem>
                  <SelectItem value="either">Cả hai</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ghi chú bố cục</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            value={layoutNotes}
            onChange={(e) => setLayoutNotes(e.target.value)}
            placeholder="Hướng dẫn bằng văn bản về quy tắc bố cục..."
          />
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Lưu guideline
      </Button>
    </form>
  );
}
