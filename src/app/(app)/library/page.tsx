import Link from "next/link";
import { Library as LibraryIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getBrands } from "@/lib/brand/queries";
import { getWorkspaceMembers } from "@/lib/workspace/queries";
import { getLibraryAssets } from "@/lib/library/queries";
import { LibraryFilters } from "@/components/library/library-filters";
import { AssetGrid } from "@/components/library/asset-grid";
import { LibraryPagination } from "@/components/library/library-pagination";
import type { CreativeAssetStatus, CreativeAssetType } from "@/types/database";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    type?: string;
    brandId?: string;
    ownerId?: string;
    status?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const workspace = await requireActiveWorkspace();
  const sp = await searchParams;

  const filters = {
    search: sp.search,
    type: (sp.type as CreativeAssetType | undefined) || undefined,
    brandId: sp.brandId || undefined,
    ownerId: sp.ownerId || undefined,
    status: (sp.status as CreativeAssetStatus | undefined) || undefined,
    sort: (sp.sort as "newest" | "oldest" | undefined) || "newest",
    page: Number(sp.page) || 1,
  };

  const [result, brands, members] = await Promise.all([
    getLibraryAssets(workspace.workspaceId, filters),
    getBrands(workspace.workspaceId),
    getWorkspaceMembers(workspace.workspaceId),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  function buildHref(targetPage: number): string {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.type) params.set("type", filters.type);
    if (filters.brandId) params.set("brandId", filters.brandId);
    if (filters.ownerId) params.set("ownerId", filters.ownerId);
    if (filters.status) params.set("status", filters.status);
    if (filters.sort) params.set("sort", filters.sort);
    params.set("page", String(targetPage));
    return `/library?${params.toString()}`;
  }

  const hasActiveFilters = !!(filters.search || filters.type || filters.brandId || filters.ownerId || filters.status);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Thư viện</h1>
        <p className="text-sm text-muted-foreground">
          {result.total} tài sản{filters.sort === "oldest" ? " · cũ nhất trước" : ""}
        </p>
      </div>

      <LibraryFilters brands={brands.filter((b) => b.status === "active")} members={members} />

      {result.error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-sm text-muted-foreground">Không thể tải thư viện.</p>
            <Link href="/library" className="text-sm font-medium text-primary hover:underline">
              Thử lại
            </Link>
          </CardContent>
        </Card>
      ) : result.assets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <LibraryIcon className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? "Không có tài sản khớp bộ lọc." : "Chưa có tài sản nào — tạo ảnh hoặc banner đầu tiên."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <AssetGrid assets={result.assets} />
          <LibraryPagination page={result.page} totalPages={totalPages} buildHref={buildHref} />
        </>
      )}
    </div>
  );
}
