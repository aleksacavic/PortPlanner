# M1.3b — Fillet + Chamfer cluster

**Branch:** `feature/m1-3b-fillet-chamfer`
**Status:** Plan authored — awaiting Codex Procedure 02 review
**Authored:** 2026-05-03
**Author:** Claude Opus 4.7 (PLAN-ONLY mode per Procedure 01)

---

## 1) Request summary

Second M1.3b modify-operator cluster: **Fillet** (`F`) + **Chamfer** (`CHA`). Same UX shape — pick 2 entities → distance/radius prompt → commit. Fillet introduces the first **production bulged polyline** per ADR-016 Appendix A; this plan ALSO closes the residual bulge-consumer gaps (preview painter, hit-test, osnap midpoint) per ADR-016 §170 ("straight-only shortcuts are Blockers").

V1 scope per user direction (Option A + Scope (ii) confirmed 2026-05-02): three pair types — **two-line**, **polyline-internal**, and **line + polyline-endpoint**. Polyline interior-segment mixed Fillet is out of scope.

---

## 2) Assumptions and scope clarifications

A1. **Two-line Fillet output = trim-and-add (Option A).** Both source lines are trimmed in place by `d = R·tan(θ/2)`; a new `ArcPrimitive` is added between the new endpoints. Op log: `2× UPDATE + 1× CREATE`. Lines stay lines. AC parity.

A2. **Polyline-internal Fillet** modifies in place: replace vertex K with two new vertices P1 / P2 and write bulge `tan(θ/4)` into `bulges[K]`. Op log: `1× UPDATE`. Per ADR-016 Appendix A.

A3. **Line + polyline-endpoint Fillet** trims the line, modifies the polyline endpoint vertex inward by `d`, adds new ArcPrimitive between trimmed endpoints. Op log: `1× UPDATE (line) + 1× UPDATE (polyline) + 1× CREATE (arc)`. The polyline keeps its identity; a single new ArcPrimitive bridges to the trimmed line.

A4. **Polyline interior-segment Fillet REJECTED.** If user clicks an interior segment of a polyline (not an endpoint segment), the tool aborts with command-bar error: `"Fillet: only polyline endpoint segments supported (interior segment fillet deferred to follow-up)"`. AC's interior-segment behavior (split or trim-back) needs its own decision.

A5. **Parallel-lines Fillet REJECTED.** `Math.abs(crossProduct) < epsilon` → domain helper throws; tool catches and aborts with `"Fillet: parallel lines cannot be filleted"`.

A6. **Trim distance exceeds segment length** → domain helper throws `Error("trim distance exceeds source segment length")`; tool catches and aborts with command-bar message.

A7. **Chamfer V1 = two-distance method only.** AC's `[mEthod]` distance-vs-angle alternation is deferred.

A8. **`[Multiple]` sub-option deferred** — one corner per tool run. User re-invokes for chained corners.

A9. **Closed polylines have no endpoint** — every vertex is interior. Mixed (line + closed-polyline) and "endpoint" prompts on closed polylines route through the same interior-segment rejection guard.

A10. **Selection order is asymmetric-tolerant.** Tool detects each picked entity's kind (Line vs Polyline) and dispatches accordingly. Order in which user picks is not user-facing.

---

## 3) Scope and Blast Radius

### 3.0) User-Visible Behavior Walkthrough (§1.5.1)

| User action | Expected visible result | Implementation site | Test |
|---|---|---|---|
| User types `F` then Enter | Command bar shows `"Select first object or [Radius]:"`; crosshair flips to pick-point | `keyboard/shortcuts.ts` adds `F` row → router activates `filletTool` (planned new `tools/fillet.ts`) | `tests/keyboard-router.test.ts` "F shortcut activates fillet" + `tests/fillet.test.ts` "first prompt yields select+pick-point" |
| User clicks first entity (LinePrimitive A) | A highlights as selected; prompt advances to `"Select second object"` | `tools/fillet.ts` first-pick branch | `tests/fillet.test.ts` "first entity stored, prompt advances" |
| Cursor moves over candidate second entity | Live preview shows ghost: trimmed A + ghost arc + trimmed B (assuming current radius) | new `PreviewShape` arm `fillet-preview` + new painter case `drawFilletPreview` in `paintPreview.ts` | `tests/paintPreview.test.ts` "fillet preview draws 2 trimmed lines + arc" |
| User clicks second entity (LinePrimitive B) | Tool commits: store has 2 UPDATEd lines + 1 new ArcPrimitive; selection clears | `tools/fillet.ts` two-line commit branch → 3 calls into `@portplanner/project-store` | `tests/fillet.test.ts` "two-line commit emits 2 UPDATE + 1 CREATE" |
| User picks polyline P twice (polyline-internal case, click near interior vertex K) | Polyline modified in place: vertex K replaced with 2 new vertices, `bulges[K]` set to `tan(θ/4)` | `tools/fillet.ts` polyline-internal branch → `domain/.../fillet.ts:filletPolylineCorner` | `tests/fillet.test.ts` "polyline-internal emits 1 UPDATE with new vertex shape" + `domain/tests/transforms-fillet.test.ts` |
| User picks line + polyline-endpoint | Line trimmed, polyline endpoint vertex modified, new ArcPrimitive added | `tools/fillet.ts` mixed branch → `domain/.../fillet.ts:filletLineAndPolylineEndpoint` | `tests/fillet.test.ts` "mixed line+poly-endpoint emits 2 UPDATE + 1 CREATE" |
| User picks line + polyline-interior-segment | Tool aborts: command bar shows `"Fillet: only polyline endpoint segments supported (interior segment fillet deferred to follow-up)"` | `tools/fillet.ts` interior-segment guard | `tests/fillet.test.ts` "interior segment rejected" |
| User picks two parallel lines | Tool aborts: `"Fillet: parallel lines cannot be filleted"` | `tools/fillet.ts` catch block + `domain/.../fillet.ts:filletTwoLines` parallel throw | `tests/fillet.test.ts` "parallel rejected" + `domain/tests/transforms-fillet.test.ts` "filletTwoLines parallel throws" |
| User cursor hovers over a bulged polyline arc segment after Fillet shipped | Hit-test correctly returns the polyline ID (cursor-on-arc, not chord) | `canvas/hit-test.ts` polyline branch upgraded to arc-aware | `tests/hit-test.test.ts` "bulged polyline arc segment hits correctly" |
| User invokes MID osnap on a bulged polyline | Snap glyph appears at the **arc midpoint** (at angle `(start+end)/2` from arc center), NOT at the chord midpoint | `snap/osnap.ts` polyline midpoint branch upgraded | `tests/osnap.test.ts` "midpoint of bulged polyline segment is arc midpoint" |
| User types `F`, then `R`, then `2.5`, then picks two entities | Fillet uses radius 2.5 instead of session default | `tools/fillet.ts` `R`/`Radius` sub-option branch | `tests/fillet.test.ts` "Radius sub-option sets fillet radius" |
| User types `CHA`, picks two lines | Live preview shows two trimmed lines + a connecting straight chamfer segment; commit emits 2 UPDATE + 1 CREATE LinePrimitive | new `tools/chamfer.ts` + `chamfer-preview` PreviewShape arm + `domain/.../chamfer.ts:chamferTwoLines` | `tests/chamfer.test.ts` "two-line commit emits 2 UPDATE + 1 CREATE LinePrimitive" |
| User picks polyline twice with Chamfer | Polyline modified in place: vertex K replaced with 2 new vertices, `bulges[K] = 0` (straight chamfer segment) | `tools/chamfer.ts` polyline-internal branch | `tests/chamfer.test.ts` |

### 3.1) In scope

**Created files:**
- `packages/domain/src/transforms/fillet.ts` — three pure helpers
- `packages/domain/src/transforms/chamfer.ts` — three pure helpers
- `packages/domain/tests/transforms-fillet.test.ts`
- `packages/domain/tests/transforms-chamfer.test.ts`
- `packages/editor-2d/src/tools/fillet.ts` — generator
- `packages/editor-2d/src/tools/chamfer.ts` — generator
- `packages/editor-2d/tests/fillet.test.ts`
- `packages/editor-2d/tests/chamfer.test.ts`
- `packages/editor-2d/src/canvas/painters/_polylineGeometry.ts` — extracts `arcParamsFromBulge` from `paintPolyline.ts` for shared use across painter + hit-test + osnap

**Modified files:**
- `packages/domain/src/transforms/index.ts` — re-exports
- `packages/domain/src/index.ts` — re-exports
- `packages/editor-2d/src/tools/types.ts` — 2 new `PreviewShape` arms (`fillet-preview`, `chamfer-preview`)
- `packages/editor-2d/src/tools/index.ts` — 2 new tool registrations
- `packages/editor-2d/src/canvas/painters/paintPreview.ts` — bulge-aware polyline branch in `drawShiftedPrimitiveOutline` + 2 new dispatcher cases
- `packages/editor-2d/src/canvas/painters/paintPolyline.ts` — `arcParamsFromBulge` re-exported from `_polylineGeometry.ts` (no behavior change)
- `packages/editor-2d/src/canvas/hit-test.ts` — arc-aware polyline distance
- `packages/editor-2d/src/snap/osnap.ts` — arc-aware polyline midpoint
- `packages/editor-2d/src/keyboard/shortcuts.ts` — 2 new entries
- `packages/editor-2d/src/ui-state/store.ts` — `fillet: { radius }` and `chamfer: { d1, d2 }` slice extensions
- `packages/editor-2d/tests/paintPreview.test.ts` — bulged-polyline + 2 new arm cases
- `packages/editor-2d/tests/hit-test.test.ts` — bulged-polyline cases
- `packages/editor-2d/tests/osnap.test.ts` — bulged-polyline MID case
- `docs/operator-shortcuts.md` — version bump 2.3.0 → 2.4.0; populate `F` + `CHA` Notes columns + changelog

### 3.2) Out of scope

- 7 remaining M1.3b operators: Trim/Extend/Break/Join/Array/Match/Explode + STRETCH (separate `m1-3b-topological` plan)
- `[Multiple]` sub-option (per A8)
- Parallel-lines Fillet (per A5)
- Polyline interior-segment mixed Fillet (per A4)
- Chamfer `[mEthod]` distance-vs-angle alternation (per A7)
- Offset of bulged polylines — `offset.ts:58-60` already throws; restated in §10 risks
- Bulge-aware osnap modes beyond MID (PERP, TAN, NEAR) — per `osnap.ts:9` these are M1.3c scope. This plan only upgrades MID since MID already exists for polylines today.
- Bulge-aware intersection (`snap/intersection.ts`) — line/line only ships per Phase 1 of snap-engine-extension; polyline-arc intersections are M1.3c

### 3.3) Blast radius

- **Packages affected:** `domain` (new helpers), `editor-2d` (new tools, painter/hit-test/osnap edits), `apps/web` (no direct change — auto-registers via editor-2d)
- **Cross-package consumers:** none — primitive-level operators
- **Stored data:** `PolylinePrimitive` with non-zero `bulges` becomes producible by users for the first time. Schema already validates (`primitive.schema.ts:56-58`). No migration — old projects with `bulges: [0, 0, ...]` parse identically.
- **Scenarios (ADR-006):** none — primitives are scenario-shared
- **UI surfaces:** command bar prompts; canvas preview / hit / osnap overlays; selection visuals

### 3.4) Binding specifications touched

| ADR / spec | Path | Relation |
|---|---|---|
| ADR-016 (drawing model + Appendix A Fillet semantics) | `docs/adr/016-drawing-model.md:191-203` | Implementation conforms — Appendix A `tan(θ/2)` trim distance + `tan(θ/4)` bulge formula honored verbatim |
| ADR-016 §170 (every consumer handles bulges; straight-only shortcuts are Blockers) | `docs/adr/016-drawing-model.md:170` | **Phase 1 closes** preview painter, hit-test, osnap-MID gaps |
| ADR-020 (operation log; `targetKind: 'primitive'`) | `docs/adr/020-project-sync.md:42-60` | Conform — CREATE/UPDATE/DELETE on primitives, snapshot before/after |
| ADR-023 (tool state machine + command bar) | `docs/adr/023-tool-state-machine-and-command-bar.md` | Conform — generator pattern, sub-options, prompts |
| ADR-001 (project-local metric Float64) | `docs/adr/001-coordinate-system.md` | Conform — domain math entirely metric |
| `docs/operator-shortcuts.md` | — | Version bump 2.3.0 → 2.4.0 |

### 3.5) Architecture Doc Impact

| Doc | Path | Change type | Reason |
|---|---|---|---|
| `docs/operator-shortcuts.md` | `docs/operator-shortcuts.md` | Version bump 2.3.0 → 2.4.0 | Populate `F` + `CHA` Notes columns + changelog |
| ADR-016 | — | No change | Appendix A already covers Fillet semantics |
| ADR-020 | — | No change | Standard primitive ops |
| ADR-023 | — | No change | Standard generator pattern |

### 3.6) Deviations from binding specs

**None.** ADR-016 §170 closure is alignment with the spec, not a deviation. Pre-existing chord approximations in hit-test/osnap were inert (no production bulged polylines existed); this plan ships bulged polylines AND simultaneously closes the §170 gaps in the same commit cluster.

---

## 4) Object Model and Extraction Integration

**Not applicable.** Fillet and Chamfer operate on primitives only. No new typed objects, no new extractor outputs, no validation rule changes, no library impact, no ownership-state transitions.

---

## 5) Hydration, Serialization, Undo/Redo, Sync (§1.9)

**Hydration:** No new fields. `PolylinePrimitive` schema already validates `bulges` array; old projects (where bulges were `[0, 0, ...]`) parse unchanged. No migration needed — clean-break preproduction policy (GR-1).

**Serialization:** No new fields. `bulges: number[]` already serialized. Derived geometry (arc params from bulge) is computed at paint/hit-test/osnap time; never written.

**Undo/Redo:** Each tool emits standard primitive ops via `addPrimitive` / `updatePrimitive` (zundo temporal middleware tracks each emission). Two-line Fillet = 3 separate ops; zundo replays in reverse on undo. Polyline-internal = 1 UPDATE op. Mixed = 3 ops. No atomic batching — AC parity confirmed: undoing a Fillet in AC reverts ONLY the arc creation, then each line trim individually.

**Sync (ADR-020):** Primitive-level ops with `targetKind: 'primitive'`, `targetId: <PrimitiveId>`. Object-level last-write-wins applies per-primitive. No `promotionGroupId` (reserved for primitive→typed-object promotion per ADR-016).

---

## 6) Implementation phases

### Phase 1 — Domain helpers + PreviewShape arms + bulge-consumer closure

**Goal:** Pure domain helpers for the 6 transform cases (3 fillet + 3 chamfer). Two new `PreviewShape` arms with painter cases. Close the three §170 gaps so production bulged polylines render/hit-test/snap correctly.

**Files:** see §3.1.

**Steps:**

1. Extract `arcParamsFromBulge` from `paintPolyline.ts:20-46` to a new shared module `painters/_polylineGeometry.ts`. Re-export from `paintPolyline.ts` for back-compat (zero call-site changes outside the new module). Add a tested helper `pointOnArcAtMidAngle(arc: ArcParams): Point2D` for osnap MID.
2. Author `domain/src/transforms/fillet.ts`:
   - `filletTwoLines(l1: LinePrimitive, l2: LinePrimitive, radius: number, pickHints: { p1Hint: Point2D; p2Hint: Point2D }): { l1Updated; l2Updated; newArc: Omit<ArcPrimitive, 'id' | 'layerId' | 'displayOverrides'> }` — pickHints disambiguate which endpoint of each line to keep (the one farther from `*Hint`).
   - `filletPolylineCorner(p: PolylinePrimitive, vertexIdx: number, radius: number): PolylinePrimitive` — replaces vertex `vertexIdx` with two new vertices and writes `bulges[vertexIdx] = tan(θ/4)`. **Throws** on closed-polyline endpoint vertex (vertex 0 / N-1) — interior-segment-only invariant. Throws on radius too large for trim.
   - `filletLineAndPolylineEndpoint(line: LinePrimitive, lineHint: Point2D, polyline: PolylinePrimitive, polylineEndpoint: 0 | -1, radius: number): { lineUpdated; polylineUpdated; newArc }` — `polylineEndpoint === 0` operates on first segment; `=== -1` on last segment. Closed polylines rejected.
   - All three: throw on `radius <= 0`; throw on parallel sources; throw if trim distance ≥ available source length.

3. Author `domain/src/transforms/chamfer.ts` — same three signatures with `(d1, d2)` instead of `radius`. Two-line and mixed produce a new **`LinePrimitive`** (the chamfer segment), NOT an ArcPrimitive. Polyline-internal sets `bulges[vertexIdx] = 0` and writes a straight polyline edge (vertex shape: replace K with two vertices, bulge 0).

4. Re-export from `domain/src/transforms/index.ts` and `domain/src/index.ts`.

5. Extend `editor-2d/src/tools/types.ts` `PreviewShape` union with two new arms:
   ```typescript
   | { kind: 'fillet-preview'; cases: FilletPreviewCase }
   | { kind: 'chamfer-preview'; cases: ChamferPreviewCase }
   ```
   where each case-type is a discriminated union over the three pair-types (`'two-line' | 'polyline-internal' | 'line-polyline-end'`) carrying source primitives + radius/distances + pick hints.

6. Modify `paintPreview.ts`:
   - **`drawShiftedPrimitiveOutline` polyline branch:** replace straight `lineTo`-only walk with bulge-aware path using `arcParamsFromBulge` from `_polylineGeometry.ts`. **This closes Codex Round-2 quality gap #2 from the prior cluster.**
   - Add `case 'fillet-preview'` and `case 'chamfer-preview'` to the dispatcher with helper functions `drawFilletPreview` / `drawChamferPreview` that compute the same geometry as commit-time and stroke with `canvas.transient.preview_stroke`.

7. Modify `hit-test.ts` polyline branch:
   - For each segment, if `bulge === 0` use existing `distancePointToLineSegment`. Else compute arc params via `arcParamsFromBulge` and use a new `distancePointToArc(p, arcParams)` helper that returns perpendicular distance from cursor to the arc circle, clamped if cursor's projection falls outside `[startAngle, endAngle]` sweep range.

8. Modify `snap/osnap.ts` polyline midpoint:
   - For each segment, if `bulge === 0` return chord midpoint `(a + b) / 2`. Else compute arc params and return `pointOnArcAtMidAngle(arcParams)`.

9. Domain tests `transforms-fillet.test.ts` (~10): 90° two-line, oblique two-line, parallel-throws, radius-too-large-throws, polyline-internal interior vertex, polyline-internal-endpoint-throws (closed-poly edge case), mixed line+poly-end-0, mixed line+poly-end-N-1, radius-zero-throws, trim-exceeds-throws.

10. Domain tests `transforms-chamfer.test.ts` (~10): mirror Fillet structure with chamfer outputs (LinePrimitive instead of ArcPrimitive, bulge=0 polyline-internal).

11. editor-2d tests:
    - `paintPreview.test.ts`: 2 cases — bulged-polyline arm asserts `ctx.arc(...)` call (not `lineTo`); fillet-preview arm asserts 2 lines + 1 arc primitive geometries on the recorder.
    - `hit-test.test.ts`: 2 cases — bulged segment hits via arc distance; non-bulged segment unchanged.
    - `osnap.test.ts`: 1 case — bulged polyline MID at arc midpoint, NOT chord midpoint.

**Invariants introduced:**

- **I-FC-1 (domain purity):** `domain/src/transforms/{fillet,chamfer}.ts` import from `domain` only. Enforcement grep:
  ```
  rg -n "^import .* from '@portplanner/(editor-2d|project-store|design-system|project-store-react)'" packages/domain/src/transforms/fillet.ts packages/domain/src/transforms/chamfer.ts
  ```
  Expected: zero.
- **I-FC-2 (preview painter polyline arc parity):** `drawShiftedPrimitiveOutline` polyline branch and `paintPolyline` agree on arc rendering via shared `arcParamsFromBulge` from `_polylineGeometry.ts`. Enforcement grep:
  ```
  rg -n "^function arcParamsFromBulge" packages/editor-2d/src/canvas/painters/_polylineGeometry.ts
  ```
  Expected: exactly 1 match (the SSOT declaration). Plus type test: `paintPolyline.ts` re-exports from `_polylineGeometry.ts`.
- **I-FC-3 (hit-test arc-aware):** polyline hit-test routes bulged segments through `distancePointToArc`. Enforcement test in `tests/hit-test.test.ts`: "bulged polyline segment uses arc distance".
- **I-FC-4 (osnap MID arc-aware):** polyline MID for bulged segments returns arc midpoint. Enforcement test in `tests/osnap.test.ts`.

**Mandatory completion gates (Phase 1):**

- **Gate FC-P1-DomainPurity:**
  ```
  rg -n "^import .* from '@portplanner/(editor-2d|project-store|design-system|project-store-react)'" packages/domain/src/transforms/fillet.ts packages/domain/src/transforms/chamfer.ts
  ```
  Expected: zero matches.
- **Gate FC-P1-ArcParamsSSOT:**
  ```
  rg -n "^export function arcParamsFromBulge" packages/editor-2d/src/canvas/painters/
  ```
  Expected: exactly 1 match in `_polylineGeometry.ts`. Re-export-only sites do not count.
- **Gate FC-P1-DomainTests:** `pnpm --filter @portplanner/domain test transforms-fillet transforms-chamfer` → all pass; ≥20 it() blocks across the two files.
- **Gate FC-P1-PainterTests:** `pnpm --filter editor-2d test paintPreview hit-test osnap` → all pass; new bulge-related cases included.
- **Gate FC-P1-Typecheck:** `pnpm typecheck` clean.
- **Gate FC-P1-Biome:** `pnpm check` clean.

### Phase 2 — Fillet tool (`F`)

**Goal:** Wire the Fillet operator generator end-to-end. Selection → first entity → second entity → commit dispatches per pair type. Sub-option `[Radius]` sets the working radius for this run and persists to `editorUiStore.fillet.radius`.

**Files:** see §3.1.

**Steps:**

1. Extend `editorUiStore` (`ui-state/store.ts`) with `fillet: { radius: number }`. Default `1.0`. Action `setFilletRadius(r: number)` clamps `r > 0`.

2. Author `tools/fillet.ts` `filletTool` async generator following `rotateTool` template (`tools/rotate.ts:25-37` pattern):
   - **Yield 1** — `"Select first object or [Radius]"` accepting `'entity' | 'subOption'`.
     - On `'subOption'` R/Radius: yield `"Specify fillet radius <{current}>"` accepting `'number'`. Clamp `> 0`. Persist via `setFilletRadius`. Loop back to Yield 1.
     - On `'entity'`: store as `firstEntity`, advance to Yield 2.
   - **Yield 2** — `"Select second object"` accepting `'entity'`. Live preview via `previewBuilder` reads `editorUiStore.overlay.hoverPrimitiveId` and constructs a `fillet-preview` shape against the stored `firstEntity` + current radius.
   - **Commit** — classify pair:
     - both LinePrimitive (different IDs): `filletTwoLines(l1, l2, radius, pickHints)`; emit `updatePrimitive(l1.id, l1Updated) ; updatePrimitive(l2.id, l2Updated) ; addPrimitive(newArc)`.
     - both same PolylinePrimitive (same ID): resolve `vertexIdx` from pick hints (closest interior vertex to each pick). Call `filletPolylineCorner(p, vertexIdx, radius)`; emit `updatePrimitive(p.id, result)`.
     - one Line + one Polyline: detect whether the polyline's pickHint is closer to vertex 0 or vertex N-1; if neither (interior segment), abort with command-bar `"Fillet: only polyline endpoint segments supported (interior segment fillet deferred to follow-up)"`. Otherwise call `filletLineAndPolylineEndpoint`.
     - any other combination (point/circle/arc/xline/rectangle, two different polylines, polyline + closed-polyline-interior): abort with `"Fillet: pair not supported in V1"`.
   - On any domain throw: catch, emit command-bar message via `editorUiStore.commandBar.statusMessage`, abort.

3. Register `filletTool` in `tools/index.ts` (alphabetical).

4. Tests in `fillet.test.ts` (~12 cases) — one per row in §3.0 walkthrough table.

**Invariants:**

- **I-FC-5:** each tool commit emits exactly the expected ops per pair-type. Enforcement: per-test assertion of `projectStore.getState().project.primitives` before/after + `zundo` op count.
- **I-FC-6:** aborted tool runs (escape, parallel reject, interior reject, trim-exceeds reject) commit ZERO ops. Enforcement: presence test "abort emits 0 ops".
- **I-FC-7:** `editorUiStore.fillet.radius` persists across tool runs. Enforcement: test "second F invocation reuses radius from first".

**Mandatory completion gates (Phase 2):**

- **Gate FC-P2-Tests:** `pnpm --filter editor-2d test fillet` → all pass; ≥12 it() blocks.
- **Gate FC-P2-Typecheck:** clean.
- **Gate FC-P2-NoStaleAbortMessage:** `rg -n "Fillet:" packages/editor-2d/src/tools/fillet.ts` → 2 matches (the two abort messages exactly as specified above).

### Phase 3 — Chamfer tool (`CHA`)

**Goal:** Same-shape generator with two-distance prompts. Radius semantics replaced by `(d1, d2)` distances; produces straight chamfer segment instead of arc.

**Files:** see §3.1.

**Steps:**

1. Extend `editorUiStore` with `chamfer: { d1: number; d2: number }`. Defaults both `0.5`. Action `setChamferDistances(d1, d2)` clamps both `> 0`.

2. Author `tools/chamfer.ts` mirroring `fillet.ts`. Yield 1 = `"Select first object or [Distance]"`. `D` sub-option opens 2-prompt sub-flow yielding both `"Specify first distance <{d1}>"` and `"Specify second distance <{d2}>"` then loops back.

3. Commit dispatches to chamfer helpers:
   - two-line: `2× UPDATE + 1× CREATE LinePrimitive` (chamfer segment)
   - polyline-internal: `1× UPDATE` with bulge=0 between two new vertices
   - mixed line+polyline-endpoint: `2× UPDATE + 1× CREATE LinePrimitive`

4. Register in `tools/index.ts`.

5. Tests in `chamfer.test.ts` (~12 cases) — mirror Fillet structure with chamfer-specific outputs.

**Invariants:** I-FC-5 / I-FC-6 / I-FC-7 (with `chamfer` slice instead of `fillet`) apply identically.

**Mandatory completion gates (Phase 3):**

- **Gate FC-P3-Tests:** `pnpm --filter editor-2d test chamfer` → all pass; ≥12 it() blocks.
- **Gate FC-P3-Typecheck:** clean.

### Phase 4 — Wiring + registry

**Goal:** Hook tools into keyboard shortcut registry; bump `operator-shortcuts.md` 2.3.0 → 2.4.0.

**Files:** `packages/editor-2d/src/keyboard/shortcuts.ts`, `docs/operator-shortcuts.md`.

**Steps:**

1. Add `F` and `CHA` entries to `shortcuts.ts` referencing `filletTool` and `chamferTool`.
2. Update `docs/operator-shortcuts.md`:
   - Bump version 2.3.0 → 2.4.0.
   - Populate `F` row Notes: `"M1.3b fillet-chamfer Phase 2. V1: two-line + polyline-internal + line+polyline-endpoint. R sub-option sets fillet radius (persists across runs in editorUiStore.fillet.radius). Parallel lines / interior polyline segment / typed objects / closed-poly endpoints rejected with command-bar message."`
   - Populate `CHA` row Notes: `"M1.3b fillet-chamfer Phase 3. V1: two-distance method only ([mEthod] alternation deferred). D sub-option sets both distances (persist in editorUiStore.chamfer.{d1,d2})."`
   - Append changelog entry: `"| 2.4.0 | <execution date> | Add `F` → Fillet, `CHA` → Chamfer. M1.3b fillet-chamfer cluster — see plan `docs/plans/feature/m1-3b-fillet-chamfer.md`. Closes M1.3b cluster Codex Round-2 quality gap #2 (polyline preview painter bulge support). **Minor bump**."` — implementer fills `<execution date>` with the date Phase 4 lands.

**Mandatory completion gates (Phase 4):**

- **Gate FC-P4-RegistryDrift:**
  ```
  rg -n "^\| `F` \||^\| `CHA` \|" packages/editor-2d/src/keyboard/shortcuts.ts
  ```
  (or equivalent — both shortcut rows present).
- **Gate FC-P4-DocVersion:** `head -5 docs/operator-shortcuts.md | rg "^\*\*Version:\*\* 2\.4\.0"` matches.
- **Gate FC-P4-FullSuite:** `pnpm typecheck && pnpm check && pnpm test` all green; tests across all packages pass.

---

## 7) Invariants summary

| ID | Invariant | Phase | Enforcement |
|---|---|---|---|
| I-FC-1 | Domain purity for fillet/chamfer modules | 1 | Grep gate FC-P1-DomainPurity |
| I-FC-2 | Preview painter polyline arc parity (single arcParamsFromBulge SSOT) | 1 | Grep gate FC-P1-ArcParamsSSOT + tests |
| I-FC-3 | Hit-test routes bulged segments through arc-distance | 1 | Test in tests/hit-test.test.ts |
| I-FC-4 | Osnap MID returns arc midpoint for bulged segments | 1 | Test in tests/osnap.test.ts |
| I-FC-5 | Tool commits emit exact op counts per pair-type | 2, 3 | Per-test before/after assertions |
| I-FC-6 | Aborted tool runs commit zero ops | 2, 3 | Presence tests |
| I-FC-7 | `editorUiStore.{fillet,chamfer}` radius/distances persist across runs | 2, 3 | Tests |

---

## 8) Test strategy

**Baseline (current main, sha `630e2a8`):**
- editor-2d: 555 tests across 45 files
- domain: 90 tests

**After (target):**
- editor-2d: +29 tests → 584 (paintPreview +2, hit-test +2, osnap +1, fillet +12, chamfer +12)
- domain: +20 tests → 110 (transforms-fillet 10 + transforms-chamfer 10)

**Cross-test isolation:** every new test owns its own fixture project (no test depends on side effects from another). Standard `vitest`-style.

**Smoke verification (manual, post-execution):**
- Draw two intersecting lines → `F` → click both → verify rounded corner appears, lines trimmed, arc selectable independently.
- Draw an open 4-vertex polyline → `F` → click polyline twice near vertex K=1 → verify polyline now has 5 vertices and the corner is rounded.
- Draw a line meeting a polyline at the polyline's first vertex → `F` → click both → verify line trimmed, polyline endpoint moved, new arc bridges them.
- `CHA` variants of the above (no arc; straight chamfer segment).

---

## 9) Done Criteria (objective pass/fail)

- [ ] All 6 domain helpers exported and tested (Gate FC-P1-DomainTests + I-FC-1)
- [ ] PreviewShape extended with `fillet-preview` + `chamfer-preview` arms; painter dispatches both
- [ ] `drawShiftedPrimitiveOutline` polyline branch handles bulges via shared `arcParamsFromBulge` SSOT (I-FC-2)
- [ ] `hit-test.ts` polyline branch handles bulges (I-FC-3)
- [ ] `osnap.ts` MID handles bulges (I-FC-4)
- [ ] `filletTool` wired and tested per §3.0 walkthrough (I-FC-5/6/7)
- [ ] `chamferTool` wired and tested per §3.0 walkthrough
- [ ] `F` and `CHA` shortcuts registered in `shortcuts.ts`
- [ ] `docs/operator-shortcuts.md` 2.4.0 with both rows populated + changelog entry
- [ ] All gates green: typecheck, biome, full test suite
- [ ] Manual smoke verifies all 4 §8 scenarios

---

## 10) Risks (residual)

| Risk | Mitigation / acceptance |
|---|---|
| Polyline interior-segment Fillet rejection feels limiting in real use | Documented in command-bar message; Join (`J`, deferred to topological cluster) + future plan unblocks |
| `offset.ts` still throws on bulged polylines (existing limitation) | Pre-existing; restated in JSDoc; M1.3c bulged-polyline offset closes |
| User expects `[Multiple]` for chained corner fillets | V1 scope per A8; multi-corner = re-invoke F. Acceptable. |
| Closed-polyline endpoint Fillet edge case | Closed polylines have no "endpoint" — vertex 0 IS interior. Tool rejects via interior-segment guard message. |
| Bulge-aware osnap modes beyond MID (PERP, TAN, NEAR) still chord-approximated | Per `osnap.ts:9` these modes are M1.3c scope. Documented as M1.3c follow-up. |
| Bulge-aware intersection (`snap/intersection.ts`) still line-only | Per snap-engine-extension Phase 1, intersections are line/line only; circle/arc pairs are M1.3c. Same scope cap. |
| Hit-test arc-distance helper might mis-clamp at sweep boundary | Mitigation: I-FC-3 test exercises both ends of sweep range + interior; failure visible at gate. |

---

## 11) Plan-vs-Code Grounding Verification (per §1.4.1)

| Plan claim citing a code construct | File read at authoring time | Match status |
|---|---|---|
| `PolylinePrimitive { vertices, bulges, closed }` shape | `packages/domain/src/types/primitive.ts:65-70` | Match |
| `bulges` length refine in Zod schema | `packages/domain/src/schemas/primitive.schema.ts:56-58` | Match |
| ADR-016 Appendix A: `d = R·tan(θ/2)`; `bulge = tan(θ/4)`; "one UPDATE op" (polyline-internal) | `docs/adr/016-drawing-model.md:191-203` | Match |
| ADR-016 §170 — every consumer must handle bulges; straight-only shortcuts are Blockers | `docs/adr/016-drawing-model.md:170` | Match — drives Phase 1 closure |
| `addPrimitive` / `updatePrimitive` / `deletePrimitive` SSOT | `packages/project-store/src/actions/primitive-actions.ts:9, 16, 25` | Match |
| `F` + `CHA` shortcut rows reserved with empty Notes | `docs/operator-shortcuts.md:78-79` | Match |
| Existing transform pure switch-on-kind pattern | `packages/domain/src/transforms/{rotate,offset}.ts` | Match |
| `paintPolyline.arcParamsFromBulge` exists and computes `(cx, cy, radius, startAngle, endAngle, counterClockwise)` | `packages/editor-2d/src/canvas/painters/paintPolyline.ts:20-46` | Match — Phase 1 step 1 extracts to `_polylineGeometry.ts` |
| `drawShiftedPrimitiveOutline` polyline branch is straight-only (`lineTo` only) | `packages/editor-2d/src/canvas/painters/paintPreview.ts:217-229` | Match — Phase 1 step 6 closes |
| `hit-test.ts` polyline approximates with line segment ("bulge-arc precise hit deferred") | `packages/editor-2d/src/canvas/hit-test.ts:61-69` | Match — Phase 1 step 7 closes |
| `bounding-boxes.ts` already calls `bboxOfPolylineSegment(a, b, bulge)` | `packages/editor-2d/src/canvas/bounding-boxes.ts:116-130` | Match — no change needed |
| `osnap.ts` polyline midpoint uses chord midpoint | `packages/editor-2d/src/snap/osnap.ts:99` region | Match (inferred from comment + grep) — Phase 1 step 8 closes |
| `Operation.targetKind` discriminant + CRUD types per ADR-020 | `docs/adr/020-project-sync.md:42-60` | Match |
| ToolGenerator pattern (async generator yielding prompts) | `packages/editor-2d/src/tools/rotate.ts:25-37` | Match |
| `editorUiStore.viewport.crosshairSizePct` mode resolver routes pick-point on point prompts | `packages/editor-2d/src/canvas/painters/paintCrosshair.ts:30-58` | Match |
| `PreviewShape` discriminated union site for new arm appending | `packages/editor-2d/src/tools/types.ts:117-145` | Match |

All grounding rows: **Match**. No mismatches that would force plan revision per §1.4.1.

---

## Plan Review Handoff

**Plan:** `docs/plans/feature/m1-3b-fillet-chamfer.md`
**Branch:** `feature/m1-3b-fillet-chamfer`
**Status:** Plan authored — awaiting Codex Procedure 02 review

### Paste to Codex for plan review
> Review this plan using the protocol at
> `docs/procedures/Codex/02-plan-review.md` (Procedure 02).
> Apply strict evidence mode. Start from Round 1.
