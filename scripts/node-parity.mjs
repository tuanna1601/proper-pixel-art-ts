import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { pixelate, computeMesh, loadOpenCvNode, createImageData } from '../dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const CASES = [
  { name: 'ash',      numColors: 16, scaleResult: 5,  transparentBackground: false, input: 'assets/ash/ash.png',           expected: 'assets/ash/result.png' },
  { name: 'bat',      numColors: 16, scaleResult: 5,  transparentBackground: true,  input: 'assets/bat/bat.png',           expected: 'assets/bat/result.png' },
  { name: 'blob',     numColors: 16, scaleResult: 25, transparentBackground: false, input: 'assets/blob/blob.png',         expected: 'assets/blob/result.png' },
  { name: 'demon',    numColors: 64, scaleResult: 5,  transparentBackground: true,  input: 'assets/demon/demon.png',       expected: 'assets/demon/result.png' },
  { name: 'mountain', numColors: 64, scaleResult: 5,  transparentBackground: false, input: 'assets/mountain/mountain.png', expected: 'assets/mountain/result.png' },
  { name: 'pumpkin',  numColors: undefined, scaleResult: 5, transparentBackground: false, input: 'assets/pumpkin/pumpkin.png', expected: 'assets/pumpkin/result.png' },
];

function loadPng(relPath) {
  const buf = readFileSync(resolve(root, relPath));
  const png = PNG.sync.read(buf);
  return createImageData(new Uint8ClampedArray(png.data), png.width, png.height);
}

const cv = await loadOpenCvNode();
console.log('opencv ready');

// Mesh sanity check on blob.
{
  const blob = loadPng('assets/blob/blob.png');
  const mesh = computeMesh(cv, blob);
  if (!(mesh.linesX.length > 2 && mesh.linesY.length > 2)) {
    console.error(`FAIL mesh blob: linesX=${mesh.linesX.length} linesY=${mesh.linesY.length}`);
    process.exit(1);
  }
  console.log(`mesh blob ok linesX=${mesh.linesX.length} linesY=${mesh.linesY.length}`);
}

let failed = 0;
for (const c of CASES) {
  const input = loadPng(c.input);
  const expected = loadPng(c.expected);
  const actual = await pixelate(input, {
    cv,
    numColors: c.numColors,
    scaleResult: c.scaleResult,
    transparentBackground: c.transparentBackground,
  });

  const sameSize = actual.width === expected.width && actual.height === expected.height;
  let diff = 0;
  if (sameSize) {
    for (let i = 0; i < actual.data.length; i += 4) {
      if (
        actual.data[i] !== expected.data[i] ||
        actual.data[i + 1] !== expected.data[i + 1] ||
        actual.data[i + 2] !== expected.data[i + 2] ||
        actual.data[i + 3] !== expected.data[i + 3]
      ) {
        diff += 1;
      }
    }
  }

  const total = actual.width * actual.height;
  const status = sameSize && diff === 0 ? 'OK' : 'DIFF';
  if (status !== 'OK') failed += 1;
  console.log(
    `${status} ${c.name}: actual=${actual.width}x${actual.height} expected=${expected.width}x${expected.height} diffPixels=${diff}/${total}`,
  );
}

if (failed > 0) {
  console.error(`\n${failed} fixture(s) diverged`);
  process.exit(1);
}
console.log('\nall fixtures match');
