// Gate REM7-P1-ParseHelperNegative — locks the parse-failure contract
// for the SSOT helpers in canvas/painters/_tokens.ts. Future helper
// changes that silently swallow malformed tokens must update this
// suite or be reverted.

import { describe, expect, it } from 'vitest';

import { parseDashPattern, parseNumericToken } from '../src/canvas/painters/_tokens';

describe('parseNumericToken — positive cases', () => {
  it('parses "40" → 40', () => {
    expect(parseNumericToken('40')).toBe(40);
  });

  it('parses "1.5" → 1.5', () => {
    expect(parseNumericToken('1.5')).toBe(1.5);
  });

  it('parses "0" → 0 (zero is finite, not invalid)', () => {
    expect(parseNumericToken('0')).toBe(0);
  });

  it('parses "-3" → -3 (negative is finite)', () => {
    expect(parseNumericToken('-3')).toBe(-3);
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parseNumericToken('  40  ')).toBe(40);
  });
});

describe('parseNumericToken — negative cases (REM7-P1-ParseHelperNegative)', () => {
  it('throws on empty string', () => {
    expect(() => parseNumericToken('')).toThrow(/invalid value/);
  });

  it('throws on whitespace-only string', () => {
    expect(() => parseNumericToken('   ')).toThrow(/invalid value/);
  });

  it('throws on non-pure number (e.g. "40px")', () => {
    expect(() => parseNumericToken('40px')).toThrow(/invalid value/);
  });

  it('throws on "NaN" literal', () => {
    expect(() => parseNumericToken('NaN')).toThrow(/invalid value/);
  });

  it('throws on "Infinity"', () => {
    expect(() => parseNumericToken('Infinity')).toThrow(/invalid value/);
  });

  it('throws on "-Infinity"', () => {
    expect(() => parseNumericToken('-Infinity')).toThrow(/invalid value/);
  });
});

describe('parseDashPattern — positive cases', () => {
  it('parses "6 4" → [6, 4]', () => {
    expect(parseDashPattern('6 4')).toEqual([6, 4]);
  });

  it('parses "2 3" → [2, 3]', () => {
    expect(parseDashPattern('2 3')).toEqual([2, 3]);
  });

  it('handles multiple internal spaces', () => {
    expect(parseDashPattern('6   4')).toEqual([6, 4]);
  });
});

describe('parseDashPattern — sentinel + degraded cases', () => {
  it('returns [] for the "solid" sentinel', () => {
    expect(parseDashPattern('solid')).toEqual([]);
  });

  it('returns [] for empty string', () => {
    expect(parseDashPattern('')).toEqual([]);
  });

  it('returns [] for whitespace-only string', () => {
    expect(parseDashPattern('   ')).toEqual([]);
  });

  it('filters non-finite tokens (e.g. "6 nope 4" → [6, 4])', () => {
    expect(parseDashPattern('6 nope 4')).toEqual([6, 4]);
  });

  it('filters all-non-finite input to []', () => {
    expect(parseDashPattern('nope nope')).toEqual([]);
  });
});
