import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getBrands, getSizePresets } from "@/lib/brand/queries";
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Tạo banner</h1>
        <p className="text-sm text-muted-foreground">Chọn thương hiệu, kích thước và ảnh nền để bắt đầu</p>
      </div>

      <BannerSetupForm
        brands={brands.filter((b) => b.status === "active")}
        presets={presets}
        initialBackgroundAssetId={backgroundAssetId ?? null}
      />
    </div>
  );
}
