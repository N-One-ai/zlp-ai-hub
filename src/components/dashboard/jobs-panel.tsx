"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, RotateCw, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getGenerationJobAction, retryGenerationJob } from "@/lib/generation/actions";
import { modelLabel } from "@/lib/generation/model-meta";
import type { DashboardJobSummary } from "@/lib/generation/queries";

const STATUS_LABEL: Record<DashboardJobSummary["status"], string> = {
  queued: "Đang chờ",
  processing: "Đang tạo...",
  succeeded: "Hoàn tất",
  failed: "Thất bại",
  cancelled: "Đã huỷ",
};

const STATUS_BADGE_CLASS: Record<DashboardJobSummary["status"], string> = {
  queued: "border-border text-muted-foreground",
  processing: "border-border text-muted-foreground",
  succeeded: "border-success/40 text-success bg-success/10",
  failed: "border-destructive/40 text-destructive bg-destructive/10",
  cancelled: "border-border text-muted-foreground",
};

// A little above the real 2000ms poll used on the dedicated job-detail
// page (see job-status.tsx) — this view often renders several jobs'
// polling loops at once, so a slightly longer interval keeps the
// dashboard from firing a burst of requests every tick.
const POLL_INTERVAL_MS = 4000;
const ACTIVE_STATUSES = new Set<DashboardJobSummary["status"]>(["queued", "processing"]);

/** Coarse, Vietnamese "x phút trước" style relative time — this is a
 * dashboard glance, not a precise timestamp display (the full date is
 * still one click away via the job/asset detail page). */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

function JobRow({ job: initialJob }: { job: DashboardJobSummary }) {
  const [job, setJob] = useState(initialJob);
  const [retrying, setRetrying] = useState(false);

  // Polls only while queued/processing, re-reading the job via the SAME
  // getGenerationJobAction the dedicated job-detail page uses (never a
  // separate ad-hoc fetch) — stops the moment the job reaches a terminal
  // status, never a fixed/guessed timeout.
  useEffect(() => {
    if (!ACTIVE_STATUSES.has(job.status)) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      const next = await getGenerationJobAction(job.id);
      if (cancelled || !next) return;
      setJob((prev) => ({
        ...prev,
        status: next.status,
        error: next.error,
        finalModel: next.finalModel,
        thumbnailUrl: next.results[0]?.url ?? prev.thumbnailUrl,
      }));
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [job.id, job.status]);

  // Creates a brand-new job (see retryGenerationJob's own doc comment on
  // why) and switches this row to follow THAT job's id — never resubmits
  // or mutates the failed row in place.
  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    try {
      const result = await retryGenerationJob(job.id);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Đã gửi yêu cầu tạo lại.");
      setJob((prev) => ({ ...prev, id: result.data.jobId, status: "queued", error: null, thumbnailUrl: null }));
    } finally {
      setRetrying(false);
    }
  }

  const label = job.isCharacterSheet ? "Character sheet" : job.prompt.trim() || "Không có mô tả";
  const href = `/create/image?job=${job.id}`;
  const isActive = ACTIVE_STATUSES.has(job.status);

  return (
    <div className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5">
      <Link
        href={href}
        className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/40"
        aria-label="Xem chi tiết tác vụ"
      >
        {job.status === "failed" ? (
          <AlertTriangle className="size-5 text-destructive" />
        ) : job.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <img src={job.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : isActive ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <ImageIcon className="size-5 text-muted-foreground" />
        )}
      </Link>

      <Link href={href} className="min-w-0 flex-1">
        <p title={label} className="truncate text-sm font-medium">
          {label}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {modelLabel(job.finalModel ?? job.requestedModel)} · {job.brandName} · {timeAgo(job.createdAt)}
        </p>
        {job.status === "failed" && job.error && <p className="truncate text-xs text-destructive">{job.error}</p>}
      </Link>

      <Badge variant="outline" className={cn("hidden shrink-0 sm:inline-flex", STATUS_BADGE_CLASS[job.status])}>
        {isActive && <Loader2 className="size-3 animate-spin" />}
        {job.status === "succeeded" && <CheckCircle2 className="size-3" />}
        {STATUS_LABEL[job.status]}
      </Badge>

      {job.status === "failed" && (
        <Button type="button" size="sm" variant="outline" disabled={retrying} onClick={handleRetry} className="shrink-0">
          {retrying ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
          Thử lại
        </Button>
      )}
    </div>
  );
}

export function DashboardJobsPanel({ jobs, loadError }: { jobs: DashboardJobSummary[]; loadError: boolean }) {
  if (loadError) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
        <AlertTriangle className="size-4 shrink-0" />
        Không tải được danh sách tác vụ — thử tải lại trang.
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <p className="rounded-xl bg-card px-3 py-4 text-center text-sm text-muted-foreground">
        Chưa có tác vụ tạo ảnh/banner nào gần đây.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {jobs.map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </div>
  );
}
