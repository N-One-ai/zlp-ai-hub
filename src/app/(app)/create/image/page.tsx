import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getBrands, getSizePresets } from "@/lib/brand/queries";
import { getLibraryAssets } from "@/lib/library/queries";
import { getGeneratedImageGallery } from "@/lib/generation/queries";
import { listAvailableModels } from "@/lib/generation/providers";
import { ImageComposer } from "@/components/generate/image-composer";

export default async function CreateImagePage() {
  const workspace = await requireActiveWorkspace();
  const [brands, presets, elementsPage, gallery] = await Promise.all([
    getBrands(workspace.workspaceId),
    getSizePresets(workspace.workspaceId),
    getLibraryAssets(workspace.workspaceId, { type: "image", page: 1 }),
    getGeneratedImageGallery(workspace.workspaceId),
  ]);

  const activeBrands = brands.filter((b) => b.status === "active");
  const brandId = activeBrands[0]?.id ?? null;

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
        <h1 className="font-heading text-2xl font-bold tracking-tight">Tạo ảnh</h1>
        <p className="text-sm text-muted-foreground">Tạo ảnh bằng AI theo model và kích thước đã chọn</p>
      </div>

      {activeBrands.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Workspace chưa có thương hiệu nào. Liên hệ Admin để tạo thương hiệu trước — Creative Hub cần ít nhất một
          thương hiệu để lưu ảnh tạo ra vào thư viện.
        </p>
      ) : (
        <ImageComposer
          brandId={brandId}
          presets={presets}
          models={models}
          elements={elementsPage.assets}
          initialGallery={gallery}
        />
      )}
    </div>
  );
}
