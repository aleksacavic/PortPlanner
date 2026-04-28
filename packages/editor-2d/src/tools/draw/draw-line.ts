import { LayerId, newPrimitiveId } from '@portplanner/domain';
import { addPrimitive } from '@portplanner/project-store';

import { DIM_OFFSET_CSS } from '../../canvas/painters/paintDimensionGuides';
import { editorUiStore } from '../../ui-state/store';
import type { DimensionGuide, DynamicInputManifest, ToolGenerator } from '../types';

// M1.3 Round 6 — DI manifest for the second-point prompt. Sparse:
// distance + angle fields, combineAs:'point' triggers the deg→rad
// polar conversion in combineDynamicInputBuffers. Plan §4.1 + Phase 2
// step 13.
const LINE_DI_MANIFEST: DynamicInputManifest = {
  fields: [
    { kind: 'distance', label: 'Distance' },
    { kind: 'angle', label: 'Angle' },
  ],
  combineAs: 'point',
};

export async function* drawLineTool(): ToolGenerator {
  const start = yield { text: 'Specify start point', acceptedInputKinds: ['point'] };
  if (start.kind !== 'point') return { committed: false, reason: 'aborted' };
  const p1 = start.point;
  const end = yield {
    text: 'Specify end point',
    acceptedInputKinds: ['point'],
    previewBuilder: (cursor) => ({ kind: 'line', p1, cursor }),
    // F1: typed numeric distance lands at p1 + unit(cursor - p1) * d.
    directDistanceFrom: p1,
    // M1.3 Round 6 — DI manifest + dimension-guides builder. The
    // dimensionGuidesBuilder mirrors previewBuilder shape: pure
    // (cursor) => DimensionGuide[]. Two guides: linear-dim along the
    // leg p1→cursor (distance pill); angle-arc at p1 from horizontal-
    // right with sweep = atan2(cursor-p1) (angle pill).
    dynamicInput: LINE_DI_MANIFEST,
    dimensionGuidesBuilder: (cursor): DimensionGuide[] => [
      // Distance: SINGLE-side witness (CCW perpendicular off the line).
      // Offset uses shared SSOT constant DIM_OFFSET_CSS so line +
      // rectangle dim offsets stay in lockstep (user feedback: "isnt
      // this ssot?").
      { kind: 'linear-dim', anchorA: p1, anchorB: cursor, offsetCssPx: DIM_OFFSET_CSS },
      // Angle arc PIVOT IS AT THE CURSOR (the rubber-band end being
      // dragged), not at p1 (user feedback: "polar arc just needs to
      // start at the cursor position"). Polar baseline extends from
      // cursor horizontally; arc sweeps from horizontal-right at cursor
      // toward p1's direction. Painter clamps baseline to [100, 400]
      // CSS-px and uses that same length as the arc radius.
      {
        kind: 'angle-arc',
        pivot: cursor,
        baseAngleRad: 0,
        sweepAngleRad: Math.atan2(p1.y - cursor.y, p1.x - cursor.x),
        radiusCssPx: 120,
        polarRefLengthMetric: Math.abs(cursor.x - p1.x),
      },
    ],
  };
  if (end.kind !== 'point') return { committed: false, reason: 'aborted' };
  const layerId = editorUiStore.getState().activeLayerId ?? LayerId.DEFAULT;
  addPrimitive({
    id: newPrimitiveId(),
    kind: 'line',
    layerId,
    displayOverrides: {},
    p1: start.point,
    p2: end.point,
  });
  return { committed: true, description: 'line' };
}
