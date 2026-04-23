# ADR-019 — Object Model v2

**Status:** ACCEPTED
**Date:** 2026-04-23
**Supersedes:** ADR-002 (`docs/adr/superseded/002-object-model-superseded.md`)

## Context

ADR-002 established the typed-object contract: every object carries identity (`id`, `project_id`, `scenario_id`, `type`, `category`), ownership, geometry in project-local metric, classification, extensible `parameters` JSONB, library traceability, and audit fields. Analysis bindings, cost bindings, mesh descriptors, and extracted quantities live in separate records. That framing remains correct.

ADR-016 introduces a hybrid primitive + typed-object data model and ADR-017 introduces a layer model. Typed objects must now:

- Carry **layer membership** (`layerId`), to participate in the drafting surface's organisational axis.
- Carry **per-entity display overrides** (`displayOverrides`) so ByLayer / explicit style resolution applies uniformly to primitives, dimensions, grids, and typed objects.
- Carry **source provenance** (`sourceKind`, `sourceProvenance?`) distinguishing directly-placed objects from promoted-from-primitive ones, per ADR-016's promotion contract.

These are shape changes to the `PortObject` schema. Per the user-approved clean-break supersession discipline (2026-04-23), this ADR replaces ADR-002 rather than amending it.

## Options considered

Same three options as ADR-002:
- **A. Single flat object with all fields.** Conflates concerns.
- **B. Separate tables per concern.** Expensive joins, schema drift.
- **C. Core object with typed extension records per concern.** Geometry + classification on the object; bindings and mesh descriptors separate.

Plus the new-field question:
- **Nullable layerId vs required layerId with default fallback.**
- **`displayOverrides` as nullable columns vs open bag.**
- **`sourceProvenance` on the object vs on a separate audit record.**

## Decision

**Option C** (unchanged from ADR-002) with the following additions.

### Core object shape

```typescript
interface PortObject {
  // Identity — first-class columns
  id: ObjectId;
  projectId: ProjectId;
  scenarioId: UUID | null;          // null = baseline (per ADR-006)
  type: ObjectType;                 // RTG_BLOCK, ROAD, BUILDING, etc.
  category: ObjectCategory;
  ownership: OwnershipState;        // AUTHORED | GENERATED | FROZEN | DETACHED (per ADR-003)

  // Geometry — project-local metric (per ADR-001)
  geometry: GeoJSON;
  geometryType: GeometryPrimitive;

  // Classification
  classification: string;           // typed per object family

  // Extensible parameters — JSONB
  parameters: ObjectParameters;

  // NEW — Layer membership (per ADR-017)
  layerId: LayerId;                 // required, never null; default layer if unspecified
  displayOverrides: DisplayOverrides;  // bag per ADR-017; key missing = ByLayer

  // NEW — Source provenance (per ADR-016)
  sourceKind: 'direct' | 'promoted';
  sourceProvenance?: {
    primitiveKind: PrimitiveKind;   // which primitive kind preceded this object
    promotedAt: string;             // ISO-8601 timestamp of promotion
    primitiveId: PrimitiveId;       // historical reference; primitive no longer exists
  };

  // Traceability (per ADR-005)
  libraryRef?: {
    source: string;
    version: string;
  };
  generatedFrom?: ObjectId;         // parent host_space_id if GENERATED (ADR-003)

  // Audit
  revision: number;
  createdBy: UserId;
  updatedBy: UserId;
  createdAt: string;
  updatedAt: string;
}
```

### New-field decisions

| Field | Decision | Rationale |
|---|---|---|
| `layerId` | **Required, never null.** Default layer fallback at creation time. | Nullable layerId would require null-handling everywhere; default-fallback gives a single universal rule. |
| `displayOverrides` | **Open bag, ADR-017 resolution.** | Schema-extensible for new override keys without migration. |
| `sourceKind` | **First-class column** (not JSONB). | Queryable ("show me all directly-placed roads") and type-discriminated. |
| `sourceProvenance` | **First-class column, optional.** Populated only when `sourceKind === 'promoted'`. | Small, rarely-queried audit record. Separate table would be over-engineering. |

### Separate records (unchanged from ADR-002)

Analysis bindings, cost bindings, mesh descriptors, and quantity bundles remain separate records keyed by `object_id`:

```
object_analysis_bindings (object_id, analysis_version, ...)
object_cost_bindings    (object_id, cost_assembly_ref, ...)
object_mesh_descriptors (object_id, geometry_fingerprint, ...)
object_quantities       (object_id, scenario_id, extractor_version, bundle)
```

### Discipline rule (unchanged from ADR-002)

Anything queried, filtered, sorted, joined, or enforced against in business rules is a first-class column. Anything purely payload (extensible parameters, rendering hints, override bags) is JSONB. If `type` or `projectId` ends up in JSONB, the discipline has failed.

## Consequences

- Typed objects participate in the drafting surface's layer and style systems without special-casing.
- Promotion audit trail (`sourceKind` + `sourceProvenance`) is queryable and survives schema evolution.
- Extraction contract (ADR-004) is unchanged — extractors still read `geometry` + `parameters` only.
- Ownership (ADR-003) unchanged.
- Library traceability (ADR-005) unchanged.
- Scenario model (ADR-006) unchanged; `scenarioId` column remains on every object.

## What this makes harder

- Hydration must seed `layerId` to `LayerId.DEFAULT` if a legacy serialised project lacks it. Preproduction (GR-1) allows clean-break replacement; no migration shim.
- Extractor implementations must tolerate `sourceProvenance` absence (undefined when `sourceKind === 'direct'`).
- Reviewers checking object-model compliance now validate layerId + displayOverrides + sourceKind presence on every persisted object.

## Cross-references

- **ADR-001** Coordinate System — geometry in project-local metric.
- **ADR-003** Ownership States — ownership field semantics unchanged.
- **ADR-004** Parameter Extraction — extraction reads `geometry` + `parameters`; new fields do not affect extraction.
- **ADR-005** Library Model — `libraryRef` unchanged.
- **ADR-006** Scenario Model — `scenarioId` column unchanged; scenarios remain parameter overlays in V1.
- **ADR-016** Drawing Model — defines `sourceKind` / `sourceProvenance` semantics, primitive types, promotion contract.
- **ADR-017** Layer Model — defines `LayerId`, `DisplayOverrides`, default layer, ByLayer resolution.
- **ADR-020** Project Sync v2 — Operation shape; `targetKind: 'object'` covers typed-object mutations.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-23 | Replaces ADR-002. Adds `layerId`, `displayOverrides`, `sourceKind`, `sourceProvenance?` fields. Core Option-C discipline unchanged. |
