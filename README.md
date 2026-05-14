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
- built-in quantized path using `image-q`, plus pluggable quantizer override
- OpenCV loader helper for Node entrypoints
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

## Entry points

- `proper-pixel-art-ts` → `dist/node.js`. Supported Node-first surface.
- `proper-pixel-art-ts/browser` → `dist/browser.js`. Experimental browser-oriented bundle/export surface.
