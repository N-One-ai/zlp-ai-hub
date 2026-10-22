import type { AIImageProvider, GenerateImageParams, GeneratedImage } from "./types";

/**
 * Default provider when no real AI image API key is configured — returns
 * a clearly-labeled SVG placeholder, never a real generated image. This
 * is the honest default, not a degraded fallback: PRD §18 explicitly
 * forbids claiming real generation happened when no provider is set up.
 *
 * Deliberately zero new dependencies — SVG is plain text, so this needs
 * no image/canvas library to produce a real, renderable image file.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxCharsPerLine) {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
  }
  return lines;
}

function buildPlaceholderSvg(width: number, height: number, prompt: string, index: number, total: number): string {
  const lines = wrapText(prompt, 36, 4);
  const centerX = width / 2;
  const startY = height / 2 - ((lines.length - 1) * 28) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e5e5" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="#f5f5f4"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>
  <rect x="16" y="16" width="${width - 32}" height="${height - 32}" fill="none" stroke="#d4d4d4" stroke-width="2" stroke-dasharray="8 6"/>
  <text x="${centerX}" y="56" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700" fill="#a16207" letter-spacing="2">DEMO</text>
  <text x="${centerX}" y="80" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#a8a29e">Chưa cấu hình AI provider thật — ảnh minh hoạ ${index}/${total}</text>
  ${lines
    .map((line, i) => `<text x="${centerX}" y="${startY + i * 28}" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#44403c">${escapeXml(line)}</text>`)
    .join("\n  ")}
  <text x="${centerX}" y="${height - 28}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#a8a29e">${width}×${height}px</text>
</svg>`;
}

export class DemoImageProvider implements AIImageProvider {
  readonly id = "demo";

  async generateImages(params: GenerateImageParams): Promise<GeneratedImage[]> {
    const results: GeneratedImage[] = [];
    for (let i = 0; i < params.count; i++) {
      const svg = buildPlaceholderSvg(params.width, params.height, params.prompt, i + 1, params.count);
      results.push({
        bytes: Buffer.from(svg, "utf-8"),
        contentType: "image/svg+xml",
        width: params.width,
        height: params.height,
        isDemo: true,
      });
    }
    return results;
  }
}
