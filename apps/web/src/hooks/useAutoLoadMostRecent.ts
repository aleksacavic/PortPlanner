// M1.2 Phase 5 — one-shot cold-start auto-load.
// On mount, if no project is in the store, load the most recently
// updated record from IndexedDB and hydrate it. Guarded against a race
// where the user clicked "New" while the load was in flight: we
// re-check `projectStore.getState().project === null` immediately
// before calling hydrateProject.

import { hydrateProject, projectStore } from '@portplanner/project-store';
import { useEffect } from 'react';

import { loadMostRecent } from '../persistence';

export function useAutoLoadMostRecent(): void {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (projectStore.getState().project !== null) {
        return;
      }
      const result = await loadMostRecent();
      if (cancelled || result === null) {
        return;
      }
      // Race guard: don't clobber a project the user created while we
      // were awaiting IndexedDB.
      if (projectStore.getState().project !== null) {
        return;
      }
      hydrateProject(result.project, result.lastSavedAt);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
