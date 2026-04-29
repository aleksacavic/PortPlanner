# Plan — M1.3 canvas-token sweep + DI pill polish (buffer persistence + hover overflow tooltip)

**Branch:** `feature/m1-3-canvas-tokens-and-di-polish`
**Author:** Claude
**Date:** 2026-04-29

## Revision history

| Rev | Date | Trigger | Changes |
|---|---|---|---|
| 1 | 2026-04-29 | Initial draft after M1.3 Round 6 + Round-2 + Round-3 remediation merged to `main` (commit `291ec68`). User-locked scope: full painter token sweep (option B), buffer persistence within-tab + per-prompt-identity + dim-placeholder mechanic, hover tooltip on overflow only with value+unit content, three phases bundled into one plan. |
| 2 | 2026-04-29 | §1.4.1 plan-vs-code grounding pass + §1.3 self-audit revealed four issues: (a) Phase 1 step 1 hand-waved an "audit at execution time" — replaced with explicit enumeration of every numeric chrome constant in §4.1 + §9; (b) `parseDashPattern` is duplicated across THREE painters (paintCrosshair, paintHoverHighlight, paintSelectionRect) — consolidation into the new `_tokens.ts` helper added as explicit Phase 1 step (was implicit); (c) `paintTransientLabel` has TWO numeric chrome constants (`FONT_PX_CSS = 11`, `CORNER_RADIUS_CSS = 4`) — `transient_label_font_size` token added; the original plan only mentioned `transient_label_radius`; (d) the original DIM_OFFSET_CSS module-load-time evaluation pattern was fragile (`parseNumericToken(dark.canvas.transient.dim_witness_offset)` evaluated at import time would crash on any malformed token at module load). Replaced with literal-in-painter + mirrored-token + unit-test-asserts-equal approach: keep `export const DIM_OFFSET_CSS = 40` literal, add `dim_witness_offset: '40'` to dark theme, gate REM7-P1-DimOffsetMirror asserts they stay in sync. SSOT enforced by assertion, not by import-time coupling. |
| 3 | 2026-04-29 | Codex Procedure 02 Round-1 review (3 Blockers + 3 High-risks). **B1:** I-BPER-1 "no serialization" claim relied on narrative; added grep gate REM7-P2-NoPersistenceLeak. **B2:** Phase 3 overflow tooltip tests under-specified for JSDOM `scrollWidth` / `clientWidth`; added explicit `Object.defineProperty` stubbing requirement + REM7-P3-OverflowDeterministic gate. **B3:** §1.4.1 grounding evidence missing from plan body (was only in chat §1.13); embedded the full grounding table at new §3.1. **H1:** `getPersistedBuffers` action-vs-helper drift — collapsed to single mutator action `recordSubmittedBuffers`; reads happen inline at call sites (no parallel selector helper). Naming convention codified in §3 A15. **H2:** scope-table `${toolId}:${promptKey}` recursive typo — corrected to canonical expression `${toolId}:${prompt.persistKey ?? promptIndex}` (matches I-BPER-2). Section-consistency pass per §1.16.12 confirms the canonical expression appears verbatim in scope, phase, invariants, risks, and audit — zero stale forms. **H3:** parseNumericToken / parseDashPattern negative-input tests added to Phase 1 step 3 with explicit error-throw assertions + new Gate REM7-P1-ParseHelperNegative. |

## 1. Request summary

Three small DI-polish features deferred from M1.3 Round 6 (`docs/plans/feature/m1-3-di-pill-redesign.md` §A10 + §2) ship together with the canvas-painter design-token sweep:

1. **Canvas painter design-token sweep.** All editor-2d canvas painters currently hard-code numeric chrome constants (witness offset, dash patterns, end-cap sizes, crosshair pickbox, hover stroke width, etc.) and read color/dash strings from `canvas.transient.*` tokens. This phase migrates every numeric constant to a token in the same `canvas.transient.*` namespace + adds dim-guide-specific tokens. No behavior change for users.
2. **Buffer persistence across tool re-invocations.** Per-prompt buffers persist within the current tab so re-invoking the same tool shows previously-typed values as dim placeholder defaults. AC parity. Lost on reload (no IndexedDB schema work this round).
3. **Hover tooltip on DI pills (overflow only).** When a pill's text overflows its rendered width, hovering shows a tooltip with the full value + unit suffix.

Single plan, three sequential phases. Tokens land first because both downstream phases consume token reads.

## 2. Out of scope (deferred / not addressed in this round)

- **Cross-session buffer persistence (IndexedDB schema bump).** Buffers are tab-local. AC's "previous value as default" UX is preserved within-tab; reload starts empty.
- **Right-click pill context menu** (Copy / Reset / Lock-field). Original deferred-list item; deferred again — needs UX design before implementation.
- **Tooltip on always-visible pills** (non-overflow). Only overflow triggers; short-text pills don't get a redundant tooltip.
- **`combineAs: 'numberTuple'` arm** (arity > 2). Lazy-add when a consumer lands (likely M1.3b Array operator).
- **`draw-arc` DI migration**. Needs separate sweep-vs-radius design call; defer to M1.3b alongside sub-option-driven modify ops.
- **Light theme.** `canvas.transient.*` only has a dark theme today (M1 design-tokens.md decision). New tokens added in dark theme only.
- **Validation/clamp on grid params from saved projects** (the "ugly grid on load" issue surfaced during planning). Out of scope for this plan; tracked as a separate one-off bug fix.

## 3. Assumptions and scope clarifications

User-confirmed in chat 2026-04-29:

- **A1 — Token sweep scope: option B (all painters).** Every painter that hardcodes a numeric chrome constant (offset, padding, dash pattern, stroke width, pickbox size, etc.) reads from a token instead. Painters that already read all chrome from tokens stay as-is. Color tokens are unchanged where they exist; only numeric constants get new tokens.
- **A2 — Buffer persistence: option (b) within-tab.** Buffers held in `editorUiStore.commandBar.lastSubmittedBuffers: Record<string, string[]>` keyed by prompt-identity. No IndexedDB persistence; reload clears.
- **A3 — Buffer identity: per-prompt.** Identity key = `${toolId}:${promptIndex}` for fixed-arity tools (line / rectangle / circle / xline). Polyline's loop iterations all share `${toolId}:next-vertex` (single key) since each iteration is semantically the same prompt. No prompt-text hashing.
- **A4 — Buffer apply mechanic: dim placeholder.** Pill renders the persisted value greyed-out; typing replaces from cursor position; Tab cycles to next field; Enter accepts the placeholder if buffer is empty. AC parity.
- **A5 — Hover tooltip trigger: overflow only.** Pill chrome measures rendered text width vs container width on hover; if overflow, render the tooltip via portal at pill anchor + screen offset. Otherwise no tooltip.
- **A6 — Hover tooltip content: value + unit suffix.** "5 m" / "30°" — unit derived from the manifest field `kind` (`'distance'` → " m", `'angle'` → "°", `'number'` → no unit). Field label not included (label is already shown in the pill itself).
- **A7 — Token namespace.** New numeric tokens live in `canvas.transient.*` (extending the existing namespace) under per-painter sub-buckets. New dim-guide-specific tokens live at `canvas.transient.dim_*`. Numeric values stored as string leaves to preserve the `Color` (string) type contract per the existing `label_padding: '3'`, `preview_dash: '6 4'` precedent.
- **A8 — Theme propagation.** Tokens added to `semantic-dark.ts` only. The `SemanticTokens` interface in `themes.ts` is extended additively. No light theme work this round (out of M1 scope per `docs/design-tokens.md`).
- **A9 — Migration is mechanical.** Each painter constant maps 1:1 to a new token with the same numeric value. No design-decision shifts. Refactor-only.
- **A10 — Substrate phase order.** Phase 1 (tokens) lands first because Phases 2 and 3 add new constants that should themselves be tokenised. No phase 2/3 painter edits without tokens already in place.
- **A11 — `paintPoint` exception.** `paintPoint.ts` has a single `POINT_RADIUS_PX = 2` constant. POINT is rendered as an entity (uses layer `style.color`, not `canvas.transient.*`). Tokenising entity-specific constants is out of scope per ADR rationale (entity styling lives in layers / ADR-017, not transient overlay tokens). `paintPoint` is the only entity-pass painter with a numeric chrome constant; left as-is. All other painters touched are overlay painters reading from `transient`.
- **A12 — DIM_OFFSET_CSS export pattern (Rev-2 lock-in).** The exported `DIM_OFFSET_CSS = 40` constant in [paintDimensionGuides.ts](packages/editor-2d/src/canvas/painters/paintDimensionGuides.ts) is consumed at module load by tools that don't have access to the live `tokens` parameter (line / polyline / rectangle / circle each `import { DIM_OFFSET_CSS }`). Original plan revision 1 proposed evaluating `parseNumericToken(dark.canvas.transient.dim_witness_offset)` at module top-level — this couples `editor-2d` import-time to design-system bundle being parseable, and any malformed token value would crash editor-2d at load. Rev-2 lock: keep the literal `export const DIM_OFFSET_CSS = 40`, mirror the same value in `dim_witness_offset: '40'` on `semantic-dark.ts`, and add a unit test (Gate REM7-P1-DimOffsetMirror) asserting `DIM_OFFSET_CSS === parseNumericToken(dark.canvas.transient.dim_witness_offset)`. SSOT is enforced by the equality assertion at test time; runtime stays decoupled. Same pattern applies to any future numeric token whose value is read by tools at module import (none currently — only DIM_OFFSET_CSS).
- **A13 — `parseDashPattern` consolidation (Rev-2 finding).** Three painters currently maintain identical local copies of `parseDashPattern(token: string): number[]` (paintCrosshair:96, paintHoverHighlight:37, paintSelectionRect:55). `paintTransientLabel` has a sibling `parsePadding(token: string): number` doing the equivalent for single-number tokens (paintTransientLabel:137). Phase 1 consolidates all four into `_tokens.ts` exporting `parseDashPattern` + `parseNumericToken`. Per-painter local copies removed. Gate REM7-P1-NoLocalParseHelper asserts zero matches for the local function definitions in painter files.
- **A14 — Sub-namespace structure.** New tokens that are painter-specific (e.g., snap-glyph sizes for the 6 snap kinds) cluster under a sub-namespace `canvas.transient.snap_glyph.*` per the existing precedent of `canvas.transient.selection_window.*` / `canvas.transient.selection_crossing.*` / `canvas.transient.hover_highlight.*`. Cross-painter shared tokens (e.g., `dim_*` overlay-wide stroke widths) sit at `canvas.transient.*` top level. The grouping makes the token catalogue navigable.
- **A15 — Slice action vs selector naming convention (Rev-3 lock per Codex H1).** `editorUiActions` carries **mutators only** — every entry sets state. Reads happen at call sites via `editorUiStore.getState()`. There are no "selector helpers" co-located with actions. The single new entry on `editorUiActions` for buffer persistence is `recordSubmittedBuffers(promptKey: string, buffers: string[]): void` (mutator). Consumers that need to read persisted buffers do so inline: `editorUiStore.getState().commandBar.lastSubmittedBuffers[promptKey] ?? null`. This matches the existing convention (e.g., `setDynamicInputManifest` is on `editorUiActions`; reads of `commandBar.dynamicInput` happen at call sites — `editorUiStore.getState().commandBar.dynamicInput` — never via a `getDynamicInput` helper).
- **A16 — Canonical promptKey expression.** The buffer-persistence identity key is **always** computed as `${toolId}:${prompt.persistKey ?? promptIndex}` where `toolId` comes from the runner's closure (see `runner.ts:32` / `:38`) and `promptIndex` is the zero-based index of the prompt within the tool generator's yield sequence. This expression appears verbatim in I-BPER-2, the Phase 2 step 3 detail, the runner-row of §4.1, the §13 risk row, and audit C-points — Codex H2 fix (the original Rev-1 scope-row had a recursive typo `${toolId}:${promptKey}` that has been corrected).

## 3.1 Plan-vs-Code Grounding Table (§1.4.1, embedded per Codex Round-1 B3)

Every plan claim that names a specific code construct was grounded by reading the cited file at plan-authoring time. Match status: Match / Partial / Mismatch. Partial = grep-confirmed but full file walk deferred to execution Phase step.

| # | Plan claim | File:line | Observed shape | Match |
|---|-----------|-----------|----------------|-------|
| 1 | `STROKE_WIDTH_CSS=1` + `PICKBOX_HALF_CSS=5` constants in paintCrosshair | [paintCrosshair.ts:33-34](packages/editor-2d/src/canvas/painters/paintCrosshair.ts:33) | `const STROKE_WIDTH_CSS = 1;` `const PICKBOX_HALF_CSS = 5;` | Match |
| 2 | `STROKE_WIDTH_CSS=1` in paintHoverHighlight + reads `transient.hover_highlight.{stroke,dash}` | [paintHoverHighlight.ts:17 + :25-32](packages/editor-2d/src/canvas/painters/paintHoverHighlight.ts:17) | `const STROKE_WIDTH_CSS = 1;` and `tokens.canvas.transient.hover_highlight` destructured | Match |
| 3 | `FONT_PX_CSS=11` + `CORNER_RADIUS_CSS=4` in paintTransientLabel; reads `label_padding` token via local `parsePadding` | [paintTransientLabel.ts:37-38, :85, :137](packages/editor-2d/src/canvas/painters/paintTransientLabel.ts:37) | Constants present at lines 37-38; `parsePadding(tokens.canvas.transient.label_padding)` at :85; helper definition at :137 | Match |
| 4 | 4 selection constants (OUTLINE_STROKE_CSS=1.5, GRIP_SIDE_CSS=7, GRIP_HOVERED_SIDE_CSS=9, GRIP_BORDER_CSS=1) | [paintSelection.ts:25-28](packages/editor-2d/src/canvas/painters/paintSelection.ts:25) | All four constants present at the cited lines | Match |
| 5 | `STROKE_WIDTH_CSS=1` in paintSelectionRect + local `parseDashPattern` | [paintSelectionRect.ts:18, :55-62](packages/editor-2d/src/canvas/painters/paintSelectionRect.ts:18) | Constant present at :18; helper at :55 | Match |
| 6 | 7 snap-glyph constants (ENDPOINT/MIDPOINT/INTERSECTION/NODE/GRID_NODE/GRID_LINE sizes + STROKE_CSS_PX) | [paintSnapGlyph.ts:30-36](packages/editor-2d/src/canvas/painters/paintSnapGlyph.ts:30) | All seven constants present at cited lines | Match |
| 7 | paintDimensionGuides 4 module-level + 1 inline `[2,3]` + 1 inline `100` + exported `DIM_OFFSET_CSS=40` | [paintDimensionGuides.ts:37-57](packages/editor-2d/src/canvas/painters/paintDimensionGuides.ts:37) | `STROKE_WIDTH_CSS=1`, `ARROW_TICK_CSS=6`, `WITNESS_OVERSHOOT_CSS=3`, `WITNESS_ENDCAP_CSS=4` at module scope; `export const DIM_OFFSET_CSS = 40` at :51; `DASHED_PATTERN_CSS: [2,3]` at :57 | Match |
| 8 | `paintGrid` `lineWidth = 1 / metricToPx` inline | [paintGrid.ts:24](packages/editor-2d/src/canvas/painters/paintGrid.ts:24) | `ctx.lineWidth = 1 / metricToPx;` | Match |
| 9 | `STROKE_WIDTH_CSS=1` in paintPreview module scope (single grep hit) | [paintPreview.ts:28](packages/editor-2d/src/canvas/painters/paintPreview.ts:28) | `const STROKE_WIDTH_CSS = 1;` | Match (Phase 1 step 5 walks file to confirm no missed sub-constants) |
| 10 | `commandBar.dynamicInput` shape `{ manifest, buffers, activeFieldIdx } \| null` | [store.ts:145-149](packages/editor-2d/src/ui-state/store.ts:145) | Type matches verbatim | Match |
| 11 | `setDynamicInputManifest` resets buffers to `Array(N).fill('')` | [store.ts:508-515](packages/editor-2d/src/ui-state/store.ts:508) | `buffers: Array<string>(manifest.fields.length).fill('')` at :512 | Match |
| 12 | Runner manifest publication: `if (prompt.dynamicInput) { setDynamicInputManifest(...) }` | [runner.ts:145-149](packages/editor-2d/src/tools/runner.ts:145) | Branch present verbatim; `else` branch calls `clearDynamicInput()` | Match |
| 13 | `startTool(toolId, factory): RunningTool` exposes `toolId` in closure scope | [runner.ts:32, :38](packages/editor-2d/src/tools/runner.ts:32) | Type signature matches; `toolId` referenced inside closure at :120, :199, :206 | Match |
| 14 | `EditorRoot.tsx onSubmitDynamicInput` callback exists | [EditorRoot.tsx:186](packages/editor-2d/src/EditorRoot.tsx:186) | `onSubmitDynamicInput: (manifest, buffers) => { ... }` callback present | Match |
| 15 | Three painters carry duplicate `parseDashPattern` definitions | paintCrosshair.ts:96, paintHoverHighlight.ts:37, paintSelectionRect.ts:55 | All three present with the same `'solid'` sentinel + whitespace-split + finite-filter logic | Match |
| 16 | `Prompt.persistKey?: string` is NEW (not currently in interface) | [types.ts](packages/editor-2d/src/tools/types.ts) Prompt interface | Confirmed absent (introduced by this plan) | Match — additive |

## 4. Scope

### 4.1 In scope — files modified

| Path | Change |
|---|---|
| `packages/design-system/src/tokens/themes.ts` | Extend `TransientTokens` interface with the explicit leaves listed in the **Token additions table** below (Rev-2 enumeration replaces the Rev-1 partial list). Each leaf is a `Color` (string) per the existing emitter contract; numeric values are stored as decimal strings (`'40'`, `'1.5'`). Each new leaf has a TSDoc comment describing the unit (CSS-px / metric / dash-pattern / dpr-multiple) and the consumer painter(s). |
| `packages/design-system/src/tokens/semantic-dark.ts` | Populate every new leaf with the current numeric value being migrated (1:1 — `'40'`, `'1.5'`, `'2 3'`, etc.). |
| `packages/design-system/src/tokens/css-vars.ts` | No code change expected; the emitter walks the `TransientTokens` object recursively and auto-emits CSS variables for the new leaves. Verified during execution by spot-checking the generated `:root` block. |
| `packages/editor-2d/src/canvas/painters/paintDimensionGuides.ts` | Replace 4 module-level constants (`STROKE_WIDTH_CSS=1`, `ARROW_TICK_CSS=6`, `WITNESS_OVERSHOOT_CSS=3`, `WITNESS_ENDCAP_CSS=4`) + 1 inline `[2,3]` dash-pattern + 1 inline `100` polar-baseline-min with `parseNumericToken(transient.dim_*)` / `parseDashPattern(transient.dim_dashed_pattern)` reads. The `export const DIM_OFFSET_CSS = 40` literal STAYS in this file (per A12); it is mirrored by the new `dim_witness_offset: '40'` token + Gate REM7-P1-DimOffsetMirror asserts equality. |
| `packages/editor-2d/src/canvas/painters/paintCrosshair.ts` | Replace 2 constants (`STROKE_WIDTH_CSS=1`, `PICKBOX_HALF_CSS=5`) with token reads. Remove the local `parseDashPattern` definition (lines 96-102) — import from `_tokens.ts`. |
| `packages/editor-2d/src/canvas/painters/paintHoverHighlight.ts` | Replace 1 constant (`STROKE_WIDTH_CSS=1`) with `transient.hover_highlight.stroke_width` (sub-namespace per A14). Remove the local `parseDashPattern` definition (lines 37-44) — import from `_tokens.ts`. |
| `packages/editor-2d/src/canvas/painters/paintSelection.ts` | Replace 4 constants: `OUTLINE_STROKE_CSS=1.5` → `transient.selection_outline_width`; `GRIP_SIDE_CSS=7` → `transient.grip.side`; `GRIP_HOVERED_SIDE_CSS=9` → `transient.grip.hovered_side`; `GRIP_BORDER_CSS=1` → `transient.grip.border_width`. |
| `packages/editor-2d/src/canvas/painters/paintSelectionRect.ts` | Replace 1 constant (`STROKE_WIDTH_CSS=1`) with `transient.selection_window.stroke_width` (the existing `selection_window` / `selection_crossing` sub-namespaces both gain `stroke_width`). Remove the local `parseDashPattern` definition (lines 55-62) — import from `_tokens.ts`. |
| `packages/editor-2d/src/canvas/painters/paintSnapGlyph.ts` | Replace 7 constants with a `transient.snap_glyph.*` sub-namespace (per A14): `endpoint_side`, `midpoint_side`, `intersection_half`, `node_radius`, `grid_node_half`, `grid_line_half`, `stroke_width`. |
| `packages/editor-2d/src/canvas/painters/paintTransientLabel.ts` | Replace 2 module-level constants (`FONT_PX_CSS=11`, `CORNER_RADIUS_CSS=4`) with `transient.label_font_size` / `transient.label_radius`. The existing `label_padding` token continues to be read; remove the local `parsePadding` helper — import `parseNumericToken` from `_tokens.ts`. |
| `packages/editor-2d/src/canvas/painters/paintPreview.ts` | Replace 1 module-level constant (`STROKE_WIDTH_CSS=1`) with `transient.preview_stroke_width`. |
| `packages/editor-2d/src/canvas/painters/paintGrid.ts` | Replace `ctx.lineWidth = 1 / metricToPx` with `parseNumericToken(transient.grid_stroke_width) / metricToPx`. Add `transient.grid_stroke_width: '1'` token. |
| `packages/editor-2d/src/ui-state/store.ts` | Add `commandBar.lastSubmittedBuffers: Record<string, string[]>` slice field + a single mutator action `recordSubmittedBuffers(promptKey, buffers)` on `editorUiActions` (Codex H1: only mutators live on `editorUiActions`; reads happen inline via `editorUiStore.getState().commandBar.lastSubmittedBuffers[promptKey] ?? null` at the call site — no parallel "selector helper" function added). Initial state: `{}`. |
| `packages/editor-2d/src/tools/runner.ts` | On manifest publication (existing prompt-yield branch), build a stable `promptKey = ${toolId}:${prompt.persistKey ?? promptIndex}` (canonical expression, see I-BPER-2). Polyline tools set `persistKey: 'next-vertex'` so all loop iterations share one key. |
| `packages/editor-2d/src/tools/types.ts` | Add `Prompt.persistKey?: string` field — optional stable identifier for buffer-persistence. When unset, runner derives from prompt index. |
| `packages/editor-2d/src/tools/draw/draw-polyline.ts` | Set `persistKey: 'next-vertex'` on the per-loop prompt so buffer state persists across loop iterations within a single tool session AND across tool re-invocations. |
| `packages/editor-2d/src/chrome/DynamicInputPills.tsx` | Read persisted buffer for the active prompt; render dim placeholder when active buffer is empty. New constant `PILL_PLACEHOLDER_OPACITY = 0.45` (also tokenised). Hover handler: on `mouseEnter` measure `scrollWidth > clientWidth`; if overflow, render tooltip via portal + `mouseLeave` clears. New `<div className={styles.tooltip}>` element. |
| `packages/editor-2d/src/chrome/DynamicInputPills.module.css` | New `.pillPlaceholder` (dim color via opacity); new `.tooltip` (positioned absolute, small backdrop, value+unit text). |
| `packages/editor-2d/src/EditorRoot.tsx` | On successful DI submit (existing `onSubmitDynamicInput` callback path), call `recordSubmittedBuffers(promptKey, buffers)` BEFORE `clearDynamicInput()` so the values are captured for next invocation. |
| `packages/editor-2d/tests/ui-state.test.ts` | New tests for the slice: default `{}`; `recordSubmittedBuffers` stores; reading `editorUiStore.getState().commandBar.lastSubmittedBuffers[promptKey]` returns `undefined` for unknown keys and the stored array for known keys (no helper function exercised — A15 lock). |
| `packages/editor-2d/tests/tool-runner.test.ts` | New test: prompt with `persistKey` propagates to manifest publication (verify via overlay state inspection at yield time). |
| `packages/editor-2d/tests/DynamicInputPills.test.tsx` | New tests: dim placeholder renders when buffer empty + persisted value present; placeholder has `data-pill-placeholder="true"` attribute; tooltip renders only on overflow + correct unit suffix per field kind. |
| `packages/editor-2d/tests/draw-tools.test.ts` | Polyline test asserts `persistKey: 'next-vertex'` on the next-vertex prompt. |
| `packages/editor-2d/tests/smoke-e2e.test.tsx` | New scenario: `'line DI: typed 5 / 30 → Esc → re-invoke L → pills show dim placeholder defaults'`. |
| `packages/editor-2d/tests/painter-token-migration.test.ts` | NEW. Per painter, mount a recorder ctx + a faux viewport + the dark token bundle; assert `ctx.lineWidth` / `setLineDash` calls match the expected token values. Locks the migration so a token rename or value change can't silently regress. |
| `docs/design-tokens.md` | Bump version (e.g., 1.x → 1.y additive); add changelog line listing the new `canvas.transient.*` numeric tokens; document the string-leaf convention for numeric values + `parseNumericToken` helper pattern. |
| `docs/operator-shortcuts.md` | No change — no shortcut surface added or removed. |

### 4.1.1 Token additions table (Rev-2 explicit enumeration)

The following tokens are added to `canvas.transient.*` in `themes.ts` interface + `semantic-dark.ts` value population. All leaf types are `Color` (string) per the existing emitter contract.

| Path | Value | Replaces (file:line) | Unit |
|---|---|---|---|
| `dim_stroke_width` | `'1'` | paintDimensionGuides.ts:37 `STROKE_WIDTH_CSS` | CSS-px |
| `dim_arrow_tick` | `'6'` | paintDimensionGuides.ts:38 `ARROW_TICK_CSS` | CSS-px |
| `dim_witness_overshoot` | `'3'` | paintDimensionGuides.ts:40 `WITNESS_OVERSHOOT_CSS` | CSS-px |
| `dim_witness_offset` | `'40'` | paintDimensionGuides.ts:51 `DIM_OFFSET_CSS` (mirrored — see A12) | CSS-px |
| `dim_witness_endcap` | `'4'` | paintDimensionGuides.ts:55 `WITNESS_ENDCAP_CSS` | CSS-px |
| `dim_dashed_pattern` | `'2 3'` | paintDimensionGuides.ts:57 `DASHED_PATTERN_CSS` | space-separated dash array |
| `dim_polar_min_length` | `'100'` | paintDimensionGuides.ts inline `100` (POLAR_REF_MIN_CSS) | CSS-px |
| `crosshair_stroke_width` | `'1'` | paintCrosshair.ts:33 `STROKE_WIDTH_CSS` | CSS-px |
| `crosshair_pickbox_half` | `'5'` | paintCrosshair.ts:34 `PICKBOX_HALF_CSS` | CSS-px |
| `hover_highlight.stroke_width` | `'1'` | paintHoverHighlight.ts:17 `STROKE_WIDTH_CSS` | CSS-px |
| `selection_outline_width` | `'1.5'` | paintSelection.ts:25 `OUTLINE_STROKE_CSS` | CSS-px |
| `grip.side` | `'7'` | paintSelection.ts:26 `GRIP_SIDE_CSS` | CSS-px |
| `grip.hovered_side` | `'9'` | paintSelection.ts:27 `GRIP_HOVERED_SIDE_CSS` | CSS-px |
| `grip.border_width` | `'1'` | paintSelection.ts:28 `GRIP_BORDER_CSS` | CSS-px |
| `selection_window.stroke_width` | `'1'` | paintSelectionRect.ts:18 `STROKE_WIDTH_CSS` (shared with crossing) | CSS-px |
| `selection_crossing.stroke_width` | `'1'` | paintSelectionRect.ts:18 (same constant — both sub-namespaces gain the field) | CSS-px |
| `snap_glyph.endpoint_side` | `'8'` | paintSnapGlyph.ts:30 `ENDPOINT_SIDE_CSS` | CSS-px |
| `snap_glyph.midpoint_side` | `'8'` | paintSnapGlyph.ts:31 `MIDPOINT_SIDE_CSS` | CSS-px |
| `snap_glyph.intersection_half` | `'5'` | paintSnapGlyph.ts:32 `INTERSECTION_HALF_CSS` | CSS-px |
| `snap_glyph.node_radius` | `'5'` | paintSnapGlyph.ts:33 `NODE_RADIUS_CSS` | CSS-px |
| `snap_glyph.grid_node_half` | `'4'` | paintSnapGlyph.ts:34 `GRID_NODE_HALF_CSS` | CSS-px |
| `snap_glyph.grid_line_half` | `'3'` | paintSnapGlyph.ts:35 `GRID_LINE_HALF_CSS` | CSS-px |
| `snap_glyph.stroke_width` | `'1.5'` | paintSnapGlyph.ts:36 `STROKE_CSS_PX` | CSS-px |
| `label_font_size` | `'11'` | paintTransientLabel.ts:37 `FONT_PX_CSS` | CSS-px |
| `label_radius` | `'4'` | paintTransientLabel.ts:38 `CORNER_RADIUS_CSS` | CSS-px |
| `preview_stroke_width` | `'1'` | paintPreview.ts:28 `STROKE_WIDTH_CSS` | CSS-px |
| `grid_stroke_width` | `'1'` | paintGrid.ts:24 inline `1` divisor | CSS-px |
| `pill_placeholder_opacity` | `'0.45'` | NEW — Phase 2 dim-placeholder (no current consumer) | unitless 0..1 |

**Total new leaves: 28.** (Some are sub-namespace additions to existing buckets — `selection_window.stroke_width` and `selection_crossing.stroke_width` slot into the existing sub-objects; same for `hover_highlight.stroke_width`. New sub-namespaces `grip` and `snap_glyph` are introduced.)

### 4.2 In scope — files created

- `packages/editor-2d/src/canvas/painters/_tokens.ts` — small helper module exporting `parseNumericToken(s: string): number` (parses `'3'` → `3`, `'6 4'` → throws — caller uses `parseDashPattern` for dash arrays). Co-located with painters per GR-3 (helper serves only `canvas/painters/*`).
- `packages/editor-2d/tests/painter-token-migration.test.ts` — see above.

### 4.3 Files deleted

None.

### 4.4 Out of scope (deferred)

See §2.

### 4.5 Blast radius

- **Painters (canvas/painters/*.ts):** every overlay painter touched to swap numeric constants for token reads. Mechanical refactor; no behavior change. Risk = typo in a token name → painter throws or paints wrong; mitigated by Phase 1 token-migration test which asserts every painter's `ctx.lineWidth` / dash / etc. matches the dark token bundle.
- **Design system (`packages/design-system`):** additive only. `TransientTokens` interface gets new leaves with default values. Existing consumers unaffected. CSS variable emitter handles new leaves automatically.
- **State slice (`packages/editor-2d/src/ui-state/store.ts`):** new field `lastSubmittedBuffers` is additive; default `{}`; existing consumers unaffected.
- **Tool runner / Prompt interface:** new optional `Prompt.persistKey?: string` field — additive. Existing tools without the field fall back to prompt-index identity.
- **Pill chrome:** larger change — placeholder rendering + tooltip on overflow. Both gated by data attributes for test access; failure mode is degradation (no placeholder / no tooltip), not crash.
- **EditorRoot:** one new line of code (`recordSubmittedBuffers` call) inside the existing onSubmitDynamicInput handler. Trivial.

### 4.6 Binding specifications touched

- `docs/design-tokens.md` — version bump, additive changelog entry.
- ADR-025 (DI manifest v2) — extended additively by Phase 2 (buffer persistence is a new contract layer on top of the manifest, not a change to the manifest itself). The `Prompt.persistKey` field is documented in this plan + a footnote in ADR-025; no new ADR needed because no existing decision is changed.
- `docs/operator-shortcuts.md` — no change.

## 5. Architecture Doc Impact

| Doc | Change | Why |
|---|---|---|
| `docs/design-tokens.md` | Version bump (1.x → 1.y additive) + changelog line listing the new `canvas.transient.*` numeric tokens (`dim_witness_offset`, `dim_witness_overshoot`, etc.) + a one-paragraph note on the string-leaf convention for numeric values. | Tokens are a binding spec; every new token must be documented per arch-contract §0.5. |
| ADR-025 (Dynamic Input Manifest v2) | Footnote (NOT edited; ADRs are immutable per §0.6). The plan file documents the `Prompt.persistKey` contract — buffer persistence sits on top of the manifest, not inside it. | No existing decision in ADR-025 is changed; persistence is a new contract layer. Per-prompt buffer keys are deterministic from the manifest + tool. |

No new ADR is needed. No existing ADR is modified. No deviation from any binding spec.

## 6. Deviations from binding specifications (§0.7)

None. The plan is additive on top of ADR-025 and design-tokens.md; no existing decisions are reversed.

## 7. Object Model and Extraction Integration

Not applicable. This plan touches only editor-2d chrome / canvas / state / design tokens. No object model or extraction registry changes.

## 8. Hydration, Serialization, Undo/Redo, Sync

- **Hydration (document load):** unchanged. `lastSubmittedBuffers` is editor-UI state, not project state; not loaded with the project document.
- **Serialization (document save):** unchanged. `lastSubmittedBuffers` is not persisted; lives only in the in-memory `editorUiStore` slice.
- **Undo/Redo:** unchanged. Buffer recording is not an undoable action (it does not mutate the project document; it is editor-UI state).
- **Sync:** unchanged.

## 9. Implementation phases

### Phase 1 — Canvas painter token sweep

#### Phase 1 Goal

Migrate every overlay painter's hardcoded numeric chrome constant to a `canvas.transient.*` token. Zero behavior change; refactor-only. After this phase, `rg "_CSS\s*=\s*\d+|_PX\s*=\s*\d+" packages/editor-2d/src/canvas/painters/` returns matches only in `paintPoint.ts` (entity painter, out of scope per A11) and helper-internal constants.

#### Phase 1 Files affected

See §4.1 first 13 rows + §4.2.

#### Phase 1 Steps

1. **Extend `TransientTokens` interface** in `packages/design-system/src/tokens/themes.ts` with every new leaf listed in the §4.1.1 Token additions table. Each leaf has a TSDoc comment describing the unit and the consumer painter(s). New sub-namespaces (`grip`, `snap_glyph`) introduced as nested object types; existing sub-namespaces (`hover_highlight`, `selection_window`, `selection_crossing`) gain new sibling fields.
2. **Populate `semantic-dark.ts`** with every new leaf at the value listed in the §4.1.1 table (1:1 with the painter constants being migrated). TypeScript's exhaustive object check catches any missed leaf at compile time.
3. **Create `_tokens.ts` helper** at `packages/editor-2d/src/canvas/painters/_tokens.ts`. Exports two functions:
   - `parseNumericToken(s: string): number` — `Number(s.trim())` + `Number.isFinite` guard; throws `new Error('parseNumericToken: invalid value "${s}"')` on failure (NaN, empty after trim, `Infinity`).
   - `parseDashPattern(s: string): number[]` — handles `'solid'` sentinel + empty string (returns `[]`); otherwise splits on whitespace, parses each, filters non-finite. (Verbatim port of the three existing duplicates.)
   - **Negative-input test coverage (Codex H3 fix):** alongside the helpers, add `packages/editor-2d/tests/_tokens.test.ts` with explicit negative-path assertions:
     - `parseNumericToken('')` → throws `Error` matching `/invalid value/`.
     - `parseNumericToken('  ')` → throws.
     - `parseNumericToken('40px')` → throws (not pure number).
     - `parseNumericToken('NaN')` → throws.
     - `parseNumericToken('Infinity')` → throws.
     - `parseNumericToken('40')` → returns `40`; `parseNumericToken('1.5')` → returns `1.5`.
     - `parseDashPattern('')` → `[]`; `parseDashPattern('solid')` → `[]`.
     - `parseDashPattern('6 4')` → `[6, 4]`.
     - `parseDashPattern('6 nope 4')` → `[6, 4]` (filters non-finite).
     - `parseDashPattern('   ')` → `[]`.
   - Gate REM7-P1-ParseHelperNegative asserts every negative path test passes.
4. **Consolidate the `parseDashPattern` duplicates.** Per A13: remove the local definitions in `paintCrosshair.ts:96-102`, `paintHoverHighlight.ts:37-44`, `paintSelectionRect.ts:55-62`. Each painter `import { parseDashPattern } from './_tokens';` instead. Same for `parsePadding` in `paintTransientLabel.ts:137-140` — replace with `parseNumericToken`.
5. **Migrate each painter** in this order (least-to-most-coupled to keep blast radius small per file):
   - `paintGrid.ts` — single `1 / metricToPx` becomes `parseNumericToken(transient.grid_stroke_width) / metricToPx`.
   - `paintPreview.ts` — `STROKE_WIDTH_CSS` → `parseNumericToken(transient.preview_stroke_width)`.
   - `paintHoverHighlight.ts` — already pulls from `transient.hover_highlight` sub-namespace; add `stroke_width` field, drop local `STROKE_WIDTH_CSS`.
   - `paintSelectionRect.ts` — `STROKE_WIDTH_CSS` → `parseNumericToken(t.stroke_width)` where `t` is the matched sub-namespace.
   - `paintCrosshair.ts` — `STROKE_WIDTH_CSS` + `PICKBOX_HALF_CSS` → tokens.
   - `paintTransientLabel.ts` — `FONT_PX_CSS` + `CORNER_RADIUS_CSS` → tokens.
   - `paintSelection.ts` — 4 grip/outline tokens. Verify the `transient.grip` sub-namespace destructures cleanly.
   - `paintSnapGlyph.ts` — 7 sub-namespace tokens.
   - `paintDimensionGuides.ts` — 4 module-level + 2 inline constants. Keep `export const DIM_OFFSET_CSS = 40` literal per A12.
   Per painter: replace constants → run `pnpm --filter @portplanner/editor-2d test -- paintXyz.test.ts` (if a per-painter test exists) → fix any regression before proceeding.
6. **Add `painter-token-migration.test.ts`** at `packages/editor-2d/tests/painter-token-migration.test.ts`. One `describe` block per painter. Each test: mount the recorder ctx (existing pattern from `paintCrosshair.test.ts`), feed a fixed viewport (`zoom: 10, dpr: 1, ...`) and the imported `dark` tokens, perform one paint call, assert the captured `ctx.lineWidth` value + `setLineDash` argument match the token-derived expected numbers. Locks the migration so a token rename or value change without a test update is caught.
7. **Add Gate REM7-P1-DimOffsetMirror unit test** at `packages/editor-2d/tests/dim-offset-mirror.test.ts` (or extend an existing test file): asserts `DIM_OFFSET_CSS === parseNumericToken(dark.canvas.transient.dim_witness_offset)`. Locks the literal-vs-token equality (per A12).

#### Phase 1 Mandatory Completion Gates

- **REM7-P1-NoHardcodedConstants:** `rg -nE "^const [A-Z_]+_CSS\s*=\s*[0-9]|^const [A-Z_]+_PX\s*=\s*[0-9]" packages/editor-2d/src/canvas/painters/` returns matches in **at most 2 files**: `paintPoint.ts` (entity painter, out of scope per A11) and `paintDimensionGuides.ts` (`DIM_OFFSET_CSS = 40` literal, mirrored per A12). Every other overlay painter has zero numeric chrome constants at module scope.
- **REM7-P1-NoLocalParseHelper:** `rg -n "function parseDashPattern\|function parsePadding" packages/editor-2d/src/canvas/painters/` returns matches **only** in `_tokens.ts`. The three previously-duplicated `parseDashPattern` definitions and the one `parsePadding` definition have been removed from individual painters.
- **REM7-P1-ParseHelperNegative (Codex Round-1 H3):** all negative-input tests in `packages/editor-2d/tests/_tokens.test.ts` pass. Specifically: `parseNumericToken('')`, `parseNumericToken('  ')`, `parseNumericToken('40px')`, `parseNumericToken('NaN')`, and `parseNumericToken('Infinity')` each throw with a message containing `'invalid value'`; `parseDashPattern('')`, `parseDashPattern('solid')`, `parseDashPattern('   ')` each return `[]`; `parseDashPattern('6 nope 4')` returns `[6, 4]`. Locks the parse-failure contract so a future helper change can't silently swallow malformed tokens.
- **REM7-P1-DimOffsetMirror:** unit test asserts `DIM_OFFSET_CSS === parseNumericToken(dark.canvas.transient.dim_witness_offset)`. Both equal `40`. Locks the literal-vs-token equality per A12.
- **REM7-P1-PainterTokenMigration:** all tests in `painter-token-migration.test.ts` pass. One assertion per migrated painter that the captured `ctx.lineWidth` and `ctx.setLineDash` calls match the token-derived expected numbers given the `dark` token bundle.
- **REM7-P1-CssVarsRoundtrip:** Existing design-system test suite continues to pass (`pnpm --filter @portplanner/design-system test`); the css-vars emitter handles the new leaves automatically (recursive walker — verified by spot-checking the generated `:root` block during execution).
- **REM7-P1-Typecheck:** `pnpm typecheck` clean.
- **REM7-P1-Lint:** `pnpm check` clean.
- **REM7-P1-Tests:** `pnpm --filter @portplanner/editor-2d test` passes; net-new test count = ~10 (one per migrated painter) + 1 (DimOffsetMirror) = ~11.

#### Phase 1 Tests added

- `packages/editor-2d/tests/painter-token-migration.test.ts` (new) — ~10 tests, one per overlay painter.
- 1 unit test in `packages/editor-2d/tests/dim-offset-mirror.test.ts` (or extension of existing test file) asserting `DIM_OFFSET_CSS === parseNumericToken(dark.canvas.transient.dim_witness_offset)` (REM7-P1-DimOffsetMirror).
- Existing painter tests continue to pass unchanged (regression coverage).

### Phase 2 — Buffer persistence within tab

#### Phase 2 Goal

Re-invoking a tool shows previously-typed values as dim placeholder defaults in DI pills. Buffers persist across tool sessions within the current browser tab; cleared on reload.

#### Phase 2 Files affected

See §4.1 rows for `store.ts`, `runner.ts`, `types.ts`, `draw-polyline.ts`, `DynamicInputPills.tsx`, `DynamicInputPills.module.css`, `EditorRoot.tsx`, plus per-tool DI test updates.

#### Phase 2 Steps

1. **Add slice field + single mutator action.** `commandBar.lastSubmittedBuffers: Record<string, string[]>` initialised to `{}`. Single action on `editorUiActions`: `recordSubmittedBuffers(promptKey, buffers)`. Reads happen inline at consumer sites via `editorUiStore.getState().commandBar.lastSubmittedBuffers[promptKey] ?? null` — no separate selector helper function (Codex Round-1 H1 fix: actions are mutators only; reads are inline state access, matching the existing `editorUiActions` convention where every entry mutates).
2. **Add `Prompt.persistKey?: string`** to the `Prompt` interface in `tools/types.ts`. Doc comment explains it as the buffer-persistence key suffix; absent means runner derives from prompt index.
3. **Runner: derive `promptKey` and pre-fill placeholder.** On manifest publication (existing yield branch in `runner.ts`), compute `promptKey = ${toolId}:${prompt.persistKey ?? promptIndex}`. Pass it through to the published `commandBar.dynamicInput` slice (new field `commandBar.dynamicInput.promptKey`). The slice's `setDynamicInputManifest` action reads `lastSubmittedBuffers[promptKey]` and seeds it as `placeholders` (a new sibling field on `commandBar.dynamicInput`, parallel to `buffers`).
4. **Polyline `persistKey`.** Set `persistKey: 'next-vertex'` on the per-loop prompt in `draw-polyline.ts`. This makes all loop iterations share one key — typing 5 / 30 in iteration 1 surfaces as a placeholder in iteration 2 too. Other tools rely on prompt-index identity; no change.
5. **Pill chrome: render placeholder.** When `buffers[idx] === ''` AND `placeholders[idx] !== undefined`, render the placeholder text with the `pillPlaceholder` CSS class (dim opacity). When the user starts typing, switch to live buffer immediately. On Enter, if buffer is still empty, the combiner reads the placeholder as the effective value (combine → `recordSubmittedBuffers` → `clearDynamicInput`). Architectural decision: placeholder→buffer fallback happens at the EditorRoot `onSubmitDynamicInput` boundary, NOT inside the combiner helper, so the combiner's pure-function contract stays clean.
6. **Record on submit.** In `EditorRoot.tsx`'s `onSubmitDynamicInput` callback, after the combiner returns non-null and BEFORE `clearDynamicInput()`, call `recordSubmittedBuffers(commandBar.dynamicInput.promptKey, effectiveBuffers)`. `effectiveBuffers` = each buffer with placeholder fallback applied (if buffer is empty, use the placeholder).
7. **Tests.**
   - `tests/ui-state.test.ts`: slice default + actions.
   - `tests/tool-runner.test.ts`: prompt with `persistKey` reaches the slice with the expected key shape.
   - `tests/DynamicInputPills.test.tsx`: dim placeholder rendering + transition to live buffer on type.
   - `tests/draw-tools.test.ts`: polyline `persistKey` assertion.
   - `tests/smoke-e2e.test.tsx`: end-to-end scenario (line tool, type 5 / 30, Esc, re-invoke L, click first point, observe placeholders).

#### Phase 2 Mandatory Completion Gates

- **REM7-P2-SliceShape:** `tests/ui-state.test.ts` assertions on `lastSubmittedBuffers` slice shape + the `recordSubmittedBuffers` mutator action pass. Read-path assertions exercise `editorUiStore.getState().commandBar.lastSubmittedBuffers[promptKey]` directly (no helper).
- **REM7-P2-PromptKey:** `tests/tool-runner.test.ts` assertion on `promptKey` propagation passes. Test verifies the canonical expression `${toolId}:${prompt.persistKey ?? promptIndex}` (per A16) for at least three cases: (1) prompt without `persistKey` at index 0 → `${toolId}:0`; (2) prompt without `persistKey` at index 1 → `${toolId}:1`; (3) prompt with `persistKey: 'next-vertex'` → `${toolId}:next-vertex` regardless of prompt index.
- **REM7-P2-Placeholder:** `tests/DynamicInputPills.test.tsx` assertions on dim-placeholder rendering pass.
- **REM7-P2-PolylinePersistKey:** `tests/draw-tools.test.ts` polyline `persistKey: 'next-vertex'` assertion passes.
- **REM7-P2-SmokeRoundtrip:** `tests/smoke-e2e.test.tsx` `'line DI: typed 5 / 30 → Esc → re-invoke L → pills show dim placeholder defaults'` passes.
- **REM7-P2-NoPersistenceLeak (Codex Round-1 B1):** `rg -n "lastSubmittedBuffers" apps/web/src/persistence/ packages/project-store/src/ services/api/` returns **zero matches**. Proves the buffer-persistence slice is never serialised to IndexedDB, never sync'd to the API, and never touched by the project-store (which is the persisted document layer per ADR-014). Locks I-BPER-1.
- **REM7-P2-Typecheck / Lint / Tests:** standard `pnpm typecheck` / `check` / `test` clean.

#### Phase 2 Tests added

~5 unit tests (slice + runner + pill placeholder + polyline shape) + 1 smoke scenario.

### Phase 3 — Hover overflow tooltip on DI pills

#### Phase 3 Goal

When a DI pill's text overflows its rendered width, hovering shows a tooltip with the full value + unit suffix.

#### Phase 3 Files affected

`packages/editor-2d/src/chrome/DynamicInputPills.tsx`, `packages/editor-2d/src/chrome/DynamicInputPills.module.css`, `packages/editor-2d/tests/DynamicInputPills.test.tsx`.

#### Phase 3 Steps

1. **Detect overflow.** Each pill `<div>` ref + `onMouseEnter` handler measures `el.scrollWidth > el.clientWidth`. Cache the boolean per pill in component state to avoid re-measure on subsequent hovers.
2. **Render tooltip via portal.** When `isOverflow && hovered`, render `<TooltipPortal>{formattedValue}</TooltipPortal>`. Portal target is `document.body` via `createPortal`; positioned absolute at pill anchor + small offset (`top: pillRect.bottom + 6, left: pillRect.left`).
3. **Format the value.** Helper `formatPillValue(rawBuffer: string, fieldKind: 'distance' | 'angle' | 'number'): string` returns `'5 m'` / `'30°'` / `'5'`. Parses raw buffer with `Number(...)` and formats; falls back to raw buffer if non-numeric (e.g., partial typing like `5.`).
4. **`mouseLeave` clears.** Hovered state + overflow boolean reset.
5. **Tests.** JSDOM does not compute layout, so `scrollWidth` and `clientWidth` are always `0` by default. Tests MUST stub these via `Object.defineProperty(element, 'scrollWidth', { value: 200, configurable: true })` and `Object.defineProperty(element, 'clientWidth', { value: 100, configurable: true })` BEFORE firing the `mouseEnter` event so the overflow detection branch is deterministic (Codex Round-1 B2 fix). Three test cases minimum:
   - **Overflow case:** `scrollWidth=200`, `clientWidth=100` → tooltip appears with full value+unit text.
   - **No-overflow case:** `scrollWidth=80`, `clientWidth=100` → no tooltip rendered (assert by absence of `[data-component="dynamic-input-pill-tooltip"]`).
   - **Mouse leave:** start in overflow case, fire `mouseLeave`, assert tooltip removed.
   Plus per-field-kind suffix tests: `'distance'` → ' m'; `'angle'` → '°'; `'number'` → no suffix.

#### Phase 3 Mandatory Completion Gates

- **REM7-P3-OverflowDetection:** test asserts tooltip present only when `scrollWidth > clientWidth` AND absent when `scrollWidth <= clientWidth`. Both branches exercised.
- **REM7-P3-OverflowDeterministic (Codex Round-1 B2):** the overflow tests use `Object.defineProperty(el, 'scrollWidth', { value: N, configurable: true })` and the same for `clientWidth` BEFORE the hover event fires. JSDOM's default `0` value for layout properties is overridden so the test's overflow branch is deterministic — no reliance on real layout calculation. Locks against flaky / false-pass behaviour.
- **REM7-P3-UnitFormat:** test asserts unit suffix per field kind. Three cases: `'distance'` → ' m'; `'angle'` → '°'; `'number'` → no suffix.
- **REM7-P3-MouseLeaveCleanup:** test asserts the tooltip is removed when `mouseLeave` fires after `mouseEnter`. Locks the cleanup path.
- **REM7-P3-Typecheck / Lint / Tests:** standard.

#### Phase 3 Tests added

~3 unit tests in `tests/DynamicInputPills.test.tsx`.

## 10. Invariants summary

- **I-CTOK-1 — All overlay painter numeric chrome constants live in `canvas.transient.*` tokens.** The two intentional exceptions are `paintPoint.ts` (entity painter, A11) and `DIM_OFFSET_CSS` literal in `paintDimensionGuides.ts` (mirrored per A12). Enforcement: REM7-P1-NoHardcodedConstants grep + REM7-P1-PainterTokenMigration unit tests.
- **I-CTOK-2 — `DIM_OFFSET_CSS` literal mirrors `dim_witness_offset` token.** The exported constant value (40) equals `parseNumericToken(dark.canvas.transient.dim_witness_offset)`. Enforcement: REM7-P1-DimOffsetMirror unit test (per A12).
- **I-CTOK-3 — `parseDashPattern` and `parseNumericToken` are SSOT in `_tokens.ts`.** No painter defines a local copy. Enforcement: REM7-P1-NoLocalParseHelper grep gate.
- **I-BPER-1 — Buffer persistence is tab-local.** `lastSubmittedBuffers` lives in `editorUiStore`, never written to IndexedDB, never sync'd, never touched by the project-store. Enforcement: REM7-P2-NoPersistenceLeak grep gate (`rg -n "lastSubmittedBuffers" apps/web/src/persistence/ packages/project-store/src/ services/api/` returns zero matches). Locks the no-leak invariant objectively (Codex Round-1 B1 fix; replaces the original narrative-only "code-review" enforcement).
- **I-BPER-2 — Per-prompt identity (canonical expression per A16).** `promptKey = ${toolId}:${prompt.persistKey ?? promptIndex}`. Two prompts share a key only when both opt in via `persistKey`. Enforcement: REM7-P2-PromptKey unit test.
- **I-BPER-3 — Polyline shares one key across loop iterations.** All iterations of polyline's next-vertex prompt write to the same `promptKey`. Enforcement: REM7-P2-PolylinePersistKey unit test.
- **I-HOV-1 — Tooltip renders only on overflow.** No tooltip for non-overflow pills. Enforcement: REM7-P3-OverflowDetection unit test (both branches) + REM7-P3-OverflowDeterministic (Object.defineProperty stubbing) + REM7-P3-MouseLeaveCleanup.
- **I-HELP-1 — `parseNumericToken` and `parseDashPattern` reject malformed tokens deterministically.** Negative inputs throw a recognisable `Error` (numeric helper) or filter to `[]`/non-finite-skip (dash helper). Enforcement: REM7-P1-ParseHelperNegative unit tests.

## 11. Test strategy

Baseline at `main` (`291ec68`): 399 tests pass in `editor-2d`. Phases add tests:

- Phase 1: `painter-token-migration.test.ts` (~10 tests, one per painter) + `_tokens.test.ts` (~10 negative + positive cases for `parseNumericToken` / `parseDashPattern`) + `dim-offset-mirror.test.ts` (1 test) ≈ ~21 net-new.
- Phase 2: ~6 unit tests (slice + 3 promptKey cases + pill placeholder + polyline shape) + 1 smoke scenario ≈ ~7.
- Phase 3: ~5 unit tests (overflow / no-overflow / mouseLeave / 3 unit-format cases).

Total net-new: ~33. Final count target ≥ 432 (baseline 399). `pnpm --filter @portplanner/editor-2d test` workspace tripwire ≥ 432.

`pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build` all pass after each phase.

## 12. Done Criteria — objective pass/fail

- [ ] **Phase 1 — token sweep complete.** All overlay painters read numeric chrome from tokens; only `paintPoint.ts` retains a hardcoded constant (entity-pass exception per A11). Verified by REM7-P1-NoHardcodedConstants + REM7-P1-PainterTokenMigration.
- [ ] **DIM_OFFSET_CSS literal mirrors `dim_witness_offset` token.** Both equal `40`. Verified by REM7-P1-DimOffsetMirror.
- [ ] **`canvas.transient.*` token namespace extended.** New leaves added to `themes.ts` interface + `semantic-dark.ts` populated + `docs/design-tokens.md` version bumped + changelog line.
- [ ] **Phase 2 — buffer persistence functional within-tab.** Re-invoking line tool after typing 5 / 30 + Esc shows dim placeholders. Verified by REM7-P2-Placeholder + REM7-P2-SmokeRoundtrip.
- [ ] **Polyline next-vertex buffer persists across loop iterations AND tool re-invocations.** Verified by REM7-P2-PolylinePersistKey.
- [ ] **Buffer recording happens on successful submit only.** Failed-parse submits (combiner returns null) do not record. Verified by smoke + slice tests.
- [ ] **Buffer persistence does not leak into project / IndexedDB / sync.** Verified by REM7-P2-NoPersistenceLeak grep gate.
- [ ] **Phase 3 — hover tooltip on overflow.** Pills with overflowing text show a tooltip on hover; non-overflow pills do not. Both branches deterministically tested via Object.defineProperty stubbing. Verified by REM7-P3-OverflowDetection + REM7-P3-OverflowDeterministic + REM7-P3-MouseLeaveCleanup.
- [ ] **Tooltip content = value + unit suffix per field kind.** Verified by REM7-P3-UnitFormat.
- [ ] **Parse helpers reject malformed tokens deterministically.** Verified by REM7-P1-ParseHelperNegative.
- [ ] All Phase 1 + 2 + 3 gates pass. `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build` all pass.
- [ ] `docs/design-tokens.md` version bumped + changelog reflects the new tokens.
- [ ] No deviations from binding specs (none planned per §6).

## 13. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Token-migration typo silently changes a numeric value | REM7-P1-PainterTokenMigration test mounts a recorder ctx and asserts the actual `ctx.lineWidth` / dash array values match the dark token bundle for every painter. Locks the migration. |
| `parseNumericToken` parsing throws on a typo'd token value (e.g., `'4o'` vs `'40'`) | Helper has `Number.isFinite` guard + throws with a clear error message including the offending key + value. Test fixtures cover the throw path. |
| New token field added to `TransientTokens` interface but `semantic-dark.ts` not updated → runtime undefined read | TypeScript exhaustive interface coverage catches this at compile time. Phase 1 step 2 + 3 are deliberately sequenced (interface first, then population). |
| Buffer placeholder fallback at submit boundary creates a discrepancy between the visible pill text and the value submitted | The fallback applies ONLY when buffer is empty AND placeholder exists. Both states are visible to the user (dim placeholder vs live caret). Smoke scenario asserts the round-trip: type / Esc / re-invoke / Enter (no extra typing) → committed value matches the placeholder. |
| Per-prompt identity scheme drifts when a tool is renamed | Identity key = `${toolId}:${persistKey ?? promptIndex}`. Renaming `draw-line` → `line` would invalidate persisted buffers — they'd silently disappear (degrade gracefully), not crash. Acceptable for the initial pass; if tool renaming becomes routine, identity scheme moves to a stable UUID per tool registration. |
| Polyline `persistKey: 'next-vertex'` collides with another tool that uses the same string | Identity key includes the toolId prefix, so collision requires both `toolId` AND `persistKey` to match. Cross-tool collision impossible. |
| Tooltip portal escapes the modal stacking context (e.g., when a Layer Manager dialog is open) | Portal target = `document.body`. Pills are only active when no modal is in front (DI is disabled while Layer Manager is open per existing toggle path). No stacking-context conflict in current code. |
| Hover overflow detection runs `scrollWidth` measurement on every hover, potentially janky for large pill counts | Measure cached per-pill in component state; runs once per hover. With ≤ 2 pills active at any time (line / polyline / rectangle / circle), perf cost is negligible. |
| Hover tooltip captures focus / interferes with click handling | Tooltip is purely visual (no pointer events, `pointer-events: none` in CSS). Pill onClick / focus paths unaffected. |
| Token sweep accidentally breaks an entity painter (paintLine / paintCircle / etc.) | Out of scope per A11 — entity painters use layer `style.color`, not transient tokens. Phase 1 step 1 audit explicitly excludes entity painters. Existing entity-painter tests catch any accidental regression. |

## 14. §1.3 Three-round self-audit

### Round 1 — Chief Architect (boundaries, invariants, SSOT)

- **Q1.1 — Token namespace placement: `canvas.transient.*` or new `canvas.dim.*` sub-namespace?** Stay in `canvas.transient.*`. Rationale: the existing namespace already covers preview / crosshair / selection / labels — all transient overlay surfaces. Dim guides are transient too (they exist only during in-flight DI prompts). A separate `canvas.dim.*` would split SSOT for "transient overlay constants". The token NAMES carry the dim-guide grouping (`dim_witness_offset` etc.).
- **Q1.2 — `parseNumericToken` location: shared helper or inlined per painter?** Shared helper (`_tokens.ts`) co-located with painters. Rationale: each painter parses 5–10 tokens; inlining would duplicate the parse logic 50+ times. GR-3 requires helpers to live next to their consumers — `_tokens.ts` in `canvas/painters/` satisfies that.
- **Q1.3 — Buffer persistence in editor-UI slice or project-store?** Editor-UI slice (`editorUiStore.commandBar.lastSubmittedBuffers`). Rationale: project-store is for project document state (primitives, layers, grids); buffers are UI ergonomics. ADR-015 separation preserved.
- **Q1.4 — `Prompt.persistKey` optional or required?** Optional. Rationale: most tools (line / rectangle / circle / xline) have a single DI-bearing prompt at a fixed index; the runner can derive identity from `${toolId}:${promptIndex}` without an explicit key. Polyline opts in via the explicit `'next-vertex'` key. Required would force every tool to set a key, including ones where the index is sufficient.
- **Q1.5 — Placeholder fallback at submit boundary or in combiner?** At submit boundary. Rationale: the combiner is documented as a pure function `(manifest, buffers, anchor) → Input`; introducing implicit "if buffer empty, look up placeholder" violates the pure-function contract. EditorRoot already orchestrates the submit; one branch there ("if buffer empty, substitute placeholder") is local + testable.

### Round 2 — Sceptical Reader (what would Codex flag?)

- **Q2.1 — DIM_OFFSET_CSS export pattern (Rev-2 revised per A12).** Original Rev-1 proposed evaluating `parseNumericToken(dark.canvas.transient.dim_witness_offset)` at module top-level so tools always read the token value. Rev-2 self-audit flagged this as fragile (any malformed token would crash editor-2d at module load) and over-coupled (editor-2d's runtime import path becomes dependent on design-system bundle being parseable, not just type-checkable). **Rev-2 fix:** keep `export const DIM_OFFSET_CSS = 40` as a literal, mirror the value in `dim_witness_offset: '40'` on `semantic-dark.ts`, and lock the equality with REM7-P1-DimOffsetMirror unit test. SSOT enforced by assertion, not by import-time coupling. Consequence: if a future contributor changes the literal without updating the token (or vice versa), the test fails immediately.
- **Q2.2 — Test count tripwire.** The plan adds ~19 net-new tests; baseline 399; target ≥ 415. With the painter-token-migration suite, test runtime grows but stays within editor-2d's existing budget (~30s).
- **Q2.3 — Polyline buffer-key conflict with explicit user reset.** What if the user explicitly wants to start with empty buffers (e.g., Esc + re-invoke line, but they want fresh values)? The dim placeholder is non-blocking — typing replaces immediately. Esc clears the live buffer but does NOT clear the persisted buffer (deliberate; AC parity). To clear persistent state, the user reloads the tab. **Documented in §3 A4 + A2.**
- **Q2.4 — Tooltip portal cleanup on unmount.** `createPortal` returns a React element; the portal target stays attached to `document.body`. Component unmount removes the portal element. Verified by React testing library cleanup pattern (no manual DOM manipulation needed).
- **Q2.5 — Token addition without `docs/design-tokens.md` update.** Arch-contract §0.5 requires the doc update in the same commit as the code change. Phase 1 step 2 + 3 land alongside the doc bump in a single commit. Gate REM7-P1-Typecheck doesn't catch missed doc updates, but post-commit Procedure 04 review does — flagged here so the implementer doesn't forget.

### Round 3 — Blast radius (what could break elsewhere?)

- **Q3.1 — paintTransientLabel already reads `canvas.transient.label_*` tokens.** Confirmed; only the numeric `label_padding` becomes a numeric-token read instead of an inline parse. Existing label tests catch any regression.
- **Q3.2 — Theme switching (M1.3 light theme work, deferred).** Tokens are read fresh per paint call (the existing pattern), so a future theme-switch event just re-renders with different values. New numeric tokens follow the same pattern. **No light theme work in this plan.**
- **Q3.3 — Bundle size impact.** `_tokens.ts` helper ≈ 30 LOC. New painter-test file ≈ 200 LOC (test code, not bundled). Pill chrome additions ≈ 100 LOC. Slice additions ≈ 30 LOC. Net production bundle delta ≈ +1 kB raw / ≈ +0.4 kB gz. Within budget.
- **Q3.4 — `canvas-host.tsx` and other React hooks that subscribe to tokens.** No change. All token consumption lives in the painters (called from canvas-host's paint loop with `dark` tokens passed in). Hooks unaffected.
- **Q3.5 — Future tools that want buffer persistence.** They get it for free. New tool with a DI manifest auto-derives `${toolId}:${promptIndex}` identity. To opt into a custom key (e.g., to share buffers across prompts in the same tool), set `Prompt.persistKey`.
- **Q3.6 — Existing rectangle / line / circle / xline DI scenarios.** All existing smoke scenarios continue to pass — buffer persistence does not change submit semantics, only adds a placeholder visual when buffer is empty. The combine path is unchanged.

---

## Plan Review Handoff

**Plan:** `docs/plans/feature/m1-3-canvas-tokens-and-di-polish.md`
**Branch:** `feature/m1-3-canvas-tokens-and-di-polish`
**Status:** Plan authored — awaiting review

### Paste to Codex for plan review
> Review this plan using the protocol at
> `docs/procedures/Codex/02-plan-review.md` (Procedure 02).
> Apply strict evidence mode. Start from Round 1.
