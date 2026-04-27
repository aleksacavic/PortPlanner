// paintSelectionRect — window vs crossing rectangle painter for the
// selection-rect drag (M1.3d Phase 7). Routed via paint.ts's overlay-
// pass dispatcher when previewShape.kind === 'selection-rect'.
//
// Direction styling (AutoCAD verbatim):
//   'window'   → blue stroke + light-blue fill   (L→R drag, fully-enclosed)
//   'crossing' → green stroke + light-green fill (R→L drag, any-touch)
//
// Renders in screen-space (transform reset to identity). The rectangle's
// CSS-pixel size matches the user's drag — same convention as
// paintSnapGlyph / paintCrosshair.

import type { SemanticTokens } from '@portplanner/design-system';
import type { Point2D } from '@portplanner/domain';

import { type Viewport, metricToScreen } from '../view-transform';

const STROKE_WIDTH_CSS = 1;

export function paintSelectionRect(
  ctx: CanvasRenderingContext2D,
  shape: {
    start: Point2D;
    end: Point2D;
    direction: 'window' | 'crossing';
  },
  viewport: Viewport,
  tokens: SemanticTokens,
): void {
  const t =
    shape.direction === 'window'
      ? tokens.canvas.transient.selection_window
      : tokens.canvas.transient.selection_crossing;
  const dash = parseDashPattern(t.dash);

  const a = metricToScreen(shape.start, viewport);
  const b = metricToScreen(shape.end, viewport);
  const dpr = viewport.dpr;
  const x = Math.min(a.x, b.x) * dpr;
  const y = Math.min(a.y, b.y) * dpr;
  const w = Math.abs(b.x - a.x) * dpr;
  const h = Math.abs(b.y - a.y) * dpr;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = t.fill;
  ctx.strokeStyle = t.stroke;
  ctx.lineWidth = STROKE_WIDTH_CSS * dpr;
  ctx.setLineDash(dash.map((n) => n * dpr));
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
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
