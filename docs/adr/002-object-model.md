# ADR-002 — Object Model Contract

**Status:** ACCEPTED
**Date:** 2026-04-16

## Context

Every element in the system — road, building, RTG block, berth, pavement —
must carry sufficient information for rendering, analysis, costing, 3D
projection, and library traceability. These concerns have different audiences:
a drafter editing a road geometry, a cost engineer editing unit rates, a
library manager maintaining global templates.

If all concerns are on the same flat object, a drafter can accidentally mutate
commercial data. If they are fully separated into independent records, the
system becomes unnavigable and cross-concern queries become expensive.

## Options considered

**A. Single flat object with all fields.** Simple in one sense, but conflates
concerns. Junior drafters can accidentally modify cost rates. Schema becomes
unwieldy as the product grows.

**B. Separate tables per concern.** Clean separation. Joins become expensive
for common queries. Schema drift across tables requires careful coordination.

**C. Core object with typed extension records per concern.** Geometry and
classification live on the object. Analysis bindings, cost bindings, and 3D
render metadata are separate records that reference the object by ID.

## Decision

**Option C.**

The core object shape:

```typescript
interface PortObject {
  // Identity — always first-class columns
  id: UUID;
  project_id: UUID;
  scenario_id: UUID | null;        // null = baseline
  type: ObjectType;                 // RTG_BLOCK, ROAD, BUILDING, etc.
  category: ObjectCategory;
  ownership: OwnershipState;        // AUTHORED | GENERATED | FROZEN | DETACHED

  // Geometry — project-local metric
  geometry: GeoJSON;
  geometry_type: GeometryPrimitive;

  // Classification
  classification: string;           // typed per object family

  // Extensible parameters — JSONB
  parameters: ObjectParameters;     // physical and operational hints

  // Traceability
  library_ref: UUID | null;
  library_version: string | null;
  generated_from: UUID | null;      // parent host_space_id if GENERATED

  // Audit
  revision: number;
  created_by: UUID;
  updated_by: UUID;
  created_at: timestamp;
  updated_at: timestamp;
}
```

**Discipline rule:** anything queried, filtered, sorted, joined, or enforced
against in business rules is a first-class column. Anything purely payload —
extensible parameters, rendering hints, override bags — is JSONB. If
`object_type` or `project_id` ends up in JSONB, the discipline has failed.

Analysis bindings, cost bindings, and 3D render metadata are **separate
records** keyed by `object_id`:

```
object_analysis_bindings (object_id, analysis_version, ...)
object_cost_bindings    (object_id, cost_assembly_ref, ...)
object_mesh_descriptors (object_id, geometry_fingerprint, ...)
object_quantities       (object_id, scenario_id, extractor_version, bundle)
```

## Consequences

- Geometry editing cannot accidentally mutate commercial data.
- Cross-concern queries are explicit joins, auditable in code review.
- JSONB is constrained to genuinely extensible payload, not domain identity.
- Object type registry defines valid parameter shapes per type, enforced at
  the API boundary.
- Adding a new concern (e.g. environmental impact bindings) is additive — new
  table, no migration of existing objects.

## What this makes harder

- A full-fidelity object snapshot requires joining multiple tables. Common
  queries need a materialized view or an explicit hydration layer.
- Two-stage writes (object + its bindings) need transaction discipline.
- Simple object-level operations have a few more moving parts than a flat
  schema.
