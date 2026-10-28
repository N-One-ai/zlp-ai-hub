"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { uploadAvatar, removeAvatar } from "@/lib/profile/actions";
import { AVATAR_ALLOWED_TYPES, AVATAR_MAX_BYTES } from "@/lib/profile/storage";

/** Avatar display + edit controls for the Settings page. Shows a LOCAL
 * object-URL preview the instant a file is picked (cropped to a circle
 * by AvatarImage's own `object-cover`, same as everywhere else this
 * component renders an avatar — never stretched), then uploads for real;
 * the preview is replaced by the real signed Storage URL only once the
 * server confirms the save, and discarded on any failure so the UI never
 * claims a save that didn't happen. */
export function AvatarEditor({
  currentAvatarUrl,
  name,
}: {
  currentAvatarUrl: string | null;
  name: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const initial = (name || "?").charAt(0).toUpperCase();
  const displayUrl = previewUrl ?? avatarUrl;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      toast.error("Định dạng không hỗ trợ. Dùng JPG, PNG hoặc WEBP.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("File quá lớn. Tối đa 5MB.");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setBusy(true);
    try {
      const result = await uploadAvatar(file);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setAvatarUrl(result.data.avatarUrl);
      toast.success("Đã cập nhật ảnh đại diện.");
      router.refresh(); // syncs sidebar/header UserMenu + members-table elsewhere on the page tree
    } finally {
      URL.revokeObjectURL(localPreview);
      setPreviewUrl(null);
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      const result = await removeAvatar();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setAvatarUrl(null);
      toast.success("Đã xoá ảnh đại diện.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-14 shrink-0">
        {displayUrl && <AvatarImage src={displayUrl} alt={name} />}
        <AvatarFallback className="text-lg font-medium">{initial}</AvatarFallback>
      </Avatar>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {avatarUrl ? "Đổi ảnh đại diện" : "Tải ảnh lên"}
        </Button>
        {avatarUrl && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={handleRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Xoá ảnh
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_ALLOWED_TYPES.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
