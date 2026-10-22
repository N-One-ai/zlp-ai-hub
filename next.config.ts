import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disabled: Cache Components requires every dynamic data access
  // (cookies(), auth session, per-workspace reads) to be explicitly
  // wrapped in Suspense or "use cache" boundaries to prerender at all.
  // Nearly every route in this app is inherently per-user/per-session
  // dynamic (auth, active workspace, RLS-scoped data) — there is very
  // little here that benefits from static prerendering, so the standard
  // per-request dynamic rendering model is the right fit, not an
  // afterthought left unconfigured.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
