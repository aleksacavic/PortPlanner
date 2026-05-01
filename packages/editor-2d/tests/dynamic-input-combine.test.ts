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
  // M1.3 DI pipeline overhaul Phase 3 (B7) — signature now takes a
  // 4th `cursor` arg. Existing 7 cases pass null because their buffers
  // are non-empty (cursor unused per §4.0.2 priority: typed > cursor).
  // For numberPair tests with cursor=null: the resolveSignedComponent
  // helper returns the typed value as-is when cursorDelta is null.

  it("'numberPair' returns {kind: 'numberPair', a, b} from ['6', '4']", () => {
    const result = combineDynamicInputBuffers(NUMBER_PAIR, ['6', '4'], ZERO, null);
    expect(result).toEqual({ kind: 'numberPair', a: 6, b: 4 });
  });

  it("'point' deg→rad at [5, 30] from anchor (0,0) → ≈ (4.330, 2.500)", () => {
    const result = combineDynamicInputBuffers(POINT, ['5', '30'], ZERO, null);
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
    const result = combineDynamicInputBuffers(POINT, ['5', '90'], { x: 10, y: 20 }, null);
    expect(result).not.toBeNull();
    if (result?.kind === 'point') {
      expect(result.point.x).toBeCloseTo(10, 6);
      expect(result.point.y).toBeCloseTo(25, 6);
    } else {
      throw new Error('expected point arm');
    }
  });

  it("'point' 0° edge case at [5, 0] from anchor (0, 0) → (5, 0)", () => {
    const result = combineDynamicInputBuffers(POINT, ['5', '0'], ZERO, null);
    expect(result).not.toBeNull();
    if (result?.kind === 'point') {
      expect(result.point.x).toBeCloseTo(5, 6);
      expect(result.point.y).toBeCloseTo(0, 6);
    } else {
      throw new Error('expected point arm');
    }
  });

  it("'point' -45° negative angle at [5, -45] from anchor (0, 0) → (5*√2/2, -5*√2/2)", () => {
    const result = combineDynamicInputBuffers(POINT, ['5', '-45'], ZERO, null);
    expect(result).not.toBeNull();
    if (result?.kind === 'point') {
      expect(result.point.x).toBeCloseTo(5 * Math.cos(-Math.PI / 4), 6);
      expect(result.point.y).toBeCloseTo(5 * Math.sin(-Math.PI / 4), 6);
    } else {
      throw new Error('expected point arm');
    }
  });

  it("'number' returns {kind: 'number', value} from ['7']", () => {
    const result = combineDynamicInputBuffers(NUMBER_SINGLE, ['7'], ZERO, null);
    expect(result).toEqual({ kind: 'number', value: 7 });
  });

  it('returns null on empty / un-parseable buffers (caller treats as ignore-submit)', () => {
    expect(combineDynamicInputBuffers(NUMBER_PAIR, ['', '4'], ZERO, null)).toBeNull();
    expect(combineDynamicInputBuffers(NUMBER_PAIR, ['6', ''], ZERO, null)).toBeNull();
    expect(combineDynamicInputBuffers(NUMBER_PAIR, ['abc', '4'], ZERO, null)).toBeNull();
    expect(combineDynamicInputBuffers(POINT, ['5'], ZERO, null)).toBeNull(); // arity mismatch
  });
});

// M1.3 DI pipeline overhaul Phase 3 (B7) — direction inversion fixtures
// per §4.0.2. Cover line/polyline 'point' arm cursor-driven angle/dist
// + signed flip + rectangle 'numberPair' arm cursor-quadrant logic.
describe('combineDynamicInputBuffers — Phase 3 cursor-aware direction inversion', () => {
  const Q3_CURSOR: { x: number; y: number } = { x: -3, y: -4 }; // hypot 5, atan2 in Q3

  it("'point' typed Distance=5 + empty Angle + cursor in Q3 → produces point in Q3", () => {
    const result = combineDynamicInputBuffers(POINT, ['5', ''], ZERO, Q3_CURSOR);
    expect(result).not.toBeNull();
    if (result?.kind !== 'point') throw new Error('expected point arm');
    // Cursor angle = atan2(-4, -3); applied to typed distance 5.
    const expectedAngleRad = Math.atan2(-4, -3);
    expect(result.point.x).toBeCloseTo(5 * Math.cos(expectedAngleRad), 6);
    expect(result.point.y).toBeCloseTo(5 * Math.sin(expectedAngleRad), 6);
    // Both components negative → confirmed Q3.
    expect(result.point.x).toBeLessThan(0);
    expect(result.point.y).toBeLessThan(0);
  });

  it("'point' typed Distance=-5 + empty Angle + cursor in Q3 → flips 180° to Q1 (signed math)", () => {
    const result = combineDynamicInputBuffers(POINT, ['-5', ''], ZERO, Q3_CURSOR);
    expect(result).not.toBeNull();
    if (result?.kind !== 'point') throw new Error('expected point arm');
    // Negative distance flips the cursor direction by 180°.
    const expectedAngleRad = Math.atan2(-4, -3);
    expect(result.point.x).toBeCloseTo(-5 * Math.cos(expectedAngleRad), 6);
    expect(result.point.y).toBeCloseTo(-5 * Math.sin(expectedAngleRad), 6);
    // Result components positive → confirmed Q1 flip.
    expect(result.point.x).toBeGreaterThan(0);
    expect(result.point.y).toBeGreaterThan(0);
  });

  it("'point' typed Distance + typed Angle (both buffers) ignores cursor", () => {
    // typed [5, 30] regardless of cursor → same result as cursor=null.
    const result = combineDynamicInputBuffers(POINT, ['5', '30'], ZERO, Q3_CURSOR);
    expect(result).not.toBeNull();
    if (result?.kind !== 'point') throw new Error('expected point arm');
    expect(result.point.x).toBeCloseTo(5 * Math.cos(Math.PI / 6), 6);
    expect(result.point.y).toBeCloseTo(5 * Math.sin(Math.PI / 6), 6);
  });

  it("'point' empty Distance + typed Angle=0 + cursor at (10,0) → distance from cursor hypot", () => {
    const result = combineDynamicInputBuffers(POINT, ['', '0'], ZERO, { x: 10, y: 0 });
    expect(result).not.toBeNull();
    if (result?.kind !== 'point') throw new Error('expected point arm');
    // Distance = hypot(10, 0) = 10; angle = 0 (typed).
    expect(result.point.x).toBeCloseTo(10, 6);
    expect(result.point.y).toBeCloseTo(0, 6);
  });

  it("'numberPair' cursor right-down (Q4) + typed W=-5 → signed-W extends LEFT (cursor sign × typed sign)", () => {
    // Cursor right-down: dx > 0 (sign +1), dy < 0 (sign -1).
    // Typed W=-5 (sign -1) → effective W = (+1) * (-1) * 5 = -5 (extends LEFT).
    // No H typed; H = cursor.y - anchor.y = -3.
    const result = combineDynamicInputBuffers(NUMBER_PAIR, ['-5', ''], ZERO, { x: 8, y: -3 });
    expect(result).not.toBeNull();
    if (result?.kind !== 'numberPair') throw new Error('expected numberPair arm');
    expect(result.a).toBe(-5);
    expect(result.b).toBe(-3);
  });

  it("'numberPair' cursor right (Q1) + typed W=5 → signed-W extends RIGHT (matches cursor)", () => {
    // Cursor right: dx > 0 (sign +1). Typed W=5 (sign +1) → effective W = +5.
    const result = combineDynamicInputBuffers(NUMBER_PAIR, ['5', '3'], ZERO, { x: 10, y: 7 });
    expect(result).not.toBeNull();
    if (result?.kind !== 'numberPair') throw new Error('expected numberPair arm');
    expect(result.a).toBe(5);
    expect(result.b).toBe(3);
  });

  it("'numberPair' cursor left (Q2) + typed W=5 → cursor wins, W extends LEFT", () => {
    // Cursor left: dx < 0 (sign -1). Typed W=5 (sign +1) → effective W = (-1)*(+1)*5 = -5.
    const result = combineDynamicInputBuffers(NUMBER_PAIR, ['5', '4'], ZERO, { x: -10, y: 6 });
    expect(result).not.toBeNull();
    if (result?.kind !== 'numberPair') throw new Error('expected numberPair arm');
    expect(result.a).toBe(-5);
    expect(result.b).toBe(4);
  });
});
