# Plan — M1.3d Drafting UX Polish (Remediation Round 5)

**Branch:** `feature/m1-3d-drafting-polish`
**Parent plans:** `docs/plans/feature/m1-3d-drafting-polish.md` (M1.3d) + Round 1 + Round 2 + Round 3 + Round 4 (`m1-3d-drafting-polish-remediation-{,2,3,4}.md`)
**Parent commit baseline:** Round 4 latest = `2d8a468` (G1 AC accumulator + G2 Dynamic Input pill; Codex post-commit Round-1 9.4/10 Go)
**Author:** Claude (Opus 4.7, 1M context)
**Date:** 2026-04-28
**Operating mode:** Procedure 01 (PLAN-ONLY) → Procedure 03 (EXECUTION) after Codex review
**Status:** Plan authored — awaiting Codex Round-1 review

---

## Revision history

| Rev | Date | Driver | Changes |
|-----|------|--------|---------|
| Rev-0 | 2026-04-28 | Initial draft | Three behavior fixes + one doc-polish from manual user testing of M1.3d-Rem-4 at `2d8a468`: H1 G3 comma-pair input via new `'numberPair'` Input kind (replaces rectangle's two-prompt W/H sub-flow with one `Specify dimensions <width,height>` prompt); H2 remove the 750 ms idle accumulator timeout (true AC parity — accumulator waits indefinitely); H3 flip Dynamic Input pill below cursor (`dy: -24 → +28`) so it stops overlapping the bottom command line; H4 fill the execution-commit placeholder `2d8a468` in the Round-4 plan's post-execution notes (Codex Round-1 quality cleanup). §1.3 three-round audit. AC-style transient-label-integrated pills + Tab cycling explicitly deferred to Round-6 / post-M1 with its own plan + ADR. |

## 1. Request summary

Three behavior issues from manual testing of M1.3d-Rem-4 at `2d8a468`, plus one Codex post-commit Round-1 quality polish item. All implementation-side; one binding-spec doc patch (`docs/operator-shortcuts.md` 1.2.0 → 1.2.1).

- **H1 — G3 comma-pair input for rectangle Dimensions (BUG).** User flow:
  1. Activate REC (`R`+`E`+`C`+Enter)
  2. Click first corner
  3. Click `[Dimensions]` (or type `D`+Enter)
  4. Type `30,40` + Enter — expects rectangle W=30, H=40 — INSTEAD: nothing happens; the `Specify width` prompt remains because `Number("30,40") === NaN` and `handleCommandSubmit` returns without feeding any input.

  AutoCAD's actual behavior at this prompt is exactly comma-pair input — `30,40` commits both dimensions in one keystroke. Round-4 had deferred this as G3 ("becomes obsolete once G2 lands") on the bet that the existing two-prompt W/H sub-flow would be usable. The bet was wrong — the user typed `30,40` muscle-memory style.

  Fix: introduce a new `'numberPair'` Input kind. Rectangle's Dimensions sub-flow yields a single prompt `Specify dimensions <width,height>` with `acceptedInputKinds: ['numberPair']`. EditorRoot's `handleCommandSubmit` parses `"a,b"` when the active prompt accepts `'numberPair'` and feeds `{ kind: 'numberPair', a, b }`.

- **H2 — Remove 750 ms idle accumulator timeout (BEHAVIOR).** User: "why does command have expiry timing? did i tell you i want that ... if i type L it should wait for me indefinitely, this is how AC works."

  Round-4 added the 750 ms silent stale-clear timeout in plan §3 A1 as a safety net ("avoid stale state"). User objects — AC has no such timeout. Accumulator should wait indefinitely until Enter / Space / Esc.

  Fix: strip the `accumulatorTimer` + `setTimeout(clearAccumulator, ACCUMULATOR_TIMEOUT_MS)` call from `pumpAccumulator`. Keep the timer-cancellation cleanup paths in case anything else still references them, but remove the timer itself entirely. Spec doc removes the "750 ms silent stale-clear" line.

- **H3 — Pill overlap with bottom command line (POLISH).** Current pill anchors at `cursor.screen + {dx: 16, dy: -24}` — above-and-to-the-right. When the user has the cursor near the bottom of the canvas, the pill sits visually atop the bottom command line, making both surfaces fight for the same pixels.

  Fix: flip pill below cursor — `{dx: 16, dy: +28}`. Predictable AC-style placement. No edge-detection logic (out of scope per A4). Updates one constant + one test assertion.

- **H4 — Codex Round-1 quality placeholder fill (DOC).** Round-4 plan's `## Post-execution notes` says "to be filled by `git log` after the execution commit lands; per Rev-1 footer convention no self-referential placeholder token." After the execution commit `2d8a468` landed, the placeholder remained because the convention from Rem-1 Rev-5 said NOT to inline self-referential hashes — but Codex Round-1 audit (9.4/10) flagged the visible "to be filled" string as audit-trail quality drift. Compromise: replace the placeholder with `2d8a468` (the commit IS now stable + landed; no longer self-referential because we're editing in a SEPARATE commit). Updates one paragraph in the Round-4 plan.

## 2. Out of scope (deferred / not addressed in Round 5)

- **AC-style transient-label-integrated Dynamic Input pills + Tab cycling.** User screenshots showed AC's actual DI: multiple pills sitting on the in-canvas transient-dimension extension lines, Tab cycles focus between them. This is a substantial UX/architecture redesign — moves DI from "single chrome pill at cursor" to "per-input-field pills anchored to in-canvas dimension lines via paintTransientLabel-adjacent chrome", needs focus management across N inputs (one per dimension axis), needs per-tool DI structure declaration. Deferred to **Round 6 or post-M1** with its own plan + ADR. The current single-pill design from Round-4 ships as the baseline DI; user lives with it for one release; the redesign builds on real usage feedback.
- **Pill edge-detection / clipping logic.** A4 — always-below-cursor placement is a one-line constant change. Edge cases (cursor at top of canvas, pill clipped by canvas-area top) are minor and can be addressed in the AC-style redesign when each pill anchors at a transient-label position instead of the cursor.
- **Other tools gaining `'numberPair'`.** Only rectangle's Dimensions sub-flow uses comma-pair input in M1.3d. Line / circle / arc / polyline don't have semantically-paired inputs at this stage. Future tools (e.g. M1.3c POLAR override, M2 RTG_BLOCK origin+orientation) may gain `'numberPair'` when they ship.
- **Multi-modifier accumulator semantics.** No change to F2 modifiers slice; H2 only touches the letter accumulator timer.
- **Spec doc beyond the timeout-removal patch.** No new shortcut additions.

## 3. Assumptions and scope clarifications

- **A1 — `'numberPair'` Input kind.** New union arm in both `AcceptedInputKind` (string literal `'numberPair'`) and `Input` (`{ kind: 'numberPair'; a: number; b: number }`). Tool runner publishes `acceptedInputKinds` transparently; runner code itself doesn't need updates (it forwards the prompt config to `setPrompt` unchanged).

- **A2 — handleCommandSubmit comma-pair parser.** New branch in EditorRoot.handleCommandSubmit, BEFORE the existing F1 directDistanceFrom branch:
  ```
  if (cb.acceptedInputKinds.includes('numberPair') && raw.includes(',')) {
    const parts = raw.split(',');
    if (parts.length === 2) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        runningToolRef.current?.feedInput({ kind: 'numberPair', a, b });
        return;
      }
    }
  }
  // Fall through to existing F1 / number / commit logic
  ```
  Edge cases: `30,` → parts=`['30','']`, `Number('')` is `0` (finite!) — guard with `parts[1].length > 0`. `30,40,50` → parts.length === 3, fail length check, fall through.

- **A3 — draw-rectangle Dimensions sub-flow rewrite.** Replace the two-prompt sequence (`Specify width` → `Specify height`) with one prompt:
  ```
  text: 'Specify dimensions <width,height>',
  acceptedInputKinds: ['numberPair'],
  ```
  On `'numberPair'` input: `width = Math.abs(input.a)`, `height = Math.abs(input.b)`, commit. On any other kind: abort.

- **A4 — Pill anchor offset H3.** Change `PILL_OFFSET_Y_PX = -24 → +28`. Always-below placement; no edge-detection. Existing X offset (16) unchanged. AC's actual offset varies by context; +28 is a reasonable approximation that clears the cursor crosshair (which spans ~20 px in either direction at default zoom).

- **A5 — H2 timeout removal scope.** Strip `accumulatorTimer: ReturnType<typeof setTimeout> | null = null;` declaration, `if (accumulatorTimer !== null) clearTimeout(accumulatorTimer);` calls (4 sites in router.ts: `clearAccumulator`, `pumpAccumulator`, top of `cleanup`), and the `setTimeout(clearAccumulator, ACCUMULATOR_TIMEOUT_MS)` call. Also strip the constant `const ACCUMULATOR_TIMEOUT_MS = 750;`. Net diff: ~10 lines removed.

- **A6 — Existing draw-rectangle F3 tests migration.** Two tests in `tests/draw-tools.test.ts` use the two-prompt flow:
  - `'Dimensions flow: typed W/H commit a rectangle of those dimensions from corner1'` — currently feeds `{kind:'number', value:8}` then `{kind:'number', value:4}`. Migrate to `{kind:'numberPair', a:8, b:4}`.
  - `'Dimensions abort path: missing width input aborts cleanly'` — currently feeds `{kind:'commit'}` after the D sub-option, expecting abort. Under G3 the second prompt is for `'numberPair'`, not `'number'`; abort still triggers via the `dims.kind !== 'numberPair'` guard. Test stays semantically valid; assertion unchanged.

- **A7 — F3 sub-option remains intact.** The `[Dimensions]` sub-option declaration on rectangle's second prompt (`subOptions: [{ label: 'Dimensions', shortcut: 'd' }]`) is unchanged. Only the SUB-FLOW yielded after the `'subOption'` Input changes (one prompt instead of two).

- **A8 — Smoke-e2e impact.** The Round-3 F3 didn't get a smoke scenario (per §11 of Round-3 it was unit-tested only). Round-5 doesn't add a smoke scenario either; the comma-pair behavior is exercised by the unit tests. Existing smoke scenarios are unaffected.

- **A9 — H2 indefinite-wait test.** Replace the existing keyboard-router test `'750 ms idle clears accumulator silently (no activation)'` (which under H2 is no longer true) with `'accumulator persists across long idle periods (no timeout in AC mode)'`. Wait 1000+ ms after pressing a letter, assert the accumulator is still set, no callback fired.

- **A10 — Spec doc patch.** `docs/operator-shortcuts.md` 1.2.0 → 1.2.1 (patch bump per registry governance for "behavior clarification + small bug fix bundle, no new shortcut"). Behavior notes: replace "750 ms silent stale-clear" line with "Accumulator waits indefinitely; clear via Escape." Add a brief mention of the comma-pair input pattern under "Sub-prompt input forms" (or similar). Changelog row.

- **A11 — Round-4 plan placeholder fill (H4).** In `docs/plans/feature/m1-3d-drafting-polish-remediation-4.md`, replace the line `**Execution commit:** to be filled by `git log` after the execution commit lands; per Rev-1 footer convention no self-referential placeholder token.` with `**Execution commit:** `2d8a468` (Round-4 G1 + G2 implementation; Codex post-commit Round-1 9.4/10 Go).` Single-line edit.

## 4. Scope

### 4.1 In scope — files modified

| Path | Change |
|---|---|
| `packages/editor-2d/src/tools/types.ts` | (H1) Add `'numberPair'` to `AcceptedInputKind` union. Add `\| { kind: 'numberPair'; a: number; b: number }` arm to `Input` discriminated union. |
| `packages/editor-2d/src/tools/draw/draw-rectangle.ts` | (H1) Replace the two-prompt Width/Height sub-flow with one prompt `Specify dimensions <width,height>` accepting `'numberPair'`. On `'numberPair'` input: commit rectangle with `width = Math.abs(input.a)`, `height = Math.abs(input.b)`, origin = corner1, localAxisAngle = 0. On any other kind: abort. |
| `packages/editor-2d/src/EditorRoot.tsx` | (H1) `handleCommandSubmit` — new comma-pair branch BEFORE the F1 directDistanceFrom branch. Reads `commandBar.acceptedInputKinds`; when it includes `'numberPair'` AND `raw.includes(',')`, parses `a,b` and feeds `{kind:'numberPair', a, b}`. Edge guard: `parts.length === 2`, `parts[1].length > 0`, both numbers finite. Falls through on any failure. |
| `packages/editor-2d/src/keyboard/router.ts` | (H2) Remove 750 ms idle accumulator timeout entirely. Strip `accumulatorTimer` variable, the four cleanup-the-timer call sites (`clearAccumulator`, `pumpAccumulator`, `cleanup`), the `setTimeout(clearAccumulator, ACCUMULATOR_TIMEOUT_MS)` call, and the `ACCUMULATOR_TIMEOUT_MS` constant. Net diff: ~10 lines removed. Pill (G2) continues to render the accumulator as the user types — the visible feedback is the safety net. |
| `packages/editor-2d/src/chrome/DynamicInputPill.tsx` | (H3) Change `PILL_OFFSET_Y_PX = -24` → `PILL_OFFSET_Y_PX = 28`. Always-below-cursor placement; clears the bottom command line area. |
| `packages/editor-2d/tests/draw-tools.test.ts` | (H1) Migrate the two F3 Dimensions sub-option tests:<br>(a) `'Dimensions flow'` — feed `{kind:'numberPair', a:8, b:4}` instead of two `{kind:'number'}` inputs. Assertions unchanged.<br>(b) `'Dimensions abort path'` — assertion unchanged; tool guard now triggers on `dims.kind !== 'numberPair'`. (H1 new) Test: `'rectangle Dimensions sub-flow: numberPair input commits W,H'` (or refine the existing one). (H1 new) Test: `'rectangle Dimensions: subOption D yields ONE prompt accepting numberPair (not two prompts)'` to lock the contract. |
| `packages/editor-2d/tests/keyboard-router.test.ts` | (H2) Replace `'750 ms idle clears accumulator silently (no activation)'` with `'accumulator persists across long idle periods (no timeout in AC mode)'`. Wait 1000+ ms after pressing a letter; assert `editorUiStore.getState().commandBar.accumulator === 'L'` (or whatever was typed); assert `mocks.onActivateTool` was not called. |
| `packages/editor-2d/tests/DynamicInputPill.test.tsx` | (H3) Update the `'pill anchors at cursor.screen + offset (16, -24)'` test — change expected transform to `'translate(116px, 228px)'` (cursor.screen.y=200 + 28 = 228). Rename test to `'pill anchors at cursor.screen + offset (16, +28) — below cursor'`. |
| `packages/editor-2d/tests/EditorRoot.test.tsx` *(if exists; otherwise covered by smoke / draw-tools)* | (H1) Test that `handleCommandSubmit('30,40')` with `acceptedInputKinds: ['numberPair']` feeds the right Input. (Likely covered by draw-tools.test indirectly via the rectangle commit assertions.) |
| `docs/operator-shortcuts.md` | 1.2.0 → 1.2.1 patch bump. Behavior notes: remove "750 ms silent stale-clear" line; replace with "Accumulator persists indefinitely; clear via Escape." Add brief note under Behavior notes documenting the comma-pair input form for sub-prompts that accept it (e.g. rectangle Dimensions). Changelog row. |
| `docs/plans/feature/m1-3d-drafting-polish-remediation-4.md` | (H4) Fill the execution-commit placeholder with `2d8a468`. Single-line edit. |

### 4.2 In scope — files created

None.

### 4.3 Out of scope (deferred)

- AC-style transient-label-integrated DI pills + Tab cycling (Round 6 / post-M1; needs its own plan + ADR).
- Pill edge-detection / clipping logic (covered by the redesign).
- Other tools' `'numberPair'` adoption (no current need; future tools opt in when they ship).

### 4.4 Blast radius

- **Packages affected:** `editor-2d` only (tools/types, tools/draw/draw-rectangle, EditorRoot, keyboard/router, chrome/DynamicInputPill).
- **Cross-cutting hard gates affected:** none — DTP-T1/T2/T6/T7 stay clean.
- **Stored data:** none. UI-state-only changes (no slice extensions).
- **UI surfaces affected:** keyboard router (timer removal), command bar input parsing (numberPair parser), draw-rectangle prompt sequence (one prompt instead of two), pill positioning.
- **ADRs:** none modified. ADR-023 (tool state machine + command bar) gains a `'numberPair'` Input kind — additive.
- **I-DTP invariants:** none changed.

## 5. Architecture doc impact

| Doc | Change |
|---|---|
| `docs/operator-shortcuts.md` | Patch bump 1.2.0 → 1.2.1. Behavior notes updated: "Accumulator persists indefinitely; clear via Escape" replaces the 750 ms language. Add a small paragraph documenting the comma-pair input form for sub-prompts (rectangle Dimensions example). Changelog row added per registry governance. |
| `docs/plans/feature/m1-3d-drafting-polish-remediation-4.md` | (H4) Execution-commit placeholder filled with `2d8a468`. |
| All other binding spec docs | No change. |

## 6. Deviations from binding specifications (§0.7)

**None.** `'numberPair'` Input kind is an additive extension within ADR-023's existing tool-runner contract. Pill offset change is a chrome layout polish. Timeout removal aligns the implementation with AC parity (the originally-claimed behavior in the M1.3d-Rem-4 plan §3 A1 was over-specified).

## 7. Implementation steps (single phase)

The four fixes (H1 + H2 + H3 + H4) are independent surface changes; bundling them in one phase keeps the Procedure-03 audit cycle tight (one phase audit + one self-review loop).

### Step-by-step

1. **H1 type extensions.** In `tools/types.ts`:
   - Add `'numberPair'` to `AcceptedInputKind`.
   - Add `\| { kind: 'numberPair'; a: number; b: number }` arm to `Input`.
2. **H1 EditorRoot comma-pair parser.** In `EditorRoot.tsx` `handleCommandSubmit`, BEFORE the F1 directDistanceFrom branch, add the comma-pair branch:
   ```ts
   const cb = editorUiStore.getState().commandBar;
   if (cb.acceptedInputKinds.includes('numberPair') && raw.includes(',')) {
     const parts = raw.split(',');
     if (parts.length === 2 && parts[1].length > 0) {
       const a = Number(parts[0]);
       const b = Number(parts[1]);
       if (Number.isFinite(a) && Number.isFinite(b)) {
         runningToolRef.current?.feedInput({ kind: 'numberPair', a, b });
         return;
       }
     }
   }
   ```
3. **H1 draw-rectangle Dimensions sub-flow rewrite.** Replace the two-prompt sequence:
   ```ts
   if (c1.kind === 'subOption' && c1.optionLabel === 'Dimensions') {
     const dims = yield {
       text: 'Specify dimensions <width,height>',
       acceptedInputKinds: ['numberPair'],
     };
     if (dims.kind !== 'numberPair') return { committed: false, reason: 'aborted' };
     const width = Math.abs(dims.a);
     const height = Math.abs(dims.b);
     if (width === 0 || height === 0) return { committed: false, reason: 'aborted' };
     const layerId = editorUiStore.getState().activeLayerId ?? LayerId.DEFAULT;
     addPrimitive({
       id: newPrimitiveId(),
       kind: 'rectangle',
       layerId,
       displayOverrides: {},
       origin: corner1,
       width,
       height,
       localAxisAngle: 0,
     });
     return { committed: true, description: 'rectangle (typed dimensions)' };
   }
   ```
4. **H2 router timeout removal.** In `keyboard/router.ts`:
   - Remove `const ACCUMULATOR_TIMEOUT_MS = 750;`.
   - Remove `let accumulatorTimer: ReturnType<typeof setTimeout> | null = null;`.
   - Remove the four `if (accumulatorTimer !== null) clearTimeout(accumulatorTimer); accumulatorTimer = null;` patterns (in `clearAccumulator`, `pumpAccumulator`, top of `cleanup`).
   - Remove the `accumulatorTimer = setTimeout(clearAccumulator, ACCUMULATOR_TIMEOUT_MS);` call at the end of `pumpAccumulator`.
5. **H3 pill offset.** In `chrome/DynamicInputPill.tsx`, change `const PILL_OFFSET_Y_PX = -24;` → `const PILL_OFFSET_Y_PX = 28;`. Update the inline header comment that documented "above-and-to-the-right" → "below-and-to-the-right".
6. **H1 test migration in draw-tools.test.ts.** Update the two existing F3 Dimensions tests to feed `'numberPair'` instead of two `'number'` inputs. Add a new test asserting the Dimensions sub-flow yields ONE prompt with `acceptedInputKinds: ['numberPair']` (not two prompts).
7. **H2 test migration in keyboard-router.test.ts.** Replace `'750 ms idle clears accumulator silently (no activation)'` with `'accumulator persists across long idle periods (no timeout in AC mode)'`. Implementation: press `'L'`, wait 1000+ ms, assert accumulator is still `'L'` and `onActivateTool` not called.
8. **H3 test update in DynamicInputPill.test.tsx.** Change the expected transform value to `'translate(116px, 228px)'`. Rename to `'pill anchors at cursor.screen + offset (16, +28) — below cursor'`.
9. **H1 spec doc + comma-pair docs.** Update `docs/operator-shortcuts.md` Behavior notes section. Add the comma-pair input form description.
10. **H2 spec doc.** Update `docs/operator-shortcuts.md` Behavior notes — remove the "750 ms silent stale-clear" line; replace with "Accumulator persists indefinitely; clear via Escape, Enter, or Space."
11. **Spec doc bump + changelog.** Header version 1.2.0 → 1.2.1; new changelog row.
12. **H4 placeholder fill.** Edit `docs/plans/feature/m1-3d-drafting-polish-remediation-4.md` line `**Execution commit:** to be filled...` → `**Execution commit:** \`2d8a468\` (Round-4 G1 + G2 implementation; Codex post-commit Round-1 9.4/10 Go).`.

### Mandatory completion gates

```
Gate REM5-H1a: 'numberPair' Input kind declared
  Command: rg -n "'numberPair'" packages/editor-2d/src/tools/types.ts
  Expected: ≥2 matches (AcceptedInputKind union arm + Input discriminated arm)

Gate REM5-H1b: handleCommandSubmit comma-pair branch
  Command: rg -A 12 -n "const handleCommandSubmit" packages/editor-2d/src/EditorRoot.tsx | rg "numberPair"
  Expected: ≥1 match (comma-pair parser branch references the kind)

Gate REM5-H1c: draw-rectangle Dimensions sub-flow uses numberPair
  Commands:
    (a) rg -n "'numberPair'" packages/editor-2d/src/tools/draw/draw-rectangle.ts
        Expected: ≥1 match (acceptedInputKinds declaration)
    (b) rg -n "Specify dimensions" packages/editor-2d/src/tools/draw/draw-rectangle.ts
        Expected: ≥1 match (the new single-prompt text)
    (c) rg -n "Specify width|Specify height" packages/editor-2d/src/tools/draw/draw-rectangle.ts
        Expected: 0 matches (the old two-prompt strings are gone)

Gate REM5-H2a: 750 ms timeout removed from router
  Commands:
    (a) rg -n "ACCUMULATOR_TIMEOUT_MS|accumulatorTimer" packages/editor-2d/src/keyboard/router.ts
        Expected: 0 matches (timer variable + constant both stripped)
    (b) rg -n "setTimeout\(clearAccumulator" packages/editor-2d/src/keyboard/router.ts
        Expected: 0 matches (the timeout call site is gone)

Gate REM5-H3: pill anchored below cursor (positive Y offset)
  Command: rg -n "PILL_OFFSET_Y_PX = 28" packages/editor-2d/src/chrome/DynamicInputPill.tsx
  Expected: 1 match (positive offset; supersedes the previous -24)

Gate REM5-H4: Round-4 plan placeholder filled
  Command: rg -n "to be filled by .git log" docs/plans/feature/m1-3d-drafting-polish-remediation-4.md
  Expected: 0 matches (placeholder removed)

Gate REM5-9: Targeted test files pass
  Command: pnpm --filter @portplanner/editor-2d test -- tests/draw-tools tests/keyboard-router tests/DynamicInputPill
  Expected: passes; H1 + H2 + H3 unit tests + migrated existing tests all green.

Gate REM5-10: Workspace test suite passes
  Command: pnpm test
  Expected: all 6 packages pass; total ≥ 470 (post-Round-4 baseline 464 + ~8 net-new; threshold conservative).

Gate REM5-11: Cross-cutting hard gates clean (DTP-T1/T2/T6/T7)
  Same commands as M1.3d §9. Expected: 0 offenders each.

Gate REM5-12: Typecheck + Biome + build
  Commands: pnpm typecheck, pnpm check, pnpm build
  Expected: all exit 0

Gate REM5-SPEC: docs/operator-shortcuts.md updated for H1 + H2
  Commands:
    (a) rg -n "^\*\*Version:\*\* 1\.2\.1" docs/operator-shortcuts.md
        Expected: 1 match (header version bumped to 1.2.1)
    (b) rg -n "^\| 1\.2\.1 " docs/operator-shortcuts.md
        Expected: 1 match (changelog row for 1.2.1 present)
    (c) rg -n "750 ms silent stale-clear" docs/operator-shortcuts.md
        Expected: 0 matches (the old behavior text is GONE)
    (d) rg -n "indefinitely|persists indefinitely" docs/operator-shortcuts.md
        Expected: ≥1 match (the new behavior text is present)
```

## 8. Done Criteria — objective pass/fail

- [ ] **H1** — Rectangle Dimensions sub-flow: type `D`, type `30,40`, Enter → rectangle commits with W=30, H=40 from corner1. Verified by Gate REM5-H1a + H1b + H1c + REM5-9 (draw-tools test `'rectangle Dimensions sub-flow: numberPair input commits W,H'` + the migrated `'Dimensions flow'` + the contract-lock test `'rectangle Dimensions: subOption D yields ONE prompt accepting numberPair'`).
- [ ] **H2** — Letter accumulator persists indefinitely; no idle timeout. Verified by Gate REM5-H2a + REM5-9 (keyboard-router test `'accumulator persists across long idle periods (no timeout in AC mode)'`).
- [ ] **H3** — Dynamic Input pill anchors below cursor (`dy: +28`); no overlap with bottom command line. Verified by Gate REM5-H3 + REM5-9 (DynamicInputPill test).
- [ ] **H4** — Round-4 plan execution-commit placeholder filled with `2d8a468`. Verified by Gate REM5-H4.
- [ ] **Binding spec doc updated (H1 + H2)** — `docs/operator-shortcuts.md` bumped 1.2.0 → 1.2.1 with timeout-removal note + comma-pair input form. Verified by Gate REM5-SPEC (a + b + c + d).
- [ ] All Phase REM5-H1a..REM5-SPEC + REM5-9..REM5-12 gates pass.
- [ ] Cross-cutting hard gates DTP-T1 / T2 / T6 / T7 pass (parent §9). Verified by Gate REM5-11.
- [ ] **Workspace test count** ≥ 470 (post-Round-4 baseline 464 + ≥6 net-new). REM5-10 provides the threshold.
- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build` all pass (Gate REM5-12).

## 9. Risks and Mitigations

(Single canonical risk register per Round-1 Rev-4 lesson on §8/§11 duplication.)

| Risk | Mitigation |
|------|-----------|
| **H1 — `'numberPair'` adds a discriminated-union arm; switch statements may become non-exhaustive.** | TypeScript exhaustiveness check catches at compile time. The only NEW consumer this round is draw-rectangle's Dimensions branch, which adds a guard `if (dims.kind !== 'numberPair') return aborted`. Existing tools that switch on `Input.kind` already have catch-all branches (e.g., `if (next.kind !== 'point') return aborted`) so they remain safe. Verified by `pnpm typecheck` (Gate REM5-12). |
| **H1 edge cases in comma-pair parsing.** Inputs like `30,`, `,40`, `30,40,50`, `abc,40`, `30 40` (space instead of comma) — what happens? | Parser guards are explicit: `parts.length === 2 && parts[1].length > 0 && Number.isFinite(a) && Number.isFinite(b)`. All rejected forms fall through to the existing F1/number/commit logic. The tool then either consumes (F1 dest as 'point' if directDistanceFrom is set) or aborts (number not accepted, no anchor). For the rectangle Dimensions prompt specifically, `acceptedInputKinds: ['numberPair']` only — fall-through to 'number' is rejected by the tool (`dims.kind !== 'numberPair'` → abort). User retries. Documented in §3 A2. |
| **H1 user types `30,40` at a NON-numberPair prompt** (e.g. line's second prompt, which accepts `'point'` with directDistanceFrom). | Parser branch is gated on `cb.acceptedInputKinds.includes('numberPair')`. False at line's prompt → branch skipped → existing logic: F1 directDistanceFrom is set, but `Number("30,40") === NaN` → fall through → commit input fed → tool aborts. Same behavior as Round-4 (no regression). |
| **H2 removing the timeout could leave accumulator non-empty if user types `L`, walks away, comes back hours later, types `R` — accumulator becomes `LR` → no shortcut → Enter does nothing.** | Same as AC behavior. The pill (G2) makes the accumulator visible at all times the user looks at the cursor. Esc clears. Acceptable per A1. The 750 ms safety net was overcautious. |
| **H2 timer-cleanup paths in `cleanup()` referenced an `accumulatorTimer` — removing the variable might leave stale references.** | Step 4 explicitly enumerates the four cleanup sites + the variable declaration. TypeScript catches any leftover `accumulatorTimer` reference at compile time (Gate REM5-12). |
| **H3 pill below cursor may overlap drawn geometry (e.g. when drawing a rectangle, the pill at `+28` could obscure the in-progress rectangle's bottom edge).** | `pointer-events: none` on the pill (existing). Visual overlap with geometry is acceptable per AC parity — AC's DI pills DO sit near drawn geometry. The user can move the cursor; the pill follows. The AC-style redesign (Round-6) integrates pills with transient dimension lines so they sit ALONGSIDE geometry, not atop. |
| **H4 placeholder fill is editing the Round-4 plan.** Round-4 plan is in the past tense (its execution is done); editing it from Round-5's commit changes a "frozen" doc. | Procedure 05 §5.6 explicitly allows updating prior plans during remediation: "the plan file MUST always reflect the true final state of the implementation." The Round-4 plan's post-execution-notes section is the natural home for the fill. Single-line edit; no semantic change. |
| **Test count drift.** Estimate is +6-8 net-new; could go higher with edge-case tests. | §10 C2.8 uses a conservative threshold (≥470 = baseline 464 + 6). Over-shoot is fine; under-shoot would fail the gate (and indicate missing tests — desired signal). |

## 10. §1.3 Three-round self-audit

Per parent plans' §1 lesson (real adversarial pass, not a tabulated stand-in).

### Round 1 — Chief Architect (boundaries, invariants, SSOT)

- **C1.1 — `'numberPair'` Input kind: where does it belong in the type hierarchy?** It's a value-input kind (like `'number'`, `'angle'`, `'distance'`), not a structural-input kind (like `'point'`, `'entity'`). Placement in the existing `Input` union is correct. SSOT preserved (one type definition; consumers switch on `kind`).
- **C1.2 — Why not generalize to `'numberTuple'` with arbitrary arity?** YAGNI — `numberPair` covers M1.3d's only paired-input use case (rectangle W,H). M1.3c's POLAR override might use 2 numbers (angle increment + count); M2 RTG_BLOCK might use origin + orientation (2 numbers). All fit `numberPair`. If a 3-number arity (X,Y,Z) emerges, introduce `numberTriple` as a SEPARATE arm rather than parameterizing — keeps the discriminated union flat and exhaustively-checkable.
- **C1.3 — Comma-pair parser placement: EditorRoot vs runner vs tool?** EditorRoot. The runner is a pure tool-driver that shouldn't know about command-bar input parsing. The tool generators consume typed Inputs, not raw strings. EditorRoot already orchestrates `handleCommandSubmit` (the F1 numeric→point transform); adding the comma-pair branch alongside is the natural location. Keeps the runner + tools simple.
- **C1.4 — H2 timeout removal: any other consumer of the timer state?** Audit: `accumulatorTimer` is local to `registerKeyboardRouter`'s closure. No external readers (the store mirror via `setAccumulator` is one-way, set by the router on every pump). Removing the timer + its cleanup is purely internal.
- **C1.5 — H3 pill offset constants: should they be design tokens?** Currently inline in `DynamicInputPill.tsx` as module-level constants. Could be hoisted to `docs/design-tokens.md` (`canvas.dynamicInput.offset_x` / `offset_y`). YAGNI — single consumer, no design-system value, no theme variants. Constants stay in the component.

### Round 2 — Sceptical Reader (what would Codex flag?)

- **C2.1 — H1 edge: user types `"30,"` (trailing comma).** parts = `['30', '']`, parts[1].length === 0 → branch skipped → fall through → `Number("30,")` is `NaN` → return. Tool abort? Actually the prompt is `acceptedInputKinds: ['numberPair']` so the tool's guard `dims.kind !== 'numberPair'` triggers abort. User sees prompt remain (no commit, no advance). Acceptable; AC behavior is similar.
- **C2.2 — H1 edge: user types `","` (just comma).** parts = `['', '']`, parts[1].length === 0 → branch skipped → fall through → `Number(",")` is NaN → return. Same fall-through as above. Acceptable.
- **C2.3 — H1 — does the parser need to strip whitespace?** User types `"30, 40"` (with space). parts = `['30', ' 40']`, both non-empty. `Number(' 40')` is `40` (Number coerces ignoring leading whitespace). Works. `"30 ,40"` → `['30 ', '40']`. `Number('30 ')` is `30`. Works. Whitespace tolerance is a JS-coercion freebie.
- **C2.4 — H1 — what if the prompt accepts BOTH `'numberPair'` AND `'number'`?** Branch order: comma-pair check first (only fires if `includes('numberPair')` AND raw has comma). If raw lacks comma → falls through to `'number'` check → fed as `{kind:'number'}`. So a prompt accepting both gets the typed kind based on input format. Useful for hypothetical future tools (e.g., circle accepting either radius (`'number'`) or center,radius (`'numberPair'`)). No regression.
- **C2.5 — H2 — does removing the timer affect any test that relies on idle behavior?** Round-4 added `'750 ms idle clears accumulator silently (no activation)'`. Step 7 explicitly migrates this. Other tests don't depend on idle timing.
- **C2.6 — H3 — pill placement when canvas is small (e.g. mobile / narrow viewport).** Pill is inside the canvas-area div with absolute positioning. If `cursor.screen.y + 28` exceeds the canvas-area height, the pill clips at the bottom edge (overflow:hidden on canvas-area? Let me verify — yes, `overflow: 'hidden'`). User would see a clipped pill. Edge case — the AC-style redesign (Round-6) handles this properly. For Round-5, predictable below-cursor placement is preferred; document the limitation.
- **C2.7 — H4 — what if Codex Round-2 flags self-referential hash again?** The Round-4 plan's "self-referential placeholder" rule (from Rem-1 Rev-5) was about the SAME commit that introduces the placeholder also writing its own hash. Here, Round-4's plan was committed at `7d39d12` (Rev-0) / `8cb34cc` (Rev-1) / `2d8a468` (execution); the post-execution-notes lived in commit `2d8a468`. Filling the placeholder in a SEPARATE commit (Round-5's execution) — non-self-referential. Compromise honored.

### Round 3 — Blast Radius (what could break elsewhere?)

- **C3.1 — Existing draw-tools tests for rectangle.** The two F3 Dimensions tests use the two-prompt flow. Step 6 migrates them to `'numberPair'`. Other rectangle tests (the basic two-corner flow, F2 Shift-square) don't touch the Dimensions sub-option — unchanged.
- **C3.2 — Tool runner's prompt-publishing logic.** The runner forwards `prompt.acceptedInputKinds` as-is to `setPrompt`. Adding `'numberPair'` to the union doesn't change the runner. Tools that don't use the new kind are unaffected.
- **C3.3 — `commandBar.acceptedInputKinds` consumers.** Other readers: Phase 3 snap-on-cursor effect gates on `acceptedInputKinds.includes('point')`. `'numberPair'` doesn't satisfy this; snap correctly stays off during Dimensions sub-flow. Pill (G2) reads `activePrompt` via priority chain; `acceptedInputKinds` isn't directly read by pill — no regression.
- **C3.4 — Bundle size:** ~80-120 LOC + small spec doc updates. Estimated +1 kB raw / negligible gz. Bundle was 446.75 kB raw / 128.90 kB gz at Rem-4 baseline. Estimate: ~447-448 kB raw. Well under budget.
- **C3.5 — Smoke-e2e existing scenarios.** No letter-activation pattern changes (Round-4 already migrated those). The H2 timer removal makes the `wait(20)` in the migrated smoke scenarios redundant but harmless. No test breakage.
- **C3.6 — Deferred AC-style redesign downstream.** Round-6 will need:
  - Per-tool DI structure declaration (e.g., line: 1 length-pill + 1 angle-pill; rectangle: W-pill + H-pill)
  - Tab focus cycling
  - Per-input-field anchor (transient-label-adjacent)
  
  Round-5 doesn't paint Round-6 into a corner — the current `inputBuffer` SSOT can extend to per-field-buffer (e.g. `inputBuffers: Record<DIFieldId, string>`) when needed, and the pill component can become per-field. None of Round-5's changes (timer removal, pill offset, comma-pair) conflict. ✓

## 11. Test strategy

**Tests existing before:** baseline at commit `2d8a468` is 464 / 464 across 6 packages.

**Tests added by this remediation (~6-8 net-new):**

- **H1 numberPair Input kind (~3 tests):**
  - `tests/draw-tools.test.ts`: `'rectangle Dimensions sub-flow: numberPair input commits W,H'` — feed `{kind:'numberPair', a:8, b:4}` after the D sub-option, assert rectangle commits with width=8 height=4.
  - `tests/draw-tools.test.ts`: `'rectangle Dimensions: subOption D yields ONE prompt accepting numberPair (not two)'` — drive the generator directly, assert exactly one yield with `acceptedInputKinds: ['numberPair']`.
  - (Migrated, not new) `'Dimensions flow: typed W/H commit a rectangle of those dimensions from corner1'` — body changed but test name + count unchanged.
  - (Migrated, not new) `'Dimensions abort path'` — semantically valid post-migration; counts the same.

- **H1 EditorRoot comma-pair parser (~2 tests):** could add to draw-tools or a new EditorRoot.test.tsx file. If draw-tools: drive via runner with raw inputs. If new file: pure handleCommandSubmit unit tests. Decision at execution time. At minimum:
  - `'handleCommandSubmit: "30,40" with acceptedInputKinds=numberPair feeds {kind:numberPair, a:30, b:40}'`
  - `'handleCommandSubmit: "30,40" with acceptedInputKinds=number falls through to number'`

- **H2 indefinite-wait (~1 test):**
  - `tests/keyboard-router.test.ts`: `'accumulator persists across long idle periods (no timeout in AC mode)'` (replaces `'750 ms idle clears...'`).

- **H3 pill offset (~1 test):**
  - `tests/DynamicInputPill.test.tsx`: `'pill anchors at cursor.screen + offset (16, +28) — below cursor'` (replaces the existing `(16, -24)` test).

**Migrated existing tests (~3 sites):**
- `'Dimensions flow'` body
- `'Dimensions abort path'` body (semantic-only; assertions unchanged)
- `'750 ms idle clears...'` → `'accumulator persists...'`
- `'pill anchors at cursor.screen + offset (16, -24)'` → `'(16, +28)'`

**Smoke E2E:** no new scenarios; H1 / H2 / H3 are unit-testable in isolation. Round-3 F3 didn't have a smoke either; consistent.

**Tests intentionally not added:**
- Visual regression for the pill position — out of scope (no image-diff infra).
- Round-6 AC-style transient-label tests — separate plan.

## 12. Why this is one phase, not many

- H1 (numberPair) + H2 (timeout) + H3 (pill offset) + H4 (placeholder) are independent surface changes. No cross-dependencies.
- H4 is a one-line edit to the Round-4 plan; trivial and bundled.
- Total LOC: ~80-120 production + ~30-50 tests + ~3 spec/doc updates.
- Single phase keeps the Procedure-03 audit cycle tight (one phase audit + one self-review loop).

---

## Plan Review Handoff

**Architecture authority note (Round-4 Rev-1 Q3 footnote, preserved):** there is no root-level `architecture.md` in this repository. The architecture authority is split across `docs/procedures/Codex/00-architecture-contract.md` (Codex's binding contract) + `docs/procedures/Claude/00-architecture-contract.md` (Claude's mirror) + the ADR set under `docs/adr/` (specifically ADR-023 "Tool state machine and command bar" for this round's surface).

**Plan:** `docs/plans/feature/m1-3d-drafting-polish-remediation-5.md`
**Branch:** `feature/m1-3d-drafting-polish` (atop `2d8a468`)
**Status:** Plan authored — awaiting Codex Round-1 review

### Paste to Codex for plan review
> Review this plan using `docs/procedures/Codex/02-plan-review.md`
> (Procedure 02). Apply strict evidence mode. Start from Round 1.
>
> Context: this is the FIFTH remediation pass on `feature/m1-3d-drafting-polish`,
> covering three behavior fixes + one doc polish from manual user testing of
> M1.3d-Rem-4 at `2d8a468`:
> - **H1 (BUG)**: G3 comma-pair input via new `'numberPair'` Input kind —
>   replaces rectangle's two-prompt W/H sub-flow with one `Specify
>   dimensions <width,height>` prompt. Round-4 had deferred this; user's
>   manual test (`30,40` muscle-memory) hit the gap.
> - **H2 (BEHAVIOR)**: Remove the 750 ms idle accumulator timeout; AC has
>   no such timer. User: "if i type L it should wait for me indefinitely."
> - **H3 (POLISH)**: Flip pill below cursor (`dy: -24 → +28`) so it stops
>   overlapping the bottom command line.
> - **H4 (DOC)**: Fill the Round-4 plan's execution-commit placeholder
>   with `2d8a468` (Codex Round-1 quality cleanup).
>
> AC-style transient-label-integrated DI pills + Tab cycling explicitly
> deferred to Round-6 / post-M1 with its own plan + ADR — needs the
> chrome/canvas-overlay boundary to be re-thought, which deserves a
> dedicated round.
>
> Round 1 (R1/R2a/R2b/R4) at `2c13b49`. Round 2 (R5/R6/R7) at `98e0915`.
> Round 3 (F1-F7 + spec governance) at `63380bb`. Round 4 (G1+G2) at
> `2d8a468`. Round 5 starts here.

### Paste to user for approval
> Please review the plan at
> `docs/plans/feature/m1-3d-drafting-polish-remediation-5.md`. After
> approval, invoke Procedure 03 to execute the single phase.
