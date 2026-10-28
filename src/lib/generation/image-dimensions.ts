/**
 * Reads real pixel dimensions straight from image bytes (PNG/JPEG/WebP
 * headers) instead of trusting whatever size a caller asked a provider
 * for. A provider's output is not guaranteed to match the requested size
 * unless it's independently checked — this is that check.
 */
export function readImageDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (isPng(bytes)) return readPngDimensions(bytes);
  if (isJpeg(bytes)) return readJpegDimensions(bytes);
  if (isWebp(bytes)) return readWebpDimensions(bytes);
  if (isSvg(bytes)) return readSvgDimensions(bytes);
  return null;
}

function isSvg(bytes: Buffer): boolean {
  // SVGs are text, not a fixed binary signature — sniff the first chunk
  // for a "<svg" tag (optionally after an XML prolog/comments/whitespace),
  // same way browsers/libraries detect SVG without a full XML parse.
  return /<svg[\s>]/i.test(bytes.subarray(0, 2048).toString("utf8"));
}

function readSvgDimensions(bytes: Buffer): { width: number; height: number } | null {
  const head = bytes.subarray(0, 4096).toString("utf8");
  const svgTagMatch = head.match(/<svg[^>]*>/i);
  const svgTag = svgTagMatch?.[0] ?? head;

  const widthMatch = svgTag.match(/\bwidth="([\d.]+)(?:px)?"/i);
  const heightMatch = svgTag.match(/\bheight="([\d.]+)(?:px)?"/i);
  if (widthMatch && heightMatch) {
    const width = parseFloat(widthMatch[1]);
    const height = parseFloat(heightMatch[1]);
    if (width > 0 && height > 0) return { width, height };
  }

  // No explicit width/height (common for logos meant to scale freely) —
  // fall back to the viewBox's aspect ratio, expressed at its own box
  // size; callers that only need the RATIO (not absolute pixels) still
  // get a correct answer this way.
  const viewBoxMatch = svgTag.match(/\bviewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*"/i);
  if (viewBoxMatch) {
    const width = parseFloat(viewBoxMatch[1]);
    const height = parseFloat(viewBoxMatch[2]);
    if (width > 0 && height > 0) return { width, height };
  }
  return null;
}

function isPng(bytes: Buffer): boolean {
  return (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function readPngDimensions(bytes: Buffer): { width: number; height: number } {
  // IHDR is always the first chunk, right after the 8-byte signature:
  // [length(4)][type(4)="IHDR"][width(4)][height(4)]...
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** PNG color type byte (IHDR offset 25): 0 grayscale, 2 RGB, 3 palette,
 * 4 grayscale+alpha, 6 RGBA. Only 4/6 carry a real alpha channel. Used to
 * check whether a provider's raw output genuinely has transparency BEFORE
 * running any local cutout heuristic on it — confirmed live (2026-10-25)
 * that Higgsfield Marketing Studio's real output is color type 2 (RGB,
 * no alpha) even when prompted for an isolated subject, i.e. this app
 * must never assume alpha without checking. Works on raw bytes, so it's
 * also safe to call client-side (no Buffer-only APIs). */
export function pngHasAlphaChannel(bytes: Uint8Array): boolean | null {
  if (bytes.length < 26 || !(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)) {
    return null; // not a PNG
  }
  const colorType = bytes[25];
  return colorType === 4 || colorType === 6;
}

function isJpeg(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function readJpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    // SOF0..SOF15 (excluding DHT/JPG/DAC markers) carry the frame size.
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    const segmentLength = bytes.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }
  return null;
}

function isWebp(bytes: Buffer): boolean {
  return (
    bytes.length >= 16 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  );
}

function readWebpDimensions(bytes: Buffer): { width: number; height: number } | null {
  const chunkType = bytes.toString("ascii", 12, 16);
  if (chunkType === "VP8X" && bytes.length >= 30) {
    // 24-bit little-endian, stored as (dimension - 1).
    const width = bytes[24] | (bytes[25] << 8) | (bytes[26] << 16);
    const height = bytes[27] | (bytes[28] << 8) | (bytes[29] << 16);
    return { width: width + 1, height: height + 1 };
  }
  if (chunkType === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    // 14 bits width-1, 14 bits height-1, little-endian bit-packed from byte 21.
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }
  if (chunkType === "VP8 " && bytes.length >= 30) {
    // Lossy VP8: 14-bit width/height little-endian at a fixed offset past the frame tag.
    const width = (bytes.readUInt16LE(26) & 0x3fff);
    const height = (bytes.readUInt16LE(28) & 0x3fff);
    return { width, height };
  }
  return null;
}
