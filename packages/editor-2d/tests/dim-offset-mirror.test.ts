// Gate REM7-P1-DimOffsetMirror — locks the literal-vs-token equality
// for the witness-offset SSOT (per ADR-025 §6 + canvas-tokens-and-di-
// polish plan A12). The exported `DIM_OFFSET_CSS = 40` literal in
// `paintDimensionGuides.ts` is consumed at module load by tools (line,
// polyline, rectangle, circle) that don't have access to the live
// `tokens` parameter. The same numeric value lives in
// `canvas.transient.dim_witness_offset` token. This test asserts both
// stay in sync — a future contributor changing the literal without
// updating the token (or vice versa) fails immediately.

import { dark } from '@portplanner/design-system';
import { describe, expect, it } from 'vitest';

import { parseNumericToken } from '../src/canvas/painters/_tokens';
import { DIM_OFFSET_CSS } from '../src/canvas/painters/paintDimensionGuides';

describe('DIM_OFFSET_CSS literal mirrors canvas.transient.dim_witness_offset token (Gate REM7-P1-DimOffsetMirror)', () => {
  it('exported literal equals 40', () => {
    expect(DIM_OFFSET_CSS).toBe(40);
  });

  it('dark theme dim_witness_offset token parses to the same value as DIM_OFFSET_CSS', () => {
    const tokenValue = parseNumericToken(dark.canvas.transient.dim_witness_offset);
    expect(tokenValue).toBe(DIM_OFFSET_CSS);
  });
});
