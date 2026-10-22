"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics/track";
import type { CreativeAssetType } from "@/types/database";

export function DownloadAssetButton({
  assetId,
  assetType,
  url,
}: {
  assetId: string;
  assetType: CreativeAssetType;
  url: string;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      nativeButton={false}
      render={
        <a
          href={url}
          download
          onClick={() => void trackEvent({ name: "asset_downloaded", assetId, assetType })}
        />
      }
    >
      <Download className="size-3.5" />
      Tải xuống
    </Button>
  );
}
