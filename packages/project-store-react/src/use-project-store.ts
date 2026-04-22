// Internal React adapter over the vanilla projectStore. All public
// hooks are thin selectors over this. Uses useSyncExternalStore
// (React 18+) which is what zustand/react uses under the hood.

import { type ProjectStoreState, projectStore } from '@portplanner/project-store';
import { useSyncExternalStore } from 'react';

export function useProjectStoreSelector<T>(selector: (state: ProjectStoreState) => T): T {
  return useSyncExternalStore(projectStore.subscribe, () => selector(projectStore.getState()));
}
