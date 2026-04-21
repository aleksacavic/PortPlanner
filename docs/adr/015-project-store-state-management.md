# ADR-015 — Project Store and State Management Scope

**Status:** ACCEPTED
**Date:** 2026-04-21

## Context

Milestone 1.2 introduces the first stateful machinery in the codebase.
ADR-012 pinned **Zustand + `zundo`** as the state-management stack.
ADR-010 defines the **project sync model** (operation log, object-level
last-write-wins). ADR-014 defines **persistence** (IndexedDB + `idb` in
M1; Postgres + PostGIS server-side later). None of these ADRs pins the
*specifics of how the project store is composed*:

- Which parts of state are captured by `zundo`'s undo history?
- Is Immer middleware adopted for reducer ergonomics?
- Is `zustand-persist` (or any automatic persistence middleware) allowed?
- How is `@portplanner/project-store-react` declared so it does not pull
  in its own React instance?

Each decision is **load-bearing**:
- Wrong `zundo` scope corrupts the Ctrl+Z UX (e.g., Ctrl+Z undoes a
  *selection change* rather than a *drawing action*).
- Wrong persistence approach fights ADR-014's canonical-JSON + IndexedDB
  story by owning a second persistence channel.
- Wrong reducer discipline makes the codebase noisy and bug-prone when
  mutating nested project structures.
- Wrong React packaging causes the "multiple React copies detected"
  runtime error that breaks hooks.

This ADR scopes all four. It does not supersede ADR-012 (which remains
the authority on Zustand as the library choice) — it constrains the
usage of that library.

Landed alongside the GR-3 extension that adds `packages/project-store`
and `packages/project-store-react` to the allowed dependency graph (see
`docs/procedures/Claude/00-architecture-contract.md` §0.4).

## Options considered

### 1. `zundo` undo-history scope

- **A. Project slice only.** Only mutations to the `Project` value are
  recorded. Selection, active tool, viewport pan/zoom are excluded.
- **B. Entire store.** Every state change becomes an undo step.
- **C. Opt-in per slice.** Middleware wrapping decides per slice.

### 2. Immer middleware adoption

- **A. Adopt via `zustand/middleware` immer helper.** Reducers can write
  `draft.objects[id] = newObj` instead of spreading manually.
- **B. Manual spreads only.** `set({ ...state, objects: { ...state.objects, [id]: newObj } })`.
- **C. Hand-written deep-clone helpers.** Worst of both worlds.

### 3. Third-party persistence middleware

- **A. Ban `zustand-persist` and any auto-persistence.** ADR-014's
  IndexedDB + `idb` wrapper is the sole persistence authority.
  Save/load triggered explicitly via UI.
- **B. Adopt `zustand-persist`.** Middleware automatically syncs to
  `localStorage` / `sessionStorage` / IndexedDB.
- **C. Hybrid.** Use `zustand-persist` for UI state; ADR-014 for the
  project.

### 4. React packaging for `project-store-react`

- **A. React as `peerDependency` only.** `project-store-react` declares
  `"peerDependencies": { "react": "..." }` and does NOT declare
  `"dependencies": { "react": "..." }`. The consumer (apps/web)
  provides React.
- **B. React as direct dependency.** `project-store-react` bundles its
  own React.
- **C. React as both.** Defensive but confusing.

## Decision

| # | Area | Choice | Rationale |
|---|------|--------|-----------|
| 1 | `zundo` scope | **Project slice only.** Selection, active tool, viewport pan/zoom, hover, snap preview, dimension preview — all EXCLUDED from history. | Ctrl+Z expected semantics: "undo the last drawing action I took", not "undo my selection change". Tracking ephemeral UI state creates noise, surprise, and broken mental models. Project mutations (object create/update/delete, classification change, parameter edit, ownership transition) are the true undo units per ADR-010's operation log. |
| 2 | Immer | **Adopt** via `zustand/middleware` immer. | `Project` is deeply nested (objects map, per-object `parameters` JSONB, nested coordinate configs). Manual spreads get verbose and error-prone for nested updates. Immer's draft-mutation style reads cleanly and eliminates a class of "forgot to spread this level" bugs. Bundle cost ~8 KB gzipped; acceptable. |
| 3 | Persistence | **BAN `zustand-persist` and all auto-persistence middleware.** ADR-014 (IndexedDB + `idb` + canonical JSON) is the sole persistence authority. Save/load is triggered explicitly from UI; no middleware writes to any storage on state change. | `zustand-persist` aggressively owns storage channels (`localStorage` by default, optionally IndexedDB). Letting it run alongside ADR-014's canonical-JSON + per-project-ID IndexedDB store would create two persistence writers with different serialisation conventions, guaranteed drift. The IndexedDB write step needs access to the canonical serialiser defined in `packages/domain` — `zustand-persist` can't call that. Explicit save triggers are correct for a CAD-like tool anyway: users expect "Save" to mean something. |
| 4 | React in `project-store-react` | **`peerDependencies` only.** `package.json` lists React ONLY under `peerDependencies`; NEVER under `dependencies`. | Prevents `project-store-react` from pulling in its own React instance at a different version from apps/web's React. Dual React instances break hooks (the "invalid hook call" / "multiple React copies" error). `peerDependencies` signals "the consumer provides React; versions must agree." |

### Concrete usage contract

- The project store is defined in `packages/project-store/src/` as a
  vanilla Zustand store (imported from `zustand/vanilla`), wrapped by
  `zundo`'s middleware scoped to the `project` slice only, and by
  `zustand/middleware`'s `immer` helper for the same slice.
- The store exposes `subscribe(listener)` and `getState()` — the vanilla
  Zustand API. Actions (`createNewProject`, `hydrateProject`, `markSaved`,
  and later `placeObject` / `moveObject` / etc.) are plain functions also
  exported from `packages/project-store`. **Canvas paint loops and other
  non-React consumers import from `packages/project-store` directly** —
  they do NOT need the React bindings.
- `packages/project-store-react/src/` exposes React hooks that wrap the
  same vanilla store via `useSyncExternalStore`:
  - `useProject()` → the current `Project`
  - `useProjectId()` → the current project id
  - `useObjectById(id)` → a specific object (selector pattern)
  - `useIsDirty()` → dirty flag
  - `useLastSavedAt()` → last-save timestamp
  - additional selectors land per milestone need

  **Hooks live only in `project-store-react`. Actions live only in
  `project-store`. Consumers import from where each lives.** No re-export
  pattern is required or recommended.
- UI state (selection, active tool, viewport pan/zoom) in M1.2 is
  **not yet in scope** because the canvas does not exist. When added in
  M1.3, it lives in a SEPARATE store (`packages/ui-state/` or similar)
  with its own semantics — no `zundo`, no Immer required, no persistence.
  That decision gets its own ADR when the need is real.
- Persistence (save/load) is implemented in `apps/web/src/persistence/`
  per ADR-014. It calls `projectStore.getState()` to read the current
  project and the canonical serializer from `packages/domain` to encode
  it. There is no persistence middleware inside the store package.

### Test isolation

Module-level singletons (how Zustand is typically exported) share state
across tests. The project-store MUST expose a reset helper:

```ts
// packages/project-store/src/index.ts
export function resetProjectStoreForTests(): void {
  projectStore.setState(createInitialProjectState(), true);
}
```

Tests call it in `beforeEach`. This is the official Zustand-recommended
pattern for singleton stores.

## Consequences

- Ctrl+Z behaves as users expect: only project-level drawing / edit
  actions are undoable. Selection, tool switches, and viewport pans are
  not tracked.
- Reducer code in `project-store` stays readable via Immer mutations.
- Persistence is single-sourced through ADR-014; no drift between two
  storage writers.
- `project-store-react` is safely importable from any package (apps/web,
  editor-2d React components, viewer-3d React components) without causing
  dual-React runtime errors.
- GR-3 extension ensures canvas paint loops never accidentally pull
  React through the store layer.
- The vanilla/React split mirrors Zustand's own `zustand/vanilla` +
  `zustand` entry pattern and the Redux + react-redux pattern; imports
  make consumer intent explicit.

## What this makes harder

- If a future milestone decides Ctrl+Z should also revert a selection
  change (unlikely but possible for specific UX patterns), a superseding
  ADR is required — plus either widening `zundo`'s scope or adding a
  secondary undo stack for UI state. Both are non-trivial.
- Immer adds ~8 KB gzipped to the bundle. Acceptable; noted.
- Banning `zustand-persist` means we forgo its conveniences
  (`partialize`, `version` migrations, `storage` abstraction). We must
  let `apps/web/src/persistence/` handle them via ADR-014's wrapper.
  Migrations are deferred to when schema versioning becomes real.
- `peerDependencies` discipline means adding `project-store-react` to
  any new app requires that app to also install React — a harmless
  duplication in `package.json` that pnpm workspaces handle naturally.
- Two workspace packages (`project-store` + `project-store-react`)
  instead of one. ~6 extra scaffold files total; amortised benefit via
  enforced vanilla-vs-React boundary.

## Cross-references

- **ADR-010** Project Sync and Offline Model — defines the operation
  log structure that `zundo` captures as undo steps.
- **ADR-012** Technology Stack — pins Zustand + `zundo` + Immer as
  libraries; this ADR scopes their application.
- **ADR-014** Persistence Architecture — sole authority for project
  save/load. `zustand-persist` ban exists to keep that authority
  un-contested.
- **`docs/procedures/Claude/00-architecture-contract.md` §0.4 (GR-3)**
  — lists `packages/project-store` and `packages/project-store-react`
  in the allowed dependency graph with the canvas-no-React grep gate.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.1.0 | 2026-04-22 | Renamed "document store" → "project store" + "doc-store" packages → "project-store" packages (also ADR title, body, cross-refs). Dropped the action re-export pattern from the concrete usage contract — hooks live only in `project-store-react`, actions live only in `project-store`, consumers import from where each lives. Semantics unchanged. |
| 1.0.0 | 2026-04-21 | Initial ADR. Scopes `zundo` to project slice only; adopts Immer; bans `zustand-persist`; mandates React as peerDependency in `project-store-react`. |
