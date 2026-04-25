import { editorUiActions, editorUiStore } from '../ui-state/store';
import type { ToolGenerator } from './types';

export async function* zoomTool(): ToolGenerator {
  const input = yield {
    text: 'Specify zoom or sub-option',
    subOptions: [
      { label: 'Extents', shortcut: 'e' },
      { label: 'Window', shortcut: 'w' },
      { label: 'Previous', shortcut: 'p' },
    ],
    acceptedInputKinds: ['point', 'subOption', 'number'],
  };

  if (input.kind === 'subOption' && input.optionLabel === 'Extents') {
    // Stub: M1.3b will compute actual extents from project content.
    editorUiActions.setViewport({ panX: 0, panY: 0, zoom: 10 });
    return { committed: true, description: 'zoom extents' };
  }
  if (input.kind === 'subOption' && input.optionLabel === 'Window') {
    return { committed: true, description: 'zoom window (stub)' };
  }
  if (input.kind === 'subOption' && input.optionLabel === 'Previous') {
    return { committed: true, description: 'zoom previous (stub)' };
  }
  if (input.kind === 'number') {
    const v = editorUiStore.getState().viewport;
    editorUiActions.setViewport({ zoom: v.zoom * input.value });
    return { committed: true, description: `zoom ×${input.value}` };
  }
  return { committed: false, reason: 'aborted' };
}
