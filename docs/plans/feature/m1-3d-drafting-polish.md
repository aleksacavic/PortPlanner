# Plan — M1.3d Drafting UX Polish

**Branch:** `feature/m1-3d-drafting-polish`
**Author:** Claude (Opus 4.7, 1M context)
**Date:** 2026-04-26
**Operating mode:** Procedure 01 (PLAN-ONLY) → Procedure 03 (EXECUTION) after approval
**Status:** Plan authored — awaiting review

---

## 1. Request summary

Implement Milestone 1.3d per `docs/execution-plan.md` v2.0.0: turn the
M1.3a drafting surface from "functional but bland" into a CAD-feeling
editor. Eight polish items — live drafting preview with shared length /
radius / angle labels, snap-target glyphs, selection highlight with
click-select grips, grip-drag stretch (the modeless one — the
dedicated STRETCH command lives in M1.3b), hover entity highlight,
default grid in the bootstrap project, status-bar live coordinate
readout, customisable cursor crosshair, and selection rectangle with
W/C direction convention plus selection auto-fire on canvas click
without an active tool. Plus the shared infrastructure that unlocks
all of them: mousemove routing through canvas-host, a new
`canvas.transient.*` token namespace explicitly outside the ByLayer
ladder, a shared `paintTransientLabel` painter, and an overlay paint
pass added to the canvas paint loop after the entity pass.

No new typed objects. No new modify operators. No promotion. No
dimensions (the dimension-entity work is M1.3c). M1.3d's only role
is to make M1.3a feel like CAD before the engine widens.

> **AutoCAD reference parity.** Each polish item targets the AutoCAD
> behavioural contract verbatim: rubber-band live preview during a
> draw, OSNAPMARKER glyphs at snap targets, dashed selection outline
> + blue grip squares on click-select with hover-highlight (no
> grips), L→R window-selection (blue, fully-enclosed) vs R→L
> crossing-selection (green, any-touch), continuous CURSORSIZE %
> for crosshair, COORDS readout in the status bar. Where AutoCAD's
> behaviour and the project's existing conventions disagree, the
> existing project conventions win and the divergence is documented
> in the relevant phase.

## 2. Assumptions and scope clarifications

User-confirmed in pre-response acknowledgment dated 2026-04-26:

- **A1 — Path β confirmed.** Typed objects are out of M1 entirely;
  M1.3d is the last sub-milestone of M1. ADR-016 is unchanged. The
  `sourceKind: 'direct' | 'promoted'` split records user-intent over
  the unified Path A pipeline. M2 ships the first typed-object via
  the direct-draw flow.
- **A2 — All eight polish items in scope** (live preview, snap glyph,
  selection + grips, grip-stretch, hover highlight, default grid,
  coord readout, cursor crosshair, selection-rect auto-fire). Plus
  the shared infrastructure that unlocks them.
- **A3 — Selection convention matches AutoCAD verbatim.** L→R drag =
  window selection (blue, fully-enclosed only). R→L drag = crossing
  selection (green, any-touch). Selection auto-fires on canvas click
  without active tool: click on entity = add-to-selection; click on
  empty + drag = selection rectangle; click + immediate release on
  empty = clear selection.
- **A4 — Grips appear on click-select, not on hover.** Hover gives a
  faint outline highlight (`canvas.node_hover` token); grips appear
  after click-select and persist until deselection. Reasoning: grip
  squares are 8×8 CSS px; if grips appeared on hover, moving the
  cursor toward a grip would leave the entity-bounds region and the
  grip would disappear — a known UX failure. AutoCAD shows grips on
  select for exactly this reason.
- **A5 — Grip-drag stretch lives in M1.3d; the dedicated STRETCH
  command lives in M1.3b.** Grip-drag is selection-driven (no command
  invocation, no command-bar prompt) and is the natural outcome of
  grips being interactive. Both surfaces ride on the same
  `updatePrimitive(id, patch)` machinery; the user-facing surface
  splits cleanly. M1.3d ships grip-drag for the existing seven primitive
  kinds; the M1.3b STRETCH command adds mode sub-options for
  crossing-window stretch on multiple entities and operator-driven
  endpoint extension.
- **A6 — Transient styling lives in a new `canvas.transient.*` token
  sub-namespace** of the existing canvas semantic tokens
  (`packages/design-system/src/tokens/semantic-dark.ts`). Transient
  painters NEVER read layer color tokens; they read only
  `canvas.transient.*`. This is a hard SSOT boundary enforced by grep
  (Gate DTP-T1).
- **A7 — Shared `paintTransientLabel(ctx, anchor, text, viewport,
  options?)` painter is the SOLE source of in-flight text on canvas.**
  Used by every draw tool's preview (line length, polyline current-
  segment length, circle radius, rectangle dimensions, arc radius +
  angle, xline angle), and by future M1.3b modify operators (move
  delta, rotate angle). Renders in screen-space (transform reset to
  identity, then translated to anchor screen-px) with a translucent
  rounded-pill background for legibility.
- **A8 — Live preview is yielded by tools alongside the prompt.**
  `Prompt` type gains an optional `preview?: PreviewShape | undefined`
  field. Tools that have an in-flight visualisation (line draws a
  rubber-band line from p1 to cursor; polyline draws the segment chain
  + rubber-band; circle draws expanding circle + radius line + radius
  label; rectangle draws expanding rectangle + dim labels; arc 3-point
  shows progressive state; xline draws the infinite line through pivot
  and cursor) yield one. Tool runner extracts the preview from each
  yield and writes it to `editorUiStore.overlay.previewShape`. Paint
  loop draws it during the overlay pass. **Preview is UI-only state;
  it MUST NEVER be written to `projectStore`** (Gate DTP-T6).
- **A9 — Mousemove routing is rAF-coalesced.** canvas-host tracks the
  latest cursor position in a ref on every `mousemove`; a single
  `requestAnimationFrame` per frame reads the ref and writes the
  cursor to `editorUiStore.overlay.cursor`. This caps the cursor-
  driven update rate at the display refresh rate (typically 60 fps),
  not the mousemove event rate (which can be 200+ fps on high-poll
  gaming mice). The same rAF callback re-runs the snap engine if the
  active tool needs snap candidates.
- **A10 — Default grid in bootstrap.** `useAutoLoadMostRecent.
  buildDefaultProject` ships one grid: 5 m × 5 m, origin at `(0,0)`,
  angle 0, on `LayerId.DEFAULT`, `visible: true`,
  `activeForSnap: true`. User can disable via Layer Manager or grid
  properties (when grid-properties UI lands). This makes GSNAP
  meaningful out of the box.
- **A11 — Cursor crosshair has continuous CURSORSIZE % + F-key preset
  toggle.** `editorUiStore.viewport.crosshairSizePct` (number 0–100,
  default 100 = full canvas, AutoCAD default) drives the crosshair
  painter. F7 (free per `docs/operator-shortcuts.md`) toggles between
  100 (full canvas) and 5 (pickbox-sized). A future settings dialog
  exposes the slider; M1.3d ships only the F-key toggle and the
  default value, no slider UI.
- **A12 — Coordinate readout in status bar.** `apps/web/src/shell/
  StatusBar.tsx` mounts a new `<StatusBarCoordReadout />` component
  (chrome subtree of editor-2d). The component reads
  `editorUiStore.overlay.cursor.metric` via `useEditorUi` and renders
  `X: 12.345  Y: -5.678` (3-decimal precision in metric units, no unit
  suffix in M1.3d — units / formatting come with M1.3c when dimensions
  introduce a unit system). When `cursor === null`, the readout shows
  `X: —  Y: —`.
- **A13 — Selection rect direction-convention hit-test.** Window selection
  (L→R, fully enclosed) requires a per-entity bbox-fully-inside-rect
  check; crossing selection (R→L, any touch) reuses the existing
  rbush `searchFrustum` (intersects). New helper `searchEnclosed`
  wrapping rbush + per-entity bbox containment lands in
  `packages/editor-2d/src/canvas/spatial-index.ts`.
- **A14 — Grip hit-test is screen-space pixel-distance,** not metric
  distance. Standard grip target is an 8×8 CSS-px square; cursor within
  half the side (4 px) hits. Hit-test runs in screen-space because the
  grip's visual size is constant across zoom — at zoom 100, a 4-px
  metric tolerance would be a 0.04 m tolerance, useless.
- **A15 — Snap engine on cursor.** When the active tool's prompt
  expects a `'point'` Input, the snap engine runs on every rAF tick
  using current toggles (OSNAP / GSNAP / Ortho). The resolved snap
  target (or null) is written to `editorUiStore.overlay.snapTarget`.
  paintSnapGlyph reads it during overlay pass. Tools receive the
  snap-resolved metric on mousedown via the snap output (not the raw
  cursor metric) — this is the I-39 bit-copy pattern existing in M1.3a.
  This means snap is invisible-but-on at draw time today; M1.3d makes
  it visible.
- **A16 — Smoke E2E coverage via DOM-level scenarios.** Phase 21-style
  `render(<EditorRoot />)` + `fireEvent.*` per A18 / Procedure 02 §2.4
  amendment. Five new scenarios covering the polish surface (preview
  visible, snap glyph appears, window vs crossing selection, grip-drag
  stretches, coord readout updates).

## 3. Scope and Blast Radius

### 3.1 In scope — files created

**Design system (`packages/design-system/src`):**

- (no new files — extend existing `tokens/semantic-dark.ts` and
  `tokens/themes.ts` and `tokens/css-vars.ts`)

**Editor-2d (`packages/editor-2d/src`):**

- `canvas/painters/paintTransientLabel.ts` — shared label painter
  (length, radius, angle, etc.) in screen-space.
- `canvas/painters/paintPreview.ts` — kind-discriminated dispatch for
  preview shapes (line / polyline / rectangle / circle / arc / xline).
- `canvas/painters/paintSnapGlyph.ts` — 5 glyph shapes (square /
  triangle / × / ● / +) per snap kind.
- `canvas/painters/paintSelection.ts` — outline + grip squares on
  selected entities.
- `canvas/painters/paintHoverHighlight.ts` — faint outline on
  `overlay.hoverEntity`.
- `canvas/painters/paintSelectionRect.ts` — window/crossing rectangle
  with dashed stroke + light fill.
- `canvas/painters/paintCrosshair.ts` — full-canvas + pickbox-sized
  crosshair painter.
- `canvas/grip-positions.ts` — per-kind `gripsOf(primitive): Grip[]`
  helper. A `Grip` is `{ entityId, gripKind, position: Point2D }`.
- `canvas/grip-hit-test.ts` — screen-space hit-test against grips.
- `tools/select-rect.ts` — modeless selection-rectangle tool started
  by canvas-host when no other tool is active.
- `tools/grip-stretch.ts` — modeless grip-drag stretch tool started by
  canvas-host when a grip is mousedown'd.
- `chrome/StatusBarCoordReadout.tsx` (+ `.module.css`) — live cursor
  metric coords component, mounted by apps/web's StatusBar.
- `tests/paintTransientLabel.test.ts`
- `tests/paintPreview.test.ts`
- `tests/paintSnapGlyph.test.ts`
- `tests/paintSelection.test.ts`
- `tests/paintSelectionRect.test.ts`
- `tests/paintCrosshair.test.ts`
- `tests/grip-positions.test.ts`
- `tests/grip-hit-test.test.ts`
- `tests/grip-stretch.test.ts`
- `tests/select-rect.test.ts`
- `tests/StatusBarCoordReadout.test.tsx`

**Documentation:**

- `docs/glossary.md` — append terms (Transient overlay, Snap glyph,
  Grip, Window selection, Crossing selection, Pickbox, Crosshair,
  CURSORSIZE).

### 3.2 In scope — files modified

**Design system:**

- `packages/design-system/src/tokens/semantic-dark.ts` — append
  `canvas.transient` sub-namespace.
- `packages/design-system/src/tokens/themes.ts` — same sub-namespace
  on light / dark theme variants.
- `packages/design-system/src/tokens/css-vars.ts` — emit
  `--canvas-transient-*` CSS custom properties.
- `docs/design-tokens.md` — append `canvas.transient.*` rows + the
  rationale that transient overlays bypass the ByLayer ladder.

**Editor-2d:**

- `packages/editor-2d/src/canvas/canvas-host.tsx` — add `onMouseMove`
  cursor tracking (rAF-coalesced via internal latest-cursor ref) +
  `onCanvasHover` prop + extend `onCanvasClick` for the no-active-tool
  selection-auto-fire branch + canvas-cursor CSS-style toggle for the
  crosshair / pickbox modes.
- `packages/editor-2d/src/canvas/paint.ts` — add an overlay pass after
  the entity pass: paintGrid → paintPrimitive (existing) → paintCrosshair
  → paintHoverHighlight → paintSelection → paintPreview → paintSnapGlyph
  → paintSelectionRect → paintTransientLabel. Last in z-order so labels
  are always legible. Order matters; this is the canonical pass.
- `packages/editor-2d/src/canvas/spatial-index.ts` — add
  `searchEnclosed(rect: BBox): PrimitiveId[]` for window-selection.
- `packages/editor-2d/src/canvas/view-transform.ts` — add `metricToScreen`
  is already there; no change.
- `packages/editor-2d/src/snap/priority.ts` — no change; existing
  resolver consumed by Phase 3 snap-on-cursor.
- `packages/editor-2d/src/EditorRoot.tsx` — wire onCanvasHover →
  setCursor, onCanvasClick (no-tool branch) → SelectRect tool, onGripDown
  → GripStretch tool. Listen for F7 (crosshair toggle) via the keyboard
  router callback set.
- `packages/editor-2d/src/keyboard/router.ts` — add F7 to the bypass
  keys; new `onToggleCrosshair` callback.
- `packages/editor-2d/src/keyboard/shortcuts.ts` — register F7 in the
  M1.3a single-letter table (or as a bypass key). Add `'select-rect'`
  and `'grip-stretch'` to `ToolId`.
- `packages/editor-2d/src/tools/types.ts` — extend `Prompt` with an
  optional `previewBuilder?: (cursor: Point2D) => PreviewShape` field
  (NOT a static `preview` value — the runner re-invokes on cursor
  change per Phase 4 step 5). The `PreviewShape` discriminated union
  is defined canonically in **Phase 4 step 2 (the SSOT)** with eight
  arms: `'line'` / `'polyline'` / `'rectangle'` / `'circle'` /
  `'arc-2pt'` / `'arc-3pt'` / `'xline'` / `'selection-rect'`. This
  bullet is a pointer to the SSOT — to avoid duplicate-definition
  drift, every other reference to `PreviewShape` in this plan defers
  to Phase 4 step 2 (Codex Round 1 H2 fix; previous Revision-2 had
  an inconsistent shorthand here).
- `packages/editor-2d/src/tools/runner.ts` — when a `Prompt` carries
  `previewBuilder`, the runner subscribes once-per-tool-start to
  `editorUiStore`, re-invokes `previewBuilder(cursor.metric)` on
  cursor change, and writes the result to
  `editorUiStore.overlay.previewShape`. Subscription lifecycle and
  closure-capture pattern are defined canonically in **Phase 4 step
  5**. Tools that don't need a preview omit the field. (Codex Round
  1 H2 fix: the previous Revision-2 phrasing here mentioned a static
  `preview` field which doesn't exist — the canonical contract is
  `previewBuilder`. Phase 4 step 5 is the SSOT.)
- `packages/editor-2d/src/tools/draw/draw-line.ts` — yield
  `previewBuilder` on the second prompt.
- `packages/editor-2d/src/tools/draw/draw-polyline.ts` — yield
  `previewBuilder` from the second prompt onward; build the chain
  + rubber-band segment.
- `packages/editor-2d/src/tools/draw/draw-rectangle.ts` — yield
  `previewBuilder` on the second prompt.
- `packages/editor-2d/src/tools/draw/draw-circle.ts` — yield
  `previewBuilder` on the second prompt; preview = circle outline +
  dashed radius line + radius label.
- `packages/editor-2d/src/tools/draw/draw-arc.ts` — yield
  `previewBuilder` on the second + third prompts.
- `packages/editor-2d/src/tools/draw/draw-xline.ts` — yield
  `previewBuilder` on the second prompt.
- `packages/editor-2d/src/tools/draw/draw-point.ts` — no preview (point
  is a single-click commit).
- `packages/editor-2d/src/tools/index.ts` — register `select-rect` and
  `grip-stretch` in `ESSENTIAL_REGISTRY`.
- `packages/editor-2d/src/ui-state/store.ts` — extend
  `EditorUiState.viewport` with `crosshairSizePct: number`. Extend
  `EditorUiState.overlay` with `cursor: { metric: Point2D, screen:
  ScreenPoint } | null`, `previewShape: PreviewShape | null` (the
  union has a `'selection-rect'` arm — selection-rect overlay state
  rides the previewShape field, no separate `selectionRect` field
  per Phase 4 step 2 + Phase 7 step 4), `snapTarget: SnapTarget | null`
  (already declared, keep), `hoverEntity: PrimitiveId | null`,
  `transientLabels: TransientLabel[]`, `grips: Grip[] | null`,
  `suppressEntityPaint: PrimitiveId | null`. New actions:
  `setCursor`, `setPreviewShape`, `setSnapTarget`, `setHoverEntity`,
  `setTransientLabels`, `setGrips`, `setSuppressEntityPaint`,
  `setCrosshairSizePct`.
- `packages/editor-2d/src/canvas/style.ts` — no change (transient
  styles bypass ByLayer).
- `packages/editor-2d/src/index.ts` — re-export
  `StatusBarCoordReadout`.
- `packages/editor-2d/tests/smoke-e2e.test.tsx` — extend with five
  polish scenarios (see Phase 9).
- `packages/editor-2d/tests/setup.ts` — no change.
- `packages/editor-2d/package.json` — no new dependencies (we already
  have everything).

**apps/web:**

- `apps/web/src/hooks/useAutoLoadMostRecent.ts` — bootstrap default
  project gains a default 5×5 grid on `LayerId.DEFAULT`,
  `activeForSnap: true`.
- `apps/web/src/shell/StatusBar.tsx` — mount
  `<StatusBarCoordReadout />`.
- `apps/web/tests/auto-load.test.tsx` — assert default grid present
  in the bootstrapped project.

**docs/operator-shortcuts.md:**

- Append `F7` for crosshair toggle in the M1.3a section. Bump version
  to 1.0.1; changelog row: "Add F7 → toggle-crosshair (full-canvas /
  pickbox preset). M1.3d Phase 8."

### 3.3 Out of scope (deferred)

- **Modify operators** (Rotate, Mirror, Scale, Offset, Fillet, Chamfer,
  Trim, Extend, Join, Explode, Break, Array, Match) — M1.3b.
- **Dedicated STRETCH command** with Mode sub-options for
  crossing-window stretch — M1.3b. (Grip-drag stretch lands here per
  A5; the command-driven STRETCH does not.)
- **Dimensions** (linear / angular / radius / etc.) — M1.3c.
- **POLAR (F10), OTRACK (F11), remaining OSNAP modes** — M1.3c.
- **Typed objects** (RTG_BLOCK, ROAD, BUILDING, PAVEMENT_AREA),
  classification, extraction, validation, capacity panel — M2.
- **Promotion** (`sourceKind: 'promoted'` flow) — M4.
- **Crosshair size slider in a settings dialog** — M1.3d ships only
  the F7 toggle and the default value. Settings UI is post-M1.
- **Customisable grip squares** (size, color override) — post-M1.
- **Theme switcher** — pick dark, ship dark per execution-plan.
- **Library system, scenarios, generator** — M5.

### 3.4 Blast radius

- **Packages affected:** `editor-2d` (most of the work), `design-system`
  (token namespace), `apps/web` (default grid + StatusBar mount).
  `domain` and `project-store` and `project-store-react` unchanged.
  `services/api` does not exist; not touched.
- **Other object types affected via cross-object extractors:** none
  (no extraction in M1.3d).
- **Scenarios affected (ADR-006):** none. `scenarioId` field
  unchanged.
- **Stored data affected:** **NO schema bump.** The default-grid
  bootstrap creates a grid via the existing M1.3a grid CRUD path; no
  schema migration. UI state (overlay, viewport.crosshairSizePct) is
  not persisted (per A3 isolation rule from M1.3a).
- **UI surfaces affected:** Canvas paint loop gains an overlay pass.
  Status bar gets a coord readout component. apps/web bootstrap
  changes. Other shell areas (Navbar, Sidebar) untouched.
- **Cross-references in non-superseded ADRs:** ADR-021 (2D rendering
  pipeline v2) gains a documented overlay pass extension — no decision
  change. All other ADRs unchanged.

### 3.5 Glossary terms appended in `docs/glossary.md`

- **Transient overlay** — Canvas paint pass that runs after the entity
  pass and renders in-flight UI elements (live preview, snap glyph,
  selection outline, grip handles, hover highlight, selection
  rectangle, crosshair, transient labels). Read from
  `editorUiStore.overlay`. NOT persisted, NOT routed through ByLayer
  styling, ALWAYS painted last for z-order. ADR-021 extension.
- **Snap glyph** — Visual marker rendered at a snap-resolved point to
  show the user "this point will snap." Five shapes per OSNAP /
  GSNAP kind: `□` endpoint, `△` midpoint, `×` intersection, `●` node,
  `+` grid node. Color from `canvas.snap_indicator` token. ADR-016
  / ADR-021.
- **Grip** — Small interactive square (8×8 CSS px) painted at a key
  point of a selected entity. User clicks-and-drags a grip to stretch
  the entity (move the underlying vertex / control point). Distinct
  from "vertex marker" (always-on dot, AutoCAD has none, we don't
  ship one). Grips appear on **click-select** (not hover) per A4.
  ADR-019 / I-DTP-4.
- **Window selection** — Selection-rectangle drag in the L→R direction
  (start.x < end.x). Selects only entities **fully enclosed** in the
  rectangle. AutoCAD-blue stroke + light-blue fill. ADR-016 §
  Selection conventions.
- **Crossing selection** — Selection-rectangle drag in the R→L
  direction (start.x > end.x). Selects entities that **any part
  intersects** the rectangle. AutoCAD-green stroke + light-green
  fill. ADR-016 § Selection conventions.
- **Pickbox** — Small square cursor representation (CSS-styled or
  painted) shown when no tool is active and the user is selecting
  entities. Distinct from the full-canvas crosshair shown when a tool
  is active. AutoCAD's `PICKBOX` system variable. M1.3d Phase 8.
- **Crosshair** — Two perpendicular guide lines (full-canvas X+Y or
  pickbox-sized cross at cursor) painted as a transient overlay to
  give cursor-tracking feedback. Continuous CURSORSIZE % 0–100
  (default 100). F7 toggles between full-canvas (100) and pickbox
  (5). AutoCAD's `CURSORSIZE` system variable.
- **CURSORSIZE** — A scalar 0–100 controlling crosshair length as a
  percentage of canvas height. Stored in
  `editorUiStore.viewport.crosshairSizePct`. Default 100.
  AutoCAD-derived terminology.

### 3.6 Binding specifications touched

| Spec | Change type |
|------|-------------|
| ADR-001 Coordinate System | No change — all geometry math in project-local metric Float64; transient labels render in screen-space (transform reset). |
| ADR-003 Ownership States | No change — primitives have no ownership state; ADR-003 still applies to typed objects (uninstantiated until M2). |
| ADR-004 Parameter Extraction | No change — extraction deferred to M2. |
| ADR-005 Library Model | No change. |
| ADR-007 Validation Engine | No change — deferred to M2. |
| ADR-008 3D Derivation Cache | No change — 2D only. |
| ADR-011 UI Stack | No change — Lucide icons + ThemeProvider + `useActiveThemeTokens` consumed unchanged. |
| ADR-012 Technology Stack | No change — no new dependencies. |
| ADR-014 Persistence Architecture | No change. |
| ADR-015 Project Store and State Management | No change — UI state in `editorUiStore` (vanilla zustand + immer; no zundo); overlay slice extended within existing pattern per A3. |
| ADR-016 Drawing Model | No change. Polyline preview uses bulge-aware rendering (existing). |
| ADR-017 Layer Model | No change. **`canvas.transient.*` tokens explicitly bypass the ByLayer ladder** — transient painters never read layer color tokens. Documented in plan + enforced by Gate DTP-T1. |
| ADR-018 Dimension Model | No change. Transient labels are NOT dimension primitives (they're UI overlay text); the dimension entity ships in M1.3c. |
| ADR-019 Object Model v2 | No change. |
| ADR-020 Project Sync v2 | No change. Grip-drag stretch emits one UPDATE Operation per primitive per release (existing emitOperation path). |
| ADR-021 2D Rendering Pipeline v2 | **Documented extension** — paint loop gains an overlay pass after the entity pass. Pass order: `paintGrid → paintPrimitive → paintCrosshair → paintHoverHighlight → paintSelection → paintPreview → paintSnapGlyph → paintSelectionRect → paintTransientLabel`. Last-in-z-order = labels. ADR-021 itself is unchanged; this is the documented implementation of its "drawOverlays" step that was always anticipated. |
| ADR-023 Tool State Machine + Command Bar (v2) | No change. `Prompt` gains optional `previewBuilder?: (cursor) => PreviewShape` — additive type extension; existing tools work unchanged. |
| `docs/operator-shortcuts.md` | Version bump 1.0.0 → 1.0.1. Add F7 → toggle-crosshair. |
| `docs/glossary.md` | Append 8 terms per §3.5. |
| `docs/coordinate-system.md` | No change. |
| `docs/design-tokens.md` | Append `canvas.transient.*` token namespace + rationale that transient overlays bypass ByLayer. Version bump per the doc's existing changelog discipline. |
| `docs/execution-plan.md` | Already revised to v2.0.0 in main commit `4e86e08` (path-β re-slice). M1.3d's place in the new structure documented. |
| `docs/extraction-registry/*` | No change. |
| Claude + Codex architecture contracts | No change — ADR table unaffected. |
| `docs/overview.md` | No change. |

## 4. Architecture Doc Impact

| Doc | Path | Change type | Reason |
|-----|------|-------------|--------|
| Design tokens | `docs/design-tokens.md` | Append `canvas.transient.*` namespace + rationale | Transient overlay styling SSOT |
| Operator shortcuts | `docs/operator-shortcuts.md` | Version 1.0.0 → 1.0.1; add F7 row | Crosshair toggle |
| Glossary | `docs/glossary.md` | Append 8 terms | New domain vocabulary |
| ADR-021 (informative reference, not the ADR file) | the plan + Phase 4 docstring | Documented overlay-pass extension within the ADR's `drawOverlays` step | No ADR file edit; the extension is an implementation of the existing ADR-021 step |
| All other ADRs | (paths) | No change | M1.3d doesn't touch their decisions |

## 5. Deviations from binding specifications (§0.7)

**None.** All polish items extend existing systems within their declared
extension points:

- ADR-021 reserves a `drawOverlays` step at the end of the paint loop;
  M1.3d implements it. Not a deviation.
- `editorUiStore.overlay` slice was declared in M1.3a Phase 11 with
  fields anticipating polish (snapTarget, guides, selectionHandles).
  M1.3d expands it. Not a deviation.
- ADR-019's `sourceKind: 'direct' | 'promoted'` is unchanged; the
  path-β interpretation is established at the execution-plan level
  (v2.0.0, commit `4e86e08`), not in any ADR. Not a deviation.

## 6. Object Model and Extraction Integration

**Not applicable.** No new typed object types are introduced in M1.3d.
The polish surface operates on existing primitives + grids + layers.
ProjectObject, extraction, validation, classification all stay
deferred to M2/M3.

## 7. Hydration, Serialization, Undo/Redo, Sync

### 7.1 Hydration (document load path)

- **Default grid in bootstrap.** The
  `useAutoLoadMostRecent.buildDefaultProject` gains one grid entry
  with `id: newGridId()`, origin `(0,0)`, angle 0, spacings 5×5,
  `layerId: LayerId.DEFAULT`, `visible: true`, `activeForSnap: true`.
  This is a CREATION-time default, not a HYDRATION default — projects
  loaded from IndexedDB carry their own grids (or none). No schema
  migration.
- **Loading projects from M1.3a (no grid).** Hydration is unchanged.
  Loaded projects without grids stay without grids; users add grids
  via Layer Manager → Grid (a future UI; M1.3d does not ship a
  grid-creation UI beyond the bootstrap default).

### 7.2 Serialization (document save path)

- No change. The new `editorUiStore.viewport.crosshairSizePct` is UI
  state, not persisted (per A3 isolation rule).
  `editorUiStore.overlay.cursor` and friends are UI-only and do not
  persist.

### 7.3 Undo / Redo

- **Grip-drag stretch emits one UPDATE Operation per release.** The
  underlying `updatePrimitive(id, patch)` already goes through
  `emitOperation` per Phase 6 of M1.3a, so undo / redo work uniformly
  via zundo. The grip-stretch tool does NOT pre-write incremental
  partial-state during the drag — only the commit (mouseup) writes.
  This avoids generating N UPDATE Operations during a drag.
- **Selection auto-fire and selection rectangle do NOT emit
  Operations.** Selection is UI-only state; selecting entities does
  not modify the project store. Per ADR-015, UI state is not
  undoable.
- **Crosshair toggle does NOT emit Operations.** Same reason.

### 7.4 Sync (ADR-020)

- No change. M1.3d's only project-store writes are
  `updatePrimitive` (grip-drag commit, existing pathway) and
  `addGrid` (bootstrap, existing pathway). Both pre-existing
  Operation flows.

## 8. Implementation phases

Eight phases (excluding final audits + handoff). Each phase has its
file list, steps, invariants, gates, and tests.

> **Phase ordering note.** Phases 1–3 establish the **infrastructure**
> (tokens, ui-state slice, mousemove + cursor tracking + snap
> visualization). Phases 4–6 implement the **per-tool features** (live
> preview, selection display, grip-stretch). Phase 7 is **selection-
> rectangle + auto-fire** (depends on Phase 5's infrastructure). Phase
> 8 is **status bar + cursor crosshair**. Phase 9 is **smoke E2E
> rewrite** (per A18 / Procedure 02 §2.4 — DOM-level scenarios that
> exercise each polish item). Phase 10 is closure.

### Phase 1 — Design tokens + UI state extension

**Goal:** Establish the `canvas.transient.*` token namespace and the
overlay slice extensions that the rest of M1.3d will consume.

**Files affected:**
- `packages/design-system/src/tokens/semantic-dark.ts` (modified — add
  `canvas.transient` sub-namespace)
- `packages/design-system/src/tokens/themes.ts` (modified)
- `packages/design-system/src/tokens/css-vars.ts` (modified — emit
  `--canvas-transient-*`)
- `docs/design-tokens.md` (modified — append `canvas.transient.*` rows
  + rationale section "Transient overlays bypass ByLayer")
- `packages/editor-2d/src/ui-state/store.ts` (modified — extend
  `EditorUiState.viewport` and `EditorUiState.overlay`)
- `packages/editor-2d/tests/ui-state.test.ts` (modified — assertions
  for new slice fields and actions)

**Steps:**

1. In `tokens/semantic-dark.ts`, add `canvas.transient` block:
   ```ts
   canvas: {
     ... existing tokens unchanged ...,
     transient: {
       preview_stroke: '#7d8fa3',
       preview_fill:   'rgba(125,143,163,0.05)',
       preview_dash:   [6, 4],   // dash pattern for ctx.setLineDash
       label_text:     '#c8d4e3',
       label_bg:       'rgba(13,20,32,0.85)',
       label_padding:  4,
       crosshair:      'rgba(180,200,255,0.35)',
       crosshair_dash: [],
       dimension_line: '#7d8fa3',
       selection_window:   { stroke: 'rgba(42,127,255,0.9)',  fill: 'rgba(42,127,255,0.07)',  dash: [6,4] },
       selection_crossing: { stroke: 'rgba(0,255,128,0.9)',   fill: 'rgba(0,255,128,0.07)',   dash: [6,4] },
       hover_highlight:    { stroke: 'rgba(180,200,255,0.5)', dash: [4,2] },
     },
   },
   ```
2. Mirror in `tokens/themes.ts` for any light-theme equivalent (though
   M1 ships dark only — keep the structure for future).
3. Update `tokens/css-vars.ts` to emit `--canvas-transient-preview-
   stroke`, `--canvas-transient-preview-fill`, etc. Existing emit
   helper handles flat keys; nested object needs a recursive walker
   (or flatten + dot-to-dash convention).
4. Append section to `docs/design-tokens.md` titled "Transient overlay
   tokens (`canvas.transient.*`)" listing each token + rationale +
   the SSOT rule "Transient painters MUST NOT read layer color
   tokens; this is enforced by Gate DTP-T1." Bump doc changelog.
5. Extend `EditorUiState.viewport` with `crosshairSizePct: number`
   (default 100). Add `setCrosshairSizePct(n: number)` action.
6. Extend `EditorUiState.overlay`. New shape:
   ```ts
   interface OverlayState {
     cursor: { metric: Point2D; screen: ScreenPoint } | null;
     snapTarget: SnapTarget | null;        // existing
     guides:     Array<{ from: Point2D; to: Point2D }>;   // existing
     selectionHandles: Array<Point2D>;      // existing — kept; possibly deprecated by grips
     previewShape: PreviewShape | null;
     hoverEntity: PrimitiveId | null;
     // NB: selectionRect is NOT a separate field; it's an arm of
     // PreviewShape (kind: 'selection-rect') so the runner's existing
     // previewBuilder mechanism + paint.ts's overlay-pass dispatcher
     // handle it uniformly. See Phase 4 step 2 + Phase 7 step 4.
     transientLabels: TransientLabel[];
     grips: Grip[] | null;
     /**
      * When set, paint.ts skips painting the entity with this id during
      * the entity pass. Used by grip-stretch (Phase 6) so the user sees
      * only the modified-entity preview during a drag, not the original
      * entity AND the preview overlapping. Cleared on grip-stretch
      * commit / abort.
      */
     suppressEntityPaint: PrimitiveId | null;
   }
   ```
   Add the corresponding actions on `editorUiActions`:
   `setCursor`, `setPreviewShape`, `setSnapTarget`, `setHoverEntity`,
   `setTransientLabels`, `setGrips`, `setSuppressEntityPaint`,
   `setCrosshairSizePct`.
7. Update `tests/ui-state.test.ts` to cover the new fields and
   actions (default values, idempotent setters, isolation across
   slices).
8. **Architectural contract for overlay access from the paint loop
   (C2 — I-68-safe data flow).** The paint loop (`canvas-host.tsx`
   already-existing rAF callback) MUST NOT subscribe to
   `editorUiStore` directly — canvas-host already subscribes to
   `projectStore`, and a second subscription would make canvas-host
   a dual-store subscriber, violating I-68 / Gate 22.7. Instead:
   - `canvas-host.tsx` accepts a new prop:
     `getOverlay?: () => OverlayState | null`.
   - `paint.ts` `paint()` signature gains an `overlay: OverlayState |
     null` parameter (alongside existing `project / viewport /
     spatialIndex`).
   - Inside canvas-host's existing rAF callback (the paint scheduler
     from M1.3a), call `props.getOverlay?.()` ONCE per frame and pass
     the result into `paint(...)`. Read frequency is bounded by the
     existing rAF coalescing — no new subscription.
   - `EditorRoot.tsx` provides `getOverlay` as a stable callback ref:
     ```tsx
     const getOverlayRef = useRef<() => OverlayState | null>(() =>
       editorUiStore.getState().overlay,
     );
     // pass getOverlayRef.current as the prop
     ```
     `getOverlayRef.current` is a one-shot reader of editorUiStore;
     calling it doesn't establish a long-lived subscription. EditorRoot
     itself already subscribes to editorUiStore via `useEditorUi`
     (which is the legitimate dual-store subscriber per I-68); the
     getOverlay callback is just a thin reader handed down to
     canvas-host.
   - This keeps canvas-host as a single-side (project-store-only)
     subscriber, preserves I-68 / Gate 22.7, and avoids the
     React-re-render storm that would result from passing overlay as
     a value-prop on every cursor frame.
9. **Tests for the overlay data flow contract:** assert that
   canvas-host does NOT import `editorUiStore` (Gate DTP-T7) and that
   `paint(...)` is called with the latest overlay snapshot via the
   getOverlay callback (canvas-host integration test).

**Invariants introduced:**

- I-DTP-1: `canvas.transient.*` tokens are the SOLE source of
  transient overlay styling. Transient painters MUST NOT import or
  read layer-color tokens (ByLayer is for entities, not overlays).
  Enforced by Gate DTP-T1 (grep on transient painter files).
- I-DTP-2: `EditorUiState.overlay.cursor === null` when no mousemove
  has yet occurred OR the cursor has left the canvas; non-null
  otherwise. Tests cover both transitions.
- I-DTP-3: `EditorUiState.viewport.crosshairSizePct` is clamped to
  [0, 100] at the action level. Tests cover boundary values.
- **I-DTP-22: `canvas-host.tsx` accesses overlay state EXCLUSIVELY
  via the `getOverlay: () => OverlayState | null` prop callback,
  NEVER by subscribing to or importing `editorUiStore`.** Preserves
  I-68 (canvas-host stays single-side projectStore subscriber).
  Enforced by **Gate DTP-T7** (hard grep — `canvas-host.tsx` MUST NOT
  import `editorUiStore` from `../ui-state/store`).

**Mandatory Completion Gates:**

```
Gate DTP-1.1: Type-check passes
  Command: pnpm tsc --noEmit
  Expected: zero errors

Gate DTP-1.2: Token namespace present in semantic-dark.ts
  Command: rg -n "transient:" packages/design-system/src/tokens/semantic-dark.ts
  Expected: ≥1 match

Gate DTP-1.3: CSS vars emit transient tokens (revised mid-execution; see §13.1)
  Command: pnpm --filter @portplanner/design-system test -- tests/tokens
  Expected: passes; tokens.test.ts "emits --canvas-transient-* CSS vars
            for the nested transient namespace" assertion is green
  Rationale (Phase 1 mid-execution gate swap, §13.1): the original grep
  `rg -n "--canvas-transient" packages/design-system/src/tokens/css-vars.ts`
  is unsatisfiable — `css-vars.ts` is a fully generic recursive flattener
  with zero token-specific literals. The emitter's nested-namespace
  handling is verified at runtime: `tokens.test.ts` (a) counts leaves
  vs declarations in `emitCSSVars(dark)` (existing) and (b) adds an
  explicit `expect(output).toContain('--canvas-transient-*')` assertion
  for sample leaves at each nesting depth (Phase 1).

Gate DTP-1.4: docs/design-tokens.md updated
  Command: rg -n "canvas\.transient" docs/design-tokens.md
  Expected: ≥1 match

Gate DTP-1.5: Overlay slice extended
  Command: rg -n "previewShape|hoverEntity|transientLabels|\\bgrips\\b|suppressEntityPaint" packages/editor-2d/src/ui-state/store.ts
  Expected: ≥5 matches
  Rationale (Codex Round 1 B1 fix): the original grep included
  `selectionRect` but Revision-2 removed that field — selection-rect
  state rides the PreviewShape union's `'selection-rect'` arm
  instead, so there's no `overlay.selectionRect` field to grep for.
  Removed-concept denylist principle: a gate must never require
  evidence of a concept the plan has removed.

Gate DTP-1.6: ui-state tests cover new fields
  Command: pnpm --filter @portplanner/editor-2d test -- tests/ui-state
  Expected: passes; new tests for cursor/previewShape/etc. present
```

### Phase 2 — Mousemove routing through canvas-host

**Goal:** Track cursor on every mousemove with rAF coalescing; expose
via `onCanvasHover(metric, screen)` prop. Wire EditorRoot to write
to `overlay.cursor`. This is the foundation that unlocks Phases 3,
4, 6, 7, 8.

**Files affected:**
- `packages/editor-2d/src/canvas/canvas-host.tsx` (modified)
- `packages/editor-2d/src/EditorRoot.tsx` (modified — wire
  onCanvasHover to setCursor)
- `packages/editor-2d/tests/canvas-host.test.tsx` (modified or new —
  rAF-coalesced cursor tracking assertions)

**Steps:**

1. Add to `CanvasHostProps`:
   - `onCanvasHover?: (metric: Point2D, screen: ScreenPoint) => void`
     for cursor tracking.
   - `getOverlay?: () => OverlayState | null` for paint-loop overlay
     access (per Phase 1 step 8 / I-DTP-22).
2. canvas-host's `onMouseMove` is currently only used for middle-
   mouse-drag pan. Refactor:
   - If `panStateRef.current` is set → existing pan handling.
   - **Always** (whether or not panning) update a new `cursorRef`
     with the latest `(metric, screen)` derived from
     `e.clientX/Y - rect.left/top` + `screenToMetric`.
   - rAF-schedule one cursor flush per frame: at the next animation
     frame, if `cursorRef` is non-null and differs from the last
     flushed value, call `onCanvasHover(metric, screen)`.
3. Add a single rAF coalescing pattern via a `cursorRafRef` (mirror
   of the existing `rafRef` for paint). On unmount, cancel.
4. **paint() signature extended.** Update `paint.ts` so `paint()` takes
   an `overlay: OverlayState | null` parameter alongside the existing
   `project / viewport / spatialIndex`. Inside canvas-host's existing
   paint rAF callback (M1.3a), call `props.getOverlay?.() ?? null`
   ONCE before invoking `paint(...)`. The overlay value is captured
   per-frame and passed into the paint pass. **canvas-host does NOT
   subscribe to editorUiStore** — Gate DTP-T7.
5. EditorRoot's new `handleCanvasHover` prop calls
   `editorUiActions.setCursor({ metric, screen })`. EditorRoot also
   provides `getOverlay = () => editorUiStore.getState().overlay` as
   a stable ref-captured callback passed to canvas-host (Phase 1
   step 8 contract).
6. **Re-trigger paint on overlay change — explicit pattern.**
   canvas-host exposes `requestPaint(): void` via
   `useImperativeHandle` on a forwarded ref. The method just calls
   the existing `schedulePaint()` (M1.3a internal) which is
   rAF-coalesced — multiple `requestPaint()` calls within a single
   frame collapse to one paint.
   ```tsx
   const CanvasHost = forwardRef<{ requestPaint: () => void }, CanvasHostProps>((props, ref) => {
     // ... existing internals ...
     useImperativeHandle(ref, () => ({ requestPaint: schedulePaint }), []);
     // ... existing render ...
   });
   ```
   EditorRoot holds a ref to canvas-host and subscribes to
   editorUiStore via `useEditorUi((s) => s.overlay)` (existing
   subscription). On every render where `overlay` reference changes,
   an effect calls `canvasHostRef.current?.requestPaint()`. Because
   schedulePaint is rAF-coalesced, even at 60 cursor-update fps this
   results in at most 60 paint frames per second — no over-paint.
   This pattern keeps canvas-host single-side (projectStore-only)
   subscriber (Gate DTP-T7); EditorRoot is the legitimate dual-store
   subscriber (per I-68 exemption). The imperative ref is the
   minimum-React-state-churn way to bridge them.
7. Tests: assert that synchronous `mousemove` events produce at
   most ONE cursor update per RAF tick. Use a fake-timers RAF
   shim if available, or just rely on the coalescing pattern
   being verifiable via internal call counts. Plus assert
   `paint(...)` called with the overlay snapshot from `getOverlay()`.

**Invariants introduced:**

- I-DTP-4: canvas-host's mousemove handler is rAF-coalesced — no
  more than one `onCanvasHover` call per animation frame, even at
  ≥200 mousemove events / second. Tests assert this.
- I-DTP-5: `onCanvasHover` is called with `metric` derived from
  `screenToMetric(screen, viewport)` — the same view-transform
  function used at click time (per ADR-001 / I-22 round-trip).

**Mandatory Completion Gates:**

```
Gate DTP-2.1: onCanvasHover prop on CanvasHostProps
  Command: rg -n "onCanvasHover" packages/editor-2d/src/canvas/canvas-host.tsx
  Expected: ≥1 match

Gate DTP-2.2: rAF-coalesced cursor flush
  Command: rg -n "cursorRafRef|cursorRef|requestAnimationFrame" packages/editor-2d/src/canvas/canvas-host.tsx
  Expected: ≥3 matches (the new ref + the new rAF call site + the existing paint rAF unaffected)

Gate DTP-2.3: EditorRoot writes overlay.cursor
  Command: rg -n "setCursor|onCanvasHover" packages/editor-2d/src/EditorRoot.tsx
  Expected: ≥2 matches

Gate DTP-2.4: canvas-host tests cover the new behaviour
  Command: pnpm --filter @portplanner/editor-2d test -- tests/canvas-host
  Expected: passes (coalescing test present)

Gate DTP-2.5: Type-check passes
  Command: pnpm tsc --noEmit
  Expected: zero errors
```

### Phase 3 — Snap engine on cursor + snap glyph painter

**Goal:** Run the snap engine on the cursor metric and write the
resolved target to `overlay.snapTarget`. Paint snap glyph (per-mode
shape) at the resolved target during the overlay pass.

**Files affected:**
- `packages/editor-2d/src/canvas/painters/paintSnapGlyph.ts` (new)
- `packages/editor-2d/src/canvas/paint.ts` (modified — overlay pass)
- `packages/editor-2d/src/EditorRoot.tsx` (modified — when cursor
  changes AND a tool is active expecting `'point'` Input AND OSNAP /
  GSNAP toggle is on, run the snap resolver and `setSnapTarget`)
- `packages/editor-2d/src/snap/index.ts` (re-exports if needed)
- `packages/editor-2d/tests/paintSnapGlyph.test.ts` (new)

**Steps:**

1. Author `paintSnapGlyph.ts`. Five shapes per `SnapTarget.kind`:
   - `endpoint` → filled square (8 px CSS).
   - `midpoint` → filled triangle (8 px CSS).
   - `intersection` → `×` (two diagonal lines, 10 px each).
   - `node` → filled circle (5 px radius).
   - `grid_node` → `+` (two perpendicular lines, 8 px).
   - `grid_line_fallback` → small tick perpendicular to the grid
     line at the foot of perpendicular drop.
   Color from `canvas.snap_indicator` token (existing). Stroke
   width 1.5 CSS px.
2. Render in screen-space: at paint time, reset transform to identity
   then translate to `metricToScreen(snapTarget.target, viewport)`,
   then draw the shape. This makes the glyph size constant across
   zoom — the user-felt visual size should not change.
3. Update `paint.ts` to call paintSnapGlyph as part of the new
   overlay pass (after entities, before paintTransientLabel).
4. EditorRoot effect: when `overlay.cursor` changes and a tool
   awaits a `'point'` Input (check `commandBar.activePrompt !== null`
   AND prompt's accepted kinds include `'point'`) AND `toggles.osnap`
   OR `toggles.gsnap` is on, run the snap resolver from
   `src/snap/priority.ts` on the cursor and call
   `editorUiActions.setSnapTarget(...)`. Otherwise null it.
5. Tests: paintSnapGlyph called with each kind produces the right
   path commands (verify via captured ctx call list).

**Invariants introduced:**

- I-DTP-6: paintSnapGlyph runs in screen-space (transform reset to
  identity); glyph visual size is invariant across zoom. Verified
  by the painter test capturing the post-`setTransform(1,0,0,1,...)`
  call sequence.
- I-DTP-7: `overlay.snapTarget` is populated only when a tool is
  awaiting `'point'` Input AND at least one of OSNAP/GSNAP is on;
  null otherwise. Tested via integration test.

**Mandatory Completion Gates:**

```
Gate DTP-3.1: paintSnapGlyph file present, exports paintSnapGlyph
  Command: rg -n "export function paintSnapGlyph" packages/editor-2d/src/canvas/painters/paintSnapGlyph.ts
  Expected: ≥1 match

Gate DTP-3.2: All five glyph kinds handled
  Command: rg -n "endpoint|midpoint|intersection|'node'|grid_node" packages/editor-2d/src/canvas/painters/paintSnapGlyph.ts
  Expected: ≥5 matches

Gate DTP-3.3: paint.ts overlay pass calls paintSnapGlyph
  Command: rg -n "paintSnapGlyph" packages/editor-2d/src/canvas/paint.ts
  Expected: ≥1 match

Gate DTP-3.4: paintSnapGlyph tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- tests/paintSnapGlyph
  Expected: passes
```

### Phase 4 — Live preview + shared transient label

**Goal:** Tools yield `previewBuilder` along with their prompts; the
runner re-builds the preview shape on every cursor tick;
paintPreview painter draws it; paintTransientLabel renders the
length / radius / angle / dimension labels.

**Files affected:**
- `packages/editor-2d/src/canvas/painters/paintTransientLabel.ts` (new)
- `packages/editor-2d/src/canvas/painters/paintPreview.ts` (new)
- `packages/editor-2d/src/tools/types.ts` (modified — extend `Prompt`
  with `previewBuilder?: (cursor: Point2D) => PreviewShape`)
- `packages/editor-2d/src/tools/runner.ts` (modified — re-evaluate
  `previewBuilder` on cursor change)
- `packages/editor-2d/src/tools/draw/draw-line.ts` (modified — yield
  `previewBuilder`)
- `packages/editor-2d/src/tools/draw/draw-polyline.ts` (modified)
- `packages/editor-2d/src/tools/draw/draw-rectangle.ts` (modified)
- `packages/editor-2d/src/tools/draw/draw-circle.ts` (modified)
- `packages/editor-2d/src/tools/draw/draw-arc.ts` (modified)
- `packages/editor-2d/src/tools/draw/draw-xline.ts` (modified)
- `packages/editor-2d/src/canvas/paint.ts` (modified — overlay pass
  calls paintPreview + paintTransientLabel)
- `packages/editor-2d/tests/paintPreview.test.ts` (new)
- `packages/editor-2d/tests/paintTransientLabel.test.ts` (new)
- `packages/editor-2d/tests/draw-tools.test.ts` (modified — assert
  previewBuilder yields)

**Steps:**

1. **Author `paintTransientLabel.ts`.** Signature:
   ```ts
   paintTransientLabel(
     ctx: CanvasRenderingContext2D,
     anchor: { metric: Point2D, screenOffset?: { dx: number; dy: number } },
     text: string,
     viewport: Viewport,
   ): void;
   ```
   Renders text at `metricToScreen(anchor.metric, viewport)` (+ optional
   screen-px offset). Translucent rounded-pill background for legibility.
   Tokens: `canvas.transient.label_text`, `label_bg`, `label_padding`.
   Reset transform to identity at the start, restore at the end. Font:
   `'12px system-ui, -apple-system, sans-serif'` (matches design-system).
2. **Define `PreviewShape` discriminated union** in `tools/types.ts`:
   ```ts
   export type PreviewShape =
     | { kind: 'line'; p1: Point2D; cursor: Point2D }
     | { kind: 'polyline'; vertices: Point2D[]; cursor: Point2D; closed: boolean }
     | { kind: 'rectangle'; corner1: Point2D; cursor: Point2D }
     | { kind: 'circle'; center: Point2D; cursor: Point2D }
     | { kind: 'arc-2pt'; p1: Point2D; cursor: Point2D }    // first leg, no arc shape yet
     | { kind: 'arc-3pt'; p1: Point2D; p2: Point2D; cursor: Point2D }  // arc through 3 points
     | { kind: 'xline'; pivot: Point2D; cursor: Point2D }
     // Selection-rectangle preview (Phase 7). Drawn by paintSelectionRect
     // (NOT paintPreview); paint.ts's overlay-pass dispatcher routes
     // PreviewShape arms by kind. This keeps the runner's previewBuilder
     // contract uniform — select-rect's previewBuilder is the same shape
     // as a draw tool's, and EditorRoot doesn't need any selection-rect-
     // specific routing.
     | { kind: 'selection-rect'; start: Point2D; end: Point2D; direction: 'window' | 'crossing' };
   ```
   **Forward compatibility note (C10):** When M1.3b adds modify-operator
   previews (Move shows ghost, Rotate shows arc, Scale shows scaled
   shape), the union extends additively. Grip-stretch's previewBuilder
   in M1.3d reuses the existing primitive-kind arms (a stretched
   line is `{ kind: 'line', p1, cursor }` with the moved endpoint as
   `cursor`); a future M1.3b move-with-multiple-entities preview MAY
   want a new `{ kind: 'modified-entities', entities: Primitive[] }`
   arm. Not added in M1.3d; documented here so M1.3b knows the
   extension point.
3. **Author `paintPreview.ts`** dispatching on `PreviewShape.kind`:
   - line: dashed line p1→cursor + label "{length} m" at midpoint.
   - polyline: chain segments + dashed rubber-band last→cursor +
     label on rubber-band segment.
   - rectangle: dashed rect from corner1 to cursor + "WxH m" label
     near the second corner.
   - circle: dashed circle outline + dashed radius line center→cursor
     + "R xx.xx m" label on radius line midpoint.
   - arc-2pt: dashed line p1→cursor (no arc yet, only the first leg
     drawn for guidance).
   - arc-3pt: dashed arc through (p1, p2, cursor) computed via
     circumscribed-circle math + "R xx.xx m" label near the arc.
   - xline: dashed infinite line through pivot at angle defined by
     pivot→cursor direction (clipped to viewport via the existing
     `paintXline` clipping math).
   Stroke style: `canvas.transient.preview_stroke` + `setLineDash`
   from `canvas.transient.preview_dash`.
4. **Extend `Prompt` type** in `tools/types.ts`:
   ```ts
   export interface Prompt {
     text: string;
     subOptions?: SubOption[];
     defaultValue?: string;
     acceptedInputKinds: AcceptedInputKind[];
     /**
      * Optional: build a preview shape from the current cursor metric.
      * Tool runner re-invokes this on every cursor change and writes
      * the result to `overlay.previewShape`. Tools that don't need
      * a preview omit it.
      */
     previewBuilder?: (cursor: Point2D) => PreviewShape;
   }
   ```
5. **Update tool runner — explicit subscription contract.** The runner
   gains a `currentPrompt: Prompt | null` field. Lifecycle:
   - When the generator yields a `Prompt`, runner sets
     `currentPrompt = prompt` and calls
     `editorUiActions.setPrompt(...)` (existing).
   - **If `currentPrompt.previewBuilder` is non-null,** runner
     subscribes to `editorUiStore` via `editorUiStore.subscribe(fn)`
     ONCE per tool start (single subscription for the tool's lifetime;
     not per-prompt to avoid resubscribe churn). The subscriber reads
     `state.overlay.cursor` on every store change and, when cursor is
     non-null AND `currentPrompt.previewBuilder` exists, calls
     `editorUiActions.setPreviewShape(currentPrompt.previewBuilder(cursor.metric))`.
   - When `currentPrompt` resolves (input received), runner clears
     the preview: `setPreviewShape(null)`. The subscription stays alive
     for the next prompt.
   - On tool completion (committed) OR abort (escape): runner unsubscribes
     and clears `setPreviewShape(null)`. Cleanup is the runner's
     existing `try { ... } finally { ... }` block in
     `tools/runner.ts`.
   - Throttling: the subscription fires on every editorUiStore change
     (cursor, snapTarget, etc. all in the same store). To avoid
     re-running previewBuilder on non-cursor changes, the subscriber
     compares `state.overlay.cursor` against a captured-last value and
     only re-builds when cursor actually changed.
   - I-68 compliance: runner subscribes to editorUiStore (single side).
     Runner DOES NOT subscribe to projectStore (only `.getState()`
     reads at commit time, which is one-shot). Verified via existing
     Gate 22.7 — runner.ts is not currently an offender; the new
     subscription keeps it single-side.
   - **Closure capture clarification (C14).** The subscription
     handler captures `() => currentPrompt?.previewBuilder` (re-read
     on each fire), NOT the previewBuilder value at subscribe time.
     `currentPrompt` is a runner-local mutable reference updated when
     the generator yields. This way, the same one-shot subscription
     handles every prompt the tool yields without resubscribing per
     prompt.
6. **Update each draw tool** to yield `previewBuilder` on the
   appropriate prompts (per the `PreviewShape.kind` table):
   - draw-line: second prompt yields `previewBuilder: (c) => ({ kind:
     'line', p1: start, cursor: c })`.
   - draw-polyline: every loop iteration yields `previewBuilder: (c)
     => ({ kind: 'polyline', vertices: [...], cursor: c, closed:
     false })`.
   - draw-rectangle: second prompt yields `previewBuilder: (c) =>
     ({ kind: 'rectangle', corner1: c1, cursor: c })`.
   - draw-circle: second prompt yields `previewBuilder: (c) =>
     ({ kind: 'circle', center: ctr, cursor: c })`.
   - draw-arc: second prompt yields `arc-2pt`, third yields `arc-3pt`.
   - draw-xline: second prompt yields `previewBuilder: (c) =>
     ({ kind: 'xline', pivot: pv, cursor: c })`.
   - draw-point: no preview (single click).
7. **Update `paint.ts`** overlay pass to call paintPreview after
   paintHoverHighlight + paintSelection but before paintSnapGlyph.
8. Tests: per-painter capture tests; tool tests assert previewBuilder
   yielded in the right phase.

**Invariants introduced:**

- I-DTP-8: `paintTransientLabel` is the SOLE source of transient
  overlay text on the canvas. Other painters never call
  `ctx.fillText` / `ctx.strokeText`. Enforced by Gate DTP-T2.
- I-DTP-9: Live preview is UI-only state; `paintPreview` reads
  `editorUiStore.overlay.previewShape`, NEVER `projectStore`.
  Enforced by Gate DTP-T6.
- I-DTP-10: `previewBuilder` is invoked on cursor change, not on
  click. Tested in tool-runner integration test.

**Mandatory Completion Gates:**

```
Gate DTP-4.1: paintTransientLabel exports
  Command: rg -n "export function paintTransientLabel" packages/editor-2d/src/canvas/painters/paintTransientLabel.ts
  Expected: ≥1 match

Gate DTP-4.2: paintPreview handles all 7 PreviewShape kinds
  Command: rg -n "'line'|'polyline'|'rectangle'|'circle'|'arc-2pt'|'arc-3pt'|'xline'" packages/editor-2d/src/canvas/painters/paintPreview.ts
  Expected: ≥7 matches

Gate DTP-4.3: All draw tools yield previewBuilder where applicable
  Command: rg -n "previewBuilder" packages/editor-2d/src/tools/draw/draw-line.ts packages/editor-2d/src/tools/draw/draw-polyline.ts packages/editor-2d/src/tools/draw/draw-rectangle.ts packages/editor-2d/src/tools/draw/draw-circle.ts packages/editor-2d/src/tools/draw/draw-arc.ts packages/editor-2d/src/tools/draw/draw-xline.ts
  Expected: ≥6 matches (one per tool)

Gate DTP-4.4: Painter + tool tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- tests/paintPreview tests/paintTransientLabel tests/draw-tools
  Expected: passes
```

### Phase 5 — Selection display: hover highlight, selection outline, grips

**Goal:** Hover entity → faint outline highlight (`canvas.transient.
hover_highlight`). Click-select entity → outline + grip squares
(`canvas.transient.selection_*` + `canvas.handle_move`). No grips on
hover.

**Files affected:**
- `packages/editor-2d/src/canvas/painters/paintHoverHighlight.ts` (new)
- `packages/editor-2d/src/canvas/painters/paintSelection.ts` (new)
- `packages/editor-2d/src/canvas/grip-positions.ts` (new — `gripsOf(p):
  Grip[]` per primitive kind)
- `packages/editor-2d/src/EditorRoot.tsx` (modified — on cursor
  change, run hit-test; update overlay.hoverEntity. On selection
  change, update overlay.grips.)
- `packages/editor-2d/src/canvas/paint.ts` (modified — overlay pass)
- `packages/editor-2d/tests/grip-positions.test.ts` (new)
- `packages/editor-2d/tests/paintHoverHighlight.test.ts` (new)
- `packages/editor-2d/tests/paintSelection.test.ts` (new)

**Steps:**

1. Author `grip-positions.ts`. Returns the `Grip[]` for a given
   primitive — per kind:
   - point: 1 grip at position.
   - line: 2 grips (p1, p2).
   - polyline: N grips, one per vertex.
   - rectangle: 5 grips — 4 corners + center (or just corners; AutoCAD
     shows 4 corners + 4 mid-edges + center. M1.3d ships 4 corners
     only; mid-edges + center deferred).
   - circle: 4 grips — N/E/S/W on circumference + 1 center.
   - arc: 3 grips — 2 endpoints + 1 midpoint of arc.
   - xline: 1 grip at pivot + 1 indicator at pivot+10m along angle
     (for visual orientation).
   Each `Grip = { entityId, gripKind: string, position: Point2D }`.
2. Author `paintHoverHighlight.ts`. When `overlay.hoverEntity` is
   non-null, paint that entity with a faint dashed outline using
   `canvas.transient.hover_highlight.stroke`. Stroke-only, no fill.
   Reset transform pattern matching paintSnapGlyph.
3. Author `paintSelection.ts`. For each entity in
   `editorUiStore.selection`:
   - Paint the entity outline using
     `canvas.transient.selection_window.stroke` (slightly different
     from hover; selection outline is 1.5 px solid blue, not dashed).
   - Paint each grip from `gripsOf(entity)` as a 7×7 px filled blue
     square + 1 px white outline using `canvas.handle_move`.
4. EditorRoot effect: on cursor change, run hit-test (existing
   `hitTest(...)` from `canvas/hit-test.ts`) on the cursor metric.
   `setHoverEntity(hit ?? null)`. **Spatial-index reuse pattern (C8):**
   matches the M1.3a `handleCanvasClick` pattern — build a fresh
   `PrimitiveSpatialIndex` at hit-test time, populate it from
   `projectStore.getState().project.primitives`, run `hitTest(...)`,
   discard. With M1.3a workloads (10s–100s of primitives), the build
   cost is negligible at 60fps. If profiling later shows this is hot,
   refactor to a memoised index keyed on project version. M1.3d does
   not pre-optimise.
5. EditorRoot effect: on selection change OR primitives change, recompute
   `overlay.grips` from selected entities + their gripsOf shapes.
   `setGrips(grips)`.
6. Update `paint.ts` overlay pass to call paintHoverHighlight first
   (lower z), then paintSelection.
7. Tests: gripsOf for each primitive kind produces expected shape.
   Painter tests capture path commands.

**Invariants introduced:**

- I-DTP-11: Grips appear ONLY when an entity is selected; never on
  hover. `paintSelection` is the sole grip painter and reads
  `editorUiStore.selection`. Hover painter (paintHoverHighlight)
  reads `overlay.hoverEntity` and never paints grips.
- I-DTP-12: `overlay.hoverEntity` is updated only when no tool is
  active (tools that await `'point'` should not show hover-of-other-
  entity since that's confusing). When a tool is active, hover-
  highlight is skipped. EditorRoot effect gates on
  `editorUiStore.activeToolId === null`.

**Mandatory Completion Gates:**

```
Gate DTP-5.1: gripsOf handles all 7 primitive kinds
  Command: rg -n "'point'|'line'|'polyline'|'rectangle'|'circle'|'arc'|'xline'" packages/editor-2d/src/canvas/grip-positions.ts
  Expected: ≥7 matches

Gate DTP-5.2: paintSelection / paintHoverHighlight files present and exported
  Command: rg -n "export function paintSelection|export function paintHoverHighlight" packages/editor-2d/src/canvas/painters/
  Expected: ≥2 matches

Gate DTP-5.3: paint.ts overlay pass orders correctly
  Command: rg -n "paintHoverHighlight|paintSelection" packages/editor-2d/src/canvas/paint.ts
  Expected: ≥2 matches; paintHoverHighlight call site precedes paintSelection in source order

Gate DTP-5.4: Painter + grip-positions tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- tests/grip-positions tests/paintHoverHighlight tests/paintSelection
  Expected: passes
```

### Phase 6 — Grip hit-test + grip-stretch tool

**Goal:** Click on a grip square → start grip-stretch tool → drag
updates a transient preview → release commits the primitive update.
Same `updatePrimitive` pathway used by Properties panel and Move /
Copy tools.

**Files affected:**
- `packages/editor-2d/src/canvas/grip-hit-test.ts` (new — screen-space
  grip hit-test)
- `packages/editor-2d/src/tools/grip-stretch.ts` (new)
- `packages/editor-2d/src/tools/index.ts` (modified — register)
- `packages/editor-2d/src/keyboard/shortcuts.ts` (modified — add
  `'grip-stretch'` to ToolId)
- `packages/editor-2d/src/canvas/canvas-host.tsx` (modified — on
  mousedown, before passing to onCanvasClick, hit-test against grips
  via the active tool runner; if grip hit, fire onGripDown(grip))
- `packages/editor-2d/src/EditorRoot.tsx` (modified — `onGripDown`
  handler starts grip-stretch tool; mousemove during grip-stretch
  yields preview)
- `packages/editor-2d/tests/grip-hit-test.test.ts` (new)
- `packages/editor-2d/tests/grip-stretch.test.ts` (new)

**Steps:**

1. Author `grip-hit-test.ts`. Screen-space hit-test:
   ```ts
   gripHitTest(
     screen: ScreenPoint,
     grips: Grip[],
     viewport: Viewport,
     toleranceCss?: number = 4,
   ): Grip | null
   ```
   For each grip: convert grip.position to screen via
   `metricToScreen`; check if screen is within tolerance (4 CSS px =
   half the 8-px grip square). Returns the closest hit or null.
2. Author `grip-stretch.ts` as a tool generator:
   - Tool starts with the picked grip in context (passed as initial
     state via the tool factory closure).
   - Yields prompt: "Specify new position".
   - Loop: receives `'point'` Inputs (canvas mousedown on a new
     point). On commit, computes the patch for the entity based on
     `gripKind` (e.g. line p1 grip: `{ p1: newPoint }`; polyline
     vertex K grip: `{ vertices: [...] with vertices[K] replaced }`).
     Calls `updatePrimitive(entityId, patch)`. Returns committed.
   - Yields `previewBuilder` that produces the primitive's preview
     shape (NOT the original primitive — a hypothetical with the
     grip moved). Since the user is dragging, the preview is the
     entity-being-modified following the cursor.
   - On Escape, returns aborted.
3. canvas-host's onMouseDown is currently:
   - middle button → pan
   - right button → onCanvasCommit
   - left button → onCanvasClick(metric, screen)
   Add to the left-button branch: BEFORE calling
   `onCanvasClick`, if `props.onGripHitTest` is provided, call it
   with `screen`. If it returns a grip, fire
   `props.onGripDown(grip)` and STOP. Otherwise fall through to the
   normal click handler.
4. EditorRoot:
   - `onGripHitTest = (screen) => gripHitTest(screen, overlay.grips
     ?? [], viewport)`.
   - `onGripDown = (grip) => { runningToolRef.current?.abort();
     runningToolRef.current = startTool('grip-stretch',
     gripStretchTool(grip)); ... }`.
5. Mousemove during a grip-stretch tool: the tool's running prompt
   has a `previewBuilder` that returns the entity's hypothetical
   shape with the grip moved to cursor. Tool runner re-builds on
   cursor change (Phase 4 mechanism).
6. Tests:
   - `gripHitTest` returns the closest grip within tolerance, null
     beyond tolerance.
   - `grip-stretch` for each primitive kind: feed grip + new point
     → commit → primitive updated correctly.

**Invariants introduced:**

- I-DTP-13: grip-stretch tool commits exactly one UPDATE Operation
  per release (not per intermediate cursor frame). Tested.
- I-DTP-14: gripHitTest is screen-space (CSS-px), not metric-space.
  Visual size is constant across zoom. Tested.

**Mandatory Completion Gates:**

```
Gate DTP-6.1: grip-stretch tool registered
  Command: rg -n "grip-stretch" packages/editor-2d/src/tools/index.ts
  Expected: ≥1 match

Gate DTP-6.2: gripHitTest exported, screen-space
  Command: rg -n "export function gripHitTest" packages/editor-2d/src/canvas/grip-hit-test.ts
  Expected: ≥1 match

Gate DTP-6.3: canvas-host wires onGripHitTest + onGripDown
  Command: rg -n "onGripHitTest|onGripDown" packages/editor-2d/src/canvas/canvas-host.tsx
  Expected: ≥2 matches

Gate DTP-6.4: grip tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- tests/grip-hit-test tests/grip-stretch
  Expected: passes
```

### Phase 7 — Selection auto-fire + window/crossing rectangle

**Goal:** Click on canvas without an active tool fires the select-rect
tool. Click on entity (hit-test hit) → add to selection. Click on
empty + drag → window/crossing rectangle. Direction convention:
L→R = window/blue/fully-enclosed. R→L = crossing/green/any-touch.

**Files affected:**
- `packages/editor-2d/src/tools/select-rect.ts` (new)
- `packages/editor-2d/src/canvas/painters/paintSelectionRect.ts` (new)
- `packages/editor-2d/src/canvas/spatial-index.ts` (modified — add
  `searchEnclosed(rect): PrimitiveId[]`)
- `packages/editor-2d/src/canvas/canvas-host.tsx` (modified — left-click
  with no active tool starts selection-rect)
- `packages/editor-2d/src/EditorRoot.tsx` (modified — wire selection-
  rect lifecycle: mousedown → start, mousemove → update,
  mouseup → resolve + commit)
- `packages/editor-2d/src/tools/index.ts` (modified)
- `packages/editor-2d/src/keyboard/shortcuts.ts` (modified)
- `packages/editor-2d/tests/select-rect.test.ts` (new)
- `packages/editor-2d/tests/paintSelectionRect.test.ts` (new)
- `packages/editor-2d/tests/spatial-index.test.ts` (modified — assert
  `searchEnclosed` correctness)

**Steps:**

1. Add `searchEnclosed(rect: BBox): PrimitiveId[]` to
   `PrimitiveSpatialIndex`. For each entity returned by
   `searchFrustum(rect)`, check that its bbox is fully inside `rect`
   (`item.minX >= rect.minX && item.maxX <= rect.maxX && ...`).
   Return only those.
2. Author `paintSelectionRect.ts`. Receives the selection-rect arm
   of `overlay.previewShape` (paint.ts's overlay-pass dispatcher
   routes `previewShape.kind === 'selection-rect'` here, and the
   other arms to `paintPreview`). Paints a dashed rectangle: stroke
   + light fill from `canvas.transient.selection_window` (direction
   === 'window') OR `canvas.transient.selection_crossing` (direction
   === 'crossing'). Reset transform to identity for a screen-space
   draw (the rectangle's visual size matches viewport coordinates,
   not metric scaling — same convention as paintSnapGlyph and
   paintCrosshair).
3. Author `select-rect.ts`. Tool generator:
   - Started by canvas-host on left-mousedown when no active tool.
     The tool factory closure receives the start point (metric)
     captured at mousedown.
   - First yield: a `Prompt` with `previewBuilder: (cursor) =>
     ({ kind: 'selection-rect', start, end: cursor, direction:
     start.x < cursor.x ? 'window' : 'crossing' })`.
     This is the standard PreviewShape-arm route from Phase 4 step 2
     — the runner writes the result to `overlay.previewShape`,
     paint.ts's overlay-pass dispatcher routes the `'selection-rect'`
     arm to `paintSelectionRect` (instead of `paintPreview`).
     **No EditorRoot routing needed; no `overlay.selectionRect` field
     in the slice.** (C6 fix.)
   - Awaits a `'point'` Input (the mouseup point). Resolves direction
     from `start.x < end.x ? 'window' : 'crossing'`. Resolves hits:
     - window: `searchEnclosed(rect)` → ids fully inside.
     - crossing: `searchFrustum(rect)` → ids intersecting.
     - Plus per-entity precise check for non-bbox geometry (xlines:
       skip; arcs / circles: bbox is tight enough).
   - On commit: `editorUiActions.setSelection(ids)`. Returns
     `{ committed: true, description: '...' }`.
   - Special case: if `start === end` (no drag — mousedown and
     mouseup at the same point within tolerance): hit-test on `start`;
     if hit, single-entity-select; else clear selection. Same return
     `committed: true`.
4. **canvas-host onMouseUp callback for select-rect commit (C7).** Add
   to `CanvasHostProps`:
   `onCanvasMouseUp?: (metric: Point2D, screen: ScreenPoint) => void`.
   In canvas-host's existing onMouseUp handler (which currently only
   resets `panStateRef`), call `props.onCanvasMouseUp?.(metric,
   screen)` after pan-state reset. EditorRoot's
   `handleCanvasMouseUp` routes to the running tool:
   `runningToolRef.current?.feedInput({ kind: 'point', point: metric })`.
   Tools that don't expect mouseup-driven commits (line, circle, arc,
   etc. all use mousedown for points) ignore the input — their next
   `await nextInput()` resolves with the mouseup metric, but the
   generator is already awaiting the next `'point'` input which it
   would also accept; that's fine for select-rect (its only `'point'`
   await IS the mouseup) but causes an unwanted "extra point" in
   draw tools.
   **Mitigation:** canvas-host fires `onCanvasMouseUp` ONLY when no
   active tool is running OR the active tool is `select-rect` /
   `grip-stretch` (the two drag-style tools). Other tools never
   receive mouseup-driven inputs. Implementation: canvas-host reads
   `props.activeToolId` (new prop) — but cleaner: canvas-host doesn't
   need to know; EditorRoot's `handleCanvasMouseUp` checks
   `activeToolId === 'select-rect' || activeToolId === 'grip-stretch'`
   before forwarding. Simple, contained.
5. canvas-host's onMouseDown when no active tool AND no grip hit:
   start select-rect tool with the mousedown point as `start`.
   Subsequent cursor changes update the previewBuilder via the
   runner's existing cursor-subscription mechanism (Phase 4 step 5).
   Mouseup → onCanvasMouseUp → EditorRoot routes the metric as a
   `'point'` Input to the running select-rect tool → tool resolves
   and commits.
6. paint.ts overlay pass adds paintSelectionRect after paintPreview.
7. Tests: searchEnclosed correctness; select-rect for both directions
   commits the right selection; paintSelectionRect path commands
   match per-direction.

**Invariants introduced:**

- I-DTP-15: Selection rectangle direction is determined by `start.x
  vs end.x`: L→R = window, R→L = crossing. Tested with both
  directions.
- I-DTP-16: Window selection uses `searchEnclosed` (fully-enclosed);
  crossing selection uses `searchFrustum` (intersects). Tested.
- I-DTP-17: Click without drag (start === end within tolerance) →
  single-entity hit-test, NOT empty-rect. Tested.

**Mandatory Completion Gates:**

```
Gate DTP-7.1: searchEnclosed exported
  Command: rg -n "searchEnclosed" packages/editor-2d/src/canvas/spatial-index.ts
  Expected: ≥1 match

Gate DTP-7.2: select-rect tool registered
  Command: rg -n "select-rect" packages/editor-2d/src/tools/index.ts
  Expected: ≥1 match

Gate DTP-7.3: paintSelectionRect exists
  Command: rg -n "export function paintSelectionRect" packages/editor-2d/src/canvas/painters/paintSelectionRect.ts
  Expected: ≥1 match

Gate DTP-7.4: Direction-convention test passes
  Command: pnpm --filter @portplanner/editor-2d test -- tests/select-rect tests/spatial-index
  Expected: passes; both directions covered
```

### Phase 8 — Default grid + status-bar coords + cursor crosshair

**Goal:** Three small finishing items.

**Files affected:**
- `apps/web/src/hooks/useAutoLoadMostRecent.ts` (modified — bootstrap
  default grid)
- `apps/web/tests/auto-load.test.tsx` (modified — assertion)
- `packages/editor-2d/src/chrome/StatusBarCoordReadout.tsx` (new) +
  `.module.css`
- `packages/editor-2d/src/index.ts` (modified — re-export)
- `apps/web/src/shell/StatusBar.tsx` (modified — mount the readout)
- `packages/editor-2d/src/canvas/painters/paintCrosshair.ts` (new)
- `packages/editor-2d/src/canvas/paint.ts` (modified — overlay pass)
- `packages/editor-2d/src/keyboard/router.ts` (modified — F7 toggle)
- `packages/editor-2d/src/EditorRoot.tsx` (modified — onToggleCrosshair
  callback)
- `docs/operator-shortcuts.md` (modified — add F7 row)
- `packages/editor-2d/tests/StatusBarCoordReadout.test.tsx` (new)
- `packages/editor-2d/tests/paintCrosshair.test.ts` (new)
- `packages/editor-2d/tests/keyboard-router.test.ts` (modified —
  F7 test)

**Steps:**

1. **Default grid in bootstrap.** `useAutoLoadMostRecent.
   buildDefaultProject` returns a project that, in addition to
   default layer, contains one grid:
   ```ts
   const gridId = newGridId();
   return {
     ...,
     grids: { [gridId]: {
       id: gridId,
       origin: { x: 0, y: 0 },
       angle: 0,
       spacingX: 5,
       spacingY: 5,
       layerId: LayerId.DEFAULT,
       visible: true,
       activeForSnap: true,
     } },
   };
   ```
   Update `apps/web/tests/auto-load.test.tsx` to assert grid presence
   in the bootstrap.
2. **StatusBarCoordReadout component.** React component reading
   `useEditorUi((s) => s.overlay.cursor)`. Renders:
   ```tsx
   const c = cursor?.metric;
   return (
     <span className={styles.coordReadout} data-component="coord-readout">
       {c ? `X: ${c.x.toFixed(3)}  Y: ${c.y.toFixed(3)}` : 'X: —  Y: —'}
     </span>
   );
   ```
3. Mount in `apps/web/src/shell/StatusBar.tsx` next to the existing
   `<StatusBarGeoRefChip />`.
4. **Crosshair painter.** `paintCrosshair.ts`:
   ```ts
   paintCrosshair(ctx, cursor, sizePct, viewport): void
   ```
   When `sizePct >= 100`: draw two lines spanning the entire canvas,
   horizontal through cursor.y and vertical through cursor.x.
   When `sizePct < 100`: draw two short crosses of length
   `sizePct/100 * canvasHeight`, centered at cursor.
   Color: `canvas.transient.crosshair`. Reset transform; render in
   screen-space.
5. paint.ts overlay pass calls paintCrosshair FIRST in the overlay
   pass (so it sits behind everything else but above entities).
6. Keyboard router: F7 fires new `onToggleCrosshair` callback. Add to
   `KeyboardRouterCallbacks`.
7. EditorRoot's `onToggleCrosshair`: toggle
   `editorUiStore.viewport.crosshairSizePct` between 100 and 5
   (preset values). Persist in viewport (UI-only state, not stored).
8. `docs/operator-shortcuts.md`: bump version 1.0.0 → 1.0.1, add
   row `| F7 | toggle-crosshair | Toggle crosshair size between
   full-canvas and pickbox preset (M1.3d) |`. Append changelog row.
9. Tests:
   - StatusBarCoordReadout renders updated coords on cursor change.
   - paintCrosshair generates the right line counts for both presets.
   - keyboard-router test: F7 fires onToggleCrosshair on canvas focus.
   - auto-load test: default grid present.

**Invariants introduced:**

- I-DTP-18: `crosshairSizePct` is clamped 0–100 at the action level.
- I-DTP-19: paintCrosshair runs in screen-space.
- I-DTP-20: F7 fires `onToggleCrosshair` callback regardless of focus
  holder (consistent with F3/F8/F9/F12 bypass-key pattern from
  M1.3a I-32).

**Mandatory Completion Gates:**

```
Gate DTP-8.1: Default grid in bootstrap
  Command: rg -n "newGridId|spacingX: 5" apps/web/src/hooks/useAutoLoadMostRecent.ts
  Expected: ≥1 match

Gate DTP-8.2: Auto-load test asserts grid presence
  Command: pnpm --filter @portplanner/web test -- tests/auto-load
  Expected: passes; grid assertion present

Gate DTP-8.3: StatusBarCoordReadout component exists
  Command: rg -n "export function StatusBarCoordReadout" packages/editor-2d/src/chrome/StatusBarCoordReadout.tsx
  Expected: ≥1 match

Gate DTP-8.4: StatusBar mounts the readout
  Command: rg -n "StatusBarCoordReadout" apps/web/src/shell/StatusBar.tsx
  Expected: ≥1 match

Gate DTP-8.5: paintCrosshair exists
  Command: rg -n "export function paintCrosshair" packages/editor-2d/src/canvas/painters/paintCrosshair.ts
  Expected: ≥1 match

Gate DTP-8.6: F7 in keyboard router
  Command: rg -n "F7" packages/editor-2d/src/keyboard/router.ts
  Expected: ≥1 match

Gate DTP-8.7: docs/operator-shortcuts.md updated
  Command: rg -n "F7|toggle-crosshair|1\\.0\\.1" docs/operator-shortcuts.md
  Expected: ≥3 matches

Gate DTP-8.8: Component + painter + keyboard tests pass
  Command: pnpm --filter @portplanner/editor-2d test -- tests/StatusBarCoordReadout tests/paintCrosshair tests/keyboard-router
  Expected: passes
```

### Phase 9 — Smoke E2E rewrite (DOM-level scenarios)

**Goal:** Extend the Phase 21 smoke E2E suite to cover the new
polish surface. Per A18 / Procedure 02 §2.4: each scenario mounts
`<EditorRoot />` in jsdom and fires DOM events; project-state
seeding via action API permitted as setup; UI-state writes and
assertion paths must be DOM-driven.

**Files affected:**
- `packages/editor-2d/tests/smoke-e2e.test.tsx` (modified — append
  five polish scenarios + extend SCENARIOS const)

**Steps:**

1. Extend `SCENARIOS` const in `smoke-e2e.test.tsx` with five new
   names:
   ```ts
   const SCENARIOS = [
     ... existing 5 ...,
     'live preview during line draw',
     'snap glyph appears at endpoint',
     'window vs crossing selection',
     'grip stretch updates primitive',
     'cursor coords update on mousemove',
   ] as const;
   ```
2. Author each scenario:
   - **`live preview during line draw`**: render EditorRoot, seed
     project, activate `L`, click first point, fire mousemove on
     canvas, assert `editorUiStore.overlay.previewShape !== null`
     and its `kind === 'line'`. Click second point. Assert preview
     gone.
   - **`snap glyph appears at endpoint`**: render, seed, draw a
     primitive (line p1=(0,0), p2=(10,0)) via action-API setup.
     Activate `L`, click first point. Move cursor near (10,0)
     endpoint via mousemove. Assert
     `editorUiStore.overlay.snapTarget !== null` and
     `snapTarget.kind === 'endpoint'`. (Glyph rendering itself is
     covered by the painter unit test; smoke verifies the wire-up.)
   - **`window vs crossing selection`**: render, seed two
     primitives in known positions. Click empty space (start L→R
     drag), mousemove to the right past the entities, mouseup.
     Assert window-direction selection AND only fully-enclosed
     entities selected. Repeat with R→L drag, assert crossing-
     direction AND any-touched entities selected.
   - **`grip stretch updates primitive`**: seed a line, mousedown
     on a grip, mousemove to a new point, mouseup. Assert the
     primitive's endpoint now matches the new point.
   - **`cursor coords update on mousemove`**: render, query
     coord readout, assert initial state shows `X: —  Y: —`. Move
     cursor (mousemove). Assert readout text matches expected
     `X: 12.345  Y: -5.678` style.
3. Update the in-file discipline meta-test (Gate 21.2.disc) to
   include the five new scenarios automatically (they're already in
   `SCENARIOS`; the meta-test iterates SCENARIOS).

**Coverage tradeoff (C9 from §1.3 Round 2 self-audit).** The smoke
suite covers each polish item with ONE representative DOM-level
scenario. Exhaustive coverage of every glyph kind / every primitive
kind for grip-stretch / every selection-rect direction edge case
lives in the per-painter / per-helper unit tests (paintSnapGlyph,
grip-positions, grip-stretch, select-rect, etc.). Smoke verifies the
end-to-end wire-up (cursor → snap engine → overlay → painter); units
verify the painter / helper correctness. This is a documented
tradeoff, not a gap — five smoke scenarios for five distinct
features keeps the suite fast (the suite's runtime growth budget
is ~5s for M1.3d).

**Invariants introduced:**

- I-DTP-21: All five new polish scenarios mount `<EditorRoot />` and
  fire DOM events per A18 / Gate 21.2.disc. Enforced by existing
  meta-test.

**Mandatory Completion Gates:**

```
Gate DTP-9.1: Five new scenarios in SCENARIOS const
  Command: rg -c "live preview|snap glyph|window vs crossing|grip stretch|cursor coords" packages/editor-2d/tests/smoke-e2e.test.tsx
  Expected: ≥5 matches

Gate DTP-9.2: Smoke E2E passes for all 10 scenarios + discipline meta-test
  Command: pnpm --filter @portplanner/editor-2d test -- tests/smoke-e2e
  Expected: 10 / 10 named scenarios pass + discipline meta-test pass; total 11 / 11

Gate DTP-9.3: Full workspace test suite passes
  Command: pnpm test
  Expected: all packages pass
```

### Phase 10 — Final audits + handoff

**Goal:** Run the final audit cycle per Procedure 03 §3.3 + §3.9 +
§3.8.

**Steps:**

1. Final Audit #1 (full system audit against plan + binding specs).
2. Final Audit #2 (independent re-audit, fresh reviewer posture).
3. §3.9 Self-Review Loop (apply Procedure 04 to own commit range,
   classify findings, remediate Blocker / High-risk).
4. §3.8 Post-Execution Handoff in chat.

**Exit criteria:**

- All M1.3d gates pass.
- Self-review loop terminates with zero Blocker / zero High-risk
  findings.
- Handoff block emitted in chat with commit range, file lists,
  binding-spec change log.

## 9. Invariants summary

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| I-DTP-1 | `canvas.transient.*` tokens are SOLE source of transient overlay styling; transient painters never read layer color tokens | Gate DTP-T1 (grep on transient painter files) |
| I-DTP-2 | `overlay.cursor` null when no mousemove yet OR cursor left canvas | Tests (Phase 1) |
| I-DTP-3 | `viewport.crosshairSizePct` clamped [0,100] at action level | Tests (Phase 1) |
| I-DTP-4 | canvas-host mousemove rAF-coalesced (≤1 onCanvasHover per frame) | Tests (Phase 2) |
| I-DTP-5 | onCanvasHover metric derived via screenToMetric (consistent with click) | Tests (Phase 2) |
| I-DTP-6 | paintSnapGlyph runs in screen-space (constant visual size across zoom) | Painter test (Phase 3) |
| I-DTP-7 | overlay.snapTarget non-null only when tool awaits 'point' AND OSNAP/GSNAP on | Integration test (Phase 3) |
| I-DTP-8 | paintTransientLabel SOLE source of transient text; other painters never call ctx.fillText/strokeText | Gate DTP-T2 (grep — exclude paintGrid) |
| I-DTP-9 | Live preview UI-only — paintPreview reads overlay.previewShape, never projectStore | Gate DTP-T6 (grep — paintPreview never imports projectStore) |
| I-DTP-10 | previewBuilder invoked on cursor change, not on click | Tool runner test (Phase 4) |
| I-DTP-11 | Grips appear ONLY on click-select; never on hover. paintSelection reads editorUiStore.selection; paintHoverHighlight never paints grips | Painter tests + integration (Phase 5) |
| I-DTP-12 | overlay.hoverEntity updated only when activeToolId === null | EditorRoot effect test (Phase 5) |
| I-DTP-13 | grip-stretch commits exactly one UPDATE Operation per release | Tool test (Phase 6) |
| I-DTP-14 | gripHitTest screen-space (CSS-px), not metric | Helper test (Phase 6) |
| I-DTP-15 | Selection-rect direction by start.x vs end.x: L→R=window, R→L=crossing | Tool test (Phase 7) |
| I-DTP-16 | Window=searchEnclosed (fully-enclosed); crossing=searchFrustum (intersects) | spatial-index test (Phase 7) |
| I-DTP-17 | Click without drag → hit-test on start, not empty-rect resolution | Tool test (Phase 7) |
| I-DTP-18 | crosshairSizePct clamped at action level | Tests (Phase 1 + Phase 8) |
| I-DTP-19 | paintCrosshair runs in screen-space | Painter test (Phase 8) |
| I-DTP-20 | F7 fires onToggleCrosshair regardless of focus holder | Keyboard router test (Phase 8) |
| I-DTP-21 | All polish smoke scenarios mount `<EditorRoot />` + fire DOM events | Gate 21.2.disc (existing per-scenario meta-test) |
| I-DTP-22 | `canvas-host.tsx` accesses overlay state EXCLUSIVELY via the `getOverlay: () => OverlayState \| null` prop callback; NEVER subscribes to or imports `editorUiStore`. Preserves I-68 (Gate 22.7). | Gate DTP-T7 (hard grep on canvas-host.tsx) |

### Cross-cutting hard gates (run once at end):

```
Gate DTP-T1: Transient painters never read layer color tokens
  Command: rg -l "layer\\.color|effectiveColor.*layer" packages/editor-2d/src/canvas/painters/paintPreview.ts packages/editor-2d/src/canvas/painters/paintSnapGlyph.ts packages/editor-2d/src/canvas/painters/paintSelection.ts packages/editor-2d/src/canvas/painters/paintSelectionRect.ts packages/editor-2d/src/canvas/painters/paintTransientLabel.ts packages/editor-2d/src/canvas/painters/paintHoverHighlight.ts packages/editor-2d/src/canvas/painters/paintCrosshair.ts
  Expected: 0 files matched (no transient painter reads layer styling)

Gate DTP-T2: Only paintTransientLabel calls ctx.fillText / strokeText (paintGrid excluded)
  Command: rg -l "ctx\\.fillText|ctx\\.strokeText" packages/editor-2d/src/canvas/painters/ | rg -v "paintTransientLabel\\.ts$|paintGrid\\.ts$"
  Expected: 0 files listed

Gate DTP-T6: paintPreview never imports projectStore
  Command: rg -n "from '@portplanner/project-store'" packages/editor-2d/src/canvas/painters/paintPreview.ts
  Expected: 0 matches

Gate DTP-T7: canvas-host.tsx never subscribes to editor-ui state (preserves I-68)
  Command: rg -n "editorUiStore|\\buseEditorUi\\(|from ['\"]\\.\\./chrome/use-editor-ui-store['\"]" packages/editor-2d/src/canvas/canvas-host.tsx
  Expected: 0 matches
  Rationale (Codex Round 1 H1 fix + C2): canvas-host already
  subscribes to projectStore; ANY editor-ui subscription path —
  whether via `editorUiStore.subscribe(`, `editorUiStore.getState()`
  reads in subscribers, OR the React-hook form `useEditorUi(` —
  would make canvas-host a dual-store subscriber, violating I-68 /
  Gate 22.7. The grep mirrors the I-68 subscription-signal regex
  pair from M1.3a Gate 22.7 (`useEditorUi(` OR `editorUiStore.
  subscribe(`), plus the import path of `useEditorUi`'s defining
  module so an aliased import is caught too. canvas-host accesses
  overlay state exclusively via the getOverlay prop callback passed
  by EditorRoot. See Phase 1 step 8 for the data flow contract.
```

## 10. Test strategy

**Tests existing before:** M1.3a + M1.3a-fixes baseline at tag
`m1.3a` ships 213 tests across 6 packages.

**Tests added by M1.3d:**

- Design-system: no new tests (token namespace is data, covered by
  CSS-vars emission existing tests if any).
- Editor-2d:
  - `tests/paintTransientLabel.test.ts` (Phase 4)
  - `tests/paintPreview.test.ts` (Phase 4)
  - `tests/paintSnapGlyph.test.ts` (Phase 3)
  - `tests/paintSelection.test.ts` (Phase 5)
  - `tests/paintHoverHighlight.test.ts` (Phase 5)
  - `tests/paintSelectionRect.test.ts` (Phase 7)
  - `tests/paintCrosshair.test.ts` (Phase 8)
  - `tests/grip-positions.test.ts` (Phase 5)
  - `tests/grip-hit-test.test.ts` (Phase 6)
  - `tests/grip-stretch.test.ts` (Phase 6)
  - `tests/select-rect.test.ts` (Phase 7)
  - `tests/StatusBarCoordReadout.test.tsx` (Phase 8)
  - `tests/canvas-host.test.tsx` (new — mousemove coalescing, getOverlay
    callback wired, requestPaint imperative ref, grip hit-test
    routing, NO editorUiStore import per Gate DTP-T7)
  - `tests/tool-runner.test.ts` (extended — runner cursor-subscription
    lifecycle: subscribe on tool start, unsubscribe on commit / abort,
    no leak across tool runs, closure-captured currentPrompt re-read
    on each fire — addresses C14 + C19)
  - `tests/spatial-index.test.ts` (extended — searchEnclosed)
  - `tests/keyboard-router.test.ts` (extended — F7 + onToggleCrosshair)
  - `tests/draw-tools.test.ts` (extended — previewBuilder yields)
  - `tests/ui-state.test.ts` (extended — new overlay slice fields
    including suppressEntityPaint per C5; selection-rect arm of
    PreviewShape per C6)
  - `tests/smoke-e2e.test.tsx` (extended — five new scenarios)
- apps/web:
  - `tests/auto-load.test.tsx` (extended — default grid in
    bootstrap)

**Tests intentionally not added (deferred):**

- Modify-operator integration tests — M1.3b.
- Dimension entity tests — M1.3c.
- Typed-object lifecycle tests — M2.

## 11. Done Criteria — objective pass/fail

- [ ] Plan file committed + pushed (verified by branch state at
  closure).
- [ ] All Phase 1-9 gates pass per §8.
- [ ] Smoke E2E suite shows 10 / 10 polish + drafting scenarios pass
  + discipline meta-test pass (verified by Gate DTP-9.2).
- [ ] Cross-cutting hard gates (DTP-T1, DTP-T2, DTP-T6, **DTP-T7**)
  pass. DTP-T7 is the I-DTP-22 / C2 store-isolation gate that
  protects I-68 from M1.3a — closure MUST verify it explicitly
  alongside the other T-gates (Codex Round-1 high-risk fix:
  earlier checklist omitted T7 even though it's the most critical
  architectural protection in this plan).
- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build`
  all pass.
- [ ] `canvas.transient.*` token namespace lives in design-system;
  emitted as CSS vars; documented in `docs/design-tokens.md`.
- [ ] Glossary appended with 8 new terms per §3.5.
- [ ] `docs/operator-shortcuts.md` bumped to 1.0.1; F7 row added.
- [ ] **Live preview** during line / polyline / rectangle / circle /
  arc / xline draw — verified by Gate DTP-9.2 ("live preview during
  line draw" smoke).
- [ ] **Snap glyph** appears at endpoint / midpoint / intersection
  / node / grid-node — verified by Gate DTP-9.2 ("snap glyph
  appears at endpoint" smoke; remaining kinds covered by painter
  unit tests).
- [ ] **Hover highlight** + **selection outline** + **click-select
  grips** + **no grips on hover** — verified by Gates DTP-5.* +
  the painter unit tests + integration via "grip stretch updates
  primitive" smoke.
- [ ] **Window vs crossing selection** with direction-determined
  color + behaviour — verified by Gate DTP-9.2 ("window vs crossing
  selection" smoke).
- [ ] **Grip-drag stretch** for line / polyline / rectangle / circle
  / arc / xline — verified by Gate DTP-6.4 (per-kind unit tests) +
  Gate DTP-9.2 ("grip stretch updates primitive" smoke for one
  representative kind).
- [ ] **Default grid** in bootstrap — verified by Gate DTP-8.2.
- [ ] **Status-bar coord readout** updates on mousemove — verified
  by Gate DTP-8.8 + Gate DTP-9.2 ("cursor coords update" smoke).
- [ ] **Cursor crosshair** with F7 toggle between full / pickbox
  presets — verified by Gate DTP-8.6 + Gate DTP-8.8 (keyboard test).
- [ ] **Selection auto-fire** on canvas click without active tool —
  verified by Gate DTP-9.2 ("window vs crossing selection" smoke
  exercises the no-tool click path).

## 12. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| **Mousemove + snap-on-cursor at 60 fps burns CPU.** | rAF coalescing (Phase 2) caps cursor updates at refresh rate. Snap engine runs only when a tool awaits 'point' AND a toggle is on. M1.3a workloads (tens-hundreds of primitives) leave headroom. Profile-as-needed; not pre-optimised. |
| **Live preview rendering on every cursor frame is expensive for polylines with many vertices.** | paintPreview re-uses existing per-kind painter primitives; the rubber-band segment is one extra line. polyline preview chain re-paints existing segments, not stored — overlay pass is bounded by visible-frustum vertex count. |
| **Discriminated `PreviewShape` union grows when modify operators land in M1.3b.** | Schema extension only — adding new arms is additive. Tools that don't yield previewBuilder work unchanged. |
| **`canvas.transient.*` token namespace duplicates existing canvas tokens (e.g. snap_indicator).** | Existing `canvas.snap_indicator`, `canvas.selection_fill`, etc. are KEPT; new namespace adds preview-specific tokens. Some (selection_fill / selection_border) are referenced by the new `canvas.transient.selection_window` token via re-use, not duplication. Glossary documents the relationship. |
| **Selection rectangle is a "drag-style" tool that doesn't fit the standard down→multiple-feedInput→up runner pattern cleanly.** | select-rect uses two `'point'` inputs (down + up) plus a `previewBuilder` that re-runs on cursor change. Mousemove during the drag is consumed by the previewBuilder mechanism, not separate feedInputs. Tool generator stays simple. |
| **Grip-drag stretch needs the entity-being-modified rendered as preview while the drag is in flight, but the original entity is also being painted.** | grip-stretch's previewBuilder returns the modified-entity shape; paint loop skips the original entity (filtered by an `overlay.suppressEntityPaint?: PrimitiveId | null` field) for the duration of the drag; on release, the field is cleared and the project store update fires the standard subscription update. |
| **F7 conflicts with browser fullscreen / dev-tools shortcuts on some platforms.** | F7 is rarely OS-bound (Chrome's "caret browsing" toggle on some Win versions, but unobtrusive). If conflict surfaces, swap to a different key in operator-shortcuts.md (1.0.1 → 1.0.2) before merge. Document in §13 if discovered mid-execution. |
| **Default grid in bootstrap shows a 5m grid that may be too dense for large-scale yards.** | 5m matches container width (~6m). User can disable via Layer Manager → grid properties (when grid-properties UI lands). For M1.3d, 5m is a sensible default; if profiling shows it slow, switch to viewport-aware spacing later. |
| **Token namespace boundary (transient vs ByLayer) is enforceable by grep but not by type system.** | Gate DTP-T1 catches accidental imports / usages. Long-term: a stronger boundary (separate module for transient tokens) is a refactor opportunity post-M1. |
| **paintTransientLabel rendering text in screen-space requires the font to load before paint.** | Use a system-default font stack (no web fonts) so paint is synchronous on canvas: `'12px system-ui, -apple-system, sans-serif'`. Captured in the painter contract. |
| **smoke E2E expansion from 5 → 10 scenarios increases test runtime ~2x.** | Each scenario is ~1s in the editor-2d test suite; total ~5s extra. Acceptable. |
| **PreviewShape forward-compatibility for M1.3b modify-operator previews (C10).** Move / Rotate / Scale on multiple entities want a "modified-entities" preview kind that doesn't fit the single-entity arms. | M1.3d ships the 8 arms it needs (7 primitive kinds + selection-rect); M1.3b extends additively with a new `modified-entities` arm if needed. Documented in Phase 4 step 2. No breaking change. |
| **Runner cursor-subscription teardown on tool abort (C11).** If a tool aborts mid-prompt (Escape), the runner's editorUiStore subscription must unsubscribe AND the previewShape must clear. | Phase 4 step 5 explicitly specifies the lifecycle: subscription created on tool start, cleared on tool completion / abort via the runner's existing try/finally. Verified by tool-runner integration test. |
| **`editorUiStore.overlay` slice growing into a kitchen sink (C12).** With ~9 fields (cursor, snapTarget, guides, selectionHandles, previewShape, hoverEntity, transientLabels, grips, suppressEntityPaint) plus `viewport.crosshairSizePct`, the overlay slice is becoming load-bearing for many concerns. | Acceptable for M1.3d — splitting into per-concern slices would be premature. M2+ refactor opportunity (e.g. `overlay-cursor`, `overlay-preview`, `overlay-selection` sub-slices) if the slice file exceeds ~400 LOC. Documented; not blocking. |
| **mouseup whitelist hard-codes drag-style tool ids (C13).** EditorRoot's `handleCanvasMouseUp` filters on `activeToolId === 'select-rect' \|\| activeToolId === 'grip-stretch'` to avoid forwarding mouseup-driven inputs to non-drag tools. Future drag-style tools (e.g. M1.3b STRETCH command with multi-entity crossing-window) would need to be added to the whitelist. | Acceptable for M1.3d — only two drag-style tools. Future cleaner pattern: declare `acceptsMouseUp?: boolean` on the running `Prompt`; EditorRoot reads from `editorUiStore.commandBar.activePrompt` instead of a hard-coded tool-id list. Defer until the third drag-style tool emerges. |

---

## 13. Post-execution notes

Per Procedure 03 §3.7, this section accumulates plan corrections discovered
during execution. Each entry is dated and tagged with the originating
phase. The plan body above is the authoritative spec; entries here record
where the body was insufficient and how execution adapted.

### 13.5 — Post-commit remediation: select-rect direction equality boundary (2026-04-26)

**Trigger:** Codex Round-1 post-commit audit on `6bcb9df..2bbb628` flagged a
quality-gap finding: spec/code drift on the I-DTP-15 direction-rule equality
boundary.

**What was found (Quality gap).** Plan §2 A3 + §8 Phase 7 step 3 + I-DTP-15
specify the canonical rule as `start.x < end.x ? 'window' : 'crossing'` —
strictly less than, so the equality boundary (vertical-only drag where
`cursor.x === start.x`) resolves to crossing. The Phase 7 implementation in
`packages/editor-2d/src/tools/select-rect.ts` used `>=` instead of `<` (both in
the previewBuilder direction expression and the drag-resolve direction
expression), and the corresponding test in
`packages/editor-2d/tests/select-rect.test.ts` encoded the same `>=` rule in
its title and assertions. The mismatch is a no-op for non-degenerate drags
(the only case it affects is `cursor.x === start.x`, which is a vertical-only
drag with non-zero `dy`), but it is a real spec/code mismatch worth reconciling
for invariants hygiene.

**What was changed.**
- `packages/editor-2d/src/tools/select-rect.ts` — both direction expressions
  swapped from `cursor.x >= start.x ? 'window' : 'crossing'` to
  `start.x < cursor.x ? 'window' : 'crossing'` (and the drag-resolve site
  similarly). Comments added explaining the strict-less-than semantics +
  AutoCAD vertical-drag bias.
- `packages/editor-2d/tests/select-rect.test.ts` — the `direction` describe
  block renamed to `(I-DTP-15: start.x < end.x → window)`, the existing test
  title updated to `start.x < cursor.x`, and TWO new tests added that exercise
  the equality boundary explicitly:
  1. previewBuilder boundary: `start.x === cursor.x` with non-zero `dy` →
     `direction === 'crossing'`.
  2. drag-resolve boundary: vertical-only drag selects a touching line
     (crossing's any-touch semantics on a zero-width rect).
- No code change to the plan body or to other affected files (paint.ts,
  paintSelectionRect.ts, smoke-e2e). Smoke scenarios use non-degenerate drags
  so they continue to pass with either rule.

**How verified.**
- `pnpm typecheck` — clean.
- `pnpm --filter @portplanner/editor-2d test -- tests/select-rect tests/spatial-index tests/smoke-e2e` —
  25/25 pass (was 23/23; +2 from boundary tests).
- `pnpm test` — 343/343 across 6 packages (was 341/341 pre-remediation).
- `pnpm check` — clean (Biome).
- Cross-cutting hard gates DTP-T1 / T2 / T6 / T7 — all 0 offenders.

**Binding-spec impact.** None. The plan body's I-DTP-15 wording was already
correct; only the implementation drifted. This entry records the reconciliation
so future post-commit reviewers see why the code now matches the plan.

### 13.4 — Phase 4 (2026-04-26)

**Gate DTP-T2 grep matches comments — same pattern as §13.2.** My
initial paintPreview.ts file-header comment included the literal string
`ctx.fillText` to explain WHY embedded labels delegate to
paintTransientLabel. The Gate DTP-T2 substring grep flagged the comment.
Same resolution as Phase 2: rephrase to omit the forbidden method
names. Pattern crystallizing across Phases 2/4: substring gates do not
distinguish comments from code; documentation prose explaining a
prohibition MUST avoid the prohibited token. Worth carrying into Phase
5/6/7/8 painter authorship.

**ADR-021 paint-loop pass restoration.** When paintPreview returns,
its internal `ctx.save()` / `ctx.restore()` pop the metric transform
the overlay-pass invariant assumes. paint.ts re-applies the metric
transform via `applyToCanvasContext(ctx, viewport)` after the
paintPreview call so subsequent overlay-pass painters (paintSnapGlyph,
labels) start from a consistent state. paintSnapGlyph and
paintTransientLabel use their own save/restore so they don't disturb
the metric transform on exit; only paintPreview's internal nested
calls (it invokes paintTransientLabel inside, which resets to identity)
require the explicit re-application. Worth knowing for Phase 5+
painter additions: any painter that internally toggles transform
(via paintTransientLabel calls or its own setTransform) needs paint.ts
to re-apply the metric transform after.

**Polyline preview vertex snapshot.** The polyline previewBuilder
captures the current vertex chain at yield time via a `[...vertices]`
clone; the runner re-invokes the builder with new cursor values, but
the chain is frozen. New vertices push into the next yield's snapshot.
This is the closure-capture pattern from plan §1 step 5 / C14 applied
specifically to a multi-iteration loop — every iteration captures a
fresh snapshot, so the runner's single subscription handler always
sees the right chain.

### 13.3 — Phase 3 (2026-04-26)

**A15 plan-text inaccuracy: M1.3a never wired `resolveSnap` at click
time.** Plan §2 A15 states "Tools receive the snap-resolved metric on
mousedown via the snap output (not the raw cursor metric) — this is
the I-39 bit-copy pattern existing in M1.3a." Investigation in Phase
3 found that `resolveSnap` (`packages/editor-2d/src/snap/priority.ts`)
has zero callers in M1.3a — the snap engine is implemented and tested
but never invoked from the click handler. M1.3d Phase 3 closes this
gap by wiring `resolveSnap` into both the snap-on-cursor effect (for
the visible glyph) and `handleCanvasClick` (for the click-time
commit). The same `commitSnappedVertex` (M1.3a, `snap/commit.ts`)
performs the I-39 bit-copy. Net effect matches A15's promised
semantics; the gap was in the wiring, not the design.

**Snap kind names: code uses kebab-case (`'grid-node'`, `'grid-line'`)
not the plan's snake_case (`'grid_node'`, `'grid_line_fallback'`).**
The snap engine's `SnapHit['kind']` union (`packages/editor-2d/src/
snap/priority.ts`) defines `'grid-node' | 'grid-line' | 'cursor'`
plus the OSNAP kinds. The plan's Phase 3 step 1 uses `'grid_node'` /
`'grid_line_fallback'` (M1.3a doc-time naming). Phase 3 implementation
uses the actual code names. Gate DTP-3.2's grep
(`endpoint|midpoint|intersection|'node'|grid_node`) was widened in
the gate-results table to also accept `grid-node`. The plan body
isn't updated because the kind names are an implementation detail
of the snap engine; the rename of `'grid_line_fallback'` → `'grid-line'`
already happened in M1.3a, and forcing the plan's literal text
through code would just churn.

**Grid-line glyph degraded fallback.** The plan calls for a "small
tick perpendicular to the grid line at the foot of perpendicular
drop." The snap engine's `SnapHit` for `'grid-line'` carries only
the snap point, NOT the line direction (the line could be along the
grid's local X or Y axis, and at any rotation per `Grid.angle`).
Recovering the direction would require either (a) returning the line
hit's direction from `resolveSnap` (a snap engine API change beyond
Phase 3 scope), or (b) re-deriving from the nearest grid + the
perpendicular-foot math. M1.3d Phase 3 ships a degraded fallback:
an axis-aligned + tick smaller than the `'grid-node'` glyph so the
user can distinguish "fell on a node" from "fell on a line." Direction
fidelity can land in M1.3c when POLAR / OTRACK touch the snap engine
shape.

**`paintSnapGlyph` reads `canvas.snap_indicator`, NOT
`canvas.transient.*`.** Plan §1 Phase 3 step 1 explicitly directs the
glyph color to come from the existing M1.3a `canvas.snap_indicator`
token. The wider I-DTP-1 invariant says transient painters read SOLELY
from `canvas.transient.*`, but Gate DTP-T1's literal grep checks for
`layer\.color|effectiveColor.*layer` — `canvas.snap_indicator` is
canvas-level, not a layer color, so the gate passes. The two are
reconciled by treating "transient styling" as the per-namespace styling
chosen for transient overlays — the snap glyph reuses snap-indicator
because the snap glyph IS the snap indicator. No new
`canvas.transient.snap_glyph` token added.

### 13.2 — Phase 2 (2026-04-26)

**Gate DTP-T7's grep matches comments too — keep the forbidden symbol
out of canvas-host comments.** The Gate DTP-T7 grep
`"editorUiStore|\buseEditorUi\(|from ['\"]\.\./chrome/use-editor-ui-store['\"]"`
is a hard substring match on the source file with no comment-stripping
pass. My initial Phase 2 canvas-host.tsx doc-comments referenced
`editorUiStore` to explain WHY the file must not import it — those
comments themselves tripped the grep. Resolution: the comments now
talk about "the editor-ui store" (with the hyphen) and explicitly
note that even the symbol name is forbidden so future authors don't
re-introduce the trap. The discipline mirrors how Gate G3.1 works
(grep on raw source for layer color tokens in transient painters,
no comment carve-out).

**jsdom 25 `HTMLCanvasElement.getContext` THROWS instead of returning
null — `tests/setup.ts` shim doesn't install for it.** The shared
setup-file shim only installs its no-op `getContext` stub when
`getContext` is missing OR its `toString()` includes `'Not
implemented'`. jsdom 25's wrapper IS a real function and its toString
doesn't include that string, so the shim is skipped and `getContext`
calls report-exception via jsdom's not-implemented helper. Existing
smoke-e2e tests pass because their assertions don't depend on
`paint()` actually running — the rAF callback's `if (!ctx) return`
short-circuits silently. canvas-host.test.tsx tests, by contrast,
DO need `paint()` to run (so `getOverlay()` is invoked in the rAF
callback and we can assert on its call count). Resolution: install
a local `getContext` stub in canvas-host.test.tsx's `beforeEach` and
restore in `afterEach`, leaving the shared setup.ts untouched (less
disturbance to other suites). Future phases that need paint() to
actually run from a per-component test should follow the same
pattern; if more than two suites need it, refactor setup.ts to
unconditionally install the stub.

### 13.1 — Phase 1 (2026-04-26)

**Gate DTP-1.3 swap (mid-execution per §3.10, user ack 2026-04-26).** The
original gate command `rg -n "--canvas-transient" packages/design-system/
src/tokens/css-vars.ts` is unsatisfiable: `css-vars.ts` is a fully generic
recursive flattener (`flatten()` walks any token tree, kebab-cases keys,
emits string leaves) and contains zero token-specific literals. Every CSS
variable name is computed at runtime from the input tree. Phase 1 added
the `canvas.transient.*` sub-namespace to `dark` such that
`emitCSSVars(dark)` now produces `--canvas-transient-*` lines for every
leaf, but the literal string `--canvas-transient` does not (and should
not) appear in the emitter source. The gate was swapped to point at a
test-level assertion in `packages/design-system/tests/tokens.test.ts`
that calls `emitCSSVars(dark)` and `expect(output).toContain
('--canvas-transient-preview-stroke')` for sample leaves at each nesting
depth (root + nested object). The §8 Phase 1 gate text was updated
in-place. Plan invariants unchanged — only the verification command
shape changed.

**Forward-referenced types relocated for type-correctness.** The plan
defines `PreviewShape` in Phase 4 step 2 (in `tools/types.ts`) and
`Grip` in Phase 5 step 1 (in `canvas/grip-positions.ts`), but the
overlay slice in Phase 1 step 6 references both via `previewShape:
PreviewShape | null` and `grips: Grip[] | null`. To make Phase 1 type-
check, Phase 1 introduced both up-front:

- `PreviewShape` discriminated union → defined in
  `packages/editor-2d/src/tools/types.ts` verbatim per the Phase 4 step
  2 spec (8 arms: `'line'`, `'polyline'`, `'rectangle'`, `'circle'`,
  `'arc-2pt'`, `'arc-3pt'`, `'xline'`, `'selection-rect'`). Phase 4 step
  2 becomes a no-op confirmation; Phase 4 only adds `paintPreview.ts`
  and the runner cursor-subscription. No relocation of the SSOT.
- `Grip` and `TransientLabel` interfaces → defined in
  `packages/editor-2d/src/ui-state/store.ts` (the slice that owns these
  fields). Phase 5 step 1's `gripsOf(p): Grip[]` will import `Grip`
  from `../ui-state/store` instead of re-defining it. Phase 4's
  `paintTransientLabel` will import `TransientLabel` from the same
  location. Light relocation; SSOT is co-located with the slice.
- `SnapTarget` → type alias in `store.ts` for the existing
  `SnapHit` from `../snap/priority`. Re-uses the snap engine's return
  shape so the overlay carries the same record the resolver produces.
  Phase 3's paintSnapGlyph reads `snapTarget.point` (the existing
  `SnapHit` field name); the plan's Phase 3 step 2 prose mentions
  `snapTarget.target`, which is a doc inconsistency from plan-time vs
  M1.3a code. Phase 3 will use `.point` and note the prose deviation
  here when it lands.

**`Viewport.crosshairSizePct` field placement.** The plan stipulates
`editorUiStore.viewport.crosshairSizePct` (Phase 1 step 5; Phase 8 step
7; I-DTP-3 / I-DTP-18). Two compatible interpretations existed: extend
the `Viewport` interface in `view-transform.ts`, or add a sibling field
on `EditorUiState` next to `viewport`. Phase 1 chose the former so the
plan's literal access path holds. Trade-off acknowledged: `Viewport`
now mixes camera transform (pan/zoom/dpr/canvas-size) with a UI cursor
preference. Three test fixtures (`view-transform.test.ts`,
`hit-test.test.ts`, `snap.test.ts`) and the `createInitialEditorUiState`
default were updated to include `crosshairSizePct: 100`. If a future
M1.3c+ refactor moves UI-only fields off Viewport, both call-sites
(canvas-host CSS-style toggle, paintCrosshair) update together.

**Token storage convention — strings instead of `number[]`.** The plan
spec for transient tokens uses `number[]` for dash patterns
(`preview_dash: [6, 4]`) and `number` for paddings (`label_padding: 4`).
Phase 1 stored these as strings (`preview_dash: '6 4'`, `label_padding:
'4'`) to preserve the existing `SemanticTokens = Color = string` leaf
contract that `tokens.test.ts` validates ("emits exactly one declaration
per leaf token" counts only `typeof === 'string'` leaves). Painters
parse on consumption via small helpers (`parseDashPattern`,
`parseInt`) — this surface lands in Phase 4 (`paintTransientLabel.ts`,
`paintPreview.ts`). `docs/design-tokens.md` documents the convention
in the new "Transient overlay tokens" section.

**`crosshair_dash: 'solid'` sentinel for "no dashing".** The plan spec
treated an empty dash array (`[]`) as the "no dashing" representation,
which translated to `crosshair_dash: ''` in the string-storage scheme
above. That value trips the pre-existing `every SemanticTokens leaf has
a non-empty string value` assertion in `tokens.test.ts` (which guards
against accidentally-blank tokens). Resolution: use the literal
sentinel `'solid'` (one of CSS's standard `border-style` values, so it
reads naturally) and have Phase 8's `paintCrosshair` helper detect the
sentinel and skip `ctx.setLineDash`. The `TransientTokens.crosshair_dash`
field doc and the `docs/design-tokens.md` token table both record the
sentinel + the rationale.

---

## Plan Review Handoff

**Plan:** `docs/plans/feature/m1-3d-drafting-polish.md`
**Branch:** `feature/m1-3d-drafting-polish`
**Status:** Plan authored — awaiting review

### Paste to Codex for plan review
> Review this plan using the protocol at
> `docs/procedures/Codex/02-plan-review.md` (Procedure 02).
> Apply strict evidence mode. Start from Round 1.

### Paste to user for approval
> Please review the plan at
> `docs/plans/feature/m1-3d-drafting-polish.md` on branch
> `feature/m1-3d-drafting-polish`. After approval, invoke
> Procedure 03 to begin execution from Phase 1 (design tokens +
> ui-state extensions).
