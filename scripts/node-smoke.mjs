import * as ppa from '../dist/index.js';

const exported = ['pixelate', 'downsample', 'computeMesh', 'loadOpenCv', 'createImageData'];
for (const key of exported) {
  if (typeof ppa[key] !== 'function') {
    throw new Error(`Missing export: ${key}`);
  }
}

const image = ppa.createImageData(new Uint8ClampedArray([
  255, 0, 0, 255,
  255, 0, 0, 255,
  255, 0, 0, 255,
  255, 0, 0, 255,
]), 2, 2);

if (image.width !== 2 || image.height !== 2) {
  throw new Error('createImageData smoke test failed.');
}

console.log('node smoke ok');
