// Draw xline (infinite construction line) by pivot + direction. The
// xline has no length — only direction matters. Round-2 remediation:
// adds a single-field [Angle] DI with an angle-arc guide (polar
// witness only — no distance dim, since the xline is infinite).

import { LayerId, type Point2D, newPrimitiveId } from '@portplanner/domain';
import { addPrimitive } from '@portplanner/project-store';

import { editorUiStore } from '../../ui-state/store';
import type { DimensionGuide, DynamicInputManifest, ToolGenerator } from '../types';

// Round-2 remediation: 1-field [Angle] DI (combineAs 'angle' yields
// { kind: 'angle', radians }). User types the direction in degrees.
const XLINE_DI_MANIFEST: DynamicInputManifest = {
  fields: [{ kind: 'angle', label: 'Angle' }],
  combineAs: 'angle',
};

// xline-specific arc radius for the angle-arc guide. The xline is
// infinite so there is no natural cursor distance to use as the arc
// radius (unlike line/polyline/circle, where radius = full segment
// length). Use a fixed metric value: cursor distance from pivot. This
// ties the arc radius to where the user's cursor is, mirroring the
// line tool's "arc passes through cursor" contract.
function radiusFromPivot(pivot: Point2D, cursor: Point2D): number {
  return Math.hypot(cursor.x - pivot.x, cursor.y - pivot.y);
}

export async function* drawXlineTool(): ToolGenerator {
  const pivot = yield { text: 'Specify pivot point', acceptedInputKinds: ['point'] };
  if (pivot.kind !== 'point') return { committed: false, reason: 'aborted' };
  const pv = pivot.point;
  const through = yield {
    text: 'Specify a point on the line (sets direction)',
    // Accept 'angle' from the DI combiner (typed direction) in addition
    // to a clicked point.
    acceptedInputKinds: ['point', 'angle'],
    previewBuilder: (cursor) => ({ kind: 'xline', pivot: pv, cursor }),
    dynamicInput: XLINE_DI_MANIFEST,
    // Polar witness only — no distance dim. The angle-arc carries the
    // full visual: dotted polar baseline + dotted arc from baseline to
    // the xline direction.
    dimensionGuidesBuilder: (cursor): DimensionGuide[] => [
      {
        kind: 'angle-arc',
        pivot: pv,
        baseAngleRad: 0,
        sweepAngleRad: Math.atan2(cursor.y - pv.y, cursor.x - pv.x),
        radiusMetric: radiusFromPivot(pv, cursor),
      },
    ],
  };

  let angle: number;
  if (through.kind === 'angle') {
    angle = through.radians;
  } else if (through.kind === 'point') {
    angle = Math.atan2(through.point.y - pivot.point.y, through.point.x - pivot.point.x);
  } else {
    return { committed: false, reason: 'aborted' };
  }

  const layerId = editorUiStore.getState().activeLayerId ?? LayerId.DEFAULT;
  addPrimitive({
    id: newPrimitiveId(),
    kind: 'xline',
    layerId,
    displayOverrides: {},
    pivot: pivot.point,
    angle,
  });
  return { committed: true, description: 'xline' };
}
