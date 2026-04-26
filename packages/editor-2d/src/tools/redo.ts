import { projectStore } from '@portplanner/project-store';

import type { ToolGenerator } from './types';

export async function* redoTool(): ToolGenerator {
  projectStore.temporal.getState().redo();
  return { committed: true, description: 'redo' };
}
