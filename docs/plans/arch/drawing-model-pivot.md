# Plan — Drawing Model Pivot (ADRs 016–022 + 3 Supersessions)

**Branch:** `arch/drawing-model-pivot`
**Author:** Claude (Opus 4.7, 1M context)
**Date:** 2026-04-23
**Operating mode:** Procedure 01 (PLAN-ONLY) → Procedure 03 (EXECUTION) after approval
**Status:** Plan authored — awaiting review

---

## 1. Request summary

Reframe PortPlanner as a CAD-adjacent drafting surface with a hybrid primitive + typed-object data model. Introduce layers, persistent dimensions, grids, a formal drawing-model contract, a tool state machine + command bar, and reconcile three existing ADRs whose shapes change. Execute per the user's explicit supersession discipline: affected ADRs move to `docs/adr/superseded/` with `-superseded` suffix and `Status: SUPERSEDED`; 1:1 replacement ADRs land in `docs/adr/`. Same `superseded/` pattern seeded in `docs/extraction-registry/` (empty in this PR — content supersessions land M1.3b/M2 when registry entries actually change). `docs/handovers/` is explicitly **not** created.

No code changes. Docs/ADRs only.

## 2. Assumptions and scope clarifications

- "Affected" for ADR supersession means any change to the decision's shape or scope, not just its existence. Additive extensions (e.g., the project value now contains more entity maps) do NOT trigger supersession when the decision text remains accurate.
- 1:1 supersession: one superseded ADR → one replacement ADR. No one-to-many.
- Seven new primitive types (including Point as the simplest): point, line, polyline, rectangle, circle, arc, xline.
- Polyline supports arc segments via DXF-convention bulge; closed via `closed: boolean` flag without vertex duplication.
- Promotion is consume-semantics with `sourceKind` + `sourceProvenance?` audit trail.
- "Drawn vs canonical geometry" principle: primitives hold drawn geometry; typed objects hold canonical (extractor-facing) geometry. Constructors transform drawn → canonical. Post-creation re-alignment is a canonical-geometry operation independent of primitive retention.
- Registry entry content (RTG_BLOCK.md, ROAD.md, etc.) is NOT superseded in this PR. Supersession-and-rewrite of individual entries happens in M1.3b (RTG_BLOCK) and subsequent milestones when constructor sections are actually authored.
- Registry README governance update to add `## Constructors` section spec is edit-in-place (README is governance, not a versioned entry).
- D1 (supersede ADR-002), D2 (supersede ADR-010), D3 (supersede ADR-013) approved by user.
- ADR-022 (Tool State Machine + Command Bar) approved by user.
- `S` letter shortcut stays reserved for Select (user preference); STRETCH gets a different shortcut TBD (non-blocking for this plan; operator shortcut map lives in ADR-022 appendix).

## 3. Scope and Blast Radius

### In scope — files created

- `docs/adr/superseded/README.md` — folder purpose + supersession index
- `docs/extraction-registry/superseded/README.md` — folder purpose + (empty) future supersession index
- `docs/adr/016-drawing-model.md` — hybrid data model, seven primitive types, promotion contract, snap accuracy model, grid entity, drawn vs canonical principle
- `docs/adr/017-layer-model.md` — data-layer light, extraction-agnostic, displayOverrides bag, protected default layer
- `docs/adr/018-dimension-model.md` — associative-annotative, seven dimension kinds
- `docs/adr/019-object-model.md` — replacement for ADR-002: adds `layerId`, `displayOverrides`, `sourceKind`, `sourceProvenance`
- `docs/adr/020-project-sync.md` — replacement for ADR-010: Operation gains `targetKind`, `targetId`, `promotionGroupId`
- `docs/adr/021-2d-rendering-pipeline.md` — replacement for ADR-013: scope broadened to primitives + dimensions + grids + layers
- `docs/adr/022-tool-state-machine-and-command-bar.md` — AutoCAD-style command bar, prompt-driven tool state machines, keyboard routing, sub-option chains

### In scope — files renamed and moved

- `docs/adr/002-object-model.md` → `docs/adr/superseded/002-object-model-superseded.md` — Status line updated to `SUPERSEDED` + pointer to ADR-019
- `docs/adr/010-project-sync.md` → `docs/adr/superseded/010-project-sync-superseded.md` — Status → SUPERSEDED + pointer to ADR-020
- `docs/adr/013-2d-rendering-pipeline.md` → `docs/adr/superseded/013-2d-rendering-pipeline-superseded.md` — Status → SUPERSEDED + pointer to ADR-021

### In scope — files modified in place

- `docs/adr/README.md` — index: superseded rows moved to dedicated section, new rows added for 016–022
- `docs/procedures/Claude/00-architecture-contract.md` — §0.2 binding table refreshed: remove 002/010/013 rows, add 016–022 rows, add supersession note
- `docs/procedures/Codex/00-architecture-contract.md` — mirror of Claude contract
- `docs/overview.md` — "not a drawing tool" paragraph replaced with CAD-adjacent posture per ADR-016 Appendix
- `docs/execution-plan.md` — M1 section revised: sub-milestones M1.3a (canvas + primitives + layers + grid + essential operators), M1.3b (promotion + first typed object + core modify operators), M1.3c (dimensions + rich snap + expansion operators), M1.4 (extraction + validation + capacity panel — closes the commercial loop)
- `docs/extraction-registry/README.md` — `## Constructors` section governance added to entry format, version-bump rules for add/change/remove constructor, note that individual entries remain valid under their current versions and will be superseded-and-rewritten on content change (per ADR governance)

### Out of scope

- Any code changes (Procedure 01 §1.1 forbids; no source files modified)
- Registry entry content supersessions (RTG_BLOCK.md, ROAD.md, BUILDING.md, PAVEMENT_AREA.md, BERTH.md, YARD_CAPACITY_SUMMARY.md, GATE_CAPACITY_SUMMARY.md) — deferred to milestones that actually author the constructor sections
- Implementation of primitives/layers/dimensions/grids in `packages/domain` — lands with the M1.3a plan in a later PR
- Canvas implementation in `packages/editor-2d` — not yet scaffolded; M1.3a plan handles it
- `docs/handovers/` directory — explicitly not created per user instruction
- Scaffold of `packages/ui-state` (M1.3a territory)
- Extraction registry content for new primitive-origin fields — M1.3b authors RTG_BLOCK's constructor section
- Operator-by-operator implementation details — ADR-022 pins the framework; per-operator prompt flow is execution-phase artifact under M1.3a/b/c plans

### Blast radius

- **Packages affected:** none at the code level. When implementation begins (separate M1.3a plan), `packages/domain`, `packages/project-store`, `packages/project-store-react`, and `packages/editor-2d` (new) will all be affected.
- **Other object types affected via cross-object extractors:** none directly. ROAD/BUILDING/etc. registry entries will gain `## Constructors` sections in future milestones; this PR adds the governance spec only.
- **Scenarios affected:** none (ADR-006 unchanged).
- **Stored data affected:** none. M1.2 shipped the `Operation` type definition but deferred emission (PI-1); zero persisted operations exist at this plan's landing time, so no migration is required for the `targetKind`/`targetId`/`promotionGroupId` extension.
- **UI surfaces affected:** none in this PR. Implementation of the command bar, layer panel, promotion dialog, etc. lands with M1.3a plan.
- **Cross-references in un-superseded ADRs (001, 003, 004, 005, 006, 007, 008, 009, 011, 012, 014, 015):** left as-is. Readers follow Status: SUPERSEDED pointers per standard ADR governance. Editing un-superseded ADRs to update their Cross-references sections is forbidden by the ADR immutability rule (00-architecture-contract.md §0.6).

### Binding specifications touched

| Spec | Change type |
|------|-------------|
| ADR-001 Coordinate System | No change — project-local metric unchanged; primitives and grids use the same system |
| ADR-002 Object Model | **SUPERSEDED → ADR-019** |
| ADR-003 Ownership States | No change — ownership applies to typed objects only; primitives have no ownership |
| ADR-004 Parameter Extraction Contract | No change — extraction contract untouched; constructors are additive registry governance, not an extractor contract change |
| ADR-005 Library Model | No change |
| ADR-006 Scenario Model | No change |
| ADR-007 Validation Engine | No change — validation targets typed objects; primitives do not validate |
| ADR-008 3D Derivation Cache | No change — 3D is derived from typed objects only |
| ADR-009 RBAC | No change |
| ADR-010 Project Sync | **SUPERSEDED → ADR-020** |
| ADR-011 UI Stack | No change |
| ADR-012 Technology Stack | No change |
| ADR-013 2D Rendering Pipeline | **SUPERSEDED → ADR-021** |
| ADR-014 Persistence Architecture | No change — canonical JSON serializer extended to cover new entity kinds is implementation detail under ADR-014's "full serialized document" contract |
| ADR-015 Project Store Scope | No change — `zundo` scope remains "project slice only"; slice contains more entity kinds but scope is unchanged |
| ADR-016 Drawing Model | **NEW** |
| ADR-017 Layer Model | **NEW** |
| ADR-018 Dimension Model | **NEW** |
| ADR-019 Object Model v2 | **NEW (replaces ADR-002)** |
| ADR-020 Project Sync v2 | **NEW (replaces ADR-010)** |
| ADR-021 2D Rendering Pipeline v2 | **NEW (replaces ADR-013)** |
| ADR-022 Tool State Machine + Command Bar | **NEW** |
| Registry README governance | Edit in place — `## Constructors` section spec + version-bump rules |
| Registry entries (7 entries) | No change in this PR; deferred |
| Glossary | No change — new terms (primitive, layer, grid, dimension, xline, bulge, constructor, promotion, Ortho, OSNAP, GSNAP, OTRACK, POLAR, ByLayer, displayOverrides) to be added in M1.3a plan alongside code |
| Design tokens | No change |
| Overview.md | Edit in place — reconcile "not a drawing tool" |
| Execution-plan.md | Edit in place — M1 sub-milestones per pivot |

## 4. Architecture Doc Impact

| Doc | Path | Change type | Reason |
|-----|------|-------------|--------|
| ADR-002 | `docs/adr/002-object-model.md` → `docs/adr/superseded/002-object-model-superseded.md` | Rename + move + Status: SUPERSEDED | D1 — PortObject gains layerId, displayOverrides, sourceKind, sourceProvenance |
| ADR-010 | `docs/adr/010-project-sync.md` → `docs/adr/superseded/010-project-sync-superseded.md` | Rename + move + Status: SUPERSEDED | D2 — Operation shape changes |
| ADR-013 | `docs/adr/013-2d-rendering-pipeline.md` → `docs/adr/superseded/013-2d-rendering-pipeline-superseded.md` | Rename + move + Status: SUPERSEDED | D3 — rendering scope broadens beyond typed objects |
| ADR-016 | `docs/adr/016-drawing-model.md` | New | Introduces primitives, promotion, snap accuracy, grid entity, drawn vs canonical principle |
| ADR-017 | `docs/adr/017-layer-model.md` | New | Introduces layer model |
| ADR-018 | `docs/adr/018-dimension-model.md` | New | Introduces dimension model |
| ADR-019 | `docs/adr/019-object-model.md` | New | Replaces ADR-002 with extended shape |
| ADR-020 | `docs/adr/020-project-sync.md` | New | Replaces ADR-010 with extended Operation shape |
| ADR-021 | `docs/adr/021-2d-rendering-pipeline.md` | New | Replaces ADR-013 with broader scope |
| ADR-022 | `docs/adr/022-tool-state-machine-and-command-bar.md` | New | Pins tool state machine + command bar interaction model |
| ADR Index | `docs/adr/README.md` | Edit in place | Reflect supersession + new ADRs |
| Claude architecture contract | `docs/procedures/Claude/00-architecture-contract.md` | Edit in place | §0.2 binding table refresh |
| Codex architecture contract | `docs/procedures/Codex/00-architecture-contract.md` | Edit in place | Mirror of Claude contract |
| Registry README | `docs/extraction-registry/README.md` | Edit in place | Add `## Constructors` governance |
| Overview | `docs/overview.md` | Edit in place | Reconcile "not a drawing tool" |
| Execution plan | `docs/execution-plan.md` | Edit in place | M1 sub-milestones |
| `docs/adr/superseded/README.md` | New | New folder purpose index |
| `docs/extraction-registry/superseded/README.md` | New | New folder purpose index |

## 5. Deviations from binding specifications (§0.7 Approved Deviation Protocol)

Three supersessions under §0.7. Each has user approval recorded below per user's response "agreed, plan it" (2026-04-23) to the Procedure 01 §1.13 pre-response notification.

### D1 — Supersede ADR-002

- **Deviation:** Object Model contract is superseded by ADR-019.
- **What in the current spec does not work:** ADR-002's `PortObject` does not carry layer membership, does not carry display-style overrides, and does not carry source-provenance for primitive-promoted objects.
- **Why adaptation is not sufficient:** ADR-002 Decision section fixes the first-class column list; adding new first-class fields changes the schema shape, which is a decision-level change not implementation discretion.
- **Replacement:** ADR-019 Object Model v2 — adds `layerId: LayerId` (required, references ADR-017 default layer if unspecified), `displayOverrides: DisplayOverrides` (bag per ADR-017), `sourceKind: 'direct' | 'promoted'`, and optional `sourceProvenance: { primitiveKind, promotedAt, primitiveId }` for audit. Core Option-C discipline (first-class columns vs JSONB parameters), analysis/cost/mesh separation, ownership field, library traceability — all unchanged.
- **User approval:** Recorded — user stated "agreed, plan it" on 2026-04-23 after reviewing pre-response notification.

### D2 — Supersede ADR-010

- **Deviation:** Project Sync + Operation shape is superseded by ADR-020.
- **What in the current spec does not work:** ADR-010's `Operation` has `object_id: UUID` as the only target identifier, implicitly assuming every mutation targets a typed object. With primitives, dimensions, layers, and grids all op-logged, a discriminant is required.
- **Why adaptation is not sufficient:** Operation shape is defined in the ADR text; adding a discriminant field and renaming `object_id` → `target_id` changes the schema.
- **Replacement:** ADR-020 Project Sync v2 — `Operation` gains `targetKind: 'object' | 'primitive' | 'dimension' | 'layer' | 'grid'`, renames `objectId` → `targetId` (branded per kind at use site), adds optional `promotionGroupId: UUID` to link atomic DELETE-primitive + CREATE-object on promotion. Sync model (project-as-value, operation log, offline, object-level LWW, CRDT-compatible V2 path) unchanged.
- **Migration concern:** None. M1.2 defined the Operation type but deferred emission per PI-1; zero persisted operations exist at landing.
- **User approval:** Recorded 2026-04-23.

### D3 — Supersede ADR-013

- **Deviation:** 2D Rendering Pipeline is superseded by ADR-021.
- **What in the current spec does not work:** ADR-013 Context frames rendering around "authoritative typed objects" (ADR-002 framing). Paint loop iterates typed objects only. With primitives, dimensions, grids, and layers all renderable first-class, framing needs updating.
- **Why adaptation is not sufficient:** ADR-013 explicitly names its scope ("Render the authoritative 2D project (ADR-001 project-local metric geometry, ADR-002 typed objects)"); broadening is a scope change.
- **Replacement:** ADR-021 2D Rendering Pipeline v2 — Canvas2D + flatten-js + rbush + custom view transform choices unchanged. Paint loop broadens to dispatch on entity kind (primitive | object | dimension | grid | layer-overlay). Snap priority integration surface formalized (OSNAP/OTRACK/POLAR/GSNAP/ORTHO priority tuning remains execution-phase).
- **Note on borderlineness:** User explicitly approved this as supersession rather than "extend without supersede" pattern (per ADR-015 precedent).
- **User approval:** Recorded 2026-04-23.

### Why ADR-022 is NOT a deviation

ADR-022 does not change a binding spec — it introduces a new one. Per §0.7: "Following an ADR literally but in a way the ADR did not explicitly enumerate… is not a deviation — it is expected extension." ADR-013 explicitly left "Tool state machine" as an execution-phase design choice; pinning it via a new ADR is consistent with that handoff.

## 6. Object Model and Extraction Integration

Not applicable as primary scope — no object type added or modified in this PR. The shape change to `PortObject` via ADR-019 is a contract refresh that touches every typed object uniformly; per-type content (RTG_BLOCK extractor, ROAD extractor, etc.) is unchanged.

Registry `## Constructors` section is governance-only in this PR. First constructor content (RTG_BLOCK.md gaining its `## Constructors` section + primitive-to-RTG_BLOCK geometry mapping) lands in the M1.3b plan, which WILL follow §1.7 compliance.

## 7. Hydration, Serialization, Undo/Redo, Sync

Not applicable as primary scope — this PR changes ADR text only, no code. The superseding ADRs (019/020) specify hydration/sync semantics for their respective domains:

- ADR-019 hydration: unchanged from ADR-002 except for the new first-class fields.
- ADR-020 sync: unchanged from ADR-010 except for the Operation shape.
- ADR-016 hydration: primitives, grids deserialize alongside typed objects; canonical JSON schema (per ADR-014) extended to cover them.
- ADR-017 hydration: layers deserialize as a map; default layer seeded on project creation (schema invariant).
- ADR-018 hydration: dimensions deserialize with their `references` structure; measured values are derived (not stored).
- Undo/redo for all new entity kinds per ADR-020 Operation targetKind extension.

Detailed hydration specifications for code are deferred to the M1.3a plan.

## 8. Implementation phases

Eight phases. Each has file list, steps, invariants, gates, and tests (where applicable — docs work has no unit tests).

### Phase 1 — Scaffold supersession directories

**Goal:** Create `docs/adr/superseded/` and `docs/extraction-registry/superseded/` subfolders with placeholder README explaining their purpose.

**Files affected:**
- `docs/adr/superseded/README.md` (new)
- `docs/extraction-registry/superseded/README.md` (new)

**Steps:**
1. Create `docs/adr/superseded/` directory.
2. Author `docs/adr/superseded/README.md` explaining: folder holds ADRs with `Status: SUPERSEDED`; each filename has `-superseded` suffix; index of current superseded ADRs; cross-links to replacement ADRs.
3. Create `docs/extraction-registry/superseded/` directory.
4. Author `docs/extraction-registry/superseded/README.md` explaining: folder holds registry entries that have been replaced (content-level changes); empty at this PR's landing; entries arrive when their content supersession happens (M1.3b+).

**Invariants introduced:**
- I-1: `docs/adr/superseded/*.md` filenames MUST end with `-superseded.md` (enforceable by grep gate).
- I-2: Every file in `docs/adr/superseded/` MUST have `Status: SUPERSEDED` in its header (enforceable by grep).

**Mandatory Completion Gates:**

```
Gate 1.1: superseded dirs exist
  Command: test -d docs/adr/superseded && test -d docs/extraction-registry/superseded && echo OK
  Expected: "OK"

Gate 1.2: superseded READMEs exist
  Command: test -f docs/adr/superseded/README.md && test -f docs/extraction-registry/superseded/README.md && echo OK
  Expected: "OK"
```

### Phase 2 — Write new ADRs 016–022

**Goal:** Author all seven new ADRs in `docs/adr/` root.

**Files affected (all new):**
- `docs/adr/016-drawing-model.md`
- `docs/adr/017-layer-model.md`
- `docs/adr/018-dimension-model.md`
- `docs/adr/019-object-model.md`
- `docs/adr/020-project-sync.md`
- `docs/adr/021-2d-rendering-pipeline.md`
- `docs/adr/022-tool-state-machine-and-command-bar.md`

**Steps per ADR:** Follow the ADR format pinned by `docs/adr/README.md` (Status/Date headers; Context / Options considered / Decision / Consequences / What this makes harder; Cross-references; Changelog). Each ADR locks the specific decisions from the 2026-04-23 discussion thread. Detailed decision contents per ADR:

**ADR-016 Drawing Model** — seven primitives (point, line, polyline with bulge arcs + closed flag, rectangle, circle, arc, xline); primitives as first-class persistent entities; promotion-consume with `sourceKind` + `sourceProvenance?`; Path A unified pipeline; `constructors` section per registry entry; one-primitive-per-promotion rule with explicit PEDIT-Join; snap accuracy model (copy-bits on commit + ε=1e-6m for derived logic + screen-pixel for UI activation); grid as first-class drafting-aid entity (`origin`, `angle`, `spacingX`, `spacingY`, `layerId`, `visible`, `activeForSnap`); drawn-vs-canonical principle (primitives hold drawn geometry; typed objects hold canonical; constructors transform drawn → canonical; post-creation operations like re-align work on canonical form); GSNAP snap priority noted informatively; appendices for fillet math, closed-polyline invariants, non-goals.

**ADR-017 Layer Model** — data-layer light; `{id, name, color, lineType, lineWeight, visible, frozen, locked}`; `DisplayOverrides` bag (`{color?, lineType?, lineWeight?}`) on every entity (primitive, object, dimension, grid); ByLayer resolution via `override ?? layer.property`; protected default layer `LayerId.DEFAULT` with name `0`; extraction-agnostic binding rule (hiding/freezing a layer does NOT affect extractor inputs — violations are Blockers); deletion semantics (reassign-to-target OR move-to-default; default never deletable); renaming preserves layerId FKs.

**ADR-018 Dimension Model** — first-class persisted entity; seven dimension kinds (`linear-aligned`, `linear-x`, `linear-y`, `angular`, `radius`, `diameter`, `arc-length`); associative references `{targetId, targetKind: 'primitive' | 'object' | 'freefloat', part: ReferencePart}`; measured value is derived (not stored) — `textOverride` authoritative when present; delete-detach (deleting referenced entity converts ref to freefloat with snapshotted point); vertex index renumbering on polyline insert/remove; parametric/driving dimensions explicitly rejected; dimension styles deferred to M2.

**ADR-019 Object Model v2** — replaces ADR-002; same Option C discipline (first-class columns vs JSONB); adds `layerId: LayerId` (required, never null), `displayOverrides: DisplayOverrides`, `sourceKind: 'direct' | 'promoted'`, `sourceProvenance?: { primitiveKind, promotedAt, primitiveId }`; analysis bindings / cost bindings / mesh descriptors separation unchanged; ownership (ADR-003) unchanged; library traceability unchanged.

**ADR-020 Project Sync v2** — replaces ADR-010; preserves project-as-value, operation log, offline behaviour, object-level LWW, CRDT compatibility; `Operation` shape: adds `targetKind`, renames `objectId` → `targetId`, adds `promotionGroupId?` for atomic delete-primitive + create-object on promotion; `TargetSnapshot` union over object/primitive/dimension/layer/grid snapshots.

**ADR-021 2D Rendering Pipeline v2** — replaces ADR-013; keeps Canvas2D + flatten-js + rbush + custom view transform; paint loop dispatches on entity kind (primitive | object | dimension | grid | layer-overlay); snap priority integration surface named (OSNAP → OTRACK → POLAR → GSNAP → grid-line → ORTHO modifier; priority tuning still execution-phase); layer visibility filters rendering (NOT extraction — per ADR-017); `useActiveThemeTokens()` integration unchanged.

**ADR-022 Tool State Machine + Command Bar** — command bar as REPL-ish bottom-UI component with current prompt / sub-option brackets / history scrollback; every tool implemented as a prompt-driven state machine (generator pattern yielding prompts and consuming inputs); keyboard routing (letter keys route to bar when it has focus; canvas shortcuts when canvas has focus; Escape always aborts current tool); focus discipline (canvas, bar, dialog — exactly one has keyboard focus at a time); sub-question flow (bracket options like `[Reference/Copy/Undo]` trigger sub-states); operator shortcut map (the discussed letters: S Select, M Move, C Copy, O Offset, F Fillet, CHA Chamfer, R Rotate, MA Match, E/DEL Erase, U/Ctrl+Z Undo, plus function-key toggles F3 OSNAP, F8 Ortho, F9 GSnap, F10 Polar, F11 OTrack, F12 DynamicInput; STRETCH deferred off `S`); appendix on operator phasing across M1.3a/b/c per §9 of this plan.

**Invariants introduced:**
- I-3: Every new ADR MUST have `Status: ACCEPTED` in its header.
- I-4: Every new ADR's `## Cross-references` section MUST name every other ADR it depends on.
- I-5: ADR-019, 020, 021 MUST each contain `Supersedes:` header naming the original ADR (002, 010, 013 respectively).
- I-6: ADR-016 MUST include the drawn-vs-canonical principle paragraph (required by user conversation).

**Mandatory Completion Gates:**

```
Gate 2.1: All seven new ADR files exist
  Command: ls docs/adr/{016,017,018,019,020,021,022}-*.md | wc -l
  Expected: 7

Gate 2.2: Each new ADR has ACCEPTED status
  Command: rg -c "Status: ACCEPTED" docs/adr/016-*.md docs/adr/017-*.md docs/adr/018-*.md docs/adr/019-*.md docs/adr/020-*.md docs/adr/021-*.md docs/adr/022-*.md
  Expected: 7 files each with ≥1 match

Gate 2.3: Three replacement ADRs have Supersedes headers
  Command: rg -n "Supersedes:" docs/adr/019-*.md docs/adr/020-*.md docs/adr/021-*.md
  Expected: ≥3 matches (one per file)

Gate 2.4: Drawn-vs-canonical principle present in ADR-016
  Command: rg -in "drawn vs canonical|drawn geometry|canonical geometry" docs/adr/016-*.md
  Expected: ≥1 match
```

### Phase 3 — Move superseded ADRs with Status update

**Goal:** Move ADR-002, ADR-010, ADR-013 to `docs/adr/superseded/` with `-superseded` suffix; update their Status line.

**Files affected:**
- `docs/adr/002-object-model.md` → `docs/adr/superseded/002-object-model-superseded.md`
- `docs/adr/010-project-sync.md` → `docs/adr/superseded/010-project-sync-superseded.md`
- `docs/adr/013-2d-rendering-pipeline.md` → `docs/adr/superseded/013-2d-rendering-pipeline-superseded.md`

**Steps:**
1. `git mv docs/adr/002-object-model.md docs/adr/superseded/002-object-model-superseded.md`
2. In the moved file, update the `Status:` header from `ACCEPTED` to `SUPERSEDED`, add `Superseded by: ADR-019 (docs/adr/019-object-model.md)` on the next line. This is a **permitted edit** of a superseded ADR — the rule is "ADRs MUST NOT be edited after acceptance", but marking a superseded ADR is the mechanism the contract itself mandates (00-architecture-contract.md §0.6: "The superseded ADR stays in the repository with `Status: SUPERSEDED` and a link to its replacement.").
3. Repeat steps 1–2 for ADR-010 → ADR-020 and ADR-013 → ADR-021.

**Invariants introduced:**
- I-7: No file named `NNN-*.md` (original path pattern) remains in `docs/adr/` root for superseded IDs.
- I-8: Each superseded file in `docs/adr/superseded/` has `Status: SUPERSEDED` and `Superseded by: ADR-NNN` header lines.

**Mandatory Completion Gates:**

```
Gate 3.1: Original superseded files no longer at root
  Command: ls docs/adr/002-*.md docs/adr/010-*.md docs/adr/013-*.md 2>&1 | rg -c "No such file|cannot access"
  Expected: 3  (each of the three patterns fails to match a file)

Gate 3.2: Superseded files at new location with -superseded suffix
  Command: ls docs/adr/superseded/{002,010,013}-*-superseded.md | wc -l
  Expected: 3

Gate 3.3: Each superseded file marked SUPERSEDED and names a replacement
  Command: rg -l "Status: SUPERSEDED" docs/adr/superseded/
  Expected: ≥3 files listed

Gate 3.4: Each superseded file points to its replacement
  Command: rg -n "Superseded by: ADR-019" docs/adr/superseded/002-* && rg -n "Superseded by: ADR-020" docs/adr/superseded/010-* && rg -n "Superseded by: ADR-021" docs/adr/superseded/013-*
  Expected: ≥1 match per command (three total)
```

### Phase 4 — Update ADR index (README)

**Goal:** Reflect supersession + new ADRs in `docs/adr/README.md`.

**Files affected:**
- `docs/adr/README.md`

**Steps:**
1. Remove rows for 002, 010, 013 from the main "Index" table.
2. Add rows for 016, 017, 018, 019, 020, 021, 022 to the main "Index" table with `Status: ACCEPTED`.
3. Add a new section "Superseded ADRs" at the end of the README listing 002, 010, 013 with their replacement ADR numbers and paths into `superseded/`.

**Invariants:**
- I-9: `docs/adr/README.md` main Index table contains exactly 19 rows (001 + 003–009 + 011–012 + 014–015 + 016–022 = 19), each referencing an ACCEPTED ADR only.
- I-10: Superseded section contains 002, 010, 013 with pointers into `superseded/`.

**Mandatory Completion Gates:**

```
Gate 4.1: New ADRs listed in main index
  Command: rg -n "016-drawing-model|017-layer-model|018-dimension-model|019-object-model|020-project-sync|021-2d-rendering|022-tool-state" docs/adr/README.md
  Expected: ≥7 matches

Gate 4.2: Superseded ADRs no longer in main index (only in superseded section)
  Command: rg -n "\| \[002\]|\| \[010\]|\| \[013\]" docs/adr/README.md
  Expected: matches occur only in the "Superseded" section table (verify by inspection — not grep-decidable)

Gate 4.3: Superseded section references new folder path
  Command: rg -n "superseded/" docs/adr/README.md
  Expected: ≥3 matches (one per superseded ADR)
```

### Phase 5 — Update architecture contracts (Claude + Codex)

**Goal:** Refresh §0.2 binding table in both architecture contracts.

**Files affected:**
- `docs/procedures/Claude/00-architecture-contract.md`
- `docs/procedures/Codex/00-architecture-contract.md`

**Steps per file (same for both):**
1. Remove rows for 002, 010, 013 from the §0.2 ADR binding table.
2. Add rows for 016, 017, 018, 019, 020, 021, 022 with paths to the new `docs/adr/NNN-*.md` files.
3. Add a note below the table: "Superseded ADRs 002 → ADR-019, 010 → ADR-020, 013 → ADR-021. Superseded ADRs have moved to `docs/adr/superseded/` per the supersession discipline adopted 2026-04-23. Superseded ADRs remain in the repository for historical traceability but are not binding."

**Invariants:**
- I-11: §0.2 ADR table in both files contains exactly the same set of ACCEPTED ADR rows (drift between Claude and Codex contracts is a governance bug).

**Mandatory Completion Gates:**

```
Gate 5.1: New ADRs listed in Claude contract
  Command: rg -n "016-drawing-model|017-layer-model|018-dimension-model|019-object-model|020-project-sync|021-2d-rendering|022-tool-state" docs/procedures/Claude/00-architecture-contract.md
  Expected: ≥7 matches

Gate 5.2: New ADRs listed in Codex contract
  Command: rg -n "016-drawing-model|017-layer-model|018-dimension-model|019-object-model|020-project-sync|021-2d-rendering|022-tool-state" docs/procedures/Codex/00-architecture-contract.md
  Expected: ≥7 matches

Gate 5.3: Superseded ADRs no longer listed as binding in Claude contract
  Command: rg -n "002-object-model\.md|010-project-sync\.md|013-2d-rendering" docs/procedures/Claude/00-architecture-contract.md
  Expected: 0 matches (unless referenced in the supersession note; inspection)

Gate 5.4: Superseded ADRs no longer listed as binding in Codex contract
  Command: rg -n "002-object-model\.md|010-project-sync\.md|013-2d-rendering" docs/procedures/Codex/00-architecture-contract.md
  Expected: 0 matches (same caveat)
```

### Phase 6 — Reconcile overview.md

**Goal:** Replace "It is not a drawing tool" framing with CAD-adjacent posture statement per ADR-016.

**Files affected:**
- `docs/overview.md`

**Steps:**
1. Edit the "What this platform is" section.
2. Remove `It is not a drawing tool. It is not a simulator. It is not a costing spreadsheet. Those tools already exist. This platform closes the loop between them.`
3. Replace with: `It is CAD-adjacent — users draft in primitives (point, line, polyline, rectangle, circle, arc, xline) organised by layer, annotate with dimensions, then classify drafts into typed port-yard objects at the moment of intent (see ADR-016). It is not a simulator. It is not a costing spreadsheet. Those tools already exist. This platform's differentiator is not the drafting surface — it is closing the loop from draft → classify → extract → validate → commercial output with drafting ergonomics port planners already know.`

**Invariants:**
- I-12: Overview MUST NOT contain the phrase "not a drawing tool" after reconciliation.
- I-13: Overview MUST name "CAD-adjacent" or equivalent posture language.

**Mandatory Completion Gates:**

```
Gate 6.1: Old framing removed
  Command: rg -n "not a drawing tool" docs/overview.md
  Expected: 0 matches

Gate 6.2: New CAD-adjacent framing present
  Command: rg -n "CAD-adjacent" docs/overview.md
  Expected: ≥1 match

Gate 6.3: ADR-016 cited for context
  Command: rg -n "ADR-016" docs/overview.md
  Expected: ≥1 match
```

### Phase 7 — Reconcile execution-plan.md

**Goal:** Replace flat M1 framing with the sub-milestone structure per the pivot.

**Files affected:**
- `docs/execution-plan.md`

**Steps:**
1. Revise Milestone 1 section to name M1.3a/b/c and M1.4 sub-milestones.
2. Cite ADR-016 as the authority for the restructure.
3. Preserve exit criteria spirit: the commercial-loop closure is now M1.4's exit criterion.

Proposed text replaces existing M1 "In scope" list with:

```
### Sub-milestones (revised 2026-04-23 by ADR-016)

- M1.1 — Foundation ✅
- M1.2 — Project Model ✅
- M1.3a — Hybrid Drafting Surface: canvas (packages/editor-2d), view transform, seven primitive types (point, line, polyline, rectangle, circle, arc, xline), layer data model (ADR-017), grid entity (ADR-016), essential operators (Select, Erase, Move, Copy, Undo/Redo, Zoom, Pan, Properties, Escape; F-key toggles F3/F8/F9/F10/F11/F12), basic OSNAP (grid/endpoint/midpoint/intersection), ortho modifier, coord system UI carry-over, command bar per ADR-022.
- M1.3b — Promotion + First Typed Object: promotion contract, Path A unified pipeline, constructors registry surface, sourceKind/sourceProvenance, RTG_BLOCK as first typed object, re-align operation per drawn-vs-canonical principle, core modify operators (Rotate, Mirror, Scale, Offset, Fillet, Chamfer, Trim, Extend, Join, Explode, Break, Array, Match).
- M1.3c — Dimensions + Richer Snap: dimension entity (ADR-018), seven dimension kinds, associative updates, POLAR, remaining OSNAP modes, OTRACK.
- M1.4 — Extraction + Validation + Capacity Panel (closes the commercial loop): RTG_BLOCK extractor, three validation rules (BLOCK_LENGTH_MAX, BLOCK_LENGTH_MIN, TRUCK_LANE_MIN_WIDTH), yard capacity summary panel, save/reload deterministic extraction verification.
```

**Invariants:**
- I-14: Execution plan MUST NOT contain "RTG_BLOCK as the only drawable object type" as a current-scope statement (historical mention in explanation is acceptable).
- I-15: Execution plan MUST cite ADR-016 for the restructure.

**Mandatory Completion Gates:**

```
Gate 7.1: Restructure cites ADR-016
  Command: rg -n "ADR-016" docs/execution-plan.md
  Expected: ≥1 match

Gate 7.2: Sub-milestone names present
  Command: rg -n "M1\.3a|M1\.3b|M1\.3c|M1\.4" docs/execution-plan.md
  Expected: ≥4 matches
```

### Phase 8 — Update registry README

**Goal:** Add `## Constructors` governance to the registry README entry format and entries-supersession note.

**Files affected:**
- `docs/extraction-registry/README.md`

**Steps:**
1. In the "Entry format" section, add a `## Constructors` section to the template.
2. Add a new subsection "Constructors governance" describing: accepted primitive kind(s), shape preconditions, parameters collected by promotion dialog, primitive → object geometry mapping must be lossless, adding a constructor = minor bump, changing accepted kind/precondition/params = major bump, removing = major bump, invalid promotion = silent absence in context menu.
3. Add a note: "Individual entries (RTG_BLOCK.md, ROAD.md, etc.) gain their `## Constructors` sections when the relevant milestone implements promotion for that object type. Entries whose content changes at that time are superseded and rewritten per the `docs/extraction-registry/superseded/` supersession pattern."

**Invariants:**
- I-16: Registry README `## Entry format` MUST include `## Constructors` in the template.
- I-17: Constructors governance subsection present with version-bump rules.

**Mandatory Completion Gates:**

```
Gate 8.1: Constructors section in entry format
  Command: rg -n "## Constructors" docs/extraction-registry/README.md
  Expected: ≥1 match

Gate 8.2: Constructors governance subsection present
  Command: rg -n "constructors governance|Adding a new constructor|Changing an existing constructor|Removing a constructor" docs/extraction-registry/README.md
  Expected: ≥3 matches (bullet cases)

Gate 8.3: Supersession pattern referenced for entries
  Command: rg -n "superseded/|supersession" docs/extraction-registry/README.md
  Expected: ≥1 match
```

## 9. Invariants summary

Consolidated list of invariants introduced across Phases 1–8 with their enforcement:

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| I-1 | Filenames in `docs/adr/superseded/` end with `-superseded.md` | Gate 3.2 + periodic grep |
| I-2 | Files in `docs/adr/superseded/` have `Status: SUPERSEDED` header | Gate 3.3 |
| I-3 | Each new ADR has `Status: ACCEPTED` | Gate 2.2 |
| I-4 | Each new ADR's Cross-references names dependent ADRs | Inspection in review |
| I-5 | ADR-019/020/021 have `Supersedes:` header | Gate 2.3 |
| I-6 | ADR-016 contains drawn-vs-canonical principle | Gate 2.4 |
| I-7 | No original-path files for superseded IDs remain at `docs/adr/` root | Gate 3.1 |
| I-8 | Superseded files name their replacement ADR in header | Gate 3.4 |
| I-9 | Main Index table in `docs/adr/README.md` contains only ACCEPTED ADRs | Gates 4.1 + 4.2 |
| I-10 | Superseded section in `docs/adr/README.md` lists all superseded ADRs | Gate 4.3 |
| I-11 | §0.2 ADR tables in Claude + Codex contracts match | Gates 5.1–5.4 |
| I-12 | Overview.md does not contain "not a drawing tool" | Gate 6.1 |
| I-13 | Overview.md names CAD-adjacent posture | Gate 6.2 |
| I-14 | Execution plan does not assert "RTG_BLOCK as the only drawable object type" as current scope | Gate 7.2 (via absence inspection) |
| I-15 | Execution plan cites ADR-016 for restructure | Gate 7.1 |
| I-16 | Registry README entry format includes `## Constructors` | Gate 8.1 |
| I-17 | Registry README has constructors governance subsection | Gate 8.2 |

## 10. Test strategy

No automated tests — this PR is documentation-only. Verification is entirely through the command-based phase gates in §8 and the Done Criteria checklist in §11.

## 11. Done Criteria — objective pass/fail

All gates in Phases 1–8 pass, plus:

- [ ] `docs/plans/arch/drawing-model-pivot.md` exists and is committed.
- [ ] `docs/adr/superseded/` and `docs/extraction-registry/superseded/` directories exist with README files.
- [ ] All seven new ADRs present (016–022) with `Status: ACCEPTED`.
- [ ] Three superseded ADRs moved to `docs/adr/superseded/` with `-superseded` suffix and `Status: SUPERSEDED` + `Superseded by:` headers.
- [ ] `docs/adr/README.md` main Index lists only ACCEPTED ADRs (19 rows); separate Superseded section lists the three moved ADRs.
- [ ] Both architecture contracts (Claude + Codex) §0.2 binding tables refreshed (no 002/010/013, includes 016–022); supersession note appended.
- [ ] `docs/overview.md` reconciled — CAD-adjacent posture, no "not a drawing tool".
- [ ] `docs/execution-plan.md` reconciled — M1 sub-milestones M1.3a/b/c + M1.4.
- [ ] `docs/extraction-registry/README.md` has `## Constructors` governance.
- [ ] No `docs/handovers/` directory created.
- [ ] No code changes (verify with `git diff --stat` showing zero changes under `packages/`, `apps/`, `services/`).
- [ ] Drawn-vs-canonical principle paragraph is present in ADR-016.
- [ ] ADR-022 operator shortcut map reflects all user-approved shortcuts: S Select, M Move, C Copy, O Offset, F Fillet, CHA Chamfer, R Rotate, MA Match, E/DEL Erase.

## 12. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Stale cross-references in non-superseded ADRs (ADR-008, 014 cite ADR-002) | Standard ADR chain — readers follow SUPERSEDED pointers. Editing other ADRs to fix refs is forbidden by §0.6 (ADR immutability). |
| Seven ADRs is a lot for one PR | All cohere around one pivot. Alternative (split across multiple PRs) creates review-order dependencies worse than the bundle. |
| `superseded/` subfolder pattern is new and not yet in the architecture contract | The contract says "stays in the repository with Status: SUPERSEDED" — no folder constraint. The pattern formalizes a visual separation. Folder READMEs document it. |
| Registry entries not superseded in this PR but will need the pattern later | Plan explicitly documents the pattern in Phase 8 and the entries-supersession note. M1.3b plan inherits this. |
| Codex Round 1 review may flag items we miss | The plan addresses the exact blockers Codex pre-flagged (overview contradiction, execution-plan framing, operation-shape precision, registry governance, binding table sync). Residual findings accepted as part of normal review. |
| Operator shortcut `S` for Select blocks STRETCH | Explicitly accepted per user preference. STRETCH gets a different shortcut (TBD in ADR-022 appendix, non-blocking for M1). |
| ADR-022 is large and partly forward-looking (operator implementations M1.3a/b/c) | ADR-022 pins the framework (state machine + command bar), not per-operator implementations. Those are execution-phase artifacts. |

---

## Plan Review Handoff

**Plan:** `docs/plans/arch/drawing-model-pivot.md`
**Branch:** `arch/drawing-model-pivot`
**Status:** Plan authored — awaiting review

### Paste to Codex for plan review
> Review this plan using the protocol at
> `docs/procedures/Codex/02-plan-review.md` (Procedure 02).
> Apply strict evidence mode. Start from Round 1.

### Paste to user for approval
> Please review the plan at `docs/plans/arch/drawing-model-pivot.md` on branch `arch/drawing-model-pivot`. After approval, invoke Procedure 03 to begin execution of Phase 1 (scaffold supersession directories) through Phase 8 (registry README).
