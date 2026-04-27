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
  onSubOption: ReturnType<typeof vi.fn>;
  onToggleCrosshair: ReturnType<typeof vi.fn>;
  onRepeatLastCommand: ReturnType<typeof vi.fn>;
  onSubmitBuffer: ReturnType<typeof vi.fn>;
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
    onSubOption: vi.fn(),
    onToggleCrosshair: vi.fn(),
    onRepeatLastCommand: vi.fn(),
    onSubmitBuffer: vi.fn(),
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

  // M1.3d-Rem-4 G1 (AC mode): letters silently accumulate; Enter or
  // Space activates. The pre-Rem-4 auto-flush-on-exact-match has been
  // removed (it blocked `MI` for Mirror, etc.).
  it('single-letter "L" with canvas focus + Enter activates draw-line', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('L');
    expect(mocks.onActivateTool).not.toHaveBeenCalled();
    pressKey('Enter');
    expect(mocks.onActivateTool).toHaveBeenCalledWith('draw-line');
  });

  it('multi-letter "P" then "L" + Enter activates draw-polyline (no timeout race)', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('P');
    pressKey('L');
    expect(mocks.onActivateTool).not.toHaveBeenCalled();
    pressKey('Enter');
    expect(mocks.onActivateTool).toHaveBeenCalledWith('draw-polyline');
  });

  it('Space at canvas focus also activates the accumulated tool', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('L');
    pressKey(' ');
    expect(mocks.onActivateTool).toHaveBeenCalledWith('draw-line');
  });

  it('letter keys in bar focus do NOT route through accumulator', () => {
    editorUiActions.setFocusHolder('bar');
    pressKey('L');
    pressKey('Enter');
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

  it('sub-option shortcut letter routes to onSubOption (not tool activation) while a tool is running', () => {
    editorUiActions.setFocusHolder('canvas');
    // Simulate a polyline tool being active with [Close/Undo] sub-options.
    editorUiActions.setActiveToolId('draw-polyline');
    editorUiActions.setPrompt('Specify next point or [Close/Undo]', [
      { label: 'Close', shortcut: 'c' },
      { label: 'Undo', shortcut: 'u' },
    ]);
    pressKey('c');
    expect(mocks.onSubOption).toHaveBeenCalledWith('Close');
    // Critical: typing 'c' must NOT activate the Copy tool while polyline
    // is running with [Close/Undo] exposed. Under G1, this would also
    // not activate via auto-flush — so just assert the mock state directly.
    expect(mocks.onActivateTool).not.toHaveBeenCalledWith('copy');
  });

  it('sub-option keyboard works case-insensitively', () => {
    editorUiActions.setFocusHolder('canvas');
    editorUiActions.setActiveToolId('draw-polyline');
    editorUiActions.setPrompt('Specify next point or [Close/Undo]', [
      { label: 'Close', shortcut: 'c' },
      { label: 'Undo', shortcut: 'u' },
    ]);
    pressKey('U');
    expect(mocks.onSubOption).toHaveBeenCalledWith('Undo');
  });

  it('letter keys still activate tools when no sub-options are exposed (now via Enter)', () => {
    editorUiActions.setFocusHolder('canvas');
    // No active tool, no sub-options → 'C' + Enter should activate the
    // Copy tool. Regression guard for the sub-option fast-path under G1.
    pressKey('C');
    pressKey('Enter');
    expect(mocks.onActivateTool).toHaveBeenCalledWith('copy');
    expect(mocks.onSubOption).not.toHaveBeenCalled();
  });

  // M1.3d Phase 8 — F7 toggle-crosshair (I-DTP-20).
  it('F7 fires onToggleCrosshair regardless of focus holder', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('F7');
    expect(mocks.onToggleCrosshair).toHaveBeenCalledTimes(1);
    editorUiActions.setFocusHolder('bar');
    pressKey('F7');
    expect(mocks.onToggleCrosshair).toHaveBeenCalledTimes(2);
    editorUiActions.setFocusHolder('dialog');
    pressKey('F7');
    expect(mocks.onToggleCrosshair).toHaveBeenCalledTimes(3);
  });
});

// M1.3d-Remediation-3 F2 — global Shift modifier tracking via window
// keydown / keyup / blur listeners.
describe('keyboard router — F2 Shift modifier tracking', () => {
  it('Shift keydown sets modifiers.shift = true', () => {
    expect(editorUiStore.getState().modifiers.shift).toBe(false);
    pressKey('Shift');
    expect(editorUiStore.getState().modifiers.shift).toBe(true);
  });

  it('Shift keyup sets modifiers.shift = false', () => {
    pressKey('Shift'); // keydown
    expect(editorUiStore.getState().modifiers.shift).toBe(true);
    const keyup = new KeyboardEvent('keyup', { key: 'Shift', bubbles: true });
    window.dispatchEvent(keyup);
    expect(editorUiStore.getState().modifiers.shift).toBe(false);
  });

  it('window blur clears modifiers.shift (alt-tab-with-shift-held lifecycle)', () => {
    pressKey('Shift');
    expect(editorUiStore.getState().modifiers.shift).toBe(true);
    const blurEvt = new Event('blur');
    window.dispatchEvent(blurEvt);
    expect(editorUiStore.getState().modifiers.shift).toBe(false);
  });

  it('non-Shift keys do NOT toggle modifiers.shift', () => {
    pressKey('A');
    expect(editorUiStore.getState().modifiers.shift).toBe(false);
  });
});

// M1.3d-Remediation-3 F6 — Spacebar at canvas focus mirrors Enter:
//   - Active tool → onCommitCurrentTool
//   - No active tool → onRepeatLastCommand
// Bar focus → no callback fires (native input handles space).
describe('keyboard router — F6 Spacebar repeat-last-command', () => {
  it('Space at canvas focus + active tool → onCommitCurrentTool', () => {
    editorUiActions.setFocusHolder('canvas');
    editorUiActions.setActiveToolId('draw-line');
    pressKey(' ');
    expect(mocks.onCommitCurrentTool).toHaveBeenCalledTimes(1);
    expect(mocks.onRepeatLastCommand).not.toHaveBeenCalled();
  });

  it('Space at canvas focus + no active tool → onRepeatLastCommand', () => {
    editorUiActions.setFocusHolder('canvas');
    editorUiActions.setActiveToolId(null);
    pressKey(' ');
    expect(mocks.onRepeatLastCommand).toHaveBeenCalledTimes(1);
    expect(mocks.onCommitCurrentTool).not.toHaveBeenCalled();
  });

  it('Space at bar focus → neither callback fires (native input handles)', () => {
    editorUiActions.setFocusHolder('bar');
    pressKey(' ');
    expect(mocks.onRepeatLastCommand).not.toHaveBeenCalled();
    expect(mocks.onCommitCurrentTool).not.toHaveBeenCalled();
  });
});

// M1.3d-Remediation-4 G1 — AC-mode accumulator. Letters silently
// accumulate; Enter or Space activates; Escape clears; 750 ms idle
// silently clears (no activation).
describe('keyboard router — G1 AC-mode accumulator', () => {
  it('letter alone does NOT activate without Enter or Space', async () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('L');
    // Wait briefly to confirm no immediate fire.
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.onActivateTool).not.toHaveBeenCalled();
    // Accumulator IS published to store so the pill can render it.
    expect(editorUiStore.getState().commandBar.accumulator).toBe('L');
  });

  it('Enter at canvas focus + accumulator non-empty → activates the accumulated tool', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('R');
    pressKey('E');
    pressKey('C');
    pressKey('Enter');
    expect(mocks.onActivateTool).toHaveBeenCalledWith('draw-rectangle');
    expect(editorUiStore.getState().commandBar.accumulator).toBe('');
  });

  it('Space at canvas focus + accumulator non-empty → activates the accumulated tool', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('L');
    pressKey('A');
    pressKey(' ');
    expect(mocks.onActivateTool).toHaveBeenCalledWith('layer-manager');
  });

  it('Escape clears accumulator without activating', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('L');
    expect(editorUiStore.getState().commandBar.accumulator).toBe('L');
    pressKey('Escape');
    expect(mocks.onActivateTool).not.toHaveBeenCalled();
    expect(editorUiStore.getState().commandBar.accumulator).toBe('');
  });

  it('Escape clears inputBuffer too (G2 stream)', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('5');
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('5');
    pressKey('Escape');
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('');
  });

  // M1.3d-Rem-5 H2 — accumulator persists indefinitely (no idle
  // timeout). User: "if i type L it should wait for me indefinitely,
  // this is how AC works." The Dynamic Input pill (G2) is the visible
  // safety net.
  it('accumulator persists across long idle periods (no timeout in AC mode)', async () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('L');
    expect(editorUiStore.getState().commandBar.accumulator).toBe('L');
    // Wait well past the OLD 750 ms timeout window — the accumulator
    // MUST still hold 'L' and no activation must have fired.
    await new Promise((r) => setTimeout(r, 1100));
    expect(mocks.onActivateTool).not.toHaveBeenCalled();
    expect(editorUiStore.getState().commandBar.accumulator).toBe('L');
    // Now Enter activates — confirming the accumulator was still live.
    pressKey('Enter');
    expect(mocks.onActivateTool).toHaveBeenCalledWith('draw-line');
    expect(editorUiStore.getState().commandBar.accumulator).toBe('');
  });
});

// M1.3d-Remediation-4 G2 — Numeric / punctuation routing at canvas
// focus into commandBar.inputBuffer. Letters keep going through the
// accumulator (separate stream).
describe('keyboard router — G2 numeric / punctuation routing', () => {
  it('digit at canvas focus appends to inputBuffer', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('5');
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('5');
    pressKey('3');
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('53');
  });

  it('comma + minus + dot at canvas focus append to inputBuffer', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('-');
    pressKey('5');
    pressKey('.');
    pressKey('2');
    pressKey(',');
    pressKey('3');
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('-5.2,3');
  });

  it('Backspace at canvas focus pops the last char from inputBuffer', () => {
    editorUiActions.setFocusHolder('canvas');
    editorUiActions.setInputBuffer('123');
    pressKey('Backspace');
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('12');
  });

  it('Backspace when inputBuffer empty is a no-op (still preventDefaults — H2 fix)', () => {
    editorUiActions.setFocusHolder('canvas');
    editorUiActions.setInputBuffer('');
    pressKey('Backspace');
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('');
  });

  it('Backspace at canvas focus always preventDefaults (suppresses browser back-navigation)', () => {
    editorUiActions.setFocusHolder('canvas');
    editorUiActions.setInputBuffer('5');
    const evt = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    window.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
  });

  it('Backspace at canvas focus when inputBuffer empty also preventDefaults', () => {
    editorUiActions.setFocusHolder('canvas');
    editorUiActions.setInputBuffer('');
    const evt = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    window.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
  });

  it('Enter at canvas focus + inputBuffer non-empty + tool active → onSubmitBuffer fires with buffer contents', () => {
    editorUiActions.setFocusHolder('canvas');
    editorUiActions.setActiveToolId('draw-line');
    editorUiActions.setInputBuffer('5');
    pressKey('Enter');
    expect(mocks.onSubmitBuffer).toHaveBeenCalledWith('5');
    expect(mocks.onCommitCurrentTool).not.toHaveBeenCalled();
  });

  it('digit at bar focus does NOT append to inputBuffer via router (bar input handles its own onChange)', () => {
    editorUiActions.setFocusHolder('bar');
    editorUiActions.setInputBuffer('');
    pressKey('5');
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('');
  });
});

// M1.3d-Remediation-4 Rev-1 H1 — Enter/Space precedence (A10b).
// inputBuffer-submit wins over accumulator-flush when both are non-empty.
describe('keyboard router — Rev-1 H1 precedence policy', () => {
  it('both buffers non-empty: Enter prefers inputBuffer over accumulator', () => {
    editorUiActions.setFocusHolder('canvas');
    editorUiActions.setActiveToolId('draw-line');
    editorUiActions.setAccumulator('REC');
    editorUiActions.setInputBuffer('5');
    pressKey('Enter');
    expect(mocks.onSubmitBuffer).toHaveBeenCalledWith('5');
    expect(mocks.onActivateTool).not.toHaveBeenCalled();
  });

  it('Enter at canvas focus + inputBuffer non-empty + no tool active → buffer cleared silently (R2-C2 follow-up)', () => {
    editorUiActions.setFocusHolder('canvas');
    editorUiActions.setActiveToolId(null);
    editorUiActions.setInputBuffer('5');
    pressKey('Enter');
    // No submit fires (no tool to consume), but the buffer is cleared.
    expect(mocks.onSubmitBuffer).not.toHaveBeenCalled();
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('');
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
