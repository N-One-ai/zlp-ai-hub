import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { BrandReadiness } from "@/types/brand";

const CHECKS: { key: keyof Omit<BrandReadiness, "isReady">; label: string }[] = [
  { key: "hasLogo", label: "Logo chính" },
  { key: "hasColors", label: "Bảng màu" },
  { key: "hasFonts", label: "Font" },
  { key: "hasSizePreset", label: "Preset kích thước" },
];

/** Only ever computed from real stored data (see computeBrandReadiness)
 * — never a guessed or hard-coded "looks ready" state. */
export function BrandReadinessBanner({ readiness }: { readiness: BrandReadiness }) {
  if (readiness.isReady) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-4 shrink-0" />
        Thương hiệu đã sẵn sàng để tạo ảnh/banner.
      </div>
    );
  }

  const missing = CHECKS.filter((c) => !readiness[c.key]).map((c) => c.label);

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-600/30 bg-amber-600/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
      <span>Chưa đủ cấu hình để sử dụng: {missing.join(", ")}.</span>
    </div>
  );
}
