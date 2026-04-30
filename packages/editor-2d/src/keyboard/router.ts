// Window-level keyboard router. Single addEventListener registration
// (Gate 11.3 enforces). Routes by focus holder + key class.
//
// Bypass keys (F-keys, Ctrl+Z/Y, Escape) handle identically across
// focus holders (I-32). Letter keys route to canvas (tool activation
// via accumulator) or bar (input accumulation) per focus holder.
//
// M1.3d-Remediation-4 G1 + Rem-5 H2 — AC-mode accumulator. Letters at
// canvas focus accumulate silently; Enter or Space activates the
// accumulated command. Escape clears. Accumulator persists indefinitely
// (no idle timeout — Rem-5 H2 removed the 750 ms stale-clear; AC parity).
// The Dynamic Input pill (G2) is the visible safety net — the user
// always sees the in-progress accumulator next to the cursor.
//
// M1.3d-Remediation-4 G2 — Numeric / punctuation / Backspace at canvas
// focus route into `commandBar.inputBuffer` so the Dynamic Input pill
// can echo what the user types. Stream separation: letters →
// accumulator, digits/punct → inputBuffer (matches AC). Enter at canvas
// focus + buffer non-empty + tool active → submit via `onSubmitBuffer`
// (parity with the bottom command line's form submit, with explicit
// history-append in EditorRoot per Rev-1 B1 fix).

import type { DynamicInputManifest } from '../tools/types';
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
  /** M1.3 Round 6 — submit the current Dynamic Input multi-field buffers
   *  to the active tool. Fired when the user hits Enter / Space at
   *  canvas focus while `commandBar.dynamicInput.manifest !== null`.
   *  EditorRoot's implementation delegates to `combineDynamicInputBuffers`
   *  helper (SSOT for `combineAs` policies + deg→rad conversion);
   *  feeds the resulting Input to the runner (or ignores submit if
   *  helper returns null on empty / un-parseable buffers). Plan §7
   *  Phase 1 step 11 + §3 A2.1. */
  onSubmitDynamicInput: (manifest: DynamicInputManifest, buffers: string[]) => void;
}

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

  // M1.3d-Rem-4 G1 + Rem-5 H2 — clear the accumulator silently (no
  // activation). Used by Escape and at the tail of
  // `flushAccumulatorAndActivate`. Mirrors the cleared state into the
  // store so the Dynamic Input pill (G2) reflects the empty buffer.
  // Rem-5 H2 removed the 750 ms idle timer — accumulator persists
  // indefinitely until Enter / Space / Escape (AC parity).
  function clearAccumulator(): void {
    accumulator = '';
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
    // M1.3d-Rem-5 H2 — no idle timeout. Accumulator persists until
    // Enter / Space activates it OR Escape clears it. AC parity. The
    // Dynamic Input pill (G2) makes the in-progress accumulator
    // visible at the cursor as the user types.
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

  // M1.3 Round 6 — DI helper: write/read/cycle the per-field DI buffer
  // when `commandBar.dynamicInput.manifest !== null`. Sole writer is the
  // router (numeric / Backspace / Tab branches below). Esc clears via
  // `clearDynamicInput`. Plan §7 step 8.
  function appendToDIActiveField(ch: string): void {
    const di = editorUiStore.getState().commandBar.dynamicInput;
    if (!di) return;
    const idx = di.activeFieldIdx;
    const cur = di.buffers[idx] ?? '';
    editorUiActions.setDynamicInputFieldBuffer(idx, cur + ch);
  }

  function popFromDIActiveField(): void {
    const di = editorUiStore.getState().commandBar.dynamicInput;
    if (!di) return;
    const idx = di.activeFieldIdx;
    const cur = di.buffers[idx] ?? '';
    if (cur.length === 0) return;
    editorUiActions.setDynamicInputFieldBuffer(idx, cur.slice(0, -1));
  }

  function cycleDIActiveField(direction: 1 | -1): void {
    const di = editorUiStore.getState().commandBar.dynamicInput;
    if (!di) return;
    const n = di.manifest.fields.length;
    if (n <= 1) return;
    const next = (di.activeFieldIdx + direction + n) % n;
    editorUiActions.setDynamicInputActiveField(next);
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
      // M1.3 DI pipeline overhaul Phase 4 (B8) + Phase 3 (B7) —
      // multi-step Esc precedence: recall cancellation > unlock all
      // > existing abort. Plan A3 / I-DI-12.
      const diBeforeEsc = editorUiStore.getState().commandBar.dynamicInput;
      // First step (Phase 4): cancel recall if active.
      if (diBeforeEsc?.recallActive) {
        e.preventDefault();
        editorUiActions.setDynamicInputRecallActive(false);
        return;
      }
      // Second step (Phase 3): unlock all locked fields.
      if (diBeforeEsc?.locked.some(Boolean)) {
        e.preventDefault();
        editorUiActions.unlockAllDynamicInputFields();
        return;
      }
      // M1.3d-Rem-4 G1: Escape clears the accumulator silently (no
      // activation). G2: Escape also clears the inputBuffer — Esc
      // means "abort everything in flight" (tool, accumulator, buffer).
      // M1.3 Round 6: Esc also clears DI manifest + buffers.
      clearAccumulator();
      editorUiActions.setInputBuffer('');
      editorUiActions.clearDynamicInput();
      callbacks.onAbortCurrentTool();
      editorUiActions.setFocusHolder('canvas');
      return;
    }
    // M1.3 Round 6 — Tab / Shift+Tab cycles activeFieldIdx when DI is
    // active. Intercepted at canvas OR bar focus so the user can Tab
    // between DI pills regardless of which surface they're typing in.
    // When no DI is active, Tab passes through to native browser
    // behaviour (preserves accessibility for chrome regions).
    //
    // M1.3 DI pipeline overhaul Phase 3 (B7) — Tab handler now also
    // locks a typed field before cycling, and fires implicit submit
    // when every field becomes locked. Plan A2 + A18 + I-DI-4 + I-DI-5.
    if (key === 'Tab') {
      const di = editorUiStore.getState().commandBar.dynamicInput;
      if (di && di.manifest.fields.length > 0) {
        e.preventDefault();
        // M1.3 DI pipeline overhaul Phase 4 (B8) — Tab during recall
        // cancels back to per-field pill mode (does NOT cycle / lock).
        // Plan A3 / I-DI-10.
        if (di.recallActive) {
          editorUiActions.setDynamicInputRecallActive(false);
          return;
        }
        const idx = di.activeFieldIdx;
        const buffer = di.buffers[idx] ?? '';
        // Lock-on-typed (Plan A2): empty field → just navigate; typed
        // field → freeze it BEFORE cycling. Idempotent if already locked.
        if (buffer.length > 0 && !di.locked[idx]) {
          editorUiActions.setDynamicInputFieldLocked(idx, true);
        }
        // Cycle navigation only if multi-field. Single-field lock
        // path falls through to the all-locked auto-submit check.
        if (di.manifest.fields.length > 1) {
          cycleDIActiveField(e.shiftKey ? -1 : 1);
        }
        // Auto-submit when every field becomes locked (Plan A18).
        // Re-read state after the lock + cycle mutations so we see
        // the current `locked` array.
        const updatedDi = editorUiStore.getState().commandBar.dynamicInput;
        if (updatedDi?.locked.every(Boolean)) {
          callbacks.onSubmitDynamicInput(updatedDi.manifest, updatedDi.buffers);
        }
        return;
      }
      // No DI active OR zero-field manifest — pass through.
    }
    // M1.3 DI pipeline overhaul Phase 4 (B8) — ArrowUp shows recall
    // pill at cursor when DI active AND a recall entry exists for the
    // active promptKey. ArrowDown cancels recall (returns to live-
    // cursor mode). Both intercepted only at canvas focus so chrome
    // regions retain native arrow-key behavior. Plan I-DI-10 + I-DI-11.
    if (key === 'ArrowUp' && focus === 'canvas') {
      const di = editorUiStore.getState().commandBar.dynamicInput;
      if (!di) return; // no DI active → pass through
      const recall = editorUiStore.getState().commandBar.dynamicInputRecall[di.promptKey];
      if (!recall || recall.length === 0) return; // no entry → pass through
      e.preventDefault();
      editorUiActions.setDynamicInputRecallActive(true);
      return;
    }
    if (key === 'ArrowDown' && focus === 'canvas') {
      const di = editorUiStore.getState().commandBar.dynamicInput;
      if (di?.recallActive) {
        e.preventDefault();
        editorUiActions.setDynamicInputRecallActive(false);
        return;
      }
    }
    if (key === 'Enter' && focus === 'canvas') {
      // M1.3d-Rem-4 — Enter at canvas focus disambiguation per A10b.
      // M1.3 Round 6 — DI submit takes precedence over inputBuffer
      // submit when a manifest is active (the DI per-field buffers
      // are the active typing surface; inputBuffer is the legacy
      // single-field path).
      e.preventDefault();
      const cb = editorUiStore.getState().commandBar;
      const activeToolId = editorUiStore.getState().activeToolId;
      // M1.3 DI pipeline overhaul Phase 4 (B8) — Enter during recall
      // commits the recalled buffers (NOT the current empty buffers).
      // Plan I-DI-10. Branch fires BEFORE the standard DI submit so
      // recall-active short-circuits without falling into the live
      // path. Recalled buffers feed straight into onSubmitDynamicInput
      // which routes through the standard combiner + tool feed path.
      if (cb.dynamicInput?.recallActive && activeToolId !== null) {
        const recall = cb.dynamicInputRecall[cb.dynamicInput.promptKey];
        if (recall && recall.length === cb.dynamicInput.manifest.fields.length) {
          callbacks.onSubmitDynamicInput(cb.dynamicInput.manifest, recall);
          return;
        }
      }
      // (0) DI active + tool active → DI submit (Round 6).
      if (cb.dynamicInput && activeToolId !== null) {
        callbacks.onSubmitDynamicInput(cb.dynamicInput.manifest, cb.dynamicInput.buffers);
        return;
      }
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
      // M1.3 DI pipeline overhaul Phase 4 (B8) — Space during recall
      // commits the recalled buffers (mirrors Enter precedence).
      // Plan I-DI-10.
      if (cb.dynamicInput?.recallActive && activeToolId !== null) {
        const recall = cb.dynamicInputRecall[cb.dynamicInput.promptKey];
        if (recall && recall.length === cb.dynamicInput.manifest.fields.length) {
          callbacks.onSubmitDynamicInput(cb.dynamicInput.manifest, recall);
          return;
        }
      }
      // (0) DI active + tool active → DI submit (Round 6 — same
      // precedence as Enter for symmetry).
      if (cb.dynamicInput && activeToolId !== null) {
        callbacks.onSubmitDynamicInput(cb.dynamicInput.manifest, cb.dynamicInput.buffers);
        return;
      }
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
      // M1.3 Round 6 — when DI is active, Backspace pops from the
      // active field's buffer; otherwise legacy inputBuffer pop.
      const di = editorUiStore.getState().commandBar.dynamicInput;
      if (di) {
        popFromDIActiveField();
      } else {
        popFromInputBuffer();
      }
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
      // M1.3 Round 6 — when DI is active, route digits/punct to the
      // active field's per-field buffer (NOT the legacy inputBuffer).
      // Plan §7 step 8.
      const di = editorUiStore.getState().commandBar.dynamicInput;
      if (di) {
        appendToDIActiveField(key);
      } else {
        appendToInputBuffer(key);
      }
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
    registered = false;
    cleanup = null;
  };
  return cleanup;
}

export function unregisterKeyboardRouterForTests(): void {
  if (cleanup) cleanup();
}
