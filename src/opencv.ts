import type { CvNamespace } from './types.js';

declare global {
  interface Window {
    cv?: Partial<CvNamespace> & { onRuntimeInitialized?: (() => void) | null };
  }
}

export type LoadOpenCvOptions = {
  scriptUrl?: string;
};

function isReady(cv: Partial<CvNamespace> | undefined): cv is CvNamespace {
  return !!cv && typeof cv.Mat === 'function' && typeof cv.matFromImageData === 'function';
}

let loadPromise: Promise<CvNamespace> | null = null;

export async function loadOpenCvNode(): Promise<CvNamespace> {
  const mod = await import('@opencvjs/node');
  const loadOpenCV = (mod as { loadOpenCV?: () => Promise<CvNamespace> }).loadOpenCV;
  if (typeof loadOpenCV !== 'function') {
    throw new Error('Failed to load @opencvjs/node runtime.');
  }
  return await loadOpenCV();
}

export function loadOpenCv(options: LoadOpenCvOptions = {}): Promise<CvNamespace> {
  const scriptUrl = options.scriptUrl ?? 'https://docs.opencv.org/4.x/opencv.js';

  if (typeof document === 'undefined') {
    return loadOpenCvNode();
  }

  if (isReady(window.cv)) {
    return Promise.resolve(window.cv);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<CvNamespace>((resolve, reject) => {
    const finish = () => {
      if (isReady(window.cv)) {
        resolve(window.cv);
        return;
      }
      reject(new Error('OpenCV.js loaded but did not initialize.'));
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-ppa-ts-opencv="true"]');
    const current = window.cv as (Partial<CvNamespace> & { onRuntimeInitialized?: (() => void) | null }) | undefined;
    if (current && !isReady(current)) {
      current.onRuntimeInitialized = finish;
      return;
    }

    const script = existing ?? document.createElement('script');
    script.dataset.ppaTsOpencv = 'true';
    script.async = true;
    script.src = scriptUrl;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error(`Failed to load OpenCV.js from ${scriptUrl}.`));
    };
    script.onload = () => {
      const cv = window.cv;
      if (isReady(cv)) {
        resolve(cv);
        return;
      }
      if (!cv) {
        loadPromise = null;
        reject(new Error('OpenCV.js did not attach to window.cv.'));
        return;
      }
      (cv as Partial<CvNamespace> & { onRuntimeInitialized?: (() => void) | null }).onRuntimeInitialized = finish;
    };
    if (!existing) {
      document.head.appendChild(script);
    }
  });

  return loadPromise;
}
