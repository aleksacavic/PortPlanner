# ADR-005 — Library Model

**Status:** ACCEPTED
**Date:** 2026-04-16

## Context

Equipment templates, building types, pavement specs, and unit cost rates need
to be reusable across projects, overrideable within projects, and stable
enough that commercial outputs are auditable.

A cost estimate that says "RTG unit rate: $850,000" is meaningless unless the
source and vintage of that rate are recorded. Was it from the platform library
v2.3? Was it overridden by the project team based on a 2024 vendor quote?
Did the scenario further adjust it for a sensitivity test?

## Options considered

**A. Global library with live references.** Projects always see the latest
values. Simple. Destroys auditability — updating the global library silently
changes every project's estimates.

**B. Copy-on-import, no link back.** Projects get a frozen snapshot at start.
Cannot benefit from library updates. No way to trace what was imported from
where.

**C. Four-tier model with versioned snapshots and explicit override
tracking.** Supports governance, auditability, and selective updates.

## Decision

**Option C** — four-tier model.

```
Platform Global Library      ← maintained by platform, semantically versioned
    ↓ tenant imports selected items
Tenant Library               ← org-specific additions and overrides
    ↓ project imports at point-in-time
Project Snapshot             ← frozen copy at import time, records source version
    ↓ project can override individual items
Project Override             ← project-specific rate, spec, or parameter change
    ↓ scenario can further override
Scenario Delta               ← scenario-specific change, does not touch baseline
```

**Every snapshot records:**

```typescript
interface LibrarySnapshot {
  library_item_id: UUID;
  library_version_at_import: string;   // semver of source library
  imported_at: timestamp;
  imported_by: UUID;
  source_library_id: UUID;              // which library this came from
  source_library_type: 'PLATFORM' | 'TENANT';
}
```

**Every override records:**

```typescript
interface LibraryOverride {
  snapshot_id: UUID;
  field_path: string;                   // e.g. "unit_rate.value"
  original_value: any;
  overridden_value: any;
  override_reason: string;              // required
  overridden_by: UUID;
  overridden_at: timestamp;
  attachments: DocumentRef[];           // e.g. vendor quote PDF
}
```

**Rebase operation:** a project can selectively rebase individual items from
a newer library version. This is a deliberate action that records:
- Which item was rebased
- From which version to which version
- What changed in the source
- Whether local overrides were preserved or discarded

## Consequences

- Cost outputs are auditable: "RTG unit rate came from platform library v2.3,
  imported 2024-03-01 by user X, overridden on 2024-05-12 with vendor quote
  attached (doc-1234.pdf), reason: 'local contractor pricing'."
- Platform library updates do not silently change existing project estimates.
- Projects can rebase selectively from newer library versions when desired.
- Tenant-specific regional variants are supported natively.
- Scenario-level sensitivity analysis does not pollute the project baseline.

## What this makes harder

- Library update propagation is not automatic. Projects can drift from the
  latest library and need rebase actions to sync.
- Schema must support versioned library items including tombstones for
  deleted/deprecated items.
- The UI must make library provenance visible without overwhelming users.
  Badges, hover tooltips, and an "audit trail" panel per item.
- Storage is higher than Option A (each project carries its snapshot).
  Acceptable tradeoff for auditability.
