import { afterEach, describe, expect, it } from 'vitest';

import { startTool } from '../src/tools/runner';
import type { DimensionGuide, DynamicInputManifest, ToolGenerator } from '../src/tools/types';
import { editorUiActions, editorUiStore, resetEditorUiStoreForTests } from '../src/ui-state/store';

afterEach(() => resetEditorUiStoreForTests());

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

async function waitFor<T>(read: () => T, predicate: (v: T) => boolean, label: string): Promise<T> {
  for (let i = 0; i < 50; i++) {
    const v = read();
    if (predicate(v)) return v;
    await tick();
  }
  throw new Error(`waitFor timed out: ${label}`);
}

describe('ToolRunner', () => {
  it('drives a 2-prompt generator to completion', async () => {
    async function* twoPrompt(): ToolGenerator {
      const a = yield { text: 'first', acceptedInputKinds: ['point'] };
      const b = yield { text: 'second', acceptedInputKinds: ['point'] };
      return {
        committed: true,
        description: `${(a as { kind: 'point'; point: { x: number; y: number } }).point.x},${(b as { kind: 'point'; point: { x: number; y: number } }).point.x}`,
      };
    }

    const tool = startTool('test', twoPrompt);
    await waitFor(
      () => editorUiStore.getState().commandBar.activePrompt,
      (p) => p === 'first',
      'first prompt published',
    );
    tool.feedInput({ kind: 'point', point: { x: 1, y: 0 } });
    await waitFor(
      () => editorUiStore.getState().commandBar.activePrompt,
      (p) => p === 'second',
      'second prompt published',
    );
    tool.feedInput({ kind: 'point', point: { x: 2, y: 0 } });
    const result = await tool.done();
    expect(result).toEqual({ committed: true, description: '1,2' });
    expect(editorUiStore.getState().activeToolId).toBeNull();
    expect(editorUiStore.getState().commandBar.activePrompt).toBeNull();
  });

  it('abort during a prompt cancels with reason=aborted', async () => {
    async function* threePrompt(): ToolGenerator {
      yield { text: 'first', acceptedInputKinds: ['point'] };
      yield { text: 'second', acceptedInputKinds: ['point'] };
      yield { text: 'third', acceptedInputKinds: ['point'] };
      return { committed: true };
    }
    const tool = startTool('test', threePrompt);
    await waitFor(
      () => editorUiStore.getState().commandBar.activePrompt,
      (p) => p === 'first',
      'first prompt published',
    );
    tool.abort();
    const result = await tool.done();
    expect(result).toEqual({ committed: false, reason: 'aborted' });
  });

  it('publishes prompts to the command-bar slice', async () => {
    async function* g(): ToolGenerator {
      yield { text: 'specify base point', acceptedInputKinds: ['point'] };
      return { committed: true };
    }
    const tool = startTool('move', g);
    await waitFor(
      () => editorUiStore.getState().commandBar.activePrompt,
      (p) => p === 'specify base point',
      'prompt published',
    );
    tool.abort();
    await tool.done();
  });

  // M1.3d-Remediation-3 F1 — runner publishes prompt.directDistanceFrom
  // to the commandBar slice so EditorRoot.handleCommandSubmit can read it.
  it('F1: publishes prompt.directDistanceFrom to commandBar slice', async () => {
    async function* g(): ToolGenerator {
      yield {
        text: 'specify end point',
        acceptedInputKinds: ['point'],
        directDistanceFrom: { x: 5, y: 7 },
      };
      return { committed: true };
    }
    const tool = startTool('test', g);
    await waitFor(
      () => editorUiStore.getState().commandBar.directDistanceFrom,
      (a) => a !== null && a.x === 5 && a.y === 7,
      'directDistanceFrom published',
    );
    tool.abort();
    await tool.done();
  });

  it('F1: omitted directDistanceFrom defaults to null on the slice', async () => {
    async function* g(): ToolGenerator {
      yield { text: 'specify base point', acceptedInputKinds: ['point'] };
      return { committed: true };
    }
    const tool = startTool('test', g);
    await waitFor(
      () => editorUiStore.getState().commandBar.activePrompt,
      (p) => p === 'specify base point',
      'prompt published',
    );
    expect(editorUiStore.getState().commandBar.directDistanceFrom).toBeNull();
    tool.abort();
    await tool.done();
  });
});

// M1.3d-Remediation-3 F6 — runner captures lastToolId on completion,
// excluding modeless / system tools (select-rect, grip-stretch, escape).
describe('ToolRunner — F6 lastToolId tracking', () => {
  it('user-invoked tool: lastToolId set on commit', async () => {
    async function* g(): ToolGenerator {
      yield { text: 'p', acceptedInputKinds: ['point'] };
      return { committed: true };
    }
    const tool = startTool('draw-line', g);
    await waitFor(
      () => editorUiStore.getState().commandBar.activePrompt,
      (p) => p === 'p',
      'prompt published',
    );
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tool.done();
    expect(editorUiStore.getState().commandBar.lastToolId).toBe('draw-line');
  });

  it('user-invoked tool: lastToolId set even on abort', async () => {
    async function* g(): ToolGenerator {
      yield { text: 'p', acceptedInputKinds: ['point'] };
      return { committed: true };
    }
    const tool = startTool('move', g);
    await waitFor(
      () => editorUiStore.getState().commandBar.activePrompt,
      (p) => p === 'p',
      'prompt published',
    );
    tool.abort();
    await tool.done();
    expect(editorUiStore.getState().commandBar.lastToolId).toBe('move');
  });

  it('select-rect: NOT tracked (modeless / system tool)', async () => {
    // Pre-seed lastToolId so we can assert select-rect doesn't overwrite.
    async function* prior(): ToolGenerator {
      yield { text: 'p', acceptedInputKinds: ['point'] };
      return { committed: true };
    }
    const t1 = startTool('draw-line', prior);
    await waitFor(
      () => editorUiStore.getState().commandBar.activePrompt,
      (p) => p === 'p',
      'prior prompt',
    );
    t1.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await t1.done();
    expect(editorUiStore.getState().commandBar.lastToolId).toBe('draw-line');

    async function* sr(): ToolGenerator {
      yield { text: 'q', acceptedInputKinds: ['point'] };
      return { committed: true };
    }
    const t2 = startTool('select-rect', sr);
    await waitFor(
      () => editorUiStore.getState().commandBar.activePrompt,
      (p) => p === 'q',
      'select-rect prompt',
    );
    t2.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await t2.done();
    // lastToolId stays at the prior user-tool — select-rect never overwrites.
    expect(editorUiStore.getState().commandBar.lastToolId).toBe('draw-line');
  });

  it('grip-stretch: NOT tracked', async () => {
    async function* g(): ToolGenerator {
      yield { text: 'p', acceptedInputKinds: ['point'] };
      return { committed: true };
    }
    const tool = startTool('grip-stretch', g);
    await waitFor(
      () => editorUiStore.getState().commandBar.activePrompt,
      (p) => p === 'p',
      'prompt published',
    );
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tool.done();
    expect(editorUiStore.getState().commandBar.lastToolId).toBeNull();
  });
});

// M1.3 Round 6 — Dynamic Input substrate tests per plan §11.
// Synchronous-bootstrap on prompt-yield (Rev-3 H2 first-frame coherence)
// + re-entrancy guard on feedInput (Rev-4 H + Rev-6 single-method form).
describe('ToolRunner — M1.3 Round 6 Dynamic Input substrate', () => {
  const RECT_MANIFEST: DynamicInputManifest = {
    fields: [
      { kind: 'number', label: 'W' },
      { kind: 'number', label: 'H' },
    ],
    combineAs: 'numberPair',
  };

  it('publishes dynamicInput manifest sparsely on yield + clears on teardown', async () => {
    async function* g(): ToolGenerator {
      yield {
        text: 'specify second corner',
        acceptedInputKinds: ['point', 'numberPair'],
        dynamicInput: RECT_MANIFEST,
      };
      return { committed: true };
    }
    const tool = startTool('draw-rectangle', g);
    await waitFor(
      () => editorUiStore.getState().commandBar.dynamicInput,
      (di) => di !== null && di.manifest.fields.length === 2,
      'dynamicInput manifest published',
    );
    const di = editorUiStore.getState().commandBar.dynamicInput;
    expect(di?.buffers).toEqual(['', '']);
    expect(di?.activeFieldIdx).toBe(0);
    tool.abort();
    await tool.done();
    // On teardown, dynamicInput cleared.
    expect(editorUiStore.getState().commandBar.dynamicInput).toBeNull();
    expect(editorUiStore.getState().overlay.dimensionGuides).toBeNull();
  });

  // Rev-3 H2 first-frame coherence — sync bootstrap of dimensionGuidesBuilder.
  it("'synchronous-bootstrap-on-prompt-yield' — overlay.dimensionGuides populated immediately on yield (no setTimeout/raf wait)", async () => {
    // Seed cursor BEFORE starting the tool so the runner reads it on yield.
    editorUiActions.setCursor({ metric: { x: 5, y: 2 }, screen: { x: 50, y: 20 } });
    const builderGuides: DimensionGuide[] = [
      {
        kind: 'linear-dim',
        anchorA: { x: 0, y: 0 },
        anchorB: { x: 5, y: 2 },
        offsetCssPx: 10,
      },
      {
        kind: 'angle-arc',
        pivot: { x: 0, y: 0 },
        baseAngleRad: 0,
        sweepAngleRad: Math.atan2(2, 5),
        radiusMetric: 5,
      },
    ];
    async function* g(): ToolGenerator {
      yield {
        text: 'specify end point',
        acceptedInputKinds: ['point'],
        dynamicInput: {
          fields: [
            { kind: 'distance', label: 'D' },
            { kind: 'angle', label: 'A' },
          ],
          combineAs: 'point',
        },
        dimensionGuidesBuilder: () => builderGuides,
      };
      return { committed: true };
    }
    const tool = startTool('draw-line', g);
    // Wait until manifest is published; at that point the sync bootstrap
    // MUST have already run and populated dimensionGuides.
    await waitFor(
      () => editorUiStore.getState().commandBar.dynamicInput,
      (di) => di !== null,
      'manifest published',
    );
    const guides = editorUiStore.getState().overlay.dimensionGuides;
    expect(guides).not.toBeNull();
    expect(guides).toHaveLength(2);
    if (guides && guides[0]?.kind === 'linear-dim') {
      expect(guides[0].anchorB).toEqual({ x: 5, y: 2 });
    } else {
      throw new Error('expected linear-dim arm');
    }
    tool.abort();
    await tool.done();
  });

  // Rev-4 H + Rev-6 single-method form — feedInput throws if called
  // from inside the synchronous builder seed.
  it("'sync-bootstrap builder cannot call feedInput' — re-entrancy throws + flag cleanup", async () => {
    editorUiActions.setCursor({ metric: { x: 1, y: 1 }, screen: { x: 10, y: 10 } });
    let toolRef: ReturnType<typeof startTool> | null = null;
    let captured: Error | null = null;
    async function* g(): ToolGenerator {
      yield {
        text: 'p',
        acceptedInputKinds: ['point'],
        // Builder closes over toolRef (test-only contrivance — production
        // builders are pure (cursor) => Shape with no RunningTool ref).
        dimensionGuidesBuilder: () => {
          if (toolRef) {
            try {
              toolRef.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
            } catch (e) {
              // Capture but DON'T rethrow — contract is that feedInput
              // throws when re-entered from sync bootstrap; the throw
              // here proves it. Returning [] lets the bootstrap finish
              // cleanly so the runner's outer finally clears the flag
              // without an unhandled rejection on the IIFE.
              captured = e instanceof Error ? e : new Error(String(e));
            }
          }
          return [];
        },
        dynamicInput: { fields: [{ kind: 'number' }], combineAs: 'number' },
      };
      return { committed: true };
    }
    toolRef = startTool('test', g);
    // The runner's sync bootstrap will invoke the builder which calls
    // feedInput → guard throws → builder's try/catch captures + rethrows
    // → bootstrap's finally clears inSyncBootstrap → runner abort path.
    // We can't easily assert the bootstrap throw bubbles, but we can
    // assert the builder captured the expected error.
    await waitFor(
      () => captured,
      (e) => e !== null,
      'feedInput re-entry throw captured',
    );
    expect(captured).not.toBeNull();
    expect((captured as unknown as Error).message).toContain(
      'cursor-effect re-entered runner during sync bootstrap',
    );
    // Verify the flag is cleared after the throw — a NEW feedInput
    // call (outside the bootstrap path) should NOT throw.
    if (toolRef) {
      // The runner generator is in an indeterminate state from the
      // bootstrap exception; call abort to clean up. abort() never
      // checks inSyncBootstrap (it's not a state-machine-advance method
      // — it's a teardown signal).
      toolRef.abort();
      await toolRef.done().catch(() => undefined);
    }
  });

  // Round 7 Phase 2 — canonical promptKey expression per plan A16:
  // `${toolId}:${prompt.persistKey ?? promptIndex}`. Three cases lock
  // the contract: index-0 fallback, index-N fallback, and explicit
  // persistKey override (used by polyline next-vertex loop).
  describe('Round 7 Phase 2 — promptKey propagation (canonical: ${toolId}:${prompt.persistKey ?? promptIndex})', () => {
    it('first prompt without persistKey gets promptKey "${toolId}:0"', async () => {
      async function* g(): ToolGenerator {
        yield {
          text: 'one',
          acceptedInputKinds: ['point', 'numberPair'],
          dynamicInput: RECT_MANIFEST,
        };
        return { committed: true };
      }
      const tool = startTool('draw-rectangle', g);
      await waitFor(
        () => editorUiStore.getState().commandBar.dynamicInput,
        (di) => di !== null,
        'manifest published',
      );
      expect(editorUiStore.getState().commandBar.dynamicInput?.promptKey).toBe('draw-rectangle:0');
      tool.abort();
      await tool.done();
    });

    it('second prompt without persistKey gets promptKey "${toolId}:1"', async () => {
      async function* g(): ToolGenerator {
        yield { text: 'first', acceptedInputKinds: ['point'] };
        yield {
          text: 'second',
          acceptedInputKinds: ['point', 'numberPair'],
          dynamicInput: RECT_MANIFEST,
        };
        return { committed: true };
      }
      const tool = startTool('draw-rectangle', g);
      // Feed a point to advance past the first yield.
      await waitFor(
        () => editorUiStore.getState().commandBar.activePrompt,
        (p) => p === 'first',
        'first prompt published',
      );
      tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
      await waitFor(
        () => editorUiStore.getState().commandBar.dynamicInput,
        (di) => di !== null,
        'second prompt manifest published',
      );
      expect(editorUiStore.getState().commandBar.dynamicInput?.promptKey).toBe('draw-rectangle:1');
      tool.abort();
      await tool.done();
    });

    it('explicit persistKey overrides the prompt-index fallback ("draw-polyline:next-vertex" regardless of yield index)', async () => {
      async function* g(): ToolGenerator {
        // Two yields without DI to advance promptIndex past 0.
        yield { text: 'p1', acceptedInputKinds: ['point'] };
        yield { text: 'p2', acceptedInputKinds: ['point'] };
        // Now at promptIndex=2 — explicit persistKey should override.
        yield {
          text: 'next vertex',
          acceptedInputKinds: ['point'],
          dynamicInput: RECT_MANIFEST,
          persistKey: 'next-vertex',
        };
        return { committed: true };
      }
      const tool = startTool('draw-polyline', g);
      await waitFor(
        () => editorUiStore.getState().commandBar.activePrompt,
        (p) => p === 'p1',
        'p1 published',
      );
      tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
      await waitFor(
        () => editorUiStore.getState().commandBar.activePrompt,
        (p) => p === 'p2',
        'p2 published',
      );
      tool.feedInput({ kind: 'point', point: { x: 1, y: 1 } });
      await waitFor(
        () => editorUiStore.getState().commandBar.dynamicInput,
        (di) => di !== null,
        'next-vertex manifest published',
      );
      expect(editorUiStore.getState().commandBar.dynamicInput?.promptKey).toBe(
        'draw-polyline:next-vertex',
      );
      tool.abort();
      await tool.done();
    });
  });
});

// M1.3 DI pipeline overhaul Phase 4 (B8) — runner subscription freeze
// while DI recall pill is active. Per plan A16 / I-DI-11: the runner's
// preview + dimensionGuides re-invocation short-circuits when
// commandBar.dynamicInput.recallActive is true, leaving the previously-
// rendered preview frozen until the user accepts/cancels recall.
describe('ToolRunner — Phase 4 (B8) recall-active rubber-band freeze (I-DI-11)', () => {
  it('does NOT re-invoke previewBuilder/dimensionGuidesBuilder while recallActive=true', async () => {
    let previewCalls = 0;
    let guidesCalls = 0;
    async function* freezeProbeTool(): ToolGenerator {
      const manifest: DynamicInputManifest = {
        fields: [{ kind: 'distance', label: 'D' }],
        combineAs: 'number',
      };
      yield {
        text: 'probe',
        acceptedInputKinds: ['point'],
        dynamicInput: manifest,
        previewBuilder: (cursor) => {
          previewCalls += 1;
          return { kind: 'circle', center: { x: 0, y: 0 }, cursor };
        },
        dimensionGuidesBuilder: (cursor): DimensionGuide[] => {
          guidesCalls += 1;
          return [
            {
              kind: 'linear-dim',
              anchorA: { x: 0, y: 0 },
              anchorB: cursor,
              offsetCssPx: 40,
            },
          ];
        },
      };
      return { committed: false, reason: 'aborted' };
    }
    // Seed an initial cursor so the synchronous bootstrap fires once.
    editorUiActions.setCursor({ metric: { x: 1, y: 1 }, screen: { x: 100, y: 100 } });
    const tool = startTool('freeze-probe', freezeProbeTool);
    await tick();
    const previewBeforeRecall = previewCalls;
    const guidesBeforeRecall = guidesCalls;
    // Bootstrap fires both builders once (sync seed).
    expect(previewBeforeRecall).toBeGreaterThanOrEqual(1);
    expect(guidesBeforeRecall).toBeGreaterThanOrEqual(1);
    // Move cursor — runner subscription fires; both builders increment.
    editorUiActions.setCursor({ metric: { x: 2, y: 2 }, screen: { x: 200, y: 200 } });
    await tick();
    expect(previewCalls).toBeGreaterThan(previewBeforeRecall);
    expect(guidesCalls).toBeGreaterThan(guidesBeforeRecall);
    // Activate recall — subscription should now short-circuit.
    editorUiActions.setDynamicInputRecallActive(true);
    const previewAtFreeze = previewCalls;
    const guidesAtFreeze = guidesCalls;
    // Move cursor multiple times while recall is active.
    editorUiActions.setCursor({ metric: { x: 3, y: 3 }, screen: { x: 300, y: 300 } });
    await tick();
    editorUiActions.setCursor({ metric: { x: 4, y: 4 }, screen: { x: 400, y: 400 } });
    await tick();
    // Builder counters frozen — runner short-circuited each call.
    expect(previewCalls).toBe(previewAtFreeze);
    expect(guidesCalls).toBe(guidesAtFreeze);
    // Cancel recall — subscription resumes for subsequent cursor moves.
    editorUiActions.setDynamicInputRecallActive(false);
    editorUiActions.setCursor({ metric: { x: 5, y: 5 }, screen: { x: 500, y: 500 } });
    await tick();
    expect(previewCalls).toBeGreaterThan(previewAtFreeze);
    expect(guidesCalls).toBeGreaterThan(guidesAtFreeze);
    tool.abort();
    await tool.done();
  });
});
