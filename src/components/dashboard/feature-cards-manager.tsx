"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, LayoutTemplate, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DashboardFeatureCardFormDialog } from "@/components/dashboard/feature-card-form-dialog";
import { toggleDashboardFeatureCardActive } from "@/lib/dashboard/actions";
import { ImageHeroArt } from "@/components/dashboard/image-hero-art";
import { BannerHeroArt } from "@/components/dashboard/banner-hero-art";
import type { DashboardFeatureCard, DashboardFeatureCardSlot } from "@/types/dashboard";
import type { LucideIcon } from "lucide-react";

const SLOT_META: Record<
  DashboardFeatureCardSlot,
  { icon: LucideIcon; defaultArt: React.ComponentType<{ className?: string }> }
> = {
  image: { icon: ImageIcon, defaultArt: ImageHeroArt },
  banner: { icon: LayoutTemplate, defaultArt: BannerHeroArt },
};

/**
 * Manages the two fixed Dashboard feature-card slots ("Tạo ảnh" / "Tạo
 * banner") — a separate, clearly-labeled section from the big banner
 * carousel above it, since these are a different part of the Dashboard
 * (the right-column shortcut tiles, not the hero carousel).
 */
export function FeatureCardsManager({ workspaceId, cards }: { workspaceId: string; cards: DashboardFeatureCard[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingCard, setEditingCard] = useState<DashboardFeatureCard | null>(null);

  function handleToggleActive(card: DashboardFeatureCard, next: boolean) {
    startTransition(async () => {
      const result = await toggleDashboardFeatureCardActive(workspaceId, card.slot, next);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-heading text-base font-semibold">Thẻ chức năng</h2>
        <p className="text-sm text-muted-foreground">
          Hai thẻ &quot;Tạo ảnh&quot; và &quot;Tạo banner&quot; hiển thị bên cạnh banner lớn trên Dashboard — tuỳ chỉnh
          riêng từng thẻ.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {cards.map((card) => {
          const meta = SLOT_META[card.slot];
          const Icon = meta.icon;
          return (
            <div key={card.slot} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/40">
                {card.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img
                    src={card.imageUrl}
                    alt=""
                    className="size-full object-cover"
                    style={{ objectPosition: `${card.focalX}% ${card.focalY}%` }}
                  />
                ) : (
                  <Icon className="size-4 text-muted-foreground" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{card.title}</p>
                {card.description && <p className="truncate text-xs text-muted-foreground">{card.description}</p>}
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {!card.isCustomized && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                      Mặc định
                    </Badge>
                  )}
                  {card.ctaLabel && card.ctaUrl ? (
                    <span className="text-[11px] text-muted-foreground">
                      CTA: {card.ctaLabel} → {card.ctaUrl}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Không có CTA</span>
                  )}
                </div>
              </div>

              <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={card.isActive}
                  onCheckedChange={(checked) => handleToggleActive(card, checked === true)}
                  disabled={isPending}
                />
                Đang bật
              </label>

              <button
                type="button"
                onClick={() => setEditingCard(card)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={`Chỉnh sửa ${card.title}`}
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <DashboardFeatureCardFormDialog
        workspaceId={workspaceId}
        open={editingCard !== null}
        onOpenChange={(open) => !open && setEditingCard(null)}
        card={editingCard}
        icon={editingCard ? SLOT_META[editingCard.slot].icon : ImageIcon}
        defaultArt={editingCard ? SLOT_META[editingCard.slot].defaultArt : ImageHeroArt}
      />
    </div>
  );
}
