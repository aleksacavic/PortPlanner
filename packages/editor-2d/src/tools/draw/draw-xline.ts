// Draw xline (infinite construction line) by pivot + direction point.

import { LayerId, newPrimitiveId } from '@portplanner/domain';
import { addPrimitive } from '@portplanner/project-store';

import { editorUiStore } from '../../ui-state/store';
import type { ToolGenerator } from '../types';

export async function* drawXlineTool(): ToolGenerator {
  const pivot = yield { text: 'Specify pivot point', acceptedInputKinds: ['point'] };
  if (pivot.kind !== 'point') return { committed: false, reason: 'aborted' };
  const pv = pivot.point;
  const through = yield {
    text: 'Specify a point on the line (sets direction)',
    acceptedInputKinds: ['point'],
    previewBuilder: (cursor) => ({ kind: 'xline', pivot: pv, cursor }),
  };
  if (through.kind !== 'point') return { committed: false, reason: 'aborted' };

  const angle = Math.atan2(through.point.y - pivot.point.y, through.point.x - pivot.point.x);
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
