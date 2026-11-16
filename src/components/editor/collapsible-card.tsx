"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";

/**
 * A sidebar section that can be collapsed/expanded — used for every
 * "Thiết lập/Lớp/Logo/Nội dung chữ/Elements/Kiểm tra guideline" group in
 * the banner editor's side panel so the panel's TOTAL height stays
 * manageable (PRD ask: "giữ các nhóm thiết lập có thể thu gọn/mở rộng")
 * instead of every section always being fully expanded and forcing a long
 * scroll. Built on the existing Collapsible primitive (base-ui) + the
 * existing Card — not a new design system, just composing the two.
 */
export function CollapsibleCard({
  title,
  description,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string;
  description?: string;
  /** Whether this section starts expanded — frequently-used sections
   * (Nội dung chữ, Lớp, Kiểm tra guideline) default to true; one-time-
   * setup sections (Thiết lập banner, Logo, Elements) default to false. */
  defaultOpen?: boolean;
  /** Small trailing indicator next to the title, shown even while
   * collapsed (e.g. a layer count or a guideline pass/fail summary) —
   * lets the user see at a glance whether a collapsed section needs
   * attention without having to open it first. */
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card size="sm" className="shrink-0">
      <Collapsible defaultOpen={defaultOpen}>
        <CardHeader>
          <CollapsibleTrigger className="cursor-pointer">
            <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
              <div className="flex flex-col gap-0.5 min-w-0 text-left">
                <CardTitle className="text-sm truncate">{title}</CardTitle>
                {description && <CardDescription className="text-xs">{description}</CardDescription>}
              </div>
              {badge}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsiblePanel>
          <CardContent className="pt-3">{children}</CardContent>
        </CollapsiblePanel>
      </Collapsible>
    </Card>
  );
}
