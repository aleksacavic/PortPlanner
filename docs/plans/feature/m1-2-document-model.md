# Plan — M1.2 Project Model

*(Plan filename `m1-2-document-model.md` and branch
`feature/m1-2-document-model` are retained from pre-rename scaffolding
per Procedure 01 §1.10 "plan filename matches branch". Plan content
speaks "Project" throughout; the legacy labels carry no semantic
weight.)*

**Branch:** `feature/m1-2-document-model`
**Author:** Claude (Opus 4.7, 1M context)
**Date:** 2026-04-21
**Status:** Revised for Codex Round 3 re-review — Round 3 response landed on this branch. Codex Round 2 memo (2026-04-21) rated **6.0/10 No-Go** on 2 Blockers (PI-2 coord compatibility overreach; ADR-010 Operation shape mismatch) + 2 High-risk (`.strict()` regression; stale zundo test wording). All Round 2 findings addressed in this revision. Additional Round 3 self-audit (§1.3 + §1.16 step 13) surfaced SR-1 (dirty-flag semantics broken across genesis/hydration) + SR-2 (cosmetic skew) and resolved them. Separately, a full `Document → Project` rename landed on main (see `docs/adr/010-project-sync.md`, `015-project-store-state-management.md`) and the re-export pattern was dropped (actions live in `project-store`, hooks live in `project-store-react`, consumers import from where each lives). See Appendix A Round 2 → Round 3 + Round 3 self-audit entries at end of file.
**Operating mode:** Procedure 01 (PLAN-ONLY) → Procedure 03 (EXECUTION) after approval

---

## 1. Request summary

Deliver the project model plumbing so a user can create a project,
save it, hard-refresh the browser, auto-load it back, and verify the
project is byte-identical. No canvas, no geometry, no object types
yet — that's M1.3 and M1.4.

This is the second of four M1 slices (M1.1 Foundation shipped ✓ →
**M1.2 Project Model** → M1.3 2D Editor Shell → M1.4 RTG_BLOCK).

## 2. Assumptions and scope clarifications

Answered via pre-plan user decisions and Codex second-opinion review:

| # | Question | Decision |
|---|---|---|
| 1 | Store placement | **Two-package split per ADR-015**: `packages/project-store` (vanilla Zustand + zundo + Immer, no React) and `packages/project-store-react` (React hooks wrapping project-store). React as peerDependency in `project-store-react`. Rationale: lets editor-2d (M1.3) and viewer-3d (M5) subscribe to the store from canvas paint loops without transitively importing React. Codex's recommendation, agreed. |
| 2 | Coordinate-system input in New Project dialog | **Defer geodetic anchor to M1.3+.** M1.2 initialises projects with `coordinateSystem: null` — "origin not yet chosen" per the binding doc's "immutable once set" language. Geodetic UI (lat/lon, UTM, basemap anchor) lands when the canvas exists and can show an origin marker / north arrow. |
| 3 | Multi-project UX in M1.2 | **Deferred to M2 per execution plan.** M1.2 is single-active-project: New Project replaces the current (with unsaved-changes confirm); Save writes under current project id; cold start auto-loads the most recently saved project. No Load dropdown, no project enumeration UI. |
| 4 | zundo scope | **Project slice only** per ADR-015. Selection, active tool, viewport — out of undo history. Not yet applicable in M1.2 (no canvas, no ephemeral UI state). |

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

- `src/types/project.ts`
- `src/types/coordinate-system.ts`
- `src/types/object.ts` (base contract per ADR-002; object-type-specific
  refinements land in M1.4 with RTG_BLOCK)
- `src/types/ownership.ts` (OwnershipState enum)
- `src/types/operation.ts` (Operation shape per ADR-010)
- `src/types/index.ts`
- `src/ids.ts` (UUIDv7 generator + `ProjectId` / `ObjectId` branded types)
- `src/schemas/project.schema.ts`
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

**Files to be created — `packages/project-store/`** (new package):

- `package.json` (name: `@portplanner/project-store`, depends on
  `@portplanner/domain`, `zustand`, `zundo`, `immer`)
- `tsconfig.json` (extends root base)
- `vitest.config.ts`
- `src/initial-state.ts` (`createInitialProjectStoreState`)
- `src/store.ts` (vanilla Zustand store with zundo + Immer middleware,
  scoped per ADR-015 to the `project` slice only; exports the
  `projectStore` singleton)
- `src/actions.ts` (three named non-mutation actions:
  `createNewProject` (genesis), `hydrateProject` (load), `markSaved`
  (post-save metadata). No project-level mutation actions in M1.2 —
  first mutation arrives in M1.3 per §6 PI-1. Dirty is managed inline
  by each action; there is no `persistence-bridge.ts` watcher (SR-1
  self-audit fix).)
- `src/test-utils.ts` (`resetProjectStoreForTests()` per ADR-015)
- `src/index.ts`
- `tests/store.test.ts`
- `tests/zundo.test.ts`
- `tests/setup.ts`

**Files to be created — `packages/project-store-react/`** (new package):

- `package.json` (name: `@portplanner/project-store-react`, depends on
  `@portplanner/project-store`, `@portplanner/domain`; React as
  **`peerDependencies` only** per ADR-015)
- `tsconfig.json`
- `vitest.config.ts`
- `src/use-project-store.ts` (internal `useSyncExternalStore` wrapper)
- `src/hooks/useProject.ts`
- `src/hooks/useProjectId.ts`
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

- `src/main.tsx` — initialise projectStore, call `useAutoLoadMostRecent`
  before first render (or in a mount effect)
- `src/App.tsx` — wire `<ConfirmDialog>` outlet (projectStore is a module-level singleton; no provider wiring needed)
- `src/shell/Navbar.tsx` — populate `controls` region with
  NewProjectButton + SaveButton (previously empty per M1.1 plan)
- `src/shell/Navbar.module.css` — adjust controls flex layout
- `src/shell/StatusBar.tsx` — read project name and dirty state;
  render "Unsaved changes" vs "Saved HH:MM" vs "No project"
- `src/shell/StatusBar.module.css` — add styles for dirty indicator
- `package.json` — add dependencies (`idb`, `fake-indexeddb` for tests,
  `@portplanner/project-store`, `@portplanner/project-store-react`)
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
| Packages created | **`packages/project-store`** (new), **`packages/project-store-react`** (new) |
| Packages filled in | `packages/domain` (was empty scaffold, now has types + ids + schemas + serializer) |
| Packages modified | `apps/web` (persistence + dialog + toolbar + status-bar signal) |
| Cross-object extractors | None touched — no extractors yet |
| Scenarios | None touched |
| Stored data (client-side) | **First time IndexedDB is used.** New object store `projects` (key: `project_id`, value: canonical JSON blob). No pre-existing data to migrate. |
| UI surfaces | Navbar (adds buttons), StatusBar (adds dirty indicator), new NewProjectDialog + ConfirmDialog modals |

## 4. Binding specifications touched

| Spec | Role in this plan |
|---|---|
| **ADR-002** Object Model | Implement `Project` and base `Object` shape in TypeScript. Analysis / cost bindings NOT on the object (per ADR-002). JSONB `parameters` field typed as `Record<string, unknown>` awaiting per-type refinement in M1.4. |
| **ADR-003** Ownership States | Implement `OwnershipState` enum (`AUTHORED` / `GENERATED` / `FROZEN` / `DETACHED`). No transitions performed in M1.2 (no objects yet), but the type exists for M1.4 consumers. |
| **ADR-004** Extraction Contract | Not touched. No extractors in M1.2. |
| **ADR-010** Project Sync | Implement `Operation` type (matches ADR-010 shape). **Zero operations emitted in M1.2 because M1.2 contains zero project-level mutations** — the three Phase 2 actions (`createNewProject`, `hydrateProject`, `markSaved`) are genesis / load / metadata respectively, not mutations of existing project state. Classified as progressive implementation per §6 PI-1. First emission lands with the first real mutation in M1.3. |
| **ADR-011** UI Stack | Consume existing `ThemeProvider` + CSS-module pattern. No change. |
| **ADR-012** Technology Stack | Apply: Zustand, zundo, Immer, Zod, UUIDv7, JSON canonical. Every library choice traces to an ADR-012 decision. |
| **ADR-014** Persistence Architecture | Implement the M1 branch: IndexedDB + `idb` wrapper, keyed by `project_id`, JSON canonical body. `apps/web/src/persistence/` is the caller; `packages/domain` provides the serializer; `packages/project-store` is persistence-agnostic. |
| **ADR-015** Project Store State Management | Apply literally: vanilla Zustand + zundo (project slice only) + Immer; ban `zustand-persist`; React as peerDependency in `project-store-react`; no action re-export pattern (actions live in `project-store`, hooks in `project-store-react`, consumers import from where each lives per the Round 3-clarified usage contract); canvas-no-React grep gate activates in M1.3. |
| **Architecture contract** §0.4 GR-3 | Consumes the freshly-extended dep graph (project-store, project-store-react). No boundary violations expected. |
| **Design tokens v1.2.0** | All UI additions use existing semantic tokens. No new tokens required. |
| **Coordinate system ref** `docs/coordinate-system.md` | Implementation introduces `CoordinateSystem` TS type matching the doc's §"Implementation requirements" interface **field-for-field** (`originLat`, `originLng`, `trueNorthRotation`, `utmZone`). Transform methods (`toProjectLocal`, etc.) arrive in M1.3. No doc change expected in M1.2. |

## 5. Architecture Doc Impact

Explicit table of every document that may be updated during execution,
per Procedure 01 §1.6 and §0.5 spec-update rule:

| Doc | Path | Anticipated change | Reason |
|-----|------|-------------------|--------|
| ADR-002 Object Model | `docs/adr/002-object-model.md` | **No change** | Implementation conforms. Concrete TS field names added to code; the ADR's schema is definitional, not implementation-level. |
| ADR-003 Ownership States | `docs/adr/003-ownership-states.md` | **No change** | Enum values match ADR exactly (`AUTHORED`, `GENERATED`, `FROZEN`, `DETACHED`). |
| ADR-010 Project Sync | `docs/adr/010-project-sync.md` | **No change** | `Operation` type + op log shape follow ADR-010. If implementation reveals a genuine gap (e.g., a field ADR-010 doesn't enumerate), pause per §3.10 and follow §0.7. |
| ADR-012 Technology Stack | `docs/adr/012-technology-stack.md` | **No change** | All library choices pin exactly; no versions bumped. |
| ADR-014 Persistence | `docs/adr/014-persistence-architecture.md` | **No change** | `idb` wrapper + canonical JSON + per-project key all match ADR-014 M1 branch. |
| ADR-015 Project Store | `docs/adr/015-project-store-state-management.md` | **No change** | Just landed; implementation conforms. |
| `docs/coordinate-system.md` | `docs/coordinate-system.md` | **No change expected** | The TS `CoordinateSystem` type implements the doc's interface field-for-field (`originLat`, `originLng`, `trueNorthRotation`, `utmZone`). Field names match the binding interface with a cosmetic camelCase shift (snake_case → camelCase is a TS convention convention, not a semantic change). Transform methods on the interface are class methods implemented separately in M1.3, not part of the stored project. If execution surfaces a genuine mismatch, pause per §3.10. |
| `docs/glossary.md` | `docs/glossary.md` | **Possible: append new terms** | Candidate additions: "canonical JSON form" (deterministic key-order + number format); "project dirty state" (transient unsaved flag). Only appended if Phase 1 or 5 introduces the term in code/UI. Handled per §0.5 (append + date in-line). |
| `docs/design-tokens.md` | `docs/design-tokens.md` | **No change** | All UI additions (NewProjectDialog, buttons, dirty indicator) use existing semantic tokens. No new tokens proposed. |
| Extraction registry | `docs/extraction-registry/*.md` | **No change** | No extractors in M1.2. |
| Procedures | `docs/procedures/**` | **No change** | No procedure gaps anticipated. If one surfaces during execution, it goes on its own chore branch per the established pattern. |
| ADR Index | `docs/adr/README.md` | **No change** | ADR-015 was added on the chore branch; no further ADRs expected in M1.2. |
| Plan file | `docs/plans/feature/m1-2-document-model.md` | **This plan, updated in-place with PE notes per §3.7 during execution.** | PE notes record mid-execution corrections. |

**Explicit rule:** if any unexpected change to a binding doc is
required during execution, the author MUST stop per Procedure 03 §3.10
and surface a proposed plan patch before proceeding.

## 6. Deviations from binding specs

**None declared as deviations.** Two items that could read as
deferrals are classified as **progressive implementation** per the
architecture-contract §0.7 "Progressive implementation (distinct from
deviation)" clause. Each satisfies all four conditions.

### PI-1 — `Operation` type defined; emission deferred

M1.2 defines the `Operation` type in
`packages/domain/src/types/operation.ts` per ADR-010's shape. M1.2
does NOT emit operations because M1.2 contains **zero project
mutations** in the ADR-010 sense. The only state changes are
`createNewProject` (genesis) and `hydrateProject` (load) — neither is a mutation of
prior state) and `markSaved` (persistence metadata — not a project
change). Emission begins in M1.3/M1.4 when the first user-authored
mutations (canvas interactions, object create/update/delete) exist.

| # | Condition | Status | Evidence |
|---|---|---|---|
| 1 | No conflicting runtime semantics | **Satisfied** | Phase 2 actions are limited to `createNewProject` (genesis), `hydrateProject` (load), and `markSaved` (post-save metadata). None is a mutation per ADR-010's "modifies existing project state" semantic — genesis creates initial state, load restores persisted state, metadata touches only dirty/lastSavedAt. `renameDocument` was removed in the Round 1 response (dead action, no UI consumer). A prior single-action `setDocument` plus `persistence-bridge.ts` design was replaced in the Round 3 self-audit (SR-1) because it conflated genesis with hydration. No runtime behaviour that ADR-010 forbids. |
| 2 | Excluded features unreachable at the type level | **Satisfied** | No `emitOperation()` / `dispatchOperation()` / mutation-action API is exported from `packages/project-store` or `packages/project-store-react`. No callable action emits an `Operation`. Consumers cannot accidentally skip emission because no emission site exists. When M1.3 introduces the first real mutation, emission is added additively to that action. |
| 3 | User approval recorded in plan file with identifier and date | **Satisfied** | 2026-04-21, `aleksacavic@gmail.com`, agreement with Codex Round 1 classification that PI-1 is progressive implementation rather than deviation (recorded in Appendix A Round 1 → Round 2 response). Original popup Q4 (2026-04-21) confirmed "zundo scope = document slice only," implicitly aligning with deferring full operation emission to the first-mutation milestone. |
| 4 | Widening plan explicitly stated | **Satisfied** | M1.3 (2D editor shell + tool state) introduces the first real mutations via canvas interactions. Each new mutation action (e.g., `placeObject`, `moveObject`) emits a typed `Operation` into the store's operation log at emission time. ADR-010's full sync model (flush-to-server on reconnect) waits for M3+ when the server ships — consistent with the ADR-014 evolution path. |

### PI-2 — Geodetic coordinate-input UI deferred to M1.3

M1.2's New Project dialog collects only the project name. Projects
are initialized with `coordinateSystem: null` — consistent with
`docs/coordinate-system.md` §"Project origin selection" which
states "the origin is chosen by the user as a meaningful point on
the site… The origin is immutable once set." Null means not-yet-set
(the user hasn't chosen yet). User-chosen origin + true-north
rotation + UTM-zone UI lands in M1.3 when the 2D canvas exists and
can show an origin marker + north arrow for immediate visual
feedback. M1.3 also enforces: `coordinateSystem` MUST be non-null
before the first object is placed (compile-time and/or runtime
guard).

| # | Condition | Status | Evidence |
|---|---|---|---|
| 1 | No conflicting runtime semantics | **Satisfied** | `coordinateSystem: CoordinateSystem \| null` with `null` at creation (not a "default" value — the field is unset until the user chooses). `null` represents "origin not yet chosen" which is directly consistent with `docs/coordinate-system.md` §"Project origin selection": *"the origin is chosen by the user… The origin is immutable once set."* An unchosen origin is a valid pre-selection state; the binding doc does not mandate a default value. All engineering math still runs in project-local metric per ADR-001; WGS84 remains at the API boundary. No runtime behaviour that the binding doc prohibits. |
| 2 | Excluded features unreachable at the type level | **Satisfied** | M1.2 exposes no `setCoordinateSystem` / `updateOrigin` / `setRotation` / similar action in any package. The New Project dialog has no origin / rotation / UTM-zone input fields. No hook returns a coordinate-system mutator. The only way `coordinateSystem` can transition from `null` → non-null is via M1.3's forthcoming UI (outside M1.2 surface area). Users cannot set coordinates via any code path in M1.2. |
| 3 | User approval recorded in plan file with identifier and date | **Satisfied** | 2026-04-21, `aleksacavic@gmail.com`, via pre-plan AskUserQuestion popup Q3: "Defer geodetic anchor; dialog collects name only (Recommended)." Reconfirmed in Appendix A Round 1 → Round 2 response (this revision). |
| 4 | Widening plan explicitly stated | **Satisfied** | M1.3 (2D Editor Shell) adds the origin marker and true-north indicator on the canvas, alongside a coord-setup dialog triggered from a Project Settings surface. `docs/execution-plan.md` Milestone 1 scope item #3 — "Project creation with coordinate system setup (origin, true north)" — is a *Milestone 1* deliverable, split across M1.2 (doc infrastructure — CoordinateSystem types + defaults persisted in round-trip) and M1.3 (user-facing UI + canvas visualization). |

Both classifications satisfy all four conditions of the
architecture-contract §0.7 "Progressive implementation" rule. No full
§0.7 Approved Deviation Protocol ceremony is required because these
are NOT deviations.

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

### Hydration (project load path)

- `loadProject(id)` reads the IndexedDB value under key `id`
- Raw value is a string (canonical JSON blob) → `JSON.parse` →
  Zod `ProjectSchema.parse(raw)` → `Project` object
- **Unknown-field policy (corrected per Round 1 review H2):** Zod's
  `.strict()` REJECTS unknown keys (throws a `ZodError`); Zod's
  default behaviour STRIPS them; `.passthrough()` PRESERVES them.
  `ProjectSchema` uses the **default (strip) behaviour** at
  the root, trading version-forward tolerance (old client reading a
  future file does not crash; unknown fields drop silently) against
  strictness. `Object.parameters` uses `.passthrough()` per ADR-002
  JSONB semantics (the parameters bag is extensible per object type;
  we cannot yet enumerate allowed keys).
- Zod parse errors surface as `LoadFailure` with a user-friendly
  message (`"This project file is from an incompatible version"`).
  Tested in `persistence.test.ts::rejectsMalformedBlob`.
- After successful parse: call `hydrateProject(parsed, record.updatedAt)` (from `@portplanner/project-store`) which atomically sets `state.project`, clears `dirty`, stamps `lastSavedAt` from the IndexedDB record, and clears zundo's temporal history. Not a mutation — hydration restores previously-saved state.
- `useAutoLoadMostRecent()` runs once on app mount; if IndexedDB has a
  most-recent entry and no current project, it loads.
- **Schema version handling:** `ProjectSchema` requires
  `schemaVersion: '1.0.0'` (Zod literal). Loading a project with a
  different `schemaVersion` throws `LoadFailure` with a migration
  hint. Migration logic is deferred until a v2 field is introduced
  (M2+).

### Serialization (project save path)

- `serialize(doc): string` in `packages/domain/src/serialize.ts`:
  - Sort object keys recursively before stringifying
  - Numbers serialised via `String(n)` (preserves integer representation;
    floats use default JS formatting — M1.2 does not yet have floats in
    the project since no geometry exists; revisit if floats introduced
    before M1.4's geometry)
  - Arrays preserve order (array order is meaningful)
  - Output: single-line, minified canonical JSON
- Round-trip: `serialize(deserialize(serialize(doc))) === serialize(doc)`
  is the determinism invariant. Tested.
- NOT written: nothing. In M1.2 the project is leaf-only (no
  extracted quantities, no mesh descriptors, no validation results
  exist yet). ADR-002's "derived fields stay off the object" is
  trivially satisfied.
- `scenario_id` (ADR-006) is a top-level `Project` field
  declared as `string | null`. Always `null` in M1.2 (no scenarios yet).

### Undo/Redo (operation log)

- zundo wraps the **`project` slice only** per ADR-015.
- **M1.2 contains ZERO project-level mutations.** The two actions in
  scope are:
  - `createNewProject(project)` — genesis; creates initial state.
    Clears zundo's temporal history (whole-state replacement).
    **Not a mutation.**
  - `hydrateProject(project, lastSavedAt)` — load; restores a
    previously-saved state from IndexedDB. Clears zundo's temporal
    history. **Not a mutation.**
  - `markSaved()` — sets `dirty = false` and stamps `lastSavedAt`.
    Affects persistence metadata only. **Not a mutation.**
- `renameDocument` was initially in scope but is **removed in the
  Round 1 response** (Codex R1/H1 mutation-contradiction fix): the
  rename UI is not in M1.2 (rename-via-Project-Settings lands M2+),
  so a reachable but unused mutation action violates ADR-010's
  "every mutation emits an Operation" if kept. Removing it eliminates
  the contradiction.
- Because there are no project-level mutations, **zero operations
  are emitted in M1.2**. The `Operation` type is defined in
  `packages/domain/src/types/operation.ts` per ADR-010 shape; emission
  sites exist only conceptually until M1.3. This is formally
  classified as progressive implementation — see §6 PI-1.
- Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z) land in M1.3 or M1.4
  when undo UX is meaningful. In M1.2 zundo infrastructure is
  present but never exercised by a user action.

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

- `src/types/project.ts` (Project interface)
- `src/types/coordinate-system.ts` (CoordinateSystem interface)
- `src/types/object.ts` (Object base contract per ADR-002)
- `src/types/ownership.ts` (OwnershipState enum)
- `src/types/operation.ts` (Operation type per ADR-010)
- `src/types/index.ts`
- `src/ids.ts` (UUIDv7 generator, branded `ProjectId` / `ObjectId`)
- `src/schemas/project.schema.ts`
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
2. Define `CoordinateSystem` interface **matching `docs/coordinate-system.md` §"Implementation requirements" field-for-field**: `originLat: number` (WGS84 latitude of project origin), `originLng: number` (WGS84 longitude), `trueNorthRotation: number` (degrees clockwise from grid north), `utmZone: string` (e.g. `"40N"`). M1.2 stores DATA only; the transform methods (`toProjectLocal`, `toWGS84`, `projectLocalToMapPixel`, `mapPixelToProjectLocal`) are implemented in M1.3 when the canvas actually needs them (they're class behaviour, not document data). TS naming uses camelCase; the wire/JSON form is the same (no snake_case conversion needed since we're client-only in M1).
3. Define `Object` base contract per ADR-002: `id: ObjectId`, `type: string`, `classification?: string`, `geometry: unknown` (typed-by-union in M1.4), `parameters: Record<string, unknown>`, `ownership: OwnershipState`, `libraryRef?: { source: string; version: string }`.
4. Define `Project`: `id: ProjectId`, `schemaVersion: '1.0.0'`, `name: string`, `createdAt: string` (ISO-8601), `updatedAt: string`, `coordinateSystem: CoordinateSystem | null` (**nullable** — null means "origin not yet chosen"; consistent with `docs/coordinate-system.md` §"Project origin selection" language that "the origin is chosen by the user… immutable once set." In M1.2, New Project creates a doc with `null`; M1.3 UI forces the user to choose real values before any object placement.), `objects: Record<ObjectId, Object>`, `scenarioId: string | null`.
5. Define `Operation` per ADR-010 **field-for-field** (earlier Round 2 Review Miss — prior version weakened required fields to optional; fixed here):
   ```ts
   export type OperationType =
     | 'CREATE' | 'UPDATE' | 'DELETE'
     | 'GENERATE' | 'FREEZE' | 'DETACH' | 'UNFREEZE';

   export interface Operation {
     id: OperationId;
     projectId: ProjectId;
     sequence: number;                     // monotonic per-client counter
     timestamp: string;                    // ISO-8601
     userId: UserId;                       // see placeholder note below
     type: OperationType;
     objectId: ObjectId;
     before: ObjectSnapshot | null;        // pre-state, null on CREATE
     after: ObjectSnapshot | null;         // post-state, null on DELETE
   }

   export type ObjectSnapshot = Object;    // structural alias for M1.2
   ```

   All fields REQUIRED per ADR-010. `before`/`after` are non-optional
   but nullable (e.g., `before: null` on CREATE; `after: null` on
   DELETE). No weakening through `?`.

   **`userId` placeholder for M1 (progressive implementation):**
   M1 has no auth per the execution plan's "Authentication beyond
   simplest possible stub" exclusion. `userId` uses a fixed
   placeholder UUID:
   ```ts
   export const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000000' as UserId;
   ```
   Stored on every Operation emitted in M1. When auth lands (M3+),
   operations emitted after auth get real user IDs; historical
   operations keep the placeholder. No deviation from ADR-010 —
   `userId` is present and well-typed; the value is just a known
   sentinel.
6. Branded types for IDs: `ProjectId = string & { readonly __brand: 'ProjectId' }` and `ObjectId`, `OperationId`, `UserId` similarly. Export `LOCAL_USER_ID` constant per step 5.
7. UUIDv7 generator in `ids.ts`: `newProjectId()`, `newObjectId()`, `newOperationId()`. Validate-UUIDv7 helpers.
8. Zod schemas matching each type. **Unknown-field policy (aligned with §8 Hydration):** `ProjectSchema` uses **Zod's default behaviour (strip)** at the root — unknown fields are silently removed on parse, trading version-forward tolerance against strictness. `Object.parameters` uses `.passthrough()` per ADR-002 JSONB semantics (extensible bag). **Do NOT use `.strict()`** anywhere in the project's schema chain — `.strict()` REJECTS on unknown keys and would make forward-compatible loads impossible. `schemaVersion: '1.0.0'` is validated via Zod's `.literal('1.0.0')` which rejects future versions with a clear migration message.
9. Canonical serializer:
   - `serialize(project: Project): string` — sort object keys recursively, emit minified JSON.
   - `deserialize(str: string): Project` — `JSON.parse` + `ProjectSchema.parse`.
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
| D5 | Zod `ProjectSchema.parse` rejects missing required fields with clear error | Unit test `schemas.test.ts::rejectsMalformed` |

**Mandatory Completion Gates:**

```
GD.0 — pnpm install succeeds after adding deps
  Command: pnpm install
  Expected: exit 0

GD.1 — domain has zero cross-package imports (re-verify M1.1 gate)
  Command: rg -n "from '@portplanner/(design-system|web|editor-2d|viewer-3d|api|project-store|project-store-react)'" packages/domain/src
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

### Phase 2 — `packages/project-store` (vanilla Zustand + zundo + Immer)

**Goal:** Create the project store as a vanilla Zustand store with
zundo temporal middleware and Immer-based mutations, per ADR-015.
No React. No persistence.

**Files created in this phase:**

- `packages/project-store/package.json` (name, deps, peerDeps, scripts)
- `packages/project-store/tsconfig.json`
- `packages/project-store/vitest.config.ts`
- `packages/project-store/tests/setup.ts`
- `src/initial-state.ts` (`createInitialProjectStoreState()`)
- `src/store.ts` (factory + exported `projectStore` singleton)
- `src/actions.ts` (`createNewProject`, `hydrateProject`, `markSaved` — three named non-mutation actions; dirty managed inline per SR-1)
- `src/test-utils.ts` (`resetProjectStoreForTests`)
- `src/index.ts`
- `tests/store.test.ts`
- `tests/zundo.test.ts`

**Dependencies:**

- `zustand: ^5.0.0` (imports from `zustand/vanilla` and `zustand/middleware`)
- `zundo: ^2.2.0`
- `immer: ^10.0.0`
- `@portplanner/domain: workspace:*`

**Steps:**

1. Define `ProjectStoreState` type: `{ project: Project | null; dirty: boolean; lastSavedAt: string | null }`.
2. `createInitialProjectStoreState(): ProjectStoreState` returns `{ project: null, dirty: false, lastSavedAt: null }`.
3. Implement the store using `createStore` from `zustand/vanilla`, wrapped with `temporal` (zundo) scoped to the `project` slice and with `immer` middleware. Pattern:
   ```ts
   import { createStore } from 'zustand/vanilla';
   import { temporal } from 'zundo';
   import { immer } from 'zustand/middleware/immer';
   ```

   Export the singleton instance as `projectStore`.

   Also add an HMR guard at the bottom of the module so Vite dev
   reloads don't wipe the in-memory store:
   ```ts
   // @ts-expect-error — import.meta.hot exists under Vite dev
   import.meta.hot?.accept();
   ```
   In production builds `import.meta.hot` is undefined; the guard
   is a no-op. Covers Round 1 Q2 HMR concern.
4. Actions in `actions.ts` (M1.2 ships **three named non-mutation actions** per §6 PI-1; dirty is managed inline by each action — no `persistence-bridge` watcher, no single generic `setDocument`):

   - `createNewProject(project: Project)` — **genesis path.** Replaces
     `state.project` with the fresh value; sets `dirty = true`; clears
     `lastSavedAt = null`; clears zundo's temporal history per Zundo's
     whole-state-replacement semantics. Called by the New Project
     dialog. **Not a mutation** per ADR-010 (genesis, not modification
     of prior state).

   - `hydrateProject(project: Project, lastSavedAt: string)` —
     **hydration path.** Replaces `state.project` with the loaded
     value; sets `dirty = false` (the project matches IndexedDB);
     stamps `state.lastSavedAt` from the supplied timestamp; clears
     zundo's temporal history. Called by `useAutoLoadMostRecent` and
     any future load flow. **Not a mutation** per ADR-010 (hydration
     is restoration, not modification).

   - `markSaved()` — **post-save metadata update.** Sets
     `dirty = false`; updates `lastSavedAt` to `new Date().toISOString()`.
     Does NOT change `state.project`. Called by the Save button after
     `saveProject(project)` resolves. **Not a mutation** per ADR-010
     (metadata, not project content).

   Each action is a plain function exported from `actions.ts` that
   calls `projectStore.setState((state) => { ... })` using Immer's
   draft API.

   **Mutation actions** (`placeObject`, `moveObject`, `renameProject`,
   etc.) DO NOT EXIST in M1.2. They arrive in M1.3 when the canvas
   allows user-authored changes. Those will emit typed `Operation`
   records per ADR-010 (per §6 PI-1 widening).

   **SR-1 fix (Round 3 self-audit):** The previous revision had a
   single `setDocument` action plus a `persistence-bridge.ts` watcher
   that blindly flipped `dirty = true` on any project change. That
   design broke hydration — auto-loaded projects showed "Unsaved
   changes" immediately because the bridge couldn't distinguish
   genesis from hydration. Splitting into `createNewProject` vs
   `hydrateProject` makes the dirty semantics explicit at the action
   level. `persistence-bridge.ts` is deleted; dirty is managed inline.
5. `test-utils.ts` exports `resetProjectStoreForTests()` that calls `projectStore.setState(createInitialProjectStoreState(), true)`.
6. Tests:
   - `store.test.ts`: `createNewProject(fresh)` sets `state.project`, `dirty=true`, `lastSavedAt=null`; `hydrateProject(loaded, '2026-04-22T10:00:00Z')` sets state, `dirty=false`, `lastSavedAt=provided`; `markSaved()` flips `dirty=false` and stamps `lastSavedAt=now` without touching `state.project`; subscribe listeners fire on each.
   - `zundo.test.ts`: temporal slice scope verification — `projectStore.temporal.getState()` exposes ONLY fields from the `project` slice (not `dirty` or `lastSavedAt`, and not selection / tool / viewport which don't exist in M1.2 but would be excluded if they did); `createNewProject` / `hydrateProject` both reset `pastStates` to empty per Zundo whole-state-replacement semantics; undo on initial state is a no-op.

**Invariants introduced:**

| ID | Invariant | Enforcement |
|---|---|---|
| S1 | `packages/project-store` has zero React imports | Grep: `rg -n "from 'react'" packages/project-store/src` returns zero |
| S2 | `packages/project-store` has zero persistence imports (`idb`, `localStorage`, `IndexedDB`) | Grep: `rg -n "from 'idb'\|localStorage\|indexedDB" packages/project-store/src` returns zero |
| S3 | zundo history captures ONLY the `project` slice | Unit test asserts `projectStore.temporal.getState().pastStates[0]` has shape `{ project: … }` (no dirty, no lastSavedAt, no selection, no tool) |
| S4 | `project-store` imports only from `@portplanner/domain` among workspace packages | Grep: `rg -n "from '@portplanner/(design-system\|web\|editor-2d\|viewer-3d\|api\|project-store-react)'" packages/project-store/src` returns zero |

**Mandatory Completion Gates:**

```
GS.0 — pnpm install succeeds with new package
  Command: pnpm install
  Expected: exit 0

GS.1 — project-store has zero React imports
  Command: rg -n "from 'react'" packages/project-store/src
  Expected: zero matches

GS.2 — project-store has zero persistence imports
  Command: rg -n "from 'idb'|localStorage|indexedDB" packages/project-store/src
  Expected: zero matches (exclude /tests from this gate if test doubles use fake-indexeddb)

GS.3 — project-store has zero cross-package imports besides domain
  Command: rg -n "from '@portplanner/(design-system|web|editor-2d|viewer-3d|api|project-store-react)'" packages/project-store/src
  Expected: zero matches

GS.4 — project-store tests pass
  Command: pnpm --filter @portplanner/project-store test
  Expected: exit 0, all tests pass

GS.5 — typecheck + Biome pass
  Command: pnpm typecheck && pnpm check
  Expected: exit 0
```

**Tests added:** ~6 cases across two files: `store.test.ts` (3 actions ×
one assertion each) + `zundo.test.ts` (3 infrastructure assertions).
No persistence-bridge tests — bridge file removed per SR-1.

---

### Phase 3 — `packages/project-store-react` (React hooks)

**Goal:** Expose the vanilla project-store through idiomatic React hooks.
React as peerDependency only per ADR-015 to prevent dual-React copies.

**Files created in this phase:**

- `packages/project-store-react/package.json`
- `packages/project-store-react/tsconfig.json`
- `packages/project-store-react/vitest.config.ts`
- `packages/project-store-react/tests/setup.ts`
- `src/use-project-store.ts` (internal `useSyncExternalStore` wrapper)
- `src/hooks/useProject.ts`
- `src/hooks/useProjectId.ts`
- `src/hooks/useObjectById.ts` (selector; M1.4 consumers)
- `src/hooks/useIsDirty.ts`
- `src/hooks/useLastSavedAt.ts`
- `src/hooks/index.ts`
- `src/index.ts` (re-exports hooks)
- `tests/hooks.test.tsx`

**Dependencies:**

- `@portplanner/project-store: workspace:*`
- `@portplanner/domain: workspace:*`
- devDeps: `@types/react`, `@types/react-dom`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `react`, `react-dom`, `@vitejs/plugin-react`
- **`peerDependencies`:** `{ "react": "^18.0.0 || ^19.0.0" }` — NO `dependencies.react`

**Steps:**

1. `use-project-store.ts` exports an internal `useProjectStoreSelector<T>(selector: (state: ProjectStoreState) => T): T` using `useSyncExternalStore(projectStore.subscribe, () => selector(projectStore.getState()))`.
2. Each public hook uses the selector pattern:
   - `useProject()` → `state.project`
   - `useProjectId()` → `state.project?.id ?? null`
   - `useObjectById(id)` → `state.project?.objects[id]` (returns undefined if project is null or id missing)
   - `useIsDirty()` → `state.dirty`
   - `useLastSavedAt()` → `state.lastSavedAt`
3. Hooks are pure re-reads; no side effects. No context provider needed (module-level singleton store per ADR-015).
4. **Actions are NOT re-exported from this package.** Consumers import
   actions (`createNewProject`, `hydrateProject`, `markSaved`) directly
   from `@portplanner/project-store`. Hooks (`useProject`, etc.) are
   imported from `@portplanner/project-store-react`. This matches the
   clarified ADR-015 usage contract: hooks live here; actions live in
   the vanilla package; consumers import from where each lives. No
   re-export discipline to maintain.
5. `index.ts` re-exports only hooks (`./hooks`) and their types.
6. Tests (`hooks.test.tsx`) mount each hook in a test component via `@testing-library/react` `renderHook`, mutate the store via actions imported from `@portplanner/project-store`, and assert re-renders.

**Invariants introduced:**

| ID | Invariant | Enforcement |
|---|---|---|
| R1 | `packages/project-store-react` lists React ONLY under `peerDependencies` | Grep on `packages/project-store-react/package.json` — peerDependencies contains `react`; dependencies does NOT contain `react` |
| R2 | `project-store-react` imports only from `@portplanner/project-store`, `@portplanner/domain`, and `react` among its deps | Grep: no other `@portplanner/*` imports |

**Mandatory Completion Gates:**

```
GR.0 — pnpm install succeeds
  Command: pnpm install
  Expected: exit 0

GR.1 — React is peerDep only in project-store-react
  Commands:
    node -e "const p=require('./packages/project-store-react/package.json'); if(p.dependencies && p.dependencies.react){process.exit(1)}; if(!p.peerDependencies || !p.peerDependencies.react){process.exit(2)}"
  Expected: exit 0

GR.2 — project-store-react has no cross-package imports besides allowed set
  Command: rg -n "from '@portplanner/(design-system|web|editor-2d|viewer-3d|api)'" packages/project-store-react/src
  Expected: zero matches

GR.3 — project-store-react tests pass
  Command: pnpm --filter @portplanner/project-store-react test
  Expected: exit 0

GR.4 — typecheck + Biome pass
  Command: pnpm typecheck && pnpm check
  Expected: exit 0
```

**Tests added:** ~6 cases (one per hook + edge cases like null project,
missing object id).

---

### Phase 4 — `apps/web` persistence layer (IndexedDB + `idb`)

**Goal:** Implement the M1 client-side persistence per ADR-014.
Save / load / auto-load using `idb` wrapper keyed by `project_id`.
Uses the canonical serializer from `packages/domain`.

**Files created in this phase:**

- `apps/web/src/persistence/storage-keys.ts` (DB name, object store name, indexes)
- `apps/web/src/persistence/project-persistence.ts` (`saveProject`, `loadProject`, `loadMostRecent`, `listProjectsByRecency`)
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
2. `saveProject(project: Project): Promise<{ savedAt: string }>`: serialize with `packages/domain`'s `serialize(project)` → write record with `id`, `name`, `updatedAt: new Date().toISOString()`, `blob`. Return `{ savedAt: updatedAt }` so the caller can pass to `markSaved` for skew-free state (SR-2 mitigation).
3. `loadProject(id): Promise<{ project: Project; lastSavedAt: string }>`: read record → `deserialize(record.blob)` → return `{ project: deserialized, lastSavedAt: record.updatedAt }`. Throw `LoadFailure` with user-friendly message on parse/validation failure.
4. `loadMostRecent(): Promise<{ project: Project; lastSavedAt: string } | null>`: query by `by-updated-at` descending, return `{ project, lastSavedAt }` for the first record (or `null` if the store is empty).
5. `listProjectsByRecency(): Promise<Array<{ id, name, updatedAt }>>`: not used in M1.2 UX but added for infra (used in test assertions).
6. `useAutoLoadMostRecent()` hook in `apps/web/src/hooks/`: on mount, if no project in store, call `loadMostRecent()`. On non-null result, call `hydrateProject(project, lastSavedAt)` imported directly from `@portplanner/project-store` (not via project-store-react — actions live in the vanilla package). Guard: only loads if `useProject()` returns null (prevents overwriting a user who clicked New while load was pending).
7. Tests use `fake-indexeddb/auto` as a setup file:
   - `persistence.test.ts::roundTripIdentity`: create → save → load → canonical JSON byte-identical
   - `persistence.test.ts::loadMostRecent`: save two projects (sleep between to ensure timestamp difference), loadMostRecent returns the later one
   - `persistence.test.ts::rejectsMalformedBlob`: manually inject a malformed blob, `loadProject` throws `LoadFailure` with a usable message

**Invariants introduced:**

| ID | Invariant | Enforcement |
|---|---|---|
| P1 | Round-trip preserves canonical JSON byte-identity | Unit test `persistence.test.ts::roundTripIdentity` |
| P2 | `packages/project-store` has zero IndexedDB / `idb` imports (already S2 from Phase 2; re-verify) | Grep re-run |
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

GP.3 — project-store persistence isolation re-verified (S2)
  Command: rg -n "from 'idb'|localStorage|indexedDB" packages/project-store/src
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
- `apps/web/src/shell/StatusBar.tsx` — import `useProject`, `useIsDirty`, `useLastSavedAt` from `@portplanner/project-store-react`; render dynamic left message
- `apps/web/src/shell/StatusBar.module.css` — add `.dirty` indicator style

**Steps:**

1. `NewProjectDialog`: form with one field (project name, required, trimmed, 1–100 chars). On Submit: build a fresh `Project` value (`id: newProjectId()`, `name`, `createdAt: now`, `updatedAt: now`, `coordinateSystem: null`, `objects: {}`, `scenarioId: null`) and call `createNewProject(project)` from `@portplanner/project-store`. Dialog closes; store now holds the fresh project with `dirty=true`.
2. `ConfirmDialog`: generic "You have unsaved changes. Continue?" shown when user clicks New Project with dirty state. Buttons: Discard / Cancel.
3. `NewProjectButton`: renders "New". Reads `useIsDirty()` and `useProject()` from `@portplanner/project-store-react`. On click, if current project exists and is dirty, shows ConfirmDialog; else shows NewProjectDialog.
4. `SaveButton`: renders "Save". Reads `useProject()` and `useIsDirty()` from `@portplanner/project-store-react`. Disabled when no project or not dirty. On click:
   ```ts
   const { savedAt } = await saveProject(project);   // from apps/web/src/persistence
   markSaved();                                       // from @portplanner/project-store
   ```
   `markSaved()` stamps `lastSavedAt = now()`; the `savedAt` return from `saveProject` is available for any skew-sensitive verification (SR-2 mitigation).
5. `useAutoLoadMostRecent()`: `useEffect` on mount, one-shot. If `useProject()` returns null, call `loadMostRecent()` from persistence. On non-null result, call `hydrateProject(project, lastSavedAt)` imported directly from `@portplanner/project-store`. Guard: the effect double-checks `useProject()` is still null immediately before calling `hydrateProject` (prevents overwriting a user who clicked New mid-load).
6. `useBeforeUnloadGuard()`: adds `beforeunload` listener returning a message if `useIsDirty()` is true; removes on dismount.
7. `StatusBar` dynamic text (consumes hooks from `@portplanner/project-store-react`):
   - No project: `"No project"` tertiary colour
   - Clean: `"{project.name} · Saved {HH:MM}"` (from `useLastSavedAt`) secondary colour
   - Dirty: `"{project.name} · Unsaved changes"` warning colour (existing `--text-warning` token)
8. Tests:
   - `new-project-dialog.test.tsx`: open dialog, type name, submit, assert `projectStore.getState().project` contains the new project with `dirty=true`.
   - `save-button.test.tsx`: set dirty state via `createNewProject`; click Save; assert `fake-indexeddb` contains the record and `dirty=false` and `lastSavedAt` is set.
   - `auto-load.test.tsx`: pre-seed `fake-indexeddb` with a project record; mount App; assert store's project equals the seeded one, `dirty=false`, `lastSavedAt` equals the seeded `updatedAt`.

**Invariants introduced:**

| ID | Invariant | Enforcement |
|---|---|---|
| U1 | apps/web dialog / toolbar / status code uses `var(--…)` tokens only | Grep: `rg -n "#[0-9a-fA-F]{3,8}\b" apps/web/src/{dialogs,toolbar,hooks} -g '*.module.css'` returns zero (inherits M1.1 G4.1 rule) |
| U2 | **Canvas paint loops and 3D scene rendering MUST NOT import from `@portplanner/project-store-react`.** (This is the *architectural* rule from GR-3 + ADR-015; it forbids React in canvas/scene code, not in apps/web chrome.) apps/web chrome is free to import both: actions from `@portplanner/project-store`, hooks from `@portplanner/project-store-react`. There is no re-export indirection in this revision. | In M1.2 only apps/web exists, so the gate passes trivially; M1.3 introduces canvas code and the gate becomes active. Grep: `rg -n "from '@portplanner/project-store-react'" packages/editor-2d/src/canvas/ packages/viewer-3d/src/scene/` expected zero (directories don't yet exist in M1.2; gate validates structure when they do). |
| U3 | Navbar renders exactly the 2 M1.2 toolbar buttons (no scope creep) | Visual assertion in test; TSX search for `Button` inside Navbar yields exactly NewProjectButton + SaveButton |

**Mandatory Completion Gates:**

```
GU.0 — full apps/web tests pass
  Command: pnpm --filter @portplanner/web test
  Expected: exit 0

GU.1 — no hardcoded hex in M1.2 UI CSS modules (inherits M1.1 G4.1)
  Command: rg -n "#[0-9a-fA-F]{3,8}\b" apps/web/src/{dialogs,toolbar,hooks,shell} -g '*.module.css'
  Expected: zero matches

GU.2 — canvas paint / 3D scene code does not import React bindings (U2)
  Command: rg -n "from '@portplanner/project-store-react'" packages/editor-2d/src/canvas/ packages/viewer-3d/src/scene/
  Expected: zero matches. In M1.2 these directories do not exist yet
  so the gate passes trivially; it becomes active in M1.3 when the
  canvas code is written.
  Rationale: the architectural rule (GR-3 + ADR-015) is
  "canvas-no-React", not "apps/web-only-from-react". apps/web chrome
  freely imports actions from @portplanner/project-store and hooks
  from @portplanner/project-store-react — one from each location,
  no re-export indirection. This matches the clarified usage
  contract: actions live in the vanilla package; hooks live in the
  React package; consumers import from where each lives.

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
| S1 | packages/project-store has zero React imports | 2 | GS.1 |
| S2 | packages/project-store has zero persistence imports | 2 | GS.2, re-verified GP.3 |
| S3 | zundo history captures ONLY the `project` slice | 2 | Unit test |
| S4 | project-store imports only from @portplanner/domain among workspace pkgs | 2 | GS.3 |
| R1 | React listed as peerDependency only in project-store-react | 3 | GR.1 |
| R2 | project-store-react imports only from project-store + domain + react | 3 | GR.2 |
| P1 | Round-trip preserves canonical JSON byte-identity | 4 | Unit test |
| P3 | All IndexedDB / idb imports live under apps/web/src/persistence/ | 4 | GP.2 |
| U1 | No hardcoded hex in apps/web CSS modules (M1.1 G4.1 scope extended to new dirs) | 5 | GU.1 |
| U2 | Canvas paint / 3D scene code MUST NOT import `@portplanner/project-store-react` (apps/web chrome imports freely from both packages per role — no re-exports). Gate activates in M1.3 when canvas subdirs exist. | 5 | GU.2 |
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
| `packages/project-store/tests/store.test.ts` | 3 | `createNewProject` sets project + dirty=true + lastSavedAt=null; `hydrateProject` sets project + dirty=false + lastSavedAt=provided; `markSaved` flips dirty=false + stamps lastSavedAt=now |
| `packages/project-store/tests/zundo.test.ts` | 3 | Temporal slice scope: `projectStore.temporal.getState()` exposes ONLY fields from the `project` slice (not dirty, not lastSavedAt, and not selection/tool/viewport which don't yet exist); both `createNewProject` and `hydrateProject` reset `pastStates` to empty per Zundo whole-state-replacement; `undo()` / `redo()` on empty history is a no-op. M1.2 has zero mutations (§6 PI-1 + §8), so these tests verify infrastructure, not behaviour. Full undo/redo behaviour tests land in M1.3 when real mutations exist. |
| `packages/project-store-react/tests/hooks.test.tsx` | 6 | One per hook + null/missing-id edge cases |
| `apps/web/tests/persistence.test.ts` | 6 | roundTripIdentity, loadMostRecent, listProjectsByRecency, rejectsMalformedBlob, rejectsNonExistentId, schemaVersionMismatch |
| `apps/web/tests/new-project-dialog.test.tsx` | 3 | opens, accepts valid, rejects empty name |
| `apps/web/tests/save-button.test.tsx` | 3 | disabled when no project, enabled when dirty, save flow writes record + markSaved flips dirty=false |
| `apps/web/tests/auto-load.test.tsx` | 2 | pre-seeded db auto-loads via `hydrateProject` (dirty=false; lastSavedAt preserved from record); empty db leaves store null |

**Target total added:** ~44 cases (dropped 2 persistence-bridge cases + 1
actions-reexport case from Round 2; store.test.ts count reduced from 4 to
3 as the three-action split makes each action test self-contained).
Combined with M1.1's 13, the full suite is ~57 cases at end of M1.2.

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
7. `pnpm test` exits 0; all ~57 tests pass (13 from M1.1 + ~44 added by M1.2).
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
| zundo middleware scoping accidentally widens to UI state later | Medium | ADR-015 is explicit; Phase 2 gates assert the temporal slice only contains `project`; Codex enforces during audit |
| `project-store-react` accidentally lists `react` under `dependencies` | Medium | GR.1 gate parses `package.json` and rejects. Caught before merge. |
| Auto-load on cold start races with user clicking "New" immediately | Low | Auto-load runs in a `useEffect` on mount with a guard: only loads if `useProject()` returns null. If user clicks "New" before load resolves, the guard prevents overwrite. Covered by `auto-load.test.tsx`. |
| IndexedDB quota exceeded (QuotaExceededError) | Very low in M1.2 (docs are tiny — no objects yet) | Catch and surface to UI later when doc sizes grow. For M1.2, unhandled — acceptable because triggering it requires malicious input. |
| Circular type dependency between `project-store` and `project-store-react` | Medium | `project-store-react` is one-way — consumes `project-store`, never imported by `project-store`. Enforced by grep gate (R2). |
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
**Status:** Plan revised for Round 2 — awaiting re-review

### Paste to Codex for Round 3 re-review

> Round 3 re-review of the M1.2 Project Model plan per Codex
> Procedure 02, strict evidence mode, §2.8 multi-round discipline
> (mark prior items Resolved / Open / Regressed / Review Miss).
>
> Round 2 memo (2026-04-21) rated **6.0/10 No-Go** with 2 Blockers
> (R2-B1 coord compatibility overreach + R2-B2 ADR-010 Operation
> shape mismatch, which was a Review Miss from Round 1) and 2
> High-risk (R2-H1 .strict() regression + R2-H2 stale zundo test
> wording) and 2 acknowledged Quality gaps.
>
> Before reviewing, **re-read Procedure 02 §2.10's "Mandatory
> revision-discipline reminder" clause** (recently added to the
> contract) — that's the clause directing Claude (the plan author)
> to re-run §1.3 self-audit + §1.13 notification + §1.16 step 12
> section-consistency pass on revisions. This review should verify
> Claude actually did those on this Round 3 response (check for the
> §1.13 notification in chat history and the §1.3 self-audit
> findings appearing as Round 3 items in Appendix A).
>
> Plan at head: see current git log on `feature/m1-2-document-model`.
> Round 2 commit reviewed was `b1a60c5`.
>
> Required reading (in order):
> 1. `docs/procedures/Codex/00-architecture-contract.md` — includes
>    §0.7 "Progressive implementation" clause and the updated GR-3
>    with `project-store` + `project-store-react` packages (post-
>    rename).
> 2. `docs/procedures/Codex/02-plan-review.md` (§2.8, §2.9, §2.10
>    including the mandatory revision-discipline reminder clause).
> 3. `docs/adr/002-object-model.md`
> 4. `docs/adr/003-ownership-states.md`
> 5. `docs/adr/010-project-sync.md` (renamed from `010-document-sync.md`)
> 6. `docs/adr/012-technology-stack.md`
> 7. `docs/adr/014-persistence-architecture.md`
> 8. `docs/adr/015-project-store-state-management.md` (renamed;
>    content v1.1.0 drops the action re-export from the concrete
>    usage contract)
> 9. `docs/execution-plan.md` (M1 scope)
> 10. `docs/coordinate-system.md`
> 11. `docs/glossary.md` (Project entry; previously "Project
>     document")
> 12. This plan — start with Appendix A to see the Round 2 → Round 3
>     response + the Round 3 self-audit subsection; then cross-check
>     each claimed fix against the plan body.
>
> Specifically verify the Round 2 resolutions:
>
> RR-R2-B1 (was R2-B1 — CoordinateSystem shape mismatch)
>   Verify Phase 1 Step 2 defines `CoordinateSystem` with the exact
>   binding fields (`originLat`, `originLng`, `trueNorthRotation`,
>   `utmZone`) — not the fabricated `(origin{x,y}, rotationDeg, unit)`
>   shape. Verify Phase 1 Step 4 makes `coordinateSystem` nullable
>   on the `Project` type. Verify §6 PI-2 mapping table uses the
>   corrected shape and explicit null-at-creation rationale. Verify
>   §4 and §5 rows cite `docs/coordinate-system.md` field-for-field
>   compatibility.
>
> RR-R2-B2 (was R2-B2 — Operation shape mismatch with ADR-010)
>   Verify Phase 1 Step 5 defines `Operation` as a TypeScript code
>   block matching ADR-010 field-for-field: `id`, `projectId`,
>   `sequence`, `timestamp`, `userId`, `type` (OperationType union
>   of 7 values), `objectId`, `before: ObjectSnapshot | null`,
>   `after: ObjectSnapshot | null`. All fields non-optional; before
>   / after nullable. Verify `LOCAL_USER_ID` placeholder is
>   documented with the M1-auth-deferred rationale.
>
> RR-R2-H1 (was R2-H1 — `.strict()` regression)
>   Verify Phase 1 Step 8 explicitly forbids `.strict()` on the
>   project schema chain and uses default-strip at root; Zod
>   semantics described correctly (default strips, `.strict()`
>   rejects, `.passthrough()` preserves); `Object.parameters` uses
>   `.passthrough()`; aligns with §8 Hydration.
>
> RR-R2-H2 (was R2-H2 — stale zundo test language)
>   Verify §11 zundo test row describes infrastructure tests
>   (temporal scope / pastStates reset / no-op), not behaviour
>   tests (mutation-revert claims).
>
> RR-R2-Q1 (node -e brittleness) — accepted open with PE fallback.
>
> RR-R2-Q2 (concurrent-tab / HMR) — HMR guard retained in Phase 2
>   step 3; concurrent-tab deferred.
>
> Fresh Round-3-specific checks:
>
> F-R3-A1  **SR-1 fix (dirty-flag split actions).** Verify Phase 2
>   Step 4 describes three named actions: `createNewProject`,
>   `hydrateProject(project, lastSavedAt)`, `markSaved`. No single
>   `setDocument` action. No `persistence-bridge.ts` in Phase 2 file
>   list or tests. Verify Phase 4 `loadProject` / `loadMostRecent`
>   return `{ project, lastSavedAt }` (not just project). Verify
>   Phase 5 `useAutoLoadMostRecent` calls `hydrateProject` with both
>   args.
>
> F-R3-A2  **Full Document → Project rename.** Verify no stale
>   `Document` / `ProjectDocument` / `doc-store` references remain
>   in prose (Appendix A may retain historical references — that's
>   intentional). Run:
>     rg -n "ProjectDocument|@portplanner/doc-store|packages/doc-store|Document Sync|Document Store" docs/plans/feature/m1-2-document-model.md
>   Expected: zero non-historical matches.
>
> F-R3-A3  **Re-export pattern dropped.** Verify Phase 3 file list
>   does NOT include `src/actions.ts` or `tests/actions-reexport
>   .test.ts`. Verify Phase 3 Step 4 explicitly states actions are
>   imported directly from `@portplanner/project-store`; hooks from
>   `@portplanner/project-store-react`; no re-export.
>
> F-R3-A4  **U2 / GU.2 semantics clarified.** Verify §10 U2 and
>   GU.2 gate now describe the canvas-no-React rule (GR-3 /
>   ADR-015) rather than the old "apps/web imports only from
>   project-store-react" rule (which was an over-fit to Codex R1/H3
>   ambiguity, now resolved by the clarified usage contract).
>
> F-R3-A5  **§1.13 pre-response notification.** Codex should
>   acknowledge the notification emitted in chat before this
>   revision commit and verify it matches Appendix A's Round 3
>   self-audit subsection.
>
> F-R3-A6  **Appendix A integrity.** Round 1 → Round 2 subsection
>   untouched; Round 2 → Round 3 subsection appended; Round 3
>   self-audit subsection appended; user approvals list extended.
>
> F-R3-A7  **Test count consistency.** §11 total now ~44 added
>   (dropped 2 persistence-bridge + 1 actions-reexport; store.test
>   reduced from 4 to 3). Done Criteria §12 matches (~57 combined).
>
> Output per §2.9. Apply §2.8 delta marking. If zero Blockers and
> every High-risk explicitly handled, move to Go per §2.11. If
> Blockers remain, §2.10 mandatory handback reminder applies —
> direct Claude to re-read Procedure 01 §1.3 + §1.13 + §1.16 step
> 12 + step 13 + Procedure 02 §2.10 before the next revision.

---

## Appendix A — Scrutiny Assessment and Actions (Round 1 → Round 2)

In response to Codex Round 1 review (memo dated 2026-04-21, reviewing
plan at commit `07549a5`, rating **4.5/10 No-Go** with 3 Blockers, 3
High-risk items, and 2 Quality gaps). Per Codex Procedure 02 §2.10,
this appendix documents each finding's decision, rationale, and the
plan updates made. History is preserved — prior plan text is updated
in-place, but the review record here is untouched.

### Blockers

| ID | Codex Item | Decision | Plan updates | Rationale |
|---|---|---|---|---|
| B1 | Item 2 (Operation defined but not emitted) classified as "no deviations" but fails §0.7 four-condition test: reachable mutations (`renameDocument`) exist without emission | **Agree — reclassify as progressive implementation after removing the reachable mutation** | Phase 2 actions list updated: `renameDocument` REMOVED (no UI consumer in M1.2; was dead action). Only `setDocument` (state-reset) and `markSaved` (persistence metadata) remain — neither is a document mutation per ADR-010. §8 Undo/Redo section rewritten to reflect zero mutations → zero emissions. §6 adds PI-1 four-condition mapping table showing all four conditions satisfied after the `renameDocument` removal. Phase 2 tests refactored: no rename test; zundo test now asserts temporal scope rather than undo behaviour. | Removing `renameDocument` is a pure simplification — it had no UI surface in M1.2 and rename-via-Project-Settings is an M2 feature. With zero mutation actions at the type level, condition 2 (unreachable at type level) becomes Pass; with `setDocument` + `markSaved` being non-mutations, condition 1 becomes Pass. User approval recorded for condition 3. |
| B2 | Item 10 (New Project dialog defers coordinate input) classified as "no deviations" but fails §0.7 four-condition test | **Agree — add explicit four-condition mapping** | §6 adds PI-2 four-condition mapping table. Each condition has concrete evidence tied to plan sections: M1.2 surface area exposes no `setCoordinateSystem` action (condition 2); default `CoordinateSystem` is a valid type member (condition 1); user popup approval on 2026-04-21 recorded with identifier (condition 3); M1.3 widening path named (condition 4). | Defaulting to `(0, 0, 0°)` is not a runtime behaviour the binding coordinate-system doc forbids — it's a valid starting value. User explicitly chose deferral in pre-plan popup. Execution-plan M1 #3 "project creation with coordinate system setup" is a Milestone 1 deliverable split across M1.2 (doc infrastructure) and M1.3 (user-facing UI). |
| B3 | §6 blanket "None" incompatible with unresolved §0.7-sensitive deferrals | **Agree** | §6 rewritten to declare both PI-1 and PI-2 explicitly, with four-condition mapping tables each. Blanket "None" replaced with "None declared as deviations" + detailed PI classification. | Section-consistency pass per §1.16.12 caught no remaining blanket "None" references. |

### High-risk

| ID | Codex Item | Decision | Plan updates | Rationale |
|---|---|---|---|---|
| H1 | Internal mutation/sync contradiction: "no mutations beyond creation" vs explicit `renameDocument` action + test | **Agree** | Resolved by B1's fix: `renameDocument` removed from Phase 2 file list, steps, and tests. §4 ADR-010 row updated to say "zero project-level mutations in M1.2 (only state-reset + persistence metadata)." §8 Undo/Redo section rewritten for consistency. Section-consistency pass confirms no remaining rename references except in Appendix A historical record. | Single root cause: the removed `renameDocument` action. Removing it eliminates every contradiction simultaneously. |
| H2 | Hydration semantics wrong: `.strict()` REJECTS, not strips | **Agree** | §8 Hydration section rewritten. Corrected terminology: `.strict()` rejects (throws `ZodError`); default Zod behaviour strips; `.passthrough()` preserves. M1.2 uses **default (strip) at the root** (for version-forward tolerance) and `.passthrough()` on `Object.parameters` (JSONB bag per ADR-002). `schemaVersion` literal check catches incompatible files with explicit error message. | Original plan text incorrectly described Zod semantics. Corrected wording protects implementers from wrong error behaviour. |
| H3 | Gate/step ambiguity: Phase steps imply store initialization in app shell while GU.2 demands zero direct project-store imports | **Agree** | Phase 3 step 4 added: `project-store-react` re-exports actions (`setDocument`, `markSaved`) from `@portplanner/project-store`. apps/web imports the full API (hooks + actions) from `project-store-react` only. `actions.ts` is added to the Phase 3 file list. `actions-reexport.test.ts` verifies the re-exported functions are the same references as the originals. §10 U2 invariant tightened: apps/web imports exclusively from `project-store-react`. GU.2 gate rewritten to explicitly match this architectural path. Persistence calls accept the document as an argument from hook-reading UI; they do NOT call `store.getState()` themselves. | Codex's ambiguity concern is correct — there was a path conflict. The re-export pattern makes project-store-react the single API surface and preserves GU.2 cleanly. |

### Quality gaps

| ID | Codex Item | Decision | Plan updates | Rationale |
|---|---|---|---|---|
| Q1 | GR.1 gate uses `node -e` (potentially brittle in CI) | **Partial agree — keep but note** | No change to the gate command. `node -e` executes reliably in CI once Node 20 LTS is installed via `.nvmrc` (which CI does per Phase 5's workflow file). The parser is a 3-line one-liner that exits 1/2 on failures; failures surface as workflow logs. If the team hits a portability issue during execution, a shell-based alternative can be swapped in as PE-N. | Brittleness is hypothetical; Node is guaranteed present in CI. Swap is cheap if ever needed. |
| Q2 | Handoff asks (concurrent-tab IndexedDB, HMR state loss) mentioned but not gated | **Partial agree — defer with rationale** | Concurrent-tab IndexedDB access is rare in M1.2 single-project mode (one tab at a time is the expected UX). Deferred to M2 when multi-project enumeration UX lands. HMR state loss: addressed by adding `import.meta.hot?.accept()` to `packages/project-store/src/store.ts` as part of Phase 2 implementation (minor addition to step 3); documented but not gated since HMR is dev-only. Listed as residual risk in §13. | Gating every theoretical risk bloats the plan. The ones with real user-visible impact today are gated; the rest are flagged for future milestones. |

### Self-review misses — patterns for future discipline

| Miss | Root cause | Proposed procedure rule enhancement |
|---|---|---|
| §6 "None" alongside Reviewer Handoff asking if items 2/10 need progressive mapping | Section-consistency gap: the handoff block asked the exact question that §6 should have answered explicitly | Procedure 01 §1.16 step 12 (section-consistency pass) should grow a specific sub-rule: "If the Reviewer Handoff block asks Codex to rule on a classification, §6 MUST contain the plan author's proposed classification (even if tentative) rather than leaving the question unanswered in the body." |
| Mutation semantics contradicted across §4 / §8 / Phase 2 | Internal consistency gap between abstract doc-level claims ("no mutations") and concrete Phase 2 action list (`renameDocument`) | Section-consistency pass should include a specific cross-reference check: every action/method named in any phase MUST reconcile with the mutation-or-not classification in §7 / §8. |
| Zod `.strict()` behaviour misremembered | Library knowledge gap; no automated check catches this class of error | N/A — depends on author's library familiarity. Codex second opinion is the natural safeguard; the system worked as intended (review caught the error). |

### User approvals recorded (2026-04-21, aleksacavic@gmail.com)

| # | Decision | Source |
|---|---|---|
| 1 | PI-1 classification: Operation type defined, emission deferred to M1.3 (progressive implementation, not deviation) | Round 1 → Round 2 response to Codex finding B1 |
| 2 | PI-2 classification: geodetic coord input deferred to M1.3 (progressive implementation, not deviation) | Pre-plan popup Q3 on 2026-04-21 + reaffirmation in Round 1 → Round 2 response to Codex finding B2 |
| 3 | Remove `renameDocument` from M1.2 scope (was dead action; UI arrives M2+) | Round 1 → Round 2 response to Codex finding B1 + H1 |
| 4 | Hydration uses Zod default (strip) at root; `.strict()` wording corrected | Round 1 → Round 2 response to Codex finding H2 |
| 5 | `project-store-react` re-exports actions from `project-store` so `apps/web` imports from `project-store-react` only | Round 1 → Round 2 response to Codex finding H3 |
| 6 | HMR guard added to `packages/project-store/src/store.ts` (`import.meta.hot?.accept()`); concurrent-tab gating deferred to M2 | Round 1 → Round 2 response to Codex finding Q2 |

### Round 2 closure checklist (against Codex §2.11)

- [x] Zero Blockers: B1 (PI-1 mapping + `renameDocument` removal), B2 (PI-2 mapping), B3 (§6 rewritten — no blanket "None").
- [x] Every High-risk item explicitly handled: H1 (mutation contradiction removed), H2 (Zod wording corrected), H3 (actions re-export pattern; GU.2 tightened).
- [x] Enforceable gates for all critical claims: new `actions-reexport.test.ts` gates H3; updated GU.2 gate text; §6 PI tables backed by concrete plan-section references.
- [x] Architecture-doc impact assessed: no ADR changes required; no new deviation-protocol artifacts; §6 classifications are internal plan decisions under the existing §0.7 progressive-implementation clause.
- [x] GR-3 module isolation verified: project-store stays vanilla (S1/S2); project-store-react peer-React (R1); apps/web imports project-store-react only (U2/GU.2).
- [x] All deviations follow §0.7 protocol — none proposed; both deferrals classified as progressive implementation with full four-condition mapping per architecture-contract §0.7.
- [x] History preserved per §2.10: prior §6 / §8 / Phase 2 text updated in place; Round 1 review record in this appendix untouched; no retroactive rewrites.

### Round 2 → Round 3 response

In response to Codex Round 2 review (memo dated 2026-04-21,
reviewing plan at commit `fb2f512`, rating **6.0/10 No-Go** with 2
Blockers, 2 High-risk items including one regression, and 2
acknowledged Quality gaps).

#### Blockers

| ID | Codex Item | Decision | Plan updates | Rationale |
|---|---|---|---|---|
| R2-B1 | PI-2 condition #1 over-claimed compatibility with `docs/coordinate-system.md`. Plan's TS shape `(origin{x,y}, rotationDeg, unit)` did NOT match the binding interface (`origin_lat`, `origin_lng`, `true_north_rotation`, `utm_zone` + transform methods). | **Agree — root cause was author error in §6 PI-2 plus Phase 1 Step 2** | **CoordinateSystem type redefined field-for-field from `docs/coordinate-system.md` §"Implementation requirements"**: `originLat`, `originLng`, `trueNorthRotation`, `utmZone` (camelCase per TS convention; semantic 1:1 with snake_case fields in the binding doc). Transform methods (`toProjectLocal`, `toWGS84`, etc.) arrive in M1.3 as class methods, not on the stored data. `Project.coordinateSystem` is `CoordinateSystem \| null` — null at creation per the binding doc's "origin is chosen by the user… immutable once set" language. §6 PI-2 rewritten with the corrected shape and null-at-creation rationale. §4 and §5 rows updated. | The previous `(origin{x,y}, rotationDeg, unit)` shape was fabricated — it didn't trace to any binding document. Field-for-field alignment with the actual `docs/coordinate-system.md` interface resolves the compatibility claim. Nullable coord-system at creation is consistent with the binding doc's "immutable once set" language (null = not-yet-chosen). |
| R2-B2 (Review Miss) | ADR-010 `Operation` shape mismatch — plan's Operation omitted `project_id`, `sequence`, and weakened `user_id` / `object_id` / `before` / `after` to optional. | **Agree — author error on spec fidelity; should have been caught Round 1** | **Operation type rewritten field-for-field from ADR-010**: `id`, `projectId`, `sequence`, `timestamp`, `userId`, `type` (typed union of the 7 ADR-010 OperationTypes), `objectId`, `before: ObjectSnapshot \| null`, `after: ObjectSnapshot \| null`. All fields non-optional; `before` and `after` are nullable (null on CREATE/DELETE respectively) per ADR-010. `userId` uses a fixed `LOCAL_USER_ID` placeholder UUID in M1 (documented as progressive implementation of auth — ADR-010 requires the field; value is a known sentinel until auth lands M3+). `OperationType` is the full union (`CREATE | UPDATE | DELETE | GENERATE | FREEZE | DETACH | UNFREEZE`). Phase 1 Step 5 shows the exact TS code block. | Hard spec-fidelity fix. The placeholder userId is the smallest deviation-free choice — ADR-010 says UUID, we provide a UUID (`00000000-0000-0000-0000-000000000000`); the execution-plan exclusion of auth is already accommodated. |

#### High-risk

| ID | Codex Item | Decision | Plan updates | Rationale |
|---|---|---|---|---|
| R2-H1 (H2 regression) | §8 correctly said default-strip; Phase 1 Step 8 still said `.strict()` | **Agree — section-consistency miss** | Phase 1 Step 8 rewritten: `ProjectSchema` uses **Zod default (strip)** at the root; `Object.parameters` uses `.passthrough()`. **Do NOT use `.strict()`** stated explicitly with rationale. `schemaVersion: '1.0.0'` validated via `.literal('1.0.0')`. Aligns Phase 1 with §8. | Classic drift: fixed §8 in Round 1 response but didn't cross-check Phase 1 Step 8. Addressed by explicit re-statement in the phase step plus the §1.16.12 consistency pass now re-run. |
| R2-H2 | §11 zundo test row said "Undo reverts mutation; redo re-applies" — stale given M1.2 has zero mutations | **Agree** | §11 `zundo.test.ts` row rewritten: three tests now verify *infrastructure* (temporal slice scope, `setDocument` resets `pastStates`, `undo()/redo()` no-op on empty history) rather than *behaviour* (mutation reverting). Full mutation-undo tests land in M1.3 when real mutations exist. | Matches the zero-mutations stance and avoids false assertions. |

#### Quality gaps

| ID | Codex Item | Decision | Plan updates | Rationale |
|---|---|---|---|---|
| R2-Q1 | `node -e` GR.1 gate brittleness (still open) | **Accept as open; non-blocking** | No change. PE escape remains available. | Codex categorised as acceptable-but-tracked. |
| R2-Q2 | Concurrent-tab behaviour deferred without hard gate | **Accept; deferred by design** | No change. Documented as residual risk in §13 with M2 widening target. | Codex categorised as acceptable for M1.2 scope. |

#### Section-consistency pass (§1.16.12) — Round 2 → Round 3

After the above edits, grep for stale references:

- `rotationDeg` — only remains in historical Appendix A Round 1 → Round 2 narrative (intentional).
- `{ x: 0, y: 0 }` / `origin: { x` — 0 matches (correctly replaced with the binding-doc shape).
- `.strict()` alone (as a prescription rather than explanation) — 0 matches in Phase 1 / §4; remaining mentions in §8 are the correct "REJECTS" explanation; in PI-1 tables are intentional cross-reference.
- `Undo reverts mutation` — 0 matches (fixed in §11).
- Operation with `userId?` or `objectId?` optional — 0 matches in current Phase 1 Step 5 code block.
- Operation without `projectId` / `sequence` — 0 matches.

#### User approvals recorded (2026-04-21, aleksacavic@gmail.com)

Extends Round 1 → Round 2 list:

| # | Decision | Source |
|---|---|---|
| 7 | `CoordinateSystem` TS type matches `docs/coordinate-system.md` §"Implementation requirements" field-for-field (camelCase); transform methods deferred to M1.3 | Round 2 → Round 3 response to Codex B1 |
| 8 | `Project.coordinateSystem` is nullable; null at creation ("origin not yet chosen"); M1.3 UI requires real values before placing objects | Round 2 → Round 3 response to Codex B1 |
| 9 | `Operation` type restated field-for-field from ADR-010; all fields non-optional; `before`/`after` nullable; `LOCAL_USER_ID` placeholder UUID for M1 | Round 2 → Round 3 response to Codex B2 |
| 10 | Phase 1 Step 8 explicitly forbids `.strict()` on the document schema chain; uses default (strip) at root for version-forward tolerance; `.passthrough()` on `Object.parameters` | Round 2 → Round 3 response to Codex H2 regression |
| 11 | §11 zundo test row reframed as infrastructure verification (scope, reset, no-op) rather than mutation-behaviour tests, matching zero-mutations stance | Round 2 → Round 3 response to Codex H2/stale-undo-language |

#### Round 3 closure checklist (against Codex §2.11)

- [x] Zero Blockers: R2-B1 (coord shape) + R2-B2 (op shape) both resolved with field-for-field binding alignment.
- [x] Every High-risk item explicitly handled: R2-H1 (`.strict()` regression) fixed; R2-H2 (stale undo language) fixed.
- [x] Enforceable gates unchanged in character; the spec-fidelity fixes tighten TS types, caught at compile time by existing GD.3 (typecheck).
- [x] Binding specs: `docs/coordinate-system.md` and ADR-010 are cited correctly and implementation now matches. §4 + §5 rows updated.
- [x] All deviations follow §0.7 protocol — none proposed; PI-1 and PI-2 remain the only progressive-implementation classifications, now with corrected evidence.
- [x] Section-consistency pass executed (see above): no stale fabricated shapes remain anywhere in the plan.
- [x] History preserved per §2.10: prior plan text updated in place where values changed; Round 1 and Round 2 review records in this appendix untouched; Round 3 response appended as a new subsection.

### Round 3 self-audit + architecture revision (2026-04-22)

Per Procedure 01 §1.3 three-round internal self-audit (re-applied on
the revised plan per the newly-landed §1.16 step 13 revision-
discipline clause) plus user-approved architecture decisions from
the store-design discussion.

#### Self-audit findings

**SR-1 (High-risk — Chief Architect + Sceptical Reader rounds)**:
Phase 2's `setDocument` + `persistence-bridge.ts` design was broken.
The bridge watched for any `document` change and set `dirty = true`,
which worked for the genesis path (New Project → dirty=true ✓) but
broke the hydration path (auto-load → dirty=true ✗; the loaded
project matches IndexedDB, should be clean). Also, `markSaved` used
`new Date().toISOString()` which would overwrite the stored
`updatedAt` timestamp on auto-load with the current time, losing
the original save time.

*Resolution*: Split into three named actions, each with explicit
dirty semantics encoded in the action:
- `createNewProject(project)` — genesis; dirty=true, lastSavedAt=null.
- `hydrateProject(project, lastSavedAt)` — load; dirty=false,
  lastSavedAt=provided (from IndexedDB record).
- `markSaved()` — post-save metadata; dirty=false, lastSavedAt=now.

`persistence-bridge.ts` deleted (was ~10 LOC of broken watcher).
`loadProject` / `loadMostRecent` return type extended to
`{ project, lastSavedAt }` so `useAutoLoadMostRecent` has the stored
timestamp. Phase 2 file list + steps + tests + §11 test strategy
all updated.

**SR-2 (Quality gap — Sceptical Reader)**: `markSaved()` uses
`new Date().toISOString()` for `lastSavedAt`; `saveProject` writes
its own `new Date().toISOString()` to the IndexedDB record. Possible
millisecond-level skew between the in-memory `lastSavedAt` and the
IDB record's `updatedAt`. Cosmetic; on next auto-load, the IDB value
wins. Mitigation added: `saveProject` now returns `{ savedAt }` so
a skew-sensitive caller could pass it to a future `markSaved(t)`
variant. Current M1.2 accepts the skew.

**SR-3 (not found; noted for completeness)**: Blast Radius round
surfaced no additional concerns. Client-only M1.2; no server
impact; downstream M1.3/M1.4 consumers are simplified by the
explicit three-action API.

#### Architecture revision (user-approved 2026-04-22)

During the store-design discussion following Round 2 review, the
following architecture decisions landed:

1. **Rename `Document` → `Project` across the architecture pack.**
   The concept renamed uniformly: glossary term, ADR titles
   (ADR-010 "Project Sync and Offline Model", ADR-015 "Project
   Store and State Management Scope"), package names (`doc-store`
   → `project-store`, `doc-store-react` → `project-store-react`),
   type name (`ProjectDocument` → `Project`), hook names
   (`useDocument` → `useProject`). Rename chore landed on main in
   commit `667efce`.

2. **Drop the action re-export pattern.** Round 2's resolution of
   R1/H3 added `packages/project-store-react/src/actions.ts` to
   re-export actions from `project-store`, so `apps/web` had a
   single import source. Clarifying discussion showed this was
   over-fitting: the real GR-3 rule is "canvas paint code does not
   import React bindings," not "apps/web imports only from the
   React package." Actions live in `project-store` (plain
   functions, framework-agnostic). Hooks live in
   `project-store-react` (React-specific). Consumers (apps/web
   chrome, editor-2d canvas, etc.) import from where each lives.
   No re-export discipline to maintain; no `actions-reexport.test`
   needed. ADR-015 v1.1.0 landed on main reflecting this.

3. **U2 / GU.2 simplified.** The "apps/web never imports from
   `project-store`" rule was dropped. The actual architectural
   concern (enforced by GR-3 grep gate) is canvas paint code not
   importing React bindings. Gate text updated accordingly; gate
   passes trivially in M1.2 (no canvas subdirs yet) and becomes
   active in M1.3.

#### Plan updates (this revision)

| Area | Change |
|---|---|
| Title + subtitle | `M1.2 Document Model` → `M1.2 Project Model`. Note added about branch / filename retention from pre-rename scaffolding. |
| §3 Scope file list | Phase 2 line updated: three actions, no persistence-bridge |
| §4 Binding specs | ADR-010 / ADR-015 row titles updated; ADR-015 row now mentions no-re-export |
| §5 Architecture Doc Impact | ADR-010 and ADR-015 paths use new filenames |
| §6 PI-1 condition 1 | References three non-mutation actions; historical setDocument note |
| §6 PI-2 | Unchanged (coord deferral classification stable) |
| §8 Hydration flow | `hydrateProject(parsed, record.updatedAt)` replaces the setState call |
| §8 Undo/Redo | Three actions enumerated; all non-mutations |
| §10 Invariants | S3 "project slice" (was "document slice"); U2 rewritten to canvas-no-React rule |
| Phase 2 file list | `persistence-bridge.ts` + test removed; exports `projectStore` singleton |
| Phase 2 Step 1 | State shape `{ project: Project \| null; dirty; lastSavedAt }` |
| Phase 2 Step 3 | Temporal scope = `project` slice |
| Phase 2 Step 4 | Three actions (createNewProject, hydrateProject, markSaved) with inline dirty semantics; SR-1 rationale note |
| Phase 2 Step 5 | Removed (persistence-bridge gone); renumbered |
| Phase 2 Step 6 | Tests: store (3), zundo (3); no persistence-bridge test |
| Phase 3 file list | `src/actions.ts` + `actions-reexport.test.ts` removed |
| Phase 3 Step 4 | No re-export; consumers import from where each lives |
| Phase 4 Step 2–4 | Return types `{ project, lastSavedAt }`; saveProject returns `{ savedAt }` |
| Phase 4 Step 6 | `useAutoLoadMostRecent` calls `hydrateProject` with both args |
| Phase 5 Step 1 | `createNewProject` (not setDocument) |
| Phase 5 Step 4 | Save flow: `saveProject` → `markSaved` |
| Phase 5 Step 5 | Auto-load flow: `loadMostRecent` → `hydrateProject` |
| GU.2 gate | Canvas-no-React rule (active in M1.3) |
| §11 test strategy | Dropped persistence-bridge (2) + actions-reexport (1); store.test reduced 4→3; total ~44 new |
| §12 Done Criteria | Test count ~57 |
| §13 Risks | No longer lists re-export discipline risk |
| Reviewer Handoff | Updated for Round 3 re-review prompt |

#### User approvals extended (2026-04-22)

Extends Round 1 → Round 2 list:

| # | Decision | Source |
|---|---|---|
| 12 | Split `setDocument` into `createNewProject` + `hydrateProject` + `markSaved`; delete `persistence-bridge.ts`; dirty managed inline | SR-1 fix approved 2026-04-22 |
| 13 | Full `Document → Project` rename across architecture pack + plan | User direction 2026-04-22 |
| 14 | Drop action re-export pattern — actions in `project-store`, hooks in `project-store-react`, consumers import from where each lives | User approval + Codex discussion 2026-04-22 |
| 15 | GU.2 simplified to canvas-no-React rule per ADR-015 v1.1.0 | Follows from #14 |

#### Round 3 self-audit closure

- [x] Procedure 01 §1.3 three internal review rounds executed on the REVISED plan (Chief Architect: no ADR violations; Sceptical Reader: SR-1 + SR-2 surfaced and resolved; Blast Radius: no downstream-consumer impact). Findings recorded above.
- [x] Procedure 01 §1.13 pre-response notification emitted in chat BEFORE this commit. User acknowledged via "go go agreed" + "your proposal is perfect, implement…" pattern.
- [x] Procedure 01 §1.16 step 12 section-consistency pass executed after edits; all stale `setDocument` / `persistence-bridge` / `document slice` / `doc-store` references confined to intentional Appendix A historical context or SR-1 rationale notes.
- [x] Procedure 01 §1.16 step 13 revision-discipline met: §1.3 + §1.13 + §1.16 step 12 all applied to this revised emission.
- [x] Procedure 02 §2.10 Scrutiny Response Protocol satisfied: Round 2 → Round 3 subsection appended above; Round 3 self-audit subsection appended here; prior round records preserved untouched.
- [x] No new deviations introduced. PI-1 and PI-2 remain the only progressive-implementation classifications.
