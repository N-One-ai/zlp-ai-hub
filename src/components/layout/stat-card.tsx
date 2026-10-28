import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Small KPI tile for dashboard overviews — every usage must pass a real,
 * already-computed number (never invent a metric the data doesn't
 * support, per the design brief). */
export function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: LucideIcon }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Icon className="size-4.5" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xl font-bold tabular-nums leading-tight">{value}</span>
          <span className="text-xs text-muted-foreground truncate">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}
