import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { BrandReadiness } from "@/types/brand";

/** Which tab each missing item should jump to when BrandReadinessBanner
 * is used inside BrandDetailTabs (onNavigate wired to tab state) — logo/
 * colors/fonts live in the Guideline tab, size presets in their own tab. */
const CHECKS: { key: keyof Omit<BrandReadiness, "isReady">; label: string; tab: string }[] = [
  { key: "hasLogo", label: "Logo chính", tab: "guideline" },
  { key: "hasColors", label: "Bảng màu", tab: "guideline" },
  { key: "hasFonts", label: "Font", tab: "guideline" },
  { key: "hasSizePreset", label: "Preset kích thước", tab: "presets" },
];

/** Only ever computed from real stored data (see computeBrandReadiness)
 * — never a guessed or hard-coded "looks ready" state. When onNavigate is
 * given (brand detail page), each missing item is a button that jumps to
 * the tab where it can actually be fixed. */
export function BrandReadinessBanner({
  readiness,
  onNavigate,
}: {
  readiness: BrandReadiness;
  onNavigate?: (tab: string) => void;
}) {
  if (readiness.isReady) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-4 shrink-0" />
        Thương hiệu đã sẵn sàng để tạo ảnh/banner.
      </div>
    );
  }

  const missing = CHECKS.filter((c) => !readiness[c.key]);

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-600/30 bg-amber-600/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
      <span className="flex flex-wrap items-center gap-x-1">
        <span>Chưa đủ cấu hình để sử dụng:</span>
        {missing.map((c, i) => (
          <span key={c.key}>
            {onNavigate ? (
              <button
                type="button"
                onClick={() => onNavigate(c.tab)}
                className="font-medium underline underline-offset-2 hover:text-amber-600 dark:hover:text-amber-300"
              >
                {c.label}
              </button>
            ) : (
              <span className="font-medium">{c.label}</span>
            )}
            {i < missing.length - 1 ? "," : "."}
          </span>
        ))}
      </span>
    </div>
  );
}
