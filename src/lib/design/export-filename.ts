function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

/** PRD §8.5: "Tên file mặc định dễ nhận biết: thương hiệu, chiến dịch/tên
 * tài sản, preset và phiên bản." Shared by the editor's own "Xuất" button
 * AND the size-variants panel's per-variant/batch export (banner-
 * variants-panel.tsx) so a variant's exported filename is distinguishable
 * by its OWN name/preset exactly the same way a normal export already is —
 * not a second, slightly different naming scheme. */
export function buildExportFilename(
  brandName: string,
  assetName: string,
  presetName: string | null,
  version: number,
  format: string
): string {
  const parts = [slugify(brandName), slugify(assetName || "banner"), presetName ? slugify(presetName) : null, `v${version}`];
  return `${parts.filter(Boolean).join("-")}.${format}`;
}
