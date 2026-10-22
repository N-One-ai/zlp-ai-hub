import type { DesignLayer } from "@/types/database";
import type { GuidelineVersion } from "@/types/brand";
import type { GuidelineCheckResult } from "@/types/design";

/**
 * Pure function, no DOM/Supabase access — every check here is either a
 * real geometric/data comparison against the layer tree, or explicitly
 * absent when there's nothing objective to check (PRD §6 principle #4:
 * "chỉ đánh dấu 'đạt' khi kiểm tra được bằng quy tắc xác định; tiêu chí
 * chủ quan phải ghi là gợi ý/cần xem lại").
 *
 * Which checks BLOCK export is hardcoded to the PRD's own stated default
 * (§8.5: size mismatch and missing logo block; everything else warns
 * only) rather than built as an Admin-configurable setting — that's a
 * deliberate Phase 1 scope cut, documented in README, not an oversight.
 */
export function checkGuideline(
  layers: DesignLayer[],
  canvasWidth: number,
  canvasHeight: number,
  presetWidth: number,
  presetHeight: number,
  guideline: GuidelineVersion | null
): GuidelineCheckResult[] {
  const results: GuidelineCheckResult[] = [];

  // 1. Đúng kích thước
  const sizeOk = canvasWidth === presetWidth && canvasHeight === presetHeight;
  results.push({
    id: "size-match",
    label: "Đúng kích thước",
    severity: sizeOk ? "pass" : "fail",
    reason: sizeOk
      ? `${canvasWidth}×${canvasHeight}px khớp với preset đã chọn.`
      : `Canvas ${canvasWidth}×${canvasHeight}px không khớp preset ${presetWidth}×${presetHeight}px.`,
    blocksExport: true,
  });

  // 2. Logo tồn tại
  const logoLayers = layers.filter((l) => l.type === "logo");
  const hasLogo = logoLayers.length > 0;
  results.push({
    id: "logo-exists",
    label: "Có logo",
    severity: hasLogo ? "pass" : "fail",
    reason: hasLogo ? "Banner có ít nhất một lớp logo." : "Banner chưa có lớp logo nào.",
    blocksExport: true,
  });

  // 3. Logo trong vùng an toàn (chỉ kiểm tra được nếu có logo + guideline có cấu hình safe zone)
  if (hasLogo && guideline) {
    const { topPx = 0, rightPx = 0, bottomPx = 0, leftPx = 0 } = guideline.safeZone;
    const violating = logoLayers.filter(
      (l) => l.x < leftPx || l.y < topPx || l.x + l.width > canvasWidth - rightPx || l.y + l.height > canvasHeight - bottomPx
    );
    results.push({
      id: "logo-safe-zone",
      label: "Logo trong vùng an toàn",
      severity: violating.length === 0 ? "pass" : "review",
      reason:
        violating.length === 0
          ? "Logo nằm trong vùng an toàn đã cấu hình."
          : `${violating.length} lớp logo nằm ngoài vùng an toàn (trên ${topPx}px, phải ${rightPx}px, dưới ${bottomPx}px, trái ${leftPx}px).`,
      blocksExport: false,
    });
  }

  // 4. Màu thuộc cấu hình
  if (guideline && guideline.colors.length > 0) {
    const palette = new Set(guideline.colors.map((c) => c.hex.toLowerCase()));
    const offPaletteLayers = layers.filter((l) => {
      const color = (l.color ?? l.fill)?.toLowerCase();
      return color && !palette.has(color);
    });
    results.push({
      id: "color-palette",
      label: "Màu thuộc bảng màu thương hiệu",
      severity: offPaletteLayers.length === 0 ? "pass" : "review",
      reason:
        offPaletteLayers.length === 0
          ? "Mọi màu dùng trong banner đều thuộc bảng màu thương hiệu."
          : `${offPaletteLayers.length} lớp dùng màu ngoài bảng màu thương hiệu.`,
      blocksExport: false,
    });
  }

  // 5. Font thuộc cấu hình
  if (guideline && (guideline.fonts.heading || guideline.fonts.body)) {
    const allowedFonts = new Set(
      [guideline.fonts.heading?.family, guideline.fonts.body?.family].filter((f): f is string => !!f)
    );
    const textLayers = layers.filter((l) => l.type === "text");
    const offFontLayers = textLayers.filter((l) => l.fontFamily && !allowedFonts.has(l.fontFamily));
    if (textLayers.length > 0) {
      results.push({
        id: "font-match",
        label: "Font thuộc cấu hình thương hiệu",
        severity: offFontLayers.length === 0 ? "pass" : "review",
        reason:
          offFontLayers.length === 0
            ? "Mọi lớp chữ đều dùng font đã cấu hình cho thương hiệu."
            : `${offFontLayers.length} lớp chữ dùng font ngoài cấu hình.`,
        blocksExport: false,
      });
    }
  }

  // 6. Chữ tràn khung
  const textLayers = layers.filter((l) => l.type === "text");
  const overflowingText = textLayers.filter(
    (l) => l.x < 0 || l.y < 0 || l.x + l.width > canvasWidth || l.y + l.height > canvasHeight
  );
  if (textLayers.length > 0) {
    results.push({
      id: "text-overflow",
      label: "Chữ không tràn khung",
      severity: overflowingText.length === 0 ? "pass" : "review",
      reason:
        overflowingText.length === 0
          ? "Mọi lớp chữ nằm trong khung banner."
          : `${overflowingText.length} lớp chữ tràn ra ngoài khung banner.`,
      blocksExport: false,
    });
  }

  // 7. Ảnh nền
  const hasBackground = layers.some((l) => l.type === "background" && !!l.imagePath);
  results.push({
    id: "background-present",
    label: "Có ảnh nền",
    severity: hasBackground ? "pass" : "review",
    reason: hasBackground ? "Banner có ảnh nền." : "Banner chưa có ảnh nền (có thể dùng màu nền thay thế).",
    blocksExport: false,
  });

  return results;
}

export function hasBlockingFailure(results: GuidelineCheckResult[]): boolean {
  return results.some((r) => r.severity === "fail" && r.blocksExport);
}
