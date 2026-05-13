import { loadOpenCvNode } from '../dist/index.js';
const started = Date.now();
const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000));
try {
  const cv = await Promise.race([loadOpenCvNode(), timeout]);
  console.log('ready', typeof cv.Mat, typeof cv.matFromImageData, typeof cv.Canny, Date.now() - started);
} catch (err) {
  console.error('ERR', err && err.message ? err.message : err);
  process.exit(1);
}
