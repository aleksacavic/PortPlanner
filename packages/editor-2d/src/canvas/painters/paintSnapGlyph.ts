// Snap glyph painter per ADR-021 + M1.3d Phase 3.
//
// Renders a per-snap-kind shape at the resolved snap target point in
// SCREEN SPACE — the transform is reset to identity at the start so the
// glyph's visual size stays constant across zoom (I-DTP-6). The caller
// (paint.ts overlay pass) is responsible for re-applying the metric
// transform afterwards if needed; this painter does NOT restore.
//
// Glyph map (matches plan §8 Phase 3 step 1):
//   endpoint    → filled square      (8 px CSS)
//   midpoint    → filled triangle    (8 px CSS)
//   intersection→ ×                  (two diagonals, 10 px each)
//   node        → filled circle      (5 px radius)
//   grid-node   → +                  (two perpendicular lines, 8 px)
//   grid-line   → small +-shaped tick (degraded fallback per §13.3 —
//                  the snap engine only carries the snap point, not the
//                  grid line direction, so a directional perpendicular
//                  tick is not derivable; an axis-aligned cross is the
//                  AutoCAD-comparable visual)
//
// The 'cursor' SnapHit kind is the snap-engine's "no snap matched" sentinel
// and MUST NOT reach this painter (paint.ts gates on snapTarget kind);
// passing it is a no-op for safety.

import type { SemanticTokens } from '@portplanner/design-system';
import type { SnapHit } from '../../snap/priority';

import { type Viewport, metricToScreen } from '../view-transform';

const ENDPOINT_SIDE_CSS = 8;
const MIDPOINT_SIDE_CSS = 8;
const INTERSECTION_HALF_CSS = 5;
const NODE_RADIUS_CSS = 5;
const GRID_NODE_HALF_CSS = 4;
const GRID_LINE_HALF_CSS = 3;
const STROKE_CSS_PX = 1.5;

/**
 * Paint a snap-target glyph at the resolved point. Caller passes the
 * SnapHit from `overlay.snapTarget` and the canvas tokens (the painter
 * resolves color from `canvas.snap_indicator`, the existing M1.3a
 * token; transient styling here is purely shape, not color, so we
 * intentionally reuse the snap-indicator color rather than introducing
 * a transient.snap_glyph token).
 *
 * The function takes its own snapshot of the existing transform via
 * `ctx.save()` / `ctx.restore()` so callers don't have to re-apply the
 * metric transform after the call.
 */
export function paintSnapGlyph(
  ctx: CanvasRenderingContext2D,
  snapTarget: SnapHit,
  viewport: Viewport,
  tokens: SemanticTokens,
): void {
  if (snapTarget.kind === 'cursor') return;

  const screen = metricToScreen(snapTarget.point, viewport);
  const dpr = viewport.dpr;
  const cx = screen.x * dpr;
  const cy = screen.y * dpr;
  const color = tokens.canvas.snap_indicator;
  const stroke = STROKE_CSS_PX * dpr;

  ctx.save();
  // Reset transform so we draw in device pixels; multiply by dpr inline
  // to keep glyph CSS-px sized regardless of zoom.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = stroke;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  switch (snapTarget.kind) {
    case 'endpoint': {
      const half = (ENDPOINT_SIDE_CSS / 2) * dpr;
      ctx.beginPath();
      ctx.rect(cx - half, cy - half, half * 2, half * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'midpoint': {
      // Equilateral triangle pointing up, side ≈ MIDPOINT_SIDE_CSS.
      const side = MIDPOINT_SIDE_CSS * dpr;
      const half = side / 2;
      const h = (Math.sqrt(3) / 2) * side;
      const apexY = cy - h * (2 / 3);
      const baseY = cy + h * (1 / 3);
      ctx.beginPath();
      ctx.moveTo(cx, apexY);
      ctx.lineTo(cx - half, baseY);
      ctx.lineTo(cx + half, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'intersection': {
      const r = INTERSECTION_HALF_CSS * dpr;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.moveTo(cx - r, cy + r);
      ctx.lineTo(cx + r, cy - r);
      ctx.stroke();
      break;
    }
    case 'node': {
      const r = NODE_RADIUS_CSS * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'grid-node': {
      const half = GRID_NODE_HALF_CSS * dpr;
      ctx.beginPath();
      ctx.moveTo(cx - half, cy);
      ctx.lineTo(cx + half, cy);
      ctx.moveTo(cx, cy - half);
      ctx.lineTo(cx, cy + half);
      ctx.stroke();
      break;
    }
    case 'grid-line': {
      // Degraded fallback — see file-header note. Smaller cross than
      // grid-node so the user can distinguish "fell on a node" vs "fell
      // on a line".
      const half = GRID_LINE_HALF_CSS * dpr;
      ctx.beginPath();
      ctx.moveTo(cx - half, cy);
      ctx.lineTo(cx + half, cy);
      ctx.moveTo(cx, cy - half);
      ctx.lineTo(cx, cy + half);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}
