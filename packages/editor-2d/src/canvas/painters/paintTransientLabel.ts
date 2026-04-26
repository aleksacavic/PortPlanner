// paintTransientLabel — screen-space label painter for transient
// overlay text (length, radius, angle, dimension readouts).
//
// I-DTP-8 + Gate DTP-T2: this is the SOLE source of transient text on
// canvas. Other overlay painters MUST NOT call ctx.fillText /
// ctx.strokeText (paintGrid is the only entity-pass exception). The
// gate greps the painters/ folder and excludes paintTransientLabel +
// paintGrid; everything else is forbidden from text rendering.
//
// Rendering contract:
//   - Resets transform to identity at the start (label position is
//     screen-pixel, not metric — the label visual size stays constant
//     across zoom and the rounded-pill background is crisp).
//   - Restores transform on exit so the caller's overlay-pass state
//     is preserved.
//   - Reads color / background / padding from `canvas.transient.*`
//     tokens (I-DTP-1).
//   - Uses a system-default font stack so paint is synchronous (no
//     web-font async wait).

import type { SemanticTokens } from '@portplanner/design-system';
import type { Point2D } from '@portplanner/domain';

import { type Viewport, metricToScreen } from '../view-transform';

const FONT_PX_CSS = 12;
const CORNER_RADIUS_CSS = 4;

export interface TransientLabelAnchor {
  /** Anchor point in metric. Painter computes screen position via
   *  metricToScreen and applies the optional screen-px offset. */
  metric: Point2D;
  /** Optional offset in CSS pixels from the anchor screen position
   *  (useful to nudge the label off the geometry it labels). */
  screenOffset?: { dx: number; dy: number };
}

/**
 * Paint a transient label. Renders text at metricToScreen(anchor.metric,
 * viewport) plus the optional screen-offset, with a translucent
 * rounded-pill background for legibility.
 */
export function paintTransientLabel(
  ctx: CanvasRenderingContext2D,
  anchor: TransientLabelAnchor,
  text: string,
  viewport: Viewport,
  tokens: SemanticTokens,
): void {
  if (text.length === 0) return;

  const screen = metricToScreen(anchor.metric, viewport);
  const dpr = viewport.dpr;
  const dx = anchor.screenOffset?.dx ?? 0;
  const dy = anchor.screenOffset?.dy ?? 0;
  const px = (screen.x + dx) * dpr;
  const py = (screen.y + dy) * dpr;
  const fontPx = FONT_PX_CSS * dpr;
  const padding = parsePadding(tokens.canvas.transient.label_padding) * dpr;
  const radius = CORNER_RADIUS_CSS * dpr;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `${fontPx}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontPx;

  const bgX = px;
  const bgY = py - textHeight / 2 - padding;
  const bgW = textWidth + padding * 2;
  const bgH = textHeight + padding * 2;

  ctx.fillStyle = tokens.canvas.transient.label_bg;
  drawRoundedRect(ctx, bgX, bgY, bgW, bgH, radius);
  ctx.fill();

  ctx.fillStyle = tokens.canvas.transient.label_text;
  ctx.fillText(text, bgX + padding, py);

  ctx.restore();
}

function parsePadding(token: string): number {
  const n = Number.parseInt(token, 10);
  return Number.isFinite(n) ? n : 4;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arc(x + w - rr, y + rr, rr, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2);
  ctx.lineTo(x + rr, y + h);
  ctx.arc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + rr);
  ctx.arc(x + rr, y + rr, rr, Math.PI, (3 * Math.PI) / 2);
  ctx.closePath();
}
