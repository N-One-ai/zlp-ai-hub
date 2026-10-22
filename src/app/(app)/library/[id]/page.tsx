import { notFound } from "next/navigation";
import Link from "next/link";
import { LayoutTemplate, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getAssetDetail } from "@/lib/library/queries";
import { getCurrentUser } from "@/lib/workspace/queries";
import { DeleteAssetButton } from "@/components/library/delete-asset-button";
import { DownloadAssetButton } from "@/components/library/download-asset-button";

const STATUS_LABEL = { draft: "Nháp", ready: "Hoàn tất", archived: "Lưu trữ" } as const;
const TYPE_LABEL = { image: "Ảnh", banner: "Banner", video: "Video" } as const;

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();

  const [asset, user] = await Promise.all([getAssetDetail(id), getCurrentUser()]);
  if (!asset) notFound();

  const canManage = workspace.role === "admin" || asset.ownerId === user?.id;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/library" className="text-sm text-muted-foreground hover:text-foreground w-fit">
        ← Thư viện
      </Link>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/30 overflow-hidden flex items-center justify-center min-h-64">
            {asset.fileUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
              <img src={asset.fileUrl} alt={asset.name} className="max-w-full max-h-[70vh] object-contain" />
            ) : (
              <p className="text-sm text-muted-foreground py-16">Chưa có file.</p>
            )}
          </div>

          {asset.prompt && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{asset.prompt}</p>
              </CardContent>
            </Card>
          )}

          {asset.versions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Lịch sử phiên bản</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y">
                {asset.versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between py-2 text-sm">
                    <span>Phiên bản {v.version}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{asset.name || "Chưa đặt tên"}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Loại</dt>
                <dd>{TYPE_LABEL[asset.type]}</dd>
                <dt className="text-muted-foreground">Thương hiệu</dt>
                <dd>{asset.brandName}</dd>
                <dt className="text-muted-foreground">Kích thước</dt>
                <dd>{asset.width && asset.height ? `${asset.width}×${asset.height}px` : "—"}</dd>
                <dt className="text-muted-foreground">Người tạo</dt>
                <dd>{asset.ownerName}</dd>
                <dt className="text-muted-foreground">Ngày tạo</dt>
                <dd>{new Date(asset.createdAt).toLocaleDateString("vi-VN")}</dd>
                <dt className="text-muted-foreground">Trạng thái</dt>
                <dd>
                  <Badge variant="secondary">{STATUS_LABEL[asset.status]}</Badge>
                </dd>
                {asset.campaign && (
                  <>
                    <dt className="text-muted-foreground">Chiến dịch</dt>
                    <dd>{asset.campaign}</dd>
                  </>
                )}
              </dl>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            {asset.fileUrl && <DownloadAssetButton assetId={asset.id} assetType={asset.type} url={asset.fileUrl} />}
            {asset.type === "banner" && canManage && (
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/create/banner/${asset.id}`} />}>
                <LayoutTemplate className="size-3.5" />
                Mở trong trình chỉnh sửa
              </Button>
            )}
            {asset.type === "image" && (
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/create/banner?asset=${asset.id}`} />}>
                <Sparkles className="size-3.5" />
                Dùng làm ảnh nền banner
              </Button>
            )}
            {canManage && <DeleteAssetButton assetId={asset.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}
