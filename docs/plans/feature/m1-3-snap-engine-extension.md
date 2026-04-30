# Plan — M1.3 snap engine extension (circle snapping + intersection registry + Point shape property)

**Branch:** `feature/m1-3-snap-engine-extension`
**Author:** Claude
**Date:** 2026-04-30

## Revision history

| Rev | Date | Trigger | Changes |
|---|---|---|---|
| 1 | 2026-04-30 | Initial draft. User backlog item B5 raised during M1.3 Round 7 manual smoke testing ("why does circle not snap on quadrants or intersection?"). Bundled with the user-requested addition of a `displayShape` property on Point primitives (default `'circle-dot'`) so node-rendering polish lands alongside the snap-engine work. |
| 2 | 2026-04-30 | §1.3 self-audit (3 rounds) revealed: (a) polyline self-intersection is captured today via flat segment iteration — refactored Phase 1 to introduce a `selfIntersect(p)` helper so the dispatcher API is `intersect(a, b)` for distinct-primitive pairs + `selfIntersect(p)` for composites, preserving polyline self-cross behaviour bit-identically; (b) `lineArc` + `arcArc` are nearly-free given the dispatcher already supports them via `lineCircle` / `circleCircle` + sweep filter — flagged in §1.13 for user confirm vs deferred-to-follow-up; (c) schema bump 1.1.0 → 1.2.0 risk surfaced in §1.13 with explicit backward-compat plan via deserializer default-fill. |
| 3 | 2026-04-30 | Codex Procedure 02 Round-1 review (No-Go, 7.2/10) raised 3 blockers + 3 high-risks. **B1:** wrong file path for Point primitive — should be `packages/domain/src/types/primitive.ts:30` (verified via `ls`); grounding table §3.1 corrected, every cited path now spot-checked with `test -f`. **B2:** Point snap-kind drift — current `osnap.ts:25-26` returns the point primitive's position via `endpointsOf`, kind `'endpoint'`. My Rev-1/2 mapping silently changed it to `'node'`. **Decision: preserve `'endpoint'` for point primitive's position** (this plan adds circle snap; not the place to retroactively migrate point semantics). Mapping table updated; explicit gate REM8-P2-PointKindPreserved added. **B3:** "bonus / required" inconsistency between Phase 2 step 5 and Done Criteria — replaced with one canonical **§4.0.1 Supported Pair Matrix** table; lineArc / arcArc / circleArc all marked **required** in Phase 2 (per Codex recommendation: "convert bonus into explicit required-scope matrix"). **H1:** `selfIntersect` parity needs explicit fixtures — added 5 enumerated fixture cases in Phase 1 step 9. **H2:** schema bump strategy was under-specified vs current `z.literal('1.1.0')` — chose **clean-break (Option A)** per GR-1: schema literal flips to `'1.2.0'`; existing 1.1.0 project saves fail to parse with `LoadFailure`. Per architecture-contract §0.6 preproduction mode, this is the standard path (no migration shim). The `displayShape` field is `optional` in the schema with deserializer-side default-fill of `'circle-dot'` for tolerance to in-flight 1.2.0 saves that omit it (e.g., from a partial implementation snapshot), but that's not a backward-compat scaffold for 1.1.0 saves. **H3:** synthetic Line fabrication for decomposition — replaced with internal `Segment = { p1: Point2D; p2: Point2D }` tuple type local to `intersection.ts`. Algorithms take `Segment`, not `LinePrimitive`. No domain-contract pretense. **Quality polish:** §2.1 industry-practice claims softened to "design choice for analytic primitive sets in this codebase's maturity" with no asserted external citations. All phase gates rewritten with exact reproducible commands. `priority.ts` removed from touched-file list (no logic change implied; type union pickup is automatic via `OsnapCandidate['kind']`). |

## 1. Goal

The circle primitive currently has no snap targets — clicking near a circle yields no `'endpoint'` / `'midpoint'` / `'intersection'` glyph. AC parity: a circle should snap on its 5 grip-positions (center + 4 compass quadrants) and on its intersections with other primitives. The fix is two parallel pieces:

1. **Snap engine extension.** Wire `gripsOf` outputs into the OSNAP candidate generator so the snap-target points are SSOT-aligned with grip-stretch points. Add a new `'quadrant'` snap kind for circle compass points. Build a pairwise **intersection registry** (one dispatcher, per-pair algorithms) replacing the ad-hoc `lineLineIntersection` in `osnap.ts`. Populate the registry with circle pairs (line, circle, arc, polyline-seg, rect-edge). Xline excluded per user direction.

2. **Point primitive shape property.** Add `displayShape: 'dot' | 'x' | 'circle-dot'` to the Point primitive (default `'circle-dot'` — circle outline + 1 px center dot). Painter switches on the shape; properties panel exposes the choice.

## 2. Background / context

### 2.1 Design choice: per-pair dispatcher (vs. unified curve-curve via NURBS conversion)

Three architectural shapes are available for primitive-pair intersection in 2D CAD. Listed without external citations — these are descriptions of design space, not appeal to authority:

1. **Per-pair switch table.** One `intersect(a, b)` entry point dispatches on `(kindA, kindB)` to a specific helper per pair. Simple, fast, type-checked at compile time. Each algorithm uses the closed-form algebra appropriate to its pair.
2. **Convert all to NURBS or generic parametric curves.** Universal curve-curve intersection via numerical root-finding. Heavyweight: needs a numerics library, slower per call, lossy precision for analytic primitives, large dependency footprint.
3. **Sample-and-narrow.** Discretize curves into many short segments, find approximate intersections, refine numerically. Robust for arbitrary curves; overkill when all primitives are analytic.

For this codebase's maturity and primitive set (7 analytic kinds: point/line/polyline/rectangle/circle/arc/xline), pattern 1 is the right design choice — it matches the existing `lineLineIntersection` already in `osnap.ts:97-104`, avoids dragging in a numerical kernel before there's a need, and the algebra is irreducibly per-pair because:

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
- **A9 — Schema bump: 1.1.0 → 1.2.0 clean-break (Rev-3 Codex H2 lock).** `ProjectSchema.schemaVersion` flips from `z.literal('1.1.0')` to `z.literal('1.2.0')`. Existing 1.1.0 saves return `LoadFailure` on parse — no migration shim, no dual-accept union. This matches GR-1 + architecture-contract §0.6 preproduction posture (users re-create saved projects). Within 1.2.0, `displayShape` is optional with `.default('circle-dot')` so a partial in-flight 1.2.0 save still parses; this is **not** a backward-compat scaffold for 1.1.0.
- **A10 — Two-stage rollout.** Phase 1 = intersection registry refactor (no behaviour change — line-line still works, plus dispatcher exists with `lineLine` registered). Phase 2 = circle snap + quadrant kind + populated registry. Phase 3 = Point displayShape. Each phase has its own gates + commits.

## 3.1 Plan-vs-code grounding table

Every cited path was verified with `test -f` at Rev-3 authoring time after the Codex Round-1 grounding finding (B1 found the wrong path for the Point primitive). Match column reflects observation against the file at the cited line range.

| # | Plan claim | File:line | Observed shape | Match |
|---|-----------|-----------|----------------|-------|
| 1 | `gripsOf` returns 5 grips for circle | [packages/editor-2d/src/canvas/grip-positions.ts:50-73](packages/editor-2d/src/canvas/grip-positions.ts) | center + east + north + west + south, all with `entityId` + `gripKind` + `position` | Match |
| 2 | `osnap.ts` returns `[]` for circle in `endpointsOf` | [packages/editor-2d/src/snap/osnap.ts:55-57](packages/editor-2d/src/snap/osnap.ts) | `case 'circle': case 'xline': return [];` | Match |
| 3 | Existing `lineLineIntersection` is segment-clamped | [packages/editor-2d/src/snap/osnap.ts:97-104](packages/editor-2d/src/snap/osnap.ts) | `if (t < 0 \|\| t > 1 \|\| u < 0 \|\| u > 1) return null;` | Match |
| 4 | Snap-glyph paints outline-only post Round-7 B1 | [packages/editor-2d/src/canvas/painters/paintSnapGlyph.ts:77-114](packages/editor-2d/src/canvas/painters/paintSnapGlyph.ts) | endpoint/midpoint/node cases call `ctx.stroke()` only — no `ctx.fill()` (verified post-merge of Round-7 commit `c0bc91d`) | Match |
| 5 | `OsnapKind` union excludes `'quadrant'` | [packages/editor-2d/src/snap/osnap.ts:11](packages/editor-2d/src/snap/osnap.ts) | `'endpoint' \| 'midpoint' \| 'intersection' \| 'node'` | Match — additive change adds `'quadrant'` |
| 6 | `SnapHitKind` derives from `OsnapCandidate['kind']` | [packages/editor-2d/src/snap/priority.ts:23](packages/editor-2d/src/snap/priority.ts) | `OsnapCandidate['kind'] \| 'grid-node' \| 'grid-line' \| 'cursor'` | Match — quadrant flows through automatically |
| 7 | **`PointPrimitive` interface (corrected from Rev-1/2 wrong path)** | [packages/domain/src/types/primitive.ts:30-32](packages/domain/src/types/primitive.ts) | `interface PointPrimitive extends PrimitiveBase { kind: 'point'; position: Point2D; }` | Match — additive `displayShape?` field |
| 8 | `PointPrimitiveSchema` zod definition | [packages/domain/src/schemas/primitive.schema.ts:25-29](packages/domain/src/schemas/primitive.schema.ts) | `const PointPrimitiveSchema = z.object({ ... position: Point2DSchema })` | Match — additive `displayShape: z.enum(['dot','x','circle-dot']).default('circle-dot')` |
| 9 | `Project.schemaVersion` literal currently `'1.1.0'` (strict) | [packages/domain/src/schemas/project.schema.ts:20](packages/domain/src/schemas/project.schema.ts) | `schemaVersion: z.literal('1.1.0')` | Match — Phase 3 flips literal to `'1.2.0'` (clean-break per A9 / Codex H2) |
| 10 | Deserializer uses strict `safeParse` with no version negotiation | [packages/domain/src/serialize.ts:27](packages/domain/src/serialize.ts) | `const result = ProjectSchema.safeParse(parsed);` | Match — Phase 3 keeps strict-parse semantics; old saves return `LoadFailure` |
| 11 | `paintPoint` renders fixed 2-px filled dot | [packages/editor-2d/src/canvas/painters/paintPoint.ts:5](packages/editor-2d/src/canvas/painters/paintPoint.ts) | `const POINT_RADIUS_PX = 2;` + `ctx.arc + fill` | Match — switch on `displayShape` to be added |
| 12 | `gatherOsnapCandidates` orchestrates all OSNAP kinds | [packages/editor-2d/src/snap/osnap.ts:138-149](packages/editor-2d/src/snap/osnap.ts) | per-primitive endpointsOf + midpointsOf + nodesOf + global intersectionsOf | Match — refactor target |
| 13 | `point` primitive's position currently snaps as `'endpoint'` (NOT `'node'`) | [packages/editor-2d/src/snap/osnap.ts:24-26](packages/editor-2d/src/snap/osnap.ts) | `case 'point': return [p.position];` inside `endpointsOf` → kind `'endpoint'` | Match — **Rev-3 Codex B2 fix:** preserve `'endpoint'` for point primitive's position; do NOT migrate to `'node'`. |
| 14 | `resolveSnap` OSNAP stage iterates candidates with screen tolerance, picks closest | [packages/editor-2d/src/snap/priority.ts:48-63](packages/editor-2d/src/snap/priority.ts) | candidate gather + tolerance filter + closest pick | Match — no logic change; quadrant kind rides through automatically since `SnapHitKind` derives from `OsnapCandidate['kind']` |

## 4.0.1 Supported intersection-pair matrix (Rev-3 canonical, replaces Rev-1/2 bonus/required ambiguity)

This is the **single source of truth** for which pairs the registry supports after Phase 2. Done Criteria, gates, and tests reference this matrix directly. There is no "bonus" tier — every cell marked `R` is a Phase 2 deliverable; every `D` is explicitly deferred (out of scope).

| pair | Rev-3 status | Algorithm | Phase 2 fixture target |
|------|--------------|-----------|------------------------|
| line ∩ line | **R** (preserved from Phase 1) | `lineLine` (ported verbatim from `osnap.ts:97-104`) | parity fixture battery (parallel / intersect-mid / shared-endpoint / no-overlap / coincident) |
| line ∩ circle | **R** | `lineCircle` (substitute parametric line into circle equation, solve quadratic, segment-clamp) | 0-root (miss) / 1-root (tangent) / 2-root (chord) — closed-form expected points |
| circle ∩ circle | **R** | `circleCircle` (standard two-circle solution) | disjoint / one-inside-other / externally tangent / internally tangent / 2-point overlap |
| line ∩ arc | **R** | `lineArc` (`lineCircle` + arc sweep filter) | line crosses underlying circle inside arc sweep / outside arc sweep |
| circle ∩ arc | **R** | `circleArc` (`circleCircle` + arc sweep filter) | inside / outside arc sweep |
| arc ∩ arc | **R** | `arcArc` (`circleCircle` + both sweep filters) | both arcs include the points / one arc excludes / both exclude |
| (line/circle/arc) ∩ rectangle | **R** (via decomposition) | `decomposeRect(rect): Segment[]` → 4 line-edge calls dispatched per algorithm above | line crosses 2 edges of a rectangle / line tangent to a corner |
| (line/circle/arc) ∩ polyline | **R** (via decomposition) | `decomposePoly(poly): Segment[]` → N line-segment calls | open polyline / closed polyline crosses |
| polyline ∩ polyline | **R** (via decomposition) | `Segment` × `Segment` pairwise via `lineLine` | two open polylines that cross |
| polyline self-intersect | **R** (via `selfIntersect`) | `decomposePoly` + pairwise on segments of the same polyline | figure-8 polyline emits the cross point |
| rectangle self-intersect | **R** (vacuous) | `selfIntersect(rect)` returns adjacent-corner shared points (mirroring current osnap behaviour for line/polyline pairs whose endpoints coincide) | 4 corners as intersection candidates (parity with current behaviour where shared segment endpoints emit as intersections) |
| **xline ∩ anything** | **D** (deferred per user direction) | `intersect(xline, X) === []` | gate REM8-P2-XlineExcluded asserts empty result |
| **point ∩ anything** | **D** (a point isn't a curve in the snap sense) | `intersect(point, X) === []` | gate REM8-P2-PointExcluded asserts empty result |

`R` = Required (Phase 2 deliverable, has fixture). `D` = Deferred (explicitly out of scope, asserted empty).

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
5. Define an internal `Segment` tuple type local to `intersection.ts`:
   ```typescript
   // NOT a domain primitive — purely an internal data carrier for
   // decomposition. No id, no layerId, no display fields. Algorithms
   // take Segment, never LinePrimitive.
   interface Segment { p1: Point2D; p2: Point2D; }
   ```
   Codex Round-1 H3 fix: replaces the Rev-1/2 "synthetic Line primitive with minimal layer stub" idea, which would have violated the domain `LinePrimitive` contract (no `id`, fake `layerId`).
6. Implement two entry points:
   - `intersect(a, b)` — distinct-primitive dispatcher with rectangle/polyline decomposition + swap-symmetric lookup. Decomposition produces `Segment[]`; algorithms accept either `(Primitive, Primitive)` or `(Segment, Segment)` based on what the dispatcher narrowed.
   - `selfIntersect(p)` — single-primitive self-intersection. Returns `[]` for atomic kinds (line/circle/arc/point/xline). For composites (polyline / rectangle): decompose to `Segment[]`, pairwise iterate, return all internal crossings. **Required to preserve current behaviour where `osnap.ts:intersectionsOf` puts all segments from all primitives into one flat array and pairs them — a single polyline's self-crossings are captured today.**
7. Implement `decomposeRect(rect: RectanglePrimitive): Segment[]` and `decomposePoly(poly: PolylinePrimitive): Segment[]` helpers. Return `Segment[]` — pure tuples. No domain-primitive fabrication.
8. Refactor `osnap.ts:intersectionsOf` to:
   ```
   for (let i = 0; i < primitives.length; i++) {
     out.push(...selfIntersect(primitives[i]));
     for (let j = i + 1; j < primitives.length; j++) {
       out.push(...intersect(primitives[i], primitives[j]));
     }
   }
   ```
   This is N + N(N-1)/2 calls vs the current S² pairwise on flat segments where S = total segment count. Same set of intersections, cleaner separation.
9. **H1 parity fixture spec (Codex Round-1 H1 fix).** Before refactoring, lock current behaviour with a parity test suite in `tests/intersection.parity.test.ts`. The suite calls the OLD `osnap.ts:intersectionsOf` (via a temporary alias kept in place during Phase 1) on these fixtures, captures the output, then asserts the NEW `gatherOsnapCandidates` (post-refactor) returns the same set:
   - **F1 — single line:** `intersectionsOf([line])` → `[]`. `selfIntersect(line) === []`.
   - **F2 — single polyline (3 vertices, no self-cross):** `intersectionsOf([poly_ABC])` returns `[B]` (segments AB and BC share endpoint B; current line-line code emits shared endpoints because t/u clamp is inclusive at 0 and 1). `selfIntersect(poly_ABC) === [B]`.
   - **F3 — single polyline (figure-8):** vertices `[A, B, C, D]` where AB and CD cross at point X. `intersectionsOf([poly])` returns `[B, X, C]` (the two adjacency points + the actual crossing). `selfIntersect(poly) === [B, X, C]`.
   - **F4 — two crossing lines:** `intersectionsOf([line1, line2])` returns `[X]` where X is the intersection point. `intersect(line1, line2) === [X]`.
   - **F5 — line-circle (CURRENT behaviour assertion):** `intersectionsOf([line, circle])` returns `[]` today (circle excluded from current segment list). After Phase 2, this becomes `[X1, X2]` for a chord-crossing line. **F5 is a Phase 1 SKIP-marker test** — asserts current `[]` behaviour at Phase 1 commit; flipped to assert `[X1, X2]` at Phase 2 commit. (Locks the behaviour expansion explicitly, no silent drift.)
10. Delete the inline `lineLineIntersection` helper from `osnap.ts:97-104`. Per I-SNAP-3 grep gate, it must live ONLY in `intersection.ts` after this phase.
11. Run all existing snap tests — they must pass unchanged.

**Phase 1 mandatory completion gates (Rev-3 Codex polish — every gate has an explicit reproducible command + expected output):**

| Gate | Command | Expected |
|------|---------|----------|
| REM8-P1-DispatcherExists | `rg -l "^export function intersect" packages/editor-2d/src/snap/intersection.ts` | 1 match |
| REM8-P1-SelfIntersectExists | `rg -l "^export function selfIntersect" packages/editor-2d/src/snap/intersection.ts` | 1 match |
| REM8-P1-LineLineUniqueLocation | `rg -n "function lineLineIntersection\|function lineLine" packages/editor-2d/src` | only `intersection.ts` (zero hits in `osnap.ts` after refactor) |
| REM8-P1-NoSyntheticLineImport | `rg -n "kind: 'line'" packages/editor-2d/src/snap/intersection.ts` | zero hits (decomposition uses `Segment` tuples per H3) |
| REM8-P1-Parity | `pnpm --filter @portplanner/editor-2d test -- intersection.parity.test.ts` | F1–F5 fixtures pass (F5 SKIP-marker asserts current `[]` for line-circle) |
| REM8-P1-OsnapUnchanged | `pnpm --filter @portplanner/editor-2d test -- osnap.test.ts` | all existing tests pass unchanged |
| REM8-P1-Typecheck | `pnpm typecheck` | exit 0 |
| REM8-P1-Lint | `pnpm check` | exit 0 |
| REM8-P1-Tests | `pnpm --filter @portplanner/editor-2d test` | ≥ 430 pass (main baseline; Phase 1 adds ~5 parity tests so realistic ≥ 435) |

### Phase 2 — Circle snap (gripsOf SSOT + quadrant kind + populated registry)

**Goal:** Circle snap targets light up. Cursor near circle center → node glyph. Cursor near a compass quadrant → diamond glyph (new). Cursor on a circle-line / circle-circle intersection → × glyph.

**Steps:**
1. Add `'quadrant'` to `OsnapKind` union in `osnap.ts:11`.
2. Add `quadrant_side: '8'` to `TransientTokens.snap_glyph` interface + dark theme.
3. Refactor `osnap.ts` to source endpoint / node / quadrant candidates from `gripsOf(primitive)` instead of the ad-hoc per-kind helpers. Mapping table (Rev-3 Codex B2 fix — `'position'` for point primitive preserved as `'endpoint'`, NOT migrated to `'node'`):

| primitive kind | `gripKind` (from `gripsOf`) | OSNAP kind output | Rationale |
|----------------|------------------------------|-------------------|-----------|
| line | `'p1'`, `'p2'` | `'endpoint'` | preserves current behaviour |
| rectangle | `'corner-sw'`, `'corner-se'`, `'corner-ne'`, `'corner-nw'` | `'endpoint'` | preserves current behaviour |
| polyline | `'vertex-0'` (open) / `'vertex-(N-1)'` (open) | `'endpoint'` | first/last vertex of open polyline = endpoint |
| polyline | `'vertex-N'` (interior, closed-or-open) | `'node'` | preserves current behaviour |
| arc | `'start'`, `'end'` | `'endpoint'` | preserves current behaviour |
| arc | `'mid'` | `'midpoint'` | preserves current behaviour |
| circle | `'center'` | `'node'` | NEW — center reuses existing kind per A6 |
| circle | `'east'`, `'north'`, `'west'`, `'south'` | `'quadrant'` | NEW — quadrant added to OsnapKind union |
| **point** | `'position'` | **`'endpoint'`** | **Rev-3 Codex B2 fix:** preserve current `osnap.ts:25-26` behaviour; do NOT silently migrate to `'node'`. Locked by gate REM8-P2-PointKindPreserved. |
| xline | `'pivot'`, `'direction'` | SKIPPED | xline gets no snap glyph per user direction (A2) |
4. Keep `midpointsOf` as-is (per A4 carveout).
5. Implement and register **all five algorithms required by the §4.0.1 supported pair matrix**. No "bonus" tier — Rev-3 Codex B3 fix collapses the bonus/required ambiguity into one canonical matrix.
   - `lineCircle(line: Segment, circle: CirclePrimitive): Point2D[]` — substitute parametric line into circle equation, solve quadratic, segment-clamp.
   - `circleCircle(c1: CirclePrimitive, c2: CirclePrimitive): Point2D[]` — standard two-circle solution; 0 if disjoint or one-inside-other, 1 if tangent, 2 otherwise.
   - `lineArc(line: Segment, arc: ArcPrimitive): Point2D[]` — `lineCircle` with arc center+radius, then filter by arc sweep angle.
   - `circleArc(circle: CirclePrimitive, arc: ArcPrimitive): Point2D[]` — `circleCircle` with arc's circle, filter by arc sweep.
   - `arcArc(a1: ArcPrimitive, a2: ArcPrimitive): Point2D[]` — `circleCircle` with both arcs' circles, filter by both sweeps.
6. Add `'quadrant'` case in `paintSnapGlyph.ts`: filled diamond geometry (4 lineTo from N → E → S → W back to N, closePath, stroke).
7. Done-criteria scenario: hover circle center → node glyph; hover compass point → diamond glyph; cross a circle with a line and hover the intersection → × glyph.

**Phase 2 mandatory completion gates:**

| Gate | Command | Expected |
|------|---------|----------|
| REM8-P2-CircleQuadrantsSnap | `pnpm --filter @portplanner/editor-2d test -- osnap.test.ts -t "circle quadrants"` | 4 quadrant candidates emitted per circle (kind `'quadrant'`) |
| REM8-P2-CircleCenterSnap | `pnpm --filter @portplanner/editor-2d test -- osnap.test.ts -t "circle center"` | center candidate emitted with kind `'node'` |
| REM8-P2-PointKindPreserved (Codex B2) | `pnpm --filter @portplanner/editor-2d test -- osnap.test.ts -t "point primitive endpoint kind"` | point primitive's position emits kind `'endpoint'` (NOT `'node'`) — locks Rev-3 decision |
| REM8-P2-LineCircleIntersect | `pnpm --filter @portplanner/editor-2d test -- intersection.test.ts -t "line-circle"` | 0-root / 1-root / 2-root all pass with closed-form expected points |
| REM8-P2-CircleCircleIntersect | `pnpm --filter @portplanner/editor-2d test -- intersection.test.ts -t "circle-circle"` | disjoint / one-inside / tangent / 2-point all pass |
| REM8-P2-ArcSweepFilter | `pnpm --filter @portplanner/editor-2d test -- intersection.test.ts -t "lineArc sweep filter"` | identical line + two arcs sharing a circle but with different sweeps — only one returns the intersection |
| REM8-P2-CircleArcIntersect | `pnpm --filter @portplanner/editor-2d test -- intersection.test.ts -t "circle-arc"` | inside / outside arc sweep cases pass |
| REM8-P2-ArcArcIntersect | `pnpm --filter @portplanner/editor-2d test -- intersection.test.ts -t "arc-arc"` | both-include / one-excludes / both-exclude pass |
| REM8-P2-QuadrantGlyph | `pnpm --filter @portplanner/editor-2d test -- paintSnapGlyph.test.ts -t "quadrant"` | diamond geometry: 4 lineTo + closePath + stroke; assert NO `fill` call |
| REM8-P2-XlineExcluded | `pnpm --filter @portplanner/editor-2d test -- intersection.test.ts -t "xline excluded"` | `intersect(xline, anything) === []` |
| REM8-P2-PointExcluded | `pnpm --filter @portplanner/editor-2d test -- intersection.test.ts -t "point excluded"` | `intersect(point, anything) === []` |
| REM8-P2-OsnapSSOTGrep (I-SNAP-1) | `rg -n "^function endpointsOf\|^function nodesOf" packages/editor-2d/src/snap/osnap.ts` | zero matches (helpers deleted; gripsOf consumed instead) |
| REM8-P2-ParityF5Flipped | `pnpm --filter @portplanner/editor-2d test -- intersection.parity.test.ts -t "F5"` | F5 now asserts line-circle returns `[X1, X2]` (was `[]` at Phase 1 commit; flipped in this phase) |
| REM8-P2-Typecheck | `pnpm typecheck` | exit 0 |
| REM8-P2-Lint | `pnpm check` | exit 0 |
| REM8-P2-Tests | `pnpm --filter @portplanner/editor-2d test` | ≥ 460 pass (Phase 1's ~435 + Phase 2's ~25 net-new) |

### Phase 3 — Point primitive `displayShape` field

**Goal:** Point primitives render in one of three shapes. Default `'circle-dot'` (circle outline + 1 px center dot).

**Schema strategy (Rev-3 Codex H2 fix — clean-break per GR-1, not dual-accept).**

The current schema `packages/domain/src/schemas/project.schema.ts:20` is `z.literal('1.1.0')` — strict literal, no version negotiation. Per architecture-contract §0.6 preproduction mode + GR-1 clean-break posture, Phase 3 takes Option A (clean-break):

- Schema literal flips: `z.literal('1.1.0')` → `z.literal('1.2.0')`.
- Existing 1.1.0 saved projects FAIL to parse → `LoadFailure` returned. No migration shim, no dual-accept union, no version negotiation.
- The `displayShape` field is `optional` in the new 1.2.0 schema with `.default('circle-dot')` so a partial in-flight 1.2.0 save (e.g., from a snapshot taken before the property panel wiring is complete) still parses correctly. **This is NOT backward compat for 1.1.0 — it's tolerance to incomplete 1.2.0 saves during Phase 3 development.**
- Per architecture-contract §0.6: in preproduction we MUST NOT introduce migration shims for stored data. Users with 1.1.0 saves re-create them. This is the standard path.
- If the user later decides they want compat (post-merge, in production), that's a separate plan with explicit deviation approval per architecture-contract §0.7.

**Steps:**
1. Extend `PointPrimitive` interface in **`packages/domain/src/types/primitive.ts:30`** (corrected path per Rev-3 Codex B1 fix) with `displayShape?: 'dot' | 'x' | 'circle-dot'`.
2. Extend `PointPrimitiveSchema` in `packages/domain/src/schemas/primitive.schema.ts:25` with `displayShape: z.enum(['dot', 'x', 'circle-dot']).default('circle-dot')`.
3. Bump `ProjectSchema.schemaVersion` literal: `z.literal('1.1.0')` → `z.literal('1.2.0')`.
4. Refactor `paintPoint.ts` to switch on `displayShape`:
   - `'dot'` — current behaviour (filled 2-px circle).
   - `'x'` — two diagonal stroke lines forming ×.
   - `'circle-dot'` — outline circle (radius 4) + filled 1-px center dot.
5. Add a `displayShape` dropdown to the Properties panel for selected Point primitives. Reuses existing `updatePrimitive` action (no new mutation API).
6. Add unit test in `packages/domain/tests/serialize.test.ts` (or equivalent) asserting:
   - **Legacy reject:** parsing a 1.1.0 project returns `LoadFailure` (not silent upgrade).
   - **1.2.0 default-fill:** a 1.2.0 project with a Point that omits `displayShape` parses successfully and the deserialized PointPrimitive has `displayShape === 'circle-dot'`.
   - **1.2.0 explicit:** a 1.2.0 project with `displayShape: 'x'` round-trips.

**Phase 3 mandatory completion gates:**

| Gate | Command | Expected |
|------|---------|----------|
| REM8-P3-SchemaBump | `pnpm --filter @portplanner/domain test -- project.schema.test.ts -t "schemaVersion 1.2.0"` | parsing a `{ schemaVersion: '1.2.0', ... }` project succeeds; `{ schemaVersion: '1.1.0', ... }` returns `LoadFailure` (clean-break per H2) |
| REM8-P3-PointShapeDefault | `pnpm --filter @portplanner/domain test -- serialize.test.ts -t "displayShape default"` | a 1.2.0 project with a Point that omits `displayShape` round-trips with `'circle-dot'` filled in |
| REM8-P3-PointShapeExplicit | `pnpm --filter @portplanner/domain test -- serialize.test.ts -t "displayShape explicit"` | a 1.2.0 project with `displayShape: 'x'` round-trips bit-identically |
| REM8-P3-LegacyReject | `pnpm --filter @portplanner/domain test -- serialize.test.ts -t "1.1.0 reject"` | a 1.1.0 saved project returns `LoadFailure` (no silent migration) |
| REM8-P3-PaintPointBranches | `pnpm --filter @portplanner/editor-2d test -- paintPoint.test.ts` | three branches: dot (1 arc + fill), x (2 lineTo + stroke), circle-dot (arc + stroke + arc + fill = circle outline + center dot) |
| REM8-P3-PropPanel | `pnpm --filter @portplanner/editor-2d test -- PropertiesPanel.test.tsx -t "Point displayShape dropdown"` | dropdown renders for selected Point + dispatches `updatePrimitive` with the new `displayShape` |
| REM8-P3-Typecheck | `pnpm typecheck` | exit 0 |
| REM8-P3-Lint | `pnpm check` | exit 0 |
| REM8-P3-Tests | `pnpm --filter @portplanner/editor-2d test && pnpm --filter @portplanner/domain test` | ≥ 470 pass total (Phase 2's ~460 + Phase 3's ~10 net-new) |

## 6. Architecture impact

- **ADR-016 (snap engine).** `OsnapKind` extended with `'quadrant'` (additive). Snap-priority cascade unchanged — quadrants ride through the existing OSNAP stage at the same priority as endpoint/midpoint/node. No new stage. Documented in ADR-016 changelog.
- **Domain schema (Project).** Bumped to 1.2.0 via clean-break per GR-1 (Rev-3 Codex H2 fix — replaces the Rev-1/2 "backward-compatible hydration" approach which conflicted with the preproduction clean-break posture). `PointPrimitive` interface gets optional `displayShape` (default `'circle-dot'` via `.default()` in the zod schema for tolerance to in-flight 1.2.0 saves omitting the field — NOT a backward-compat scaffold for 1.1.0 saves). Existing 1.1.0 project files return `LoadFailure` on parse; preproduction users re-create them.
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
- **I-SNAP-3 — Intersection dispatcher SSOT.** Every pair-wise intersection routes through `intersect(a, b)` in `intersection.ts`. No bespoke pair math anywhere else. Enforcement: REM8-P1-LineLineUniqueLocation grep gate.
- **I-SNAP-4 — Xline excluded; point excluded.** `intersect(xline, X) = []` and `intersect(point, X) = []` for all X. Enforcement: REM8-P2-XlineExcluded + REM8-P2-PointExcluded tests.
- **I-SNAP-5 — Point primitive position kind preserved (Rev-3 Codex B2).** A point primitive's `position` snaps as kind `'endpoint'`, NOT `'node'`. This is the explicit decision documented in §3.1 row 13 + Phase 2 mapping table. Enforcement: REM8-P2-PointKindPreserved unit test.
- **I-PT-1 — Point displayShape default + clean-break schema (Rev-3 Codex H2).** New 1.2.0 schema is strict-parse via `z.literal('1.2.0')`. Existing 1.1.0 saves return `LoadFailure` (no migration shim — preproduction clean-break per GR-1). Within 1.2.0, `displayShape` is optional with `.default('circle-dot')` for tolerance to in-flight saves omitting the field. Enforcement: REM8-P3-SchemaBump + REM8-P3-PointShapeDefault + REM8-P3-LegacyReject.

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

References §4.0.1 supported pair matrix as the canonical scope statement (Rev-3 Codex B3 fix — no separate "bonus" tier).

- [ ] **Intersection dispatcher landed.** `intersect(a, b)` + `selfIntersect(p)` are the single entry points. Existing line-line behaviour preserved bit-identically per parity fixtures F1–F4. Gates REM8-P1-DispatcherExists + REM8-P1-SelfIntersectExists + REM8-P1-Parity + REM8-P1-OsnapUnchanged + REM8-P1-LineLineUniqueLocation + REM8-P1-NoSyntheticLineImport.
- [ ] **Circle snap works at every cell of §4.0.1 marked `R`.** Quadrants render diamond glyph; center renders node glyph; circle-line / circle-circle / line-arc / circle-arc / arc-arc intersections all detect; rectangle and polyline decompose correctly. Gates REM8-P2-CircleQuadrantsSnap + REM8-P2-CircleCenterSnap + REM8-P2-LineCircleIntersect + REM8-P2-CircleCircleIntersect + REM8-P2-ArcSweepFilter + REM8-P2-CircleArcIntersect + REM8-P2-ArcArcIntersect + REM8-P2-QuadrantGlyph.
- [ ] **Behaviour preserved at every cell of §4.0.1 marked `D`.** Xline-anything and point-anything return `[]`. Gates REM8-P2-XlineExcluded + REM8-P2-PointExcluded.
- [ ] **Point primitive position snap kind preserved as `'endpoint'`** (Rev-3 Codex B2 lock). Gate REM8-P2-PointKindPreserved.
- [ ] **Phase-1 → Phase-2 behavioural transition explicit, not silent.** F5 parity fixture flips from `[]` (Phase 1) to `[X1, X2]` (Phase 2). Gate REM8-P2-ParityF5Flipped.
- [ ] **Point displayShape works.** Three shapes render correctly; default is `'circle-dot'` for in-flight 1.2.0 saves; legacy 1.1.0 saves are REJECTED per GR-1 clean-break; properties panel exposes the choice. Gates REM8-P3-PointShapeDefault + REM8-P3-PointShapeExplicit + REM8-P3-LegacyReject + REM8-P3-PaintPointBranches + REM8-P3-SchemaBump + REM8-P3-PropPanel.
- [ ] **Architecture-doc updates committed alongside code per architecture-contract §0.5.** ADR-016 changelog entry (quadrant + gripsOf SSOT + point kind preserved); design-tokens.md 1.5.0 with `quadrant_side` leaf; domain schema 1.2.0 changelog.
- [ ] **All gates green; typecheck + lint clean across all 3 phases.**
- [ ] **Final test count ≥ 470** (vs main 430 baseline + ~40 net-new across Phase 1 parity + Phase 2 intersections + Phase 3 schema/paint/props).

## Plan Review Handoff

### Files touched by this plan (Rev-3 — `priority.ts` removed; domain paths corrected)
- `packages/editor-2d/src/snap/intersection.ts` (NEW — dispatcher + algorithms + `Segment` tuple).
- `packages/editor-2d/src/snap/osnap.ts` (refactored — consumes `gripsOf`, calls dispatcher).
- `packages/editor-2d/src/canvas/painters/paintSnapGlyph.ts` (new `'quadrant'` case).
- `packages/editor-2d/src/canvas/painters/paintPoint.ts` (switch on `displayShape`).
- `packages/design-system/src/tokens/themes.ts` (new leaf `snap_glyph.quadrant_side`).
- `packages/design-system/src/tokens/semantic-dark.ts` (populates `quadrant_side: '8'`).
- `packages/domain/src/types/primitive.ts` (`PointPrimitive.displayShape?`).
- `packages/domain/src/schemas/primitive.schema.ts` (`PointPrimitiveSchema` adds `displayShape` enum field).
- `packages/domain/src/schemas/project.schema.ts` (`schemaVersion` literal `'1.1.0'` → `'1.2.0'`).
- `packages/editor-2d/src/chrome/PropertiesPanel.tsx` (Point shape dropdown).
- `docs/design-tokens.md` (1.4.0 → 1.5.0 changelog entry).
- `docs/adr/016-drawing-model.md` (changelog entry — `'quadrant'` added to OsnapKind, gripsOf SSOT, point kind preserved as `'endpoint'`).
- Tests: `tests/intersection.test.ts` (new), `tests/intersection.parity.test.ts` (new), `tests/osnap.test.ts` (extended), `tests/paintSnapGlyph.test.ts` (extended), `tests/paintPoint.test.ts` (extended), `packages/domain/tests/serialize.test.ts` + `project.schema.test.ts` (extended).

**Not touched:** `packages/editor-2d/src/snap/priority.ts` (Rev-2 listed it; Rev-3 drops the listing — `SnapHitKind` derives via `OsnapCandidate['kind']` so adding `'quadrant'` to `OsnapKind` flows through automatically with zero edits in `priority.ts`).

### Paste to Codex for plan review (Rev-3, Round 2)
> Re-review this plan using the protocol at `docs/procedures/Codex/02-plan-review.md` (Procedure 02), strict evidence mode, **Round 2** (continuing from your Round-1 No-Go at 7.2/10).
>
> Round-1 findings addressed in Rev-3:
> - **B1** (wrong file path for Point) — every cited path in §3.1 spot-checked with `test -f`; corrected to `packages/domain/src/types/primitive.ts:30` and `packages/domain/src/schemas/primitive.schema.ts:25`.
> - **B2** (point snap-kind drift) — explicit decision: **preserve `'endpoint'` for point primitive's position**. New invariant I-SNAP-5 + gate REM8-P2-PointKindPreserved. Mapping table updated.
> - **B3** (bonus / required inconsistency) — replaced with single canonical **§4.0.1 Supported Pair Matrix**. All five algorithms (lineCircle, circleCircle, lineArc, circleArc, arcArc) marked Required. Done Criteria references the matrix directly.
> - **H1** (selfIntersect parity under-specified) — added 5 enumerated parity fixtures F1–F5 in Phase 1 step 9. F5 is a SKIP-marker that flips between Phase 1 (`[]` for line-circle, current behaviour) and Phase 2 (`[X1, X2]`, behaviour expansion). Locks the Phase 1→2 transition explicitly.
> - **H2** (schema strategy under-specified) — chose **clean-break (Option A) per GR-1**. `z.literal('1.1.0')` → `z.literal('1.2.0')`; legacy saves return `LoadFailure`; no migration shim. The `displayShape.default('circle-dot')` is for in-flight 1.2.0 tolerance, not 1.1.0 compat.
> - **H3** (synthetic Line fabrication) — replaced with internal `Segment = { p1: Point2D; p2: Point2D }` tuple local to `intersection.ts`. No domain-primitive pretense.
> - **Quality polish** — §2.1 industry-practice claims softened (no asserted external citations); all phase gates rewritten with exact reproducible commands + expected outputs (table format); `priority.ts` removed from touched-file list.
>
> If Round 2 returns Go, hand back to Claude for execution per Procedure 03.
