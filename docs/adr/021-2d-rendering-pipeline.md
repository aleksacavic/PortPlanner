# ADR-021 — 2D Rendering Pipeline v2

**Status:** ACCEPTED
**Date:** 2026-04-23
**Supersedes:** ADR-013 (`docs/adr/superseded/013-2d-rendering-pipeline-superseded.md`)

## Context

ADR-013 pinned the 2D rendering foundations: **Plain Canvas2D** (imperative paint loop), **`@flatten-js/core`** for 2D Euclidean primitives, **`rbush`** as the spatial index, **custom ~100 LOC view-transform layer**. Those choices remain correct.

ADR-013's Context and Decision text scoped the paint loop to "ADR-002 typed objects" — i.e., typed-object geometry only. With ADR-016 introducing primitives, ADR-017 introducing layers, ADR-018 introducing dimensions, and ADR-016 introducing grids as first-class entities, the paint loop must dispatch on entity kind, not just iterate typed objects.

Per the user-approved clean-break supersession discipline (2026-04-23), this ADR replaces ADR-013 rather than amending its scope. Renderer / geometry / spatial-index / view-transform choices carry over unchanged.

## Options considered

Renderer, geometry library, spatial index, and view-transform choices considered identically to ADR-013:

- **Renderer:** SVG / Plain Canvas2D / Canvas2D scene-graph wrapper / WebGL.
- **Geometry math:** `@flatten-js/core` / roll-our-own / turf.js / martinez.
- **Spatial index:** `rbush` / `kdbush` / `flatbush` / roll-our-own.
- **View transform:** roll-our-own / `d3-zoom`.

New question — how to dispatch paint across entity kinds:

- **A. Flat list of renderables.** All entities normalised to a common shape; one paint function.
- **B. Per-kind paint functions with kind-discriminated dispatch.** `paintPrimitive`, `paintObject`, `paintDimension`, `paintGrid` called from a central loop.
- **C. Entity-kind registry pattern.** `paintRegistry.get(entity.kind)(ctx, entity)` — pluggable.

## Decision

| Aspect | Choice |
|---|---|
| Renderer | **Plain Canvas2D**, imperative `paint(ctx, state)` pattern, driven by op-log-backed project state (ADR-020). `devicePixelRatio` handled at canvas init. |
| Geometry math | **`@flatten-js/core`** for 2D Euclidean primitives. |
| Spatial index | **`rbush`** (R-tree) over entity bounding boxes for hit testing, snap targeting, frustum culling. |
| View transform | **Roll our own** view-transform layer (~100 LOC). No `d3-zoom` dependency. |
| Dispatch across entity kinds | **B. Per-kind paint functions.** Central paint loop iterates visible entities within viewport frustum; kind-discriminated dispatch calls `paintPrimitive` / `paintObject` / `paintDimension` / `paintGrid` (layer-as-entity is never painted directly — layers contribute *style* to other entities). |

### The paint pattern

```
paint(ctx, projectState, viewState, overlayState):
  clear(ctx)
  applyViewTransform(ctx, viewState)                     // pan + zoom + DPR
  activeLayerLookup = index projectState.layers by id    // for ByLayer resolution

  visibleGrids = projectState.grids.filter(g => g.visible && activeLayerLookup[g.layerId].visible)
  for each grid in visibleGrids:
    paintGrid(ctx, grid, activeLayerLookup[grid.layerId], theme)  // below all else

  visibleEntities = rbush.search(viewFrustum)
                           .filter(e => activeLayerLookup[e.layerId].visible && !activeLayerLookup[e.layerId].frozen)
  for each entity in visibleEntities:
    layer = activeLayerLookup[entity.layerId]
    effective = resolveEffectiveStyle(entity, layer)     // ADR-017 ByLayer resolution
    switch entity.kind:
      case 'point' | 'line' | 'polyline' | 'rectangle' | 'circle' | 'arc' | 'xline':
        paintPrimitive(ctx, entity, effective, theme)
      case 'object':
        paintObject(ctx, entity, effective, theme)       // dispatches on entity.type (RTG_BLOCK, ROAD, ...)
      case 'dimension':
        paintDimension(ctx, entity, effective, theme, projectState)  // reads referenced geometry

  drawOverlays(ctx, overlayState, theme)                 // snap markers, guides, dynamic dim preview, selection handles
```

- `projectState` is a Zustand selector on the project store (ADR-015); contains `primitives`, `objects`, `dimensions`, `grids`, `layers` maps.
- `viewState` is a separate slice (zoom, pan). Not undoable.
- `overlayState` is ephemeral UI state (active snap target, alignment lines, dimension preview, selection handles). Not undoable.
- Redraw triggered by Zustand `store.subscribe` on relevant slices and explicit `invalidate()` calls during interaction.

### Layer visibility, frozen, and locked

- **Invisible layer** (`visible === false`): entities on the layer are excluded from rendering AND from hit-test.
- **Frozen layer** (`frozen === true`): same as invisible for rendering. Additionally excluded from M3+ generator interaction.
- **Locked layer** (`locked === true`): entities render normally; hit-test excludes them from modify tools (move / rotate / delete); query-info hit-test still allowed.

**Binding (from ADR-017):** layer visibility / frozen state **MUST NOT** affect extraction inputs. Extraction reads all entities regardless of layer state. Any implementation that filters by `layer.visible` or `layer.frozen` before extraction is a **Blocker**.

### Grid rendering

Grids render as lattices clipped to the viewport. For a grid with origin / angle / spacingX / spacingY:

1. Compute viewport bounds in grid-local frame.
2. Emit vertical lines at `origin.x + k × spacingX` within viewport for integer k.
3. Emit horizontal lines at `origin.y + k × spacingY` within viewport for integer k.
4. Transform to project-local via angle rotation.
5. Stroke with effective style from `layer(grid.layerId)` + `grid.displayOverrides`.

Grid nodes (line intersections) are never rendered as visible dots — the intersections are the visual signal. Grid snap-activation is a separate concern (snap engine reads `grid.activeForSnap`; see §Snap priority).

### Dimension rendering

Dimensions render by reading referenced entity geometry (ADR-018 associative references). Measured value is computed on-the-fly; `textOverride` takes precedence when set. Vertex-index renumbering (ADR-018 Appendix A) is a store-side concern, not a render-side one.

### Snap priority integration surface (execution-phase; named here for reference)

```
OSNAP (endpoint / midpoint / center / intersection / node)  [highest]
OTRACK (alignment from snapped entities)
POLAR (angle lock from last point)
GSNAP (grid node)
grid-line fallback (near a grid line, not a node)  [lowest]
ORTHO (modifier, always active when toggled)
```

Priority tuning, tolerance thresholds, and per-mode visual hierarchy are execution-phase design, pinned by the M1.3a plan.

### Theme integration

Unchanged from ADR-013: canvas draw code reads the active theme via `useActiveThemeTokens()` (ADR-011); theme switches trigger canvas redraw via Zustand subscription.

### What this ADR does NOT decide

Tool state machine (ADR-022), keyboard shortcut bindings, snap priority resolution thresholds, per-operator prompt flows, static export (PNG / SVG) path. These are execution-phase artifacts under the M1.3a / b / c plans.

## Consequences

- Paint loop scales to M3 generated-content volumes unchanged from ADR-013.
- Kind-discriminated dispatch keeps per-entity-type rendering logic modular; adding a new primitive or typed object type doesn't fork the main loop.
- Layer resolution happens once per paint call (via `activeLayerLookup`), not per-entity, so N×M lookup cost is linear not quadratic.
- Dimensions stay derived — render reads referenced geometry; no sync invariant risk.
- Snap priority is named at the architectural layer; tuning moves to execution.

## What this makes harder

- Hit-testing for dimensions is more involved (click dimension text vs extension line vs arrow) — dedicated dimension hit-test helper in `packages/editor-2d`.
- Polyline arc segments (bulge-encoded per ADR-016) need dedicated rendering / hit-test paths beyond straight-line-only shortcuts.
- Debugging a draw bug still requires stepping through paint code; no "inspect element" on canvas.

## Cross-references

- **ADR-001** Coordinate System — paint transforms project-local metric → screen pixels at render time.
- **ADR-004** Parameter Extraction — paint is extract-independent; extraction reads entities regardless of visibility.
- **ADR-008** 3D Derivation Cache — 2D rendering follows the same "derive from authoritative state; don't retain a parallel scene" philosophy.
- **ADR-011** UI Stack — `useActiveThemeTokens()` feeds canvas draw state.
- **ADR-012** Technology Stack — Zustand for state subscriptions.
- **ADR-016** Drawing Model — entity kinds (primitives, grids), snap accuracy model.
- **ADR-017** Layer Model — visibility / style / ByLayer resolution; extraction-agnostic binding.
- **ADR-018** Dimension Model — dimension rendering reads associative references.
- **ADR-019** Object Model v2 — typed-object paint reads core fields + layerId + displayOverrides.
- **ADR-020** Project Sync v2 — paint reads selectors over the op-log-backed state; never mutates.
- **ADR-022** Tool State Machine + Command Bar — tool overlays draw via `overlayState`.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-23 | Replaces ADR-013. Renderer / geometry / spatial-index / view-transform choices carry over. Paint loop broadens to dispatch on entity kind (primitive / object / dimension / grid). Layer visibility / frozen / locked semantics specified at the paint layer. Snap priority integration surface named. |
