import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getBrands, getSizePresets } from "@/lib/brand/queries";
import { listAvailableModels } from "@/lib/generation/providers";
import { getCharacters } from "@/lib/generation/character-queries";
import { CharacterBuilder } from "@/components/generate/character-builder";

export default async function CreateCharacterPage() {
  const workspace = await requireActiveWorkspace();
  const [brands, presets, characters] = await Promise.all([
    getBrands(workspace.workspaceId),
    getSizePresets(workspace.workspaceId),
    getCharacters(workspace.workspaceId),
  ]);

  const activeBrands = brands.filter((b) => b.status === "active");
  const brandId = activeBrands[0]?.id ?? null;

  // Same shape ImageComposer already receives — see create/image/page.tsx.
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
        <h1 className="font-heading text-2xl font-bold tracking-tight">Xây dựng nhân vật</h1>
        <p className="text-sm text-muted-foreground">
          Khóa một khuôn mặt và tạo bảng nhân vật nhiều góc chụp (chính diện / nghiêng / phía sau) nhất quán, dùng lại
          cho các lần tạo ảnh sau.
        </p>
      </div>

      {activeBrands.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Workspace chưa có thương hiệu nào. Liên hệ Admin để tạo thương hiệu trước — Creative Hub cần ít nhất một
          thương hiệu để lưu ảnh tạo ra vào thư viện.
        </p>
      ) : (
        <CharacterBuilder brandId={brandId} presets={presets} models={models} initialCharacters={characters} />
      )}
    </div>
  );
}
