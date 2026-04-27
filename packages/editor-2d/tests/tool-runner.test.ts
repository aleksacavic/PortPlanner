import { afterEach, describe, expect, it } from 'vitest';

import { startTool } from '../src/tools/runner';
import type { ToolGenerator } from '../src/tools/types';
import { editorUiStore, resetEditorUiStoreForTests } from '../src/ui-state/store';

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
