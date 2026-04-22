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
      let result: Awaited<ReturnType<typeof loadMostRecent>>;
      try {
        result = await loadMostRecent();
      } catch (err) {
        // Malformed / incompatible record in IndexedDB must not crash
        // the app or escape as an unhandled rejection (Codex Round 1
        // H2 remediation). Leave the store empty so the user can
        // create a fresh project; surface details in console only.
        console.error('[useAutoLoadMostRecent] failed to load most-recent project:', err);
        return;
      }
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
