# Superseded Architecture Decision Records

This folder holds ADRs that have been formally superseded by later ADRs.

## Why this folder exists

Per `docs/procedures/Claude/00-architecture-contract.md` §0.6: *"ADR files: never edited after acceptance. New ADRs supersede old ones. The superseded ADR stays in the repository with `Status: SUPERSEDED` and a link to its replacement."*

The supersession discipline was formalised into a physical folder layout on **2026-04-23** (branch `arch/drawing-model-pivot`):

- Superseded ADRs are renamed with a `-superseded` suffix (e.g. `002-object-model.md` → `002-object-model-superseded.md`).
- The file is moved to this folder.
- The file's header is updated in-place to set `Status: SUPERSEDED` and to add a `Superseded by:` line pointing at the replacement ADR. This is a permitted edit — the contract explicitly mandates the status marker on supersession.

The superseded file stays in the repository for historical traceability but is **not binding**. Readers following a cross-reference to a superseded ADR follow the `Superseded by:` pointer to the current authority.

## Current supersessions

| Superseded ADR | Replacement | Date |
|---|---|---|
| [ADR-002 Object Model Contract](002-object-model-superseded.md) | [ADR-019 Object Model v2](../019-object-model.md) | 2026-04-23 |
| [ADR-010 Project Sync and Offline](010-project-sync-superseded.md) | [ADR-020 Project Sync v2](../020-project-sync.md) | 2026-04-23 |
| [ADR-013 2D Rendering Pipeline](013-2d-rendering-pipeline-superseded.md) | [ADR-021 2D Rendering Pipeline v2](../021-2d-rendering-pipeline.md) | 2026-04-23 |
| [ADR-022 Tool State Machine and Command Bar](022-tool-state-machine-and-command-bar-superseded.md) | [ADR-023 Tool State Machine and Command Bar (v2)](../023-tool-state-machine-and-command-bar.md) | 2026-04-25 |
| [ADR-024 Dynamic Input Manifest](024-dynamic-input-manifest-superseded.md) | [ADR-025 Dynamic Input Manifest v2](../025-dynamic-input-manifest-v2.md) | 2026-04-29 |

See also `docs/adr/README.md` §Superseded ADRs for the canonical supersession map.
