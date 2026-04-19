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
