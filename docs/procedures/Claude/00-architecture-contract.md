# Procedure 00 — Architecture Contract (Binding Specifications Reference)

> **RFC 2119 convention**: "MUST", "MUST NOT", "SHALL", "SHOULD", and "MAY"
> carry their standard meanings throughout this document.

---

## 0.1) Purpose

This document defines which specifications in the repository are **binding**
and which are **informative**. Binding specifications constrain implementation.
Informative documents provide context but do not constrain.

Every procedure in `docs/procedures/Claude/` references this contract. Read
this file before starting any task.

---

## 0.2) Binding specifications

The following are **binding**. Implementation that violates these is a
**Blocker** by default (see §0.7 Approved Deviation Protocol for the escape
valve).

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
- ADRs MUST NOT be edited. If a decision changes, a new ADR MUST be written
  that references and supersedes the old one. The superseded ADR stays in
  the repository with `Status: SUPERSEDED` and a link to its replacement.
- Deviating from an ADR silently is a **Blocker**.
- Proposing a deviation requires the Approved Deviation Protocol (§0.7).

### Parameter Extraction Registry

All entries in `docs/extraction-registry/` are binding specification written
**before** implementation.

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
- Changing an existing extractor formula MUST bump its semver version in
  the registry entry. Implementation without version bump is a **Blocker**.
- Adding a new object type without a registry entry is a **Blocker**.
- The extractor's `version` string in output bundles MUST match the
  registry entry version.

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
- MUST NOT port code patterns from `reference/`.
- MUST NOT treat the prototype's monolithic structure as a template.
- The prototype explicitly violates ADRs 001, 002, 004, 007, and 010.
- Use it only for visual design token validation and interaction pattern
  replication.

---

## 0.4) Ground Rules (applied across all procedures)

### GR-1: PREPRODUCTION CLEAN-BREAK RULE

The application is preproduction. Backward compatibility is NOT required.

- MUST NOT add migration shims, legacy adapters, deprecation bridges, or
  "temporary compatibility" code.
- If old architecture conflicts with target architecture, MUST replace old
  code directly.

### GR-2: ARCHITECTURE-FIRST RULE

No shortcuts. No hacks. No "good enough for now."

Every decision MUST be:
- SSOT-compliant (single source of truth per concept)
- DRY (no duplication of logic, formulas, or invariants)
- Scalable (supports the object types and scenarios beyond the current one)
- Explicitly testable (every invariant has a verification command or test)
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
                         (and design-system for UI elements).
                         MAY depend on doc-store-react inside React chrome
                         subdirectories (inspector panels, overlays).
                         Canvas paint loops MUST NOT import doc-store-react.
                         MUST NOT depend on viewer-3d.

packages/viewer-3d/      3D derived viewer. Depends on domain + doc-store
                         (and design-system).
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
- MUST NOT import from editor-2d into viewer-3d or vice versa.
- MUST NOT import from apps/web into any package.
- Cross-package imports are a **Blocker** unless they match the dependency
  graph above.
- Shared utilities that serve multiple packages MUST live in an
  appropriately owned package — never in a cross-cutting "utils" dump.
- **Canvas paint loops and 3D scene rendering MUST NOT import from
  `@portplanner/doc-store-react`.** They import `@portplanner/doc-store`
  directly and use `store.subscribe()` / `store.getState()`. This keeps
  React out of the rendering hot path.

  Enforcement grep gate (applies when the subdirectories exist):
  ```
  rg -n "from '@portplanner/doc-store-react'" \
     packages/editor-2d/src/canvas/ \
     packages/viewer-3d/src/scene/
  ```
  Expected: zero matches. Until those subdirectories exist, the gate
  passes trivially.

**Folder structure and modularity:**
- Every folder MUST have a clear single owner (one domain concept, one
  feature, one utility concern).
- Files MUST be modular: one responsibility per file. If a file grows
  beyond ~400 LOC or mixes concerns, it MUST be split.
- Helpers serving a single component MUST live next to their consumer.
- MUST NOT create "catch-all" or "misc" files. Every file name MUST
  describe its contents.
- When creating a new file, MUST verify no existing file already covers
  that responsibility (DRY).

---

## 0.5) Spec update rule

Any plan, execution, remediation, or review that changes behaviour
described in a binding specification MUST update the relevant spec
document(s) **in the same commit** as the code change.

Specific examples:
- Adding a new extractor output field → update the registry entry and
  bump the version, in the same commit as the extractor code change.
- Changing an ownership state transition → either follow §0.7 Approved
  Deviation Protocol and write a new ADR, or reject the change.
- Adding a new design token → update `docs/design-tokens.md` in the
  same commit.

Failure to update the relevant spec is a **Blocker**.

---

## 0.6) Architecture doc file lifecycle

- ADR files: never edited after acceptance. Write a new ADR if the
  decision changes.
- Extraction registry entries: edited for version bumps and clarifications.
  Every change increments the version and adds a changelog line.
- Glossary: appended when new terms enter the codebase. Existing entries
  can be clarified but not redefined without an ADR.
- Design tokens: edited when the palette or scale evolves. Every change
  increments the document version in the changelog section.

---

## 0.7) Approved Deviation Protocol

**Architecture specifications evolve.** ADRs were written before every
edge case was known. Extraction registry entries may prove insufficient
once implementation exposes new requirements. Deviations from binding
specifications are legitimate when the existing spec is wrong or
incomplete.

However, **deviations are never silent.** Every deviation follows this
protocol.

### When a deviation is needed

If a plan, execution, or remediation needs to deviate from a binding
specification, the implementer MUST:

1. **Name the deviation explicitly** in the plan. Example: "This plan
   proposes modifying ADR-003 ownership state transitions to add a new
   state: PENDING_REGENERATION, required by the generator to handle the
   race condition between regeneration triggers and user edits."

2. **Justify the deviation** in a dedicated section of the plan:
   - What in the current specification does not work for this case
   - What was missed in the original specification
   - Why adapting the implementation without changing the spec is not
     sufficient
   - Why the new approach is correct

3. **Propose the replacement**:
   - For an ADR: write a new superseding ADR that replaces the old one.
     The old ADR gets `Status: SUPERSEDED` and a link to the new one.
   - For an extraction registry entry: patch the entry and bump its
     version. If the change is major, consider a new entry.
   - For the glossary or design tokens: patch with a changelog line.

4. **Flag the deviation in the pre-response notification** (see Procedure
   01 §1.12). The user MUST see deviations before the full plan.

5. **Require explicit user approval.** The plan is NOT approved for
   execution until the user has explicitly acknowledged the deviation.
   Approval MUST be recorded in the plan file (date, user identifier,
   reason statement).

6. **Commit the spec update alongside the implementation.** The new/updated
   ADR, registry entry, or doc change lands in the same PR as the code
   that depends on it. Never separate.

### Classification

- A deviation without user approval → **Blocker**.
- A deviation with approval but without the updated spec committed in the
  same PR → **Blocker**.
- A deviation with approval and updated spec committed together → legitimate
  evolution of the architecture.

### What is NOT a deviation

- Following an ADR literally but in a way the ADR did not explicitly
  enumerate. Example: ADR-002 does not list every possible object type,
  but adding `BERTH` as a new type conforming to the contract is not a
  deviation — it is expected extension.
- Adding a validation rule to an existing object type. The registry
  entry is updated, no ADR change needed.
- Refining an extraction formula to fix a bug. Bump the version, update
  the registry entry changelog, no ADR change.

### What IS a deviation

- Changing the semantics of an ownership state.
- Adding a new ownership state.
- Changing how the coordinate system works.
- Introducing a new data layer not covered by ADR-002.
- Changing the sync model from last-write-wins to CRDT-based.
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

---

## 0.8) Verification expectation

Every review (Procedures 02, 04) and every execution (Procedure 03) MUST
verify against this contract:

- Binding specifications listed in §0.2 are consulted, not memorised.
- Any deviation found must trace to an approval per §0.7.
- Any missed spec update per §0.5 is flagged as a Blocker.
- Any GR-3 violation per §0.4 is flagged as a Blocker.

If you are unsure whether something is binding, treat it as binding and
ask.
