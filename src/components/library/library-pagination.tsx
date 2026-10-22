import { cn } from "@/lib/utils";

/** Plain server-rendered anchor links — same pattern used throughout this
 * app for pagination (no client JS needed, the data fetch always happens
 * server-side on navigation). */
export function LibraryPagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const windowSize = 5;
  const start = Math.max(1, Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1));
  const end = Math.min(totalPages, start + windowSize - 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <nav className="flex items-center justify-center gap-1 text-sm" aria-label="Phân trang">
      <PageLink href={buildHref(Math.max(1, page - 1))} disabled={page === 1}>
        Trước
      </PageLink>
      {pages.map((p) => (
        <a
          key={p}
          href={buildHref(p)}
          aria-current={p === page ? "page" : undefined}
          className={cn(
            "flex size-8 items-center justify-center rounded-lg font-medium tabular-nums",
            p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          )}
        >
          {p}
        </a>
      ))}
      <PageLink href={buildHref(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
        Sau
      </PageLink>
    </nav>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="px-3 py-1.5 text-muted-foreground/40">{children}</span>;
  return (
    <a href={href} className="px-3 py-1.5 rounded-lg font-medium text-foreground hover:bg-muted">
      {children}
    </a>
  );
}
