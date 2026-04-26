# Plan — M1.3d Drafting UX Polish (Remediation pass)

**Branch:** `feature/m1-3d-drafting-polish`
**Parent plan:** `docs/plans/feature/m1-3d-drafting-polish.md`
**Parent commit baseline:** `f3e1a1a` (M1.3d implementation `2bbb628` + Codex Round-1 direction-rule remediation `f3e1a1a`, both Codex-approved 10/10)
**Author:** Claude (Opus 4.7, 1M context)
**Date:** 2026-04-26
**Operating mode:** Procedure 01 (PLAN-ONLY) → Procedure 03 (EXECUTION) after Codex review
**Status:** Plan Revision-4 — Codex Round-4 quality-gap cleanups landed during execution (QG-1 + QG-2)

---

## Revision history

| Rev | Date | Driver | Changes |
|-----|------|--------|---------|
| Rev-4 | 2026-04-26 | Codex Round-4 (9.4/10, Go) | Two non-blocking quality-gap cleanups landed during execution per user direction. QG-1: §8 and §11 had diverged into two risk tables with different row sets — merged into a single canonical §8; §11 retired with stub note. QG-2: Plan Review Handoff footer refreshed from stale "Plan authored — awaiting Codex review" to reflect Rev-4 execution-time state with the full revision history chain. Implementation commit (R1/R2a/R2b/R4 + tests) ships the same commit. **Procedural lesson refined a third time:** the consistency pass must scan the FOOTER too — every section that reflects status / handoff context goes stale across revisions if not refreshed. Pattern: revision history table is the SSOT for status; the footer should re-link to it rather than restate. |
| Rev-3 | 2026-04-26 | Codex Round-3 (9.1/10, No-Go on 1 high-risk) | H1' carryover-of-class from Rev-2 lesson: REM-6's expected output still cited the parent baseline `≥343` while Done Criteria specified `≥346`. False-closure risk (gate text could be read as still permitting only the baseline). Fixed: REM-6 expected output bumped to `≥346 (post-remediation, parent baseline + 3 new)`. Q1 (quality, non-blocking): select-rect smoke scenario absent. Acknowledged as documented design choice — symmetry with grip-stretch via shared EditorRoot.handleCanvasMouseUp wiring (already in §10 "Tests intentionally not added"). No change. **Procedural lesson refined:** the §1.16 step 12 consistency pass must scan for ALL data points across normative sections — not just narrative keywords, but also test counts, file lists, threshold values, version numbers. Rev-2's grep for "new test" / "snap mouseup tests" caught keyword references but missed the count number — same class of bug as Rev-1 → Rev-2 carryover. Pattern now explicit. |
| Rev-2 | 2026-04-26 | Codex Round-2 (8.6/10, No-Go on 1 blocker) | B1 carryover from Round-1 H1: REM-5 + Done Criteria still encoded the OLD multi-surface test plan — false-closure risk. Fixed: REM-5 now scopes to `tests/paintCrosshair tests/smoke-e2e` with reworded expectation; new Gate REM-5b adds structural scenario-name grep; Done Criteria test-count delta enumerates the actual 3 new additions (1 pickbox + 1 segment-clear + 1 smoke scenario, total ≥346). **Procedural lesson:** §1.16 step 12 section-consistency pass MUST scan EVERY normative section (gates, Done Criteria, risks, test strategy), not just narrative — Rev-1's `grep "new test"` only caught narrative references, missing the gate block. |
| Rev-1 | 2026-04-26 | Codex Round-1 (8.9/10) | H1: R4 test SSOT — smoke-e2e is the only validation surface; tool-level snap tests dropped from grip-stretch.test.ts and select-rect.test.ts. Q1: Gate REM-4 hardened to targeted multiline grep within handleCanvasMouseUp's body. (Revision-1 partial — gate/checklist update missed; see Rev-2.) |
| Rev-0 | 2026-04-26 | Initial draft | All four findings (R1/R2a/R2b/R4) scoped + §1.3 three-round audit. |

## 1. Request summary

Four user-side UX-testing findings on the M1.3d build at `f3e1a1a`. All four are
implementation-side polish — no spec change, no ADR, no token change.

- **R1 — Properties panel divider missing.** The right-hand properties area
  has no visual seam against the canvas; the two regions read as one
  continuous surface. AutoCAD-style chrome separates them with a 1-px border.
- **R2a — OS cursor arrow renders on top of the painted crosshair.**
  `<canvas>` is missing `cursor: none`. The native pointer competes with the
  painted crosshair for the user's eye.
- **R2b — Crosshair lines pass through the cursor point with no center gap or
  pickbox.** AutoCAD trims the cross lines around a small square at the
  cursor (the *pickbox* — also the click target when no tool is active).
  Current `paintCrosshair` draws two continuous lines.
- **R4 — Snap consumption misses on mouseup-driven `'point'` inputs.** Phase 3
  wired snap consumption into `handleCanvasClick` (mousedown). Phase 7's
  `handleCanvasMouseUp` (used by `grip-stretch` + `select-rect` drag commits)
  feeds the raw cursor metric — bypassing `commitSnappedVertex(snap.point)`.
  Visible snap glyph appears (gating works), but the commit doesn't honor it.

## 2. Assumptions and scope clarifications

User-confirmed in chat 2026-04-26:

- **A1 — All four fixes ship in one commit on `feature/m1-3d-drafting-polish`,
  not a new branch.** The branch is still pre-merge to `main`; landing this as
  one more commit before tag `m1.3d` keeps the M1.3d shipped unit cohesive.
- **A2 — Two related items are deliberately deferred** (see §3.3):
  - **R2c — crosshair size slider UI.** Plan §2 A11 explicitly defers to a
    post-M1 settings dialog. Keeping the deferral.
  - **R3 — circle / arc snap targets (`center`, `quadrant`).** Execution-plan
    v2.0.0 schedules these for M1.3c. Pulling forward would overlap that
    milestone's design surface (extending `OsnapKind`, `gatherOsnapCandidates`,
    `paintSnapGlyph` glyph kinds — non-trivial).
- **A3 — Snap-on-mouseup applies to BOTH `grip-stretch` AND `select-rect`** (not
  just grip-stretch). Reasoning: `handleCanvasClick` (mousedown) already snaps
  for ALL active tools — including select-rect's start point — so symmetry on
  mouseup is the simpler invariant. AutoCAD also snaps select-rect endpoints.
  Risk acknowledged: a far-away snap target could grow the rect more than the
  user intended. Acceptable given AutoCAD parity.
- **A4 — Pickbox half-extent is fixed at 5 CSS px** (10 px square), matching
  AutoCAD's default. M1.3d-Remediation does NOT introduce a `PICKBOX` system-
  variable analog — that ships with the post-M1 settings dialog alongside the
  crosshair-size slider.

## 3. Scope

### 3.1 In scope — files modified

| Path | Change |
|---|---|
| `packages/editor-2d/src/EditorRoot.tsx` | (R1) Add `borderLeft: '1px solid var(--border-default)'` to the properties-area div inline style. (R4) `handleCanvasMouseUp` reads `overlay.snapTarget` and uses `commitSnappedVertex(snap.point)` when present, mirroring `handleCanvasClick`. |
| `packages/editor-2d/src/canvas/canvas-host.tsx` | (R2a) Add `style={{ cursor: 'none' }}` to the `<canvas>` element. |
| `packages/editor-2d/src/canvas/painters/paintCrosshair.ts` | (R2b) Rework to draw four line segments (skipping a `PICKBOX_HALF_CSS = 5` gap around the cursor center) + a `strokeRect` for the pickbox outline. Existing color / dash / dpr logic preserved. |
| `packages/editor-2d/tests/paintCrosshair.test.ts` | Update existing line-count assertions (now 4 moveTo + 4 lineTo per crosshair) + add explicit assertion for the pickbox `strokeRect` + add assertion that no line segment crosses the pickbox region. |
| `packages/editor-2d/tests/smoke-e2e.test.tsx` | (R4 SSOT — Codex Round-1 H1 fix) Add ONE new smoke scenario `'snap honored on grip-stretch mouseup'` to `SCENARIOS` const + matching `it()` block. The scenario mounts `<EditorRoot />`, seeds two primitives (target line + line to grip-stretch), grip-stretches near the target's endpoint with OSNAP on, asserts the primitive's stretched endpoint EXACTLY matches the snap-resolved metric (not the raw mouseup metric). This is the SOLE validation surface for R4. Discipline meta-test picks it up automatically via `SCENARIOS` iteration. |

### 3.2 In scope — files created

None.

### 3.3 Out of scope (discussed and agreed deferred)

- **R2c — crosshair size slider UI.** M1.3d plan §2 A11 explicit deferral. A
  post-M1 settings dialog will surface `setCrosshairSizePct` as a continuous
  control. The F7 toggle (100 ↔ 5) remains the only access path for now.
- **R3 — circle/arc snap targets.** Adds `'center'` and `'quadrant'` `OsnapKind`
  values, extends `gatherOsnapCandidates` to emit them for circle / arc
  primitives, and adds matching `paintSnapGlyph` glyph cases (per
  AutoCAD: `◇` for center, `◇` for quadrant — same glyph, different
  semantics; or distinct symbols if desired). All scheduled for M1.3c per
  `docs/execution-plan.md` v2.0.0.

### 3.4 Blast radius

- **Packages affected:** `editor-2d` only.
- **Cross-cutting hard gates affected:** none — DTP-T1/T2/T6/T7 stay clean.
- **Stored data affected:** none. No schema bump, no migration.
- **UI surfaces affected:** the canvas (cursor visibility + crosshair shape),
  the properties area (visual divider), grip-stretch / select-rect commit
  semantics. Other shell areas (Navbar, Sidebar, CommandBar, StatusBar)
  untouched.
- **ADRs touched:** none. ADR-021 paint pipeline is unchanged in shape; only
  one painter's path commands change.
- **Stored I-DTP invariants affected:** none changed; one widened in spirit
  (I-DTP-19 says `paintCrosshair runs in screen-space` — still true with the
  pickbox addition).

## 4. Architecture doc impact

None. No ADR change, no design-token change, no operator-shortcuts update, no
glossary additions. The `pickbox` term IS in the existing M1.3d glossary (§3.5
of the parent plan) — no need to amend.

## 5. Deviations from binding specifications (§0.7)

**None.** All changes extend existing systems within their declared extension
points.

## 6. Implementation steps (single phase)

R1–R4 are tightly scoped and independent enough that decomposition into
multiple Procedure-03 phases would be overhead. One phase covers all four.

### Step-by-step

1. **R1 — Properties panel divider.** In `EditorRoot.tsx`, add
   `borderLeft: '1px solid var(--border-default)'` to the existing inline
   `style={{ gridColumn: 2, gridRow: 1, overflow: 'auto' }}` on the
   `data-component="properties-area"` div. CSS-var token chosen to match the
   rest of the chrome's border story. No CSS module change (the component
   currently has no module — keeps the diff minimal).
2. **R2a — Hide OS cursor over canvas.** In `canvas-host.tsx`'s `<canvas>`
   JSX, add `style={{ cursor: 'none' }}`. The cursor returns to default when
   the pointer leaves the canvas (browser default behavior). Side effect: when
   `crosshairSizePct === 0` the user has no cursor visual at all over the
   canvas — currently impossible because F7 toggles 100 ↔ 5, but worth noting
   for the future settings slider.
3. **R2b — paintCrosshair pickbox + center gap.** Define
   `PICKBOX_HALF_CSS = 5` constant. Replace the two long `moveTo`/`lineTo`
   segment pairs with four segment pairs that stop short of the pickbox:
   ```
   moveTo(cx - halfH, cy)        → lineTo(cx - pbHalf, cy)         // left arm
   moveTo(cx + pbHalf, cy)       → lineTo(cx + halfH, cy)          // right arm
   moveTo(cx, cy - halfV)        → lineTo(cx, cy - pbHalf)         // top arm
   moveTo(cx, cy + pbHalf)       → lineTo(cx, cy + halfV)          // bottom arm
   ```
   Then `strokeRect(cx - pbHalf, cy - pbHalf, pbHalf * 2, pbHalf * 2)` for
   the pickbox outline. Stroke style + dash pattern unchanged. Pickbox is
   always drawn (whenever the crosshair paints). For `sizePct=5` (pickbox
   preset), `crossLen = 30` device px → `halfH = halfV = 15` → arm visible
   length is `15 - 5 = 10` device px on each side, which is enough to be
   visible alongside the pickbox.
4. **R4 — Snap-on-mouseup.** In `EditorRoot.tsx` `handleCanvasMouseUp`:
   ```ts
   const handleCanvasMouseUp = (metric: Point2D, _screen: ScreenPoint): void => {
     const id = editorUiStore.getState().activeToolId;
     if (id !== 'select-rect' && id !== 'grip-stretch') return;
     const snap = editorUiStore.getState().overlay.snapTarget;
     const point = snap ? commitSnappedVertex(snap.point) : metric;
     runningToolRef.current?.feedInput({ kind: 'point', point });
   };
   ```
   `commitSnappedVertex` is already imported (used by `handleCanvasClick`).
   The whitelist gate stays as-is.
5. **Tests** — see §3.1 for the per-file extensions:
   - `paintCrosshair.test.ts` — assertion counts updated to 4 moveTo + 4 lineTo;
     new test for pickbox `strokeRect`; new test asserting line segments do not
     cross the pickbox region (per-segment endpoint extents check).
   - `smoke-e2e.test.tsx` — extend `SCENARIOS` with `'snap honored on grip-
     stretch mouseup'` and add the matching `it()` block. **This is the SOLE
     validation surface for R4** (Codex Round-1 H1 fix — tool-level tests in
     grip-stretch.test.ts / select-rect.test.ts CANNOT validate R4 because
     the snap-on-mouseup wiring lives in EditorRoot.handleCanvasMouseUp,
     not in the runner; calling `tool.feedInput` directly bypasses that
     route entirely and a tool-level test would pass even with R4 unfixed).
   - `grip-stretch.test.ts`, `select-rect.test.ts` — **NO new tests added.**
     The existing tool-level coverage stays as-is. R4 is integration-layer
     concern only.

### Mandatory completion gates

```
Gate REM-1: Properties area has borderLeft
  Command: rg -n "borderLeft" packages/editor-2d/src/EditorRoot.tsx
  Expected: ≥1 match (on the properties-area div)

Gate REM-2: canvas element has cursor: none
  Command: rg -n "cursor: ['\"]none['\"]" packages/editor-2d/src/canvas/canvas-host.tsx
  Expected: ≥1 match

Gate REM-3: paintCrosshair has the PICKBOX_HALF_CSS constant + strokeRect call
  Command: rg -n "PICKBOX_HALF_CSS|strokeRect" packages/editor-2d/src/canvas/painters/paintCrosshair.ts
  Expected: ≥2 matches (constant declaration + at least one strokeRect site)

Gate REM-4: handleCanvasMouseUp body contains commitSnappedVertex
            (Revision-1 hardening — Codex Round-1 Q1 fix)
  Command: rg -A 10 -n "const handleCanvasMouseUp =" packages/editor-2d/src/EditorRoot.tsx | rg "commitSnappedVertex"
  Expected: ≥1 match (commitSnappedVertex appears within 10 lines after
            the handleCanvasMouseUp declaration — tight enough that a
            comment elsewhere or a reference in handleCanvasClick can't
            satisfy this gate falsely). Behavioral verification continues
            via Gate REM-5 / REM-6 (smoke scenario asserts snap-resolved
            metric is used at commit time).

Gate REM-5: paintCrosshair pickbox tests + R4 smoke scenario pass
            (Revision-2 — Codex Round-2 B1 fix: scoped to actual planned
             additions; drops stale tool-level test file refs)
  Command: pnpm --filter @portplanner/editor-2d test -- tests/paintCrosshair tests/smoke-e2e
  Expected: passes. Vitest runs every it() block in both files; failure
            of any new test (paintCrosshair pickbox/segment-clear or
            smoke-e2e 'snap honored on grip-stretch mouseup') fails the
            file → fails the gate. The discipline meta-test inside
            smoke-e2e iterates SCENARIOS and asserts the new scenario's
            block mounts <EditorRoot /> and uses fireEvent (Gate 21.2.disc).

Gate REM-5b: R4 smoke scenario name appears in SCENARIOS + matching it() block
             (Revision-2 — Codex Round-2 B1 fix: structural scenario-name
              presence check, complements REM-5's behavioral check)
  Command: rg -n "'snap honored on grip-stretch mouseup'" packages/editor-2d/tests/smoke-e2e.test.tsx
  Expected: ≥2 matches (one in SCENARIOS const, one in the matching it()
            block title — the discipline meta-test requires this pairing).

Gate REM-6: Workspace test suite passes
            (Revision-3 — Codex Round-3 H1' fix: count threshold aligned
             with Done Criteria's enumerated +3 delta)
  Command: pnpm test
  Expected: all 6 packages pass; total ≥ 346 (parent baseline 343 + 3 new
            additions per Done Criteria §7: 1 pickbox + 1 segment-clear
            + 1 smoke scenario). Behavioral correctness is enforced by
            vitest's non-zero exit on any failure; the count threshold is
            a human-review consistency check matching Done Criteria.

Gate REM-7: Cross-cutting hard gates clean (DTP-T1/T2/T6/T7)
  Same commands as M1.3d §9. Expected: 0 offenders each.

Gate REM-8: Typecheck + Biome + build
  Commands: pnpm typecheck, pnpm check, pnpm build
  Expected: all exit 0
```

## 7. Done Criteria — objective pass/fail

- [ ] **R1** — Properties area renders with a visible 1-px left border against
  the canvas (verified visually + Gate REM-1 grep).
- [ ] **R2a** — OS cursor is hidden over the canvas (`<canvas style="cursor:
  none">` in DOM; verified visually + Gate REM-2 grep).
- [ ] **R2b** — Crosshair renders with a center gap around a 10×10-px (CSS)
  pickbox square (verified visually + Gate REM-3 grep + Gate REM-5 unit test
  asserting line segments stop short of the pickbox region).
- [ ] **R4** — When a snap target is set during a grip-stretch or select-rect
  drag, the mouseup commit uses the snap-resolved metric (Gate REM-4 +
  REM-5 tests).
- [ ] All Phase REM-1..REM-8 gates pass (REM-1, REM-2, REM-3, REM-4, REM-5,
  REM-5b, REM-6, REM-7, REM-8).
- [ ] Cross-cutting hard gates DTP-T1 / T2 / T6 / T7 pass (parent plan §9).
- [ ] **Workspace test count** ≥ 343 (parent baseline) **+ 3 new = ≥ 346**.
  The 3 new additions, enumerated explicitly to match planned scope (Codex
  Round-2 B1 fix):
  1. `tests/paintCrosshair.test.ts` — `'draws a pickbox square at the cursor'`
  2. `tests/paintCrosshair.test.ts` — `'line segments do not cross the pickbox region'`
  3. `tests/smoke-e2e.test.tsx` — `'snap honored on grip-stretch mouseup'`
  (No new tests in `grip-stretch.test.ts` / `select-rect.test.ts` — see
  §10 + Rev-1 SSOT for why.)
- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build` all pass.

## 8. Risks and Mitigations

(Revision-4 — Codex Round-4 QG-1 fix: §8 and §11 had diverged into two
risk tables with different row sets. This is now the single canonical
risk register; §11 is retired below.)

| Risk | Mitigation |
|------|-----------|
| `cursor: none` over canvas means the user has NO cursor visual when `crosshairSizePct === 0`. Could also confuse a user who alt-tabs back expecting the OS arrow. | M1.3d ships only F7 toggle (100 ↔ 5); 0 is unreachable today. Cursor returns to default when the pointer leaves the canvas, so other chrome regions keep the OS arrow. The post-M1 settings slider needs a guard (probably "force pickbox if sizePct < 1") — captured in the slider's plan. AutoCAD parity makes the learning curve familiar to CAD users. |
| Center-gap math could put the gap outside the line at `sizePct < ~2` (where `halfH = halfV < pbHalf`). | The pickbox-preset case (sizePct=5) gives halfH=15, well clear of pbHalf=5. F7 only reaches 5 or 100, both safe. Defensive `if (halfH > pbHalf)` / `if (halfV > pbHalf)` before drawing the arms keeps very-small sizePct values from emitting backwards segments. New `paintCrosshair` test specifically asserts no segment crosses the pickbox region. |
| Snap on select-rect mouseup grows the rect toward a far-away snap target. | A3 acceptance: matches AutoCAD; mousedown for select-rect already snaps via `handleCanvasClick`, so symmetry is the simpler invariant. If user testing surfaces complaints, refine to grip-stretch only — one-line revert. |
| Pickbox z-order vs snap glyph: pickbox sits at cursor exactly where snap glyph would render, potentially occluding it. | Snap glyph is 8×8 CSS px (endpoint square), pickbox is 10×10 — slight overlap. Glyph is painted AFTER pickbox in the overlay pass (paintCrosshair is FIRST, paintSnapGlyph is later) so the glyph wins z-order. Verified by paint.ts §3 overlay-pass order. |
| `PICKBOX_HALF_CSS = 5` is a magic number not in design tokens. | Acceptable for M1.3d-Remediation. The post-M1 settings dialog will surface a `pickboxSize` token alongside the crosshair-size slider — both pickbox + crosshair UI share the same future settings module. |
| `var(--border-default)` (R1) token not resolving in some test fixture that mounts EditorRoot WITHOUT ThemeProvider. | None today. EditorRoot is always rendered inside ThemeProvider per `apps/web/src/App.tsx`. If a test breaks, wrap the test mount in `<ThemeProvider mode="dark">` (existing pattern from `apps/web/tests`). |

## 9. §1.3 Three-round self-audit

Per parent plan §1 (lessons learned), this is a real adversarial pass — three
distinct postures producing real concerns. Each concern either gets addressed
in the plan body or recorded as a documented trade-off below.

### Round 1 — Chief Architect posture (boundaries, invariants, SSOT)

- **C1.1 — Does R1's inline border violate the design-token discipline?** The
  fix uses `var(--border-default)` which IS the canonical chrome border token
  per `docs/design-tokens.md`. Inline-style usage matches the existing
  `properties-area` div pattern (also inline). No SSOT violation. Could
  migrate the whole layout to a CSS module post-M1; out of scope.
- **C1.2 — Does R2b's pickbox introduce a new "transient styling" surface
  that should live under `canvas.transient.*`?** The pickbox stroke uses the
  same `canvas.transient.crosshair` color as the lines (it's part of the
  crosshair painter, not a separate visual). No new token needed. The
  `PICKBOX_HALF_CSS = 5` magic number is a metric, not a color — captured in
  Risks as a documented trade-off.
- **C1.3 — Does R4 violate I-39 bit-copy contract?** No. The fix uses the
  same `commitSnappedVertex(snap.point)` helper that `handleCanvasClick`
  uses. I-39 bit-identical guarantees hold by virtue of reusing the helper.
- **C1.4 — Does R4 disturb I-DTP-13 (one UPDATE Operation per release)?**
  No. The patch shape and call site are unchanged; only the input metric
  changes from raw to snap-resolved. Still exactly one `updatePrimitive`
  per release.

### Round 2 — Sceptical Reader posture (what would Codex flag?)

- **C2.1 — paintCrosshair test extension may need updates to multiple
  existing tests** that count moveTo/lineTo. Specifically: "renders 2 lines
  ... at sizePct=100" and "renders 2 lines at sizePct=5 (pickbox)" both
  hard-assert `moveTo`.toHaveLength(2). With R2b they become 4. **Plan
  fix:** §3.1 explicitly notes the existing assertions update; §6 step 5
  spells it out. Also: rename the test descriptions from "renders 2 lines"
  to "renders 4 line segments + pickbox" so the test title doesn't lie.
- **C2.2 — `cursor: none` may have an interaction with the existing pan
  state.** Middle-mouse-drag pan currently works regardless of cursor —
  jsdom + real browsers both fire mouse events on the canvas regardless of
  CSS cursor. Not a new bug. Documented here so a future post-commit
  reviewer doesn't flag it.
- **C2.3 — R4's whitelist is currently `select-rect` + `grip-stretch`. When
  a third drag-style tool lands, the whitelist needs an entry AND the snap
  consumption needs to mirror that choice.** Already captured in parent
  plan §12 (C13 risk). This remediation doesn't widen the surface; same
  mitigation applies.
- **C2.4 — Defensive gating on `halfH > pbHalf`** for sizePct < ~2 — added
  to §6 step 3 + to Risks. Without it, a sizePct=1 (1% of canvasH=600 = 6
  device px → halfH=3 < pbHalf=5) would emit `moveTo(cx-3, cy) →
  lineTo(cx-5, cy)` — a backwards-drawn segment. Defensive `if` makes the
  arms simply not draw when crowded by the pickbox.
- **C2.5 — paint.ts overlay-pass z-order: paintCrosshair is FIRST, then
  paintSnapGlyph.** Pickbox + snap glyph overlap means the glyph wins
  visibly (drawn AFTER) — captured in Risks. Sanity-check during
  implementation: the glyph SHOULD paint on top because z-order is the
  last-drawn-wins rule of canvas.

### Round 3 — Blast Radius posture (what could break elsewhere?)

- **C3.1 — Existing `paintCrosshair.test.ts` "renders 2 lines" assertions
  WILL fail** as soon as R2b lands. Plan §6 step 5 + §3.1 explicitly call
  this out.
- **C3.2 — Smoke E2E "cursor coords update on mousemove"** scenario
  asserts text content of `[data-component="coord-readout"]`. Doesn't
  touch the crosshair painting at all. Safe.
- **C3.3 — Smoke E2E "grip stretch updates primitive"** scenario fires
  mousedown + mouseup at known screen coords. With R4, if `overlay.snapTarget`
  happens to be set during the test (it could be — Phase 5 hover effect runs
  on cursor movement), the test's mouseup metric could be replaced by the
  snap-resolved metric. **Mitigation:** the test's mouseup screen position
  (450, 250) is far from any seeded entity's snap targets — no snap should
  resolve. Safe by accident; worth verifying explicitly when testing.
- **C3.4 — Smoke E2E "window vs crossing selection"** uses select-rect.
  Same R4 concern as C3.3 — if a snap target resolves during the drag,
  the rect end snaps to it. Same mitigation: drag endpoints are in empty
  space, no snap candidates nearby.
- **C3.5 — R1's `var(--border-default)` token resolves only when
  `ThemeProvider` is mounted.** EditorRoot is always rendered inside
  ThemeProvider per `apps/web/src/App.tsx` — verified by current shipping
  app. Safe.
- **C3.6 — `cursor: none` over canvas means tools like middle-mouse-drag
  pan have no visible affordance** when the user middle-clicks. Acceptable
  — middle-mouse-pan is keyboard-discoverable + matches AutoCAD which
  also hides the cursor. Documented in Risks.

## 10. Test strategy

**Tests existing before:** baseline at commit `f3e1a1a` is 343 / 343 across
6 packages.

**Tests added by this remediation:**

- `tests/paintCrosshair.test.ts` (R2b coverage): existing line-count
  assertions UPDATED (2 → 4 segments per axis), 2 NEW tests:
  - "draws a pickbox square at the cursor" — asserts `strokeRect` is called
    with the cursor as center and `PICKBOX_HALF_CSS * dpr` as the half-extent.
  - "line segments do not cross the pickbox region" — asserts every line
    segment endpoint sits at `cx ± pbHalf` or beyond, never inside the
    pickbox square.
- `tests/smoke-e2e.test.tsx` (R4 coverage — SOLE validation surface):
  1 NEW scenario added to `SCENARIOS` const + matching `it()` block:
  - **`'snap honored on grip-stretch mouseup'`** — mounts `<EditorRoot />`,
    seeds two primitives (a target line whose endpoint will be the snap
    target + a second line to grip-stretch). With OSNAP on (default),
    fires mousedown on the second line's p1 grip, mousemove near the
    target line's endpoint (so `overlay.snapTarget` is set by the snap-on-
    cursor effect), waits for the rAF flush via `wait(80)` (existing
    smoke pattern), fires mouseup AT a slightly-off screen position, and
    asserts the second line's p1 endpoint EXACTLY matches the target's
    snap-resolved metric (NOT the slightly-off mouseup metric). The
    "exactly matches" assertion uses `toBeCloseTo(..., 9)` since
    `commitSnappedVertex` bit-copies via `Object.is` semantics.

**Why the smoke layer is the SOLE R4 validation surface (Codex Round-1 H1
fix):** the snap-on-mouseup wiring is in `EditorRoot.handleCanvasMouseUp`
which calls `commitSnappedVertex(snap.point)` before forwarding to
`runningToolRef.current?.feedInput`. Tool-level tests in
`grip-stretch.test.ts` / `select-rect.test.ts` call `tool.feedInput` directly
— they bypass EditorRoot entirely. A tool-level "snap" test would PASS even
with R4 unfixed (because the test would feed in a pre-snapped point itself).
Only an EditorRoot-mounted integration test exercises the actual wiring.
Smoke E2E is the established surface for that style of test (M1.3d Phase 9).

Select-rect mouseup-snap is symmetric to grip-stretch (same code path,
same `handleCanvasMouseUp`, same `commitSnappedVertex` call). The grip-
stretch scenario is representative — adding a select-rect duplicate
scenario buys redundant coverage of the same wiring.

**Tests intentionally not added (deferred):**

- `tests/grip-stretch.test.ts`, `tests/select-rect.test.ts` — NO snap tests
  added. These are tool-level unit tests; the snap-on-mouseup behavior is
  EditorRoot's, not the tool's. (Codex Round-1 H1 — single-SSOT R4 testing.)
- Visual-regression for the crosshair shape — out of scope for M1.3d (no
  image-diff infrastructure in place).
- Per-tool select-rect snap-on-mouseup smoke scenario — symmetric to grip-
  stretch's wiring; representative grip-stretch coverage suffices.

## 11. Risks and Mitigations — RETIRED

(Revision-4 — Codex Round-4 QG-1 fix.) This section was a duplicate
risk table with diverging rows from §8. Its content has been merged
into §8 (the canonical risk register). This stub remains so that
existing references to "§11" don't dangle; future revisions should
treat §8 as the sole risk SSOT.

## 12. Why this is one phase, not many

- All four fixes are independent — each touches a single file (or one source +
  one test pair).
- No shared infrastructure to lay down first (vs. M1.3d's tokens + paint loop +
  runner, which had to land in dependency order).
- Total LOC ~80 production + ~120 tests. Multi-phase ceremony would be pure
  overhead.
- Procedure 03's "phase audit" still applies as the single-phase audit at
  closure; cross-cutting hard gates still run.

---

## Plan Review Handoff

(Revision-4 — Codex Round-4 QG-2 fix: footer metadata refreshed to
reflect the actual revision state at execution time. Earlier revisions
left the footer at "Plan authored — awaiting Codex review" which was
stale once Rounds 1-4 produced revisions in §0 history.)

**Plan:** `docs/plans/feature/m1-3d-drafting-polish-remediation.md`
**Branch:** `feature/m1-3d-drafting-polish`
**Revision history:** Rev-0 `8de102b` → Rev-1 `9274f08` → Rev-2 `6999983` → Rev-3 `ea57c21` → Rev-4 (this commit, `<filled-in-at-commit-time>`)
**Status:** Codex Round-4 returned Go (9.4/10) on Rev-3. Rev-4 lands the two non-blocking quality-gap cleanups (QG-1: §8/§11 Risks merged; QG-2: this footer refresh) as part of the Procedure-03 execution commit, per user direction "fix during execution."

### Paste to Codex for post-commit review (after execution)
> Review the execution commit on `feature/m1-3d-drafting-polish` using
> `docs/procedures/Codex/04-post-commit-review.md` (Procedure 04). The
> remediation lands R1 / R2a / R2b / R4 + the QG-1 / QG-2 doc cleanups
> in one commit. Cross-cutting hard gates DTP-T1/T2/T6/T7 should still be
> 0 offenders; workspace test count should be ≥346 per Done Criteria §7.
