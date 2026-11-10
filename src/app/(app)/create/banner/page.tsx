import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getBrands, getSizePresets } from "@/lib/brand/queries";
import { listAvailableModels } from "@/lib/generation/providers";
import { createBannerAsset } from "@/lib/design/actions";
import { BannerSetupForm } from "@/components/editor/banner-setup-form";

export default async function CreateBannerSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string }>;
}) {
  const workspace = await requireActiveWorkspace();
  const { asset: backgroundAssetId } = await searchParams;
  const [brands, presets] = await Promise.all([
    getBrands(workspace.workspaceId),
    getSizePresets(workspace.workspaceId),
  ]);
  const activeBrands = brands.filter((b) => b.status === "active");

  // "Tạo banner" (sidebar/dashboard/mobile-nav — every entry point that
  // doesn't name a specific background asset) always opens a brand-new
  // draft straight in the editor, no setup step first — see PRD request.
  // This reuses the EXACT same createBannerAsset() the setup form itself
  // calls, just with the first active brand/preset as sensible defaults
  // instead of a user pick, so it's a real persisted draft (status
  // 'draft'), never a fake/local-only one. The `?asset=` deep links from
  // Library/job-status (reusing a SPECIFIC existing image as background)
  // still render the setup form below unchanged — that's a genuinely
  // different flow (confirm brand/size for a chosen background), not
  // something this redirect should swallow.
  if (!backgroundAssetId && activeBrands[0] && presets[0]) {
    const created = await createBannerAsset({
      brandId: activeBrands[0].id,
      sizePresetId: presets[0].id,
      backgroundAssetId: null,
      templateId: null,
    });
    if (created.ok) redirect(`/create/banner/${created.data.assetId}`);
  }

  const models = listAvailableModels().map((m) => ({
    id: m.id,
    label: m.label,
    description: m.description,
    maxPromptLength: m.capabilities.maxPromptLength,
    maxReferenceImages: m.capabilities.maxReferenceImages,
    supportsAspectRatioResolution: m.capabilities.supportsAspectRatioResolution,
    supportsPromptEnhancement: m.capabilities.supportsPromptEnhancement,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Tạo banner</h1>
        <p className="text-sm text-muted-foreground">Chọn thương hiệu, kích thước và ảnh nền để bắt đầu</p>
      </div>

      <BannerSetupForm
        brands={brands.filter((b) => b.status === "active")}
        presets={presets}
        initialBackgroundAssetId={backgroundAssetId ?? null}
        models={models}
      />
    </div>
  );
}
