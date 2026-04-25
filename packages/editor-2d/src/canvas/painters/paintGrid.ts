// Grid painter per ADR-021 §Grid rendering. Computes lattice lines
// in viewport extent, transforms by grid origin/angle, strokes with
// effective layer style.

import type { Grid } from '@portplanner/domain';

import type { EffectiveStyle } from '../style';

interface Frustum {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function paintGrid(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  style: EffectiveStyle,
  metricToPx: number,
  frustum: Frustum,
): void {
  ctx.strokeStyle = style.color;
  ctx.lineWidth = 1 / metricToPx;
  const cos = Math.cos(grid.angle);
  const sin = Math.sin(grid.angle);

  // Inverse-rotate frustum corners into grid-local frame, take their
  // extent as the lattice range.
  const corners = [
    { x: frustum.minX, y: frustum.minY },
    { x: frustum.maxX, y: frustum.minY },
    { x: frustum.maxX, y: frustum.maxY },
    { x: frustum.minX, y: frustum.maxY },
  ].map((c) => {
    const dx = c.x - grid.origin.x;
    const dy = c.y - grid.origin.y;
    return { u: dx * cos + dy * sin, v: -dx * sin + dy * cos };
  });
  const us = corners.map((p) => p.u);
  const vs = corners.map((p) => p.v);
  const uMin = Math.min(...us);
  const uMax = Math.max(...us);
  const vMin = Math.min(...vs);
  const vMax = Math.max(...vs);

  const kStartX = Math.floor(uMin / grid.spacingX);
  const kEndX = Math.ceil(uMax / grid.spacingX);
  const kStartY = Math.floor(vMin / grid.spacingY);
  const kEndY = Math.ceil(vMax / grid.spacingY);

  ctx.beginPath();
  // Vertical lines (constant u).
  for (let k = kStartX; k <= kEndX; k++) {
    const u = k * grid.spacingX;
    // From (u, vMin) to (u, vMax) in local; transform to world.
    const x0 = grid.origin.x + u * cos - vMin * sin;
    const y0 = grid.origin.y + u * sin + vMin * cos;
    const x1 = grid.origin.x + u * cos - vMax * sin;
    const y1 = grid.origin.y + u * sin + vMax * cos;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  // Horizontal lines (constant v).
  for (let k = kStartY; k <= kEndY; k++) {
    const v = k * grid.spacingY;
    const x0 = grid.origin.x + uMin * cos - v * sin;
    const y0 = grid.origin.y + uMin * sin + v * cos;
    const x1 = grid.origin.x + uMax * cos - v * sin;
    const y1 = grid.origin.y + uMax * sin + v * cos;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
}
