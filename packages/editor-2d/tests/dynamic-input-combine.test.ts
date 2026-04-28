// M1.3 Round 6 — combineDynamicInputBuffers SSOT helper tests per plan §11.
// Covers all combineAs arms + the deg→rad invariant for combineAs:'point'
// (Rev-1 H2 + Codex Round-1 high-risk fix). Plan §10 audit C2.8.

import { describe, expect, it } from 'vitest';

import { combineDynamicInputBuffers } from '../src/tools/dynamic-input-combine';
import type { DynamicInputManifest } from '../src/tools/types';

const NUMBER_PAIR: DynamicInputManifest = {
  fields: [
    { kind: 'number', label: 'W' },
    { kind: 'number', label: 'H' },
  ],
  combineAs: 'numberPair',
};

const POINT: DynamicInputManifest = {
  fields: [
    { kind: 'distance', label: 'Distance' },
    { kind: 'angle', label: 'Angle' },
  ],
  combineAs: 'point',
};

const NUMBER_SINGLE: DynamicInputManifest = {
  fields: [{ kind: 'distance', label: 'Radius' }],
  combineAs: 'number',
};

const ZERO: { x: number; y: number } = { x: 0, y: 0 };

describe('combineDynamicInputBuffers — combineAs SSOT + deg→rad invariant', () => {
  it("'numberPair' returns {kind: 'numberPair', a, b} from ['6', '4']", () => {
    const result = combineDynamicInputBuffers(NUMBER_PAIR, ['6', '4'], ZERO);
    expect(result).toEqual({ kind: 'numberPair', a: 6, b: 4 });
  });

  it("'point' deg→rad at [5, 30] from anchor (0,0) → ≈ (4.330, 2.500)", () => {
    const result = combineDynamicInputBuffers(POINT, ['5', '30'], ZERO);
    expect(result).not.toBeNull();
    if (result?.kind === 'point') {
      // 5 * cos(π/6) = 5 * (√3/2) ≈ 4.330; 5 * sin(π/6) = 5 * 0.5 = 2.500.
      expect(result.point.x).toBeCloseTo(5 * Math.cos(Math.PI / 6), 6);
      expect(result.point.y).toBeCloseTo(5 * Math.sin(Math.PI / 6), 6);
      expect(result.point.x).toBeCloseTo(4.330127, 5);
      expect(result.point.y).toBeCloseTo(2.5, 5);
    } else {
      throw new Error('expected point arm');
    }
  });

  it("'point' 90° edge case at [5, 90] from anchor (10, 20) → (10, 25)", () => {
    const result = combineDynamicInputBuffers(POINT, ['5', '90'], { x: 10, y: 20 });
    expect(result).not.toBeNull();
    if (result?.kind === 'point') {
      expect(result.point.x).toBeCloseTo(10, 6);
      expect(result.point.y).toBeCloseTo(25, 6);
    } else {
      throw new Error('expected point arm');
    }
  });

  it("'point' 0° edge case at [5, 0] from anchor (0, 0) → (5, 0)", () => {
    const result = combineDynamicInputBuffers(POINT, ['5', '0'], ZERO);
    expect(result).not.toBeNull();
    if (result?.kind === 'point') {
      expect(result.point.x).toBeCloseTo(5, 6);
      expect(result.point.y).toBeCloseTo(0, 6);
    } else {
      throw new Error('expected point arm');
    }
  });

  it("'point' -45° negative angle at [5, -45] from anchor (0, 0) → (5*√2/2, -5*√2/2)", () => {
    const result = combineDynamicInputBuffers(POINT, ['5', '-45'], ZERO);
    expect(result).not.toBeNull();
    if (result?.kind === 'point') {
      expect(result.point.x).toBeCloseTo(5 * Math.cos(-Math.PI / 4), 6);
      expect(result.point.y).toBeCloseTo(5 * Math.sin(-Math.PI / 4), 6);
    } else {
      throw new Error('expected point arm');
    }
  });

  it("'number' returns {kind: 'number', value} from ['7']", () => {
    const result = combineDynamicInputBuffers(NUMBER_SINGLE, ['7'], ZERO);
    expect(result).toEqual({ kind: 'number', value: 7 });
  });

  it('returns null on empty / un-parseable buffers (caller treats as ignore-submit)', () => {
    expect(combineDynamicInputBuffers(NUMBER_PAIR, ['', '4'], ZERO)).toBeNull();
    expect(combineDynamicInputBuffers(NUMBER_PAIR, ['6', ''], ZERO)).toBeNull();
    expect(combineDynamicInputBuffers(NUMBER_PAIR, ['abc', '4'], ZERO)).toBeNull();
    expect(combineDynamicInputBuffers(POINT, ['5'], ZERO)).toBeNull(); // arity mismatch
  });
});
