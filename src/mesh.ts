import { clampAlpha } from './colors.js';
import type { CvMat, CvNamespace, Lines, Mesh, ImageDataLike } from './types.js';
import { cropBorder, scaleImageNearest } from './utils.js';

function medianValue(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle]!;
  }
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function numpyRound(value: number): number {
  const lower = Math.floor(value);
  const diff = value - lower;
  if (diff < 0.5) return lower;
  if (diff > 0.5) return lower + 1;
  return lower % 2 === 0 ? lower : lower + 1;
}

export function clusterLines(lines: Lines, threshold = 4): Lines {
  if (lines.length === 0) return [];
  const sorted = [...lines].sort((a, b) => a - b);
  const clusters: number[][] = [[sorted[0]!]];
  for (const point of sorted.slice(1)) {
    const cluster = clusters[clusters.length - 1]!;
    if (Math.abs(point - cluster[cluster.length - 1]!) <= threshold) {
      cluster.push(point);
    } else {
      clusters.push([point]);
    }
  }
  return clusters.map(cluster => {
    return Math.trunc(medianValue(cluster));
  });
}

function detectGridLinesFromMat(
  cv: CvNamespace,
  edges: CvMat,
  width: number,
  height: number,
  houghRho = 1,
  houghThetaRad = Math.PI / 180,
  houghThreshold = 100,
  houghMinLineLen = 50,
  houghMaxLineGap = 10,
  angleThresholdDeg = 15
): Mesh {
  const lines = new cv.Mat();
  try {
    cv.HoughLinesP(edges, lines, houghRho, houghThetaRad, houghThreshold, houghMinLineLen, houghMaxLineGap);
    const linesX = [0, width - 1];
    const linesY = [0, height - 1];

    if (!lines.empty() && lines.data32S) {
      for (let i = 0; i < lines.data32S.length; i += 4) {
        const x1 = lines.data32S[i]!;
        const y1 = lines.data32S[i + 1]!;
        const x2 = lines.data32S[i + 2]!;
        const y2 = lines.data32S[i + 3]!;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const angle = Math.abs(Math.atan2(dy, dx));
        if (angle > ((90 - angleThresholdDeg) * Math.PI) / 180) {
          linesX.push(Math.round((x1 + x2) / 2));
        } else if (angle < (angleThresholdDeg * Math.PI) / 180) {
          linesY.push(Math.round((y1 + y2) / 2));
        }
      }
    }

    return {
      linesX: clusterLines(linesX),
      linesY: clusterLines(linesY),
    };
  } finally {
    lines.delete();
  }
}

export function detectGridLines(
  cv: CvNamespace,
  edges: ImageDataLike,
  houghRho = 1,
  houghThetaRad = Math.PI / 180,
  houghThreshold = 100,
  houghMinLineLen = 50,
  houghMaxLineGap = 10,
  angleThresholdDeg = 15
): Mesh {
  const mat = cv.matFromImageData(edges as ImageData);
  try {
    return detectGridLinesFromMat(
      cv,
      mat,
      edges.width,
      edges.height,
      houghRho,
      houghThetaRad,
      houghThreshold,
      houghMinLineLen,
      houghMaxLineGap,
      angleThresholdDeg
    );
  } finally {
    mat.delete();
  }
}

function numpyPercentile(sortedAsc: number[], percent: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const rank = (percent / 100) * (sortedAsc.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sortedAsc[lower]!;
  const fraction = rank - lower;
  return sortedAsc[lower]! * (1 - fraction) + sortedAsc[upper]! * fraction;
}

export function getPixelWidth(lineCollection: Lines[], trimOutlierFraction = 0.2): number {
  const allGaps: number[] = [];
  for (const lines of lineCollection) {
    for (let i = 1; i < lines.length; i++) {
      allGaps.push(lines[i]! - lines[i - 1]!);
    }
  }
  if (allGaps.length === 0) return 1;

  const sorted = [...allGaps].sort((a, b) => a - b);
  const low = numpyPercentile(sorted, 100 * trimOutlierFraction);
  const hi = numpyPercentile(sorted, 100 * (1 - trimOutlierFraction));
  let middle = allGaps.filter(g => g >= low && g <= hi);
  if (middle.length === 0) middle = allGaps;

  return Math.max(1, numpyRound(medianValue(middle)));
}

export function homogenizeLines(lines: Lines, pixelWidth: number): Lines {
  if (lines.length === 0) return [];
  const complete: number[] = [];
  for (let index = 0; index < lines.length - 1; index++) {
    const start = lines[index]!;
    const end = lines[index + 1]!;
    const sectionWidth = end - start;
    const numPixels = numpyRound(sectionWidth / pixelWidth);
    const sectionPixelWidth = numPixels === 0 ? 0 : sectionWidth / numPixels;
    for (let n = 0; n < numPixels; n++) {
      complete.push(start + Math.trunc(n * sectionPixelWidth));
    }
  }
  complete.push(lines[lines.length - 1]!);
  return complete;
}

export function isTrivialMesh(mesh: Mesh): boolean {
  return (mesh.linesX.length === 2 || mesh.linesX.length === 3) && (mesh.linesY.length === 2 || mesh.linesY.length === 3);
}

function computeClosedEdges(
  cv: CvNamespace,
  image: ImageDataLike,
  cannyThresholds: [number, number],
  closureKernelSize: number
): { closed: CvMat; width: number; height: number } {
  const cropped = cropBorder(image, 2);
  const src = cv.matFromImageData(clampAlpha(cropped, 'grayscale') as ImageData);
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const closed = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(closureKernelSize, closureKernelSize));

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.Canny(gray, edges, cannyThresholds[0], cannyThresholds[1]);
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);
    return { closed, width: cropped.width, height: cropped.height };
  } finally {
    src.delete();
    gray.delete();
    edges.delete();
    kernel.delete();
  }
}

export function computeMesh(
  cv: CvNamespace,
  image: ImageDataLike,
  cannyThresholds: [number, number] = [50, 200],
  closureKernelSize = 8,
  pixelWidth?: number
): Mesh {
  const { closed, width, height } = computeClosedEdges(cv, image, cannyThresholds, closureKernelSize);
  try {
    const initialMesh = detectGridLinesFromMat(cv, closed, width, height);
    const resolvedPixelWidth = pixelWidth ?? getPixelWidth([initialMesh.linesX, initialMesh.linesY]);
    return {
      linesX: homogenizeLines(initialMesh.linesX, resolvedPixelWidth),
      linesY: homogenizeLines(initialMesh.linesY, resolvedPixelWidth),
    };
  } finally {
    closed.delete();
  }
}

export function computeMeshWithScaling(
  cv: CvNamespace,
  image: ImageDataLike,
  upscaleFactor: number,
  pixelWidth?: number
): { mesh: Mesh; upscaleFactor: number } {
  const scaled = scaleImageNearest(image, upscaleFactor);
  const scaledMesh = computeMesh(cv, scaled, [50, 200], 8, pixelWidth);
  if (!isTrivialMesh(scaledMesh)) {
    return { mesh: scaledMesh, upscaleFactor };
  }
  return { mesh: computeMesh(cv, image, [50, 200], 8, pixelWidth), upscaleFactor: 1 };
}
