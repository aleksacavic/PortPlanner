// Vanilla Zustand store per ADR-015 — no React. zundo temporal
// middleware scoped to the `project` slice only. Immer middleware for
// ergonomic mutations on nested structures.

import { temporal } from 'zundo';
import { immer } from 'zustand/middleware/immer';
import { createStore } from 'zustand/vanilla';

import { type ProjectStoreState, createInitialProjectStoreState } from './initial-state';

/**
 * The singleton project store. Exported for:
 *   - the React bindings in @portplanner/project-store-react to wrap
 *     via useSyncExternalStore
 *   - canvas paint loops / 3D scene loops / tests / future workers
 *     to subscribe directly via `projectStore.subscribe(...)`
 *
 * zundo's `temporal` is scoped to the `project` slice only —
 * `dirty` and `lastSavedAt` are excluded from undo history per
 * ADR-015 decision #1. Selection, active tool, viewport (when they
 * land in M1.3) live in a separate store, not here.
 */
export const projectStore = createStore<ProjectStoreState>()(
  temporal(
    immer(() => createInitialProjectStoreState()),
    {
      partialize: (state) => ({ project: state.project }) as ProjectStoreState,
    },
  ),
);

// Vite HMR guard — in dev, accept module reloads so the singleton
// store survives hot updates. In production builds `import.meta.hot`
// is undefined and this is a no-op. Covers Round 1 Q2 concern.
// Typed locally so this package stays Vite-type-agnostic.
const viteHot = (import.meta as { hot?: { accept: () => void } }).hot;
if (viteHot) {
  viteHot.accept();
}
