// Paint loop per ADR-021. Kind-discriminated dispatch over visible
// entities; layer visibility / frozen filter applied here. Layer
// visibility MUST NOT propagate beyond paint (extraction is layer-
// agnostic per ADR-017).

import type { Project } from '@portplanner/domain';

import { paintGrid, paintPrimitive } from './painters';
import { type PrimitiveSpatialIndex } from './spatial-index';
import { resolveEffectiveStyle } from './style';
import { type Viewport, applyToCanvasContext, viewportFrustum } from './view-transform';

export interface PaintInput {
  project: Project;
  viewport: Viewport;
  spatialIndex: PrimitiveSpatialIndex;
}

export function paint(ctx: CanvasRenderingContext2D, input: PaintInput): void {
  const { project, viewport, spatialIndex } = input;

  // Reset transform + clear in device-pixel coords.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, viewport.canvasWidthCss * viewport.dpr, viewport.canvasHeightCss * viewport.dpr);

  // Apply view transform (DPR + Y-flip + zoom + pan).
  applyToCanvasContext(ctx, viewport);
  const metricToPx = viewport.zoom * viewport.dpr;
  const frustum = viewportFrustum(viewport);

  // 1. Grids first (below entities). Filter by grid + layer visibility.
  for (const grid of Object.values(project.grids)) {
    if (!grid.visible) continue;
    const layer = project.layers[grid.layerId];
    if (!layer || !layer.visible || layer.frozen) continue;
    const style = resolveEffectiveStyle({}, layer);
    paintGrid(ctx, grid, style, metricToPx, frustum);
  }

  // 2. Primitives in frustum, filtered by layer visibility.
  const visiblePrimitiveIds = spatialIndex.searchFrustum(frustum);
  for (const id of visiblePrimitiveIds) {
    const primitive = project.primitives[id];
    if (!primitive) continue;
    const layer = project.layers[primitive.layerId];
    if (!layer || !layer.visible || layer.frozen) continue;
    const style = resolveEffectiveStyle(primitive.displayOverrides, layer);
    paintPrimitive(ctx, primitive, style, metricToPx, frustum);
  }
}
