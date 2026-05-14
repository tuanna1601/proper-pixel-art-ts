import * as ppa from '../dist/node.js';

const exported = ['pixelate', 'downsample', 'computeMesh', 'loadOpenCv', 'loadOpenCvNode', 'createImageData'];
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

const cv = await Promise.race([
  ppa.loadOpenCvNode(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('loadOpenCvNode timeout')), 30000)),
]);

if (typeof cv.Mat !== 'function' || typeof cv.Canny !== 'function') {
  throw new Error('loadOpenCvNode smoke test failed.');
}

console.log('node smoke ok');
