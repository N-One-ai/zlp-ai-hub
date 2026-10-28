import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspaceAdmin } from "@/lib/workspace/guards";
import { getBrand, getCurrentGuideline, computeBrandReadiness, getSizePresets, getTemplates } from "@/lib/brand/queries";
import { BrandDetailTabs } from "@/components/brand/brand-detail-tabs";
import { BrandProfileForm } from "@/components/brand/brand-profile-form";
import { BrandGuidelineEditor } from "@/components/brand/brand-guideline-editor";
import { SizePresetsManager } from "@/components/brand/size-presets-manager";
import { TemplatesManager } from "@/components/brand/templates-manager";

export default async function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireWorkspaceAdmin();

  const brand = await getBrand(id);
  if (!brand || brand.workspaceId !== workspace.workspaceId) notFound();

  const [guideline, presets, templates] = await Promise.all([
    getCurrentGuideline(id),
    getSizePresets(workspace.workspaceId),
    getTemplates(id),
  ]);

  const readiness = computeBrandReadiness(guideline, presets.length);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/brands" className="text-sm text-muted-foreground hover:text-foreground w-fit">
        ← Thương hiệu
      </Link>

      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">{brand.name}</h1>
        <p className="text-sm text-muted-foreground">{brand.description || "Chưa có mô tả."}</p>
      </div>

      <BrandDetailTabs
        readiness={readiness}
        profile={
          <Card>
            <CardContent>
              <BrandProfileForm workspaceId={workspace.workspaceId} brand={brand} avatarUrl={brand.avatarUrl} />
            </CardContent>
          </Card>
        }
        guideline={<BrandGuidelineEditor workspaceId={workspace.workspaceId} brandId={brand.id} guideline={guideline} />}
        presets={
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preset kích thước (dùng chung cho toàn workspace)</CardTitle>
            </CardHeader>
            <CardContent>
              <SizePresetsManager workspaceId={workspace.workspaceId} presets={presets} />
            </CardContent>
          </Card>
        }
        templates={
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mẫu banner của {brand.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <TemplatesManager brandId={brand.id} templates={templates} presets={presets} />
            </CardContent>
          </Card>
        }
      />
    </div>
  );
}
