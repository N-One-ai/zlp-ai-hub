import { requireWorkspaceAdmin } from "@/lib/workspace/guards";
import { getBrands, getCurrentGuideline, getSizePresets, computeBrandReadiness } from "@/lib/brand/queries";
import { BrandFormDialog } from "@/components/brand/brand-form-dialog";
import { BrandsGrid, type BrandListItem } from "@/components/brand/brands-grid";

export default async function BrandsPage() {
  const workspace = await requireWorkspaceAdmin();
  const [brands, sizePresets] = await Promise.all([
    getBrands(workspace.workspaceId),
    getSizePresets(workspace.workspaceId),
  ]);

  const items: BrandListItem[] = await Promise.all(
    brands.map(async (brand) => {
      const guideline = await getCurrentGuideline(brand.id);
      const readiness = computeBrandReadiness(guideline, sizePresets.length);
      const logoCount = guideline
        ? [guideline.logos.primaryUrl, guideline.logos.secondaryUrl, guideline.logos.lightUrl, guideline.logos.darkUrl].filter(
            Boolean
          ).length
        : 0;
      return {
        brand,
        readiness,
        colorCount: guideline?.colors.length ?? 0,
        logoCount,
        hasFonts: !!(guideline?.fonts.heading || guideline?.fonts.body),
      };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Thương hiệu</h1>
          <p className="text-sm text-muted-foreground">Quản lý thương hiệu và brand guideline</p>
        </div>
        <BrandFormDialog workspaceId={workspace.workspaceId} />
      </div>

      <BrandsGrid items={items} workspaceId={workspace.workspaceId} />
    </div>
  );
}
