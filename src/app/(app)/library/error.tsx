"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LibraryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium">Không tải được thư viện</p>
          <p className="mt-0.5 max-w-sm text-sm text-muted-foreground">
            Đã có lỗi xảy ra khi tải dữ liệu. Vui lòng thử lại.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={reset}>
          Thử lại
        </Button>
      </CardContent>
    </Card>
  );
}
