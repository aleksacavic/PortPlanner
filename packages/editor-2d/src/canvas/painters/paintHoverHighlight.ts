// paintHoverHighlight — faint dashed outline drawn over the entity
// currently under the cursor when no tool is active (I-DTP-12 gating
// is at the EditorRoot effect; this painter just renders).
//
// Reads styling EXCLUSIVELY from canvas.transient.hover_highlight per
// I-DTP-1. Stroke-only (no fill). The outline is drawn in METRIC space
// using the active paint transform — same coordinate system as
// paintPreview's per-arm rendering — so the highlight tracks the
// entity at any zoom.

import type { SemanticTokens } from '@portplanner/design-system';
import type { Primitive } from '@portplanner/domain';

import type { Viewport } from '../view-transform';
import { parseDashPattern, parseNumericToken } from './_tokens';
import { strokeEntityOutline } from './strokeEntityOutline';

export function paintHoverHighlight(
  ctx: CanvasRenderingContext2D,
  primitive: Primitive,
  viewport: Viewport,
  tokens: SemanticTokens,
): void {
  const transient = tokens.canvas.transient.hover_highlight;
  const dash = parseDashPattern(transient.dash);
  const lineWidthMetric =
    parseNumericToken(transient.stroke_width) / (viewport.zoom * viewport.dpr);

  ctx.save();
  ctx.strokeStyle = transient.stroke;
  ctx.lineWidth = lineWidthMetric;
  ctx.setLineDash(dash.map((n) => n / (viewport.zoom * viewport.dpr)));
  strokeEntityOutline(ctx, primitive, viewport);
  ctx.restore();
}
