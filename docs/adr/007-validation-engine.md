# ADR-007 — Validation Engine

**Status:** ACCEPTED
**Date:** 2026-04-16

## Context

The platform's primary differentiation over AutoCAD plus Excel is not better
drawing. It is the closed feedback loop from geometry through operations back
to the designer. The system tells planners when their layout is inconsistent,
non-compliant, or commercially incoherent.

Validation is not a post-processing audit. It is a core product function.

## Options considered

**A. Validation as UI warnings only, informational.** Users can ignore
warnings silently. Misses the opportunity to close the loop.

**B. Validation as a separate audit module run on demand.** User triggers an
audit, gets a report. Valuable but delayed — user has moved on by the time
they see the report.

**C. Validation integrated into the derivation pipeline, runs on every
change.** Validation is part of the extraction and analysis flow. Results
surface in real time.

## Decision

**Option C.**

Validation rules are first-class, registered per object type and per
cross-object relationship:

```typescript
interface ValidationRule {
  id: string;                          // unique rule identifier
  scope: 'OBJECT' | 'RELATIONSHIP' | 'PROJECT';
  object_types: ObjectType[];          // which types this rule applies to
  severity: 'ERROR' | 'WARNING' | 'INFO';
  version: string;

  validate(context: ValidationContext): ValidationResult[];
}

interface ValidationResult {
  rule_id: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  object_ids: UUID[];                  // objects involved
  message: string;
  metric: { actual: number, required: number, unit: string };
  suggested_fix: string | null;
}
```

**Example rules:**

```
RTG_BLOCK_MAX_LENGTH         length > 250m → WARNING
RTG_BLOCK_MIN_LENGTH         length < 50m → WARNING
TRUCK_LANE_MIN_WIDTH         width < 6.0m → ERROR
STACK_CLEARANCE              girder_height < stack_height + 2m → ERROR
THROUGHPUT_CAPACITY_MISMATCH throughput_target > yard_capacity → WARNING
BERTH_DRAFT_MISMATCH         berth_depth < vessel_draft → ERROR
CIRCULATION_CONFLICT         road_intersection_angle < 20° → WARNING
BUILDING_IN_SETBACK          building < site_boundary_setback → ERROR
ROAD_IN_STACK_ZONE           road centreline in RTG_BLOCK → ERROR
```

**Integration into derivation pipeline:**

```
geometry change
  → quantity extraction (per object)
  → object-level validation
  → cross-object validation
  → analysis computation
  → project-level validation
  → output
```

**Storage:** validation results are stored per object and per project,
invalidated when inputs change. Surfaced in:
- Properties panel for the selected object
- Canvas overlay (warning indicator on affected objects)
- Project-wide validation summary panel

## Consequences

- Every saved state has a validation summary.
- Planners see problems as they draw, not after export.
- Validation rules are versioned and unit-testable.
- The validation engine is queryable: "show me all blocks exceeding max
  length" is a simple filter.
- Critical errors can block scenario approval or export until resolved.
- The validation engine is itself a differentiator — demos for potential
  customers can show the system catching real problems in real time.

## What this makes harder

- Adding a new validation rule requires registering it, implementing it,
  writing test cases including edge cases, and versioning it.
- Cross-object rules require the engine to know dependencies between
  objects — which objects to re-validate when object X changes.
- Performance: every change triggers a validation pass. Must be fast enough
  to not impact editing. Scope rules appropriately (object-scope rules run
  on that object; project-scope rules run on save or on demand).
- Warnings vs errors is a product decision that must be deliberate for each
  rule, not an afterthought.
