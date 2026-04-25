import { editorUiActions } from '../ui-state/store';
import type { ToolGenerator } from './types';

export async function* propertiesTool(): ToolGenerator {
  // Open the Properties panel (focus → dialog so keyboard routes there).
  editorUiActions.pushFocusAndSet('dialog');
  return { committed: true, description: 'properties panel opened' };
}
