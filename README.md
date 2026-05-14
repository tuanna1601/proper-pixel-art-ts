# proper-pixel-art-ts

Node-first TypeScript port of [`KennethJAllen/proper-pixel-art`](https://github.com/KennethJAllen/proper-pixel-art).

Current baseline tracks upstream commit `93945ff`.

## Goals

- mirror upstream module structure: `utils`, `colors`, `mesh`, `pixelate`
- keep browser-first APIs over `ImageData`
- support OpenCV.js through injection or script loading
- support Node package consumption first
- preserve upstream behavior before adding extra features

## Current scope

- upstream-style mesh detection and cell sampling pipeline
- transparency handling and dominant-color logic
- PIL-aligned MAXCOVERAGE palette built in TS, plus pluggable quantizer override
- OpenCV loader helper that auto-detects Node vs browser
- Vitest coverage for colors, mesh helpers, and pixelate/downsample flow

## Remaining work

- fixture parity against the full upstream asset set
- packaging polish and CI

## Current caveat

The Node package builds, imports, initializes OpenCV, and passes unit tests, but it does **not** yet match the upstream Python fixture outputs exactly. Use it as an active port, not as a verified drop-in equivalent.

## Development

```bash
bun install
bun run build
bun run test
bun run test:parity
```

`test:parity` is the browser/OpenCV fixture suite. It requires a working Playwright Chromium install.

## Example

```ts
import { loadOpenCv, pixelate } from 'proper-pixel-art-ts';

const cv = await loadOpenCv();
const result = await pixelate(inputImageData, {
  cv,
  initialUpscaleFactor: 2,
  numColors: undefined,
  transparentBackground: true,
});
```

In Node, `loadOpenCv()` falls back to `loadOpenCvNode()`, which initializes the runtime via `@opencvjs/node` (listed as an optional dependency — install it only if you need the Node loader).

## Using from React / Vite / webpack

The package ships an `exports` map with `browser` and `node` conditions, so modern bundlers pick the right entry automatically. In a React app, the default import resolves to the pre-bundled browser ESM (`dist/browser.js`, ~32 KB):

```tsx
import { loadOpenCv, pixelate } from 'proper-pixel-art-ts';
import { useEffect, useState } from 'react';

export function Pixelator({ source }: { source: HTMLImageElement }) {
  const [output, setOutput] = useState<ImageData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cv = await loadOpenCv(); // injects <script src="https://docs.opencv.org/4.x/opencv.js"> on first call
      const canvas = document.createElement('canvas');
      canvas.width = source.naturalWidth;
      canvas.height = source.naturalHeight;
      canvas.getContext('2d')!.drawImage(source, 0, 0);
      const input = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      const result = await pixelate(input, { cv, numColors: 16, scaleResult: 4, transparentBackground: true });
      if (!cancelled) setOutput(result);
    })();
    return () => { cancelled = true; };
  }, [source]);

  // …render `output` to a canvas
}
```

If you'd rather host OpenCV.js yourself, pass `scriptUrl`:

```ts
const cv = await loadOpenCv({ scriptUrl: '/static/opencv-4.10.0.js' });
```

Or skip the loader entirely and hand `pixelate` a `cv` namespace you've already initialized.

## Entry points

| Subpath | Resolves to | Use when |
|---|---|---|
| `proper-pixel-art-ts` (browser bundler) | `dist/browser.js` | React, Vite, webpack, esbuild, rollup — picked via the `browser` export condition |
| `proper-pixel-art-ts` (Node) | `dist/node.js` | Node scripts, SSR, tests — picked via the `node` export condition |
| `proper-pixel-art-ts/browser` | `dist/browser.js` | Force the pre-bundled ESM regardless of bundler condition |
| `proper-pixel-art-ts/node` | `dist/node.js` | Force the Node entry regardless of bundler condition |
