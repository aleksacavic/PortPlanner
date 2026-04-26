// Custom view transform per ADR-021 — pan + zoom + DPR.
// Project-local metric ↔ screen pixels.
//
// Invariants:
//   I-22: screenToMetric(metricToScreen(p, v), v) ≈ p (within 1e-9 rel).
//
// Sign convention: project +Y is "up" in metric, but canvas +Y is "down"
// in screen. metricToScreen flips Y so visual orientation matches.

import type { Point2D } from '@portplanner/domain';

export interface Viewport {
  /** Project-local metric x of the canvas centre. */
  panX: number;
  /** Project-local metric y of the canvas centre. */
  panY: number;
  /** Pixels per metric unit (>0). */
  zoom: number;
  /** devicePixelRatio at canvas init time. */
  dpr: number;
  /** Canvas CSS width (independent of DPR). */
  canvasWidthCss: number;
  /** Canvas CSS height (independent of DPR). */
  canvasHeightCss: number;
  /**
   * Cursor crosshair size as a percentage of canvas height (0..100).
   * 100 = full-canvas crosshair (AutoCAD CURSORSIZE default).
   * 5 = pickbox-sized cross at cursor.
   * F7 toggles between presets (M1.3d Phase 8). Continuous values
   * permitted for a future settings slider; clamped to [0, 100] at
   * the action level (I-DTP-3 / I-DTP-18).
   */
  crosshairSizePct: number;
}

export interface ScreenPoint {
  /** CSS pixels from canvas left edge. */
  x: number;
  /** CSS pixels from canvas top edge. */
  y: number;
}

export function metricToScreen(p: Point2D, v: Viewport): ScreenPoint {
  return {
    x: v.canvasWidthCss / 2 + (p.x - v.panX) * v.zoom,
    y: v.canvasHeightCss / 2 - (p.y - v.panY) * v.zoom,
  };
}

export function screenToMetric(s: ScreenPoint, v: Viewport): Point2D {
  return {
    x: v.panX + (s.x - v.canvasWidthCss / 2) / v.zoom,
    y: v.panY - (s.y - v.canvasHeightCss / 2) / v.zoom,
  };
}

/** Frustum (axis-aligned bounding box) of the visible viewport in metric. */
export function viewportFrustum(v: Viewport): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const halfW = v.canvasWidthCss / 2 / v.zoom;
  const halfH = v.canvasHeightCss / 2 / v.zoom;
  return {
    minX: v.panX - halfW,
    maxX: v.panX + halfW,
    minY: v.panY - halfH,
    maxY: v.panY + halfH,
  };
}

/**
 * Configures the canvas 2D context to operate in metric coordinates
 * with DPR + Y-flip applied. After calling, `ctx.lineTo(metricX, metricY)`
 * draws at the right pixel.
 *
 * The canvas backing buffer MUST already be sized to `canvasWidthCss * dpr`
 * by `canvasHeightCss * dpr`; this function only sets the transform.
 */
export function applyToCanvasContext(ctx: CanvasRenderingContext2D, v: Viewport): void {
  // The combined transform takes (metricX, metricY) → device pixels.
  // 1. Translate to canvas centre (in device pixels).
  // 2. Scale by zoom × dpr (positive x, negative y to flip Y).
  // 3. Translate by -pan.
  const dpr = v.dpr;
  const cx = (v.canvasWidthCss / 2) * dpr;
  const cy = (v.canvasHeightCss / 2) * dpr;
  // setTransform(a, b, c, d, e, f) = matrix [[a,c,e],[b,d,f]]
  // metricX → cx + (metricX - panX) * zoom * dpr
  // metricY → cy - (metricY - panY) * zoom * dpr
  const s = v.zoom * dpr;
  ctx.setTransform(s, 0, 0, -s, cx - v.panX * s, cy + v.panY * s);
}
