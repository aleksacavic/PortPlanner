// paintPreview — kind-discriminated dispatcher for in-flight live
// previews (line / polyline / rectangle / circle / arc-2pt / arc-3pt /
// xline). The 'selection-rect' arm is intentionally NOT routed here —
// paint.ts dispatches it to paintSelectionRect (Phase 7) so the two
// styles (preview stroke vs selection-rect window/crossing) stay
// separated.
//
// I-DTP-9 / Gate DTP-T6: this painter MUST NOT import or read
// projectStore. Live preview is UI-only state; the preview shape is
// fully described by the PreviewShape arm passed in.
//
// Each arm draws in METRIC SPACE (the active transform is the metric
// transform applied by paint.ts). Stroke patterns come from
// canvas.transient.preview_stroke / preview_dash. Embedded labels (line
// length, rectangle dimensions, circle radius, arc radius) delegate
// to paintTransientLabel — Gate DTP-T2 forbids any other painter from
// calling the canvas text APIs directly. Even mentioning the forbidden
// method names in a comment trips the gate's substring grep, so the
// names are intentionally omitted here.

import type { SemanticTokens } from '@portplanner/design-system';
import {
  type Point2D,
  type Primitive,
  chamferLineAndPolylineEndpoint,
  chamferPolylineCorner,
  chamferTwoLines,
  filletLineAndPolylineEndpoint,
  filletPolylineCorner,
  filletTwoLines,
  mirrorPrimitive,
  offsetPrimitive,
  rotatePrimitive,
  scalePrimitive,
} from '@portplanner/domain';

import type { ChamferPreviewCase, FilletPreviewCase, PreviewShape } from '../../tools/types';
import type { Viewport } from '../view-transform';
import { arcParamsFromBulge } from './_polylineGeometry';
import { parseNumericToken } from './_tokens';

/**
 * Paint a live preview shape.
 *
 * M1.3 Round 7 backlog B3 — embedded label rendering removed wholesale
 * along with `paintTransientLabel`. Length / W×H / radius readouts
 * during draw flows are now sourced exclusively from `DynamicInputPills`
 * (multi-pill DOM chrome) on top of `overlay.dimensionGuides`. The
 * one tool that did NOT have a DI manifest (Arc) loses its inline
 * readout temporarily until B3-proper migrates it to DI in a follow-up
 * session. The rubber-band geometry stroke still renders unchanged.
 */
export function paintPreview(
  ctx: CanvasRenderingContext2D,
  shape: PreviewShape,
  viewport: Viewport,
  tokens: SemanticTokens,
): void {
  // The 'selection-rect' arm has its own dedicated painter (Phase 7);
  // paint.ts routes by kind so this painter never sees it. Defensive
  // early return keeps types tight.
  if (shape.kind === 'selection-rect') return;

  const transient = tokens.canvas.transient;
  const lineWidthMetric =
    parseNumericToken(transient.preview_stroke_width) / (viewport.zoom * viewport.dpr);

  ctx.save();
  ctx.strokeStyle = transient.preview_stroke;
  ctx.fillStyle = transient.preview_fill;
  ctx.lineWidth = lineWidthMetric;
  // M1.3 Round 6 visual contract — rubber-band preview is SOLID (per
  // AC behaviour; supersedes the prior dashed look from
  // canvas.transient.preview_dash). Dimension guides + witness lines
  // are the dashed elements (paintDimensionGuides handles those).
  ctx.setLineDash([]);

  switch (shape.kind) {
    case 'line':
      drawLinePreview(ctx, shape);
      break;
    case 'polyline':
      drawPolylinePreview(ctx, shape);
      break;
    case 'rectangle':
      drawRectanglePreview(ctx, shape);
      break;
    case 'circle':
      drawCirclePreview(ctx, shape);
      break;
    case 'arc-2pt':
      drawArc2ptPreview(ctx, shape);
      break;
    case 'arc-3pt':
      drawArc3ptPreview(ctx, shape);
      break;
    case 'xline':
      drawXlinePreview(ctx, shape, viewport);
      break;
    case 'modified-entities':
      drawModifiedEntitiesPreview(ctx, shape);
      break;
    case 'rotated-entities':
      drawRotatedEntitiesPreview(ctx, shape);
      break;
    case 'scaled-entities':
      drawScaledEntitiesPreview(ctx, shape);
      break;
    case 'mirrored-entities':
      drawMirroredEntitiesPreview(ctx, shape);
      break;
    case 'offset-preview':
      drawOffsetPreview(ctx, shape);
      break;
    case 'fillet-preview':
      drawFilletPreview(ctx, shape);
      break;
    case 'chamfer-preview':
      drawChamferPreview(ctx, shape);
      break;
  }

  ctx.restore();
}

// M1.3d-Remediation-3 F4 — translucent ghost of entities being moved /
// copied. Iterates `shape.primitives`, applies `offsetMetric` translation,
// strokes each outline with the same transient stroke + dash style as
// the other arms. No labels. No fill. Per-kind dispatch mirrors the
// outline shape painted by the entity-pass painter for each Primitive
// kind, but unfilled and rendered through the transient path.
function drawModifiedEntitiesPreview(
  ctx: CanvasRenderingContext2D,
  shape: { primitives: Primitive[]; offsetMetric: Point2D },
): void {
  const { offsetMetric, primitives } = shape;
  for (const p of primitives) {
    drawShiftedPrimitiveOutline(ctx, p, offsetMetric);
  }
}

// M1.3b simple-transforms Phase 1 — 4 new modify-operator preview
// helpers. Each delegates per-primitive transform to the domain helper
// (rotate / scale / mirror / offset) then strokes the resulting outline
// via the existing `drawPrimitiveOutline` shape-dispatch (zero offset).
function drawRotatedEntitiesPreview(
  ctx: CanvasRenderingContext2D,
  shape: { primitives: Primitive[]; base: Point2D; angleRad: number },
): void {
  const { primitives, base, angleRad } = shape;
  for (const p of primitives) {
    drawPrimitiveOutline(ctx, rotatePrimitive(p, base, angleRad));
  }
}

function drawScaledEntitiesPreview(
  ctx: CanvasRenderingContext2D,
  shape: { primitives: Primitive[]; base: Point2D; factor: number },
): void {
  const { primitives, base, factor } = shape;
  // Skip rendering when factor === 0 (degenerate per I-MOD-7); domain
  // helper would throw. Defensive — tools reject this at submit time.
  if (factor === 0) return;
  for (const p of primitives) {
    drawPrimitiveOutline(ctx, scalePrimitive(p, base, factor));
  }
}

function drawMirroredEntitiesPreview(
  ctx: CanvasRenderingContext2D,
  shape: { primitives: Primitive[]; line: { p1: Point2D; p2: Point2D } },
): void {
  const { primitives, line } = shape;
  for (const p of primitives) {
    drawPrimitiveOutline(ctx, mirrorPrimitive(p, line));
  }
}

function drawOffsetPreview(
  ctx: CanvasRenderingContext2D,
  shape: { primitive: Primitive; distance: number; side: 1 | -1 },
): void {
  const { primitive, distance, side } = shape;
  if (distance <= 0) return; // defensive — tools reject at submit time
  // The domain helper throws for unsupported / degenerate cases (e.g.,
  // bulged polylines, point primitives, sub-zero radii). The preview
  // skips rendering rather than crashing.
  try {
    drawPrimitiveOutline(ctx, offsetPrimitive(primitive, distance, side));
  } catch {
    // No preview available for this configuration; tool's commit-time
    // path will surface the same error to the user.
  }
}

/**
 * Stroke a primitive's outline at its current geometry (no offset, no
 * transform applied here — caller has already produced the transformed
 * Primitive via the domain helper). Mirrors `drawShiftedPrimitiveOutline`
 * but with `off = (0, 0)` baked in for clarity at the call site.
 */
function drawPrimitiveOutline(ctx: CanvasRenderingContext2D, p: Primitive): void {
  drawShiftedPrimitiveOutline(ctx, p, { x: 0, y: 0 });
}

function drawShiftedPrimitiveOutline(
  ctx: CanvasRenderingContext2D,
  p: Primitive,
  off: Point2D,
): void {
  switch (p.kind) {
    case 'point': {
      // 0-radius outline isn't visible; draw a small cross at the offset
      // position so the ghost is at least perceptible.
      const x = p.position.x + off.x;
      const y = p.position.y + off.y;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y);
      ctx.stroke();
      return;
    }
    case 'line': {
      ctx.beginPath();
      ctx.moveTo(p.p1.x + off.x, p.p1.y + off.y);
      ctx.lineTo(p.p2.x + off.x, p.p2.y + off.y);
      ctx.stroke();
      return;
    }
    case 'polyline': {
      // M1.3b fillet-chamfer Phase 1 — bulge-aware preview rendering
      // closes ADR-016 §170 ("straight-only shortcuts are Blockers")
      // for the preview painter. Mirrors paintPolyline.ts entity-painter
      // arc walk via the shared `arcParamsFromBulge` SSOT.
      if (p.vertices.length === 0) return;
      const n = p.vertices.length;
      const segCount = p.closed ? n : n - 1;
      ctx.beginPath();
      const first = p.vertices[0]!;
      ctx.moveTo(first.x + off.x, first.y + off.y);
      for (let k = 0; k < segCount; k += 1) {
        const a = p.vertices[k]!;
        const b = p.vertices[(k + 1) % n]!;
        const aShifted = { x: a.x + off.x, y: a.y + off.y };
        const bShifted = { x: b.x + off.x, y: b.y + off.y };
        const bulge = p.bulges[k] ?? 0;
        if (bulge === 0) {
          ctx.lineTo(bShifted.x, bShifted.y);
        } else {
          const arc = arcParamsFromBulge(aShifted, bShifted, bulge);
          ctx.arc(arc.cx, arc.cy, arc.radius, arc.startAngle, arc.endAngle, arc.counterClockwise);
        }
      }
      if (p.closed) ctx.closePath();
      ctx.stroke();
      return;
    }
    case 'rectangle': {
      // Walk the 4 corners through the local frame (mirrors paintRectangle.ts)
      // so a non-zero `localAxisAngle` actually rotates the preview ghost.
      // Pre-fix this used `ctx.rect(...)` which is axis-aligned in canvas
      // space and silently ignored localAxisAngle — making rotated/mirrored
      // ghosts render at angle 0.
      const cos = Math.cos(p.localAxisAngle);
      const sin = Math.sin(p.localAxisAngle);
      const ox = p.origin.x + off.x;
      const oy = p.origin.y + off.y;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + p.width * cos, oy + p.width * sin);
      ctx.lineTo(ox + p.width * cos - p.height * sin, oy + p.width * sin + p.height * cos);
      ctx.lineTo(ox - p.height * sin, oy + p.height * cos);
      ctx.closePath();
      ctx.stroke();
      return;
    }
    case 'circle': {
      ctx.beginPath();
      ctx.arc(p.center.x + off.x, p.center.y + off.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case 'arc': {
      ctx.beginPath();
      ctx.arc(p.center.x + off.x, p.center.y + off.y, p.radius, p.startAngle, p.endAngle);
      ctx.stroke();
      return;
    }
    case 'xline': {
      // xline has no finite extent; draw a long segment through the
      // shifted pivot in its angle.
      const cx = p.pivot.x + off.x;
      const cy = p.pivot.y + off.y;
      const ux = Math.cos(p.angle);
      const uy = Math.sin(p.angle);
      const extent = 1e6; // far past any plausible viewport
      ctx.beginPath();
      ctx.moveTo(cx - ux * extent, cy - uy * extent);
      ctx.lineTo(cx + ux * extent, cy + uy * extent);
      ctx.stroke();
      return;
    }
  }
}

function drawLinePreview(
  ctx: CanvasRenderingContext2D,
  shape: { p1: Point2D; cursor: Point2D },
): void {
  ctx.beginPath();
  ctx.moveTo(shape.p1.x, shape.p1.y);
  ctx.lineTo(shape.cursor.x, shape.cursor.y);
  ctx.stroke();
}

function drawPolylinePreview(
  ctx: CanvasRenderingContext2D,
  shape: { vertices: Point2D[]; cursor: Point2D; closed: boolean },
): void {
  if (shape.vertices.length === 0) return;
  ctx.beginPath();
  const first = shape.vertices[0]!;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < shape.vertices.length; i += 1) {
    const v = shape.vertices[i]!;
    ctx.lineTo(v.x, v.y);
  }
  ctx.lineTo(shape.cursor.x, shape.cursor.y);
  if (shape.closed) ctx.closePath();
  ctx.stroke();
}

function drawRectanglePreview(
  ctx: CanvasRenderingContext2D,
  shape: { corner1: Point2D; cursor: Point2D },
): void {
  const x = Math.min(shape.corner1.x, shape.cursor.x);
  const y = Math.min(shape.corner1.y, shape.cursor.y);
  const w = Math.abs(shape.cursor.x - shape.corner1.x);
  const h = Math.abs(shape.cursor.y - shape.corner1.y);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.stroke();
}

function drawCirclePreview(
  ctx: CanvasRenderingContext2D,
  shape: { center: Point2D; cursor: Point2D },
): void {
  const radius = Math.hypot(shape.cursor.x - shape.center.x, shape.cursor.y - shape.center.y);
  ctx.beginPath();
  ctx.arc(shape.center.x, shape.center.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  // Dashed radius line center → cursor.
  ctx.beginPath();
  ctx.moveTo(shape.center.x, shape.center.y);
  ctx.lineTo(shape.cursor.x, shape.cursor.y);
  ctx.stroke();
}

function drawArc2ptPreview(
  ctx: CanvasRenderingContext2D,
  shape: { p1: Point2D; cursor: Point2D },
): void {
  // No arc shape known yet — only the first leg as a guide.
  ctx.beginPath();
  ctx.moveTo(shape.p1.x, shape.p1.y);
  ctx.lineTo(shape.cursor.x, shape.cursor.y);
  ctx.stroke();
}

function drawArc3ptPreview(
  ctx: CanvasRenderingContext2D,
  shape: { p1: Point2D; p2: Point2D; cursor: Point2D },
): void {
  const cc = circumcircle(shape.p1, shape.p2, shape.cursor);
  if (!cc) {
    // Degenerate (collinear) — fall back to a polyline preview through
    // the three points.
    ctx.beginPath();
    ctx.moveTo(shape.p1.x, shape.p1.y);
    ctx.lineTo(shape.p2.x, shape.p2.y);
    ctx.lineTo(shape.cursor.x, shape.cursor.y);
    ctx.stroke();
    return;
  }
  const a1 = Math.atan2(shape.p1.y - cc.cy, shape.p1.x - cc.cx);
  const a3 = Math.atan2(shape.cursor.y - cc.cy, shape.cursor.x - cc.cx);
  // Sweep CCW from p1 to cursor through p2; rely on the canvas API
  // to take the shorter or longer path based on a flag — pick the
  // one that includes p2 by checking the midpoint angle.
  const start = a1;
  let end = a3;
  while (end < start) end += Math.PI * 2;
  ctx.beginPath();
  ctx.arc(cc.cx, cc.cy, cc.r, start, end);
  ctx.stroke();
}

function drawXlinePreview(
  ctx: CanvasRenderingContext2D,
  shape: { pivot: Point2D; cursor: Point2D },
  viewport: Viewport,
): void {
  const dx = shape.cursor.x - shape.pivot.x;
  const dy = shape.cursor.y - shape.pivot.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  // Extend the line far beyond the visible viewport in both directions.
  // Using viewport.canvasWidthCss / zoom gives a metric extent that
  // covers the visible canvas; multiply by 4 for pan headroom.
  const extent = ((viewport.canvasWidthCss + viewport.canvasHeightCss) / viewport.zoom) * 4;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = shape.pivot.x - ux * extent;
  const y1 = shape.pivot.y - uy * extent;
  const x2 = shape.pivot.x + ux * extent;
  const y2 = shape.pivot.y + uy * extent;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function circumcircle(
  a: Point2D,
  b: Point2D,
  c: Point2D,
): { cx: number; cy: number; r: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) return null;
  const ax2 = a.x * a.x + a.y * a.y;
  const bx2 = b.x * b.x + b.y * b.y;
  const cx2 = c.x * c.x + c.y * c.y;
  const cx = (ax2 * (b.y - c.y) + bx2 * (c.y - a.y) + cx2 * (a.y - b.y)) / d;
  const cy = (ax2 * (c.x - b.x) + bx2 * (a.x - c.x) + cx2 * (b.x - a.x)) / d;
  const r = Math.hypot(a.x - cx, a.y - cy);
  return { cx, cy, r };
}

// M1.3b fillet-chamfer Phase 1 — fillet/chamfer preview helpers. Each
// delegates per-pair-type math to the matching domain helper, then
// strokes the result (modified primitives + new arc/segment) using the
// shared `drawPrimitiveOutline` SSOT plus a direct ctx.arc / ctx.line
// call for the new geometry. Wrapped in try/catch — when the domain
// helper throws (parallel sources, trim-too-large, etc.) the preview
// renders nothing rather than crashing; the tool's commit path will
// surface the same error to the user.

function drawFilletPreview(
  ctx: CanvasRenderingContext2D,
  shape: { case: FilletPreviewCase },
): void {
  const { case: c } = shape;
  try {
    if (c.pairType === 'two-line') {
      const r = filletTwoLines(c.l1, c.l2, c.radius, c.pickHints);
      drawPrimitiveOutline(ctx, r.l1Updated);
      drawPrimitiveOutline(ctx, r.l2Updated);
      ctx.beginPath();
      ctx.arc(
        r.newArc.center.x,
        r.newArc.center.y,
        r.newArc.radius,
        r.newArc.startAngle,
        r.newArc.endAngle,
      );
      ctx.stroke();
    } else if (c.pairType === 'polyline-internal') {
      const r = filletPolylineCorner(c.polyline, c.vertexIdx, c.radius);
      drawPrimitiveOutline(ctx, r);
    } else {
      const r = filletLineAndPolylineEndpoint(
        c.line,
        c.lineHint,
        c.polyline,
        c.polylineEndpoint,
        c.radius,
      );
      drawPrimitiveOutline(ctx, r.lineUpdated);
      drawPrimitiveOutline(ctx, r.polylineUpdated);
      ctx.beginPath();
      ctx.arc(
        r.newArc.center.x,
        r.newArc.center.y,
        r.newArc.radius,
        r.newArc.startAngle,
        r.newArc.endAngle,
      );
      ctx.stroke();
    }
  } catch {
    // domain helper rejected this configuration; render nothing.
  }
}

function drawChamferPreview(
  ctx: CanvasRenderingContext2D,
  shape: { case: ChamferPreviewCase },
): void {
  const { case: c } = shape;
  try {
    if (c.pairType === 'two-line') {
      const r = chamferTwoLines(c.l1, c.l2, c.d1, c.d2, c.pickHints);
      drawPrimitiveOutline(ctx, r.l1Updated);
      drawPrimitiveOutline(ctx, r.l2Updated);
      ctx.beginPath();
      ctx.moveTo(r.newSegment.p1.x, r.newSegment.p1.y);
      ctx.lineTo(r.newSegment.p2.x, r.newSegment.p2.y);
      ctx.stroke();
    } else if (c.pairType === 'polyline-internal') {
      const r = chamferPolylineCorner(c.polyline, c.vertexIdx, c.d1, c.d2);
      drawPrimitiveOutline(ctx, r);
    } else {
      const r = chamferLineAndPolylineEndpoint(
        c.line,
        c.lineHint,
        c.polyline,
        c.polylineEndpoint,
        c.d1,
        c.d2,
      );
      drawPrimitiveOutline(ctx, r.lineUpdated);
      drawPrimitiveOutline(ctx, r.polylineUpdated);
      ctx.beginPath();
      ctx.moveTo(r.newSegment.p1.x, r.newSegment.p1.y);
      ctx.lineTo(r.newSegment.p2.x, r.newSegment.p2.y);
      ctx.stroke();
    }
  } catch {
    // domain helper rejected this configuration; render nothing.
  }
}
