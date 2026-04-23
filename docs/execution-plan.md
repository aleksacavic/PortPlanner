# Execution Plan

## Principle

Ship a closed loop end-to-end before widening the feature set. The architecture
is good enough. The risk now is analysis paralysis dressed as rigour.

## Milestone 1 — The end-to-end proof (revised 2026-04-23 by ADR-016)

**Goal:** prove that the core loop works for one object type, from draft →
classify → extract → validate → saved output. Revised from the original
"RTG_BLOCK as the only drawable object type" framing: ADR-016 established
the hybrid primitive + typed-object data model, which means M1 now ships
the drafting surface first and closes the commercial loop via promotion.
The loop-closure milestone is now M1.4 rather than M1.3.

### Sub-milestones

- **M1.1 — Foundation.** ✅ Shipped.
- **M1.2 — Project Model.** ✅ Shipped (domain types, project store, IndexedDB persistence, New/Save/auto-load).
- **M1.3 — Hybrid Drafting Surface.** Broken into three sub-milestones per ADR-016:
  - **M1.3a — Canvas + Primitives + Layers + Grid.** `packages/editor-2d`, view transform, seven primitive draw tools (point, line, polyline, rectangle, circle, arc, xline), layer data model (ADR-017), grid entity (ADR-016), essential operators per ADR-022 (Select, Erase, Move, Copy, Undo/Redo, Zoom, Pan, Properties, Escape, F-key toggles), basic OSNAP (grid / endpoint / midpoint / intersection), ortho modifier, command bar per ADR-022, coordinate-system UI. No typed objects, no promotion, no dimensions.
  - **M1.3b — Promotion + First Typed Object.** Promotion contract implementation (Path A unified pipeline per ADR-016), constructors registry surface, `sourceKind` / `sourceProvenance` provenance (ADR-019), RTG_BLOCK as the first typed object type, re-align operation per drawn-vs-canonical principle, core modify operators (Rotate, Mirror, Scale, Offset, Fillet, Chamfer, Trim, Extend, Join, Explode, Break, Array, Match). No extraction or validation yet.
  - **M1.3c — Dimensions + Richer Snap.** Dimension entity (ADR-018), seven dimension kinds, associative updates, POLAR, remaining OSNAP modes, OTRACK.
- **M1.4 — Extraction + Validation + Capacity Panel (closes the commercial loop).** RTG_BLOCK extractor per `extraction-registry/RTG_BLOCK.md`, three validation rules (BLOCK_LENGTH_MAX, BLOCK_LENGTH_MIN, TRUCK_LANE_MIN_WIDTH), yard capacity summary panel, save/reload deterministic extraction verification.

### In scope (M1 as a whole, post-ADR-016)

1. Project model with serialise/reload determinism ✅ (M1.2)
2. 2D canvas editor shell with view transform (M1.3a)
3. Coordinate system setup UI (M1.3a)
4. Seven first-class primitive types, layer model, grid entity, command bar, essential operators (M1.3a per ADR-016/017/022)
5. Promotion contract + RTG_BLOCK as first typed object + core modify operators (M1.3b per ADR-016/019)
6. Dimension entity with associative references + POLAR/OTRACK snap (M1.3c per ADR-018)
7. RTG_BLOCK extractor per `extraction-registry/RTG_BLOCK.md` (M1.4)
8. Three validation rules: BLOCK_LENGTH_MAX, BLOCK_LENGTH_MIN, TRUCK_LANE_MIN_WIDTH (M1.4)
9. Yard capacity summary panel (M1.4)
10. Save/reload deterministic extraction verification (M1.4)

### Explicitly out of scope

- 3D viewer
- Other object types (road, building, pavement — come in Milestone 2)
- Library system
- Scenario management
- Generator and space recognition
- Full design system and component library
- Theme switcher (pick dark or light, ship one)
- Authentication beyond simplest possible stub
- Multi-user, permissions, RBAC
- Deployment infrastructure beyond local development

### Design system scope in M1

Design tokens exist from day one — the three-layer architecture (primitives,
semantic, theme) as a TypeScript module of perhaps 100-150 lines. A theme
context provider. CSS custom property generation. **No component library,
no Storybook, no component documentation beyond inline TypeScript types.**

The token system is cheap and painful to retrofit. The component library is
expensive and fine to grow organically.

### Exit criteria

- An engineer can clone the repo, run it locally, create a project, draw an
  RTG_BLOCK, see the extracted outputs in the summary panel, save, reload, and
  see the same outputs.
- The three validation rules trigger correctly on test cases.
- The extractor produces deterministic output given identical input.
- The document serialises and deserialises without loss.

## Milestone 2 — Widen the object set (3-4 weeks)

**Goal:** validate that the extraction contract and ownership model scale
across the core object types.

### In scope

1. ROAD, BUILDING, PAVEMENT_AREA object types with their tools
2. Extraction contracts for each, per `extraction-registry/`
3. Validation rules per the registry
4. Cross-object validation (road-in-stack-zone, building-in-setback)
5. Classification system (right-click → classify)
6. Object managers (pavement manager, building manager) matching the prototype
7. Fillet hover slider on road nodes
8. Node drag to reshape for all object types
9. Properties panel with object-specific fields

### Exit criteria

- All four object types draw, extract, validate, save, and reload.
- Cross-object validation rules fire correctly.
- Classification changes extractor behaviour where it should (e.g. GATE_APPROACH
  road changes the lane minimum validation).

## Milestone 3 — Generator and library (3-4 weeks)

**Goal:** add the distinctive generative layout capability and the library
governance model.

### In scope

1. Planar graph construction from road network + site boundary
2. Host space recognition via face extraction
3. Space use type assignment UI (click empty space → pick use type)
4. RTG_BLOCK generator (packing algorithm with design rules)
5. Reactive regeneration triggered by constraint changes
6. Ownership state UI (badges for GENERATED/FROZEN/DETACHED)
7. DETACHED warning on regeneration
8. Library system with snapshot and override per ADR-005
9. Library manager UI for global, tenant, project levels
10. Scenario system as parameter overlay per ADR-006

### Exit criteria

- User draws roads enclosing a space, clicks the space, assigns "container
  stacks", sees generated blocks.
- Moving a bounding road triggers regeneration, generated blocks update live.
- Manually editing a generated block transitions it to DETACHED and protects
  it from overwrite.
- Freezing a block excludes it from regeneration and treats it as an obstacle.
- Libraries can be imported into projects with version provenance recorded.
- Two scenarios produce different capacity outputs from the same geometry.

## Milestone 4 — Costing and revenue (2-3 weeks)

**Goal:** close the commercial loop.

### In scope

1. Costing assembly library (unit rates linked to extracted quantities)
2. Cost computation per object and rolled up to project
3. Revenue computation from throughput × tariff
4. Project financial summary panel
5. Scenario-level cost and revenue comparison
6. Document upload attached to library items and rate sources

### Exit criteria

- Draw an RTG yard, see TEU capacity, see capex estimate, see revenue
  projection — all deterministically derived and traceable to their sources.

## Milestone 5 — 3D viewer and polish (3-4 weeks)

**Goal:** add the derived 3D view and bring the UI to demo quality.

### In scope

1. Mesh descriptor cache per object with geometry fingerprint
2. 3D scene composition from cached descriptors
3. Road 3D with correct lane markings
4. Building 3D with roof types and storey counts
5. Pavement 3D
6. RTG_BLOCK 3D with containers, RTG crane, occupancy slider
7. Theme switcher (dark/light)
8. Component library extraction and Storybook setup
9. Shell polish and interaction refinement
10. Component documentation

### Exit criteria

- Switching to 3D tab renders the current project.
- Editing a single object invalidates only that object's mesh.
- Scene loads quickly on tab switch (cache hits).
- Both themes render correctly.
- Component library is documented for future feature work.

## Beyond Milestone 5

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
  the current milestone (already written for M1 and M2)
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
architecture is good enough to start. When Milestone 1 reveals something the
architecture got wrong, update the ADRs and move on. Do not pre-solve problems
that have not appeared yet.

The first PR should create the repo structure and a README pointing to this
architecture pack. The second PR should be the minimum project model. Move.
