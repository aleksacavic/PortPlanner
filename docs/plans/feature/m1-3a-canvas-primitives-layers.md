# Plan — M1.3a Hybrid Drafting Surface (Canvas + Primitives + Layers + Grid)

**Branch:** `feature/m1-3a-canvas-primitives-layers`
**Author:** Claude (Opus 4.7, 1M context)
**Date:** 2026-04-25
**Operating mode:** Procedure 01 (PLAN-ONLY) → Procedure 03 (EXECUTION) after approval
**Status:** Plan authored — awaiting review

---

## 1. Request summary

Implement Milestone 1.3a per `docs/execution-plan.md`: stand up the hybrid
drafting surface that lets a planner open a project, set up a canvas
viewport, and draft freely in the seven primitive types (point, line,
polyline-with-bulge, rectangle, circle, arc, xline) on layers, with grids
as drafting aids. Adds a new `packages/editor-2d` package, expands
`packages/domain` and `packages/project-store` with primitive / layer /
grid entities, brings `Operation` and `ProjectObject` into binding-ADR
shape (ADR-020 and ADR-019), introduces a window-level keyboard routing
discipline + AutoCAD-style command bar (per ADR-023, which supersedes
ADR-022 in this milestone — see §5 + Phase 15), and ships the essential
operator set + seven primitive draw tools.

No promotion, no typed objects (RTG_BLOCK et al), no dimensions, no
extraction. Promotion + typed objects → M1.3b. Dimensions + remaining
OSNAP modes + POLAR + OTRACK → M1.3c. Extraction + validation + capacity
panel → M1.4.

ADR governance: ADR-022 is **superseded by ADR-023** (new) per §0.6 +
§0.7 step 3, with the operator shortcut SSOT moving to a subordinate
registry file `docs/operator-shortcuts.md`. ADR-022 moves to
`docs/adr/superseded/`. Same-PR spec-update commitment satisfied —
docs and code land in the same M1.3a PR.

> **Architecture contract source-of-truth note:** the architecture
> contract lives at `docs/procedures/Claude/00-architecture-contract.md`
> (Claude-side) and `docs/procedures/Codex/00-architecture-contract.md`
> (Codex-side). No `docs/architecture.md` exists at the repo root.

## 2. Assumptions and scope clarifications

User-confirmed in pre-response acknowledgment dated 2026-04-25:

- **A1 — `ProjectObject` aligned to ADR-019 now (Q1 approved).** Adds
  `layerId: LayerId` (required, defaults to `LayerId.DEFAULT`),
  `displayOverrides: DisplayOverrides`, `sourceKind: 'direct' | 'promoted'`,
  optional `sourceProvenance`. No `ProjectObject` instances exist in
  M1.3a (no typed objects yet) — the type and schema are brought into
  compliance proactively to avoid a partial-refactor in M1.3b.
- **A2 — ADR-022 superseded by ADR-023 + subordinate registry file
  `docs/operator-shortcuts.md` (Codex Round-1 OI-1 resolution,
  user-acknowledged 2026-04-25).** ADR-023 restates ADR-022's
  framework decisions (command bar, generator-pattern tools,
  keyboard routing, sub-options, focus discipline) and adds the
  seven primitive draw-tool shortcut rows (`PT`, `L`, `PL`, `REC`,
  `CC`, `A`, `XL`/`XX`). ADR-023 also rewrites the operator-addition
  governance clause to point at `docs/operator-shortcuts.md` as the
  authoritative shortcut SSOT going forward; future operator additions
  edit the registry file (with version bumps + changelog) and do not
  edit any ADR. ADR-022 moves to `docs/adr/superseded/022-tool-state-
  machine-and-command-bar-superseded.md` with `Status: SUPERSEDED` +
  `Superseded by: ADR-023` headers per §0.6 governance. Both
  architecture contracts (Claude + Codex) get §0.2 binding-table
  refresh: ADR-022 row removed, ADR-023 row added, supersession note
  appended (mirrors the drawing-model-pivot precedent for ADRs
  002/010/013 → 019/020/021). Supersession is the binding-compliant
  mechanism per §0.7 step 3 and is not classified as a deviation.
- **A3 — UI state co-located in `packages/editor-2d/src/ui-state/`
  (Q3 approved).** Single store using vanilla zustand + immer (no
  zundo — UI state is not undoable per ADR-015). When a second consumer
  emerges (3D viewer, future shared chrome), promote to a separate
  package; expected refactor cost is ~1–2 hours mechanical.
- **A4 — Snap scope M1.3a (Q4 approved).** OSNAP modes: endpoint,
  midpoint, intersection, node. GSNAP: grid node + grid-line fallback.
  Ortho modifier. Remaining OSNAP modes (center, perpendicular, tangent,
  parallel, quadrant, nearest, extension, apparent intersection), POLAR,
  and OTRACK deferred to M1.3c.
- **A5 — Draw-tool shortcuts (Q5 final).** `PT` Point, `L` Line,
  `PL` Polyline, `REC` Rectangle, `CC` Circle (avoids collision with
  `C` Copy), `A` Arc, `XL` and `XX` (alias) Xline.
- **A6 — Coordinate-system UX (corrected from M1.2 PI-2).** The
  geodetic anchor (`coordinateSystem`: `originLat`, `originLng`,
  `trueNorthRotation`, `utmZone`) remains nullable and **does not**
  block drafting. Drafting operates entirely in project-local metric
  (WCS — origin `(0,0)`, +X bay-axis, +Y cross-bay-axis); the geodetic
  anchor is consulted only by future georef-requiring features
  (basemap, GIS import / export — none in M1.3a). The status bar shows
  a "Not geo-referenced" chip with a click-to-set affordance for future
  use. The blocking dialog framing from the M1.2 PI-2 carryover is
  **retired**; PI-2 closes by virtue of making the anchor truly
  optional.
- **A7 — UCS scope.** No UCS abstraction in M1.3a. WCS is used directly
  for Ortho axes, grid-snap transform reference, and command-bar
  coordinate display. Multiple UCSs (rotated / translated drafting
  frames) are post-M1.
- **A8 — Operation emission (PI-1 from M1.2 plan) wired in M1.3a.**
  Every project-store mutation goes through a single `emitOperation()`
  helper that captures before / after snapshots and pushes to an
  in-memory operation log. Op-log persistence remains deferred per
  ADR-014 M1 scope (full-project save is the M1 persistence path);
  the in-memory log feeds zundo for undo / redo and is discarded on
  reload.
- **A9 — Schema break (M1.2 → M1.3a) under GR-1 clean-break rule.**
  `ProjectSchema.schemaVersion` bumps from `1.0.0` to `1.1.0` with no
  hydration shim. Old `1.0.0` projects are rejected by Zod with a
  clear `LoadFailure` error. Preproduction phase, no real user data.
- **A10 — Bulge-encoded arcs in polylines per ADR-016.** Polyline
  vertices array length N; bulges array length N when closed, N−1
  when open; `bulge[k] === 0` means straight segment k. Unique
  authoritative encoding; no separate "line-only polyline" type.
- **A11 — Closed-polyline invariant.** `closed === true` requires
  `vertices.length >= 3`. Closing connects `vertices[N-1] → vertices[0]`
  using `bulges[N-1]` without duplicating vertex 0. Enforced at the
  Zod schema level.
- **A12 — Three snap tolerances kept distinct per ADR-016 §Snap
  accuracy.** Three named utilities — `commitSnappedVertex`,
  `equalsMetric`, `isSnapCandidate`. Mixing layers (e.g., using
  `equalsMetric` in UI-tolerance code, or the 10-px tolerance in
  derived-logic comparisons) is a Blocker, enforced by grep gate.
- **A13 — Focus discipline.** Three-state focus holder
  (`canvas | bar | dialog`) plus a window-level keyboard handler that
  routes by holder, with explicit bypass set (`F3 / F8 / F9 / F12`,
  `Ctrl+Z / Ctrl+Y`, `Escape`). DOM focus on native inputs (number
  field in Properties panel, text in command bar) is secondary; our
  store is authoritative for routing.
- **A14 — Module isolation per GR-3.** `packages/editor-2d/src/canvas/`
  MUST NOT import from `@portplanner/project-store-react`; it uses
  `@portplanner/project-store` directly. React chrome subdirectories
  inside editor-2d (command bar, properties panel, layer manager) MAY
  use `@portplanner/project-store-react` hooks. Verified by grep gate
  per the architecture contract §0.4.
- **A15 — Default layer seeded on project creation.** On
  `createNewProject()`, the project state initialises `layers` with
  one entry: `LayerId.DEFAULT` named `"0"`, color `#FFFFFF`,
  `lineType: 'continuous'`, `lineWeight: 0.25`, `visible: true`,
  `frozen: false`, `locked: false`. Default layer is non-deletable,
  non-renamable; its other properties may be edited.
- **A16 — Test scope.** Unit tests for: domain Zod schemas (round-trip
  parse), serializer determinism, project-store reducers + emission,
  three-tolerance snap utilities, view transform math, per-kind
  hit-test, snap priority resolver, tool generators (input → output
  invariants), keyboard routing table. Integration tests for: save +
  reload of new entity kinds, default-layer seed, undo / redo across
  entity kinds. Smoke E2E (vitest + happy-dom or jsdom) for: create
  project → pick draw tool → click two points → primitive appears in
  store → save → reload → primitive still there.

## 3. Scope and Blast Radius

### 3.1 In scope — files created

**Domain (`packages/domain/src`):**

- `types/primitive.ts` — `PrimitiveKind` union; `Point2D` interface;
  `PrimitiveBase` + per-kind interfaces (`Point`, `Line`, `Polyline`,
  `Rectangle`, `Circle`, `Arc`, `Xline`); `Primitive` discriminated
  union; `PrimitiveSnapshot` alias.
- `types/layer.ts` — `Layer` interface; `DisplayOverrides` interface;
  `LayerSnapshot` alias; `LineTypeId` union; `ColorValue` type; default
  layer factory `defaultLayer(): Layer`.
- `types/grid.ts` — `Grid` interface; `GridSnapshot` alias.
- `schemas/primitive.schema.ts` — Zod schemas for each primitive kind +
  discriminated-union `PrimitiveSchema`.
- `schemas/layer.schema.ts` — `LayerSchema`, `DisplayOverridesSchema`.
- `schemas/grid.schema.ts` — `GridSchema`.

**Project-store (`packages/project-store/src`):**

- `actions/primitive-actions.ts` — `addPrimitive`, `updatePrimitive`,
  `deletePrimitive`.
- `actions/layer-actions.ts` — `addLayer`, `updateLayer`, `deleteLayer`,
  `setActiveLayerId` (active layer is **UI state**, not project state —
  this action lives in editor-2d's ui-state, not project-store; corrected
  in implementation).
- `actions/grid-actions.ts` — `addGrid`, `updateGrid`, `deleteGrid`.
- `operation-emit.ts` — `emitOperation()` helper; in-memory op-log
  buffer.

**Project-store-react (`packages/project-store-react/src`):**

- `hooks/usePrimitive.ts`, `usePrimitives.ts`
- `hooks/useLayer.ts`, `useLayers.ts`, `useDefaultLayer.ts`
- `hooks/useGrid.ts`, `useGrids.ts`

**editor-2d (`packages/editor-2d/`, NEW):**

- `package.json`, `tsconfig.json`, `vitest.config.ts`,
  `tsconfig.build.json`
- `src/index.ts` — public API
- `src/EditorRoot.tsx` — top-level React component embedding canvas +
  command bar + dialogs
- `src/canvas/view-transform.ts` — pan / zoom / DPR transform
  (custom ~100 LOC)
- `src/canvas/spatial-index.ts` — rbush wrapper + per-kind bounding-box
  calculators
- `src/canvas/paint.ts` — main paint loop
- `src/canvas/painters/index.ts` — painter dispatch
- `src/canvas/painters/paintPoint.ts`, `paintLine.ts`, `paintPolyline.ts`,
  `paintRectangle.ts`, `paintCircle.ts`, `paintArc.ts`, `paintXline.ts`
- `src/canvas/painters/paintGrid.ts`
- `src/canvas/style.ts` — ByLayer effective-style resolution
- `src/canvas/hit-test.ts` — pixel → entity hit-test
- `src/canvas/canvas-host.tsx` — React component owning the
  `<canvas>` element + DPR + paint subscription
- `src/snap/equals.ts` — `equalsMetric(a, b, eps?)`
- `src/snap/commit.ts` — `commitSnappedVertex(target)` (bit-copy)
- `src/snap/screen-tolerance.ts` — `isSnapCandidate(...)`
- `src/snap/osnap.ts` — endpoint / midpoint / intersection / node
  candidates
- `src/snap/gsnap.ts` — grid node + grid-line fallback
- `src/snap/ortho.ts` — Ortho modifier
- `src/snap/priority.ts` — priority resolver per ADR-016 §GSNAP ordering
- `src/ui-state/store.ts` — vanilla zustand + immer store
- `src/ui-state/viewport.ts` — viewport slice (zoom, pan, DPR)
- `src/ui-state/selection.ts` — selection slice
- `src/ui-state/active-tool.ts` — active tool slice + generator handle
- `src/ui-state/toggles.ts` — F-key toggle slice
- `src/ui-state/command-bar.ts` — command-bar state slice
- `src/ui-state/focus.ts` — focus-holder slice + key routing table
- `src/ui-state/overlay.ts` — overlay slice (snap target, guides,
  selection handles)
- `src/keyboard/router.ts` — window-level keydown handler
- `src/keyboard/shortcuts.ts` — shortcut → tool-id table
- `src/tools/runner.ts` — generator-pattern ToolRunner
- `src/tools/types.ts` — `Prompt`, `Input`, `ToolGenerator`,
  `ToolResult` types
- `src/tools/select.ts`, `erase.ts`, `move.ts`, `copy.ts`, `undo.ts`,
  `redo.ts`, `zoom.ts`, `pan.ts`, `properties.ts`, `escape.ts`,
  `layer-manager.ts`
- `src/tools/draw/draw-point.ts`, `draw-line.ts`, `draw-polyline.ts`,
  `draw-rectangle.ts`, `draw-circle.ts`, `draw-arc.ts`, `draw-xline.ts`
- `src/chrome/CommandBar.tsx` + `.module.css`
- `src/chrome/PropertiesPanel.tsx` + `.module.css`
- `src/chrome/LayerManagerDialog.tsx` + `.module.css`
- `src/chrome/StatusBarGeoRefChip.tsx` + `.module.css`
- `tests/` — unit + integration test files (one per module under test)

**Architecture / docs (new):**

- `docs/adr/023-tool-state-machine-and-command-bar.md` — replacement
  for ADR-022; restates framework decisions; includes the complete
  M1.3a/b/c shortcut map plus seven new draw-tool rows; governance
  clause moves the shortcut SSOT to `docs/operator-shortcuts.md`.
- `docs/adr/superseded/022-tool-state-machine-and-command-bar-superseded.md`
  — ADR-022 moved here with `Status: SUPERSEDED` + `Superseded by:
  ADR-023` headers.
- `docs/operator-shortcuts.md` — new subordinate registry file. Holds
  the authoritative operator shortcut table; governance: edit-in-place
  with version bumps + changelog (extraction-registry-style). Initial
  contents: every M1.3a/b/c row from old ADR-022's table + the seven
  new draw-tool rows.

### 3.2 In scope — files modified

**Domain:**

- `packages/domain/src/ids.ts` — add `PrimitiveId`, `LayerId`, `GridId`
  branded types + `newPrimitiveId()`, `newLayerId()`, `newGridId()`
  factories + `LayerId.DEFAULT` constant. (Constant lives as exported
  fixed UUID; default layer always has this id.)
- `packages/domain/src/types/object.ts` — extend `ProjectObject` with
  `layerId`, `displayOverrides`, `sourceKind`, `sourceProvenance?`
  per ADR-019.
- `packages/domain/src/types/operation.ts` — replace ADR-010 shape
  with ADR-020 shape (`type`, `targetKind`, `targetId`, `before`,
  `after`, `promotionGroupId?`); `TargetSnapshot` discriminated union
  over object / primitive / layer / grid (dimension snapshot lands
  M1.3c).
- `packages/domain/src/types/project.ts` — add `primitives`, `layers`,
  `grids` maps; `schemaVersion: '1.1.0'`.
- `packages/domain/src/types/index.ts` — re-export new types.
- `packages/domain/src/schemas/object.schema.ts` — extend
  `ProjectObjectSchema` per ADR-019.
- `packages/domain/src/schemas/operation.schema.ts` — replace per
  ADR-020.
- `packages/domain/src/schemas/project.schema.ts` — version literal
  `1.1.0`; add primitives / layers / grids record fields.
- `packages/domain/src/schemas/index.ts` — re-export new schemas.
- `packages/domain/src/serialize.ts` — extend canonical serializer to
  cover new entity maps; round-trip tests.
- `packages/domain/src/index.ts` — re-exports.
- `packages/domain/package.json` — no dep changes (Zod and uuid
  already present).

**Project-store:**

- `packages/project-store/src/initial-state.ts` — no change (project
  is still nullable; entity maps live inside Project).
- `packages/project-store/src/actions.ts` — `createNewProject` seeds
  default layer; `hydrateProject` validates default layer presence.
- `packages/project-store/src/store.ts` — wire `emitOperation` into
  the store's setState path via a small middleware-style wrapper.
- `packages/project-store/src/index.ts` — re-export new actions and
  the operation-emit helper.
- `packages/project-store/package.json` — no dep changes.

**Project-store-react:**

- `packages/project-store-react/src/hooks/index.ts` — re-export new
  hooks.
- `packages/project-store-react/src/index.ts` — re-export.
- `packages/project-store-react/package.json` — no dep changes.

**apps/web:**

- `apps/web/src/shell/CanvasArea.tsx` — replace placeholder with
  `<EditorRoot />` from `@portplanner/editor-2d`.
- `apps/web/src/shell/StatusBar.tsx` — host the geo-ref chip
  (`StatusBarGeoRefChip` from editor-2d).
- `apps/web/src/App.tsx` — no change (or trivial, depending on shell
  layout).
- `apps/web/package.json` — add `@portplanner/editor-2d`: `workspace:*`.

**Architecture / docs (modified in place):**

- `docs/adr/README.md` — main `## Index` table gets ADR-023 row;
  `## Superseded ADRs` section gets ADR-022 row.
- `docs/adr/superseded/README.md` — supersession-folder index gets
  ADR-022 row.
- `docs/procedures/Claude/00-architecture-contract.md` — §0.2 ADR
  binding table: remove ADR-022 row, add ADR-023 row, append
  supersession note.
- `docs/procedures/Codex/00-architecture-contract.md` — same as Claude
  contract (mirror).
- `docs/glossary.md` — append 12 terms (see §3.5).

**Workspace:**

- `pnpm-workspace.yaml` — already globs `packages/*`; new package is
  picked up automatically (no edit needed). Verified.

### 3.3 Out of scope (deferred)

- **Promotion contract, constructors registry, `sourceKind: 'promoted'`
  instantiation** — M1.3b.
- **RTG_BLOCK and any other typed object** — M1.3b.
- **Modify operators** (Rotate, Mirror, Scale, Offset, Fillet,
  Chamfer, Trim, Extend, Join, Explode, Break, Array, Match) —
  M1.3b.
- **Re-align operation, classify, drawn-vs-canonical machinery** —
  M1.3b.
- **Dimension entity** (linear-aligned, linear-x, linear-y, angular,
  radius, diameter, arc-length); associative refs; `DimensionSnapshot`
  in `TargetSnapshot` — M1.3c.
- **POLAR (F10), OTRACK (F11), remaining OSNAP modes** (center,
  perpendicular, tangent, parallel, quadrant, nearest, extension,
  apparent intersection) — M1.3c.
- **Extraction, validation, capacity panel, save/reload deterministic
  extraction** — M1.4.
- **3D viewer, mesh descriptors** — M5.
- **UCS abstraction** (define / switch / align-to-object) — post-M1.
- **Geo-reference dialog body** — chip is in scope; the actual
  "set geodetic anchor" dialog renders a placeholder with a "Set
  later" button only. Real basemap + georef workflows post-M1.
- **Op-log durable persistence** — ADR-014 M1 scope keeps full-project
  save / reload as the persistence path; in-memory op log feeds zundo
  only.
- **Theme switching** — `dark` theme remains the only ship; M1
  scope per `docs/execution-plan.md`.
- **Library system, scenarios, generator** — later milestones.

### 3.4 Blast radius

- **Packages affected:** `domain`, `project-store`, `project-store-react`,
  `editor-2d` (new), `apps/web`. `design-system` consumed unchanged.
  `services/api` does not exist; not touched.
- **Other object types affected via cross-object extractors:** none
  (no extraction in M1.3a).
- **Scenarios affected (ADR-006):** none. `scenarioId` field on
  `Project` retained; baseline-only.
- **Stored data affected:** YES — `schemaVersion 1.0.0 → 1.1.0`.
  Old `1.0.0` projects fail to load (GR-1 clean break, A9). Any
  M1.2 test projects on developer machines must be discarded.
- **UI surfaces affected:** `apps/web/src/shell/CanvasArea.tsx`
  (placeholder replaced); `apps/web/src/shell/StatusBar.tsx` (chip
  added). Navbar / Sidebar untouched.
- **Cross-references in non-superseded ADRs (001, 003–009, 011, 012,
  014, 015, 016, 017, 018, 019, 020, 021, 022):** all remain valid;
  M1.3a does not change any of their decisions.

### 3.5 Glossary terms appended in `docs/glossary.md`

- **Primitive** — A first-class persistent geometry entity in the
  drafting surface (point / line / polyline / rectangle / circle / arc /
  xline). Carries no ownership state and no extraction. ADR-016.
- **Layer** — Organisational grouping for primitives, grids, dimensions,
  and typed objects. Carries default style (color, lineType, lineWeight)
  and visibility / frozen / locked flags. ADR-017.
- **Default layer** — Protected layer named `"0"` seeded on project
  creation; cannot be deleted or renamed; orphans fall back to it.
  ADR-017.
- **DisplayOverrides** — Open key-value bag on every entity that
  overrides ByLayer defaults (`{ color?, lineType?, lineWeight? }`).
  Missing key = inherit from layer; present key = explicit override.
  ADR-017.
- **Grid** — A first-class drafting-aid entity with origin, angle,
  X/Y spacings, layer membership, visibility, and `activeForSnap`
  flag. ADR-016.
- **Xline** — An infinite construction line defined by a pivot point
  and an angle. First-class primitive; layer-membership-controlled
  visibility. ADR-016.
- **Bulge** — DXF-convention scalar `tan(θ/4)` encoding the included
  arc angle and direction (sign) of a polyline segment.
  `bulge === 0` means straight. ADR-016.
- **ByLayer** — Effective-style resolution rule: an entity's
  effective style is `displayOverrides.<key> ?? layer.<key>`.
  ADR-017.
- **OSNAP** — Object snap. Cursor magnetises to specific geometric
  features of nearby entities (endpoint, midpoint, intersection,
  node). M1.3a subset; remaining modes M1.3c. ADR-016, ADR-021.
- **GSNAP** — Grid snap. Cursor magnetises to grid nodes (or grid
  lines as fallback). M1.3a. ADR-016, ADR-021.
- **Ortho** — Modifier that constrains cursor motion to ±X / ±Y of
  the active drafting frame (WCS in M1.3a — bay / cross-bay axes)
  relative to the previous point in a tool's prompt chain. M1.3a.
  ADR-016, ADR-023.
- **Snap priority** — Resolution order when multiple snap candidates
  apply (highest to lowest): OSNAP → OTRACK → POLAR → GSNAP →
  grid-line fallback. Ortho is a modifier applied after all snaps.
  ADR-016 §GSNAP ordering, ADR-021.
- **View transform** — Pan + zoom + DPR transformation between
  project-local metric and screen pixels. Custom implementation in
  `packages/editor-2d/src/canvas/view-transform.ts`. ADR-021.

### 3.6 Binding specifications touched

| Spec | Change type |
|------|-------------|
| ADR-001 Coordinate System | No change — all geometry in project-local metric Float64; canvas paints with view transform applied at render time. |
| ADR-003 Ownership States | No change — primitives have no ownership field; ADR-003 still applies to typed objects (uninstantiated in M1.3a). |
| ADR-004 Parameter Extraction | No change — extraction deferred to M1.4; primitives do not extract per ADR-016. |
| ADR-007 Validation Engine | No change — deferred to M1.4. |
| ADR-008 3D Derivation Cache | No change — 2D only. |
| ADR-011 UI Stack | No change — Lucide icons + ThemeProvider + `useActiveThemeTokens()` consumed as-is in editor-2d React chrome. |
| ADR-012 Technology Stack | No change — adds `@flatten-js/core` and `rbush` to `packages/editor-2d/package.json` per ADR-021's pinned choices. |
| ADR-014 Persistence Architecture | No change — full-project IndexedDB save / reload extended to cover new entity maps; op-log persistence remains deferred per ADR-014 M1 scope. |
| ADR-015 Project Store and State Management | No change — vanilla zustand + zundo + immer; partialize keeps zundo on `project` slice only; UI state is a separate store in editor-2d. |
| ADR-016 Drawing Model | No change — M1.3a implements primitives + grid + three-tolerance snap accuracy model; promotion / drawn-vs-canonical / typed-object pieces stay deferred. |
| ADR-017 Layer Model | No change — M1.3a implements layer model + default layer + ByLayer + extraction-agnostic binding (no extraction yet, but the rule will be enforced at the render boundary as a precondition). |
| ADR-018 Dimension Model | No change — dimensions deferred to M1.3c; the `TargetSnapshot` union in `Operation` is shaped to accept a future `DimensionSnapshot` arm without further migration. |
| ADR-019 Object Model v2 | No change — M1.3a brings `ProjectObject` type + Zod schema + serializer into ADR-019 compliance proactively (A1). |
| ADR-020 Project Sync v2 | No change — M1.3a replaces `Operation` shape with ADR-020 shape; `targetKind` / `targetId` / `promotionGroupId?` honoured. |
| ADR-021 2D Rendering Pipeline v2 | No change — M1.3a implements the kind-discriminated paint loop, ByLayer style resolution, snap priority resolver. |
| ADR-022 Tool State Machine + Command Bar | **SUPERSEDED → ADR-023.** Status flipped to `SUPERSEDED`; file moved to `docs/adr/superseded/`; supersession + supersedee pointers added per §0.6 governance. Removed from binding-table in both architecture contracts. |
| ADR-023 Tool State Machine + Command Bar (v2) | **NEW — replaces ADR-022.** Restates the framework decisions. Embeds the complete M1.3a/b/c operator shortcut map including the seven new draw-tool rows. Governance clause moves the shortcut SSOT to `docs/operator-shortcuts.md`; future operator additions edit the registry file, not any ADR. |
| `docs/operator-shortcuts.md` | **NEW** subordinate registry file. Authoritative shortcut SSOT going forward. Governance: edit-in-place with version bumps + changelog (extraction-registry-style). |
| `docs/glossary.md` | Appended — 12 new terms per §3.5. |
| `docs/coordinate-system.md` | No change. |
| `docs/design-tokens.md` | Audit — confirm canvas tokens exist for `snap_indicator`, `grid`, `background`, `selection_handle`, `dimension_preview`. If any are missing, append in same commit; if all present, no change. |
| `docs/execution-plan.md` | No change — M1.3a sub-milestone scope already documented. |
| `docs/extraction-registry/*` | No change. |
| `docs/procedures/Claude/*`, `docs/procedures/Codex/*` | No change. |
| `docs/overview.md` | No change. |

## 4. Architecture Doc Impact

| Doc | Path | Change type | Reason |
|-----|------|-------------|--------|
| ADR-022 | `docs/adr/022-tool-state-machine-and-command-bar.md` → `docs/adr/superseded/022-tool-state-machine-and-command-bar-superseded.md` | Move + status flip to `SUPERSEDED` + supersession pointer | Codex Round-1 OI-1: editing ADR text in place violates §0.6; supersession is the §0.7-compliant path |
| ADR-023 | `docs/adr/023-tool-state-machine-and-command-bar.md` | New | Replacement for ADR-022; restates framework + adds shortcuts + moves SSOT to subordinate registry |
| `docs/operator-shortcuts.md` | `docs/operator-shortcuts.md` | New | Subordinate registry holding the authoritative operator shortcut table |
| ADR README | `docs/adr/README.md` | Edit in place | Add ADR-023 row in main `## Index`; add ADR-022 row in `## Superseded ADRs` section |
| Superseded README | `docs/adr/superseded/README.md` | Edit in place | Add ADR-022 row to the supersession-folder index |
| Claude contract | `docs/procedures/Claude/00-architecture-contract.md` | Edit in place | §0.2 binding table: remove ADR-022 row; add ADR-023 row; supersession note appended |
| Codex contract | `docs/procedures/Codex/00-architecture-contract.md` | Edit in place | Mirror of Claude contract |
| Glossary | `docs/glossary.md` | Append 12 terms | New domain vocabulary lands with M1.3a code |
| Design tokens | `docs/design-tokens.md` | Audit + append iff missing | Canvas overlay tokens consumed by paint code |
| ADR-019 | `docs/adr/019-object-model.md` | No change | Implementation comes into compliance |
| ADR-020 | `docs/adr/020-project-sync.md` | No change | Implementation comes into compliance |
| ADR-021 | `docs/adr/021-2d-rendering-pipeline.md` | No change | Implementation realises the pinned design |
| ADR-016, ADR-017 | (paths) | No change | Implementation realises the pinned design |
| All other ADRs | (paths) | No change | M1.3a doesn't touch their decisions |

## 5. Deviations from binding specifications (§0.7 Approved Deviation Protocol)

**None formally.** Two close-to-the-line items were surfaced and resolved
in the pre-response notification (acknowledged 2026-04-25):

- **ADR-022 supersession (A2, Codex Round-1 OI-1).** Originally
  Revision-0 proposed an in-place edit of ADR-022's shortcut map.
  Codex Round-1 flagged this as a §0.6 immutability violation. The
  Revision-1 resolution supersedes ADR-022 with ADR-023 + introduces
  a subordinate `docs/operator-shortcuts.md` registry as the
  going-forward SSOT for shortcut additions. Supersession is the
  binding-compliant mechanism per §0.6 + §0.7 step 3 — **not a
  deviation**. The same-PR commitment (ADR-023 + registry file +
  supersession move + index/contract updates land in the same M1.3a
  PR as the code that registers the shortcuts) is satisfied via
  Phase 15 (docs governance) → Phase 17 (code uses ADR-023's registry
  references) → Phase 21 (final verification gates).
- **`ProjectObject` ADR-019 alignment (A1).** Not a deviation — ADR-019
  is binding and the type was on the now-superseded ADR-002 shape.
  M1.3a brings the type into spec compliance. Timing (M1.3a vs M1.3b)
  is an execution-plan choice; the chosen timing minimises mid-stream
  refactor risk. Recorded user approval: 2026-04-25.

## 6. Object Model and Extraction Integration

**Not applicable as primary scope.** No new typed object types are
introduced in M1.3a. Primitives are not typed objects: they have no
ownership state (ADR-003), no parameters extension, no extractor, no
validation rules, no library traceability, no mesh descriptor.

`ProjectObject` (the typed-object contract from ADR-019) is updated in
shape but uninstantiated until M1.3b. The shape update is the §1.7
"contract refresh that touches every typed object uniformly" pattern;
per-type content (RTG_BLOCK, ROAD, etc.) is unaffected because no such
type exists in code yet.

The `Operation` ADR-020 shape covers all entity kinds via `targetKind`
+ `targetId` + the discriminated `TargetSnapshot` union. M1.3a provides
the `'object' | 'primitive' | 'layer' | 'grid'` arms; the `'dimension'`
arm is reserved for M1.3c (declared in the union; producers of dimension
ops do not exist yet).

Registry `## Constructors` sections remain governance-only (per the
drawing-model-pivot plan); first constructor content lands in M1.3b.

## 7. Hydration, Serialization, Undo/Redo, Sync

### 7.1 Hydration (document load path)

- `deserialize(raw)` parses `raw` against `ProjectSchema` v`1.1.0`. A
  `1.0.0` payload produces a `LoadFailure("schema version mismatch:
  expected 1.1.0, got 1.0.0")` (GR-1 clean break, A9).
- `Project.layers[LayerId.DEFAULT]` MUST be present; absence is a
  `LoadFailure`. Tested.
- All entities (primitives, grids, typed objects) carry a `layerId`
  that MUST resolve to a layer in `Project.layers`; orphan layerIds
  trigger a `LoadFailure`. Tested.
- Polyline schemas validate `vertices.length >= 3` when `closed`;
  validate `bulges.length === vertices.length` when closed and
  `bulges.length === vertices.length - 1` when open.

### 7.2 Serialization (document save path)

- `serialize(project)` writes the full project state including
  `primitives`, `layers`, `grids`, `objects`, `coordinateSystem`,
  `scenarioId`, `schemaVersion`. Keys sorted recursively for byte
  stability per existing M1.2 contract.
- Derived state NOT written: `dirty`, `lastSavedAt` (project-store
  metadata), in-memory operation log, UI state (viewport / selection /
  active tool / toggles).
- `scenarioId` behaviour unchanged from M1.2 (null = baseline; ADR-006).

### 7.3 Undo / Redo (operation log)

- Every store mutation passes through `emitOperation()` which
  constructs an `Operation` per ADR-020 with the right `targetKind`
  (`'primitive'` for primitive CRUD, `'layer'` for layer CRUD, `'grid'`
  for grid CRUD, `'object'` reserved for M1.3b), populates `before` /
  `after` snapshots, and pushes onto the in-memory log.
- `zundo` partialize remains scoped to `project` slice; undo / redo
  operate on the entire project state via temporal step (not by
  replaying `Operation` records). `Operation` records exist for sync
  / audit purposes; zundo provides the user-facing undo / redo path.
  This split matches ADR-015 + ADR-020.
- UI state changes (viewport pan / zoom, selection, active tool
  toggle) are NOT undoable per ADR-015 — they live in editor-2d's
  ui-state store with no temporal middleware.
- For primitive draw operations, the operation is committed to the
  project store on the tool generator's final yield (after all prompts
  resolve), so partial draws are not undoable as discrete steps; an
  Escape during a tool aborts without any commit.

### 7.4 Sync (ADR-020)

- M1.3a is single-writer offline; the sync model is implemented at the
  shape level (Operation record exists, op-log queue exists) but no
  multi-writer reconciliation code lands here. Per ADR-020 V1
  scope, last-write-wins at entity level with `targetKind` discriminant
  is the merge story when multi-writer arrives.
- Conflict resolution code, server backend, persistence of op-log:
  all post-M1.

## 8. Implementation phases

Twenty-one phases. Each has its file list, steps, invariants, gates,
and tests (where applicable). Phases are sequenced with strong
dependency order — Phase N+1 can begin only when Phase N's gates pass.

### Phase 1 — Domain types (primitives, layers, grid, ids)

**Goal:** Land the foundational domain types and branded ids for
M1.3a entity kinds. No schemas yet — types only, so editor-2d code
compiles against the types when it lands.

**Files affected:**
- `packages/domain/src/ids.ts` (modified)
- `packages/domain/src/types/primitive.ts` (new)
- `packages/domain/src/types/layer.ts` (new)
- `packages/domain/src/types/grid.ts` (new)
- `packages/domain/src/types/index.ts` (modified)
- `packages/domain/src/index.ts` (modified)

**Steps:**
1. In `ids.ts`, add `PrimitiveId`, `LayerId`, `GridId` branded types
   and factories `newPrimitiveId()`, `newLayerId()`, `newGridId()`.
   Add exported constant `LayerId.DEFAULT` (a fixed UUIDv7 value;
   chosen and pinned in this phase). Implementation note:
   `LayerId.DEFAULT` is a static UUIDv7 string constant; every
   project's default layer uses this id so cross-project layer
   references are not ambiguous.
2. Author `types/primitive.ts`: `Point2D`, `PrimitiveKind` union,
   `PrimitiveBase`, per-kind interfaces (Point, Line, Polyline,
   Rectangle, Circle, Arc, Xline), `Primitive` discriminated union,
   `PrimitiveSnapshot` alias.
3. Author `types/layer.ts`: `LineTypeId` (`'continuous' | 'dashed' |
   'dotted' | 'dashdot'`), `ColorValue` (`#RRGGBB` template literal
   type, runtime validated by Zod in Phase 2), `DisplayOverrides`,
   `Layer`, `LayerSnapshot` alias, `defaultLayer(): Layer` factory.
4. Author `types/grid.ts`: `Grid`, `GridSnapshot` alias.
5. Update `types/index.ts` and `src/index.ts` to re-export.

**Invariants introduced:**
- I-1: `LayerId.DEFAULT` is a fixed UUIDv7 constant; same value across
  every project. Enforced by exported constant + grep for any
  alternative seed.
- I-2: Every per-kind primitive interface carries `id: PrimitiveId`,
  `kind: PrimitiveKind`, `layerId: LayerId`, `displayOverrides:
  DisplayOverrides`. Type-level enforcement via `PrimitiveBase`.

**Mandatory Completion Gates:**

```
Gate 1.1: Type-check passes
  Command: pnpm tsc --noEmit
  Expected: zero errors

Gate 1.2: All seven primitive kinds present in PrimitiveKind union
  Command: rg -n "'point'|'line'|'polyline'|'rectangle'|'circle'|'arc'|'xline'" packages/domain/src/types/primitive.ts
  Expected: ≥7 matches in the file

Gate 1.3: Branded ids exported from ids.ts
  Command: rg -n "PrimitiveId|LayerId|GridId|newPrimitiveId|newLayerId|newGridId" packages/domain/src/ids.ts
  Expected: ≥6 matches

Gate 1.4: LayerId.DEFAULT exported
  Command: rg -n "LayerId\.DEFAULT|export const DEFAULT_LAYER_ID|LayerIdDefault" packages/domain/src/ids.ts
  Expected: ≥1 match (whichever export form chosen)
```

**Tests added:** none in this phase (types only). Schema round-trip
tests follow in Phase 2.

### Phase 2 — Domain Zod schemas + serializer + schemaVersion bump

**Goal:** Land Zod schemas for primitives / layers / grid; bump
`ProjectSchema.schemaVersion` from `1.0.0` to `1.1.0`; extend the
canonical serializer to round-trip new entity maps.

**Files affected:**
- `packages/domain/src/schemas/primitive.schema.ts` (new)
- `packages/domain/src/schemas/layer.schema.ts` (new)
- `packages/domain/src/schemas/grid.schema.ts` (new)
- `packages/domain/src/schemas/project.schema.ts` (modified — version
  literal + add primitives / layers / grids records)
- `packages/domain/src/schemas/index.ts` (modified)
- `packages/domain/src/serialize.ts` (modified)
- `packages/domain/src/index.ts` (modified)
- `packages/domain/tests/schemas.test.ts` (new) — round-trip tests
- `packages/domain/tests/serialize.test.ts` (modified or new) — new
  entity-kind round-trip + schema-version mismatch rejection

**Steps:**
1. Author `schemas/primitive.schema.ts` with discriminated union over
   the seven `kind`-tagged shapes; enforce closed-polyline invariants
   (`vertices.length >= 3` when `closed`; `bulges.length` matches
   open / closed convention).
2. Author `schemas/layer.schema.ts` and `schemas/grid.schema.ts`.
3. Modify `schemas/project.schema.ts`: `schemaVersion: z.literal('1.1.0')`;
   add `primitives: z.record(z.string(), PrimitiveSchema)`,
   `layers: z.record(z.string(), LayerSchema)`,
   `grids: z.record(z.string(), GridSchema)`.
4. Update `serialize.ts`'s key-sort logic to recurse into the new
   record fields (existing recursive sort already does this, but
   confirm by test).
5. Tests: round-trip parse for each new schema; schema-version
   mismatch (`1.0.0` payload) raises `LoadFailure`; closed-polyline
   invariant (vertices < 3) rejected; bulge-length-mismatch rejected.

**Invariants introduced:**
- I-3: `ProjectSchema.schemaVersion === '1.1.0'`. Enforced by Zod.
- I-4: Closed polyline requires `vertices.length >= 3`. Enforced by
  Zod refinement on `PolylineSchema`.
- I-5: Bulge count: `bulges.length === vertices.length` when closed,
  `bulges.length === vertices.length - 1` when open. Enforced by Zod
  refinement.
- I-6: Loading a `1.0.0` payload fails with `LoadFailure`. Enforced
  by serialize.test.ts.

**Mandatory Completion Gates:**

```
Gate 2.1: Type-check passes
  Command: pnpm tsc --noEmit
  Expected: zero errors

Gate 2.2: Schemas tests pass
  Command: pnpm --filter @portplanner/domain test
  Expected: all pass, no skipped, schema round-trip tests present

Gate 2.3: schemaVersion bumped to 1.1.0
  Command: rg -n "schemaVersion.*1\.1\.0|z\.literal\('1\.1\.0'\)" packages/domain/src/schemas/project.schema.ts
  Expected: ≥1 match

Gate 2.4: Closed-polyline invariant present
  Command: rg -n "closed|vertices.length|bulges" packages/domain/src/schemas/primitive.schema.ts
  Expected: ≥3 matches (presence of refinement code)

Gate 2.5: Old version explicitly rejected
  Command: pnpm --filter @portplanner/domain test -- --grep "schema version mismatch"
  Expected: at least one test referencing the rejection passes
```

### Phase 3 — Domain `operation.ts` to ADR-020 shape

**Goal:** Replace ADR-010 `Operation` shape with ADR-020 shape per
user-pinned first-implementation-step.

**Files affected:**
- `packages/domain/src/types/operation.ts` (modified)
- `packages/domain/src/schemas/operation.schema.ts` (modified)
- `packages/domain/src/types/index.ts` (modified)
- `packages/domain/src/schemas/index.ts` (modified)
- `packages/domain/src/index.ts` (re-exports if any names changed)
- `packages/domain/tests/operation-schema.test.ts` (new) —
  round-trip per `targetKind` arm

**Steps:**
1. Replace `OperationType` enum if needed (currently
   `CREATE/UPDATE/DELETE/GENERATE/FREEZE/DETACH/UNFREEZE`); ADR-020
   keeps the same set so no change there.
2. Replace `Operation` interface body:
   - Remove `objectId`.
   - Add `targetKind: TargetKind` (= `'object' | 'primitive' |
     'dimension' | 'layer' | 'grid'`).
   - Add `targetId: UUID` (string typed at use site as one of the
     branded id types via the `targetKind` discriminant).
   - Replace `before`, `after` types from `ObjectSnapshot` to
     `TargetSnapshot | null`.
   - Add optional `promotionGroupId?: UUID`.
3. Author `TargetSnapshot` discriminated union typing over
   `{ kind: 'object', snapshot: ObjectSnapshot } | { kind:
   'primitive', snapshot: PrimitiveSnapshot } | { kind: 'layer',
   snapshot: LayerSnapshot } | { kind: 'grid', snapshot: GridSnapshot }`.
   The `'dimension'` arm is declared in the type union but its
   snapshot type is a placeholder (`never` or a TODO marker
   referenced by issue / ADR-018) so M1.3c lands the real shape
   without a churn-y refactor. **Decision: declare arm as `{ kind:
   'dimension'; snapshot: never }`** so type-narrowing makes the arm
   unreachable at the type level until M1.3c widens it (matches §0.7
   progressive-implementation Condition 2).
4. Update `OperationSchema` Zod to match.
5. Tests: round-trip per arm; `promotionGroupId` optional; before /
   after null on CREATE / DELETE respectively.

**Invariants introduced:**
- I-7: `Operation.targetKind` is a discriminant; `Operation.targetId`
  is branded at use site by the kind. Type-level enforcement via the
  `TargetSnapshot` discriminated union.
- I-8: `'dimension'` snapshot arm is type-level unreachable in M1.3a
  (`snapshot: never`). Per progressive-implementation §0.7 Condition 2.
- I-9: `promotionGroupId` is optional; populated only when an
  operation is part of a promotion atomic group (ADR-016 §Promotion
  contract) — no producer in M1.3a; M1.3b populates it.

**Mandatory Completion Gates:**

```
Gate 3.1: Old objectId field absent from Operation type
  Command: rg -n "objectId" packages/domain/src/types/operation.ts
  Expected: 0 matches

Gate 3.2: targetKind discriminant present
  Command: rg -n "targetKind|TargetKind" packages/domain/src/types/operation.ts
  Expected: ≥2 matches

Gate 3.3: All five TargetKind arms named
  Command: rg -n "'object'|'primitive'|'dimension'|'layer'|'grid'" packages/domain/src/types/operation.ts
  Expected: ≥5 matches

Gate 3.4: promotionGroupId optional field present
  Command: rg -n "promotionGroupId" packages/domain/src/types/operation.ts packages/domain/src/schemas/operation.schema.ts
  Expected: ≥2 matches

Gate 3.5: Type-check passes
  Command: pnpm tsc --noEmit
  Expected: zero errors

Gate 3.6: Operation tests pass
  Command: pnpm --filter @portplanner/domain test
  Expected: all pass
```

### Phase 4 — Domain `ProjectObject` to ADR-019 shape

**Goal:** Bring the typed-object contract into ADR-019 compliance per
A1.

**Files affected:**
- `packages/domain/src/types/object.ts` (modified)
- `packages/domain/src/schemas/object.schema.ts` (modified)
- `packages/domain/src/index.ts` (re-exports)
- `packages/domain/tests/object-schema.test.ts` (new) — schema
  round-trip including new fields

**Steps:**
1. Modify `types/object.ts`:
   - Add `layerId: LayerId` (required).
   - Add `displayOverrides: DisplayOverrides`.
   - Add `sourceKind: 'direct' | 'promoted'`.
   - Add optional `sourceProvenance?: { primitiveKind: PrimitiveKind;
     promotedAt: string; primitiveId: PrimitiveId }`.
2. Modify `schemas/object.schema.ts` to match.
3. `ObjectSnapshot` already aliases `ProjectObject` — no change to the
   alias.
4. Tests: schema round-trip with all fields; `sourceProvenance` only
   valid when `sourceKind === 'promoted'` (Zod refinement).

**Invariants introduced:**
- I-10: `ProjectObject.layerId` is required, never null; default to
  `LayerId.DEFAULT` is a domain-store concern (Phase 5) not the type.
- I-11: `sourceProvenance` is set iff `sourceKind === 'promoted'`.
  Enforced by Zod refinement.

**Mandatory Completion Gates:**

```
Gate 4.1: layerId required on ProjectObject
  Command: rg -n "layerId.*LayerId" packages/domain/src/types/object.ts
  Expected: ≥1 match

Gate 4.2: sourceKind discriminant present
  Command: rg -n "sourceKind.*'direct'|sourceKind.*'promoted'" packages/domain/src/types/object.ts
  Expected: ≥1 match

Gate 4.3: sourceProvenance refinement test passes
  Command: pnpm --filter @portplanner/domain test -- --grep "sourceProvenance"
  Expected: ≥1 test, passes

Gate 4.4: Type-check passes
  Command: pnpm tsc --noEmit
  Expected: zero errors
```

### Phase 5 — Project-store state expansion + default layer + actions

**Goal:** Extend project state with primitives / layers / grids maps;
seed default layer on project creation; add CRUD actions per entity
kind. Operation emission wires up in Phase 6.

**Files affected:**
- `packages/domain/src/types/project.ts` (modified — adds entity maps)
- `packages/domain/src/schemas/project.schema.ts` (modified — already
  done in Phase 2; verify)
- `packages/project-store/src/actions.ts` (modified — `createNewProject`
  seeds default layer)
- `packages/project-store/src/actions/primitive-actions.ts` (new)
- `packages/project-store/src/actions/layer-actions.ts` (new)
- `packages/project-store/src/actions/grid-actions.ts` (new)
- `packages/project-store/src/index.ts` (modified — re-exports)
- `packages/project-store/tests/primitive-actions.test.ts` (new)
- `packages/project-store/tests/layer-actions.test.ts` (new)
- `packages/project-store/tests/grid-actions.test.ts` (new)
- `packages/project-store/tests/store.test.ts` (modified — assert
  default layer seed in `createNewProject`)

**Steps:**
1. Modify `Project` interface in `types/project.ts` (already covered
   by §3.2; bringing into focus here): add three `Record<>` maps.
2. Modify `createNewProject(project)` to seed `project.layers[
   LayerId.DEFAULT] = defaultLayer()` if not already present. Also
   ensure `primitives` and `grids` exist as empty objects.
3. Author primitive / layer / grid action files. Each action mutates
   via Immer:
   - `addPrimitive(primitive)`: assign to `state.project.primitives[
     primitive.id] = primitive`.
   - `updatePrimitive(id, patch)`: spread-merge into existing.
   - `deletePrimitive(id)`: `delete state.project.primitives[id]`.
   - Layer / grid actions analogous.
4. Layer-delete special semantics (ADR-017): cannot delete
   `LayerId.DEFAULT`; deleting a layer with entities requires a
   `reassignTo: LayerId | 'default'` argument; throws otherwise.
5. Tests per file.

**Invariants introduced:**
- I-12: `createNewProject` seeds `LayerId.DEFAULT` with the
  `defaultLayer()` shape. Tested by `store.test.ts`.
- I-13: `deleteLayer(LayerId.DEFAULT)` throws / no-ops with a clear
  error. Tested.
- I-14: `deleteLayer(id)` with referenced entities requires
  `reassignTo` and reassigns all referencing entities (primitives,
  grids; objects in M1.3b). Tested.
- I-15: Layer rename does not change `LayerId`; references unaffected.
  Tested.

**Mandatory Completion Gates:**

```
Gate 5.1: Default layer seeded
  Command: pnpm --filter @portplanner/project-store test -- --grep "default layer seeded"
  Expected: ≥1 test, passes

Gate 5.2: Default-layer protection
  Command: pnpm --filter @portplanner/project-store test -- --grep "default layer.*delete|cannot delete default"
  Expected: ≥1 test, passes

Gate 5.3: Layer reassignment on delete
  Command: pnpm --filter @portplanner/project-store test -- --grep "reassign|reassignTo"
  Expected: ≥1 test, passes

Gate 5.4: Type-check passes
  Command: pnpm tsc --noEmit
  Expected: zero errors

Gate 5.5: Project-store tests pass
  Command: pnpm --filter @portplanner/project-store test
  Expected: all pass
```

### Phase 6 — Project-store operation emission (PI-1 from M1.2)

**Goal:** Wire `emitOperation()` into the project store so every
mutation produces an Operation record. Resolves M1.2 PI-1.

**Files affected:**
- `packages/project-store/src/operation-emit.ts` (new)
- `packages/project-store/src/store.ts` (modified — wire emission)
- `packages/project-store/src/actions/*.ts` (modified — call
  emission in each action)
- `packages/project-store/src/actions.ts` (modified — `createNewProject`
  + `hydrateProject` clear the op log)
- `packages/project-store/src/index.ts` (re-export op-log accessors)
- `packages/project-store/tests/operation-emit.test.ts` (new)

**Steps:**
1. Author `operation-emit.ts`:
   - Module-level `operationLog: Operation[]` (in-memory; not
     persisted in M1.3a).
   - Module-level `sequence: number` counter.
   - **emitOperation is a transactional wrapper (Codex Round-1 OI-2a
     hardening).** Signature:
     `emitOperation(meta: { type, targetKind, targetId, promotionGroupId? },
     mutator: (state: ProjectStoreState) => void): Operation`.
     Internally:
       1. Read current state; build before-snapshot via the
          `targetKind`-discriminated lookup (`state.project.primitives[id]`
          for `'primitive'`, etc.). For CREATE the before-snapshot is `null`.
       2. Call `projectStore.setState(mutator)`.
       3. Read post-mutation state; build after-snapshot. For DELETE the
          after-snapshot is `null`.
       4. Construct `Operation` with the next `sequence`, push to
          `operationLog`, and return the op.
   - `getOperationLog(): readonly Operation[]` accessor for tests.
   - `clearOperationLog(): void` for `createNewProject` /
     `hydrateProject` and tests.
2. Refactor each action under `packages/project-store/src/actions/` to
   call `emitOperation(meta, mutator)` exclusively — actions MUST NOT
   call `projectStore.setState` directly (Gate 6.5 enforces this with a
   hard zero-match grep). The mutator closure is the only place where
   the action mutates state. Whole-state replacement actions
   (`createNewProject`, `hydrateProject`, `markSaved`) remain in
   `actions.ts` at the package root and continue to call setState
   directly — they are not entity-level mutations and are excluded
   from the Gate 6.5 directory scope.
3. Modify `createNewProject` and `hydrateProject` to call
   `clearOperationLog()` (whole-state replacement; no incremental
   ops to retain).
4. Tests: each action emits the right `targetKind` + `targetId` +
   shapes; sequence increments monotonically; `clearOperationLog`
   empties the buffer; `promotionGroupId` is omitted (M1.3a has no
   promotion).

**Invariants introduced:**
- I-16: Every project-store mutation passes through `emitOperation`.
  Enforced by grep gate that detects raw `state.project.<map>[id] =`
  outside `emitOperation` call sites.
- I-17: `Operation.sequence` is monotonically increasing within a
  session. Tested.
- I-18: `clearOperationLog()` is called by `createNewProject` and
  `hydrateProject`. Tested.

**Mandatory Completion Gates:**

```
Gate 6.1: emitOperation utility present
  Command: rg -n "export function emitOperation" packages/project-store/src/operation-emit.ts
  Expected: ≥1 match

Gate 6.2: Each entity action calls emitOperation
  Command: rg --files-without-match "emitOperation\\(" packages/project-store/src/actions/primitive-actions.ts packages/project-store/src/actions/layer-actions.ts packages/project-store/src/actions/grid-actions.ts
  Expected: zero output (every listed file contains at least one call)

Gate 6.3: Operation-emit tests pass
  Command: pnpm --filter @portplanner/project-store test -- --grep "emitOperation|operation log|targetKind"
  Expected: tests present and pass

Gate 6.4: Sequence-monotonicity test passes
  Command: pnpm --filter @portplanner/project-store test -- --grep "sequence|monotonic"
  Expected: ≥1 test, passes

Gate 6.5: Entity actions never call projectStore.setState directly
  Command: rg -n "projectStore\\.setState\\b" packages/project-store/src/actions/
  Expected: 0 matches
  Rationale (per Codex Round-1 OI-2a): emitOperation is refactored into a
  transactional wrapper with signature `emitOperation(meta, mutator)`.
  Internally it captures before-snapshot, calls projectStore.setState
  with the mutator, captures after-snapshot, builds the Operation, and
  pushes to the log. Therefore the only legal setState call from inside
  packages/project-store/src/actions/ is the one made by emitOperation
  itself — actions never call setState directly. Whole-state replacement
  paths (createNewProject, hydrateProject, markSaved) live in actions.ts
  at the package root (NOT under actions/) and are not entity-level
  mutations; they are excluded from this gate by directory scope.
```

### Phase 7 — Project-store-react hooks for new entity kinds

**Goal:** Expose React hooks for the new entity maps so editor-2d's
React chrome can read them.

**Files affected:**
- `packages/project-store-react/src/hooks/usePrimitive.ts` (new)
- `packages/project-store-react/src/hooks/usePrimitives.ts` (new)
- `packages/project-store-react/src/hooks/useLayer.ts` (new)
- `packages/project-store-react/src/hooks/useLayers.ts` (new)
- `packages/project-store-react/src/hooks/useDefaultLayer.ts` (new)
- `packages/project-store-react/src/hooks/useGrid.ts` (new)
- `packages/project-store-react/src/hooks/useGrids.ts` (new)
- `packages/project-store-react/src/hooks/index.ts` (modified —
  re-exports)
- `packages/project-store-react/src/index.ts` (modified — re-exports)
- `packages/project-store-react/tests/hooks.test.tsx` (modified or
  new) — tests per hook

**Steps:**
1. Author each hook as a thin selector over `projectStore` via
   `useSyncExternalStore`. Mirror the M1.2 pattern (see existing
   `useProject`, `useObjectById`).
2. Re-export.
3. Tests with `@testing-library/react` + `happy-dom`.

**Invariants introduced:**
- I-19: Hooks return stable references across re-renders when the
  underlying entity is unchanged (referential equality contract).
  Tested.

**Mandatory Completion Gates:**

```
Gate 7.1: All seven new hooks present
  Command: ls packages/project-store-react/src/hooks/use{Primitive,Primitives,Layer,Layers,DefaultLayer,Grid,Grids}.ts | wc -l
  Expected: 7

Gate 7.2: Hook tests pass
  Command: pnpm --filter @portplanner/project-store-react test
  Expected: all pass

Gate 7.3: Type-check passes
  Command: pnpm tsc --noEmit
  Expected: zero errors

Gate 7.4: No hook imports from outside project-store + domain
  Command: rg -n "from ['\"]@portplanner/" packages/project-store-react/src/hooks/ | rg -v "@portplanner/project-store|@portplanner/domain"
  Expected: 0 lines (every cross-package import goes to project-store or domain)
```

### Phase 8 — `packages/editor-2d` package scaffold

**Goal:** Stand up the new package with build / test / lint
infrastructure. No canvas code yet — just the shell.

**Files affected:**
- `packages/editor-2d/package.json` (new)
- `packages/editor-2d/tsconfig.json` (new)
- `packages/editor-2d/tsconfig.build.json` (new)
- `packages/editor-2d/vitest.config.ts` (new)
- `packages/editor-2d/src/index.ts` (new — placeholder export)
- `packages/editor-2d/src/EditorRoot.tsx` (new — empty React component
  that renders a placeholder div; expanded in Phase 12+)
- `packages/editor-2d/tests/setup.ts` (new — happy-dom)
- `packages/editor-2d/tests/smoke.test.ts` (new — `expect(true).toBe(true)`
  scaffold)

**Steps:**
1. Author `package.json`:
   ```json
   {
     "name": "@portplanner/editor-2d",
     "version": "0.1.0",
     "private": true,
     "type": "module",
     "main": "./src/index.ts",
     "types": "./src/index.ts",
     "scripts": {
       "test": "vitest run",
       "build": "tsc -p tsconfig.build.json"
     },
     "peerDependencies": {
       "react": "^18.0.0 || ^19.0.0",
       "react-dom": "^18.0.0 || ^19.0.0"
     },
     "dependencies": {
       "@portplanner/design-system": "workspace:*",
       "@portplanner/domain": "workspace:*",
       "@portplanner/project-store": "workspace:*",
       "@portplanner/project-store-react": "workspace:*",
       "@flatten-js/core": "^1.5.0",
       "rbush": "^4.0.1",
       "zustand": "^5.0.2",
       "immer": "^10.1.1",
       "lucide-react": "^0.468.0"
     },
     "devDependencies": {
       "happy-dom": "^15.0.0",
       "vitest": "^2.1.8",
       "@types/rbush": "^4.0.0",
       "@testing-library/react": "^16.1.0"
     }
   }
   ```
   Note: dependency versions pinned to ranges matching the existing
   workspace conventions (verified against `apps/web/package.json`
   for vitest + React, project-store package.json for zustand /
   immer, etc.). `lucide-react` version aligned with whatever
   `@portplanner/design-system` already uses (read from existing
   package; if absent, install latest minor).
2. Author tsconfig files extending `tsconfig.base.json`.
3. Author `vitest.config.ts` with happy-dom environment for React
   component tests.
4. Author placeholder `index.ts`, `EditorRoot.tsx`, smoke test.
5. Run `pnpm install` to wire workspace deps.

**Invariants introduced:**
- I-20: `packages/editor-2d/package.json` declares `@flatten-js/core`
  + `rbush` dependencies (per ADR-021).
- I-21: `packages/editor-2d` peerDependencies include `react` and
  `react-dom` (consumed only in chrome subdirs per A14).

**Mandatory Completion Gates:**

```
Gate 8.1: Package installed and build works
  Command: pnpm --filter @portplanner/editor-2d build
  Expected: success, dist created

Gate 8.2: Smoke test passes
  Command: pnpm --filter @portplanner/editor-2d test
  Expected: passes

Gate 8.3: @flatten-js/core + rbush declared
  Command: rg -n "@flatten-js/core|\"rbush\"" packages/editor-2d/package.json
  Expected: ≥2 matches

Gate 8.4: Workspace recognises new package
  Command: pnpm list --filter @portplanner/editor-2d
  Expected: lists the package

Gate 8.5: Type-check passes for whole repo
  Command: pnpm tsc --noEmit
  Expected: zero errors
```

### Phase 9 — View transform + spatial index

**Goal:** Land the canvas math foundation: pan / zoom / DPR transform
and rbush bounding-box index.

**Files affected:**
- `packages/editor-2d/src/canvas/view-transform.ts` (new)
- `packages/editor-2d/src/canvas/spatial-index.ts` (new)
- `packages/editor-2d/src/canvas/bounding-boxes.ts` (new) — per-kind
  bbox calculator
- `packages/editor-2d/tests/view-transform.test.ts` (new)
- `packages/editor-2d/tests/spatial-index.test.ts` (new)
- `packages/editor-2d/tests/bounding-boxes.test.ts` (new)

**Steps:**
1. Author `view-transform.ts`:
   - `Viewport` interface: `{ panX: number; panY: number; zoom:
     number; dpr: number; canvasWidthCss: number; canvasHeightCss:
     number }`.
   - `metricToScreen(metricPoint, viewport): ScreenPoint` and inverse
     `screenToMetric`.
   - `viewportFrustum(viewport): { minX, minY, maxX, maxY }` in
     metric (used for rbush query).
   - `applyToCanvasContext(ctx, viewport)`: sets canvas transform via
     `ctx.setTransform(...)` accounting for DPR.
   - Round-trip property test: `screenToMetric(metricToScreen(p)) === p`
     under reasonable zoom range.
2. Author `bounding-boxes.ts`:
   - `bboxOfPrimitive(primitive): BBox` per kind:
     - point → `{ minX: x, minY: y, maxX: x, maxY: y }`
     - line → axis-aligned envelope of (p1, p2)
     - polyline → walk vertices + bulge-arc envelopes
     - rectangle → walk four rotated corners
     - circle → `{ minX: cx - r, minY: cy - r, maxX: cx + r, ... }`
     - arc → arc-segment-aware envelope (consider whether the
       extremes ±X / ±Y are inside the angular span)
     - xline → infinite extent placeholder; spatial index treats
       xlines specially (always candidate; not in rbush — kept in a
       separate per-frame iteration list)
   - `bboxOfGrid(grid): BBox` returns `null` (grids tile the whole
     viewport; not in rbush).
3. Author `spatial-index.ts`:
   - Wraps rbush with insert / remove / update / search-by-bbox.
   - Per-entity-id key tracking so updates avoid duplicate inserts.
   - Xline list maintained separately; `searchFrustum(viewport)`
     returns rbush hits + all xlines.
4. Tests:
   - View transform round-trip identity.
   - Bbox correctness per primitive kind, including bulge-arc edge
     cases.
   - Spatial index insert / update / delete / query.

**Invariants introduced:**
- I-22: View transform round-trips: `screenToMetric(metricToScreen(p,
  v), v)` equals `p` within `1e-9` relative error. Property-tested.
- I-23: Bbox of arc accounts for ±X / ±Y extremes lying within the
  angular span (not just endpoints). Unit-tested with quadrant-spanning
  arcs.
- I-24: Bbox of bulge-arc segment in polyline computed correctly.
  Unit-tested.
- I-25: Xlines are queried separately (not in rbush) because rbush
  bboxes assume bounded geometry. Documented in spatial-index.ts.

**Mandatory Completion Gates:**

```
Gate 9.1: View-transform round-trip test passes
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "round-trip|metricToScreen"
  Expected: ≥1 test, passes

Gate 9.2: Bbox per kind tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "bbox"
  Expected: ≥7 tests (one per primitive kind), all pass

Gate 9.3: Spatial index tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "spatial index|rbush"
  Expected: passes

Gate 9.4: Type-check passes
  Command: pnpm tsc --noEmit
  Expected: zero errors

Gate 9.5: Module isolation — view-transform/spatial-index don't import React or project-store-react
  Command: rg -n "from ['\"]react['\"]|from ['\"]@portplanner/project-store-react['\"]" packages/editor-2d/src/canvas/view-transform.ts packages/editor-2d/src/canvas/spatial-index.ts packages/editor-2d/src/canvas/bounding-boxes.ts
  Expected: 0 matches
```

### Phase 10 — Canvas paint loop + per-kind painters + grid + ByLayer

**Goal:** Land the kind-discriminated paint loop and per-kind painters
per ADR-021.

**Files affected:**
- `packages/editor-2d/src/canvas/style.ts` (new) — ByLayer resolution
- `packages/editor-2d/src/canvas/paint.ts` (new)
- `packages/editor-2d/src/canvas/painters/index.ts` (new)
- `packages/editor-2d/src/canvas/painters/paintPoint.ts` (new)
- `packages/editor-2d/src/canvas/painters/paintLine.ts` (new)
- `packages/editor-2d/src/canvas/painters/paintPolyline.ts` (new) —
  bulge-aware
- `packages/editor-2d/src/canvas/painters/paintRectangle.ts` (new)
- `packages/editor-2d/src/canvas/painters/paintCircle.ts` (new)
- `packages/editor-2d/src/canvas/painters/paintArc.ts` (new)
- `packages/editor-2d/src/canvas/painters/paintXline.ts` (new) —
  infinite-line clipped to viewport
- `packages/editor-2d/src/canvas/painters/paintGrid.ts` (new)
- `packages/editor-2d/src/canvas/canvas-host.tsx` (new)
- `packages/editor-2d/src/canvas/hit-test.ts` (new)
- `packages/editor-2d/tests/paint.test.ts` (new — uses node-canvas
  shim or pixel-buffer assertions; if heavyweight, restrict to
  smoke-level "paint completes without throwing for representative
  state")
- `packages/editor-2d/tests/painters.test.ts` (new — per-painter
  smoke + bulge correctness via path-string capture)
- `packages/editor-2d/tests/hit-test.test.ts` (new)

**Steps:**
1. Author `style.ts`:
   - `effectiveColor(entity, layer)`, `effectiveLineType`,
     `effectiveLineWeight` per ADR-017 ByLayer rules.
2. Author `paint.ts` matching the ADR-021 §The paint pattern
   pseudo-code:
   - clear → applyViewTransform → activeLayerLookup → visibleGrids
     → entities filtered by layer.visible && !layer.frozen → kind
     dispatch → drawOverlays.
3. Per-kind painters use `@flatten-js/core` for any non-trivial math
   (e.g., arc tessellation handled by Canvas2D `ctx.arc`; bulge-arcs
   in polyline computed via included-angle math as described in
   ADR-016 Appendix A).
4. `paintXline.ts` clips infinite lines to viewport via Liang-Barsky
   or straightforward parametric solve.
5. `paintGrid.ts` per ADR-021 §Grid rendering — emit lattice within
   viewport, transform by grid origin / angle, stroke with effective
   style.
6. `canvas-host.tsx` is the React component owning the `<canvas>`
   ref, handling resize + DPR + paint subscription. Subscribes to
   `projectStore` and `uiStateStore`. Calls `paint(ctx, project,
   viewport, overlay)` on every relevant change. Uses
   `requestAnimationFrame` coalescing.
7. `hit-test.ts`: pixel → entity. Uses spatial index + per-kind
   precise hit math (point distance, line segment distance,
   polyline segment-by-segment, etc.).
8. Tests: see file list.

**Invariants introduced:**
- I-26: Paint loop excludes entities on `visible === false` or
  `frozen === true` layers. Tested by paint smoke.
- I-27: Paint loop does NOT exclude entities for extraction
  inputs — there is no extraction in M1.3a, but `paint.ts` reads
  the layer-visibility filter; `paint.ts` is the only call site.
  No path from `paint.ts` to extraction. Documented.
- I-28: `canvas-host.tsx` is the only file under
  `packages/editor-2d/src/canvas/` that imports React. All other
  canvas/* files are React-free for module-isolation per A14.
- I-29: `canvas-host.tsx` subscribes via `projectStore.subscribe` (not
  `useProject` from project-store-react) per ADR-015 / A14.
- I-30: Polyline painter handles bulge-arc segments via `ctx.arc`
  (or equivalent path commands) when `bulge !== 0`. Tested with a
  bulge-encoded polyline assertion on the captured path.

**Mandatory Completion Gates:**

```
Gate 10.1: Paint loop file exists and exports paint()
  Command: rg -n "export function paint" packages/editor-2d/src/canvas/paint.ts
  Expected: ≥1 match

Gate 10.2: Per-kind painters all present
  Command: ls packages/editor-2d/src/canvas/painters/paint{Point,Line,Polyline,Rectangle,Circle,Arc,Xline,Grid}.ts | wc -l
  Expected: 8

Gate 10.3: Painters tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "paint|painter"
  Expected: passes

Gate 10.4: Hit-test tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "hit-test"
  Expected: passes

Gate 10.5: Module isolation: canvas/* (except canvas-host.tsx) are React-free
  Command: rg -l "from ['\"]react['\"]" packages/editor-2d/src/canvas/ | rg -v "canvas-host\\.tsx"
  Expected: 0 files listed

Gate 10.6: Module isolation: canvas/* doesn't import project-store-react
  Command: rg -n "from ['\"]@portplanner/project-store-react['\"]" packages/editor-2d/src/canvas/
  Expected: 0 matches

Gate 10.7: Layer visibility filter present in paint loop
  Command: rg -n "layer\\.visible|layer\\.frozen" packages/editor-2d/src/canvas/paint.ts
  Expected: ≥1 match
```

### Phase 11 — UI state store + focus discipline + key routing

**Goal:** Land the editor-2d UI state store covering viewport,
selection, active tool, F-key toggles, command bar state, focus
holder, overlay; window-level keyboard handler with explicit routing
table.

**Files affected:**
- `packages/editor-2d/src/ui-state/store.ts` (new — vanilla zustand
  + immer)
- `packages/editor-2d/src/ui-state/viewport.ts` (new)
- `packages/editor-2d/src/ui-state/selection.ts` (new)
- `packages/editor-2d/src/ui-state/active-tool.ts` (new)
- `packages/editor-2d/src/ui-state/toggles.ts` (new — F3 / F8 / F9 /
  F12)
- `packages/editor-2d/src/ui-state/command-bar.ts` (new)
- `packages/editor-2d/src/ui-state/focus.ts` (new — focus holder)
- `packages/editor-2d/src/ui-state/overlay.ts` (new)
- `packages/editor-2d/src/keyboard/router.ts` (new — window-level
  handler)
- `packages/editor-2d/src/keyboard/shortcuts.ts` (new — shortcut →
  tool-id table)
- `packages/editor-2d/src/keyboard/routing-table.ts` (new — focus →
  key-class → handler)
- `packages/editor-2d/tests/ui-state.test.ts` (new)
- `packages/editor-2d/tests/keyboard-router.test.ts` (new)

**Steps:**
1. Compose zustand slices into a single `editorUiStore` with immer
   middleware (no zundo — UI state is not undoable per ADR-015).
2. Author `keyboard/routing-table.ts`:
   ```
   Key class                | canvas focus     | bar focus           | dialog focus
   -------------------------|------------------|---------------------|---------------
   F3/F8/F9/F12             | toggle           | toggle              | toggle
   Ctrl+Z / Ctrl+Y          | undo/redo        | undo/redo           | (dialog handles or no-op)
   Escape                   | abort tool       | abort prompt        | close dialog
   Letter (A-Z)             | activate tool    | accumulate / sub-opt| (dialog input)
   Digit (0-9)              | (numeric input)  | accumulate          | (dialog input)
   Arrow keys               | pan              | move caret          | (dialog input)
   Enter                    | (commit if tool) | submit              | (dialog input)
   Backspace                | (no-op)          | erase               | (dialog input)
   ```
3. Author `keyboard/router.ts`:
   - Single `window.addEventListener('keydown', handler)` registered
     at editor mount; cleanup on unmount.
   - Handler reads focus holder from ui-state, looks up the row in
     routing-table, invokes the appropriate handler.
   - Bypass keys (F3/F8/F9/F12, Ctrl+Z/Y) are routed identically
     across focus holders.
4. Author `keyboard/shortcuts.ts`: `Map<string, ToolId>` for letter-
   activated tools (S → select, M → move, etc.). Multi-letter
   commands (LA, REC, PT, PL, CC, CIR, XL, XX) handled by a small
   accumulator inside the keyboard router that times out after
   ~750 ms of inactivity (AutoCAD-like).
5. Tests:
   - Focus transitions via store actions; DOM focus on a faux input
     does not bypass the routing table.
   - F3 toggle from any focus holder updates the toggle state.
   - Escape from canvas aborts the active tool generator (mocked).
   - Multi-letter command resolves correctly (e.g., "P" "L" → polyline
     tool; "P" alone after timeout → pan tool).

**Invariants introduced:**
- I-31: Focus holder is `'canvas' | 'bar' | 'dialog'`. Type-level.
- I-32: Bypass keys (F3/F8/F9/F12/Ctrl+Z/Ctrl+Y) handle identically
  across focus holders. Tested.
- I-33: Window-level keydown listener is registered exactly once per
  editor instance. Tested.
- I-34: Multi-letter commands resolve via accumulator with ~750 ms
  timeout. Tested.
- I-35: UI state has no zundo middleware. Verified by reading
  `editorUiStore` setup; tested.

**Mandatory Completion Gates:**

```
Gate 11.1: UI state store exports
  Command: rg -n "export.*editorUiStore" packages/editor-2d/src/ui-state/store.ts
  Expected: ≥1 match

Gate 11.2: Focus holder enum constrained
  Command: rg -n "'canvas'.*'bar'.*'dialog'|FocusHolder" packages/editor-2d/src/ui-state/focus.ts
  Expected: ≥1 match

Gate 11.3: Single window-level keydown registration
  Command: rg -n "window\\.addEventListener\\(['\"]keydown" packages/editor-2d/src
  Expected: exactly 1 match, located inside packages/editor-2d/src/keyboard/router.ts

Gate 11.4: UI state has no zundo
  Command: rg -n "temporal|zundo" packages/editor-2d/src/ui-state/
  Expected: 0 matches

Gate 11.5: Keyboard router tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "keyboard|router|focus"
  Expected: passes

Gate 11.6: Type-check passes
  Command: pnpm tsc --noEmit
  Expected: zero errors
```

### Phase 12 — Snap engine (three tolerances + OSNAP + GSNAP + Ortho + priority)

**Goal:** Land the snap engine with the three named tolerance utilities,
OSNAP modes (endpoint, midpoint, intersection, node), GSNAP, Ortho
modifier, and the priority resolver.

**Files affected:**
- `packages/editor-2d/src/snap/equals.ts` (new — `equalsMetric`)
- `packages/editor-2d/src/snap/commit.ts` (new — `commitSnappedVertex`)
- `packages/editor-2d/src/snap/screen-tolerance.ts` (new —
  `isSnapCandidate`)
- `packages/editor-2d/src/snap/osnap.ts` (new)
- `packages/editor-2d/src/snap/gsnap.ts` (new)
- `packages/editor-2d/src/snap/ortho.ts` (new)
- `packages/editor-2d/src/snap/priority.ts` (new)
- `packages/editor-2d/tests/snap-tolerances.test.ts` (new)
- `packages/editor-2d/tests/osnap.test.ts` (new)
- `packages/editor-2d/tests/gsnap.test.ts` (new)
- `packages/editor-2d/tests/ortho.test.ts` (new)
- `packages/editor-2d/tests/snap-priority.test.ts` (new)

**Steps:**
1. Author the three named tolerance utilities exactly as in A12.
   `equalsMetric` defaults eps to `1e-6`. `isSnapCandidate` takes a
   px tolerance (default 10).
2. Author OSNAP candidate functions:
   - Endpoint: every primitive's terminal points (line p1/p2;
     polyline `vertices[0]` and `vertices[N-1]` if open; rectangle
     four corners; arc start/end; circle has no endpoint).
   - Midpoint: midpoints of bounded segments.
   - Intersection: pairwise intersections of in-frustum entities
     (use `@flatten-js/core` for line-line, line-arc, arc-arc).
   - Node: vertices of polylines + grid nodes (the "node" osnap
     overlaps GSNAP for grid; OSNAP node is the more specific match).
3. Author GSNAP: nearest grid node (per active grid) + grid-line
   fallback (perpendicular drop). When `grid.activeForSnap === false`,
   skip.
4. Author Ortho modifier: given prior point + cursor metric, clamp
   to ±X / ±Y of the active drafting frame (= WCS in M1.3a). Returns
   the constrained metric point.
5. Author priority resolver implementing ADR-016 §GSNAP ordering:
   - Stage 1: OSNAP candidates within screen tolerance → highest-priority
     candidate wins.
   - Stage 2 reserved for OTRACK (M1.3c stub returning empty).
   - Stage 3 reserved for POLAR (M1.3c stub returning empty).
   - Stage 4: GSNAP candidates within screen tolerance.
   - Stage 5: GSNAP grid-line fallback.
   - Final: if Ortho is on, apply Ortho clamp AFTER snap resolution
     (modifier; per ADR-016).
   - Returns `{ kind, target?: Point2D, hint: SnapHint }`.
6. Tests: per stage; priority resolution; bit-copy on commit;
   ε-distance behaviour at boundaries; screen-tolerance behaviour
   under different zoom levels.

**Invariants introduced:**
- I-36: Three tolerance utilities exist as named modules. Each
  module exports exactly one function.
- I-37: `equalsMetric` default ε is `1e-6` (1 micrometer).
- I-38: `isSnapCandidate` default px tolerance is `10`.
- I-39: `commitSnappedVertex(target)` returns a `Point2D` whose
  fields are bit-identical to `target`'s fields. Tested via
  `Object.is(committed.x, target.x) && Object.is(committed.y, target.y)`.
- I-40: Snap priority order matches ADR-016 §GSNAP ordering.
  Tested.
- I-41: Ortho is applied AS A MODIFIER after snap resolution —
  if OSNAP found a target, Ortho does not re-clamp away from it.
  Tested.
- I-42: Three tolerance utilities are not mixed at use sites.
  Enforced by directory-scoped grep gates (12.5a/b/c).

**Mandatory Completion Gates:**

```
Gate 12.1: Three named tolerance modules exist
  Command: ls packages/editor-2d/src/snap/equals.ts packages/editor-2d/src/snap/commit.ts packages/editor-2d/src/snap/screen-tolerance.ts | wc -l
  Expected: 3

Gate 12.2: All snap tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "snap|osnap|gsnap|ortho|tolerance"
  Expected: passes

Gate 12.3: equalsMetric default ε is 1e-6
  Command: rg -n "1e-6|1\\.0e-6|0\\.000001" packages/editor-2d/src/snap/equals.ts
  Expected: ≥1 match

Gate 12.4: Bit-copy commit test passes
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "bit-copy|commitSnappedVertex|Object\\.is"
  Expected: ≥1 test, passes

Gate 12.5a: equalsMetric used only in src/snap/ (derived-logic tolerance)
  Command: rg -l "\\bequalsMetric\\b" packages/editor-2d/src | rg -v "src/snap/|src/snap/equals\\.ts"
  Expected: 0 files listed
  Rationale (per Codex Round-1 OI-2b): equalsMetric is the ε=1e-6 derived-logic
  utility. Canvas paint paths and UI-tolerance code MUST NOT import it.

Gate 12.5b: commitSnappedVertex used only in src/tools/ + src/snap/ (commit path)
  Command: rg -l "\\bcommitSnappedVertex\\b" packages/editor-2d/src | rg -v "src/tools/|src/snap/|src/snap/commit\\.ts"
  Expected: 0 files listed
  Rationale: bit-copy commit is a tool-final-step utility; called from snap engine
  and tool generators only.

Gate 12.5c: isSnapCandidate used only in src/snap/ + src/canvas/hit-test.ts (UI tolerance)
  Command: rg -l "\\bisSnapCandidate\\b" packages/editor-2d/src | rg -v "src/snap/|src/canvas/hit-test\\.ts|src/snap/screen-tolerance\\.ts"
  Expected: 0 files listed
  Rationale: screen-pixel UI tolerance utility; never used by derived-logic code.

Gate 12.6: Snap priority resolver respects ADR-016 ordering
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "priority|OSNAP wins over GSNAP"
  Expected: ≥1 test, passes
```

### Phase 13 — Tool runner (generator pattern)

**Goal:** Land the ToolRunner that drives generator-pattern tools per
ADR-023 (post-Phase-15 supersession of ADR-022).

**Files affected:**
- `packages/editor-2d/src/tools/types.ts` (new)
- `packages/editor-2d/src/tools/runner.ts` (new)
- `packages/editor-2d/tests/tool-runner.test.ts` (new)

**Steps:**
1. Author `types.ts`: `Prompt`, `Input`, `ToolGenerator`, `ToolResult`
   per ADR-023.
2. Author `runner.ts`:
   - `startTool(generator: () => ToolGenerator)`: instantiates the
     generator; subscribes to canvas pointer / keyboard / bar inputs;
     dispatches into the generator via `generator.next(input)`.
   - Yields are `Prompt` records; the runner publishes them to the
     command-bar slice of ui-state (so the bar shows the prompt).
   - `Input` events come from: canvas click (point), bar input
     (number / angle / sub-option / text), keyboard (escape).
   - On `escape`: runner cancels generator, restores canvas focus,
     clears selection-in-progress.
   - On generator return: runner commits the `ToolResult` to the
     project-store via the appropriate action(s) (which trigger
     `emitOperation`).
3. Tests: a synthetic two-prompt generator returns expected result;
   escape mid-generator cancels; commit path emits operation(s).

**Invariants introduced:**
- I-43: ToolRunner is a single, stateless function (state lives in
  ui-state's active-tool slice). Tested.
- I-44: Escape during a tool aborts without commit (no operation
  emitted). Tested.
- I-45: Successful tool completion emits at least one operation
  (CREATE for draw tools, DELETE for erase, UPDATE for move/copy).
  Tested.

**Mandatory Completion Gates:**

```
Gate 13.1: ToolRunner tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "tool-runner|ToolRunner"
  Expected: passes

Gate 13.2: Generator types present
  Command: rg -n "ToolGenerator|AsyncGenerator<Prompt" packages/editor-2d/src/tools/types.ts
  Expected: ≥1 match

Gate 13.3: Type-check passes
  Command: pnpm tsc --noEmit
  Expected: zero errors
```

### Phase 14 — Essential operator tools

**Goal:** Land Select, Erase, Move, Copy, Undo/Redo, Zoom (with
sub-options Extents/Window/Previous), Pan, Properties, Layer Manager
(LA), Escape, F3/F8/F9/F12 toggle handlers.

**Files affected:**
- `packages/editor-2d/src/tools/select.ts`
- `packages/editor-2d/src/tools/erase.ts`
- `packages/editor-2d/src/tools/move.ts`
- `packages/editor-2d/src/tools/copy.ts`
- `packages/editor-2d/src/tools/undo.ts`
- `packages/editor-2d/src/tools/redo.ts`
- `packages/editor-2d/src/tools/zoom.ts` — Z + sub-options Extents
  (E), Window (W), Previous (P)
- `packages/editor-2d/src/tools/pan.ts` — modeless + middle-mouse-drag
- `packages/editor-2d/src/tools/properties.ts` — opens Properties
  panel
- `packages/editor-2d/src/tools/layer-manager.ts` — opens Layer
  Manager dialog
- `packages/editor-2d/src/tools/escape.ts` (or inline in runner)
- `packages/editor-2d/src/tools/index.ts` — registry mapping toolIds
  → generator factories
- `packages/editor-2d/tests/tools-essential.test.ts`

**Steps:**
1. Author each tool as a generator per ADR-023 example. Move is the
   reference implementation (select if no selection, base point,
   second point, commit).
2. Sub-option handling for Zoom: yield with `subOptions:
   [{label:'Extents', shortcut:'e'}, {label:'Window', shortcut:'w'},
   {label:'Previous', shortcut:'p'}]`. Default = drag-to-zoom.
3. Pan is modeless: middle-mouse-drag always pans regardless of
   active tool; the `P` shortcut activates a one-shot pan tool.
4. Undo / Redo call zundo `temporal.undo()` / `temporal.redo()` on
   the project store; clear active tool first if any.
5. Properties tool: opens Properties panel and selects the current
   selection's first entity. If selection is empty, prompts "Select
   entity".
6. Layer Manager (LA): opens Layer Manager dialog (Phase 17).
7. F3/F8/F9/F12 toggles: pure ui-state mutations; not generator-driven.
8. Tests per tool: representative input → expected operation log
   contents and expected ui-state.

**Invariants introduced:**
- I-46: Each tool generator emits at most one logical commit per
  successful run (single Operation cluster; promotionGroupId not
  used in M1.3a).
- I-47: Undo / Redo use `projectStore.temporal` (zundo); not custom
  inverse-op replay. Per ADR-015 + ADR-020.

**Mandatory Completion Gates:**

```
Gate 14.1: All eleven essential tools present
  Command: ls packages/editor-2d/src/tools/{select,erase,move,copy,undo,redo,zoom,pan,properties,layer-manager,escape}.ts | wc -l
  Expected: 11

Gate 14.2: Tools tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "tool|select|erase|move|copy|zoom|pan"
  Expected: passes

Gate 14.3: Sub-options on Zoom present
  Command: rg -n "Extents|Window|Previous" packages/editor-2d/src/tools/zoom.ts
  Expected: ≥3 matches

Gate 14.4: Type-check passes
  Command: pnpm tsc --noEmit
  Expected: zero errors
```

### Phase 15 — ADR governance: supersede ADR-022 with ADR-023 + create operator-shortcuts.md registry

**Goal:** Resolve Codex Round-1 OI-1 by superseding ADR-022 with
ADR-023 and creating the subordinate `docs/operator-shortcuts.md`
registry as the going-forward shortcut SSOT. Land all docs governance
artifacts in this phase so Phase 16 (impl) can reference an
already-authoritative ADR + registry. No code touched here — pure
docs governance.

**Files affected:**
- `docs/adr/023-tool-state-machine-and-command-bar.md` (new)
- `docs/adr/superseded/022-tool-state-machine-and-command-bar-superseded.md`
  (moved from `docs/adr/022-tool-state-machine-and-command-bar.md`)
- `docs/operator-shortcuts.md` (new)
- `docs/adr/README.md` (modified)
- `docs/adr/superseded/README.md` (modified)
- `docs/procedures/Claude/00-architecture-contract.md` (modified)
- `docs/procedures/Codex/00-architecture-contract.md` (modified)

**Steps:**
1. **Author ADR-023.** File: `docs/adr/023-tool-state-machine-and-command-bar.md`.
   Headers: `**Status:** ACCEPTED`, `**Date:** 2026-04-25`,
   `**Supersedes:** ADR-022 (`docs/adr/superseded/022-tool-state-machine-and-command-bar-superseded.md`)`.
   Content:
   - Restate ADR-022's framework decisions verbatim (command bar as
     bottom UI, generator-pattern tool state machines, keyboard
     routing rules, sub-option bracket notation, focus discipline
     across canvas / bar / dialog).
   - Operator shortcut map: include every row from the original
     ADR-022 table (Select, Erase, Move, Copy, Undo, Redo, Zoom +
     sub-options, Pan, Properties, LA, Escape, F3/F8/F9/F12, plus
     M1.3b/c rows) **plus** the seven new draw-tool rows
     (`PT` Point, `L` Line, `PL` Polyline, `REC` Rectangle, `CC`
     Circle, `A` Arc, `XL`/`XX` Xline).
   - Governance clause (replaces ADR-022's self-describing
     "changelog bump" clause): *Future operator additions edit
     `docs/operator-shortcuts.md` (the subordinate registry file)
     with a version bump + changelog line. ADR-023's shortcut map
     is the snapshot at the time of supersession; the registry
     file is the going-forward SSOT.* This pattern mirrors the
     extraction-registry governance in `docs/extraction-registry/`.
   - Cross-references: ADR-016, ADR-017, ADR-018, ADR-019, ADR-020,
     ADR-021. Same set as ADR-022.
   - Changelog: `| 1.0.0 | 2026-04-25 | Replaces ADR-022. Restates
     framework + adds seven primitive draw-tool shortcuts (PT, L, PL,
     REC, CC, A, XL/XX). Moves operator-shortcut SSOT to
     docs/operator-shortcuts.md going forward. |`.
2. **Move ADR-022 to superseded folder.**
   `git mv docs/adr/022-tool-state-machine-and-command-bar.md
   docs/adr/superseded/022-tool-state-machine-and-command-bar-superseded.md`.
   Then edit the moved file: change `**Status:** ACCEPTED` to
   `**Status:** SUPERSEDED`, and add `**Superseded by:** ADR-023
   (`docs/adr/023-tool-state-machine-and-command-bar.md`)` on the
   following line. (This is the §0.6-permitted edit of a superseded
   ADR — the contract itself mandates the supersession-marker edit.)
3. **Create `docs/operator-shortcuts.md`.** Format mirrors an
   extraction-registry entry:
   - Title + intro paragraph (purpose, governance, version)
   - `**Version:** 1.0.0`, `**Date:** 2026-04-25`
   - `## Governance` section: edit-in-place with version bumps;
     adding a shortcut = minor; changing an existing = major;
     removing = major; same Constructors-style discipline as the
     extraction registry.
   - `## Shortcut map` table — three sub-sections: M1.3a, M1.3b,
     M1.3c. Rows mirror ADR-023's table.
   - `## Changelog` table — initial row `1.0.0 | 2026-04-25 | Initial
     registry. Seeded from ADR-023's M1.3a/b/c shortcut map at
     supersession of ADR-022.`
4. **Update `docs/adr/README.md`.**
   - In the main `## Index` table: add a row for ADR-023.
   - In the `## Superseded ADRs` section: add a row for ADR-022
     pointing at `docs/adr/superseded/022-tool-state-machine-and-command-bar-superseded.md`
     and the replacement ADR-023.
   - The `## Index` table count moves from 19 (per drawing-model-pivot
     plan) to 19 — ADR-022 leaves the index, ADR-023 enters; net zero.
     (Verify via gate.)
5. **Update `docs/adr/superseded/README.md`.** Add a row for ADR-022
   in the supersession-folder index.
6. **Update both architecture contracts** (`docs/procedures/Claude/00-architecture-contract.md`
   and `docs/procedures/Codex/00-architecture-contract.md`):
   - Remove the ADR-022 row from the §0.2 ADR binding table.
   - Add an ADR-023 row pointing to `docs/adr/023-tool-state-machine-and-command-bar.md`.
   - Append the supersession note in the existing supersession-list
     prose (the same paragraph that lists ADRs 002/010/013 → 019/020/021;
     extend to mention ADR-022 → ADR-023).
   - Both contracts must remain identical (mirror discipline per the
     drawing-model-pivot precedent).

**Invariants introduced:**
- I-60: ADR-023 file exists at `docs/adr/023-tool-state-machine-and-command-bar.md`
  with `Status: ACCEPTED`, `Supersedes: ADR-022`, and the seven
  draw-tool shortcut rows. Hard grep gates.
- I-61: ADR-022 file moved to `docs/adr/superseded/022-tool-state-machine-and-command-bar-superseded.md`
  with `Status: SUPERSEDED` and `Superseded by: ADR-023` headers; the
  original-path file no longer exists at root. Hard test + grep gates.
- I-62: `docs/operator-shortcuts.md` exists, version `1.0.0`, contains
  the seven draw-tool rows + the M1.3a/b/c carry-over rows from
  ADR-022's table. Hard grep gate.
- I-63: Both architecture contracts (Claude + Codex) §0.2 binding
  tables list ADR-023 and DO NOT list `022-tool-state-machine-and-command-bar.md`
  (path string). Hard grep gate.
- I-64: ADR README main `## Index` lists ADR-023; `## Superseded ADRs`
  section lists ADR-022. Hard grep gates.

**Mandatory Completion Gates:**

```
Gate 15.1: ADR-023 file exists with ACCEPTED status + Supersedes header
  Command: rg -n "^\\*\\*Status:\\*\\* ACCEPTED" docs/adr/023-tool-state-machine-and-command-bar.md && rg -n "^\\*\\*Supersedes:\\*\\* ADR-022" docs/adr/023-tool-state-machine-and-command-bar.md
  Expected: ≥1 match in each (combined exit 0)

Gate 15.2: ADR-023 contains all seven draw-tool shortcut rows
  Command: rg -n "\\| `PT` |\\| `L` |\\| `PL` |\\| `REC` |\\| `CC` |\\| `A` |\\| `XL`|\\| `XX`" docs/adr/023-tool-state-machine-and-command-bar.md
  Expected: ≥8 matches (one per row including XX alias)

Gate 15.3: ADR-022 moved to superseded folder; root file gone
  Command: test ! -e docs/adr/022-tool-state-machine-and-command-bar.md && test -f docs/adr/superseded/022-tool-state-machine-and-command-bar-superseded.md && echo OK
  Expected: "OK"

Gate 15.4: Superseded ADR-022 has SUPERSEDED status + Superseded by ADR-023 pointer
  Command: rg -n "Status:\\*\\* SUPERSEDED" docs/adr/superseded/022-tool-state-machine-and-command-bar-superseded.md && rg -n "Superseded by:\\*\\* ADR-023" docs/adr/superseded/022-tool-state-machine-and-command-bar-superseded.md
  Expected: ≥1 match each

Gate 15.5: docs/operator-shortcuts.md registry exists with version + governance + draw-tool rows
  Command: rg -n "Version.*1\\.0\\.0|## Governance|## Shortcut map" docs/operator-shortcuts.md && rg -n "\\| `PT` |\\| `L` |\\| `PL` |\\| `REC` |\\| `CC` |\\| `A` |\\| `XL`|\\| `XX`" docs/operator-shortcuts.md
  Expected: ≥3 matches in first; ≥8 matches in second

Gate 15.6: ADR README updated — ADR-023 in main index, ADR-022 in superseded section
  Command: rg -n "023-tool-state-machine" docs/adr/README.md && awk '/^## Superseded ADRs/{flag=1} flag' docs/adr/README.md | rg -n "022-tool-state-machine"
  Expected: matches in both

Gate 15.7a: Both architecture contracts list ADR-023 in §0.2 binding table
  Command: rg -n "023-tool-state-machine" docs/procedures/Claude/00-architecture-contract.md docs/procedures/Codex/00-architecture-contract.md
  Expected: ≥2 matches (one per contract file)

Gate 15.7b: Neither contract references the OLD ADR-022 path
  Command: rg -n "022-tool-state-machine-and-command-bar\\.md" docs/procedures/Claude/00-architecture-contract.md docs/procedures/Codex/00-architecture-contract.md
  Expected: 0 matches
```

**Tests added:** none in this phase (docs work; verification by gates
only).

### Phase 16 — Seven primitive draw tools + register shortcuts in registry

**Goal:** Land draw tools for the seven primitive kinds, register
their shortcuts in `packages/editor-2d/src/keyboard/shortcuts.ts`, and
populate the seven new draw-tool rows in
`docs/operator-shortcuts.md` (the registry created in Phase 15). No
ADR text edits in this phase — Phase 15 already authored ADR-023 with
the complete shortcut map; this phase only touches the impl-side
registration and the subordinate registry rows.

**Files affected:**
- `packages/editor-2d/src/tools/draw/draw-point.ts` (new)
- `packages/editor-2d/src/tools/draw/draw-line.ts` (new)
- `packages/editor-2d/src/tools/draw/draw-polyline.ts` (new)
- `packages/editor-2d/src/tools/draw/draw-rectangle.ts` (new)
- `packages/editor-2d/src/tools/draw/draw-circle.ts` (new)
- `packages/editor-2d/src/tools/draw/draw-arc.ts` (new)
- `packages/editor-2d/src/tools/draw/draw-xline.ts` (new)
- `packages/editor-2d/src/tools/index.ts` (modified — register draw
  tools)
- `packages/editor-2d/src/keyboard/shortcuts.ts` (modified — register
  shortcuts)
- `packages/editor-2d/tests/draw-tools.test.ts` (new)
- `docs/operator-shortcuts.md` (modified — verify the seven draw-tool
  rows seeded in Phase 15 are present and consistent with the impl
  shortcut registration)

**Steps:**
1. Author each draw tool generator. Reference flow for Polyline:
   - Prompt "Specify start point" (accept point).
   - Loop: prompt "Specify next point or [Close/Undo]" (accept point
     or `Close` → close polyline, `Undo` → drop last vertex).
   - Closed condition: `Close` sub-option commits with `closed: true`.
   - Open commit: `Enter` or two right-clicks.
   - Bulge entry deferred to M1.3c (M1.3a polyline draws straight
     segments only; bulges set to `0`). NOTE: this is a progressive
     subset of ADR-016 §Polyline (which supports bulge per-segment).
     Per §0.7 progressive-implementation: schema accepts bulge !== 0
     (Phase 2); the draw tool simply doesn't emit non-zero bulges.
     Edit by post-creation Fillet (M1.3b) or direct property edit
     (M1.3c) introduces non-zero bulges.
   - Commit: `addPrimitive({ kind: 'polyline', vertices, bulges:
     [0, 0, ..., 0], closed, layerId: activeLayerId,
     displayOverrides: {} })`.
2. Other draw tools follow analogously. Rectangle: two-corner with
   `localAxisAngle = 0` (rotated rectangles via post-creation rotate
   in M1.3b). Circle: center + radius (or 2-point diameter via
   sub-option). Arc: 3-point (start, mid, end) by default; sub-option
   for center+start+angle, etc.
3. Update `keyboard/shortcuts.ts` registry:
   - `PT` → `draw-point`
   - `L` → `draw-line`
   - `PL` → `draw-polyline`
   - `REC` → `draw-rectangle`
   - `CC` → `draw-circle`
   - `A` → `draw-arc`
   - `XL` → `draw-xline`
   - `XX` → `draw-xline` (alias)
4. Confirm `docs/operator-shortcuts.md` (created in Phase 15) contains
   the seven draw-tool rows; if drift between impl shortcuts and
   registry file rows is detected, update the registry file and bump
   its changelog.
5. Tests: each draw tool produces the expected primitive shape with
   `bulges` zero-filled.

**Invariants introduced:**
- I-48: M1.3a polyline draw tool emits `bulges: [0, ..., 0]` only.
  Non-zero bulges enter via post-creation operations (M1.3b Fillet,
  M1.3c property edit).
- I-49: Each draw tool assigns `layerId: activeLayerId` (not
  `LayerId.DEFAULT` directly — `activeLayerId` resolves to default
  on first entity if user has not changed it). `activeLayerId` lives
  in editor-2d ui-state.
- I-50: Each draw tool sets `displayOverrides: {}` (ByLayer for all
  properties). Tested.
- I-51: `docs/operator-shortcuts.md` registry contains rows for
  `PT`, `L`, `PL`, `REC`, `CC`, `A`, `XL`, `XX` (seeded in Phase 15;
  verified again in this phase). Hard grep gate.
- I-52: `keyboard/shortcuts.ts` impl maps the same eight shortcut
  literals to the seven draw tools. Hard grep gate.

**Mandatory Completion Gates:**

```
Gate 16.1: All seven draw tools present
  Command: ls packages/editor-2d/src/tools/draw/draw-{point,line,polyline,rectangle,circle,arc,xline}.ts | wc -l
  Expected: 7

Gate 16.2: Draw tools tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "draw"
  Expected: passes

Gate 16.3: All eight draw-tool shortcut literals registered in keyboard/shortcuts.ts
  Command: rg -n "['\"](PT|L|PL|REC|CC|A|XL|XX)['\"]" packages/editor-2d/src/keyboard/shortcuts.ts
  Expected: ≥8 matches

Gate 16.4: docs/operator-shortcuts.md still contains the seven draw-tool rows (consistency with impl)
  Command: rg -n "\\| `PT` |\\| `L` |\\| `PL` |\\| `REC` |\\| `CC` |\\| `A` |\\| `XL`|\\| `XX`" docs/operator-shortcuts.md
  Expected: ≥8 matches

Gate 16.5: M1.3a polyline emits zero bulges only
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "polyline.*bulge.*0"
  Expected: ≥1 test, passes

Gate 16.6: Type-check passes
  Command: pnpm tsc --noEmit
  Expected: zero errors
```

### Phase 17 — Command bar React component

**Goal:** Land the AutoCAD-style command bar React component with
prompt display, sub-option brackets, history scrollback, focus
integration.

**Files affected:**
- `packages/editor-2d/src/chrome/CommandBar.tsx` (new)
- `packages/editor-2d/src/chrome/CommandBar.module.css` (new)
- `packages/editor-2d/src/chrome/CommandHistoryList.tsx` (new — split
  for testability)
- `packages/editor-2d/src/chrome/CommandPromptLine.tsx` (new — split
  for testability)
- `packages/editor-2d/tests/CommandBar.test.tsx` (new)

**Steps:**
1. Authors per ADR-023 §Command bar schema. Read state from
   `editorUiStore` via dedicated hook (in chrome/, so React imports
   are allowed).
2. Render history scrollback (capped at N=200 entries; older
   evictions noted).
3. Render current prompt + bracket sub-options (clickable + keyboard
   activatable).
4. Bar input field: when focused, ui-state focus holder = `'bar'`.
5. Focus transitions:
   - User types a letter while canvas has focus → keyboard router
     activates tool (not bar).
   - User clicks bar input → focus = bar; canvas keeps cursor
     tracking but doesn't receive letter keys.
   - User presses Escape in bar → focus → canvas; current tool
     aborts.
6. Tests: render with mock prompt; click sub-option triggers handler;
   typing in bar accumulates.

**Invariants introduced:**
- I-53: Command bar history is capped (200 entries default; configurable).
  Tested.
- I-54: Command bar input is `<input>` (or `<textarea>` for multi-line
  history scrollback in future) — native DOM focus drives our
  ui-state focus holder via `onFocus` / `onBlur`. Tested.

**Mandatory Completion Gates:**

```
Gate 17.1: CommandBar component exists
  Command: rg -n "export.*function CommandBar|export const CommandBar" packages/editor-2d/src/chrome/CommandBar.tsx
  Expected: ≥1 match

Gate 17.2: CommandBar tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "CommandBar|commandBar"
  Expected: passes

Gate 17.3: History cap configured
  Command: rg -n "200|HISTORY_CAP|historyLimit" packages/editor-2d/src/chrome/CommandBar.tsx packages/editor-2d/src/chrome/CommandHistoryList.tsx
  Expected: ≥1 match
```

### Phase 18 — Properties panel + Layer Manager dialog + StatusBar geo-ref chip

**Goal:** Land the supporting React chrome for Properties (Ctrl+1),
Layer Manager (LA), and the geo-ref chip for the status bar.

**Files affected:**
- `packages/editor-2d/src/chrome/PropertiesPanel.tsx` (new) +
  `.module.css`
- `packages/editor-2d/src/chrome/LayerManagerDialog.tsx` (new) +
  `.module.css`
- `packages/editor-2d/src/chrome/StatusBarGeoRefChip.tsx` (new) +
  `.module.css`
- `packages/editor-2d/src/chrome/GeoRefDialog.tsx` (new — minimal
  body; shows a "set later" placeholder per A6) + `.module.css`
- `packages/editor-2d/tests/PropertiesPanel.test.tsx` (new)
- `packages/editor-2d/tests/LayerManagerDialog.test.tsx` (new)
- `packages/editor-2d/tests/StatusBarGeoRefChip.test.tsx` (new)

**Steps:**
1. Properties panel: read selection from ui-state; if exactly one
   primitive / layer / grid selected, show its core fields read-only
   + editable controls for `layerId` (dropdown) and
   `displayOverrides.color / lineType / lineWeight`. If multi-select
   or empty, panel shows a placeholder.
2. Layer Manager dialog: list layers; create / rename / recolor /
   visibility-frozen-locked toggles / delete (with reassign confirm
   dialog).
3. Geo-ref chip: shown in status bar, label "Not geo-referenced"
   when `coordinateSystem === null`; clicking opens GeoRefDialog
   placeholder with explanatory text and "Set later" button.
4. GeoRefDialog body: explanatory paragraph + "Set later" button;
   no actual coordinate-input UI in M1.3a (deferred per A6).
5. Tests per file.

**Invariants introduced:**
- I-55: Properties panel does not allow editing `layerId` to a
  layer that does not exist (dropdown sourced from `useLayers()`).
- I-56: Layer Manager prevents renaming or deleting `LayerId.DEFAULT`
  (UI-disabled state). Tested.
- I-57: GeoRefDialog has a "Set later" button; closing the dialog
  leaves `coordinateSystem` as null. Drafting continues unblocked.
  Tested.

**Mandatory Completion Gates:**

```
Gate 18.1: All chrome components exist
  Command: ls packages/editor-2d/src/chrome/{PropertiesPanel,LayerManagerDialog,StatusBarGeoRefChip,GeoRefDialog,CommandBar}.tsx | wc -l
  Expected: 5

Gate 18.2: Properties / LayerManager / GeoRef tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "Properties|LayerManager|GeoRef"
  Expected: passes

Gate 18.3: GeoRef chip "Not geo-referenced" label present
  Command: rg -n "Not geo-referenced" packages/editor-2d/src/chrome/StatusBarGeoRefChip.tsx
  Expected: ≥1 match

Gate 18.4: Default layer protected in Layer Manager
  Command: rg -n "LayerId\\.DEFAULT|defaultLayer.*delete|cannot delete default" packages/editor-2d/src/chrome/LayerManagerDialog.tsx
  Expected: ≥1 match
```

### Phase 19 — apps/web integration

**Goal:** Wire `<EditorRoot />` into `apps/web/src/shell/CanvasArea.tsx`
and the geo-ref chip into the status bar.

**Files affected:**
- `apps/web/package.json` (modified — add `@portplanner/editor-2d`)
- `apps/web/src/shell/CanvasArea.tsx` (modified — replace placeholder
  with `<EditorRoot />`)
- `apps/web/src/shell/StatusBar.tsx` (modified — render
  `<StatusBarGeoRefChip />` from editor-2d)
- `apps/web/tests/CanvasArea.test.tsx` (modified or new)

**Steps:**
1. Add workspace dep to `apps/web/package.json`. Run `pnpm install`.
2. Replace `CanvasArea.tsx` body with `<EditorRoot />`; keep aria
   labels updated ("2D drafting canvas").
3. Render `<StatusBarGeoRefChip />` inside `StatusBar.tsx`.
4. Update `M1.3a` references in `CanvasArea.tsx` placeholder
   comments (remove "lands in M1.3" stub markers).
5. Tests: shell renders without crashing; CanvasArea contains a
   `<canvas>` element (or its wrapper).

**Invariants introduced:**
- I-58: `apps/web/src/shell/CanvasArea.tsx` renders `<EditorRoot />`.
- I-59: `apps/web/src/shell/StatusBar.tsx` includes the geo-ref chip.

**Mandatory Completion Gates:**

```
Gate 19.1: apps/web depends on editor-2d
  Command: rg -n "@portplanner/editor-2d" apps/web/package.json
  Expected: ≥1 match

Gate 19.2: CanvasArea renders EditorRoot
  Command: rg -n "EditorRoot" apps/web/src/shell/CanvasArea.tsx
  Expected: ≥1 match

Gate 19.3: StatusBar renders geo-ref chip
  Command: rg -n "StatusBarGeoRefChip" apps/web/src/shell/StatusBar.tsx
  Expected: ≥1 match

Gate 19.4: apps/web tests + smoke pass
  Command: pnpm --filter @portplanner/web test
  Expected: passes

Gate 19.5: Build passes
  Command: pnpm -r build
  Expected: success across all packages
```

### Phase 20 — Glossary + design tokens audit

**Goal:** Append glossary terms + audit/append design tokens.

**Files affected:**
- `docs/glossary.md` (modified — append 12 terms per §3.5)
- `docs/design-tokens.md` (modified iff missing tokens — see Steps)

**Steps:**
1. Append the 12 glossary entries from §3.5 to `docs/glossary.md`.
   Place them in the appropriate sub-sections per existing structure
   (Spatial / UI / Object / etc.).
2. Audit `docs/design-tokens.md` Layer 2 — Semantic tokens — Canvas
   sub-section. Required tokens (consumed by paint code):
   `snap_indicator`, `grid_minor`, `grid_major`, `background`,
   `selection_handle`, `dimension_preview`, `guide_line`, `ortho_axis`.
   Append any missing ones with values appropriate to the existing
   token style. Update the design-tokens.md changelog.
3. Update `useActiveThemeTokens()` consumer expectations to match.

**Mandatory Completion Gates:**

```
Gate 20.1: All 12 new glossary terms present
  Command: rg -n "Primitive|Layer\\b|Default layer|DisplayOverrides|Grid\\b|Xline|Bulge|ByLayer|OSNAP|GSNAP|Ortho|Snap priority|View transform" docs/glossary.md
  Expected: ≥12 matches

Gate 20.2: Canvas tokens present in design-tokens.md
  Command: rg -n "snap_indicator|grid_minor|grid_major|selection_handle|dimension_preview|guide_line|ortho_axis" docs/design-tokens.md
  Expected: ≥6 matches (or all 8 if a clean append)
```

### Phase 21 — Comprehensive test pass + smoke E2E

**Goal:** Final verification: full test suite passes; smoke E2E
covers the headline user journey.

**Files affected:**
- `packages/editor-2d/tests/smoke-e2e.test.tsx` (new) — happy-dom
  jsdom-based test
- (any test gaps surfaced during this phase)

**Steps:**
1. Run full test suite (`pnpm test`).
2. Author smoke E2E suite. Each scenario is a named `it(...)` test
   inside `packages/editor-2d/tests/smoke-e2e.test.tsx`. Gate 21.2's
   grep matches the scenario name strings:
   - **Scenario "draw line and reload":** mount `<EditorRoot />` in
     happy-dom; simulate `createNewProject` → assert default layer
     present; `keyDown('L')` → active tool = draw-line; canvas click
     at metric (0,0) → first prompt resolved; canvas click at (10,0)
     → tool commits; assert one `'line'` primitive in store with
     right vertices; serialize / deserialize round-trip; assert
     primitive survives.
   - **Scenario "pan zoom toggle":** wheel events zoom; middle-mouse
     drag pans (assert `viewport.panX` changes); `keyDown('Z')` →
     active tool = zoom; sub-option `keyDown('E')` → fits extents;
     `keyDown('F3')` → assert toggles[OSNAP] flips; same for F8 / F9 /
     F12. Each toggle change reflected in ui-state.
   - **Scenario "layer manager flow":** `keyDown('L')` then
     `keyDown('A')` → multi-letter accumulator → LA tool active →
     LayerManagerDialog opens; create layer; set active; `keyDown('L')`
     → draw-line; click two points; assert primitive on the new layer;
     toggle visibility on layer → assert paint excludes; toggle back.
   - **Scenario "properties edit":** select a primitive (canvas click
     in select tool); `keyDown('Ctrl+1')` → Properties panel opens;
     change layer dropdown → assert primitive's `layerId` updates;
     change color override → assert `displayOverrides.color` set.
   - **Scenario "geo-ref chip non-blocking":** click chip in status
     bar → GeoRefDialog opens; click "Set later" → dialog closes;
     `coordinateSystem` still null; primitive can be drawn afterward.
3. Run `pnpm typecheck` (= `pnpm tsc --noEmit`); zero errors.
4. Run `pnpm check` (Biome); zero issues.
5. Run `pnpm build`; success.

**Mandatory Completion Gates:**

```
Gate 21.1: Full test suite passes
  Command: pnpm test
  Expected: all packages pass; no skipped without justification

Gate 21.2: Smoke E2E passes
  Command: pnpm --filter @portplanner/editor-2d test -- --grep "smoke-e2e|draw line.*reload|round-trip"
  Expected: ≥1 test, passes

Gate 21.3: Typecheck passes
  Command: pnpm typecheck
  Expected: zero errors

Gate 21.4: Lint passes
  Command: pnpm check
  Expected: zero issues

Gate 21.5: Build passes
  Command: pnpm build
  Expected: success across all packages

Gate 21.6: Module isolation grep gates pass
  Command: rg -n "from '@portplanner/project-store-react'" packages/editor-2d/src/canvas/ ; rg -n "from '@portplanner/editor-2d'" packages/viewer-3d/ 2>/dev/null ; rg -n "from '@portplanner/viewer-3d'" packages/editor-2d/ 2>/dev/null
  Expected: zero matches across all three commands (third + fourth tolerate non-existence of viewer-3d package)

Gate 21.7: Out-of-scope artifacts are absent
  Command: test ! -e docs/handovers && test ! -e services/api && test ! -e packages/viewer-3d && echo OK
  Expected: "OK"
```

## 9. Invariants summary

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| I-1 | `LayerId.DEFAULT` is a fixed UUIDv7 constant | Gate 1.4 + grep for alternatives |
| I-2 | Per-kind primitive interfaces extend `PrimitiveBase` (id/kind/layerId/displayOverrides) | Type-level (Phase 1) |
| I-3 | `ProjectSchema.schemaVersion === '1.1.0'` | Gate 2.3, Zod literal |
| I-4 | Closed polyline requires `vertices.length >= 3` | Gate 2.4, Zod refinement |
| I-5 | Bulge count matches vertex count per closed/open convention | Gate 2.4, Zod refinement |
| I-6 | Loading `1.0.0` payload fails with `LoadFailure` | Gate 2.5 |
| I-7 | `Operation.targetKind` discriminant + `targetId` branded at use site | Gate 3.2 / 3.3 |
| I-8 | `'dimension'` snapshot arm is type-unreachable in M1.3a | Type-level (Phase 3) |
| I-9 | `promotionGroupId` optional; populated only by promotion ops (none in M1.3a) | Gate 3.4 |
| I-10 | `ProjectObject.layerId` required | Gate 4.1 |
| I-11 | `sourceProvenance` set iff `sourceKind === 'promoted'` | Gate 4.3 |
| I-12 | `createNewProject` seeds default layer | Gate 5.1 |
| I-13 | Default layer cannot be deleted | Gate 5.2 |
| I-14 | Layer delete with referenced entities requires reassign | Gate 5.3 |
| I-15 | Layer rename preserves layerId | Tested (Phase 5) |
| I-16 | Every entity-level mutation in `actions/` goes through emitOperation; setState in `actions/` is forbidden | Gate 6.2 + 6.5 (hard, directory-scoped after Codex Round-1 OI-2a refactor) |
| I-17 | Operation sequence is monotonically increasing | Gate 6.4 |
| I-18 | `clearOperationLog` called on `createNewProject`/`hydrateProject` | Tested (Phase 6) |
| I-19 | Hooks return stable references when entity unchanged | Tested (Phase 7) |
| I-20 | editor-2d depends on `@flatten-js/core` + `rbush` | Gate 8.3 |
| I-21 | editor-2d declares `react`+`react-dom` as peerDependencies | Gate 8.1 inspection |
| I-22 | View transform round-trip identity (1e-9 relative error) | Gate 9.1 |
| I-23 | Arc bbox accounts for ±X/±Y extremes within angular span | Gate 9.2 |
| I-24 | Bulge-arc bbox in polyline correct | Gate 9.2 |
| I-25 | Xlines queried separately from rbush | Tested (Phase 9) |
| I-26 | Paint excludes invisible / frozen layers | Gate 10.7 |
| I-27 | No paint-extraction coupling (extraction-agnostic discipline) | Documented; no extractor in M1.3a |
| I-28 | Only `canvas-host.tsx` under `canvas/` imports React | Gate 10.5 |
| I-29 | `canvas-host.tsx` subscribes via `projectStore.subscribe` (not `useProject`) | Gate 10.6 (hard grep — file does not import from `@portplanner/project-store-react`) |
| I-30 | Polyline painter handles `bulge !== 0` segments | Gate 10.3 + path-string assertion |
| I-31 | Focus holder is `'canvas' \| 'bar' \| 'dialog'` | Gate 11.2 |
| I-32 | Bypass keys (F3/F8/F9/F12, Ctrl+Z/Y) handle identically across focus holders | Gate 11.5 |
| I-33 | Single window-level keydown listener per editor instance | Gate 11.3 |
| I-34 | Multi-letter commands resolve via accumulator with timeout | Gate 11.5 |
| I-35 | UI state has no zundo middleware | Gate 11.4 |
| I-36 | Three named tolerance modules: equals / commit / screen-tolerance | Gate 12.1 |
| I-37 | `equalsMetric` default ε is `1e-6` | Gate 12.3 |
| I-38 | `isSnapCandidate` default px tolerance is `10` | Tested (Phase 12) |
| I-39 | `commitSnappedVertex` is bit-copy (Object.is identity) | Gate 12.4 |
| I-40 | Snap priority order matches ADR-016 §GSNAP ordering | Gate 12.6 |
| I-41 | Ortho applied as modifier after snap resolution | Tested (Phase 12) |
| I-42 | No mixing of tolerance utilities outside their modules | Gates 12.5a + 12.5b + 12.5c (hard, directory-scoped) |
| I-43 | ToolRunner is stateless; state in active-tool slice | Tested (Phase 13) |
| I-44 | Escape during tool aborts without commit | Gate 13.1 |
| I-45 | Successful tool completion emits ≥1 operation | Gate 13.1 |
| I-46 | Each tool emits at most one logical commit per run | Tested (Phase 14) |
| I-47 | Undo/Redo via zundo `temporal` | Tested (Phase 14) |
| I-48 | M1.3a polyline draw emits zero bulges only (progressive subset of ADR-016) | Gate 16.5 |
| I-49 | Draw tools assign `activeLayerId`, defaulting to `LayerId.DEFAULT` | Tested (Phase 16) |
| I-50 | Draw tools set `displayOverrides: {}` (ByLayer) | Tested (Phase 16) |
| I-51 | `docs/operator-shortcuts.md` registry contains rows for `PT/L/PL/REC/CC/A/XL/XX` | Gate 15.5 + Gate 16.4 |
| I-52 | `keyboard/shortcuts.ts` impl maps the eight shortcut literals to the seven draw tools | Gate 16.3 |
| I-53 | Command bar history capped at 200 entries | Gate 17.3 |
| I-54 | Bar input native focus drives ui-state focus holder | Tested (Phase 17) |
| I-55 | Properties panel `layerId` dropdown sourced from `useLayers()` | Tested (Phase 18) |
| I-56 | Layer Manager prevents rename/delete of `LayerId.DEFAULT` | Gate 18.4 |
| I-57 | GeoRefDialog has "Set later"; drafting unblocked when null | Tested (Phase 18) |
| I-58 | apps/web `CanvasArea` renders `<EditorRoot />` | Gate 19.2 |
| I-59 | apps/web `StatusBar` includes geo-ref chip | Gate 19.3 |
| I-60 | ADR-023 file exists with ACCEPTED + Supersedes ADR-022 + seven draw-tool rows | Gate 15.1 + 15.2 |
| I-61 | ADR-022 moved to superseded folder with SUPERSEDED + Superseded by ADR-023 headers | Gate 15.3 + 15.4 |
| I-62 | `docs/operator-shortcuts.md` registry exists with version + governance + draw-tool rows | Gate 15.5 |
| I-63 | Both architecture contracts list ADR-023 in §0.2 binding table; neither references the OLD ADR-022 path | Gate 15.7a + 15.7b |
| I-64 | ADR README updated — ADR-023 in main `## Index`, ADR-022 in `## Superseded ADRs` section | Gate 15.6 |

## 10. Test strategy

**Tests existing before:** M1.2 ships:
- `packages/domain/tests/*.test.ts` — schemas, ids, serialize.
- `packages/project-store/tests/store.test.ts`,
  `tests/zundo.test.ts` — actions, partialize.
- `packages/project-store-react/tests/hooks.test.tsx` — basic hooks.
- `packages/design-system/tests/*.test.ts` — token / theme tests.
- `apps/web/tests/*.test.tsx` — shell layout, persistence smoke.

**Tests added by M1.3a:**
- Domain (Phase 2 + 3 + 4): primitive / layer / grid Zod round-trip;
  schema version mismatch; closed-polyline invariants; bulge length;
  Operation ADR-020 round-trip; ProjectObject ADR-019 refinement.
- Project-store (Phase 5 + 6): primitive/layer/grid actions; default
  layer seed; layer delete with reassign; emitOperation correctness;
  sequence monotonicity; clearOperationLog.
- Project-store-react (Phase 7): hook stability + selector contract.
- Editor-2d (Phases 8–14, 16–18, 20, 21): view transform round-trip; per-kind
  bbox; spatial index CRUD; paint smoke; per-painter capture
  assertions; bulge-arc rendering; hit-test per kind; UI state slices;
  keyboard router (focus matrix); snap tolerances; OSNAP / GSNAP /
  Ortho per mode; snap priority; tool runner; per-tool tests; draw
  tools; CommandBar; PropertiesPanel; LayerManagerDialog;
  StatusBarGeoRefChip; smoke E2E.

**Tests intentionally not added (deferred):**
- Promotion atomicity tests — M1.3b.
- Dimension associative ref tests — M1.3c.
- Extraction determinism — M1.4.
- POLAR / OTRACK / remaining OSNAP — M1.3c.
- Multi-user sync — post-M1.

## 11. Done Criteria — objective pass/fail

All Phase 1–21 gates pass. Each Done Criteria item below pairs a
behavioural check with the executable gate / test that verifies it
(per Codex Round-1 OI-4 — no manual-only UX checkpoints):

- [ ] Plan file committed + pushed — verified by branch state at
  closure (the very fact of this PR existing on `feature/m1-3a-canvas-primitives-layers`).
- [ ] All seven primitive kinds round-trip — verified by Gate 2.2
  (schema round-trip tests) + Gate 21.2 (smoke E2E persists each
  kind through save/reload).
- [ ] `Operation` ADR-020 shape — verified by Gate 3.1 + 3.2 + 3.3
  + 3.4 + Gate 6.3 (operation-emit tests cover each `targetKind`).
- [ ] `ProjectObject` ADR-019 shape — verified by Gate 4.1 + 4.2
  + 4.3.
- [ ] Default layer seeded; absent → hydrateProject fails — verified
  by Gate 5.1 + Gate 7.1 (hydration test for orphan-layerId / missing-default).
- [ ] `emitOperation` covers every entity action; sequence
  monotonic — verified by Gate 6.2 + 6.4 + 6.5 (hard, after OI-2a
  refactor).
- [ ] `packages/editor-2d` builds / types / lints / tests cleanly
  — verified by Gate 8.1 + Gate 21.3 + Gate 21.4 + Gate 21.5.
- [ ] **Smoke E2E: New Project → press `L` → click two points →
  line rendered → save → reload → line still rendered** — verified
  by Gate 21.2 (the headline E2E scenario).
- [ ] **Smoke E2E: middle-mouse pan, wheel zoom, `Z` Extents/Window/
  Previous, F3/F8/F9/F12 toggles** — verified by Phase 21 expansion
  to include these scenarios in the smoke E2E suite (added in Phase
  21 step 2 below; Gate 21.2 grep widens to match these scenario
  names).
- [ ] **Smoke E2E: open LA → create layer → set active → draw
  primitive → toggle visibility** — verified by Gate 21.2.
- [ ] **Smoke E2E: open Properties (Ctrl+1) on a selection → change
  layer → change color override** — verified by Gate 21.2.
- [ ] **Smoke E2E: click geo-ref chip → GeoRefDialog opens → "Set
  later" closes without setting → drafting continues** — verified
  by Gate 17.3 (presence) + Gate 21.2 (full flow).
- [ ] Three snap tolerances are not mixed at any use site —
  verified by **hard, command-verifiable** Gates 12.5a + 12.5b +
  12.5c (after OI-2b hardening).
- [ ] **ADR-023 contains the seven draw-tool shortcut rows + ADR-022
  is properly superseded + `docs/operator-shortcuts.md` registry
  is the going-forward SSOT + both architecture contracts updated**
  — verified by Gates 15.1 + 15.2 + 15.3 + 15.4 + 15.5 + 15.6 +
  15.7a + 15.7b.
- [ ] `keyboard/shortcuts.ts` registers the eight shortcut literals
  (PT, L, PL, REC, CC, A, XL, XX) — verified by Gate 16.3.
- [ ] No `docs/handovers/` directory; no `services/api` scaffold;
  no `packages/viewer-3d` package — verified by `test ! -e
  docs/handovers && test ! -e services/api && test ! -e packages/viewer-3d
  && echo OK` (added as Gate 21.7 in the smoke pass).
- [ ] Module isolation grep gates (Gate 21.6) pass.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm check`, `pnpm build`
  all pass — verified by Gate 21.1 + 21.3 + 21.4 + 21.5.

## 12. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `packages/editor-2d` is large (~30+ source files); review burden | Phased delivery with per-phase completion gates; each phase ships independently runnable tests; no phase requires the next to validate. |
| Three-tolerance snap model easy to conflate | Three named modules (Phase 12); hard directory-scoped grep gates 12.5a/b/c (Codex Round-1 OI-2b hardening); unit tests assert each layer's contract. |
| Operation emission first wired across all reducers (PI-1 risk) | Single `emitOperation` helper centralises shape; tests per action verify correct `targetKind` + before/after; sequence monotonicity test catches double-emission. |
| Undo/redo for new entity kinds — zundo partialize scope unchanged | Partialize remains `project` slice; entity maps live inside `project`; undo / redo work transparently. Tested in `packages/project-store/tests/zundo.test.ts` (extended). |
| Focus-holder bugs (canvas/bar/dialog routing) | Window-level single keydown handler (Gate 11.3); explicit routing table; per-transition tests; bypass keys covered. |
| `C` collides with Copy and Circle in AutoCAD convention | M1.3a uses `CC` for Circle (Q5 final). Documented in ADR-023 shortcut map and `docs/operator-shortcuts.md` registry. |
| Bulge-encoded arc rendering / hit-test | Dedicated polyline-arc-segment painter + hit-test routines; tests with bulge ≠ 0 polylines. M1.3a draw tool only emits zero bulges (I-48); first non-zero source is M1.3b Fillet. |
| DPR mismatch between paint and hit-test | Single `Viewport` value used by both; round-trip identity test (Gate 9.1). |
| rbush bboxes too loose for rotated/bulge entities → false-positive frustum hits | Per-kind tight bbox calculator (Phase 9); xlines special-cased outside rbush; tests on rotated rectangles + bulge-arcs. |
| M1.2 projects rejected by schema bump | GR-1 clean break is the explicit policy (A9). Preproduction; no real user data. Clear `LoadFailure` message names the version mismatch. |
| Coordinate-system UX trap (M1.2 PI-2 framing) | Retired (A6). Drafting unblocked; geo-ref chip + dialog deferred to non-blocking discoverable affordance. |
| `@flatten-js/core` + `rbush` are new deps | Pinned in Phase 8; `pnpm install` runs as part of scaffold gate; build gate (Gate 8.1) catches install failures. |
| Multi-letter shortcut accumulator bugs (e.g., user types `L` then waits then `A` — Line followed by selection?) | Timeout-based accumulator (~750 ms inactivity flushes); tests around boundary cases. AutoCAD's exact behaviour is the reference. |
| ADR-022 supersession adds 6 new docs files (ADR-023 + superseded mirror + registry + ADR README + Claude+Codex contract edits) | Mirrors drawing-model-pivot precedent (ADRs 002/010/013 → 019/020/021 + superseded mirrors); reviewers can navigate the chain via `Status: SUPERSEDED` + `Superseded by:` headers; Phase 15 gates 15.1–15.7b verify each artifact. Net cost is one extra docs phase; benefit is full §0.6 + §0.7 compliance and a sustainable shortcut SSOT (`docs/operator-shortcuts.md`) for future operator additions without touching ADR text. |
| Cross-reference drift in future plans (M1.3b/c will write against ADR-023, not ADR-022) | ADR-022's superseded copy retains its content for historical lookup; the ADR-023 file's Cross-references section names ADR-016/017/018/019/020/021. M1.3b plan-review (Procedure 02 Round 1) catches stale ADR-022 references. |
| Properties panel scope too broad → bloat | Limit to read-only display + layer/displayOverrides edit (A4 implicit; restated in Phase 18); deeper editing M1.3b. |
| Layer Manager scope too broad → bloat | Limit to create/rename/recolor/visibility-frozen-locked/delete-with-reassign; no filters, no states, no print plots. |
| Canvas paint performance with many entities | rbush frustum cull keeps per-frame work proportional to visible entities; xline list small; grid lattice clipped to viewport. M1.3a does not pre-optimise; profiling deferred until a real workload appears. |
| Focus holder transitions on dialog close (return to previous) | Stack-of-focus model: opening dialog pushes; closing pops. Single-stack assumption (no nested dialogs in M1.3a) noted; nested dialogs deferred. |

---

## Plan Review Handoff

**Plan:** `docs/plans/feature/m1-3a-canvas-primitives-layers.md`
**Branch:** `feature/m1-3a-canvas-primitives-layers`
**Status:** Plan authored — awaiting review

### Paste to Codex for plan review
> Review this plan using the protocol at
> `docs/procedures/Codex/02-plan-review.md` (Procedure 02).
> Apply strict evidence mode. Start from Round 1.

### Paste to user for approval
> Please review the plan at
> `docs/plans/feature/m1-3a-canvas-primitives-layers.md` on branch
> `feature/m1-3a-canvas-primitives-layers`. After approval, invoke
> Procedure 03 to begin execution from Phase 1 (domain types).
