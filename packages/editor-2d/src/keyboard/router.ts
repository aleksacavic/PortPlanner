// Window-level keyboard router. Single addEventListener registration
// (Gate 11.3 enforces). Routes by focus holder + key class.
//
// Bypass keys (F-keys, Ctrl+Z/Y, Escape) handle identically across
// focus holders (I-32). Letter keys route to canvas (tool activation
// via accumulator) or bar (input accumulation) per focus holder.
//
// M1.3d-Remediation-4 G1 — AC-mode accumulator. Letters at canvas
// focus accumulate silently; Enter or Space activates the accumulated
// command. Escape clears. A 750 ms idle timeout silently clears the
// accumulator without activating (no stale state).
//
// M1.3d-Remediation-4 G2 — Numeric / punctuation / Backspace at canvas
// focus route into `commandBar.inputBuffer` so the Dynamic Input pill
// can echo what the user types. Stream separation: letters →
// accumulator, digits/punct → inputBuffer (matches AC). Enter at canvas
// focus + buffer non-empty + tool active → submit via `onSubmitBuffer`
// (parity with the bottom command line's form submit, with explicit
// history-append in EditorRoot per Rev-1 B1 fix).

import { editorUiActions, editorUiStore } from '../ui-state/store';
import { type ToolId, lookupShortcut } from './shortcuts';

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
  /** M1.3d-Remediation-4 G2 — submit the current `commandBar.inputBuffer`
   *  to the active tool. Fired when the user hits Enter or Space at
   *  canvas focus while the buffer has content AND a tool is active.
   *  EditorRoot routes through the same `handleCommandSubmit` path the
   *  bottom command line's form uses (so the F1 direct-distance
   *  transform applies uniformly), and explicitly appends to history
   *  to mirror CommandBar.tsx's bar-form onSubmit (Rev-1 B1 parity). */
  onSubmitBuffer: (raw: string) => void;
}

const ACCUMULATOR_TIMEOUT_MS = 750;
// M1.3d-Rem-4 G2 — keys that route into `commandBar.inputBuffer` at
// canvas focus. Explicit `0-9` form (NOT `\d`) per Gate REM4-G2b(a).
const INPUT_BUFFER_KEY_RE = /^[0-9.,\-]$/;

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

  // M1.3d-Rem-4 G1 — clear the accumulator silently (no activation).
  // Used by the 750 ms idle timeout, by Escape, and at the tail of
  // `flushAccumulatorAndActivate`. Mirrors the cleared state into the
  // store so the Dynamic Input pill (G2) reflects the empty buffer.
  function clearAccumulator(): void {
    accumulator = '';
    if (accumulatorTimer !== null) {
      clearTimeout(accumulatorTimer);
      accumulatorTimer = null;
    }
    editorUiActions.setAccumulator('');
  }

  // M1.3d-Rem-4 G1 — flush the accumulator, look up the shortcut, and
  // activate it via `onActivateTool`. Used only by the Enter / Space
  // handlers at canvas focus (NEVER auto-fired). Pre-Rem-4 there was
  // an exact-match-no-extension auto-flush in pumpAccumulator; that
  // heuristic is removed (it blocked `MI` for Mirror because `M` would
  // activate Move first).
  function flushAccumulatorAndActivate(): void {
    if (accumulator.length > 0) {
      const tool = lookupShortcut(accumulator);
      if (tool) callbacks.onActivateTool(tool);
    }
    clearAccumulator();
  }

  function pumpAccumulator(letter: string): void {
    accumulator += letter.toUpperCase();
    editorUiActions.setAccumulator(accumulator);
    if (accumulatorTimer !== null) clearTimeout(accumulatorTimer);
    // Silent stale-clear: 750 ms of inactivity clears the accumulator
    // without activating. AC parity — the user must hit Enter / Space
    // to activate. (Pre-Rem-4 this fired `flushAccumulator` which
    // auto-activated; the new policy never auto-activates.)
    accumulatorTimer = setTimeout(clearAccumulator, ACCUMULATOR_TIMEOUT_MS);
  }

  // M1.3d-Rem-4 G2 — append a key char to `commandBar.inputBuffer`.
  // Sole writer at canvas focus; the bar form input has its own
  // onChange path (focus-exclusive — both can't fire simultaneously).
  function appendToInputBuffer(ch: string): void {
    const current = editorUiStore.getState().commandBar.inputBuffer;
    editorUiActions.setInputBuffer(current + ch);
  }

  function popFromInputBuffer(): void {
    const current = editorUiStore.getState().commandBar.inputBuffer;
    if (current.length === 0) return;
    editorUiActions.setInputBuffer(current.slice(0, -1));
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
      // M1.3d-Rem-4 G1: Escape clears the accumulator silently (no
      // activation). G2: Escape also clears the inputBuffer — Esc
      // means "abort everything in flight" (tool, accumulator, buffer).
      clearAccumulator();
      editorUiActions.setInputBuffer('');
      callbacks.onAbortCurrentTool();
      editorUiActions.setFocusHolder('canvas');
      return;
    }
    if (key === 'Enter' && focus === 'canvas') {
      // M1.3d-Rem-4 — Enter at canvas focus disambiguation per A10b.
      // Branch order is inputBuffer-first (the AC-correct policy: a
      // typed value answers the active prompt; activation can wait).
      e.preventDefault();
      const cb = editorUiStore.getState().commandBar;
      const activeToolId = editorUiStore.getState().activeToolId;
      // (1) inputBuffer non-empty + tool active → submit buffer.
      if (cb.inputBuffer.length > 0 && activeToolId !== null) {
        callbacks.onSubmitBuffer(cb.inputBuffer);
        return;
      }
      // (2) accumulator non-empty → flush + activate (G1).
      if (accumulator.length > 0) {
        flushAccumulatorAndActivate();
        return;
      }
      // (3) inputBuffer non-empty + no tool active → degenerate;
      // clear silently (no tool to consume the value).
      if (cb.inputBuffer.length > 0) {
        editorUiActions.setInputBuffer('');
        return;
      }
      // (4) Else → existing commit-current-tool semantic.
      callbacks.onCommitCurrentTool();
      return;
    }
    // M1.3d-Rem-3 F6 + Rem-4 G1+G2 — Spacebar at canvas focus mirrors
    // Enter for the inputBuffer-submit + accumulator-flush branches,
    // then preserves the existing F6 spacebar logic at the bottom.
    // Bar focus: native input handles space (typing a literal space
    // character); we don't intercept.
    if (key === ' ' && focus === 'canvas') {
      e.preventDefault();
      const cb = editorUiStore.getState().commandBar;
      const activeToolId = editorUiStore.getState().activeToolId;
      // (1) inputBuffer non-empty + tool active → submit buffer.
      if (cb.inputBuffer.length > 0 && activeToolId !== null) {
        callbacks.onSubmitBuffer(cb.inputBuffer);
        return;
      }
      // (2) accumulator non-empty → flush + activate (G1).
      if (accumulator.length > 0) {
        flushAccumulatorAndActivate();
        return;
      }
      // (3) inputBuffer non-empty + no tool → clear silently.
      if (cb.inputBuffer.length > 0) {
        editorUiActions.setInputBuffer('');
        return;
      }
      // (4) tool active → existing onCommitCurrentTool (F6 commit path).
      if (activeToolId !== null) {
        callbacks.onCommitCurrentTool();
        return;
      }
      // (5) no tool + lastToolId set → onRepeatLastCommand (existing F6).
      callbacks.onRepeatLastCommand();
      return;
    }
    if (key === 'Delete' && focus === 'canvas') {
      e.preventDefault();
      callbacks.onActivateTool('erase');
      return;
    }
    // M1.3d-Rem-4 G2 H2 — Backspace at canvas focus ALWAYS
    // preventDefaults (suppresses any browser default like back-
    // navigation). When inputBuffer is non-empty, pop the last char;
    // when empty, the preventDefault is a benign safety net.
    if (key === 'Backspace' && focus === 'canvas') {
      e.preventDefault();
      popFromInputBuffer();
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
    // M1.3d-Rem-4 G2 — Numeric / punctuation routing at canvas focus.
    // Captured set: digits 0-9, `.`, `-`, `,`. Lives BELOW letter
    // routing because letters never match this regex. Bar focus: the
    // bar input handles its own onChange.
    if (focus === 'canvas' && INPUT_BUFFER_KEY_RE.test(key)) {
      e.preventDefault();
      appendToInputBuffer(key);
      return;
    }
    // Bar / dialog focus: native input handles letters / numerics; we
    // don't intercept here. The bar component consumes its own keystrokes.
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
