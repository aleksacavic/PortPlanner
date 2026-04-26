// Select tool — single-pick selection. Multi-pick + window-select
// are M1.3b refinements; M1.3a ships single-click pick.

import { editorUiActions } from '../ui-state/store';
import type { ToolGenerator } from './types';

export async function* selectTool(): ToolGenerator {
  const input = yield {
    text: 'Select objects',
    acceptedInputKinds: ['entity', 'point'],
  };
  if (input.kind === 'entity') {
    editorUiActions.setSelection([input.entityId as never]);
    return { committed: true, description: `selected ${input.entityId}` };
  }
  if (input.kind === 'point') {
    editorUiActions.setSelection([]);
    return { committed: true, description: 'cleared selection' };
  }
  return { committed: false, reason: 'aborted' };
}
