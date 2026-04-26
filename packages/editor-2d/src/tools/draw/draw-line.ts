import { LayerId, newPrimitiveId } from '@portplanner/domain';
import { addPrimitive } from '@portplanner/project-store';

import { editorUiStore } from '../../ui-state/store';
import type { ToolGenerator } from '../types';

export async function* drawLineTool(): ToolGenerator {
  const start = yield { text: 'Specify start point', acceptedInputKinds: ['point'] };
  if (start.kind !== 'point') return { committed: false, reason: 'aborted' };
  const p1 = start.point;
  const end = yield {
    text: 'Specify end point',
    acceptedInputKinds: ['point'],
    previewBuilder: (cursor) => ({ kind: 'line', p1, cursor }),
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
