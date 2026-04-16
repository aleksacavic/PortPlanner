# ADR-010 — Document Sync and Offline Model

**Status:** ACCEPTED
**Date:** 2026-04-16

## Context

Port planners work on site, on vessels during inspection, in remote project
locations, and in client offices with variable connectivity. A system that
requires continuous server connection to be useful will frustrate its users
on the very days they most need the tool.

When connectivity returns, changes made offline must merge cleanly with
server state and with any concurrent changes made by other team members.

## Options considered

**A. Server-dependent. All operations require online connection.** Simple.
Fails the use case.

**B. Full CRDT-based multi-user collaboration from day one (Yjs or
Automerge).** Maximum capability. Large implementation investment.
Distorts document model around synchronization complexity. Not justified
by V1 use cases (small teams, rarely simultaneous editing).

**C. Single-writer offline with deterministic merge on reconnect. Document
is a serializable value type. Changes are operations. Object-level
last-write-wins on conflicts.** Supports offline. Handles low-contention
multi-user. CRDT-compatible upgrade path for future.

## Decision

**Option C for V1. Option B design-compatible for V2.**

### Document as serializable value

The project document is a **serializable value type**. At any moment it is
a map `object_id → ObjectSnapshot`. Every mutation produces a new valid
document state. The document is never mutated in place at the architectural
level (implementation may use in-place mutation for performance; what
matters is that externally it behaves as immutable).

### Operations

Every mutation is an **operation** logged with:

```typescript
interface Operation {
  id: UUID;
  project_id: UUID;
  sequence: number;                    // local monotonic counter per client
  timestamp: timestamp;
  user_id: UUID;
  type: OperationType;                 // CREATE | UPDATE | DELETE | GENERATE | FREEZE
  object_id: UUID;
  before: ObjectSnapshot | null;       // pre-operation state (for undo)
  after: ObjectSnapshot | null;        // post-operation state
}

enum OperationType {
  CREATE,
  UPDATE,
  DELETE,
  GENERATE,      // batch from generator
  FREEZE,        // ownership state transition
  DETACH,
  UNFREEZE
}
```

### Offline behaviour

1. Client maintains a local operation log since last sync.
2. Operations apply immediately to local document state.
3. On reconnect, client sends its operation log to the server.
4. Server applies operations in sequence, resolving conflicts at object level.

### Conflict resolution

**Object-level last-write-wins.**

- If two users edited **different** objects: both changes apply, no conflict.
- If two users edited the **same** object: the later server-timestamped
  operation wins. The losing client receives a conflict notification showing
  both versions; user can choose to re-apply their change.

This is not full CRDT. It is not real-time simultaneous editing of the same
object. It handles the primary V1 use case: one planner offline on site,
syncing when back at the office; two colleagues working on different parts
of the same project.

### Future CRDT compatibility

The operation log structure is compatible with CRDT adoption. CRDTs refine
how conflicts resolve; the operation log model persists. Migrating to a
CRDT-based model in V2 is an upgrade of the merge resolution layer, not a
rewrite of the document model.

## Consequences

- Full offline capability for single-user workflows.
- Clean sync for low-contention multi-user workflows.
- Explicit conflict notification for high-contention cases — user knows
  when their change was overwritten.
- Document remains a serializable value type: testable, snapshotable,
  migratable.
- Undo/redo is a natural consequence of the operation log (reverse the
  last N operations).
- V2 multi-user real-time editing is an additive upgrade.

## What this makes harder

- Client must maintain a local operation log with durable storage
  (IndexedDB).
- Sync protocol must handle partial failures (server accepts some
  operations, rejects others).
- Timestamp skew between clients must be handled (server timestamps are
  authoritative for ordering on conflict).
- Undo across a sync boundary (did we sync a mistake?) needs a
  clearly-communicated UI: user can undo locally, which generates new
  operations that reverse earlier ones, rather than trying to literally
  reverse time on the server.
