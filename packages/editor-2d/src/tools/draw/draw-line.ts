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
    dimensionGuidesBuilder: (cursor): DimensionGuide[] => {
      // Phase 6 — anchorA/anchorB swap so the dim line always lands on
      // the OUTER side of the polar arc. Painter computes perp = CCW
      // rotation of (anchorB - anchorA); for cursor strictly in Q3
      // (sweep < -π/2), CCW perp falls INSIDE the polar wedge,
      // overlapping the arc. Swapping anchors flips perp 180° to the
      // outer side. Other quadrants (Q1, Q2, Q4) keep the natural
      // (p1, cursor) order.
      const sweep = Math.atan2(cursor.y - p1.y, cursor.x - p1.x);
      const flip = sweep < -Math.PI / 2;
      const dimA = flip ? cursor : p1;
      const dimB = flip ? p1 : cursor;
      return [
        { kind: 'linear-dim', anchorA: dimA, anchorB: dimB, offsetCssPx: DIM_OFFSET_CSS },
        // Angle arc — Round-2 user spec: arc centered at LINE START (p1),
        // PASSES THROUGH cursor, terminates ON the horizontal baseline.
        {
          kind: 'angle-arc',
          pivot: p1,
          baseAngleRad: 0,
          sweepAngleRad: sweep,
          radiusMetric: Math.hypot(cursor.x - p1.x, cursor.y - p1.y),
        },
      ];
    },
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
