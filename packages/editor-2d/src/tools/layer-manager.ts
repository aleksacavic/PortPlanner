import { editorUiActions } from '../ui-state/store';
import type { ToolGenerator } from './types';

export async function* layerManagerTool(): ToolGenerator {
  editorUiActions.pushFocusAndSet('dialog');
  return { committed: true, description: 'layer manager opened' };
}
