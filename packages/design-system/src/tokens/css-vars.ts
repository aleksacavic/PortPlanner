// Emit CSS custom properties from a SemanticTokens tree.
// Pure and deterministic: keys are sorted lexicographically so output is
// byte-stable across runs (tested in tokens.test.ts).

import type { SemanticTokens } from './themes';

/**
 * Return the semantic-token tree as a string of CSS custom-property
 * declarations, one per line, sorted by key.
 *
 * Example output (excerpt):
 * ```
 *   --accent-primary: #2a7fff;
 *   --canvas-snap-indicator: #00e5a0;
 *   --surface-base: #1a1a2e;
 * ```
 *
 * Underscore-separated leaf keys (e.g. `snap_indicator`) are converted to
 * kebab-case (`snap-indicator`).
 */
export function emitCSSVars(tokens: SemanticTokens): string {
  return emitCSSVarEntries(tokens)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n');
}

/**
 * Return the flat entries the ThemeProvider uses at runtime to call
 * `document.documentElement.style.setProperty`. Sorted deterministically.
 */
export function emitCSSVarEntries(tokens: SemanticTokens): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  flatten(tokens as unknown as Record<string, unknown>, '', out);
  out.sort((a, b) => a[0].localeCompare(b[0]));
  return out;
}

function flatten(obj: Record<string, unknown>, prefix: string, out: Array<[string, string]>): void {
  for (const [key, value] of Object.entries(obj)) {
    const k = prefix ? `${prefix}-${toKebab(key)}` : toKebab(key);
    if (typeof value === 'string') {
      out.push([k, value]);
    } else if (typeof value === 'object' && value !== null) {
      flatten(value as Record<string, unknown>, k, out);
    }
  }
}

function toKebab(s: string): string {
  return s.replaceAll('_', '-');
}
