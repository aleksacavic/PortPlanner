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
**Status:** Rev-1 authored — addresses Codex Round-1 findings + §1.3 audit refinements; awaiting Codex Round-2 review

---

## Revision history

| Rev | Date | Driver | Changes |
|-----|------|--------|---------|
| Rev-0 | 2026-04-28 | Initial draft | Per-prompt Dynamic Input manifest; multi-pill chrome replacing single pill; new `paintDimensionGuides` painter (witness + dim lines + angle arcs); per-field input buffer slice with Tab focus cycling; first-pass migration of rectangle / line / polyline / circle. ADR-024 proposed for the manifest contract. §1.3 three-round audit. |
| Rev-1 | 2026-04-28 | Codex Round-1 plan-review findings + §1.3 self-audit on revised text | **B1 (Blocker, Agree):** removed planned edit to accepted ADR-023 (§0.6 immutability); ADR-024 cross-references ADR-023 from its own body only (one-way). **H1 (High-risk, Agree):** added explicit Phase-1 step + gate for click-eat guard extension at the 3 sites in `EditorRoot.tsx` (lines ~389/533/560) to OR-check `cb.dynamicInput?.buffers.some(b => b.length > 0)`; smoke scenario `'click is eaten while DI buffer non-empty (multi-field DI parity)'` added. **H2 (High-risk, Agree):** extracted pure helper `combineDynamicInputBuffers` in NEW `tools/dynamic-input-combine.ts` as SSOT for the angle deg→rad conversion (`(angleDeg * Math.PI) / 180`); helper unit tests cover anchor-offset + 0°/90°/-45° edge cases; Gate REM6-P1-AngleUnit added. **Q1 (Quality, Agree):** all prompt-text greps in Phase-1/2 gates replaced with structural symbol greps (`dynamicInput`, `combineAs`, `'point'`, `setDynamicInputActiveField`). **Q2 (Quality, Partial agree):** Gate REM6-10 demoted to "informational tripwire — not architecture-significant"; REM6-9 / REM6-11 / REM6-12 are the architecture-significant gates. **§1.3 audit additions:** R1-A2 helper delegates parsing to existing parser path (no SSOT duplication); R1-A3 §5 ADR-024 row enumerates all three axes (field-kind / guide-kind / combineAs) + angle invariant; R2-A3 helper test edge-case coverage; R2-A5 per-prompt-yield buffer reset semantics in step 3; R2-A6 dynamic-anchor descriptor handling deferred to execution-time; R2-A8 angle-as-degrees invariant locked down for future trig users (M1.3b Rotate); R3-A4 step-numbering cross-refs scanned in §1.16 step 12 pass. |

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
  - **Dynamic anchor handling (line/polyline distance-along-leg):** for guides whose anchor depends on current cursor (e.g., midpoint of the rubber-band leg p1→cursor), the implementation MAY either (a) re-publish the manifest each cursor-effect tick with FIXED metric coords, or (b) declare REFERENCE descriptors (e.g., `'cursor'`, `'midpoint:p1,cursor'`) resolved at render time by the painter and pill component. **Decide at execution-time** based on which is cleaner; both approaches preserve the ADR-021 painter contract (DTP-T1/T2/T6/T7) and the ADR-023/024 manifest contract.
- **A3 — Multi-pill chrome.** Existing `chrome/DynamicInputPill.tsx` (single pill at cursor) is **replaced** by `chrome/DynamicInputPills.tsx` (plural). The new component reads the active prompt's manifest from store, renders 0..N pills at metric-anchored positions (each `metricToScreen(anchor) + offset`), highlights the focused pill, shows a caret on the focused pill, and disappears when no manifest is active. Single-pill behavior (when prompt has no DI manifest but accumulator or inputBuffer is non-empty) still renders ONE pill at cursor as the degenerate case — same fallback as M1.3d-Rem-4 G2's pill.
- **A4 — Per-field input buffer.** New slice field `commandBar.dynamicInput: { activeFieldIdx: number; buffers: string[] } | null`. Null when no manifest is active; populated when the runner publishes a manifest. The existing single `inputBuffer` stays for non-DI paths (bottom command line typing, accumulator); `dynamicInput.buffers` is the parallel structure for DI prompts. Both can't be active simultaneously.
- **A5 — Tab focus cycling.** Keyboard router intercepts `Tab` at canvas focus AND bar focus when `commandBar.dynamicInput !== null`. Tab cycles `activeFieldIdx` modulo `buffers.length`. Shift+Tab cycles backwards. Tab pass-through to native browser behavior when no manifest is active (preserves keyboard accessibility for chrome regions).
- **A6 — Numeric routing while DI is active.** Numeric / punctuation keys (`0-9`, `.`, `-`, `,`) at canvas focus when DI is active append to `dynamicInput.buffers[activeFieldIdx]` (NOT the legacy single `inputBuffer`). Backspace pops from that field's buffer. Esc clears all DI field buffers. Enter / Space combines all field buffers via the manifest's `combineAs` policy and feeds a single Input to the runner.
- **A7 — `combineAs` policies.** First-pass set, implemented as SSOT in pure helper `combineDynamicInputBuffers(manifest, buffers, anchor): Input | null` at `packages/editor-2d/src/tools/dynamic-input-combine.ts` (NEW). The helper does the COMBINATION; per-field PARSING is delegated to the existing parser path in `tools/runner.ts` (re-use, do NOT duplicate — SSOT preservation per §10 audit R1-A2). Returns `null` if any required buffer is empty / un-parseable; caller treats null as "ignore submit".
  - `'numberPair'` → `{kind: 'numberPair', a: parsed[0], b: parsed[1]}`. Used by rectangle's W,H. Already exists from M1.3d-Rem-5 H1 — direct reuse of the parser path.
  - `'point'` → polar conversion: given `[distance, angleDeg]`, compute `{kind: 'point', point: {x: anchor.x + cos(angleRad) * distance, y: anchor.y + sin(angleRad) * distance}}` where `angleRad = (angleDeg * Math.PI) / 180` and anchor is the field's metricAnchor or the prompt's `directDistanceFrom`. **Angle invariant: the typed `angle` field is INVARIANT in DEGREES (AC convention; user types "30" expecting 30°). The helper performs deg→rad conversion ONLY for `combineAs: 'point'` polar trig. Future trig users (e.g., M1.3b Rotate sweep angle) MUST route through the same helper or reuse the same constant — no mixed conventions.** Used by line/polyline second-point with both fields filled.
  - `'number'` → single field `{kind: 'number', value: parsed[0]}`. Used by circle radius and any single-field manifest.
  - Future: `'numberTuple'`, `'angle'` (as a top-level Input kind for Rotate-style operators) — add when needed; not in this round.
- **A8 — F1 directDistanceFrom interplay.** F1 (typing a single number into the bottom command line for line/polyline/circle/arc to interpret as polar distance from anchor) STAYS unchanged. It's the single-field shortcut path. The new DI manifest is the multi-field enhanced path. When a tool yields a prompt with BOTH `directDistanceFrom` and a `dynamicInput` manifest, both work — bar-form Enter triggers F1; per-field DI Enter triggers the manifest's combineAs path. Bottom command line and DI pills are alternate surfaces for the same inputBuffer concept; on submit, whichever path the user used wins.
- **A9 — Per-tool migration scope (first-pass).** Four tools migrate in this round:
  1. **draw-rectangle.ts** — second-corner prompt grows `dynamicInput` manifest with two `linear-dim` fields (W on bottom edge, H on right edge), `combineAs: 'numberPair'`. Existing F3 Dimensions sub-flow's single `numberPair` prompt could ALSO get a manifest if helpful, but the natural primary flow is the second-corner-with-DI rather than the explicit Dimensions sub-option. Decide at execution time which prompt(s) get the manifest.
  2. **draw-line.ts** — second-point prompt grows manifest with two fields: distance (`linear-dim` along the rubber-band leg) + angle (`angle-arc` from horizontal-right at p1), `combineAs: 'point'`. Existing F1 directDistanceFrom anchor stays.
  3. **draw-polyline.ts** — same as draw-line on each loop iteration. Anchor for both = `verticesSnapshot[verticesSnapshot.length - 1]`.
  4. **draw-circle.ts** — radius prompt grows manifest with one field: radius (`radius-line` from center to current cursor), `combineAs: 'number'` (the value is the radius scalar; tool computes the edge point). Existing F1 directDistanceFrom anchor (`ctr`) stays.
- **A10 — Existing tools NOT migrated this round.** draw-arc (two prompts; manifest design needs separate thinking on radius vs sweep — defer), draw-rectangle's first-corner prompt (no useful dimensions to declare yet), move/copy (have F4 modified-entities preview but no typed numerics — typed-distance offset comes with M1.3b STRETCH or a future enhancement), select-rect (drag-style; doesn't match the typed-input model).
- **A11 — Substrate-first migration philosophy.** Substrate (manifest types + painter + chrome + buffer slice + router updates) lands in one phase; per-tool migration is a separate phase that opts each tool in. This minimizes the risk of breaking existing tools while substrate develops.
- **A12 — ADR placement.** **ADR-024 ONLY.** ADR-023 is `Status: ACCEPTED` and §0.6 of the architecture contract forbids editing accepted ADRs ("ADR files: never edited after acceptance. Write a new ADR if the decision changes."). Even a one-line "see ADR-024" pointer inside ADR-023 would violate this rule. ADR-023 itself contains language at supersession (line 33-34: "this ADR's shortcut map ... SHOULD NOT be edited again") consistent with the contract rule. **ADR-024 carries the cross-reference one-way only — from ADR-024's body referencing ADR-023, never the reverse direction.** ADR-023 is NOT modified. (Codex Round-1 B1 finding, Rev-1 fix.)

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
| `packages/editor-2d/src/tools/dynamic-input-combine.ts` | **NEW.** Pure helper `combineDynamicInputBuffers(manifest, buffers, anchor): Input \| null` — SSOT for `combineAs` policies (`'numberPair'` / `'point'` / `'number'`). Performs the COMBINATION; delegates per-field PARSING to the existing parser path in `tools/runner.ts` (no SSOT duplication). For `combineAs: 'point'`, performs explicit `(angleDeg * Math.PI) / 180` deg→rad conversion before `cos`/`sin`. Returns `null` on empty / un-parseable buffer. |
| `packages/editor-2d/tests/dynamic-input-combine.test.ts` | **NEW.** Helper unit tests: `numberPair` (`['6', '4']` → `{a:6, b:4}`); `point` deg→rad conversion at `[5, 30]` from anchor (0,0) → ≈(4.330, 2.500); `point` 90° edge case at `[5, 90]` from anchor (10, 20) → (10, 25); `point` 0° edge case → (anchor.x + d, anchor.y); `point` -45° negative angle; `number` (`['7']` → `{value: 7}`); empty / un-parseable buffer → `null`. |
| `docs/adr/024-dynamic-input-manifest.md` | NEW — proposed. ADR-024 documenting the per-prompt DI manifest contract: (a) field-kind enum (`'number' \| 'distance' \| 'angle'`); (b) dimension-guide-kind enum (`'linear-dim' \| 'angle-arc' \| 'radius-line'`); (c) `combineAs` policy enum (`'numberPair' \| 'point' \| 'number'`); (d) painter dispatch model; (e) per-field buffer model + Tab-cycling focus invariant; (f) **angle-unit invariant — typed angle field is in degrees; `combineAs: 'point'` converts to radians via `(angleDeg * Math.PI) / 180` before trig** (SSOT in `tools/dynamic-input-combine.ts`); (g) cross-reference to ADR-023 (one-way, from ADR-024 body only — ADR-023 is NOT modified per §0.6). |

### 4.2 In scope — files created

- `packages/editor-2d/src/canvas/painters/paintDimensionGuides.ts`
- `packages/editor-2d/src/chrome/DynamicInputPills.tsx` + `.module.css`
- `packages/editor-2d/src/tools/dynamic-input-combine.ts` (NEW — SSOT helper for `combineAs` policies; angle deg→rad conversion lives here)
- `packages/editor-2d/tests/DynamicInputPills.test.tsx`
- `packages/editor-2d/tests/paintDimensionGuides.test.ts`
- `packages/editor-2d/tests/dynamic-input-combine.test.ts` (NEW — helper unit tests covering deg→rad, edge cases, parser failures)
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
- **ADRs:** **ADR-024 created (NEW).** ADR-023 NOT modified — ADR-024 cross-references ADR-023 from its body only (one-way reference). Per §0.6 of the architecture contract, accepted ADRs are immutable; the cross-reference from ADR-024 → ADR-023 is allowed (it's an edit of ADR-024, not ADR-023).
- **Tests rework volume:** medium. ~25-32 net-new tests (substrate ~24: types ×1 + slice ×3 + runner ×1 + painter ×3 + multi-pill ×4 + router ×5 + combiner helper ×7 across edge cases; per-tool generators ×4; smoke ×4 including click-eat-with-DI parity) + ~5 migrated. **Threshold gate (REM6-10): ≥480 (470 + ≥10 minimum).** Actual count expected to be in the ~495-505 range; informational tripwire only per Rev-1 Q2.

## 5. Architecture doc impact

| Doc | Change |
|---|---|
| `docs/adr/024-dynamic-input-manifest.md` | **NEW** — proposed. Per-prompt DI manifest contract: (a) field-kind enum (`'number' \| 'distance' \| 'angle'`); (b) dimension-guide-kind enum (`'linear-dim' \| 'angle-arc' \| 'radius-line'`); (c) `combineAs` policy enum (`'numberPair' \| 'point' \| 'number'`); (d) painter dispatch model (consumed by `paintDimensionGuides`); (e) per-field buffer model + Tab-cycling focus invariant; (f) **angle-unit invariant — typed angle field is in degrees; `combineAs: 'point'` converts to radians via `(angleDeg * Math.PI) / 180` before trig** (SSOT in `packages/editor-2d/src/tools/dynamic-input-combine.ts`); (g) one-way cross-reference to ADR-023 from ADR-024's own body — ADR-023 file is NOT modified per §0.6. |
| `docs/adr/023-tool-state-machine-and-command-bar.md` | **No change.** Editing accepted ADRs violates §0.6 ("ADR files: never edited after acceptance"). ADR-024 references ADR-023 from its own body; the reference does not require any reciprocal edit to ADR-023. (Codex Round-1 B1 finding, Rev-1 fix.) |
| `docs/operator-shortcuts.md` | Minor bump 2.0.0 → 2.1.0. Add `Tab` row to M1.3a section: cycles focus between DI fields when DI is active; pass-through otherwise. Behavior notes section gets a new paragraph documenting multi-field DI. (Per `docs/operator-shortcuts.md` §Governance: adding a new shortcut → minor version bump.) |
| All other binding spec docs | No change. |

## 6. Deviations from binding specifications (§0.7)

**None proposed.** ADR-024 is a NEW ADR (additive). **ADR-023 is NOT edited** — ADR-024 cross-references ADR-023 from ADR-024's own body only (one-way reference), which is allowed under §0.6 (the rule forbids editing the REFERENCED ADR; it does not forbid a new ADR from citing an old one). The Prompt contract grows an optional `dynamicInput?: DynamicInputManifest` field; existing tools that don't use it are unaffected (additive type widening — no breaking change). The `operator-shortcuts.md` bump 2.0.0 → 2.1.0 is per-governance (adding a new shortcut → minor bump per the registry's §Governance rules). (Codex Round-1 B1 finding, Rev-1 fix — previous Rev-0 wording had ADR-023 receiving "a brief note pointing at ADR-024", which would have been an in-place edit and a §0.6 violation. Rev-1 removes that planned edit entirely.)

## 7. Implementation phases

Two phases: **Phase 1 — Substrate** lands the types + painter + chrome + slice + router updates. **Phase 2 — Per-tool migration** opts each of the four tools into the manifest. This minimizes risk: substrate is testable in isolation; each tool migration is incremental.

### Phase 1 — Substrate

#### Phase 1 Goal
Land the per-prompt DI manifest contract, the multi-pill chrome, the `paintDimensionGuides` painter, and the keyboard router updates. After this phase, no tool yet declares a manifest; existing tools continue using the legacy single-pill / F1 path.

#### Phase 1 Steps
1. Add `DynamicInputManifest`, `DynamicInputField`, `DimensionGuide` types to `tools/types.ts`. Add optional `Prompt.dynamicInput?: DynamicInputManifest`.
2. Add slice fields + actions in `ui-state/store.ts`: `commandBar.dynamicInput`, `overlay.dimensionGuides`. Update `createInitialEditorUiState` defaults to null.
3. Update `tools/runner.ts`: when yielded prompt has `dynamicInput`, call `setDynamicInputManifest(manifest)` + `setDimensionGuides(guides)` based on the manifest. **Buffer reset semantics (Rev-1 R2-A5 clarification):** each prompt yield with a manifest resets `dynamicInput.buffers` to `Array(manifest.fields.length).fill('')` and `activeFieldIdx` to 0. This means each polyline-loop iteration starts with empty buffers (one prompt = one input session — the user retypes per leg). On tool teardown OR on a yielded prompt without `dynamicInput`, call `clearDynamicInput()` + `setDimensionGuides(null)`.
4. Create `paintDimensionGuides.ts` with the per-shape switch dispatcher. Implement `linear-dim` (witness + dim line + ticks), `angle-arc` (ctx.arc with screen-px radius converted to metric), `radius-line` (single tick or no-op). For dynamic-anchor descriptors (line/polyline distance-along-leg per A2), implementation chooses re-publish-per-cursor-tick OR reference-resolve-at-render-time at execution time.
5. Add `paintDimensionGuides` dispatch in `paint.ts` overlay pass (after `paintPreview`).
6. Replace `DynamicInputPill.tsx` with `DynamicInputPills.tsx`. Multi-pill rendering with metric-anchored positioning; fallback single-pill behavior preserved when no manifest active.
7. Update `EditorRoot.tsx` import + mount.
8. Update `keyboard/router.ts`:
   - Tab branch: at canvas/bar focus + DI active → preventDefault, cycle `activeFieldIdx` via `setDynamicInputActiveField` (Shift+Tab cycles backward).
   - Numeric / Backspace branches: when DI active, route to `dynamicInput.buffers[activeFieldIdx]` via `setDynamicInputFieldBuffer`; otherwise existing path to `inputBuffer`.
   - Enter / Space branches: when DI active, invoke `onSubmitDynamicInput(manifest, buffers)` callback.
   - Esc branch: clear DI buffers in addition to existing accumulator/inputBuffer clear via `clearDynamicInput()`.
9. Add `onSubmitDynamicInput: (manifest, buffers) => void` to `KeyboardRouterCallbacks`.
10. **Create NEW pure helper `combineDynamicInputBuffers(manifest, buffers, anchor): Input | null` in `packages/editor-2d/src/tools/dynamic-input-combine.ts` — SSOT for `combineAs` policies.** The helper:
    - **Delegates per-field PARSING to the existing parser path in `tools/runner.ts`** (re-use, do NOT duplicate — Rev-1 R1-A2 SSOT preservation). Locate the existing parser at execution-time; if it lives inline in runner.ts, extract it to a shared module that both runner and helper import.
    - For `combineAs: 'numberPair'` → returns `{kind: 'numberPair', a: parsed[0], b: parsed[1]}` (re-uses M1.3d-Rem-5 H1's parser path).
    - For `combineAs: 'point'` → polar conversion. **Angle field is interpreted in DEGREES; helper converts via `(angleDeg * Math.PI) / 180` before `cos`/`sin`.** Returns `{kind: 'point', point: {x: anchor.x + Math.cos(angleRad) * distance, y: anchor.y + Math.sin(angleRad) * distance}}`.
    - For `combineAs: 'number'` → returns `{kind: 'number', value: parsed[0]}`.
    - Returns `null` if any required buffer is empty / un-parseable (caller treats null as "ignore submit").
11. Implement `onSubmitDynamicInput` in `EditorRoot.tsx`: delegates to `combineDynamicInputBuffers(manifest, buffers, anchor)`; if helper returns non-null, feeds the Input to runner; clears DI buffers via `clearDynamicInput()`. **No conversion math in `EditorRoot.tsx`** — all combineAs / deg→rad logic lives in the helper (SSOT).
12. **Extend click-eat guard at the 3 sites in `EditorRoot.tsx`** (Rev-1 H1 fix; Codex Round-1 high-risk finding). Current guards (M1.3d-Rem-4 G2 pattern):
    - [`handleCanvasClick` ~line 389](packages/editor-2d/src/EditorRoot.tsx:389): `if (...inputBuffer.length > 0) return;`
    - [`handleCanvasMouseDown` ~line 533](packages/editor-2d/src/EditorRoot.tsx:533): same.
    - [`handleCanvasMouseUp` ~line 560](packages/editor-2d/src/EditorRoot.tsx:560): same.
    Each MUST be extended to OR-check `cb.dynamicInput !== null && cb.dynamicInput.buffers.some(b => b.length > 0)`. Rationale: with DI active, `inputBuffer` may stay empty while `dynamicInput.buffers` are populated; a stray click during DI typing would slip through the existing `inputBuffer.length > 0` guard and commit unintended geometry. Implementation MAY introduce a named helper (e.g., `hasNonEmptyDIBuffer(state)`) provided each guard site references DI state explicitly.
13. Tests for substrate: types, slice, runner publish + buffer-reset semantics, painter per-shape, multi-pill component, **combiner helper** (covering all `combineAs` arms + angle deg→rad edge cases per §11), router (Tab forward/backward + numeric routing + Backspace + Enter + Esc branches), **click-eat-with-DI smoke parity scenario**.

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

Gate REM6-P1-Router-Tab: Tab handler invokes setDynamicInputActiveField (Rev-1 Q1 — structural symbol grep, not prompt-text)
  Command: rg -n "setDynamicInputActiveField" packages/editor-2d/src/keyboard/router.ts
  Expected: ≥1 match (router cycles activeFieldIdx via the slice action)

Gate REM6-P1-Router-Submit: onSubmitDynamicInput callback wired
  Command: rg -n "onSubmitDynamicInput" packages/editor-2d/src/keyboard/router.ts packages/editor-2d/src/EditorRoot.tsx
  Expected: ≥3 matches (callback type + router invocation + EditorRoot impl)

Gate REM6-P1-Combiner: combineDynamicInputBuffers helper file + tests exist (Rev-1 R1-A2/H2 SSOT)
  Commands:
    (a) ls packages/editor-2d/src/tools/dynamic-input-combine.ts
        Expected: file exists
    (b) ls packages/editor-2d/tests/dynamic-input-combine.test.ts
        Expected: file exists
    (c) rg -n "combineDynamicInputBuffers" packages/editor-2d/src/EditorRoot.tsx
        Expected: ≥1 match (EditorRoot's onSubmitDynamicInput delegates to helper)

Gate REM6-P1-AngleUnit: combineDynamicInputBuffers performs explicit deg→rad conversion (Rev-1 H2 fix)
  Command: rg -n "Math\.PI\s*/\s*180|DEG_TO_RAD|deg2rad" packages/editor-2d/src/tools/dynamic-input-combine.ts
  Expected: ≥1 match (conversion symbol present in helper; SSOT — no other code re-implements)
  Cross-check: rg -n "Math\.PI\s*/\s*180|DEG_TO_RAD|deg2rad" packages/editor-2d/src/EditorRoot.tsx
  Expected: 0 matches (EditorRoot delegates; conversion lives only in helper)

Gate REM6-P1-ClickEat: click-eat guard extended for DI buffers (Rev-1 H1 fix; Codex Round-1)
  Command (grep): rg -c "dynamicInput" packages/editor-2d/src/EditorRoot.tsx
  Expected: ≥3 occurrences (the 3 click-eat guard sites — handleCanvasClick / Down / Up — each reference DI state, either inline `cb.dynamicInput?.buffers.some(...)` or via a named helper symbol that itself references `dynamicInput`)
  Command (smoke): rg -n "'click is eaten while DI buffer non-empty" packages/editor-2d/tests/smoke-e2e.test.tsx
  Expected: 2 matches (SCENARIOS const + matching it() title)
  Wired-behavior verification: pnpm --filter @portplanner/editor-2d test -- tests/smoke-e2e — the 'click is eaten while DI buffer non-empty (multi-field DI parity)' scenario passes; canvas click during DI typing does NOT commit geometry until Enter.
```

### Phase 2 — Per-tool migration (rectangle, line, polyline, circle)

#### Phase 2 Goal
Migrate the four primary draw tools to declare DI manifests on their relevant prompts. After this phase, the user sees AC-style multi-field DI when drawing these primitives.

#### Phase 2 Steps
12. Migrate `draw-rectangle.ts`'s second-corner prompt — manifest with two `linear-dim` fields (W on bottom edge midpoint metric anchor, H on right edge midpoint), `combineAs: 'numberPair'`. The width and height field kind is `'number'`. The witness anchor metric points = the rectangle's two corners; the painter computes the dim line offset.
13. Migrate `draw-line.ts`'s second-point prompt — manifest with two fields:
    - distance: kind `'distance'`, `linear-dim` along the leg from p1 to cursor, anchor = midpoint of leg (computed dynamically per cursor frame).
    - angle: kind `'angle'`, `angle-arc` at p1, base angle = 0 (horizontal-right), sweep angle = current leg angle.
    - `combineAs: 'point'` (polar: helper `combineDynamicInputBuffers` converts the typed angle from degrees to radians via `(angleDeg * Math.PI) / 180`, then computes `point = p1 + (cos(angleRad) × distance, sin(angleRad) × distance)` — see Phase 1 step 10 for SSOT helper details).
14. Migrate `draw-polyline.ts` — same as draw-line on each loop; anchor = `verticesSnapshot[verticesSnapshot.length - 1]`.
15. Migrate `draw-circle.ts`'s radius prompt — manifest with one field: radius (kind `'distance'`, `radius-line` from `ctr` to cursor, anchor = midpoint of radius line). `combineAs: 'number'`.
16. Update tool tests to assert each tool yields the expected manifest shape on the relevant prompt.
17. Add 4 new smoke-e2e scenarios (Rev-1: count includes the click-eat-with-DI parity scenario, which depends on at least one tool migration to activate DI; the click-eat fix itself is wired in Phase 1 step 12 but exercised end-to-end here):
    - `'rectangle DI: type 6 Tab 4 Enter commits 6×4'` (focuses W, types 6, Tab, types 4, Enter, asserts rectangle of 6×4)
    - `'line DI: type 5 Tab 30 Enter commits a 5m line at 30°'` (polar; deg→rad correctness verified end-to-end)
    - `'circle DI: type 7 Enter commits a radius-7 circle'` (single-field, no Tab)
    - **`'click is eaten while DI buffer non-empty (multi-field DI parity)'`** (Rev-1 H1): in line tool with DI active, after typing into the distance buffer, a canvas click does NOT commit a line at the click position; only Enter (via the helper-driven `combineAs`) commits geometry.

#### Phase 2 Mandatory Completion Gates
```
Gate REM6-P2-Rectangle: draw-rectangle yields linear-dim manifest with combineAs 'numberPair' (Rev-1 Q1 — structural)
  Command: rg -n "dynamicInput|'linear-dim'|'numberPair'" packages/editor-2d/src/tools/draw/draw-rectangle.ts
  Expected: ≥3 matches (manifest declaration site + 'linear-dim' shape kind + 'numberPair' combineAs literal)

Gate REM6-P2-Line: draw-line yields manifest with linear-dim distance + angle-arc angle, combineAs 'point' (Rev-1 Q1)
  Command: rg -n "dynamicInput|'linear-dim'|'angle-arc'|'point'" packages/editor-2d/src/tools/draw/draw-line.ts
  Expected: ≥4 matches (manifest + 'linear-dim' distance guide + 'angle-arc' angle guide + 'point' combineAs)

Gate REM6-P2-Polyline: draw-polyline yields the same manifest shape per loop iteration (Rev-1 Q1)
  Command: rg -n "dynamicInput|'angle-arc'|'point'" packages/editor-2d/src/tools/draw/draw-polyline.ts
  Expected: ≥3 matches

Gate REM6-P2-Circle: draw-circle yields radius-line manifest with combineAs 'number' (Rev-1 Q1)
  Command: rg -n "dynamicInput|'radius-line'|'number'" packages/editor-2d/src/tools/draw/draw-circle.ts
  Expected: ≥3 matches (manifest + 'radius-line' guide + 'number' combineAs literal — note: 'number' may also appear in field-kind context; ≥3 is the minimum across manifest declaration + guide + combineAs)

Gate REM6-P2-Smoke: 4 new smoke scenarios in SCENARIOS const + matching it() blocks (Rev-1 — added click-eat-with-DI parity)
  Command: rg -n "'rectangle DI:|'line DI:|'circle DI:|'click is eaten while DI buffer non-empty" packages/editor-2d/tests/smoke-e2e.test.tsx
  Expected: ≥8 matches (each of the 4 scenario names appears twice: SCENARIOS const + it() title)
```

### Cross-phase gates

```
Gate REM6-9 (architecture-significant): Targeted test files pass
  Command: pnpm --filter @portplanner/editor-2d test -- tests/types tests/ui-state tests/tool-runner tests/keyboard-router tests/DynamicInputPills tests/paintDimensionGuides tests/dynamic-input-combine tests/draw-tools tests/smoke-e2e
  Expected: passes; new substrate (incl. dynamic-input-combine helper unit tests) + per-tool tests + 4 new smoke scenarios (rectangle DI / line DI / circle DI / click-eat-with-DI) all green

Gate REM6-10 (informational tripwire — NOT architecture-significant by itself, per Codex Round-1 Q2): Workspace test count
  Command: pnpm test
  Expected: all 6 packages pass; total ≥ 480 (post-Round-5 baseline 470 + ≥10 net-new minimum — actual ~25-32 across substrate + per-tool + smoke per the §11 breakdown).
  Note: failure of THIS gate indicates a count-regression somewhere unrelated; the architecture-significant test gate is REM6-9 (named test files pass) — not the count threshold. The count cannot meaningfully be padded with trivial tests to hit a number; if substrate semantics regress, REM6-9 catches it first.

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

- [ ] **Substrate** — DynamicInputManifest type + slice + painter + chrome + router updates + **`combineDynamicInputBuffers` helper** landed. Verified by REM6-P1 gates (incl. REM6-P1-Combiner + REM6-P1-AngleUnit + REM6-P1-ClickEat).
- [ ] **Click-eat guard extended for DI buffers** — 3 sites in `EditorRoot.tsx` (handleCanvasClick / Down / Up) reference DI state in the guard expression; smoke scenario `'click is eaten while DI buffer non-empty (multi-field DI parity)'` passes. Verified by REM6-P1-ClickEat. (Rev-1 H1 fix.)
- [ ] **Angle-unit invariant enforced** — `combineDynamicInputBuffers` is the SSOT helper performing deg→rad conversion via `(angleDeg * Math.PI) / 180` before `cos`/`sin`; helper unit tests at `[5, 30]`, `[5, 90]`, `[5, 0]`, `[5, -45]` from anchors (0,0) and (10,20) all pass; `EditorRoot.tsx` contains zero conversion-symbol matches (delegation only). Verified by REM6-P1-AngleUnit + REM6-P1-Combiner + the unit test in `dynamic-input-combine.test.ts`. (Rev-1 H2 fix.)
- [ ] **Rectangle migration** — second-corner prompt yields W,H linear-dim manifest; user sees both pills + dim lines; Tab cycles. Verified by REM6-P2-Rectangle + REM6-P2-Smoke (`'rectangle DI: type 6 Tab 4 Enter'`).
- [ ] **Line migration** — second-point prompt yields distance + angle-arc manifest; polar conversion on submit. Verified by REM6-P2-Line + smoke (`'line DI: type 5 Tab 30 Enter commits a 5m line at 30°'`).
- [ ] **Polyline migration** — same manifest shape on each loop iteration; per-yield buffer reset (Rev-1 R2-A5). Verified by REM6-P2-Polyline.
- [ ] **Circle migration** — radius single-field. Verified by REM6-P2-Circle + smoke.
- [ ] **Binding spec docs updated** — operator-shortcuts.md 2.0.0 → 2.1.0; ADR-024 created (NEW). **ADR-023 NOT modified** per §0.6 (Rev-1 B1 fix). Verified by REM6-SPEC (a + b + c + d).
- [ ] All Phase REM6-P1 + REM6-P2 + REM6-9 + REM6-11 + REM6-12 + REM6-SPEC gates pass.
- [ ] Cross-cutting hard gates DTP-T1 / T2 / T6 / T7 pass with the extended painter list. Verified by REM6-11.
- [ ] **Workspace test count tripwire** ≥ 480 (post-Round-5 baseline 470 + ≥10 net-new minimum; actual ~25-32 per §11 breakdown). Informational only; the architecture-significant gates are REM6-9 (named test files) + REM6-11 (cross-cutting structural) + REM6-12 (typecheck/check/build). REM6-10 demoted in Rev-1 per Codex Round-1 Q2.
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
| ADR-024 is the only ADR-level change — extending or editing ADR-023 is forbidden by §0.6 (Rev-1 B1 fix) | Plan §5 + §6 + §10 C1.5 explicitly state ADR-023 is NOT modified. ADR-024 cross-references ADR-023 from its own body only (one-way). Per §0.6 the rule forbids editing the REFERENCED ADR; it does not forbid a new ADR from citing an old one. The DI manifest is a substantive contract addition deserving of its own ADR (per-field buffer model, Tab focus invariant, painter dispatch model, angle-as-degrees → radians conversion invariant for `combineAs: 'point'`). |
| Click-eat guard omitted DI buffers (M1.3d-Rem-4 G2 parity gap; Rev-1 H1 fix) | Phase 1 step 12 extends the 3 guard sites in `EditorRoot.tsx` ([handleCanvasClick ~line 389](packages/editor-2d/src/EditorRoot.tsx:389), [handleCanvasMouseDown ~line 533](packages/editor-2d/src/EditorRoot.tsx:533), [handleCanvasMouseUp ~line 560](packages/editor-2d/src/EditorRoot.tsx:560)) with an OR-check on `cb.dynamicInput?.buffers.some(b => b.length > 0)`. Gate REM6-P1-ClickEat enforces (grep ≥3 occurrences of `dynamicInput` in `EditorRoot.tsx` AND smoke scenario asserts wired behavior). |
| Angle-unit silent mismatch (typed 30 interpreted as radians → line lands at ~1719° wrapped, geometrically wrong but not crashy; Rev-1 H2 fix) | Pure helper `combineDynamicInputBuffers` in `tools/dynamic-input-combine.ts` is the SSOT for deg→rad conversion via `(angleDeg * Math.PI) / 180`. Unit tests in `dynamic-input-combine.test.ts` cover `[5, 30]`, `[5, 90]`, `[5, 0]`, `[5, -45]` from anchors (0,0) and (10,20) — all assert the polar conversion math. Gate REM6-P1-AngleUnit greps for the conversion symbol IN the helper AND verifies `EditorRoot.tsx` has ZERO conversion-symbol matches (delegation only). Field kind 'angle' is locked to degrees; future trig users (M1.3b Rotate) MUST route through the same helper. |
| Helper duplicates existing parser logic (SSOT regression; Rev-1 R1-A2) | Phase 1 step 10 mandates: helper does the COMBINATION; per-field PARSING delegates to the existing parser path in `tools/runner.ts` (re-use, do NOT duplicate). If the existing parser is inline in runner.ts, extract to a shared module that both runner and helper import. Verified during execution at the import site review. |
| Per-prompt-yield buffer reset semantics ambiguous (Rev-1 R2-A5) | Phase 1 step 3 specifies: each prompt yield with a manifest resets `dynamicInput.buffers` to `Array(N).fill('')` and `activeFieldIdx` to 0; tool teardown calls `clearDynamicInput()`. Polyline-loop iterations therefore start with empty buffers (one prompt = one input session). Verified by `tests/ui-state.test.ts` and `tests/tool-runner.test.ts`. |
| Dynamic anchor for line/polyline distance-along-leg (Rev-1 R2-A6) | A2 explicitly defers the implementation choice to execution-time: (a) re-publish the manifest each cursor-effect tick with FIXED metric coords, OR (b) declare REFERENCE descriptors (e.g., `'cursor'`, `'midpoint:p1,cursor'`) resolved at render time. Both approaches preserve the ADR-021 painter contract (DTP-T1/T2/T6/T7) and the manifest contract; choice does not affect the user-visible behavior. |
| Mockup HTML at `docs/round-6-mockup.html` is a static reference — kept or deleted? | Keep. It's a useful design artifact for future readers. Could be moved to `docs/design-mockups/round-6-di-pill.html` for cleaner organization. |
| Existing F1 directDistanceFrom path in `EditorRoot.handleCommandSubmit` interacts with the new DI submit path | F1 stays for the BOTTOM COMMAND LINE typing path (single number → polar via anchor). The new DI submit path is for typing into the per-field pills at canvas focus. Both eventually feed an Input. They don't both fire on the same Enter — keyboard router branches by which surface the user typed in (canvas focus + DI active → onSubmitDynamicInput; bar focus form submit → handleCommandSubmit which still does F1). |

## 10. §1.3 Three-round self-audit

### Round 1 — Chief Architect (boundaries, invariants, SSOT)

- **C1.1 — Per-prompt manifest declared on the Prompt contract: SSOT or contract bloat?** SSOT. The Prompt is the natural carrier — a tool's per-prompt input semantics include "what fields the DI should display". Alternative (a separate parallel registry mapping tool-id × prompt-text → manifest) would split SSOT. Co-locating is right.
- **C1.2 — `combineAs` policies: enum vs callback?** Enum (for now). Callbacks-on-prompts would let tools provide arbitrary combinator functions, but adds complexity. Enum-with-fixed-set covers M1.3d's needs (numberPair, point, number); future arities extend the enum (numberTuple, angle). YAGNI on callbacks.
- **C1.3 — `overlay.dimensionGuides` vs deriving from `commandBar.dynamicInput`?** Two-slice model: manifest declares fields with their guide shapes; runner publishes the manifest to commandBar AND the guide shapes (extracted from each field) to overlay.dimensionGuides. The painter ONLY reads overlay (consistent with other painters per I-DTP-9 / DTP-T6). The pill component reads commandBar (chrome-side). Boundary preserved.
- **C1.4 — Single fallback pill (no manifest, but accumulator/inputBuffer non-empty) — keep or drop?** Keep. The legacy DynamicInputPill behavior must survive for non-DI prompts (simple letter shortcuts, single-number inputs at the bottom command line). The new DynamicInputPills component handles 0..N pills uniformly: 0 = hidden; 1 with no manifest = legacy fallback; N with manifest = new behavior.
- **C1.5 — ADR placement (extend ADR-023 vs new ADR-024)?** **New ADR-024 ONLY.** Editing accepted ADR-023 — even a one-line "see ADR-024" pointer — violates §0.6 of the architecture contract ("ADR files: never edited after acceptance. Write a new ADR if the decision changes."). ADR-023 itself contains language at supersession (line 33-34: "this ADR's shortcut map ... SHOULD NOT be edited again") consistent with the contract rule. **ADR-024 carries the cross-reference one-way: from ADR-024's body referencing ADR-023, never the reverse direction.** ADR-023 file is NOT touched. The DI manifest is a substantive contract addition with its own invariants (per-field buffer mutual exclusion with single inputBuffer, Tab focus invariant, painter dispatch model, **angle-as-degrees → radians conversion invariant for `combineAs: 'point'`**), all documented in ADR-024. Rev-1 B1 fix (Codex Round-1 Blocker).

### Round 2 — Sceptical Reader (what would Codex flag?)

- **C2.1 — `numberPair` already exists from M1.3d-Rem-5 H1; is the manifest re-using it correctly?** Yes. The rectangle's existing F3 D Dimensions sub-flow yields a prompt with `acceptedInputKinds: ['numberPair']` and the parser path is unchanged. The new manifest for the rectangle's primary second-corner prompt adds DI graphics (witness lines + pills) on top — but the Input that lands in the runner is still `{kind: 'numberPair', a, b}`. SSOT.
- **C2.2 — Tab focus interception risk: form inputs in Layer Manager dialog could need Tab.** The router checks `commandBar.dynamicInput !== null` before intercepting. When no DI is active, Tab is not intercepted; the dialog's native Tab handling works. Only intercepted at canvas/bar focus + DI active.
- **C2.3 — Pill positioning during pan/zoom: any flicker?** Pills re-render on every overlay change (existing). The `metricToScreen` conversion is in JS; React's `transform: translate(...)` updates are GPU-accelerated. No flicker observed in M1.3d-Rem-4's single-pill pan/zoom; multi-pill is the same pattern × N.
- **C2.4 — `paintDimensionGuides` painter must NOT call `ctx.fillText` / `strokeText`.** Witness lines + dim lines + arrow ticks + arcs are pure-vector. Pill TEXT is in DOM (chrome). Gate REM6-11(b) enforces.
- **C2.5 — Per-tool migration overlap with existing F1 directDistanceFrom.** F1's `Prompt.directDistanceFrom` field stays. The DI manifest's distance field uses the same anchor under the hood. Tools declare both: directDistanceFrom (for bottom command line F1) AND dynamicInput.fields[distance].metricAnchor (for the canvas-focus DI). Same anchor, two surfaces, one Input.
- **C2.6 — Test count math.** Net-new ≈ 25-32 (Rev-1 expanded from Rev-0's ~12-15 to include the 7-test helper covering deg→rad edge cases + click-eat-with-DI smoke). Substrate breakdown: types ×1 + slice ×3 + runner ×1 (incl. buffer-reset semantics test per Rev-1 R2-A5) + painter ×3 + multi-pill ×4 + router ×5 + **combiner helper ×7** (numberPair / point at `[5,30]` / point at `[5,90]` / point at `[5,0]` / point at `[5,-45]` / number / invalid → null) ≈ 24. Per-tool generators: ×4. Smoke: **×4** (rectangle DI / line DI / circle DI / `'click is eaten while DI buffer non-empty (multi-field DI parity)'`). Theoretical sum ≈ 32; Vitest test-count grouping (some it() blocks may be table-driven and counted per-row vs per-block) yields a practical range of ~25-32. Threshold ≥480 (470 + ≥10 minimum) passes with substantial slack regardless — and per Rev-1 Q2, REM6-10 is now an informational tripwire only.
- **C2.7 — `commandBar.activePrompt` already exists; is the new `commandBar.dynamicInput` redundant?** No. activePrompt is the prompt's TEXT (string). dynamicInput is the structured per-field state (active idx + N buffers). They're orthogonal.
- **C2.8 — Angle unit invariant (Rev-1 H2 / R2-A8 / Codex Round-1 high-risk).** Typed angle values arrive as DEGREES (AC convention; user types "30" expecting 30°). `combineAs: 'point'` performs polar trig that requires RADIANS. Risk: silent unit mismatch yields a line at 30 radians (≈ 1719° wrapped) instead of 30° — geometrically wrong but not crashy, hard to catch in casual testing. **Fix: extracted pure helper `combineDynamicInputBuffers` in `tools/dynamic-input-combine.ts` as SSOT for the deg→rad conversion (`(angleDeg * Math.PI) / 180`); helper unit-tested against `[5, 30] → (5*cos(π/6), 5*sin(π/6))` plus 0°/90°/-45° edge cases and non-zero anchors; Gate REM6-P1-AngleUnit greps for the conversion symbol IN the helper file AND verifies zero matches in `EditorRoot.tsx` (delegation only — no duplication).** Field kind 'angle' is locked to degrees as a contract invariant; future trig users (e.g., M1.3b Rotate sweep) MUST route through the same helper or reuse the same constant — no mixed conventions allowed in the codebase.

### Round 3 — Blast Radius (what could break elsewhere?)

- **C3.1 — DynamicInputPill (singular) deletion: any external consumer?** Search: only EditorRoot.tsx imports it. After replacement, no orphans. Tests directly named DynamicInputPill.test.tsx → renamed to DynamicInputPills.test.tsx.
- **C3.2 — Existing M1.3d-Rem-4 G2 click-eat behavior on `commandBar.inputBuffer.length > 0` (Rev-1 H1 / Codex Round-1 high-risk).** Three guard sites in `EditorRoot.tsx` ([handleCanvasClick ~line 389](packages/editor-2d/src/EditorRoot.tsx:389), [handleCanvasMouseDown ~line 533](packages/editor-2d/src/EditorRoot.tsx:533), [handleCanvasMouseUp ~line 560](packages/editor-2d/src/EditorRoot.tsx:560)) currently check ONLY `inputBuffer.length > 0`. With DI active, `inputBuffer` may stay empty while `dynamicInput.buffers` are populated — clicks would slip through and commit unintended geometry. **Fix (Phase 1 step 12): extend each guard to also check `cb.dynamicInput !== null && cb.dynamicInput.buffers.some(b => b.length > 0)` (or call a named helper `hasNonEmptyDIBuffer(state)` that does the same).** Enforced by Gate REM6-P1-ClickEat (grep ≥3 occurrences of `dynamicInput` in `EditorRoot.tsx` AND smoke scenario `'click is eaten while DI buffer non-empty (multi-field DI parity)'`).
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

**Tests added by this round (~25-32 net-new — Rev-1 expanded from Rev-0's ~12-15 estimate to include the 7-test combiner helper covering deg→rad edge cases + click-eat-with-DI smoke; threshold gate REM6-10 still ≥480 with substantial slack):**

- **Substrate types (~1 test):** `tests/types.test.ts` (or extension to existing): manifest shape conformance.
- **Substrate slice (~3 tests):** `tests/ui-state.test.ts` — `commandBar.dynamicInput` default null; setDynamicInputManifest stores AND resets buffers to `Array(N).fill('')` (Rev-1 R2-A5); clearDynamicInput resets; setDynamicInputFieldBuffer per-index update; setDynamicInputActiveField cycles; `overlay.dimensionGuides` slice + setter.
- **Substrate runner (~1 test):** `tests/tool-runner.test.ts` — prompt with manifest publishes to slice (with buffer-reset on each yield per Rev-1 R2-A5) + clears on teardown.
- **Substrate router (~5 tests):** `tests/keyboard-router.test.ts` — Tab cycles activeFieldIdx forward; Shift+Tab cycles backward; numeric routes to active field; Backspace pops active field; Enter calls onSubmitDynamicInput.
- **Substrate painter (~3 tests):** `tests/paintDimensionGuides.test.ts` — linear-dim emits witness + dim line + ticks; angle-arc emits ctx.arc with right pivot/radius; radius-line tick or no-op.
- **Substrate chrome (~4 tests):** `tests/DynamicInputPills.test.tsx` — fallback single-pill at cursor; multi-pill rendering at metric anchors; focused pill glow + caret; pills hide when manifest cleared.
- **Substrate combiner helper (~7 tests; NEW in Rev-1 — Codex Round-1 H2 + R2-A3 edge-case coverage):** `tests/dynamic-input-combine.test.ts`:
  1. `numberPair`: `['6', '4']` → `{kind: 'numberPair', a: 6, b: 4}`.
  2. `point` deg→rad at `[5, 30]` from anchor (0,0) → `{kind: 'point', point: {x: 5*cos(π/6), y: 5*sin(π/6)}}` ≈ `(4.330, 2.500)`.
  3. `point` 90° edge case at `[5, 90]` from anchor (10, 20) → `(10, 25)` (straight up).
  4. `point` 0° edge case at `[5, 0]` from anchor (0, 0) → `(5, 0)` (horizontal-right baseline).
  5. `point` -45° negative angle at `[5, -45]` from anchor (0, 0) → `(5*cos(-π/4), 5*sin(-π/4))` ≈ `(3.535, -3.535)`.
  6. `number`: `['7']` → `{kind: 'number', value: 7}`.
  7. Invalid / empty buffer (e.g., `['', '4']` for numberPair) → `null` (caller treats as ignore-submit).
- **Per-tool generators (~4 tests):** `tests/draw-tools.test.ts` — rectangle yields 2-field linear-dim manifest with combineAs 'numberPair'; line yields linear-dim + angle-arc with combineAs 'point'; polyline yields manifest per loop with anchor = last vertex; circle yields radius-line single-field with combineAs 'number'.
- **Smoke E2E (~4 scenarios):**
  - `'rectangle DI: type 6 Tab 4 Enter commits 6×4'` (full pill flow + Tab cycle + numberPair combineAs).
  - `'line DI: type 5 Tab 30 Enter commits a 5m line at 30°'` (polar combineAs; deg→rad correctness verified end-to-end at the wired EditorRoot level).
  - `'circle DI: type 7 Enter commits a radius-7 circle'` (single-field, no Tab).
  - **`'click is eaten while DI buffer non-empty (multi-field DI parity)'` (NEW in Rev-1 — Codex Round-1 H1):** in line tool with DI active, after typing into the distance buffer, a canvas click does NOT commit a line at the click position; only Enter (via the helper-driven combineAs) commits geometry.

**Migrated existing tests (no count change):**
- DynamicInputPill.test.tsx → DynamicInputPills.test.tsx (rename + multi-pill assertions)
- Smoke scenarios `'dynamic input pill: typing a number while in line tool shows pill + Enter submits'` + `'click is eaten while inputBuffer non-empty'` — assertions updated to handle multi-pill semantics in fallback mode (these continue to exercise the legacy single-pill path; the new `'click is eaten while DI buffer non-empty'` scenario exercises the multi-field DI path).

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

**Architecture authority note:** there is no root-level `architecture.md` in this repository. The architecture authority is split across `docs/procedures/Codex/00-architecture-contract.md` (Codex's binding contract) + `docs/procedures/Claude/00-architecture-contract.md` (Claude's mirror) + the ADR set under `docs/adr/` (specifically ADR-023 "Tool state machine and command bar"; this round proposes a NEW ADR-024 "Dynamic Input manifest" — ADR-023 is NOT modified per §0.6, ADR-024 cross-references ADR-023 from its own body only / one-way).

**Mockup reference:** `docs/round-6-mockup.html` — interactive HTML showing the four UI options (rectangle minimal/full + line minimal/full). User picked "full" in chat 2026-04-28.

**Plan:** `docs/plans/feature/m1-3-di-pill-redesign.md`
**Branch:** `feature/m1-3-di-pill-redesign` (atop `1aee6b6` — main after the M1.3d merge + grip-stretch fix)
**Status:** Rev-1 authored — addresses Codex Round-1 findings (1 Blocker + 2 High-risk + 2 Quality gaps) + 7 §1.3 self-audit refinements baked in same revision; awaiting Codex Round-2 review

### Paste to Codex for plan review (Round 2)
> Review this plan using `docs/procedures/Codex/02-plan-review.md`
> (Procedure 02). Apply strict evidence mode. Start from Round 2 —
> this is Rev-1 of the plan; Round-1 returned No-Go (1 Blocker / 2
> High-risk / 2 Quality gaps); see the Revision history table at top
> of plan for the complete Rev-1 disposition.
>
> Context: M1.3 Round 6 — Dynamic Input pill redesign (AC-style
> transient-dimension-line + multi-field pills + Tab cycle). User
> approved "full" visual fidelity per the mockup at
> `docs/round-6-mockup.html`. Two phases: substrate (types + slice +
> painter + chrome + router + **`combineDynamicInputBuffers` SSOT
> helper** — Rev-1 H2 fix) then per-tool migration (rectangle / line
> / polyline / circle).
>
> Branch: `feature/m1-3-di-pill-redesign` from `main` after the M1.3d
> tag (`m1.3d`) and the grip-stretch click-sticky-click fix
> (`1aee6b6`).
>
> Spec impact: `docs/operator-shortcuts.md` 2.0.0 → 2.1.0 (Tab as
> DI-cycling key). NEW ADR-024 "Dynamic Input manifest" — first ADR
> proposed in M1.3 polish work. **ADR-023 is NOT modified** (Rev-1
> B1 fix; the Rev-0 plan's "brief note pointing at ADR-024" edit
> would have violated §0.6 immutability and is removed).
>
> Existing F1 directDistanceFrom mechanism (M1.3d-Rem-3) STAYS for
> the bottom command line typing path. The new DI manifest is the
> multi-field enhanced path at canvas focus. Both surfaces feed the
> same Input arms; legacy single-pill path stays for non-DI prompts.
>
> Rev-1 also: extracts `combineDynamicInputBuffers` as SSOT helper
> in `tools/dynamic-input-combine.ts` (deg→rad conversion lives
> there only — Rev-1 H2); extends click-eat guards at 3 sites in
> `EditorRoot.tsx` to OR-check DI buffers (Rev-1 H1); replaces all
> prompt-text greps in Phase-1/2 gates with structural symbol greps
> (Rev-1 Q1); demotes REM6-10 test-count gate to informational
> tripwire (Rev-1 Q2).

### Paste to user for approval
> Please review the plan at
> `docs/plans/feature/m1-3-di-pill-redesign.md`. After approval,
> invoke Procedure 03 to execute Phase 1 (substrate) then Phase 2
> (per-tool migration).
