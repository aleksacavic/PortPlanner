// M1.3 Round 6 — SSOT helper for `combineAs` policies per ADR-024.
// Plan §3 A7: helper does the COMBINATION; per-field parsing is a thin
// `Number(...)` + finite-check line (no shared parser to delegate to —
// the existing path in EditorRoot.handleCommandSubmit is a 3-line
// inline implementation, not a callable helper, so this file owns its
// own parsing for sparse manifest buffers without violating SSOT —
// the SSOT is the deg→rad conversion + combineAs policy registry,
// both of which live here only).
//
// Plan §3 A7 angle invariant: typed `angle` field is INVARIANT in
// DEGREES (AC convention; user types "30" expecting 30°). The helper
// performs deg→rad conversion ONLY for `combineAs: 'point'` polar
// trig. Future trig users (M1.3b Rotate sweep) MUST route through
// this helper — Gate REM6-P1-AngleUnit greps for the conversion
// symbol IN this file AND verifies zero matches in EditorRoot.tsx.
//
// Returns `null` if any required buffer is empty / un-parseable;
// caller (EditorRoot.onSubmitDynamicInput) treats null as "ignore
// submit" — no Input fed, buffers preserved for the user to edit.

import type { Point2D } from '@portplanner/domain';

import type { DynamicInputManifest, Input } from './types';
// `Input` is exported from types.ts; re-imported here so callers don't
// need both modules. Type-only import keeps the helper free of any
// runtime dependency beyond the @portplanner/domain Point2D type.

/**
 * Combine per-field DI buffers into a single `Input` per the
 * manifest's `combineAs` policy. Pure function. SSOT for the
 * `combineAs` enum + the `'point'` deg→rad conversion.
 *
 * @param manifest — declarative metadata: field kinds + combineAs policy.
 * @param buffers — per-field raw text. `buffers.length` MUST equal `manifest.fields.length`.
 * @param anchor — metric anchor for `combineAs: 'point'` polar conversion (e.g. line p1, polyline last vertex). Ignored by other combineAs arms.
 * @returns `Input` (kind matching the combineAs arm) or `null` on empty / un-parseable buffers.
 */
export function combineDynamicInputBuffers(
  manifest: DynamicInputManifest,
  buffers: string[],
  anchor: Point2D,
): Input | null {
  if (buffers.length !== manifest.fields.length) return null;

  // Parse every buffer as a finite number. Empty / NaN → reject.
  const parsed: number[] = [];
  for (const raw of buffers) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    parsed.push(n);
  }

  switch (manifest.combineAs) {
    case 'numberPair': {
      // Plan A7: rectangle's W,H. Re-uses the M1.3d-Rem-5 H1 numberPair
      // Input arm; same parser semantics inline (Number(raw) +
      // Number.isFinite, plus per-token trim guard above).
      if (parsed.length !== 2) return null;
      const [a, b] = parsed as [number, number];
      return { kind: 'numberPair', a, b };
    }
    case 'point': {
      // Plan A7: polar conversion. ANGLE FIELD IS DEGREES (AC parity);
      // helper performs deg→rad conversion via (angleDeg * Math.PI) / 180
      // before applying cos/sin. Anchor supplied by caller (sourced
      // from overlay.dimensionGuides[0].anchorA at submit time per
      // plan §10 audit C2.5). SSOT for the conversion lives ONLY in
      // this file — Gate REM6-P1-AngleUnit asserts EditorRoot.tsx has
      // zero conversion-symbol matches.
      if (parsed.length !== 2) return null;
      const [distance, angleDeg] = parsed as [number, number];
      const angleRad = (angleDeg * Math.PI) / 180;
      return {
        kind: 'point',
        point: {
          x: anchor.x + Math.cos(angleRad) * distance,
          y: anchor.y + Math.sin(angleRad) * distance,
        },
      };
    }
    case 'number': {
      // Plan A7: circle radius (single-field manifest).
      if (parsed.length !== 1) return null;
      const [value] = parsed as [number];
      return { kind: 'number', value };
    }
    case 'angle': {
      // Round-2: xline direction angle. Single-field [Angle] manifest;
      // typed value is in DEGREES (AC parity, same convention as the
      // 'point' arm's angle component). Helper converts deg→rad and
      // emits { kind: 'angle', radians } so the xline tool can derive
      // the through-point at any unit length along that direction.
      if (parsed.length !== 1) return null;
      const [angleDeg] = parsed as [number];
      const angleRad = (angleDeg * Math.PI) / 180;
      return { kind: 'angle', radians: angleRad };
    }
  }
}
