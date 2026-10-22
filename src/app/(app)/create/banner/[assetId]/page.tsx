import { notFound } from "next/navigation";
import Link from "next/link";
import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getBannerAsset, getCurrentDesignDocument } from "@/lib/design/queries";
import { getCurrentGuideline, getBrand, getSizePreset } from "@/lib/brand/queries";
import { EditorShell } from "@/components/editor/editor-shell";

export default async function BannerEditorPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const workspace = await requireActiveWorkspace();

  const asset = await getBannerAsset(assetId);
  if (!asset || asset.workspaceId !== workspace.workspaceId) notFound();

  const [document, guideline, brand] = await Promise.all([
    getCurrentDesignDocument(assetId),
    getCurrentGuideline(asset.brandId),
    getBrand(asset.brandId),
  ]);
  if (!document) notFound();

  const preset = document.sizePresetId ? await getSizePreset(document.sizePresetId) : null;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/library" className="text-sm text-muted-foreground hover:text-foreground w-fit">
        ← Thư viện
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">{asset.name || "Banner chưa đặt tên"}</h1>

      <EditorShell
        assetId={asset.id}
        brandId={asset.brandId}
        brandName={brand?.name ?? "thuong-hieu"}
        assetName={asset.name}
        presetName={preset?.name ?? null}
        documentId={document.id}
        documentVersion={document.version}
        presetWidth={document.width}
        presetHeight={document.height}
        initialLayers={document.layers}
        guideline={guideline}
      />
    </div>
  );
}
