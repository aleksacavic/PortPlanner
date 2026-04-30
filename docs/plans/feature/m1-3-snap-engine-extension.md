# Plan — M1.3 snap engine extension (circle snapping + intersection registry + Point shape property)

**Branch:** `feature/m1-3-snap-engine-extension`
**Author:** Claude
**Date:** 2026-04-30

## Revision history

| Rev | Date | Trigger | Changes |
|---|---|---|---|
| 1 | 2026-04-30 | Initial draft. User backlog item B5 raised during M1.3 Round 7 manual smoke testing ("why does circle not snap on quadrants or intersection?"). Bundled with the user-requested addition of a `displayShape` property on Point primitives (default `'circle-dot'`) so node-rendering polish lands alongside the snap-engine work. |
| 2 | 2026-04-30 | §1.3 self-audit (3 rounds) revealed: (a) polyline self-intersection is captured today via flat segment iteration — refactored Phase 1 to introduce a `selfIntersect(p)` helper so the dispatcher API is `intersect(a, b)` for distinct-primitive pairs + `selfIntersect(p)` for composites, preserving polyline self-cross behaviour bit-identically; (b) `lineArc` + `arcArc` are nearly-free given the dispatcher already supports them via `lineCircle` / `circleCircle` + sweep filter — flagged in §1.13 for user confirm vs deferred-to-follow-up; (c) schema bump 1.1.0 → 1.2.0 risk surfaced in §1.13 with explicit backward-compat plan via deserializer default-fill. |

## 1. Goal

The circle primitive currently has no snap targets — clicking near a circle yields no `'endpoint'` / `'midpoint'` / `'intersection'` glyph. AC parity: a circle should snap on its 5 grip-positions (center + 4 compass quadrants) and on its intersections with other primitives. The fix is two parallel pieces:

1. **Snap engine extension.** Wire `gripsOf` outputs into the OSNAP candidate generator so the snap-target points are SSOT-aligned with grip-stretch points. Add a new `'quadrant'` snap kind for circle compass points. Build a pairwise **intersection registry** (one dispatcher, per-pair algorithms) replacing the ad-hoc `lineLineIntersection` in `osnap.ts`. Populate the registry with circle pairs (line, circle, arc, polyline-seg, rect-edge). Xline excluded per user direction.

2. **Point primitive shape property.** Add `displayShape: 'dot' | 'x' | 'circle-dot'` to the Point primitive (default `'circle-dot'` — circle outline + 1 px center dot). Painter switches on the shape; properties panel exposes the choice.

## 2. Background / context

### 2.1 Why piecewise intersection algebra (and how the registry resolves the scalability concern)

Industry CAD kernels use one of three patterns for primitive intersection:

1. **Per-pair switch table** (AutoCAD ObjectARX, SolidWorks, Rhino). One `intersect(a, b)` entry point dispatches on `(kindA, kindB)` to a specific helper. Simple, fast, type-checked.
2. **Convert all to NURBS** (OpenCASCADE, Parasolid). Universal curve-curve via numerical root-finding. Heavyweight; needs a numerics library; lossy precision for analytic primitives.
3. **Sample-and-narrow.** Discretize curves, find approximate hits, refine. Robust for arbitrary curves; overkill for our analytic set.

For our 7-kind primitive set (point/line/polyline/rectangle/circle/arc/xline), pattern 1 is correct. The algebra is irreducibly per-pair because:

- line ∩ line = 2 linear equations (matrix solve).
- line ∩ circle = substitute parametric line into x² + y² = r² → quadratic equation → 0/1/2 roots.
- circle ∩ circle = solve two circle equations → 0/1/2 points.
- line ∩ arc = line ∩ circle, then filter by arc sweep.
- arc ∩ arc = circle ∩ circle, then filter by both sweeps.

There is no algebraic reduction to "one model" without throwing analytic precision away (NURBS conversion does this).

**The dispatcher unifies the API**, not the math:

```typescript
// One entry point, exhaustive table, swap-symmetric.
type Kind = Primitive['kind'];
type Algo = (a: Primitive, b: Primitive) => Point2D[];

const TABLE: Partial<Record<Kind, Partial<Record<Kind, Algo>>>> = {
  line:    { line: lineLine, circle: lineCircle, arc: lineArc, ... },
  circle:  { circle: circleCircle, arc: circleArc, polyline: circlePolylineSeg, ... },
  arc:     { arc: arcArc, ... },
};

export function intersect(a: Primitive, b: Primitive): Point2D[] {
  // Composites (rectangle, polyline) decompose to line segments first.
  if (a.kind === 'rectangle') return decomposeRect(a).flatMap((s) => intersect(s, b));
  if (a.kind === 'polyline')  return decomposePoly(a).flatMap((s) => intersect(s, b));
  if (b.kind === 'rectangle' || b.kind === 'polyline') return intersect(b, a); // swap
  // Direct lookup with swap fallback.
  const direct  = TABLE[a.kind]?.[b.kind];
  if (direct)  return direct(a, b);
  const swapped = TABLE[b.kind]?.[a.kind];
  if (swapped) return swapped(b, a);
  return []; // pair not supported (xline-anything, point-anything)
}
```

Properties:
- One entry point; same input/output contract for every pair.
- Symmetry exploited automatically (register `lineCircle` once; both call directions route to it via arg-swap).
- Composites pre-process to line segments before reaching the table — no rectangle×anything entries needed.
- Adding a new primitive kind (e.g. ellipse) = N new entries in the table; no other consumer changes.
- TypeScript narrows `a.kind` per branch; missing pair entries surface at compile time when the table is type-bounded.

This is the same architecture AC's internal kernel uses (different language; identical shape).

### 2.2 SSOT: snap targets are grip-positions

The user's mental model: when an entity is selected, grips render filled at its key points. When NOT selected and the cursor is near, the SAME points render as snap-glyph outlines. Two visual states for one set of points.

`gripsOf(primitive)` (in `canvas/grip-positions.ts`) is the SSOT for those points. Currently:
- circle → 5 grips: center + east/north/west/south.
- arc → 3 grips: start/mid/end.
- line → 2 grips: p1/p2.
- polyline → N grips: vertex-0..vertex-(N-1).
- rectangle → 4 grips: corner-sw/se/ne/nw.
- xline → 2 grips: pivot/direction.
- point → 1 grip: position.

The current `osnap.ts` reproduces a SUBSET of these positions through its own per-kind helpers (`endpointsOf`, `midpointsOf`, `nodesOf`). For circle/arc, `osnap.ts` returns `[]` everywhere — the bug behind B5.

**Fix:** `osnap.ts` consumes `gripsOf()` output, plus midpoints (which are NOT grip positions in the current model — see §3 A4 for the carveout).

### 2.3 Snap-glyph for the new `'quadrant'` kind

Glyph = filled diamond (per AC convention). New case in `paintSnapGlyph.ts`. Per Round 7 backlog B1, the glyph renders OUTLINE-ONLY (consistent with endpoint/midpoint/node).

## 3. Assumptions + locks

- **A1 — Pairwise algebra is irreducible.** Per §2.1; no NURBS conversion. The dispatcher is the only "unified" piece.
- **A2 — Xline excluded from intersection.** Per user direction. xline is an infinite construction line; no edge-like behaviour for snap purposes.
- **A3 — Point-anything intersection is empty.** A point isn't a curve; it doesn't "intersect" anything in the snap sense. `intersect(point, X) = []` always.
- **A4 — Midpoint carveout.** `gripsOf` currently does NOT include line midpoints, rectangle edge midpoints, or polyline segment midpoints. AC's grip set DOES include those (line midpoint = translate-grip, rect edge midpoints = resize-along-edge grips). Bringing line/rect/polyline midpoint GRIPS into existence is out of scope for this plan (it's a grip-stretch contract change). For snap purposes, midpoints are produced by a separate `midpointsOf()` helper (already exists in `osnap.ts`), kept as-is. The user's "snap = grips" model holds for endpoints / vertices / corners / circle quadrants / circle center / arc start-mid-end; midpoints are the small, principled exception.
- **A5 — Quadrant glyph = filled diamond, outline-only stroke.** New case in `paintSnapGlyph.ts`. Side ≈ 8 CSS-px (matches existing endpoint glyph). Token added: `canvas.transient.snap_glyph.quadrant_side` = `'8'`.
- **A6 — Circle center snap = `'node'` kind.** Center is one point on a closed shape; semantically it's a "node" (same as polyline vertex / point primitive). Reusing the existing kind avoids glyph proliferation. `'quadrant'` is reserved for the 4 compass points.
- **A7 — Intersection registry is purely additive.** Existing `lineLineIntersection` in `osnap.ts` becomes the `lineLine` registry entry. Existing line-line intersection behaviour is preserved bit-identically (same numeric output for the same inputs).
- **A8 — `displayShape` is a Point-primitive direct field, not in `displayOverrides`.** It's a structural property (changes the rendered shape), not a style override (color/lineweight). Mirrors `localAxisAngle` on Rectangle, `bulges` on Polyline. Default `'circle-dot'` so existing point primitives auto-upgrade visually.
- **A9 — Hydration: schemaVersion bump from 1.1.0 → 1.2.0.** Old projects (Point without `displayShape`) hydrate with the default `'circle-dot'` filled in by the deserializer. No data migration required because the default matches the new visual default.
- **A10 — Two-stage rollout.** Phase 1 = intersection registry refactor (no behaviour change — line-line still works, plus dispatcher exists with `lineLine` registered). Phase 2 = circle snap + quadrant kind + populated registry. Phase 3 = Point displayShape. Each phase has its own gates + commits.

## 3.1 Plan-vs-code grounding table

| # | Plan claim | File:line | Observed shape | Match |
|---|-----------|-----------|----------------|-------|
| 1 | `gripsOf` returns 5 grips for circle | [grip-positions.ts:50-73](packages/editor-2d/src/canvas/grip-positions.ts:50) | center + east + north + west + south, all with `entityId` + `gripKind` + `position` | Match |
| 2 | `osnap.ts` returns `[]` for circle in endpointsOf | [osnap.ts:55-57](packages/editor-2d/src/snap/osnap.ts:55) | `case 'circle': case 'xline': return [];` | Match |
| 3 | Existing `lineLineIntersection` is segment-clamped | [osnap.ts:97-104](packages/editor-2d/src/snap/osnap.ts:97) | `if (t < 0 || t > 1 || u < 0 || u > 1) return null;` | Match |
| 4 | Snap-glyph paints outline-only post Round-7 B1 | [paintSnapGlyph.ts:77-99](packages/editor-2d/src/canvas/painters/paintSnapGlyph.ts:77) | endpoint/midpoint/node cases call `ctx.stroke()` only — no `ctx.fill()` | Match |
| 5 | `OsnapKind` union excludes `'quadrant'` | [osnap.ts:11](packages/editor-2d/src/snap/osnap.ts:11) | `'endpoint' \| 'midpoint' \| 'intersection' \| 'node'` | Match — additive change to add `'quadrant'` |
| 6 | `SnapHitKind` derives from `OsnapCandidate['kind']` | [priority.ts:23](packages/editor-2d/src/snap/priority.ts:23) | `OsnapCandidate['kind'] \| 'grid-node' \| 'grid-line' \| 'cursor'` | Match — quadrant flows through automatically |
| 7 | Point primitive currently has no displayShape field | [packages/domain/src/primitives.ts](packages/domain/src/primitives.ts) Point interface | `{ kind: 'point', id, layerId, displayOverrides, position }` | Match — additive `displayShape?` field |
| 8 | `paintPoint` renders fixed 2-px dot | [paintPoint.ts:5](packages/editor-2d/src/canvas/painters/paintPoint.ts:5) | `const POINT_RADIUS_PX = 2;` plus `ctx.arc + fill` | Match — switch case to be added |
| 9 | `gatherOsnapCandidates` orchestrates all OSNAP kinds | [osnap.ts:138-149](packages/editor-2d/src/snap/osnap.ts:138) | per-primitive endpointsOf + midpointsOf + nodesOf + global intersectionsOf | Match — refactor target |
| 10 | `priority.ts` resolveSnap iterates candidates with screen tolerance | [priority.ts:48-63](packages/editor-2d/src/snap/priority.ts:48) | OSNAP stage gathers + tolerance-filters + picks closest | Match — no change needed; quadrants ride through automatically |

## 4. Scope

### In scope
- New file: `packages/editor-2d/src/snap/intersection.ts` (registry + per-pair algorithms).
- Refactor: `packages/editor-2d/src/snap/osnap.ts` to consume `gripsOf` for endpoint/node/quadrant points + delegate intersections to the new registry.
- New token: `canvas.transient.snap_glyph.quadrant_side` (CSS-px stringified, default `'8'`).
- New snap kind: `'quadrant'` added to `OsnapKind`.
- New painter case: `paintSnapGlyph.ts` `'quadrant'` branch (filled diamond geometry, outline-only stroke per B1).
- Domain change: `Point` primitive gets optional `displayShape: 'dot' | 'x' | 'circle-dot'` field (additive, default-on-deserialize handled in `deserialize`).
- Painter change: `paintPoint.ts` switches on `displayShape`.
- Properties panel: dropdown for the Point shape (small UI addition).
- Schema version bump 1.1.0 → 1.2.0 in `Project` + deserializer back-fills `displayShape: 'circle-dot'` for legacy points.
- Tests:
  - `snap/intersection.test.ts` — per-pair algorithm correctness (line-circle 0/1/2 roots, circle-circle 0/1/2 points, arc filtering by sweep, decomposition for rectangle/polyline).
  - `snap/osnap.test.ts` — extended to cover circle quadrant + center candidates + intersection candidates from registry.
  - `paintSnapGlyph.test.ts` — new `'quadrant'` case (diamond geometry: 4 lineTo, closePath, stroke-only).
  - `paintPoint.test.ts` — three displayShape branches.
  - `paint.ts` smoke (circle snap end-to-end through the existing scenario harness).

### Out of scope
- Adding line midpoint / rect edge midpoint / polyline segment midpoint as GRIPS (that's a grip-stretch contract change; midpoints stay snap-only via the existing `midpointsOf` carveout per A4).
- Xline ∩ anything (per user direction; xline excluded from intersection registry).
- Tangent / perpendicular / parallel snap modes (M1.3c+).
- Editing intersections — they're snap-only; selecting an intersection point doesn't pick the involved primitives.
- Light-theme token population (deferred to Milestone 5 with the rest of light-mode work).

## 5. Phases

### Phase 1 — Intersection registry refactor

**Goal:** Stand up the dispatcher with one registered pair (`lineLine`, ported verbatim from `osnap.ts`). No behaviour change. After this phase, `osnap.ts:intersectionsOf` calls the registry; existing line-line snap behaviour is bit-identical.

**Steps:**
1. Create `packages/editor-2d/src/snap/intersection.ts`.
2. Define `type IntersectAlgo = (a: Primitive, b: Primitive) => Point2D[]`.
3. Define `TABLE: Partial<Record<Kind, Partial<Record<Kind, IntersectAlgo>>>>`.
4. Port `lineLineIntersection` from `osnap.ts:97-104` into a `lineLine` algorithm in the new module. Wrap it to take `(line1: Primitive, line2: Primitive)` and narrow internally.
5. Implement two entry points:
   - `intersect(a, b)` — distinct-primitive dispatcher with rectangle/polyline decomposition + swap-symmetric lookup.
   - `selfIntersect(p)` — single-primitive self-intersection. Returns `[]` for atomic kinds (line/circle/arc/point/xline). For composites (polyline / rectangle): decompose to segments, pairwise iterate, return all internal crossings. **Required to preserve current behaviour where `osnap.ts:intersectionsOf` puts all segments from all primitives into one flat array and pairs them — a single polyline's self-crossings are captured today.**
6. Implement `decomposeRect(rect): Line[]` and `decomposePoly(poly): Line[]` helpers (return synthetic Line primitives — no `id`, just `kind: 'line'` + `p1` + `p2` + minimal layer stub for type compatibility).
7. Refactor `osnap.ts:intersectionsOf` to:
   ```
   for (let i = 0; i < primitives.length; i++) {
     out.push(...selfIntersect(primitives[i]));
     for (let j = i + 1; j < primitives.length; j++) {
       out.push(...intersect(primitives[i], primitives[j]));
     }
   }
   ```
   This is N + N(N-1)/2 calls vs the current S² pairwise on flat segments where S = total segment count. Same set of intersections, cleaner separation.
8. Delete the inline `lineLineIntersection` helper from `osnap.ts:97-104`. Per I-SNAP-3 grep gate, it must live ONLY in `intersection.ts` after this phase.
9. Run all existing snap tests — they must pass unchanged.

**Phase 1 gates (explicit commands):**
- REM8-P1-DispatcherExists: `rg -l "export function intersect" packages/editor-2d/src/snap/intersection.ts` → 1 match.
- REM8-P1-LineLineRegistered: new unit test `intersection.test.ts` asserts `intersect(line1, line2)` returns the same point as the legacy `lineLineIntersection` for a battery of fixtures (parallel, intersecting, T-junction, end-touch, no-overlap).
- REM8-P1-OsnapRefactor: existing `osnap.test.ts` passes unchanged (proves the refactor preserved behaviour).
- REM8-P1-Typecheck: `pnpm typecheck` clean.
- REM8-P1-Lint: `pnpm check` clean.
- REM8-P1-Tests: `pnpm --filter @portplanner/editor-2d test` passes (no regression vs main 430/430).

### Phase 2 — Circle snap (gripsOf SSOT + quadrant kind + populated registry)

**Goal:** Circle snap targets light up. Cursor near circle center → node glyph. Cursor near a compass quadrant → diamond glyph (new). Cursor on a circle-line / circle-circle intersection → × glyph.

**Steps:**
1. Add `'quadrant'` to `OsnapKind` union in `osnap.ts:11`.
2. Add `quadrant_side: '8'` to `TransientTokens.snap_glyph` interface + dark theme.
3. Refactor `osnap.ts` to source endpoint / node / quadrant candidates from `gripsOf(primitive)` instead of the ad-hoc per-kind helpers. Mapping:
   - `gripKind` `'p1'`/`'p2'` (line) → `'endpoint'`.
   - `gripKind` `'corner-*'` (rectangle) → `'endpoint'`.
   - `gripKind` `'vertex-N'` (polyline) → `'node'` for closed polylines + first/last as `'endpoint'` for open polylines (matches current behaviour).
   - `gripKind` `'start'`/`'end'` (arc) → `'endpoint'`.
   - `gripKind` `'mid'` (arc) → `'midpoint'`.
   - `gripKind` `'center'` (circle) → `'node'`.
   - `gripKind` `'east'`/`'north'`/`'west'`/`'south'` (circle) → `'quadrant'`.
   - `gripKind` `'position'` (point) → `'node'`.
   - `gripKind` `'pivot'` / `'direction'` (xline) → SKIPPED (xline gets no snap glyph per user direction; the xline construction marker isn't a snap target).
4. Keep `midpointsOf` as-is (per A4 carveout).
5. Implement intersection algorithms and register them. Five required pair-helpers + one bonus block (see §1.13 question Q-Bonus for the lineArc / arcArc decision):
   - **Required** (covers user's B5 ask):
     - `lineCircle(line: Line, circle: Circle): Point2D[]` — substitute parametric line into circle equation, solve quadratic, segment-clamp.
     - `circleCircle(c1: Circle, c2: Circle): Point2D[]` — standard two-circle solution; 0 if disjoint or one inside other, 1 if tangent, 2 otherwise.
   - **Bonus** (decided in §1.13 — included by default per Rev-2 audit; cheap given the dispatcher exists):
     - `lineArc(line: Line, arc: Arc): Point2D[]` — `lineCircle` with the arc's center+radius, then filter by arc sweep.
     - `circleArc(circle: Circle, arc: Arc): Point2D[]` — `circleCircle` with the arc's circle, filter by arc sweep.
     - `arcArc(a1: Arc, a2: Arc): Point2D[]` — `circleCircle` with both arcs' circles, filter by both sweeps.
6. Add `'quadrant'` case in `paintSnapGlyph.ts`: filled diamond geometry (4 lineTo from N → E → S → W back to N, closePath, stroke).
7. Done-criteria scenario: hover circle center → node glyph; hover compass point → diamond glyph; cross a circle with a line and hover the intersection → × glyph.

**Phase 2 gates:**
- REM8-P2-CircleQuadrantsSnap: `osnap.test.ts` covers the 4 compass-point candidates produced for a sample circle.
- REM8-P2-CircleCenterSnap: `osnap.test.ts` covers the center candidate (kind `'node'`).
- REM8-P2-LineCircleIntersect: `intersection.test.ts` covers 0-root (line misses circle), 1-root (tangent), 2-root (chord) cases with closed-form expected points.
- REM8-P2-CircleCircleIntersect: `intersection.test.ts` covers disjoint / one-inside-other / tangent / 2-point cases.
- REM8-P2-ArcSweepFilter: `intersection.test.ts` covers `lineArc` filtering — same line, two arcs with same circle but different sweeps; only one returns the intersection point.
- REM8-P2-QuadrantGlyph: `paintSnapGlyph.test.ts` `'quadrant'` case asserts diamond shape (4 lineTo, closePath, stroke; no fill per B1).
- REM8-P2-XlineExcluded: `intersection.test.ts` — `intersect(xline, anything)` returns `[]`.
- REM8-P2-Typecheck/Lint/Tests: clean.

### Phase 3 — Point primitive `displayShape` field

**Goal:** Point primitives render in one of three shapes. Default `'circle-dot'` (circle outline + 1 px center dot). Old projects auto-upgrade.

**Steps:**
1. Extend `Point` interface in `packages/domain/src/primitives.ts` with `displayShape?: 'dot' | 'x' | 'circle-dot'`.
2. Extend `Point` deserializer to fill `displayShape: 'circle-dot'` when the field is missing (legacy projects).
3. Bump `Project.schemaVersion` 1.1.0 → 1.2.0.
4. Refactor `paintPoint.ts` to switch on `displayShape`:
   - `'dot'` — current behaviour (filled 2-px circle).
   - `'x'` — two diagonal stroke lines forming ×.
   - `'circle-dot'` — outline circle (radius 4) + filled 1-px center dot.
5. Add a `displayShape` dropdown to the Properties panel for selected Point primitives.
6. Schema-version test in `domain` ensures legacy hydration produces `displayShape: 'circle-dot'`.

**Phase 3 gates:**
- REM8-P3-PointShapeDefault: `domain` test asserts `deserialize(legacyPointJson)` yields `displayShape: 'circle-dot'`.
- REM8-P3-PaintPointBranches: `paintPoint.test.ts` covers all 3 shapes.
- REM8-P3-SchemaBump: `Project.schemaVersion` literal-test asserts `'1.2.0'`.
- REM8-P3-PropPanel: Properties-panel test asserts the dropdown renders + dispatches `updatePrimitive` action.
- REM8-P3-Typecheck/Lint/Tests: clean.

## 6. Architecture impact

- **ADR-016 (snap engine).** `OsnapKind` extended with `'quadrant'` (additive). Snap-priority cascade unchanged — quadrants ride through the existing OSNAP stage at the same priority as endpoint/midpoint/node. No new stage. Documented in ADR-016 changelog.
- **Domain schema (Project).** Bumped to 1.2.0. `Point` interface gets optional `displayShape`. Backward-compatible hydration via deserializer default-fill.
- **Token doc (`docs/design-tokens.md`).** Bump 1.4.0 → 1.5.0 (additive). New `canvas.transient.snap_glyph.quadrant_side` leaf.
- **No painter SSOT changes.** `_tokens.ts` helper from Round 7 stays the same. Quadrant painter consumes via `parseNumericToken`.

## 7. Tests

### Net-new tests
- `snap/intersection.test.ts` — ~25 tests:
  - dispatcher: lookup, swap symmetry, decomposition (rectangle / polyline), point-anything = [], xline-anything = [].
  - lineLine: parallel, intersect-mid, intersect-at-endpoint, no-overlap, coincident.
  - lineCircle: 0-root (miss), 1-root (tangent), 2-root (chord). Segment clamping (line entirely inside circle vs crossing into it).
  - circleCircle: disjoint, one-inside-other, externally tangent, internally tangent, two-point overlap.
  - lineArc: hits arc / hits the underlying circle but outside arc sweep.
  - circleArc: same logic.
  - arcArc: same logic.
- `snap/osnap.test.ts` — ~10 net-new:
  - circle quadrants × 4.
  - circle center.
  - cross-primitive intersection: line crossing circle yields 2 intersection candidates.
- `paintSnapGlyph.test.ts` — 1 net-new: quadrant diamond geometry.
- `paintPoint.test.ts` — 3 net-new: dot / x / circle-dot shape branches.
- `domain` deserialize test — 1 net-new: legacy point hydrates with `displayShape: 'circle-dot'`.

**Total net-new: ~40 tests.** Target final count ≥ 470 (430 main + 40 net-new).

### Tests not added (out of scope)
- No grip-stretch test for line midpoint / rect edge midpoint (not in scope per A4).
- No xline-circle intersection test (xline excluded per A2).

## 8. Mandatory completion gates per phase

Each phase has its own gate list (above). All gates use **explicit reproducible commands** per Codex Round-2 quality polish from Round 7.

## 9. Invariants + enforcement

- **I-SNAP-1 — Snap-target SSOT.** `gripsOf(primitive)` is the single source for endpoint/node/quadrant snap candidates. `osnap.ts` consumes it; does NOT hard-code per-kind point lists for those categories. Enforcement: the `osnap.ts` per-kind helpers `endpointsOf` / `nodesOf` are deleted in Phase 2 (search by name returns zero matches outside test fixtures). REM8-P2-OsnapSSOTGrep gate asserts.
- **I-SNAP-2 — Midpoint carveout.** Midpoints are produced by `midpointsOf()` separately from `gripsOf` (per A4). Enforcement: `osnap.test.ts` retains its midpoint coverage; the helper stays in `osnap.ts`.
- **I-SNAP-3 — Intersection dispatcher.** Every pair-wise intersection routes through `intersect(a, b)` in `intersection.ts`. No bespoke pair math anywhere else. Enforcement: REM8-P1-OsnapRefactor + grep gate `rg "lineLineIntersection|circleCircleIntersection" packages/editor-2d/src` returns matches only in `intersection.ts`.
- **I-SNAP-4 — Xline excluded.** `intersect(xline, X) = []` for all X. Enforcement: REM8-P2-XlineExcluded test.
- **I-PT-1 — Point displayShape default.** Legacy points (no field) hydrate as `'circle-dot'`. Enforcement: REM8-P3-PointShapeDefault deserialize test.

## 10. Risks + mitigations

| Risk | Mitigation |
|------|-----------|
| Refactoring `osnap.ts` to consume `gripsOf` regresses an existing snap behaviour we don't have a test for | Phase 1 lands the dispatcher refactor WITHOUT touching the candidate-generation path (still using the local helpers). Phase 2 then swaps in `gripsOf`. Each phase has its own commit + gate run; if Phase 2 regresses, we can revert Phase 2 alone without losing the dispatcher work. |
| Floating-point precision on tangent / one-root cases trips test assertions | Tests use `toBeCloseTo` with explicit tolerance (1e-9 metric). Tangent points are computed in closed form; tests assert closed-form expectations. |
| Schema bump 1.1.0 → 1.2.0 breaks existing project files | Default-fill in deserializer ensures legacy points get `'circle-dot'` automatically. No data migration; just default. Existing project-store tests cover hydration roundtrip. |
| `'quadrant'` glyph clashes visually with `'node'` (filled circle) | Diamond shape is geometrically distinct from circle. Per B1, both render outline-only — visual differentiation by shape, not fill. |
| Properties-panel dropdown for `displayShape` adds chrome surface | Small surface, single dropdown. No new modal. Reuses existing `PropertiesPanel` row pattern. |
| Adding `'quadrant'` to `SnapHitKind` requires touching paint dispatch | Existing dispatch in `paintSnapGlyph.ts` is a switch on kind. Adding a case is purely additive. TypeScript exhaustiveness check catches anywhere else that needs to know about the new kind. |

## 11. Done criteria

- [ ] **Intersection dispatcher landed** — `intersect(a, b)` is the single entry point. Existing line-line behaviour preserved bit-identically. Gate REM8-P1-LineLineRegistered + REM8-P1-OsnapRefactor.
- [ ] **Circle snap works** — center renders node glyph; 4 quadrants render diamond glyph; circle-line / circle-circle / line-arc / arc-arc intersections render × glyph. Gates REM8-P2-CircleQuadrantsSnap + REM8-P2-CircleCenterSnap + REM8-P2-LineCircleIntersect + REM8-P2-CircleCircleIntersect + REM8-P2-ArcSweepFilter + REM8-P2-QuadrantGlyph + REM8-P2-XlineExcluded.
- [ ] **Point displayShape works** — three shapes render correctly; default is `'circle-dot'`; legacy projects auto-upgrade; properties panel exposes the choice. Gates REM8-P3-PointShapeDefault + REM8-P3-PaintPointBranches + REM8-P3-SchemaBump + REM8-P3-PropPanel.
- [ ] **Architecture-doc updates committed** — ADR-016 changelog entry; design-tokens.md 1.5.0 with `quadrant_side` leaf; domain schema 1.2.0 documented.
- [ ] **All gates green; typecheck + lint clean across all 3 phases.**
- [ ] **Final test count ≥ 470** (vs main 430 baseline + ~40 net-new).

## Plan Review Handoff

### Files touched by this plan (preview)
- `packages/editor-2d/src/snap/intersection.ts` (new)
- `packages/editor-2d/src/snap/osnap.ts` (refactored)
- `packages/editor-2d/src/snap/priority.ts` (no logic change; OsnapKind union pickup)
- `packages/editor-2d/src/canvas/painters/paintSnapGlyph.ts` (new `'quadrant'` case)
- `packages/editor-2d/src/canvas/painters/paintPoint.ts` (switch on displayShape)
- `packages/design-system/src/tokens/themes.ts` (new leaf)
- `packages/design-system/src/tokens/semantic-dark.ts` (new leaf)
- `packages/domain/src/primitives.ts` (Point.displayShape)
- `packages/domain/src/serialize.ts` (deserializer default-fill)
- `packages/editor-2d/src/chrome/PropertiesPanel.tsx` (Point shape dropdown)
- `docs/design-tokens.md` (1.4.0 → 1.5.0 changelog)
- `docs/adr/016-snap-engine.md` (changelog entry — quadrant added)
- Tests: `intersection.test.ts` (new), `osnap.test.ts`, `paintSnapGlyph.test.ts`, `paintPoint.test.ts`, domain deserialize tests.

### Paste to Codex for plan review
> Review this plan using the protocol at `docs/procedures/Codex/02-plan-review.md` (Procedure 02).
> Apply strict evidence mode. Start from Round 1.
>
> Scope: snap engine extension (circle snapping + intersection registry + Point displayShape).
> Three phases, each gated independently. Plan-vs-code grounding table at §3.1 lists every cited code construct with file:line evidence.
>
> Particular attention requested on:
> - §2.1 architectural argument for the per-pair dispatcher (vs unified NURBS) — confirm this matches industry practice for analytic primitives.
> - A4 midpoint carveout — confirm the principled exception is acceptable, or push back if you think `gripsOf` should grow to include line/rect/poly midpoints (which would require grip-stretch contract changes out of scope here).
> - Phase ordering — Phase 1 dispatcher refactor with no behaviour change, then Phase 2 swaps in `gripsOf`, then Phase 3 displayShape. Justify or push back on the staging.
