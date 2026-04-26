# Execution Plan

## Principle

Ship a closed loop end-to-end before widening the feature set. The architecture
is good enough. The risk now is analysis paralysis dressed as rigour.

## Milestone 1 — A perfected 2D drafting engine (revised 2026-04-26)

**Goal:** ship a CAD-adjacent 2D drafting surface that *feels* like CAD —
seven primitives, full operator suite, dimensions, full snap stack, and the
visual polish (live preview, snap glyphs, selection grips, etc.) that turns
"functional" into "natural to draft in." **No typed objects in M1.** The
typed-object pipeline (RTG_BLOCK, ROAD, BUILDING, PAVEMENT_AREA) starts in
M2.

This is a **strategic shift** from the previous version of this plan, which
folded typed-object work and the commercial-loop demo into M1.3b/M1.4. The
revised principle: prove the drafting surface end-to-end before introducing
typed-object semantics. The commercial-loop demo (draw a yard, see capacity)
moves from M1.4 to **M2** — it now arrives at the end of the first typed-
object milestone, with one type fully wired.

Path β confirmed (2026-04-26): typed objects can be created via two flows —
**direct-draw** (`sourceKind: 'direct'`, M2) and **promotion** (`sourceKind:
'promoted'`, M4). ADR-016 Path A's "unified pipeline" is interpreted as both
flows internally exercising the same primitive→typed-object machinery, with
the `sourceKind` field recording user-intent. No ADR change required.

### Sub-milestones

- **M1.1 — Foundation.** ✅ Shipped.
- **M1.2 — Project Model.** ✅ Shipped (domain types, project store,
  IndexedDB persistence, New / Save / auto-load).
- **M1.3a — Canvas + Primitives + Layers + Grid.** ✅ Shipped (tag
  `m1.3a`). `packages/editor-2d`, view transform, seven primitive draw
  tools (point, line, polyline, rectangle, circle, arc, xline), layer
  data model (ADR-017), grid entity (ADR-016), eleven essential operators
  per ADR-023 (Select, Erase, Move, Copy, Undo, Redo, Zoom, Pan, Properties,
  LA, Escape), basic OSNAP (endpoint / midpoint / intersection / node),
  GSNAP, Ortho modifier, command bar per ADR-023, coordinate-system UI.
  No typed objects, no promotion, no dimensions.
- **M1.3b — Modify operators.** Thirteen modify operators on primitives:
  Rotate, Mirror, Scale, Offset, Fillet, Chamfer, Trim, Extend, Join,
  Explode, Break, Array, Match. Plus the dedicated STRETCH command (with
  mode sub-options for crossing-window stretch). Bulge-arcs in polylines
  enter the world here via Fillet. No typed objects.
- **M1.3c — Dimensions + richer snap.** Dimension entity (ADR-018), seven
  dimension kinds (linear-aligned / linear-x / linear-y / angular / radius
  / diameter / arc-length), associative updates. POLAR (F10), OTRACK
  (F11), remaining OSNAP modes (perpendicular, tangent, parallel,
  quadrant, nearest, extension, apparent intersection).
- **M1.3d — Drafting UX polish.** Live drafting preview (rubber-band
  shapes with shared length / radius / angle labels), snap-target glyphs
  (per-mode shapes — square / triangle / × / ● / +), selection highlight
  + click-select grips, grip-drag stretch (M1.3d-specific; the dedicated
  STRETCH command lives in M1.3b), hover-entity highlight, default grid
  in the bootstrap project, status-bar live coordinate readout, cursor
  crosshair (continuous CURSORSIZE % + F-key preset toggle between full-
  canvas and pickbox-sized), selection rectangle with W/C direction
  convention (left-to-right = window selection / blue / fully enclosed;
  right-to-left = crossing / green / any-touch), and selection auto-fire
  on canvas click without active tool. Plus the shared infrastructure:
  mousemove routing through canvas-host, `canvas.transient.*` token
  namespace (separated from layer / ByLayer styling), shared
  `paintTransientLabel` painter, overlay paint pass. **End of M1.**

### Exit criteria for M1

- Seven primitive types draw cleanly with live preview during drafting,
  visible length / radius / angle readouts, and snap glyphs at OSNAP
  / GSNAP targets.
- Thirteen modify operators (plus STRETCH command) work on existing
  primitives; bulge-arcs appear via Fillet.
- Dimensions can be placed and update associatively when their referenced
  geometry moves.
- Snap stack complete: OSNAP (all modes), GSNAP, POLAR, OTRACK, Ortho,
  with priority resolution per ADR-016.
- Selection feels like CAD: click-select shows grips, hover gives a faint
  highlight, click-and-drag on canvas opens a window/crossing rectangle
  with the right colour conventions, grips stretch on drag.
- Status bar shows live cursor coordinates; cursor crosshair toggles
  between full-canvas and pickbox-sized.
- Document serialises and deserialises across the full primitive +
  layer + grid + dimension surface without loss.

### In scope (M1 as a whole, post-revision)

1. Project model with serialise / reload determinism ✅ (M1.2)
2. 2D canvas editor shell with view transform ✅ (M1.3a)
3. Coordinate system setup UI ✅ (M1.3a)
4. Seven first-class primitive types, layer model, grid entity, command
   bar, essential operators ✅ (M1.3a per ADR-016 / 017 / 023)
5. Thirteen modify operators + STRETCH command (M1.3b)
6. Dimension entity with associative references + POLAR / OTRACK +
   remaining OSNAP modes (M1.3c per ADR-018)
7. Drafting UX polish — live preview, snap glyphs, selection grips +
   stretch, hover highlight, default grid, coord readout, cursor
   crosshair, selection-rect direction convention (M1.3d)

### Explicitly out of M1

- Typed objects (RTG_BLOCK, ROAD, BUILDING, PAVEMENT_AREA) — **M2**
- Extraction + validation + capacity panel — **M2**
- Promotion contract (`sourceKind: 'promoted'` flow) — **M4**
- 3D viewer
- Library system, scenarios, generator
- Authentication, multi-user, permissions, deployment infra
- Theme switcher (pick dark or light, ship one)

### Design system scope in M1

Design tokens exist from day one — the three-layer architecture (primitives,
semantic, theme) as a TypeScript module of perhaps 100-150 lines. A theme
context provider. CSS custom property generation. **No component library,
no Storybook, no component documentation beyond inline TypeScript types.**
M1.3d adds a `canvas.transient.*` token sub-namespace for in-flight UI
(preview / snap / selection rect / crosshair) explicitly outside the layer
ByLayer ladder.

The token system is cheap and painful to retrofit. The component library is
expensive and fine to grow organically.

## Milestone 2 — First typed object end-to-end (commercial loop closes here)

**Goal:** prove the typed-object architecture by shipping ONE type
end-to-end — RTG_BLOCK — via the **direct-draw path** (`sourceKind:
'direct'`), with extraction, validation, and the capacity-summary panel.
This is where the commercial loop closes for the first time.

### In scope

1. Typed-object schema + direct-draw tool for RTG_BLOCK (per
   `extraction-registry/RTG_BLOCK.md`)
2. `sourceKind: 'direct'` flow — direct-draw tool emits a typed object
   without surfacing a promotion ceremony (the unified pipeline runs
   internally per ADR-016 Path A, but the user invokes "Draw RTG_BLOCK"
   not "Draw polyline + Convert")
3. RTG_BLOCK extractor per `extraction-registry/RTG_BLOCK.md`
4. Three validation rules: BLOCK_LENGTH_MAX, BLOCK_LENGTH_MIN,
   TRUCK_LANE_MIN_WIDTH
5. Yard capacity summary panel (TEU read-out)
6. Save / reload deterministic extraction verification
7. Properties panel surfaces typed-object parameters with object-specific
   fields

### Exit criteria for M2

- An engineer can clone the repo, run it locally, create a project, draw
  an RTG_BLOCK directly, see the extracted outputs (TEU capacity) in the
  summary panel, save, reload, and see the same outputs.
- The three validation rules trigger correctly on test cases.
- The extractor produces deterministic output given identical input.
- The document serialises and deserialises without loss across primitives
  + the new RTG_BLOCK type.

## Milestone 3 — Widen the typed-object set (3-4 weeks)

**Goal:** validate that the typed-object architecture and extraction
contract scale across the core types.

### In scope

1. ROAD, BUILDING, PAVEMENT_AREA typed objects with their direct-draw
   tools
2. Extractors for each type per `extraction-registry/`
3. Validation rules per registry
4. Cross-object validation (road-in-stack-zone, building-in-setback)
5. Classification system (right-click → classify)
6. Object managers (pavement manager, building manager) matching the
   prototype
7. Fillet hover slider on road nodes
8. Properties panel with object-specific fields per type

### Exit criteria

- All four object types draw, extract, validate, save, and reload.
- Cross-object validation rules fire correctly.
- Classification changes extractor behaviour where it should
  (e.g. GATE_APPROACH road changes the lane minimum validation).

## Milestone 4 — Promotion contract (productivity layer)

**Goal:** add the alternate path for typed-object creation —
**promotion of existing primitives** to typed objects via right-click
→ Convert. Pure productivity layer; the architecture has already
proved itself in M2/M3 via direct-draw.

### In scope

1. Constructors registry surface (per ADR-016 §Promotion contract)
2. Right-click → Convert UI (context menu populated from the registry's
   "given a selected primitive kind, which typed-object targets are
   valid?" index)
3. `sourceKind: 'promoted'` + `sourceProvenance` audit trail (the
   `'promoted'` arm of the field declared in ADR-019)
4. Re-align operation per drawn-vs-canonical principle (e.g. ROAD
   centerline / left / right alignment shift post-creation)
5. Promotion atomicity (`promotionGroupId` so undo reverses the
   primitive-DELETE + typed-object-CREATE pair atomically)

### Exit criteria

- Drawing a polyline and right-clicking → "Convert to ROAD" produces a
  ROAD with `sourceKind: 'promoted'` and the original polyline is
  consumed.
- Undo reverses the entire promotion atomically (primitive returns,
  typed object disappears).
- The Convert context menu is populated from the registry, not
  hard-coded; adding a new typed object in the registry surfaces
  automatically.

## Milestone 5 — Generator and library (3-4 weeks)

**Goal:** add the distinctive generative layout capability and the library
governance model.

### In scope

1. Planar graph construction from road network + site boundary
2. Host space recognition via face extraction
3. Space use type assignment UI (click empty space → pick use type)
4. RTG_BLOCK generator (packing algorithm with design rules)
5. Reactive regeneration triggered by constraint changes
6. Ownership state UI (badges for GENERATED / FROZEN / DETACHED)
7. DETACHED warning on regeneration
8. Library system with snapshot and override per ADR-005
9. Library manager UI for global, tenant, project levels
10. Scenario system as parameter overlay per ADR-006

### Exit criteria

- User draws roads enclosing a space, clicks the space, assigns
  "container stacks", sees generated blocks.
- Moving a bounding road triggers regeneration, generated blocks update
  live.
- Manually editing a generated block transitions it to DETACHED and
  protects it from overwrite.
- Freezing a block excludes it from regeneration and treats it as an
  obstacle.
- Libraries can be imported into projects with version provenance
  recorded.
- Two scenarios produce different capacity outputs from the same
  geometry.

## Milestone 6 — Costing and revenue (2-3 weeks)

**Goal:** widen the commercial loop closed in M2.

### In scope

1. Costing assembly library (unit rates linked to extracted quantities)
2. Cost computation per object and rolled up to project
3. Revenue computation from throughput × tariff
4. Project financial summary panel
5. Scenario-level cost and revenue comparison
6. Document upload attached to library items and rate sources

### Exit criteria

- Draw a multi-block RTG yard with roads + buildings + pavement, see
  TEU capacity, see capex estimate, see revenue projection — all
  deterministically derived and traceable to their sources.

## Milestone 7 — 3D viewer and final polish (3-4 weeks)

**Goal:** add the derived 3D view and bring the UI to demo quality.

### In scope

1. Mesh descriptor cache per object with geometry fingerprint (ADR-008)
2. 3D scene composition from cached descriptors
3. Road 3D with correct lane markings
4. Building 3D with roof types and storey counts
5. Pavement 3D
6. RTG_BLOCK 3D with containers, RTG crane, occupancy slider
7. Theme switcher (dark / light)
8. Component library extraction and Storybook setup
9. Shell polish and interaction refinement
10. Component documentation

### Exit criteria

- Switching to 3D tab renders the current project.
- Editing a single object invalidates only that object's mesh.
- Scene loads quickly on tab switch (cache hits).
- Both themes render correctly.
- Component library is documented for future feature work.

## Beyond Milestone 7

The deferred items from the architecture pack become candidates:

- Real-time multi-user editing (CRDT adoption on top of operation log)
- Bathymetric and tidal data layers
- Temporal phasing model
- Vessel call schedule and throughput entry mode
- Geometry branching in scenarios
- External API
- Advanced solver separation into its own service

None of these are committed to dates. Each requires its own ADR if selected.

## Meta-discipline

### What must exist before any code is written

- The ADRs (already written)
- The extraction registry entries for the object types being implemented in
  the current milestone (already written for M1 typed objects = none, M2 =
  RTG_BLOCK, M3 = ROAD / BUILDING / PAVEMENT_AREA)
- This execution plan (this document)
- The repository scaffold with linting and formatting configured

### What must exist before a milestone starts

- Updated extraction registry entries for any new object types
- Updated or new ADRs for any architectural decisions that have emerged
- A brief milestone kickoff note describing what is being built and what is
  explicitly excluded

### What must exist at the end of each milestone

- All exit criteria demonstrably met
- Documentation updated in the same PRs as the feature work
- A short retrospective noting what was harder than expected and what emerged
- Any new ADRs capturing decisions made during the milestone

## The trap to avoid

The temptation will be to keep refining architecture before building. The
architecture is good enough to start. When a milestone reveals something the
architecture got wrong, update the ADRs and move on. Do not pre-solve problems
that have not appeared yet.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | (initial) | Initial plan: M1 ships RTG_BLOCK end-to-end; M2 widens; M3+ later. |
| 1.1.0 | 2026-04-23 | Per ADR-016, M1 split into M1.3a/b/c (drafting → typed objects → dimensions) and M1.4 closing the commercial loop. |
| 2.0.0 | 2026-04-26 | **Path β re-slice**: typed objects move out of M1 entirely. M1 = perfected 2D drafting engine (M1.3a ✅ + M1.3b modify ops + M1.3c dimensions/snap + M1.3d polish). M2 = first typed object (RTG_BLOCK) with direct-draw + extraction + capacity panel — commercial loop closes here. M3 = widen typed objects. M4 = promotion as productivity layer. M5 = generator + library + scenarios. M6 = costing. M7 = 3D + final polish. ADR-016 unchanged (`sourceKind: 'direct'/'promoted'` records user intent over the unified Path A pipeline). |
