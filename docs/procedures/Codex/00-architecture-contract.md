# Procedure 00 — Architecture Contract (Binding Specifications Reference)

> **RFC 2119 convention**: "MUST", "MUST NOT", "SHALL", "SHOULD", and "MAY"
> carry their standard meanings throughout this document.

---

## 0.1) Purpose

This document defines which specifications in the repository are **binding**
and which are **informative**. Binding specifications constrain all
implementation that Codex reviews. Codex uses this document to determine
whether an implementation conforms or deviates.

Every Codex procedure references this contract. Read this file before
starting any review.

---

## 0.2) Binding specifications

The following are **binding**. Implementation that violates these without
following the Approved Deviation Protocol (§0.7) is a **Blocker**.

### Architecture Decision Records

All files in `docs/adr/` are binding.

| ID | Title | Path |
|----|-------|------|
| 001 | Coordinate System Strategy | `docs/adr/001-coordinate-system.md` |
| 002 | Object Model Contract | `docs/adr/002-object-model.md` |
| 003 | Ownership States | `docs/adr/003-ownership-states.md` |
| 004 | Parameter Extraction Contract | `docs/adr/004-parameter-extraction.md` |
| 005 | Library Model | `docs/adr/005-library-model.md` |
| 006 | Scenario Model | `docs/adr/006-scenario-model.md` |
| 007 | Validation Engine | `docs/adr/007-validation-engine.md` |
| 008 | 3D Derivation Cache | `docs/adr/008-3d-cache.md` |
| 009 | RBAC and Permissions | `docs/adr/009-rbac.md` |
| 010 | Document Sync and Offline | `docs/adr/010-document-sync.md` |
| 011 | UI Stack: Icon Library and Theme Switching | `docs/adr/011-ui-stack.md` |
| 012 | Technology Stack | `docs/adr/012-technology-stack.md` |
| 013 | 2D Rendering Pipeline | `docs/adr/013-2d-rendering-pipeline.md` |
| 014 | Persistence Architecture | `docs/adr/014-persistence-architecture.md` |
| 015 | Document Store and State Management Scope | `docs/adr/015-document-store-state-management.md` |

**ADR rules:**
- ADRs MUST NOT be edited. Decision changes require a new ADR that
  references and supersedes the old one. The superseded ADR stays in the
  repository with `Status: SUPERSEDED` and a link to its replacement.
- Deviating from an ADR silently is a **Blocker**.
- Proposing a deviation requires the Approved Deviation Protocol (§0.7).

### Parameter Extraction Registry

All entries in `docs/extraction-registry/` are binding specification
written **before** implementation.

| Entry | Path |
|-------|------|
| Registry Governance | `docs/extraction-registry/README.md` |
| RTG_BLOCK | `docs/extraction-registry/RTG_BLOCK.md` |
| ROAD | `docs/extraction-registry/ROAD.md` |
| BUILDING | `docs/extraction-registry/BUILDING.md` |
| PAVEMENT_AREA | `docs/extraction-registry/PAVEMENT_AREA.md` |
| BERTH | `docs/extraction-registry/BERTH.md` |
| YARD_CAPACITY_SUMMARY | `docs/extraction-registry/YARD_CAPACITY_SUMMARY.md` |
| GATE_CAPACITY_SUMMARY | `docs/extraction-registry/GATE_CAPACITY_SUMMARY.md` |

**Registry rules:**
- New object types, new extractors, new validation rules MUST be added to
  the registry **before** implementation.
- Changing an existing extractor formula MUST bump its semver version.
  Implementation without version bump is a **Blocker**.
- Adding a new object type without a registry entry is a **Blocker**.
- Extractor output bundle's `version` string MUST match the registry entry
  version.

### Domain specification

| Doc | Path | Status |
|-----|------|--------|
| Domain Glossary | `docs/glossary.md` | Binding terminology |
| Coordinate System Reference | `docs/coordinate-system.md` | Binding |
| Design Tokens | `docs/design-tokens.md` | Binding for UI work |

### Informative documents (not binding, but authoritative context)

| Doc | Path |
|-----|------|
| System Overview | `docs/overview.md` |
| Execution Plan | `docs/execution-plan.md` |
| ADR Index | `docs/adr/README.md` |

---

## 0.3) Reference material (non-binding)

The `reference/` directory at repository root contains visual and
interaction references only.

- `reference/prototype-v1.html` — validated HTML prototype for visual
  design and UX validation.
- `reference/README.md` — explains what the prototype is and is not.

**Rules:**
- Implementation that copies code patterns from `reference/` is a
  **Blocker**. The prototype is visual reference only.
- The prototype explicitly violates ADRs 001, 002, 004, 007, and 010.

---

## 0.4) Ground Rules (applied across all procedures)

### GR-1: PREPRODUCTION CLEAN-BREAK RULE

The application is preproduction. Backward compatibility is NOT required.

- Migration shims, legacy adapters, deprecation bridges, and
  "temporary compatibility" code are **Blockers**.
- If old architecture conflicts with target architecture, implementation
  MUST replace old code directly.

### GR-2: ARCHITECTURE-FIRST RULE

No shortcuts. No hacks. No "good enough for now."

Every decision MUST be:
- SSOT-compliant (single source of truth per concept)
- DRY (no duplication of logic, formulas, or invariants)
- Scalable (supports object types and scenarios beyond the current one)
- Explicitly testable (every invariant has verification)
- Operationally safe (undo/redo, hydration, serialization, document sync)

### GR-3: MODULE ISOLATION AND CODE ORGANISATION

**Module boundaries for this project:**

```
packages/domain/         Pure logic. Types, extractors, validators, generators.
                         MUST NOT depend on any other package.
                         MUST NOT import React, Zustand, or any stateful lib.

packages/doc-store/      Document state (vanilla Zustand + zundo + Immer).
                         Depends on domain. MUST NOT import React.
                         MUST NOT own persistence (ADR-014 is authoritative).

packages/doc-store-react/ React bindings for doc-store (hooks, context).
                         Depends on doc-store + domain. React as
                         peerDependency only (never a direct dependency —
                         see ADR-015).

packages/editor-2d/      2D canvas editor. Depends on domain + doc-store
                         (and design-system).
                         MAY depend on doc-store-react inside React chrome
                         subdirectories (inspector panels, overlays).
                         Canvas paint loops MUST NOT import doc-store-react.
                         MUST NOT depend on viewer-3d.

packages/viewer-3d/      3D derived viewer. Depends on domain + doc-store.
                         MAY depend on doc-store-react inside React chrome.
                         Scene rendering code MUST NOT import doc-store-react.
                         MUST NOT depend on editor-2d.

packages/design-system/  Tokens and components.
                         MUST NOT depend on domain or any app.

apps/web/                Integrates packages. Depends on all packages
                         including doc-store-react for chrome hooks.
                         MUST NOT be imported from anywhere.

services/api/            Backend. Shares types from domain only.
                         MUST NOT import UI-specific code, doc-store,
                         or doc-store-react.
```

**Isolation rules:**
- Cross-package imports violating the dependency graph above are
  **Blockers**.
- Shared utilities that serve multiple packages MUST live in an
  appropriately owned package.
- **Canvas paint loops and 3D scene rendering MUST NOT import from
  `@portplanner/doc-store-react`.** They import `@portplanner/doc-store`
  directly. Enforcement grep (applies when subdirectories exist):
  ```
  rg -n "from '@portplanner/doc-store-react'" \
     packages/editor-2d/src/canvas/ \
     packages/viewer-3d/src/scene/
  ```
  Expected: zero matches. Reviewer verification mandatory once
  `packages/editor-2d` lands.

**Folder structure and modularity:**
- Every folder MUST have a clear single owner.
- Files beyond ~400 LOC or mixing concerns MUST be split.
- No "catch-all" or "misc" files.
- Every file name MUST describe its contents.

---

## 0.5) Spec update rule

Any change that alters behaviour described in a binding specification
MUST update the relevant spec document(s) **in the same commit** as the
code change.

Specific examples:
- Adding a new extractor output field → registry entry updated, version
  bumped, in the same commit as the extractor code change.
- Changing an ownership state transition → new superseding ADR per the
  Approved Deviation Protocol.
- Adding a new design token → `docs/design-tokens.md` updated in the
  same commit.

Failure to update the relevant spec is a **Blocker**.

---

## 0.6) Architecture doc file lifecycle

- ADR files: never edited after acceptance. New ADRs supersede old ones.
- Extraction registry entries: edited for version bumps and
  clarifications. Every change increments the version.
- Glossary: appended when new terms enter the codebase. Existing entries
  clarified but not redefined without an ADR.
- Design tokens: edited when the palette or scale evolves. Each change
  increments the document version.

---

## 0.7) Approved Deviation Protocol

**Architecture specifications evolve.** ADRs were written before every
edge case was known. Deviations are legitimate when the existing spec is
wrong or incomplete, but deviations are never silent.

### Required elements of an approved deviation

1. Deviation named explicitly in the plan.
2. Justification section explaining what doesn't work in the current spec.
3. Concrete replacement: new superseding ADR, or registry entry patch
   with version bump.
4. Flagged in the plan's pre-response notification (Procedure 01 §1.13
   in Claude's procedures).
5. Explicit user approval recorded in the plan file.
6. Spec update committed in the same PR as the implementation.

### Classification (from Codex's perspective)

- A deviation without user approval recorded in the plan → **Blocker**.
- A deviation with approval but without the updated spec committed in
  the same PR → **Blocker**.
- Implementation that changes behaviour described in a binding spec but
  the plan does not declare the deviation → **Blocker**.
- A deviation with approval and updated spec committed together →
  legitimate evolution; verify the superseded ADR is marked SUPERSEDED.

### What is NOT a deviation

- Adding `BERTH` or other new object types conforming to ADR-002's
  contract.
- Adding validation rules to an existing object type's registry entry.
- Bug-fix patches to extraction formulas with version bump.

### What IS a deviation

- Changing semantics of an ownership state.
- Adding a new ownership state.
- Changing coordinate system approach.
- Introducing a data layer not covered by ADR-002.
- Changing sync model from last-write-wins to CRDT-based.
- Any change that would make an existing ADR incorrect.

### Progressive implementation (distinct from deviation)

An implementation that ships a **strict subset** of a binding
specification at a given milestone is NOT classified as a deviation
when ALL of the following conditions hold:

1. **No conflicting runtime semantics.** The subset does not add
   fallback logic, warnings, proxies, or runtime behaviour absent
   from the spec.
2. **Excluded features unreachable at the type level.** Type
   narrowing MUST be additive-only so later widening (the full
   superset) does not break current-milestone consumers.
3. **User approval recorded in the plan file** with user identifier
   and date.
4. **Widening plan explicitly stated**: which milestone restores the
   full spec, named in the plan.

If any condition is not met, the change MUST follow the Approved
Deviation Protocol above as a deviation.

Progressive implementation is the legitimate path when the execution
plan explicitly excludes a feature in the current milestone
(e.g. `docs/execution-plan.md` Milestone 1: "pick dark or light, ship
one"). Each plan applying this classification MUST include a mapping
table demonstrating the four conditions hold, with references to the
plan sections that satisfy each.

**Codex verification:** when a plan invokes progressive implementation
under this clause, Codex MUST verify the mapping table exists and each
condition is backed by concrete plan references. A missing or
hand-waved condition flips the classification back to deviation, which
then requires the full §0.7 Approved Deviation Protocol.

---

## 0.8) Codex review expectation

Every Codex review (Procedures 02, 04) MUST verify against this contract:

- Binding specifications listed in §0.2 are consulted, not memorised.
- Any deviation found must trace to an approval per §0.7.
- Any missed spec update per §0.5 is flagged as a Blocker.
- Any GR-3 violation per §0.4 is flagged as a Blocker.

If unsure whether something is binding, treat it as binding and flag it
for user attention.
