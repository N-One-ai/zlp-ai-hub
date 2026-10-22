import Link from "next/link";
import { Image as ImageIcon, LayoutTemplate, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getRecentAssets } from "@/lib/library/queries";
import { getIncompleteJobs } from "@/lib/generation/queries";
import { AssetGrid } from "@/components/library/asset-grid";

export default async function DashboardPage() {
  const workspace = await requireActiveWorkspace();
  const [recentAssets, incompleteJobs] = await Promise.all([
    getRecentAssets(workspace.workspaceId),
    getIncompleteJobs(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{workspace.workspaceName}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="size-4" />
              Tạo ảnh
            </CardTitle>
            <CardDescription>Tạo ảnh bằng AI theo thương hiệu đã chọn.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" nativeButton={false} render={<Link href="/create/image" />}>
              Bắt đầu
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutTemplate className="size-4" />
              Tạo banner
            </CardTitle>
            <CardDescription>Dàn trang banner theo kích thước và guideline.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/create/banner" />}>
              Bắt đầu
            </Button>
          </CardContent>
        </Card>
      </div>

      {incompleteJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tác vụ chưa hoàn tất</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {incompleteJobs.map((job) => (
              <Link
                key={job.id}
                href={`/create/image?job=${job.id}`}
                className="flex items-center gap-2 py-2 text-sm hover:text-foreground"
              >
                <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
                <span className="flex-1 truncate text-muted-foreground">{job.prompt}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tài sản gần đây</CardTitle>
          {recentAssets.length === 0 && (
            <CardDescription>Chưa có tài sản nào. Bắt đầu bằng cách tạo ảnh hoặc banner đầu tiên.</CardDescription>
          )}
        </CardHeader>
        {recentAssets.length > 0 && (
          <CardContent className="flex flex-col gap-3">
            <AssetGrid assets={recentAssets} />
            <Link href="/library" className="text-sm font-medium text-primary hover:underline w-fit">
              Xem tất cả →
            </Link>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
