import Link from "next/link";
import { Palette } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { requireWorkspaceAdmin } from "@/lib/workspace/guards";
import { getBrands } from "@/lib/brand/queries";
import { BrandFormDialog } from "@/components/brand/brand-form-dialog";

export default async function BrandsPage() {
  const workspace = await requireWorkspaceAdmin();
  const brands = await getBrands(workspace.workspaceId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Thương hiệu</h1>
          <p className="text-sm text-muted-foreground">Quản lý thương hiệu và brand guideline</p>
        </div>
        <BrandFormDialog workspaceId={workspace.workspaceId} />
      </div>

      {brands.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Palette className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Chưa có thương hiệu nào. Tạo thương hiệu đầu tiên để bắt đầu cấu hình guideline.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((brand) => (
            <Link key={brand.id} href={`/brands/${brand.id}`}>
              <Card className="h-full hover:bg-accent/40 transition-colors">
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8 shrink-0">
                      {brand.avatarUrl && <AvatarImage src={brand.avatarUrl} alt={brand.name} />}
                      <AvatarFallback className="text-xs">{brand.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium truncate flex-1">{brand.name}</span>
                    {brand.status === "archived" && <Badge variant="outline">Đã lưu trữ</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {brand.description || "Chưa có mô tả."}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
