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
    if (key === 'Delete' && focus === 'canvas') {
      e.preventDefault();
      callbacks.onActivateTool('erase');
      return;
    }

    // Per-focus letter routing.
    if (focus === 'canvas' && /^[A-Za-z]$/.test(key)) {
      pumpAccumulator(key);
      return;
    }
    // Bar / dialog focus: native input handles letters; we don't
    // intercept here. The bar component consumes its own keystrokes.
  };

  window.addEventListener('keydown', handler);
  cleanup = () => {
    window.removeEventListener('keydown', handler);
    if (accumulatorTimer !== null) clearTimeout(accumulatorTimer);
    registered = false;
    cleanup = null;
  };
  return cleanup;
}

export function unregisterKeyboardRouterForTests(): void {
  if (cleanup) cleanup();
}
