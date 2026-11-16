/** Reads a File's natural pixel size client-side, before/alongside
 * uploading it — used right after selection so the form can warn about a
 * ratio/size mismatch immediately, and so the real dimensions get saved
 * with the banner (lib/dashboard/schema.ts's imageWidth/imageHeight)
 * instead of guessed or left null. */
export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được kích thước ảnh."));
    };
    img.src = url;
  });
}
