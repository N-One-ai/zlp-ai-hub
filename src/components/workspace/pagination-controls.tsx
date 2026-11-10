import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared pager for the two Members-page sections. Caller owns the page
 * state and data fetch — this is purely presentational + prev/next. */
export function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  disabled,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        {start}-{end} trong {total} · Trang {page}/{totalPages}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Trang sau"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
