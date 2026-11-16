"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardMarquee } from "@/components/dashboard/dashboard-marquee";
import { updateDashboardMarquee } from "@/lib/dashboard/actions";
import { dashboardMarqueeInputSchema } from "@/lib/dashboard/schema";
import { DASHBOARD_MARQUEE_SPEED_PRESETS } from "@/lib/dashboard/marquee-defaults";
import type { DashboardMarquee as DashboardMarqueeData } from "@/types/dashboard";

function speedLabel(speedSeconds: number): string {
  return DASHBOARD_MARQUEE_SPEED_PRESETS.find((p) => p.value === speedSeconds)?.label ?? `${speedSeconds}s/vòng`;
}

/**
 * Settings for the Dashboard marquee strip — lives in the same "Banner
 * Dashboard" management page as the big banner and feature cards (never
 * a separate settings page), admin-only via requireWorkspaceAdmin() on
 * that page plus RLS on dashboard_marquee itself.
 */
export function DashboardMarqueeSettings({ workspaceId, marquee }: { workspaceId: string; marquee: DashboardMarqueeData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldError, setFieldError] = useState<string | undefined>();

  const [text, setText] = useState(marquee.text);
  const [speedSeconds, setSpeedSeconds] = useState(marquee.speedSeconds);
  const [isActive, setIsActive] = useState(marquee.isActive);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;

    const rawInput = { text, speedSeconds, isActive };
    const parsed = dashboardMarqueeInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);

    startTransition(async () => {
      const result = await updateDashboardMarquee(workspaceId, rawInput);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Đã lưu dải chữ chạy.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-heading text-base font-semibold">Dải chữ chạy</h2>
        <p className="text-sm text-muted-foreground">
          Thay cho hàng chỉ số cũ trên Dashboard — chạy liên tục giữa banner/thẻ chức năng và Tài sản gần đây.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="marquee-text">Nội dung</Label>
          <Input id="marquee-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} required />
          {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marquee-speed">Tốc độ chạy</Label>
            <Select value={String(speedSeconds)} onValueChange={(v) => setSpeedSeconds(Number(v))}>
              <SelectTrigger id="marquee-speed" className="w-44">
                <SelectValue>{() => speedLabel(speedSeconds)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DASHBOARD_MARQUEE_SPEED_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={String(preset.value)}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} />
            Đang bật (hiển thị trên Dashboard)
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Xem trước</Label>
          <DashboardMarquee text={text || "..."} speedSeconds={speedSeconds} />
        </div>

        <div>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Lưu dải chữ
          </Button>
        </div>
      </form>
    </div>
  );
}
