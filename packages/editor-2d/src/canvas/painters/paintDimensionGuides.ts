// paintDimensionGuides — overlay-pass painter for the M1.3 Round 6
// Dynamic Input dimension guides (witness lines + dim lines + arrow
// ticks for `linear-dim`; arcs for `angle-arc`; tick markers for
// `radius-line`). Plan §3 A2 + A2.1.
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

const STROKE_WIDTH_CSS = 1;
const ARROW_TICK_CSS = 6;
// Witness lines extend 3 CSS-px PAST the dim line (mockup-measured AC
// look — witness goes from corner to (offsetCssPx + WITNESS_OVERSHOOT_CSS)).
const WITNESS_OVERSHOOT_CSS = 3;
// Polar reference: faint horizontal "0° baseline" extending from the
// angle-arc pivot. Mockup uses 100 CSS-px length, dotted gray.
const POLAR_REF_LENGTH_CSS = 100;

export function paintDimensionGuides(
  ctx: CanvasRenderingContext2D,
  guides: DimensionGuide[],
  viewport: Viewport,
  tokens: SemanticTokens,
): void {
  if (guides.length === 0) return;
  const transient = tokens.canvas.transient;
  const metricToPx = viewport.zoom * viewport.dpr;
  const lineWidthMetric = STROKE_WIDTH_CSS / metricToPx;

  ctx.save();
  ctx.strokeStyle = transient.preview_stroke;
  ctx.fillStyle = transient.preview_stroke;
  ctx.lineWidth = lineWidthMetric;
  ctx.setLineDash([]);

  for (const guide of guides) {
    switch (guide.kind) {
      case 'linear-dim':
        paintLinearDim(ctx, guide, metricToPx);
        break;
      case 'angle-arc':
        paintAngleArc(ctx, guide, metricToPx);
        break;
      case 'radius-line':
        paintRadiusLine(ctx, guide, metricToPx);
        break;
    }
  }

  ctx.restore();
}

/**
 * Linear dimension. Two render modes selected by `offsetCssPx`:
 *
 *   offsetCssPx > 0 — full AC-style measured-dim look (rectangle W/H):
 *     - Witness lines from each anchor extending PAST the dim line by
 *       WITNESS_OVERSHOOT_CSS (mockup-measured 3 CSS-px overshoot).
 *     - Dim line parallel to segment at offsetCssPx perpendicular.
 *     - Arrow ticks at each end of the dim line.
 *     - Pill consumer (DynamicInputPills) anchors on dim-line midpoint.
 *
 *   offsetCssPx === 0 — inline mode (line/polyline distance):
 *     - No witness lines, no separate dim line. The rubber-band line
 *       itself IS the dim reference.
 *     - Small perpendicular ticks at each segment endpoint.
 *     - Pill consumer anchors on segment midpoint.
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
): void {
  const { anchorA, anchorB, offsetCssPx } = guide;
  const dx = anchorB.x - anchorA.x;
  const dy = anchorB.y - anchorA.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;

  // Perpendicular unit vector (rotated 90° CCW from segment direction).
  // Note paint.ts applies a Y-flip in the metric transform; perpendicular
  // direction is consistent within the metric-space transform we're in.
  const perpX = -dy / len;
  const perpY = dx / len;
  const tickMetric = ARROW_TICK_CSS / metricToPx;

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

  // FULL mode — witness extends past dim line; separate dim line; ticks.
  const dimOffsetMetric = offsetCssPx / metricToPx;
  const witnessOffsetMetric = (offsetCssPx + WITNESS_OVERSHOOT_CSS) / metricToPx;
  const dimAx = anchorA.x + perpX * dimOffsetMetric;
  const dimAy = anchorA.y + perpY * dimOffsetMetric;
  const dimBx = anchorB.x + perpX * dimOffsetMetric;
  const dimBy = anchorB.y + perpY * dimOffsetMetric;
  const witAx = anchorA.x + perpX * witnessOffsetMetric;
  const witAy = anchorA.y + perpY * witnessOffsetMetric;
  const witBx = anchorB.x + perpX * witnessOffsetMetric;
  const witBy = anchorB.y + perpY * witnessOffsetMetric;

  // Witness lines: from each anchor to its witness endpoint (3 px past dim line).
  ctx.beginPath();
  ctx.moveTo(anchorA.x, anchorA.y);
  ctx.lineTo(witAx, witAy);
  ctx.moveTo(anchorB.x, anchorB.y);
  ctx.lineTo(witBx, witBy);
  ctx.stroke();

  // Dim line: between the two witness mid-points (at the dim offset, not the witness end).
  ctx.beginPath();
  ctx.moveTo(dimAx, dimAy);
  ctx.lineTo(dimBx, dimBy);
  ctx.stroke();

  // Arrow ticks at each dim-line endpoint (45° marks pointing inward).
  const segUnitX = dx / len;
  const segUnitY = dy / len;
  paintTickAt(ctx, dimAx, dimAy, segUnitX, segUnitY, tickMetric);
  paintTickAt(ctx, dimBx, dimBy, -segUnitX, -segUnitY, tickMetric);
}

/**
 * Tick mark at `(x, y)` extending in the direction `(unitX, unitY)` —
 * a small inward stub at 45° relative to the dim line. Approximates
 * the AC dim-line arrow style without committing to a specific shape.
 */
function paintTickAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unitX: number,
  unitY: number,
  tickMetric: number,
): void {
  // Two short strokes at +/-45° from the inward direction.
  const cos45 = Math.SQRT1_2;
  const sin45 = Math.SQRT1_2;
  const a1x = unitX * cos45 - unitY * sin45;
  const a1y = unitX * sin45 + unitY * cos45;
  const a2x = unitX * cos45 + unitY * sin45;
  const a2y = -unitX * sin45 + unitY * cos45;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + a1x * tickMetric, y + a1y * tickMetric);
  ctx.moveTo(x, y);
  ctx.lineTo(x + a2x * tickMetric, y + a2y * tickMetric);
  ctx.stroke();
}

/**
 * Angle-arc with polar reference baseline (AC-style "angle from
 * horizontal"). Renders:
 *   1. A faint dotted horizontal "0° baseline" extending POLAR_REF_LENGTH_CSS
 *      from the pivot in the baseAngleRad direction (the reference the
 *      angle is measured FROM).
 *   2. The arc itself from baseAngleRad sweeping sweepAngleRad at radius
 *      radiusCssPx (converted to metric).
 *
 * The pill consumer (DynamicInputPills.derivePillAnchorMetric) anchors
 * on the arc midpoint at sweep/2.
 */
function paintAngleArc(
  ctx: CanvasRenderingContext2D,
  guide: {
    kind: 'angle-arc';
    pivot: { x: number; y: number };
    baseAngleRad: number;
    sweepAngleRad: number;
    radiusCssPx: number;
  },
  metricToPx: number,
): void {
  const { pivot, baseAngleRad, sweepAngleRad, radiusCssPx } = guide;
  const radiusMetric = radiusCssPx / metricToPx;
  const endAngleRad = baseAngleRad + sweepAngleRad;
  const counterclockwise = sweepAngleRad < 0;

  // Polar reference baseline: faint dotted line from pivot extending
  // POLAR_REF_LENGTH_CSS in the baseAngleRad direction. Mockup uses
  // ~100 px length; dashed pattern matches AC's "0° guide" look.
  const polarRefLenMetric = POLAR_REF_LENGTH_CSS / metricToPx;
  const polarEndX = pivot.x + Math.cos(baseAngleRad) * polarRefLenMetric;
  const polarEndY = pivot.y + Math.sin(baseAngleRad) * polarRefLenMetric;
  ctx.save();
  ctx.setLineDash([2 / metricToPx, 3 / metricToPx]);
  ctx.beginPath();
  ctx.moveTo(pivot.x, pivot.y);
  ctx.lineTo(polarEndX, polarEndY);
  ctx.stroke();
  ctx.restore();

  // The arc itself.
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, radiusMetric, baseAngleRad, endAngleRad, counterclockwise);
  ctx.stroke();
}

/**
 * Radius-line: visual no-op. AC's circle DI shows the radius value pill
 * directly on the existing `paintPreview` circle-arm radius line — no
 * additional tick or witness mark. The guide carries the pivot +
 * endpoint coords so `DynamicInputPills.derivePillAnchorMetric` can
 * place the pill on the radius midpoint, but the painter itself draws
 * nothing here. Plan §3 A2 explicitly allowed the radius-line variant
 * to be a no-op: "the radius line is already drawn by paintPreview's
 * circle arm, so this guide may be a no-op visual marker; decide at
 * execution time."
 */
function paintRadiusLine(
  _ctx: CanvasRenderingContext2D,
  _guide: {
    kind: 'radius-line';
    pivot: { x: number; y: number };
    endpoint: { x: number; y: number };
  },
  _metricToPx: number,
): void {
  // Intentional no-op (AC parity).
}
