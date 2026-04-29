// Painter token-parsing helpers. SSOT for converting `Color` (string)
// design-token leaves into the numeric values painters consume at
// runtime. Per ADR-025 §6 + canvas-tokens-and-di-polish plan A13:
// every overlay painter that reads numeric chrome from
// `canvas.transient.*` imports from THIS module rather than defining
// a local `parseDashPattern` / `parsePadding` (which were duplicated
// across paintCrosshair / paintHoverHighlight / paintSelectionRect /
// paintTransientLabel before consolidation).
//
// Why string-typed numeric leaves? The css-vars emitter (`themes.ts`
// → `css-vars.ts`) requires every leaf to be a `Color` (string) so the
// CSS variable namespace is uniformly serialisable. Painters parse on
// consumption.
//
// Negative-input behaviour is locked by `_tokens.test.ts`
// (Gate REM7-P1-ParseHelperNegative): malformed numeric tokens throw
// a recognisable Error; malformed dash tokens filter to a finite
// subset (or `[]` for the `'solid'` sentinel / empty input).

/**
 * Parse a numeric design-token value (e.g. `'40'`, `'1.5'`) into a
 * finite `number`. Throws if the input is empty after trim, parses to
 * `NaN`, or is `±Infinity`. Caller passes the offending leaf path
 * implicitly via the value text in the error message — readers can
 * grep the message for fast diagnosis.
 *
 * @example
 *   parseNumericToken('40')        // → 40
 *   parseNumericToken('1.5')       // → 1.5
 *   parseNumericToken('')          // throws Error
 *   parseNumericToken('40px')      // throws Error (non-pure number)
 *   parseNumericToken('NaN')       // throws Error
 *   parseNumericToken('Infinity')  // throws Error
 */
export function parseNumericToken(s: string): number {
  const trimmed = s.trim();
  if (trimmed.length === 0) {
    throw new Error(`parseNumericToken: invalid value "${s}" (empty after trim)`);
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    throw new Error(`parseNumericToken: invalid value "${s}" (not a finite number)`);
  }
  return n;
}

/**
 * Parse a space-separated dash-pattern token (e.g. `'6 4'`, `'2 3'`)
 * into a numeric array suitable for `ctx.setLineDash`. The literal
 * `'solid'` sentinel + empty / whitespace-only input both yield `[]`
 * (no dashing — caller skips `setLineDash` or passes `[]` explicitly).
 * Non-finite tokens within the input are filtered out, mirroring the
 * pre-consolidation behaviour of the three duplicate copies in
 * paintCrosshair / paintHoverHighlight / paintSelectionRect.
 *
 * @example
 *   parseDashPattern('6 4')         // → [6, 4]
 *   parseDashPattern('solid')       // → []
 *   parseDashPattern('')            // → []
 *   parseDashPattern('  ')          // → []
 *   parseDashPattern('6 nope 4')    // → [6, 4]
 */
export function parseDashPattern(token: string): number[] {
  const trimmed = token.trim();
  if (trimmed === '' || trimmed === 'solid') return [];
  return trimmed
    .split(/\s+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}
