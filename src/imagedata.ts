export interface ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

class ImageDataPolyfill implements ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

export function createImageData(data: Uint8ClampedArray, width: number, height: number): ImageDataLike {
  const ctor = globalThis.ImageData as
    | (new (data: Uint8ClampedArray, width: number, height: number) => ImageDataLike)
    | undefined;
  if (typeof ctor === 'function') {
    return new ctor(data, width, height);
  }
  return new ImageDataPolyfill(data, width, height);
}

export function isImageDataLike(value: unknown): value is ImageDataLike {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ImageDataLike>;
  return (
    candidate.data instanceof Uint8ClampedArray &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number'
  );
}
