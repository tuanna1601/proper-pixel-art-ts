import { describe, expect, it } from 'vitest';
import { downsample, pixelate } from '../src/pixelate';
import type { CvMat, CvNamespace, Mesh } from '../src/types';

class FakeMat implements CvMat {
  cols?: number;
  data?: Uint8Array;
  data32S?: Int32Array;
  rows?: number;

  delete() {}

  empty() {
    return !this.data32S || this.data32S.length === 0;
  }
}

function createFakeCv(): CvNamespace {
  return {
    Mat: FakeMat,
    Size: class {
      constructor(_width: number, _height: number) {}
    },
    COLOR_RGBA2GRAY: 0,
    MORPH_RECT: 0,
    MORPH_CLOSE: 0,
    matFromImageData(data: ImageData) {
      const mat = new FakeMat();
      mat.rows = data.height;
      mat.cols = data.width;
      mat.data = new Uint8Array(data.data);
      return mat;
    },
    getStructuringElement() {
      return { delete() {} };
    },
    cvtColor(src: CvMat, dst: CvMat) {
      dst.rows = src.rows;
      dst.cols = src.cols;
      dst.data = src.data;
    },
    Canny(src: CvMat, dst: CvMat) {
      dst.rows = src.rows;
      dst.cols = src.cols;
      dst.data = src.data;
    },
    morphologyEx(src: CvMat, dst: CvMat) {
      dst.rows = src.rows;
      dst.cols = src.cols;
      dst.data = src.data;
    },
    HoughLinesP(image: CvMat, lines: CvMat) {
      const width = image.cols ?? 0;
      const height = image.rows ?? 0;
      const xMid = Math.round(width / 2);
      const yMid = Math.round(height / 2);
      lines.data32S = new Int32Array([
        xMid, 0, xMid, Math.max(0, height - 1),
        0, yMid, Math.max(0, width - 1), yMid,
      ]);
    },
  };
}

describe('downsample', () => {
  it('reduces one cell to one pixel in quantized mode', () => {
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 10;
      data[i + 1] = 20;
      data[i + 2] = 30;
      data[i + 3] = 255;
    }
    const mesh: Mesh = { linesX: [0, 4], linesY: [0, 4] };
    const out = downsample(new ImageData(data, width, height), mesh, false);
    expect(out.width).toBe(1);
    expect(out.height).toBe(1);
    expect(Array.from(out.data)).toEqual([10, 20, 30, 255]);
  });

  it('returns transparent cell when alpha is majority transparent', () => {
    const width = 2;
    const height = 2;
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,
      255, 0, 0, 0,
      255, 0, 0, 0,
      255, 0, 0, 0,
    ]);
    const alpha = new Uint8ClampedArray([255, 0, 0, 0]);
    const mesh: Mesh = { linesX: [0, 2], linesY: [0, 2] };
    const out = downsample(new ImageData(data, width, height), mesh, false, alpha);
    expect(Array.from(out.data)).toEqual([0, 0, 0, 0]);
  });
});

describe('pixelate', () => {
  it('runs end-to-end without a custom quantizer when numColors is set', async () => {
    const width = 24;
    const height = 24;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (x < width / 2) {
          data[i] = 255;
        } else {
          data[i + 2] = 255;
        }
        data[i + 3] = 255;
      }
    }
    const out = await pixelate(new ImageData(data, width, height), {
      cv: createFakeCv(),
      numColors: 2,
    });
    expect(out.width).toBeGreaterThan(0);
    expect(out.height).toBeGreaterThan(0);
  });

  it('runs end-to-end in skip-quantization mode', async () => {
    const width = 24;
    const height = 24;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 120;
      data[i + 1] = 80;
      data[i + 2] = 40;
      data[i + 3] = 255;
    }
    const out = await pixelate(new ImageData(data, width, height), {
      cv: createFakeCv(),
      transparentBackground: false,
    });
    expect(out.width).toBeGreaterThan(0);
    expect(out.height).toBeGreaterThan(0);
  });
});
