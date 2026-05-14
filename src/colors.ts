import { createImageData } from './imagedata.js';
import { thumbnailLike } from './resample.js';
import type { RGB, RGBA, ImageDataLike } from './types.js';

export const ALPHA_THRESHOLD = 128;

function medianValue(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle]!;
  }
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function downscaleForColorStats(image: ImageDataLike, maxSize = 160): ImageDataLike {
  return thumbnailLike(image, maxSize, 2.0);
}

function isMajorityTransparent(opaqueCount: number, totalCount: number): boolean {
  return opaqueCount <= totalCount / 2;
}

function rgbDistanceSquared(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

export function topOpaqueColors(image: ImageDataLike, limit = 8): RGB[] {
  const sampled = downscaleForColorStats(image, 160);
  const counts = new Map<number, number>();
  for (let i = 0; i < sampled.data.length; i += 4) {
    if (sampled.data[i + 3] < ALPHA_THRESHOLD) continue;
    const key = (sampled.data[i]! << 16) | (sampled.data[i + 1]! << 8) | sampled.data[i + 2]!;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => [(key >> 16) & 255, (key >> 8) & 255, key & 255] as RGB);
}

export function pickBackgroundColor(colors: RGB[]): RGB {
  const candidates: RGB[] = [
    [0, 255, 255],
    [255, 255, 255],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [255, 0, 255],
    [255, 128, 0],
    [128, 0, 255],
    [0, 128, 255],
    [0, 255, 128],
    [255, 0, 128],
  ];

  if (colors.length === 0) return [255, 255, 255];

  let best = candidates[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const score = Math.min(...colors.map(color => rgbDistanceSquared(candidate, color)));
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

export function clampAlpha(image: ImageDataLike, mode: 'rgba' | 'grayscale' = 'rgba'): ImageDataLike {
  const background = pickBackgroundColor(topOpaqueColors(image));
  const out = new Uint8ClampedArray(image.width * image.height * 4);

  for (let i = 0; i < image.data.length; i += 4) {
    const opaque = image.data[i + 3]! >= ALPHA_THRESHOLD;
    const r = opaque ? image.data[i]! : background[0];
    const g = opaque ? image.data[i + 1]! : background[1];
    const b = opaque ? image.data[i + 2]! : background[2];
    const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);

    if (mode === 'grayscale') {
      out[i] = gray;
      out[i + 1] = gray;
      out[i + 2] = gray;
    } else {
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
    }
    out[i + 3] = 255;
  }

  return createImageData(out, image.width, image.height);
}

export function extractAndScaleAlpha(image: ImageDataLike, scaleFactor = 1): Uint8ClampedArray {
  const factor = Math.max(1, Math.round(scaleFactor));
  if (factor === 1) {
    const alpha = new Uint8ClampedArray(image.width * image.height);
    for (let i = 0, p = 0; i < image.data.length; i += 4, p++) alpha[p] = image.data[i + 3]!;
    return alpha;
  }

  const width = image.width * factor;
  const height = image.height * factor;
  const alpha = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    const srcY = Math.floor(y / factor);
    for (let x = 0; x < width; x++) {
      const srcX = Math.floor(x / factor);
      alpha[y * width + x] = image.data[(srcY * image.width + srcX) * 4 + 3]!;
    }
  }
  return alpha;
}

export function getOpaqueCellColor(cellPixels: Uint8ClampedArray): RGBA {
  const counts = new Map<number, number>();
  for (let i = 0; i < cellPixels.length; i += 3) {
    const key = (cellPixels[i]! << 16) | (cellPixels[i + 1]! << 8) | cellPixels[i + 2]!;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let bestKey = 0;
  let bestCount = -1;
  for (const [key, count] of counts.entries()) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }
  return [(bestKey >> 16) & 255, (bestKey >> 8) & 255, bestKey & 255, 255];
}

export function getCellColorWithAlpha(cellPixels: Uint8ClampedArray, cellAlpha: Uint8ClampedArray): RGBA {
  const totalPixels = cellAlpha.length;
  let opaqueCount = 0;
  for (const alpha of cellAlpha) {
    if (alpha >= ALPHA_THRESHOLD) opaqueCount += 1;
  }

  if (isMajorityTransparent(opaqueCount, totalPixels)) {
    return [0, 0, 0, 0];
  }

  return getOpaqueCellColor(cellPixels);
}

function dominantRgbByBinning(rgbPixels: Uint8ClampedArray): RGB {
  const count = rgbPixels.length / 3;
  if (count === 0) return [0, 0, 0];
  if (count === 1) return [rgbPixels[0]!, rgbPixels[1]!, rgbPixels[2]!];
  if (count <= 3) {
    const pickMedian = (channel: number) => {
      const values: number[] = [];
      for (let i = channel; i < rgbPixels.length; i += 3) values.push(rgbPixels[i]!);
      return Math.trunc(medianValue(values));
    };
    return [pickMedian(0), pickMedian(1), pickMedian(2)];
  }

  const binSize = 52;
  const offset = Math.floor(binSize / 2);
  const counts1 = new Uint32Array(125);
  const counts2 = new Uint32Array(125);
  const bins1 = new Uint16Array(count);
  const bins2 = new Uint16Array(count);

  for (let p = 0; p < count; p++) {
    const r = rgbPixels[p * 3]!;
    const g = rgbPixels[p * 3 + 1]!;
    const b = rgbPixels[p * 3 + 2]!;
    const index1 = Math.floor(r / binSize) * 25 + Math.floor(g / binSize) * 5 + Math.floor(b / binSize);
    const r2 = Math.min(r + offset, 255);
    const g2 = Math.min(g + offset, 255);
    const b2 = Math.min(b + offset, 255);
    const index2 =
      Math.floor(r2 / binSize) * 25 +
      Math.floor(g2 / binSize) * 5 +
      Math.floor(b2 / binSize);
    bins1[p] = index1;
    bins2[p] = index2;
    counts1[index1] += 1;
    counts2[index2] += 1;
  }

  let dominant1 = 0;
  let dominant2 = 0;
  for (let i = 1; i < 125; i++) {
    if (counts1[i] > counts1[dominant1]) dominant1 = i;
    if (counts2[i] > counts2[dominant2]) dominant2 = i;
  }

  const useFirst = counts1[dominant1] >= counts2[dominant2];
  const dominant = useFirst ? dominant1 : dominant2;
  const bins = useFirst ? bins1 : bins2;

  const channels: [number[], number[], number[]] = [[], [], []];
  for (let p = 0; p < count; p++) {
    if (bins[p] !== dominant) continue;
    channels[0].push(rgbPixels[p * 3]!);
    channels[1].push(rgbPixels[p * 3 + 1]!);
    channels[2].push(rgbPixels[p * 3 + 2]!);
  }

  const median = (values: number[]) => Math.trunc(medianValue(values));

  return [median(channels[0]), median(channels[1]), median(channels[2])];
}

export function getCellColorSkipQuantization(
  cellPixels: Uint8ClampedArray,
  alphaThreshold = ALPHA_THRESHOLD
): RGBA {
  const totalPixels = cellPixels.length / 4;
  if (totalPixels === 0) return [0, 0, 0, 0];

  const rgb: number[] = [];
  let opaqueCount = 0;
  for (let i = 0; i < cellPixels.length; i += 4) {
    if (cellPixels[i + 3]! < alphaThreshold) continue;
    opaqueCount += 1;
    rgb.push(cellPixels[i]!, cellPixels[i + 1]!, cellPixels[i + 2]!);
  }

  if (isMajorityTransparent(opaqueCount, totalPixels)) {
    return [0, 0, 0, 0];
  }

  const [r, g, b] = dominantRgbByBinning(Uint8ClampedArray.from(rgb));
  return [r, g, b, 255];
}

export async function paletteImage(image: ImageDataLike, numColors = 16): Promise<ImageDataLike> {
  return paletteImageMaxCoverage(image, numColors);
}

type UniquePixel = {
  b: number;
  g: number;
  key: number;
  nearestDistance: number;
  r: number;
};

function distanceSq(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function buildUniquePixels(image: ImageDataLike): { pixels: UniquePixel[]; mean: RGB } {
  const unique = new Map<number, UniquePixel>();
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  const totalPixels = image.width * image.height;

  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i]!;
    const g = image.data[i + 1]!;
    const b = image.data[i + 2]!;
    const key = (r << 16) | (g << 8) | b;
    if (!unique.has(key)) {
      unique.set(key, { key, r, g, b, nearestDistance: Number.POSITIVE_INFINITY });
    }
    sumR += r;
    sumG += g;
    sumB += b;
  }

  const mean: RGB = [
    Math.floor(0.5 + sumR / totalPixels),
    Math.floor(0.5 + sumG / totalPixels),
    Math.floor(0.5 + sumB / totalPixels),
  ];
  return { pixels: Array.from(unique.values()), mean };
}

function chooseMaxCoveragePalette(uniquePixels: UniquePixel[], count: number, mean: RGB): RGB[] {
  if (uniquePixels.length === 0) return [];
  const palette: RGB[] = [];
  let currentCenter: RGB = mean;

  for (let paletteIndex = 0; paletteIndex < count && paletteIndex < uniquePixels.length; paletteIndex++) {
    let furthest: UniquePixel | null = null;
    let furthestDistance = -1;
    const forceReplace = paletteIndex === 1;

    for (const pixel of uniquePixels) {
      const nextDistance = distanceSq([pixel.r, pixel.g, pixel.b], currentCenter);
      if (forceReplace || nextDistance < pixel.nearestDistance) {
        pixel.nearestDistance = nextDistance;
      }
      if (pixel.nearestDistance > furthestDistance) {
        furthestDistance = pixel.nearestDistance;
        furthest = pixel;
      }
    }

    if (!furthest) break;
    currentCenter = [furthest.r, furthest.g, furthest.b];
    palette.push(currentCenter);
  }

  return palette;
}

export function paletteImageMaxCoverage(image: ImageDataLike, numColors = 16): ImageDataLike {
  const imageRgb = clampAlpha(image, 'rgba');
  const { pixels, mean } = buildUniquePixels(imageRgb);
  const palette = chooseMaxCoveragePalette(pixels, numColors, mean);
  const out = new Uint8ClampedArray(imageRgb.data);

  for (let i = 0; i < out.length; i += 4) {
    let best = palette[0]!;
    let bestDistance = distanceSq([out[i]!, out[i + 1]!, out[i + 2]!], best);
    for (let p = 1; p < palette.length; p++) {
      const color = palette[p]!;
      const d = distanceSq([out[i]!, out[i + 1]!, out[i + 2]!], color);
      if (d < bestDistance) {
        bestDistance = d;
        best = color;
      }
    }
    out[i] = best[0];
    out[i + 1] = best[1];
    out[i + 2] = best[2];
    out[i + 3] = 255;
  }

  return createImageData(out, imageRgb.width, imageRgb.height);
}

export function mostCommonBoundaryColor(image: ImageDataLike): RGB {
  const counts = new Map<number, number>();
  const push = (r: number, g: number, b: number) => {
    const key = (r << 16) | (g << 8) | b;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  for (let x = 0; x < image.width; x++) {
    let i = x * 4;
    push(image.data[i]!, image.data[i + 1]!, image.data[i + 2]!);
    i = ((image.height - 1) * image.width + x) * 4;
    push(image.data[i]!, image.data[i + 1]!, image.data[i + 2]!);
  }
  for (let y = 1; y < image.height - 1; y++) {
    let i = y * image.width * 4;
    push(image.data[i]!, image.data[i + 1]!, image.data[i + 2]!);
    i = (y * image.width + (image.width - 1)) * 4;
    push(image.data[i]!, image.data[i + 1]!, image.data[i + 2]!);
  }

  let bestKey = 0;
  let bestCount = -1;
  for (const [key, count] of counts.entries()) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }
  return [(bestKey >> 16) & 255, (bestKey >> 8) & 255, bestKey & 255];
}

export function makeBackgroundTransparent(image: ImageDataLike): ImageDataLike {
  const background = mostCommonBoundaryColor(image);
  const out = new Uint8ClampedArray(image.data);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i] === background[0] && out[i + 1] === background[1] && out[i + 2] === background[2]) {
      out[i + 3] = 0;
    }
  }
  return createImageData(out, image.width, image.height);
}
