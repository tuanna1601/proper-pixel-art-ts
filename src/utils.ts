import { createImageData } from './imagedata.js';
import type { Mesh, ImageDataLike } from './types.js';

export function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h);
  }
  throw new Error('No canvas runtime available.');
}

export function get2DContext(canvas: HTMLCanvasElement | OffscreenCanvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to acquire 2D context.');
  return ctx;
}

export function cropBorder(image: ImageDataLike, numPixels = 1): ImageDataLike {
  if (image.width <= numPixels * 2 || image.height <= numPixels * 2) {
    return image;
  }
  const width = image.width - numPixels * 2;
  const height = image.height - numPixels * 2;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcStart = ((y + numPixels) * image.width + numPixels) * 4;
    const srcEnd = srcStart + width * 4;
    out.set(image.data.subarray(srcStart, srcEnd), y * width * 4);
  }
  return createImageData(out, width, height);
}

export function scaleImageNearest(image: ImageDataLike, scale: number): ImageDataLike {
  const factor = Math.max(1, Math.round(scale));
  if (factor === 1) return image;
  const width = image.width * factor;
  const height = image.height * factor;
  const out = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    const srcY = Math.floor(y / factor);
    for (let x = 0; x < width; x++) {
      const srcX = Math.floor(x / factor);
      const srcIndex = (srcY * image.width + srcX) * 4;
      const dstIndex = (y * width + x) * 4;
      out[dstIndex] = image.data[srcIndex]!;
      out[dstIndex + 1] = image.data[srcIndex + 1]!;
      out[dstIndex + 2] = image.data[srcIndex + 2]!;
      out[dstIndex + 3] = image.data[srcIndex + 3]!;
    }
  }

  return createImageData(out, width, height);
}

export function overlayGridLines(
  image: ImageDataLike,
  mesh: Mesh,
  lineColor: [number, number, number] = [255, 0, 0],
  lineWidth = 1
): ImageDataLike {
  const canvas = createCanvas(image.width, image.height);
  const ctx = get2DContext(canvas);
  ctx.putImageData(image as ImageData, 0, 0);
  ctx.strokeStyle = `rgba(${lineColor[0]}, ${lineColor[1]}, ${lineColor[2]}, 1)`;
  ctx.lineWidth = lineWidth;

  for (const x of mesh.linesX) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, image.height);
    ctx.stroke();
  }

  for (const y of mesh.linesY) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(image.width, y + 0.5);
    ctx.stroke();
  }

  return createImageData(ctx.getImageData(0, 0, image.width, image.height).data, image.width, image.height);
}
