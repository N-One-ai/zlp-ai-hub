import { Skeleton } from "@/components/ui/skeleton";

export default function AuthGalleryLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
            <Skeleton className="size-14 shrink-0 rounded-md" />
            <div className="flex-1 flex flex-col gap-1.5">
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
