import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { GuidelineCheckResult } from "@/types/design";

const SEVERITY_ICON = { pass: CheckCircle2, review: AlertTriangle, fail: XCircle } as const;
const SEVERITY_CLASS = {
  pass: "text-emerald-600",
  review: "text-amber-600",
  fail: "text-destructive",
} as const;
const SEVERITY_LABEL = { pass: "Đạt", review: "Cần xem lại", fail: "Không đạt" } as const;

export function GuidelinePanel({ results }: { results: GuidelineCheckResult[] }) {
  return (
    <div className="flex flex-col gap-2">
      {results.map((r) => {
        const Icon = SEVERITY_ICON[r.severity];
        return (
          <div key={r.id} className="flex items-start gap-2 text-sm">
            <Icon className={`size-4 shrink-0 mt-0.5 ${SEVERITY_CLASS[r.severity]}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium">{r.label}</span>
                <span className={`text-xs ${SEVERITY_CLASS[r.severity]}`}>{SEVERITY_LABEL[r.severity]}</span>
                {r.severity === "fail" && r.blocksExport && (
                  <span className="text-xs text-muted-foreground">(chặn xuất)</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{r.reason}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
