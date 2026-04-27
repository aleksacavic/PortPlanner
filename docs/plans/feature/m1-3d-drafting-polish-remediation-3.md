# Plan — M1.3d Drafting UX Polish (Remediation Round 3)

**Branch:** `feature/m1-3d-drafting-polish`
**Parent plans:** `docs/plans/feature/m1-3d-drafting-polish.md` (M1.3d) + `docs/plans/feature/m1-3d-drafting-polish-remediation.md` (Round 1) + `docs/plans/feature/m1-3d-drafting-polish-remediation-2.md` (Round 2)
**Parent commit baseline:** Round 2 latest = `98e0915` (Procedure-05 wire-intersect bug fix on Codex post-commit Round-1 Go)
**Author:** Claude (Opus 4.7, 1M context)
**Date:** 2026-04-27
**Operating mode:** Procedure 01 (PLAN-ONLY) → Procedure 03 (EXECUTION) after Codex review
**Status:** Plan Revision-1 — Codex Round-1 fixes (1 Blocker + 2 High-risk; all agreed)

---

## Revision history

| Rev | Date | Driver | Changes |
|-----|------|--------|---------|
| Rev-1 | 2026-04-27 | Codex Round-1 (No-Go on 1 Blocker + 2 High-risk; all agreed) | **B1** (Blocker) — `docs/operator-shortcuts.md` declared in §5 spec impact for F6 but missing from §4.1 files-modified table AND no completion gate verified the version bump or new row. Fix: added the file to §4.1; added **Gate REM3-SPEC** with two commands (a) version-grep `1\.0\.2`, (b) row-grep `repeat-last-command`. **H1** (High-risk) — F2 shift lifecycle: §10 C2.2 + §11 test strategy both required a `window.blur` clear, but §7 step 8 only mentioned keydown/keyup AND no gate enforced it. Fix: §7 step 8 now explicitly mandates the `blur` listener calling `setShift(false)` with cleanup on unregister; added **Gate REM3-F2b** (`rg -n "blur" router.ts ≥1`). **H2** (High-risk) — A11 declared `TOOL_DISPLAY_NAMES: Record<ToolId, string>` while same paragraph + §4.1 row require `null` entries for internal tools. Fix: A11 type normalized to `Record<ToolId, string \| null>` (matches §4.1 row, which was already correct). §8 Done Criteria updated to cite the new gates (F2 row → REM3-F2b; F6 row → REM3-SPEC; new "spec doc updated" checkbox). §10 gains a Revision-1 audit subsection per §1.16 step 13. **Procedural lesson refined:** every binding-spec doc declared in §5 MUST also appear in §4.1's files-modified table AND be paired with a dedicated completion gate (version-grep + semantic row-grep). Same shape of gap as Rem-2 Rev-2 H2 (label_padding ownership), this time on a doc rather than a code path. |
| Rev-0 | 2026-04-27 | Initial draft | All seven items (F1-F7) scoped + §1.3 three-round audit. Plan committed at `813614e`. |

## 1. Request summary

Seven items from user-side testing of M1.3d at `98e0915`. Six are pure
implementation-side polish + one is a bug fix (F5). No ADR change.
**One binding-spec doc update**: `docs/operator-shortcuts.md` bumps from
1.0.1 → 1.0.2 to register F6's new `Space` → repeat-last-command
shortcut (added in Rev-1 per Codex Round-1 Blocker — see §5 + §4.1).

- **F1 — Direct distance entry while drawing.** When a draw tool is awaiting
  a `'point'` input, typing a number in the command bar should be interpreted
  as a distance along the cursor direction from a tool-defined anchor. Line:
  type `5` + Enter from p1 → p2 lands 5 m along cursor heading. Polyline:
  same from last vertex. Circle: typed value = radius. Arc: typed value =
  distance along the next leg. AutoCAD direct-distance entry verbatim.
- **F2 — Shift constraint forces rectangle to square.** While drawing a
  rectangle's second corner, holding Shift snaps the preview to a 1:1
  aspect ratio (square) and the commit creates a square.
- **F3 — Type `D` for rectangle Dimensions sub-option.** At rectangle's
  second prompt, brackets show `[Dimensions]`. Typing `D` (or clicking the
  bracket) prompts for `Width:` then `Height:` numerically. Same sub-option
  pattern as polyline's `[Close/Undo]`.
- **F4 — Move/copy preview ghost.** Today after picking the base point,
  the entity disappears until the destination is committed — user is
  blind. AutoCAD shows a translucent "ghost" of the affected entities
  following the cursor. Adds the `'modified-entities'` `PreviewShape`
  arm pre-declared in M1.3d Phase 4 step 2 / parent plan §12 risks C10.
- **F5 — BUG FIX: grip click during running tool feeds grip position as
  point input (don't abort).** Currently `handleGripDown` aborts the running
  tool unconditionally and starts grip-stretch. AutoCAD parity: when a
  tool is running and awaiting a `'point'`, clicking on a grip uses the
  grip's exact position as the input — grip serves as a snap target.
  Grip-stretch only starts when no tool is active. ~5-LOC fix in EditorRoot.
- **F6 — Spacebar at canvas focus repeats the last command.** AutoCAD
  muscle-memory: Spacebar / Enter at canvas focus, when no tool is
  running, re-invokes the most recently used tool. When a tool IS
  running, both keys keep their existing "commit" semantic
  (`onCommitCurrentTool`). Branch on `activeToolId` in the keyboard
  router.
- **F7 — Command-bar badge with current command name.** When a tool is
  active, render a colored badge ("LINE", "CIRCLE", "RECTANGLE", etc.)
  on the left of the command bar, before the prompt text. Visual anchor
  for "I'm in command X" — also reinforces F5's behavior (when MOVE
  badge is showing, the user knows grip clicks feed points). Badge color
  uses `accent.primary` (blue, matches selection-window.stroke and the
  R6 label pill — consistent in-flight-action vocabulary).

## 2. Out of scope

This round bundles the 7 items above. Not deferring anything; the user
asked for one consolidated plan.

## 3. Assumptions and scope clarifications

User-confirmed in chat 2026-04-27:

- **A1 — All seven fixes ship in one commit on `feature/m1-3d-drafting-polish`,
  not a new branch.** Branch is still pre-merge to main; landing this as
  one more commit before tag `m1.3d` keeps the M1.3d shipped unit cohesive.
  Per user: "one go".
- **A2 — F1 cursor source.** Direct distance computation needs a cursor
  position even when the user's pointer is over the command bar (where
  `overlay.cursor` is null). Solution: introduce `overlay.lastKnownCursor:
  Point2D | null` that captures the last non-null `overlay.cursor.metric`
  and never clears once set. EditorRoot's existing hover effect updates
  both. F1 distance routing reads `lastKnownCursor`. paintCrosshair stays
  bound to `overlay.cursor` (only paint when cursor is live on canvas).
- **A3 — F1 anchor source.** Tools opt into direct-distance entry by
  yielding `Prompt.directDistanceFrom: Point2D` (the previous point in
  the tool flow — line p1, polyline last vertex, circle center, etc.).
  Runner publishes it to `commandBar.directDistanceFrom`. EditorRoot's
  `handleCommandSubmit`, on numeric input AND `directDistanceFrom !== null`
  AND `lastKnownCursor !== null`, computes `dest = anchor + unit(cursor -
  anchor) * distance` and feeds `{ kind: 'point', point: dest }`.
  Otherwise feeds `{ kind: 'number', value }` (existing fallback).
- **A4 — F2 modifier slice scope.** New `editorUiStore.modifiers: { shift:
  boolean }` (just shift for now; alt / ctrl can extend later). Keyboard
  router listens on keydown / keyup for Shift and updates the slice.
  Rectangle's previewBuilder + commit logic read it. No other tool reads
  it in this round.
- **A5 — F3 sub-option dispatch.** Reuses the existing `subOptions` /
  `'subOption'` `Input` kind from M1.3a. draw-rectangle's second prompt
  declares `[{ label: 'Dimensions', shortcut: 'd' }]`. On
  `'subOption'` input with `optionLabel === 'Dimensions'`, the tool
  yields two more prompts ("Width:" / "Height:") with
  `acceptedInputKinds: ['number']`. The numeric inputs are NOT
  direct-distance entries — they're absolute scalar values.
- **A6 — F4 PreviewShape arm.** New `{ kind: 'modified-entities';
  primitives: Primitive[]; offsetMetric: Point2D }` arm added to
  `PreviewShape` (the union in `tools/types.ts`). paintPreview.ts
  dispatches the new arm to a new helper `drawModifiedEntitiesPreview`
  that strokes each primitive's outline at the offset using transient
  styling (`canvas.transient.preview_stroke` + `preview_dash`). No fill;
  no labels. M1.3b modify-operators (rotate / scale / mirror) extend
  this arm with their own per-operator transformations later.
- **A7 — F4 scope.** Wired ONLY for move + copy in this round. Other
  M1.3b operators (rotate / scale / mirror) wire the arm when M1.3b ships.
- **A8 — F5 fix shape.** `handleGripDown` becomes a 2-branch dispatch:
  if `runningToolRef.current === null`, start grip-stretch (existing
  behavior); else feed `{ kind: 'point', point: grip.position }` to the
  running tool and DO NOT start grip-stretch. Bit-copy semantics (no
  snap re-resolution needed — grip.position IS the canonical point).
- **A9 — F6 last-tool tracking.** `editorUiStore.commandBar.lastToolId:
  string | null` tracks the most recently completed (or aborted) tool.
  Updated when `setActiveToolId(null)` fires after a non-null prior id.
  Special tools EXCLUDED from "last" tracking: `select-rect`,
  `grip-stretch`, `escape` — these are modeless / system, never user-
  invoked via shortcut, and would surprise users to repeat. Existing
  `select-rect` and `grip-stretch` are auto-started by canvas-host.
- **A10 — F6 spacebar in keyboard router.** Same handler shape as Enter:
  on `key === ' ' && focus === 'canvas'`, branch on activeToolId. If
  null AND `lastToolId !== null` → `onActivateTool(lastToolId)`. If
  non-null → `onCommitCurrentTool` (same as Enter). Spacebar in `bar`
  focus types a literal space character — keyboard router does NOT
  intercept (existing per-focus letter routing pattern).
- **A11 — F7 toolId-to-display-name map.** New constant `TOOL_DISPLAY_NAMES:
  Record<ToolId, string | null>` in `keyboard/shortcuts.ts` (alongside the
  existing ToolId union and shortcut maps — single SSOT for tool
  metadata). Examples: `'draw-line' → 'LINE'`, `'draw-circle' → 'CIRCLE'`,
  `'move' → 'MOVE'`, `'copy' → 'COPY'`. Internal tools
  (`'select-rect'`, `'grip-stretch'`, `'escape'`) map to `null` and don't
  render a badge. (Rev-1 H2: type widened to `string | null` to match the
  null entries; §4.1 row was already correct on this point.)
- **A12 — F7 badge styling.** Chrome element, NOT a canvas overlay —
  uses design-system semantic tokens via CSS vars: `var(--accent-primary)`
  background, `var(--surface-base)` or pure white text. Lives in
  `CommandBar.module.css`. Renders when `activeToolId` is a tool with
  a display name; hides otherwise.

## 4. Scope

### 4.1 In scope — files modified

| Path | Change |
|---|---|
| `packages/editor-2d/src/tools/types.ts` | (F1) Extend `Prompt` with optional `directDistanceFrom?: Point2D`. (F4) Add new `'modified-entities'` arm to `PreviewShape` discriminated union: `\| { kind: 'modified-entities'; primitives: Primitive[]; offsetMetric: Point2D }`. |
| `packages/editor-2d/src/ui-state/store.ts` | (F1) Add `commandBar.directDistanceFrom: Point2D \| null` (default null). Extend `setPrompt` action to accept it; update `editorUiActions.setPrompt` signature additively. (F1) Add `overlay.lastKnownCursor: Point2D \| null` (default null). New action `setLastKnownCursor`. (F2) Add `modifiers: { shift: boolean }` slice with `setShift` action. (F6) Add `commandBar.lastToolId: string \| null` (default null). New action `setLastToolId`. |
| `packages/editor-2d/src/tools/runner.ts` | (F1) Pass `prompt.directDistanceFrom` to `setPrompt` (additive). (F6) When `setActiveToolId(null)` fires AND the prior id was a user-invoked tool (not in EXCLUDED-FROM-LAST set), capture the prior id as `lastToolId`. |
| `packages/editor-2d/src/tools/draw/draw-line.ts` | (F1) Yield `directDistanceFrom: start.point` on the second prompt. |
| `packages/editor-2d/src/tools/draw/draw-polyline.ts` | (F1) Yield `directDistanceFrom: <last vertex in chain>` on each loop prompt. |
| `packages/editor-2d/src/tools/draw/draw-circle.ts` | (F1) Yield `directDistanceFrom: ctr` on the second (radius) prompt. |
| `packages/editor-2d/src/tools/draw/draw-arc.ts` | (F1) Yield `directDistanceFrom: p1` on the second (mid) prompt and `directDistanceFrom: p2` on the third (end) prompt. |
| `packages/editor-2d/src/tools/draw/draw-rectangle.ts` | (F2) On second prompt, read `editorUiStore.getState().modifiers.shift`; if held AND input is a 'point' click, snap to square (max(\|dx\|, \|dy\|)). previewBuilder reads modifiers + computes square preview. (F3) Add `subOptions: [{ label: 'Dimensions', shortcut: 'd' }]` to second prompt. On `'subOption'` Input with `optionLabel === 'Dimensions'`, yield "Specify width:" then "Specify height:" prompts with `acceptedInputKinds: ['number']`, then create rectangle from corner1 + W/H. |
| `packages/editor-2d/src/tools/move.ts` | (F4) Yield `previewBuilder` on the second prompt that produces `{ kind: 'modified-entities', primitives: <selectedPrimitives>, offsetMetric: cursor - basePoint }`. |
| `packages/editor-2d/src/tools/copy.ts` | (F4) Same as move — yield previewBuilder for the modified-entities arm. |
| `packages/editor-2d/src/canvas/painters/paintPreview.ts` | (F4) Add `drawModifiedEntitiesPreview` helper. Dispatch the new arm in the main `switch`. Helper iterates `shape.primitives`, applies `offsetMetric` translation, calls `strokeEntityOutline` with transient styling. |
| `packages/editor-2d/src/EditorRoot.tsx` | (F1) `handleCommandSubmit` reads `commandBar.directDistanceFrom` + `overlay.lastKnownCursor`; on numeric input with both set, computes destination and feeds 'point' (not 'number'). (F1) `handleCanvasHover` updates `overlay.lastKnownCursor` alongside `overlay.cursor`. (F5 BUG FIX) `handleGripDown` 2-branch dispatch: if `runningToolRef.current === null` start grip-stretch (existing); else feed `{ kind: 'point', point: grip.position }` to the running tool and return. (F6) Add `onRepeatLastCommand` callback to keyboard router callbacks: reads `editorUiStore.getState().commandBar.lastToolId` and re-invokes `onActivateTool(lastToolId)` if non-null. |
| `packages/editor-2d/src/keyboard/router.ts` | (F6) Add Spacebar handling: on `key === ' '` AND focus === 'canvas', preventDefault + branch on activeToolId. Active tool → existing `onCommitCurrentTool`; no tool + `lastToolId` non-null → new `onRepeatLastCommand` callback. (F2) Add Shift keydown / keyup listeners that update `editorUiStore.modifiers.shift` via `editorUiActions.setShift`. |
| `packages/editor-2d/src/keyboard/shortcuts.ts` | (F7) Add `TOOL_DISPLAY_NAMES: Record<ToolId, string \| null>` constant mapping each ToolId to its badge label. Internal tools (`'select-rect'`, `'grip-stretch'`, `'escape'`) map to `null` (no badge). |
| `packages/editor-2d/src/chrome/CommandBar.tsx` | (F7) Read `editorUiStore.activeToolId`, look up `TOOL_DISPLAY_NAMES[activeToolId]`. If non-null, render `<span className={styles.toolBadge}>{name}</span>` to the left of the existing prompt text. |
| `packages/editor-2d/src/chrome/CommandBar.module.css` | (F7) Add `.toolBadge` style: `var(--accent-primary)` background, white text, padding 2px 8px, border-radius 999px (pill), font-size 11px, weight 600, letter-spacing 0.05em. Sit inline with prompt text. |
| `packages/editor-2d/tests/draw-tools.test.ts` | (F1) Extend per-tool tests to assert `directDistanceFrom` is yielded on the right prompt. |
| `packages/editor-2d/tests/ui-state.test.ts` | (F1, F2, F6) Test new slice fields: `directDistanceFrom`, `lastKnownCursor`, `modifiers.shift`, `lastToolId` defaults + setters. |
| `packages/editor-2d/tests/runner.test.ts` (or `tool-runner.test.ts`) | (F6) Test `lastToolId` update on tool completion (excluded tools NOT tracked). |
| `packages/editor-2d/tests/keyboard-router.test.ts` | (F6) Spacebar at canvas + no tool + lastToolId set → `onRepeatLastCommand`. Spacebar + active tool → `onCommitCurrentTool`. Spacebar at bar focus → no callback (native input handles). (F2) Shift keydown/keyup updates `modifiers.shift`. |
| `packages/editor-2d/tests/CommandBar.test.tsx` | (F7) Badge renders when activeToolId has a display name; hides when null. |
| `packages/editor-2d/tests/paintPreview.test.ts` | (F4) New tests for `'modified-entities'` arm — paints each primitive at offset; uses transient stroke. |
| `packages/editor-2d/tests/draw-tools.test.ts` | (F2) Shift held during rectangle second click → square primitive committed. (F3) D sub-option flow → width/height prompts → rectangle committed with typed dimensions. |
| `packages/editor-2d/tests/grip-stretch.test.ts` | (F5) Smoke regression: grip click while move tool is running → tool receives 'point' input at grip.position; no grip-stretch tool started. (Tool-level integration verifying the runner sees the 'point' input.) |
| `packages/editor-2d/tests/smoke-e2e.test.tsx` | (SOLE integration validation surfaces) Add THREE new smoke scenarios: (a) `'direct distance entry'` — draw line, click p1, type `5` + Enter → line of length exactly 5 m along cursor heading. (b) `'grip click during running tool feeds point'` — F5 SOLE integration validation: activate move (or copy), click first base-point at grip, assert tool receives the grip's position; no grip-stretch starts. (c) `'spacebar repeats last command'` — activate L (line), commit, then press Space → draw-line activates again. |
| `docs/operator-shortcuts.md` | (F6 — Rev-1 B1: declared in §5 but originally missing here.) Bump version `1.0.1` → `1.0.2`; add changelog row `\| 1.0.2 \| 2026-04-27 \| Add `Space` → repeat-last-command (canvas focus only; commits in-flight tool when one is active). M1.3d Round-3 F6. \|`; add row to the M1.3a "Essential operators + draw tools" section: `\| `Space` \| repeat-last-command \| Canvas focus only; same handler shape as Enter — commits in-flight tool when active, else re-invokes last user-tool \|`. Implementation file `packages/editor-2d/src/keyboard/router.ts` MUST stay in sync per the registry's governance preamble. |

### 4.2 In scope — files created

None. All extensions to existing files.

### 4.3 Out of scope (deferred)

- M1.3b modify-operator integration (rotate / scale / mirror / etc.) for
  the `'modified-entities'` PreviewShape arm. F4 wires only move + copy
  in this round; M1.3b adds per-operator usage when it ships. Documented
  in §3 A7.
- F4 multi-entity move/copy preview ghost color differentiation by
  primitive kind. The `drawModifiedEntitiesPreview` helper paints all
  affected primitives uniformly with `canvas.transient.preview_stroke`.
  Per-kind highlighting could come later if the visual proves confusing.
- F2 / F1 modifier overlap: holding Shift to activate ortho during line
  drawing is M1.3a's existing F8 toggle; this round does NOT add
  Shift = transient ortho. Only Shift = square-rectangle is in scope.
- F1 direct-distance-entry for rectangle. Rectangle's two-corner contract
  doesn't cleanly map to a single distance value. F3 (D sub-option)
  handles rectangle's typed dimensions instead. Documented in §3 A3.
- F7 badge color variation per tool category (draw vs modify vs query).
  Single accent color for all in this round. Per-category color is a
  post-M1 design refinement.

### 4.4 Blast radius

- **Packages affected:** `editor-2d` only (tools, runner, painters,
  EditorRoot, keyboard router, ui-state, CommandBar chrome).
- **Cross-cutting hard gates affected:** none — DTP-T1/T2/T6/T7 stay clean.
- **Stored data:** none. UI-only state extensions.
- **UI surfaces affected:** command bar (badge + numeric routing), canvas
  during draw (direct-distance preview convergence), canvas during
  move/copy (ghost), canvas during grip-click-while-tool-running (no
  grip-stretch start).
- **ADRs:** none modified. ADR-023 tool state machine gains optional
  `Prompt.directDistanceFrom` (additive), `PreviewShape` gains an arm
  (additive). ADR-021 paint pipeline unchanged in shape.
- **I-DTP invariants:** none changed; F4 is the realization of the
  forward-compat hook noted in M1.3d Phase 4 step 2 (C10).

## 5. Architecture doc impact

| Doc | Change |
|---|---|
| `docs/operator-shortcuts.md` | F6 adds Spacebar = repeat-last-command. Bump 1.0.1 → 1.0.2; new row in M1.3a section: `Space` → `repeat-last-command` (canvas focus only; commits in-flight tool when one is active). Same handler shape as Enter; documenting both. |
| `docs/glossary.md` | Optional new term: "Direct distance entry" — typing a numeric distance in the command bar to specify a point along the cursor direction from a tool-defined anchor. AutoCAD-derived. Decide at execution time if it adds value. |
| All other binding spec docs | No change. |

## 6. Deviations from binding specifications (§0.7)

**None.** All changes extend existing systems within their declared
extension points (Prompt fields additive; PreviewShape arm additive;
modifier slice new but isolated; keyboard router callback additive).

## 7. Implementation steps (single phase)

The 7 items are independent enough that decomposition into multiple
Procedure-03 phases would be overhead. One phase covers all seven.

### Step-by-step

1. **F5 BUG FIX (highest priority — ship this even if other steps slip).**
   In `EditorRoot.tsx` `handleGripDown`:
   ```ts
   const handleGripDown = (grip: Grip): void => {
     const tool = runningToolRef.current;
     if (tool) {
       // Tool active — grip serves as a snap target. Feed grip.position
       // as the point input. AutoCAD parity: never abort a running tool
       // by clicking a grip.
       tool.feedInput({ kind: 'point', point: grip.position });
       return;
     }
     // No active tool — selection-mode grip-stretch (existing behavior).
     const factory = gripStretchTool(grip);
     const running = startTool('grip-stretch', factory);
     runningToolRef.current = running;
     running.done().finally(() => {
       if (runningToolRef.current === running) runningToolRef.current = null;
     });
   };
   ```
2. **F1 — slice extensions.** Add `directDistanceFrom` to `CommandBarState`,
   `lastKnownCursor` to `OverlayState`. Update `createInitialEditorUiState`
   defaults (both null). Add actions: `setLastKnownCursor`. Extend
   `setPrompt` signature to accept `directDistanceFrom`.
3. **F1 — runner publishes directDistanceFrom.** In `tools/runner.ts`,
   pass `prompt.directDistanceFrom ?? null` to `editorUiActions.setPrompt`
   (additive 5th arg).
4. **F1 — tools opt in.** Each draw tool (line, polyline, circle, arc)
   yields `directDistanceFrom: <anchor>` on the relevant prompt.
   draw-rectangle does NOT (per §4.3 — F3 handles its typed dimensions).
   draw-xline / draw-point: NOT in scope (xline's "specify a point on
   the line" doesn't have a meaningful distance anchor; point is
   single-click).
5. **F1 — EditorRoot handleCommandSubmit transform.** Read store state.
   When numeric input arrives:
   - If `commandBar.directDistanceFrom !== null` AND `overlay.lastKnownCursor
     !== null`:
     - Compute `dest = anchor + unit(cursor - anchor) * distance`
     - Feed `{ kind: 'point', point: dest }`
   - Else: feed `{ kind: 'number', value }` (existing behavior).
   Edge case: `cursor === anchor` (zero-length direction). Fall through
   to 'number' (no direction inferred) — tool will likely abort gracefully.
6. **F1 — handleCanvasHover updates lastKnownCursor.** In
   `EditorRoot.handleCanvasHover`, also call
   `editorUiActions.setLastKnownCursor(metric)`. Once set, never cleared
   (so it survives cursor leaving canvas → bar focus → typing distance).
7. **F2 — modifier slice.** Add `editorUiStore.modifiers: { shift: boolean }`
   slice + `setShift` action. Default `shift: false`.
8. **F2 — keyboard router shift listeners.** In `keyboard/router.ts`'s
   `registerKeyboardRouter`, add `keydown`/`keyup` handlers for
   `e.key === 'Shift'`: `editorUiActions.setShift(true / false)`.
   **Also add a `blur` listener on `window`** that calls
   `editorUiActions.setShift(false)` — handles the alt-tab-out-with-
   shift-held edge case where the keyup event fires outside our window
   and our slice would otherwise stay stuck at `shift: true` (per §10
   C2.2). All three listeners (keydown / keyup / blur) cleared on
   unregister via the existing teardown function.
9. **F2 — draw-rectangle reads shift.** previewBuilder + commit in
   `draw-rectangle.ts` read `editorUiStore.getState().modifiers.shift`.
   When shift held, side = `max(|dx|, |dy|)`; rectangle becomes square
   with that side. Both preview and commit consistent.
10. **F3 — draw-rectangle Dimensions sub-option.** Second prompt declares
    `subOptions: [{ label: 'Dimensions', shortcut: 'd' }]` and
    `acceptedInputKinds: ['point', 'subOption']`. On `'subOption'` Input
    with `optionLabel === 'Dimensions'`:
    - Yield `{ text: 'Specify width:', acceptedInputKinds: ['number'] }`
    - Receive `'number'` → width
    - Yield `{ text: 'Specify height:', acceptedInputKinds: ['number'] }`
    - Receive `'number'` → height
    - Create rectangle from corner1 + width + height (existing creation
      path with explicit dims).
11. **F4 — PreviewShape arm.** Extend `tools/types.ts` `PreviewShape` with
    `\| { kind: 'modified-entities'; primitives: Primitive[]; offsetMetric:
    Point2D }`.
12. **F4 — paintPreview helper.** New `drawModifiedEntitiesPreview` in
    `paintPreview.ts`. Iterates `shape.primitives`, translates each by
    `offsetMetric` into a temporary metric-shifted primitive (or
    transforms ctx then strokes), calls `strokeEntityOutline` with the
    existing transient stroke + dash. No labels.
13. **F4 — paintPreview dispatch.** Add the new arm to the main switch.
    paint.ts overlay-pass condition `if (overlay.previewShape && overlay.previewShape.kind
    !== 'selection-rect')` continues to route the new arm to paintPreview
    (only `'selection-rect'` is excluded; the new arm gets handled).
14. **F4 — move + copy yield previewBuilder.** Read selected primitives
    from project store at tool start. Second prompt yields
    `previewBuilder: (cursor) => ({ kind: 'modified-entities', primitives,
    offsetMetric: { x: cursor.x - basePoint.x, y: cursor.y - basePoint.y } })`.
15. **F6 — lastToolId tracking.** In `tools/runner.ts`'s `setActiveToolId`
    flow OR via a new editorUiActions-level subscription, capture
    transitions: when `setActiveToolId(null)` fires after a non-null id
    that was NOT in `EXCLUDED_FROM_LAST = ['select-rect', 'grip-stretch',
    'escape']`, call `setLastToolId(priorId)`.
16. **F6 — spacebar in keyboard router.** Add `key === ' ' && focus
    === 'canvas'` handler: `e.preventDefault()`. If `activeToolId !==
    null`, `callbacks.onCommitCurrentTool()`. Else, if `lastToolId
    !== null`, `callbacks.onRepeatLastCommand()`. Else, no-op.
17. **F6 — KeyboardRouterCallbacks + EditorRoot.** Add
    `onRepeatLastCommand: () => void` to the callback type. EditorRoot's
    handler reads `editorUiStore.getState().commandBar.lastToolId` and
    re-invokes its existing `onActivateTool(lastToolId)` flow.
18. **F7 — TOOL_DISPLAY_NAMES.** Add the constant in
    `keyboard/shortcuts.ts`. Internal tools null; user-invoked tools
    map to their badge label.
19. **F7 — CommandBar badge.** `CommandBar.tsx` reads `activeToolId`
    via `useEditorUi`. Looks up `TOOL_DISPLAY_NAMES[activeToolId]`.
    Renders the badge if non-null. CSS module addition for `.toolBadge`.
20. **Tests** — see §4.1's per-file test rows.

### Mandatory completion gates

```
Gate REM3-F1: Prompt.directDistanceFrom field declared
  Command: rg -n "directDistanceFrom" packages/editor-2d/src/tools/types.ts
  Expected: ≥1 match (Prompt interface field)

Gate REM3-F1b: Each opted-in draw tool yields directDistanceFrom
  Command: rg -n "directDistanceFrom" packages/editor-2d/src/tools/draw/draw-line.ts packages/editor-2d/src/tools/draw/draw-polyline.ts packages/editor-2d/src/tools/draw/draw-circle.ts packages/editor-2d/src/tools/draw/draw-arc.ts
  Expected: ≥4 matches (one per opted-in tool)

Gate REM3-F1c: EditorRoot.handleCommandSubmit transforms numeric → point
  Command: rg -A 20 -n "const handleCommandSubmit" packages/editor-2d/src/EditorRoot.tsx | rg "directDistanceFrom"
  Expected: ≥1 match (within ~20 lines of handleCommandSubmit declaration)

Gate REM3-F2: modifiers slice + shift listeners
  Command: rg -n "modifiers|setShift" packages/editor-2d/src/ui-state/store.ts packages/editor-2d/src/keyboard/router.ts
  Expected: ≥5 matches (slice declaration + setShift action + keydown listener + keyup listener + blur listener — Rev-1 H1 added blur)

Gate REM3-F2b: window.blur clears shift modifier (Rev-1 H1)
  Command: rg -n "blur" packages/editor-2d/src/keyboard/router.ts
  Expected: ≥1 match (blur listener registration; teardown via the listener variable counts toward the same site)

Gate REM3-F3: draw-rectangle Dimensions sub-option
  Command: rg -n "Dimensions" packages/editor-2d/src/tools/draw/draw-rectangle.ts
  Expected: ≥1 match (subOptions label)

Gate REM3-F4: PreviewShape modified-entities arm + paintPreview helper
  Commands:
    (a) rg -n "'modified-entities'" packages/editor-2d/src/tools/types.ts
        Expected: ≥1 match (union arm)
    (b) rg -n "drawModifiedEntitiesPreview|'modified-entities'" packages/editor-2d/src/canvas/painters/paintPreview.ts
        Expected: ≥2 matches (helper + dispatch case)
    (c) rg -n "previewBuilder" packages/editor-2d/src/tools/move.ts packages/editor-2d/src/tools/copy.ts
        Expected: ≥2 matches (one per tool — move + copy yield previewBuilder)

Gate REM3-F5: handleGripDown 2-branch dispatch
  Command: rg -A 10 -n "const handleGripDown" packages/editor-2d/src/EditorRoot.tsx | rg "feedInput"
  Expected: ≥1 match (the running-tool branch feeds 'point' input)

Gate REM3-F6: lastToolId + Spacebar + onRepeatLastCommand wired
  Commands:
    (a) rg -n "lastToolId|setLastToolId" packages/editor-2d/src/ui-state/store.ts
        Expected: ≥3 matches (slice field + default + setter)
    (b) rg -n "onRepeatLastCommand" packages/editor-2d/src/keyboard/router.ts packages/editor-2d/src/EditorRoot.tsx
        Expected: ≥3 matches (callback type + router handler + EditorRoot impl)
    (c) rg -n "key === ' '|key.*Space" packages/editor-2d/src/keyboard/router.ts
        Expected: ≥1 match (spacebar handler)

Gate REM3-F7: TOOL_DISPLAY_NAMES + CommandBar badge
  Commands:
    (a) rg -n "TOOL_DISPLAY_NAMES" packages/editor-2d/src/keyboard/shortcuts.ts packages/editor-2d/src/chrome/CommandBar.tsx
        Expected: ≥2 matches (declaration + consumer)
    (b) rg -n "toolBadge" packages/editor-2d/src/chrome/CommandBar.module.css packages/editor-2d/src/chrome/CommandBar.tsx
        Expected: ≥2 matches (CSS class + JSX usage)

Gate REM3-9: Targeted test files pass + new smoke scenarios
  Command: pnpm --filter @portplanner/editor-2d test -- tests/draw-tools tests/keyboard-router tests/ui-state tests/CommandBar tests/paintPreview tests/grip-stretch tests/smoke-e2e
  Expected: passes; new F1/F2/F3/F4/F5/F6/F7 tests + 3 new smoke scenarios all green.

Gate REM3-9b: Three new R3 smoke scenarios in SCENARIOS const + matching it() blocks
  Command: rg -n "'direct distance entry'|'grip click during running tool feeds point'|'spacebar repeats last command'" packages/editor-2d/tests/smoke-e2e.test.tsx
  Expected: ≥6 matches (each name appears twice — SCENARIOS const + it() title)

Gate REM3-10: Workspace test suite passes
  Command: pnpm test
  Expected: all 6 packages pass; total ≥ 416 (post-Round-2 baseline 391
            + 25 net-new across F1 ~6 + F2 ~3 + F3 ~3 + F4 ~5 + F5 ~2
            + F6 ~3 + F7 ~2 + smoke ~3 = ~27 net-new; Done Criteria
            uses ≥416 as a conservative human-review check).

Gate REM3-SPEC: docs/operator-shortcuts.md updated for F6 (Rev-1 B1)
  Commands (post-Codex-Round-1 governance correction: targets 1.1.0):
    (a) rg -n "^\*\*Version:\*\* 1\.1\.0" docs/operator-shortcuts.md
        Expected: 1 match (header version bumped to 1.1.0 per
        registry's "minor for new shortcut" rule)
    (b) rg -n "^\| 1\.1\.0 " docs/operator-shortcuts.md
        Expected: 1 match (changelog row for 1.1.0 present)
    (c) rg -n "repeat-last-command" docs/operator-shortcuts.md
        Expected: ≥1 match (Space row present in the M1.3a section)
  History: at execution time these gates targeted 1.0.2 (patch). The
  Codex post-commit Round-1 audit flagged the bump as governance-drift
  (additions should be minor per the registry preamble). Bumped to
  1.1.0 in the post-commit remediation; gate definitions updated to
  match the corrected target. See "Post-commit remediation" below.

Gate REM3-11: Cross-cutting hard gates clean (DTP-T1/T2/T6/T7)
  Same commands as M1.3d §9. Expected: 0 offenders each.

Gate REM3-12: Typecheck + Biome + build
  Commands: pnpm typecheck, pnpm check, pnpm build
  Expected: all exit 0
```

## 8. Done Criteria — objective pass/fail

- [ ] **F1** — Direct distance entry works for line / polyline / circle /
  arc. Verified by Gate REM3-F1 + REM3-F1b + REM3-F1c + REM3-9 +
  REM3-9b ('direct distance entry' smoke scenario).
- [ ] **F2** — Holding Shift while drawing rectangle's second corner
  forces square. Verified by Gate REM3-F2 + REM3-F2b (Rev-1 H1 blur
  cleanup) + REM3-9 (draw-tools + keyboard-router tests, including
  blur-clear assertion).
- [ ] **F3** — Typing D at rectangle's second prompt opens Width / Height
  numeric prompts; rectangle commits with typed dims. Verified by
  Gate REM3-F3 + REM3-9 (draw-tools test).
- [ ] **F4** — Move / copy show a translucent ghost of affected entities
  following cursor between picks. Verified by Gate REM3-F4 + REM3-9
  (paintPreview tests).
- [ ] **F5** — Grip click while a tool is running feeds grip.position as
  the point input; grip-stretch does NOT start. Verified by Gate
  REM3-F5 + REM3-9 + REM3-9b ('grip click during running tool feeds
  point' smoke scenario).
- [ ] **F6** — Spacebar at canvas focus + no active tool + lastToolId
  set → re-invokes last command. Spacebar + active tool → commits.
  Verified by Gate REM3-F6 + REM3-SPEC (Rev-1 B1 binding-spec
  enforcement: `docs/operator-shortcuts.md` 1.0.2 + Space row) +
  REM3-9 (keyboard-router tests) + REM3-9b ('spacebar repeats last
  command' smoke scenario).
- [ ] **F7** — Command bar shows colored badge with current tool name
  when active; hides when no tool. Verified by Gate REM3-F7 + REM3-9
  (CommandBar test).
- [ ] **Binding spec doc updated (Rev-1 B1)** — `docs/operator-shortcuts.md`
  bumped to 1.0.2 with the Space row added. Verified by Gate REM3-SPEC
  (a + b + c).
- [ ] All Phase REM3-F1..REM3-F7 + REM3-F2b + REM3-SPEC + REM3-9..REM3-12
  gates pass.
- [ ] Cross-cutting hard gates DTP-T1 / T2 / T6 / T7 pass (parent §9).
- [ ] **Workspace test count** ≥ 416 (post-Round-2 baseline 391 + ≥25
  net-new). REM3-10 provides the threshold; behavioral correctness via
  vitest's exit code; this checkbox is the human-review consistency check.
- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build` all pass.

## 9. Risks and Mitigations

(Single canonical risk register per Round-1 Rev-4 lesson on §8/§11
duplication. No retired-stub §11 in this plan — the lesson stuck.)

| Risk | Mitigation |
|------|-----------|
| F1 cursor source: `overlay.cursor` is null when pointer is over command bar (where the user types the distance), so direct-distance computation needs a "last canvas cursor" snapshot. | A2 introduces `overlay.lastKnownCursor` — captures last non-null cursor metric and never clears once set. F1 routing reads it; paintCrosshair stays bound to live cursor. |
| F1 zero-length direction: cursor exactly on the anchor (cursor.metric === anchor). `unit(cursor - anchor)` is undefined. | Fall through to existing 'number' input (tool will likely commit-fail or treat as a no-op). Documented in step 5. Edge case unreachable in practice — user has to click a point AND have cursor exactly there AND type a distance, all without moving. |
| F2 shift state leaks across draws: user holds shift, releases AFTER clicking → rectangle commit reads stale shift state. | Both previewBuilder AND commit read shift state at the time of evaluation. PreviewBuilder runs on cursor change; commit runs on click. If user releases shift between cursor change and click, the click sees the released state. Acceptable — matches AutoCAD's observed behavior. |
| F2 Shift conflicts with text-input shift (e.g., shift + arrow key in command bar). | Shift state is global but only consumed by draw-rectangle. Text inputs receive shift through their normal browser handling regardless of our slice. No conflict. |
| F3 sub-option D collides with existing `D` shortcut for some other tool. | Per `docs/operator-shortcuts.md` (the active registry — true at both 1.0.1 baseline and 1.0.2 post-F6), no top-level `D` shortcut exists; the multi-letter sub-option fast-path runs only when an active tool's `subOptions` includes a shortcut letter (per M1.3a keyboard-router design). |
| F4 ghost rendering with many selected entities is expensive. | drawModifiedEntitiesPreview iterates `shape.primitives` and strokes each. For typical M1.3d workloads (selection ≤ a few entities), cost is negligible. If profiling later shows hotspots, can clip to viewport frustum first. |
| F4 PreviewShape arm makes paintPreview's switch non-exhaustive if a future arm is added without dispatch. | TypeScript's discriminated-union exhaustiveness check catches this at compile time. Existing arms already use the pattern. |
| F5 fix changes existing grip-stretch behavior — may break the existing 'grip stretch updates primitive' smoke scenario from Rem-1. | Existing scenario fires mousedown on a grip with NO active tool. Per the new branch, that path stays unchanged (selection-mode grip-stretch). Tests still green. |
| F6 spacebar accidentally repeats a destructive last command (e.g., last command was `erase`). | AutoCAD behavior is identical — spacebar repeats. User adapts. Acceptance tradeoff. |
| F6 lastToolId persists across page reloads if persisted. | UI state is NOT persisted (per parent plan §7.2). lastToolId resets to null on reload, which is correct — first spacebar after reload does nothing. |
| F7 badge for tools with long names (e.g., 'LAYER MANAGER') overflows the bar. | Tool names are short (LINE, CIRCLE, RECTANGLE, MOVE, COPY, etc.) — longest is ~10 chars. Bar has horizontal space. If a future tool needs a long name, abbreviate at the TOOL_DISPLAY_NAMES map. |
| F7 badge color (`accent.primary` blue) collides with the R6 label pill (also blue) when both are visible at once. | Label pill is on canvas (in-flight measurement); badge is in chrome (out-of-canvas). Distinct contexts; no visual collision. Both blue is the intended consistency. |

## 10. §1.3 Three-round self-audit

Per parent plans' §1 lesson (real adversarial pass, not a tabulated stand-in).

### Round 1 — Chief Architect (boundaries, invariants, SSOT)

- **C1.1 — F1 direct-distance routing belongs where?** Two candidates:
  runner (centralizes "what to do with numeric input given prompt
  context") vs EditorRoot (orchestrator, has access to overlay +
  command bar + tool runner). Decision: EditorRoot. Reason: runner is
  a pure tool-driver that doesn't know about overlay or cursor.
  EditorRoot already orchestrates handleCommandSubmit and has access
  to all relevant slices. Keeps runner simple.
- **C1.2 — F2 modifier slice scope (just shift, or full set)?** Adding
  just `shift` for now. Other modifiers (alt, ctrl, meta) extend the
  same slice when needed. SSOT preserved; no per-modifier slice.
- **C1.3 — F4 PreviewShape new arm conflicts with M1.3b's plan?** No.
  M1.3d Phase 4 step 2 + parent plan §12 risks C10 explicitly pre-
  declares the `'modified-entities'` arm as a forward-compat hook.
  M1.3b extends with per-operator usage (rotate transforms, scale
  factors); M1.3d-Rem-3 wires it for move/copy first.
- **C1.4 — F6 lastToolId belongs in commandBar slice or as a top-level
  field?** commandBar slice. Reason: it's tool-runtime metadata, same
  conceptual layer as `activeToolId`. Single-slice cohesion.
- **C1.5 — F7 TOOL_DISPLAY_NAMES SSOT.** Lives next to the existing
  `ToolId` union and shortcut maps in `keyboard/shortcuts.ts`. Single
  file, single export, all tool metadata co-located.

### Round 2 — Sceptical Reader (what would Codex flag?)

- **C2.1 — F1 numeric → point routing requires `overlay.lastKnownCursor`
  to NEVER be null after first canvas hover. What if user opens app,
  immediately activates a tool, and types a distance without moving
  cursor over canvas?** lastKnownCursor would be null. handleCommandSubmit
  falls through to 'number' (existing behavior). Acceptable; documented
  in step 5 + risks. Mitigates surprise: tool just rejects the number.
- **C2.2 — F2 shift state synchronization with browser focus loss.** If
  user holds shift, alt-tabs out, releases shift outside the app, comes
  back: keyup never fires. Slice stays `shift: true`. Mitigation: also
  listen on `window.blur` and clear shift state. Add to step 8.
- **C2.3 — F3 Dimensions sub-option creates a NESTED prompt loop in
  draw-rectangle.** Existing tools don't have nested-prompt patterns.
  The runner's existing previewBuilder subscription (Phase 4 mechanism)
  must work across the nested prompts. Verified: runner's subscription
  is per-tool-start, not per-prompt — survives nested yields.
  previewBuilder for the inner Width/Height prompts is null (no preview
  needed for typed dimensions); existing fallback `editorUiActions.setPreviewShape(null)`
  in runner step 5 handles it.
- **C2.4 — F4 paintPreview's discriminated union exhaustiveness.** When
  the new `'modified-entities'` arm is added to `PreviewShape`, every
  switch on `shape.kind` becomes non-exhaustive until each adds a case.
  paintPreview is the obvious one; paintSelectionRect (Phase 7) only
  reads `kind === 'selection-rect'` so it's fine. paint.ts overlay-pass
  dispatcher routes by `kind === 'selection-rect'` vs other; the new
  arm correctly routes to paintPreview. Verified by chasing every
  `previewShape.kind` reference.
- **C2.5 — F5 fix: when tool is running and grip is clicked, do we run
  the snap engine on grip.position?** No. grip.position IS the canonical
  metric of the grip; snap-resolving it would be redundant (and could
  pull it to a different snap target). Bit-copy semantics preserved.
- **C2.6 — F6 spacebar conflict with sub-option fast-path.** Sub-option
  shortcut letters are A-Z; spacebar is not a letter. No conflict with
  the existing keyboard-router accumulator.
- **C2.7 — F7 badge blink on rapid tool switches.** When user activates
  L → Esc → L rapidly, badge transitions LINE → (none) → LINE. No
  guard needed — React rendering handles state changes naturally.
- **C2.8 — Test count math.** Net-new ≈ 25 (F1×6 + F2×3 + F3×3 + F4×5 +
  F5×2 + F6×3 + F7×2 + smoke×3). Workspace 391 + 25 = 416 — REM3-10's
  threshold. Per-round count drift is acknowledged in Rem-2 Rev-3 lesson;
  using a conservative threshold so under-shoots don't fail the gate.

### Round 3 — Blast Radius (what could break elsewhere?)

- **C3.1 — Existing draw-tools tests** assume specific prompt counts and
  yield orders. F3's D sub-option adds branches; F1's directDistanceFrom
  is additive (existing tests don't read it). Existing tests pass
  unchanged; new tests cover new branches.
- **C3.2 — Existing grip-stretch tests** fire mousedown on a grip with
  NO active tool. F5 keeps that path. Tests pass unchanged.
- **C3.3 — Existing keyboard-router tests** pass mocked callbacks.
  F6 adds `onRepeatLastCommand`; existing tests' mocks must not include
  it without breaking the type check. TypeScript would catch — update
  the RouterMocks interface in the test file.
- **C3.4 — Existing CommandBar test** asserts prompt-text rendering.
  F7 badge is additive to the DOM; existing assertions don't break.
- **C3.5 — `setPrompt` action signature change** (additive 5th arg
  `directDistanceFrom`). Existing callers pass 4 args; new arg is
  optional with default null. Backward-compat additive. TypeScript
  passes.
- **C3.6 — `editorUiStore.commandBar` extends with `lastToolId` +
  `directDistanceFrom`.** Existing default state has neither; both add
  with default null. No regression on existing reads.
- **C3.7 — Bundle size: 7 features add ~250 LOC + the modified-entities
  helper.** Bundle was 441kB raw / 127kB gz at Rem-2 baseline. R3 adds
  no new dependencies (everything reuses existing patterns). Estimated
  delta: +5-10kB raw / ~+2kB gz. Well under the 350kB-raw / 130kB-gz
  practical budget.

### Revision-1 audit (per §1.16 step 13 — three-round pass on the Rev-1 changes)

Per Procedure 01 §1.16 step 13, every revision re-runs §1.3. The three
Codex Round-1 fixes are small but each has its own risk surface; this
section is the real adversarial pass on the *revised* text, not a
restatement of why the original findings were valid.

**Round 1 — Chief Architect on the Rev-1 changes:**

- **R1-C1 — operator-shortcuts.md row addition path.** The doc is governed
  by ADR-023 supersession + its own preamble (§Governance). Adding a
  Space row to the M1.3a section + a 1.0.2 changelog entry follows the
  same pattern as the F7 row that was added at 1.0.1. Pre-existing
  drift exists between the preamble's "minor for new shortcut" rule and
  actual practice (1.0.0 → 1.0.1 was a patch); this revision matches
  practice (1.0.1 → 1.0.2) rather than re-litigate the governance text.
  Out of scope to fix the preamble here; called out so the next reader
  doesn't think we missed it.
- **R1-C2 — Gate REM3-SPEC enforcement shape.** Three-command gate
  (header version + changelog row + Space-row semantic) mirrors the
  enforcement shape used for `docs/design-tokens.md` in Rem-2 (R6 token
  bumps gated by version-grep + value-grep). Established pattern.
- **R1-C3 — Window.blur listener architecture.** Same `addEventListener`
  / cleanup pair as the existing keydown / keyup handlers in
  `registerKeyboardRouter`. Step 8 explicitly requires teardown via
  the existing teardown function — implementer must hold the listener
  reference (functions, not arrow inlines passed straight in). No new
  abstraction; one more line in the existing handler set.
- **R1-C4 — A11 type widening to `string | null`.** Pure type-side
  change; the §4.1 row was already correct on this point (Rev-1 only
  fixed the contradicting prose in §3 A11). CommandBar.tsx's consumer
  per A12 already null-checks before rendering.

**Round 2 — Sceptical reader on the Rev-1 changes:**

- **R2-C1 — Gate REM3-F2b false-positive risk.** Verified router.ts
  currently has zero `blur` references (`rg -n "blur"
  packages/editor-2d/src/keyboard/router.ts` → no matches). After the
  edit, the listener registration site contains the literal string
  `'blur'`. Gate ≥1 will land on exactly 1 match for the intended site;
  no false positives possible from pre-existing text.
- **R2-C2 — Gate REM3-F2 count update from ≥4 to ≥5.** Audit math:
  slice declaration `modifiers: { shift: boolean }` (1 match —
  contains `modifiers`), `setShift` action declaration in store (1),
  keydown handler calling `setShift(true)` (1), keyup handler calling
  `setShift(false)` (1), blur handler calling `setShift(false)` (1) =
  5 matches. ≥5 is exact-tight; if the implementer factors the keyup +
  blur into a shared helper, the count could drop. Acceptable
  implementation freedom — the per-site Gate REM3-F2b independently
  verifies the blur listener exists, so factoring doesn't bypass the
  invariant.
- **R2-C3 — Gate REM3-SPEC (a) regex specificity.** Pattern
  `^\*\*Version:\*\* 1\.0\.2` matches the line-leading header form
  exactly (anchored to start-of-line, escaped asterisks + dot). Will
  not match changelog row text. Will match the unique header line
  after bump.
- **R2-C4 — Gate REM3-SPEC (b) regex specificity.** Pattern
  `^\| 1\.0\.2 ` (note trailing space) matches the changelog row
  format `| 1.0.2 | 2026-04-27 | ...` exactly; the trailing space
  prevents accidentally matching e.g. `| 1.0.20 |` if such a future
  bump existed.
- **R2-C5 — A11 vs §4.1 self-consistency.** Both now read
  `Record<ToolId, string | null>`. §10's existing C2.x audit notes
  remain valid (none referenced the type signature directly).

**Round 3 — Blast radius of the Rev-1 changes:**

- **R3-C1 — `docs/operator-shortcuts.md` 1.0.2 bump downstream.** No
  code reads the version number. Files in
  `packages/editor-2d/src/keyboard/shortcuts.ts` MUST stay in sync per
  the registry's own preamble — the F6 implementation already touches
  shortcuts.ts via TOOL_DISPLAY_NAMES (F7) and the keyboard-router
  spacebar handler (F6 step 16); the registry row is the doc-side
  partner of those code edits. No additional code change beyond what
  was already planned.
- **R3-C2 — Window-level `blur` listener interactions.** No other
  editor-2d listener registers on `window.blur` today (verified
  separately — clean baseline). Adding one is additive; teardown
  symmetry preserved per Step 8's explicit cleanup requirement.
- **R3-C3 — A11 type widening downstream.** TypeScript narrows on
  `value !== null` at the consumer site (CommandBar.tsx per A12).
  Existing exhaustiveness checks across other consumers of
  `TOOL_DISPLAY_NAMES`: there are none — this is a brand-new constant
  introduced in this plan, so no cascade.
- **R3-C4 — §8 Done Criteria additions.** Three new bullet/citation
  edits. Pure documentation enrichment; no semantics change to
  pass/fail evaluation. The new "spec doc updated" checkbox is the
  human-readable mirror of Gate REM3-SPEC.

**Verdict on Revision-1:** Fixes address the Codex findings as stated;
no fresh deviations introduced; gates added are objectively
verifiable; section-consistency pass (§1.16 step 12) follows below.

## 11. Test strategy

**Tests existing before:** baseline at commit `98e0915` is 391 / 391
across 6 packages.

**Tests added by this remediation (~25-30 net-new):**

- **F1:** ~6 tests — types.test (Prompt.directDistanceFrom optional);
  ui-state.test (slice fields); runner.test (publishes
  directDistanceFrom); draw-tools.test (per-tool yields); EditorRoot
  integration (numeric → point transform); + smoke scenario `'direct
  distance entry'`.
- **F2:** ~3 tests — ui-state.test (modifiers.shift default + setShift);
  keyboard-router.test (Shift keydown/keyup + window.blur clear);
  draw-tools.test (rectangle with shift commits square).
- **F3:** ~3 tests — draw-tools.test (D sub-option dispatches to W/H
  prompts; rectangle commits with typed W/H; abort path).
- **F4:** ~5 tests — paintPreview.test (modified-entities arm draws
  primitive outlines at offset; uses transient stroke; per-kind
  fanout for line / circle / etc.); + verify move/copy yield previewBuilder.
- **F5:** ~2 tests — grip-stretch.test (regression: grip click while
  move tool is running → tool receives 'point' input; no grip-stretch
  starts) + smoke scenario `'grip click during running tool feeds point'`.
- **F6:** ~3 tests — ui-state.test (lastToolId default + setter);
  runner.test or EditorRoot integration (lastToolId tracked excluding
  internals); keyboard-router.test (spacebar branches on activeToolId);
  + smoke scenario `'spacebar repeats last command'`.
- **F7:** ~2 tests — CommandBar.test (badge renders when activeToolId
  has display name; hides when null; correct text per tool).

**Smoke E2E new scenarios (3 net-new):**

- `'direct distance entry'` — F1 SOLE integration validation.
- `'grip click during running tool feeds point'` — F5 SOLE integration
  validation.
- `'spacebar repeats last command'` — F6 SOLE integration validation.

F2 / F3 / F4 / F7 are validated at the unit/component layer (no smoke
scenario each). Rationale: F2/F3 are tool-internal flows; F4 is a
painter; F7 is chrome rendering. None has the same "wiring across
EditorRoot" concern that F1/F5/F6 have (where the user-facing change
crosses multiple layers and the integration boundary is the load-bearing
test). This matches the pattern from Rem-1 R4 + Rem-2 R5/R7 (smoke for
integration-boundary changes; unit tests for layer-internal logic).

**Tests intentionally not added (deferred):**

- Visual-regression for the badge / ghost / direct-distance preview —
  out of scope for M1.3d (no image-diff infrastructure).
- M1.3b modify-operator integration tests for the modified-entities
  PreviewShape arm — F4 wires only move + copy in this round; M1.3b
  adds per-operator tests when it ships.

## 12. Why this is one phase, not many

- F1 / F2 / F3 / F4 / F5 / F6 / F7 are independent — each touches a
  distinct feature surface. Common shared substrate is the editor-2d
  package, but no shared infrastructure to lay down first.
- F5 is a 5-LOC bug fix; phase-level ceremony for it would be overhead.
- F1 / F2 / F6 each touch a small slice extension + a consumer; no
  ordering dependency.
- F4 introduces a new PreviewShape arm but doesn't depend on or block
  any other item.
- Total LOC: ~250 production + ~150 tests across 7 features.
- Multi-phase ceremony would be pure overhead — single phase keeps the
  Procedure-03 audit cycle tight (one phase audit + one self-review loop).

---

## Plan Review Handoff

(Footer convention per Round-1 Rev-5 lesson: revision-history table is
the SSOT for hash chain; the footer points at the table rather than
inlining self-referential hashes. No `<filled-in-at-commit-time>`
placeholder tokens.)

**Plan:** `docs/plans/feature/m1-3d-drafting-polish-remediation-3.md`
**Branch:** `feature/m1-3d-drafting-polish` (atop `98e0915`)
**Status:** Plan Revision-1 — Codex Round-1 fixes applied; awaiting Codex Round-2 review.

### Paste to Codex for plan review
> Review this plan using `docs/procedures/Codex/02-plan-review.md`
> (Procedure 02). Apply strict evidence mode. This is Round 2 — Round 1
> returned No-Go on 1 Blocker (operator-shortcuts.md missing from §4.1
> + no enforcement gate) + 2 High-risk (F2 blur clear not propagated to
> step-list / gates; A11 type contradiction). Rev-1 changes are
> documented in the Revision history table at the top of the plan.
>
> Context: this is the THIRD remediation pass on `feature/m1-3d-drafting-polish`,
> bundling seven items (F1-F7) per user-side testing. Round-1 (R1/R2a/R2b/R4
> + QG-1/QG-2 + Rev-5 footer fix) is at `2c13b49`. Round-2 (R5/R6/R7 + Rev-3
> gate-polish + Procedure-05 wire-intersect bug fix) is at `98e0915`.
> Round-3 covers F1-F7 (direct distance entry, square-rectangle constraint,
> Dimensions sub-option, move/copy ghost, grip-precedence bug fix, spacebar
> repeats last command, command-bar tool badge). User asked for a single
> consolidated plan ("one go").
>
> Parent plans + Round-1 + Round-2 plan files + their revision histories
> + post-execution / post-commit notes are the authoritative context for
> invariants, gates, and the existing implementation surface.

---

## Post-execution notes (Procedure 03 §3.7)

**Execution commit:** to be filled by `git log` after the execution commit lands; per Rev-1 footer convention (Round-1 Rev-5 lesson) no self-referential placeholder token.

**Codex Round-2 quality gaps bundled per "fix during execution" pattern (Lesson 10):**
- **QG-A** — §1 Request summary previously said "no spec change"; updated to reflect the binding-doc update for `docs/operator-shortcuts.md` 1.0.2 introduced in Rev-1.
- **QG-B** — §4.1 had ambiguous test-file phrasing `tests/types.test.ts (or similar) — actually tests/draw-tools.test.ts`; reduced to the single authoritative path `tests/draw-tools.test.ts`.

Both QG fixes landed in this same execution commit per user direction "fix during execution"; equivalent to Rem-2 Rev-2 pattern.

**Final test count vs estimate:**
- §10 C2.8 estimate: ~25 net-new tests, threshold ≥416.
- Actual: 437 (was 391 at Rem-2 baseline `98e0915`; +46 net-new). Per-package: editor-2d 274 → 320 (+46); domain / design-system / project-store / project-store-react / web unchanged.
- Sources of overshoot: paintPreview F4 modified-entities arm got 8 sub-tests (one per Primitive kind plus the multi-primitive case), draw-tools F1 directDistanceFrom got 5 per-tool yields, F2 / F3 each had 2-3 sub-paths. Same shape of estimate-vs-actual drift acknowledged in Rem-2 Rev-3 — using a conservative threshold so under-shoots don't fail.

**Implementation observations worth recording for future readers:**

1. **F5 fix is exactly the 5-LOC change estimated** (handleGripDown 2-branch dispatch). The pre-fix path `runningToolRef.current?.abort(); runningToolRef.current = null;` BEFORE starting grip-stretch was redundant in the new structure (the only path reaching grip-stretch is the no-active-tool branch where the ref is already null), so it was elided in the rewrite. Behavioral equivalence preserved. Net change in handleGripDown: -2 lines existing + ~7 lines new = +5 lines.
2. **F6 lastToolId type fudge.** `commandBar.lastToolId: string | null` is held as `string`, not `ToolId`, because typing it as `ToolId` would force the ui-state store (lower-level package) to import from `keyboard/shortcuts.ts` (higher-level). A small `as ToolId` cast in EditorRoot's `onRepeatLastCommand` bridges the gap; `lookupTool(id)` returns null for unknown ids regardless, so the cast is defensive even if mistyped. Cleaner than introducing a cross-module dep.
3. **F4 `'modified-entities'` arm primitive snapshot.** move.ts and copy.ts capture the source primitives at base-point-pick time (not at second-point time). Reason: snapshot stability across the second prompt — if the project store mutated mid-prompt (unlikely but possible via undo/redo), the ghost would jump. Captured primitives flow through closure into the previewBuilder.
4. **F7 badge UX detail.** Moving `border-top` from `.promptLine` to a new `.promptRow` wrapper was needed so the divider line spans the full bar width (across badge + prompt form). Without this, the divider would appear to span only the form's column, giving the badge a "floating above the line" look.
5. **§7 Step 7 (modifier slice) and step 8 (router listeners) implemented per plan with one design micro-decision: blur listener calls `setShift(false)` (NOT clearing the whole modifiers slice).** Future modifiers (alt, ctrl, meta) can be cleared by separate handlers; isolating per-key clear keeps the slice extension forward-compatible.

**Bundle delta:** apps/web/dist/index.js was 441 kB raw / 127 kB gz at Rem-2 baseline; now 445 kB raw / 128.55 kB gz. Delta: +4 kB raw / +1.55 kB gz. Within the +5-10 kB raw / +2 kB gz estimate from §10 C3.7.

**Procedure 03 §3.9 self-review loop:** after the execution commit lands, run Procedure 04 against the commit range and remediate any Blocker / High-risk findings before the §3.8 handoff. Quality-gap findings may be deferred but MUST be listed as residual risks.

---

## Post-commit remediation (Procedure 05)

### Round 1 — 2026-04-27 — Codex post-commit Round-1 quality cleanup

**Trigger:** Codex post-commit Round-1 audit on commit range `98e0915..359ab48` (rated 9.2/10, Go conditional). One quality gap, no Blocker / No High-risk.

**Finding (Quality):** `docs/operator-shortcuts.md` versioning governance drift. The registry's own §Governance preamble states "Adding a new shortcut → minor version bump (e.g. 1.0.0 → 1.1.0)". The execution commit applied a patch bump (1.0.1 → 1.0.2) for adding `Space` → repeat-last-command. The Round-3 plan's §10 Revision-1 audit R1-C1 had flagged this as pre-existing drift (matching the prior 1.0.0 → 1.0.1 patch precedent for F7) and explicitly chose "match practice" rather than re-litigate the governance text — Codex's post-commit audit didn't accept that rationale and asked for the policy to be enforced.

**Fix:** Bumped `docs/operator-shortcuts.md` 1.0.2 → **1.1.0**:
- Header: `**Version:** 1.0.2` → `**Version:** 1.1.0` (line 3).
- Changelog row: `| 1.0.2 | 2026-04-27 | ...` → `| 1.1.0 | 2026-04-27 | ...` with an inline note documenting the correction + acknowledging the historic 1.0.1 patch as pre-existing drift (recorded historically; not retroactively re-numbered).

**Plan-side update (this commit):** Gate REM3-SPEC commands (a) and (b) updated from `1\.0\.2` to `1\.1\.0` so the gate definitions match the corrected file state. Per Procedure 05 §5.6: the plan file MUST always reflect the true final state.

**Verification:**
- `rg -n "^\*\*Version:\*\* 1\.1\.0" docs/operator-shortcuts.md` → 1 match (line 3).
- `rg -n "^\| 1\.1\.0 " docs/operator-shortcuts.md` → 1 match (changelog row).
- `rg -n "repeat-last-command" docs/operator-shortcuts.md` → ≥1 match (Space row + changelog mention).
- `pnpm typecheck` → clean (docs-only change; no code touched).
- `pnpm test` → 437/437 (no test depends on the version literal).

**Binding-spec update applied in same commit per Procedure 05 §5.3 Phase 2.**

**Residual risk:** none. The 1.0.1 patch row remains as a historical artifact — going forward all additions are minor per the governance rule.

### Paste to user for approval
> Please review the plan at
> `docs/plans/feature/m1-3d-drafting-polish-remediation-3.md`. After
> approval, invoke Procedure 03 to execute the single phase.
