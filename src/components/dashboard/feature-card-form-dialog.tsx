"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X, AlertTriangle, Info, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FocalPointPicker } from "@/components/dashboard/focal-point-picker";
import { DashboardFeatureCardTile } from "@/components/dashboard/feature-card-tile";
import {
  updateDashboardFeatureCard,
  uploadDashboardFeatureCardImage,
  discardDashboardBannerImage,
  resetDashboardFeatureCard,
} from "@/lib/dashboard/actions";
import { dashboardFeatureCardInputSchema } from "@/lib/dashboard/schema";
import { DASHBOARD_BANNER_ALLOWED_TYPES, DASHBOARD_BANNER_MAX_BYTES } from "@/lib/dashboard/storage";
import { DASHBOARD_FEATURE_CARD_FRAME, DASHBOARD_FEATURE_CARD_BACKGROUNDS, checkImageFit, type ImageFitWarning } from "@/lib/dashboard/banner-frame";
import { readImageDimensions } from "@/lib/dashboard/read-image-dimensions";
import { cn } from "@/lib/utils";
import type { DashboardFeatureCard } from "@/types/dashboard";
import type { LucideIcon } from "lucide-react";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function ImageWarnings({ warnings }: { warnings: ImageFitWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {warnings.map((w, i) => (
        <p key={i} className={cn("flex items-start gap-1.5 text-xs", w.level === "error" ? "text-destructive" : "text-warning")}>
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          {w.message}
        </p>
      ))}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}

function CardForm({
  workspaceId,
  card,
  icon: Icon,
  defaultArt: DefaultArt,
  onDone,
}: {
  workspaceId: string;
  card: DashboardFeatureCard;
  icon: LucideIcon;
  defaultArt: React.ComponentType<{ className?: string }>;
  onDone: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmReset, setConfirmReset] = useState(false);

  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [ctaLabel, setCtaLabel] = useState(card.ctaLabel);
  const [ctaUrl, setCtaUrl] = useState(card.ctaUrl);
  const [backgroundStyle, setBackgroundStyle] = useState(card.backgroundStyle);
  const [isActive, setIsActive] = useState(card.isActive);

  const [imagePath, setImagePath] = useState<string | null>(card.imagePath);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(card.imageUrl);
  const [imageWidth, setImageWidth] = useState<number | null>(card.imageWidth);
  const [imageHeight, setImageHeight] = useState<number | null>(card.imageHeight);
  const [imageWarnings, setImageWarnings] = useState<ImageFitWarning[]>([]);
  const [isNewImage, setIsNewImage] = useState(false);
  const [focalX, setFocalX] = useState(card.focalX);
  const [focalY, setFocalY] = useState(card.focalY);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!DASHBOARD_BANNER_ALLOWED_TYPES.includes(file.type)) {
      setFieldErrors((prev) => ({ ...prev, imagePath: "Định dạng không hỗ trợ. Dùng PNG, JPG hoặc WEBP." }));
      return;
    }
    if (file.size > DASHBOARD_BANNER_MAX_BYTES) {
      setFieldErrors((prev) => ({ ...prev, imagePath: "File quá lớn. Tối đa 5MB." }));
      return;
    }

    setUploading(true);
    try {
      const dimensions = await readImageDimensions(file).catch(() => null);
      const result = await uploadDashboardFeatureCardImage(workspaceId, file);
      if (!result.ok) {
        setFieldErrors((prev) => ({ ...prev, imagePath: result.error.message }));
        return;
      }
      if (isNewImage && imagePath) {
        await discardDashboardBannerImage(imagePath);
      }
      setFieldErrors((prev) => ({ ...prev, imagePath: "" }));
      setImagePath(result.data.path);
      setImagePreviewUrl(result.data.previewUrl);
      setIsNewImage(true);
      if (dimensions) {
        setImageWidth(dimensions.width);
        setImageHeight(dimensions.height);
        setImageWarnings(checkImageFit(dimensions.width, dimensions.height, DASHBOARD_FEATURE_CARD_FRAME));
      } else {
        setImageWidth(null);
        setImageHeight(null);
        setImageWarnings([]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveImage() {
    if (isNewImage && imagePath) {
      await discardDashboardBannerImage(imagePath);
    }
    setImagePath(null);
    setImagePreviewUrl(null);
    setImageWidth(null);
    setImageHeight(null);
    setImageWarnings([]);
    setIsNewImage(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;

    const rawInput = {
      slot: card.slot,
      title,
      description,
      ctaLabel,
      ctaUrl,
      imagePath,
      imageWidth,
      imageHeight,
      focalX,
      focalY,
      backgroundStyle,
      isActive,
    };

    const parsed = dashboardFeatureCardInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "general");
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const result = await updateDashboardFeatureCard(workspaceId, rawInput, isNewImage ? card.imagePath : null);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Đã lưu thẻ chức năng.");
      onDone();
      router.refresh();
    });
  }

  function handleReset() {
    startTransition(async () => {
      const result = await resetDashboardFeatureCard(workspaceId, card.slot);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Đã khôi phục nội dung mặc định.");
      setConfirmReset(false);
      onDone();
      router.refresh();
    });
  }

  const previewCard: DashboardFeatureCard = {
    ...card,
    title,
    description,
    ctaLabel,
    ctaUrl,
    imagePath,
    imageUrl: imagePreviewUrl,
    imageWidth,
    imageHeight,
    focalX,
    focalY,
    backgroundStyle,
    isActive,
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <SectionHeading>Hình ảnh</SectionHeading>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" />
            Ảnh vuông, tỷ lệ {DASHBOARD_FEATURE_CARD_FRAME.ratioLabel} (khuyến nghị tối thiểu{" "}
            {DASHBOARD_FEATURE_CARD_FRAME.recommendedWidth}×{DASHBOARD_FEATURE_CARD_FRAME.recommendedHeight} px). Nếu
            không tải ảnh, thẻ dùng minh hoạ mặc định hiện tại.
          </p>

          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
              {imagePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img
                  src={imagePreviewUrl}
                  alt=""
                  className="size-full object-cover"
                  style={{ objectPosition: `${focalX}% ${focalY}%` }}
                />
              ) : (
                <Upload className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
                {uploading && <Loader2 className="size-3.5 animate-spin" />}
                {imagePreviewUrl ? "Thay đổi" : "Tải lên"}
              </Button>
              {imagePreviewUrl && (
                <Button type="button" size="sm" variant="ghost" onClick={handleRemoveImage}>
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={DASHBOARD_BANNER_ALLOWED_TYPES.join(",")}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          {imageWidth && imageHeight && (
            <p className="text-xs text-muted-foreground">
              Kích thước thực tế: {imageWidth}×{imageHeight} px
            </p>
          )}
          <FieldError message={fieldErrors.imagePath} />
          <ImageWarnings warnings={imageWarnings} />

          {imagePreviewUrl && (
            <FocalPointPicker
              label="Điểm focus"
              imageUrl={imagePreviewUrl}
              aspectClass="aspect-square"
              focalX={focalX}
              focalY={focalY}
              onChange={(x, y) => {
                setFocalX(x);
                setFocalY(y);
              }}
            />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeading>Nội dung</SectionHeading>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`card-title-${card.slot}`}>Tiêu đề</Label>
            <Input
              id={`card-title-${card.slot}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={Boolean(fieldErrors.title)}
              required
              autoFocus
            />
            <FieldError message={fieldErrors.title} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`card-description-${card.slot}`}>Mô tả</Label>
            <Textarea
              id={`card-description-${card.slot}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={Boolean(fieldErrors.description)}
              rows={2}
            />
            <FieldError message={fieldErrors.description} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeading>Nút CTA</SectionHeading>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`card-cta-label-${card.slot}`}>Nhãn CTA</Label>
              <Input
                id={`card-cta-label-${card.slot}`}
                placeholder="Bắt đầu"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                aria-invalid={Boolean(fieldErrors.ctaLabel)}
              />
              <FieldError message={fieldErrors.ctaLabel} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`card-cta-url-${card.slot}`}>Đường dẫn CTA</Label>
              <Input
                id={`card-cta-url-${card.slot}`}
                placeholder="/create/image hoặc https://..."
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                aria-invalid={Boolean(fieldErrors.ctaUrl)}
              />
              <FieldError message={fieldErrors.ctaUrl} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeading>Hiển thị</SectionHeading>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`card-bg-${card.slot}`}>Kiểu nền</Label>
              <Select value={backgroundStyle} onValueChange={(v) => setBackgroundStyle(v as typeof backgroundStyle)}>
                <SelectTrigger id={`card-bg-${card.slot}`} className="w-48">
                  <SelectValue>{() => DASHBOARD_FEATURE_CARD_BACKGROUNDS[backgroundStyle].label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DASHBOARD_FEATURE_CARD_BACKGROUNDS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
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
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmReset(true)} disabled={isPending}>
            <RotateCcw className="size-3.5" />
            Khôi phục mặc định
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:sticky lg:top-0 lg:self-start">
        <SectionHeading>Xem trước trên Dashboard</SectionHeading>
        <DashboardFeatureCardTile
          card={previewCard}
          icon={<Icon className="size-4.5" />}
          defaultArt={
            <DefaultArt className="absolute inset-0 size-full scale-105 transition-transform duration-300 group-hover:scale-110" />
          }
          interactive={false}
        />
        <p className="text-[11px] text-muted-foreground">
          Xem trước dùng đúng bố cục, kiểu nền và cách crop ảnh như trên Dashboard thật.
        </p>
        <DialogFooter className="mt-2">
          <Button type="submit" disabled={isPending || uploading}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Lưu thẻ
          </Button>
        </DialogFooter>
      </div>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Khôi phục nội dung mặc định?</AlertDialogTitle>
            <AlertDialogDescription>
              Mọi tuỳ chỉnh (ảnh, tiêu đề, mô tả, CTA, kiểu nền) của thẻ này sẽ bị xoá và quay về nội dung mặc định ban
              đầu. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={handleReset}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Khôi phục
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

export function DashboardFeatureCardFormDialog({
  workspaceId,
  open,
  onOpenChange,
  card,
  icon,
  defaultArt,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: DashboardFeatureCard | null;
  icon: LucideIcon;
  defaultArt: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa thẻ chức năng</DialogTitle>
          <DialogDescription>Hiển thị bên cạnh banner lớn trên Dashboard.</DialogDescription>
        </DialogHeader>
        {open && card && (
          <CardForm
            key={card.slot}
            workspaceId={workspaceId}
            card={card}
            icon={icon}
            defaultArt={defaultArt}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
