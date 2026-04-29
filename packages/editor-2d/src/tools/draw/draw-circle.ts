// Draw circle by center + radius point. Round-2 remediation: single-
// field [Radius] DI with linear-dim guide along center→cursor (full
// witness + dim line + end-caps via DIM_OFFSET_CSS SSOT). No angle
// pill / angle-arc — the circle is rotationally symmetric, so the
// radius angle is meaningless.

import { LayerId, newPrimitiveId } from '@portplanner/domain';
import { addPrimitive } from '@portplanner/project-store';

import { DIM_OFFSET_CSS } from '../../canvas/painters/paintDimensionGuides';
import { editorUiStore } from '../../ui-state/store';
import type { DimensionGuide, DynamicInputManifest, ToolGenerator } from '../types';

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
    // Accept 'number' from the DI single-field combiner (typed radius)
    // and 'point' from a click.
    acceptedInputKinds: ['point', 'number'],
    previewBuilder: (cursor) => ({ kind: 'circle', center: ctr, cursor }),
    // F1: typed numeric distance lands at center + unit(cursor - center) * d.
    directDistanceFrom: ctr,
    dynamicInput: CIRCLE_DI_MANIFEST,
    // linear-dim: full witness + dim line + end-caps along the radius
    // segment, offset DIM_OFFSET_CSS from the line. Radius pill anchors
    // on the dim-line midpoint.
    dimensionGuidesBuilder: (cursor): DimensionGuide[] => [
      { kind: 'linear-dim', anchorA: ctr, anchorB: cursor, offsetCssPx: DIM_OFFSET_CSS },
    ],
  };

  // DI single-field commit (typed radius + Enter on canvas focus).
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
