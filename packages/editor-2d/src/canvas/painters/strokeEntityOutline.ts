// Strokes the outline of any primitive in METRIC space using the
// CURRENT ctx.strokeStyle / lineWidth / lineDash. Caller is responsible
// for save/restore and stroke-style configuration.
//
// Used by paintHoverHighlight (Phase 5) and paintSelection (Phase 5).
// Both painters need to render an entity's silhouette without a fill,
// using their own transient styling. Centralizing the path geometry
// here avoids duplicating per-kind path commands.
//
// xline is intentionally rendered as a long line through the pivot
// (extended past the visible viewport) — matches paintPreview's xline
// behaviour. Fillet bulges in polylines are NOT yet supported (M1.3a
// straight-only per I-48); when M1.3b adds bulges via Fillet, this
// helper extends additively.

import type { Primitive } from '@portplanner/domain';

import type { Viewport } from '../view-transform';

export function strokeEntityOutline(
  ctx: CanvasRenderingContext2D,
  p: Primitive,
  viewport: Viewport,
): void {
  switch (p.kind) {
    case 'point': {
      // Render a small cross around the point so a hover/selection on
      // a point primitive is visible at all zooms. 4 px CSS half-extent.
      const halfMetric = 4 / (viewport.zoom * viewport.dpr);
      ctx.beginPath();
      ctx.moveTo(p.position.x - halfMetric, p.position.y);
      ctx.lineTo(p.position.x + halfMetric, p.position.y);
      ctx.moveTo(p.position.x, p.position.y - halfMetric);
      ctx.lineTo(p.position.x, p.position.y + halfMetric);
      ctx.stroke();
      return;
    }
    case 'line':
      ctx.beginPath();
      ctx.moveTo(p.p1.x, p.p1.y);
      ctx.lineTo(p.p2.x, p.p2.y);
      ctx.stroke();
      return;
    case 'polyline': {
      if (p.vertices.length === 0) return;
      ctx.beginPath();
      const first = p.vertices[0]!;
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < p.vertices.length; i += 1) {
        const v = p.vertices[i]!;
        ctx.lineTo(v.x, v.y);
      }
      if (p.closed) ctx.closePath();
      ctx.stroke();
      return;
    }
    case 'rectangle': {
      const cos = Math.cos(p.localAxisAngle);
      const sin = Math.sin(p.localAxisAngle);
      const c0 = { x: p.origin.x, y: p.origin.y };
      const c1 = { x: p.origin.x + p.width * cos, y: p.origin.y + p.width * sin };
      const c2 = {
        x: p.origin.x + p.width * cos - p.height * sin,
        y: p.origin.y + p.width * sin + p.height * cos,
      };
      const c3 = { x: p.origin.x - p.height * sin, y: p.origin.y + p.height * cos };
      ctx.beginPath();
      ctx.moveTo(c0.x, c0.y);
      ctx.lineTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.lineTo(c3.x, c3.y);
      ctx.closePath();
      ctx.stroke();
      return;
    }
    case 'circle':
      ctx.beginPath();
      ctx.arc(p.center.x, p.center.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case 'arc': {
      const start = p.startAngle;
      let end = p.endAngle;
      while (end < start) end += Math.PI * 2;
      ctx.beginPath();
      ctx.arc(p.center.x, p.center.y, p.radius, start, end);
      ctx.stroke();
      return;
    }
    case 'xline': {
      // Same extent strategy as paintPreview's xline arm: span past the
      // visible viewport in both directions.
      const extent = ((viewport.canvasWidthCss + viewport.canvasHeightCss) / viewport.zoom) * 4;
      const ux = Math.cos(p.angle);
      const uy = Math.sin(p.angle);
      ctx.beginPath();
      ctx.moveTo(p.pivot.x - ux * extent, p.pivot.y - uy * extent);
      ctx.lineTo(p.pivot.x + ux * extent, p.pivot.y + uy * extent);
      ctx.stroke();
      return;
    }
  }
}
