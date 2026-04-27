// ToolRunner — drives a generator-pattern tool to completion. Inputs
// are pushed via feedInput; outputs (prompts) are published to the
// command bar slice of editorUiStore.
//
// M1.3d Phase 4 — when a yielded Prompt carries `previewBuilder`, the
// runner subscribes to editorUiStore (single side; runner does NOT
// subscribe to projectStore — only one-shot getState reads at commit
// time, which is not a subscription per Gate 22.7 / I-68). The
// subscription handler captures `currentPromptRef` (a runner-local
// mutable) so a single store subscription serves every prompt the
// tool yields without resubscribing per prompt — see plan §1 step 5
// closure-capture clarification (C14). Lifecycle:
//   - Subscription created lazily on the first prompt that has a
//     previewBuilder.
//   - Reads `state.overlay.cursor`, dedupes against last cursor seen,
//     re-invokes the current previewBuilder, writes setPreviewShape.
//   - Cleared on tool completion / abort via the existing try/finally.
//   - I-DTP-9 + Gate DTP-T6: previewBuilder writes ONLY to
//     overlay.previewShape, never to projectStore.

import { type EditorUiState, editorUiActions, editorUiStore } from '../ui-state/store';
import type { Input, Prompt, ToolGenerator, ToolResult } from './types';

// M1.3d-Remediation-3 F6 — modeless / system tools never user-invoked
// via shortcut. Excluded from `lastToolId` tracking so spacebar's
// repeat-last-command behaviour never replays them. `select-rect` and
// `grip-stretch` are auto-started by canvas-host on pointer events;
// `escape` is the abort sentinel.
const EXCLUDED_FROM_LAST: ReadonlyArray<string> = ['select-rect', 'grip-stretch', 'escape'];

export interface RunningTool {
  toolId: string;
  feedInput(input: Input): void;
  abort(): void;
  done(): Promise<ToolResult>;
}

export function startTool(toolId: string, generatorFactory: () => ToolGenerator): RunningTool {
  const generator = generatorFactory();
  let pendingResolve: ((input: Input) => void) | null = null;
  let aborted = false;
  const inputQueue: Input[] = [];

  // M1.3d Phase 4 — preview subscription state, lazily initialized.
  // currentPromptRef.current is mutated when each new Prompt is
  // yielded; the subscription handler reads it on every fire so a
  // single subscription serves every prompt the tool yields.
  const currentPromptRef: { current: Prompt | null } = { current: null };
  let unsubscribePreview: (() => void) | null = null;
  let lastCursorSeen: { x: number; y: number } | null = null;

  function ensurePreviewSubscription(): void {
    if (unsubscribePreview !== null) return;
    unsubscribePreview = editorUiStore.subscribe((state: EditorUiState) => {
      const cursor = state.overlay.cursor;
      const builder = currentPromptRef.current?.previewBuilder;
      if (!builder) return;
      if (!cursor) {
        lastCursorSeen = null;
        return;
      }
      const last = lastCursorSeen;
      if (last && last.x === cursor.metric.x && last.y === cursor.metric.y) return;
      lastCursorSeen = { x: cursor.metric.x, y: cursor.metric.y };
      editorUiActions.setPreviewShape(builder(cursor.metric));
    });
  }

  function teardownPreviewSubscription(): void {
    if (unsubscribePreview) {
      unsubscribePreview();
      unsubscribePreview = null;
    }
    currentPromptRef.current = null;
    lastCursorSeen = null;
    editorUiActions.setPreviewShape(null);
  }

  // Inputs may arrive faster than the generator drains them (rapid
  // pointerDowns from a smoke test, queued bar submits, etc.). Buffer
  // them in `inputQueue` when no awaiter is pending; pop on the next
  // `nextInput()` so no input is lost.
  function nextInput(): Promise<Input> {
    return new Promise<Input>((resolve) => {
      if (inputQueue.length > 0) {
        resolve(inputQueue.shift() as Input);
        return;
      }
      pendingResolve = resolve;
    });
  }

  const resultPromise: Promise<ToolResult> = (async (): Promise<ToolResult> => {
    editorUiActions.setActiveToolId(toolId);
    let nextValue: Input | undefined;
    try {
      while (true) {
        if (aborted) {
          await generator.return({ committed: false, reason: 'aborted' });
          return { committed: false, reason: 'aborted' };
        }
        const yielded =
          nextValue === undefined ? await generator.next() : await generator.next(nextValue);
        if (yielded.done) {
          return yielded.value;
        }
        const prompt = yielded.value;
        currentPromptRef.current = prompt;
        editorUiActions.setPrompt(
          prompt.text,
          prompt.subOptions ?? [],
          prompt.defaultValue ?? null,
          prompt.acceptedInputKinds,
          prompt.directDistanceFrom ?? null,
        );
        if (prompt.previewBuilder) {
          ensurePreviewSubscription();
          // Seed the preview from the current cursor so the first
          // frame shows it without waiting for a mousemove.
          const cursor = editorUiStore.getState().overlay.cursor;
          if (cursor) {
            editorUiActions.setPreviewShape(prompt.previewBuilder(cursor.metric));
            lastCursorSeen = { x: cursor.metric.x, y: cursor.metric.y };
          }
        } else {
          // Prompt without a preview — clear any leftover from the
          // previous prompt so a stale shape doesn't linger.
          editorUiActions.setPreviewShape(null);
          lastCursorSeen = null;
        }
        const input = await nextInput();
        if (input.kind === 'escape') {
          aborted = true;
          continue;
        }
        nextValue = input;
      }
    } finally {
      editorUiActions.setActiveToolId(null);
      editorUiActions.setPrompt(null);
      teardownPreviewSubscription();
      // M1.3d-Remediation-3 F6 — capture this tool as the
      // "last invoked" for spacebar-repeat, unless it's a modeless /
      // system tool. Both committed and aborted tools count — repeating
      // a just-aborted tool is the standard AutoCAD muscle-memory.
      if (!EXCLUDED_FROM_LAST.includes(toolId)) {
        editorUiActions.setLastToolId(toolId);
      }
    }
  })();

  return {
    toolId,
    feedInput(input: Input): void {
      if (pendingResolve) {
        const r = pendingResolve;
        pendingResolve = null;
        r(input);
        return;
      }
      inputQueue.push(input);
    },
    abort(): void {
      aborted = true;
      if (pendingResolve) {
        const r = pendingResolve;
        pendingResolve = null;
        r({ kind: 'escape' });
      }
    },
    done(): Promise<ToolResult> {
      return resultPromise;
    },
  };
}
