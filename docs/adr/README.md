# Architecture Decision Records

ADRs are the record of significant architectural choices, their context, the
options considered, and the rationale. They are never edited. If a decision
changes, a new ADR is written that references and supersedes the old one.

## Index

| ID | Title | Status |
|---|---|---|
| [001](001-coordinate-system.md) | Coordinate System Strategy | ACCEPTED |
| [003](003-ownership-states.md) | Ownership States | ACCEPTED |
| [004](004-parameter-extraction.md) | Parameter Extraction Contract | ACCEPTED |
| [005](005-library-model.md) | Library Model | ACCEPTED |
| [006](006-scenario-model.md) | Scenario Model | ACCEPTED |
| [007](007-validation-engine.md) | Validation Engine | ACCEPTED |
| [008](008-3d-cache.md) | 3D Derivation Cache | ACCEPTED |
| [009](009-rbac.md) | RBAC and Permission Model | ACCEPTED |
| [011](011-ui-stack.md) | UI Stack: Icon Library and Theme Switching | ACCEPTED |
| [012](012-technology-stack.md) | Technology Stack | ACCEPTED |
| [014](014-persistence-architecture.md) | Persistence Architecture | ACCEPTED |
| [015](015-project-store-state-management.md) | Project Store and State Management Scope | ACCEPTED |
| [016](016-drawing-model.md) | Drawing Model (Hybrid Primitive + Element) | ACCEPTED |
| [017](017-layer-model.md) | Layer Model | ACCEPTED |
| [018](018-dimension-model.md) | Dimension Model | ACCEPTED |
| [019](019-object-model.md) | Object Model v2 | ACCEPTED |
| [020](020-project-sync.md) | Project Sync and Offline Model v2 | ACCEPTED |
| [021](021-2d-rendering-pipeline.md) | 2D Rendering Pipeline v2 | ACCEPTED |
| [023](023-tool-state-machine-and-command-bar.md) | Tool State Machine and Command Bar (v2) | ACCEPTED |
| [025](025-dynamic-input-manifest-v2.md) | Dynamic Input Manifest v2 (geometry contract refinement) | ACCEPTED |

## Format

Each ADR follows this structure:

```
# ADR-NNN — Title

Status: ACCEPTED | SUPERSEDED | DEPRECATED
Date: YYYY-MM-DD
Supersedes: (if applicable)
Superseded by: (if applicable)

## Context
## Options considered
## Decision
## Consequences
## What this makes harder
```

## When to write a new ADR

- A new architectural decision with system-wide impact
- A significant deviation from an existing ADR (write the new one, mark old
  as superseded)
- A material change to an interface between modules
- A choice between two or more genuinely viable options where the rationale
  matters for future engineers

## When not to write an ADR

- Implementation details within a module
- Choice of third-party library where any of several would work
- Refactoring that does not change external behaviour
- Bug fixes

## Superseded ADRs

ADRs that have been formally superseded. Each entry lives in
[`superseded/`](superseded/) with a `-superseded` suffix and its own
`Status: SUPERSEDED` + `Superseded by:` header. Files remain in the
repository for historical traceability but are not binding.

| Superseded ADR | Replacement | Superseded on |
|---|---|---|
| [002 Object Model Contract](superseded/002-object-model-superseded.md) | [019 Object Model v2](019-object-model.md) | 2026-04-23 |
| [010 Project Sync and Offline Model](superseded/010-project-sync-superseded.md) | [020 Project Sync and Offline Model v2](020-project-sync.md) | 2026-04-23 |
| [013 2D Rendering Pipeline](superseded/013-2d-rendering-pipeline-superseded.md) | [021 2D Rendering Pipeline v2](021-2d-rendering-pipeline.md) | 2026-04-23 |
| [022 Tool State Machine and Command Bar](superseded/022-tool-state-machine-and-command-bar-superseded.md) | [023 Tool State Machine and Command Bar (v2)](023-tool-state-machine-and-command-bar.md) | 2026-04-25 |
| [024 Dynamic Input Manifest](024-dynamic-input-manifest.md) | [025 Dynamic Input Manifest v2](025-dynamic-input-manifest-v2.md) | 2026-04-29 |

See [`superseded/README.md`](superseded/README.md) for the supersession
procedure and folder purpose.
