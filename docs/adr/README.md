# Architecture Decision Records

ADRs are the record of significant architectural choices, their context, the
options considered, and the rationale. They are never edited. If a decision
changes, a new ADR is written that references and supersedes the old one.

## Index

| ID | Title | Status |
|---|---|---|
| [001](001-coordinate-system.md) | Coordinate System Strategy | ACCEPTED |
| [002](002-object-model.md) | Object Model Contract | ACCEPTED |
| [003](003-ownership-states.md) | Ownership States | ACCEPTED |
| [004](004-parameter-extraction.md) | Parameter Extraction Contract | ACCEPTED |
| [005](005-library-model.md) | Library Model | ACCEPTED |
| [006](006-scenario-model.md) | Scenario Model | ACCEPTED |
| [007](007-validation-engine.md) | Validation Engine | ACCEPTED |
| [008](008-3d-cache.md) | 3D Derivation Cache | ACCEPTED |
| [009](009-rbac.md) | RBAC and Permission Model | ACCEPTED |
| [010](010-document-sync.md) | Document Sync and Offline Model | ACCEPTED |
| [011](011-ui-stack.md) | UI Stack: Icon Library and Theme Switching | ACCEPTED |

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
