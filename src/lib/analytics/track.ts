"use server";

import { createClient } from "@/lib/supabase/server";
import type { AnalyticsEvent } from "./events";

/**
 * No third-party analytics provider is configured in Phase 1 (PRD §17
 * left this unspecified) — this logs a structured, server-side line as
 * the sink for now. Swap the body for a real provider call later
 * (PostHog/Segment/etc.) without touching any call site, since every
 * event already goes through this one function.
 *
 * Never logs prompt text or other free-form user content — only the
 * typed, deliberately minimal properties in AnalyticsEvent (PRD §14:
 * "không gửi prompt hoặc nội dung nhạy cảm vào analytics... theo mặc
 * định").
 */
export async function trackEvent(
  event: AnalyticsEvent,
  context?: { userId?: string; workspaceId?: string }
): Promise<void> {
  let userId = context?.userId;
  const workspaceId = context?.workspaceId;

  if (!userId) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
  }

  console.log(
    JSON.stringify({
      type: "analytics_event",
      event: event.name,
      userId: userId ?? null,
      workspaceId: workspaceId ?? null,
      at: new Date().toISOString(),
      ...event,
    })
  );
}
