"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { FocalPointPicker } from "@/components/dashboard/focal-point-picker";
import { BannerSlideContent } from "@/components/dashboard/banner-slide";
import {
  createDashboardBanner,
  updateDashboardBanner,
  uploadDashboardBannerImage,
  discardDashboardBannerImage,
  reorderDashboardBanners,
} from "@/lib/dashboard/actions";
import { dashboardBannerInputSchema } from "@/lib/dashboard/schema";
import { DASHBOARD_BANNER_ALLOWED_TYPES, DASHBOARD_BANNER_MAX_BYTES } from "@/lib/dashboard/storage";
import { DASHBOARD_BANNER_FRAME, checkImageFit, type ImageFitWarning } from "@/lib/dashboard/banner-frame";
import { readImageDimensions } from "@/lib/dashboard/read-image-dimensions";
import { cn } from "@/lib/utils";
import type { DashboardBanner } from "@/types/dashboard";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function ImageWarnings({ warnings }: { warnings: ImageFitWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {warnings.map((w, i) => (
        <p
          key={i}
          className={cn(
            "flex items-start gap-1.5 text-xs",
            w.level === "error" ? "text-destructive" : "text-warning"
          )}
        >
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

function buildReorderedIds(
  existing: DashboardBanner[],
  excludeId: string | null,
  insertId: string,
  desiredIndex: number
): string[] {
  const ids = existing.filter((b) => b.id !== excludeId).map((b) => b.id);
  const clamped = Math.min(Math.max(desiredIndex, 0), ids.length);
  ids.splice(clamped, 0, insertId);
  return ids;
}

/** Owns the actual form state, initialized directly from `banner` (no
 * effect needed) — the parent remounts this with a fresh `key` every time
 * the dialog opens, so switching between "create" and editing different
 * banners never leaks stale field values from a previous open. */
function BannerForm({
  workspaceId,
  banner,
  banners,
  onDone,
}: {
  workspaceId: string;
  banner?: DashboardBanner | null;
  banners: DashboardBanner[];
  onDone: () => void;
}) {
  const router = useRouter();
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState(banner?.title ?? "");
  const [description, setDescription] = useState(banner?.description ?? "");
  const [ctaLabel, setCtaLabel] = useState(banner?.ctaLabel ?? "");
  const [ctaUrl, setCtaUrl] = useState(banner?.ctaUrl ?? "");
  const [isActive, setIsActive] = useState(banner?.isActive ?? true);

  const [imagePath, setImagePath] = useState<string | null>(banner?.imagePath ?? null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(banner?.imageUrl ?? null);
  const [imageWidth, setImageWidth] = useState<number | null>(banner?.imageWidth ?? null);
  const [imageHeight, setImageHeight] = useState<number | null>(banner?.imageHeight ?? null);
  const [imageWarnings, setImageWarnings] = useState<ImageFitWarning[]>([]);
  const [isNewImage, setIsNewImage] = useState(false);
  const [focalX, setFocalX] = useState(banner?.focalX ?? 50);
  const [focalY, setFocalY] = useState(banner?.focalY ?? 50);

  const [mobileImagePath, setMobileImagePath] = useState<string | null>(banner?.mobileImagePath ?? null);
  const [mobileImagePreviewUrl, setMobileImagePreviewUrl] = useState<string | null>(banner?.mobileImageUrl ?? null);
  const [mobileImageWidth, setMobileImageWidth] = useState<number | null>(banner?.mobileImageWidth ?? null);
  const [mobileImageHeight, setMobileImageHeight] = useState<number | null>(banner?.mobileImageHeight ?? null);
  const [mobileImageWarnings, setMobileImageWarnings] = useState<ImageFitWarning[]>([]);
  const [isNewMobileImage, setIsNewMobileImage] = useState(false);
  const [mobileFocalX, setMobileFocalX] = useState(banner?.mobileFocalX ?? 50);
  const [mobileFocalY, setMobileFocalY] = useState(banner?.mobileFocalY ?? 50);

  const initialPosition = banner ? banners.findIndex((b) => b.id === banner.id) + 1 || banners.length : banners.length + 1;
  const [position, setPosition] = useState(initialPosition);
  const positionOptions = banner ? banners.length : banners.length + 1;

  async function handleDesktopFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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

    setUploadingDesktop(true);
    try {
      const dimensions = await readImageDimensions(file).catch(() => null);
      const result = await uploadDashboardBannerImage(workspaceId, file);
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
        setImageWarnings(checkImageFit(dimensions.width, dimensions.height, DASHBOARD_BANNER_FRAME.desktop));
      } else {
        setImageWidth(null);
        setImageHeight(null);
        setImageWarnings([]);
      }
    } finally {
      setUploadingDesktop(false);
    }
  }

  async function handleRemoveDesktopImage() {
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

  async function handleMobileFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!DASHBOARD_BANNER_ALLOWED_TYPES.includes(file.type)) {
      toast.error("Định dạng không hỗ trợ. Dùng PNG, JPG hoặc WEBP.");
      return;
    }
    if (file.size > DASHBOARD_BANNER_MAX_BYTES) {
      toast.error("File quá lớn. Tối đa 5MB.");
      return;
    }

    setUploadingMobile(true);
    try {
      const dimensions = await readImageDimensions(file).catch(() => null);
      const result = await uploadDashboardBannerImage(workspaceId, file);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      if (isNewMobileImage && mobileImagePath) {
        await discardDashboardBannerImage(mobileImagePath);
      }
      setMobileImagePath(result.data.path);
      setMobileImagePreviewUrl(result.data.previewUrl);
      setIsNewMobileImage(true);
      if (dimensions) {
        setMobileImageWidth(dimensions.width);
        setMobileImageHeight(dimensions.height);
        setMobileImageWarnings(checkImageFit(dimensions.width, dimensions.height, DASHBOARD_BANNER_FRAME.mobile));
      } else {
        setMobileImageWidth(null);
        setMobileImageHeight(null);
        setMobileImageWarnings([]);
      }
    } finally {
      setUploadingMobile(false);
    }
  }

  async function handleRemoveMobileImage() {
    if (isNewMobileImage && mobileImagePath) {
      await discardDashboardBannerImage(mobileImagePath);
    }
    setMobileImagePath(null);
    setMobileImagePreviewUrl(null);
    setMobileImageWidth(null);
    setMobileImageHeight(null);
    setMobileImageWarnings([]);
    setIsNewMobileImage(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;

    const rawInput = {
      title,
      description,
      ctaLabel,
      ctaUrl,
      imagePath: imagePath ?? "",
      imageWidth,
      imageHeight,
      focalX,
      focalY,
      mobileImagePath,
      mobileImageWidth,
      mobileImageHeight,
      mobileFocalX,
      mobileFocalY,
      isActive,
    };

    const parsed = dashboardBannerInputSchema.safeParse(rawInput);
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
      let newId = banner?.id ?? null;

      if (banner) {
        const result = await updateDashboardBanner(
          banner.id,
          rawInput,
          isNewImage ? banner.imagePath : null,
          isNewMobileImage ? banner.mobileImagePath : null
        );
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
      } else {
        const result = await createDashboardBanner(workspaceId, rawInput);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        newId = result.data.id;
      }

      if (newId && position !== initialPosition) {
        const reorderResult = await reorderDashboardBanners(
          buildReorderedIds(banners, banner?.id ?? null, newId, position - 1)
        );
        if (!reorderResult.ok) toast.error(reorderResult.error.message);
      }

      toast.success(banner ? "Đã lưu thay đổi." : "Đã tạo banner mới.");
      onDone();
      router.refresh();
    });
  }

  const previewData = {
    title,
    description,
    ctaLabel,
    ctaUrl,
    imageUrl: imagePreviewUrl,
    focalX,
    focalY,
    mobileImageUrl: mobileImagePreviewUrl,
    mobileFocalX,
    mobileFocalY,
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <SectionHeading>Hình ảnh</SectionHeading>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" />
            Ảnh ngang, tỷ lệ {DASHBOARD_BANNER_FRAME.desktop.ratioLabel} (khuyến nghị tối thiểu{" "}
            {DASHBOARD_BANNER_FRAME.desktop.recommendedWidth}×{DASHBOARD_BANNER_FRAME.desktop.recommendedHeight} px). Ảnh
            được crop để phủ kín khung (cover) theo điểm focus bạn chọn — không bị kéo giãn méo hình.
          </p>

          <div className="flex items-center gap-3">
            <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
              {imagePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img src={imagePreviewUrl} alt="" className="size-full object-cover" style={{ objectPosition: `${focalX}% ${focalY}%` }} />
              ) : (
                <Upload className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploadingDesktop}
                onClick={() => desktopInputRef.current?.click()}
              >
                {uploadingDesktop && <Loader2 className="size-3.5 animate-spin" />}
                {imagePreviewUrl ? "Thay đổi" : "Tải lên"}
              </Button>
              {imagePreviewUrl && (
                <Button type="button" size="sm" variant="ghost" onClick={handleRemoveDesktopImage}>
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
            <input
              ref={desktopInputRef}
              type="file"
              accept={DASHBOARD_BANNER_ALLOWED_TYPES.join(",")}
              onChange={handleDesktopFileChange}
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
              label="Điểm focus (khung desktop 2:1)"
              imageUrl={imagePreviewUrl}
              aspectClass={DASHBOARD_BANNER_FRAME.desktop.aspectClass.replace("sm:", "")}
              focalX={focalX}
              focalY={focalY}
              onChange={(x, y) => {
                setFocalX(x);
                setFocalY(y);
              }}
            />
          )}

          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">
                Ảnh riêng cho mobile (tuỳ chọn) — tỷ lệ {DASHBOARD_BANNER_FRAME.mobile.ratioLabel}
              </span>
              {!mobileImagePreviewUrl && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={uploadingMobile}
                  onClick={() => mobileInputRef.current?.click()}
                >
                  {uploadingMobile && <Loader2 className="size-3 animate-spin" />}
                  Thêm ảnh mobile
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Không thêm thì ảnh ở trên được dùng lại cho khung mobile, crop theo điểm focus riêng bên dưới.
            </p>
            <input
              ref={mobileInputRef}
              type="file"
              accept={DASHBOARD_BANNER_ALLOWED_TYPES.join(",")}
              onChange={handleMobileFileChange}
              className="hidden"
            />
            {mobileImagePreviewUrl && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                    <img
                      src={mobileImagePreviewUrl}
                      alt=""
                      className="size-full object-cover"
                      style={{ objectPosition: `${mobileFocalX}% ${mobileFocalY}%` }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={uploadingMobile}
                      onClick={() => mobileInputRef.current?.click()}
                    >
                      {uploadingMobile && <Loader2 className="size-3 animate-spin" />}
                      Thay đổi
                    </Button>
                    <Button type="button" size="xs" variant="ghost" onClick={handleRemoveMobileImage}>
                      <X className="size-3" />
                    </Button>
                  </div>
                </div>
                {mobileImageWidth && mobileImageHeight && (
                  <p className="text-xs text-muted-foreground">
                    Kích thước thực tế: {mobileImageWidth}×{mobileImageHeight} px
                  </p>
                )}
                <ImageWarnings warnings={mobileImageWarnings} />
                <FocalPointPicker
                  label="Điểm focus (khung mobile 4:3)"
                  imageUrl={mobileImagePreviewUrl}
                  aspectClass={DASHBOARD_BANNER_FRAME.mobile.aspectClass}
                  focalX={mobileFocalX}
                  focalY={mobileFocalY}
                  onChange={(x, y) => {
                    setMobileFocalX(x);
                    setMobileFocalY(y);
                  }}
                />
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeading>Nội dung</SectionHeading>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="banner-title">Tiêu đề</Label>
            <Input
              id="banner-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={Boolean(fieldErrors.title)}
              required
              autoFocus
            />
            <FieldError message={fieldErrors.title} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="banner-description">Mô tả</Label>
            <Textarea
              id="banner-description"
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
              <Label htmlFor="banner-cta-label">Nhãn CTA</Label>
              <Input
                id="banner-cta-label"
                placeholder="Bắt đầu"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                aria-invalid={Boolean(fieldErrors.ctaLabel)}
              />
              <FieldError message={fieldErrors.ctaLabel} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="banner-cta-url">Đường dẫn CTA</Label>
              <Input
                id="banner-cta-url"
                placeholder="/create/banner hoặc https://..."
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
              <Label htmlFor="banner-position">Vị trí hiển thị</Label>
              <Select value={String(position)} onValueChange={(v) => setPosition(Number(v))}>
                <SelectTrigger id="banner-position" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: positionOptions }, (_, i) => i + 1).map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      Vị trí {p}
                      {p === 1 ? " (đầu tiên)" : p === positionOptions ? " (cuối cùng)" : ""}
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
          <p className="text-xs text-muted-foreground">
            Chỉ banner đang bật mới xuất hiện trong carousel trên Dashboard — tắt để tạm ẩn mà không mất dữ liệu.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:sticky lg:top-0 lg:self-start">
        <SectionHeading>Xem trước trên Dashboard</SectionHeading>
        <BannerSlideContent data={previewData} />
        <p className="text-[11px] text-muted-foreground">
          Xem trước dùng đúng khung, cách crop ảnh và vị trí CTA như trên Dashboard thật — thu nhỏ cửa sổ trình duyệt để
          xem bản mobile ({DASHBOARD_BANNER_FRAME.mobile.ratioLabel}).
        </p>
        <DialogFooter className="mt-2">
          <Button type="submit" disabled={isPending || uploadingDesktop || uploadingMobile || !imagePath}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {banner ? "Lưu thay đổi" : "Tạo banner"}
          </Button>
        </DialogFooter>
      </div>
    </form>
  );
}

export function DashboardBannerFormDialog({
  workspaceId,
  open,
  onOpenChange,
  banner,
  banners,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present for edit, absent (undefined/null) for create. */
  banner?: DashboardBanner | null;
  /** Full current list (sorted by display order) — used to compute the
   * position selector and to reorder on save if the admin changed it. */
  banners: DashboardBanner[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{banner ? "Chỉnh sửa banner" : "Thêm banner"}</DialogTitle>
          <DialogDescription>Hiển thị trên Dashboard, luân phiên cùng các banner khác đang bật.</DialogDescription>
        </DialogHeader>
        {open && (
          <BannerForm
            key={banner?.id ?? "create"}
            workspaceId={workspaceId}
            banner={banner}
            banners={banners}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
