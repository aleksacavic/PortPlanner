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
});
