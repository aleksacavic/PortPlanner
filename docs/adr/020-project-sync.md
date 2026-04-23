# ADR-020 — Project Sync and Offline Model v2

**Status:** ACCEPTED
**Date:** 2026-04-23
**Supersedes:** ADR-010 (`docs/adr/superseded/010-project-sync-superseded.md`)

## Context

ADR-010 established: project is a serializable value type; operations logged per mutation; object-level last-write-wins on conflicts; offline-capable single-writer V1; CRDT-compatible V2 upgrade path. That model is correct and unchanged at the top level.

The `Operation` interface, however, was scoped to typed objects only — `objectId: UUID` as the target identifier. With ADR-016 introducing primitives as first-class persistent entities, ADR-017 introducing layers, ADR-018 introducing dimensions, and ADR-016 introducing grids, every entity kind now emits operations. A discriminant on `Operation` is required.

Per the user-approved clean-break supersession discipline (2026-04-23), this ADR replaces ADR-010 rather than amending its Operation section. All other sync-model clauses (project-as-value, offline behaviour, conflict resolution, CRDT future compatibility) are restated here unchanged for completeness.

## Options considered

Same three top-level options as ADR-010:
- **A. Server-dependent.** Fails offline use case.
- **B. Full CRDT from day one.** Justified? Not for V1 (small teams, rare simultaneous editing).
- **C. Single-writer offline with deterministic merge on reconnect. Object-level LWW.** Chosen for V1.

Plus the new Operation-shape question:
- **Keep `objectId` and add a parallel field `primitiveId`/`dimensionId`/etc.** Fragments the log.
- **Replace `objectId` with `targetId` + `targetKind` discriminant.** One uniform shape.
- **Separate op-log per entity kind.** Fragments merge semantics.

## Decision

**Option C for V1, Option B design-compatible for V2** (unchanged from ADR-010).

**Uniform Operation shape with `targetKind` discriminant** (new).

### Project as serializable value

The project is a serializable value type. At any moment it is a composite of maps keyed by entity id: `objects`, `primitives`, `dimensions`, `layers`, `grids`. Every mutation produces a new valid project state. The project is never mutated in place at the architectural level.

### Operations

Every mutation is an **operation** logged with:

```typescript
export type OperationType =
  | 'CREATE' | 'UPDATE' | 'DELETE'
  | 'GENERATE' | 'FREEZE' | 'DETACH' | 'UNFREEZE';

export type TargetKind = 'object' | 'primitive' | 'dimension' | 'layer' | 'grid';

export interface Operation {
  id: OperationId;                   // UUIDv7
  projectId: ProjectId;
  sequence: number;                  // local monotonic counter per client
  timestamp: string;                 // ISO-8601 emission time on client
  userId: UserId;                    // emitter identity (LOCAL_USER_ID placeholder in M1)
  type: OperationType;
  targetKind: TargetKind;            // discriminant
  targetId: UUID;                    // branded per kind at use site (ObjectId | PrimitiveId | DimensionId | LayerId | GridId)
  before: TargetSnapshot | null;     // pre-operation state (null on CREATE)
  after: TargetSnapshot | null;      // post-operation state (null on DELETE)
  promotionGroupId?: UUID;           // links atomic DELETE-primitive + CREATE-object on promotion (ADR-016)
}

export type TargetSnapshot =
  | ObjectSnapshot
  | PrimitiveSnapshot
  | DimensionSnapshot
  | LayerSnapshot
  | GridSnapshot;
```

### Offline behaviour

1. Client maintains a local operation log since last sync.
2. Operations apply immediately to local project state.
3. On reconnect, client sends its operation log to the server.
4. Server applies operations in sequence, resolving conflicts at entity level.

### Conflict resolution

**Entity-level last-write-wins** (generalises ADR-010's object-level LWW to cover all entity kinds).

- Two users edited **different** entities (regardless of kind): both changes apply, no conflict.
- Two users edited the **same** entity: the later server-timestamped operation wins. The losing client receives a conflict notification with both versions; user can re-apply their change.

This is not full CRDT. It is not real-time simultaneous editing of the same entity. It handles the primary V1 use case (one planner offline, syncs later; two colleagues working on different parts of the same project).

### Promotion atomicity

Promotion (ADR-016) emits exactly two operations: `DELETE` on the source primitive and `CREATE` on the resulting typed object. Both carry the same `promotionGroupId: UUID`. Undo reverts both atomically via the group id. The operation log handler treats a `promotionGroupId` cluster as a single transactional unit for merge / replay.

### Future CRDT compatibility

The operation log structure is compatible with CRDT adoption. CRDTs refine how conflicts resolve; the operation log model persists. Migrating to a CRDT-based model in V2 is an upgrade of the merge resolution layer, not a rewrite of the sync model.

### Migration concern — none

M1.2 shipped the `Operation` type definition but deferred emission per PI-1. Zero persisted operations exist in any project at the time this ADR lands. No migration shim required (preproduction / GR-1).

## Consequences

- Full offline capability for single-user workflows, extended to cover primitives, dimensions, layers, grids.
- Clean sync for low-contention multi-user workflows across every entity kind.
- Entity-level conflict notification for high-contention cases.
- Single op log across all mutation kinds — uniform merge story.
- Promotion atomicity via `promotionGroupId` keeps consume-semantics transactionally sound.
- V2 multi-user real-time editing remains an additive upgrade.

## What this makes harder

- Client must carry a local operation log with durable storage (IndexedDB per ADR-014).
- Sync protocol must handle partial failures (server accepts some operations, rejects others).
- Timestamp skew between clients — server timestamps authoritative for ordering on conflict.
- Undo across a sync boundary needs a clearly-communicated UI (user undoes locally, which generates reverse ops, rather than attempting to literally reverse time on the server).
- Every reducer in `packages/project-store` must emit correctly-shaped `Operation`s — `targetKind` matches the entity map mutated; `targetId` branded correctly.

## Cross-references

- **ADR-001** Coordinate System — operations preserve project-local metric geometry; no transform at sync.
- **ADR-004** Parameter Extraction — extraction results are derived (not logged); mutations to `parameters` emit UPDATE ops.
- **ADR-014** Persistence Architecture — IndexedDB stores serialised project + op log; Postgres planned for server.
- **ADR-015** Project Store — `zundo` captures operation log as undo history, scoped to project slice.
- **ADR-016** Drawing Model — `promotionGroupId` atomicity for primitive→object conversion.
- **ADR-017** Layer Model — layer mutations emit `targetKind: 'layer'`.
- **ADR-018** Dimension Model — dimension mutations emit `targetKind: 'dimension'`; vertex-index renumbering emits UPDATE ops in the same promotionGroup as the polyline update.
- **ADR-019** Object Model v2 — object mutations emit `targetKind: 'object'`.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-23 | Replaces ADR-010. Uniform `Operation` shape with `targetKind` discriminant covering object / primitive / dimension / layer / grid. Adds `promotionGroupId?` for atomic promotion. Sync / offline / LWW / CRDT-compatibility all preserved from ADR-010. |
