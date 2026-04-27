// paintCrosshair — cursor crosshair painter (M1.3d Phase 8 +
// M1.3d-Remediation R2b).
//
// Two visual modes via continuous CURSORSIZE % (viewport.crosshairSizePct):
//   sizePct >= 100 → full-canvas crosshair (lines spanning the entire
//                    canvas — AutoCAD CURSORSIZE default)
//   sizePct <  100 → centered cross of length sizePct/100 * canvasHeight
//   sizePct === 0  → no-op (caller may also gate on cursor presence)
//
// AutoCAD-style cursor (R2b — Codex Round-1 + Round-2 + Round-3 cleared):
// the cross lines are TRIMMED around a small pickbox square at the cursor
// (PICKBOX_HALF_CSS = 5 → 10×10 CSS-px square). The pickbox doubles as
// the click target when no tool is active. Each axis becomes TWO
// segments (a left / right arm or a top / bottom arm) skipping the
// pickbox region; the pickbox itself is a strokeRect.
//
// Defensive `halfH > pbHalf` / `halfV > pbHalf` guards: if the user
// (or a future settings slider) lands sizePct so small that the arm
// length is shorter than the pickbox half-extent, the arm is omitted
// rather than emitting a backwards-drawn segment. F7 only reaches
// 100 or 5 today (halfH at sizePct=5 = 15 device px > pbHalf=5),
// so the guards are pure forward-compat.
//
// Color from canvas.transient.crosshair. Dash pattern from
// canvas.transient.crosshair_dash ('solid' sentinel → no dashing).
// Renders in screen-space (transform reset to identity).

import type { SemanticTokens } from '@portplanner/design-system';
import type { Point2D } from '@portplanner/domain';

import { type Viewport, metricToScreen } from '../view-transform';

const STROKE_WIDTH_CSS = 1;
const PICKBOX_HALF_CSS = 5;

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
  const pbHalf = PICKBOX_HALF_CSS * dpr;

  let halfH: number;
  let halfV: number;
  if (sizePct >= 100) {
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
  // Horizontal arms — skip the pickbox region [cx-pbHalf, cx+pbHalf].
  if (halfH > pbHalf) {
    ctx.moveTo(cx - halfH, cy);
    ctx.lineTo(cx - pbHalf, cy);
    ctx.moveTo(cx + pbHalf, cy);
    ctx.lineTo(cx + halfH, cy);
  }
  // Vertical arms — skip the pickbox region [cy-pbHalf, cy+pbHalf].
  if (halfV > pbHalf) {
    ctx.moveTo(cx, cy - halfV);
    ctx.lineTo(cx, cy - pbHalf);
    ctx.moveTo(cx, cy + pbHalf);
    ctx.lineTo(cx, cy + halfV);
  }
  ctx.stroke();

  // Pickbox square at the cursor — outlined, no fill (snap glyph + other
  // overlay-pass painters paint AFTER paintCrosshair so they win z-order
  // when they overlap the pickbox region).
  ctx.strokeRect(cx - pbHalf, cy - pbHalf, pbHalf * 2, pbHalf * 2);

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
