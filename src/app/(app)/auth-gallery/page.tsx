import { requireWorkspaceAdmin } from "@/lib/workspace/guards";
import { getAllAuthGalleryImages, getAuthGallerySettings } from "@/lib/auth-gallery/queries";
import { getLibraryAssets } from "@/lib/library/queries";
import { AuthGalleryManager } from "@/components/auth/auth-gallery-manager";

export default async function AuthGalleryAdminPage() {
  // Reuses the existing per-workspace admin gate — the resource itself is
  // global (shared by /login and /register across every workspace), see
  // migration 0016_auth_gallery.sql for why there's no separate
  // platform-admin role to check against instead.
  const workspace = await requireWorkspaceAdmin();

  const [images, settings, libraryPage] = await Promise.all([
    getAllAuthGalleryImages(),
    getAuthGallerySettings(),
    getLibraryAssets(workspace.workspaceId, { page: 1, sort: "newest", type: "image" }),
  ]);

  return (
    <AuthGalleryManager
      images={images}
      isEnabled={settings.isEnabled}
      libraryAssets={libraryPage.assets}
    />
  );
}
