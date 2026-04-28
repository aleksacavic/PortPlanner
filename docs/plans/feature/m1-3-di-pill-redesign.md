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
**Status:** Rev-7 authored — Codex Round-7 caught 8 stale-symbol leaks Rev-6's §1.16 sweep missed; addressed + Procedure 01 §1.16.12.a stale-symbol-purge rule landed to prevent recurrence; awaiting Codex Round-8 review

---

## Revision history

| Rev | Date | Driver | Changes |
|-----|------|--------|---------|
| Rev-0 | 2026-04-28 | Initial draft | Per-prompt Dynamic Input manifest; multi-pill chrome replacing single pill; new `paintDimensionGuides` painter (witness + dim lines + angle arcs); per-field input buffer slice with Tab focus cycling; first-pass migration of rectangle / line / polyline / circle. ADR-024 proposed for the manifest contract. §1.3 three-round audit. |
| Rev-7 | 2026-04-28 | Codex Round-7 plan-review findings (1 Blocker + 2 High-risk + 0 Quality — all caused by Rev-6's incomplete §1.16 section-consistency sweep, NOT by new architectural concerns) | **Findings root cause:** Rev-6 correctly rewrote core flow sections (§3 A2.1, Phase 1 step 12, Gate REM6-P1-SyncBootstrapNoReentry, §4.1 EditorRoot.tsx row, §5 ADR-024 row, §10 audit C2.10, §13 risk re-entrancy row) to match the function-based runner + corrected handler names. But the §1.16 step 12 section-consistency sweep was incomplete: it greped for `metricAnchor` / version numbers / execution-time-deferral phrasing (the prior Rev-3/Rev-4 patterns) but did NOT grep for the newly-removed symbols (`handleCanvasMouseDown`, `handleCanvasMouseUp`, `STATE_MACHINE_ADVANCE_METHODS`, `publishPrompt`, `advanceGenerator`, `dispatchInput`, `assertNotInSyncBootstrap`). Result: 8 stale active references survived in §4.1 (runner.ts scope-table row), §4.2 (files-created list), §7 (Gate REM6-P1-ClickEat Test 2/Test 3 wording), §10 audit C3.2, §11 (substrate-runner-tests entry + click-eat-tests entry), §12 (Done Criteria click-eat bullet), §13 (2 click-eat risk rows). **Rev-7 fixes:** all 8 stale references rewritten to current symbols (`handleGripDown`, `handleSelectRectStart`, function-based `startTool` + `inSyncBootstrap` flag + `feedInput` single entrypoint). Active narrative now consistent with Rev-6 D1+D5; historical references (revision history rows, Codex paste block, Post-execution notes, "was incorrectly named X" annotations) preserved. **Procedure tightening:** Procedure 01 §1.16.12.a NEW (Codex's proposed rule from Round-7 memo) — when a revision REMOVES or RENAMES a named symbol, the author MUST grep the literal string against the entire plan and triage every match into bucket (a) stale active → fix, bucket (b) intentional historical → keep, bucket (c) borderline → fix unless framing is explicit. Documented in §1.13 grounding-verification table sibling. **No re-opening of locked decisions:** the Rev-6 architectural lock-ins (function-based runner, single-method `feedInput` re-entrancy guard, `Prompt.dimensionGuidesBuilder` mirror of `previewBuilder`, click-eat handler names) all preserved verbatim — Rev-7 is purely a section-consistency cleanup. |
| Rev-6 | 2026-04-28 | Procedure 03 §3.10 mid-execution deviation discovery — actual runner architecture is function-based, not class-based | **D1 (Runner architecture mismatch, large impact on Rev-5 H):** Plan said `class ToolRunner { static readonly STATE_MACHINE_ADVANCE_METHODS = ['publishPrompt', 'advanceGenerator', 'dispatchInput'] as const; ... }`. Reality is `function startTool(toolId, factory): RunningTool` (closure-based, [runner.ts:38](packages/editor-2d/src/tools/runner.ts:38)). The `RunningTool` interface exposes a single external state-advance entrypoint: `feedInput(input: Input): void` ([runner.ts:154](packages/editor-2d/src/tools/runner.ts:154)). The Rev-5 H SSOT array would have 1 element: `['feedInput']`. **D2 (Cursor-effect model mismatch, medium impact on Rev-2 H1):** Plan said "per-tool cursor-effect handler in `tools/runner.ts` (or per-tool subdir)". Reality is `Prompt.previewBuilder?: (cursor: Point2D) => PreviewShape` ([types.ts:80](packages/editor-2d/src/tools/types.ts:80)) — a per-Prompt **pure callback** captured at yield time. Tools express cursor-effect logic as a closure on the Prompt they yield, not as a separate handler block. **D3 (Synchronous bootstrap already exists, beneficial impact on Rev-3 H2):** Plan presented sync-bootstrap as a NEW thing to add. Reality: lines [116-130](packages/editor-2d/src/tools/runner.ts:116) of runner.ts ALREADY do this for `previewBuilder` — runner reads `overlay.cursor` and synchronously invokes `previewBuilder(cursor.metric)` immediately after publishing the prompt, before returning from the yield-side path. The Rev-3 H2 fix simply extends the existing block to also seed `dimensionGuidesBuilder` if present. **D4 (Re-entrancy risk reduced, simplifying impact on Rev-4 H + Rev-5 H):** With `previewBuilder` and `dimensionGuidesBuilder` as pure-function Prompt callbacks `(cursor) => Shape`, the builder doesn't receive a runner reference — it can't access `feedInput` / `abort` / `done`. The "any state-machine-advance method" concern collapses: there's only `feedInput`, and pure builders can't reach it. The Rev-5 H elaborate SSOT-array + helper machinery was over-engineered for this architecture. The minimal-equivalent guard is a single boolean flag in the `startTool` closure, set/cleared with try/finally around the synchronous builder seed calls; `feedInput` checks the flag. **D5 (Click-eat handler names, small impact on Rev-1 H1):** Plan named `handleCanvasClick` (389) ✓ + `handleCanvasMouseDown` (533) + `handleCanvasMouseUp` (560). Reality: `handleCanvasClick` (389) ✓ + `handleGripDown` (533) + `handleSelectRectStart` (560). All three M1.3d-Rem-4 G2 click-eat annotations exist; handlers serve the same purpose; only the names differ. **Rev-6 changes:** §3 A2.1 simplified to function-based runner contract; §7 Phase-1 step 3a leverages existing previewBuilder pattern; §7 Phase-1 step 12 + Gate REM6-P1-ClickEat target actual handler names; §7 Gate REM6-P1-SyncBootstrapNoReentry collapsed to single-method form on `feedInput` (not parameterized over a 3-element array); §11 test counts adjusted (~33-40 net-new — Rev-5's "~36-43" included tests for methods that don't exist); ADR-024 description (§5) reflects the actual `Prompt.dimensionGuidesBuilder` shape mirroring `Prompt.previewBuilder`. **No re-opening of locked decisions:** the dynamic-anchor schema (Rev-2 H1), angle-deg→rad invariant (Rev-1 H2), ADR-023 immutability (Rev-1 B1), click-eat semantic-outcome unit-test gate (Rev-3 Q + Rev-4 Q2), first-frame coherence invariant (Rev-3 H2) — all preserved. **Procedural lesson + procedure tightening:** the plan-vs-code grounding gap that allowed this discovery to slip past 6 review rounds is captured in commit `62310b2` (`docs(procedures): mandate plan-vs-code grounding`) — Procedure 01 §1.4.1 + §1.13 grounding-table, Procedure 02 §2.4 forced-scan entry + §2.9 output table, Procedure 03 §3.0.1 pre-Phase-1 re-grounding. The Post-execution notes section at the bottom of this plan captures the full discovery narrative. |
| Rev-5 | 2026-04-28 | Codex Round-5 plan-review findings (1 High-risk Review Miss + 2 Quality gaps) | **H (High-risk Review Miss, Agree — caused by Rev-4's "and any other state-machine-advance method" wording without enforceable closure):** Rev-4 named publishPrompt / advanceGenerator / dispatchInput plus "any other state-machine-advance method" but only specified 2 unit tests, with dispatchInput as optional "or". No mechanism guaranteed future entrypoints would be guarded. **Lock SSOT array + helper:** runner exposes `static readonly STATE_MACHINE_ADVANCE_METHODS = ['publishPrompt', 'advanceGenerator', 'dispatchInput'] as const` (extensible — adding a new entrypoint REQUIRES adding to the array, which automatically generates a parameterized test). Single private helper `assertNotInSyncBootstrap(methodName: string): void` called at entry of each guarded method; throws `'cursor-effect re-entered runner during sync bootstrap: ${methodName}'` (error message includes method name for diagnostic clarity). **Test parameterized:** `for (const method of ToolRunner.STATE_MACHINE_ADVANCE_METHODS) it('sync-bootstrap cursor-effect cannot call ${method}', ...)` — iterates the SSOT array, generating 3 tests (one per current entrypoint); test count grows automatically as the array grows. **Exhaustiveness gate:** `rg -c "this\.assertNotInSyncBootstrap\(" packages/editor-2d/src/tools/runner.ts` MUST be ≥ `STATE_MACHINE_ADVANCE_METHODS.length` (proves each named method calls the helper). Failure modes covered: forgot helper → exhaustiveness count gate fails AND parameterized test fails (no throw); forgot array entry → silent omission of test for that method, but the method itself is still guarded at runtime (acceptable — primary safety preserved; secondary test coverage is a code-review responsibility, documented in §13). Updates §3 A2.1 (SSOT array + helper), §7 Phase-1 step 3a.iii (helper call replaces inline check), §7 Gate REM6-P1-SyncBootstrapNoReentry (parameterized + exhaustiveness count + helper-name grep), §10 audit C2.10 (helper SSOT), §11 tests (3 parameterized), §13 risks. **Q1 (Quality, Agree):** Phase-2 step 17 said "Add 4 new smoke-e2e scenarios" while cross-phase + Done Criteria + §11 said 5 (first-frame coherence added in Rev-3 H2 but Phase-2 step 17 wasn't updated to match). Rev-5 §1.16 sweep extends to step-level smoke counts: Phase-2 step 17 → "Add 5 new smoke-e2e scenarios"; first-frame coherence added to the list; Gate REM6-P2-Smoke expected count updated from "≥8 matches" to "≥10 matches" (5 scenarios × 2 occurrences each). **Q2 (Quality, Agree):** Click-eat tertiary "no `console.error`" was fragile to environment noise (jsdom/React dev-time warnings unrelated to click-eat). Dropped tertiary entirely. Two-tier deterministic gate: Primary (MUST pass) — projectStore.entities.size unchanged AND projectStore.temporal.pastStates.length unchanged. Secondary (MUST pass) — overlay.preview unchanged. Updates §7 Gate REM6-P1-ClickEat + §11 click-eat test description. **§1.3 audit additions (light):** R1 — SSOT array + helper is GR-2 simple and testable, no decorator complexity. R2 — both failure directions caught (forgot helper → exhaustiveness count gate + test fail; forgot array → silent test-omission only, runtime guard still active). R3 — test count goes from 2 manual to 3 parameterized; net change ~35-42 → ~36-43. **Procedural lesson reinforced (§13):** Rev-5 §1.16 step 12 pass extends Rev-4's all-sections sweep to **step-level smoke counts** — Phase-2 step 17 carrying a stale count survived through Rev-3 + Rev-4 because the consistency pass focused on structural sections (Done Criteria, risks, audit) but not individual phase-step prose. Added to Rev-5 audit checklist. |
| Rev-4 | 2026-04-28 | Codex Round-4 plan-review findings (1 High-risk Review Miss + 2 Quality gaps) | **H (High-risk Review Miss, Agree — caused by Rev-3 H2 sync-bootstrap fix):** Rev-3 step 3a.ii synchronously triggers the per-tool cursor-effect handler from the runner's prompt-yield path but did not bound what the cursor-effect can do. If a cursor-effect calls back into the runner (publish prompt, advance generator, dispatch input/cancel), recursion or state corruption results. **Lock contract:** cursor-effect handler invoked from 3a.ii is **overlay-write-only** — Allowed: write `overlay.preview` / `overlay.dimensionGuides` / `overlay.snap` / `overlay.cursor`; read project store + tool state. **Forbidden:** publish prompts, advance generator, dispatch tool submit/cancel, mutate `commandBar.*`, mutate domain state. **Enforcement:** runtime guard in `tools/runner.ts` — `inSyncBootstrap` flag set/cleared around the synchronous cursor-effect call (try/finally so it always clears even if cursor-effect throws); methods `publishPrompt` / `advanceGenerator` / `dispatchInput` (and any other state-machine-advance method) check the flag and throw `'cursor-effect re-entered runner during sync bootstrap'` if set. Existing per-cursor-tick cursor-effect path is unaffected (flag is false → no constraint; existing behavior preserved). NEW Gate REM6-P1-SyncBootstrapNoReentry — 2 unit tests in `tests/tool-runner.test.ts`: (1) `'sync-bootstrap cursor-effect cannot republish prompt'` (mounts a fixture cursor-effect that tries `runner.publishPrompt`, asserts throw with the expected error message); (2) `'sync-bootstrap cursor-effect cannot advance generator'` (same pattern for generator-advance). **Q1 (Quality, Agree):** Done Criteria + risk-row remnants from Rev-2 still referenced grep-based click-eat gate framing. Rev-4 §1.16 sweep updates them to match Rev-3 unit-test gate state ("3 unit tests in `tests/click-eat-with-di.test.tsx`, one per handler, refactor-resilient — semantic outcome assertion, not regex/symbol coupling"). **Q2 (Quality, Agree):** Click-eat unit test assertion target ("no entity added + no preview commit") was not deterministic enough. **Locked primary assertion target:** project-store entity count unchanged AND zundo temporal-stack length unchanged (deterministic snapshot-able state via project-store's exposed selectors — abstracts over storage internals). Secondary: `overlay.preview` shape unchanged. Tertiary: no `console.error`. Specified in §11 click-eat test spec + Gate REM6-P1-ClickEat description. **§1.3 audit additions (light):** R1 — runtime guard via flag is GR-2 compliant (testable, named error, no shim); TypeScript narrowing of runner-API surface for "during-bootstrap-only" would need invasive type plumbing, not worth it. R2 — try/finally ensures flag always cleared; future tool needing to break the contract follows §0.7 deviation. R3 — 2 new unit tests update count to ~35-42. **Procedural lesson reinforced (§13):** Rev-3 bucket-(a)/(b)/(c) triage must extend to Done Criteria + risk-table sections, not just core flow steps; Rev-2 wording remnants in non-flow sections caused the Q1 finding. |
| Rev-3 | 2026-04-28 | Codex Round-3 plan-review findings (1 High-risk regression + 1 High-risk Review Miss + 1 Quality) | **H1 (High-risk regression, Agree — my §1.16 step 12 miss in Rev-2):** Phase 1 step 4 still contained stale "implementation chooses re-publish-per-cursor-tick OR reference-resolve-at-render-time at execution time" wording, directly contradicting Rev-2 §3 A2/A2.1 lock-in. Rev-2's section-consistency pass focused on `metricAnchor` / `~25-32` patterns and did not grep for `execution.time` / `implementation chooses` / `MAY either`. **Fix:** stale sentence deleted from step 4; replaced with "Painter is fully driven by `overlay.dimensionGuides` flat coords (Rev-2 §3 A2 lock-in) — no resolution logic, no per-frame state lookup. Dynamic-anchor case (line/polyline) handled upstream in the tool's cursor-effect handler per step 3b." Rev-3 §1.16 step 12 pass uses broader regex coverage (added the missed patterns) — lesson recorded in §13 risks. **H2 (High-risk Review Miss, Agree — caused by Rev-2 step 3a/3b split):** prompt-yield sets `overlay.dimensionGuides = null` (3a); next cursor-tick populates (3b). Pills read manifest+overlay → between yield and first tick = mismatched state, no invariant or gate, would cause first-frame flicker. **Fix:** Option B (synchronous bootstrap) — runner triggers the per-tool cursor-effect handler synchronously on prompt-yield (immediately after publishing the manifest, before returning from the yield-side path), populating `overlay.dimensionGuides` BEFORE first paint. **Invariant** added (§3 A2.1, §11 invariants summary, §13 risk row): `commandBar.dynamicInput.manifest !== null ⟹ overlay.dimensionGuides !== null && overlay.dimensionGuides.length === manifest.fields.length` after prompt-yield, before next paint. NEW Gate REM6-P1-FirstFrameCoherence (unit test in `tests/tool-runner.test.ts` + smoke scenario `'first-frame DI coherence: pill renders at expected metric anchor on prompt-yield (no flicker)'`). Pill component coded defensively: renders multi-pill arm only when BOTH manifest AND guides are present. Optional runtime assertion in runner ("MAY add" per step 3a) for defense-in-depth. **A2.1 locked assumption:** tools that yield manifests do so after a click that sets `overlay.cursor` (line/polyline after first click; rectangle after first-corner click; circle after center click) — the "no cursor" case never occurs at the targeted yield sites. **Q (Quality, Agree):** Rev-2 click-eat grep was helper-name-coupled (`hasNonEmptyDIBuffer` literal), brittle to refactor. **Fix:** Gate REM6-P1-ClickEat converts to **3 unit tests** as primary architecture-significant gate — NEW `tests/click-eat-with-di.test.tsx` with one test per handler (`handleCanvasClick` / `handleCanvasMouseDown` / `handleCanvasMouseUp`), each mounting EditorRoot, setting state with `inputBuffer = ''` AND `dynamicInput.buffers = ['5', '']`, firing the specific event on the canvas, asserting no geometry commits. Existing smoke scenario stays for end-to-end wiring. Grep simplified to annotation-count-only (`rg -c "M1\.3d-Rem(ediation)?-4 G2" EditorRoot.tsx ≥3`) — pure regression-protection on the comments being preserved, NOT on guard implementation. **§1.3 audit additions (light):** R1 runtime-assertion idea baked as "MAY add" in step 3a; R2 cursor-null assumption locked in A2.1; R3 test-count update reflected in §11 (~33-40 net-new). |
| Rev-2 | 2026-04-28 | Codex Round-2 plan-review findings (Rev-1 Review Miss + 2 Quality gaps) | **H1 (High-risk, Agree — Review Miss):** Rev-1 R2-A6 deferred the dynamic-anchor strategy to "decide at execution-time" between flat metric coords vs reference descriptors. Codex Round-2 correctly flagged this as implementation-guessing per Procedure 01 §1.4 — architectural-contract decisions cannot be deferred to execution-time. **Lock-in:** flat metric coordinates ONLY. `DimensionGuide` is a discriminated union (`linear-dim` / `angle-arc` / `radius-line`), each variant carrying concrete `{x: number, y: number}` props — NO reference strings (`'cursor'`, `'midpoint:p1,cursor'`), NO callbacks, NO anchor-id fields. `commandBar.dynamicInput.manifest` is sparse — declares fields + labels + `combineAs` only, NO anchor info. `overlay.dimensionGuides: DimensionGuide[] \| null` is dynamic — written every cursor-effect tick by the per-tool cursor-effect handler in `tools/runner.ts` (existing pattern; same machinery as `overlay.cursor` and `overlay.preview`). Painter reads flat coords, no resolution logic (DTP-T1/T2/T6 contract preserved). Pill component reads `commandBar.dynamicInput` for buffers + active-field AND `overlay.dimensionGuides[N]` for pill N's anchor. NEW Gate REM6-P1-DimensionGuideTypes asserts the schema (positive grep for the 3 variant kinds + negative grep proving zero reference-string fields in `tools/types.ts`). 4 NEW cursor-effect tests in `tests/draw-tools.test.ts` (one per migrated tool) assert that with a known cursor + tool state, the tool's cursor-effect handler writes the expected `DimensionGuide[]` to `overlay.dimensionGuides`. **Q1 (Quality, Agree):** §4.1 EditorRoot scope-table row was internally inconsistent with Phase-1 step 11 (table said "parses each buffer", step said "delegates to helper"). Rewritten: EditorRoot calls `combineDynamicInputBuffers(manifest, buffers, anchor)` only — no parsing or `combineAs` math. Single SSOT statement. **Q2 (Quality, Agree):** Gate REM6-P1-ClickEat tightened from loose `rg -c "dynamicInput" EditorRoot.tsx` to per-site annotation-anchored grep — `rg -B 1 -A 5 "M1\.3d-Rem(ediation)?-4 G2" EditorRoot.tsx \| rg -c "dynamicInput\|hasNonEmptyDIBuffer"` ≥3 — proves each of the 3 click-eat annotation blocks (handleCanvasClick / Down / Up) references DI state. **Meta-lesson recorded in §13 risks:** "decide at execution-time" is legitimate ONLY for implementation tactics (specific algorithms, code organization, helper extraction). Architectural CONTRACT decisions (type shapes, ownership boundaries, publication/subscription patterns) MUST be locked at plan-time; Codex correctly flags contract-level deferrals as no-guessing violations. |
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
- **A2 — Dimension-guide shape descriptors (Rev-2 lock-in — Codex Round-2 H1 fix).** `DimensionGuide` is a discriminated union of three variants. **Each variant carries flat metric coordinates ONLY — no reference strings, no callbacks, no anchor-id fields.** This is locked at plan-time per Procedure 01 §1.4 (no implementation-guessing).
  - `linear-dim` — `{ kind: 'linear-dim', anchorA: { x: number; y: number }, anchorB: { x: number; y: number }, offsetCssPx: number }`. Painter draws witness lines from anchorA and anchorB perpendicular to the dim line, the dim line itself parallel to (anchorB - anchorA) at offsetCssPx (screen-space, converted to metric via `STROKE_WIDTH_CSS / (zoom * dpr)` pattern), arrow ticks at each end. Used for: rectangle W (anchorA = bottom-left corner, anchorB = bottom-right), rectangle H (anchorA = bottom-right, anchorB = top-right), line/polyline distance (anchorA = leg start, anchorB = leg end / cursor).
  - `angle-arc` — `{ kind: 'angle-arc', pivot: { x: number; y: number }, baseAngleRad: number, sweepAngleRad: number, radiusCssPx: number }`. Painter calls `ctx.arc(metricToScreen(pivot), radiusCssPx_in_metric, baseAngleRad, baseAngleRad + sweepAngleRad)`. Used for: line angle (pivot = p1, base = 0 for horizontal-right, sweep = atan2(cursor.y - p1.y, cursor.x - p1.x)), polyline angle (pivot = last vertex), future Rotate angle (pivot = rotation center).
  - `radius-line` — `{ kind: 'radius-line', pivot: { x: number; y: number }, endpoint: { x: number; y: number } }`. Painter draws a tick marker at the midpoint, or no-op if `paintPreview`'s circle arm already draws the radius line (decide at execution time — implementation tactic, not contract).
- **A2.1 — Publication contract (Rev-2 lock-in + Rev-3 first-frame coherence).** Two slices, two timing patterns:
  - `commandBar.dynamicInput.manifest` is **sparse** — published ONCE per prompt-yield. Carries `{ fields: Array<{ kind: 'number'|'distance'|'angle', label?: string }>, combineAs: 'numberPair'|'point'|'number' }`. **NO anchor coordinates anywhere on the manifest.** The manifest is declarative metadata: how many fields, what kinds, what labels, how to combine on submit.
  - `overlay.dimensionGuides: DimensionGuide[] | null` is **dynamic** — written every cursor-effect tick by the per-tool cursor-effect handler in `tools/runner.ts` (or per-tool subdir). Each opted-in tool extends its existing cursor-effect block (which already updates `overlay.preview` per cursor-tick) to ALSO compute its `DimensionGuide[]` from current cursor + local tool state and write them. The dimensionGuides array has a 1:1 correspondence with the manifest's fields array (dimensionGuides[N] is the guide for field[N]); the pill component uses `dimensionGuides[N]` to position pill N.
  - **First-frame coherence (Rev-3 H2 fix):** runner triggers the per-tool cursor-effect handler **synchronously on prompt-yield** (immediately after publishing the manifest, before returning from the yield-side path). This populates `overlay.dimensionGuides` BEFORE the first paint, eliminating the gap between manifest-set and guides-set. **Invariant:** `commandBar.dynamicInput.manifest !== null ⟹ overlay.dimensionGuides !== null && overlay.dimensionGuides.length === manifest.fields.length` (after prompt-yield, before next paint). Enforced by Gate REM6-P1-FirstFrameCoherence (unit test in `tests/tool-runner.test.ts`) + smoke scenario.
  - **Sync-bootstrap re-entrancy contract (Rev-4 H fix; Rev-6 adapted to function-based runner):** the `dimensionGuidesBuilder` callback (and the existing `previewBuilder`) invoked synchronously from step 3a.ii is **overlay-write-only**. **Allowed:** write `overlay.previewShape` / `overlay.dimensionGuides` / `overlay.snap` / `overlay.cursor`; READ project store, tool state, viewport, design tokens; the builder is a **pure function** `(cursor: Point2D) => PreviewShape | DimensionGuide[]` — it does not receive a `RunningTool` reference, so it cannot reach `feedInput` / `abort` / `done` even by accident. **Forbidden:** call `RunningTool.feedInput`, mutate `commandBar.*` slice, mutate domain state. **Enforcement (architecture — Rev-6 simplified):** the builder's pure-function signature is the primary defense; pure functions cannot receive references they aren't passed. **Enforcement (runtime — defense-in-depth):** `tools/runner.ts` (function-based, `startTool` closure-scoped) maintains a closure-local `inSyncBootstrap` boolean, set to `true` immediately before the synchronous builder seed calls (existing pattern at [runner.ts:120-124](packages/editor-2d/src/tools/runner.ts:120) for `previewBuilder`; extended in this round for `dimensionGuidesBuilder`), cleared in a `finally` block. The `feedInput(input: Input): void` method on the returned `RunningTool` interface checks the flag at entry: `if (inSyncBootstrap) throw new Error('cursor-effect re-entered runner during sync bootstrap')`. **Single state-advance entrypoint:** `feedInput` is the only externally-callable runner method that advances the generator — there is no `publishPrompt` / `advanceGenerator` / `dispatchInput`; the runner's internal generator iteration loop is closure-private and not exposed. **Enforcement (test — Gate REM6-P1-SyncBootstrapNoReentry, single-method form):** unit test in `tests/tool-runner.test.ts` mounts a fixture cursor-effect builder closing over a captured `RunningTool` reference (test-only contrivance — production builders cannot do this) and calling `runningTool.feedInput(...)` from inside the builder; assert the synchronous bootstrap call throws. The test is not parameterized over an SSOT array because there is only one method to guard. **Future deviation:** if a future state-advance entrypoint is added to the `RunningTool` interface, the §1.4.1 plan-vs-code grounding for that change MUST extend the flag-check to the new method. §0.7 Approved Deviation Protocol applies if the contract itself changes.
  - **Locked assumption (Rev-3 R2):** tools that yield manifests do so after a click that sets `overlay.cursor` — line/polyline yield only after first click; rectangle yields second-corner manifest only after first-corner click; circle yields radius manifest only after center click. The "no cursor" case never occurs at the targeted yield sites; cursor is always valid input to the synchronous bootstrap.
  - **Painter `paintDimensionGuides` reads flat coords from `overlay.dimensionGuides` only** — no resolution logic, no project-store imports, no manifest reads. Preserves DTP-T1/T2/T6/T7 contract.
  - **Pill component reads BOTH slices** — `commandBar.dynamicInput` for buffers + activeFieldIdx + manifest field labels; `overlay.dimensionGuides[N]` for pill N's anchor coords. Multi-source reads are allowed in chrome (the painter contract restriction does not apply to React components). **Defensive coding:** pill renders the multi-pill arm only when BOTH `manifest` AND `dimensionGuides` are present (so a hypothetical future bug that violates the invariant degrades to single-pill or null rather than crashing).
- **A3 — Multi-pill chrome.** Existing `chrome/DynamicInputPill.tsx` (single pill at cursor) is **replaced** by `chrome/DynamicInputPills.tsx` (plural). The new component reads the active prompt's manifest from store, renders 0..N pills at metric-anchored positions (each `metricToScreen(anchor) + offset`), highlights the focused pill, shows a caret on the focused pill, and disappears when no manifest is active. Single-pill behavior (when prompt has no DI manifest but accumulator or inputBuffer is non-empty) still renders ONE pill at cursor as the degenerate case — same fallback as M1.3d-Rem-4 G2's pill.
- **A4 — Per-field input buffer.** New slice field `commandBar.dynamicInput: { activeFieldIdx: number; buffers: string[] } | null`. Null when no manifest is active; populated when the runner publishes a manifest. The existing single `inputBuffer` stays for non-DI paths (bottom command line typing, accumulator); `dynamicInput.buffers` is the parallel structure for DI prompts. Both can't be active simultaneously.
- **A5 — Tab focus cycling.** Keyboard router intercepts `Tab` at canvas focus AND bar focus when `commandBar.dynamicInput !== null`. Tab cycles `activeFieldIdx` modulo `buffers.length`. Shift+Tab cycles backwards. Tab pass-through to native browser behavior when no manifest is active (preserves keyboard accessibility for chrome regions).
- **A6 — Numeric routing while DI is active.** Numeric / punctuation keys (`0-9`, `.`, `-`, `,`) at canvas focus when DI is active append to `dynamicInput.buffers[activeFieldIdx]` (NOT the legacy single `inputBuffer`). Backspace pops from that field's buffer. Esc clears all DI field buffers. Enter / Space combines all field buffers via the manifest's `combineAs` policy and feeds a single Input to the runner.
- **A7 — `combineAs` policies.** First-pass set, implemented as SSOT in pure helper `combineDynamicInputBuffers(manifest, buffers, anchor): Input | null` at `packages/editor-2d/src/tools/dynamic-input-combine.ts` (NEW). The helper does the COMBINATION; per-field PARSING is delegated to the existing parser path in `tools/runner.ts` (re-use, do NOT duplicate — SSOT preservation per §10 audit R1-A2). Returns `null` if any required buffer is empty / un-parseable; caller treats null as "ignore submit".
  - `'numberPair'` → `{kind: 'numberPair', a: parsed[0], b: parsed[1]}`. Used by rectangle's W,H. Already exists from M1.3d-Rem-5 H1 — direct reuse of the parser path.
  - `'point'` → polar conversion: given `[distance, angleDeg]`, compute `{kind: 'point', point: {x: anchor.x + cos(angleRad) * distance, y: anchor.y + sin(angleRad) * distance}}` where `angleRad = (angleDeg * Math.PI) / 180`. **Anchor sourcing (Rev-2 lock-in):** anchor is supplied by the caller (`EditorRoot.onSubmitDynamicInput`) at submit time, sourced from `overlay.dimensionGuides[0].anchorA` (or equivalent — the line-tool guide carries `anchorA = p1`; the polyline-tool guide carries `anchorA = lastVertex`). Manifest fields do NOT carry anchor info (Rev-2 H1 schema lock). Prompt's `directDistanceFrom` field (used by the bar-form F1 path) carries the same anchor independently — both paths resolve to the same metric point. **Angle invariant: the typed `angle` field is INVARIANT in DEGREES (AC convention; user types "30" expecting 30°). The helper performs deg→rad conversion ONLY for `combineAs: 'point'` polar trig. Future trig users (e.g., M1.3b Rotate sweep angle) MUST route through the same helper or reuse the same constant — no mixed conventions.** Used by line/polyline second-point with both fields filled.
  - `'number'` → single field `{kind: 'number', value: parsed[0]}`. Used by circle radius and any single-field manifest.
  - Future: `'numberTuple'`, `'angle'` (as a top-level Input kind for Rotate-style operators) — add when needed; not in this round.
- **A8 — F1 directDistanceFrom interplay.** F1 (typing a single number into the bottom command line for line/polyline/circle/arc to interpret as polar distance from anchor) STAYS unchanged. It's the single-field shortcut path. The new DI manifest is the multi-field enhanced path. When a tool yields a prompt with BOTH `directDistanceFrom` and a `dynamicInput` manifest, both work — bar-form Enter triggers F1; per-field DI Enter triggers the manifest's combineAs path. Bottom command line and DI pills are alternate surfaces for the same inputBuffer concept; on submit, whichever path the user used wins.
- **A9 — Per-tool migration scope (first-pass).** Four tools migrate in this round:
  1. **draw-rectangle.ts** — second-corner prompt grows `dynamicInput` manifest with two `linear-dim` fields (W on bottom edge, H on right edge), `combineAs: 'numberPair'`. **Locked (Rev-3 §1.16 consistency pass):** ONLY the primary second-corner prompt opts in this round; the F3 Dimensions sub-flow's single `numberPair` prompt (M1.3d-Rem-5 H1) stays as-is — bar-form numberPair input, no DI manifest. Rationale: F3 already has a coherent bar-form input surface; adding a duplicate canvas-focus DI surface would be redundant.
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
| `packages/editor-2d/src/tools/types.ts` | Add `DynamicInputManifest`, `DynamicInputField`, `DimensionGuide` types per Rev-2 A2 lock-in. **`DynamicInputField` is `{ kind: 'number' \| 'distance' \| 'angle', label?: string }` ONLY — no `metricAnchor` field, no `dimensionGuide` field, no reference-string field.** `DynamicInputManifest` is `{ fields: DynamicInputField[], combineAs: 'numberPair' \| 'point' \| 'number' }` — sparse, no anchor info. **`DimensionGuide` is a discriminated union of three variants, each carrying flat `{ x: number; y: number }` metric coords ONLY — no reference strings, no callbacks, no IDs.** Add optional `Prompt.dynamicInput?: DynamicInputManifest`. No change to existing `Input` arms (numberPair / point / number already exist). |
| `packages/editor-2d/src/ui-state/store.ts` | Add `commandBar.dynamicInput: { activeFieldIdx: number; buffers: string[] } \| null` slice field. New actions: `setDynamicInputManifest(state)`, `setDynamicInputActiveField(idx)`, `setDynamicInputFieldBuffer(idx, value)`, `clearDynamicInput()`. Existing `inputBuffer` field unchanged. |
| `packages/editor-2d/src/ui-state/store.ts` | Add `overlay.dimensionGuides: DimensionGuide[] \| null` (mirrors the active prompt's manifest fields' guides for the painter to render). New action `setDimensionGuides`. |
| `packages/editor-2d/src/tools/runner.ts` | Per Rev-2 + Rev-3 + Rev-6 publication contract for the function-based `startTool(toolId, factory): RunningTool`: (a) on prompt-yield with `dynamicInput`, call `setDynamicInputManifest(manifest)` + reset buffers (sparse manifest publication — Phase-1 step 3a.i); (b) **extend the existing synchronous-builder-seed block at [runner.ts:116-130](packages/editor-2d/src/tools/runner.ts:116) to also seed `prompt.dimensionGuidesBuilder(cursor.metric)` if present, wrapped with closure-local `inSyncBootstrap = true; try { ... } finally { inSyncBootstrap = false }`** (Rev-3 H2 first-frame coherence + Rev-4 H + Rev-6 single-method re-entrancy guard — Phase-1 step 3a.ii); (c) on tool teardown OR yielded prompt without manifest, call `clearDynamicInput()` + `setDimensionGuides(null)` (Phase-1 step 3c). **Add `inSyncBootstrap` boolean to the `startTool` closure scope + check at entry of `RunningTool.feedInput(input)` (Rev-6 single-method form — actual function-based runner has only one external state-advance entrypoint; the elaborate Rev-5 SSOT array was based on a misread architecture).** Per-cursor-tick path is unchanged — guides written by `Prompt.dimensionGuidesBuilder` callback (step 3b), mirroring the existing `Prompt.previewBuilder` pattern. |
| `packages/editor-2d/src/keyboard/router.ts` | Tab handler: at canvas/bar focus when `commandBar.dynamicInput !== null`, intercept `Tab` (preventDefault) + cycle `activeFieldIdx`. Shift+Tab cycles backward. Numeric routing branch (existing G2) updates: when DI is active, route to `dynamicInput.buffers[activeFieldIdx]` instead of `inputBuffer`. Backspace branch updates similarly. **Enter branch:** when DI is active, invoke the new callback `onSubmitDynamicInput(manifest, buffers)` — the router does NOT combine; combination happens in EditorRoot's callback implementation which delegates to `combineDynamicInputBuffers` helper per Phase-1 step 11 (Rev-1 H2 SSOT helper; Rev-2 Q1 delegation lock-in). Esc clears DI buffers (in addition to existing accumulator/inputBuffer clear). |
| `packages/editor-2d/src/EditorRoot.tsx` | New callback `onSubmitDynamicInput` impl: **calls `combineDynamicInputBuffers(manifest, buffers, anchor)` (the SSOT helper); if it returns non-null, feeds the Input to runner and clears DI buffers via `clearDynamicInput()`. NO parsing, NO `combineAs` policy logic, NO deg→rad conversion in `EditorRoot.tsx` — delegation only** (Rev-2 Q1 fix; aligns scope-table row with Phase-1 step 11 + Gate REM6-P1-AngleUnit cross-check that asserts zero conversion-symbol matches in `EditorRoot.tsx`). Anchor is sourced from `overlay.dimensionGuides[0]` (or equivalent first-field guide) at submit time. |
| `packages/editor-2d/src/canvas/painters/paintDimensionGuides.ts` | NEW. Reads `overlay.dimensionGuides`. Per-shape painter:<br>- `linear-dim`: two witness lines (perpendicular off the measured segment, screen-px offset converted to metric); dim line connecting them at the offset distance; arrow ticks at each end.<br>- `angle-arc`: arc centered at `pivot` from `baseAngleRad` sweeping `sweepAngleRad` at radius `radiusPx` (screen-space radius converted to metric).<br>- `radius-line`: small tick marker at midpoint or no-op if circle preview already draws it. |
| `packages/editor-2d/src/canvas/paint.ts` | Dispatch `paintDimensionGuides` during the overlay pass after `paintPreview` (so dim guides paint on top of the rubber-band geometry). |
| `packages/editor-2d/src/chrome/DynamicInputPill.tsx` | DELETE (replaced by `DynamicInputPills.tsx`). |
| `packages/editor-2d/src/chrome/DynamicInputPill.module.css` | DELETE or rename to `DynamicInputPills.module.css`. |
| `packages/editor-2d/src/chrome/DynamicInputPills.tsx` | NEW. Reads `commandBar.dynamicInput` (buffers + activeFieldIdx + manifest field labels), `overlay.cursor` (fallback pill positioning), **`overlay.dimensionGuides` (per-pill anchor coords — Rev-2 lock-in)**, `commandBar.activePrompt`, `commandBar.accumulator`, `commandBar.inputBuffer`, `toggles.dynamicInput`. Renders:<br>- 0 pills if `toggles.dynamicInput` is false OR no manifest AND no accumulator/inputBuffer/prompt to fall back on.<br>- 1 fallback pill at `cursor.screen + offset` if no manifest but accumulator / inputBuffer / prompt exists (preserves M1.3d-Rem-4 G2 behavior for non-DI prompts).<br>- N pills if a manifest is active. Pill N's screen position = `metricToScreen(derivePillAnchor(overlay.dimensionGuides[N])) + offset`. Helper `derivePillAnchor(guide: DimensionGuide): {x,y}` computes the pill's metric anchor from the guide's flat coords (linear-dim → midpoint of [anchorA, anchorB] + perpendicular offset; angle-arc → on the arc at sweep midpoint; radius-line → on the line at midpoint). Focused pill has yellow glow + caret. |
| `packages/editor-2d/src/chrome/DynamicInputPills.module.css` | NEW. `.pill` (existing styles), `.pillFocused` (glow), `.pillCaret` (animated caret), `.pillLabel` (small dim prefix like "W:"). |
| `packages/editor-2d/src/EditorRoot.tsx` | Import `DynamicInputPills` instead of `DynamicInputPill`. Update mount site. |
| `packages/editor-2d/src/tools/draw/draw-rectangle.ts` | Second-corner prompt grows sparse `dynamicInput` manifest: `{ fields: [{kind: 'number', label: 'W'}, {kind: 'number', label: 'H'}], combineAs: 'numberPair' }`. **Cursor-effect handler (Rev-2 lock-in) ALSO writes `overlay.dimensionGuides`** with two `linear-dim` guides — guide[0] (W) anchorA = first-corner, anchorB = (cursor.x, first-corner.y); guide[1] (H) anchorA = (cursor.x, first-corner.y), anchorB = cursor. Same cursor-effect block that already updates `overlay.preview`. |
| `packages/editor-2d/src/tools/draw/draw-line.ts` | Second-point prompt grows sparse manifest: `{ fields: [{kind: 'distance', label: 'Distance'}, {kind: 'angle', label: 'Angle'}], combineAs: 'point' }`. **Cursor-effect handler (Rev-2 lock-in) ALSO writes `overlay.dimensionGuides`** — guide[0] = `linear-dim` with anchorA = p1, anchorB = cursor; guide[1] = `angle-arc` with pivot = p1, baseAngleRad = 0, sweepAngleRad = atan2(cursor.y - p1.y, cursor.x - p1.x), radiusCssPx = 40 (or design-token-equivalent). Existing F1 `directDistanceFrom` field on the prompt stays unchanged. |
| `packages/editor-2d/src/tools/draw/draw-polyline.ts` | Each loop's prompt grows the same manifest shape as draw-line. **Cursor-effect handler (Rev-2 lock-in) ALSO writes `overlay.dimensionGuides`** — same shapes as line, with pivot/anchorA = `verticesSnapshot[verticesSnapshot.length - 1]` (last vertex) per loop iteration. |
| `packages/editor-2d/src/tools/draw/draw-circle.ts` | Radius prompt grows sparse manifest: `{ fields: [{kind: 'distance', label: 'Radius'}], combineAs: 'number' }`. **Cursor-effect handler (Rev-2 lock-in) ALSO writes `overlay.dimensionGuides`** with one `radius-line` guide — pivot = ctr, endpoint = cursor. (May be a no-op if `paintPreview`'s circle arm already draws the radius line; decide at execution time — implementation tactic, not contract.) |
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
- `packages/editor-2d/tests/click-eat-with-di.test.tsx` (NEW — Rev-3 Q fix; 3 unit tests, one per actual click-eat handler — `handleCanvasClick` / `handleGripDown` / `handleSelectRectStart` (Rev-6 D5 corrected names) — each mounts EditorRoot and asserts the handler suppresses path when DI buffers are non-empty)
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
- **Tests rework volume:** medium. ~33-40 net-new tests (substrate ~29: types ×1 + slice ×3 + runner ×3 incl. synchronous-bootstrap (Rev-3 H2) + **1 re-entrancy test on `feedInput` (Rev-4 H + Rev-6 single-method form)** + painter ×3 + multi-pill ×4 + router ×5 + combiner helper ×7 across edge cases + click-eat handler unit tests ×3 (Rev-3 Q); per-tool generators ×4; per-tool cursor-effect ×4 (Rev-2 H1); smoke ×5 including click-eat-with-DI parity + first-frame coherence (Rev-3 H2)) + ~5 migrated. **Threshold gate (REM6-10): ≥480 (470 + ≥10 minimum).** Actual count expected to be in the ~503-513 range; informational tripwire only per Rev-1 Q2.

## 5. Architecture doc impact

| Doc | Change |
|---|---|
| `docs/adr/024-dynamic-input-manifest.md` | **NEW** — proposed. Per-prompt DI manifest contract: (a) `DynamicInputField` shape (`{ kind: 'number' \| 'distance' \| 'angle', label?: string }`) — manifest fields carry NO anchor info; (b) `DynamicInputManifest` shape (`{ fields: DynamicInputField[], combineAs: ... }`) — sparse, declarative metadata only; (c) **`DimensionGuide` discriminated union with three variants, EACH carrying flat `{x: number, y: number}` metric coords ONLY** — `linear-dim` (anchorA + anchorB + offsetCssPx), `angle-arc` (pivot + baseAngleRad + sweepAngleRad + radiusCssPx), `radius-line` (pivot + endpoint). NO reference strings (`'cursor'`, `'midpoint:p1,cursor'`), NO callbacks at the shape level, NO anchor IDs (Rev-2 H1 lock-in); (d) `combineAs` policy enum (`'numberPair' \| 'point' \| 'number'`); (e) **publication contract (Rev-6 adapted to function-based runner architecture)** — `commandBar.dynamicInput.manifest` published once per prompt-yield (sparse); `overlay.dimensionGuides` written by `Prompt.dimensionGuidesBuilder?: (cursor: Point2D) => DimensionGuide[]` (a per-Prompt **pure callback** mirroring the existing `Prompt.previewBuilder` pattern at [runner.ts:80](packages/editor-2d/src/tools/types.ts:80)). The runner subscribes to `overlay.cursor` and re-invokes the builder on every cursor change (the existing `ensurePreviewSubscription` mechanism is extended to also fire `dimensionGuidesBuilder`). Synchronous seed on yield via the same block at [runner.ts:116-130](packages/editor-2d/src/tools/runner.ts:116) that already seeds `previewBuilder`; painter `paintDimensionGuides` reads flat coords only — no resolution logic, preserves DTP-T1/T2/T6/T7 contract; (f) painter dispatch model (per-shape switch in `paintDimensionGuides`); (g) per-field buffer model + Tab-cycling focus invariant; (h) **angle-unit invariant** — typed angle field is in degrees; `combineAs: 'point'` converts to radians via `(angleDeg * Math.PI) / 180` before trig (SSOT in `packages/editor-2d/src/tools/dynamic-input-combine.ts`); (i) **sync-bootstrap re-entrancy contract** — builder callbacks are pure functions (no `RunningTool` reference); closure-local `inSyncBootstrap` flag in `startTool` set/cleared with try/finally around synchronous seed; `RunningTool.feedInput` (the single state-advance entrypoint) checks the flag; (j) one-way cross-reference to ADR-023 from ADR-024's own body — ADR-023 file is NOT modified per §0.6. |
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
3. Update `tools/runner.ts` per the Rev-2 publication contract (§3 A2.1):
   - **3a. On prompt-yield with a manifest (Rev-6 adapted to function-based runner):** the existing `startTool` async IIFE ([runner.ts:93-150](packages/editor-2d/src/tools/runner.ts:93)) extends its prompt-handling block (currently lines 107-130) to also handle `dynamicInput`. Specifically:
     - (i) Call `setDynamicInputManifest(manifest)` + reset `dynamicInput.buffers` to `Array(manifest.fields.length).fill('')` + `activeFieldIdx` to 0 (Rev-1 R2-A5 buffer-reset semantics; each prompt yield is one input session — polyline-loop iterations start with empty buffers per leg).
     - (ii) **Synchronous bootstrap (Rev-3 H2 + Rev-6 leverages existing pattern):** the existing block at [runner.ts:116-130](packages/editor-2d/src/tools/runner.ts:116) ALREADY synchronously seeds `previewBuilder(cursor.metric)` from the current `overlay.cursor` immediately after publishing the prompt. Extend the same block to also seed `prompt.dimensionGuidesBuilder(cursor.metric)` if present, writing the result to `overlay.dimensionGuides` via `setDimensionGuides`. Wrap the synchronous builder seed calls in `try/finally` with `inSyncBootstrap = true; try { ... } finally { inSyncBootstrap = false }`. Pseudocode:
     ```ts
     // Existing — Rev-3 H2 sync bootstrap leverages this:
     if (prompt.previewBuilder || prompt.dimensionGuidesBuilder) {
       const cursor = editorUiStore.getState().overlay.cursor;
       if (cursor) {
         inSyncBootstrap = true;
         try {
           if (prompt.previewBuilder) {
             editorUiActions.setPreviewShape(prompt.previewBuilder(cursor.metric));
             lastCursorSeen = { x: cursor.metric.x, y: cursor.metric.y };
           }
           if (prompt.dimensionGuidesBuilder) {
             editorUiActions.setDimensionGuides(prompt.dimensionGuidesBuilder(cursor.metric));
           }
         } finally {
           inSyncBootstrap = false;
         }
       }
     }
     ```
     This populates `overlay.dimensionGuides` BEFORE returning from the yield-side path (Rev-3 H2 — first-frame coherence) AND prevents re-entrancy (Rev-4 H — overlay-write-only contract per §3 A2.1).
     - (iii) **Re-entrancy guard on `feedInput` (Rev-6 single-method form):** the closure-returned `RunningTool.feedInput(input: Input): void` method ([runner.ts:154](packages/editor-2d/src/tools/runner.ts:154)) checks the closure-local `inSyncBootstrap` flag at entry: `if (inSyncBootstrap) throw new Error('cursor-effect re-entered runner during sync bootstrap')`. This is the single state-advance entrypoint on the runner; there are no `publishPrompt` / `advanceGenerator` / `dispatchInput` methods (those were plan-text artifacts that did not match reality — see Rev-6 D1 in revision history). The architectural primary defense is the pure-function signature of `previewBuilder` / `dimensionGuidesBuilder` — builders don't receive a `RunningTool` reference and so cannot reach `feedInput` in production code. The flag-on-`feedInput` is defense-in-depth for test-time contrivances and future refactors.
     - (iv) **MAY add post-bootstrap runtime assertion (defense-in-depth):** `assert(overlay.dimensionGuides?.length === manifest.fields.length, 'first-frame coherence violated — cursor-effect bootstrap missing or returned wrong field count')`. Locked assumption (§3 A2.1): `overlay.cursor` is always valid at yield sites because tools yield manifests only AFTER a click that establishes cursor state.
   - **3b. On cursor-effect tick (existing per-frame pipeline; Rev-2 H1 lock-in):** the per-tool cursor-effect handler — which already updates `overlay.preview` per cursor-tick — extends to ALSO compute its `DimensionGuide[]` from current cursor + tool state and write to `overlay.dimensionGuides` via `setDimensionGuides(guides)`. Each tool produces 1 DimensionGuide per manifest field (1:1 correspondence: dimensionGuides[N] is the guide for fields[N]). NO publication of the manifest from this path — only the guides update. Tools without a manifest active produce no guides (cursor-effect leaves `overlay.dimensionGuides` as-is).
   - **3c. On tool teardown OR yielded prompt WITHOUT a manifest:** runner calls `clearDynamicInput()` + `setDimensionGuides(null)`.
4. Create `paintDimensionGuides.ts` with the per-shape switch dispatcher. Implement `linear-dim` (witness + dim line + ticks), `angle-arc` (ctx.arc with screen-px radius converted to metric), `radius-line` (single tick or no-op). **Painter is fully driven by `overlay.dimensionGuides` flat coords (Rev-2 §3 A2 lock-in) — no resolution logic, no per-frame state lookup beyond the slice read, no project-store imports (DTP-T6 preserved). Dynamic-anchor case (line/polyline distance-along-leg, circle radius endpoint) is handled upstream in each tool's cursor-effect handler per step 3b.** (Rev-3 H1 fix — Rev-2's stale "implementation chooses re-publish-per-cursor-tick OR reference-resolve-at-render-time at execution time" wording removed; Codex Round-3 correctly flagged this as a contract regression contradicting the Rev-2 lock-in.)
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
    - **Delegates per-field PARSING to the existing parser path in `tools/runner.ts`** (re-use, do NOT duplicate — Rev-1 R1-A2 SSOT preservation). **Tactical decision (NOT contract — locked: helper delegates to existing parser; only the location of that parser is implementation choice):** at execution time, locate the existing parser; if it lives inline in runner.ts, extract it to a shared module that both runner and helper import. The contract (no duplication; helper delegates) is fixed at plan-time.
    - For `combineAs: 'numberPair'` → returns `{kind: 'numberPair', a: parsed[0], b: parsed[1]}` (re-uses M1.3d-Rem-5 H1's parser path).
    - For `combineAs: 'point'` → polar conversion. **Angle field is interpreted in DEGREES; helper converts via `(angleDeg * Math.PI) / 180` before `cos`/`sin`.** Returns `{kind: 'point', point: {x: anchor.x + Math.cos(angleRad) * distance, y: anchor.y + Math.sin(angleRad) * distance}}`.
    - For `combineAs: 'number'` → returns `{kind: 'number', value: parsed[0]}`.
    - Returns `null` if any required buffer is empty / un-parseable (caller treats null as "ignore submit").
11. Implement `onSubmitDynamicInput` in `EditorRoot.tsx`: delegates to `combineDynamicInputBuffers(manifest, buffers, anchor)`; if helper returns non-null, feeds the Input to runner; clears DI buffers via `clearDynamicInput()`. **No conversion math in `EditorRoot.tsx`** — all combineAs / deg→rad logic lives in the helper (SSOT).
12. **Extend click-eat guard at the 3 sites in `EditorRoot.tsx`** (Rev-1 H1 fix; Codex Round-1 high-risk finding; Rev-6 corrected handler names per §3.10 deviation discovery). Current guards (M1.3d-Rem-4 G2 pattern):
    - [`handleCanvasClick` ~line 389](packages/editor-2d/src/EditorRoot.tsx:389): `if (...inputBuffer.length > 0) return;`
    - [`handleGripDown` ~line 533](packages/editor-2d/src/EditorRoot.tsx:533): same. (Was incorrectly named `handleCanvasMouseDown` in Rev-1 through Rev-5 — actual handler is `handleGripDown`, called by canvas-host on grip-hit-test mousedown.)
    - [`handleSelectRectStart` ~line 560](packages/editor-2d/src/EditorRoot.tsx:560): same. (Was incorrectly named `handleCanvasMouseUp` in Rev-1 through Rev-5 — actual handler is `handleSelectRectStart`, called by canvas-host on left-mousedown when no tool is active.)
    Each MUST be extended to OR-check `cb.dynamicInput !== null && cb.dynamicInput.buffers.some(b => b.length > 0)`. Rationale: with DI active, `inputBuffer` may stay empty while `dynamicInput.buffers` are populated; a stray click during DI typing would slip through the existing `inputBuffer.length > 0` guard and commit unintended geometry. Implementation MAY introduce a named helper (e.g., `hasNonEmptyDIBuffer(state)`) provided each guard site references DI state explicitly.
13. Tests for substrate: types, slice, runner publish + buffer-reset semantics + **synchronous-bootstrap-on-prompt-yield (Rev-3 H2)**, painter per-shape, multi-pill component, **combiner helper** (covering all `combineAs` arms + angle deg→rad edge cases per §11), router (Tab forward/backward + numeric routing + Backspace + Enter + Esc branches), **3 click-eat unit tests in `tests/click-eat-with-di.test.tsx` (Rev-3 Q)**, **click-eat-with-DI smoke parity scenario**, **`'first-frame DI coherence'` smoke scenario (Rev-3 H2)**.

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

Gate REM6-P1-ClickEat: each click-eat handler suppresses path when DI buffers are non-empty (Rev-3 Q — semantic unit tests; Rev-4 Q2 — locked deterministic primary assertion target)
  Architecture-significant gate (3 unit tests in NEW packages/editor-2d/tests/click-eat-with-di.test.tsx):
    Setup (shared across all 3 tests):
      - Mount EditorRoot via @testing-library/react render().
      - Set commandBar.inputBuffer = '' (legacy buffer empty — proves DI-only path catches the case).
      - Set commandBar.dynamicInput = { manifest: <line tool's 2-field manifest>, buffers: ['5', ''], activeFieldIdx: 0 } (DI buffer non-empty).
      - Snapshot baseline:
        * `entityCountBefore = projectStore.getState().entities.size` (or equivalent selector — abstracts over storage internals).
        * `temporalStackLengthBefore = projectStore.temporal.getState().pastStates.length` (zundo).
        * `previewBefore = editorUiStore.getState().overlay.preview`.
    Test 1: handleCanvasClick — fireEvent.click(canvas).
    Test 2: handleGripDown — set up a grip in `overlay.grips`, fire grip-down via canvas-host's grip-hit-test path (or invoke `handleGripDown` directly with a fixture grip).
    Test 3: handleSelectRectStart — fire select-rect start via canvas-host's left-mousedown-when-no-tool path (or invoke `handleSelectRectStart` directly with fixture metric/screen).
    **Locked assertion order (Rev-4 Q2 — deterministic primary signal; Rev-5 Q2 dropped fragile tertiary):**
      Primary (MUST pass — proves "no geometry committed"):
        a) `projectStore.getState().entities.size === entityCountBefore` — no new entity created.
        b) `projectStore.temporal.getState().pastStates.length === temporalStackLengthBefore` — no zundo undo-frame pushed.
      Secondary (MUST pass — proves "no preview state mutation"):
        c) `editorUiStore.getState().overlay.preview === previewBefore` (reference equality OR deep-equal — same shape).
      (Rev-5 Q2: tertiary "no console.error" assertion DROPPED — fragile to environment noise from jsdom/React dev-time warnings unrelated to click-eat. Two-tier deterministic gate is sufficient.)
    Each test exercises the specific handler's guard in isolation — does not depend on helper symbol names, regex patterns, or comment annotations. Refactor-resilient. Assertion targets abstract over project-store storage internals via exposed selectors; if selectors change in a future refactor, the tests change with them but the semantic outcome assertion ("no commit happened") stays stable.
  Command (architecture-significant): pnpm --filter @portplanner/editor-2d test -- tests/click-eat-with-di
    Expected: 3 tests pass.
  Command (regression-protection on annotations being preserved — pure comment grep, NOT guard-implementation gate):
    rg -c "M1\.3d-Rem(ediation)?-4 G2" packages/editor-2d/src/EditorRoot.tsx
    Expected: ≥3 matches (the M1.3d-Rem-4 G2 click-eat annotations at handleCanvasClick / Down / Up remain — protects against accidental annotation deletion during a refactor).
  Command (smoke — end-to-end wired behavior): rg -n "'click is eaten while DI buffer non-empty" packages/editor-2d/tests/smoke-e2e.test.tsx
    Expected: 2 matches (SCENARIOS const + matching it() title)
  Wired-behavior verification: pnpm --filter @portplanner/editor-2d test -- tests/smoke-e2e — 'click is eaten while DI buffer non-empty (multi-field DI parity)' passes.

Gate REM6-P1-SyncBootstrapNoReentry: builders invoked from sync bootstrap cannot re-enter feedInput (Rev-4 H fix; Rev-6 collapsed to single-method form per actual function-based runner architecture)
  Architecture-significant gate (1 unit test in packages/editor-2d/tests/tool-runner.test.ts):
    Test: 'sync-bootstrap builder cannot call feedInput' —
      (a) Build a fixture tool whose previewBuilder closes over a captured RunningTool reference (test-only contrivance — production builders are pure (cursor) => Shape and don't have access to RunningTool) and calls runningTool.feedInput({...}) when invoked;
      (b) Drive the tool to a yield point with a Prompt that triggers the synchronous builder seed (the existing block at runner.ts:116-130 extended for dimensionGuidesBuilder in this round);
      (c) Assert: the synchronous bootstrap call throws an error matching 'cursor-effect re-entered runner during sync bootstrap';
      (d) Assert: the closure's inSyncBootstrap flag is back to false after the throw (try/finally cleanup verified).
    Single test, not parameterized over an SSOT array — the runner is function-based with closure state and exposes a single external state-advance entrypoint (feedInput) on the RunningTool interface. There is no class with a STATE_MACHINE_ADVANCE_METHODS array of public methods to iterate. The Rev-5 H elaborate machinery was over-engineered for this architecture (see Rev-6 D1 in revision history).
    Existing per-cursor-tick previewBuilder invocation (lines runner.ts:54-66 ensurePreviewSubscription) implicitly verifies the flag is false during normal cursor-ticks — production behavior unaffected.
  Command (architecture-significant): pnpm --filter @portplanner/editor-2d test -- tests/tool-runner
    Expected: existing tests + sync-bootstrap-coherence + 1 re-entrancy test pass.
  Command (defense-in-depth — flag lifecycle in the closure): rg -n "inSyncBootstrap" packages/editor-2d/src/tools/runner.ts
    Expected: ≥4 matches (flag declaration in startTool closure + set-true around builder seed + set-false in finally + check at feedInput entry).
  Command (feedInput guard exists): rg -B 1 -A 5 "feedInput" packages/editor-2d/src/tools/runner.ts | rg "inSyncBootstrap"
    Expected: ≥1 match (the feedInput method body references the flag — primary runtime guard).

Gate REM6-P1-FirstFrameCoherence: manifest+overlay.dimensionGuides coherent on first paint after prompt-yield (Rev-3 H2 fix)
  Architecture-significant gate (unit test in packages/editor-2d/tests/tool-runner.test.ts):
    Test: synchronous-bootstrap-on-prompt-yield —
      (a) Mount the runner with a fixture tool that yields a prompt with a 2-field manifest;
      (b) Set overlay.cursor to a known metric point (e.g., (5, 2));
      (c) Drive the tool to the yield point;
      (d) Assert IMMEDIATELY after yield (before any setTimeout / requestAnimationFrame): commandBar.dynamicInput.manifest !== null AND overlay.dimensionGuides !== null AND overlay.dimensionGuides.length === manifest.fields.length;
      (e) Assert overlay.dimensionGuides[0] is the expected DimensionGuide shape for the fixture tool given cursor (5,2).
    This proves the synchronous-bootstrap step (3a.ii) runs and populates the guides BEFORE the paint loop sees the new manifest.
  Command (architecture-significant): pnpm --filter @portplanner/editor-2d test -- tests/tool-runner
    Expected: existing tests + new 'synchronous-bootstrap-on-prompt-yield' test pass.
  Command (smoke — wired first-frame behavior): rg -n "'first-frame DI coherence" packages/editor-2d/tests/smoke-e2e.test.tsx
    Expected: 2 matches (SCENARIOS const + matching it() title)
  Smoke scenario: 'first-frame DI coherence: pill renders at expected metric anchor on prompt-yield (no flicker)' — invoke line tool, click first point, BEFORE moving cursor query the DI pills, assert pill[0] (Distance) and pill[1] (Angle) are positioned at the expected screen coords given p1 + current cursor (i.e., guides were populated synchronously, not on next cursor-tick).

Gate REM6-P1-DimensionGuideTypes: DimensionGuide carries flat metric coords ONLY (Rev-2 H1 lock-in)
  Command (positive — three discriminated-union variants exist): rg -n "kind: 'linear-dim'|kind: 'angle-arc'|kind: 'radius-line'" packages/editor-2d/src/tools/types.ts
  Expected: ≥3 matches (one per variant kind in the discriminated union)
  Command (negative — NO reference-string fields): rg -n "anchorRef|guideRef|'cursor'|'midpoint:|'last-vertex'|'p1,cursor'" packages/editor-2d/src/tools/types.ts
  Expected: 0 matches (Option-A flat-coord lock; Option-B reference-descriptor variant is forbidden by ADR-024)
  Command (DynamicInputField shape — sparse, no anchor info): rg -n "metricAnchor|dimensionGuide:" packages/editor-2d/src/tools/types.ts
  Expected: 0 matches (manifest fields carry { kind, label } only; anchor data lives on overlay.dimensionGuides, not on the manifest)
  Cross-check (overlay slice has the dynamic guides): rg -n "dimensionGuides" packages/editor-2d/src/ui-state/store.ts
  Expected: ≥3 matches (interface field + default null + setter setDimensionGuides)
```

### Phase 2 — Per-tool migration (rectangle, line, polyline, circle)

#### Phase 2 Goal
Migrate the four primary draw tools to declare DI manifests on their relevant prompts. After this phase, the user sees AC-style multi-field DI when drawing these primitives.

#### Phase 2 Steps
12. Migrate `draw-rectangle.ts` (Rev-2 lock-in: manifest sparse, guides on overlay):
    - **Yield-side:** second-corner prompt grows sparse manifest `{ fields: [{kind: 'number', label: 'W'}, {kind: 'number', label: 'H'}], combineAs: 'numberPair' }`. NO anchor info on the manifest.
    - **Cursor-effect side:** extend the existing cursor-effect block (the one that already updates `overlay.preview` for the rubber-band rectangle) to ALSO write `overlay.dimensionGuides` per tick: guide[0] (W) = `{ kind: 'linear-dim', anchorA: firstCorner, anchorB: {x: cursor.x, y: firstCorner.y}, offsetCssPx: 10 }`; guide[1] (H) = `{ kind: 'linear-dim', anchorA: {x: cursor.x, y: firstCorner.y}, anchorB: cursor, offsetCssPx: 10 }`.
13. Migrate `draw-line.ts` (Rev-2 lock-in):
    - **Yield-side:** second-point prompt grows sparse manifest `{ fields: [{kind: 'distance', label: 'Distance'}, {kind: 'angle', label: 'Angle'}], combineAs: 'point' }`. Existing `directDistanceFrom: p1` field on the prompt stays unchanged.
    - **Cursor-effect side:** extend the cursor-effect block to write `overlay.dimensionGuides` per tick: guide[0] (Distance) = `{ kind: 'linear-dim', anchorA: p1, anchorB: cursor, offsetCssPx: 10 }`; guide[1] (Angle) = `{ kind: 'angle-arc', pivot: p1, baseAngleRad: 0, sweepAngleRad: Math.atan2(cursor.y - p1.y, cursor.x - p1.x), radiusCssPx: 40 }`.
    - **Submit-side:** `combineAs: 'point'` (polar: helper `combineDynamicInputBuffers` converts the typed angle from degrees to radians via `(angleDeg * Math.PI) / 180`, then computes `point = anchor + (cos(angleRad) × distance, sin(angleRad) × distance)` where `anchor = p1` — see Phase 1 step 10 for SSOT helper details). EditorRoot's `onSubmitDynamicInput` reads anchor from `overlay.dimensionGuides[0].anchorA` (or equivalent) and passes to the helper.
14. Migrate `draw-polyline.ts` (Rev-2 lock-in): same yield-side + cursor-effect-side + submit-side as draw-line on each loop iteration; pivot/anchorA = `verticesSnapshot[verticesSnapshot.length - 1]` (the last committed vertex). Per-loop manifest yield resets buffers (Rev-1 R2-A5).
15. Migrate `draw-circle.ts` (Rev-2 lock-in):
    - **Yield-side:** radius prompt grows sparse manifest `{ fields: [{kind: 'distance', label: 'Radius'}], combineAs: 'number' }`. Existing `directDistanceFrom: ctr` field stays.
    - **Cursor-effect side:** extend the cursor-effect block to write `overlay.dimensionGuides` per tick: guide[0] (Radius) = `{ kind: 'radius-line', pivot: ctr, endpoint: cursor }`. (May be a no-op visual marker if `paintPreview`'s circle arm already draws the radius line — implementation tactic, not contract.)
16. Update tool tests to assert each tool yields the expected manifest shape on the relevant prompt.
17. Add **5 new smoke-e2e scenarios (Rev-5 Q1 corrected — was "4" prior to Rev-5; first-frame coherence was added in Rev-3 H2 but Phase-2 step 17 wasn't updated to match)**. Each scenario depends on at least one tool migration to activate DI; click-eat / first-frame fixes are wired in Phase 1 substrate but exercised end-to-end here:
    - `'rectangle DI: type 6 Tab 4 Enter commits 6×4'` (focuses W, types 6, Tab, types 4, Enter, asserts rectangle of 6×4)
    - `'line DI: type 5 Tab 30 Enter commits a 5m line at 30°'` (polar; deg→rad correctness verified end-to-end)
    - `'circle DI: type 7 Enter commits a radius-7 circle'` (single-field, no Tab)
    - **`'click is eaten while DI buffer non-empty (multi-field DI parity)'`** (Rev-1 H1): in line tool with DI active, after typing into the distance buffer, a canvas click does NOT commit a line at the click position; only Enter (via the helper-driven `combineAs`) commits geometry.
    - **`'first-frame DI coherence: pill renders at expected metric anchor on prompt-yield (no flicker)'`** (Rev-3 H2): invoke line tool, click first point, BEFORE moving cursor query the DI pills, assert pill[0] (Distance) and pill[1] (Angle) are positioned at the expected screen coords given p1 + current cursor. Verifies the synchronous-bootstrap on yield (step 3a.ii) populated guides BEFORE first paint.

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

Gate REM6-P2-Smoke: 5 new smoke scenarios in SCENARIOS const + matching it() blocks (Rev-5 Q1 — count harmonized with cross-phase / Done Criteria / §11; first-frame coherence added in Rev-3 H2 now reflected in Phase-2 gate)
  Command: rg -n "'rectangle DI:|'line DI:|'circle DI:|'click is eaten while DI buffer non-empty|'first-frame DI coherence" packages/editor-2d/tests/smoke-e2e.test.tsx
  Expected: ≥10 matches (each of the 5 scenario names appears twice: SCENARIOS const + it() title)
```

### Cross-phase gates

```
Gate REM6-9 (architecture-significant): Targeted test files pass
  Command: pnpm --filter @portplanner/editor-2d test -- tests/types tests/ui-state tests/tool-runner tests/keyboard-router tests/DynamicInputPills tests/paintDimensionGuides tests/dynamic-input-combine tests/click-eat-with-di tests/draw-tools tests/smoke-e2e
  Expected: passes; new substrate (incl. dynamic-input-combine helper unit tests + **click-eat handler unit tests ×3 — Rev-3 Q** + **synchronous-bootstrap unit test — Rev-3 H2**) + per-tool tests + 5 new smoke scenarios (rectangle DI / line DI / circle DI / click-eat-with-DI / **first-frame DI coherence — Rev-3 H2**) all green

Gate REM6-10 (informational tripwire — NOT architecture-significant by itself, per Codex Round-1 Q2): Workspace test count
  Command: pnpm test
  Expected: all 6 packages pass; total ≥ 480 (post-Round-5 baseline 470 + ≥10 net-new minimum — actual ~33-40 across substrate + per-tool + per-tool-cursor-effect + click-eat handler tests + 1 sync-bootstrap re-entrancy test on feedInput + smoke per the §11 breakdown).
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
- [ ] **Click-eat guard extended for DI buffers (Rev-1 H1; gate evolved through Rev-2 → Rev-3 → Rev-4)** — 3 sites in `EditorRoot.tsx` (handleCanvasClick / Down / Up) suppress geometry commit when `dynamicInput.buffers` are non-empty. Verified by Gate REM6-P1-ClickEat: 3 unit tests in `tests/click-eat-with-di.test.tsx` (Rev-3 Q — semantic outcome, refactor-resilient; one test per handler) with locked deterministic primary assertion target (Rev-4 Q2 — project-store entity count + zundo temporal-stack length unchanged) + smoke scenario `'click is eaten while DI buffer non-empty (multi-field DI parity)'` (end-to-end wiring) + annotation-count grep ≥3 (regression-protection on the M1.3d-Rem-4 G2 comments being preserved).
- [ ] **DimensionGuide schema locked to flat coords (Rev-2 H1)** — `DimensionGuide` discriminated union in `tools/types.ts` carries 3 variants (`linear-dim` / `angle-arc` / `radius-line`), each with flat `{x, y}` metric coords; NO reference strings, NO callbacks, NO anchor IDs; manifest fields are sparse `{kind, label}` only. Verified by REM6-P1-DimensionGuideTypes (positive grep ≥3 + negative grep 0 + cross-check on overlay slice).
- [ ] **Per-tool cursor-effect writes overlay.dimensionGuides (Rev-2 H1)** — each migrated tool (rectangle / line / polyline / circle) extends its existing cursor-effect handler to compute its `DimensionGuide[]` from current cursor + tool state per tick. Verified by 4 cursor-effect tests in `tests/draw-tools.test.ts`.
- [ ] **EditorRoot delegates to helper, no parsing/conversion math (Rev-2 Q1)** — §4.1 EditorRoot scope-table row matches Phase-1 step 11 wording; `EditorRoot.tsx` calls `combineDynamicInputBuffers` only; `rg "Math\.PI / 180" EditorRoot.tsx` returns 0 matches. Verified by Gate REM6-P1-AngleUnit cross-check + REM6-P1-Combiner.
- [ ] **First-frame coherence invariant holds (Rev-3 H2)** — `commandBar.dynamicInput.manifest !== null ⟹ overlay.dimensionGuides !== null && overlay.dimensionGuides.length === manifest.fields.length` after prompt-yield, before next paint. Verified by Gate REM6-P1-FirstFrameCoherence (`'synchronous-bootstrap-on-prompt-yield'` unit test + `'first-frame DI coherence'` smoke scenario). Pill component coded defensively for graceful degradation if invariant violated by a future bug.
- [ ] **Sync-bootstrap re-entrancy contract enforced (Rev-4 H + Rev-6 single-method form per actual function-based runner)** — `previewBuilder` / `dimensionGuidesBuilder` invoked synchronously from step 3a.ii are pure functions `(cursor) => Shape` and don't receive a `RunningTool` reference (architectural primary defense). Runtime guard via closure-local `inSyncBootstrap` flag in `startTool` set/cleared with try/finally; `RunningTool.feedInput(input)` checks the flag at entry and throws `'cursor-effect re-entered runner during sync bootstrap'` if set. Verified by Gate REM6-P1-SyncBootstrapNoReentry: 1 unit test in `tests/tool-runner.test.ts` (`'sync-bootstrap builder cannot call feedInput'`) using a fixture builder that closes over a captured `RunningTool` (test-only contrivance). Existing per-cursor-tick `previewBuilder` invocation path leaves the flag at `false` — production tools unaffected.
- [ ] **Click-eat handler unit tests pass (Rev-3 Q + Rev-6 D5 handler-name correction)** — 3 tests in `tests/click-eat-with-di.test.tsx`, one per actual handler (`handleCanvasClick` / `handleGripDown` / `handleSelectRectStart`); each exercises the handler's guard in isolation without coupling to helper symbol names or comment annotations. Verified by Gate REM6-P1-ClickEat (architecture-significant gate unit-test-driven, not grep-driven).
- [ ] **Angle-unit invariant enforced** — `combineDynamicInputBuffers` is the SSOT helper performing deg→rad conversion via `(angleDeg * Math.PI) / 180` before `cos`/`sin`; helper unit tests at `[5, 30]`, `[5, 90]`, `[5, 0]`, `[5, -45]` from anchors (0,0) and (10,20) all pass; `EditorRoot.tsx` contains zero conversion-symbol matches (delegation only). Verified by REM6-P1-AngleUnit + REM6-P1-Combiner + the unit test in `dynamic-input-combine.test.ts`. (Rev-1 H2 fix.)
- [ ] **Rectangle migration** — second-corner prompt yields W,H linear-dim manifest; user sees both pills + dim lines; Tab cycles. Verified by REM6-P2-Rectangle + REM6-P2-Smoke (`'rectangle DI: type 6 Tab 4 Enter'`).
- [ ] **Line migration** — second-point prompt yields distance + angle-arc manifest; polar conversion on submit. Verified by REM6-P2-Line + smoke (`'line DI: type 5 Tab 30 Enter commits a 5m line at 30°'`).
- [ ] **Polyline migration** — same manifest shape on each loop iteration; per-yield buffer reset (Rev-1 R2-A5). Verified by REM6-P2-Polyline.
- [ ] **Circle migration** — radius single-field. Verified by REM6-P2-Circle + smoke.
- [ ] **Binding spec docs updated** — operator-shortcuts.md 2.0.0 → 2.1.0; ADR-024 created (NEW). **ADR-023 NOT modified** per §0.6 (Rev-1 B1 fix). Verified by REM6-SPEC (a + b + c + d).
- [ ] All Phase REM6-P1 + REM6-P2 + REM6-9 + REM6-11 + REM6-12 + REM6-SPEC gates pass.
- [ ] Cross-cutting hard gates DTP-T1 / T2 / T6 / T7 pass with the extended painter list. Verified by REM6-11.
- [ ] **Workspace test count tripwire** ≥ 480 (post-Round-5 baseline 470 + ≥10 net-new minimum; actual ~33-40 per §11 breakdown — Rev-6 collapsed Rev-5's 3 parameterized re-entrancy tests to 1 single-method test on `feedInput`). Informational only; the architecture-significant gates are REM6-9 (named test files) + REM6-11 (cross-cutting structural) + REM6-12 (typecheck/check/build). REM6-10 demoted in Rev-1 per Codex Round-1 Q2.
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
| Click-eat guard omitted DI buffers (M1.3d-Rem-4 G2 parity gap; Rev-1 H1 fix; gate evolved through Rev-2 → Rev-3 → Rev-4 → Rev-6 D5 handler-name correction) | Phase 1 step 12 extends the 3 actual guard sites in `EditorRoot.tsx` ([handleCanvasClick ~line 389](packages/editor-2d/src/EditorRoot.tsx:389), [handleGripDown ~line 533](packages/editor-2d/src/EditorRoot.tsx:533), [handleSelectRectStart ~line 560](packages/editor-2d/src/EditorRoot.tsx:560)) with an OR-check on `cb.dynamicInput?.buffers.some(b => b.length > 0)`. **Current gate (Rev-3 + Rev-4 Q2):** Gate REM6-P1-ClickEat is **3 unit tests** in `tests/click-eat-with-di.test.tsx` — one per handler, semantic-outcome assertion via locked deterministic primary target (project-store entity count + zundo temporal-stack length unchanged). Refactor-resilient. Plus end-to-end smoke scenario + annotation-count grep ≥3 (regression-protection on the comments). |
| Angle-unit silent mismatch (typed 30 interpreted as radians → line lands at ~1719° wrapped, geometrically wrong but not crashy; Rev-1 H2 fix) | Pure helper `combineDynamicInputBuffers` in `tools/dynamic-input-combine.ts` is the SSOT for deg→rad conversion via `(angleDeg * Math.PI) / 180`. Unit tests in `dynamic-input-combine.test.ts` cover `[5, 30]`, `[5, 90]`, `[5, 0]`, `[5, -45]` from anchors (0,0) and (10,20) — all assert the polar conversion math. Gate REM6-P1-AngleUnit greps for the conversion symbol IN the helper AND verifies `EditorRoot.tsx` has ZERO conversion-symbol matches (delegation only). Field kind 'angle' is locked to degrees; future trig users (M1.3b Rotate) MUST route through the same helper. |
| Helper duplicates existing parser logic (SSOT regression; Rev-1 R1-A2) | Phase 1 step 10 mandates: helper does the COMBINATION; per-field PARSING delegates to the existing parser path in `tools/runner.ts` (re-use, do NOT duplicate). If the existing parser is inline in runner.ts, extract to a shared module that both runner and helper import. Verified during execution at the import site review. |
| Per-prompt-yield buffer reset semantics ambiguous (Rev-1 R2-A5) | Phase 1 step 3 specifies: each prompt yield with a manifest resets `dynamicInput.buffers` to `Array(N).fill('')` and `activeFieldIdx` to 0; tool teardown calls `clearDynamicInput()`. Polyline-loop iterations therefore start with empty buffers (one prompt = one input session). Verified by `tests/ui-state.test.ts` and `tests/tool-runner.test.ts`. |
| Dynamic-anchor architectural lock-in (Rev-2 H1 fix; supersedes Rev-1's deferral that Codex Round-2 correctly flagged as a Review Miss) | **Locked at plan-time per Procedure 01 §1.4:** `DimensionGuide` carries flat `{x, y}` metric coords ONLY (no reference strings, no callbacks, no IDs); `commandBar.dynamicInput.manifest` is sparse (no anchor info); `overlay.dimensionGuides` is dynamic — written by per-tool cursor-effect every tick (existing pattern; same as `overlay.cursor` and `overlay.preview`). Painter reads flat coords (DTP-T1/T2/T6/T7 contract preserved). Documented in §3 A2 + A2.1, §4.1 types/Pills/4-tool rows, §5 ADR-024 row, §7 Phase-1 step 3 (3a/3b/3c) + Phase-2 steps 12-15, §10 audit C3.9, §11 4 new cursor-effect tests. Enforced by Gate REM6-P1-DimensionGuideTypes (positive grep for variant kinds + negative grep proving zero reference-string fields). User-visible UX is identical to either option; the choice is internal architecture only. |
| Future regression — someone re-introduces reference-style anchor descriptors (e.g., a future M1.3b operator author tries to add `'pivot-of-rotation'` reference) | ADR-024 documents the locked schema; deviation requires §0.7 protocol. Gate REM6-P1-DimensionGuideTypes' negative grep (`rg "anchorRef\|guideRef\|'cursor'\|'midpoint:" tools/types.ts` Expected: 0 matches) catches schema drift in CI/PR review. |
| First-frame coherence between sparse manifest and dynamic overlay (Rev-3 H2 fix; Codex Round-3 Review Miss) | Synchronous bootstrap on prompt-yield (Phase-1 step 3a.ii) — runner triggers per-tool cursor-effect handler immediately after publishing the manifest, populating `overlay.dimensionGuides` BEFORE first paint. Invariant: `manifest !== null ⟹ guides !== null && guides.length === manifest.fields.length`. Enforced by Gate REM6-P1-FirstFrameCoherence (unit test in `tests/tool-runner.test.ts` + smoke scenario in `tests/smoke-e2e.test.tsx`). Pill component coded defensively (multi-pill arm renders only when both slices populated). Optional runtime assertion in runner ("MAY add" — defense-in-depth). Locked assumption: `overlay.cursor` is always valid at yield sites because tools yield manifests only AFTER a click that establishes cursor. |
| Click-eat gate refactor-resilience (Rev-3 Q fix; Rev-4 Q2 added deterministic primary assertion target; Rev-5 Q2 dropped fragile tertiary; Rev-6 D5 corrected handler names) | Gate REM6-P1-ClickEat is **3 unit tests** in `tests/click-eat-with-di.test.tsx` — one per actual handler (`handleCanvasClick` / `handleGripDown` / `handleSelectRectStart`), each asserts the SEMANTIC outcome (handler suppresses path when DI buffers non-empty) without coupling to implementation details (helper name, regex pattern, comment annotation). **Locked deterministic two-tier gate:** Primary (MUST pass) — project-store entity count unchanged AND zundo temporal-stack length unchanged. Secondary (MUST pass) — overlay.preview unchanged. (Rev-5 Q2: tertiary "no console.error" assertion DROPPED — fragile to environment noise.) Existing smoke scenario stays for end-to-end wiring. Annotation grep simplified to count-only — pure regression-protection. |
| Sync-bootstrap re-entrancy regression — a future builder refactor could attempt to call `feedInput` from inside the synchronous bootstrap path, causing recursion (Rev-4 H fix; Rev-6 single-method form per actual function-based runner architecture; Codex Round-4 Review Miss + §3.10 deviation discovery) | §3 A2.1 locks the contract: builder callbacks (`previewBuilder` / `dimensionGuidesBuilder`) invoked synchronously from step 3a.ii are **pure functions** `(cursor) => Shape` and don't receive a `RunningTool` reference — the architectural primary defense. **Runtime enforcement (defense-in-depth):** closure-local `inSyncBootstrap` boolean in `startTool`, set/cleared with try/finally around synchronous builder seed calls (extending the existing block at [runner.ts:120-124](packages/editor-2d/src/tools/runner.ts:120) for `previewBuilder` to also cover `dimensionGuidesBuilder`). `RunningTool.feedInput` checks the flag and throws `'cursor-effect re-entered runner during sync bootstrap'` if set. **Test enforcement (single-method form):** Gate REM6-P1-SyncBootstrapNoReentry — 1 unit test (`'sync-bootstrap builder cannot call feedInput'`) using a fixture builder that closes over a captured `RunningTool` (test-only contrivance — production builders cannot reach `RunningTool`); assert throw + flag cleanup. Existing per-cursor-tick `previewBuilder` invocation path leaves the flag at `false` — production tools unaffected. Future deviation requires §0.7 protocol (new ADR or extend ADR-024). |
| Future state-machine-advance entrypoint added to `RunningTool` interface without extending the `inSyncBootstrap` check | Code-review responsibility — the `RunningTool` interface declaration at `tools/runner.ts` (currently exposing `feedInput` / `abort` / `done`) is small and well-known; any new entrypoint added MUST follow §1.4.1 plan-vs-code grounding which requires confirming the new method's interaction with `inSyncBootstrap`. The flag is closure-local so any new method's implementation lives in the same `startTool` closure where the flag is declared — drift would be immediately visible to a reviewer. Not a current risk; preserved as a future contributor caution. |
| **Procedural lesson (Rev-3) — §1.16 step 12 section-consistency pass needs broader regex coverage AND tactical-vs-contract triage** | Rev-2's section-consistency pass missed the stale "implementation chooses re-publish-per-cursor-tick OR reference-resolve-at-render-time at execution time" wording in Phase-1 step 4 (caught by Codex Round-3 H1). Pass focused on `metricAnchor` / `~25-32` / version-number patterns and didn't grep for execution-time-deferral phrasing. **Lesson: when a revision LOCKS a previously-deferred decision, the consistency pass MUST grep for the deferral phrasing patterns (`execution.time`, `implementation chooses`, `decide.*at.*execution`, `MAY either.*OR`) and triage each match into one of three buckets:** (a) **Stale contract decision** (the locked decision is now contradicted by leftover deferral text) → DELETE / rewrite. (b) **Contract-adjacent decision still open** (e.g., "which prompts opt into the contract" — the contract itself is locked, but the scope of application isn't) → LOCK NOW or explicitly annotate as "scope decision, not contract". (c) **Pure implementation tactic** (e.g., "where does the existing parser live in code") → KEEP, but annotate explicitly as "tactical, NOT contract" so future review readers don't mistake it for a re-opened contract decision. Rev-3 §1.16 pass applied this triage: line 72 (F3 sub-flow opt-in) was bucket (b) → locked now to "primary prompt only"; line 191 (parser-location lookup) was bucket (c) → annotated as tactical. **Rev-4 extension (Codex Round-4 Q1):** the §1.16 pass MUST sweep ALL sections — not just core flow steps but also Done Criteria, risk table, and §10 audit C-points — for stale wording from prior revisions (Rev-2 click-eat grep framing remnants survived in Done Criteria + risks until Rev-4 §1.16 caught them). Added to Rev-4 audit checklist for future revisions. |
| **Meta-lesson — architectural-contract decisions deferred to execution-time create review-miss risk (Rev-2 lesson from Rev-1's R2-A6)** | "Decide at execution-time" is legitimate ONLY for implementation tactics (specific algorithms, code organization, helper extraction). Architectural CONTRACT decisions (type shapes, ownership boundaries, publication/subscription patterns) MUST be locked at plan-time. Future plan-authoring sessions should preflight any "decide at execution-time" sentence: if it affects type definitions / gate signatures / test assertions, it's a contract decision and MUST be locked. |
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
- **C2.5 — Per-tool migration overlap with existing F1 directDistanceFrom (Rev-2 schema-aware update).** F1's `Prompt.directDistanceFrom` field stays for the bar-form path. The DI manifest's distance field carries NO anchor info (Rev-2 H1 lock — fields are sparse `{kind, label}` only); instead, the tool's cursor-effect handler writes `overlay.dimensionGuides[0].anchorA` per cursor-tick, and `EditorRoot.onSubmitDynamicInput` reads that anchor at submit time. So the same physical anchor (e.g., `p1` for line, `lastVertex` for polyline, `ctr` for circle) appears in TWO places: `Prompt.directDistanceFrom` (sparse, set on prompt-yield, used by bar-form F1) AND `overlay.dimensionGuides[N].anchorA` (dynamic, written per cursor-tick, used by canvas-focus DI submit). Both surfaces resolve to the same metric point at submit time.
- **C2.6 — Test count math.** Net-new ≈ 33-40 (Rev-6 collapsed Rev-5's 3 parameterized re-entrancy tests to 1 — actual function-based runner has only one external state-advance entrypoint). Substrate breakdown: types ×1 + slice ×3 + runner ×3 (buffer-reset + synchronous-bootstrap (Rev-3 H2) + **1 re-entrancy test on `feedInput` (Rev-4 H + Rev-6 single-method form)**) + painter ×3 + multi-pill ×4 + router ×5 + combiner helper ×7 (numberPair / point at `[5,30]` / point at `[5,90]` / point at `[5,0]` / point at `[5,-45]` / number / invalid → null) + click-eat handler unit tests ×3 (Rev-3 Q) ≈ 29. Per-tool generators: ×4. Per-tool cursor-effect (Rev-2 H1): ×4. Smoke: ×5 (rectangle DI / line DI / circle DI / click-eat-with-DI / first-frame coherence — Rev-3 H2). Theoretical sum ≈ 42; Vitest test-count grouping yields a practical range of ~33-40. Threshold ≥480 (470 + ≥10 minimum) passes with substantial slack regardless — and per Rev-1 Q2, REM6-10 is now an informational tripwire only.
- **C2.7 — `commandBar.activePrompt` already exists; is the new `commandBar.dynamicInput` redundant?** No. activePrompt is the prompt's TEXT (string). dynamicInput is the structured per-field state (active idx + N buffers). They're orthogonal.
- **C2.10 — Sync-bootstrap re-entrancy contract (Rev-4 H fix; Rev-6 collapsed Rev-5's parameterized array per actual function-based runner architecture; Codex Round-4 + Round-5 Review Misses + Rev-6 §3.10 deviation discovery).** Rev-3's synchronous-bootstrap call (step 3a.ii) introduced a callback-from-runner path. Rev-4 bounded it with an `inSyncBootstrap` flag. Rev-5 elaborated to a parameterized SSOT array `['publishPrompt', 'advanceGenerator', 'dispatchInput']` after Codex Round-5 correctly flagged exhaustiveness — but the entire array was based on a misread of the runner architecture (those methods don't exist; see Rev-6 D1). **Rev-6 simplification per actual runner:** the function-based `startTool(toolId, factory): RunningTool` runner has a single external state-advance entrypoint on the returned `RunningTool` interface: `feedInput(input: Input): void`. The internal generator iteration loop is closure-private and not exposed. The architectural primary defense for re-entrancy is the pure-function signature of `previewBuilder` / `dimensionGuidesBuilder` — `(cursor: Point2D) => Shape` builders don't receive a `RunningTool` reference and so cannot reach `feedInput` in production code. **Runtime guard (defense-in-depth):** closure-local `inSyncBootstrap` boolean in `startTool`, set true around synchronous builder seed calls (extending the existing block at [runner.ts:120-124](packages/editor-2d/src/tools/runner.ts:120) for `previewBuilder` to also cover `dimensionGuidesBuilder`), cleared in `finally`. `feedInput` checks the flag at entry and throws `'cursor-effect re-entered runner during sync bootstrap'` if set. **Test (single-method form):** 1 unit test in `tests/tool-runner.test.ts` (`'sync-bootstrap builder cannot call feedInput'`) uses a fixture builder closing over a captured `RunningTool` (test-only contrivance) and calls `feedInput()` from inside the builder; assert throw + flag cleanup. **Future deviation path (§0.7):** if a future state-advance entrypoint is added to `RunningTool`, the §1.4.1 plan-vs-code grounding for that change MUST extend the flag-check to the new method.
- **C2.9 — First-frame coherence between sparse manifest and dynamic overlay (Rev-3 H2 fix; Codex Round-3 Review Miss).** Rev-2's step 3a/3b split published the manifest on prompt-yield but deferred guide computation to the next cursor-tick. Pills read both slices, so the gap between yield and first cursor-tick = mismatched state — pills would either render at stale/null anchors or flicker into place once the first tick fires. **Fix:** runner triggers the per-tool cursor-effect handler **synchronously on prompt-yield** (step 3a.ii), populating `overlay.dimensionGuides` BEFORE returning from the yield path. **Invariant:** `commandBar.dynamicInput.manifest !== null ⟹ overlay.dimensionGuides !== null && overlay.dimensionGuides.length === manifest.fields.length` (after prompt-yield, before next paint). Enforced by Gate REM6-P1-FirstFrameCoherence (unit test `'synchronous-bootstrap-on-prompt-yield'` in `tests/tool-runner.test.ts` + smoke scenario `'first-frame DI coherence: pill renders at expected metric anchor on prompt-yield (no flicker)'`). Pill component coded defensively: renders multi-pill arm only when BOTH manifest AND guides are present (degrades gracefully if invariant violated by a future bug). Locked assumption: `overlay.cursor` is always valid at yield sites because tools yield manifests only AFTER a click that establishes cursor state (line/polyline first click; rectangle first-corner click; circle center click). Optional runtime assertion in runner ("MAY add" per step 3a.iv) for defense-in-depth.
- **C2.8 — Angle unit invariant (Rev-1 H2 / R2-A8 / Codex Round-1 high-risk).** Typed angle values arrive as DEGREES (AC convention; user types "30" expecting 30°). `combineAs: 'point'` performs polar trig that requires RADIANS. Risk: silent unit mismatch yields a line at 30 radians (≈ 1719° wrapped) instead of 30° — geometrically wrong but not crashy, hard to catch in casual testing. **Fix: extracted pure helper `combineDynamicInputBuffers` in `tools/dynamic-input-combine.ts` as SSOT for the deg→rad conversion (`(angleDeg * Math.PI) / 180`); helper unit-tested against `[5, 30] → (5*cos(π/6), 5*sin(π/6))` plus 0°/90°/-45° edge cases and non-zero anchors; Gate REM6-P1-AngleUnit greps for the conversion symbol IN the helper file AND verifies zero matches in `EditorRoot.tsx` (delegation only — no duplication).** Field kind 'angle' is locked to degrees as a contract invariant; future trig users (e.g., M1.3b Rotate sweep) MUST route through the same helper or reuse the same constant — no mixed conventions allowed in the codebase.

### Round 3 — Blast Radius (what could break elsewhere?)

- **C3.1 — DynamicInputPill (singular) deletion: any external consumer?** Search: only EditorRoot.tsx imports it. After replacement, no orphans. Tests directly named DynamicInputPill.test.tsx → renamed to DynamicInputPills.test.tsx.
- **C3.2 — Existing M1.3d-Rem-4 G2 click-eat behavior on `commandBar.inputBuffer.length > 0` (Rev-1 H1 / Codex Round-1 high-risk; gate evolved through Rev-2 → Rev-3 → Rev-4 → Rev-6 D5 handler-name correction).** Three actual guard sites in `EditorRoot.tsx` ([handleCanvasClick ~line 389](packages/editor-2d/src/EditorRoot.tsx:389), [handleGripDown ~line 533](packages/editor-2d/src/EditorRoot.tsx:533), [handleSelectRectStart ~line 560](packages/editor-2d/src/EditorRoot.tsx:560)) originally checked ONLY `inputBuffer.length > 0`. With DI active, `inputBuffer` may stay empty while `dynamicInput.buffers` are populated — clicks would slip through and commit unintended geometry. **Fix (Phase 1 step 12): extend each guard to also check `cb.dynamicInput !== null && cb.dynamicInput.buffers.some(b => b.length > 0)` (or call a named helper that does the same).** **Current gate (Rev-3 + Rev-4 + Rev-6):** Gate REM6-P1-ClickEat is **3 unit tests** in `tests/click-eat-with-di.test.tsx` — one per actual handler (`handleCanvasClick` / `handleGripDown` / `handleSelectRectStart`), each mounting EditorRoot and asserting the SEMANTIC outcome (handler suppresses path when DI buffers non-empty) via locked deterministic primary assertion target (Rev-4 Q2 — project-store entity count + zundo temporal-stack length unchanged). Refactor-resilient — does not couple to helper symbol names, regex patterns, or comment annotations. Plus end-to-end smoke scenario `'click is eaten while DI buffer non-empty (multi-field DI parity)'` + annotation-count grep ≥3 (regression-protection only).
- **C3.3 — Bundle size impact:** New painter ~120 LOC + new chrome ~150 LOC + new tests not bundled. Net change to apps/web bundle: ~+3 kB raw / ~+1 kB gz. Round-5 bundle was 446.85 kB raw / 128.97 kB gz; estimate ~450 kB raw post-Round-6. Well under budget.
- **C3.4 — Smoke E2E discipline meta-test:** existing meta-test reads SCENARIOS const + asserts each scenario block contains `<EditorRoot` AND `fireEvent.`. New scenarios follow that pattern.
- **C3.5 — F2 modifiers slice (Shift state) interplay with Tab + DI:** Shift+Tab cycles backward. Modifiers slice's `shift: boolean` flag is read by draw-rectangle for square constraint; the keyboard router's Tab handler reads `e.shiftKey` directly (not the slice — modifier slice is for in-flight mouse-clicked shift, not keyboard-event shift). Both work independently. ✓
- **C3.6 — Existing tests touching DynamicInputPill (now DynamicInputPills):**
  - `tests/DynamicInputPill.test.tsx` → renamed/replaced as `tests/DynamicInputPills.test.tsx` (component scope updated).
  - Smoke scenarios that interact with the pill (`'dynamic input pill: typing a number while in line tool shows pill + Enter submits'`, `'click is eaten while inputBuffer non-empty (AC parity)'`) — updated to query `[data-component="dynamic-input-pill"]` (the pill data-component name stays same; multi-pill component renders multiple instances of the same data-component selector). The smoke assertions about a single pill at cursor still pass for non-DI prompts (fallback path).
- **C3.7 — keyboard router test count growth:** existing tests stay; ~5 new tests (Tab cycles forward; Shift+Tab cycles backward; numeric routes to active field; Backspace pops from active field; Enter calls onSubmitDynamicInput). Test file grows ~80 LOC.
- **C3.8 — paintDimensionGuides downstream:** new painter dispatched in paint.ts overlay pass. Order matters — must paint AFTER paintPreview (so dim guides render on top of rubber-band geometry, not under). Documented in §7 step 5.
- **C3.10 — Click-eat gate refactor-resilience (Rev-3 Q fix).** Rev-2's per-site annotation-anchored grep (`rg -B 1 -A 5 "M1\.3d-Rem-4 G2" EditorRoot.tsx | rg -c "dynamicInput|hasNonEmptyDIBuffer"`) coupled the gate to a specific helper symbol name (`hasNonEmptyDIBuffer`). A legitimate refactor renaming the helper to e.g., `hasDIBufferContent` would false-fail the gate without changing behavior. **Fix (Rev-3):** convert the architecture-significant gate from grep to **3 unit tests** in NEW `tests/click-eat-with-di.test.tsx` — one test per handler, each mounting EditorRoot, setting state with `inputBuffer = ''` AND `dynamicInput.buffers = ['5', '']`, firing the specific event (`fireEvent.click` / `mouseDown` / `mouseUp`), asserting no geometry committed. The test verifies the SEMANTIC outcome (handler suppresses path when DI buffer non-empty) without coupling to any implementation detail (helper name, regex pattern, comment annotation). Existing smoke scenario (`'click is eaten while DI buffer non-empty'`) stays for end-to-end wiring. Grep simplified to annotation-count-only (`rg -c "M1\.3d-Rem(ediation)?-4 G2" EditorRoot.tsx ≥3`) — pure regression-protection on the comments being preserved.
- **C3.9 — Dynamic-anchor architectural lock-in (Rev-2 H1 fix; Codex Round-2 Review Miss).** Rev-1 R2-A6 deferred the dynamic-anchor strategy ("re-publish manifest with fixed coords per cursor-tick" vs "reference descriptors resolved at render time") to execution-time. Codex Round-2 correctly flagged this as implementation-guessing per §1.4 — the type definitions, painter contract, and grep gates can't be written without picking one. **Rev-2 locks Option A: flat metric coords ONLY + per-tool cursor-effect writes to `overlay.dimensionGuides` (Rev-2 §3 A2 + A2.1).** Rationale: (1) existing pattern — every tool already updates `overlay.preview` per cursor-tick from its cursor-effect block; adding `overlay.dimensionGuides` is symmetric, zero new infrastructure. (2) Painter contract — DTP-T1/T2/T6 forbid project-store imports and heavy state lookups in painters; Option B would push resolution logic into the painter (parse `'midpoint:p1,cursor'`, look up p1 + cursor from somewhere, compute), violating the contract. Option A keeps the painter dumb: input is flat coords, output is `ctx.lineTo` calls. (3) Type system — Option A gives a clean discriminated union of plain `{x, y}` records; Option B would need a parallel descriptor schema + parser/resolver + tests for both, more places drift can hide. **Locked across:** types (`tools/types.ts` — Gate REM6-P1-DimensionGuideTypes positive grep for variant kinds + negative grep proving zero reference-string fields); steps (Phase-1 step 3 split into 3a/3b/3c, Phase-2 steps 12-15 each extending cursor-effect); tests (4 new cursor-effect tests in `tests/draw-tools.test.ts` asserting per-tool guide computation); ADR-024 (§5 row enumerates the locked schema). **No user-visible UX difference vs Option B** — both produce the same pills at the same screen positions; the choice is purely about internal data flow + painter contract compliance + type-system simplicity. **Meta-lesson:** "decide at execution-time" is legitimate ONLY for implementation tactics (specific algorithms, code organization, helper extraction). Architectural CONTRACT decisions (type shapes, ownership boundaries, publication/subscription patterns) MUST be locked at plan-time; Codex correctly flags contract-level deferrals as no-guessing violations.

## 11. Test strategy

**Tests existing before:** baseline at commit `1aee6b6` (post-grip-stretch fix) is 470 / 470 across 6 packages.

**Tests added by this round (~33-40 net-new — Rev-6 collapsed Rev-5's parameterized 3 re-entrancy tests to 1 per actual function-based runner architecture; threshold gate REM6-10 still ≥480 with substantial slack):**

- **Substrate types (~1 test):** `tests/types.test.ts` (or extension to existing): manifest shape conformance.
- **Substrate slice (~3 tests):** `tests/ui-state.test.ts` — `commandBar.dynamicInput` default null; setDynamicInputManifest stores AND resets buffers to `Array(N).fill('')` (Rev-1 R2-A5); clearDynamicInput resets; setDynamicInputFieldBuffer per-index update; setDynamicInputActiveField cycles; `overlay.dimensionGuides` slice + setter.
- **Substrate runner (~3 tests; Rev-6 collapsed Rev-5's 5 to 3 per actual function-based runner architecture):** `tests/tool-runner.test.ts` — (1) prompt with manifest publishes to slice (with buffer-reset on each yield per Rev-1 R2-A5) + clears on teardown; (2) **`'synchronous-bootstrap-on-prompt-yield'` (Rev-3 H2)** — after a prompt-yield with a 2-field manifest and known `overlay.cursor`, assert IMMEDIATELY (before any timer/raf) that `overlay.dimensionGuides !== null` and `overlay.dimensionGuides.length === manifest.fields.length`, with the expected DimensionGuide shape; (3) **`'sync-bootstrap builder cannot call feedInput'` (Rev-4 H + Rev-6 single-method form)** — fixture `previewBuilder` closes over a captured `RunningTool` reference (test-only contrivance) and calls `runningTool.feedInput(...)` when invoked; assert the synchronous bootstrap throws `'cursor-effect re-entered runner during sync bootstrap'` and the closure-local `inSyncBootstrap` flag is back to `false` after the throw. Single test, not parameterized — the runner has only one external state-advance entrypoint on the `RunningTool` interface (`feedInput`); there are no `publishPrompt` / `advanceGenerator` / `dispatchInput` methods (Rev-5 specified them based on a misread of the runner architecture; see Rev-6 D1).
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
- **Per-tool generators (~4 tests):** `tests/draw-tools.test.ts` — rectangle yields sparse 2-field manifest (`combineAs: 'numberPair'`, no anchor info on fields); line yields sparse 2-field manifest (`combineAs: 'point'`); polyline yields manifest per loop iteration; circle yields sparse 1-field manifest (`combineAs: 'number'`).
- **Per-tool cursor-effect (~4 tests; NEW in Rev-2 — H1 lock-in):** `tests/draw-tools.test.ts` (or per-tool test files):
  1. **Rectangle cursor-effect:** with first-corner = (0,0) + cursor = (10, 5), tool's cursor-effect handler writes `overlay.dimensionGuides = [{kind: 'linear-dim', anchorA: (0,0), anchorB: (10,0), offsetCssPx: 10}, {kind: 'linear-dim', anchorA: (10,0), anchorB: (10,5), offsetCssPx: 10}]`.
  2. **Line cursor-effect:** with p1 = (0,0) + cursor = (5, 2), tool's cursor-effect handler writes `[{kind: 'linear-dim', anchorA: (0,0), anchorB: (5,2), offsetCssPx: 10}, {kind: 'angle-arc', pivot: (0,0), baseAngleRad: 0, sweepAngleRad: Math.atan2(2, 5), radiusCssPx: 40}]`. Asserts the angle is in RADIANS (atan2 output), preserving the deg→rad invariant from C2.8 — the GUIDE's angle is radians (for `ctx.arc`); the typed FIELD value is degrees (converted in the helper at submit).
  3. **Polyline cursor-effect:** with `verticesSnapshot = [(0,0), (3,4)]` + cursor = (8, 4), tool's cursor-effect handler writes guides with pivot/anchorA = (3,4) (last vertex), anchorB / sweep computed from cursor.
  4. **Circle cursor-effect:** with ctr = (5, 5) + cursor = (8, 9), tool's cursor-effect handler writes `[{kind: 'radius-line', pivot: (5,5), endpoint: (8,9)}]`.
- **Substrate click-eat unit tests (~3 tests; NEW in Rev-3, assertion target locked in Rev-4 Q2; tertiary dropped in Rev-5 Q2; handler names corrected in Rev-6 D5):** `tests/click-eat-with-di.test.tsx` — one test per actual click-eat handler (`handleCanvasClick` / `handleGripDown` / `handleSelectRectStart`). Each mounts EditorRoot, sets `commandBar.inputBuffer = ''` AND `commandBar.dynamicInput.buffers = ['5', '']`, snapshots `entityCountBefore` + `temporalStackLengthBefore` + `previewBefore`, then exercises the specific handler (Test 1: `fireEvent.click(canvas)`; Test 2: invoke handleGripDown via canvas-host's grip-hit-test path with a fixture grip; Test 3: invoke handleSelectRectStart via canvas-host's left-mousedown-when-no-tool path with fixture metric/screen). **Locked deterministic two-tier gate:** Primary (MUST pass) — `projectStore.entities.size` unchanged AND `projectStore.temporal.pastStates.length` unchanged. Secondary (MUST pass) — `overlay.preview` unchanged. (Rev-5 Q2: tertiary "no `console.error`" DROPPED — fragile to environment noise.) Assertion targets abstract over project-store storage internals via exposed selectors; refactor-resilient. Replaces the Rev-2 helper-name-coupled grep gate.
- **Smoke E2E (~5 scenarios; Rev-3 added first-frame coherence):**
  - `'rectangle DI: type 6 Tab 4 Enter commits 6×4'` (full pill flow + Tab cycle + numberPair combineAs).
  - `'line DI: type 5 Tab 30 Enter commits a 5m line at 30°'` (polar combineAs; deg→rad correctness verified end-to-end at the wired EditorRoot level).
  - `'circle DI: type 7 Enter commits a radius-7 circle'` (single-field, no Tab).
  - `'click is eaten while DI buffer non-empty (multi-field DI parity)'` (Rev-1 H1).
  - **`'first-frame DI coherence: pill renders at expected metric anchor on prompt-yield (no flicker)'` (NEW in Rev-3 — Codex Round-3 H2):** invoke line tool, click first point, BEFORE moving cursor query the DI pills, assert pill[0] (Distance) and pill[1] (Angle) are positioned at the expected screen coords given p1 + current cursor. Verifies the synchronous-bootstrap on yield (step 3a.ii) populated guides BEFORE first paint.

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
**Status:** Rev-7 authored — Codex Round-7 caught 8 stale-symbol leaks Rev-6's §1.16 sweep missed; addressed + Procedure 01 §1.16.12.a stale-symbol-purge rule landed to prevent recurrence; awaiting Codex Round-8 review

### Paste to Codex for plan review (Round 8)
> Review this plan using `docs/procedures/Codex/02-plan-review.md`
> (Procedure 02 — note the §2.4 Plan-vs-Code Grounding entry + §2.9
> item 5b output requirement, in effect since commit `62310b2`; plus
> the NEW §1.16.12.a stale-symbol-purge rule landed in this round
> based on your Round-7 proposal). Apply strict evidence mode. Start
> from Round 8.
>
> Prior rounds: Round-1 No-Go (1B/2H/2Q); Round-2 No-Go (1H Review
> Miss / 2Q); Round-3 No-Go (1H regression / 1H Review Miss / 1Q);
> Round-4 No-Go (1H Review Miss / 2Q); Round-5 No-Go (1H Review
> Miss / 2Q); Round-6 GO at 9.8/10 → §3.10 deviation discovery →
> Rev-6; Round-7 No-Go (1B + 2H — all from Rev-6's incomplete §1.16
> sweep, NOT new architectural concerns). Rev-7 fixes the 8 stale
> active references; Procedure 01 §1.16.12.a stale-symbol-purge rule
> ensures future revisions catch this class of finding before review.
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
>
> Rev-2 fixes the Round-2 Review Miss by **locking the dynamic-
> anchor strategy** (Rev-1 R2-A6 had deferred this to execution-
> time, which Codex correctly flagged as implementation-guessing
> per §1.4). Locked: `DimensionGuide` discriminated union carries
> flat `{x, y}` metric coords ONLY — no reference strings, no
> callbacks, no IDs; `commandBar.dynamicInput.manifest` is sparse
> (no anchor info); `overlay.dimensionGuides` is dynamic (written
> per cursor-tick by each opted-in tool's cursor-effect handler;
> same machinery as `overlay.cursor` / `overlay.preview`). Painter
> reads flat coords (DTP-T1/T2/T6/T7 preserved). Pill component
> reads both slices. NEW Gate REM6-P1-DimensionGuideTypes
> (positive grep for variant kinds + negative grep proving zero
> reference-string fields). 4 new cursor-effect tests in
> `tests/draw-tools.test.ts` (one per migrated tool).
>
> Rev-2 also: rewrites §4.1 EditorRoot scope-table row to align
> with Phase-1 step 11 wording ("delegates to helper, no parsing
> or combineAs math in EditorRoot" — Rev-2 Q1); tightens Gate
> REM6-P1-ClickEat from loose count grep to per-site annotation-
> anchored grep (Rev-2 Q2).
>
> Rev-3 fixes Round-3 No-Go: (H1 regression — Phase-1 step 4 had
> stale "implementation chooses re-publish-per-cursor-tick OR
> reference-resolve-at-render-time at execution time" wording that
> contradicted Rev-2 lock-in; missed by Rev-2's §1.16 step 12
> consistency pass). **Removed.** (H2 Review Miss — first-frame
> coherence between sparse manifest and dynamic overlay guides
> after Rev-2's step 3a/3b split.) **Fixed:** synchronous bootstrap
> on prompt-yield (step 3a.ii) — runner triggers per-tool cursor-
> effect handler immediately after publishing the manifest,
> populating `overlay.dimensionGuides` BEFORE first paint. Invariant
> `manifest !== null ⟹ guides !== null && guides.length ===
> manifest.fields.length` enforced by NEW Gate REM6-P1-FirstFrame-
> Coherence (unit test + smoke scenario `'first-frame DI
> coherence: pill renders at expected metric anchor on prompt-yield
> (no flicker)'`). Pill component coded defensively for graceful
> degradation. (Q — click-eat grep helper-name-coupled.) **Fixed:**
> Gate REM6-P1-ClickEat converted from grep to 3 unit tests in NEW
> `tests/click-eat-with-di.test.tsx` (one per handler), refactor-
> resilient. Annotation grep simplified to count-only.
>
> Procedural lesson recorded in §13: §1.16 step 12 consistency pass
> must grep for execution-time-deferral phrasing patterns when a
> revision LOCKS a previously-deferred decision.
>
> Rev-4 fixes Round-4 No-Go: (H Review Miss — sync-bootstrap re-
> entrancy contract not bounded). **Locked:** cursor-effect handler
> invoked from step 3a.ii is overlay-write-only (allowed/forbidden
> lists in §3 A2.1). **Runtime guard:** `inSyncBootstrap` flag in
> runner, set/cleared with try/finally; forbidden methods check the
> flag and throw `'cursor-effect re-entered runner during sync
> bootstrap'`. NEW Gate REM6-P1-SyncBootstrapNoReentry — 2 unit tests
> in `tests/tool-runner.test.ts` (republish-prompt + advance-
> generator). Existing per-cursor-tick path unaffected.
>
> Rev-4 also: (Q1) scrubbed Rev-2 click-eat wording remnants in Done
> Criteria + risk table to match current Rev-3 unit-test gate state.
> (Q2) Locked click-eat unit-test deterministic primary assertion
> target — project-store entity count + zundo temporal-stack length
> unchanged (primary), overlay.preview unchanged (secondary).
> Refactor-resilient via project-store's exposed selectors. (Rev-5
> Q2 subsequently dropped the fragile "no console.error" tertiary —
> two-tier deterministic gate is sufficient.)
>
> Rev-6 adapts to the function-based runner architecture per
> Procedure 03 §3.10 mid-execution deviation discovery (see
> Post-execution notes section at bottom of plan for the full
> narrative). 5 deviations addressed: (D1) `class ToolRunner` with
> `STATE_MACHINE_ADVANCE_METHODS` array → function-based `startTool`
> with single `feedInput` entrypoint; (D2) per-tool cursor-effect
> handler → `Prompt.dimensionGuidesBuilder` per-Prompt pure callback
> mirroring existing `Prompt.previewBuilder`; (D3) sync-bootstrap is
> already the existing pattern at [runner.ts:116-130](packages/editor-2d/src/tools/runner.ts:116)
> for `previewBuilder` — Rev-3 H2 fix simply extends the same block
> for `dimensionGuidesBuilder`; (D4) re-entrancy guard simplified to
> single-method form on `feedInput` (was Rev-5's elaborate SSOT
> array + helper); (D5) click-eat handler names corrected
> (`handleGripDown` + `handleSelectRectStart`, not Rev-1's
> `handleCanvasMouseDown` + `handleCanvasMouseUp`). No re-opening
> of locked decisions: dynamic-anchor schema (Rev-2 H1), angle
> deg→rad invariant (Rev-1 H2), ADR-023 immutability (Rev-1 B1),
> click-eat semantic-outcome unit-test gate (Rev-3 Q + Rev-4 Q2),
> first-frame coherence invariant (Rev-3 H2), click-eat tertiary
> drop (Rev-5 Q2) — all preserved.
>
> Rev-5 fixes Round-5 No-Go: (H Review Miss — re-entrancy guard
> exhaustiveness under-enforced; Rev-4's "and any other state-
> machine-advance method" wording lacked enforceable closure).
> **Locked:** runner exposes `static readonly STATE_MACHINE_ADVANCE_METHODS = ['publishPrompt', 'advanceGenerator', 'dispatchInput'] as const`
> (SSOT array — extensible) + private helper `assertNotInSyncBootstrap(methodName)`
> called at entry of each guarded method (throws
> `'cursor-effect re-entered runner during sync bootstrap: ${methodName}'`).
> Adding a new state-machine-advance entrypoint REQUIRES adding it
> to the array. **Parameterized test** iterates the SSOT array (3
> tests at current size; auto-grows). Plus exhaustiveness count
> gate `rg -c "this\.assertNotInSyncBootstrap\(" runner.ts ≥ STATE_MACHINE_ADVANCE_METHODS.length`
> proves each method calls the helper. (Q1 — Phase-2 step 17 count
> drift.) **Fixed:** Phase-2 step 17 updated from "4 new smoke
> scenarios" to "5" (first-frame coherence added in Rev-3 H2 was
> never reflected in step 17 prose). Gate REM6-P2-Smoke expected
> count updated to ≥10 matches. (Q2 — click-eat tertiary fragile.)
> **Fixed:** dropped tertiary "no console.error" from click-eat
> assertion target; two-tier deterministic gate is sufficient.
>
> Procedural lesson reinforced in §13: §1.16 step 12 consistency
> pass extends Rev-4's all-sections sweep to **step-level smoke
> counts** — Phase-2 step 17 carrying a stale count survived
> through Rev-3 + Rev-4 because the consistency pass focused on
> structural sections (Done Criteria, risks, audit) but not
> individual phase-step prose.
>
> Particular things to check this round:
>
> - Is the runtime-guard flag the correct enforcement surface, or
>   would a TypeScript-narrowing approach be more architecturally
>   pure? (Rev-4 picks runtime guard for GR-2 simplicity; Rev-5
>   adds SSOT array + helper for exhaustiveness; if Round-6 wants
>   types, that's a Round-6 fix.)
>
> - Are there other runner methods beyond publishPrompt /
>   advanceGenerator / dispatchInput that should also check the
>   inSyncBootstrap flag? Rev-5 locks the SSOT array; if you find
>   additional state-machine-advance entrypoints in runner.ts that
>   are not in the array, that's a Rev-6 fix (add them to
>   STATE_MACHINE_ADVANCE_METHODS + the helper auto-generates a
>   parameterized test).
>
> - Does the click-eat assertion target ("entity count + temporal-
>   stack length unchanged") cover all geometry-commit paths? Is
>   there a path that mutates entities WITHOUT incrementing entity
>   count or pushing a zundo frame?
>
> - The Rev-1 → Rev-5 chain has surfaced 5 sequential Review Misses,
>   each caused by deferral or under-specification at the prior
>   revision. The §13 procedural lessons cumulate (Rev-3 broader-
>   regex; Rev-4 all-sections sweep; Rev-5 step-level smoke counts).
>   Worth a final check on whether any current Rev-5 sentence is the
>   next Review Miss in waiting — particularly any "MAY add" /
>   "may also" / "or equivalent" wording that doesn't carry
>   enforcement.

### Paste to user for approval
> Please review the plan at
> `docs/plans/feature/m1-3-di-pill-redesign.md`. After approval,
> invoke Procedure 03 to execute Phase 1 (substrate) then Phase 2
> (per-tool migration).

---

## Post-execution notes

### Note 1 — 2026-04-28 — Procedure 03 §3.10 mid-execution deviation discovery (pre-Phase-1)

**When:** start of execution after Codex Round-6 Go (9.8/10 on Rev-5, commit `cb449c7`).
**What:** Pre-Phase-1 codebase audit per Procedure 03 §3.0.1 (added retroactively in commit `62310b2` from this same lesson) revealed 5 plan-vs-code mismatches:

1. **D1 — Runner architecture mismatch (large impact on Rev-5 H).**
   - **Plan:** `class ToolRunner { static readonly STATE_MACHINE_ADVANCE_METHODS = ['publishPrompt', 'advanceGenerator', 'dispatchInput'] as const; private inSyncBootstrap = false; private assertNotInSyncBootstrap(methodName) {...}; publishPrompt(...) {...}; advanceGenerator() {...}; dispatchInput(...) {...} }`.
   - **Reality** ([runner.ts:38](packages/editor-2d/src/tools/runner.ts:38)): `export function startTool(toolId: string, generatorFactory: () => ToolGenerator): RunningTool` — closure-based, single external state-advance entrypoint `feedInput(input: Input): void` ([runner.ts:154](packages/editor-2d/src/tools/runner.ts:154)). The closure-private async IIFE drives the generator iteration loop ([runner.ts:93-150](packages/editor-2d/src/tools/runner.ts:93)).
   - **Cause:** plan author (Claude) at Rev-5 specified the `class ToolRunner` shape based on a mental model of "what a runner should look like" without reading the actual file. Codex Rounds 1-5 reviewed plan internal consistency but never grepped for `class ToolRunner` in the codebase to confirm it existed.

2. **D2 — Cursor-effect model mismatch (medium impact on Rev-2 H1).**
   - **Plan:** "per-tool cursor-effect handler in `tools/runner.ts` (or per-tool subdir)" — a separate handler block per tool.
   - **Reality** ([types.ts:80](packages/editor-2d/src/tools/types.ts:80)): `Prompt.previewBuilder?: (cursor: Point2D) => PreviewShape` — a per-Prompt **pure callback** captured at yield time. Tools express cursor-effect logic as a closure on the Prompt they yield, not as a separate handler block.
   - **Cause:** same as D1 — plan author specified an architecture pattern without reading the actual mechanism.

3. **D3 — Synchronous bootstrap is the existing pattern (beneficial impact on Rev-3 H2).**
   - **Plan (Rev-3 H2):** "MUST set `inSyncBootstrap = true`, then synchronously trigger the per-tool cursor-effect handler with current `overlay.cursor`, then clear `inSyncBootstrap = false` in a `finally` block" — presented as a NEW pattern to introduce.
   - **Reality** ([runner.ts:116-130](packages/editor-2d/src/tools/runner.ts:116)): runner already synchronously invokes `previewBuilder(cursor.metric)` immediately after publishing the prompt, before returning from the yield-side path. The Rev-3 H2 fix is achievable by extending the same block to also seed `dimensionGuidesBuilder`.
   - **Cause:** plan author proposed a NEW bootstrap pattern without checking whether the existing runner already had one. This led Codex to bless an "introduction of new infrastructure" that was actually a "small extension of existing infrastructure" — and the resulting plan text led the implementer to expect more work than was actually needed.

4. **D4 — Re-entrancy risk reduced (simplifying impact on Rev-4 H + Rev-5 H).**
   - **Plan (Rev-4 H + Rev-5 H):** elaborate SSOT array `STATE_MACHINE_ADVANCE_METHODS = ['publishPrompt', 'advanceGenerator', 'dispatchInput']` + private helper `assertNotInSyncBootstrap(methodName)` + parameterized test iterating the array + exhaustiveness count gate. Designed to handle "any state-machine-advance method" exhaustively.
   - **Reality:** with `previewBuilder` and `dimensionGuidesBuilder` as pure-function callbacks `(cursor) => Shape`, the builder doesn't receive a `RunningTool` reference. It cannot reach `feedInput` / `abort` / `done` even by accident — pure-function signatures are the architectural primary defense. The "any state-machine-advance method" concern collapses to a single method (`feedInput`), and the elaborate SSOT machinery is over-engineered for this architecture.
   - **Cause:** Rev-4 H and Rev-5 H are downstream consequences of D1 — once the plan committed to `class ToolRunner` with multiple state-advance methods, Codex correctly flagged exhaustiveness; both fixes built increasingly elaborate machinery on a foundation that didn't match reality.

5. **D5 — Click-eat handler names mismatch (small impact on Rev-1 H1).**
   - **Plan:** `handleCanvasClick` (389) ✓ + `handleCanvasMouseDown` (533) + `handleCanvasMouseUp` (560).
   - **Reality** ([EditorRoot.tsx](packages/editor-2d/src/EditorRoot.tsx)): `handleCanvasClick` (389) ✓ + `handleGripDown` (533) + `handleSelectRectStart` (560). All three M1.3d-Rem-4 G2 click-eat annotations exist; handlers serve the same purpose; only the names differ.
   - **Cause:** plan author guessed conventional handler names rather than reading the actual file. Codex's regex-based grep gates would have hit on whatever line happened to contain `inputBuffer.length > 0` regardless of the surrounding handler name, so the gates passed despite the naming mismatch.

### Why this slipped past 6 review rounds

Six rounds of Codex review polished plan TEXT for internal logical consistency. None of those rounds verified plan-vs-code grounding because:

- Procedure 02 §2.4 (Forced Completeness Scan) had no entry for "verify plan-cited code constructs match the actual code".
- Procedure 02 §2.9 (Required Output Format) had no "Plan-vs-Code Grounding Verification" table.
- Codex's adversarial postures (Chief Architect / Sceptical Reader / Blast Radius equivalents) were oriented toward LOGIC checks (does this plan contradict ADR-X? does this gate prove invariant Y?), not GROUNDING checks (does the file the plan cites actually look the way the plan says it does?).

Procedure 01 §1.4 (Investigation Depth) said "do not guess" but did not enforce "read the actual file when claiming a specific code shape." Claude's three internal review rounds (Chief Architect / Sceptical Reader / Blast Radius) checked the plan against itself and against ADRs but didn't include a "did I read the file I'm claiming to extend?" check.

The result: 5 sequential Review Misses across Rev-1 → Rev-5, each at finer granularity, each based on plan text describing an architecture that did not exist. Rev-5 reached Codex Go at 9.8/10 — a plan that would have failed at Round-1 if any reviewer (Codex or Claude) had grepped the codebase for `class ToolRunner`.

### Procedure tightening landed in commit `62310b2`

To prevent recurrence:

- **Claude Procedure 01 §1.4.1 (Plan-vs-Code Grounding):** every plan claim referencing a specific code construct (class declaration, function signature, public API surface, file path/line, architectural pattern) MUST be grounded by reading the actual file at plan-authoring time. Pre-emit checklist required.
- **Claude Procedure 01 §1.13 (Pre-Response Notification):** new "Plan-vs-Code Grounding Verification" table required in every §1.13 emission. Author cannot emit without confronting the grounding question for each cited construct.
- **Codex Procedure 02 §2.4 (Forced Completeness Scan) + §2.9 item 5b:** Codex MUST verify every plan-cited code construct by reading the referenced file independently. Mismatches are High-risk findings regardless of plan internal consistency. New "Plan-vs-Code Grounding Verification" table required in every review memo.
- **Claude Procedure 03 §3.0.1 (Pre-Phase-1 plan-vs-code re-grounding):** before writing the first line of code, MUST audit every file the plan cites. Catches drift between plan approval and execution start.

### What this means for execution

Rev-6 adapts the plan to the actual codebase architecture. Once Codex Round-7 reviews Rev-6 (using the new §2.4 plan-vs-code grounding check) and returns Go, execution can resume from Phase 1. The substrate phase remains: types + slice + helper + click-eat + sync-bootstrap + painter + chrome + router + cursor-effect base. The implementation is materially simpler than Rev-5 specified because the existing runner architecture already provides much of the machinery.

**Cost of the gap:** ~3 hours of plan revision rounds (Rev-1 through Rev-5) polishing plan text against an architecture that did not exist; ~30 minutes of Pre-Phase-1 audit + Rev-6 patch + Post-execution notes; ~10 minutes of procedure tightening. Net cost is contained; the procedure tightening prevents future plans from incurring this in the first place.

**Lesson source for future plans:** when an author finds themselves describing an architecture in code-pseudocode (class declarations, method signatures, etc.) without having read the actual file, that is a §1.4.1 violation regardless of how plausible the pseudocode looks. The act of writing pseudocode without grounding it should trip the author's "am I making this up?" instinct.
