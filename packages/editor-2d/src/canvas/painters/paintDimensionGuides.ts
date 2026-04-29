// paintDimensionGuides — overlay-pass painter for the M1.3 Round 6
// Dynamic Input dimension guides (per ADR-025):
//   - `linear-dim` FULL mode: witness + dim lines + filled-square
//     end-caps (NO arrow ticks — AC uses end-caps INSTEAD of arrows).
//   - `linear-dim` INLINE mode (offsetCssPx === 0): perpendicular
//     ticks at each segment endpoint (the segment itself is the dim).
//   - `angle-arc`: dotted polar reference baseline + dotted arc at
//     metric `radiusMetric`. Pivot = vertex of the angle. Arc and
//     baseline are the same length so the arc terminates on the
//     baseline endpoint.
// (`radius-line` variant existed in ADR-024 but was removed in
// Remediation Round-3 — circle now uses `linear-dim`.)
//
// I-DTP-9 / Gate DTP-T6: this painter MUST NOT import or read
// projectStore. Guides are UI-only state; each guide arm fully
// describes the geometry via flat metric coords (Rev-2 H1 lock —
// Gate REM6-P1-DimensionGuideTypes asserts the schema is flat-coord-
// only with no reference strings, callbacks, or anchor IDs).
//
// I-DTP-8 / Gate DTP-T2: this painter MUST NOT call the canvas text
// APIs (paintTransientLabel + paintGrid are the SOLE allowed callers).
// Pill labels live in DOM (DynamicInputPills); guides are pure-vector
// strokes (witness/dim/arrow lines + arcs + tick marks). The forbidden
// method names are deliberately not mentioned in this file's prose so
// the gate's substring grep doesn't trip on documentation.
//
// Each arm draws in METRIC SPACE (the active transform is the metric
// transform applied by paint.ts). Stroke patterns / widths follow the
// same `canvas.transient.preview_stroke` + screen-px-to-metric
// conversion idiom as paintPreview / paintTransientLabel.

import type { SemanticTokens } from '@portplanner/design-system';

import type { DimensionGuide } from '../../tools/types';
import type { Viewport } from '../view-transform';
import { parseDashPattern, parseNumericToken } from './_tokens';

/**
 * SSOT for the dim-line perpendicular offset distance (in CSS pixels).
 * Used by ALL primitives that emit a `linear-dim` guide — rectangle
 * W/H, line/polyline distance, and any future operators. Tools import
 * this constant rather than hard-coding magic numbers per call-site
 * (Round-2 remediation: user-locked SSOT, every primitive's witness
 * offset MUST resolve through this constant).
 *
 * **Round 7 (canvas-tokens-and-di-polish A12) lock:** the literal `40`
 * is mirrored by `canvas.transient.dim_witness_offset: '40'` in
 * `semantic-dark.ts`. Equality is locked by
 * `tests/dim-offset-mirror.test.ts`. The literal stays in this file
 * so tools that consume `DIM_OFFSET_CSS` at module load (line /
 * polyline / rectangle / circle) don't depend on design-system
 * bundle parsing at import time.
 */
export const DIM_OFFSET_CSS = 40;

export function paintDimensionGuides(
  ctx: CanvasRenderingContext2D,
  guides: DimensionGuide[],
  viewport: Viewport,
  tokens: SemanticTokens,
): void {
  if (guides.length === 0) return;
  const transient = tokens.canvas.transient;
  const metricToPx = viewport.zoom * viewport.dpr;
  const dimStrokeWidthCss = parseNumericToken(transient.dim_stroke_width);
  const arrowTickCss = parseNumericToken(transient.dim_arrow_tick);
  const witnessOvershootCss = parseNumericToken(transient.dim_witness_overshoot);
  const witnessEndcapCss = parseNumericToken(transient.dim_witness_endcap);
  const dashedPatternCss = parseDashPattern(transient.dim_dashed_pattern);
  const lineWidthMetric = dimStrokeWidthCss / metricToPx;

  ctx.save();
  ctx.strokeStyle = transient.preview_stroke;
  ctx.fillStyle = transient.preview_stroke;
  ctx.lineWidth = lineWidthMetric;
  ctx.setLineDash([]);

  for (const guide of guides) {
    switch (guide.kind) {
      case 'linear-dim':
        paintLinearDim(ctx, guide, metricToPx, {
          arrowTickCss,
          witnessOvershootCss,
          witnessEndcapCss,
          dashedPatternCss,
        });
        break;
      case 'angle-arc':
        paintAngleArc(ctx, guide, metricToPx, { dashedPatternCss });
        break;
    }
  }

  ctx.restore();
}

interface LinearDimChrome {
  arrowTickCss: number;
  witnessOvershootCss: number;
  witnessEndcapCss: number;
  dashedPatternCss: number[];
}

interface AngleArcChrome {
  dashedPatternCss: number[];
}

/**
 * Linear dimension. Two render modes selected by `offsetCssPx`:
 *
 *   offsetCssPx > 0 — FULL AC-style measured-dim look (rectangle W/H):
 *     - Witness lines from each anchor extending PAST the dim line by
 *       WITNESS_OVERSHOOT_CSS, drawn DOTTED.
 *     - Dim line parallel to segment at offsetCssPx perpendicular,
 *       drawn DOTTED.
 *     - Filled-square end-caps at the witness endpoints (NOT arrow
 *       ticks — AC uses end-caps INSTEAD of arrows).
 *     - Pill consumer (DynamicInputPills) anchors on dim-line midpoint.
 *
 *   offsetCssPx === 0 — INLINE mode (line/polyline distance):
 *     - No witness lines, no separate dim line. The rubber-band line
 *       itself IS the dim reference.
 *     - Small perpendicular ticks at each segment endpoint.
 *     - Pill consumer anchors on segment midpoint.
 *
 * Sign convention: perpendicular = CCW rotation of (anchorB - anchorA)
 * in metric Y-up. The dim line lands on the LEFT of (B - A); callers
 * choose the (A, B) order accordingly.
 */
function paintLinearDim(
  ctx: CanvasRenderingContext2D,
  guide: {
    kind: 'linear-dim';
    anchorA: { x: number; y: number };
    anchorB: { x: number; y: number };
    offsetCssPx: number;
  },
  metricToPx: number,
  chrome: LinearDimChrome,
): void {
  const { anchorA, anchorB, offsetCssPx } = guide;
  const { arrowTickCss, witnessOvershootCss, witnessEndcapCss, dashedPatternCss } = chrome;
  const dx = anchorB.x - anchorA.x;
  const dy = anchorB.y - anchorA.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;

  const perpX = -dy / len;
  const perpY = dx / len;
  const tickMetric = arrowTickCss / metricToPx;

  if (offsetCssPx === 0) {
    // INLINE mode — perpendicular ticks at each endpoint of the segment.
    const halfTick = tickMetric * 0.5;
    ctx.beginPath();
    ctx.moveTo(anchorA.x + perpX * halfTick, anchorA.y + perpY * halfTick);
    ctx.lineTo(anchorA.x - perpX * halfTick, anchorA.y - perpY * halfTick);
    ctx.moveTo(anchorB.x + perpX * halfTick, anchorB.y + perpY * halfTick);
    ctx.lineTo(anchorB.x - perpX * halfTick, anchorB.y - perpY * halfTick);
    ctx.stroke();
    return;
  }

  // FULL mode — witness + dim lines + filled-square end-caps.
  const dashMetric = dashedPatternCss.map((n) => n / metricToPx);
  const endcapMetric = witnessEndcapCss / metricToPx;
  const dimOffsetMetric = offsetCssPx / metricToPx;
  const witnessOffsetMetric = (offsetCssPx + witnessOvershootCss) / metricToPx;
  const dimAx = anchorA.x + perpX * dimOffsetMetric;
  const dimAy = anchorA.y + perpY * dimOffsetMetric;
  const dimBx = anchorB.x + perpX * dimOffsetMetric;
  const dimBy = anchorB.y + perpY * dimOffsetMetric;
  const witAx = anchorA.x + perpX * witnessOffsetMetric;
  const witAy = anchorA.y + perpY * witnessOffsetMetric;
  const witBx = anchorB.x + perpX * witnessOffsetMetric;
  const witBy = anchorB.y + perpY * witnessOffsetMetric;

  ctx.save();
  ctx.setLineDash(dashMetric);
  ctx.beginPath();
  ctx.moveTo(anchorA.x, anchorA.y);
  ctx.lineTo(witAx, witAy);
  ctx.moveTo(anchorB.x, anchorB.y);
  ctx.lineTo(witBx, witBy);
  ctx.moveTo(dimAx, dimAy);
  ctx.lineTo(dimBx, dimBy);
  ctx.stroke();
  ctx.restore();

  const endcapHalf = endcapMetric * 0.5;
  ctx.fillRect(witAx - endcapHalf, witAy - endcapHalf, endcapMetric, endcapMetric);
  ctx.fillRect(witBx - endcapHalf, witBy - endcapHalf, endcapMetric, endcapMetric);
}

/**
 * Angle-arc with polar reference baseline. Round-2 user spec: the arc
 * is centered at `pivot`, has radius = `radiusMetric` (set by the tool
 * to the full line length), and sweeps from `baseAngleRad` to
 * `baseAngleRad + sweepAngleRad`. The polar baseline extends from
 * `pivot` along `baseAngleRad` direction with the SAME length, so the
 * arc PASSES THROUGH the cursor and TERMINATES on the baseline (the
 * baseline endpoint coincides with the arc endpoint at the baseline
 * angle).
 *
 * Sign convention (metric Y-up + canvas Y-flip transform):
 *   - sweep > 0 → arc drawn visually COUNTERCLOCKWISE from baseline
 *     to line direction (line is above-baseline). ctx.arc with
 *     ccw=false under the Y-flipped transform.
 *   - sweep < 0 → arc drawn visually CLOCKWISE (line below-baseline).
 *     ctx.arc with ccw=true under Y-flip.
 *   - sweep = 0 → degenerate zero-length arc.
 */
function paintAngleArc(
  ctx: CanvasRenderingContext2D,
  guide: {
    kind: 'angle-arc';
    pivot: { x: number; y: number };
    baseAngleRad: number;
    sweepAngleRad: number;
    radiusMetric: number;
  },
  metricToPx: number,
  chrome: AngleArcChrome,
): void {
  const { pivot, baseAngleRad, sweepAngleRad, radiusMetric } = guide;
  const { dashedPatternCss } = chrome;
  if (radiusMetric <= 0) return;
  // Round-2 contract preserved (no min-radius clamp): the arc passes
  // THROUGH the cursor at radiusMetric (= full segment length), and the
  // polar baseline extends to the same length. Clamping to a CSS-px
  // floor disconnects the arc from the cursor at short distances —
  // user-rejected per AC parity (Phase 1 §3.10 in-flight discovery,
  // 2026-04-29: clamp added then reverted).
  const endAngleRad = baseAngleRad + sweepAngleRad;
  const counterclockwise = sweepAngleRad < 0;
  const polarEndX = pivot.x + Math.cos(baseAngleRad) * radiusMetric;
  const polarEndY = pivot.y + Math.sin(baseAngleRad) * radiusMetric;

  ctx.save();
  ctx.setLineDash(dashedPatternCss.map((n) => n / metricToPx));
  ctx.beginPath();
  ctx.moveTo(pivot.x, pivot.y);
  ctx.lineTo(polarEndX, polarEndY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, radiusMetric, baseAngleRad, endAngleRad, counterclockwise);
  ctx.stroke();
  ctx.restore();
}
