// Module-level singleton stores share state across tests. Tests MUST
// call resetProjectStoreForTests() in `beforeEach` (or rely on the
// afterEach hook in tests/setup.ts) to avoid cross-test pollution.

import { createInitialProjectStoreState } from './initial-state';
import { clearOperationLog } from './operation-emit';
import { projectStore } from './store';

export function resetProjectStoreForTests(): void {
  projectStore.setState(createInitialProjectStoreState(), true);
  projectStore.temporal.getState().clear();
  clearOperationLog();
}
