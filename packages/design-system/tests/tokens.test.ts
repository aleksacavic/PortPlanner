import { describe, expect, it } from 'vitest';
import { type ThemeMode, dark, emitCSSVarEntries, emitCSSVars } from '../src';

describe('semantic-dark tokens', () => {
  it('every SemanticTokens leaf has a non-empty string value', () => {
    const check = (obj: unknown, path: string): void => {
      if (typeof obj === 'string') {
        expect(obj.length, `token "${path}" must be non-empty`).toBeGreaterThan(0);
        return;
      }
      if (obj && typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
          check(value, path ? `${path}.${key}` : key);
        }
      }
    };
    check(dark, '');
  });
});

describe('emitCSSVars', () => {
  it('is deterministic across repeated calls', () => {
    const a = emitCSSVars(dark);
    const b = emitCSSVars(dark);
    expect(a).toBe(b);
  });

  it('emits exactly one declaration per leaf token', () => {
    const output = emitCSSVars(dark);
    const lines = output.split('\n').filter((l) => l.trim().length > 0);

    let leaves = 0;
    const count = (obj: unknown): void => {
      if (typeof obj === 'string') {
        leaves += 1;
        return;
      }
      if (obj && typeof obj === 'object') {
        for (const v of Object.values(obj)) count(v);
      }
    };
    count(dark);

    expect(lines).toHaveLength(leaves);
  });

  it('uses kebab-case CSS variable names (underscores converted)', () => {
    const output = emitCSSVars(dark);
    expect(output).toContain('--surface-base:');
    expect(output).toContain('--canvas-snap-indicator:');
    expect(output).toContain('--interactive-focus-ring:');
    expect(output).not.toMatch(/--[a-z]+_/);

    const entries = emitCSSVarEntries(dark);
    // Verify the sorted order matches what the string form would produce
    const strFromEntries = entries.map(([k, v]) => `  --${k}: ${v};`).join('\n');
    expect(strFromEntries).toBe(output);
  });

  // M1.3d Phase 1 — Gate DTP-1.3 evidence (per plan §8 Phase 1, swapped
  // to test-level assertion in §13 Post-execution notes). The
  // `canvas.transient.*` sub-namespace is nested; assert the emitter's
  // recursion produces the expected `--canvas-transient-*` CSS vars
  // (a sample drawn from each nesting depth — leaf at the transient
  // root, leaf inside a nested object).
  it('emits --canvas-transient-* CSS vars for the nested transient namespace', () => {
    const output = emitCSSVars(dark);
    expect(output).toContain('--canvas-transient-preview-stroke:');
    expect(output).toContain('--canvas-transient-preview-dash:');
    // M1.3 Round 7 backlog B3 wiped paintTransientLabel + 5 label_* tokens
    // (label_text, label_bg, label_padding, label_font_size, label_radius).
    // Asserting on `dim_witness_offset` instead — a top-level transient
    // leaf added in M1.3 Round 7 Phase 1 that's currently in production.
    expect(output).toContain('--canvas-transient-dim-witness-offset:');
    expect(output).toContain('--canvas-transient-selection-window-stroke:');
    expect(output).toContain('--canvas-transient-selection-crossing-fill:');
    expect(output).toContain('--canvas-transient-hover-highlight-dash:');
    // M1.3 snap-engine-extension Phase 2 — quadrant_side leaf added
    // for circle quadrant snap glyph.
    expect(output).toContain('--canvas-transient-snap-glyph-quadrant-side:');
  });
});

describe('ThemeMode type narrowness (M1.1 progressive implementation)', () => {
  it('accepts "dark"', () => {
    const m: ThemeMode = 'dark';
    expect(m).toBe('dark');
  });

  it('rejects "light" and "system" at the type level', () => {
    // @ts-expect-error — 'light' is not assignable to ThemeMode in M1.1.
    const invalidLight: ThemeMode = 'light';
    // @ts-expect-error — 'system' is not assignable to ThemeMode in M1.1.
    const invalidSystem: ThemeMode = 'system';
    // These values exist at runtime (strings), but TS enforces the contract.
    expect(typeof invalidLight).toBe('string');
    expect(typeof invalidSystem).toBe('string');
  });
});
