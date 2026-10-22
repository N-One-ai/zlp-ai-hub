"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, Download, Save, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getGenerationJobAction, saveGenerationResult } from "@/lib/generation/actions";
import { trackEvent } from "@/lib/analytics/track";
import type { GenerationJob } from "@/types/generation";

const POLL_INTERVAL_MS = 2000;
const ACTIVE_STATUSES = new Set(["queued", "processing"]);

const STATUS_LABEL: Record<GenerationJob["status"], string> = {
  queued: "Đang chờ",
  processing: "Đang tạo...",
  succeeded: "Hoàn tất",
  failed: "Thất bại",
  cancelled: "Đã huỷ",
};

/**
 * Polls while the job is queued/processing — even though the current
 * Demo/synchronous provider resolves almost immediately, this is the
 * real architecture PRD §8.3 asks for ("client có thể rời trang rồi quay
 * lại xem trạng thái"), already correct for when a slower real provider
 * (10-90s) is wired in later. The job is re-fetched once on mount from
 * `initialJob` (server-rendered, survives a full page refresh via the
 * ?job= URL param) rather than assumed from client state alone.
 */
export function JobStatus({ initialJob }: { initialJob: GenerationJob }) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!ACTIVE_STATUSES.has(job.status)) return;
    let cancelled = false;

    const interval = setInterval(async () => {
      const next = await getGenerationJobAction(job.id);
      if (!cancelled && next) setJob(next);
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [job.id, job.status]);

  function handleSave(index: number) {
    setSavingIndex(index);
    startTransition(async () => {
      try {
        const result = await saveGenerationResult({ jobId: job.id, outputIndex: index, name: job.prompt.slice(0, 80) });
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        toast.success("Đã lưu vào thư viện.");
        const refreshed = await getGenerationJobAction(job.id);
        if (refreshed) setJob(refreshed);
        router.refresh();
      } finally {
        setSavingIndex(null);
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {ACTIVE_STATUSES.has(job.status) && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {job.status === "succeeded" && <CheckCircle2 className="size-4 text-emerald-600" />}
          {job.status === "failed" && <XCircle className="size-4 text-destructive" />}
          <Badge variant="secondary">{STATUS_LABEL[job.status]}</Badge>
          <span className="text-xs text-muted-foreground">
            {job.width}×{job.height}px · {job.count} ảnh
          </span>
        </div>

        {job.status === "failed" && job.error && <p className="text-sm text-destructive">{job.error}</p>}

        {job.results.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-3">
            {job.results.map((result) => (
              <div key={result.index} className="flex flex-col gap-2 rounded-lg border p-2">
                <div className="aspect-square w-full overflow-hidden rounded-md bg-muted/40 flex items-center justify-center">
                  {result.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                    <img src={result.url} alt="Kết quả sinh ảnh" className="size-full object-contain" />
                  ) : (
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  {result.isDemo && (
                    <Badge variant="outline" className="text-amber-700 border-amber-600/40">
                      Demo
                    </Badge>
                  )}
                  <div className="flex gap-1.5 ml-auto">
                    {result.url && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        nativeButton={false}
                        render={
                          <a
                            href={result.url}
                            download
                            onClick={() => {
                              if (result.savedAssetId) {
                                void trackEvent({ name: "asset_downloaded", assetId: result.savedAssetId, assetType: "image" });
                              }
                            }}
                          />
                        }
                      >
                        <Download className="size-3.5" />
                      </Button>
                    )}
                    {result.savedAssetId ? (
                      <Badge variant="secondary" className="text-xs">
                        Đã lưu
                      </Badge>
                    ) : (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={savingIndex === result.index}
                        onClick={() => handleSave(result.index)}
                      >
                        {savingIndex === result.index ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Save className="size-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                {result.savedAssetId && (
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<a href={`/create/banner?asset=${result.savedAssetId}`} />}
                  >
                    <LayoutTemplate className="size-3.5" />
                    Mở trong trình tạo banner
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
