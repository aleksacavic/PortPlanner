import { LayerId, newPrimitiveId } from '@portplanner/domain';
import { addPrimitive } from '@portplanner/project-store';

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
      // Distance: AC-style FULL-witness with BOTH-SIDE mirror —
      // parallelogram tube of dotted witness lines around the rubber-
      // band line. mirrorWitness: true paints witness on both sides.
      // 14 CSS-px offset on each side = 28-px-tall tube.
      {
        kind: 'linear-dim',
        anchorA: p1,
        anchorB: cursor,
        offsetCssPx: 14,
        mirrorWitness: true,
      },
      // Angle arc at p1 from horizontal-right baseline.
      // - radiusCssPx 120 — substantial AC-scale arc.
      // - polarRefLengthMetric = horizontal projection of the line
      //   (abs(cursor.x - p1.x)), so the dotted polar baseline visually
      //   spans from p1 toward the line end. AC reference image
      //   behaviour.
      {
        kind: 'angle-arc',
        pivot: p1,
        baseAngleRad: 0,
        sweepAngleRad: Math.atan2(cursor.y - p1.y, cursor.x - p1.x),
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
