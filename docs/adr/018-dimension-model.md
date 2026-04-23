# ADR-018 — Dimension Model

**Status:** ACCEPTED
**Date:** 2026-04-23
**Supersedes:** none (new concept)

## Context

ADR-013 (superseded by ADR-021) named "dynamic dimension lines" as an interaction overlay — transient visual feedback, not persisted. ADR-016 reframes PortPlanner as a CAD-adjacent drafting surface where planners annotate drawings with **persistent** dimensions: "this road is 120 m", "this RTG block bay is 6.058 m × 16 m", "this gate approach turns at 90°". These dimensions are part of the drawing planners produce for reviewers, stakeholders, and their future selves.

Two questions need ADR-level decisions:

- Are dimensions an **entity category** in the data model, or purely an overlay?
- If entities, are they **associative** (read referenced geometry; update when it moves) or **parametric** (drive referenced geometry)?

## Options considered

### 1. Dimension persistence

- **A. Overlay-only.** Dimensions are ephemeral UI during drawing, never saved.
- **B. First-class persisted entity.** Dimensions survive save/reload, op-logged, carry layer membership.

### 2. Reference semantics

- **A. Freefloat points.** Dimension stores two points in project-local coordinates. No link to geometry.
- **B. Associative references.** Dimension stores `(targetId, targetPart)` tuples. Moving referenced geometry updates the dimension automatically.
- **C. Parametric (driving).** Dimension value drives referenced geometry.

### 3. Dimension taxonomy

Standard CAD kinds: linear aligned, linear X, linear Y, angular, radius, diameter, arc length, and higher-order (ordinate, baseline, continued, tolerance, leader).

### 4. Style

- **A. Per-dimension style.** Every dimension has its own full style record.
- **B. Style references.** Dimensions reference a `DimensionStyle` entity; styles are reusable.
- **C. No styles in M1.** Single hardcoded render style.

## Decision

| # | Area | Choice | Rationale |
|---|------|--------|-----------|
| 1 | Persistence | **B. First-class persisted entity.** Op-logged via ADR-020 `targetKind: 'dimension'`. | Annotation is authored content. Transient-only loses planner work on every reload. |
| 2 | Reference semantics | **B. Associative.** References are `{ targetId, targetKind: 'primitive' \| 'object' \| 'freefloat', part }`. On referenced geometry mutation, dimensions recompute their measured value from the current target state. **Parametric (C) is explicitly rejected.** | Associative matches 99% of CAD dimension use. Parametric is a rabbit hole (inverse geometry constraints, solver dependency cycles) that does not earn its cost for a port planning tool. |
| 3 | Taxonomy in M1.3c | **Linear aligned, linear X, linear Y, angular, radius, diameter, arc length.** Seven kinds, discriminated via `kind: DimensionKind`. | Matches AutoCAD's core dimension types and covers annotation needs of road / yard / building planning. Ordinate, baseline, continued, tolerance, leader deferred to M2+. |
| 4 | Style | **C. No styles in M1 → B in M2.** M1.3c uses a single hardcoded render style. M2 introduces `DimensionStyle` entity and style FK. `textOverride?: string` and `textOffset?: Point2D` allow per-dimension deviation from measured value / text placement without a style system. | Style infrastructure is ~1 week of work, not load-bearing for M1. Single-style ships sooner and covers the 80% case. |

### Dimension schema

```typescript
type DimensionKind =
  | 'linear-aligned'
  | 'linear-x'
  | 'linear-y'
  | 'angular'
  | 'radius'
  | 'diameter'
  | 'arc-length';

type ReferencePart =
  | { kind: 'vertex'; index: number }                         // polyline, rectangle, polygon
  | { kind: 'endpoint'; which: 'start' | 'end' }              // line, arc
  | { kind: 'center' }                                        // circle, arc, rectangle
  | { kind: 'edge'; index: number }                           // rectangle, polyline edge
  | { kind: 'point'; point: Point2D };                        // freefloat fallback

interface DimensionReference {
  targetId: UUID;
  targetKind: 'primitive' | 'object' | 'freefloat';
  part: ReferencePart;
}

interface Dimension {
  id: DimensionId;                  // UUIDv7
  kind: DimensionKind;
  layerId: LayerId;                 // per ADR-017
  displayOverrides: DisplayOverrides;
  references: DimensionReference[]; // 2 for linear, 3 for angular, 1 for radius/diameter/arc-length
  textOffset?: Point2D;
  textOverride?: string;
  precision: number;                // decimal places, default 2
  unit: 'm' | 'mm' | 'ft' | 'in';   // default 'm'
}
```

### Associative update

When an op mutates an entity that has dimensions referencing it, dimensions are NOT mutated in the op log — the measured value is a **derivation** and recomputes on render or on explicit query. Dimensions persist the *reference structure*, not the *measured value*. Exception: `textOverride` is authoritative when present.

### Deletion propagation

Deleting a referenced entity detaches dimensions that referenced it:
- Reference with `targetKind: 'primitive' | 'object'` converts to `targetKind: 'freefloat'` with the last-known point snapshotted into `part: { kind: 'point', point: ... }`.
- The dimension is NOT deleted — planner annotation survives, detached from (now-gone) geometry. UI indication (stale / detached marker) is UX concern, not ADR.

### Vertex index stability

Polyline edits that insert or remove vertices change downstream vertex indices. Dimension references with `part: { kind: 'vertex', index: N }` where N is at or after the insertion point MUST be renumbered in the same op. See Appendix A.

## Consequences

- Planner annotations persist across sessions.
- Geometry edits auto-update visible dimension values without re-annotating.
- Deletion does not silently destroy planner annotation work.
- Dimension shape is rich enough for M1.3c to ship common cases (distances, angles, radii, arc lengths).
- Style deferral keeps M1.3c scope tight.

## What this makes harder

- Associative reference integrity must be maintained through polyline refactors (mid-polyline insert renumbering).
- Render cost is non-trivial on large projects; level-of-detail and viewport culling mandatory in paint loop (ADR-021).
- Freefloat conversion on delete is additional op-log logic.
- `textOverride` can drift from reality if set and then underlying geometry changes. Accepted — explicit authorial intent.

## Cross-references

- **ADR-016** Drawing Model — primitives are dimension reference targets.
- **ADR-017** Layer Model — dimensions carry `layerId` + `displayOverrides`.
- **ADR-019** Object Model v2 — typed objects are also dimension reference targets.
- **ADR-020** Project Sync v2 — `targetKind: 'dimension'`; vertex-index renumbering emits UPDATE ops in same promotionGroup.
- **ADR-021** 2D Rendering Pipeline v2 — dimensions render via paint loop, no scene graph.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-23 | Initial ADR. Associative-annotative dimensions as first-class entities; seven kinds; no styles in M1. |

---

## Appendix A — Vertex index renumbering

```
insertVertexAfter(polylineId, afterIndex):
  for each dimension D referencing polylineId with part.kind == 'vertex' and part.index > afterIndex:
    D.reference.part.index += 1
  emit UPDATE ops for each affected D, same promotionGroupId as the polyline update

removeVertex(polylineId, vertexIndex):
  for each dimension D referencing polylineId with part.kind == 'vertex':
    if D.reference.part.index == vertexIndex:
      convert reference to freefloat at last-known point
    elif D.reference.part.index > vertexIndex:
      D.reference.part.index -= 1
  emit UPDATE ops for each affected D
```

Execution-level logic in `packages/project-store` mutation reducers. Missing it is a silent data-integrity bug class.

## Appendix B — Non-goals

Ordinate / baseline / continued dimensions — deferred. Tolerance display — deferred. Leader annotations — deferred (different entity category). Per-viewport dimension overrides — deferred. Dimension styles — deferred to M2. Parametric / driving dimensions — rejected.
