// paintCrosshair — cursor crosshair painter.
//
// SSOT for crosshair modes. Three discrete modes; the resolver maps the
// (point-pick prompt, user-toggled F7 size) inputs to a single mode and
// the painter dispatches on it. No more raw `sizePct` plumbing in the
// caller.
//
//   full      — long arms spanning the canvas + pickbox      (F7 default)
//   pickbox   — pickbox only, no arms                        (F7 minimum)
//   pick-point — short cross + NO pickbox                    (point-pick prompts)
//
// AutoCAD-style cursor: the pickbox doubles as the click target when no
// tool is active and tags the cursor center with a 10×10 CSS-px square.
// Each axis becomes TWO segments (left/right or top/bottom arms) skipping
// the pickbox region; the pickbox itself is a strokeRect. Defensive
// `halfH > pbHalf` / `halfV > pbHalf` guards omit zero-or-negative arms.
//
// Color from canvas.transient.crosshair. Dash pattern from
// canvas.transient.crosshair_dash ('solid' sentinel → no dashing).
// Renders in screen-space (transform reset to identity).

import type { SemanticTokens } from '@portplanner/design-system';
import type { Point2D } from '@portplanner/domain';

import { type Viewport, metricToScreen } from '../view-transform';
import { parseDashPattern, parseNumericToken } from './_tokens';

/** Discriminated cursor styles. SSOT — every consumer routes through
 *  `resolveCrosshairMode` to pick one of these. */
export type CrosshairMode = 'full' | 'pickbox' | 'pick-point';

interface CrosshairVisual {
  /** % of canvas height for cross arm length. Special: 100 → full canvas
   *  (arms span the whole viewport). 0 → no arms (pickbox-only mode). */
  sizePct: number;
  /** Render the 10×10 CSS-px pickbox at the cursor center. */
  showPickbox: boolean;
}

const VISUAL_BY_MODE: Record<CrosshairMode, CrosshairVisual> = {
  full: { sizePct: 100, showPickbox: true },
  pickbox: { sizePct: 0, showPickbox: true },
  // Pick-point: small cross indicates "pick a metric point now"; no
  // pickbox so the cursor doesn't look like a hit-test selector.
  'pick-point': { sizePct: 5, showPickbox: false },
};

/** Resolve the cursor mode from the two orthogonal inputs:
 *    - pointPickActive: the active prompt expects a metric point
 *    - userSizePct: the user's F7 toggle (50+ → full, else → pickbox)
 *  Pick-point wins over the user toggle. SSOT for the precedence rule. */
export function resolveCrosshairMode(args: {
  pointPickActive: boolean;
  userSizePct: number;
}): CrosshairMode {
  if (args.pointPickActive) return 'pick-point';
  return args.userSizePct >= 50 ? 'full' : 'pickbox';
}

export function paintCrosshair(
  ctx: CanvasRenderingContext2D,
  cursor: Point2D,
  mode: CrosshairMode,
  viewport: Viewport,
  tokens: SemanticTokens,
): void {
  const { sizePct, showPickbox } = VISUAL_BY_MODE[mode];
  const transient = tokens.canvas.transient;
  const dash = parseDashPattern(transient.crosshair_dash);
  const dpr = viewport.dpr;
  const strokeWidth = parseNumericToken(transient.crosshair_stroke_width);
  const pickboxHalf = parseNumericToken(transient.crosshair_pickbox_half);
  const screen = metricToScreen(cursor, viewport);
  const cx = screen.x * dpr;
  const cy = screen.y * dpr;
  const canvasW = viewport.canvasWidthCss * dpr;
  const canvasH = viewport.canvasHeightCss * dpr;
  const pbHalf = pickboxHalf * dpr;

  let halfH: number;
  let halfV: number;
  if (sizePct >= 100) {
    halfH = canvasW;
    halfV = canvasH;
  } else if (sizePct <= 0) {
    halfH = 0;
    halfV = 0;
  } else {
    const crossLen = (sizePct / 100) * canvasH;
    halfH = crossLen / 2;
    halfV = crossLen / 2;
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = transient.crosshair;
  ctx.lineWidth = strokeWidth * dpr;
  ctx.setLineDash(dash.map((n) => n * dpr));

  ctx.beginPath();
  // Pick-point mode hides the pickbox, so cross arms run all the way
  // through the cursor (no gap). Other modes skip the pickbox region.
  const armGap = showPickbox ? pbHalf : 0;
  if (halfH > armGap) {
    ctx.moveTo(cx - halfH, cy);
    ctx.lineTo(cx - armGap, cy);
    ctx.moveTo(cx + armGap, cy);
    ctx.lineTo(cx + halfH, cy);
  }
  if (halfV > armGap) {
    ctx.moveTo(cx, cy - halfV);
    ctx.lineTo(cx, cy - armGap);
    ctx.moveTo(cx, cy + armGap);
    ctx.lineTo(cx, cy + halfV);
  }
  ctx.stroke();

  if (showPickbox) {
    // Pickbox square at the cursor — outlined, no fill (snap glyph and
    // other overlay-pass painters paint AFTER paintCrosshair so they
    // win z-order when they overlap the pickbox region).
    ctx.strokeRect(cx - pbHalf, cy - pbHalf, pbHalf * 2, pbHalf * 2);
  }

  ctx.restore();
}
