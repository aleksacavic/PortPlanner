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
// Witness lines extend 3 CSS-px PAST the dim line.
const WITNESS_OVERSHOOT_CSS = 3;
/**
 * SSOT for the dim-line perpendicular offset distance (in CSS pixels).
 * Used by all tools that emit a `linear-dim` guide — rectangle W/H,
 * line/polyline distance, and any future operators. Tools import this
 * constant rather than hard-coding magic numbers per call-site.
 *
 * 20 CSS-px is a balance: large enough to clearly separate the dim
 * line from rectangle edges (which have a 2D body to clear), small
 * enough that line distance dim doesn't float far from the line.
 */
export const DIM_OFFSET_CSS = 20;
// Witness end-cap: small filled square at the witness endpoint
// (away from the anchor). AC shows this consistently — see user
// rectangle screenshot. Square is centered on the witness end.
const WITNESS_ENDCAP_CSS = 4;
// Polar reference baseline: default fallback length when the
// angle-arc guide doesn't carry an explicit polarRefLengthMetric.
const POLAR_REF_DEFAULT_CSS = 100;
// Minimum polar baseline length (CSS-px) regardless of zoom. The
// guide may pass a metric value (e.g. abs(cursor.x - pivot.x)) that
// at low zoom maps to only a few device pixels — clamp upward so the
// baseline is always visually substantial. AC parity (the polar
// guide is a CSS-screen visual cue, not a metric measurement).
const POLAR_REF_MIN_CSS = 100;
// Minimum polar baseline length CAP — prevents extreme zoom-in cases
// from drawing a baseline that overshoots the canvas. 400 CSS-px is
// substantial enough to be readable on any reasonable canvas.
const POLAR_REF_MAX_CSS = 400;
// Dash pattern for witness + dim lines (AC dotted look).
const DASHED_PATTERN_CSS: [number, number] = [2, 3];

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
    mirrorWitness?: boolean;
  },
  metricToPx: number,
): void {
  const { anchorA, anchorB, offsetCssPx, mirrorWitness = false } = guide;
  const dx = anchorB.x - anchorA.x;
  const dy = anchorB.y - anchorA.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;

  const perpX = -dy / len;
  const perpY = dx / len;
  const tickMetric = ARROW_TICK_CSS / metricToPx;
  const dashMetric: [number, number] = [
    DASHED_PATTERN_CSS[0] / metricToPx,
    DASHED_PATTERN_CSS[1] / metricToPx,
  ];
  const endcapMetric = WITNESS_ENDCAP_CSS / metricToPx;

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

  // FULL mode — paint primary side; if mirrorWitness, also paint mirror side.
  paintWitnessSide(ctx, anchorA, anchorB, perpX, perpY, offsetCssPx, metricToPx, dashMetric, endcapMetric);
  if (mirrorWitness) {
    paintWitnessSide(ctx, anchorA, anchorB, -perpX, -perpY, offsetCssPx, metricToPx, dashMetric, endcapMetric);
  }
}

/**
 * Paint a single side of witness + dim line + ticks + end-cap squares.
 * Called once for single-sided rectangles, twice for both-side line
 * tubes (with negated perpendicular for the mirror call).
 */
function paintWitnessSide(
  ctx: CanvasRenderingContext2D,
  anchorA: { x: number; y: number },
  anchorB: { x: number; y: number },
  perpX: number,
  perpY: number,
  offsetCssPx: number,
  metricToPx: number,
  dashMetric: [number, number],
  endcapMetric: number,
): void {
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

  // Witness + dim lines drawn DOTTED (AC look).
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

  // Small filled-square end-caps at the witness endpoints (AC parity —
  // AC shows end-caps INSTEAD of arrow ticks, not both. Earlier
  // implementation drew both; that was incorrect — arrow ticks removed).
  const endcapHalf = endcapMetric * 0.5;
  ctx.fillRect(witAx - endcapHalf, witAy - endcapHalf, endcapMetric, endcapMetric);
  ctx.fillRect(witBx - endcapHalf, witBy - endcapHalf, endcapMetric, endcapMetric);
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
    polarRefLengthMetric?: number;
  },
  metricToPx: number,
): void {
  const { pivot, baseAngleRad, sweepAngleRad, polarRefLengthMetric } = guide;
  const endAngleRad = baseAngleRad + sweepAngleRad;
  const counterclockwise = sweepAngleRad < 0;

  // Polar reference baseline length resolution:
  //   1. Tool-supplied metric value (e.g. abs(cursor.x - p1.x)) maps
  //      naturally to "spans the horizontal projection of the line"
  //      at HIGH zoom — but at LOW zoom that metric distance maps to
  //      only a few CSS-px and the baseline becomes invisible.
  //   2. Clamp to [POLAR_REF_MIN_CSS, POLAR_REF_MAX_CSS] in CSS pixels
  //      so the baseline is always visually substantial regardless of
  //      zoom. AC's polar baseline is fundamentally a CHROME visual
  //      cue, not a metric measurement.
  const requestedMetric =
    polarRefLengthMetric !== undefined && polarRefLengthMetric > 0
      ? polarRefLengthMetric
      : POLAR_REF_DEFAULT_CSS / metricToPx;
  const requestedCss = requestedMetric * metricToPx;
  const clampedCss = Math.max(POLAR_REF_MIN_CSS, Math.min(POLAR_REF_MAX_CSS, requestedCss));
  const polarRefLenMetric = clampedCss / metricToPx;
  // Arc radius matches the clamped polar baseline length so baseline +
  // arc visually scale together (user feedback: "polar should be biggest
  // possible arc on the line end"). The guide's radiusCssPx field is
  // now an unused legacy hint — the arc always uses polarRefLenMetric.
  const radiusMetric = polarRefLenMetric;
  const polarEndX = pivot.x + Math.cos(baseAngleRad) * polarRefLenMetric;
  const polarEndY = pivot.y + Math.sin(baseAngleRad) * polarRefLenMetric;
  ctx.save();
  ctx.setLineDash([DASHED_PATTERN_CSS[0] / metricToPx, DASHED_PATTERN_CSS[1] / metricToPx]);
  ctx.beginPath();
  ctx.moveTo(pivot.x, pivot.y);
  ctx.lineTo(polarEndX, polarEndY);
  ctx.stroke();
  // The arc itself, also dotted.
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, radiusMetric, baseAngleRad, endAngleRad, counterclockwise);
  ctx.stroke();
  ctx.restore();
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
