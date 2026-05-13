const { loadOpenCV } = require('/workspace/ppa-ts/node_modules/@opencvjs/node');
async function main() {
  const started = Date.now();
  const cv = await Promise.race([
    loadOpenCV(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
  ]);
  console.log('ready', typeof cv.Mat, typeof cv.matFromImageData, typeof cv.Canny, Date.now() - started);
}
main().catch(err => { console.error(err && err.message ? err.message : err); process.exit(1); });
