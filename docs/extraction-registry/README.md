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

## Changelog
Version history with reasons for bumps.
```

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
