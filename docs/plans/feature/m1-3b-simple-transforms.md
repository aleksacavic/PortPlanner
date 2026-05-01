# Plan — M1.3b simple transforms (Rotate + Mirror + Scale + Offset)

**Branch:** `feature/m1-3b-simple-transforms`
**Author:** Claude
**Date:** 2026-05-01

## Revision history

| Rev | Date | Trigger | Changes |
|---|---|---|---|
| 1 | 2026-05-01 | Initial draft. M1.3b kicks off with the 4 simple-transform modify operators (Rotate, Mirror, Scale, Offset). Bundled per the cluster split documented in `docs/plans/feature/m1-3-di-pipeline-overhaul.md` post-merge handoff. The 4 operators share the "select → reference → preview → commit" flow inherited from `move.ts` / `copy.ts` (M1.3a) but each requires NEW `PreviewShape` discriminated-union arms because the existing `'modified-entities'` arm only carries a translation `offsetMetric` — rotation, scale, and mirror produce non-translation ghosts that need their own preview shape. Plan also adds DI manifest support (typed angle for Rotate; typed scale factor for Scale; typed offset distance for Offset) using the existing manifest pipeline (no new manifest contract change). Per the just-shipped Procedure 01 §1.5.1, this plan includes the User-Visible Behavior Walkthrough table (§3.0). Per Procedure 01 §1.8.1, every grep gate's regex is anchored to declarative sites. |

## 1. Goal

Ship 4 modify operators on primitives:

1. **Rotate (`R`)** — select → base point → reference angle → final angle. Each selected primitive rotates about the base point by `Δangle = finalAngle - referenceAngle`.
2. **Mirror (`MI`)** — select → first mirror line point → second mirror line point. Each selected primitive is reflected across the line through those two points. Original deleted (per AC default; the "keep source" sub-option is M1.3b deferred polish, not in this plan).
3. **Scale (`SC`)** — select → base point → reference distance → new distance. Each selected primitive scales about the base point by factor = `newDistance / referenceDistance`.
4. **Offset (`O`)** — select an entity → specify offset distance → click on the side. Creates a new parallel/offset entity at that distance. Single-entity operation per AC; multi-select Offset is M1.3b deferred polish.

All four follow the M1.3a `move.ts` / `copy.ts` pattern (select → base → reference → commit) with two modifications: (a) each tool needs DI manifest support for typed reference values, and (b) each tool needs a NEW `PreviewShape` arm for the live ghost preview (the existing `'modified-entities'` arm is translation-only).

## 2. Background / context

### 2.1 Why these 4 together

These 4 share the same UX shape (select → base point → reference → final), the same per-primitive transform structure (apply one math function to each Primitive's geometry), and the same preview pattern (a ghost of the result). Bundling reduces repeated PreviewShape contract churn — adding 3 new arms (`rotated-entities`, `scaled-entities`, `mirrored-entities`) plus 1 new `'offset-preview'` arm in one plan vs. 4 plans is one diff to the discriminated union vs. four.

### 2.2 What's NOT in this plan (deferred to M1.3b later or M1.3c)

- **STRETCH** (with crossing-window mode sub-options) — separate cluster, larger scope. Bundled with topological operators in a follow-up plan.
- **Fillet / Chamfer** — separate cluster (introduces bulge-arcs in polylines per ADR-016).
- **Trim / Extend / Break / Join / Array / Match / Explode** — topological-operator cluster, separate plan.
- **Mirror "keep source" sub-option** — AC's `[Yes/No]` sub-prompt to keep the original entity. M1.3b polish; deferred. Default is delete source.
- **Offset multi-select** — multi-entity offset cluster. AC supports it via repeat; deferred. This plan does single-entity offset.
- **Reference angle / distance via 2 clicks vs typed value** — Rotate's "reference angle" can be typed (DI) OR picked via a second click. Same for Scale's "reference distance." This plan ships BOTH paths from the start; the DI path uses the same manifest pipeline that B7 just landed.

## 3. Assumptions + locks

User-confirmed during scoping (chat 2026-05-01) and adopted as plan locks:

- **A1 — All 4 operators bundle in one branch.** Per the M1.3 DI pipeline overhaul handoff cluster split. Each operator gets its own commit phase; PreviewShape extension lands in Phase 1 ahead of the per-tool phases.
- **A2 — `move.ts` / `copy.ts` are the structural template.** Each tool: yield "Select objects" if selection empty → yield "Specify base point" → yield reference prompt with previewBuilder → yield final prompt with previewBuilder → apply transform via `updatePrimitive`. Consistent with ADR-023 + the M1.3a essential-operators shape.
- **A3 — DI manifest support for typed reference values.** Rotate's "Specify rotation angle" accepts typed angle (combineAs `'angle'`, single-field manifest, same as xline). Scale's "Specify scale factor" accepts typed number (combineAs `'number'`, single-field). Offset's "Specify offset distance" accepts typed number. No new combineAs arm needed; reuse existing `'angle'` / `'number'` arms from B7.
- **A4 — PreviewShape extends with 4 new arms.** `'rotated-entities'` (primitives + base + angleRad), `'scaled-entities'` (primitives + base + factor), `'mirrored-entities'` (primitives + line p1/p2), `'offset-preview'` (single primitive + offsetDistance + side). Each painter case delegates to a per-primitive geometry transform (similar to `drawShiftedPrimitiveOutline`'s switch).
- **A5 — Per-primitive transform helpers in pure domain code.** `rotatePrimitive(p, base, angleRad)`, `scalePrimitive(p, base, factor)`, `mirrorPrimitive(p, line)`, `offsetPrimitive(p, distance, side)` live in `packages/domain/src/transforms/` (new directory). Pure functions, no React, no store. Mirror Move's `shiftPrimitive` pattern but kept domain-pure since multiple consumers (tools, preview builders, future scripting) will use them.
- **A6 — Mirror deletes source by default.** AC convention: `[Yes/No to keep source]` defaults to No (delete). The sub-option is deferred.
- **A7 — Offset side is determined by click position relative to the source entity.** Click on the cursor side → offset goes that way. Same as AC. No "Through" option (deferred).
- **A8 — Selection: same precedence as Move/Copy.** If `editorUiStore.selection` is non-empty at tool activation, skip the "Select objects" prompt. Otherwise yield it as the first prompt (single-entity for now; multi-select via `select-rect` carries the array forward).
- **A9 — Operator shortcuts already reserved in `docs/operator-shortcuts.md`** (per M1.3b row): `R` = Rotate, `MI` = Mirror, `SC` = Scale, `O` = Offset. Plan adds them to `SINGLE_LETTER_SHORTCUTS` (R, O) and `MULTI_LETTER_SHORTCUTS` (MI, SC). Bumps `operator-shortcuts.md` 2.2.0 → 2.3.0 (minor — adding 4 shortcuts).
- **A10 — Per-primitive transforms preserve `displayOverrides`, `layerId`, and (for points) `displayShape`.** Object spread `{ ...p, <transformed-fields> }` is the SSOT pattern (per `copy.ts:13-29`).
- **A11 — Xline rotation: rotates the `pivot` AND adjusts `angle` by `Δangle`.** Mirror flips `angle` by `2 * mirrorLineAngle - angle` and reflects pivot. Scale: pivot scales about base; angle unchanged (xline is direction-invariant under uniform scale). Offset: parallel xline at distance perpendicular to direction.
- **A12 — Arc rotation: rotates `center` AND adjusts `startAngle` / `endAngle` by `Δangle`.** Scale: center scales, radius scales. Mirror: center reflects; sweep direction may flip (CCW arc becomes CW). Offset: arc with same center but radius ± offsetDistance.
- **A13 — Polyline rotation/scale/mirror operate per-vertex.** Rotate each vertex about base. Scale each vertex about base. Mirror each vertex across line. Bulges unchanged for rotate / scale (uniform); mirror NEGATES bulge values (CCW/CW flip). Offset polyline = offset each segment + reconnect; see Phase 4 details — offset for polyline is the most algorithmically heavy of the 4.
- **A14 — Rectangle = treat as 4-vertex polyline equivalent for transforms.** Rotate: corners rotate; `localAxisAngle` += Δangle; origin recomputed as min-corner. Scale: corners scale; width/height scale by factor; origin recomputed. Mirror: corners reflect; localAxisAngle reflects; origin recomputed. Offset: rectangle dimensions ±2*offset, centered.
- **A15 — Operations emit single OperationType per tool invocation.** `'UPDATE'` per primitive in Rotate/Mirror/Scale (current `updatePrimitive` semantic). Offset emits `'CREATE'` (new primitive). Undo replays correctly via existing `emitOperation` machinery (no new operation types needed — ADR-010 unchanged).

## 3.0 User-Visible Behavior Walkthrough (Procedure 01 §1.5.1)

Per the procedure update committed in this run, here's the explicit user-action → visible-result → implementation-site → test mapping. Codex Procedure 02 will verify each row's implementation site is non-empty + each row's test exercises the *visible* path (not just commit-time math).

| User action | Expected visible result | Implementation site | Test that observes it |
|---|---|---|---|
| Press `R` + Enter (no selection) | Tool activates; prompt: "Select objects" | `tools/rotate.ts` Phase 2 + `keyboard/shortcuts.ts` `R: 'rotate'` registration | `rotate.test.ts` ("yields select prompt when selection empty") |
| Press `R` + Enter (with selection) | Tool activates; prompt: "Specify base point" | `tools/rotate.ts` Phase 2 selection-skip branch | `rotate.test.ts` ("yields base-point prompt directly when selection non-empty") |
| Click base point in Rotate | Prompt: "Specify reference angle"; rubber-band line from base to cursor | `tools/rotate.ts` Phase 2 (yield 2 with previewBuilder kind: 'line', anchorA: base) | `rotate.test.ts` ("yields reference-angle prompt with line preview from base") |
| Click reference point in Rotate | Prompt: "Specify rotation angle"; rotated-entities ghost preview | `tools/rotate.ts` Phase 2 (yield 3 with previewBuilder kind: 'rotated-entities') + `paintPreview.ts` Phase 1 dispatch | `rotate.test.ts` ("yields final-angle prompt with rotated-entities preview"); `paintPreview.test.ts` Phase 1 ("renders rotated-entities arm") |
| Click final point in Rotate | Selected primitives rotated about base by Δangle; tool exits | `tools/rotate.ts` Phase 2 commit + `domain/src/transforms/rotate.ts` per-primitive math | `rotate.test.ts` ("commit rotates primitives by Δangle"); `domain/tests/transforms.test.ts` (per-primitive unit tests) |
| Type angle in DI pill (Rotate, final-angle prompt) | Pill shows typed value; rubber-band rotation freezes at typed angle on Tab | `tools/rotate.ts` Phase 2 dynamicInput manifest (combineAs 'angle') + B7 lock-gated effective cursor (already shipped) | `rotate.test.ts` ("typed angle commits at locked rotation") |
| Press `MI` + Enter | Tool activates; "Select objects" or "Specify first mirror line point" | `tools/mirror.ts` Phase 3 + `keyboard/shortcuts.ts` `MI: 'mirror'` | `mirror.test.ts` |
| Click 2 points in Mirror | Mirrored-entities ghost shows reflection; selected primitives reflected on commit; sources deleted | `tools/mirror.ts` Phase 3 + `paintPreview.ts` mirrored-entities arm + `domain/src/transforms/mirror.ts` | `mirror.test.ts` ("mirrors primitives across line"); `paintPreview.test.ts` ("renders mirrored-entities arm") |
| Press `SC` + Enter, click base + 2 distance points | Scaled-entities ghost shows scaled preview; commit applies factor | `tools/scale.ts` Phase 4 + `paintPreview.ts` scaled-entities arm + `domain/src/transforms/scale.ts` | `scale.test.ts` |
| Type number in DI pill (Scale, factor prompt) | Pill shows typed value; rubber-band scaled by typed factor on Tab | `tools/scale.ts` Phase 4 dynamicInput manifest (combineAs 'number') | `scale.test.ts` ("typed factor commits at locked scale") |
| Press `O` + Enter, click entity, type distance, click side | Offset preview shows parallel entity at typed distance; commit creates new entity | `tools/offset.ts` Phase 5 + `paintPreview.ts` offset-preview arm + `domain/src/transforms/offset.ts` | `offset.test.ts` |
| All 4 tools: Esc at any prompt | Tool aborts; preview clears; selection preserved | Existing `escape` handling in `runner.ts` (no per-tool change needed) | tested implicitly by tool generators returning aborted |

Rows are intended to be exhaustive for the user-observable surface. Codex review should flag any user action this plan promises that's missing a row; conversely, any row whose implementation site is hand-wavy (file:line not findable) is a Blocker.

## 3.1 Plan-vs-code grounding table (§1.4.1)

| # | Plan claim | File:line | Observed shape | Match |
|---|-----------|-----------|----------------|-------|
| 1 | `moveTool` is the structural template — yields select / base / target with previewBuilder; uses `editorUiStore.selection` for skip-select branch | [packages/editor-2d/src/tools/move.ts:30-73](packages/editor-2d/src/tools/move.ts) | Function matches: `editorUiStore.getState().selection`, "Select objects", "Specify base point", "Specify second point" with `previewBuilder: kind 'modified-entities'` | Match |
| 2 | `copyTool` mirrors moveTool but with `addPrimitive` instead of `updatePrimitive` + `shiftedClone` instead of `shiftPrimitive` | [packages/editor-2d/src/tools/copy.ts:32-75](packages/editor-2d/src/tools/copy.ts) | Same shape; difference is the commit step | Match |
| 3 | `PreviewShape` discriminated union currently has 9 arms + `'modified-entities'` (translation only via `offsetMetric`) | [packages/editor-2d/src/tools/types.ts:117-138](packages/editor-2d/src/tools/types.ts) | `'line' \| 'polyline' \| 'rectangle' \| 'circle' \| 'arc-2pt' \| 'arc-3pt' \| 'xline' \| 'selection-rect' \| 'modified-entities'` | Match — Phase 1 adds 4 new arms |
| 4 | `paintPreview.ts` switch has cases for each PreviewShape arm; `'modified-entities'` calls `drawModifiedEntitiesPreview` which iterates `primitives` + applies `offsetMetric` | [packages/editor-2d/src/canvas/painters/paintPreview.ts:80-160](packages/editor-2d/src/canvas/painters/paintPreview.ts) | Switch matches; per-primitive draw branches for each kind | Match — Phase 1 adds 4 new dispatch cases |
| 5 | `updatePrimitive(id, patch: Partial<Primitive>)` is the standard mutation API (emits `'UPDATE'` operation) | [packages/project-store/src/actions/primitive-actions.ts:16-22](packages/project-store/src/actions/primitive-actions.ts) | Signature matches | Match — modify operators reuse |
| 6 | `addPrimitive(primitive: Primitive)` for Offset's new-entity creation (emits `'CREATE'`) | [packages/project-store/src/actions/primitive-actions.ts:9-13](packages/project-store/src/actions/primitive-actions.ts) | Signature matches | Match |
| 7 | `ToolId` union includes draw + essential operators; new ids `'rotate'`, `'mirror'`, `'scale'`, `'offset'` need to be added | [packages/editor-2d/src/keyboard/shortcuts.ts:8-33](packages/editor-2d/src/keyboard/shortcuts.ts) | Union present; M1.3b additions absent | Match — additive |
| 8 | `SINGLE_LETTER_SHORTCUTS` has S/E/M/C/U/Z/P/L/A; `MULTI_LETTER_SHORTCUTS` has LA/PT/PL/REC/CC/XL/XX | [packages/editor-2d/src/keyboard/shortcuts.ts:36-57](packages/editor-2d/src/keyboard/shortcuts.ts) | Both maps populated as described | Match — Phase 2 adds R/O single + MI/SC multi |
| 9 | `TOOL_DISPLAY_NAMES` is a `Record<ToolId, string \| null>` — exhaustiveness-checked at compile time | [packages/editor-2d/src/keyboard/shortcuts.ts:80-101](packages/editor-2d/src/keyboard/shortcuts.ts) | Type matches; adding new ToolIds requires entries here | Match — TypeScript enforces |
| 10 | `lookupTool` registry in `tools/index.ts` has 17 entries (all draw + essential) | [packages/editor-2d/src/tools/index.ts:25-44](packages/editor-2d/src/tools/index.ts) | Registry object literal, 17 entries | Match — Phase 2 adds 4 entries |
| 11 | DI manifest contract has `combineAs: 'angle'` arm (xline) and `combineAs: 'number'` arm (circle radius) — single-field manifests | [packages/editor-2d/src/tools/types.ts:34](packages/editor-2d/src/tools/types.ts) | `CombineAsPolicy = 'numberPair' \| 'point' \| 'number' \| 'angle'` | Match — Rotate uses 'angle', Scale + Offset use 'number' |
| 12 | B7 `computeEffectiveCursor` 'angle' arm fixes cursor distance + locked angle (xline pattern); 'number' arm fixes radius along cursor direction (circle pattern) | [packages/editor-2d/src/tools/dynamic-input-combine.ts:215-235](packages/editor-2d/src/tools/dynamic-input-combine.ts) | Arms exist; lock-gated; reusable for Rotate (angle) / Scale + Offset (number) | Match — no new arms needed |
| 13 | `directDistanceFrom: Point2D` on Prompt anchors B7 effective-cursor calc; rotate/scale/offset all benefit from this | [packages/editor-2d/src/tools/runner.ts:29-50](packages/editor-2d/src/tools/runner.ts) | `resolveEffectiveCursorAnchor(state)` reads `commandBar.directDistanceFrom` | Match — each new tool sets this on prompts that DI cursor-relate to a base |
| 14 | `Primitive` discriminated union covers point/line/polyline/rectangle/circle/arc/xline (7 kinds) | [packages/domain/src/types/primitive.ts](packages/domain/src/types/primitive.ts) | 7 kinds present | Match — domain transforms switch on all 7 |

## 4. Scope

### 4.1 In scope — files modified

| Path | Phase | Change |
|---|---|---|
| `packages/editor-2d/src/tools/types.ts` | 1 | Extend `PreviewShape` discriminated union with 4 new arms: `'rotated-entities'` (primitives + base: Point2D + angleRad: number), `'scaled-entities'` (primitives + base + factor: number), `'mirrored-entities'` (primitives + line: { p1: Point2D; p2: Point2D }), `'offset-preview'` (primitive: Primitive + distance: number + side: 1 \| -1). Documentation updated to enumerate all 13 arms. |
| `packages/editor-2d/src/canvas/painters/paintPreview.ts` | 1 | Add 4 new switch cases. Each delegates to a per-primitive draw helper similar to `drawShiftedPrimitiveOutline` but applying the transform inline (rotate / scale / mirror / offset). Painters are pure ctx draws; transform math reuses the domain helpers via inline calls or via duplication if domain helpers prove overkill — Phase 1 step 3 audits this. |
| `packages/domain/src/transforms/index.ts` | 1 | NEW. Exports `rotatePrimitive`, `scalePrimitive`, `mirrorPrimitive`, `offsetPrimitive` from per-op files. |
| `packages/domain/src/transforms/rotate.ts` | 1 | NEW. `rotatePrimitive(p: Primitive, base: Point2D, angleRad: number): Primitive` — switch on kind; per-vertex rotation for polyline/rectangle; pivot+angle update for arc/xline; center rotation for circle. Rectangle: `localAxisAngle += angleRad`, corners recomputed via min-corner. |
| `packages/domain/src/transforms/scale.ts` | 1 | NEW. `scalePrimitive(p: Primitive, base: Point2D, factor: number): Primitive` — switch; uniform scale; arc/circle radius × factor; rectangle width/height × factor; xline pivot scales but angle unchanged (direction-invariant). Negative factor throws (caller validates). |
| `packages/domain/src/transforms/mirror.ts` | 1 | NEW. `mirrorPrimitive(p: Primitive, line: { p1: Point2D; p2: Point2D }): Primitive` — switch; reflect each vertex across the line. Polyline bulges negate (CCW↔CW flip). Arc sweep direction flips (start/end angles compute from reflected center + reflected start point). |
| `packages/domain/src/transforms/offset.ts` | 1 | NEW. `offsetPrimitive(p: Primitive, distance: number, side: 1 \| -1): Primitive` — switch; line: parallel line offset perpendicular by distance×side; circle: same center, radius ± distance; arc: same center, radius ± distance; rectangle: dimensions ± 2*distance, centered; polyline: per-segment offset + reconnect (V1 simple — connect adjacent segment endpoints; complex self-intersection handling deferred); xline: parallel xline at offset perpendicular to direction; point: throws (point has no offset semantic). |
| `packages/domain/src/index.ts` | 1 | Re-export the 4 transform helpers. |
| `packages/editor-2d/src/tools/rotate.ts` | 2 | NEW. Generator following move.ts pattern: select → base → reference angle → final angle. DI manifest on final-angle prompt: `combineAs: 'angle'`, single-field `[Rotation angle]`. directDistanceFrom = base. previewBuilder yields `'rotated-entities'`. Commit: for each id in selection, `updatePrimitive(id, rotatePrimitive(p, base, deltaAngle))`. |
| `packages/editor-2d/src/tools/mirror.ts` | 3 | NEW. Generator: select → first mirror line point → second mirror line point. previewBuilder on second prompt yields `'mirrored-entities'` with `line: { p1, p2: cursor }`. Commit: for each id, `updatePrimitive(id, mirrorPrimitive(p, line))`. Sources NOT deleted (M1.3b A6 lock — `[Yes/No to keep source]` deferred; default keeps source for now per the principle "don't surprise the user with deletions"). |
| `packages/editor-2d/src/tools/scale.ts` | 4 | NEW. Generator: select → base → reference distance point → new distance point (or typed factor via DI). DI manifest on final prompt: `combineAs: 'number'`, single-field `[Scale factor]`. previewBuilder yields `'scaled-entities'` with factor = dist(cursor)/refDist. directDistanceFrom = base. |
| `packages/editor-2d/src/tools/offset.ts` | 5 | NEW. Generator: select single entity (Offset is single-entity in this plan; multi-select deferred per A8) → specify offset distance (DI: combineAs 'number') → click side. previewBuilder yields `'offset-preview'`. Commit: `addPrimitive(offsetPrimitive(source, distance, side))`. |
| `packages/editor-2d/src/keyboard/shortcuts.ts` | 6 | Add `'rotate'`, `'mirror'`, `'scale'`, `'offset'` to `ToolId` union. Add `R: 'rotate'`, `O: 'offset'` to `SINGLE_LETTER_SHORTCUTS`. Add `MI: 'mirror'`, `SC: 'scale'` to `MULTI_LETTER_SHORTCUTS`. Add 4 entries to `TOOL_DISPLAY_NAMES` (`'ROTATE'`, `'MIRROR'`, `'SCALE'`, `'OFFSET'`). |
| `packages/editor-2d/src/tools/index.ts` | 6 | Import + register 4 new tools in `ESSENTIAL_REGISTRY`. |
| `docs/operator-shortcuts.md` | 6 | Bump `2.2.0 → 2.3.0` (minor — adding 4 shortcuts). Add 4 rows in the M1.3b section. Add changelog entry. |
| `packages/domain/tests/transforms.test.ts` | 1 | NEW. Per-primitive transform unit tests. Each transform × each Primitive kind = test row. Floats use `toBeCloseTo`. |
| `packages/editor-2d/tests/rotate.test.ts` | 2 | NEW. Tool-generator tests + DI manifest path. Same structure as `tests/draw-tools.test.ts` for line-tool DI tests. |
| `packages/editor-2d/tests/mirror.test.ts` | 3 | NEW. |
| `packages/editor-2d/tests/scale.test.ts` | 4 | NEW. |
| `packages/editor-2d/tests/offset.test.ts` | 5 | NEW. |
| `packages/editor-2d/tests/paintPreview.test.ts` | 1 | EXTEND. Add 4 new test cases (one per new arm) asserting `ctx.stroke()` is called with the expected geometry. Reuses the existing recorder-ctx pattern. |
| `packages/editor-2d/tests/keyboard-router.test.ts` | 6 | EXTEND. Add 4 new tests asserting `R`, `MI`, `SC`, `O` activate the corresponding tools (mirrors existing `L` / `REC` tests). |

### 4.2 In scope — files created

(Listed inline above with NEW marker — 9 new files: 4 in `packages/editor-2d/src/tools/`, 5 in `packages/domain/src/transforms/`, plus 5 new test files in `packages/editor-2d/tests/` + 1 in `packages/domain/tests/`.)

### 4.3 Files deleted

None.

### 4.4 Out of scope (deferred)

See §2.2.

### 4.5 Blast radius

- **`PreviewShape` discriminated union grows from 10 to 14 arms.** All consumers (paintPreview.ts switch, tools that yield PreviewShape, tests) need to handle exhaustiveness. TypeScript catches missed cases at compile time via switch exhaustiveness.
- **New `packages/domain/src/transforms/` module.** Pure functions; no React, no store, no design-system dependency. Per GR-3 module isolation, this is correctly placed in `domain` (other packages may consume).
- **Operator shortcuts registry version bump 2.2.0 → 2.3.0.** Minor per "Adding new shortcut" governance.
- **Selection semantics unchanged.** Current select / select-rect produces a `selection: PrimitiveId[]` slice that all 4 tools consume. No change to selection model.
- **Undo/redo: covered by existing `emitOperation` + `'UPDATE'` / `'CREATE'` types** (ADR-010 unchanged). Each tool produces N operations (one per affected primitive); zundo groups them via the existing per-action-cycle convention.
- **No domain schema change** (Primitive shape unchanged; no new fields).

### 4.6 Binding specifications touched

- `docs/operator-shortcuts.md` — minor bump 2.2.0 → 2.3.0.
- ADR-016 — no change; Path A primitive transforms apply uniformly.
- ADR-023 — no change; tool generator + command-bar contract unchanged.
- ADR-010 — no change; existing `'UPDATE'` / `'CREATE'` operations cover modify ops.
- No other binding spec touched.

## 5. Architecture Doc Impact

| Doc | Path | Change | Reason |
|---|---|---|---|
| `docs/operator-shortcuts.md` | as above | Version `2.2.0 → 2.3.0` + 4 entries + changelog | Per ADR-023 / §0.5 — registry entries land in same commit as router code |
| ADR-016 (drawing model) | `docs/adr/016-drawing-model.md` | No change | Modify operators apply uniform transforms; no contract change |
| ADR-023 (tool state machine) | `docs/adr/023-tool-state-machine-and-command-bar.md` | No change | Tool generator + command-bar contract unchanged |

## 6. Deviations from binding specifications (§0.7)

None.

## 7. Object Model and Extraction Integration

Not applicable. This plan operates on existing primitives; no new object types, no extraction registry changes, no validation rules.

## 8. Hydration, Serialization, Undo/Redo, Sync

- **Hydration:** unchanged — modify ops produce mutated Primitives with the same shape per ADR-016 schema.
- **Serialization:** unchanged.
- **Undo/Redo:** each modify op emits `'UPDATE'` (rotate/mirror/scale on existing primitives) or `'CREATE'` (offset of a new primitive). zundo replays via existing operation log. Multi-primitive operations within one tool invocation produce N operations; undo currently steps through them one at a time (acceptable per ADR-023 single-action grouping; group-undo is M1.3c polish).
- **Sync (ADR-010):** unchanged — operations carry before/after snapshots per existing emitter.

## 9. Implementation phases

### Phase 1 — Domain transforms + PreviewShape extension (foundation)

**Goal:** Land the per-primitive transform helpers in `packages/domain/src/transforms/` and extend `PreviewShape` with 4 new arms. After this phase, the math + preview contract is in place; no tool yet uses them. Downstream phases (per-tool) consume.

**Files affected:** `packages/domain/src/transforms/{index,rotate,scale,mirror,offset}.ts` (NEW), `packages/domain/src/index.ts` (re-export), `packages/editor-2d/src/tools/types.ts` (PreviewShape extension), `packages/editor-2d/src/canvas/painters/paintPreview.ts` (4 new switch cases), `packages/domain/tests/transforms.test.ts` (NEW), `packages/editor-2d/tests/paintPreview.test.ts` (extend).

**Steps:**
1. Create `packages/domain/src/transforms/` directory + 4 transform files. Each exports a single function with the signature documented in §4.1. Switch on `Primitive['kind']` exhaustively (TypeScript exhaustiveness check enforces).
2. `rotate.ts` body: helper `rotatePoint(p, base, angleRad) = base + R(angleRad) * (p - base)`. Per-kind:
   - point: `position` rotated.
   - line: `p1`, `p2` rotated.
   - polyline: each vertex rotated; bulges unchanged.
   - rectangle: derive 4 corners, rotate each, recompute origin = min-corner; `width`/`height` unchanged (rotation preserves dimensions); `localAxisAngle += angleRad`.
   - circle: `center` rotated; `radius` unchanged.
   - arc: `center` rotated; `startAngle` += angleRad; `endAngle` += angleRad.
   - xline: `pivot` rotated; `angle` += angleRad.
3. `scale.ts` body: helper `scalePoint(p, base, factor) = base + factor * (p - base)`. Per-kind:
   - point: `position` scaled.
   - line: `p1`, `p2` scaled.
   - polyline: each vertex scaled; bulges unchanged (uniform scale preserves bulge ratio).
   - rectangle: `origin` scaled; `width`/`height` × factor.
   - circle: `center` scaled; `radius` × factor.
   - arc: `center` scaled; `radius` × factor; angles unchanged.
   - xline: `pivot` scaled; `angle` unchanged.
   - Throw if factor === 0 (degenerate).
4. `mirror.ts` body: helper `reflectPoint(p, line)` reflects across line through line.p1 / line.p2. Per-kind:
   - point: `position` reflected.
   - line: both endpoints reflected.
   - polyline: each vertex reflected; bulges NEGATED (sweep direction flips).
   - rectangle: 4 corners reflected; `localAxisAngle` reflected; origin = min-corner; w/h = abs of new corner deltas.
   - circle: `center` reflected; radius unchanged.
   - arc: `center` reflected; new start/end angles computed from reflected start/end points (sweep direction flips).
   - xline: `pivot` reflected; `angle` reflected (`angle' = 2 * lineAngle - angle`).
5. `offset.ts` body: helper-free, switch directly. Per-kind:
   - point: throw — point has no offset semantic.
   - line: compute perpendicular unit vector, shift both endpoints by `distance * side * perpUnit`.
   - polyline: per-segment offset (compute each segment's parallel line at offset, then connect at intersection of adjacent segments). V1 simple version: linear-only, no self-intersection clean-up. Bulges throw `Error('offset on bulged polyline not implemented in V1')` (ADR-016: bulges introduced by Fillet, not in this plan; bulged polylines don't exist on main yet).
   - rectangle: dimensions ± 2*distance*side, centered (origin shifts by ±distance per axis).
   - circle: same center, radius + distance*side. Throw if result ≤ 0.
   - arc: same center, radius + distance*side. Same constraint.
   - xline: pivot shifts by `distance * side * perpUnit(angle)`; angle unchanged.
6. Re-export from `packages/domain/src/index.ts` and `packages/domain/src/transforms/index.ts`.
7. Extend `PreviewShape` in `packages/editor-2d/src/tools/types.ts`:
   ```ts
   | { kind: 'rotated-entities'; primitives: Primitive[]; base: Point2D; angleRad: number }
   | { kind: 'scaled-entities'; primitives: Primitive[]; base: Point2D; factor: number }
   | { kind: 'mirrored-entities'; primitives: Primitive[]; line: { p1: Point2D; p2: Point2D } }
   | { kind: 'offset-preview'; primitive: Primitive; distance: number; side: 1 | -1 }
   ```
   Update the JSDoc above the union to enumerate all 13 arms (was: "Forward-compat note: M1.3b modify operators may add a 'modified-entities' arm" — update to acknowledge the 4 new arms now landed).
8. Extend `paintPreview.ts` switch with 4 new cases. Each delegates to a per-arm `drawXxxPreview(ctx, shape)` helper. Each helper iterates primitives (or in offset's case, the single primitive), applies the transform inline (calling the domain helper from Step 1-5), and strokes the resulting outline using the same dash + transient stroke style as `drawModifiedEntitiesPreview`. Net new code in paintPreview: ~80-120 LOC.
9. Add Phase 1 tests:
   - `packages/domain/tests/transforms.test.ts` (NEW) — per-transform × per-primitive-kind = ~28 unit tests (4 transforms × 7 kinds, minus offset×point throw case). Use `toBeCloseTo(value, 6)` for float comparisons.
   - `packages/editor-2d/tests/paintPreview.test.ts` (EXTEND) — 4 new tests (one per new arm) using the existing recorder-ctx + assert correct strokes.

**Phase 1 mandatory completion gates:**

| Gate | Command | Expected |
|---|---|---|
| MOD-P1-TransformsExist | `rg -n "^export function (rotatePrimitive\|scalePrimitive\|mirrorPrimitive\|offsetPrimitive)" packages/domain/src/transforms/` | exactly 4 matches across the 4 files |
| MOD-P1-PreviewShapeArms | `rg -n "kind: 'rotated-entities'\|kind: 'scaled-entities'\|kind: 'mirrored-entities'\|kind: 'offset-preview'" packages/editor-2d/src/tools/types.ts` | exactly 4 matches (one per arm in the discriminated union) |
| MOD-P1-PaintPreviewCases | `rg -n "case 'rotated-entities'\|case 'scaled-entities'\|case 'mirrored-entities'\|case 'offset-preview'" packages/editor-2d/src/canvas/painters/paintPreview.ts` | exactly 4 matches (one per switch case) |
| MOD-P1-Typecheck | `pnpm typecheck` | exit code 0; zero TS errors. (TS exhaustiveness on `paintPreview.ts` switch will fail at compile time if any new arm is missing a case.) |
| MOD-P1-Lint | `pnpm check` | exit code 0; zero biome errors |
| MOD-P1-Tests | `pnpm test` | exit code 0; final count = baseline 519 + ~32 net-new (~28 transform unit + 4 paintPreview) |

**Phase 1 invariants:**
- **I-MOD-1** — transforms are domain-pure: `packages/domain/src/transforms/` MUST NOT import from `editor-2d`, `project-store`, `react`, `zustand`, or `design-system`. Enforcement: `rg -n "from '@portplanner/(editor-2d\|project-store\|design-system)'\|from 'react'\|from 'zustand'" packages/domain/src/transforms/` → zero matches.
- **I-MOD-2** — PreviewShape exhaustiveness in paintPreview.ts switch is TypeScript-enforced. Adding a new arm without a switch case fails compile.

### Phase 2 — Rotate tool

**Goal:** `R + Enter` activates Rotate. select → base → reference angle → final angle commits. DI manifest typed-angle path works (Tab to lock; auto-submit on all-locked).

**Files affected:** `packages/editor-2d/src/tools/rotate.ts` (NEW), `packages/editor-2d/tests/rotate.test.ts` (NEW).

**Steps:**
1. Implement `rotateTool` generator in `packages/editor-2d/src/tools/rotate.ts`. Pattern from `move.ts`:
   - Read selection from `editorUiStore.getState().selection`. If empty, yield "Select objects".
   - Yield "Specify base point" with `acceptedInputKinds: ['point']`.
   - Yield "Specify reference angle" with `previewBuilder: (cursor) => ({ kind: 'line', p1: base, cursor })` + `directDistanceFrom: base`.
   - Yield "Specify rotation angle" with `dynamicInput: { fields: [{ kind: 'angle', label: 'Angle' }], combineAs: 'angle' }`, `previewBuilder: (cursor) => ({ kind: 'rotated-entities', primitives: ghost, base, angleRad: atan2(cursor - base) - referenceAngleRad })`, `dimensionGuidesBuilder: (cursor) => [{ kind: 'angle-arc', pivot: base, baseAngleRad: referenceAngleRad, sweepAngleRad: atan2(cursor - base) - referenceAngleRad, radiusMetric: hypot(cursor - base) }]`, `directDistanceFrom: base`.
   - Commit: `for (id of selection) updatePrimitive(id, rotatePrimitive(p, base, deltaAngle))`.
2. Snapshot ghost primitives at base-point-pick time (mirrors move.ts:42-48).
3. Add to `ESSENTIAL_REGISTRY` in `tools/index.ts` (deferred to Phase 6).
4. Tests in `tests/rotate.test.ts`:
   - "yields select prompt when selection empty"
   - "yields base-point prompt directly when selection non-empty"
   - "yields reference-angle prompt with line preview from base"
   - "yields final-angle prompt with rotated-entities preview"
   - "commit rotates primitives by Δangle" (use a single line primitive; verify p1/p2 after commit)
   - "typed angle commits at locked rotation" (DI path)

**Phase 2 mandatory completion gates:**

| Gate | Command | Expected |
|---|---|---|
| MOD-P2-RotateToolExists | `rg -n "^export async function\* rotateTool" packages/editor-2d/src/tools/rotate.ts` | exactly 1 match |
| MOD-P2-Tests | `pnpm --filter @portplanner/editor-2d test -- rotate.test.ts` | all pass |
| MOD-P2-Typecheck | `pnpm typecheck` | exit 0 |
| MOD-P2-Lint | `pnpm check` | exit 0 |

### Phase 3 — Mirror tool

**Goal:** `MI + Enter` activates Mirror. select → first mirror line point → second mirror line point commits. Sources kept (per A6 lock).

Same shape as Phase 2 but with mirror-axis-line previewBuilder and `'mirrored-entities'` arm.

**Files affected:** `packages/editor-2d/src/tools/mirror.ts` (NEW), `packages/editor-2d/tests/mirror.test.ts` (NEW).

**Phase 3 mandatory completion gates:**

| Gate | Command | Expected |
|---|---|---|
| MOD-P3-MirrorToolExists | `rg -n "^export async function\* mirrorTool" packages/editor-2d/src/tools/mirror.ts` | exactly 1 match |
| MOD-P3-Tests | `pnpm --filter @portplanner/editor-2d test -- mirror.test.ts` | all pass |
| MOD-P3-Typecheck + Lint | `pnpm typecheck && pnpm check` | exit 0 |

### Phase 4 — Scale tool

Same shape with reference-distance + new-distance prompts; DI typed-factor path.

**Phase 4 mandatory completion gates:**

| Gate | Command | Expected |
|---|---|---|
| MOD-P4-ScaleToolExists | `rg -n "^export async function\* scaleTool" packages/editor-2d/src/tools/scale.ts` | exactly 1 match |
| MOD-P4-Tests | `pnpm --filter @portplanner/editor-2d test -- scale.test.ts` | all pass |
| MOD-P4-Typecheck + Lint | `pnpm typecheck && pnpm check` | exit 0 |

### Phase 5 — Offset tool

Single-entity per A8. DI typed-distance path. Side determined by click position relative to source.

**Phase 5 mandatory completion gates:**

| Gate | Command | Expected |
|---|---|---|
| MOD-P5-OffsetToolExists | `rg -n "^export async function\* offsetTool" packages/editor-2d/src/tools/offset.ts` | exactly 1 match |
| MOD-P5-Tests | `pnpm --filter @portplanner/editor-2d test -- offset.test.ts` | all pass |
| MOD-P5-Typecheck + Lint | `pnpm typecheck && pnpm check` | exit 0 |

### Phase 6 — Wiring (shortcuts + registry + operator-shortcuts.md)

**Goal:** All 4 tools accessible via keyboard. Operator-shortcuts.md bumped + new rows + changelog entry.

**Files affected:** `packages/editor-2d/src/keyboard/shortcuts.ts`, `packages/editor-2d/src/tools/index.ts`, `docs/operator-shortcuts.md`, `packages/editor-2d/tests/keyboard-router.test.ts` (extend).

**Steps:**
1. Add 4 ToolIds to the union; add R/O to single-letter map; MI/SC to multi-letter map; add 4 entries to `TOOL_DISPLAY_NAMES`.
2. Import + register 4 factories in `ESSENTIAL_REGISTRY`.
3. Bump `docs/operator-shortcuts.md` Version field 2.2.0 → 2.3.0; Date field; add 4 rows under M1.3b section; add changelog row.
4. Extend keyboard-router.test.ts with 4 activation tests.

**Phase 6 mandatory completion gates:**

| Gate | Command | Expected |
|---|---|---|
| MOD-P6-ToolIdUnion | `rg -n "\| 'rotate'\|'mirror'\|'scale'\|'offset'" packages/editor-2d/src/keyboard/shortcuts.ts` | matches confirm union extended (4 new entries) |
| MOD-P6-ShortcutMaps | `rg -n "R: 'rotate'\|MI: 'mirror'\|SC: 'scale'\|O: 'offset'" packages/editor-2d/src/keyboard/shortcuts.ts` | exactly 4 matches |
| MOD-P6-Registry | `rg -n "rotate: rotateTool\|mirror: mirrorTool\|scale: scaleTool\|offset: offsetTool" packages/editor-2d/src/tools/index.ts` | exactly 4 matches |
| MOD-P6-OperatorShortcutsVersion | `rg -n "^\*\*Version:\*\* 2\.3\.0" docs/operator-shortcuts.md && rg -n "^\| 2\.3\.0 \|" docs/operator-shortcuts.md` | both succeed |
| MOD-P6-RouterActivation | `pnpm --filter @portplanner/editor-2d test -- keyboard-router.test.ts -t "activate.*(rotate\|mirror\|scale\|offset)"` | 4 tests pass |
| MOD-P6-Typecheck + Lint + Tests | `pnpm typecheck && pnpm check && pnpm test` | all green; final count = 519 (post-DI-overhaul baseline) + ~50 net-new (Phase 1 transforms + Phase 2-5 per-tool + Phase 6 router) ≈ 570 |

## 10. Invariants summary

| ID | Invariant | Phase | Enforcement |
|---|---|---|---|
| I-MOD-1 | Domain transforms are pure (no editor-2d / project-store / react / zustand / design-system imports) | 1 | grep gate (Phase 1 step 9) |
| I-MOD-2 | PreviewShape switch in paintPreview is exhaustive (TS catches missing cases) | 1 | TypeScript exhaustiveness compile-time |
| I-MOD-3 | Each modify tool reads selection from `editorUiStore.selection` and falls back to "Select objects" prompt when empty | 2-5 | per-tool tests |
| I-MOD-4 | Operator-shortcuts.md version bumped 2.2.0 → 2.3.0 + changelog entry per spec-update rule §0.5 | 6 | gate MOD-P6-OperatorShortcutsVersion |
| I-MOD-5 | Tool activation works through keyboard router for all 4 ops | 6 | gate MOD-P6-RouterActivation |

## 11. Test strategy

**Net-new test count target:** ~50 across the 6 phases.

- Phase 1: ~28 domain transform unit tests + 4 paintPreview arm tests = ~32
- Phase 2-5: ~4 tool-generator tests per phase × 4 phases = ~16
- Phase 6: 4 router-activation tests

**Coverage:** every Primitive kind × every transform = unit-tested in `domain/tests/transforms.test.ts`. Tool-level integration tests cover the prompt sequence + commit per operator. Router tests cover activation. paintPreview tests cover the new render arms.

**Floats:** all comparisons use `toBeCloseTo(value, 6)`.

## 12. Done Criteria

- [ ] **Phase 1.** All 4 domain transform helpers exist + ~28 unit tests pass; PreviewShape extended to 13 arms; paintPreview.ts switch handles all new cases; per-arm draw helpers stroke correctly. Gates MOD-P1-{TransformsExist,PreviewShapeArms,PaintPreviewCases,Typecheck,Lint,Tests}.
- [ ] **Phases 2-5.** Each tool ships its generator + tests. Every user-visible behavior row in §3.0 traces to a code site in this branch.
- [ ] **Phase 6.** Shortcuts + registry + operator-shortcuts.md 2.3.0 wired. Router activation tests pass for all 4. Gates MOD-P6-*.
- [ ] **All gates green; typecheck + lint clean across all 6 phases.**
- [ ] **Final test count ≥ 569** (519 post-DI-overhaul baseline + ~50 net-new).
- [ ] **Manual smoke instructions** (per Procedure 03 §3.5) handed off in the post-execution block — bullets covering each user-visible behavior row in §3.0.

## 13. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Polyline offset is algorithmically heavy (per-segment offset + reconnect), and bulged polylines aren't on main yet — V1 simple version may not exactly match AC for complex non-convex polylines | A12 lock — V1 simple linear-only (throw on bulged input). Production polyline offset is tracked as M1.3c+ deferred work. Test suite covers convex 4+ vertex polylines; complex cases are out of V1 scope. |
| Mirror's bulge negation may surprise users when polylines have bulges (later, when Fillet introduces them) | Bulges aren't on main yet (Fillet is M1.3b post-this-plan). When Fillet lands, the existing mirror tests cover the negation contract — no rework needed. |
| Scale with negative factor produces a flipped-and-scaled result; AC behavior is to throw + warn | A5 — `scalePrimitive` throws on `factor === 0`; negative factor allowed (AutoCAD convention: negative scale flips). Test asserts negative-factor case for line + circle. |
| 4 new PreviewShape arms grow the discriminated union (10 → 14 arms); paintPreview switch + tests get bulkier | TypeScript exhaustiveness check catches missing cases at compile time. Each arm gets ~30 LOC in paintPreview. Net acceptable given the user value. |
| `directDistanceFrom: base` on rotate's reference-angle prompt may interact with F1 typed-distance entry in surprising ways (rectangle had this issue Phase 5) | Rotate's reference-angle prompt accepts `'point'` only (not `'number'`); F1 typed-distance fires only when `commandBar.acceptedInputKinds.includes('number')`, which it doesn't here. No interaction. |
| Selection model change (multi-select) post-this-plan could regress modify ops | Each tool reads `editorUiStore.selection` directly; multi-select changes the array length, not the slice shape. Existing tests cover both single and multi-element selection paths. |
| Modify ops produce N operations per invocation (one per primitive); undo steps through them one at a time | Acceptable per ADR-023. Group-undo (multi-op as one undo step) is M1.3c polish per the plan body. |

## Plan Review Handoff

### Files touched by this plan
- `packages/domain/src/transforms/{index,rotate,scale,mirror,offset}.ts` (NEW)
- `packages/domain/src/index.ts` (re-export)
- `packages/editor-2d/src/tools/types.ts` (PreviewShape +4 arms)
- `packages/editor-2d/src/canvas/painters/paintPreview.ts` (+4 switch cases + helpers)
- `packages/editor-2d/src/tools/{rotate,mirror,scale,offset}.ts` (NEW)
- `packages/editor-2d/src/tools/index.ts` (+4 registry entries)
- `packages/editor-2d/src/keyboard/shortcuts.ts` (ToolId + maps + display names)
- `docs/operator-shortcuts.md` (2.2.0 → 2.3.0 + 4 rows + changelog)
- Tests: `packages/domain/tests/transforms.test.ts` (NEW), `packages/editor-2d/tests/{rotate,mirror,scale,offset,paintPreview,keyboard-router}.test.ts` (NEW + extends)

### Paste to Codex for plan review

> Review this plan using the protocol at `docs/procedures/Codex/02-plan-review.md` (Procedure 02), strict evidence mode. Note Procedure 02 was extended at commit `626589d` (this conversation's procedure-update commit) with two new Round-1 questions: #15 User-Visible Behavior Walkthrough check (verify §1.5.1 table is populated, complete, with non-empty implementation sites + tests that observe the visible path) and #16 Gate-regex anchoring check (verify "exactly N" / "zero matches" gates anchor to declarative sites). Apply both rigorously — they exist *because* the prior M1.3 DI pipeline overhaul plan reached Codex Round-4 Go on commit-time math while the user-observable mid-action behavior was unwired.
>
> §3.0 of this plan is the §1.5.1 table; please verify each row's implementation site is a real file:line (not hand-wavy) and the test column references a test that exercises the visible path. §1.4.1 grounding table is at §3.1 (14 rows, all Match against current main as of `594583a`).
>
> If Round 1 returns Go, hand back to Claude for execution per Procedure 03.
