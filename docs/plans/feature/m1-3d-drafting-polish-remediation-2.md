# Plan — M1.3d Drafting UX Polish (Remediation Round 2)

**Branch:** `feature/m1-3d-drafting-polish`
**Parent plans:** `docs/plans/feature/m1-3d-drafting-polish.md` (M1.3d) +
                  `docs/plans/feature/m1-3d-drafting-polish-remediation.md` (Round 1)
**Parent commit baseline:** Round 1 latest = `2c13b49` (Rev-5 footer fix on Codex post-commit Round-1 Go)
**Author:** Claude (Opus 4.7, 1M context)
**Date:** 2026-04-27
**Operating mode:** Procedure 01 (PLAN-ONLY) → Procedure 03 (EXECUTION) after Codex review
**Status:** Plan Revision-3 — execution-discovered gate polish (REM2-4 / REM2-6 robustness + REM2-10 count accuracy)

---

## Revision history

| Rev | Date | Driver | Changes |
|-----|------|--------|---------|
| Rev-3 | 2026-04-27 | Self-discovered during execution (per CLAUDE.md / Procedure 03 §3.7 in-place plan corrections) | Three gate-text refinements caught while running gates against the actual implementation. None affect implementation correctness; all are plan-side data-point alignment. (a) **REM2-4** — original `rg -A 5 ... \| rg "angleRad"` was window-bound; angleRad lives in PaintTransientLabelOptions interface ABOVE the export, outside the 5-line window. Broadened to file-wide grep (`rg -n "angleRad"` ≥3 matches). (b) **REM2-6** — original combined regex `setHoveredGrip\\(` had shell-quoting fragility (literal paren in the pattern). Split into two simpler greps (`setHoveredGrip` ≥2 + `gripHitTest` ≥2). (c) **REM2-10** — count threshold updated from "+7 new = ≥353" estimate to "+33 net-new = ≥379" actual. Per Rev-5 lesson on data-point alignment: the consistency pass scans for ALL data points; planning-time test estimates often understate density once per-kind / per-arm / per-state cases are written. |
| Rev-2 | 2026-04-27 | Codex Round-2 (9.1/10, Go conditional on one quality polish) | Quality-only Review Miss: R6 Done Criteria cited "paintPreview per-arm angle assertions as validated by REM2-9", but REM2-9's command did NOT run `tests/paintPreview` — only ran `tests/wire-intersect tests/paintTransientLabel tests/paintSelection tests/smoke-e2e`. Traceability mismatch (claim > gate scope). Fix: added `tests/paintPreview` to REM2-9's command. Done in the same execution commit per user direction "fix during execution." Other Round-2 closures (B1 / H1 / H2 / Q1) confirmed clean by Codex; no further changes needed. |
| Rev-1 | 2026-04-27 | Codex Round-1 (8.2/10, No-Go on 1 Blocker + 2 High-risk) | **B1** (Blocker) — R5 lacked user-boundary smoke coverage; added one new smoke scenario `'crossing selection narrows to wire-intersect (not bbox)'` to SCENARIOS const + matching `it()` block (mirrors Rem-1's single-scenario pattern for R4). Updated test-count math (≥353 = baseline 346 + 7 new). New gate REM2-9c for the structural scenario-name presence check. **H1** (High-risk) — `searchCrossing` signature inconsistency: normalized to 2-arg `(rect, primitives)` everywhere; struck the "projectPrimitives" third arg from §4.1. **H2** (High-risk) — `label_padding` ownership contradiction: picked option (a) — `label_padding` STAYS a `canvas.transient` token (existing SSOT); only the VALUE updates `'4' → '3'` in semantic-dark.ts; paintTransientLabel reads via `tokens.canvas.transient.label_padding` (existing path). §4.1 / §5 / §7 reconciled on this single source. **Q1** — "visual confirmation on dev server" replaced with command-verifiable gate cross-references in Done Criteria. **Q2** — date metadata is correct (today is 2026-04-27); no change needed. **Procedural lesson:** any user-facing behavior change in a remediation MUST default to "needs a mounted-EditorRoot smoke scenario" — unit tests cover helper math; smoke covers wiring. Same class as Rem-1 R4 H1, caught earlier this time. |
| Rev-0 | 2026-04-27 | Initial draft | All three findings (R5 / R6 / R7) scoped + §1.3 three-round audit + F4 deferral to M1.3c. |

## 1. Request summary

Three additional UX-testing findings from user-side testing of M1.3d at
`2c13b49` (post-Round-1 remediation). All three are implementation-side
polish; no spec change, no ADR.

- **R5 — Crossing selection (R→L drag) uses bbox, not actual wire geometry.**
  `select-rect` currently calls `searchFrustum(rect)` for crossing
  selection, which returns ids whose AABB intersects the rect. This
  over-selects: an entity whose bbox crosses the rect even though its
  actual wire (line segment, polyline chain, circle outline, arc curve)
  does NOT cross the rect IS selected. AutoCAD's crossing requires
  geometric wire-vs-rect intersection. Confirmed by user: "f1 it is a"
  → option (a) crossing semantics.
- **R6 — Length / radius / W×H labels are visually heavy and don't
  align with the element direction.** Currently `paintTransientLabel`
  renders a translucent dark-grey pill with horizontal text. User wants:
  small rounded BLUE pill, rotated to align with the element direction
  (line preview rotates label along p1→cursor; circle radius along
  center→cursor; etc.).
- **R7 — Hovered-grip highlight.** When an entity is selected and grips
  show, AutoCAD highlights the SPECIFIC grip the cursor is closest to
  (so the user knows which grip clicking will grab). Today
  `paintSelection` paints all grips identically; there is no
  cursor-proximity feedback. Fix: compute hovered-grip via existing
  `gripHitTest` (Phase 6, screen-space, 4 CSS-px tolerance), publish
  to a new overlay slice field, paint it with a different color +
  larger size.

## 2. Out of scope (discussed and agreed deferred)

- **F4 — UI surface for snap-distance sensitivity.** The snap tolerance
  is currently a fixed `DEFAULT_PX_TOLERANCE = 10` constant in
  `packages/editor-2d/src/snap/screen-tolerance.ts`. User wants a UI
  to tune it. Per user: "i hope that is easy and can be done along
  with polar osnap" — explicitly defers to **M1.3c** (POLAR / OTRACK
  / settings dialog work). Captured here so the M1.3c plan picks it up.

## 3. Assumptions and scope clarifications

User-confirmed in chat 2026-04-27:

- **A1 — All three fixes ship in one commit on `feature/m1-3d-drafting-polish`,
  not a new branch.** Branch is still pre-merge to main; landing this as
  one more commit before tag `m1.3d` keeps the M1.3d shipped unit cohesive.
- **A2 — R5 crossing-vs-wire intersect uses geometric narrow-phase**
  (per-primitive segment / circle / arc intersect math). Broad-phase
  stays via the existing rbush `tree.search(rect)` for cheap candidate
  filtering. We use `@flatten-js/core` (already in `editor-2d` deps,
  currently unused) for segment-segment / segment-circle / segment-arc
  intersection helpers — keeps our math minimal and uses a battle-tested
  library.
- **A3 — R6 pill color is BLUE.** Token: a new `canvas.transient.label_bg_blue`
  + `label_text_blue` pair, OR replace the existing `label_bg` /
  `label_text` tokens to blue values. Per Rev-4 lesson on token SSOT,
  prefer REPLACEMENT (single pair, all pills go blue). Specific values:
  background = `rgba(42, 127, 255, 0.9)` (matches `accent.primary` /
  `selection_window.stroke`); text = `#ffffff` (white on blue for max
  contrast). Pill stays at corner-radius 4 CSS px; size shrinks: padding
  `4 → 3`, font `12 → 11`.
- **A4 — R6 element-aligned rotation per arm:**
  - line, polyline-rubberband, arc-2pt: angle = `atan2(cursor.y - anchor.y,
    cursor.x - anchor.x)` where `anchor` is `p1` (line / arc-2pt) or
    last-vertex (polyline).
  - circle: angle = `atan2(cursor.y - center.y, cursor.x - center.x)`
    (radius line direction).
  - rectangle: angle = 0 (label stays horizontal — diagonal would be
    arbitrary; the W×H label reads naturally horizontal).
  - arc-3pt: angle = 0 (the 3-point arc has no single "direction"; the
    radius label sits horizontally near the cursor).
  - xline: no embedded label currently; n/a.
  Text-readability normalization: if `angle ∈ (π/2, 3π/2)` mod 2π,
  flip 180° so text reads left-to-right (no upside-down text).
- **A5 — R7 hovered grip uses both color AND size change.** AutoCAD does
  both. Color: `canvas.handle_rotate` (existing amber token, semantically
  "handle being acted on"). Size: 9×9 CSS px (vs default 7×7). Hovered
  detection uses existing `gripHitTest` with the existing 4-CSS-px
  tolerance.
- **A6 — R7 hovered-grip detection runs only when `overlay.grips !== null`**
  (i.e., an entity is selected). When no entity is selected, no grips
  are painted, so no hovered-grip computation needed. Effect gates on
  `overlay.grips?.length` to avoid wasted rAF work.

## 4. Scope

### 4.1 In scope — files modified

| Path | Change |
|---|---|
| `packages/editor-2d/src/canvas/spatial-index.ts` | (R5) Add `searchCrossing(rect, primitives): PrimitiveId[]` (Rev-1 H1 fix — 2-arg signature, normalized across plan) — broad-phase via rbush `tree.search(rect)`, then narrow-phase via `wireIntersectsRect(primitive, rect)` per kind. The `primitives` argument is `Project['primitives']` so the narrow-phase can look up full primitive shapes from the broad-phase candidate ids. xlines included via the existing infinite-extent path (any infinite line crosses any finite rect). |
| `packages/editor-2d/src/canvas/wire-intersect.ts` (NEW) | (R5) Per-primitive narrow-phase `wireIntersectsRect(primitive, rect): boolean`. Uses `@flatten-js/core` for segment-segment / segment-circle / segment-arc helpers. Per-kind branches: point (point-in-rect), line (segment-vs-rect), polyline (any segment intersects rect OR any vertex inside), rectangle (any side intersects OR any corner inside OR rect-inside-entity), circle (any rect side intersects circle outline OR rect-inside-circle OR circle-bbox-inside-rect), arc (segment-vs-arc per side OR endpoints inside rect), xline (segment-vs-line via Liang-Barsky). |
| `packages/editor-2d/src/tools/select-rect.ts` | (R5) Replace `idx.searchFrustum(rect)` for crossing branch with `idx.searchCrossing(rect, project.primitives)`. Window branch unchanged (`searchEnclosed` is bbox-fully-inside, which IS equivalent to wire-fully-inside for our convex/connected primitives — verified in §9 audit). |
| `packages/design-system/src/tokens/semantic-dark.ts` | (R6) Update three values in the `canvas.transient` block: `label_bg` → `'rgba(42, 127, 255, 0.9)'` (blue, matches selection_window.stroke); `label_text` → `'#ffffff'` (white on blue); `label_padding` → `'3'` (Rev-1 H2 fix — padding STAYS a token; only the value changes). paintTransientLabel reads `label_padding` via `tokens.canvas.transient.label_padding` (existing path); the existing `parsePadding` helper in paintTransientLabel converts the string to a number unchanged. |
| `packages/design-system/src/tokens/themes.ts` | (R6) No interface change; existing `label_bg` / `label_text` fields still typed as `Color`. Doc comment updated to note the blue convention. |
| `docs/design-tokens.md` | (R6) Bump 1.3.0 → 1.3.1; changelog row for the blue pill color. Token table updated. |
| `packages/editor-2d/src/canvas/painters/paintTransientLabel.ts` | (R6) (a) Add optional `options.angleRad?: number` parameter. When set, rotate label around its anchor; flip 180° if angle in lower half so text reads left-to-right. (b) Reduce font constant: `FONT_PX_CSS = 12 → 11`. Padding is unchanged in code — the `parsePadding(token)` helper converts the new `'3'` token value automatically (Rev-1 H2 fix — token-side change only; no painter constant change for padding). |
| `packages/editor-2d/src/canvas/painters/paintPreview.ts` | (R6) For each preview arm, compute the appropriate `angleRad` per A4 and pass to `paintTransientLabel({...}, options: { angleRad })`. |
| `packages/editor-2d/src/ui-state/store.ts` | (R7) Add `overlay.hoveredGrip: { entityId: PrimitiveId; gripKind: string } | null` to OverlayState; default null in `createInitialEditorUiState`; new action `setHoveredGrip(grip | null)`. |
| `packages/editor-2d/src/EditorRoot.tsx` | (R7) New effect: on `overlay.cursor` change AND `overlay.grips !== null`, call `gripHitTest(cursor.screen, grips, viewport)` and `setHoveredGrip(hit ?? null)`. Effect dep is `overlay.cursor` (same as the snap-on-cursor effect). |
| `packages/editor-2d/src/canvas/painters/paintSelection.ts` | (R7) Take a new `hoveredGripKey?: { entityId: PrimitiveId; gripKind: string } | null` parameter (passed from paint.ts). For the matching grip, paint with `canvas.handle_rotate` fill + 9×9 CSS px (vs default `canvas.handle_move` + 7×7). |
| `packages/editor-2d/src/canvas/paint.ts` | (R7) Pass `overlay.hoveredGrip` into `paintSelection` calls. |
| `packages/editor-2d/tests/wire-intersect.test.ts` (NEW) | (R5) Per-kind unit tests: line crossing rect (yes / no / endpoint-touch), polyline (any-segment crossing), rectangle, circle (chord intersect / outline-inside), arc (endpoint cases), point, xline. |
| `packages/editor-2d/tests/spatial-index.test.ts` | (R5) Extend with `searchCrossing` cases mirroring `searchEnclosed`'s structure: bbox-only-overlap should NOT match if wire doesn't cross; wire-crossing should match. |
| `packages/editor-2d/tests/select-rect.test.ts` | (R5) Replace / extend the existing crossing test to assert wire-vs-bbox semantics. Add a regression case: a long diagonal line whose bbox crosses the rect but whose wire doesn't. |
| `packages/editor-2d/tests/paintTransientLabel.test.ts` | (R6) Add tests for `angleRad` parameter: rotation applied; 180° flip when angle in lower half. |
| `packages/editor-2d/tests/paintPreview.test.ts` | (R6) Verify each arm's call to paintTransientLabel passes the expected angleRad (line / polyline / circle / rectangle / arc-2pt / arc-3pt). |
| `packages/editor-2d/tests/ui-state.test.ts` | (R7) Test `overlay.hoveredGrip` default null; setHoveredGrip stores + clears via null. |
| `packages/editor-2d/tests/paintSelection.test.ts` | (R7) Test hovered grip paints amber + 9×9 (different from non-hovered grips' blue + 7×7). |
| `packages/editor-2d/tests/smoke-e2e.test.tsx` | (R5 + R7 SOLE integration validation surfaces — Rev-1 B1 fix adds the R5 scenario.) Add TWO new smoke scenarios to `SCENARIOS` const + matching `it()` blocks: (a) `'crossing selection narrows to wire-intersect (not bbox)'` — mounts `<EditorRoot />`, seeds two primitives (one whose wire crosses the rect, one whose bbox crosses but wire does NOT — the diagonal-line regression), fires R→L drag, asserts the selection set CONTAINS the wire-crossing entity and EXCLUDES the bbox-only-overlap entity. SOLE integration validation surface for R5 — wire-intersect.test.ts unit cases cover the per-kind helper math; smoke verifies the EditorRoot → select-rect → searchCrossing wiring. (b) `'hovered grip highlights on cursor proximity'` — mounts `<EditorRoot />`, seeds + selects a line, fires mousemove near a grip, asserts `editorUiStore.overlay.hoveredGrip` resolves to that grip via the EditorRoot effect. |

### 4.2 In scope — files created

- `packages/editor-2d/src/canvas/wire-intersect.ts` (R5)
- `packages/editor-2d/tests/wire-intersect.test.ts` (R5)

### 4.3 Out of scope (deferred — discussed and agreed)

- **F4 — snap-distance sensitivity UI.** Currently the tolerance is
  `DEFAULT_PX_TOLERANCE = 10` in `packages/editor-2d/src/snap/screen-tolerance.ts`.
  M1.3c will surface this alongside POLAR / OTRACK toggles and a
  settings panel. Captured here as an explicit M1.3c scope add so the
  M1.3c author picks it up.
- **R6 rectangle preview label rotation along the diagonal.** Diagonal
  is arbitrary; horizontal label reads naturally. Per A4.
- **R6 arc-3pt radius label rotation along the chord.** Same — chord
  direction is ambiguous; horizontal reads naturally. Per A4.

### 4.4 Blast radius

- **Packages affected:** `editor-2d` (wire-intersect, select-rect,
  paintTransientLabel, paintPreview, paintSelection, paint.ts,
  EditorRoot, ui-state) + `design-system` (label_bg / label_text token
  values; no interface change). `domain` / `project-store` / `apps/web`
  unchanged.
- **Cross-cutting hard gates:** none affected. DTP-T1/T2/T6/T7 stay clean.
- **Stored data:** none. UI-only state extensions.
- **UI surfaces:** crossing selection result set (R5 narrows it),
  preview labels (R6 changes color + rotation + size), grip rendering
  (R7 adds proximity highlight). Other shell areas untouched.
- **ADRs:** none modified. ADR-021 paint pipeline unchanged in shape;
  paintSelection signature gains an optional parameter (additive).

## 5. Architecture doc impact

| Doc | Change |
|---|---|
| `docs/design-tokens.md` | Bump 1.3.0 → 1.3.1; changelog row covers all three `canvas.transient` value changes: `label_bg` → blue rgba, `label_text` → white, `label_padding` → `'3'` (Rev-1 H2 fix — padding stays a token; only value changes). The token table row for `label_padding` updates from `'4'` to `'3'`. |
| All other binding spec docs | No change. |
| `docs/glossary.md` | No new term required (hovered grip is a UX behavior; existing "Grip" definition covers it). |

## 6. Deviations from binding specifications (§0.7)

**None.** All changes extend existing systems within their declared
extension points. Token VALUE change (label_bg / label_text) is an
edit-in-place per `docs/design-tokens.md` §"Architecture doc file
lifecycle" governance — design tokens are edited freely with version
bumps and changelog rows; no ADR change required.

## 7. Implementation steps (single phase)

R5 / R6 / R7 are independent enough that decomposition into multiple
Procedure-03 phases would be overhead. One phase covers all three.

### Step-by-step

1. **R5 — Wire-intersect narrow-phase (new file).** Author
   `packages/editor-2d/src/canvas/wire-intersect.ts` exporting
   `wireIntersectsRect(primitive, rect): boolean`. Per-kind branches
   listed in §4.1. For the heavy intersect math (segment-segment,
   segment-circle, segment-arc), use `@flatten-js/core`'s `Segment`,
   `Circle`, `Arc` constructors and their `.intersect(other)` method.
   Note `@flatten-js/core` is already declared in `editor-2d`'s
   `package.json` deps but currently unused — this remediation is the
   first consumer.
2. **R5 — `searchCrossing` on PrimitiveSpatialIndex.** Add a method
   that takes the rect AND the `Project['primitives']` map (so it can
   look up full primitives for narrow-phase). Broad-phase via existing
   `tree.search(rect)`; narrow-phase via `wireIntersectsRect`. xlines
   pass through the existing `xlineIds` concatenation (any infinite
   line crosses any finite rect).
3. **R5 — `select-rect.ts` swap.** Replace `idx.searchFrustum(rect)` in
   the crossing branch with `idx.searchCrossing(rect, project.primitives)`.
   Window branch unchanged.
4. **R6 — Token value update (Rev-1 H2 fix: padding stays a token).**
   In `semantic-dark.ts`'s `canvas.transient` block, three values
   change: `label_bg` → `'rgba(42, 127, 255, 0.9)'`; `label_text` →
   `'#ffffff'`; `label_padding` → `'3'` (was `'4'`). The
   `TransientTokens` interface in `themes.ts` is unchanged structurally
   (all three remain typed as `Color`); doc comments updated to note
   the blue convention + smaller padding. `docs/design-tokens.md`
   bumped 1.3.0 → 1.3.1 with a changelog row covering all three value
   changes. paintTransientLabel does NOT need a code change for
   padding — its existing `parsePadding(token)` helper picks up the
   new `'3'` automatically.
5. **R6 — `paintTransientLabel` rotation + font size.** Add `options?:
   { angleRad?: number }` parameter. New `FONT_PX_CSS = 11` (was 12).
   Padding is NOT changed in code — it's read from the token (Rev-1
   H2 fix; see step 4). When `angleRad` is set: `ctx.translate(anchor
   screen)`, normalize angle to `(-π/2, π/2]` (flip 180° if outside),
   `ctx.rotate(angle)`, render text + pill at origin. When `angleRad`
   is unset / null, existing horizontal rendering unchanged.
6. **R6 — `paintPreview` arm-by-arm angle computation.** Each arm
   computes its `angleRad` per A4 and passes to `paintTransientLabel`.
   line / polyline / circle / arc-2pt get rotated; rectangle / arc-3pt
   stay horizontal.
7. **R7 — `overlay.hoveredGrip` slice extension.** Add the field to
   `OverlayState`, default `null` in `createInitialEditorUiState`,
   add `setHoveredGrip` action.
8. **R7 — EditorRoot effect.** New `useEffect` on `[overlay.cursor]`.
   Reads `editorUiStore.getState()`. If `cursor === null` OR
   `overlay.grips === null` OR `overlay.grips.length === 0`, call
   `setHoveredGrip(null)` (idempotent — only writes if changing).
   Otherwise compute `gripHitTest(cursor.screen, overlay.grips,
   viewport)` and call `setHoveredGrip` with the result. Same pattern
   as the existing snap-on-cursor effect.
9. **R7 — `paintSelection` differential rendering.** Take a new
   `hoveredGripKey?: { entityId: PrimitiveId; gripKind: string } | null`
   parameter. For each grip in the loop: if `hoveredGripKey?.entityId
   === g.entityId && hoveredGripKey.gripKind === g.gripKind`, paint
   with `canvas.handle_rotate` fill + 9×9 CSS px; otherwise existing
   `canvas.handle_move` fill + 7×7. Border / stroke style unchanged.
10. **R7 — `paint.ts` overlay-pass plumb.** Pass `overlay.hoveredGrip`
    into the `paintSelection(ctx, selected, grips, viewport, dark,
    overlay.hoveredGrip)` call.
11. **Tests** — see §10.

### Mandatory completion gates

```
Gate REM2-1: searchCrossing exported on PrimitiveSpatialIndex
  Command: rg -n "searchCrossing" packages/editor-2d/src/canvas/spatial-index.ts
  Expected: ≥1 match (method declaration)

Gate REM2-2: wire-intersect.ts exists and exports wireIntersectsRect
  Command: rg -n "export function wireIntersectsRect" packages/editor-2d/src/canvas/wire-intersect.ts
  Expected: ≥1 match

Gate REM2-3: select-rect uses searchCrossing for the crossing branch
  Command: rg -n "searchCrossing" packages/editor-2d/src/tools/select-rect.ts
  Expected: ≥1 match

Gate REM2-4: paintTransientLabel accepts angleRad
  (Revision-3 — gate broadened from window-bound grep to file-wide;
   the angleRad option lives in PaintTransientLabelOptions interface
   above the export, so a -A 5 window after `export function` missed
   it. File-wide grep catches both the interface field + the function
   parameter consumption.)
  Command: rg -n "angleRad" packages/editor-2d/src/canvas/painters/paintTransientLabel.ts
  Expected: ≥3 matches (interface field + parameter declaration +
            normalizeReadable invocation site)

Gate REM2-5: overlay.hoveredGrip slice field
  Command: rg -n "hoveredGrip" packages/editor-2d/src/ui-state/store.ts
  Expected: ≥3 matches (interface field declaration + default + setter)

Gate REM2-6: EditorRoot effect computes hoveredGrip via gripHitTest
  (Revision-3 — gate broadened to two simpler greps with ≥1 each so
   shell-quoting of the parenthesis in `setHoveredGrip(` doesn't trip
   the original combined regex on some shells.)
  Commands:
    (a) rg -n "setHoveredGrip" packages/editor-2d/src/EditorRoot.tsx
        Expected: ≥2 matches (clear-null call + set-with-hit call)
    (b) rg -n "gripHitTest" packages/editor-2d/src/EditorRoot.tsx
        Expected: ≥2 matches (import + EditorRoot effect invocation;
                  the existing handleGripHitTest also references it,
                  giving ≥2 by construction)

Gate REM2-7: paintSelection accepts hoveredGripKey + dispatches by it
  Command: rg -n "hoveredGripKey|handle_rotate" packages/editor-2d/src/canvas/painters/paintSelection.ts
  Expected: ≥2 matches (parameter declaration + handle_rotate fill site)

Gate REM2-8: design-tokens.md bumped to 1.3.1
  Command: rg -n "1\\.3\\.1" docs/design-tokens.md
  Expected: ≥1 match (changelog row)

Gate REM2-9: Test additions present + R5 + R7 smoke scenarios pass
  (Revision-2 — Codex Round-2 Quality fix: added tests/paintPreview
   so the R6 Done-Criteria citation about "paintPreview per-arm angle
   assertions" is covered by this gate's command scope.)
  Command: pnpm --filter @portplanner/editor-2d test -- tests/wire-intersect tests/paintTransientLabel tests/paintPreview tests/paintSelection tests/smoke-e2e
  Expected: passes. Vitest runs every it() block in each file; failure
            of any new test (wire-intersect kind cases / paintTransientLabel
            rotation / paintPreview per-arm angle / paintSelection
            hovered-grip / smoke R5 + R7 scenarios) fails the gate
            behaviorally.

Gate REM2-9b: R7 smoke scenario name in SCENARIOS + matching it() block
  Command: rg -n "'hovered grip highlights on cursor proximity'" packages/editor-2d/tests/smoke-e2e.test.tsx
  Expected: ≥2 matches (SCENARIOS const + it() title)

Gate REM2-9c: R5 smoke scenario name in SCENARIOS + matching it() block
  (Revision-1 — Codex Round-1 B1 fix: structural presence check for the
   new R5 smoke scenario; complements REM2-9's behavioral check.)
  Command: rg -n "'crossing selection narrows to wire-intersect (not bbox)'" packages/editor-2d/tests/smoke-e2e.test.tsx
  Expected: ≥2 matches (SCENARIOS const + it() title)

Gate REM2-10: Workspace test suite passes
  (Revision-3 — count updated to reflect actual implementation density.
   The Rev-1 estimate of "≥353 / +7 new" undercounted; final delta
   was +33 net-new tests.)
  Command: pnpm test
  Expected: all 6 packages pass; total ≥ 379 (post-Round-1 baseline 346
            + 33 net-new across wire-intersect ~11 + spatial-index
            extends ~2 + select-rect extends ~1 + paintTransientLabel
            rotation ~3 + paintPreview per-arm angle ~6 + paintSelection
            hovered-grip ~3 + ui-state hoveredGrip ~2 + smoke R5 + R7
            scenarios ~2 + minor adjacent extends). Behavioral correctness
            enforced by vitest's non-zero exit on any failure; the
            count threshold is the human-review consistency check.

Gate REM2-11: Cross-cutting hard gates clean (DTP-T1/T2/T6/T7)
  Same commands as M1.3d §9. Expected: 0 offenders each.

Gate REM2-12: Typecheck + Biome + build
  Commands: pnpm typecheck, pnpm check, pnpm build
  Expected: all exit 0
```

## 8. Done Criteria — objective pass/fail

- [ ] **R5** — Crossing selection (R→L drag) selects only entities whose
  actual wire intersects the drag rect. Bbox-only-overlap NOT selected.
  Verified by Gate REM2-2 (wire-intersect.ts exports), REM2-3
  (select-rect uses searchCrossing), REM2-9 (wire-intersect unit tests
  + smoke R5 scenario behavioral run), REM2-9c (R5 smoke scenario name
  present in SCENARIOS). Rev-1 B1 fix added the smoke scenario as the
  SOLE integration validation surface.
- [ ] **R6** — Length / radius / W×H labels render as small blue rounded
  pills, rotated to align with the element direction (line / polyline /
  circle / arc-2pt; rectangle / arc-3pt stay horizontal per A4).
  Verified by (Rev-1 Q1 fix replacing "visual confirmation"): Gate
  REM2-4 (paintTransientLabel angleRad signature), REM2-8
  (design-tokens.md bumped 1.3.0 → 1.3.1 with all three value changes),
  REM2-9 (paintTransientLabel rotation tests + paintPreview per-arm
  angle assertions), REM2-12 (Biome / typecheck / build clean).
- [ ] **R7** — Cursor near a grip on a selected entity highlights that
  grip (amber fill + 9×9 px) while other grips remain blue + 7×7.
  Verified by Gate REM2-5 (overlay.hoveredGrip slice field), REM2-6
  (EditorRoot effect computes hoveredGrip via gripHitTest), REM2-7
  (paintSelection differential rendering), REM2-9 (paintSelection
  hovered-grip unit test + smoke R7 scenario behavioral run), REM2-9b
  (R7 smoke scenario name present).
- [ ] All Phase REM2-1..REM2-12 gates pass (REM2-1, REM2-2, REM2-3,
  REM2-4, REM2-5, REM2-6, REM2-7, REM2-8, REM2-9, REM2-9b, REM2-9c,
  REM2-10, REM2-11, REM2-12).
- [ ] Cross-cutting hard gates DTP-T1 / T2 / T6 / T7 pass.
- [ ] **Workspace test count** ≥ 379 (post-Round-1 baseline 346 + 33
  net-new per Gate REM2-10's enumeration; updated in Rev-3 from the
  earlier "+7" estimate which proved low once the per-kind wire-
  intersect cases + per-arm paintPreview rotation cases + per-state
  paintSelection hovered cases were authored in detail).
- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build` all pass.

## 9. Risks and Mitigations

(Single canonical risk register per Round-1 Rev-4 lesson on §8/§11
duplication.)

| Risk | Mitigation |
|------|-----------|
| `@flatten-js/core` is currently unused in the codebase; introducing it as the first consumer surfaces dependency risk (bundle size, API stability). | The library is already declared in `packages/editor-2d/package.json`. Bundle impact: assess via `pnpm build` size delta; current dist js is ~348kB gzipped to 103kB. flatten-js is ~50kB minified + ~15kB gzipped (per its npm page); should land well under the 350kB budget for editor-2d. If size proves a concern, fall back to hand-rolled segment-vs-rect and segment-vs-circle helpers (~80 LOC of well-known math). |
| Arc-vs-rect intersection is the hardest case; may have edge-case bugs (tangent intersections, partial-arc semantics). | Per-kind unit tests in `wire-intersect.test.ts` cover the obvious cases. Acceptable trade-off: if the arc check has a false negative (under-selects), user can crossing-drag tighter to compensate. False positive (over-selects) would re-introduce the R5 bug shape. Tests focus on false-positive prevention. |
| Element-aligned label rotation can produce upside-down text when the segment angle is near 180°. | A4 specifies the (-π/2, π/2] normalization with a 180° flip — paintTransientLabel handles this internally. Tests cover the flip boundary. |
| Token value change for `label_bg` (now blue) affects ALL transient labels, including future M1.3b modify-operator labels (move-delta, rotate-angle). | Acceptable — the blue accent vocabulary is consistent across all in-flight metric readouts. If M1.3b wants a distinct color (e.g., delta in green for visual differentiation), introduce a `label_bg_secondary` token then; M1.3d-Remediation-2 stays single-token. |
| Hovered-grip computation runs on every cursor frame (rAF-coalesced). | Same rate as snap-on-cursor effect. Workload is `gripHitTest` over `overlay.grips` (typically <10 grips for a single selected primitive); negligible cost at 60Hz. |
| Hovered-grip color (amber `canvas.handle_rotate`) collides semantically with "rotate handle" — future Rotate operator (M1.3b) uses the same color for its rotate-angle handle. | Semantic overlap is acceptable: amber = "this handle is the action target." Both uses are correct. Rotate operator's handle is a transient overlay during the rotate operation; hovered-grip is a static highlight on a selected primitive. Different lifecycles, same visual vocabulary. Consistent. |
| R5 `searchCrossing` taking `Project['primitives']` couples spatial-index to project shape. | Acceptable. `searchEnclosed` already requires the rect; `searchCrossing` additionally needs primitive lookup for narrow-phase. Alternative — pass primitives via constructor — would persist the reference and risk staleness as the project mutates. Lookup-at-query-time matches the existing project subscription pattern. |
| Adding a new `wire-intersect.ts` file in the same directory as `bounding-boxes.ts` could be confused with it. | File name is specific (`wire-intersect` vs `bounding-boxes`); doc comments explain the relationship (wire-intersect is the narrow-phase complement to bbox's broad-phase). |

## 10. §1.3 Three-round self-audit

Per parent plans' §1 lessons, this is a real adversarial pass — three
distinct postures producing real concerns.

### Round 1 — Chief Architect posture (boundaries, invariants, SSOT)

- **C1.1 — Does R5's `searchCrossing` violate the spatial-index's
  abstraction?** Currently `PrimitiveSpatialIndex` is a pure rbush
  wrapper that doesn't know about primitive geometry — only bboxes.
  `searchCrossing` introduces primitive-shape awareness. **Decision:**
  acceptable — the index already KNOWS about xlines specially (via
  `xlineIds`), so primitive-kind awareness exists at the index layer.
  `searchCrossing`'s narrow-phase delegates to a separate module
  (`wire-intersect.ts`); the index just orchestrates broad + narrow.
- **C1.2 — Does R6's token replacement break SSOT for "transient label
  styling"?** The token IS the SSOT; replacing its value doesn't change
  the SSOT, just its content. All consumers (paintTransientLabel +
  paintPreview indirectly + paintSnapGlyph if it ever uses labels)
  pick up the new value automatically. No DRY violation.
- **C1.3 — Does R7's `overlay.hoveredGrip` overlap with `overlay.grips`?**
  They serve different roles: `overlay.grips` is the FULL list of grip
  records for selected entities (positions, kinds, entityIds);
  `overlay.hoveredGrip` is a POINTER to which one is hovered (entityId
  + gripKind only). Different concerns; both belong in the slice.
  Could a single `grips: (Grip & { hovered: boolean })[]` work? Yes,
  but it would couple cursor-proximity computation into the
  selection-grips effect (instead of keeping them as separate effects
  with separate triggers). Two-field design is cleaner.
- **C1.4 — Does R7 break I-DTP-11 (grips appear ONLY on click-select,
  never on hover)?** No. R7 modifies WHICH grip is highlighted, not
  WHEN grips appear. Grips still only appear on click-select; the
  hovered-grip differential is just visual emphasis on an already-
  visible grip.

### Round 2 — Sceptical Reader posture (what would Codex flag?)

- **C2.1 — R5's `wireIntersectsRect` for arc and circle is non-trivial.
  Tests must cover the false-positive case explicitly** (the diagonal-
  line bug shape from F1). `wire-intersect.test.ts` has a dedicated
  case for "bbox-overlaps-rect but wire-doesn't" per kind.
- **C2.2 — Could the rotation logic in paintTransientLabel produce
  numerical instability when angleRad is exactly π/2 or -π/2?** The
  normalization rule `if (angle > π/2 || angle ≤ -π/2) angle += π`
  would flip exactly π/2... actually wait, let me re-check. Let me
  use a clearer normalization: target range `(-π/2, π/2]`. For input
  `α`: while α > π/2: α -= π; while α ≤ -π/2: α += π. This guarantees
  the final angle is in `(-π/2, π/2]`. Edge case α = π/2: exactly π/2
  stays as π/2 (text reads sideways, which is fine for vertical lines
  in CAD). Edge case α = -π/2: snaps to π/2 via the second while.
  Documented in paintTransientLabel as A4 rule.
- **C2.3 — `searchCrossing` adding a primitive-lookup parameter could
  break existing callers of `searchFrustum`.** They're separate methods;
  `searchFrustum` is unchanged. Only `searchCrossing` is new; `select-
  rect.ts` is the sole crossing-call site swap.
- **C2.4 — Could R7's effect over-render?** The cursor effect runs on
  every overlay.cursor change, which is rAF-coalesced. Each fire reads
  store, computes gripHitTest (O(grips)), conditionally writes. Worst
  case: 60Hz × ~10 grips × ~4 floating-point ops per grip = trivial.
- **C2.5 — Tokens-test asserts every leaf is non-empty string. Token
  value change keeps strings non-empty (no edge to `''`).** Verified.
- **C2.6 — Padding token change `'4' → '3'` reduces label size. Could
  the label become unreadable?** 3 px padding × 2 sides = 6 px total
  horizontal padding around 11px text — still legible. AutoCAD's
  comparable dimension labels use similarly tight spacing. Trade-off
  for "small" per user request.

### Round 3 — Blast Radius posture (what could break elsewhere?)

- **C3.1 — Existing `paintTransientLabel` tests assert specific text
  position math.** The rotation parameter is OPTIONAL with default
  `undefined` (no rotation) — existing tests pass without modification.
  New rotation tests are additive.
- **C3.2 — Existing `paintPreview` tests verify each arm calls
  paintTransientLabel.** With R6, those calls now include `angleRad`
  in the options object. Tests assert call args via the proxy
  recorder; the args.length will grow by 1 (options object). Need to
  update existing assertions OR loosen them to "args[0..N-1]" matches.
  Captured in test plan §10.
- **C3.3 — Existing `paintSelection` tests assert `fillRect` called
  per grip.** With R7, hovered grip uses different fill/size. Tests
  may assert specific values; need to either add a new test for the
  hovered case or extend existing tests to cover both. Captured.
- **C3.4 — Token value change affects design-system tests** (the
  tokens.test.ts asserts specific CSS-var emission). Updated values
  should still emit matching `--canvas-transient-label-bg: rgba(...)`
  / `--canvas-transient-label-text: #ffffff` / `--canvas-transient-
  label-padding: 3`. Sample assertions in `tokens.test.ts` check for
  `--canvas-transient-preview-stroke` etc., not the specific values
  of label tokens — should pass unchanged. Verified.
- **C3.5 — `searchCrossing` excluding xlines via the existing
  xlineIds path means crossing selection of an xline still hits via
  bbox (infinite-extent shorthand).** Acceptable: any infinite line
  intersects any finite rect, so bbox-shorthand IS correct for xlines.
  No false positives.
- **C3.6 — R5's narrow-phase rejects entities the user expected to
  select.** Per A2 + per AutoCAD parity, this is the desired behavior.
  Visual feedback (the green crossing rect) doesn't change; only the
  COMMITTED selection narrows.

## 11. Test strategy

**Tests existing before:** baseline at commit `2c13b49` is 346 / 346
across 6 packages.

**Tests added by this remediation:**

- `tests/wire-intersect.test.ts` (R5, NEW): per-kind cases. Approx 8-10
  tests covering the seven primitive kinds + the false-positive
  regression (bbox-overlap without wire-intersect).
- `tests/spatial-index.test.ts` (R5): extend with `searchCrossing`
  test cases — 1 happy-path + 1 bbox-only-overlap-rejected.
- `tests/select-rect.test.ts` (R5): extend the existing crossing test
  to use the wire-intersect path; add the diagonal-line regression.
- `tests/paintTransientLabel.test.ts` (R6): 1-2 new tests for
  `angleRad` parameter (rotation applied; flip in lower half).
- `tests/paintPreview.test.ts` (R6): update existing per-arm tests to
  assert the angle is passed to paintTransientLabel; the line / polyline
  / circle / arc-2pt arms get rotation, rectangle / arc-3pt stay
  horizontal.
- `tests/paintSelection.test.ts` (R7): 1 new test for hovered-grip
  differential rendering (amber + 9×9 vs blue + 7×7).
- `tests/ui-state.test.ts` (R7): 1 new test for `overlay.hoveredGrip`
  default + setHoveredGrip set/clear.
- `tests/smoke-e2e.test.tsx` (R5 + R7 SOLE integration validation
  surfaces — Rev-1 B1 fix added the R5 scenario): 2 new scenarios:
  - `'crossing selection narrows to wire-intersect (not bbox)'` — R5
    SSOT integration test. Mounts `<EditorRoot />`, seeds a wire-
    crossing entity + a bbox-only-overlap entity (the diagonal-line
    regression from §1), drives R→L drag, asserts the resolved
    selection set EXCLUDES the bbox-only-overlap entity. Per Rem-1's
    R4 single-scenario pattern (Codex-approved precedent).
  - `'hovered grip highlights on cursor proximity'` — R7 SSOT
    integration test as previously specified.

**Net new test additions: ≥ 7** (at least: 3 wire-intersect + 1
paintTransientLabel + 1 paintSelection + 2 smoke = 7; spatial-index +
select-rect + ui-state + paintPreview extensions are EXTENDED tests
within existing files, not net-new). Workspace count: 346 + 7 = ≥ 353.

**Tests intentionally not added (deferred):**

- F4 (snap-distance sensitivity UI) tests — deferred to M1.3c.
- Visual-regression for the rotated label — out of scope for M1.3d
  (no image-diff infrastructure).
- (Rev-0's "no select-rect crossing scenario" deferral was REVERSED in
  Rev-1 per Codex Round-1 B1 finding. The R5 SSOT integration test is
  now in scope per §3.1's smoke-e2e row.)

## 12. Why this is one phase, not many

- R5 / R6 / R7 are independent — each touches a distinct surface
  (spatial-index + tools, painters + tokens, UI state + EditorRoot
  effect + paintSelection respectively).
- No shared infrastructure to lay down first.
- Total LOC: ~150 production (wire-intersect ~80 + paintTransientLabel
  rotation ~25 + paintPreview arm-by-arm ~20 + EditorRoot effect ~15
  + paintSelection differential ~10) + ~100 tests.
- Multi-phase ceremony would be pure overhead.

---

## Plan Review Handoff

(Footer convention per Round-1 Rev-5 lesson: revision-history table is
the SSOT for hash chain; the footer points at the table rather than
inlining self-referential hashes.)

**Plan:** `docs/plans/feature/m1-3d-drafting-polish-remediation-2.md`
**Branch:** `feature/m1-3d-drafting-polish` (atop `2c13b49`)
**Status:** Plan authored — awaiting Codex Round-1 review

### Paste to Codex for plan review
> Review this plan using the protocol at
> `docs/procedures/Codex/02-plan-review.md` (Procedure 02).
> Apply strict evidence mode. Start from Round 1.
>
> Context: this is the SECOND remediation pass on `feature/m1-3d-drafting-polish`,
> addressing three additional UX-testing findings on the M1.3d shipped
> surface (post-Round-1 baseline at `2c13b49`). Round-1 remediation
> (R1/R2a/R2b/R4 + QG-1/QG-2 + Rev-5 footer fix) is at commits
> `606e266` + `2c13b49`. Round-2 covers R5 (crossing wire-intersect),
> R6 (blue rotated label pill), R7 (hovered-grip highlight). F4
> (snap-distance sensitivity UI) is explicitly deferred to M1.3c.
> Parent plan + Round-1 plan + their post-execution / revision notes
> are the authoritative context for invariants, gates, and the existing
> implementation surface.

### Paste to user for approval
> Please review the plan at
> `docs/plans/feature/m1-3d-drafting-polish-remediation-2.md`. After
> approval, invoke Procedure 03 to execute the single phase.
