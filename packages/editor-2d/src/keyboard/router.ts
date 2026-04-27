// Window-level keyboard router. Single addEventListener registration
// (Gate 11.3 enforces). Routes by focus holder + key class.
//
// Bypass keys (F-keys, Ctrl+Z/Y, Escape) handle identically across
// focus holders (I-32). Letter keys route to canvas (tool activation)
// or bar (input accumulation) per focus holder.
//
// Multi-letter shortcuts (LA, PT, PL, REC, CC, XL, XX) resolve via a
// 750 ms accumulator (I-34) — typing a prefix waits for either the
// next letter or timeout.

import { editorUiActions, editorUiStore } from '../ui-state/store';
import { type ToolId, isMultiLetterPrefix, lookupShortcut } from './shortcuts';

export interface KeyboardRouterCallbacks {
  onActivateTool: (id: ToolId) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAbortCurrentTool: () => void;
  /** Enter on canvas focus — commit the in-flight tool (e.g. end an
   *  open polyline). Distinct from `onAbortCurrentTool` (Escape). */
  onCommitCurrentTool: () => void;
  /** Letter typed on canvas focus that matches a sub-option shortcut of
   *  the currently running tool (e.g. `c` for [Close] in polyline).
   *  Beats tool-activation accumulator so the in-flight tool keeps
   *  control. Routed by EditorRoot to a `subOption` Input. */
  onSubOption: (label: string) => void;
  /** F7 — toggle the cursor crosshair size between full-canvas (100%)
   *  and pickbox (5%) presets. M1.3d Phase 8. EditorRoot owns the
   *  toggle behaviour; the router just fires the callback. */
  onToggleCrosshair: () => void;
  /** M1.3d-Remediation-3 F6 — Spacebar at canvas focus when no tool is
   *  active re-invokes the most recently completed user-tool. EditorRoot
   *  reads `editorUiStore.commandBar.lastToolId` and re-activates it. */
  onRepeatLastCommand: () => void;
}

const ACCUMULATOR_TIMEOUT_MS = 750;

let registered = false;
let cleanup: (() => void) | null = null;

export function registerKeyboardRouter(callbacks: KeyboardRouterCallbacks): () => void {
  // Idempotent re-register (Phase 22 / I-65). React 19 StrictMode
  // double-invokes effects, and per-test mounts in the smoke E2E suite
  // remount EditorRoot many times. If a router is already registered,
  // call its cleanup first then proceed to register the new one.
  if (registered && cleanup) {
    cleanup();
  }
  registered = true;

  let accumulator = '';
  let accumulatorTimer: ReturnType<typeof setTimeout> | null = null;

  function flushAccumulator(): void {
    if (accumulator.length > 0) {
      const tool = lookupShortcut(accumulator);
      if (tool) callbacks.onActivateTool(tool);
    }
    accumulator = '';
    if (accumulatorTimer !== null) {
      clearTimeout(accumulatorTimer);
      accumulatorTimer = null;
    }
  }

  function pumpAccumulator(letter: string): void {
    accumulator += letter.toUpperCase();
    if (accumulatorTimer !== null) clearTimeout(accumulatorTimer);
    const exact = lookupShortcut(accumulator);
    const couldExtend = isMultiLetterPrefix(accumulator);
    if (exact && !couldExtend) {
      flushAccumulator();
      return;
    }
    accumulatorTimer = setTimeout(flushAccumulator, ACCUMULATOR_TIMEOUT_MS);
  }

  const handler = (e: KeyboardEvent): void => {
    const focus = editorUiStore.getState().focusHolder;
    const key = e.key;

    // Bypass keys — handle identically regardless of focus.
    if (key === 'F3') {
      e.preventDefault();
      editorUiActions.toggleOsnap();
      return;
    }
    if (key === 'F8') {
      e.preventDefault();
      editorUiActions.toggleOrtho();
      return;
    }
    if (key === 'F9') {
      e.preventDefault();
      editorUiActions.toggleGsnap();
      return;
    }
    if (key === 'F12') {
      e.preventDefault();
      editorUiActions.toggleDynamicInput();
      return;
    }
    if (key === 'F7') {
      e.preventDefault();
      callbacks.onToggleCrosshair();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (key === 'z' || key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) callbacks.onRedo();
      else callbacks.onUndo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (key === 'y' || key === 'Y')) {
      e.preventDefault();
      callbacks.onRedo();
      return;
    }
    if (key === 'Escape') {
      flushAccumulator();
      callbacks.onAbortCurrentTool();
      editorUiActions.setFocusHolder('canvas');
      return;
    }
    if (key === 'Enter' && focus === 'canvas') {
      // Enter on canvas focus = commit in-flight tool (end open polyline,
      // etc.). Bar focus has its own Enter via the form's onSubmit.
      e.preventDefault();
      flushAccumulator();
      callbacks.onCommitCurrentTool();
      return;
    }
    // M1.3d-Remediation-3 F6 — Spacebar at canvas focus mirrors Enter:
    //   - Active tool → commit (same as Enter).
    //   - No active tool → re-invoke last user-tool (via lastToolId).
    // Bar focus: native input handles space (typing a literal space
    // character); we don't intercept. Same per-focus pattern as letter
    // routing below.
    if (key === ' ' && focus === 'canvas') {
      e.preventDefault();
      flushAccumulator();
      const activeId = editorUiStore.getState().activeToolId;
      if (activeId !== null) {
        callbacks.onCommitCurrentTool();
      } else {
        callbacks.onRepeatLastCommand();
      }
      return;
    }
    if (key === 'Delete' && focus === 'canvas') {
      e.preventDefault();
      callbacks.onActivateTool('erase');
      return;
    }

    // Per-focus letter routing.
    if (focus === 'canvas' && /^[A-Za-z]$/.test(key)) {
      // CAD convention: while a tool is running and showing bracketed
      // sub-options like [Close/Undo], typing the shortcut letter (c, u)
      // triggers the sub-option directly. This beats the tool-activation
      // accumulator — otherwise typing `c` mid-polyline would activate
      // Copy and abort the polyline. See draw-polyline.ts sub-options.
      const uiState = editorUiStore.getState();
      if (uiState.activeToolId !== null && uiState.commandBar.subOptions.length > 0) {
        const lower = key.toLowerCase();
        const match = uiState.commandBar.subOptions.find((o) => o.shortcut.toLowerCase() === lower);
        if (match) {
          e.preventDefault();
          callbacks.onSubOption(match.label);
          return;
        }
      }
      pumpAccumulator(key);
      return;
    }
    // Bar / dialog focus: native input handles letters; we don't
    // intercept here. The bar component consumes its own keystrokes.
  };

  // M1.3d-Remediation-3 F2 — global Shift modifier tracking. Updates
  // editorUiStore.modifiers.shift on keydown/keyup. The `blur` listener
  // resets to false to handle the "user holds shift, alt-tabs out,
  // releases shift outside the window" edge case where keyup never
  // fires inside the app and the slice would otherwise stay stuck at
  // true. draw-rectangle reads modifiers.shift for the F2 square
  // constraint; future tools / modifiers extend the same slice.
  const shiftKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Shift') editorUiActions.setShift(true);
  };
  const shiftKeyup = (e: KeyboardEvent): void => {
    if (e.key === 'Shift') editorUiActions.setShift(false);
  };
  const windowBlur = (): void => {
    editorUiActions.setShift(false);
  };

  window.addEventListener('keydown', handler);
  window.addEventListener('keydown', shiftKeydown);
  window.addEventListener('keyup', shiftKeyup);
  window.addEventListener('blur', windowBlur);
  cleanup = () => {
    window.removeEventListener('keydown', handler);
    window.removeEventListener('keydown', shiftKeydown);
    window.removeEventListener('keyup', shiftKeyup);
    window.removeEventListener('blur', windowBlur);
    if (accumulatorTimer !== null) clearTimeout(accumulatorTimer);
    registered = false;
    cleanup = null;
  };
  return cleanup;
}

export function unregisterKeyboardRouterForTests(): void {
  if (cleanup) cleanup();
}
