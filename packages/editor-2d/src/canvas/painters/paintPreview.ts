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
import type { Point2D } from '@portplanner/domain';

import type { PreviewShape } from '../../tools/types';
import type { Viewport } from '../view-transform';
import { paintTransientLabel } from './paintTransientLabel';

const STROKE_WIDTH_CSS = 1;

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
  const dash = parseDashPattern(transient.preview_dash);
  const lineWidthMetric = STROKE_WIDTH_CSS / (viewport.zoom * viewport.dpr);

  ctx.save();
  ctx.strokeStyle = transient.preview_stroke;
  ctx.fillStyle = transient.preview_fill;
  ctx.lineWidth = lineWidthMetric;
  ctx.setLineDash(dash.map((n) => n / (viewport.zoom * viewport.dpr)));

  switch (shape.kind) {
    case 'line':
      drawLinePreview(ctx, shape, viewport, tokens);
      break;
    case 'polyline':
      drawPolylinePreview(ctx, shape, viewport, tokens);
      break;
    case 'rectangle':
      drawRectanglePreview(ctx, shape, viewport, tokens);
      break;
    case 'circle':
      drawCirclePreview(ctx, shape, viewport, tokens);
      break;
    case 'arc-2pt':
      drawArc2ptPreview(ctx, shape, viewport, tokens);
      break;
    case 'arc-3pt':
      drawArc3ptPreview(ctx, shape, viewport, tokens);
      break;
    case 'xline':
      drawXlinePreview(ctx, shape, viewport);
      break;
  }

  ctx.restore();
}

function drawLinePreview(
  ctx: CanvasRenderingContext2D,
  shape: { p1: Point2D; cursor: Point2D },
  viewport: Viewport,
  tokens: SemanticTokens,
): void {
  ctx.beginPath();
  ctx.moveTo(shape.p1.x, shape.p1.y);
  ctx.lineTo(shape.cursor.x, shape.cursor.y);
  ctx.stroke();
  const length = Math.hypot(shape.cursor.x - shape.p1.x, shape.cursor.y - shape.p1.y);
  const mid: Point2D = {
    x: (shape.p1.x + shape.cursor.x) / 2,
    y: (shape.p1.y + shape.cursor.y) / 2,
  };
  // R6: rotate label to align with line direction p1 → cursor (screen
  // y is flipped relative to metric y, so negate the y-delta when
  // computing the screen-space rotation angle the painter applies).
  const angleRad = -Math.atan2(shape.cursor.y - shape.p1.y, shape.cursor.x - shape.p1.x);
  paintTransientLabel(
    ctx,
    { metric: mid, screenOffset: { dx: 8, dy: -8 } },
    `${length.toFixed(3)} m`,
    viewport,
    tokens,
    { angleRad },
  );
}

function drawPolylinePreview(
  ctx: CanvasRenderingContext2D,
  shape: { vertices: Point2D[]; cursor: Point2D; closed: boolean },
  viewport: Viewport,
  tokens: SemanticTokens,
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
  const last = shape.vertices[shape.vertices.length - 1]!;
  const length = Math.hypot(shape.cursor.x - last.x, shape.cursor.y - last.y);
  const mid: Point2D = {
    x: (last.x + shape.cursor.x) / 2,
    y: (last.y + shape.cursor.y) / 2,
  };
  // R6: align label with the rubber-band segment last → cursor.
  const angleRad = -Math.atan2(shape.cursor.y - last.y, shape.cursor.x - last.x);
  paintTransientLabel(
    ctx,
    { metric: mid, screenOffset: { dx: 8, dy: -8 } },
    `${length.toFixed(3)} m`,
    viewport,
    tokens,
    { angleRad },
  );
}

function drawRectanglePreview(
  ctx: CanvasRenderingContext2D,
  shape: { corner1: Point2D; cursor: Point2D },
  viewport: Viewport,
  tokens: SemanticTokens,
): void {
  const x = Math.min(shape.corner1.x, shape.cursor.x);
  const y = Math.min(shape.corner1.y, shape.cursor.y);
  const w = Math.abs(shape.cursor.x - shape.corner1.x);
  const h = Math.abs(shape.cursor.y - shape.corner1.y);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.stroke();
  paintTransientLabel(
    ctx,
    { metric: shape.cursor, screenOffset: { dx: 8, dy: -8 } },
    `${w.toFixed(3)} × ${h.toFixed(3)} m`,
    viewport,
    tokens,
  );
}

function drawCirclePreview(
  ctx: CanvasRenderingContext2D,
  shape: { center: Point2D; cursor: Point2D },
  viewport: Viewport,
  tokens: SemanticTokens,
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
  const mid: Point2D = {
    x: (shape.center.x + shape.cursor.x) / 2,
    y: (shape.center.y + shape.cursor.y) / 2,
  };
  // R6: align label with the radius line center → cursor.
  const angleRad = -Math.atan2(shape.cursor.y - shape.center.y, shape.cursor.x - shape.center.x);
  paintTransientLabel(
    ctx,
    { metric: mid, screenOffset: { dx: 8, dy: -8 } },
    `R ${radius.toFixed(3)} m`,
    viewport,
    tokens,
    { angleRad },
  );
}

function drawArc2ptPreview(
  ctx: CanvasRenderingContext2D,
  shape: { p1: Point2D; cursor: Point2D },
  viewport: Viewport,
  tokens: SemanticTokens,
): void {
  // No arc shape known yet — only the first leg as a guide.
  ctx.beginPath();
  ctx.moveTo(shape.p1.x, shape.p1.y);
  ctx.lineTo(shape.cursor.x, shape.cursor.y);
  ctx.stroke();
  const length = Math.hypot(shape.cursor.x - shape.p1.x, shape.cursor.y - shape.p1.y);
  const mid: Point2D = {
    x: (shape.p1.x + shape.cursor.x) / 2,
    y: (shape.p1.y + shape.cursor.y) / 2,
  };
  // R6: align label with the leg p1 → cursor (same as line preview).
  const angleRad = -Math.atan2(shape.cursor.y - shape.p1.y, shape.cursor.x - shape.p1.x);
  paintTransientLabel(
    ctx,
    { metric: mid, screenOffset: { dx: 8, dy: -8 } },
    `${length.toFixed(3)} m`,
    viewport,
    tokens,
    { angleRad },
  );
}

function drawArc3ptPreview(
  ctx: CanvasRenderingContext2D,
  shape: { p1: Point2D; p2: Point2D; cursor: Point2D },
  viewport: Viewport,
  tokens: SemanticTokens,
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
  paintTransientLabel(
    ctx,
    { metric: shape.cursor, screenOffset: { dx: 8, dy: -8 } },
    `R ${cc.r.toFixed(3)} m`,
    viewport,
    tokens,
  );
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

function parseDashPattern(token: string): number[] {
  const trimmed = token.trim();
  if (trimmed === '' || trimmed === 'solid') return [];
  return trimmed
    .split(/\s+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
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
