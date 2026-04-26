import type { PrimitiveId } from '@portplanner/domain';
import { deletePrimitive } from '@portplanner/project-store';

import { editorUiActions, editorUiStore } from '../ui-state/store';
import type { ToolGenerator } from './types';

export async function* eraseTool(): ToolGenerator {
  const selection = editorUiStore.getState().selection;
  if (selection.length === 0) {
    const input = yield {
      text: 'Select objects to erase',
      acceptedInputKinds: ['entity'],
    };
    if (input.kind !== 'entity') return { committed: false, reason: 'aborted' };
    deletePrimitive(input.entityId as PrimitiveId);
    editorUiActions.setSelection([]);
    return { committed: true, description: `erased ${input.entityId}` };
  }
  for (const id of selection) deletePrimitive(id);
  editorUiActions.setSelection([]);
  return { committed: true, description: `erased ${selection.length} entities` };
}
