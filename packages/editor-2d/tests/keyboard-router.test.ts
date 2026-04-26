import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerKeyboardRouter, unregisterKeyboardRouterForTests } from '../src/keyboard/router';
import { lookupShortcut } from '../src/keyboard/shortcuts';
import { editorUiActions, editorUiStore, resetEditorUiStoreForTests } from '../src/ui-state/store';

interface RouterMocks {
  onActivateTool: ReturnType<typeof vi.fn>;
  onUndo: ReturnType<typeof vi.fn>;
  onRedo: ReturnType<typeof vi.fn>;
  onAbortCurrentTool: ReturnType<typeof vi.fn>;
  onCommitCurrentTool: ReturnType<typeof vi.fn>;
}

let mocks: RouterMocks;

function pressKey(key: string, opts: KeyboardEventInit = {}): void {
  const evt = new KeyboardEvent('keydown', { key, bubbles: true, ...opts });
  window.dispatchEvent(evt);
}

beforeEach(() => {
  resetEditorUiStoreForTests();
  mocks = {
    onActivateTool: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onAbortCurrentTool: vi.fn(),
    onCommitCurrentTool: vi.fn(),
  };
  registerKeyboardRouter(mocks);
});

afterEach(() => {
  unregisterKeyboardRouterForTests();
});

describe('keyboard router', () => {
  it('F3 toggles osnap regardless of focus holder', () => {
    const before = editorUiStore.getState().toggles.osnap;
    editorUiActions.setFocusHolder('canvas');
    pressKey('F3');
    expect(editorUiStore.getState().toggles.osnap).toBe(!before);
    editorUiActions.setFocusHolder('bar');
    pressKey('F3');
    expect(editorUiStore.getState().toggles.osnap).toBe(before);
  });

  it('Ctrl+Z calls onUndo; Ctrl+Shift+Z calls onRedo', () => {
    pressKey('z', { ctrlKey: true });
    expect(mocks.onUndo).toHaveBeenCalledTimes(1);
    pressKey('z', { ctrlKey: true, shiftKey: true });
    expect(mocks.onRedo).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Y also calls onRedo', () => {
    pressKey('y', { ctrlKey: true });
    expect(mocks.onRedo).toHaveBeenCalledTimes(1);
  });

  it('Escape aborts current tool and returns focus to canvas', () => {
    editorUiActions.setFocusHolder('bar');
    pressKey('Escape');
    expect(mocks.onAbortCurrentTool).toHaveBeenCalled();
    expect(editorUiStore.getState().focusHolder).toBe('canvas');
  });

  it('single-letter "L" with canvas focus activates draw-line', async () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('L');
    // Wait for accumulator timeout.
    await new Promise((r) => setTimeout(r, 800));
    expect(mocks.onActivateTool).toHaveBeenCalledWith('draw-line');
  });

  it('multi-letter "P" then "L" within timeout activates draw-polyline', async () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('P');
    pressKey('L');
    await new Promise((r) => setTimeout(r, 800));
    expect(mocks.onActivateTool).toHaveBeenCalledWith('draw-polyline');
  });

  it('"L" without further input falls back to single-letter draw-line', async () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('L');
    await new Promise((r) => setTimeout(r, 800));
    expect(mocks.onActivateTool).toHaveBeenCalledWith('draw-line');
  });

  it('letter keys in bar focus do NOT route through accumulator', async () => {
    editorUiActions.setFocusHolder('bar');
    pressKey('L');
    await new Promise((r) => setTimeout(r, 800));
    expect(mocks.onActivateTool).not.toHaveBeenCalled();
  });

  it('Delete in canvas focus activates erase', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('Delete');
    expect(mocks.onActivateTool).toHaveBeenCalledWith('erase');
  });

  it('Enter on canvas focus calls onCommitCurrentTool (commit, not abort)', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('Enter');
    expect(mocks.onCommitCurrentTool).toHaveBeenCalledTimes(1);
    expect(mocks.onAbortCurrentTool).not.toHaveBeenCalled();
  });

  it('Enter on bar focus does NOT call onCommitCurrentTool (form Enter wins)', () => {
    editorUiActions.setFocusHolder('bar');
    pressKey('Enter');
    expect(mocks.onCommitCurrentTool).not.toHaveBeenCalled();
  });
});

describe('shortcut lookup', () => {
  it('all M1.3a draw-tool literals resolve', () => {
    expect(lookupShortcut('PT')).toBe('draw-point');
    expect(lookupShortcut('L')).toBe('draw-line');
    expect(lookupShortcut('PL')).toBe('draw-polyline');
    expect(lookupShortcut('REC')).toBe('draw-rectangle');
    expect(lookupShortcut('CC')).toBe('draw-circle');
    expect(lookupShortcut('A')).toBe('draw-arc');
    expect(lookupShortcut('XL')).toBe('draw-xline');
    expect(lookupShortcut('XX')).toBe('draw-xline');
  });
});
