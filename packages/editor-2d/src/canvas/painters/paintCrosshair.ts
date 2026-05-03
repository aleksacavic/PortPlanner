// paintCrosshair — cursor crosshair painter.
//
// SSOT for crosshair modes. Three discrete modes; the resolver maps the
// (point-pick prompt, user-toggled F7 size) inputs to a single mode and
// the painter dispatches on it. No more raw `sizePct` plumbing in the
// caller.
//
//   full        — long arms spanning the canvas + pickbox    (F7 default)
//   pickbox     — short cross + pickbox                      (F7 minimum)
//   pick-point  — short cross + NO pickbox                   (free-form point-pick prompts)
//   pick-entity — pickbox only, NO arms                      ("Select object" prompts —
//                                                            tools opt in via Prompt.pickIntent
//                                                            = 'select-entity')
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
export type CrosshairMode = 'full' | 'pickbox' | 'pick-point' | 'pick-entity';

interface CrosshairVisual {
  /** % of canvas height for cross arm length. Special: 100 → full canvas
   *  (arms span the whole viewport). 0 → no arms. */
  sizePct: number;
  /** Render the 10×10 CSS-px pickbox at the cursor center. */
  showPickbox: boolean;
}

const VISUAL_BY_MODE: Record<CrosshairMode, CrosshairVisual> = {
  full: { sizePct: 100, showPickbox: true },
  // Pickbox mode = AC's "minimum CURSORSIZE" — short arms (~15 device px
  // at the F7 5% setting) flanking a pickbox. The pre-SSOT painter took
  // sizePct=5 directly and rendered both arms + pickbox; the SSOT mapping
  // preserves that visual.
  pickbox: { sizePct: 5, showPickbox: true },
  // Pick-point: same short arms but NO pickbox so the cursor doesn't look
  // like a hit-test selector during a free-form point-pick prompt.
  'pick-point': { sizePct: 5, showPickbox: false },
  // Pick-entity: pickbox ONLY (no arms) — visual signal "click an object",
  // distinct from pick-point's free-form-point signal. Used when a tool
  // sets Prompt.pickIntent = 'select-entity' (Fillet, Chamfer first/second
  // picks; future Trim/Extend/Erase/etc.).
  'pick-entity': { sizePct: 0, showPickbox: true },
};

/** Resolve the cursor mode from the orthogonal inputs:
 *    - entityPickActive: the active prompt selects an entity ("Select
 *      object" semantics — wins over everything else)
 *    - pointPickActive: the active prompt expects a metric point
 *    - userSizePct: the user's F7 toggle (50+ → full, else → pickbox)
 *  Precedence: pick-entity > pick-point > user toggle (full / pickbox).
 *  SSOT for the resolution rule.
 *
 *  `entityPickActive` is optional in the args type for back-compat with
 *  existing callers that haven't been updated; defaults to false. */
export function resolveCrosshairMode(args: {
  entityPickActive?: boolean;
  pointPickActive: boolean;
  userSizePct: number;
}): CrosshairMode {
  if (args.entityPickActive) return 'pick-entity';
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
