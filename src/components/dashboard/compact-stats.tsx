import type { LucideIcon } from "lucide-react";

export interface CompactStatItem {
  label: string;
  value: number | string;
  icon: LucideIcon;
}

/** Small, muted KPI row next to the workspace title — deliberately lower
 * visual weight than StatCard's full Card chrome (no background/border
 * box per item), since these now sit beside the page's own heading
 * rather than as their own section. Wraps onto its own line below the
 * title when there isn't room beside it (flex-wrap on the parent), and
 * scrolls horizontally on narrow screens instead of wrapping per-item or
 * overflowing the viewport. */
export function CompactStats({ items }: { items: CompactStatItem[] }) {
  return (
    <div className="-mx-1 flex min-w-0 items-center gap-4 overflow-x-auto px-1 sm:mx-0 sm:gap-5 sm:px-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      {items.map((item, i) => (
        <div key={item.label} className="flex shrink-0 items-center gap-3">
          {i > 0 && <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden="true" />}
          <div className="flex shrink-0 items-center gap-1.5">
            <item.icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-semibold tabular-nums">{item.value}</span>
            <span className="text-xs whitespace-nowrap text-muted-foreground">{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
