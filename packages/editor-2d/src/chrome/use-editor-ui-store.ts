// React selector hook over the editor-2d UI state store. Lives in
// chrome/ (React-allowed). Mirrors the @portplanner/project-store-react
// pattern.

import { useSyncExternalStore } from 'react';

import { type EditorUiState, editorUiStore } from '../ui-state/store';

export function useEditorUi<T>(selector: (s: EditorUiState) => T): T {
  return useSyncExternalStore(
    editorUiStore.subscribe,
    () => selector(editorUiStore.getState()),
    () => selector(editorUiStore.getState()),
  );
}
