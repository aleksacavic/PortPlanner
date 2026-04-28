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
 * Linear dimension: two witness lines perpendicular to (anchorB-anchorA)
 * extending outward by `offsetCssPx`, plus a dim line parallel to the
 * segment at the same perpendicular offset, plus arrow ticks at each
 * end of the dim line.
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
  const offsetMetric = offsetCssPx / metricToPx;
  const perpOffsetX = perpX * offsetMetric;
  const perpOffsetY = perpY * offsetMetric;

  // Witness lines: short stubs from each anchor outward to the dim line.
  ctx.beginPath();
  ctx.moveTo(anchorA.x, anchorA.y);
  ctx.lineTo(anchorA.x + perpOffsetX, anchorA.y + perpOffsetY);
  ctx.moveTo(anchorB.x, anchorB.y);
  ctx.lineTo(anchorB.x + perpOffsetX, anchorB.y + perpOffsetY);
  ctx.stroke();

  // Dim line: between the two witness-line outer endpoints.
  const dimAx = anchorA.x + perpOffsetX;
  const dimAy = anchorA.y + perpOffsetY;
  const dimBx = anchorB.x + perpOffsetX;
  const dimBy = anchorB.y + perpOffsetY;
  ctx.beginPath();
  ctx.moveTo(dimAx, dimAy);
  ctx.lineTo(dimBx, dimBy);
  ctx.stroke();

  // Arrow ticks at each dim-line endpoint (45° marks pointing inward).
  const tickMetric = ARROW_TICK_CSS / metricToPx;
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
 * Angle-arc: arc centered at `pivot` from `baseAngleRad` sweeping
 * `sweepAngleRad` at screen-px radius `radiusCssPx` (converted to
 * metric). ctx.arc handles the polar-to-Cartesian internally.
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
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, radiusMetric, baseAngleRad, endAngleRad, counterclockwise);
  ctx.stroke();
}

/**
 * Radius-line: small tick marker at the midpoint between pivot and
 * endpoint. paintPreview's circle arm already draws the radius line
 * itself; the tick gives a visual confirmation that the DI guide is
 * tracking the cursor without duplicating the line stroke.
 */
function paintRadiusLine(
  ctx: CanvasRenderingContext2D,
  guide: {
    kind: 'radius-line';
    pivot: { x: number; y: number };
    endpoint: { x: number; y: number };
  },
  metricToPx: number,
): void {
  const { pivot, endpoint } = guide;
  const midX = (pivot.x + endpoint.x) / 2;
  const midY = (pivot.y + endpoint.y) / 2;
  const dx = endpoint.x - pivot.x;
  const dy = endpoint.y - pivot.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  // Perpendicular tick across the radius line at midpoint.
  const perpX = -dy / len;
  const perpY = dx / len;
  const tickMetric = ARROW_TICK_CSS / metricToPx;
  ctx.beginPath();
  ctx.moveTo(midX + perpX * tickMetric * 0.5, midY + perpY * tickMetric * 0.5);
  ctx.lineTo(midX - perpX * tickMetric * 0.5, midY - perpY * tickMetric * 0.5);
  ctx.stroke();
}
