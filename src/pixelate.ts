import { createImageData } from './imagedata.js';
import {
  extractAndScaleAlpha,
  getCellColorSkipQuantization,
  getCellColorWithAlpha,
  getOpaqueCellColor,
  makeBackgroundTransparent,
  paletteImage,
} from './colors.js';
import { computeMeshWithScaling } from './mesh.js';
import type { Mesh, PixelateOptions, ImageDataLike } from './types.js';
import { createCanvas, get2DContext, scaleImageNearest } from './utils.js';

function extractCellRgb(image: ImageDataLike, x0: number, y0: number, x1: number, y1: number): Uint8ClampedArray {
  const values = new Uint8ClampedArray((x1 - x0) * (y1 - y0) * 3);
  let outIndex = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * image.width + x) * 4;
      values[outIndex++] = image.data[i];
      values[outIndex++] = image.data[i + 1];
      values[outIndex++] = image.data[i + 2];
    }
  }
  return values;
}

function extractCellRgba(image: ImageDataLike, x0: number, y0: number, x1: number, y1: number): Uint8ClampedArray {
  const values = new Uint8ClampedArray((x1 - x0) * (y1 - y0) * 4);
  let outIndex = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * image.width + x) * 4;
      values[outIndex++] = image.data[i];
      values[outIndex++] = image.data[i + 1];
      values[outIndex++] = image.data[i + 2];
      values[outIndex++] = image.data[i + 3];
    }
  }
  return values;
}

function extractCellAlpha(alpha: Uint8ClampedArray, width: number, x0: number, y0: number, x1: number, y1: number): Uint8ClampedArray {
  const values = new Uint8ClampedArray((x1 - x0) * (y1 - y0));
  let outIndex = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      values[outIndex++] = alpha[y * width + x];
    }
  }
  return values;
}

export function downsample(
  image: ImageDataLike,
  mesh: Mesh,
  skipQuantization = false,
  originalAlpha?: Uint8ClampedArray
): ImageDataLike {
  const widthResult = mesh.linesX.length - 1;
  const heightResult = mesh.linesY.length - 1;
  const out = new Uint8ClampedArray(widthResult * heightResult * 4);

  for (let j = 0; j < heightResult; j++) {
    for (let i = 0; i < widthResult; i++) {
      const x0 = mesh.linesX[i];
      const x1 = mesh.linesX[i + 1];
      const y0 = mesh.linesY[j];
      const y1 = mesh.linesY[j + 1];
      const rgba = skipQuantization
        ? getCellColorSkipQuantization(extractCellRgba(image, x0, y0, x1, y1))
        : originalAlpha
          ? getCellColorWithAlpha(
              extractCellRgb(image, x0, y0, x1, y1),
              extractCellAlpha(originalAlpha, image.width, x0, y0, x1, y1)
            )
          : getOpaqueCellColor(extractCellRgb(image, x0, y0, x1, y1));
      const index = (j * widthResult + i) * 4;
      out[index] = rgba[0];
      out[index + 1] = rgba[1];
      out[index + 2] = rgba[2];
      out[index + 3] = rgba[3];
    }
  }

  return createImageData(out, widthResult, heightResult);
}

function ensureRgba(image: ImageDataLike): ImageDataLike {
  return createImageData(new Uint8ClampedArray(image.data), image.width, image.height);
}

export async function pixelate(image: ImageDataLike, options: PixelateOptions): Promise<ImageDataLike> {
  const imageRgba = ensureRgba(image);
  const numColors = options.numColors;
  const initialUpscaleFactor = options.initialUpscaleFactor ?? 2;
  const scaleResult = options.scaleResult;
  const transparentBackground = options.transparentBackground ?? false;

  const { mesh, upscaleFactor } = computeMeshWithScaling(
    options.cv,
    imageRgba,
    initialUpscaleFactor,
    options.pixelWidth
  );

  const skipQuantization = numColors === undefined;
  let processed = imageRgba;
  if (!skipQuantization) {
    const quantizeImage = options.quantizeImage ?? paletteImage;
    processed = await quantizeImage(imageRgba, numColors);
  }

  const scaledImage = upscaleFactor === 1 ? processed : scaleImageNearest(processed, upscaleFactor);
  const scaledAlpha = skipQuantization ? undefined : extractAndScaleAlpha(imageRgba, upscaleFactor);
  let result = downsample(scaledImage, mesh, skipQuantization, scaledAlpha);

  if (transparentBackground) {
    result = makeBackgroundTransparent(result);
  }

  if (scaleResult !== undefined) {
    result = scaleImageNearest(result, scaleResult);
  }

  return result;
}

export function imageDataToCanvas(image: ImageDataLike): HTMLCanvasElement | OffscreenCanvas {
  const canvas = createCanvas(image.width, image.height);
  get2DContext(canvas).putImageData(image as ImageData, 0, 0);
  return canvas;
}
