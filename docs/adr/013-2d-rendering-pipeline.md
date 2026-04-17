# ADR-013 — 2D Rendering Pipeline

**Status:** ACCEPTED
**Date:** 2026-04-18

## Context

The `packages/editor-2d` package is the primary surface area in Milestones 1
and 2. It must:

- Render the authoritative 2D project document (ADR-001 project-local metric
  geometry, ADR-002 typed objects).
- Support interactive authoring (draw, select, move, rotate, reshape).
- Support CAD-style interactions: object snap (OSNAP) to endpoints,
  midpoints, intersections, centers; polar tracking; ortho mode; object-snap
  tracking (OTRACK); dynamic dimension lines.
- Render overlays (snap markers, alignment guides, dimension text, selection
  handles) during interaction.
- Scale to Milestone 3 generated RTG blocks — potentially 10k+ container-level
  shapes per project.
- Honor the theme system (`useActiveThemeTokens()` bridge per ADR-011).
- Work within the op-log-driven document model (ADR-010) without introducing
  a parallel source of truth for object state.

Choosing the wrong rendering foundation is expensive to undo. Once components
and interactions are built on top, migrating to a different renderer touches
every consumer. This ADR pins the choice before implementation starts.

## Options considered

### Renderer

**A. SVG (retained-mode DOM).** Each shape is a DOM node with CSS selectors
and native hit testing.

- Pros: resolution-independent; free hit testing via `element.matches`;
  accessible; easy PNG/SVG export.
- Cons: DOM node-per-shape does not scale past ~1–5k elements; panning
  triggers layout; even hidden nodes cost reflow; sub-pixel artifacts at
  extreme zoom from viewport transform precision.

**B. Plain Canvas2D (immediate mode).** Imperative `ctx.moveTo` / `ctx.lineTo`
/ `ctx.stroke` each frame. No retained scene. Redraw on every zoom/pan.

- Pros: scales to 50k+ shapes; level-of-detail trivial (conditional inside
  paint function); frustum culling free; devicePixelRatio handling is ~10 LOC.
- Cons: hit testing requires custom geometry math; text rendering slightly
  less rich than SVG + CSS; no DOM to inspect.

**C. Canvas2D with a scene-graph wrapper (Konva, Paper.js).** Library maintains
its own object tree; attaches event handlers per shape.

- Pros: saves ~500–2000 LOC of hit-test boilerplate; layer-based caching.
- Cons: the scene graph is a **second source of truth** that must mirror the
  op-log document (ADR-010). Every create/update/delete mutates two
  structures; undo/redo must tear down and rebuild scene nodes in sync.
  Duplicates the invalidation pattern of ADR-008.

**D. WebGL (Pixi.js or raw).** GPU rasterization with shaders.

- Pros: scales to 100k+ shapes; shader effects.
- Cons: overkill for M1; shader debugging cost; text rendering painful;
  harder to hire for.

### Zoom behaviour (common misconception)

Canvas2D is not pixelated at zoom when used correctly. The draw loop
re-runs on every zoom change, passing the new transform matrix to the
context. `ctx.lineTo(x, y)` accepts floating-point screen coordinates — at
5× zoom you pass 5× larger values and the browser rasterizes a fresh vector
path at full pixel precision. Identical crispness to SVG at every zoom level.
Figma, AutoCAD Web, Miro, FigJam, tldraw, and the post-migration Excalidraw
all use Canvas (or Canvas + WebGL). Authoritative geometry stays in
project-local metres as Float64 (ADR-001); rasterization happens once per
frame at the final zoom.

### Geometry math library

**A. `@flatten-js/core`.** Typed 2D Euclidean primitives (Point, Segment,
Line, Circle, Polygon); intersections, distances, projections, boolean ops.

- Pros: exactly the primitives OSNAP / OTRACK / polar need; typed; small;
  actively maintained.
- Cons: one more dependency.

**B. Roll our own.** Write primitives as needed.

- Pros: zero deps; full control.
- Cons: ~500 LOC of geometry primitives; subtle bugs in segment-segment
  intersection are easy to introduce.

**C. `turf.js`.** GeoJSON-first geospatial operations.

- Cons: heavy; geospatial-first; we work in project-local metric per ADR-001.

**D. `martinez-polygon-clipping` + ad-hoc.** Polygon boolean ops only.

- Cons: does not cover intersection / projection primitives.

### Spatial index

**A. `rbush` (R-tree).** Dynamic R-tree index; nearest-neighbor and
bounding-box queries.

- Pros: mature; small; exactly the interface CAD snap needs.
- Cons: one dependency.

**B. `kdbush` (k-d tree, point-only).** Cons: points only.

**C. `flatbush`.** Cons: static-only — full rebuild on each mutation; wrong
for interactive editing.

**D. Roll our own (grid or naive scan).** Cons: naive scan is O(n) per
query; grid index degrades for clustered layouts typical of port drawings.

### View-transform layer

**A. Roll our own (~100 LOC).** Linear domain→range mapping; mouse-wheel
zoom; click-drag pan; keyboard shortcuts.

- Pros: full control over snap-aware zoom and CAD keyboard ergonomics.
- Cons: ~100 LOC to write.

**B. `d3-zoom`.** Generic zoom/pan behavior.

- Pros: battle-tested.
- Cons: designed for data-visualization patterns; customising for
  snap-aware zoom and keyboard shortcuts needs override scaffolding; ~5 KB
  we can save.

## Decision

| Aspect | Choice |
|---|---|
| Renderer | **Plain Canvas2D**, imperative `paint(ctx, state)` pattern, driven by the op-log-backed document state (ADR-010). `devicePixelRatio` handled at canvas init. |
| Geometry math | **`@flatten-js/core`** for 2D Euclidean primitives. Revisit only if it becomes a measured bottleneck or a better-typed alternative emerges. |
| Spatial index | **`rbush`** (R-tree) over object bounding boxes for hit testing, snap targeting, and frustum culling. |
| View transform | **Roll our own** view-transform layer (~100 LOC). No `d3-zoom` dependency. |

### The paint pattern

```
paint(ctx, documentState, viewState, overlayState):
  clear(ctx)
  applyViewTransform(ctx, viewState)           // pan + zoom + DPR
  visible = rbush.search(viewFrustum)
  for each object in visible:
    drawObject(ctx, object, theme)
  drawOverlays(ctx, overlayState, theme)       // snap markers, guides, dimensions
```

- `documentState` is a Zustand selector on the document store (ADR-012).
- `viewState` is a separate slice (zoom, pan). Not undoable.
- `overlayState` is ephemeral UI state (active snap target, alignment lines,
  dimension preview). Not undoable.
- Redraw is triggered by Zustand `store.subscribe` on the relevant slices
  and by explicit `invalidate()` calls during interaction.

### Why not Konva / Paper / Pixi / SVG / WebGL

- **SVG:** DOM-cost ceiling at Milestone 3 scale; pan thrashes layout.
- **Konva, Paper.js:** second scene graph duplicates the op-log document
  (ADR-010); adds synchronization surface for every mutation.
- **Pixi.js, raw WebGL:** overkill for M1; shader debugging cost; text
  rendering pain.
- **Static export** (PNG, SVG) for reports and prints is handled separately
  via a dedicated render-to-export path when that feature lands (post-M1).

### What this ADR does NOT decide

The following are execution-phase design choices that emerge during M1
implementation, not pre-decided here:

- Tool state machine (SELECT, LINE, POLYGON, RTG_BLOCK).
- Snap engine implementation: priority resolution between overlapping
  candidates, tolerance thresholds, visual hierarchy of snap markers.
- Command / operation dispatch (already constrained by ADR-010; details in
  execution).
- Selection model (single vs multi; rubber-band semantics).
- Fillet and other node-level interactions.

If any of these reveal a shortcoming in this ADR during execution, the
remedy is a superseding ADR via §0.7, not silent drift.

## Consequences

- The 2D editor scales to Milestone 3 generated-content volumes without
  architectural rework.
- Level-of-detail, frustum culling, and interactive overlays are first-class
  in the paint loop.
- OSNAP / OTRACK / polar / ortho / dynamic dimensions are implementable as
  pure geometry + overlay draw code; no renderer-specific wrappers.
- Theme swaps trigger canvas redraw via the `useActiveThemeTokens()`
  dependency from ADR-011.
- `rbush` + `@flatten-js/core` form the editor's computation core; both are
  testable independently of rendering.

## What this makes harder

- Hit testing is our responsibility. An R-tree bounding-box query followed
  by a per-candidate geometry check is the standard pattern; no
  `element.matches` fallback.
- Text rendering quirks (font metrics, baseline positioning) must be handled
  explicitly when drawing labels and dimensions.
- Debugging a draw bug requires stepping through paint code; there is no
  "inspect element" equivalent on the canvas.
- Static image export (PNG, SVG) requires a separate render path when that
  feature lands.

## Cross-references

- **ADR-001** Coordinate System — geometry is project-local metric; view
  transform converts to screen pixels at render time.
- **ADR-002** Object Model — object geometry stored in GeoJSON with
  project-local coordinates; paint code reads the core object record.
- **ADR-008** 3D Derivation Cache — uses fingerprint-keyed descriptors; 2D
  rendering follows the same philosophy (derive from authoritative state;
  don't retain a parallel scene).
- **ADR-010** Document Sync — the document is the single source of truth;
  paint reads a selector, never mutates.
- **ADR-011** UI Stack — `ThemeProvider` and `useActiveThemeTokens()` feed
  canvas draw state.
- **ADR-012** Technology Stack — Zustand for state subscriptions; Biome for
  lint; pinned Node, pnpm, Vite versions.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-18 | Initial ADR. Pins M1 2D rendering foundations. |
