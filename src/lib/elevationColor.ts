// Shared elevation decode/colorize helpers — used to turn the terrain-RGB
// tiles (data/akmola-terrain.mbtiles, elevation encoded per the standard
// Mapbox formula: -10000 + (R*65536 + G*256 + B) * 0.1) into a hypsometric
// color, with the color ramp scaled to whatever min/max is passed in — that's
// what makes the relief layer rescale per current viewport instead of using
// one fixed range for the whole region.

import sharp from "sharp";

// Same visual progression as before (deep green -> yellow -> brown -> white),
// expressed as relative position (0 = min, 1 = max) instead of absolute
// elevations, so the same ramp shape works for any min/max range.
export const RELATIVE_STOPS: { t: number; rgb: [number, number, number] }[] = [
  { t: 0,    rgb: [34, 85, 51] },
  { t: 0.12, rgb: [76, 153, 76] },
  { t: 0.20, rgb: [154, 191, 94] },
  { t: 0.27, rgb: [216, 209, 112] },
  { t: 0.34, rgb: [222, 173, 105] },
  { t: 0.43, rgb: [199, 134, 84] },
  { t: 0.57, rgb: [163, 101, 68] },
  { t: 0.75, rgb: [140, 96, 82] },
  { t: 1.0,  rgb: [245, 245, 240] },
];

export function colorForFraction(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RELATIVE_STOPS.length; i++) {
    const a = RELATIVE_STOPS[i - 1];
    const b = RELATIVE_STOPS[i];
    if (clamped <= b.t) {
      const localT = (clamped - a.t) / (b.t - a.t || 1);
      return [
        Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * localT),
        Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * localT),
        Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * localT),
      ];
    }
  }
  return RELATIVE_STOPS[RELATIVE_STOPS.length - 1].rgb;
}

// Decodes a terrain-RGB PNG tile buffer into a plain elevation-per-pixel array.
export async function decodeElevationTile(
  pngBuffer: Buffer,
): Promise<{ elevations: Float32Array; width: number; height: number }> {
  const { data, info } = await sharp(pngBuffer).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const elevations = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    elevations[i] = -10000 + (r * 65536 + g * 256 + b) * 0.1;
  }
  return { elevations, width, height };
}

// The /stats endpoint (viewport bbox -> min/max) and the tile route decode
// the same tiles over and over as the user pans — each decode spins up a
// sharp/libvips pipeline, and doing that unbounded pushed the Next dev
// server over its memory threshold and forced a self-restart. Small bounded
// cache (insertion-order eviction, good enough as a rough LRU here) fixes it.
type DecodedTile = { elevations: Float32Array; width: number; height: number };
const decodedCache = new Map<string, DecodedTile>();
const MAX_CACHE_ENTRIES = 60;

export async function decodeElevationTileCached(key: string, pngBuffer: Buffer): Promise<DecodedTile> {
  const cached = decodedCache.get(key);
  if (cached) return cached;
  const result = await decodeElevationTile(pngBuffer);
  decodedCache.set(key, result);
  if (decodedCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = decodedCache.keys().next().value;
    if (oldestKey !== undefined) decodedCache.delete(oldestKey);
  }
  return result;
}

export async function colorizeElevations(
  elevations: Float32Array,
  width: number,
  height: number,
  min: number,
  max: number,
): Promise<Buffer> {
  const span = max - min || 1;
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < elevations.length; i++) {
    const t = (elevations[i] - min) / span;
    const [r, g, b] = colorForFraction(t);
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  return sharp(rgb, { raw: { width, height, channels: 3 } }).png().toBuffer();
}
