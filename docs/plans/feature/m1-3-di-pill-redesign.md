# Plan — M1.3 Round 6: Dynamic Input pill redesign (AC-style transient-dimension-line + multi-field pills + Tab cycle)

**Branch:** `feature/m1-3-di-pill-redesign`
**Parent commits / context:**
- M1.3d shipped at `m1.3d` tag (`712b8f6` merge) — single-pill DI from M1.3d-Rem-4 G2 lives at `chrome/DynamicInputPill.tsx`.
- Post-merge fix `1aee6b6` — grip-stretch is click-sticky-click (relevant for grip-stretch's eventual DI manifest in M1.3b).
- AC reference: user screenshots in conversation history (rectangle W/H dim lines + pills, circle radius, line distance + angle arc).
- Mockup: `docs/round-6-mockup.html` shows minimal vs full visual options; user picked full.

**Author:** Claude (Opus 4.7, 1M context)
**Date:** 2026-04-28
**Operating mode:** Procedure 01 (PLAN-ONLY) → Procedure 03 (EXECUTION) after Codex review
**Status:** Plan authored — awaiting Codex Round-1 review

---

## Revision history

| Rev | Date | Driver | Changes |
|-----|------|--------|---------|
| Rev-0 | 2026-04-28 | Initial draft | Per-prompt Dynamic Input manifest; multi-pill chrome replacing single pill; new `paintDimensionGuides` painter (witness + dim lines + angle arcs); per-field input buffer slice with Tab focus cycling; first-pass migration of rectangle / line / polyline / circle. ADR-024 proposed for the manifest contract. §1.3 three-round audit. |

## 1. Request summary

Manual user testing of M1.3d-Rem-4's single-pill DI (single chrome pill at cursor showing `inputBuffer` OR `accumulator` OR `activePrompt`) surfaced AC-parity gaps:
- AC anchors **multiple** input pills at meaningful geometric positions (W on bottom edge, H on right edge, distance on the line itself, angle near an arc near the start point).
- Each pill is its **own focused input** with a caret; **Tab cycles** focus between pills.
- **Witness + dimension lines** connect geometry corners to the dim line + pill, giving the AC measured-dimension feel.
- **Angle arcs** show the polar reference (where 0° is) so the user knows what their typed angle is measured from.

Round 6 implements the AC-style design (the "full" option from the mockup, per user's `yes`). Scope is the **DI substrate + first-pass migration** of rectangle / line / polyline / circle. Modify operators (M1.3b) migrate as they ship.

## 2. Out of scope (deferred / not addressed in Round 6)

- **Modify operators (M1.3b — Rotate / Mirror / Scale / Trim / Extend / Break / Fillet / Chamfer / Offset / Array / Join / Explode / STRETCH / Match Properties).** They opt into DI manifests as M1.3b ships them.
- **POLAR / OTRACK / extended OSNAP modes (M1.3c).** Round 6's polar baseline (horizontal-right) is hardcoded; M1.3c adds configurable POLAR angle increments + OTRACK alignment lines.
- **Persisting per-field buffers across tool re-invocations.** Buffers cleared on tool start. AC's "previous value as default" UX could come later.
- **Customizable witness offsets / line styles.** Hardcoded constants (10 CSS-px offset, 1 CSS-px stroke). Design tokens come post-M1.
- **Hover-tooltip on pill / right-click context menu / dialog access from pill.** Out of scope.
- **Numeric input arity > 2 (e.g. an `XYZ` pair).** No M1.3d use case yet; can extend `combineAs: 'numberTuple'` when needed.

## 3. Assumptions and scope clarifications

User-confirmed in chat 2026-04-28:

- **A1 — Per-prompt DI manifest contract.** Tools yield prompts that may include an optional `dynamicInput: DynamicInputManifest` field declaring N input fields and how to combine them into a single Input on submit. Single-field manifests are valid (degenerate case for circle radius). Tools without the field continue to use the single-pill / legacy F1 mechanism unchanged.
- **A2 — Dimension-guide shape descriptors.** Each field declares an optional `dimensionGuide` describing the witness/dim-line or angle-arc graphic the painter should render. Three guide kinds in scope:
  - `linear-dim` — witness lines from two metric endpoints + dim line + arrow ticks (rectangle W, rectangle H, line distance via "leg-as-dim-line").
  - `angle-arc` — pivot + base angle + sweep + radius-px (line angle, polyline angle, future Rotate angle).
  - `radius-line` — pivot + endpoint, possibly tick markers (circle radius — note the radius line is already drawn by `paintPreview`'s circle arm, so this guide may be a no-op visual marker; decide at execution time).
- **A3 — Multi-pill chrome.** Existing `chrome/DynamicInputPill.tsx` (single pill at cursor) is **replaced** by `chrome/DynamicInputPills.tsx` (plural). The new component reads the active prompt's manifest from store, renders 0..N pills at metric-anchored positions (each `metricToScreen(anchor) + offset`), highlights the focused pill, shows a caret on the focused pill, and disappears when no manifest is active. Single-pill behavior (when prompt has no DI manifest but accumulator or inputBuffer is non-empty) still renders ONE pill at cursor as the degenerate case — same fallback as M1.3d-Rem-4 G2's pill.
- **A4 — Per-field input buffer.** New slice field `commandBar.dynamicInput: { activeFieldIdx: number; buffers: string[] } | null`. Null when no manifest is active; populated when the runner publishes a manifest. The existing single `inputBuffer` stays for non-DI paths (bottom command line typing, accumulator); `dynamicInput.buffers` is the parallel structure for DI prompts. Both can't be active simultaneously.
- **A5 — Tab focus cycling.** Keyboard router intercepts `Tab` at canvas focus AND bar focus when `commandBar.dynamicInput !== null`. Tab cycles `activeFieldIdx` modulo `buffers.length`. Shift+Tab cycles backwards. Tab pass-through to native browser behavior when no manifest is active (preserves keyboard accessibility for chrome regions).
- **A6 — Numeric routing while DI is active.** Numeric / punctuation keys (`0-9`, `.`, `-`, `,`) at canvas focus when DI is active append to `dynamicInput.buffers[activeFieldIdx]` (NOT the legacy single `inputBuffer`). Backspace pops from that field's buffer. Esc clears all DI field buffers. Enter / Space combines all field buffers via the manifest's `combineAs` policy and feeds a single Input to the runner.
- **A7 — `combineAs` policies.** First-pass set:
  - `'numberPair'` → `{kind: 'numberPair', a: parsed[0], b: parsed[1]}`. Used by rectangle's W,H. Already exists from M1.3d-Rem-5 H1 — direct reuse.
  - `'point'` → polar conversion: given `[distance, angle]`, compute `{kind: 'point', point: anchor + (cos(angle) * distance, sin(angle) * distance)}` where anchor is the field's metricAnchor or the prompt's `directDistanceFrom`. Used by line/polyline second-point with both fields filled.
  - `'number'` → single field `{kind: 'number', value: parsed[0]}`. Used by circle radius and any single-field manifest.
  - Future: `'numberTuple'`, `'angle'` — add when needed; not in this round.
- **A8 — F1 directDistanceFrom interplay.** F1 (typing a single number into the bottom command line for line/polyline/circle/arc to interpret as polar distance from anchor) STAYS unchanged. It's the single-field shortcut path. The new DI manifest is the multi-field enhanced path. When a tool yields a prompt with BOTH `directDistanceFrom` and a `dynamicInput` manifest, both work — bar-form Enter triggers F1; per-field DI Enter triggers the manifest's combineAs path. Bottom command line and DI pills are alternate surfaces for the same inputBuffer concept; on submit, whichever path the user used wins.
- **A9 — Per-tool migration scope (first-pass).** Four tools migrate in this round:
  1. **draw-rectangle.ts** — second-corner prompt grows `dynamicInput` manifest with two `linear-dim` fields (W on bottom edge, H on right edge), `combineAs: 'numberPair'`. Existing F3 Dimensions sub-flow's single `numberPair` prompt could ALSO get a manifest if helpful, but the natural primary flow is the second-corner-with-DI rather than the explicit Dimensions sub-option. Decide at execution time which prompt(s) get the manifest.
  2. **draw-line.ts** — second-point prompt grows manifest with two fields: distance (`linear-dim` along the rubber-band leg) + angle (`angle-arc` from horizontal-right at p1), `combineAs: 'point'`. Existing F1 directDistanceFrom anchor stays.
  3. **draw-polyline.ts** — same as draw-line on each loop iteration. Anchor for both = `verticesSnapshot[verticesSnapshot.length - 1]`.
  4. **draw-circle.ts** — radius prompt grows manifest with one field: radius (`radius-line` from center to current cursor), `combineAs: 'number'` (the value is the radius scalar; tool computes the edge point). Existing F1 directDistanceFrom anchor (`ctr`) stays.
- **A10 — Existing tools NOT migrated this round.** draw-arc (two prompts; manifest design needs separate thinking on radius vs sweep — defer), draw-rectangle's first-corner prompt (no useful dimensions to declare yet), move/copy (have F4 modified-entities preview but no typed numerics — typed-distance offset comes with M1.3b STRETCH or a future enhancement), select-rect (drag-style; doesn't match the typed-input model).
- **A11 — Substrate-first migration philosophy.** Substrate (manifest types + painter + chrome + buffer slice + router updates) lands in one phase; per-tool migration is a separate phase that opts each tool in. This minimizes the risk of breaking existing tools while substrate develops.
- **A12 — ADR placement.** Two options: (a) extend ADR-023 in place with an "Extension: dynamic input manifest (M1.3-Round-6)" subsection; (b) spin ADR-024 "Dynamic Input manifest contract" superseding the relevant sub-section of ADR-023. **Recommendation: (b) — new ADR-024**. The manifest is a substantive contract addition with its own invariants; cleaner to separate. Decide at execution time if Codex has a strong preference; the plan's §5 lists both as candidates.

## 4. Scope

### 4.1 In scope — files modified

| Path | Change |
|---|---|
| `packages/editor-2d/src/tools/types.ts` | Add `DynamicInputManifest`, `DynamicInputField`, `DimensionGuide` types. Add optional `Prompt.dynamicInput?: DynamicInputManifest`. No change to existing `Input` arms (numberPair / point / number already exist). |
| `packages/editor-2d/src/ui-state/store.ts` | Add `commandBar.dynamicInput: { activeFieldIdx: number; buffers: string[] } \| null` slice field. New actions: `setDynamicInputManifest(state)`, `setDynamicInputActiveField(idx)`, `setDynamicInputFieldBuffer(idx, value)`, `clearDynamicInput()`. Existing `inputBuffer` field unchanged. |
| `packages/editor-2d/src/ui-state/store.ts` | Add `overlay.dimensionGuides: DimensionGuide[] \| null` (mirrors the active prompt's manifest fields' guides for the painter to render). New action `setDimensionGuides`. |
| `packages/editor-2d/src/tools/runner.ts` | When yielded prompt has `dynamicInput`, also publish to the slice + the overlay.dimensionGuides. On tool teardown, clear both. Adds 1 setter call per prompt with manifest. |
| `packages/editor-2d/src/keyboard/router.ts` | Tab handler: at canvas/bar focus when `commandBar.dynamicInput !== null`, intercept `Tab` (preventDefault) + cycle `activeFieldIdx`. Shift+Tab cycles backward. Numeric routing branch (existing G2) updates: when DI is active, route to `dynamicInput.buffers[activeFieldIdx]` instead of `inputBuffer`. Backspace branch updates similarly. Enter branch updates: when DI is active, combine field buffers via manifest's combineAs and feed via a new callback `onSubmitDynamicInput(manifest, buffers)`. Esc clears DI buffers (in addition to existing accumulator/inputBuffer clear). |
| `packages/editor-2d/src/EditorRoot.tsx` | New callback `onSubmitDynamicInput` impl: parses each buffer per its field's `kind`, applies manifest's `combineAs` to produce an Input, feeds to runner. |
| `packages/editor-2d/src/canvas/painters/paintDimensionGuides.ts` | NEW. Reads `overlay.dimensionGuides`. Per-shape painter:<br>- `linear-dim`: two witness lines (perpendicular off the measured segment, screen-px offset converted to metric); dim line connecting them at the offset distance; arrow ticks at each end.<br>- `angle-arc`: arc centered at `pivot` from `baseAngleRad` sweeping `sweepAngleRad` at radius `radiusPx` (screen-space radius converted to metric).<br>- `radius-line`: small tick marker at midpoint or no-op if circle preview already draws it. |
| `packages/editor-2d/src/canvas/paint.ts` | Dispatch `paintDimensionGuides` during the overlay pass after `paintPreview` (so dim guides paint on top of the rubber-band geometry). |
| `packages/editor-2d/src/chrome/DynamicInputPill.tsx` | DELETE (replaced by `DynamicInputPills.tsx`). |
| `packages/editor-2d/src/chrome/DynamicInputPill.module.css` | DELETE or rename to `DynamicInputPills.module.css`. |
| `packages/editor-2d/src/chrome/DynamicInputPills.tsx` | NEW. Reads `commandBar.dynamicInput`, `overlay.cursor`, `commandBar.activePrompt`, `commandBar.accumulator`, `commandBar.inputBuffer`, `toggles.dynamicInput`. Renders:<br>- 0 pills if `toggles.dynamicInput` is false OR no manifest AND no accumulator/inputBuffer/prompt to fall back on.<br>- 1 fallback pill at `cursor.screen + offset` if no manifest but accumulator / inputBuffer / prompt exists (preserves M1.3d-Rem-4 G2 behavior for non-DI prompts).<br>- N pills if a manifest is active, each at `metricToScreen(field.metricAnchor) + screen-offset` derived from the field's dimensionGuide (e.g., perpendicular off the measured axis for linear-dim; on the arc for angle-arc; on the radius line for radius-line). Focused pill has yellow glow + caret. |
| `packages/editor-2d/src/chrome/DynamicInputPills.module.css` | NEW. `.pill` (existing styles), `.pillFocused` (glow), `.pillCaret` (animated caret), `.pillLabel` (small dim prefix like "W:"). |
| `packages/editor-2d/src/EditorRoot.tsx` | Import `DynamicInputPills` instead of `DynamicInputPill`. Update mount site. |
| `packages/editor-2d/src/tools/draw/draw-rectangle.ts` | Second-corner prompt grows `dynamicInput` manifest with two `linear-dim` fields. The rubber-band rectangle's metric corners feed the witness anchor points. `combineAs: 'numberPair'`. |
| `packages/editor-2d/src/tools/draw/draw-line.ts` | Second-point prompt grows manifest with two fields: distance (linear-dim along the leg p1→cursor) + angle (angle-arc at p1, base = horizontal-right, sweep = leg angle). `combineAs: 'point'` (polar conversion). |
| `packages/editor-2d/src/tools/draw/draw-polyline.ts` | Each loop's prompt grows the same manifest as draw-line, anchor = last vertex. |
| `packages/editor-2d/src/tools/draw/draw-circle.ts` | Radius prompt grows manifest with one `radius-line` field. `combineAs: 'number'` (scalar = radius). |
| `packages/editor-2d/tests/types.test.ts` *(if exists)* | New tests for `DynamicInputManifest` / `DynamicInputField` / `DimensionGuide` shapes. |
| `packages/editor-2d/tests/ui-state.test.ts` | New tests for `commandBar.dynamicInput` slice + actions; `overlay.dimensionGuides` slice + setter. |
| `packages/editor-2d/tests/tool-runner.test.ts` | Test that a prompt with `dynamicInput` publishes to the slice + clears on teardown. |
| `packages/editor-2d/tests/keyboard-router.test.ts` | Tab cycles `activeFieldIdx`; Shift+Tab cycles backward; numeric / Backspace / Enter route to active field; Esc clears DI buffers. |
| `packages/editor-2d/tests/draw-tools.test.ts` | Per-tool generator tests assert the new prompts yield manifests with the right shape (rectangle: 2 linear-dim fields, combineAs numberPair; line: 1 linear-dim + 1 angle-arc, combineAs point; etc.). |
| `packages/editor-2d/tests/DynamicInputPill.test.tsx` | DELETE (replaced by DynamicInputPills.test.tsx). |
| `packages/editor-2d/tests/DynamicInputPills.test.tsx` | NEW. Component tests: visibility (toggle off; no manifest; etc.); fallback single-pill at cursor; multi-pill rendering at metric anchors; focused pill has glow + caret; pill label shown; pill hides when manifest cleared. |
| `packages/editor-2d/tests/paintDimensionGuides.test.ts` | NEW. Per-shape: linear-dim emits witness + dim line + arrow ticks; angle-arc emits ctx.arc with right pivot/radii; radius-line emits a tick (or no-op if integrated with paintPreview's circle). |
| `packages/editor-2d/tests/smoke-e2e.test.tsx` | New scenarios: (1) `'rectangle DI: type 6 Tab 4 Enter commits 6×4'` (full pill flow); (2) `'line DI: type 5 Tab 30 Enter commits a 5m line at 30°'` (polar conversion); (3) `'circle DI: type 7 Enter commits a radius-7 circle'` (single-field). Existing 'rectangle Dimensions: typed "30,40" + Enter commits W=30 H=40' from M1.3d-Rem-5 keeps working through F3 sub-option; the new scenario tests the primary flow. |
| `docs/operator-shortcuts.md` | Minor bump 2.0.0 → 2.1.0 — add Tab as a DI-cycling key when DI is active. New row in M1.3a section. Behavior notes update describing multi-field DI. |
| `docs/adr/024-dynamic-input-manifest.md` | NEW — proposed. ADR-024 documenting the per-prompt DI manifest contract, the four field-kind shapes, the painter dispatch model, the per-field buffer model, and the Tab-cycling focus invariant. Supersedes the relevant sub-section of ADR-023. |
| `docs/adr/023-tool-state-machine-and-command-bar.md` | Note pointing at ADR-024 for the DI extension. |

### 4.2 In scope — files created

- `packages/editor-2d/src/canvas/painters/paintDimensionGuides.ts`
- `packages/editor-2d/src/chrome/DynamicInputPills.tsx` + `.module.css`
- `packages/editor-2d/tests/DynamicInputPills.test.tsx`
- `packages/editor-2d/tests/paintDimensionGuides.test.ts`
- `docs/adr/024-dynamic-input-manifest.md`

### 4.3 Files deleted

- `packages/editor-2d/src/chrome/DynamicInputPill.tsx`
- `packages/editor-2d/src/chrome/DynamicInputPill.module.css`
- `packages/editor-2d/tests/DynamicInputPill.test.tsx`

### 4.4 Out of scope (deferred)

- Modify operators (M1.3b)
- POLAR / OTRACK angle increments (M1.3c)
- Customizable witness offsets / line styles (post-M1)
- Persisting buffers across tool re-invocations
- `numberTuple` arity > 2

### 4.5 Blast radius

- **Packages affected:** `editor-2d` only. No domain / project-store / design-system changes.
- **Cross-cutting hard gates affected:** none — DTP-T1/T2/T6/T7 stay clean. New painter `paintDimensionGuides` MUST NOT call `ctx.fillText / strokeText` (DTP-T2), MUST NOT import projectStore (DTP-T6 — needs new gate to extend the DTP-T6 list to include the new painter).
- **Stored data:** none. UI-state-only extensions.
- **UI surfaces affected:** chrome (multi-pill), canvas overlay (new painter), keyboard router (Tab + per-field routing), bottom command line behavior unchanged (legacy path stays).
- **ADRs:** ADR-023 noted; ADR-024 created.
- **Tests rework volume:** medium. ~15 new tests + ~5 migrated.

## 5. Architecture doc impact

| Doc | Change |
|---|---|
| `docs/adr/024-dynamic-input-manifest.md` | NEW. Per-prompt DI manifest contract; field-kind shapes (linear-dim, angle-arc, radius-line); painter dispatch model; per-field buffer model; Tab-cycling focus invariant; combineAs policy registry. |
| `docs/adr/023-tool-state-machine-and-command-bar.md` | Add a brief "Extended in ADR-024 for multi-field dynamic input" note in the relevant section. No behavior change in ADR-023 itself. |
| `docs/operator-shortcuts.md` | Minor bump 2.0.0 → 2.1.0. Add `Tab` row to M1.3a section: cycles focus between DI fields when DI is active; pass-through otherwise. Behavior notes section gets a new paragraph documenting multi-field DI. |
| All other binding spec docs | No change. |

## 6. Deviations from binding specifications (§0.7)

**None proposed.** ADR-024 is a NEW ADR (additive); ADR-023 gets a cross-reference note. The Prompt contract grows an optional field; existing tools that don't use it are unaffected. The operator-shortcuts.md bump is per-governance (Tab is a new shortcut → minor bump).

## 7. Implementation phases

Two phases: **Phase 1 — Substrate** lands the types + painter + chrome + slice + router updates. **Phase 2 — Per-tool migration** opts each of the four tools into the manifest. This minimizes risk: substrate is testable in isolation; each tool migration is incremental.

### Phase 1 — Substrate

#### Phase 1 Goal
Land the per-prompt DI manifest contract, the multi-pill chrome, the `paintDimensionGuides` painter, and the keyboard router updates. After this phase, no tool yet declares a manifest; existing tools continue using the legacy single-pill / F1 path.

#### Phase 1 Steps
1. Add `DynamicInputManifest`, `DynamicInputField`, `DimensionGuide` types to `tools/types.ts`. Add optional `Prompt.dynamicInput?: DynamicInputManifest`.
2. Add slice fields + actions in `ui-state/store.ts`: `commandBar.dynamicInput`, `overlay.dimensionGuides`. Update `createInitialEditorUiState` defaults to null.
3. Update `tools/runner.ts`: when yielded prompt has `dynamicInput`, call `setDynamicInputManifest` + `setDimensionGuides` based on the manifest. On tool teardown, call `clearDynamicInput` + `setDimensionGuides(null)`.
4. Create `paintDimensionGuides.ts` with the per-shape switch dispatcher. Implement `linear-dim` (witness + dim line + ticks), `angle-arc` (ctx.arc with screen-px radius converted to metric), `radius-line` (single tick or no-op).
5. Add `paintDimensionGuides` dispatch in `paint.ts` overlay pass (after `paintPreview`).
6. Replace `DynamicInputPill.tsx` with `DynamicInputPills.tsx`. Multi-pill rendering with metric-anchored positioning; fallback single-pill behavior preserved when no manifest active.
7. Update `EditorRoot.tsx` import + mount.
8. Update `keyboard/router.ts`:
   - Tab branch: at canvas/bar focus + DI active → preventDefault, cycle `activeFieldIdx` (Shift+Tab cycles backward).
   - Numeric / Backspace branches: when DI active, route to `dynamicInput.buffers[activeFieldIdx]`; otherwise existing path to `inputBuffer`.
   - Enter / Space branches: when DI active, combine via manifest's `combineAs` and feed via `onSubmitDynamicInput` callback.
   - Esc branch: clear DI buffers in addition to existing.
9. Add `onSubmitDynamicInput: (manifest, buffers) => void` to `KeyboardRouterCallbacks`.
10. Implement `onSubmitDynamicInput` in `EditorRoot.tsx`: parse each buffer per its field's `kind`; apply `combineAs`; feed Input; clear DI buffers.
11. Tests for substrate: types, slice, runner publish, painter per-shape, multi-pill component.

#### Phase 1 Mandatory Completion Gates
```
Gate REM6-P1-Types: DynamicInputManifest declared in types.ts
  Command: rg -n "DynamicInputManifest" packages/editor-2d/src/tools/types.ts
  Expected: ≥2 matches (interface declaration + Prompt.dynamicInput field reference)

Gate REM6-P1-Slice: commandBar.dynamicInput slice field
  Command: rg -n "dynamicInput" packages/editor-2d/src/ui-state/store.ts
  Expected: ≥6 matches (interface + default + 4 actions: setDynamicInputManifest, setDynamicInputActiveField, setDynamicInputFieldBuffer, clearDynamicInput)

Gate REM6-P1-OverlayGuides: overlay.dimensionGuides slice field
  Command: rg -n "dimensionGuides" packages/editor-2d/src/ui-state/store.ts
  Expected: ≥3 matches (interface field + default + setter)

Gate REM6-P1-Painter: paintDimensionGuides exists + dispatches by shape kind
  Commands:
    (a) ls packages/editor-2d/src/canvas/painters/paintDimensionGuides.ts
        Expected: file exists
    (b) rg -n "'linear-dim'|'angle-arc'|'radius-line'" packages/editor-2d/src/canvas/painters/paintDimensionGuides.ts
        Expected: ≥3 matches (one per shape kind in the dispatch switch)
    (c) rg -n "paintDimensionGuides" packages/editor-2d/src/canvas/paint.ts
        Expected: ≥1 match (mounted in the overlay pass)

Gate REM6-P1-Pills: DynamicInputPills component file + mount
  Commands:
    (a) ls packages/editor-2d/src/chrome/DynamicInputPills.tsx
        Expected: file exists
    (b) ! ls packages/editor-2d/src/chrome/DynamicInputPill.tsx 2>/dev/null
        Expected: file does NOT exist (singular variant deleted)
    (c) rg -n "DynamicInputPills" packages/editor-2d/src/EditorRoot.tsx
        Expected: ≥2 matches (import + JSX usage)

Gate REM6-P1-Router-Tab: Tab handler routes to DI when active
  Command: rg -A 6 -n "key === 'Tab'" packages/editor-2d/src/keyboard/router.ts
  Expected: ≥1 match (Tab handler exists; uses activeFieldIdx)

Gate REM6-P1-Router-Submit: onSubmitDynamicInput callback wired
  Command: rg -n "onSubmitDynamicInput" packages/editor-2d/src/keyboard/router.ts packages/editor-2d/src/EditorRoot.tsx
  Expected: ≥3 matches (callback type + router invocation + EditorRoot impl)
```

### Phase 2 — Per-tool migration (rectangle, line, polyline, circle)

#### Phase 2 Goal
Migrate the four primary draw tools to declare DI manifests on their relevant prompts. After this phase, the user sees AC-style multi-field DI when drawing these primitives.

#### Phase 2 Steps
12. Migrate `draw-rectangle.ts`'s second-corner prompt — manifest with two `linear-dim` fields (W on bottom edge midpoint metric anchor, H on right edge midpoint), `combineAs: 'numberPair'`. The width and height field kind is `'number'`. The witness anchor metric points = the rectangle's two corners; the painter computes the dim line offset.
13. Migrate `draw-line.ts`'s second-point prompt — manifest with two fields:
    - distance: kind `'distance'`, `linear-dim` along the leg from p1 to cursor, anchor = midpoint of leg (computed dynamically per cursor frame).
    - angle: kind `'angle'`, `angle-arc` at p1, base angle = 0 (horizontal-right), sweep angle = current leg angle.
    - `combineAs: 'point'` (polar: point = p1 + (cos(angle) × distance, sin(angle) × distance)).
14. Migrate `draw-polyline.ts` — same as draw-line on each loop; anchor = `verticesSnapshot[verticesSnapshot.length - 1]`.
15. Migrate `draw-circle.ts`'s radius prompt — manifest with one field: radius (kind `'distance'`, `radius-line` from `ctr` to cursor, anchor = midpoint of radius line). `combineAs: 'number'`.
16. Update tool tests to assert each tool yields the expected manifest shape on the relevant prompt.
17. Add 3 new smoke-e2e scenarios:
    - `'rectangle DI: type 6 Tab 4 Enter commits 6×4'` (focuses W, types 6, Tab, types 4, Enter, asserts rectangle of 6×4)
    - `'line DI: type 5 Tab 30 Enter commits a 5m line at 30°'` (polar)
    - `'circle DI: type 7 Enter commits a radius-7 circle'` (single-field, no Tab)

#### Phase 2 Mandatory Completion Gates
```
Gate REM6-P2-Rectangle: draw-rectangle yields linear-dim manifest
  Command: rg -A 20 -n "Specify opposite corner" packages/editor-2d/src/tools/draw/draw-rectangle.ts | rg "dynamicInput|linear-dim|combineAs"
  Expected: ≥1 match

Gate REM6-P2-Line: draw-line yields manifest with distance + angle fields
  Command: rg -A 25 -n "Specify end point" packages/editor-2d/src/tools/draw/draw-line.ts | rg "dynamicInput|angle-arc|combineAs"
  Expected: ≥1 match

Gate REM6-P2-Polyline: draw-polyline yields manifest per loop
  Command: rg -A 25 -n "Specify next point" packages/editor-2d/src/tools/draw/draw-polyline.ts | rg "dynamicInput"
  Expected: ≥1 match

Gate REM6-P2-Circle: draw-circle yields radius-line manifest
  Command: rg -A 15 -n "Specify radius" packages/editor-2d/src/tools/draw/draw-circle.ts | rg "dynamicInput|radius-line"
  Expected: ≥1 match

Gate REM6-P2-Smoke: 3 new smoke scenarios in SCENARIOS const + matching it() blocks
  Command: rg -n "'rectangle DI:|'line DI:|'circle DI:" packages/editor-2d/tests/smoke-e2e.test.tsx
  Expected: ≥6 matches (each scenario name appears twice: SCENARIOS const + it() title)
```

### Cross-phase gates

```
Gate REM6-9: Targeted test files pass
  Command: pnpm --filter @portplanner/editor-2d test -- tests/types tests/ui-state tests/tool-runner tests/keyboard-router tests/DynamicInputPills tests/paintDimensionGuides tests/draw-tools tests/smoke-e2e
  Expected: passes; new substrate + per-tool tests + 3 new smoke scenarios all green

Gate REM6-10: Workspace test suite passes
  Command: pnpm test
  Expected: all 6 packages pass; total ≥ 480 (post-Round-5 baseline 470 + ~10-15 net-new across substrate + per-tool + smoke).

Gate REM6-11: Cross-cutting hard gates clean (DTP-T1/T2/T6/T7)
  Commands:
    (a) DTP-T1 — no painter reads layer.color directly:
        rg -l "layer\.color|effectiveColor.*layer" \
          packages/editor-2d/src/canvas/painters/paint{Preview,SnapGlyph,Selection,SelectionRect,TransientLabel,HoverHighlight,Crosshair,DimensionGuides}.ts
        Expected: 0 files match.
        Note: brace list extended to include the new paintDimensionGuides.ts.
    (b) DTP-T2 — no painter calls ctx.fillText / strokeText except paintTransientLabel + paintGrid (paintDimensionGuides MUST NOT either):
        rg -l "ctx\.fillText|ctx\.strokeText" packages/editor-2d/src/canvas/painters/*.ts | rg -v "paintTransientLabel\.ts$|paintGrid\.ts$"
        Expected: 0 files match.
    (c) DTP-T6 — painters MUST NOT import @portplanner/project-store. Existing gate scopes paintPreview only; extending here:
        rg -n "from '@portplanner/project-store'" packages/editor-2d/src/canvas/painters/paintPreview.ts packages/editor-2d/src/canvas/painters/paintDimensionGuides.ts
        Expected: 0 matches.
    (d) DTP-T7 — canvas-host MUST NOT subscribe to editorUiStore / useEditorUi:
        rg -n "editorUiStore|\buseEditorUi\(|from ['\"]\.\./chrome/use-editor-ui-store['\"]" packages/editor-2d/src/canvas/canvas-host.tsx
        Expected: 0 matches.

Gate REM6-12: Typecheck + Biome + build
  Commands: pnpm typecheck, pnpm check, pnpm build
  Expected: all exit 0

Gate REM6-SPEC: docs/operator-shortcuts.md + ADR-024 updates
  Commands:
    (a) rg -n "^\*\*Version:\*\* 2\.1\.0" docs/operator-shortcuts.md
        Expected: 1 match (header bumped to 2.1.0)
    (b) rg -n "^\| 2\.1\.0 " docs/operator-shortcuts.md
        Expected: 1 match (changelog row for 2.1.0 present)
    (c) rg -n "Tab" docs/operator-shortcuts.md
        Expected: ≥1 match (new Tab row in M1.3a section + behavior note)
    (d) ls docs/adr/024-dynamic-input-manifest.md
        Expected: file exists
```

## 8. Done Criteria — objective pass/fail

- [ ] **Substrate** — DynamicInputManifest type + slice + painter + chrome + router updates landed. Verified by REM6-P1 gates.
- [ ] **Rectangle migration** — second-corner prompt yields W,H linear-dim manifest; user sees both pills + dim lines; Tab cycles. Verified by REM6-P2-Rectangle + REM6-P2-Smoke (`'rectangle DI: type 6 Tab 4 Enter'`).
- [ ] **Line migration** — second-point prompt yields distance + angle-arc manifest; polar conversion on submit. Verified by REM6-P2-Line + smoke.
- [ ] **Polyline migration** — same on each loop. Verified by REM6-P2-Polyline.
- [ ] **Circle migration** — radius single-field. Verified by REM6-P2-Circle + smoke.
- [ ] **Binding spec docs updated** — operator-shortcuts.md 2.0.0 → 2.1.0; ADR-024 created. Verified by REM6-SPEC (a + b + c + d).
- [ ] All Phase REM6-P1 + REM6-P2 + REM6-9..REM6-12 gates pass.
- [ ] Cross-cutting hard gates DTP-T1 / T2 / T6 / T7 pass with the extended painter list. Verified by REM6-11.
- [ ] **Workspace test count** ≥ 480 (post-Round-5 baseline 470 + ≥10 net-new). REM6-10 provides the threshold.
- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build` all pass (Gate REM6-12).

## 9. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Per-field buffer model collides with the existing single inputBuffer | Two separate slice fields. Existing `inputBuffer` stays for non-DI prompts (bottom command line accumulator/typing). New `commandBar.dynamicInput` is opt-in via prompt manifest. Tools without manifest unchanged. |
| Painter math for witness/dim line endpoints (perpendicular offset, screen-space stroke) is fiddly | Reuse `paintTransientLabel`'s screen-offset → metric pattern; that helper is battle-tested across M1.3d. New painter follows the same conventions. |
| Tab focus across N pills could clash with browser focus in other contexts | Tab intercepted ONLY when `commandBar.dynamicInput !== null`. Otherwise pass-through to native browser behavior — keyboard accessibility for chrome regions (panels, dialog buttons) preserved. |
| Keyboard router complexity grows with the new DI branches | Branch order tightly specified in §7 step 8. Tests exercise every branch. The existing AC-mode accumulator + G2 numeric routing patterns are extended additively, not replaced. |
| Painter's screen-px stroke / arc-radius conversion: existing `paintTransientLabel` uses `STROKE_WIDTH_CSS / (zoom * dpr)` which has been stable since M1.3a. New painter follows the same recipe; angle-arc radius likewise (e.g., `40 / (zoom * dpr)` for a 40 CSS-px radius). | Pattern is tested and well-understood; tests assert `ctx.arc(...)` is called with the expected metric radius given a specific viewport. |
| `combineAs: 'point'` (polar) needs an anchor — distance is FROM where? | The manifest's polar combineAs computes from the line's `directDistanceFrom` anchor (or equivalent — polyline's last vertex). Documented in ADR-024 §combineAs. Tests assert the polar conversion math. |
| Per-tool migration is N tools × M prompts × test updates | Phase 2 is sequential: rectangle → line → polyline → circle. Each ~50 LOC + ~20 LOC tests. Roughly 1 day per tool. |
| Pill rendering at metric-anchored positions during pan/zoom | Pills re-render on every cursor-effect or viewport change (existing pill already does this). The `metricToScreen` conversion is cheap; React's transform-style updates are negligible. |
| ADR-024 is new — risk of architectural disagreement at Codex review | Plan §5 explicitly proposes ADR-024 as a NEW ADR with all the contracts; if Codex prefers extending ADR-023 instead, that's a Procedure-01-revision item. Pre-empt by being clear in the plan that this is a SUBSTANTIVE contract addition deserving of its own ADR. |
| Mockup HTML at `docs/round-6-mockup.html` is a static reference — kept or deleted? | Keep. It's a useful design artifact for future readers. Could be moved to `docs/design-mockups/round-6-di-pill.html` for cleaner organization. |
| Existing F1 directDistanceFrom path in `EditorRoot.handleCommandSubmit` interacts with the new DI submit path | F1 stays for the BOTTOM COMMAND LINE typing path (single number → polar via anchor). The new DI submit path is for typing into the per-field pills at canvas focus. Both eventually feed an Input. They don't both fire on the same Enter — keyboard router branches by which surface the user typed in (canvas focus + DI active → onSubmitDynamicInput; bar focus form submit → handleCommandSubmit which still does F1). |

## 10. §1.3 Three-round self-audit

### Round 1 — Chief Architect (boundaries, invariants, SSOT)

- **C1.1 — Per-prompt manifest declared on the Prompt contract: SSOT or contract bloat?** SSOT. The Prompt is the natural carrier — a tool's per-prompt input semantics include "what fields the DI should display". Alternative (a separate parallel registry mapping tool-id × prompt-text → manifest) would split SSOT. Co-locating is right.
- **C1.2 — `combineAs` policies: enum vs callback?** Enum (for now). Callbacks-on-prompts would let tools provide arbitrary combinator functions, but adds complexity. Enum-with-fixed-set covers M1.3d's needs (numberPair, point, number); future arities extend the enum (numberTuple, angle). YAGNI on callbacks.
- **C1.3 — `overlay.dimensionGuides` vs deriving from `commandBar.dynamicInput`?** Two-slice model: manifest declares fields with their guide shapes; runner publishes the manifest to commandBar AND the guide shapes (extracted from each field) to overlay.dimensionGuides. The painter ONLY reads overlay (consistent with other painters per I-DTP-9 / DTP-T6). The pill component reads commandBar (chrome-side). Boundary preserved.
- **C1.4 — Single fallback pill (no manifest, but accumulator/inputBuffer non-empty) — keep or drop?** Keep. The legacy DynamicInputPill behavior must survive for non-DI prompts (simple letter shortcuts, single-number inputs at the bottom command line). The new DynamicInputPills component handles 0..N pills uniformly: 0 = hidden; 1 with no manifest = legacy fallback; N with manifest = new behavior.
- **C1.5 — ADR placement (extend ADR-023 vs new ADR-024)?** New ADR-024. The DI manifest is a substantive contract addition with its own invariants (per-field buffer mutual exclusion with single inputBuffer, Tab focus invariant, painter dispatch model). Cleaner separation; ADR-023 stays focused on the tool runner + command bar core.

### Round 2 — Sceptical Reader (what would Codex flag?)

- **C2.1 — `numberPair` already exists from M1.3d-Rem-5 H1; is the manifest re-using it correctly?** Yes. The rectangle's existing F3 D Dimensions sub-flow yields a prompt with `acceptedInputKinds: ['numberPair']` and the parser path is unchanged. The new manifest for the rectangle's primary second-corner prompt adds DI graphics (witness lines + pills) on top — but the Input that lands in the runner is still `{kind: 'numberPair', a, b}`. SSOT.
- **C2.2 — Tab focus interception risk: form inputs in Layer Manager dialog could need Tab.** The router checks `commandBar.dynamicInput !== null` before intercepting. When no DI is active, Tab is not intercepted; the dialog's native Tab handling works. Only intercepted at canvas/bar focus + DI active.
- **C2.3 — Pill positioning during pan/zoom: any flicker?** Pills re-render on every overlay change (existing). The `metricToScreen` conversion is in JS; React's `transform: translate(...)` updates are GPU-accelerated. No flicker observed in M1.3d-Rem-4's single-pill pan/zoom; multi-pill is the same pattern × N.
- **C2.4 — `paintDimensionGuides` painter must NOT call `ctx.fillText` / `strokeText`.** Witness lines + dim lines + arrow ticks + arcs are pure-vector. Pill TEXT is in DOM (chrome). Gate REM6-11(b) enforces.
- **C2.5 — Per-tool migration overlap with existing F1 directDistanceFrom.** F1's `Prompt.directDistanceFrom` field stays. The DI manifest's distance field uses the same anchor under the hood. Tools declare both: directDistanceFrom (for bottom command line F1) AND dynamicInput.fields[distance].metricAnchor (for the canvas-focus DI). Same anchor, two surfaces, one Input.
- **C2.6 — Test count math.** Net-new ≈ 12-15. Substrate: ~6 (types ×1, slice ×3, runner ×1, painter ×3 per shape, multi-pill component ×4, router ×2). Per-tool: ~4 (one manifest-shape assertion per tool). Smoke: ~3. Total: ~12-13. Threshold ≥480 (470 + ≥10).
- **C2.7 — `commandBar.activePrompt` already exists; is the new `commandBar.dynamicInput` redundant?** No. activePrompt is the prompt's TEXT (string). dynamicInput is the structured per-field state (active idx + N buffers). They're orthogonal.

### Round 3 — Blast Radius (what could break elsewhere?)

- **C3.1 — DynamicInputPill (singular) deletion: any external consumer?** Search: only EditorRoot.tsx imports it. After replacement, no orphans. Tests directly named DynamicInputPill.test.tsx → renamed to DynamicInputPills.test.tsx.
- **C3.2 — Existing M1.3d-Rem-4 G2 click-eat behavior on inputBuffer.length > 0:** the click-eat guard reads `inputBuffer.length > 0`. With DI active, `inputBuffer` may stay empty while `dynamicInput.buffers` are non-empty. Fix: extend click-eat to ALSO check `dynamicInput.buffers.some(b => b.length > 0)`. Documented in §7 step 6 (router updates).
- **C3.3 — Bundle size impact:** New painter ~120 LOC + new chrome ~150 LOC + new tests not bundled. Net change to apps/web bundle: ~+3 kB raw / ~+1 kB gz. Round-5 bundle was 446.85 kB raw / 128.97 kB gz; estimate ~450 kB raw post-Round-6. Well under budget.
- **C3.4 — Smoke E2E discipline meta-test:** existing meta-test reads SCENARIOS const + asserts each scenario block contains `<EditorRoot` AND `fireEvent.`. New scenarios follow that pattern.
- **C3.5 — F2 modifiers slice (Shift state) interplay with Tab + DI:** Shift+Tab cycles backward. Modifiers slice's `shift: boolean` flag is read by draw-rectangle for square constraint; the keyboard router's Tab handler reads `e.shiftKey` directly (not the slice — modifier slice is for in-flight mouse-clicked shift, not keyboard-event shift). Both work independently. ✓
- **C3.6 — Existing tests touching DynamicInputPill (now DynamicInputPills):**
  - `tests/DynamicInputPill.test.tsx` → renamed/replaced as `tests/DynamicInputPills.test.tsx` (component scope updated).
  - Smoke scenarios that interact with the pill (`'dynamic input pill: typing a number while in line tool shows pill + Enter submits'`, `'click is eaten while inputBuffer non-empty (AC parity)'`) — updated to query `[data-component="dynamic-input-pill"]` (the pill data-component name stays same; multi-pill component renders multiple instances of the same data-component selector). The smoke assertions about a single pill at cursor still pass for non-DI prompts (fallback path).
- **C3.7 — keyboard router test count growth:** existing tests stay; ~5 new tests (Tab cycles forward; Shift+Tab cycles backward; numeric routes to active field; Backspace pops from active field; Enter calls onSubmitDynamicInput). Test file grows ~80 LOC.
- **C3.8 — paintDimensionGuides downstream:** new painter dispatched in paint.ts overlay pass. Order matters — must paint AFTER paintPreview (so dim guides render on top of rubber-band geometry, not under). Documented in §7 step 5.

## 11. Test strategy

**Tests existing before:** baseline at commit `1aee6b6` (post-grip-stretch fix) is 470 / 470 across 6 packages.

**Tests added by this round (~12-15 net-new):**

- **Substrate types (~1 test):** `tests/types.test.ts` (or extension to existing): manifest shape conformance.
- **Substrate slice (~3 tests):** `tests/ui-state.test.ts` — `commandBar.dynamicInput` default null; setDynamicInputManifest stores; clearDynamicInput resets; setDynamicInputFieldBuffer per-index update; setDynamicInputActiveField cycles; `overlay.dimensionGuides` slice + setter.
- **Substrate runner (~1 test):** `tests/tool-runner.test.ts` — prompt with manifest publishes to slice + clears on teardown.
- **Substrate router (~5 tests):** `tests/keyboard-router.test.ts` — Tab cycles activeFieldIdx; Shift+Tab cycles backward; numeric routes to active field; Backspace pops active field; Enter calls onSubmitDynamicInput.
- **Substrate painter (~3 tests):** `tests/paintDimensionGuides.test.ts` — linear-dim emits witness + dim line + ticks; angle-arc emits ctx.arc with right pivot/radius; radius-line tick or no-op.
- **Substrate chrome (~4 tests):** `tests/DynamicInputPills.test.tsx` — fallback single-pill at cursor; multi-pill rendering at metric anchors; focused pill glow + caret; pills hide when manifest cleared.
- **Per-tool generators (~4 tests):** `tests/draw-tools.test.ts` — rectangle yields 2-field linear-dim manifest; line yields linear-dim + angle-arc; polyline yields manifest per loop; circle yields radius-line single-field.
- **Smoke E2E (~3 scenarios):**
  - `'rectangle DI: type 6 Tab 4 Enter commits 6×4'` (full pill flow + Tab cycle + numberPair combineAs)
  - `'line DI: type 5 Tab 30 Enter commits a 5m line at 30°'` (polar combineAs)
  - `'circle DI: type 7 Enter commits a radius-7 circle'` (single-field, no Tab)

**Migrated existing tests (no count change):**
- DynamicInputPill.test.tsx → DynamicInputPills.test.tsx (rename + multi-pill assertions)
- Smoke scenarios `'dynamic input pill: typing a number while in line tool shows pill + Enter submits'` + `'click is eaten while inputBuffer non-empty'` — assertions updated to handle multi-pill semantics in fallback mode.

**Tests intentionally not added:**
- Visual regression for the painter — out of scope (no image-diff infra).
- Modify-operator DI manifests — M1.3b ships with each operator's manifest tests.

## 12. Why two phases, not one

- **Phase 1 (substrate)** is testable in isolation: types + slice + painter + chrome + router updates. No tool yet declares a manifest, so legacy paths still serve. If substrate has bugs, tools aren't affected.
- **Phase 2 (per-tool migration)** opts each tool in incrementally. If migration of tool X surfaces an issue, only that tool is impacted; other tools keep using the legacy path until their migration lands.
- This matches the substrate-first migration philosophy from §3 A11.
- Combining into one phase would risk surfacing migration bugs alongside substrate bugs — harder to triage.

---

## Plan Review Handoff

**Architecture authority note:** there is no root-level `architecture.md` in this repository. The architecture authority is split across `docs/procedures/Codex/00-architecture-contract.md` (Codex's binding contract) + `docs/procedures/Claude/00-architecture-contract.md` (Claude's mirror) + the ADR set under `docs/adr/` (specifically ADR-023 "Tool state machine and command bar" being extended by the proposed new ADR-024 "Dynamic Input manifest" in this round).

**Mockup reference:** `docs/round-6-mockup.html` — interactive HTML showing the four UI options (rectangle minimal/full + line minimal/full). User picked "full" in chat 2026-04-28.

**Plan:** `docs/plans/feature/m1-3-di-pill-redesign.md`
**Branch:** `feature/m1-3-di-pill-redesign` (atop `1aee6b6` — main after the M1.3d merge + grip-stretch fix)
**Status:** Plan authored — awaiting Codex Round-1 review

### Paste to Codex for plan review
> Review this plan using `docs/procedures/Codex/02-plan-review.md`
> (Procedure 02). Apply strict evidence mode. Start from Round 1.
>
> Context: M1.3 Round 6 — Dynamic Input pill redesign (AC-style
> transient-dimension-line + multi-field pills + Tab cycle). User
> approved "full" visual fidelity per the mockup at
> `docs/round-6-mockup.html`. Two phases: substrate (types + slice +
> painter + chrome + router) then per-tool migration (rectangle / line
> / polyline / circle).
>
> Branch: `feature/m1-3-di-pill-redesign` from `main` after the M1.3d
> tag (`m1.3d`) and the grip-stretch click-sticky-click fix
> (`1aee6b6`).
>
> Spec impact: `docs/operator-shortcuts.md` 2.0.0 → 2.1.0 (Tab as
> DI-cycling key). New ADR-024 "Dynamic Input manifest" — first ADR
> proposed in M1.3 polish work.
>
> Existing F1 directDistanceFrom mechanism (M1.3d-Rem-3) STAYS for
> the bottom command line typing path. The new DI manifest is the
> multi-field enhanced path at canvas focus. Both surfaces feed the
> same Input arms; legacy single-pill path stays for non-DI prompts.

### Paste to user for approval
> Please review the plan at
> `docs/plans/feature/m1-3-di-pill-redesign.md`. After approval,
> invoke Procedure 03 to execute Phase 1 (substrate) then Phase 2
> (per-tool migration).
