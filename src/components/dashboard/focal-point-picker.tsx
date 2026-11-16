"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Lets the admin click/drag on the uploaded image to pick the CSS
 * object-position anchor used when it's cover-cropped into the Dashboard
 * frame — the simplest reliable "adjust image position in the frame"
 * mechanism available without adding a cropping library (see
 * banner-frame.ts's doc comment). Shown at the SAME aspect ratio as the
 * real frame, so what the admin sees here is what gets kept on crop. */
export function FocalPointPicker({
  label,
  imageUrl,
  aspectClass,
  focalX,
  focalY,
  onChange,
}: {
  label: string;
  imageUrl: string | null;
  aspectClass: string;
  focalX: number;
  focalY: number;
  onChange: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function updateFromPointer(e: React.PointerEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
    onChange(Math.round(x), Math.round(y));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div
        ref={ref}
        role="slider"
        tabIndex={imageUrl ? 0 : -1}
        aria-label={`Điểm focus — ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={focalX}
        aria-valuetext={`${focalX}% ngang, ${focalY}% dọc`}
        onPointerDown={(e) => {
          if (!imageUrl) return;
          updateFromPointer(e);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (imageUrl && e.buttons === 1) updateFromPointer(e);
        }}
        onKeyDown={(e) => {
          if (!imageUrl) return;
          const step = 5;
          if (e.key === "ArrowLeft") onChange(clamp(focalX - step, 0, 100), focalY);
          else if (e.key === "ArrowRight") onChange(clamp(focalX + step, 0, 100), focalY);
          else if (e.key === "ArrowUp") onChange(focalX, clamp(focalY - step, 0, 100));
          else if (e.key === "ArrowDown") onChange(focalX, clamp(focalY + step, 0, 100));
          else return;
          e.preventDefault();
        }}
        className={cn(
          "relative w-full overflow-hidden rounded-lg bg-muted/40 ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring",
          imageUrl && "cursor-crosshair",
          aspectClass
        )}
      >
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL or local blob preview
          <img
            src={imageUrl}
            alt=""
            className="pointer-events-none absolute inset-0 size-full object-cover"
            style={{ objectPosition: `${focalX}% ${focalY}%` }}
          />
        )}
        {imageUrl && (
          <div
            className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/40"
            style={{ left: `${focalX}%`, top: `${focalY}%` }}
          />
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {imageUrl ? "Kéo hoặc bấm vào ảnh để chọn phần quan trọng khi ảnh bị cắt." : "Tải ảnh lên để chọn điểm focus."}
      </p>
    </div>
  );
}
