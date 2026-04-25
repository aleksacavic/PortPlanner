import { projectStore } from '@portplanner/project-store';

import type { ToolGenerator } from './types';

export async function* undoTool(): ToolGenerator {
  // Undo via zundo temporal middleware (per ADR-015 + ADR-020 / I-47).
  projectStore.temporal.getState().undo();
  return { committed: true, description: 'undo' };
}
