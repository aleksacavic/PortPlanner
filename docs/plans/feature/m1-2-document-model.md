# Plan — M1.2 Document Model

**Branch:** `feature/m1-2-document-model`
**Author:** Claude (Opus 4.7, 1M context)
**Date:** 2026-04-21
**Status:** Authored — awaiting review
**Operating mode:** Procedure 01 (PLAN-ONLY) → Procedure 03 (EXECUTION) after approval

---

## 1. Request summary

Deliver the document model plumbing so a user can create a project,
save it, hard-refresh the browser, auto-load it back, and verify the
document is byte-identical. No canvas, no geometry, no object types
yet — that's M1.3 and M1.4.

This is the second of four M1 slices (M1.1 Foundation shipped ✓ →
**M1.2 Document Model** → M1.3 2D Editor Shell → M1.4 RTG_BLOCK).

## 2. Assumptions and scope clarifications

Answered via pre-plan user decisions and Codex second-opinion review:

| # | Question | Decision |
|---|---|---|
| 1 | Store placement | **Two-package split per ADR-015**: `packages/doc-store` (vanilla Zustand + zundo + Immer, no React) and `packages/doc-store-react` (React hooks wrapping doc-store). React as peerDependency in `doc-store-react`. Rationale: lets editor-2d (M1.3) and viewer-3d (M5) subscribe to the store from canvas paint loops without transitively importing React. Codex's recommendation, agreed. |
| 2 | Coordinate-system input in New Project dialog | **Defer geodetic anchor to M1.3+.** M1.2 initialises documents with origin `(0, 0)` project-local metres and rotation `0°`. Geodetic UI (lat/lon, UTM, basemap anchor) lands when the canvas exists and can show an origin marker / north arrow. |
| 3 | Multi-project UX in M1.2 | **Deferred to M2 per execution plan.** M1.2 is single-active-project: New Project replaces the current (with unsaved-changes confirm); Save writes under current project id; cold start auto-loads the most recently saved project. No Load dropdown, no project enumeration UI. |
| 4 | zundo scope | **Document slice only** per ADR-015. Selection, active tool, viewport — out of undo history. Not yet applicable in M1.2 (no canvas, no ephemeral UI state). |

Other assumptions:

- Persistence caller lives in `apps/web/src/persistence/` per ADR-014
  (M1 client-side persistence; server + Postgres + PostGIS ships M3+).
- IndexedDB wrapper: `idb` library (ADR-014 default).
- Zod is the schema-validation library per ADR-012.
- UUIDv7 via the `uuid` npm package (v11+ supports v7 natively).
- `packages/domain` remains pure: no React, no Zustand, no IndexedDB.
  Only types, Zod schemas, UUID generator, canonical-JSON serializer,
  and pure logic.

## 3. Scope and Blast Radius

### In scope

**Files to be created — `packages/domain/`:**

- `src/types/project-document.ts`
- `src/types/coordinate-system.ts`
- `src/types/object.ts` (base contract per ADR-002; object-type-specific
  refinements land in M1.4 with RTG_BLOCK)
- `src/types/ownership.ts` (OwnershipState enum)
- `src/types/operation.ts` (Operation shape per ADR-010)
- `src/types/index.ts`
- `src/ids.ts` (UUIDv7 generator + `ProjectId` / `ObjectId` branded types)
- `src/schemas/project-document.schema.ts`
- `src/schemas/coordinate-system.schema.ts`
- `src/schemas/object.schema.ts` (base schema; extensible per object type)
- `src/schemas/operation.schema.ts`
- `src/schemas/index.ts`
- `src/serialize.ts` (canonical JSON `serialize(doc)` + `deserialize(str)`)
- `tests/ids.test.ts`
- `tests/schemas.test.ts`
- `tests/serialize.test.ts`
- `vitest.config.ts`
- `tests/setup.ts`
- `packages/domain/src/index.ts` replacing the current `export {}` stub

**Files to be created — `packages/doc-store/`** (new package):

- `package.json` (name: `@portplanner/doc-store`, depends on
  `@portplanner/domain`, `zustand`, `zundo`, `immer`)
- `tsconfig.json` (extends root base)
- `vitest.config.ts`
- `src/initial-state.ts` (`createInitialDocumentState`)
- `src/store.ts` (vanilla Zustand store with zundo + Immer middleware,
  scoped per ADR-015 to document slice only)
- `src/actions.ts` (explicit mutator functions: `setDocument`,
  `renameDocument`, minimal set for M1.2)
- `src/persistence-bridge.ts` (subscribes to doc store and emits a
  dirty-state signal consumed by UI; does NOT persist itself — ADR-014
  is the authority)
- `src/test-utils.ts` (`resetDocStoreForTests()` per ADR-015)
- `src/index.ts`
- `tests/store.test.ts`
- `tests/zundo.test.ts`
- `tests/persistence-bridge.test.ts`
- `tests/setup.ts`

**Files to be created — `packages/doc-store-react/`** (new package):

- `package.json` (name: `@portplanner/doc-store-react`, depends on
  `@portplanner/doc-store`, `@portplanner/domain`; React as
  **`peerDependencies` only** per ADR-015)
- `tsconfig.json`
- `vitest.config.ts`
- `src/use-doc-store.ts` (internal `useSyncExternalStore` wrapper)
- `src/hooks/useDocument.ts`
- `src/hooks/useDocumentId.ts`
- `src/hooks/useObjectById.ts` (selector pattern — returns undefined in
  M1.2 since no objects exist; usable from M1.4 onward)
- `src/hooks/useIsDirty.ts`
- `src/hooks/index.ts`
- `src/index.ts`
- `tests/hooks.test.tsx`
- `tests/setup.ts`

**Files to be created — `apps/web/`:**

- `src/persistence/doc-persistence.ts` (idb wrapper: `saveProject`,
  `loadProject`, `loadMostRecent`)
- `src/persistence/storage-keys.ts`
- `src/persistence/index.ts`
- `src/dialogs/NewProjectDialog.tsx` + `.module.css`
- `src/dialogs/ConfirmDialog.tsx` + `.module.css` (unsaved-changes warn)
- `src/toolbar/SaveButton.tsx` + `.module.css`
- `src/toolbar/NewProjectButton.tsx` + `.module.css`
- `src/hooks/useAutoLoadMostRecent.ts`
- `src/hooks/useBeforeUnloadGuard.ts`
- `tests/persistence.test.ts`
- `tests/new-project-dialog.test.tsx`
- `tests/save-button.test.tsx`
- `tests/auto-load.test.tsx`

**Files to be modified — `apps/web/`:**

- `src/main.tsx` — initialise docStore, call `useAutoLoadMostRecent`
  before first render (or in a mount effect)
- `src/App.tsx` — wire DocStore + ConfirmDialog outlet
- `src/shell/Navbar.tsx` — populate `controls` region with
  NewProjectButton + SaveButton (previously empty per M1.1 plan)
- `src/shell/Navbar.module.css` — adjust controls flex layout
- `src/shell/StatusBar.tsx` — read project name and dirty state;
  render "Unsaved changes" vs "Saved HH:MM" vs "No project"
- `src/shell/StatusBar.module.css` — add styles for dirty indicator
- `package.json` — add dependencies (`idb`, `fake-indexeddb` for tests,
  `@portplanner/doc-store`, `@portplanner/doc-store-react`)
- `vitest.config.ts` — add `fake-indexeddb/auto` to setupFiles if the
  tests need global patching

**Root files modified:**

- `package.json` — add workspace deps only; root devDeps unchanged
- `pnpm-lock.yaml` — regenerated by `pnpm install`
- `pnpm-workspace.yaml` — no change (already globs `packages/*`)

### Files to be modified — not expected

- ADRs 001–015 — no supersede expected; implementation conforms
- Extraction registry — untouched (no extractors in M1.2)
- `docs/design-tokens.md` — untouched (UI additions use existing tokens)
- `docs/glossary.md` — may need small additions (see §6 below)
- `docs/coordinate-system.md` — may need TS-field-name clarification
  (see §6 below)
- `docs/procedures/**` — untouched
- M1.1 files (`apps/web/src/shell/*`) — only Navbar and StatusBar change

### Out of scope (explicitly deferred)

| Item | Pushed to |
|---|---|
| Geodetic coordinate system UI (lat/lon, UTM, basemap anchor) | M1.3 or later |
| Canvas rendering, view transform, tool system | M1.3 |
| Object types (RTG_BLOCK, etc.), extractors, validators | M1.4 |
| Load dropdown / project enumeration UI | M2 |
| Export project file (download .json) | M2 |
| Import project file (upload .json) | M2 |
| Server + Postgres + PostGIS persistence | M3+ |
| Real-time sync, multi-user, CRDT | M3+ / deferred |
| Operation log applier + inverter machinery | M1.3 or M1.4 (when real mutations emit Operations) |
| Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts | M1.3 (when there's something meaningful to undo) |
| `packages/editor-2d`, `packages/viewer-3d` package creation | M1.3, M5 |
| Light theme, theme switcher | M5 |
| `packages/ui-state` (selection, active tool, viewport) | M1.3 |

### Blast radius

| Area | Effect |
|---|---|
| Packages created | **`packages/doc-store`** (new), **`packages/doc-store-react`** (new) |
| Packages filled in | `packages/domain` (was empty scaffold, now has types + ids + schemas + serializer) |
| Packages modified | `apps/web` (persistence + dialog + toolbar + status-bar signal) |
| Cross-object extractors | None touched — no extractors yet |
| Scenarios | None touched |
| Stored data (client-side) | **First time IndexedDB is used.** New object store `projects` (key: `project_id`, value: canonical JSON blob). No pre-existing data to migrate. |
| UI surfaces | Navbar (adds buttons), StatusBar (adds dirty indicator), new NewProjectDialog + ConfirmDialog modals |

## 4. Binding specifications touched

| Spec | Role in this plan |
|---|---|
| **ADR-002** Object Model | Implement `ProjectDocument` and base `Object` shape in TypeScript. Analysis / cost bindings NOT on the object (per ADR-002). JSONB `parameters` field typed as `Record<string, unknown>` awaiting per-type refinement in M1.4. |
| **ADR-003** Ownership States | Implement `OwnershipState` enum (`AUTHORED` / `GENERATED` / `FROZEN` / `DETACHED`). No transitions performed in M1.2 (no objects yet), but the type exists for M1.4 consumers. |
| **ADR-004** Extraction Contract | Not touched. No extractors in M1.2. |
| **ADR-010** Document Sync | Implement `Operation` type and document-sync contract. `Operation` is defined; **no operations are emitted in M1.2 because no document-level mutations exist beyond full doc creation.** The op-log applier/inverter lands in M1.3/M1.4 when real mutations arrive. |
| **ADR-011** UI Stack | Consume existing `ThemeProvider` + CSS-module pattern. No change. |
| **ADR-012** Technology Stack | Apply: Zustand, zundo, Immer, Zod, UUIDv7, JSON canonical. Every library choice traces to an ADR-012 decision. |
| **ADR-014** Persistence Architecture | Implement the M1 branch: IndexedDB + `idb` wrapper, keyed by `project_id`, JSON canonical body. `apps/web/src/persistence/` is the caller; `packages/domain` provides the serializer; `packages/doc-store` is persistence-agnostic. |
| **ADR-015** Document Store State Management | Apply literally: vanilla Zustand + zundo (document slice only) + Immer; ban `zustand-persist`; React as peerDependency in `doc-store-react`; canvas-no-React grep gate satisfied trivially (editor-2d/viewer-3d don't exist yet). |
| **Architecture contract** §0.4 GR-3 | Consumes the freshly-extended dep graph (doc-store, doc-store-react). No boundary violations expected. |
| **Design tokens v1.2.0** | All UI additions use existing semantic tokens. No new tokens required. |
| **Coordinate system ref** `docs/coordinate-system.md` | Implementation introduces `CoordinateSystem` TS type. Doc may need a small clarification mapping TS field names (`origin`, `rotationDeg`) to conceptual terms (`project origin`, `true-north rotation`) — addressed in §6. |

## 5. Architecture Doc Impact

Explicit table of every document that may be updated during execution,
per Procedure 01 §1.6 and §0.5 spec-update rule:

| Doc | Path | Anticipated change | Reason |
|-----|------|-------------------|--------|
| ADR-002 Object Model | `docs/adr/002-object-model.md` | **No change** | Implementation conforms. Concrete TS field names added to code; the ADR's schema is definitional, not implementation-level. |
| ADR-003 Ownership States | `docs/adr/003-ownership-states.md` | **No change** | Enum values match ADR exactly (`AUTHORED`, `GENERATED`, `FROZEN`, `DETACHED`). |
| ADR-010 Document Sync | `docs/adr/010-document-sync.md` | **No change** | `Operation` type + op log shape follow ADR-010. If implementation reveals a genuine gap (e.g., a field ADR-010 doesn't enumerate), pause per §3.10 and follow §0.7. |
| ADR-012 Technology Stack | `docs/adr/012-technology-stack.md` | **No change** | All library choices pin exactly; no versions bumped. |
| ADR-014 Persistence | `docs/adr/014-persistence-architecture.md` | **No change** | `idb` wrapper + canonical JSON + per-project key all match ADR-014 M1 branch. |
| ADR-015 Doc Store | `docs/adr/015-document-store-state-management.md` | **No change** | Just landed; implementation conforms. |
| `docs/coordinate-system.md` | `docs/coordinate-system.md` | **Possible: patch to map TS field names** | When `CoordinateSystem.origin` and `CoordinateSystem.rotationDeg` land in TS, the reference doc may want a small section naming the field conventions. Only patched if a Codex reviewer or a fresh reader finds the mapping ambiguous. Handled per §0.5 (same-commit update if it happens). No version bump — the doc doesn't carry one. |
| `docs/glossary.md` | `docs/glossary.md` | **Possible: append new terms** | Candidate additions: "canonical JSON form" (deterministic key-order + number format); "document dirty state" (transient unsaved flag). Only appended if Phase 1 or 5 introduces the term in code/UI. Handled per §0.5 (append + date in-line). |
| `docs/design-tokens.md` | `docs/design-tokens.md` | **No change** | All UI additions (NewProjectDialog, buttons, dirty indicator) use existing semantic tokens. No new tokens proposed. |
| Extraction registry | `docs/extraction-registry/*.md` | **No change** | No extractors in M1.2. |
| Procedures | `docs/procedures/**` | **No change** | No procedure gaps anticipated. If one surfaces during execution, it goes on its own chore branch per the established pattern. |
| ADR Index | `docs/adr/README.md` | **No change** | ADR-015 was added on the chore branch; no further ADRs expected in M1.2. |
| Plan file | `docs/plans/feature/m1-2-document-model.md` | **This plan, updated in-place with PE notes per §3.7 during execution.** | PE notes record mid-execution corrections. |

**Explicit rule:** if any unexpected change to a binding doc is
required during execution, the author MUST stop per Procedure 03 §3.10
and surface a proposed plan patch before proceeding.

## 6. Deviations from binding specs

**None.** This plan implements binding specs literally. No §0.7
deviation proposed.

## 7. Object Model and Extraction Integration

Applicable parts:

- **Object contract compliance (ADR-002):** the M1.2 `Object` type is
  the base shape — `id`, `type`, `classification`, `geometry`,
  `parameters`, `ownership`, `libraryRef?`. Typed core fields are
  first-class; extensible `parameters` is `Record<string, unknown>`
  in M1.2 (awaiting per-type Zod schemas from M1.4's RTG_BLOCK).
  **No analysis bindings or cost bindings on the object record** per
  ADR-002; those are separate records that don't exist yet.
- **Library traceability (ADR-005):** `libraryRef?: LibrarySnapshotRef`
  field is declared optional on Object. No library infrastructure in
  M1.2; the field stays undefined until M3.

Not applicable:

- **Extraction contract (ADR-004):** no extractors, no registry touches
  in M1.2.
- **Validation rules (ADR-007):** no rules registered; no object types
  to validate beyond base shape.
- **Mesh descriptor (ADR-008):** no 3D in M1.2.
- **Ownership state transitions (ADR-003):** enum defined; no
  transitions performed (no objects exist yet). Transition logic is
  M1.4 when RTG_BLOCK objects start being AUTHORED.

## 8. Hydration, Serialization, Undo/Redo, Sync

### Hydration (document load path)

- `loadProject(id)` reads the IndexedDB value under key `id`
- Raw value is a string (canonical JSON blob) → `JSON.parse` →
  Zod `ProjectDocumentSchema.parse(raw)` → `Document` object
- Unknown fields in stored JSON are **stripped** by Zod `.strict()`
  versus `.passthrough()`. M1.2 uses `.strict()` on `ProjectDocument`
  and `.passthrough()` on `Object.parameters` (JSONB bag per ADR-002).
- Zod parse errors surface as `LoadFailure` with a user-friendly
  message (`"This project file is from an incompatible version"`)
- After successful parse: `docStore.setState({ document: parsed, dirty: false })`
- `useAutoLoadMostRecent()` runs once on app mount; if IndexedDB has a
  most-recent entry and no current document, it loads.

### Serialization (document save path)

- `serialize(doc): string` in `packages/domain/src/serialize.ts`:
  - Sort object keys recursively before stringifying
  - Numbers serialised via `String(n)` (preserves integer representation;
    floats use default JS formatting — M1.2 does not yet have floats in
    the document since no geometry exists; revisit if floats introduced
    before M1.4's geometry)
  - Arrays preserve order (array order is meaningful)
  - Output: single-line, minified canonical JSON
- Round-trip: `serialize(deserialize(serialize(doc))) === serialize(doc)`
  is the determinism invariant. Tested.
- NOT written: nothing. In M1.2 the document is leaf-only (no
  extracted quantities, no mesh descriptors, no validation results
  exist yet). ADR-002's "derived fields stay off the object" is
  trivially satisfied.
- `scenario_id` (ADR-006) is a top-level `ProjectDocument` field
  declared as `string | null`. Always `null` in M1.2 (no scenarios yet).

### Undo/Redo (operation log)

- zundo wraps the **`document` slice only** per ADR-015.
- In M1.2, document mutations are:
  - `createDocument(initialState)` — not undoable (it's a fresh-start
    action; zundo history resets on it)
  - `renameDocument(newName)` — potentially undoable, but no UI
    surfaces this in M1.2 (rename-via-dialog is M2's "Project Settings")
- **Practically, M1.2 has no user-facing undo.** Infrastructure is in
  place (zundo middleware + temporal slice); keyboard shortcuts
  (Ctrl+Z, Ctrl+Shift+Z) land in M1.3 or M1.4 when canvas mutations
  create real undo steps.
- `Operation` type is defined in `packages/domain/src/types/operation.ts`
  per ADR-010 shape but no operations are **emitted** in M1.2. The
  store's `setState` calls are the minimal primitive; explicit
  Operation dispatch lands with the first real mutation in M1.3.

### Sync (ADR-010)

- M1.2 is **single-user, single-client, no server**.
- Last-write-wins at object level is trivially satisfied (no concurrent
  writers).
- The IndexedDB write is the source of truth for an offline single-client
  M1 project.
- Operation log flush on reconnect: **not implemented** (no server to
  flush to). The infrastructure for this ships with M3+.

## 9. Implementation phases

Five phases. Each phase MUST pass every listed gate before the next
begins. Per Procedure 03 §3.2, gate failure requires fix-within-phase
and re-run of ALL phase gates.

---

### Phase 1 — Domain types + UUIDv7 + Zod schemas + canonical serializer

**Goal:** Fill `packages/domain` with the foundational types,
validation schemas, ID generator, and canonical-JSON serializer.
Zero runtime dependencies on React, Zustand, or IndexedDB.

**Files created in this phase:**

All under `packages/domain/`:

- `src/types/project-document.ts` (ProjectDocument interface)
- `src/types/coordinate-system.ts` (CoordinateSystem interface)
- `src/types/object.ts` (Object base contract per ADR-002)
- `src/types/ownership.ts` (OwnershipState enum)
- `src/types/operation.ts` (Operation type per ADR-010)
- `src/types/index.ts`
- `src/ids.ts` (UUIDv7 generator, branded `ProjectId` / `ObjectId`)
- `src/schemas/project-document.schema.ts`
- `src/schemas/coordinate-system.schema.ts`
- `src/schemas/object.schema.ts`
- `src/schemas/ownership.schema.ts`
- `src/schemas/operation.schema.ts`
- `src/schemas/index.ts`
- `src/serialize.ts` (canonical JSON `serialize` + `deserialize`)
- `src/index.ts` (replaces the `export {}` stub)
- `tests/ids.test.ts`
- `tests/schemas.test.ts`
- `tests/serialize.test.ts`
- `tests/setup.ts`
- `vitest.config.ts`
- `package.json` (update — add `uuid` and `zod` deps; add test script)

**Dependencies to add (packages/domain/package.json):**

- `uuid: ^11.0.0` (UUIDv7 support)
- `zod: ^3.23.0`
- devDeps: `@types/uuid: ^10.0.0`, `vitest` is workspace-provided

**Steps:**

1. Define `OwnershipState` enum (`'AUTHORED' | 'GENERATED' | 'FROZEN' | 'DETACHED'` — string literals, not TS enum).
2. Define `CoordinateSystem` interface (`origin: { x: number; y: number }`; `rotationDeg: number`; `unit: 'meters'`).
3. Define `Object` base contract per ADR-002: `id: ObjectId`, `type: string`, `classification?: string`, `geometry: unknown` (typed-by-union in M1.4), `parameters: Record<string, unknown>`, `ownership: OwnershipState`, `libraryRef?: { source: string; version: string }`.
4. Define `ProjectDocument`: `id: ProjectId`, `schemaVersion: '1.0.0'`, `name: string`, `createdAt: string` (ISO-8601), `updatedAt: string`, `coordinateSystem: CoordinateSystem`, `objects: Record<ObjectId, Object>`, `scenarioId: string | null`.
5. Define `Operation` per ADR-010: `id: OperationId`, `timestamp: string`, `type: string`, `userId?: string`, `objectId?: ObjectId`, `before?: unknown`, `after?: unknown`.
6. Branded types for IDs: `ProjectId = string & { readonly __brand: 'ProjectId' }` and `ObjectId`, `OperationId` similarly.
7. UUIDv7 generator in `ids.ts`: `newProjectId()`, `newObjectId()`, `newOperationId()`. Validate-UUIDv7 helpers.
8. Zod schemas matching each type. `ProjectDocumentSchema` uses `.strict()`. `Object.parameters` uses `.passthrough()` per JSONB semantics.
9. Canonical serializer:
   - `serialize(doc: ProjectDocument): string` — sort object keys recursively, emit minified JSON.
   - `deserialize(str: string): ProjectDocument` — `JSON.parse` + `ProjectDocumentSchema.parse`.
10. Tests: deterministic UUIDv7 time-ordering; schema accept/reject branches; serialize round-trip byte-identical on structurally-identical input.
11. `package.json` test script points at `vitest run`.
12. `src/index.ts` re-exports types, ids, schemas, serializer.

**Invariants introduced:**

| ID | Invariant | Enforcement |
|---|---|---|
| D1 | `packages/domain` has zero imports from any other `@portplanner/*` package | Grep G1.1 (existing from M1.1; re-verify) |
| D2 | `packages/domain` has zero imports from React or Zustand | Grep: `rg -n "from 'react'\|from 'zustand'" packages/domain/src` returns zero |
| D3 | UUIDv7 generator produces time-ordered IDs | Unit test `ids.test.ts::sortsByCreation` |
| D4 | `serialize(x) === serialize(deserialize(serialize(x)))` for all valid docs | Unit test `serialize.test.ts::roundTripIdentity` |
| D5 | Zod `ProjectDocumentSchema.parse` rejects missing required fields with clear error | Unit test `schemas.test.ts::rejectsMalformed` |

**Mandatory Completion Gates:**

```
GD.0 — pnpm install succeeds after adding deps
  Command: pnpm install
  Expected: exit 0

GD.1 — domain has zero cross-package imports (re-verify M1.1 gate)
  Command: rg -n "from '@portplanner/(design-system|web|editor-2d|viewer-3d|api|doc-store|doc-store-react)'" packages/domain/src
  Expected: zero matches

GD.2 — domain has zero React / Zustand imports
  Command: rg -n "from 'react'|from 'zustand'|from 'zundo'|from 'immer'" packages/domain/src
  Expected: zero matches

GD.3 — domain typecheck passes
  Command: pnpm --filter @portplanner/domain exec tsc --noEmit
  Expected: exit 0

GD.4 — domain tests pass
  Command: pnpm --filter @portplanner/domain test
  Expected: exit 0, all tests pass

GD.5 — Biome clean on domain files
  Command: pnpm check
  Expected: exit 0
```

**Tests added:** `ids.test.ts` (~5 cases), `schemas.test.ts` (~8
cases covering valid/invalid branches for each schema), `serialize.test.ts`
(~5 cases including round-trip, key-order, number-format).

---

### Phase 2 — `packages/doc-store` (vanilla Zustand + zundo + Immer)

**Goal:** Create the document store as a vanilla Zustand store with
zundo temporal middleware and Immer-based mutations, per ADR-015.
No React. No persistence.

**Files created in this phase:**

- `packages/doc-store/package.json` (name, deps, peerDeps, scripts)
- `packages/doc-store/tsconfig.json`
- `packages/doc-store/vitest.config.ts`
- `packages/doc-store/tests/setup.ts`
- `src/initial-state.ts` (`createInitialDocumentState()`)
- `src/store.ts` (factory + exported singleton)
- `src/actions.ts` (`setDocument`, `renameDocument`, `markSaved`)
- `src/persistence-bridge.ts` (dirty-flag signal)
- `src/test-utils.ts` (`resetDocStoreForTests`)
- `src/index.ts`
- `tests/store.test.ts`
- `tests/zundo.test.ts`
- `tests/persistence-bridge.test.ts`

**Dependencies:**

- `zustand: ^5.0.0` (imports from `zustand/vanilla` and `zustand/middleware`)
- `zundo: ^2.2.0`
- `immer: ^10.0.0`
- `@portplanner/domain: workspace:*`

**Steps:**

1. Define `DocumentState` type: `{ document: ProjectDocument | null; dirty: boolean; lastSavedAt: string | null }`.
2. `createInitialDocumentState(): DocumentState` returns `{ document: null, dirty: false, lastSavedAt: null }`.
3. Implement the store using `create` from `zustand/vanilla`, wrapped with `temporal` (zundo) scoped to the `document` slice and with `immer` middleware. Pattern:
   ```ts
   import { createStore } from 'zustand/vanilla';
   import { temporal } from 'zundo';
   import { immer } from 'zustand/middleware/immer';
   ```
4. Actions in `actions.ts`:
   - `setDocument(doc)` — replaces document (resets zundo history; fresh start)
   - `renameDocument(newName)` — updates `document.name` via Immer draft
   - `markSaved()` — sets `dirty = false`, updates `lastSavedAt`
   - Each action calls `docStore.setState((state) => { … })` with the Immer draft.
5. `persistence-bridge.ts` subscribes to document changes and flips `dirty = true` on any mutation. `markSaved` resets it.
6. `test-utils.ts` exports `resetDocStoreForTests()` that calls `docStore.setState(createInitialDocumentState(), true)`.
7. Tests:
   - `store.test.ts`: `setDocument` sets state; `renameDocument` mutates the name; subscribe listeners fire on change.
   - `zundo.test.ts`: after two renames, `docStore.temporal.getState().undo()` reverts to previous name; verify selection-like state (if any in future) is NOT in history (for M1.2, we just assert the temporal slice ONLY captures `document`).
   - `persistence-bridge.test.ts`: dirty flag flips on mutation, clears on `markSaved`.

**Invariants introduced:**

| ID | Invariant | Enforcement |
|---|---|---|
| S1 | `packages/doc-store` has zero React imports | Grep: `rg -n "from 'react'" packages/doc-store/src` returns zero |
| S2 | `packages/doc-store` has zero persistence imports (`idb`, `localStorage`, `IndexedDB`) | Grep: `rg -n "from 'idb'\|localStorage\|indexedDB" packages/doc-store/src` returns zero |
| S3 | zundo history captures ONLY the `document` slice | Unit test asserts `docStore.temporal.getState().pastStates[0]` has shape `{ document: … }` (no selection, no tool) |
| S4 | `doc-store` imports only from `@portplanner/domain` among workspace packages | Grep: `rg -n "from '@portplanner/(design-system\|web\|editor-2d\|viewer-3d\|api\|doc-store-react)'" packages/doc-store/src` returns zero |

**Mandatory Completion Gates:**

```
GS.0 — pnpm install succeeds with new package
  Command: pnpm install
  Expected: exit 0

GS.1 — doc-store has zero React imports
  Command: rg -n "from 'react'" packages/doc-store/src
  Expected: zero matches

GS.2 — doc-store has zero persistence imports
  Command: rg -n "from 'idb'|localStorage|indexedDB" packages/doc-store/src
  Expected: zero matches (exclude /tests from this gate if test doubles use fake-indexeddb)

GS.3 — doc-store has zero cross-package imports besides domain
  Command: rg -n "from '@portplanner/(design-system|web|editor-2d|viewer-3d|api|doc-store-react)'" packages/doc-store/src
  Expected: zero matches

GS.4 — doc-store tests pass
  Command: pnpm --filter @portplanner/doc-store test
  Expected: exit 0, all tests pass

GS.5 — typecheck + Biome pass
  Command: pnpm typecheck && pnpm check
  Expected: exit 0
```

**Tests added:** ~8 cases across three files (store mechanics, zundo
scope verification, persistence-bridge dirty-flag behaviour).

---

### Phase 3 — `packages/doc-store-react` (React hooks)

**Goal:** Expose the vanilla doc-store through idiomatic React hooks.
React as peerDependency only per ADR-015 to prevent dual-React copies.

**Files created in this phase:**

- `packages/doc-store-react/package.json`
- `packages/doc-store-react/tsconfig.json`
- `packages/doc-store-react/vitest.config.ts`
- `packages/doc-store-react/tests/setup.ts`
- `src/use-doc-store.ts` (internal `useSyncExternalStore` wrapper)
- `src/hooks/useDocument.ts`
- `src/hooks/useDocumentId.ts`
- `src/hooks/useObjectById.ts` (selector; M1.4 consumers)
- `src/hooks/useIsDirty.ts`
- `src/hooks/useLastSavedAt.ts`
- `src/hooks/index.ts`
- `src/index.ts`
- `tests/hooks.test.tsx`

**Dependencies:**

- `@portplanner/doc-store: workspace:*`
- `@portplanner/domain: workspace:*`
- devDeps: `@types/react`, `@types/react-dom`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `react`, `react-dom`, `@vitejs/plugin-react`
- **`peerDependencies`:** `{ "react": "^18.0.0 || ^19.0.0" }` — NO `dependencies.react`

**Steps:**

1. `use-doc-store.ts` exports an internal `useDocStoreSelector<T>(selector: (state: DocumentState) => T): T` using `useSyncExternalStore(docStore.subscribe, () => selector(docStore.getState()))`.
2. Each public hook uses the selector pattern:
   - `useDocument()` → `state.document`
   - `useDocumentId()` → `state.document?.id ?? null`
   - `useObjectById(id)` → `state.document?.objects[id]` (returns undefined if doc is null or id missing)
   - `useIsDirty()` → `state.dirty`
   - `useLastSavedAt()` → `state.lastSavedAt`
3. Hooks are pure re-reads; no side effects. No context provider needed (module-level singleton store per ADR-015).
4. Tests (`hooks.test.tsx`) mount each hook in a test component via `@testing-library/react` `renderHook`, mutate the store, assert re-renders.

**Invariants introduced:**

| ID | Invariant | Enforcement |
|---|---|---|
| R1 | `packages/doc-store-react` lists React ONLY under `peerDependencies` | Grep on `packages/doc-store-react/package.json` — peerDependencies contains `react`; dependencies does NOT contain `react` |
| R2 | `doc-store-react` imports only from `@portplanner/doc-store`, `@portplanner/domain`, and `react` among its deps | Grep: no other `@portplanner/*` imports |

**Mandatory Completion Gates:**

```
GR.0 — pnpm install succeeds
  Command: pnpm install
  Expected: exit 0

GR.1 — React is peerDep only in doc-store-react
  Commands:
    node -e "const p=require('./packages/doc-store-react/package.json'); if(p.dependencies && p.dependencies.react){process.exit(1)}; if(!p.peerDependencies || !p.peerDependencies.react){process.exit(2)}"
  Expected: exit 0

GR.2 — doc-store-react has no cross-package imports besides allowed set
  Command: rg -n "from '@portplanner/(design-system|web|editor-2d|viewer-3d|api)'" packages/doc-store-react/src
  Expected: zero matches

GR.3 — doc-store-react tests pass
  Command: pnpm --filter @portplanner/doc-store-react test
  Expected: exit 0

GR.4 — typecheck + Biome pass
  Command: pnpm typecheck && pnpm check
  Expected: exit 0
```

**Tests added:** ~6 cases (one per hook + edge cases like null doc,
missing object id).

---

### Phase 4 — `apps/web` persistence layer (IndexedDB + `idb`)

**Goal:** Implement the M1 client-side persistence per ADR-014.
Save / load / auto-load using `idb` wrapper keyed by `project_id`.
Uses the canonical serializer from `packages/domain`.

**Files created in this phase:**

- `apps/web/src/persistence/storage-keys.ts` (DB name, object store name, indexes)
- `apps/web/src/persistence/doc-persistence.ts` (`saveProject`, `loadProject`, `loadMostRecent`, `listProjectsByRecency`)
- `apps/web/src/persistence/index.ts`
- `apps/web/tests/persistence.test.ts`

**Dependencies:**

- `idb: ^8.0.0` (apps/web dependency)
- devDeps: `fake-indexeddb: ^6.0.0` (for tests)

**Steps:**

1. IndexedDB schema:
   - DB name: `portplanner`
   - Object store: `projects` (key: `id`, value: `{ id, name, updatedAt, blob }` where `blob` is the canonical JSON string)
   - Index: `by-updated-at` on `updatedAt` for `loadMostRecent`
   - Version: 1
2. `saveProject(doc: ProjectDocument)`: serialize with `packages/domain`'s `serialize(doc)` → write record with `id`, `name`, `updatedAt: new Date().toISOString()`, `blob`.
3. `loadProject(id)`: read record → `deserialize(record.blob)` → return doc. Throw `LoadFailure` with user-friendly message on parse/validation failure.
4. `loadMostRecent()`: query by `by-updated-at` descending, return first record's deserialized doc.
5. `listProjectsByRecency()`: not used in M1.2 UX but added for infra (returns `{ id, name, updatedAt }[]` summaries). Used in test assertions.
6. `useAutoLoadMostRecent()` hook in `apps/web/src/hooks/`: on mount, if no document in store, try `loadMostRecent()` and `setDocument(doc)`.
7. Tests use `fake-indexeddb/auto` as a setup file:
   - `persistence.test.ts::roundTripIdentity`: create → save → load → canonical JSON byte-identical
   - `persistence.test.ts::loadMostRecent`: save two projects (sleep between to ensure timestamp difference), loadMostRecent returns the later one
   - `persistence.test.ts::rejectsMalformedBlob`: manually inject a malformed blob, `loadProject` throws `LoadFailure` with a usable message

**Invariants introduced:**

| ID | Invariant | Enforcement |
|---|---|---|
| P1 | Round-trip preserves canonical JSON byte-identity | Unit test `persistence.test.ts::roundTripIdentity` |
| P2 | `packages/doc-store` has zero IndexedDB / `idb` imports (already S2 from Phase 2; re-verify) | Grep re-run |
| P3 | All persistence calls go through `apps/web/src/persistence/` | Grep: `rg -n "indexedDB\|from 'idb'" apps/web/src` returns matches ONLY inside `src/persistence/` |

**Mandatory Completion Gates:**

```
GP.0 — pnpm install succeeds
  Command: pnpm install
  Expected: exit 0

GP.1 — round-trip test passes
  Command: pnpm --filter @portplanner/web test -- tests/persistence.test.ts
  Expected: exit 0

GP.2 — persistence isolated to apps/web/src/persistence/
  Command: rg -n "indexedDB|from 'idb'" apps/web/src --glob '!src/persistence/**'
  Expected: zero matches

GP.3 — doc-store persistence isolation re-verified (S2)
  Command: rg -n "from 'idb'|localStorage|indexedDB" packages/doc-store/src
  Expected: zero matches

GP.4 — full pnpm test passes (no regression in design-system or previous web tests)
  Command: pnpm test
  Expected: exit 0
```

**Tests added:** ~6 cases (roundTripIdentity, loadMostRecent,
listProjectsByRecency, rejectsMalformedBlob, rejectsNonExistentId,
schemaVersionMismatch stub).

---

### Phase 5 — UI: New Project dialog + Save button + status-bar signal

**Goal:** Expose the machinery from Phases 1–4 via minimal UI so the
exit criterion (create → save → refresh → auto-load → byte-identical)
is demonstrable. Single-active-project UX; no Load dropdown.

**Files created in this phase:**

- `apps/web/src/dialogs/NewProjectDialog.tsx` + `.module.css`
- `apps/web/src/dialogs/ConfirmDialog.tsx` + `.module.css`
- `apps/web/src/toolbar/NewProjectButton.tsx` + `.module.css`
- `apps/web/src/toolbar/SaveButton.tsx` + `.module.css`
- `apps/web/src/hooks/useAutoLoadMostRecent.ts`
- `apps/web/src/hooks/useBeforeUnloadGuard.ts` (browser "leave without saving?" confirm)
- `apps/web/tests/new-project-dialog.test.tsx`
- `apps/web/tests/save-button.test.tsx`
- `apps/web/tests/auto-load.test.tsx`

**Files modified:**

- `apps/web/src/main.tsx` — import store, wire auto-load effect
- `apps/web/src/App.tsx` — no change or minimal
- `apps/web/src/shell/Navbar.tsx` — render `<NewProjectButton />` and `<SaveButton />` in the previously-empty `controls` region
- `apps/web/src/shell/Navbar.module.css` — adjust controls flex for two buttons
- `apps/web/src/shell/StatusBar.tsx` — import `useDocument`, `useIsDirty`, `useLastSavedAt`; render dynamic left message
- `apps/web/src/shell/StatusBar.module.css` — add `.dirty` indicator style

**Steps:**

1. `NewProjectDialog`: form with one field (project name, required, trimmed, 1–100 chars). Submit → `newProjectId()` + `createInitialDocumentState()` → `setDocument({ id, name, createdAt: now, updatedAt: now, coordinateSystem: defaultCoordinateSystem(), objects: {}, scenarioId: null })`.
2. `ConfirmDialog`: generic "You have unsaved changes. Continue?" shown when user clicks New Project with dirty state. Buttons: Discard / Cancel.
3. `NewProjectButton`: renders "New". On click, if current doc exists and is dirty, shows ConfirmDialog; else shows NewProjectDialog.
4. `SaveButton`: renders "Save". Disabled when no document or no dirty state. On click, `saveProject(currentDoc)` → `markSaved()`.
5. `useAutoLoadMostRecent()`: `useEffect` on mount, one-shot. If no doc in store, `loadMostRecent()`. Called from `<App>`.
6. `useBeforeUnloadGuard()`: adds `beforeunload` listener returning a message if dirty; removes on dismount.
7. `StatusBar` dynamic text:
   - No document: `"No project"` tertiary colour
   - Clean: `"{project.name} · Saved {HH:MM}"` secondary colour
   - Dirty: `"{project.name} · Unsaved changes"` warning colour (existing `--text-warning` token)
8. Tests:
   - `new-project-dialog.test.tsx`: open dialog, type name, submit, assert doc in store (via getState)
   - `save-button.test.tsx`: dirty state enables; click saves to fake-indexeddb; assert persistence getState
   - `auto-load.test.tsx`: pre-seed fake-indexeddb with a project, mount App, assert store picks it up

**Invariants introduced:**

| ID | Invariant | Enforcement |
|---|---|---|
| U1 | apps/web dialog / toolbar / status code uses `var(--…)` tokens only | Grep: `rg -n "#[0-9a-fA-F]{3,8}\b" apps/web/src/{dialogs,toolbar,hooks} -g '*.module.css'` returns zero (inherits M1.1 G4.1 rule) |
| U2 | apps/web does NOT import from `@portplanner/doc-store` directly for anything rendering React | Grep: `rg -n "from '@portplanner/doc-store'" apps/web/src` returns zero (apps/web uses `doc-store-react` exclusively for React chrome; the vanilla store is accessed through hooks) |
| U3 | Navbar renders exactly the 2 M1.2 toolbar buttons (no scope creep) | Visual assertion in test; TSX search for `Button` inside Navbar yields exactly NewProjectButton + SaveButton |

**Mandatory Completion Gates:**

```
GU.0 — full apps/web tests pass
  Command: pnpm --filter @portplanner/web test
  Expected: exit 0

GU.1 — no hardcoded hex in M1.2 UI CSS modules (inherits M1.1 G4.1)
  Command: rg -n "#[0-9a-fA-F]{3,8}\b" apps/web/src/{dialogs,toolbar,hooks,shell} -g '*.module.css'
  Expected: zero matches

GU.2 — apps/web React chrome uses doc-store-react only (U2)
  Command: rg -n "from '@portplanner/doc-store'" apps/web/src
  Expected: zero matches. (Persistence calls store.getState() through the hook; the raw vanilla store is not imported into apps/web.)

GU.3 — production build succeeds
  Command: pnpm --filter @portplanner/web build
  Expected: exit 0

GU.4 — full pnpm test suite passes (no regression)
  Command: pnpm test
  Expected: exit 0

GU.5 — Biome + typecheck
  Command: pnpm check && pnpm typecheck
  Expected: exit 0

GU.6 — manual exit-criterion walkthrough (not gated; recorded in
       Post-Execution Handoff):
  1. pnpm dev
  2. Click "New" — name "Test Port" — submit
  3. Click "Save" — status shows "Saved HH:MM"
  4. Hard-refresh browser (Ctrl+Shift+R)
  5. Verify status shows "Test Port · Saved HH:MM" (auto-loaded)
  6. DevTools → Application → IndexedDB → portplanner/projects — inspect the blob: it should be minified canonical JSON with sorted keys
```

**Tests added:** ~8 cases across three test files.

---

## 10. Invariants summary

| ID | Invariant | Phase | Enforcement |
|----|-----------|-------|-------------|
| D1 | packages/domain has zero cross-package imports | 1 | GD.1 |
| D2 | packages/domain has zero React/Zustand imports | 1 | GD.2 |
| D3 | UUIDv7 generator produces time-ordered IDs | 1 | Unit test |
| D4 | `serialize(deserialize(serialize(x))) === serialize(x)` | 1 | Unit test |
| D5 | Zod schemas reject malformed docs with clear errors | 1 | Unit test |
| S1 | packages/doc-store has zero React imports | 2 | GS.1 |
| S2 | packages/doc-store has zero persistence imports | 2 | GS.2, re-verified GP.3 |
| S3 | zundo history captures ONLY the `document` slice | 2 | Unit test |
| S4 | doc-store imports only from @portplanner/domain among workspace pkgs | 2 | GS.3 |
| R1 | React listed as peerDependency only in doc-store-react | 3 | GR.1 |
| R2 | doc-store-react imports only from doc-store + domain + react | 3 | GR.2 |
| P1 | Round-trip preserves canonical JSON byte-identity | 4 | Unit test |
| P3 | All IndexedDB / idb imports live under apps/web/src/persistence/ | 4 | GP.2 |
| U1 | No hardcoded hex in apps/web CSS modules (M1.1 G4.1 scope extended to new dirs) | 5 | GU.1 |
| U2 | apps/web does not import @portplanner/doc-store directly (uses react wrapper) | 5 | GU.2 |
| U3 | Navbar renders exactly 2 M1.2 toolbar buttons | 5 | Test assertion |
| M1.1-carry | All M1.1 gates continue to pass (G1.1, G1.2, G3.1, G3.2, G3.3, G4.1, G4.2, G5.0) | 5 | Re-verify during Final Audit |

## 11. Test strategy

**Before this plan:** 13 tests pass (M1.1 foundation — 8 design-system
+ 5 apps/web).

**Added by this plan (target counts):**

| File | Target | Purpose |
|------|--------|---------|
| `packages/domain/tests/ids.test.ts` | 5 | UUIDv7 generation, time-ordering, branded-type boundaries |
| `packages/domain/tests/schemas.test.ts` | 8 | Valid/invalid branches for each Zod schema |
| `packages/domain/tests/serialize.test.ts` | 5 | Canonical round-trip, key-order, number-format, deserialize safety |
| `packages/doc-store/tests/store.test.ts` | 4 | setDocument, renameDocument, subscribe, markSaved |
| `packages/doc-store/tests/zundo.test.ts` | 3 | Undo reverts mutation; temporal slice excludes non-document state; redo re-applies |
| `packages/doc-store/tests/persistence-bridge.test.ts` | 2 | Dirty flag flips on mutation, clears on markSaved |
| `packages/doc-store-react/tests/hooks.test.tsx` | 6 | One per hook + null/missing-id edge cases |
| `apps/web/tests/persistence.test.ts` | 6 | roundTripIdentity, loadMostRecent, listProjectsByRecency, rejectsMalformedBlob, rejectsNonExistentId, schemaVersionMismatch |
| `apps/web/tests/new-project-dialog.test.tsx` | 3 | opens, accepts valid, rejects empty name |
| `apps/web/tests/save-button.test.tsx` | 3 | disabled when no doc, enabled when dirty, save flow |
| `apps/web/tests/auto-load.test.tsx` | 2 | pre-seeded db auto-loads; empty db leaves store null |

**Target total added:** ~47 cases. Combined with M1.1's 13, the full
suite is ~60 cases at end of M1.2.

**Additional verification types (not test cases):**

- `pnpm typecheck` across all packages
- `pnpm check` (Biome) across all files
- `pnpm --filter @portplanner/web build` (production)
- All grep gates G*.N return zero matches

## 12. Done Criteria

### Local — clean-machine reproducible

1. Fresh clone of the repo + `pnpm install` + `pnpm dev` starts Vite
   with no errors.
2. Click "New" in the navbar → dialog → type "Test Port" → Submit.
   Status bar updates: `"Test Port · Unsaved changes"` (warning colour).
3. Click "Save". Status bar updates: `"Test Port · Saved HH:MM"`.
4. Hard-refresh the tab (Ctrl+Shift+R). After load, status bar still
   shows `"Test Port · Saved HH:MM"` (auto-loaded). Dev tools →
   Application → IndexedDB → `portplanner/projects` shows the record.
5. `pnpm typecheck` exits 0.
6. `pnpm check` exits 0.
7. `pnpm test` exits 0; all ~60 tests pass.
8. `pnpm --filter @portplanner/web build` exits 0; produces `apps/web/dist/`.
9. All grep gates G1.1, G1.2, G3.1, G3.2, G3.3, G4.1, G4.2 (M1.1) AND
   GD.1–GD.2, GS.1–GS.3, GR.1–GR.2, GP.2, GU.1–GU.2 (M1.2) return zero
   matches.

### Remote — CI green

10. CI workflow `ci.yml` runs green on the feature branch's PR.
    Verification command (requires `gh` authenticated):
    ```
    gh run list --workflow=ci.yml --branch=feature/m1-2-document-model --limit=1 --json conclusion -q '.[0].conclusion'
    ```
    Expected: `"success"`.

### Invariants preserved

11. No edits to any ADR (001–015) or to the extraction registry.
12. No edits to `docs/design-tokens.md` beyond v1.2.0 (unchanged).
13. Any amendments to `docs/coordinate-system.md` or `docs/glossary.md`
    landed in the same commit as the code that triggered them (§0.5),
    with reasoning noted in Post-Execution Handoff.
14. No deviations proposed beyond what's explicitly in §6 (none
    anticipated).

## 13. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Vitest + `fake-indexeddb` + jsdom interaction breaks in CI | Low | `fake-indexeddb/auto` is a well-trodden path; smoke-test early in Phase 4 |
| Canonical JSON determinism fails due to locale-dependent number formatting | Low | Use plain `String(n)` for numbers; add test that asserts locale-independence by setting `process.env.LC_ALL` in test env |
| zundo middleware scoping accidentally widens to UI state later | Medium | ADR-015 is explicit; Phase 2 gates assert the temporal slice only contains `document`; Codex enforces during audit |
| `doc-store-react` accidentally lists `react` under `dependencies` | Medium | GR.1 gate parses `package.json` and rejects. Caught before merge. |
| Auto-load on cold start races with user clicking "New" immediately | Low | Auto-load runs in a `useEffect` on mount with a guard: only loads if store has `document === null`. If user clicks "New" before load resolves, the guard prevents overwrite. Covered by `auto-load.test.tsx`. |
| IndexedDB quota exceeded (QuotaExceededError) | Very low in M1.2 (docs are tiny — no objects yet) | Catch and surface to UI later when doc sizes grow. For M1.2, unhandled — acceptable because triggering it requires malicious input. |
| Circular type dependency between `doc-store` and `doc-store-react` | Medium | `doc-store-react` is one-way — consumes `doc-store`, never imported by `doc-store`. Enforced by grep gate (R2). |
| Plan's `schemaVersion: '1.0.0'` ossifies before we know we need versioning | Low | Single string constant; adding migration handling later is a well-known upgrade path (ADR supersede if it becomes load-bearing). |

## 14. Execution notes

Procedure 03 (Plan Execution) operates in AUDIT-FIRST mode. Specific
to this plan:

- **Phase boundaries are strict.** All gates in Phase N MUST pass
  before Phase N+1 begins. Gate failure → fix-within-phase per §3.2.
- **Commit granularity.** One commit per phase is the default.
  Acceptable alternative: one commit per file-group inside a phase if
  the message trail names the phase and every commit in the group
  leaves all Phase-N gates green.
- **Do not pre-compute across phases.** Phase 3 does not ship code
  Phase 4 will use. Phase 4 does not wire UI that Phase 5 will render.
- **Section-consistency pass per Procedure 01 §1.16.12.** After any
  mid-execution revision to this plan (Post-Execution notes), grep for
  references to the removed/renamed concept across §3, §4, §10, §11,
  §12, §13 and phase-goal headers.

---

## Plan Review Handoff

**Plan:** `docs/plans/feature/m1-2-document-model.md`
**Branch:** `feature/m1-2-document-model`
**Status:** Plan authored — awaiting review

### Paste to Codex for plan review

> Review this plan using the protocol at
> `docs/procedures/Codex/02-plan-review.md` (Procedure 02).
> Apply strict evidence mode. Start from Round 1.
>
> Required reading (in order):
> 1. `docs/procedures/Codex/00-architecture-contract.md` — note the
>    recently-extended GR-3 module-boundary graph (doc-store and
>    doc-store-react packages added) and the new canvas-no-React
>    grep gate.
> 2. `docs/adr/002-object-model.md`
> 3. `docs/adr/003-ownership-states.md`
> 4. `docs/adr/010-document-sync.md`
> 5. `docs/adr/012-technology-stack.md`
> 6. `docs/adr/014-persistence-architecture.md`
> 7. `docs/adr/015-document-store-state-management.md`
> 8. `docs/execution-plan.md` (M1 scope)
> 9. `docs/coordinate-system.md`
> 10. This plan.
>
> Additionally verify these plan-specific items:
>
> 1. §4 correctly enumerates every binding spec touched. ADR-015 is
>    NEW to the contract; verify §4 cites it. Confirm ADR-001 and
>    ADR-008 are correctly marked N/A (no coordinate math, no 3D).
>
> 2. §6 declares "no deviations." Verify the M1.2 narrow-type
>    implementation of Operation (defined but not emitted) is NOT a
>    deviation from ADR-010. ADR-010 requires operations to be emitted
>    per mutation; M1.2 has no mutations beyond full doc creation. Is
>    this a progressive-implementation case per architecture-contract
>    §0.7? If so, does §6 need a four-condition mapping table?
>
> 3. Every phase has concrete command-based completion gates per
>    Procedure 01 §1.12. Specifically check GR.1 (the node -e parsing
>    of package.json) — is this cross-platform robust enough?
>
> 4. Module-isolation grep gates extend M1.1's GR-3 set to cover the
>    new packages. Every boundary has a gate; verify there's no
>    missing coverage (e.g., editor-2d future-import gates
>    still present).
>
> 5. The plan does NOT pre-introduce anything belonging to M1.3/M1.4.
>    Specifically no Canvas2D, no rbush, no @flatten-js, no RTG_BLOCK
>    code, no extractor, no actual Operation emission on mutations.
>
> 6. Hydration / Serialization / Undo/Redo / Sync (§8) is complete
>    per Procedure 01 §1.9. Verify the op-log deferral is correctly
>    classified (progressive implementation vs deviation).
>
> 7. Test strategy hits meaningful coverage across 47 added cases.
>    Is any critical path uncovered (e.g., concurrent-tab IndexedDB
>    access, HMR state loss)?
>
> 8. Phase-order coupling: does any phase depend on a later phase's
>    artifact? Specifically Phase 5 UI tests — do they require
>    fake-indexeddb setup from Phase 4, and is that dependency
>    documented?
>
> 9. Done Criteria in §12 are objectively testable end-to-end.
>    Local items run without external auth; remote items gated
>    explicitly.
>
> 10. The New Project dialog collecting only name (deferring
>     coordinate-system UI) — is this a deviation from the M1
>     execution-plan line "Project creation with coordinate system
>     setup (origin, true north)"? Or is it progressive implementation
>     per architecture-contract §0.7? If the latter, §6 needs a
>     four-condition mapping.
>
> Report findings as Blocker / High-risk / Quality gap per §0.8.
> Classify with Agree/Disagree, Root Cause, Proposed Rule Enhancement.
