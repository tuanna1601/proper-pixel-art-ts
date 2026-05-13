import { describe, expect, it } from 'vitest';
import { clusterLines, getPixelWidth, homogenizeLines, isTrivialMesh } from '../src/mesh';

describe('mesh helpers', () => {
  it('clusters nearby lines by median', () => {
    expect(clusterLines([0, 2, 3, 10, 11, 20], 2)).toEqual([2, 11, 20]);
  });

  it('infers pixel width from median gaps', () => {
    expect(getPixelWidth([[0, 8, 16, 24], [0, 7, 15, 23]])).toBe(8);
  });

  it('homogenizes uneven sections', () => {
    expect(homogenizeLines([0, 17], 8)).toEqual([0, 8, 17]);
  });

  it('detects trivial meshes', () => {
    expect(isTrivialMesh({ linesX: [0, 10], linesY: [0, 10, 20] })).toBe(true);
    expect(isTrivialMesh({ linesX: [0, 5, 10, 15], linesY: [0, 10] })).toBe(false);
  });
});
