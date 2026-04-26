// paintCrosshair — cursor crosshair painter (M1.3d Phase 8).
//
// Two visual modes via continuous CURSORSIZE % (viewport.crosshairSizePct):
//   sizePct >= 100 → full-canvas crosshair (two lines spanning the
//                    entire canvas — AutoCAD CURSORSIZE default)
//   sizePct <  100 → centered cross of length sizePct/100 * canvasHeight
//   sizePct === 0  → no-op (caller may also gate on cursor presence)
//
// Color from canvas.transient.crosshair. Dash pattern from
// canvas.transient.crosshair_dash ('solid' sentinel → no dashing).
// Renders in screen-space (transform reset to identity).

import type { SemanticTokens } from '@portplanner/design-system';
import type { Point2D } from '@portplanner/domain';

import { type Viewport, metricToScreen } from '../view-transform';

const STROKE_WIDTH_CSS = 1;

export function paintCrosshair(
  ctx: CanvasRenderingContext2D,
  cursor: Point2D,
  sizePct: number,
  viewport: Viewport,
  tokens: SemanticTokens,
): void {
  if (sizePct <= 0) return;
  const transient = tokens.canvas.transient;
  const dash = parseDashPattern(transient.crosshair_dash);
  const dpr = viewport.dpr;
  const screen = metricToScreen(cursor, viewport);
  const cx = screen.x * dpr;
  const cy = screen.y * dpr;
  const canvasW = viewport.canvasWidthCss * dpr;
  const canvasH = viewport.canvasHeightCss * dpr;

  let halfH: number;
  let halfV: number;
  if (sizePct >= 100) {
    // Full-canvas extents — span past the visible area in both axes
    // so the crosshair always reaches the edges regardless of cursor
    // position.
    halfH = canvasW;
    halfV = canvasH;
  } else {
    const crossLen = (sizePct / 100) * canvasH;
    halfH = crossLen / 2;
    halfV = crossLen / 2;
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = transient.crosshair;
  ctx.lineWidth = STROKE_WIDTH_CSS * dpr;
  ctx.setLineDash(dash.map((n) => n * dpr));
  ctx.beginPath();
  ctx.moveTo(cx - halfH, cy);
  ctx.lineTo(cx + halfH, cy);
  ctx.moveTo(cx, cy - halfV);
  ctx.lineTo(cx, cy + halfV);
  ctx.stroke();
  ctx.restore();
}

function parseDashPattern(token: string): number[] {
  const trimmed = token.trim();
  if (trimmed === '' || trimmed === 'solid') return [];
  return trimmed
    .split(/\s+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}
