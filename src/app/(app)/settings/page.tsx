import Link from "next/link";
import { Palette, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getCurrentUser } from "@/lib/workspace/queries";

export default async function SettingsPage() {
  const [workspace, user] = await Promise.all([requireActiveWorkspace(), getCurrentUser()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cài đặt</h1>
        <p className="text-sm text-muted-foreground">{workspace.workspaceName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tài khoản</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{user?.name || "—"}</span>
          <span className="text-muted-foreground">{user?.email}</span>
        </CardContent>
      </Card>

      {/* Lối tắt admin cho mobile — Thương hiệu/Thành viên không có slot
          riêng trong bottom nav (xem mobile-nav.tsx). */}
      {workspace.role === "admin" && (
        <Card className="md:hidden">
          <CardHeader>
            <CardTitle className="text-base">Quản trị workspace</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <Link href="/brands" className="flex items-center gap-2 py-2 text-sm">
              <Palette className="size-4" />
              Thương hiệu
            </Link>
            <Link href="/members" className="flex items-center gap-2 py-2 text-sm">
              <Users className="size-4" />
              Thành viên
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
