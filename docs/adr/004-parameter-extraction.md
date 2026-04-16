# ADR-004 — Parameter Extraction Contract

**Status:** ACCEPTED
**Date:** 2026-04-16

## Context

The throughput model, costing engine, and validation engine all need
operational quantities derived from object geometry and parameters. An RTG
block has a TEU slot count. A road has a pavement area. A berth has a crane
position count.

If this derivation is scattered across analysis code, the system becomes
untestable, unstable, and impossible to audit. When a throughput number
changes by 5%, nobody can trace why.

This is the seam between spatial engineering (what planners draw) and
operations analysis (what the commercial model consumes). It is the most
consequential interface in the system.

## Options considered

**A. Analysis code reads geometry directly and derives what it needs.**
Fastest to implement initially. Creates implicit, scattered formulas.
Duplication across throughput and costing modules. No version control over
the formulas. "Why did we get 18,200 TEU?" has no clean answer.

**B. Each object type registers a typed extractor function. Extractors run
at save time.** Clean contract. Always-fresh results. Expensive on every
save for complex projects.

**C. Typed extractors run lazily on demand with a versioned cache keyed by
object geometry fingerprint.** Clean contract plus performance discipline.

## Decision

**Option C** — typed extractors with lazy evaluation and fingerprint-keyed
caching.

Each `ObjectType` registers a `QuantityExtractor`:

```typescript
interface QuantityExtractor {
  object_type: ObjectType;
  version: string;                     // semver, bumped when formula changes

  extract(
    geometry: ProjectGeometry,
    parameters: ObjectParameters,
    scenario_overrides: ScenarioOverrides
  ): QuantityBundle;
}

interface QuantityBundle {
  // Physical quantities
  gross_area_m2?: number;
  net_area_m2?: number;
  length_m?: number;
  volume_m3?: number;

  // Operational quantities
  teu_slots?: number;
  crane_positions?: number;
  truck_lane_length_m?: number;
  berth_length_m?: number;

  // Equipment quantities
  rtg_count?: number;
  gate_lanes?: number;

  // Extensible per object type
  [key: string]: number | string | undefined;

  // Metadata
  extractor_version: string;
  extraction_timestamp: timestamp;
  warnings: ExtractionWarning[];
}
```

**Storage:** extracted bundles are stored in `object_quantities`, keyed by
`(object_id, scenario_id, extractor_version)`. Invalidated when object
geometry or parameters change.

**Scenario overrides:** a scenario can override specific quantity values with
explicit provenance:

```typescript
interface QuantityOverride {
  object_id: UUID;
  scenario_id: UUID;
  quantity_key: string;                // e.g. "teu_slots"
  original_value: number;
  override_value: number;
  override_reason: string;             // required
  overridden_by: UUID;
  overridden_at: timestamp;
  extractor_version: string;           // version at time of override
}
```

**Governance:** the registry of valid extractors lives in
`docs/extraction-registry/`. An object type cannot enter production without
a registry entry. Changing a formula requires bumping the extractor version
and a migration note.

## Consequences

- Every throughput and cost output is traceable to a specific object,
  extractor version, and scenario.
- Changing an extractor formula is a deliberate versioned event.
- Scenario overrides are explicit and reasoned.
- The extraction layer is unit-testable independently of the editor.
- "Why did we get 18,200 TEU?" resolves to a specific extractor version and
  input set.
- Multiple scenarios over the same geometry reuse the cache except where they
  override.

## What this makes harder

- Adding a new object type now requires a registry entry, an extractor
  implementation, and test cases before it can enter the system.
- Changing a formula requires version bumping and triggers recomputation of
  stored bundles across all projects.
- The cost analysis and throughput model cannot take shortcuts by reaching
  into geometry directly — they must go through the extraction layer.
