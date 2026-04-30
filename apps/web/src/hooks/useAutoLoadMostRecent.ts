// M1.2 Phase 5 — one-shot cold-start auto-load.
// On mount, if no project is in the store, load the most recently
// updated record from IndexedDB and hydrate it. Guarded against a race
// where the user clicked "New" while the load was in flight: we
// re-check `projectStore.getState().project === null` immediately
// before calling hydrateProject.
//
// M1.3a Phase 22 follow-up: when nothing exists in IndexedDB on first
// run, bootstrap a default empty project so the running app is
// immediately drawable. The existing "New" toolbar button still lets
// users name and re-create a project; the bootstrap just removes the
// "click before you can draw" friction so `pnpm dev` opens onto a
// usable canvas.

import { LayerId, type Project, defaultLayer, newGridId, newProjectId } from '@portplanner/domain';
import { createNewProject, hydrateProject, projectStore } from '@portplanner/project-store';
import { useEffect } from 'react';

import { loadMostRecent } from '../persistence';

function buildDefaultProject(): Project {
  const now = new Date().toISOString();
  // M1.3d Phase 8 — bootstrap a 5×5m grid on the default layer so the
  // GSNAP modifier has something to snap to out of the box. The grid
  // matches typical container width (~6 m) so the user immediately sees
  // a useful lattice. Disable via Layer Manager → Grid (when grid-
  // properties UI lands; M1.3d ships only the bootstrap default).
  const gridId = newGridId();
  return {
    id: newProjectId(),
    schemaVersion: '1.2.0',
    name: 'Untitled',
    createdAt: now,
    updatedAt: now,
    coordinateSystem: null,
    objects: {},
    primitives: {},
    layers: { [LayerId.DEFAULT]: defaultLayer() },
    grids: {
      [gridId]: {
        id: gridId,
        origin: { x: 0, y: 0 },
        angle: 0,
        spacingX: 5,
        spacingY: 5,
        layerId: LayerId.DEFAULT,
        visible: true,
        activeForSnap: true,
      },
    },
    scenarioId: null,
  };
}

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
      if (cancelled) {
        return;
      }
      // Race guard: don't clobber a project the user created while we
      // were awaiting IndexedDB.
      if (projectStore.getState().project !== null) {
        return;
      }
      if (result === null) {
        // No saved record — bootstrap an empty default project so the
        // user can draft immediately.
        createNewProject(buildDefaultProject());
        return;
      }
      hydrateProject(result.project, result.lastSavedAt);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
