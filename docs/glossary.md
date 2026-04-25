# Domain Glossary

Precise definitions for terms that are used across the codebase and
documentation. When a term here changes meaning, the change is dated in-line
and the rationale noted.

## Spatial terms

**Project-local coordinate system** — the metric Cartesian plane used for all
engineering computation within a project. Origin is defined per project. X/Y
are metres. Rotation is set by the project's true north alignment. All geometry
is stored in this system. See `coordinate-system.md` and ADR-001.

**WGS84 coordinates** — geodetic latitude/longitude used at the API boundary
and for basemap display only. Never used for engineering math.

**Bay axis** — for a container stack, the line along which the RTG travels and
containers are placed end-to-end. Length dimension of each container (CL_M =
6.058m) is along this axis.

**Cross-bay axis** — perpendicular to the bay axis. Width dimension of each
container (CW_M = 2.438m) is along this axis. The RTG girder spans this
direction.

## Object terms

**Object** — any spatial element in the project. Has identity,
geometry, classification, parameters, and ownership state.

**Object type** — the formal category of an object: `RTG_BLOCK`, `ROAD`,
`BUILDING`, `PAVEMENT_AREA`, `BERTH`, etc. Each type has a registered
extraction contract.

**Classification** — a sub-category within an object type. A road may be
classified as `GATE_APPROACH`, `PERIMETER`, `INTERNAL`. A building may be
classified as `WAREHOUSE`, `ADMIN`, `WORKSHOP`. Classification affects
validation rules and cost rates.

**Parameters** — the extensible properties of an object beyond its geometry.
For an RTG_BLOCK: containers_wide, stack_height, rows, RTG type. Stored in
JSONB.

## Ownership terms

**AUTHORED** — object drawn directly by the user. Moves freely. Never touched
by the generator. Moving an authored object may trigger regeneration of
dependent generated objects.

**GENERATED** — object created by the generator from an authored constraint
set. Has no manual edits. Safe to regenerate when constraints change.

**FROZEN** — object that was generated, then explicitly frozen by the user.
Excluded from regeneration. Treated as an obstacle by the generator on
subsequent runs.

**DETACHED** — object that was generated, then manually edited by the user.
Regeneration does not silently overwrite it. The system prompts the user to
either discard manual edits (regenerate) or freeze the object.

## Library terms

**Platform global library** — the base library maintained by the platform.
Versioned. Contains reference equipment templates, building types, pavement
types, and benchmark unit rates.

**Tenant library** — the organisation's own library. May extend or override
the platform library. Regional variants live here.

**Project snapshot** — a frozen copy of library items at the moment they were
imported into a project. Records the library version at import time. Does not
automatically update when the source library updates.

**Project override** — a project-specific modification of a snapshot item. Has
an explicit reason and timestamp.

**Scenario delta** — a scenario-specific change layered on top of the project
baseline. Does not modify the project baseline itself.

## Extraction and analysis terms

**Extractor** — a pure function registered per object type that takes
geometry + parameters + scenario overrides and returns a typed QuantityBundle.
Versioned. See ADR-004.

**QuantityBundle** — the typed output of an extractor. Contains physical
quantities (area, length, volume), operational quantities (TEU slots, crane
positions), and equipment quantities (RTG count, gate lanes).

**Extraction contract** — the formal specification of what an extractor
consumes and produces, written before the extractor is implemented. Lives in
`extraction-registry/`.

**Validation rule** — a function registered against an object type or
relationship that checks a condition and returns an error, warning, or info
result. Runs as part of the derivation pipeline.

## Scenario terms

**Scenario (V1)** — a named parameter overlay on the project baseline.
Contains operational assumptions, financial assumptions, library overrides,
and quantity overrides. Does not modify geometry. See ADR-006.

**Scenario (V2, deferred)** — may additionally contain geometry branches.
Not in V1.

**Baseline** — the project's default scenario. The geometry the project was
drawn against.

## Document and sync terms

**Project** — the authoritative, serializable value representing the
entire project state. Includes objects, settings, library snapshots, and
scenarios. Previously called "project document" (pre-2026-04-22); renamed
for simplicity and consistency with the user-facing word. Semantics
unchanged.

**Operation** — a single mutation to the project. Logged with id,
timestamp, user, and payload. Used for sync.

**Operation log** — the append-only sequence of operations since last sync.
Replayed on reconnect. See ADR-010.

**Last-write-wins at object level** — when two users edit different objects,
both changes apply. When two users edit the same object, the later
server-timestamped operation wins. See ADR-010.

## UI terms

**Tool** — the active drawing or editing mode in the 2D editor. `SELECT`,
`LINE`, `ROAD`, `POLYGON`, etc.

**Snap** — the proximity-based target identification that guides cursor
placement to endpoints, midpoints, or intersections of nearby geometry.

**Handle** — a visual control attached to a selected object that enables a
specific interaction: move, rotate, or reshape.

**Host space** — an enclosed area automatically recognised by the planar
graph extraction from the road network. Can have a use type assigned
(container stacks, empty yard, parking). Becomes the input polygon for the
generator.

## Drawing surface terms (M1.3a, ADRs 016–017, 023)

**Primitive** — a first-class persistent geometry entity in the drafting
surface. Seven kinds in M1.3a: point, line, polyline, rectangle, circle,
arc, xline. Carries no ownership state and is not extracted. ADR-016.

**Layer** — an organisational grouping for primitives, grids, dimensions,
and typed objects. Carries default style (color, lineType, lineWeight) and
visibility / frozen / locked flags. ADR-017.

**Default layer** — the protected layer named `"0"` seeded on project
creation. Cannot be deleted or renamed; orphan-id references fall back to
it. ADR-017.

**DisplayOverrides** — the open key-value bag on every entity that
overrides ByLayer defaults: `{ color?, lineType?, lineWeight? }`. Missing
key = inherit from layer; present key = explicit override. ADR-017.

**Grid** — a first-class drafting-aid entity with origin, angle, X/Y
spacings, layer membership, visibility, and `activeForSnap` flag. ADR-016.

**Xline** — an infinite construction line defined by a pivot point and an
angle. First-class primitive; layer membership controls visibility.
ADR-016.

**Bulge** — DXF-convention scalar `tan(θ/4)` encoding the included arc
angle and direction (sign) of a polyline segment. `bulge === 0` means
straight; positive bulge = CCW. ADR-016.

**ByLayer** — effective-style resolution rule: `effective.<key> =
displayOverrides.<key> ?? layer.<key>`. ADR-017.

**OSNAP** — object snap. Cursor magnetises to specific geometric features
of nearby entities (endpoint, midpoint, intersection, node). Remaining
modes (center, perpendicular, tangent, parallel, quadrant, nearest,
extension, apparent intersection) deferred to M1.3c. ADR-016, ADR-021.

**GSNAP** — grid snap. Cursor magnetises to grid nodes (or grid lines as
fallback). Multi-grid supported; `activeForSnap` flag per grid. ADR-016,
ADR-021.

**Ortho** — modifier that constrains cursor motion to ±X / ±Y of the
active drafting frame (WCS in M1.3a — bay-axis / cross-bay-axis) relative
to the previous point in a tool's prompt chain. M1.3a, F8 toggle.

**Snap priority** — resolution order when multiple snap candidates apply
(highest to lowest): OSNAP → OTRACK → POLAR → GSNAP → grid-line fallback.
Ortho is a modifier applied after all snaps. ADR-016 §GSNAP ordering.

**View transform** — pan + zoom + DPR transformation between project-local
metric and screen pixels. Custom implementation in
`packages/editor-2d/src/canvas/view-transform.ts`. ADR-021.
