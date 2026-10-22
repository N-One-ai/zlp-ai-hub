import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getBrands, getSizePresets, getCurrentGuideline } from "@/lib/brand/queries";
import { getGenerationJob } from "@/lib/generation/queries";
import { ImageGenerateForm } from "@/components/generate/image-generate-form";

export default async function CreateImagePage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const workspace = await requireActiveWorkspace();
  const { job: jobId } = await searchParams;
  const [brands, presets, initialJob] = await Promise.all([
    getBrands(workspace.workspaceId),
    getSizePresets(workspace.workspaceId),
    jobId ? getGenerationJob(jobId) : Promise.resolve(null),
  ]);

  const activeBrands = brands.filter((b) => b.status === "active");
  const guidelines = await Promise.all(activeBrands.map((b) => getCurrentGuideline(b.id)));
  const brandColors: Record<string, string[]> = {};
  activeBrands.forEach((b, i) => {
    brandColors[b.id] = (guidelines[i]?.colors ?? []).map((c) => c.hex);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Tạo ảnh</h1>
        <p className="text-sm text-muted-foreground">Tạo ảnh bằng AI theo thương hiệu và kích thước đã chọn</p>
      </div>

      <ImageGenerateForm brands={activeBrands} presets={presets} brandColors={brandColors} initialJob={initialJob} />
    </div>
  );
}
