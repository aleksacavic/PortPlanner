// select-rect tool — modeless selection-rectangle drag (M1.3d Phase 7).
//
// Lifecycle:
//   1) canvas-host's left-mousedown with no active tool + no grip hit
//      starts select-rect via `selectRectTool(start, hitTestAtStart)`.
//      The factory captures the mousedown METRIC point.
//   2) Tool yields one Prompt with previewBuilder that constructs the
//      'selection-rect' arm of PreviewShape from the cursor.
//      paint.ts dispatches the selection-rect arm to paintSelectionRect
//      (NOT paintPreview) so the per-direction styling is right.
//   3) Tool awaits a 'point' input — the mouseup point routed by
//      EditorRoot's handleCanvasMouseUp via the canvas-host
//      onCanvasMouseUp prop.
//   4) Click-without-drag (start ≈ end within tolerance) → single-
//      entity hit-test on start + setSelection. Otherwise, resolve
//      direction (start.x < end.x → window, else crossing) and call
//      searchEnclosed (window) or searchFrustum (crossing) on the
//      drag rect.
//   5) Always returns committed: true (selection is UI-only state and
//      can't really fail).
//
// I-DTP-15: direction by start.x vs end.x.
// I-DTP-16: window=searchEnclosed, crossing=searchFrustum.
// I-DTP-17: click-without-drag → hit-test on start, NOT empty-rect.

import type { Point2D, PrimitiveId } from '@portplanner/domain';
import { projectStore } from '@portplanner/project-store';

import { hitTest } from '../canvas/hit-test';
import { PrimitiveSpatialIndex } from '../canvas/spatial-index';
import { type ScreenPoint, metricToScreen } from '../canvas/view-transform';
import { editorUiActions, editorUiStore } from '../ui-state/store';
import type { ToolGenerator } from './types';

const CLICK_VS_DRAG_TOLERANCE_CSS = 2;

export function selectRectTool(start: Point2D, startScreen: ScreenPoint): () => ToolGenerator {
  return async function* (): ToolGenerator {
    const next = yield {
      text: 'Specify opposite corner',
      acceptedInputKinds: ['point'],
      previewBuilder: (cursor) => ({
        kind: 'selection-rect',
        start,
        end: cursor,
        // Plan canonical rule (I-DTP-15): `start.x < end.x` → window;
        // otherwise crossing. The strict-less-than treats the equality
        // boundary (vertical-only drag with cursor.x === start.x) as
        // crossing — matches AutoCAD behaviour where a strictly-vertical
        // drag biases toward crossing-selection.
        direction: start.x < cursor.x ? 'window' : 'crossing',
      }),
    };
    if (next.kind !== 'point') {
      return { committed: false, reason: 'aborted' };
    }
    const end = next.point;
    const ui = editorUiStore.getState();
    const project = projectStore.getState().project;
    if (!project) return { committed: false, reason: 'aborted' };

    // Click-without-drag detection (I-DTP-17). Convert end to screen
    // and compare against the original mousedown screen point.
    const endScreen = metricToScreen(end, ui.viewport);
    const dx = endScreen.x - startScreen.x;
    const dy = endScreen.y - startScreen.y;
    const isClickOnly = Math.hypot(dx, dy) <= CLICK_VS_DRAG_TOLERANCE_CSS;

    if (isClickOnly) {
      // Single-entity hit-test on the start point. Empty hit clears
      // the selection (CAD convention).
      const idx = new PrimitiveSpatialIndex();
      for (const p of Object.values(project.primitives)) idx.insert(p);
      const hit = hitTest(startScreen, ui.viewport, idx, project.primitives);
      editorUiActions.setSelection(hit ? [hit] : []);
      return { committed: true, description: hit ? 'select 1' : 'clear selection' };
    }

    // Drag-resolved selection — plan canonical rule (I-DTP-15):
    // `start.x < end.x` → window; otherwise crossing. MUST match the
    // previewBuilder's direction logic above so the visible color and
    // the resolved selection semantics agree on the boundary.
    const direction: 'window' | 'crossing' = start.x < end.x ? 'window' : 'crossing';
    const rect = {
      minX: Math.min(start.x, end.x),
      maxX: Math.max(start.x, end.x),
      minY: Math.min(start.y, end.y),
      maxY: Math.max(start.y, end.y),
    };
    const idx = new PrimitiveSpatialIndex();
    for (const p of Object.values(project.primitives)) idx.insert(p);
    // M1.3d-Remediation-2 R5 — crossing now uses geometric wire-vs-rect
    // narrow-phase (searchCrossing) instead of the bbox-only
    // searchFrustum. Window stays bbox-fully-inside (equivalent to
    // wire-fully-inside for our convex/connected primitives — verified
    // in spatial-index.ts).
    const ids: PrimitiveId[] =
      direction === 'window'
        ? idx.searchEnclosed(rect)
        : idx.searchCrossing(rect, project.primitives);
    editorUiActions.setSelection(ids);
    return {
      committed: true,
      description: `${direction} select ${ids.length}`,
    };
  };
}

// Re-export for tests / for any future consumer that needs the
// internals (currently none — kept for symmetry with other tools).
export const SELECT_RECT_CLICK_TOLERANCE_CSS = CLICK_VS_DRAG_TOLERANCE_CSS;
