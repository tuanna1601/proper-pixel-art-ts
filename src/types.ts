import type { ImageDataLike } from './imagedata.js';

export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];
export type Lines = number[];
export type Mesh = {
  linesX: Lines;
  linesY: Lines;
};

export type QuantizeImage = (image: ImageDataLike, numColors: number) => Promise<ImageDataLike> | ImageDataLike;

export type PixelateOptions = {
  cv: CvNamespace;
  numColors?: number;
  initialUpscaleFactor?: number;
  scaleResult?: number;
  transparentBackground?: boolean;
  pixelWidth?: number;
  quantizeImage?: QuantizeImage;
};

export type { ImageDataLike };

export interface CvMat {
  cols?: number;
  data32S?: Int32Array;
  data?: Uint8Array;
  rows?: number;
  delete(): void;
  empty(): boolean;
}

export interface CvKernel {
  delete(): void;
}

export interface CvSizeCtor {
  new (width: number, height: number): unknown;
}

export interface CvNamespace {
  Mat: new () => CvMat;
  Size: CvSizeCtor;
  COLOR_RGBA2GRAY: number;
  MORPH_RECT: number;
  MORPH_CLOSE: number;
  matFromImageData(data: ImageData): CvMat;
  getStructuringElement(shape: number, size: unknown): CvKernel;
  cvtColor(src: CvMat, dst: CvMat, code: number): void;
  Canny(src: CvMat, dst: CvMat, threshold1: number, threshold2: number): void;
  morphologyEx(src: CvMat, dst: CvMat, op: number, kernel: CvKernel): void;
  HoughLinesP(
    image: CvMat,
    lines: CvMat,
    rho: number,
    theta: number,
    threshold: number,
    minLineLength?: number,
    maxLineGap?: number
  ): void;
}
