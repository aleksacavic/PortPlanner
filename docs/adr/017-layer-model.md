# ADR-017 — Layer Model

**Status:** ACCEPTED
**Date:** 2026-04-23
**Supersedes:** none (new concept)

## Context

ADR-016 introduces first-class primitives and grids alongside typed objects and dimensions. Planners organise drafting work by **layer** — a shared CAD convention for grouping entities by purpose (roads, utilities, construction lines, redline markups) with per-layer visibility, lock state, and default display properties (color, linetype, lineweight).

Without a layer model, visibility toggling requires ad hoc selection filters, style defaults are repeated per entity, and the drafting surface loses a standard organisational axis. With an over-designed layer model (AutoCAD's full Layer State Manager, layer groups, filters, per-viewport overrides), feature budget gets swamped by meta-UI and extraction code risks quietly depending on layer state.

This ADR pins a **light, data-layer, AutoCAD-inspired layer model** scoped to what earns its keep.

## Options considered

### 1. Layer persistence

- **A. Data-layer first-class** — persisted entity, op-logged, survives save/reload.
- **B. View-local preference** — per-user view state, not part of project truth.

### 2. Scope of layer behaviour

- **A. Visibility and style only.** No effect on extraction, validation, commercial outputs.
- **B. Visibility + style + extraction scoping.** Hidden layer = entities excluded from extraction.
- **C. Full CAD Layer State Manager.** Layer groups, filters, per-viewport overrides, saved layer states.

### 3. Per-entity style overrides

- **A. Nullable columns on entity.** `color: Color | null` where null = inherit.
- **B. Override bag.** `displayOverrides: { color?, lineType?, ... }` — key missing = ByLayer, key present = override.
- **C. No overrides.** Entities always inherit layer style.

### 4. Default layer

- **A. No default.** Every entity must name a layer at creation.
- **B. Protected default layer.** Reserved layer (AutoCAD convention: name `0`) exists in every project, cannot be deleted or renamed. All orphans fall back to it.

## Decision

| # | Area | Choice | Rationale |
|---|------|--------|-----------|
| 1 | Persistence | **A. Data-layer first-class.** Layers persist, op-logged via ADR-020's `targetKind: 'layer'`. | Project-authored organisation is part of project truth; multiple users opening the same project must see the same layer structure. |
| 2 | Scope | **A. Visibility + style only. Extraction is layer-agnostic.** An RTG_BLOCK on a hidden or frozen layer still extracts to yard capacity. | Commercial outputs must not be visibility-dependent. Hiding a block cannot silently drop its TEU from the capacity summary. **Binding: implementations that filter entities by layer visibility before extraction are Blockers.** |
| 3 | Per-entity overrides | **B. `displayOverrides` bag.** Keys missing = ByLayer; keys present = explicit override. Schema is open to new override keys without migration. | Mirrors AutoCAD ByLayer / ByBlock / explicit. Nullable columns don't scale (each new property = schema change). ADR-019 uses open-bag pattern for `parameters`; same shape keeps the codebase consistent. |
| 4 | Default layer | **B. Protected default.** Every project created with a layer `{ id: LayerId.DEFAULT, name: '0', color: "#FFFFFF", lineType: 'continuous', lineWeight: 0.25, visible: true, frozen: false, locked: false }`. Cannot be deleted or renamed; its properties may be edited. | Protects against orphaned entities. Aligns with AutoCAD layer `0`. |

### Layer schema

```typescript
interface Layer {
  id: LayerId;                     // UUIDv7 branded type
  name: string;                    // display name, unique per project (case-insensitive)
  color: ColorValue;               // hex "#RRGGBB" or named token
  lineType: LineTypeId;            // 'continuous' | 'dashed' | 'dotted' | 'dashdot' | ... (extensible)
  lineWeight: number;              // millimetres at 1:1 plot scale; 0.25 default
  visible: boolean;                // hidden layers do not render
  frozen: boolean;                 // frozen = hidden + excluded from regen (M3+ generator)
  locked: boolean;                 // locked renders but is not selectable / editable
}

interface DisplayOverrides {
  color?: ColorValue;              // key present = override; missing = ByLayer
  lineType?: LineTypeId;
  lineWeight?: number;
}
```

### Layer membership

Every primitive (ADR-016), dimension (ADR-018), grid (ADR-016), and typed object (ADR-019) carries a required `layerId: LayerId`. Non-nullable. At entity creation UI assigns the currently-active layer or falls back to `LayerId.DEFAULT`.

### Effective-property resolution

```
effectiveColor(entity)      = entity.displayOverrides.color      ?? layer(entity.layerId).color
effectiveLineType(entity)   = entity.displayOverrides.lineType   ?? layer(entity.layerId).lineType
effectiveLineWeight(entity) = entity.displayOverrides.lineWeight ?? layer(entity.layerId).lineWeight
```

- **Locked layer:** entity renders, hit-test excludes it for modify tools; query-info allowed.
- **Frozen layer in M1:** treated as hidden for rendering; no generator interaction yet (M3 generator MUST skip frozen-layer entities entirely).

### Deletion semantics

- Deleting a non-default layer with no entities: allowed.
- Deleting a non-default layer with entities: UI prompts **reassign-to-target-layer** or **move-to-default**. Rejection at the store level if no reassignment.
- Default layer never deletable.
- Renaming preserves layerId FKs (references are to id, not name).

## Consequences

- Drafting has a familiar organisational axis.
- Extraction is layer-agnostic by binding rule; commercial outputs cannot be silently skewed.
- `displayOverrides` bag gives ByLayer + explicit-override without schema churn.
- Default layer eliminates orphaned entities.

## What this makes harder

- Every entity carries `layerId` + `displayOverrides`. Serializer, op-log, hit-test, renderer all handle it.
- Default layer must be seeded on project creation; missing it is a schema-level invariant.
- Extraction-agnostic layer discipline needs explicit test coverage.

## Cross-references

- **ADR-016** Drawing Model — defines primitive / grid / dimension `layerId` fields.
- **ADR-019** Object Model v2 — typed objects gain `layerId` and `displayOverrides`.
- **ADR-020** Project Sync v2 — `targetKind: 'layer'` covers layer mutations.
- **ADR-014** Persistence — layers serialise with the project.
- **ADR-021** 2D Rendering Pipeline v2 — resolves effective display properties at paint time.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-23 | Initial ADR. Data-layer light layer model with ByLayer + override bag; extraction-agnostic discipline; protected default layer. |

---

## Appendix A — Why not Layer State Manager

AutoCAD's LSM saves named snapshots of entire layer visibility / state tables. In port planning workflows, scenarios (ADR-006) already carry the "alternate state" burden at the object-parameter level; layer state snapshots would duplicate scenario semantics at the display layer. Deferred indefinitely.

## Appendix B — Why extraction-agnostic

A planner hides the "RTG blocks" layer to focus on roads. Yard capacity summary drops to zero. Hours of confusion. This is the exact failure mode the binding rule prevents. Any implementation that filters extraction inputs by `layer.visible` or `frozen` is rejected at review.
