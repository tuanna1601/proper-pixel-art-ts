import { expect, test } from '@playwright/test';

const CASES = [
  { name: 'anchor', numColors: 16, scaleResult: 5, transparentBackground: true, path: '/assets/anchor/anchor.png', expected: '/assets/anchor/result.png' },
  { name: 'ash', numColors: 16, scaleResult: 5, transparentBackground: false, path: '/assets/ash/ash.png', expected: '/assets/ash/result.png' },
  { name: 'bat', numColors: 16, scaleResult: 5, transparentBackground: true, path: '/assets/bat/bat.png', expected: '/assets/bat/result.png' },
  { name: 'blob', numColors: 16, scaleResult: 25, transparentBackground: false, path: '/assets/blob/blob.png', expected: '/assets/blob/result.png' },
  { name: 'demon', numColors: 64, scaleResult: 5, transparentBackground: true, path: '/assets/demon/demon.png', expected: '/assets/demon/result.png' },
  { name: 'mountain', numColors: 64, scaleResult: 5, transparentBackground: false, path: '/assets/mountain/mountain.png', expected: '/assets/mountain/result.png' },
  { name: 'pumpkin', numColors: undefined, scaleResult: 5, transparentBackground: false, path: '/assets/pumpkin/pumpkin.png', expected: '/assets/pumpkin/result.png' },
] as const;

test.describe('proper-pixel-art parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.addScriptTag({ url: '/vendor/opencv.js' });
    await page.waitForFunction(() => Boolean((window as Window & { cv?: { Mat?: unknown } }).cv?.Mat), undefined, { timeout: 120_000 });
  });

  test('mesh stays non-trivial for blob fixture', async ({ page }) => {
    const lengths = await page.evaluate(async () => {
      const ppa = await import('/dist/browser.js');
      const response = await fetch('/assets/blob/blob.png');
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      const image = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      bitmap.close();
      const mesh = ppa.computeMesh((window as Window & { cv: unknown }).cv as never, image);
      return { x: mesh.linesX.length, y: mesh.linesY.length };
    });

    expect(lengths.x).toBeGreaterThan(2);
    expect(lengths.y).toBeGreaterThan(2);
  });

  for (const fixture of CASES) {
    test(`pixelate parity smoke: ${fixture.name}`, async ({ page }) => {
      const result = await page.evaluate(async current => {
        const ppa = await import('/dist/browser.js');

        async function loadImageData(url: string) {
          const response = await fetch(url);
          const blob = await response.blob();
          const bitmap = await createImageBitmap(blob);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(bitmap, 0, 0);
          const image = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
          bitmap.close();
          return image;
        }

        const input = await loadImageData(current.path);
        const expected = await loadImageData(current.expected);
        const actual = await ppa.pixelate(input, {
          cv: (window as Window & { cv: unknown }).cv as never,
          numColors: current.numColors,
          scaleResult: current.scaleResult,
          transparentBackground: current.transparentBackground,
        });

        const sameSize = actual.width === expected.width && actual.height === expected.height;
        const width = Math.min(actual.width, expected.width);
        const height = Math.min(actual.height, expected.height);
        let diffPixels = 0;
        if (sameSize) {
          for (let i = 0; i < actual.data.length; i += 4) {
            if (
              actual.data[i] !== expected.data[i] ||
              actual.data[i + 1] !== expected.data[i + 1] ||
              actual.data[i + 2] !== expected.data[i + 2] ||
              actual.data[i + 3] !== expected.data[i + 3]
            ) {
              diffPixels += 1;
            }
          }
        }
        return {
          actual: { width: actual.width, height: actual.height },
          expected: { width: expected.width, height: expected.height },
          sameSize,
          diffPixels,
          comparablePixels: width * height,
        };
      }, fixture);

      expect(result.actual.width).toBeGreaterThan(0);
      expect(result.actual.height).toBeGreaterThan(0);
      expect(result.sameSize).toBe(true);
      expect(result.diffPixels).toBe(0);
    });
  }
});
