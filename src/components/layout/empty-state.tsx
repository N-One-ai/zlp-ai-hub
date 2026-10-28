import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Consistent "nothing here yet" treatment — always icon + heading +
 * explanation + an actionable next step, never a bare placeholder icon
 * (per the design brief: "không để card trống hoặc chỉ hiện icon
 * placeholder"). Reused across Dashboard, Thư viện, Thương hiệu. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-sm">{description}</p>
        </div>
        {action && <div className="flex items-center gap-2 mt-1">{action}</div>}
      </CardContent>
    </Card>
  );
}
