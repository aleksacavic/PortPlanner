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

#### 6.1.0) Closed-polyline decision table (added Rev-2 after Codex Round-1 High-risk #1)

This is the SSOT for who rejects what across the domain/tool boundary. Resolves the prior wording-level ambiguity between A4/A9 (assumptions) and step 2 below (`filletPolylineCorner` throw semantics) vs. Phase 2 step 2 (tool-level interior-segment rejection).

| Input | Owner that decides | Action | Domain throw / tool message |
|---|---|---|---|
| `filletPolylineCorner(p, K, R)` where vertex K has TWO adjacent segments (open `1 ≤ K ≤ N-2` OR closed any K) | **domain** | Compute and return modified polyline | (no throw) |
| `filletPolylineCorner(p, K, R)` where `p.closed === false` AND `K === 0` OR `K === N-1` | **domain** | Throw — endpoint vertex of open polyline has only one adjacent segment, no corner exists | `Error("filletPolylineCorner: open polyline endpoint vertex has no corner")` |
| `filletPolylineCorner(p, K, R)` where computed trim distance ≥ adjacent segment length | **domain** | Throw | `Error("filletPolylineCorner: radius too large for adjacent segment length")` |
| `filletLineAndPolylineEndpoint(line, ah, p, polylineEndpoint, R)` where `p.closed === true` | **domain** | Throw — closed polylines have no endpoint segment | `Error("filletLineAndPolylineEndpoint: polyline must be open (closed polylines have no endpoint)")` |
| Tool: user picks Line A + Line B (different IDs) | **tool** | Dispatch → `filletTwoLines` | (no message — happy path) |
| Tool: user picks Polyline P twice (same ID) with both pickHints near interior vertex K (open `1 ≤ K ≤ N-2` OR closed any K) | **tool** | Dispatch → `filletPolylineCorner(p, K, R)`; `K` resolved from pickHints (closest qualifying vertex to either pick) | (no message) |
| Tool: user picks Polyline P twice (same ID) with pickHints near vertex 0 or N-1 of OPEN polyline | **tool** | Reject pre-domain-call (open polyline endpoint vertex isn't a corner) | command-bar: `"Fillet: open polyline endpoint vertex is not a corner — pick an interior vertex"` |
| Tool: user picks Line A + OPEN Polyline P with P's pickHint near vertex 0 or N-1 | **tool** | Dispatch → `filletLineAndPolylineEndpoint(A, ah, P, 0 or -1, R)` | (no message) |
| Tool: user picks Line A + OPEN Polyline P with P's pickHint near interior vertex (NOT 0 or N-1) | **tool** | Reject pre-domain-call (interior segment fillet deferred) | command-bar: `"Fillet: only polyline endpoint segments supported (interior segment fillet deferred to follow-up)"` |
| Tool: user picks Line A + CLOSED Polyline P (any pickHint) | **tool** | Reject pre-domain-call (closed polylines have no endpoint) | command-bar: `"Fillet: closed polyline has no endpoint segment — pick the polyline twice for an interior fillet, or pick a different pair"` |
| Tool: user picks two DIFFERENT polylines | **tool** | Reject | command-bar: `"Fillet: two-different-polylines not supported in V1"` |
| Tool: user picks any pair containing point/circle/arc/xline/rectangle | **tool** | Reject | command-bar: `"Fillet: pair not supported in V1"` |
| Domain throws unexpectedly mid-commit (e.g., trim-too-large not caught by tool pre-check) | **tool** | Catch domain `Error.message`, surface to command bar verbatim, abort run with 0 ops | command-bar: domain error message |

**Boundary contract:** the tool MUST classify the pair AND check tool-level rejections (closed-polyline-endpoint, interior-segment, two-different-polylines, non-supported kinds) BEFORE calling any domain helper. Domain helpers throw only on their narrow contract violations (single-adjacent vertex, closed polyline passed to endpoint helper, geometry-too-large). Both layers contribute to the user experience but they don't overlap their concerns.

Same table applies to `chamferPolylineCorner` / `chamferLineAndPolylineEndpoint` substituting `(d1, d2)` for `R` and the chamfer messages (`"Chamfer: ..."`).



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

- **I-FC-5:** each tool commit emits exactly the expected ops per pair-type. Enforcement: per-test assertion of `projectStore.getState().project.primitives` before/after.
- **I-FC-6:** aborted tool runs (escape, parallel reject, interior reject, trim-exceeds reject) commit ZERO ops. Enforcement: presence test "abort emits 0 ops".
- **I-FC-7:** `editorUiStore.fillet.radius` persists across tool runs. Enforcement: test "second F invocation reuses radius from first".
- **I-FC-8 (zundo temporal step parity — added Rev-2 after Codex Round-1 High-risk #2):** zundo's `pastStates.length` increases by exactly N after a tool commit, where N matches the §3.0-walkthrough-asserted op count for the pair-type:
  - two-line Fillet → +3
  - polyline-internal Fillet → +1
  - mixed line+polyline-endpoint Fillet → +3
  - aborted run (any cause) → +0

  Enforcement: per-test snapshot `projectStore.getState() /* zundo middleware exposes pastStates */` length before / after each commit. Test names: `"two-line fillet zundo step-count is 3"`, `"polyline-internal fillet zundo step-count is 1"`, `"mixed fillet zundo step-count is 3"`, `"aborted fillet zundo step-count is 0"`.

  Why this matters per Codex finding: AC parity claims (§5 Undo/Redo) require N successive Ctrl+Z presses to restore pre-Fillet state. If the zundo middleware groups ops, that contract breaks silently. The gate locks step count at every commit path.

**Mandatory completion gates (Phase 2):**

- **Gate FC-P2-Tests:** `pnpm --filter editor-2d test fillet` → all pass; ≥15 it() blocks (12 walkthrough cases + 3 zundo step-count cases + abort case = 16 minimum, allow 15+ for robustness).
- **Gate FC-P2-Typecheck:** `pnpm typecheck` clean.
- **Gate FC-P2-NoStaleAbortMessage:** `rg -n "Fillet:" packages/editor-2d/src/tools/fillet.ts` → 5 matches (the five tool-level abort messages from the §6.1.0 decision table: open-poly-endpoint, interior-segment, closed-poly-endpoint, two-different-polylines, pair-not-supported).
- **Gate FC-P2-ZundoStepCount:** `pnpm --filter editor-2d test fillet -t "zundo step-count"` → all 4 it() blocks pass (three pair-types + abort).

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

**Invariants:** I-FC-5 / I-FC-6 / I-FC-7 / I-FC-8 (with `chamfer` slice instead of `fillet`) apply identically. Chamfer zundo step counts: two-line +3, polyline-internal +1, mixed +3, aborted +0 (same shapes; chamfer's CREATE is a LinePrimitive instead of an ArcPrimitive but step count identical).

**Mandatory completion gates (Phase 3):**

- **Gate FC-P3-Tests:** `pnpm --filter editor-2d test chamfer` → all pass; ≥15 it() blocks.
- **Gate FC-P3-Typecheck:** `pnpm typecheck` clean.
- **Gate FC-P3-NoStaleAbortMessage:** `rg -n "Chamfer:" packages/editor-2d/src/tools/chamfer.ts` → 5 matches (mirror of FC-P2-NoStaleAbortMessage).
- **Gate FC-P3-ZundoStepCount:** `pnpm --filter editor-2d test chamfer -t "zundo step-count"` → all 4 it() blocks pass.

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

> File-format note (added Rev-2 after Codex Round-1 Blocker #2): `shortcuts.ts` is a TypeScript file with object-literal shortcut maps (per the read at `packages/editor-2d/src/keyboard/shortcuts.ts:40-65` — `SINGLE_LETTER_SHORTCUTS`, `MULTI_LETTER_SHORTCUTS`, `ToolId` union). `docs/operator-shortcuts.md` is a markdown file with pipe-delimited table rows. The gates below match each file's actual syntax.

- **Gate FC-P4-RegistryDrift-ToolId** (TypeScript union additions):
  ```
  rg -n "^\s+\| 'fillet'\s*$" packages/editor-2d/src/keyboard/shortcuts.ts
  rg -n "^\s+\| 'chamfer'\s*$" packages/editor-2d/src/keyboard/shortcuts.ts
  ```
  Expected: each command returns exactly 1 match (the `ToolId` union additions).
- **Gate FC-P4-RegistryDrift-Single-F** (single-letter Fillet entry):
  ```
  rg -n "^\s+F: 'fillet',\s*$" packages/editor-2d/src/keyboard/shortcuts.ts
  ```
  Expected: exactly 1 match (the `SINGLE_LETTER_SHORTCUTS` `F: 'fillet'` row).
- **Gate FC-P4-RegistryDrift-Multi-CHA** (multi-letter Chamfer entry):
  ```
  rg -n "^\s+CHA: 'chamfer',\s*$" packages/editor-2d/src/keyboard/shortcuts.ts
  ```
  Expected: exactly 1 match (the `MULTI_LETTER_SHORTCUTS` `CHA: 'chamfer'` row).
- **Gate FC-P4-RegistryDrift-DisplayNames** (`TOOL_DISPLAY_NAMES` exhaustiveness — TypeScript will fail typecheck if missing, but a positive grep guards against accidental `null` shadow):
  ```
  rg -n "^\s+fillet: 'FILLET',\s*$" packages/editor-2d/src/keyboard/shortcuts.ts
  rg -n "^\s+chamfer: 'CHAMFER',\s*$" packages/editor-2d/src/keyboard/shortcuts.ts
  ```
  Expected: each returns exactly 1 match.
- **Gate FC-P4-DocFillet** (markdown table row in operator-shortcuts.md `### M1.3b — Promotion + modify operators` section):
  ```
  rg -n "^\| \`F\` \| Fillet \|" docs/operator-shortcuts.md
  ```
  Expected: exactly 1 match.
- **Gate FC-P4-DocChamfer**:
  ```
  rg -n "^\| \`CHA\` \| Chamfer \|" docs/operator-shortcuts.md
  ```
  Expected: exactly 1 match.
- **Gate FC-P4-DocVersion**:
  ```
  rg -n "^\*\*Version:\*\* 2\.4\.0\s*$" docs/operator-shortcuts.md
  ```
  Expected: exactly 1 match (line 3 of the file post-bump).
- **Gate FC-P4-DocChangelog** (changelog row appended):
  ```
  rg -n "^\| 2\.4\.0 \|" docs/operator-shortcuts.md
  ```
  Expected: exactly 1 match.
- **Gate FC-P4-FullSuite**:
  ```
  pnpm typecheck && pnpm check && pnpm test
  ```
  Expected: all packages green; ToolId exhaustiveness in `TOOL_DISPLAY_NAMES` enforced by TypeScript at compile time.

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

## 9) Done Criteria (objective pass/fail — every row maps to a gate ID)

> Rev-2 (Codex Round-1 Blocker #3): every Done Criteria row MUST map to a named gate with command + expected output. Rows previously requiring "manual smoke" are moved to §9.1 (Acceptance verification, post-gate, pre-merge — separate from objective gates).

| # | Done Criteria | Gate ID | Command | Expected output |
|---|---|---|---|---|
| 1 | 6 domain helpers exported + tested | FC-P1-DomainTests | `pnpm --filter @portplanner/domain test transforms-fillet transforms-chamfer` | ≥20 it() blocks pass; 0 fail |
| 2 | Domain modules import only from `@portplanner/domain` | FC-P1-DomainPurity | `rg -n "^import .* from '@portplanner/(editor-2d\|project-store\|design-system\|project-store-react)'" packages/domain/src/transforms/fillet.ts packages/domain/src/transforms/chamfer.ts` | 0 matches |
| 3 | `arcParamsFromBulge` declared in exactly one site (SSOT) | FC-P1-ArcParamsSSOT | `rg -n "^export function arcParamsFromBulge" packages/editor-2d/src/canvas/painters/` | exactly 1 match in `_polylineGeometry.ts` |
| 4 | Preview painter polyline branch arc-aware | FC-P1-PainterTests | `pnpm --filter editor-2d test paintPreview` | ≥2 new it() blocks pass: "bulged polyline arc segment" + "fillet-preview" arm |
| 5 | Hit-test polyline branch arc-aware | FC-P1-PainterTests (same suite) | `pnpm --filter editor-2d test hit-test` | ≥1 new it() block: "bulged polyline segment uses arc distance" |
| 6 | Osnap MID polyline branch arc-aware | FC-P1-PainterTests (same suite) | `pnpm --filter editor-2d test osnap` | ≥1 new it() block: "bulged polyline midpoint at arc midpoint" |
| 7 | Phase 1 typecheck + biome clean | FC-P1-Typecheck + FC-P1-Biome | `pnpm typecheck && pnpm check` | exit 0; 0 errors |
| 8 | `filletTool` wired with all walkthrough cases passing | FC-P2-Tests | `pnpm --filter editor-2d test fillet` | ≥15 it() blocks pass |
| 9 | Fillet zundo step-count locked per pair-type | FC-P2-ZundoStepCount | `pnpm --filter editor-2d test fillet -t "zundo step-count"` | 4/4 pass (two-line +3, polyline-internal +1, mixed +3, abort +0) |
| 10 | Fillet tool emits exactly the 5 expected abort messages | FC-P2-NoStaleAbortMessage | `rg -n "Fillet:" packages/editor-2d/src/tools/fillet.ts` | exactly 5 matches |
| 11 | `chamferTool` wired with all walkthrough cases passing | FC-P3-Tests | `pnpm --filter editor-2d test chamfer` | ≥15 it() blocks pass |
| 12 | Chamfer zundo step-count locked per pair-type | FC-P3-ZundoStepCount | `pnpm --filter editor-2d test chamfer -t "zundo step-count"` | 4/4 pass |
| 13 | Chamfer tool emits exactly the 5 expected abort messages | FC-P3-NoStaleAbortMessage | `rg -n "Chamfer:" packages/editor-2d/src/tools/chamfer.ts` | exactly 5 matches |
| 14 | `ToolId` union extended with `'fillet'` and `'chamfer'` | FC-P4-RegistryDrift-ToolId | `rg -n "^\s+\| 'fillet'\s*$" packages/editor-2d/src/keyboard/shortcuts.ts && rg -n "^\s+\| 'chamfer'\s*$" packages/editor-2d/src/keyboard/shortcuts.ts` | each: exactly 1 match |
| 15 | `F → fillet` in `SINGLE_LETTER_SHORTCUTS` | FC-P4-RegistryDrift-Single-F | `rg -n "^\s+F: 'fillet',\s*$" packages/editor-2d/src/keyboard/shortcuts.ts` | exactly 1 match |
| 16 | `CHA → chamfer` in `MULTI_LETTER_SHORTCUTS` | FC-P4-RegistryDrift-Multi-CHA | `rg -n "^\s+CHA: 'chamfer',\s*$" packages/editor-2d/src/keyboard/shortcuts.ts` | exactly 1 match |
| 17 | `TOOL_DISPLAY_NAMES` exhaustive for fillet + chamfer | FC-P4-RegistryDrift-DisplayNames | `rg -n "^\s+fillet: 'FILLET',\s*$" packages/editor-2d/src/keyboard/shortcuts.ts && rg -n "^\s+chamfer: 'CHAMFER',\s*$" packages/editor-2d/src/keyboard/shortcuts.ts` | each: exactly 1 match |
| 18 | `docs/operator-shortcuts.md` `F` row populated | FC-P4-DocFillet | `rg -n "^\| \`F\` \| Fillet \|" docs/operator-shortcuts.md` | exactly 1 match |
| 19 | `docs/operator-shortcuts.md` `CHA` row populated | FC-P4-DocChamfer | `rg -n "^\| \`CHA\` \| Chamfer \|" docs/operator-shortcuts.md` | exactly 1 match |
| 20 | `operator-shortcuts.md` version bumped 2.3.0 → 2.4.0 | FC-P4-DocVersion | `rg -n "^\*\*Version:\*\* 2\.4\.0\s*$" docs/operator-shortcuts.md` | exactly 1 match |
| 21 | Changelog row appended for 2.4.0 | FC-P4-DocChangelog | `rg -n "^\| 2\.4\.0 \|" docs/operator-shortcuts.md` | exactly 1 match |
| 22 | Full test suite green across all packages | FC-P4-FullSuite | `pnpm typecheck && pnpm check && pnpm test` | exit 0; baseline 555 editor-2d + 90 domain → target 584 + 110 |

### 9.1) Acceptance verification (post-gate, pre-merge)

These are **non-gate** smoke checks performed on the running app after all gates above pass. They are not part of objective Done Criteria but are the user-facing acceptance signal before opening the merge PR. Procedure 03 §3.10 mid-execution discovery captures any drift from these scenarios as a separate process step.

- A1. Draw two intersecting LinePrimitives → `F` → click both → rounded corner appears, lines visibly trimmed, arc selectable independently from each line.
- A2. Draw an open 4-vertex polyline → `F` → click polyline twice near vertex K=1 → polyline now has 5 vertices and visibly rounded corner.
- A3. Draw a line meeting a polyline at the polyline's first vertex → `F` → click both → line trimmed, polyline endpoint moved, new arc bridges them.
- A4. Repeat A1–A3 with `CHA` → identical flow, straight chamfer segment instead of arc.

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
| **Procedure 02 prerequisite — architecture contract baseline** (§0.2 binding ADR list; §0.4 GR-1/GR-2/GR-3; §0.7 deviation protocol) | `docs/procedures/Claude/00-architecture-contract.md:26-50, 131-228, 261-355` | **Match — all referenced ADRs (016/020/023/001) confirmed binding; ADR-010 confirmed superseded by ADR-020 per §0.2 line 52-54; no deviations proposed so §0.7 not invoked** |
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
