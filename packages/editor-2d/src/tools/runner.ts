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
import type { DimensionGuide, Input, Prompt, ToolGenerator, ToolResult } from './types';

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
  //
  // M1.3 Round 6 — extended to also re-invoke
  // `currentPromptRef.current?.dimensionGuidesBuilder` per cursor-tick
  // (mirrors `previewBuilder` exactly; same dedup / null-cursor /
  // teardown semantics). Both builders are pure functions
  // `(cursor) => Shape`; per plan §3 A2.1 they don't receive a
  // `RunningTool` reference, so re-entrancy via `feedInput` is
  // architecturally prevented (defense-in-depth via inSyncBootstrap).
  const currentPromptRef: { current: Prompt | null } = { current: null };
  let unsubscribePreview: (() => void) | null = null;
  let lastCursorSeen: { x: number; y: number } | null = null;
  // M1.3 Round 6 — sync-bootstrap re-entrancy guard. Set true around
  // synchronous builder seed calls (the block at the prompt-yield site
  // below); cleared in finally. `feedInput` checks the flag at entry
  // and throws if set. Plan §3 A2.1 + Phase 1 step 3a.iii (Rev-6
  // single-method form per actual function-based runner architecture).
  let inSyncBootstrap = false;

  function ensurePreviewSubscription(): void {
    if (unsubscribePreview !== null) return;
    unsubscribePreview = editorUiStore.subscribe((state: EditorUiState) => {
      const cursor = state.overlay.cursor;
      const promptNow = currentPromptRef.current;
      if (!promptNow) return;
      const previewBuilder = promptNow.previewBuilder;
      const guidesBuilder = promptNow.dimensionGuidesBuilder;
      if (!previewBuilder && !guidesBuilder) return;
      if (!cursor) {
        lastCursorSeen = null;
        return;
      }
      const last = lastCursorSeen;
      if (last && last.x === cursor.metric.x && last.y === cursor.metric.y) return;
      lastCursorSeen = { x: cursor.metric.x, y: cursor.metric.y };
      if (previewBuilder) {
        editorUiActions.setPreviewShape(previewBuilder(cursor.metric));
      }
      if (guidesBuilder) {
        editorUiActions.setDimensionGuides(guidesBuilder(cursor.metric));
      }
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
    // M1.3 Round 6 — also clear DI manifest + dimension guides on teardown
    // (plan §7 Phase 1 step 3c).
    editorUiActions.clearDynamicInput();
    editorUiActions.setDimensionGuides(null);
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
        // M1.3 Round 6 — Phase 1 step 3a.i: publish DI manifest sparsely
        // on prompt-yield (resets buffers + activeFieldIdx per Rev-1
        // R2-A5). When the prompt has no manifest, clear any leftover.
        if (prompt.dynamicInput) {
          editorUiActions.setDynamicInputManifest(prompt.dynamicInput);
        } else {
          editorUiActions.clearDynamicInput();
        }
        if (prompt.previewBuilder || prompt.dimensionGuidesBuilder) {
          ensurePreviewSubscription();
          // M1.3 Round 6 — Phase 1 step 3a.ii: synchronous bootstrap.
          // Seed preview AND dimension guides from the current cursor so
          // the first frame after yield is coherent (Rev-3 H2 first-frame
          // coherence). Wrap the builder calls with `inSyncBootstrap`
          // try/finally so any re-entrancy attempt via `feedInput`
          // throws (Rev-4 H + Rev-6 single-method re-entrancy guard).
          const cursor = editorUiStore.getState().overlay.cursor;
          if (cursor) {
            inSyncBootstrap = true;
            try {
              if (prompt.previewBuilder) {
                editorUiActions.setPreviewShape(prompt.previewBuilder(cursor.metric));
                lastCursorSeen = { x: cursor.metric.x, y: cursor.metric.y };
              }
              if (prompt.dimensionGuidesBuilder) {
                const guides: DimensionGuide[] = prompt.dimensionGuidesBuilder(cursor.metric);
                editorUiActions.setDimensionGuides(guides);
              } else if (!prompt.dynamicInput) {
                // Manifest absent → no guides expected; clear leftover.
                editorUiActions.setDimensionGuides(null);
              }
            } finally {
              inSyncBootstrap = false;
            }
          }
        } else {
          // Prompt without builders — clear any leftover preview / guides
          // so stale shapes don't linger.
          editorUiActions.setPreviewShape(null);
          editorUiActions.setDimensionGuides(null);
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
      // M1.3 Round 6 — re-entrancy guard. If a builder somehow obtained
      // a `RunningTool` reference (test-only contrivance — production
      // builders are pure (cursor) => Shape and don't have access) and
      // calls feedInput from inside the synchronous bootstrap path,
      // throw. Plan §3 A2.1 + Phase 1 step 3a.iii (Rev-6 single-method
      // form). Production tools never hit this; existing per-cursor-tick
      // builder invocations leave the flag at false.
      if (inSyncBootstrap) {
        throw new Error('cursor-effect re-entered runner during sync bootstrap');
      }
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
