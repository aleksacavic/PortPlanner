# ADR-016 — Drawing Model (Hybrid Primitive + Element Data Model)

**Status:** ACCEPTED
**Date:** 2026-04-23
**Supersedes:** none (new concept)

## Context

Through M1.1 and M1.2 the project was positioned as a **typed-object-first editor**: users would place RTG_BLOCK, ROAD, BUILDING, PAVEMENT, BERTH via dedicated tools, and drawn geometry lived inside `ProjectObject.geometry` per the object model ADR. The accepted 2D rendering ADR named OSNAP / OTRACK / POLAR / dynamic dimension lines as interaction primitives but left the data-model question unanswered: where does drawn geometry live *before* it becomes a typed object, and can it stay there?

Port planners do not draft that way. They open a CAD-adjacent surface, draw lines, polylines, rectangles, circles, arcs, and construction lines (xlines), organise by layer, annotate with dimensions, then classify work into typed objects at the moment of intent, not at the first click. A rigid "pick object type first, then draw" flow fights the mental model from the first interaction.

This ADR reframes the product posture: PortPlanner is a **CAD-adjacent drafting surface where users draft freely in primitives and promote drafts into typed port-yard objects at the moment of classification**. The differentiator (validation-in-the-loop, extractor-to-commercial pipeline, generator) kicks in *after* promotion, not before. This is a change in product narrative; it is explicit here so downstream readers do not re-litigate it.

**Scope of this ADR:** primitives as first-class entities, promotion contract, snap accuracy model, grid as drafting-aid entity, drawn-vs-canonical principle. Layers are covered by ADR-017. Dimensions by ADR-018. Object model extensions (layerId, displayOverrides, sourceKind) live in ADR-019. Operation-log `targetKind` extension lives in ADR-020. Rendering dispatch lives in ADR-021. Tool state machine + command bar live in ADR-022. Extraction-registry constructor governance lands in `docs/extraction-registry/README.md`.

## Options considered

### 1. Primitive persistence

- **A. Transient scaffolding only.** Primitives exist during a draw interaction, are consumed by the tool that emits a typed object, and are never persisted.
- **B. First-class persistent entities.** Primitives have their own schemas, op-log ops, layer FK, style, and survive save / reload. Promotion to typed object is a separate explicit user action.
- **C. Live-linked (bind).** Typed object references a primitive as its live geometry source; editing the primitive edits the object.

### 2. Promotion policy

- **Consume** — primitive vanishes, typed object created.
- **Preserve** — primitive remains, typed object created alongside.
- **Bind** — live reference, object follows primitive.

### 3. Merge path between "draw tool direct" and "draw primitive then promote"

- **Path A — unified pipeline.** Both tool types drive the same primitive-creation plus promotion machinery. "Draw ROAD" = create transient polyline + auto-promote with tool-collected params.
- **Path B — separate code paths.** "Draw ROAD" directly emits a ROAD; promotion is only for explicit primitive→element conversion. Two pipelines maintained in sync.

### 4. Snap coordinate equality

- **A. Epsilon-distance everywhere.** Every coordinate comparison uses a tolerance.
- **B. Copy-bits-on-snap-commit + epsilon for derived logic.** When snapping, the new primitive's vertex inherits the target vertex's exact float bits. Float equality works. Epsilon used only in later derived analysis.
- **C. Snap to a grid of integer microunits.** All coordinates stored as integers in scaled units.

### 5. Primitive types in scope

- Line, polyline (open/closed, straight segments only), rectangle, circle.
- Above plus arc, xline, and point.
- Above plus spline, ellipse, text primitives.

### 6. Grid as drafting aid

- **A. Viewport-local preference.** Grid is per-user view state, not persisted.
- **B. First-class entity.** Grid is a persisted entity with origin, angle, spacings, layer membership, visibility, and snap-active flags.

## Decision

| # | Area | Choice | Rationale |
|---|------|--------|-----------|
| 1 | Primitive persistence | **B. First-class persistent entities.** | Matches planner mental model. Option A forces type commitment at first click. Option C breaks the typed-object geometry-ownership invariant (see ADR-019), complicates extraction, creates lifecycle bugs on primitive delete. |
| 2 | Promotion policy | **Consume.** The source primitive is deleted in the same operation that creates the typed object. A `sourceKind: 'direct' \| 'promoted'` plus `sourceProvenance?: { primitiveKind, promotedAt, primitiveId }` field on the typed object records the origin for audit and undo (declared in ADR-019). No live link. | Consume matches AutoCAD BLOCK insertion semantics, keeps extraction single-source, and is unambiguous on delete. Live binding is revisitable in M2+ if a real need emerges. |
| 3 | Merge path | **Path A — unified pipeline.** "Draw ROAD" tool internally creates a transient polyline primitive, then auto-runs promotion with tool-collected params (no disambiguation dialog when the tool already chose the type). Explicit "draw primitive then right-click → Convert to X" exercises the same promotion code with a parameter dialog. | Single promotion pipeline = DRY. Two pipelines drift. The "confirm vs ask" split is a UI concern on the same code path. |
| 4 | Snap equality | **B. Copy-bits-on-commit + ε = 1e-6 m derived + screen-pixel UI tolerance.** Three distinct tolerances for three concerns; see §Snap accuracy model below. | Coordinate comparison is the problem, not float precision. Copying target-vertex bits at snap commit means float equality works downstream. Epsilon only appears in auto-logic (fillet detection, polyline-join, extractor geometry walks). UI snap tolerance is pixel-based and zoom-aware. |
| 5 | Primitive types in M1.3a | **Point, line, polyline, rectangle, circle, arc, xline.** Seven primitive kinds. Polyline supports both straight and arc segments via the DXF-convention **bulge factor** on each segment. Polylines carry a `closed: boolean` flag (no vertex duplication — segment K connects vertex K to vertex (K+1) mod N when closed). | Point is the zero-dimensional primitive used for reference markers and node snaps. Arc is too common in port layouts to defer. Xline is a genuine geometric primitive (point + angle, infinite line) and fits the category cleanly — layer membership controls its visibility, not an overlay hack. Bulge-encoded arcs in polylines avoid a second segment representation drifting from the first. Spline, ellipse, text deferred pending real demand. |
| 6 | Grid | **B. First-class entity.** Schema: `{ id, origin: Point2D, angle: number, spacingX: number, spacingY: number, layerId: LayerId, visible: boolean, activeForSnap: boolean }`. No data-model exclusivity — any number of grids may be `activeForSnap` simultaneously; priority resolution is an execution-phase concern of the snap engine (ADR-021). | Project-authored drafting decisions (e.g., yard grid anchored to a quay wall) must survive reload and be identical for every user opening the project. `spacingX` / `spacingY` separate because real port grids are rarely square (container = 6.058 m, lane ≠ 6.058 m). Visibility and snap-activeness split because the two modes ("I can see but don't snap" / "I snap but hide") are independently legitimate. |

### Primitive schema shape

```typescript
type PrimitiveKind = 'point' | 'line' | 'polyline' | 'rectangle' | 'circle' | 'arc' | 'xline';

interface PrimitiveBase {
  id: PrimitiveId;              // UUIDv7
  kind: PrimitiveKind;
  layerId: LayerId;             // per ADR-017; required, never null
  displayOverrides: DisplayOverrides;  // per ADR-017
}

interface Point extends PrimitiveBase { kind: 'point'; position: Point2D; }

interface Line extends PrimitiveBase { kind: 'line'; p1: Point2D; p2: Point2D; }

interface Polyline extends PrimitiveBase {
  kind: 'polyline';
  vertices: Point2D[];          // length N
  bulges: number[];             // length N when closed, N-1 when open; bulge=0 => straight
  closed: boolean;
}

interface Rectangle extends PrimitiveBase {
  kind: 'rectangle';
  origin: Point2D;              // one corner
  width: number;                // along localAxisAngle
  height: number;               // perpendicular to localAxisAngle
  localAxisAngle: number;       // radians from project-local +X
}

interface Circle extends PrimitiveBase {
  kind: 'circle';
  center: Point2D;
  radius: number;
}

interface Arc extends PrimitiveBase {
  kind: 'arc';
  center: Point2D;
  radius: number;
  startAngle: number;           // radians, CCW from +X
  endAngle: number;             // radians; endAngle > startAngle by convention
}

interface Xline extends PrimitiveBase {
  kind: 'xline';
  pivot: Point2D;
  angle: number;                // radians
}
```

All point fields store project-local metric coordinates per ADR-001 (Float64).

### Polyline bulge convention

A polyline segment is a straight line when `bulges[k] === 0`, otherwise an arc. `bulge = tan(θ / 4)` where θ is the included angle of the arc swept from vertex K to vertex K+1; sign encodes direction (positive = CCW, negative = CW). The `bulge === 0` degenerate case cleanly represents a line segment with one authoritative encoding. Fillet is a polyline-edit operation (see Appendix A) that mutates adjacent segments and injects an arc segment.

### Promotion contract

1. Each typed object's registry entry declares a `## Constructors` section listing accepted primitive shapes and the parameters a promotion dialog must collect. Registry is SSOT; primitives are ignorant of which objects can be built from them.
2. Runtime inverts the registry into a "given a selected primitive kind / shape, which typed-object targets are valid?" index. UI populates the right-click menu from that index.
3. Invalid promotion (primitive kind not accepted by any target, or shape mismatch) is a **silent absence** in the context menu, never a runtime error.
4. **One primitive per promotion.** Bulk-select → bulk-promote-each is UI sugar over N single-promotion ops. Merging multiple primitives into one typed object requires an explicit PEDIT-style Join operation first, producing a single primitive, then promotion.
5. Promotion emits exactly two operations in the log (per ADR-020): `DELETE` on the primitive and `CREATE` on the typed object. Both carry the same `promotionGroupId: UUID` so undo reverses atomically.
6. The typed object carries `sourceKind: 'direct' | 'promoted'` and, when `'promoted'`, `sourceProvenance: { primitiveKind, promotedAt, primitiveId }`. The primitive itself is gone from the project after promotion — `primitiveId` is historical only.

### Drawn vs canonical geometry

Primitives hold the geometry the user **drew**. Typed objects hold the **canonical** geometry their extractors read (e.g., ROAD centerline, BUILDING footprint, BERTH apron line). The promotion constructor transforms drawn → canonical using constructor-declared parameters. Post-creation geometry operations (e.g., ROAD re-align across center / left / right) work on the canonical form and do **not** require the original primitive. This means:

- The constructor asks "ROAD alignment: center / left / right?" and applies the offset math once; the stored ROAD polyline is always the centerline.
- Re-align post-creation is a separate operation that shifts the centerline by ±width/2 normal to tangent. It runs on any ROAD regardless of how it was born (direct-drawn or promoted).
- Consume-semantics does not constrain this capability because it is not primitive-dependent.

The same principle applies to any typed object whose drawn shape may differ from its canonical shape (BUILDING corner-vs-center anchor, BERTH apron-vs-centerline, etc.). Per-type alignment / offset parameters live in the registry constructor declarations.

### Snap accuracy model

Three distinct tolerances:

1. **Layer 1 — copy-bits on snap commit.** When the user confirms a snap to a target point (endpoint, midpoint, grid node, intersection, etc.), the new primitive's vertex is assigned the target point's exact `(x, y)` floats (structural copy, not recomputed from cursor). Float equality works downstream because bits are identical.
2. **Layer 2 — ε-distance for derived logic.** Where bit-equality is impossible (e.g., analysing two primitives drawn independently that happen to share a vertex), `ε = 1e-6 m` (1 micrometer) in project-local metric: `equal(a, b) := hypot(a.x - b.x, a.y - b.y) < ε`. 1 μm is four orders of magnitude tighter than any CAD user-facing snap grid.
3. **Layer 3 — screen-pixel UI tolerance.** "Is the cursor close enough to this candidate for snap to trigger?" is measured in screen pixels (tolerance ~10 px, tunable), converted to project-local metres via current viewport zoom. UX only, never touches stored data.

These three tolerances MUST NOT be conflated. Violating this (e.g., using ε=1e-6 for UI snap activation) is a **Blocker**.

### GSNAP ordering (informative, not binding here; execution-phase per ADR-021)

Snap priority resolver, highest to lowest: OSNAP (endpoint / midpoint / center / intersection / node) → OTRACK (alignment tracking) → POLAR (angle lock from last point) → GSNAP (grid node) → grid-line fallback. ORTHO is an always-on modifier when toggled.

## Consequences

- PortPlanner is formally a CAD-adjacent drafting surface with a hybrid primitive + element data model. Draft → classify → extract → validate is the canonical authoring flow.
- Canvas tool system in M1.3a ships primitive drafting without typed-object commitment pressure; the closed commercial loop moves from M1.3 to M1.4.
- Promotion is a single atomic code path reused by every "draw X tool" and every "convert primitive to X" flow. Registry-driven constructors mean adding a new typed object in M2 does not change drawing-surface code — only registry entries.
- Snap accuracy is defined at three levels of tolerance, preventing the common CAD bug "these two vertices that look equal compare unequal."
- Xline and grid fit the data model cleanly as drafting aids with layer membership, no overlay hacks.
- Drawn-vs-canonical principle gives a durable answer to alignment / anchor-variance questions without retaining primitives.

## What this makes harder

- Schema surface grows: seven primitive kinds + grid + dimensions (ADR-018) + layers (ADR-017) alongside typed objects. Each has serialiser support, op-log wiring, hit-test, and render paths.
- Promotion audit trail (`sourceKind` / `sourceProvenance`) must be persisted and surfaced in UI contexts that show object origins.
- Three-tolerance snap model is more discipline than a single-ε approach; reviewers must check each use site for the correct tolerance class.
- Milestone 1 no longer closes the end-to-end commercial loop at M1.3. The loop closes at M1.4.
- Polyline bulge encoding requires every downstream consumer (renderer, hit-test, extractor, serializer) to handle arc segments correctly; straight-only shortcuts are Blockers.

## Cross-references

- **ADR-001** Coordinate System — all primitive and grid geometry in project-local metric Float64.
- **ADR-004** Parameter Extraction — extraction reads typed-object geometry only; primitives do not extract. Registry extended with per-object `## Constructors` sections.
- **ADR-017** Layer Model — defines `LayerId`, `DisplayOverrides`, default layer, ByLayer resolution.
- **ADR-018** Dimension Model — defines dimension entity and associative references.
- **ADR-019** Object Model v2 — replaces ADR-002; typed object adds `layerId`, `displayOverrides`, `sourceKind`, `sourceProvenance?`.
- **ADR-020** Project Sync v2 — replaces ADR-010; `Operation` gains `targetKind`, `targetId`, `promotionGroupId?`.
- **ADR-021** 2D Rendering Pipeline v2 — replaces ADR-013; paint loop dispatches on entity kind; snap priority integration surface.
- **ADR-022** Tool State Machine + Command Bar — prompt-driven tool state machines, keyboard routing.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-23 | Initial ADR. Establishes hybrid primitive + element data model, promotion contract, snap accuracy model, grid entity, drawn-vs-canonical principle. |

---

## Appendix A — Fillet as a polyline-edit operation

Fillet takes two adjacent segments of a polyline (meeting at vertex K) and a radius R, replaces vertex K with two vertices P1 and P2 on the respective segments, and inserts an arc segment between them tangent to both:

```
turn angle θ     = angle between seg(K-1 → K) and seg(K → K+1) at vertex K
trim distance d  = R × tan(θ / 2)
P1 = vertex K shifted toward K-1 by distance d
P2 = vertex K shifted toward K+1 by distance d
new arc segment between P1 and P2 has bulge = tan(θ / 4), sign = turn direction
```

Fillet is a pure edit operation emitting one `UPDATE` op (ADR-020). The ROAD registry's `geometry.fillets: number[]` field (per `docs/extraction-registry/ROAD.md`) surfaces per-vertex fillet radius for human readability; the authoritative encoding is bulge-per-segment.

## Appendix B — Closed-polyline invariants

Schema-level invariant: `closed === true` requires `vertices.length >= 3`; violations rejected by Zod schemas in `packages/domain/src/schemas/`. Closing with "C" during draw sets `closed = true` without duplicating vertex 0; the closing segment connects `vertices[N-1] → vertices[0]` with bulge from `bulges[N-1]`.

## Appendix C — Non-goals

This ADR does NOT decide: snap priority tuning (ADR-021 execution-phase), tool state machine specifics (ADR-022), keyboard shortcut bindings, promotion dialog UX, construction-line layer auto-create, closed-primitive hatch/fill rendering, spline/ellipse/leader/text primitives, parametric driving dimensions (ADR-018 rejects them).
