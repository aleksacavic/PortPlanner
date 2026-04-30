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
 * **M1.3 DI pipeline overhaul Phase 3 (B7) — cursor-aware combining.**
 * The combiner now reads `cursor` to support:
 * - 'point' arm: when distance OR angle buffer is empty, derive the
 *   missing field from the cursor (matches what the live-cursor pill
 *   displays). Negative typed distance naturally flips 180° via
 *   signed math (no special-case branch needed).
 * - 'numberPair' arm: cursor's quadrant determines W/H signs;
 *   typed sign optionally flips. Cursor direction wins.
 *
 * 'number' (circle radius) and 'angle' (xline) arms ignore cursor
 * per A11 / A12 — single-field, no direction to invert.
 *
 * The `locked: boolean[]` slice field is NOT a parameter here — its
 * semantic role lives in chrome (suppress live read on locked field)
 * and router (don't re-lock on Tab). Buffer-emptiness alone gates
 * "use cursor" vs "use typed" per plan A19.
 *
 * @param manifest — declarative metadata: field kinds + combineAs policy.
 * @param buffers — per-field raw text. `buffers.length` MUST equal `manifest.fields.length`.
 * @param anchor — metric anchor for `combineAs: 'point'` polar conversion (e.g. line p1, polyline last vertex) and `combineAs: 'numberPair'` quadrant resolution (rectangle corner1).
 * @param cursor — most recent canvas cursor metric (lastKnownCursor); may be null when no mousemove has happened yet. When null, the combiner falls back to typed-only semantics if every required buffer is non-empty; if any required buffer is empty AND cursor is null, returns null.
 * @returns `Input` (kind matching the combineAs arm) or `null` on empty / un-parseable buffers.
 */
export function combineDynamicInputBuffers(
  manifest: DynamicInputManifest,
  buffers: string[],
  anchor: Point2D,
  cursor: Point2D | null,
): Input | null {
  if (buffers.length !== manifest.fields.length) return null;

  switch (manifest.combineAs) {
    case 'numberPair': {
      // M1.3 DI pipeline overhaul Phase 3 (B7) — signed numberPair
      // with cursor-quadrant direction. Per §4.0.2 and rectangle tool's
      // post-Phase-3 commit logic (drops Math.abs), the W and H values
      // are signed: cursor's X-sign × typed-sign × |W|, and likewise
      // for H. Cursor direction wins; typed sign optionally flips.
      if (buffers.length !== 2) return null;
      const wRaw = parseSignedFloat(buffers[0] ?? '');
      const hRaw = parseSignedFloat(buffers[1] ?? '');

      const w = resolveSignedComponent(wRaw, cursor ? cursor.x - anchor.x : null);
      if (w === null) return null;
      const h = resolveSignedComponent(hRaw, cursor ? cursor.y - anchor.y : null);
      if (h === null) return null;
      return { kind: 'numberPair', a: w, b: h };
    }
    case 'point': {
      // M1.3 DI pipeline overhaul Phase 3 (B7) — cursor-aware polar.
      // Per §4.0.2: distance buffer empty → use hypot(cursor - anchor);
      // angle buffer empty → use atan2(cursor - anchor). Negative typed
      // distance naturally flips 180° via signed multiplication.
      // ANGLE FIELD IS DEGREES (AC parity per ADR-025 §4); helper
      // performs deg→rad conversion before applying cos/sin.
      if (buffers.length !== 2) return null;

      // Resolve angleRad (priority: typed buffer > cursor-derived):
      let angleRad: number;
      const angleBuf = (buffers[1] ?? '').trim();
      if (angleBuf.length > 0) {
        const angleDeg = Number(angleBuf);
        if (!Number.isFinite(angleDeg)) return null;
        angleRad = (angleDeg * Math.PI) / 180;
      } else if (cursor) {
        angleRad = Math.atan2(cursor.y - anchor.y, cursor.x - anchor.x);
      } else {
        return null;
      }

      // Resolve distance (priority: typed buffer signed > cursor hypot):
      let distance: number;
      const distBuf = (buffers[0] ?? '').trim();
      if (distBuf.length > 0) {
        const d = Number(distBuf);
        if (!Number.isFinite(d)) return null;
        distance = d;
      } else if (cursor) {
        distance = Math.hypot(cursor.x - anchor.x, cursor.y - anchor.y);
      } else {
        return null;
      }

      return {
        kind: 'point',
        point: {
          x: anchor.x + Math.cos(angleRad) * distance,
          y: anchor.y + Math.sin(angleRad) * distance,
        },
      };
    }
    case 'number': {
      // Plan A7 + A11: circle radius (single-field manifest). Cursor
      // ignored (no direction to invert for a single-field manifest).
      // Existing semantics preserved — combiner emits raw signed value;
      // tool's Math.abs reject-zero handles the rest.
      if (buffers.length !== 1) return null;
      const raw = (buffers[0] ?? '').trim();
      if (raw.length === 0) return null;
      const value = Number(raw);
      if (!Number.isFinite(value)) return null;
      return { kind: 'number', value };
    }
    case 'angle': {
      // Plan A7 + A12: xline direction angle. Single-field [Angle]
      // manifest; cursor ignored (xline is bidirectional). Helper
      // converts deg→rad as before.
      if (buffers.length !== 1) return null;
      const raw = (buffers[0] ?? '').trim();
      if (raw.length === 0) return null;
      const angleDeg = Number(raw);
      if (!Number.isFinite(angleDeg)) return null;
      const angleRad = (angleDeg * Math.PI) / 180;
      return { kind: 'angle', radians: angleRad };
    }
  }
}

/** Parse a typed buffer into a signed float; returns null when empty
 *  or un-parseable (so caller can fall back to cursor-derived). */
function parseSignedFloat(buf: string): number | null {
  const trimmed = buf.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Resolve a signed numberPair component (W or H) per §4.0.2:
 *  - typed buffer non-empty: cursor's sign × typed sign × |typed|
 *    (cursor direction wins; typed sign optionally flips).
 *  - typed buffer empty + cursor non-null: cursor delta as-is.
 *  - typed buffer empty + cursor null: null (caller propagates as "ignore").
 *  When cursor delta is exactly 0 (cursor on anchor axis), we treat
 *  the cursor sign as +1 so a typed value still applies in the +X/+Y
 *  direction by default. */
function resolveSignedComponent(typed: number | null, cursorDelta: number | null): number | null {
  if (typed !== null) {
    if (cursorDelta !== null) {
      const cursorSign = cursorDelta >= 0 ? 1 : -1;
      const typedSign = typed < 0 ? -1 : 1;
      return cursorSign * typedSign * Math.abs(typed);
    }
    return typed;
  }
  if (cursorDelta !== null) return cursorDelta;
  return null;
}
