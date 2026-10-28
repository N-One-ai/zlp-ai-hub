import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getBrands, getSizePresets } from "@/lib/brand/queries";
import { listAvailableModels } from "@/lib/generation/providers";
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
