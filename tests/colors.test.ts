import { describe, expect, it } from 'vitest';
import {
  getCellColorSkipQuantization,
  getCellColorWithAlpha,
  getOpaqueCellColor,
  makeBackgroundTransparent,
  mostCommonBoundaryColor,
} from '../src/colors';

function makeRgba(rgbCell: Uint8ClampedArray, width: number, height: number, alpha = 255): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let src = 0, dst = 0; src < rgbCell.length; src += 3, dst += 4) {
    rgba[dst] = rgbCell[src]!;
    rgba[dst + 1] = rgbCell[src + 1]!;
    rgba[dst + 2] = rgbCell[src + 2]!;
    rgba[dst + 3] = alpha;
  }
  return rgba;
}

describe('getOpaqueCellColor', () => {
  it('returns the most frequent color', () => {
    const cell = new Uint8ClampedArray(10 * 10 * 3);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const i = (y * 10 + x) * 3;
        if (y < 6) {
          cell[i] = 255;
        } else {
          cell[i + 2] = 255;
        }
      }
    }
    expect(getOpaqueCellColor(cell)).toEqual([255, 0, 0, 255]);
  });
});

describe('getCellColorWithAlpha', () => {
  it('returns transparent when >=50% transparent', () => {
    const cellPixels = new Uint8ClampedArray(10 * 10 * 3).fill(100);
    const alpha = new Uint8ClampedArray(10 * 10);
    alpha.fill(0);
    alpha.fill(255, 0, 30);
    expect(getCellColorWithAlpha(cellPixels, alpha)).toEqual([0, 0, 0, 0]);
  });

  it('returns the dominant RGB when majority opaque', () => {
    const cellPixels = new Uint8ClampedArray(10 * 10 * 3);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const i = (y * 10 + x) * 3;
        if (y < 7) {
          cellPixels[i] = 255;
        } else {
          cellPixels[i + 2] = 255;
        }
      }
    }
    const alpha = new Uint8ClampedArray(10 * 10).fill(0);
    alpha.fill(255, 0, 70);
    expect(getCellColorWithAlpha(cellPixels, alpha)).toEqual([255, 0, 0, 255]);
  });
});

describe('getCellColorSkipQuantization', () => {
  it('returns exact color for single pixel', () => {
    const cell = new Uint8ClampedArray([128, 64, 32, 255]);
    expect(getCellColorSkipQuantization(cell)).toEqual([128, 64, 32, 255]);
  });

  it('returns transparent for empty cell', () => {
    expect(getCellColorSkipQuantization(new Uint8ClampedArray())).toEqual([0, 0, 0, 0]);
  });

  it('filters out minority outliers', () => {
    const rgb = new Uint8ClampedArray(10 * 10 * 3);
    for (let p = 0; p < 100; p++) {
      const i = p * 3;
      rgb[i] = 200;
      rgb[i + 1] = 100;
      rgb[i + 2] = 50;
    }
    rgb[0] = 0;
    rgb[1] = 0;
    rgb[2] = 255;
    rgb[3] = 0;
    rgb[4] = 255;
    rgb[5] = 0;
    const cell = makeRgba(rgb, 10, 10);
    const [r, g, b, a] = getCellColorSkipQuantization(cell);
    expect(r).toBeGreaterThan(190);
    expect(g).toBeGreaterThan(90);
    expect(b).toBeGreaterThan(40);
    expect(a).toBe(255);
  });
});

describe('background helpers', () => {
  it('finds the most common boundary color', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 3] = 255;
    }
    data[(1 * 4 + 1) * 4] = 0;
    data[(2 * 4 + 2) * 4] = 0;
    const image = new ImageData(data, 4, 4);
    expect(mostCommonBoundaryColor(image)).toEqual([255, 0, 0]);
  });

  it('makes all matching boundary-color pixels transparent', () => {
    const data = new Uint8ClampedArray(3 * 3 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 3] = 255;
    }
    const image = new ImageData(data, 3, 3);
    const out = makeBackgroundTransparent(image);
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i + 3]).toBe(0);
    }
  });
});
