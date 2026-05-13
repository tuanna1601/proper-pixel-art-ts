# proper-pixel-art-ts

TypeScript port of [`KennethJAllen/proper-pixel-art`](https://github.com/KennethJAllen/proper-pixel-art) for browser and worker runtimes.

Current baseline tracks upstream commit `93945ff`.

## Goals

- mirror upstream module structure: `utils`, `colors`, `mesh`, `pixelate`
- keep browser-first APIs over `ImageData`
- support OpenCV.js through injection or script loading
- support both browser and Node package consumption
- preserve upstream behavior before adding extra features

## Current scope

- upstream-style mesh detection and cell sampling pipeline
- transparency handling and dominant-color logic
- built-in quantized path using `image-q`, plus pluggable quantizer override
- OpenCV.js loader helper for browser and Node entrypoints
- Vitest coverage for colors, mesh helpers, and pixelate/downsample flow

## Remaining work

- fixture parity against the full upstream asset set
- packaging polish and CI

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

In Node, `loadOpenCv()` falls back to `loadOpenCvNode()`, which compiles the WASM runtime via `@opencvjs/node` (listed as an optional dependency — install it only if you need the Node loader). In browsers, it injects the OpenCV.js script tag (default `https://docs.opencv.org/4.x/opencv.js`) and waits for `onRuntimeInitialized`.

## Entry points

- `proper-pixel-art-ts` → `dist/index.js`. The ESM source you want bundlers (Vite, webpack, esbuild, rollup) to resolve. `@opencvjs/node` is loaded via an opaque dynamic import, so browser bundles never pull in its WASM blob.
- `proper-pixel-art-ts/browser` → `dist/browser.js`. A prebundled, dependency-inlined ESM (~120 KB) for direct `<script type="module">` use without a bundler.
