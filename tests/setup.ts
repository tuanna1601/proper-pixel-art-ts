class ImageDataPolyfill {
  data: Uint8ClampedArray;
  height: number;
  width: number;

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

if (typeof globalThis.ImageData === 'undefined') {
  // Minimal shape used by the library in Node-side tests.
  (globalThis as typeof globalThis & { ImageData: typeof ImageDataPolyfill }).ImageData = ImageDataPolyfill;
}
