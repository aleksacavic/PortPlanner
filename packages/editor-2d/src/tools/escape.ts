import type { ToolGenerator } from './types';

// `escape` is handled at the keyboard router level (router.ts injects
// { kind: 'escape' } into the active tool's runner). This file is the
// no-op tool generator that lives in the registry for completeness.

export async function* escapeTool(): ToolGenerator {
  return { committed: false, reason: 'aborted' };
}
