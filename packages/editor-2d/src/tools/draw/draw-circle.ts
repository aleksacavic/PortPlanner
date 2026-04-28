// Draw circle by center + radius (default) or 2-point diameter
// (sub-option, M1.3a stub — radius via second click).

import { LayerId, newPrimitiveId } from '@portplanner/domain';
import { addPrimitive } from '@portplanner/project-store';

import { editorUiStore } from '../../ui-state/store';
import type { DimensionGuide, DynamicInputManifest, ToolGenerator } from '../types';

// M1.3 Round 6 — DI manifest for the radius prompt. Single-field
// (kind 'distance', combineAs 'number'). Plan §4.1 + Phase 2 step 15.
const CIRCLE_DI_MANIFEST: DynamicInputManifest = {
  fields: [{ kind: 'distance', label: 'Radius' }],
  combineAs: 'number',
};

export async function* drawCircleTool(): ToolGenerator {
  const center = yield { text: 'Specify center', acceptedInputKinds: ['point'] };
  if (center.kind !== 'point') return { committed: false, reason: 'aborted' };
  const ctr = center.point;
  const edge = yield {
    text: 'Specify radius (point on circle)',
    // M1.3 Round 6 — accept 'number' on the radius prompt so the DI
    // single-field pill (typed radius + Enter) commits without going
    // through F1 directDistance polar conversion. The combiner returns
    // {kind: 'number', value} and the tool uses it directly as the
    // radius scalar.
    acceptedInputKinds: ['point', 'number'],
    previewBuilder: (cursor) => ({ kind: 'circle', center: ctr, cursor }),
    // F1: typed numeric value = radius (distance from center along cursor heading).
    directDistanceFrom: ctr,
    dynamicInput: CIRCLE_DI_MANIFEST,
    // radius-line guide: pivot = center, endpoint = cursor. Painter
    // draws a perpendicular tick at the midpoint as visual confirmation
    // (paintPreview's circle arm draws the radius line itself).
    dimensionGuidesBuilder: (cursor): DimensionGuide[] => [
      { kind: 'radius-line', pivot: ctr, endpoint: cursor },
    ],
  };

  // M1.3 Round 6 — DI single-field (typed radius + Enter on canvas focus).
  if (edge.kind === 'number') {
    const radius = Math.abs(edge.value);
    if (radius === 0) return { committed: false, reason: 'aborted' };
    const layerId = editorUiStore.getState().activeLayerId ?? LayerId.DEFAULT;
    addPrimitive({
      id: newPrimitiveId(),
      kind: 'circle',
      layerId,
      displayOverrides: {},
      center: ctr,
      radius,
    });
    return { committed: true, description: 'circle (DI radius)' };
  }

  if (edge.kind !== 'point') return { committed: false, reason: 'aborted' };

  const radius = Math.hypot(edge.point.x - center.point.x, edge.point.y - center.point.y);
  if (radius === 0) return { committed: false, reason: 'aborted' };

  const layerId = editorUiStore.getState().activeLayerId ?? LayerId.DEFAULT;
  addPrimitive({
    id: newPrimitiveId(),
    kind: 'circle',
    layerId,
    displayOverrides: {},
    center: center.point,
    radius,
  });
  return { committed: true, description: 'circle' };
}
