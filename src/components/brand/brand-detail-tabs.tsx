"use client";

import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandReadinessBanner } from "@/components/brand/brand-readiness-banner";
import type { BrandReadiness } from "@/types/brand";

/** Lifts tab selection to state (instead of Tabs' own uncontrolled
 * defaultValue) so BrandReadinessBanner's missing-config links can jump
 * straight to the tab that fixes them — see brand-readiness-banner.tsx. */
export function BrandDetailTabs({
  readiness,
  profile,
  guideline,
  presets,
  templates,
}: {
  readiness: BrandReadiness;
  profile: ReactNode;
  guideline: ReactNode;
  presets: ReactNode;
  templates: ReactNode;
}) {
  const [tab, setTab] = useState("profile");

  return (
    <div className="flex flex-col gap-6">
      <BrandReadinessBanner readiness={readiness} onNavigate={setTab} />

      <Tabs value={tab} onValueChange={(v) => v && setTab(v as string)}>
        <TabsList>
          <TabsTrigger value="profile">Hồ sơ</TabsTrigger>
          <TabsTrigger value="guideline">Guideline</TabsTrigger>
          <TabsTrigger value="presets">Preset kích thước</TabsTrigger>
          <TabsTrigger value="templates">Mẫu banner</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="pt-4">
          {profile}
        </TabsContent>
        <TabsContent value="guideline" className="pt-4">
          {guideline}
        </TabsContent>
        <TabsContent value="presets" className="pt-4">
          {presets}
        </TabsContent>
        <TabsContent value="templates" className="pt-4">
          {templates}
        </TabsContent>
      </Tabs>
    </div>
  );
}
