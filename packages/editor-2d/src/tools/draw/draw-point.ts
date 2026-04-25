import { LayerId, newPrimitiveId } from '@portplanner/domain';
import { addPrimitive } from '@portplanner/project-store';

import { editorUiStore } from '../../ui-state/store';
import type { ToolGenerator } from '../types';

export async function* drawPointTool(): ToolGenerator {
  const input = yield { text: 'Specify point', acceptedInputKinds: ['point'] };
  if (input.kind !== 'point') return { committed: false, reason: 'aborted' };
  const layerId = editorUiStore.getState().activeLayerId ?? LayerId.DEFAULT;
  addPrimitive({
    id: newPrimitiveId(),
    kind: 'point',
    layerId,
    displayOverrides: {},
    position: input.point,
  });
  return { committed: true, description: 'point' };
}
