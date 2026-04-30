// paintSelection — selection outline + grip squares for selected
// entities. M1.3d Phase 5 + M1.3d-Remediation-2 R7 (hovered-grip
// differential rendering).
//
// Two passes per selected entity:
//   1) Solid outline using canvas.transient.selection_window.stroke
//      (slightly different from hover: solid 1.5 px CSS, not dashed).
//   2) Grip squares at each gripsOf(entity) position. Default: 7×7 CSS
//      px filled blue square (canvas.handle_move) with 1 px white
//      border. R7: when `hoveredGripKey` matches the current grip,
//      paint amber (canvas.handle_rotate) + 9×9 instead — AutoCAD-style
//      "this grip will grab on click" feedback.
//
// I-DTP-11: grips appear ONLY on click-select; hover NEVER paints
// grips. Caller (EditorRoot effect) is responsible for setting
// overlay.grips ONLY when an entity is selected.

import type { SemanticTokens } from '@portplanner/design-system';
import type { Primitive, PrimitiveId } from '@portplanner/domain';

import type { Grip } from '../../ui-state/store';
import { type Viewport, metricToScreen } from '../view-transform';
import { parseNumericToken } from './_tokens';
import { strokeEntityOutline } from './strokeEntityOutline';

export interface HoveredGripKey {
  entityId: PrimitiveId;
  gripKind: string;
}

export function paintSelection(
  ctx: CanvasRenderingContext2D,
  primitive: Primitive,
  grips: Grip[],
  viewport: Viewport,
  tokens: SemanticTokens,
  hoveredGripKey?: HoveredGripKey | null,
): void {
  const transient = tokens.canvas.transient.selection_window;
  const outlineStrokeCss = parseNumericToken(tokens.canvas.transient.selection_outline_width);
  const gripSideCss = parseNumericToken(tokens.canvas.transient.grip.side);
  const gripHoveredSideCss = parseNumericToken(tokens.canvas.transient.grip.hovered_side);
  const gripBorderCss = parseNumericToken(tokens.canvas.transient.grip.border_width);
  const lineWidthMetric = outlineStrokeCss / (viewport.zoom * viewport.dpr);

  // Outline pass — solid stroke (clear setLineDash explicitly so a
  // previous painter's dash doesn't leak into the outline).
  ctx.save();
  ctx.strokeStyle = transient.stroke;
  ctx.lineWidth = lineWidthMetric;
  ctx.setLineDash([]);
  strokeEntityOutline(ctx, primitive, viewport);
  ctx.restore();

  // Grip pass — screen-space squares so visual size stays constant
  // across zoom (I-DTP-14). Hovered grip (R7) gets amber fill + larger
  // square per AutoCAD's "grip about to be grabbed" convention.
  const dpr = viewport.dpr;
  const halfDefault = (gripSideCss / 2) * dpr;
  const halfHovered = (gripHoveredSideCss / 2) * dpr;
  const border = gripBorderCss * dpr;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const g of grips) {
    if (g.entityId !== primitive.id) continue;
    const isHovered =
      hoveredGripKey != null &&
      hoveredGripKey.entityId === g.entityId &&
      hoveredGripKey.gripKind === g.gripKind;
    const half = isHovered ? halfHovered : halfDefault;
    const fillColor = isHovered ? tokens.canvas.handle_rotate : tokens.canvas.handle_move;
    const screen = metricToScreen(g.position, viewport);
    const cx = screen.x * dpr;
    const cy = screen.y * dpr;
    ctx.fillStyle = fillColor;
    ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = border;
    ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
  }
  ctx.restore();
}
