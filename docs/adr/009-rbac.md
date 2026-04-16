# ADR-009 — RBAC and Permission Model

**Status:** ACCEPTED
**Date:** 2026-04-16

## Context

Users have different levels of access to project geometry, commercial
assumptions, and global libraries. A junior drafter editing a road alignment
should not be able to silently modify unit rates. A cost manager should be
able to edit rates but not geometry. A library administrator manages
organisational templates without needing project-edit access.

These are meaningfully different concerns and should not collapse into a
single role hierarchy.

## Options considered

**A. Single role per user per project (owner / editor / viewer).** Simple
for users. Cannot prevent a project editor from also editing commercial
data. Library governance is not addressed.

**B. Complex role hierarchy with many named roles.** Captures every
distinction. Difficult to explain. Role proliferation becomes a governance
burden of its own. Most small consultancies (3-5 people) do not think in
complex org charts.

**C. Simple project roles plus independent permission flags for sensitive
resources.** Two axes: project membership and resource governance.
Additive, understandable, extensible.

## Decision

**Option C.**

### Project membership roles (simple, mutually exclusive per project)

```
OWNER     — full control including member management and project deletion
EDITOR    — can edit geometry, parameters, operational assumptions
VIEWER    — read-only, can comment, cannot modify
```

### Resource permission flags (additive, independent of project role)

```
LIBRARY_EDITOR       — can edit tenant and global library items
COST_EDITOR          — can edit unit rates and cost assumptions
SCENARIO_APPROVER    — can mark a scenario as APPROVED for export/submission
EXPORT_FULL          — can export cost-bearing outputs (PDFs, spreadsheets)
```

A user who is a project EDITOR but lacks COST_EDITOR can move buildings but
cannot change unit rates. A VIEWER with SCENARIO_APPROVER can approve a
scenario without editing it. These combinations compose cleanly.

### Tenant-level roles (simple)

```
TENANT_ADMIN    — manages org settings, members, tenant library
MEMBER          — standard member, access granted per-project
```

### Permission checks

All checks happen server-side. Frontend may hide disabled features for UX,
but the server is the enforcement point.

```typescript
interface PermissionCheck {
  user_id: UUID;
  action: 'READ' | 'EDIT_GEOMETRY' | 'EDIT_COST' | 'APPROVE_SCENARIO' | ...;
  resource_type: 'PROJECT' | 'SCENARIO' | 'LIBRARY_ITEM';
  resource_id: UUID;
}
```

## Consequences

- Junior drafters cannot accidentally modify commercial data even though
  they have project edit access.
- Library IP is protected independently of project access — a library
  manager can exist without project membership at all.
- Role model stays simple enough to explain: three project roles plus a
  handful of additive flags.
- Adding new permission flags (e.g. `PUBLISH_TO_CLIENT_PORTAL`) is
  additive and non-breaking.
- Small consultancies can ignore most flags and operate with
  owner/editor/viewer alone.

## What this makes harder

- The UI must clearly show which actions are available and which are
  gated. Gate implementation needs consistent styling ("you don't have
  permission to do X" tooltips or disabled states).
- Audit logging must capture permission-check outcomes alongside action
  events.
- When a user is removed from COST_EDITOR, in-flight draft changes to
  cost data must be handled gracefully (either committed before removal
  or discarded).
