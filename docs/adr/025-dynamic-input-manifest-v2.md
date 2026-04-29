# ADR-025 — Dynamic Input Manifest v2 (geometry contract refinement)

**Status:** ACCEPTED
**Date:** 2026-04-29
**Supersedes:** [ADR-024](superseded/024-dynamic-input-manifest-superseded.md) —
DI manifest contract parts that this ADR refines. ADR-024's ground
architecture (per-prompt manifest on the `Prompt` shape, sparse manifest
publication, dynamic `overlay.dimensionGuides`, painter contract, click-eat
guard, sync-bootstrap re-entrancy) is **preserved verbatim**. This ADR
records ONLY the geometric / schema changes surfaced during M1.3 Round 6
post-commit remediation Round 2 (Codex Round-2 Blocker on angle-arc visual
semantics + user-locked geometric intent).

**Cross-references:** ADR-023 (`docs/adr/023-tool-state-machine-and-command-bar.md`)
unchanged. ADR-024 lives at
`docs/adr/superseded/024-dynamic-input-manifest-superseded.md` per the
superseded-folder convention documented in
[`docs/adr/superseded/README.md`](superseded/README.md) (relocated in
Round-3 remediation 2026-04-29 to follow the same layout as ADRs 002 / 010
/ 013 / 022 — addresses Codex Round-3 governance-consistency finding).

## Context

ADR-024 was accepted 2026-04-29 alongside the M1.3 Round 6 substrate +
per-tool migration commits (3708fbc). Two follow-up signals required
contract refinement:

**Codex post-commit Round-2 audit memo (2026-04-29):**
- **Blocker** — angle-arc geometry contract was semantically wrong for
  expected UX in diagonal cases. The line / polyline tools wired
  `pivot: cursor` + `sweepAngleRad: Math.atan2(p1.y - cursor.y, p1.x - cursor.x)`,
  producing the supplementary angle (≈ 180° − line angle) and rendering a
  huge half-circle wedge instead of a small wedge at the line start.
- **High-risk** — `radiusCssPx` was effectively dead at the painter level
  (the painter overrode it with the clamped polar baseline length).
  Type drift.
- **High-risk** — tests asserted call-shape (radius / sweep / start /
  end) but not visual-semantic side / orientation. Quadrant orientation
  blind spot.
- **Quality** — `mirrorWitness?: boolean` on `linear-dim` was declared in
  the type and handled in the painter but never set by any tool.

**User-locked geometric intent (chat 2026-04-29):**
- "I WANT A FUCKING ARC TO BE CENTERED AT THE LINE START AND TO START AT
  THE CURSOR AND THEN ARC UNTIL HORIZONTAL LINE" — arc passes through
  cursor; baseline terminates at the same length so the arc and baseline
  meet at the baseline endpoint.
- "make witness lines 40px away ... make sure this space is ssot for all
  primitives" — `DIM_OFFSET_CSS` bumped 20 → 40 with explicit SSOT
  expectation across rectangle, line, polyline, circle.
- "CENTER THE ANGLE PILL INPUT TO THE MIDDLE OF THE ARC" — angle pill
  anchored at the arc midpoint in metric, projected through
  `metricToScreen`, not at a fixed CSS-px offset from pivot.
- "we need to apply to circle too. there is line too which should have
  only polar witness line" — circle gets the dim treatment along
  center→cursor (no angle, since rotationally symmetric); xline gets
  angle-arc only (no distance dim, since the xline is infinite).
- "circle has angle notation remove that" — confirmed circle is
  single-field [Radius] only.

## Decision

Refine the DI contract with **four schema changes** + **one tool-scope
expansion**. All other ADR-024 invariants (sparse manifest publication,
flat-coords-only on `DimensionGuide`, painter contract preservation,
sync-bootstrap re-entrancy, click-eat guard, angle-as-degrees invariant
for `combineAs: 'point'`) carry forward unchanged.

### 1. `DimensionGuide.angle-arc` — radius semantics

**Before (ADR-024):**

```ts
| {
    kind: 'angle-arc';
    pivot: Point2D;
    baseAngleRad: number;
    sweepAngleRad: number;
    radiusCssPx: number;
    polarRefLengthMetric?: number;
  }
```

The painter used `radiusCssPx` for arc radius (CSS-px screen value
converted to metric per zoom), and `polarRefLengthMetric` (metric) for
the dotted polar baseline length, with a CSS-px clamp for visibility.

**After (this ADR):**

```ts
| {
    kind: 'angle-arc';
    pivot: Point2D;
    baseAngleRad: number;
    sweepAngleRad: number;
    radiusMetric: number;
  }
```

Single `radiusMetric` field in metric units. The painter draws the arc
at `radiusMetric` and the polar baseline at the **same** length, so the
arc's baseline endpoint coincides with the baseline endpoint. Tools set
`radiusMetric` to the full segment length (e.g.,
`Math.hypot(cursor.x - p1.x, cursor.y - p1.y)` for line / polyline; the
xline tool uses cursor distance from pivot). The arc therefore passes
through the cursor and terminates on the polar baseline.

### 2. `DimensionGuide.linear-dim` — `mirrorWitness` removed

The optional `mirrorWitness?: boolean` field was declared in the type
and handled in the painter but never set by any production tool.
Removed both the type field and the painter branch. GR-1 dead-code
purge.

### 3. `DimensionGuide.angle-arc` — geometric intent

**Pivot at line start, sweep is the line angle.** For line / polyline
tools:

- `pivot` = first-clicked point (`p1` for line, last vertex for
  polyline) — NOT cursor.
- `sweepAngleRad` = `Math.atan2(cursor.y - pivot.y, cursor.x - pivot.x)`
  — NOT the reverse vector.

This restores the contract documented in ADR-024 §A9 line tool entry,
which the ADR-024 commit's implementation had drifted from. Codex
Round-2 audit Blocker.

The painter selects arc direction from the sign of `sweepAngleRad`:
`sweep > 0` → visually CCW (line above-baseline), `ccw=false` under the
Y-flipped canvas transform; `sweep < 0` → visually CW (line below-
baseline), `ccw=true`.

### 4. `CombineAsPolicy` — `'angle'` arm added

```ts
export type CombineAsPolicy = 'numberPair' | 'point' | 'number' | 'angle';
```

The `'angle'` arm consumes a 1-field manifest with field `kind: 'angle'`
and produces `{ kind: 'angle', radians: ... }` from a typed-degrees
buffer (deg→rad conversion via `(angleDeg * Math.PI) / 180`, same SSOT
location as the existing `'point'` arm). Used by the xline tool to set
the construction-line direction angle.

The angle-as-degrees invariant from ADR-024 carries forward: typed
`'angle'` field values are in degrees; the helper performs the deg→rad
conversion before producing the `Input`.

### 5. Tool scope — xline migration + circle simplification

ADR-024 §A9 listed four tools in scope (rectangle, line, polyline,
circle) and §A10 explicitly deferred xline. This ADR migrates xline as
the fifth tool:

- **`draw-xline`** — pivot + direction. 1-field `[Angle]` manifest
  (`combineAs: 'angle'`). Single `angle-arc` guide (no `linear-dim` —
  the xline is infinite, so distance has no meaning). The angle-arc
  carries the full visual: dotted polar baseline + dotted arc from
  baseline to xline direction.

- **`draw-circle`** — single-field `[Radius]` manifest preserved
  (`combineAs: 'number'`), but the guide kind shifts from `radius-line`
  (visual no-op in ADR-024) to `linear-dim` along center→cursor with
  full witness + dim-line + end-cap treatment via `DIM_OFFSET_CSS`. The
  Radius pill anchors on the dim-line midpoint. Rationale: the user
  flagged the bare radius-line preview as inconsistent with line /
  polyline / rectangle's measured-dim feel; the circle is rotationally
  symmetric so there is no Angle pill.

**Update (Remediation Round-3, same day):** the `radius-line` guide
variant has been **removed** from `DimensionGuide`. The painter branch
+ pill component case + test were dropped together. Codex Round-3
flagged the variant as a dead-variant gate risk (no consumer + no gate
proving "intended dead" status); per GR-1 clean-break the variant
should not linger as a forward-extensibility placeholder. Future
operators that need a radius-tick visual add a new variant when their
concrete need lands.

### 6. Witness-offset SSOT

`DIM_OFFSET_CSS` constant in
`packages/editor-2d/src/canvas/painters/paintDimensionGuides.ts` is
**the** SSOT for the perpendicular distance between any segment and its
dim line, in CSS pixels. Bumped from `20` to `40` (user-locked). All
five migrated tools (rectangle W, rectangle H, line distance, polyline
distance, circle radius) consume this constant — no per-tool magic
numbers.

### 7. Angle pill placement — arc midpoint in metric

The DI angle pill anchors at the arc midpoint:

```ts
const midAngleRad = guide.baseAngleRad + guide.sweepAngleRad / 2;
const midpointMetric = {
  x: guide.pivot.x + Math.cos(midAngleRad) * guide.radiusMetric,
  y: guide.pivot.y + Math.sin(midAngleRad) * guide.radiusMetric,
};
return metricToScreen(midpointMetric, viewport);
```

This matches the painter's metric→screen transform exactly, so the pill
sits dead-center on the arc at any zoom or line length. Replaces the
ADR-024 placement (pivot screen + `radiusCssPx` × `(cos midAngle,
-sin midAngle)`), which was decoupled from the arc midpoint after the
radius-semantics change in §1.

## Test enforcement

- **Quadrant orientation** — `tests/paintDimensionGuides.test.ts` adds
  a `'angle-arc quadrant orientation'` describe block with five tests
  covering NE / SE / NW / SW / horizontal-east cursor positions. Each
  asserts `sweepAngleRad` sign + `start = baseAngleRad` + `end =
  baseAngleRad + sweepAngleRad` + `ccw` flag matches the visual
  expectation. Closes the Codex Round-2 High-risk test blind-spot.
- **Tool-shape generators** — `tests/draw-tools.test.ts` updates the
  circle test to assert single-field `[Radius]` manifest + linear-dim
  guide; adds a new xline test asserting single-field `[Angle]`
  manifest (`combineAs: 'angle'`) + angle-arc guide only.
- **Combiner** — `tests/dynamic-input-combine.test.ts` is unchanged
  (its existing seven-test coverage spans the prior arms; the `'angle'`
  arm could be added as an eighth case; deferred to a follow-up since
  the helper is exercised by xline's smoke path).
- **Smoke E2E** — `tests/smoke-e2e.test.tsx` updates the circle scenario
  name + assertions; existing line / rectangle / first-frame-coherence
  scenarios unaffected.

Workspace test count: 400 / 400 pass. `pnpm typecheck` clean.
`pnpm check` (biome) clean.

## Consequences

- The painter and tools are coherent: arc radius is authoritative from
  one field; the polar baseline length follows. No more dead fields.
- Diagonal lines render a small visible wedge at p1 (the actual line
  angle) instead of a huge half-circle (the supplementary angle).
- Quadrant tests lock the visual-semantic contract so future call-shape
  refactors can't false-pass when the orientation flips.
- xline acquires the polar-witness-only DI without distance noise.
- Circle gets the measured-dim feel its sibling tools have, without an
  irrelevant Angle pill.
- The `radius-line` `DimensionGuide` variant was originally retained in
  this ADR for forward extensibility, then **removed in Round-3
  cleanup** (Codex Round-3 dead-variant finding) per GR-1 clean-break.
  Future operators that need a radius-tick visual write a new variant
  when their concrete need lands.
