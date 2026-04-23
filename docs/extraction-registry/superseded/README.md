# Superseded Extraction Registry Entries

This folder holds extraction-registry entries that have been formally superseded by newer versions.

## Why this folder exists

The extraction registry has its own versioning policy (see `docs/extraction-registry/README.md` §Versioning policy): patch / minor / major bumps happen in place with a changelog entry. However, when a registry entry's **contract shape** changes materially (e.g., the addition of the `## Constructors` section per ADR-016, or a reworking of an extractor's input/output contract), the previous version of the entry is preserved in this folder under the same `-superseded` suffix discipline used for ADRs.

The supersession discipline was formalised on **2026-04-23** alongside the drawing-model pivot (branch `arch/drawing-model-pivot`).

## Current status

**Empty.** No registry entries have been superseded yet.

Registry entries whose **content** will change when the `## Constructors` section is added (per ADR-016) will land in this folder as the relevant milestones implement promotion for each object type:

- `RTG_BLOCK.md` — will be superseded when M1.3b authors its constructor section.
- `ROAD.md`, `BUILDING.md`, `PAVEMENT_AREA.md`, `BERTH.md` — superseded as subsequent milestones add their constructors.
- `YARD_CAPACITY_SUMMARY.md`, `GATE_CAPACITY_SUMMARY.md` — cross-object extractors with no primitive constructors; not subject to supersession under this pivot.

## Supersession procedure (when applicable)

1. `git mv docs/extraction-registry/<ENTRY>.md docs/extraction-registry/superseded/<ENTRY>-superseded.md`
2. In the moved file, update the `Version:` header to indicate retirement and add a `Superseded by:` line pointing at the replacement entry's path and version.
3. Author a new `docs/extraction-registry/<ENTRY>.md` with the revised contract and an entry in its changelog explaining what changed.
4. Update `docs/extraction-registry/README.md` Files list if the replacement has a different path.

This mirrors the ADR supersession pattern in `docs/adr/superseded/README.md`.
