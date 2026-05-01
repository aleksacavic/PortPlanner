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
  onSubmitDynamicInput: ReturnType<typeof vi.fn>;
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
    onSubmitDynamicInput: vi.fn(),
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

  // M1.3b simple-transforms Phase 6 — router activation tests for the 4
  // new modify operators (R / MI / SC / O).
  it('activates rotate via R shortcut', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('R');
    pressKey('Enter');
    expect(mocks.onActivateTool).toHaveBeenCalledWith('rotate');
  });

  it('activates mirror via MI shortcut', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('M');
    pressKey('I');
    pressKey('Enter');
    expect(mocks.onActivateTool).toHaveBeenCalledWith('mirror');
  });

  it('activates scale via SC shortcut', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('S');
    pressKey('C');
    pressKey('Enter');
    expect(mocks.onActivateTool).toHaveBeenCalledWith('scale');
  });

  it('activates offset via O shortcut', () => {
    editorUiActions.setFocusHolder('canvas');
    pressKey('O');
    pressKey('Enter');
    expect(mocks.onActivateTool).toHaveBeenCalledWith('offset');
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

// M1.3 Round 6 — Dynamic Input router branches per plan §11.
// Tab cycles activeFieldIdx; numeric/Backspace route to active DI field
// when manifest is active; Enter invokes onSubmitDynamicInput.
describe('keyboard router — M1.3 Round 6 Dynamic Input', () => {
  function activateDIManifest(): void {
    editorUiActions.setDynamicInputManifest({
      fields: [
        { kind: 'distance', label: 'D' },
        { kind: 'angle', label: 'A' },
      ],
      combineAs: 'point',
    });
    editorUiActions.setActiveToolId('draw-line');
    editorUiActions.setFocusHolder('canvas');
  }

  it('Tab cycles activeFieldIdx forward (with DI manifest active)', () => {
    activateDIManifest();
    expect(editorUiStore.getState().commandBar.dynamicInput?.activeFieldIdx).toBe(0);
    pressKey('Tab');
    expect(editorUiStore.getState().commandBar.dynamicInput?.activeFieldIdx).toBe(1);
    pressKey('Tab');
    // Wraps modulo field-count (2 fields → 1 → 0).
    expect(editorUiStore.getState().commandBar.dynamicInput?.activeFieldIdx).toBe(0);
  });

  it('Shift+Tab cycles activeFieldIdx backward', () => {
    activateDIManifest();
    pressKey('Tab', { shiftKey: true });
    expect(editorUiStore.getState().commandBar.dynamicInput?.activeFieldIdx).toBe(1);
  });

  it('Numeric keys route to dynamicInput.buffers[activeFieldIdx] (NOT inputBuffer)', () => {
    activateDIManifest();
    pressKey('5');
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers).toEqual(['5', '']);
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('');
    // Tab to next field then type.
    pressKey('Tab');
    pressKey('3');
    pressKey('0');
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers).toEqual(['5', '30']);
  });

  it('Backspace pops from active field buffer (when DI active)', () => {
    activateDIManifest();
    pressKey('5');
    pressKey('5');
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers[0]).toBe('55');
    pressKey('Backspace');
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers[0]).toBe('5');
  });

  it('Enter at canvas focus + DI active → onSubmitDynamicInput (DI submit takes precedence over inputBuffer submit)', () => {
    activateDIManifest();
    pressKey('5');
    pressKey('Tab');
    pressKey('3');
    pressKey('0');
    pressKey('Enter');
    expect(mocks.onSubmitDynamicInput).toHaveBeenCalledTimes(1);
    expect(mocks.onSubmitDynamicInput).toHaveBeenCalledWith(
      expect.objectContaining({ combineAs: 'point' }),
      ['5', '30'],
    );
    // onSubmitBuffer NOT called — DI takes precedence.
    expect(mocks.onSubmitBuffer).not.toHaveBeenCalled();
  });

  it('Esc clears DI buffers (in addition to existing inputBuffer + accumulator)', () => {
    activateDIManifest();
    pressKey('5');
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers[0]).toBe('5');
    pressKey('Escape');
    expect(editorUiStore.getState().commandBar.dynamicInput).toBeNull();
  });

  it('Tab passes through (no DI active) — does NOT preventDefault, no slice mutation', () => {
    // No DI manifest set; activeFieldIdx is null.
    expect(editorUiStore.getState().commandBar.dynamicInput).toBeNull();
    pressKey('Tab');
    // No DI to mutate; the test merely asserts no throw + no DI side effect.
    expect(editorUiStore.getState().commandBar.dynamicInput).toBeNull();
  });
});

// M1.3 DI pipeline overhaul Phase 3 (B7) — Tab lock-on-typed +
// auto-submit + two-step Esc semantics. Plan invariants I-DI-4 / I-DI-5 / I-DI-6.
describe('keyboard router — M1.3 DI pipeline overhaul Phase 3 (B7)', () => {
  function activateDIManifest(): void {
    editorUiActions.setDynamicInputManifest(
      {
        fields: [
          { kind: 'distance', label: 'D' },
          { kind: 'angle', label: 'A' },
        ],
        combineAs: 'point',
      },
      'draw-line:0',
    );
    editorUiActions.setActiveToolId('draw-line');
    editorUiActions.setFocusHolder('canvas');
  }

  it('Tab on a typed field locks it before cycling (I-DI-4)', () => {
    activateDIManifest();
    pressKey('5');
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers[0]).toBe('5');
    pressKey('Tab');
    // Field 0 typed → locked; cycled to field 1.
    expect(editorUiStore.getState().commandBar.dynamicInput?.locked).toEqual([true, false]);
    expect(editorUiStore.getState().commandBar.dynamicInput?.activeFieldIdx).toBe(1);
  });

  it('Tab on an empty field just navigates (no lock per A2)', () => {
    activateDIManifest();
    // Don't type — buffer empty.
    pressKey('Tab');
    expect(editorUiStore.getState().commandBar.dynamicInput?.locked).toEqual([false, false]);
    expect(editorUiStore.getState().commandBar.dynamicInput?.activeFieldIdx).toBe(1);
  });

  it('Tab when all fields locked auto-submits via onSubmitDynamicInput (I-DI-5 / A18)', () => {
    activateDIManifest();
    pressKey('5');
    pressKey('Tab'); // locks field 0, cycles to field 1
    pressKey('3');
    pressKey('0');
    pressKey('Tab'); // locks field 1, cycles back to field 0; every(locked) → auto-submit
    expect(mocks.onSubmitDynamicInput).toHaveBeenCalledTimes(1);
    expect(mocks.onSubmitDynamicInput).toHaveBeenCalledWith(
      expect.objectContaining({ combineAs: 'point' }),
      ['5', '30'],
    );
  });

  it('Esc with any locked field → unlocks all (no abort) — first step of two-step Esc (I-DI-6)', () => {
    activateDIManifest();
    pressKey('5');
    pressKey('Tab'); // lock field 0
    expect(editorUiStore.getState().commandBar.dynamicInput?.locked).toEqual([true, false]);
    pressKey('Escape');
    // First Esc: unlock all; tool NOT aborted, manifest still active.
    expect(editorUiStore.getState().commandBar.dynamicInput?.locked).toEqual([false, false]);
    expect(editorUiStore.getState().commandBar.dynamicInput).not.toBeNull();
    expect(mocks.onAbortCurrentTool).not.toHaveBeenCalled();
  });

  it('Esc with no locked fields → existing abort semantics (clearDynamicInput + onAbortCurrentTool)', () => {
    activateDIManifest();
    expect(editorUiStore.getState().commandBar.dynamicInput?.locked).toEqual([false, false]);
    pressKey('Escape');
    // No fields locked → standard abort path: DI cleared + abort callback fires.
    expect(editorUiStore.getState().commandBar.dynamicInput).toBeNull();
    expect(mocks.onAbortCurrentTool).toHaveBeenCalledTimes(1);
  });

  it('Two-step Esc: first press unlocks; second press aborts', () => {
    activateDIManifest();
    pressKey('5');
    pressKey('Tab'); // lock field 0
    pressKey('Escape'); // first Esc: unlock all
    expect(editorUiStore.getState().commandBar.dynamicInput?.locked).toEqual([false, false]);
    expect(mocks.onAbortCurrentTool).not.toHaveBeenCalled();
    pressKey('Escape'); // second Esc: abort
    expect(editorUiStore.getState().commandBar.dynamicInput).toBeNull();
    expect(mocks.onAbortCurrentTool).toHaveBeenCalledTimes(1);
  });
});

// M1.3 DI pipeline overhaul Phase 4 (B8) — ArrowUp recall pill +
// recall precedence on Tab/Esc/Enter/Space. Plan invariants I-DI-10 + I-DI-12.
describe('keyboard router — M1.3 DI pipeline overhaul Phase 4 (B8)', () => {
  function activateDIManifestWithRecall(): void {
    // Seed a recall entry under the promptKey BEFORE publishing the
    // manifest so ArrowUp finds an entry to show.
    editorUiActions.recordSubmittedBuffers('draw-line:0', ['5', '30']);
    editorUiActions.setDynamicInputManifest(
      {
        fields: [
          { kind: 'distance', label: 'D' },
          { kind: 'angle', label: 'A' },
        ],
        combineAs: 'point',
      },
      'draw-line:0',
    );
    editorUiActions.setActiveToolId('draw-line');
    editorUiActions.setFocusHolder('canvas');
  }

  it('ArrowUp at canvas focus + DI active + recall entry exists → setRecallActive(true)', () => {
    activateDIManifestWithRecall();
    expect(editorUiStore.getState().commandBar.dynamicInput?.recallActive).toBe(false);
    pressKey('ArrowUp');
    expect(editorUiStore.getState().commandBar.dynamicInput?.recallActive).toBe(true);
  });

  it('ArrowUp with no recall entry under active promptKey → no-op', () => {
    // Activate manifest but DON'T seed recall.
    editorUiActions.setDynamicInputManifest(
      {
        fields: [
          { kind: 'distance', label: 'D' },
          { kind: 'angle', label: 'A' },
        ],
        combineAs: 'point',
      },
      'draw-line:0',
    );
    editorUiActions.setActiveToolId('draw-line');
    editorUiActions.setFocusHolder('canvas');
    pressKey('ArrowUp');
    expect(editorUiStore.getState().commandBar.dynamicInput?.recallActive).toBe(false);
  });

  it('ArrowDown when recallActive → setRecallActive(false)', () => {
    activateDIManifestWithRecall();
    pressKey('ArrowUp');
    expect(editorUiStore.getState().commandBar.dynamicInput?.recallActive).toBe(true);
    pressKey('ArrowDown');
    expect(editorUiStore.getState().commandBar.dynamicInput?.recallActive).toBe(false);
  });

  it('Tab during recall cancels recall (does NOT cycle / lock)', () => {
    activateDIManifestWithRecall();
    pressKey('ArrowUp');
    expect(editorUiStore.getState().commandBar.dynamicInput?.recallActive).toBe(true);
    const idxBefore = editorUiStore.getState().commandBar.dynamicInput?.activeFieldIdx;
    pressKey('Tab');
    expect(editorUiStore.getState().commandBar.dynamicInput?.recallActive).toBe(false);
    // activeFieldIdx unchanged — Tab cancelled recall instead of cycling.
    expect(editorUiStore.getState().commandBar.dynamicInput?.activeFieldIdx).toBe(idxBefore);
    expect(editorUiStore.getState().commandBar.dynamicInput?.locked).toEqual([false, false]);
  });

  it('Enter during recall commits at recalled buffers via onSubmitDynamicInput', () => {
    activateDIManifestWithRecall();
    pressKey('ArrowUp');
    pressKey('Enter');
    expect(mocks.onSubmitDynamicInput).toHaveBeenCalledTimes(1);
    expect(mocks.onSubmitDynamicInput).toHaveBeenCalledWith(
      expect.objectContaining({ combineAs: 'point' }),
      ['5', '30'], // recalled buffers, NOT the current empty buffers
    );
  });

  it('Esc precedence: recall > unlock > abort (I-DI-12)', () => {
    activateDIManifestWithRecall();
    // Type something + Tab to lock field 0, then ArrowUp → both
    // recallActive=true AND locked[0]=true coexist.
    pressKey('5');
    pressKey('Tab'); // locks field 0; activeFieldIdx now 1
    expect(editorUiStore.getState().commandBar.dynamicInput?.locked).toEqual([true, false]);
    pressKey('ArrowUp');
    expect(editorUiStore.getState().commandBar.dynamicInput?.recallActive).toBe(true);
    // First Esc: cancel recall (precedence 1). Locked still true.
    pressKey('Escape');
    expect(editorUiStore.getState().commandBar.dynamicInput?.recallActive).toBe(false);
    expect(editorUiStore.getState().commandBar.dynamicInput?.locked).toEqual([true, false]);
    expect(mocks.onAbortCurrentTool).not.toHaveBeenCalled();
    // Second Esc: unlock all (precedence 2).
    pressKey('Escape');
    expect(editorUiStore.getState().commandBar.dynamicInput?.locked).toEqual([false, false]);
    expect(mocks.onAbortCurrentTool).not.toHaveBeenCalled();
    // Third Esc: abort (precedence 3).
    pressKey('Escape');
    expect(editorUiStore.getState().commandBar.dynamicInput).toBeNull();
    expect(mocks.onAbortCurrentTool).toHaveBeenCalledTimes(1);
  });
});
