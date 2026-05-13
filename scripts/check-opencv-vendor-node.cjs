const cvModule = require('../vendor/opencv.js');
const started = Date.now();
function done(cv){ console.log('ready', typeof cv.Mat, typeof cv.matFromImageData, typeof cv.Canny, Date.now()-started); process.exit(0); }
if (cvModule && typeof cvModule.then === 'function') {
  Promise.resolve(cvModule).then(done).catch(err => { console.error(err); process.exit(1); });
} else {
  cvModule.onRuntimeInitialized = () => done(cvModule);
}
setTimeout(() => { console.error('timeout'); process.exit(1); }, 30000);
