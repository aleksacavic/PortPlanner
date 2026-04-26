// paintSelection — selection outline + grip squares for selected
// entities. M1.3d Phase 5.
//
// Two passes per selected entity:
//   1) Solid outline using canvas.transient.selection_window.stroke
//      (slightly different from hover: solid 1.5 px CSS, not dashed).
//   2) Grip squares at each gripsOf(entity) position, painted as 7×7
//      CSS-px filled blue squares (canvas.handle_move) with a 1 px
//      white border for contrast on dark canvas.
//
// I-DTP-11: grips appear ONLY on click-select; hover NEVER paints
// grips. Caller (EditorRoot effect) is responsible for setting
// overlay.grips ONLY when an entity is selected.

import type { SemanticTokens } from '@portplanner/design-system';
import type { Primitive } from '@portplanner/domain';

import type { Grip } from '../../ui-state/store';
import { type Viewport, metricToScreen } from '../view-transform';
import { strokeEntityOutline } from './strokeEntityOutline';

const OUTLINE_STROKE_CSS = 1.5;
const GRIP_SIDE_CSS = 7;
const GRIP_BORDER_CSS = 1;

export function paintSelection(
  ctx: CanvasRenderingContext2D,
  primitive: Primitive,
  grips: Grip[],
  viewport: Viewport,
  tokens: SemanticTokens,
): void {
  const transient = tokens.canvas.transient.selection_window;
  const lineWidthMetric = OUTLINE_STROKE_CSS / (viewport.zoom * viewport.dpr);

  // Outline pass — solid stroke (clear setLineDash explicitly so a
  // previous painter's dash doesn't leak into the outline).
  ctx.save();
  ctx.strokeStyle = transient.stroke;
  ctx.lineWidth = lineWidthMetric;
  ctx.setLineDash([]);
  strokeEntityOutline(ctx, primitive, viewport);
  ctx.restore();

  // Grip pass — screen-space squares so visual size stays constant
  // across zoom (I-DTP-14).
  const dpr = viewport.dpr;
  const half = (GRIP_SIDE_CSS / 2) * dpr;
  const border = GRIP_BORDER_CSS * dpr;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const g of grips) {
    if (g.entityId !== primitive.id) continue;
    const screen = metricToScreen(g.position, viewport);
    const cx = screen.x * dpr;
    const cy = screen.y * dpr;
    ctx.fillStyle = tokens.canvas.handle_move;
    ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = border;
    ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
  }
  ctx.restore();
}
