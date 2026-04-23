# Parameter Extraction Registry

This directory is the formal contract between the layout editor and every
downstream module — validation, throughput, costing, 3D rendering. Every
object type that contributes to analysis has an entry here. Implementation
follows the specification; specification does not follow implementation.

See ADR-004 for the architectural decision underlying this registry.

## Files

- [`RTG_BLOCK.md`](RTG_BLOCK.md) — Rubber-tyred gantry container stack block
- [`ROAD.md`](ROAD.md) — Road segment
- [`BUILDING.md`](BUILDING.md) — Building footprint with vertical extent
- [`PAVEMENT_AREA.md`](PAVEMENT_AREA.md) — Paved surface polygon
- [`BERTH.md`](BERTH.md) — Berth line with vessel specification

## Cross-object extractors

- [`YARD_CAPACITY_SUMMARY.md`](YARD_CAPACITY_SUMMARY.md) — Aggregate yard
  throughput metrics
- [`GATE_CAPACITY_SUMMARY.md`](GATE_CAPACITY_SUMMARY.md) — Aggregate gate
  throughput metrics

## Entry format

Each entry contains:

```
# OBJECT_TYPE

Version: X.Y.Z

## Inputs
List of parameters and geometry inputs the extractor consumes.

## Outputs
Typed quantities the extractor produces.

## Formulas
How each output is computed from inputs.

## Validation rules
Rules registered against this object type, with severity and threshold.

## Constructors
Primitive shapes that can be promoted into this object type per ADR-016.
Each constructor declares:
  - Accepted primitive kind(s) (e.g., 'polyline', 'line', 'rectangle')
  - Shape precondition(s) on the primitive (e.g., polyline must have
    exactly 2 vertices; rectangle must have non-zero width and height)
  - Parameters the promotion dialog collects from the user (with defaults)
  - How primitive geometry maps onto the object's canonical `geometry`
    fields (per ADR-016's drawn-vs-canonical principle)

## Changelog
Version history with reasons for bumps.
```

### Constructors governance

Constructors are a binding part of the registry entry per ADR-016; they
define the contract between the drafting surface and the typed-object
layer.

- **Adding a new constructor** to an existing object type → **minor
  version bump** on that registry entry (new creation path; existing
  promotion flows unchanged).
- **Changing an existing constructor's** accepted primitive kind, shape
  precondition, or collected parameters → **major version bump** (breaking
  change to the promotion contract).
- **Removing a constructor** → **major version bump**.
- **Invalid promotion** (primitive kind or shape not matching any
  constructor precondition) is a **silent absence in the context menu**,
  never a runtime error (per ADR-016 Promotion contract).
- The primitive → canonical-object-geometry mapping MUST be lossless for
  the fields the extractor reads. If a primitive shape cannot populate a
  required extractor input, that constructor does not exist.

Individual entries (`RTG_BLOCK.md`, `ROAD.md`, etc.) gain their
`## Constructors` sections when the relevant milestone implements
promotion for that object type (M1.3b for RTG_BLOCK; subsequent
milestones for ROAD, BUILDING, PAVEMENT_AREA, BERTH). When an entry's
content changes materially at that point, the previous version is
preserved in `docs/extraction-registry/superseded/` with a `-superseded`
suffix per the supersession discipline adopted 2026-04-23.

## Governance

### Adding a new object type

1. Write the registry entry (this document) first.
2. Implement the `QuantityExtractor` class matching the specification.
3. Register in the `ExtractorRegistry`.
4. Write unit tests covering every output formula and every validation rule
   including edge cases.
5. Only then may the object type enter production.

### Changing an existing extractor

1. Bump the semver version in the registry entry.
2. Add a changelog note: what changed, why, impact on stored results.
3. All stored `QuantityBundle` records with the old version are invalidated
   on deploy.
4. Recomputation runs as a background job.
5. Output values may change for existing projects — this is expected and
   must be communicated to affected users.

### Scenario overrides

A scenario may override any specific output value from an extractor. The
override is explicit, reasoned, and traceable (see ADR-004). Overrides do
not change the extractor; they substitute values at the scenario level.

## Versioning policy

- **Patch bump (X.Y.Z → X.Y.Z+1):** bug fix to formula, same output shape.
- **Minor bump (X.Y.0 → X.Y+1.0):** new optional output field added.
- **Major bump (X.0.0 → X+1.0.0):** existing output field changed, removed,
  or semantics changed.

Major bumps require an ADR documenting the reason and a migration note.
