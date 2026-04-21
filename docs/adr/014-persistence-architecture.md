# ADR-014 — Persistence Architecture

**Status:** ACCEPTED
**Date:** 2026-04-18

## Context

ADR-010 defines the **document sync model** — serializable value type,
operation log, object-level last-write-wins, CRDT-compatible V2 path. It
does not fully pin the persistence *implementation*:

- Where is the project persisted in M1 (no server exists)?
- What is the server-side store when the server ships?
- How does persistence evolve across M1 → M2 → M3+?

Without pinning these, M1 execution either stalls or a path gets picked
silently by whoever writes the save button first. This ADR closes the gap.

**Scope:** this ADR is the **implementation** of ADR-010's sync model, not a
replacement for it. ADR-010 owns: doc-as-value, operation structure,
conflict semantics. This ADR owns: M1 client persistence, planned server
store, and the evolution path.

The serialization primitive (JSON with canonical key ordering + deterministic
number formatting) and ID generation (UUIDv7) are decided in ADR-012 and
referenced below rather than re-decided here.

## Options considered

### M1 client persistence

Constraint: M1 is local-development only. No server. Exit criterion is
"save, reload, outputs are deterministic" per the execution plan.

**A. IndexedDB keyed by `project_id`.** The full serialized document is
stored as a JSON blob under its project ID.

- Pros: works identically in all evergreen browsers; no permission prompts;
  easily testable under Playwright / jsdom; exit criterion trivially
  satisfied; quota is practically unlimited at M1 document sizes.
- Cons: not "a file on disk" — users cannot hand a project to a colleague
  as a file until M2 ships export/import.

**B. File System Access API (FSA) with download/upload fallback.** User
picks a file; subsequent saves write to that handle.

- Pros: feels like saving a CAD file; aligns with `.dwg` / `.skp` mental
  model.
- Cons: Chromium-native; Safari 17+ has it with rough edges; Firefox
  requires a polyfill whose UX is different (download + upload). Every save
  triggers a permission prompt. Automated testing requires special flags.
  Adds ceremony M1 does not need to satisfy its exit criterion.

**C. localStorage.** Simple key-value store.

- Cons: ~5 MB quota; synchronous API (blocks main thread); wrong tool.

### IndexedDB wrapper

**A. `idb` library (~2 KB).** Small promise wrapper over IndexedDB.

- Pros: promise-native API; tiny.
- Cons: one dependency.

**B. Raw IndexedDB.** Native callback API wrapped in ~30 LOC of promise
helpers.

- Pros: zero dependencies.
- Cons: slightly more code to maintain.

**C. Dexie (~6 KB).** ORM-ish wrapper with queries and migrations.

- Cons: features we do not need — we are storing one JSON blob per project
  in M1.

### Planned server-side store

When the server ships (no earlier than Milestone 3 per the execution plan):

**A. Postgres 16+ with PostGIS.** ADR-001 assumes PostGIS materialized views
for WGS84 spatial indexing. ADR-002 uses relational table language
("separate tables", "JSONB", "materialized view"). ADR-005 library snapshots
are relational. ADR-009 RBAC checks are server-side. Every ADR that touches
persistence points here.

- Pros: aligns with every ADR that mentions DB behavior; mature PostGIS for
  spatial; JSONB for extensible `parameters`; strong Node query-layer
  options.
- Cons: hosted Postgres is not free; self-host requires backups and
  upgrades.

**B. SQLite on the server (with SpatiaLite).**

- Pros: file-based; easy ops.
- Cons: SpatiaLite is not feature-equivalent to PostGIS; multi-tenant
  scaling weak.

**C. Document DB (MongoDB, DynamoDB).**

- Cons: loses spatial indexing and relational joins required by ADR-005 and
  ADR-009; contradicts ADR-002's relational discipline.

### Evolution path

**A. Phased migration.** M1 IndexedDB → M2 add file export/import on top of
IndexedDB → M3+ add server with Postgres + PostGIS; IndexedDB transitions
from "primary store" to "offline op-log cache" per ADR-010.

**B. Start with FSA in M1.** Less migration later; forces file-handle UX on
M1 which the M1 exit criterion does not require.

**C. Start with a stub server in M1.** Contradicts the M1 exclusion
"deployment infrastructure beyond local development."

## Decision

### M1 client persistence

| Aspect | Choice |
|---|---|
| M1 primary store | **IndexedDB, keyed by `project_id`.** Stores the full serialized document per project. |
| Wrapper | **`idb`** (~2 KB) for promise ergonomics. Raw IndexedDB is acceptable if the team prefers zero extra deps; default is `idb`. |
| Serialization | JSON with canonical key ordering + deterministic number formatting (ADR-012 #11). |
| ID strategy | UUIDv7 for project IDs and all object IDs (ADR-012 #10). |
| Save/reload semantics | Save writes the full document under its `project_id`. Reload reads the full document. No partial writes in M1. |
| Determinism | Round-trip (doc → JSON → IndexedDB → JSON → doc) is byte-identical when inputs are identical. Enforced by canonical serialization + tested against M1 exit criterion. |

### Planned server-side store

| Aspect | Choice |
|---|---|
| Server DB | **Postgres 16+ with the PostGIS extension.** |
| Relational discipline | Per ADR-002: first-class columns for identity / classification / ownership / traceability; JSONB only for extensible `parameters`. |
| Spatial indexing | PostGIS GiST indexes on geometry columns; materialized WGS84 view per ADR-001 for cross-project geographic queries. |
| Stored operations | Append-only `operations` table mirroring ADR-010's `Operation` shape. |
| Client-server sync | Client op log flushes on reconnect; server applies in order; conflicts resolved per ADR-010 object-level LWW. |
| ORM / query layer | NOT pinned here. Deferred to the ADR that lands with the server (M3+). |

### Evolution path

1. **Milestone 1:** IndexedDB only. Single project at a time in UX. Save /
   reload via `idb`. Exit criterion: round-trip determinism.
2. **Milestone 2:** Add "Export project file" (download JSON) and "Import
   project file" (upload JSON) features on top of the IndexedDB store.
   Same canonical JSON format — import is validated with Zod (ADR-012 #4).
   Multi-project UX via IndexedDB `project_id` key enumeration.
3. **Milestone 3+ (when the server ships):** Client gains a sync layer.
   The operation log (ADR-010) persists durably in IndexedDB and syncs to
   Postgres on reconnect. IndexedDB transitions from "primary store" to
   "offline cache + op-log queue."

### Decisions this ADR does NOT make

- Backend framework (Fastify / Hono / tRPC / Express). Deferred.
- ORM or query builder (Drizzle / Prisma / Kysely / raw SQL). Deferred
  until the server ships.
- Migration tooling. Deferred.
- Backup and disaster-recovery strategy. Deferred.
- Multi-tenancy model. Deferred until post-MVP.
- Real-time multi-user sync via CRDT. ADR-010 keeps V2 compatibility; this
  ADR does not commit to a library.

## Consequences

- M1 exit criterion ("save, reload, outputs are deterministic") is trivially
  satisfied with a minimal dependency footprint.
- Automated testing of save/reload is straightforward — no browser
  permission prompts, no platform-specific APIs.
- The serialized document format is stable across M1 → M2 → M3+. File
  import/export in M2 and server sync in M3 both use the same canonical JSON.
- The server-side store is locked in (Postgres + PostGIS), so future server
  work does not rehash DB selection.
- Client-side code in `packages/domain` is persistence-agnostic. In M1 the
  persistence caller lives in `apps/web`; in M3+ it lives in `apps/web` +
  `services/api`. `packages/domain` never knows where the doc is stored.

## What this makes harder

- M1 users cannot hand a project file to a colleague until M2 ships export /
  import. Acceptable — M1 is a proof-of-loop milestone, not a deliverable
  for real planning work.
- IndexedDB `QuotaExceededError` must be caught explicitly with a clear user
  message, even though quotas are practically unreachable at M1 document
  sizes.
- When the server ships, the client's IndexedDB role shifts from "primary
  store" to "offline cache + op-log queue." The persistence interface in
  `apps/web` must not ossify around the M1 shape — this is an interface
  discipline the M1 plan will need to guard.

## Cross-references

- **ADR-001** Coordinate System — project-local metric geometry; PostGIS
  WGS84 materialized view named here as the planned server spatial index.
- **ADR-002** Object Model — relational discipline (first-class columns vs
  JSONB) drives the planned Postgres schema shape.
- **ADR-005** Library Model — library snapshots live in Postgres (planned),
  not in client IndexedDB.
- **ADR-009** RBAC — permission checks happen server-side; M1 has no server,
  so no RBAC in M1.
- **ADR-010** Project Sync — authoritative sync model; this ADR is the
  implementation path beneath it.
- **ADR-012** Technology Stack — JSON serialization primitive and UUIDv7 ID
  generation are decided there and applied here.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-18 | Initial ADR. Pins M1 client persistence (IndexedDB + `idb`); names Postgres + PostGIS as the planned server store; lays out the M1→M2→M3 evolution path. |
