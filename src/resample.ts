import { createImageData } from './imagedata.js';
import type { ImageDataLike } from './types.js';

const BICUBIC_SUPPORT = 2.0;
const BICUBIC_A = -0.5;
const PRECISION_BITS = 32 - 8 - 2;
const PRECISION_SCALE = 1 << PRECISION_BITS;
const ROUNDING_BIAS = 1 << (PRECISION_BITS - 1);

function bicubicFilter(x: number): number {
  const a = BICUBIC_A;
  const ax = x < 0 ? -x : x;
  if (ax < 1) {
    return ((a + 2) * ax - (a + 3)) * ax * ax + 1;
  }
  if (ax < 2) {
    return (((ax - 5) * ax + 8) * ax - 4) * a;
  }
  return 0;
}

type Coeffs = { ksize: number; bounds: Int32Array; kk: Int32Array };

function precomputeCoeffs(inSize: number, outSize: number): Coeffs {
  const scale = inSize / outSize;
  const filterScale = scale < 1 ? 1 : scale;
  const support = BICUBIC_SUPPORT * filterScale;
  const ksize = Math.ceil(support) * 2 + 1;
  const bounds = new Int32Array(outSize * 2);
  const kkFloat = new Float64Array(outSize * ksize);

  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    const invFilterScale = 1 / filterScale;
    let xmin = Math.trunc(center - support + 0.5);
    if (xmin < 0) xmin = 0;
    let xmax = Math.trunc(center + support + 0.5);
    if (xmax > inSize) xmax = inSize;
    xmax -= xmin;
    let ww = 0;
    for (let x = 0; x < xmax; x++) {
      const w = bicubicFilter((x + xmin - center + 0.5) * invFilterScale);
      kkFloat[xx * ksize + x] = w;
      ww += w;
    }
    if (ww !== 0) {
      for (let x = 0; x < xmax; x++) {
        kkFloat[xx * ksize + x] /= ww;
      }
    }
    bounds[xx * 2] = xmin;
    bounds[xx * 2 + 1] = xmax;
  }

  const kk = new Int32Array(outSize * ksize);
  for (let i = 0; i < outSize * ksize; i++) {
    const v = kkFloat[i]!;
    if (v < 0) {
      kk[i] = Math.trunc(-0.5 + v * PRECISION_SCALE);
    } else {
      kk[i] = Math.trunc(0.5 + v * PRECISION_SCALE);
    }
  }

  return { ksize, bounds, kk };
}

function clip8(v: number): number {
  const shifted = v >> PRECISION_BITS;
  if (shifted <= 0) return 0;
  if (shifted >= 255) return 255;
  return shifted;
}

function resampleHorizontal(src: ImageDataLike, outW: number, coeffs: Coeffs): ImageDataLike {
  const out = new Uint8ClampedArray(outW * src.height * 4);
  const { ksize, bounds, kk } = coeffs;
  for (let yy = 0; yy < src.height; yy++) {
    for (let xx = 0; xx < outW; xx++) {
      const xmin = bounds[xx * 2]!;
      const xmax = bounds[xx * 2 + 1]!;
      const koff = xx * ksize;
      let r = ROUNDING_BIAS, g = ROUNDING_BIAS, b = ROUNDING_BIAS, a = ROUNDING_BIAS;
      for (let x = 0; x < xmax; x++) {
        const k = kk[koff + x]!;
        const i = (yy * src.width + xmin + x) * 4;
        r += src.data[i]! * k;
        g += src.data[i + 1]! * k;
        b += src.data[i + 2]! * k;
        a += src.data[i + 3]! * k;
      }
      const oi = (yy * outW + xx) * 4;
      out[oi] = clip8(r);
      out[oi + 1] = clip8(g);
      out[oi + 2] = clip8(b);
      out[oi + 3] = clip8(a);
    }
  }
  return createImageData(out, outW, src.height);
}

function resampleVertical(src: ImageDataLike, outH: number, coeffs: Coeffs): ImageDataLike {
  const out = new Uint8ClampedArray(src.width * outH * 4);
  const { ksize, bounds, kk } = coeffs;
  for (let yy = 0; yy < outH; yy++) {
    const ymin = bounds[yy * 2]!;
    const ymax = bounds[yy * 2 + 1]!;
    const koff = yy * ksize;
    for (let xx = 0; xx < src.width; xx++) {
      let r = ROUNDING_BIAS, g = ROUNDING_BIAS, b = ROUNDING_BIAS, a = ROUNDING_BIAS;
      for (let y = 0; y < ymax; y++) {
        const k = kk[koff + y]!;
        const i = ((ymin + y) * src.width + xx) * 4;
        r += src.data[i]! * k;
        g += src.data[i + 1]! * k;
        b += src.data[i + 2]! * k;
        a += src.data[i + 3]! * k;
      }
      const oi = (yy * src.width + xx) * 4;
      out[oi] = clip8(r);
      out[oi + 1] = clip8(g);
      out[oi + 2] = clip8(b);
      out[oi + 3] = clip8(a);
    }
  }
  return createImageData(out, src.width, outH);
}

export function resizeBicubic(src: ImageDataLike, outW: number, outH: number): ImageDataLike {
  if (outW === src.width && outH === src.height) return src;
  const horizontal =
    outW === src.width
      ? src
      : resampleHorizontal(src, outW, precomputeCoeffs(src.width, outW));
  if (outH === horizontal.height) return horizontal;
  return resampleVertical(horizontal, outH, precomputeCoeffs(horizontal.height, outH));
}

export function reduceByFactor(src: ImageDataLike, factorX: number, factorY: number): ImageDataLike {
  if (factorX <= 1 && factorY <= 1) return src;
  const fx = Math.max(1, Math.floor(factorX));
  const fy = Math.max(1, Math.floor(factorY));
  const outW = Math.ceil(src.width / fx);
  const outH = Math.ceil(src.height / fy);
  const out = new Uint8ClampedArray(outW * outH * 4);

  for (let yy = 0; yy < outH; yy++) {
    const ySpan = Math.min(fy, src.height - yy * fy);
    for (let xx = 0; xx < outW; xx++) {
      const xSpan = Math.min(fx, src.width - xx * fx);
      const area = xSpan * ySpan;
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < ySpan; dy++) {
        const rowBase = ((yy * fy + dy) * src.width + xx * fx) * 4;
        for (let dx = 0; dx < xSpan; dx++) {
          const i = rowBase + dx * 4;
          r += src.data[i]!;
          g += src.data[i + 1]!;
          b += src.data[i + 2]!;
          a += src.data[i + 3]!;
        }
      }
      const oi = (yy * outW + xx) * 4;
      out[oi] = Math.floor(r / area + 0.5);
      out[oi + 1] = Math.floor(g / area + 0.5);
      out[oi + 2] = Math.floor(b / area + 0.5);
      out[oi + 3] = Math.floor(a / area + 0.5);
    }
  }

  return createImageData(out, outW, outH);
}

function roundAspect(n: number, key: (k: number) => number): number {
  const f = Math.floor(n);
  const c = Math.ceil(n);
  const winner = key(f) <= key(c) ? f : c;
  return winner < 1 ? 1 : winner;
}

export function thumbnailLike(image: ImageDataLike, maxSize: number, reducingGap = 2.0): ImageDataLike {
  if (image.width <= maxSize && image.height <= maxSize) return image;

  const aspect = image.width / image.height;
  let x = maxSize;
  let y = maxSize;
  if (x / y >= aspect) {
    x = roundAspect(y * aspect, k => Math.abs(aspect - k / y));
  } else {
    y = roundAspect(x / aspect, k => (k === 0 ? 0 : Math.abs(aspect - x / k)));
  }

  let src = image;
  if (reducingGap !== undefined) {
    const factorX = Math.max(1, Math.floor(src.width / x / reducingGap));
    const factorY = Math.max(1, Math.floor(src.height / y / reducingGap));
    if (factorX > 1 || factorY > 1) {
      src = reduceByFactor(src, factorX, factorY);
    }
  }

  return resizeBicubic(src, x, y);
}
