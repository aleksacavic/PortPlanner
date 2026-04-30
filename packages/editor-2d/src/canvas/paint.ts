// Paint loop per ADR-021. Kind-discriminated dispatch over visible
// entities; layer visibility / frozen filter applied here. Layer
// visibility MUST NOT propagate beyond paint (extraction is layer-
// agnostic per ADR-017).
//
// M1.3d Phase 2 — paint() now receives an `overlay: OverlayState | null`
// parameter alongside project/viewport/spatialIndex. The overlay snapshot
// is read once per frame by canvas-host's rAF callback via the
// `getOverlay` callback prop (Phase 1 step 8 / I-DTP-22). Phase 2 only
// threads the type through; the overlay-pass painters (paintCrosshair,
// paintHoverHighlight, paintSelection, paintPreview, paintSnapGlyph,
// paintSelectionRect, paintTransientLabel) land in Phases 3-8.

import { dark } from '@portplanner/design-system';
import type { PrimitiveId, Project } from '@portplanner/domain';

import type { Grip, OverlayState } from '../ui-state/store';
import { paintGrid, paintPrimitive } from './painters';
import { paintCrosshair } from './painters/paintCrosshair';
import { paintDimensionGuides } from './painters/paintDimensionGuides';
import { paintHoverHighlight } from './painters/paintHoverHighlight';
import { paintPreview } from './painters/paintPreview';
import { paintSelection } from './painters/paintSelection';
import { paintSelectionRect } from './painters/paintSelectionRect';
import { paintSnapGlyph } from './painters/paintSnapGlyph';
import type { PrimitiveSpatialIndex } from './spatial-index';
import { resolveEffectiveStyle } from './style';
import { type Viewport, applyToCanvasContext, viewportFrustum } from './view-transform';

export interface PaintInput {
  project: Project;
  viewport: Viewport;
  spatialIndex: PrimitiveSpatialIndex;
  /** Overlay snapshot read once per frame from `getOverlay()` callback.
   *  May be null if no overlay state is provided (initial frames before
   *  EditorRoot wires `getOverlay`, or test fixtures that don't care). */
  overlay: OverlayState | null;
}

export function paint(ctx: CanvasRenderingContext2D, input: PaintInput): void {
  const { project, viewport, spatialIndex, overlay } = input;

  // Reset transform + clear in device-pixel coords.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(
    0,
    0,
    viewport.canvasWidthCss * viewport.dpr,
    viewport.canvasHeightCss * viewport.dpr,
  );

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
    paintGrid(ctx, grid, style, metricToPx, frustum, dark);
  }

  // 2. Primitives in frustum, filtered by layer visibility.
  const visiblePrimitiveIds = spatialIndex.searchFrustum(frustum);
  const suppressId = overlay?.suppressEntityPaint ?? null;
  for (const id of visiblePrimitiveIds) {
    if (suppressId !== null && id === suppressId) continue;
    const primitive = project.primitives[id];
    if (!primitive) continue;
    const layer = project.layers[primitive.layerId];
    if (!layer || !layer.visible || layer.frozen) continue;
    const style = resolveEffectiveStyle(primitive.displayOverrides, layer);
    paintPrimitive(ctx, primitive, style, metricToPx, frustum);
  }

  // 3. Overlay pass — transient UI elements painted ABOVE entities, in
  // z-order: paintCrosshair → paintHoverHighlight → paintSelection →
  // paintPreview → paintSnapGlyph → paintSelectionRect →
  // paintTransientLabel (last so labels are always legible). Phases
  // 5-8 add the missing painters; the order below stays the canonical
  // pass even when a slot is empty. Each painter is responsible for
  // its own ctx.save/restore — none mutate the outgoing transform.
  if (overlay) {
    // Phase 8 — cursor crosshair (FIRST in overlay z-order so it sits
    // behind everything else but above entities). Only paints when
    // the cursor is over the canvas (overlay.cursor non-null).
    if (overlay.cursor && viewport.crosshairSizePct > 0) {
      paintCrosshair(ctx, overlay.cursor.metric, viewport.crosshairSizePct, viewport, dark);
    }
    // Phase 5 — hover highlight (lower z, renders below selection).
    if (overlay.hoverEntity) {
      const hovered = project.primitives[overlay.hoverEntity];
      if (hovered) {
        const layer = project.layers[hovered.layerId];
        if (layer?.visible && !layer.frozen) {
          paintHoverHighlight(ctx, hovered, viewport, dark);
        }
      }
    }
    // Phase 5 — selection outline + grips. Skip the suppressed entity
    // (mid-grip-stretch — Phase 6) since the entity is hidden during
    // the drag; the preview shape stands in for it.
    const grips = overlay.grips ?? [];
    const hoveredGripKey = overlay.hoveredGrip;
    for (const id of overlay.grips ? collectSelectedIds(grips) : []) {
      if (suppressId !== null && id === suppressId) continue;
      const selected = project.primitives[id];
      if (!selected) continue;
      paintSelection(ctx, selected, grips, viewport, dark, hoveredGripKey);
    }
    // Phase 4 — live preview. The 'selection-rect' arm routes to
    // paintSelectionRect (Phase 7); paintPreview ignores it. Re-apply
    // the metric transform after paintPreview's restore in case the
    // painter's save/restore left ctx in identity.
    if (overlay.previewShape && overlay.previewShape.kind !== 'selection-rect') {
      // M1.3 Round 7 backlog B3 — embedded labels removed wholesale
      // along with paintTransientLabel; rubber-band length/radius/W×H
      // readouts come from DynamicInputPills (DOM chrome) on top of
      // overlay.dimensionGuides.
      paintPreview(ctx, overlay.previewShape, viewport, dark);
      applyToCanvasContext(ctx, viewport);
    }
    // M1.3 Round 6 — dimension guides (linear-dim / angle-arc) painted
    // AFTER paintPreview so the witness/dim/arc strokes render on top
    // of the rubber-band geometry. Plan §7 Phase 1 step 5 + §10 audit
    // C3.8; per ADR-025.
    if (overlay.dimensionGuides && overlay.dimensionGuides.length > 0) {
      paintDimensionGuides(ctx, overlay.dimensionGuides, viewport, dark);
      applyToCanvasContext(ctx, viewport);
    }
    // Phase 3 — snap glyph.
    if (overlay.snapTarget) {
      paintSnapGlyph(ctx, overlay.snapTarget, viewport, dark);
    }
    // Phase 7 — selection rectangle. Drawn AFTER snap glyph (above) so
    // a snap target inside the rect remains visible. Routed by kind on
    // the previewShape arm so the runner's previewBuilder mechanism
    // handles it uniformly with the 7 draw previews.
    if (overlay.previewShape && overlay.previewShape.kind === 'selection-rect') {
      paintSelectionRect(ctx, overlay.previewShape, viewport, dark);
    }
    // M1.3 Round 7 backlog B3 — `overlay.transientLabels[]` had no
    // production writer (no tool ever called setTransientLabels) and
    // paintTransientLabel itself was wiped. The slice field is also
    // removed in this round.
  }
}

function collectSelectedIds(grips: Grip[]): PrimitiveId[] {
  const ids = new Set<PrimitiveId>();
  for (const g of grips) ids.add(g.entityId);
  return Array.from(ids);
}
