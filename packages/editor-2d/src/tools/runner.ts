// ToolRunner — drives a generator-pattern tool to completion. Inputs
// are pushed via feedInput; outputs (prompts) are published to the
// command bar slice of editorUiStore.

import { editorUiActions } from '../ui-state/store';
import type { Input, ToolGenerator, ToolResult } from './types';

export interface RunningTool {
  toolId: string;
  feedInput(input: Input): void;
  abort(): void;
  done(): Promise<ToolResult>;
}

export function startTool(toolId: string, generatorFactory: () => ToolGenerator): RunningTool {
  const generator = generatorFactory();
  let pendingResolve: ((input: Input) => void) | null = null;
  let resultPromise: Promise<ToolResult>;
  let aborted = false;

  function nextInput(): Promise<Input> {
    return new Promise<Input>((resolve) => {
      pendingResolve = resolve;
    });
  }

  resultPromise = (async (): Promise<ToolResult> => {
    editorUiActions.setActiveToolId(toolId);
    let nextValue: Input | undefined;
    try {
      while (true) {
        if (aborted) {
          await generator.return({ committed: false, reason: 'aborted' });
          return { committed: false, reason: 'aborted' };
        }
        const yielded = nextValue === undefined ? await generator.next() : await generator.next(nextValue);
        if (yielded.done) {
          return yielded.value;
        }
        const prompt = yielded.value;
        editorUiActions.setPrompt(prompt.text, prompt.subOptions ?? [], prompt.defaultValue ?? null);
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
    }
  })();

  return {
    toolId,
    feedInput(input: Input): void {
      if (pendingResolve) {
        const r = pendingResolve;
        pendingResolve = null;
        r(input);
      }
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
