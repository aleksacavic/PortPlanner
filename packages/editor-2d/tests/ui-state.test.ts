import { afterEach, describe, expect, it } from 'vitest';

import {
  HISTORY_CAP,
  editorUiActions,
  editorUiStore,
  resetEditorUiStoreForTests,
} from '../src/ui-state/store';

describe('editorUiStore', () => {
  afterEach(() => resetEditorUiStoreForTests());

  it('focus holder is canvas by default and can be set', () => {
    expect(editorUiStore.getState().focusHolder).toBe('canvas');
    editorUiActions.setFocusHolder('bar');
    expect(editorUiStore.getState().focusHolder).toBe('bar');
  });

  it('pushFocusAndSet/popFocus stack restores prior holder', () => {
    expect(editorUiStore.getState().focusHolder).toBe('canvas');
    editorUiActions.pushFocusAndSet('dialog');
    expect(editorUiStore.getState().focusHolder).toBe('dialog');
    editorUiActions.popFocus();
    expect(editorUiStore.getState().focusHolder).toBe('canvas');
  });

  it('toggle actions flip toggle states', () => {
    const before = editorUiStore.getState().toggles.osnap;
    editorUiActions.toggleOsnap();
    expect(editorUiStore.getState().toggles.osnap).toBe(!before);
  });

  it('command-bar history caps at HISTORY_CAP', () => {
    for (let i = 0; i < HISTORY_CAP + 50; i++) {
      editorUiActions.appendHistory({ role: 'input', text: `${i}`, timestamp: '' });
    }
    expect(editorUiStore.getState().commandBar.history).toHaveLength(HISTORY_CAP);
  });

  it('setPrompt resets inputBuffer and updates subOptions', () => {
    editorUiActions.setInputBuffer('typed');
    editorUiActions.setPrompt('Specify base point', [{ label: 'Reference', shortcut: 'r' }], '0');
    const cb = editorUiStore.getState().commandBar;
    expect(cb.activePrompt).toBe('Specify base point');
    expect(cb.subOptions).toHaveLength(1);
    expect(cb.defaultValue).toBe('0');
    expect(cb.inputBuffer).toBe('');
  });
});
