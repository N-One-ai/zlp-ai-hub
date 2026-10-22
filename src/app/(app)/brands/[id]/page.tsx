import Link from "next/link";
import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspaceAdmin } from "@/lib/workspace/guards";
import { getBrand, getCurrentGuideline, computeBrandReadiness, getSizePresets, getTemplates } from "@/lib/brand/queries";
import { BrandReadinessBanner } from "@/components/brand/brand-readiness-banner";
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
        <h1 className="text-xl font-semibold tracking-tight">{brand.name}</h1>
        <p className="text-sm text-muted-foreground">{brand.description || "Chưa có mô tả."}</p>
      </div>

      <BrandReadinessBanner readiness={readiness} />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Hồ sơ</TabsTrigger>
          <TabsTrigger value="guideline">Guideline</TabsTrigger>
          <TabsTrigger value="presets">Preset kích thước</TabsTrigger>
          <TabsTrigger value="templates">Mẫu banner</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="pt-4">
          <Card>
            <CardContent>
              <BrandProfileForm workspaceId={workspace.workspaceId} brand={brand} avatarUrl={brand.avatarUrl} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guideline" className="pt-4">
          <BrandGuidelineEditor workspaceId={workspace.workspaceId} brandId={brand.id} guideline={guideline} />
        </TabsContent>

        <TabsContent value="presets" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preset kích thước (dùng chung cho toàn workspace)</CardTitle>
            </CardHeader>
            <CardContent>
              <SizePresetsManager workspaceId={workspace.workspaceId} presets={presets} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mẫu banner của {brand.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <TemplatesManager brandId={brand.id} templates={templates} presets={presets} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
