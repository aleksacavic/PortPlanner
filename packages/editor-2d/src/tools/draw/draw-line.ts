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
      // Distance: inline-mode dim (offsetCssPx === 0 → no witness/dim
      // line, line itself is the dim reference). Pill anchors on
      // segment midpoint. Offset uses shared SSOT constant
      // DIM_OFFSET_CSS so line + rectangle stay in lockstep.
      { kind: 'linear-dim', anchorA: p1, anchorB: cursor, offsetCssPx: DIM_OFFSET_CSS },
      // Angle arc — Round-2 user spec: arc centered at LINE START (p1),
      // PASSES THROUGH cursor, terminates ON the horizontal baseline.
      // Therefore radiusMetric = full line length; sweepAngleRad = line
      // angle from horizontal-right; painter draws the polar baseline
      // at the same length so the arc's baseline endpoint meets the
      // baseline endpoint.
      //
      // Sign of sweep: positive = line above horizontal (arc visually
      // CCW); negative = line below (arc visually CW). Painter selects
      // arc direction from sign of sweep.
      {
        kind: 'angle-arc',
        pivot: p1,
        baseAngleRad: 0,
        sweepAngleRad: Math.atan2(cursor.y - p1.y, cursor.x - p1.x),
        radiusMetric: Math.hypot(cursor.x - p1.x, cursor.y - p1.y),
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
