# Plan — M1.3d Drafting UX Polish (Remediation Round 4)

**Branch:** `feature/m1-3d-drafting-polish`
**Parent plans:** `docs/plans/feature/m1-3d-drafting-polish.md` (M1.3d) + `docs/plans/feature/m1-3d-drafting-polish-remediation.md` (Round 1) + `docs/plans/feature/m1-3d-drafting-polish-remediation-2.md` (Round 2) + `docs/plans/feature/m1-3d-drafting-polish-remediation-3.md` (Round 3)
**Parent commit baseline:** Round 3 latest = `63380bb` (Codex post-commit Round-1 governance fix on Round-3 9.2/10 Go; Round-3 chain closed at 9.8/10 Go after this)
**Author:** Claude (Opus 4.7, 1M context)
**Date:** 2026-04-27
**Operating mode:** Procedure 01 (PLAN-ONLY) → Procedure 03 (EXECUTION) after Codex review
**Status:** Plan authored — awaiting Codex Round-1 review

---

## Revision history

| Rev | Date | Driver | Changes |
|-----|------|--------|---------|
| Rev-0 | 2026-04-27 | Initial draft | G1 (AC-mode keyboard accumulator) + G2 (Dynamic Input pill at cursor + non-letter input routing + click-eat). G3 (W,H comma-separated) deferred per user agreement (becomes obsolete once G2 lands and the existing two-prompt W/H flow is usable). §1.3 three-round audit. |

## 1. Request summary

Two new behaviors from manual user-side testing of M1.3d-Rem-3 at `63380bb`. Both address a vocabulary + mental-model split that the user surfaced explicitly: today the only visible input surface is the **command line** at the bottom of the screen, but AutoCAD muscle memory expects a **dynamic input pill** anchored at the cursor.

- **G1 — AC-mode keyboard accumulator (letter-shortcut activation requires Enter or Space).**
  Currently: typing `M` activates Move at the 750 ms accumulator timeout (when `M` is an exact match in `SINGLE_LETTER_SHORTCUTS` and no entry in `MULTI_LETTER_SHORTCUTS` starts with `M`). This blocks `MI` for Mirror, `MA` for Match-Properties, etc. Even the existing prefix-detection (`isMultiLetterPrefix`) is fragile — it's based on the current registry contents, so adding `MI` later silently changes `M`'s behavior.

  AutoCAD parity: letters silently accumulate. Only Enter or Space activates. Escape clears. A silent stale-clear timeout (kept at 750 ms) clears the accumulator without activating, so leftover `M` doesn't sit forever if the user wandered off.

- **G2 — Dynamic Input pill at the cursor.**
  Currently: numeric keys (and any non-letter, non-Enter, non-Esc, non-F-key) at canvas focus are dropped on the floor. Users can't see what they're typing unless they explicitly click the command-line input to focus it. AC's Dynamic Input feature (F12 toggle) addresses this with a small floating pill anchored to the cursor that echoes every keystroke.

  Concretely:
  - New `DynamicInputPill.tsx` chrome component anchored at `overlay.cursor.screen + offset`.
  - Pill content priority: `commandBar.inputBuffer` > `commandBar.accumulator` > `commandBar.activePrompt` (when any are present).
  - Pill visibility gated on `toggles.dynamicInput` (already plumbed but unwired since M1.3a F12 toggle).
  - Keyboard router routes printable non-letter keys at canvas focus (digits 0-9, `.`, `-`, `,`, Backspace) into `commandBar.inputBuffer`. Letters keep going through the accumulator (G1 path) — accumulator is for command activation, inputBuffer is for value entry; keeping them as distinct streams matches AC's mental model.
  - Enter at canvas focus, when `commandBar.inputBuffer` is non-empty AND a tool is awaiting input, submits the buffer through the same path as the bottom command line's form submit.
  - **Click-eat:** when `commandBar.inputBuffer` is non-empty, canvas clicks (`handleCanvasClick`, `handleSelectRectStart`, `handleGripDown`) are silently eaten — AC parity. The buffer takes precedence; the user must Enter or Esc to commit/discard the buffer before clicking.

The user also asked for a vocabulary cleanup. The terms going forward:
- **Command line** — the bottom chrome with prompt + input + history (existing `CommandBar.tsx`).
- **Dynamic input** (or "DI pill") — the cursor-anchored pill (NEW; this round).
- **Sub-options** — bracketed `[Close/Undo]`-style choices on a prompt (existing `subOptions: SubOption[]`).
- **Accumulator** — the multi-letter-shortcut staging buffer in the keyboard router (existing; published to store this round so the pill can render it).

## 2. Out of scope (deferred / not addressed in Round 4)

This round bundles G1 + G2. Explicit deferrals:

- **G3 — pair-input "Specify dimensions: width,height".** The user originally surfaced this as a separate concern alongside G1+G2. Becomes obsolete once G2 lands: the existing two-prompt W/H flow (`Specify width:` then `Specify height:` from M1.3d-Rem-3 F3) becomes usable because the pill makes the buffer visible and the typed numerics now route into the buffer. Both prompts work as intended. AutoCAD itself uses two separate prompts here; we match that.
- **F12 toggle behavior changes.** `toggles.dynamicInput` is already plumbed and exposed via F12 (M1.3a). This round just *reads* it (pill visibility gate). No change to the toggle's semantics or UI.
- **Pill visual polish** (animations, micro-interactions, theme variants). Default styling per existing chrome conventions; design refinement post-M1.
- **Numeric-only input mode toggle, multi-line pill, history navigation in pill, etc.** Out of scope.
- **F1 cursor-source rework.** F1 (direct distance entry) already works correctly with `overlay.lastKnownCursor` from M1.3d-Rem-3; G2's new pill doesn't change F1's anchor logic, just makes the buffer visible while typing.

## 3. Assumptions and scope clarifications

User-confirmed in chat 2026-04-27:

- **A1 — AC-mode accumulator (G1).** Letters silently accumulate. Enter or Space activates. Escape clears. 750 ms silent stale-clear stays (no activation). Confirmed: "ac mode, i want instant feedback on space enter escape".

- **A2 — Dynamic Input pill (G2).** Pill follows the cursor (`overlay.cursor.screen + offset`). Anchored at the cursor with a small offset (e.g. `{dx: 16, dy: -24}`) so it doesn't sit directly under the pointer. Re-renders on cursor change (existing 60 Hz rAF-coalesced path). Confirmed: AC default behavior.

- **A3 — Pill content priority.** When the pill is visible (`toggles.dynamicInput === true`), it renders the highest-priority of:
  1. `commandBar.inputBuffer` (user typing a value)
  2. `commandBar.accumulator` (user typing a command shortcut)
  3. `commandBar.activePrompt` text (when a tool is awaiting input but the user hasn't typed yet — gives a visible cue what to enter)
  4. Hidden when all three are empty/null.

  When `toggles.dynamicInput === false`, pill is hidden regardless.

- **A4 — Letters into accumulator only.** Letters typed at canvas focus continue to flow into the accumulator (G1 silent path). They do NOT go into `inputBuffer`. Numbers / punctuation / Backspace go into `inputBuffer`. Two distinct streams — matches AC's separation of "command activation" vs "value entry".

- **A5 — `toggles.dynamicInput` reads.** Default value already `true` per `createInitialEditorUiState`. F12 keypress already toggles it (M1.3a Phase 8). This round wires it as the pill visibility gate; no other behavior change.

- **A6 — Click-eat (AC parity).** When `inputBuffer.length > 0`, canvas pointer-down handlers (`handleCanvasClick`, `handleSelectRectStart`, `handleGripDown`) silently return without acting. The user must Enter (submit buffer) or Esc (clear buffer + abort tool) before clicking again. Confirmed: "ear the click same as AC".

- **A7 — Sub-option fast-path interaction with G1.** Existing logic: when a tool is running with `subOptions` exposed AND the user types a letter that matches a `subOption.shortcut`, the keypress routes directly to `onSubOption` BEFORE the accumulator. This bypass stays unchanged — sub-option keys remain "instant" (no Enter required). Letters that don't match a sub-option fall into the accumulator and require Enter to activate (which would abort the running tool and start a new one — AC parity).

- **A8 — Numeric input scope.** Printable non-letter keys captured by the router at canvas focus: `0-9`, `.`, `-`, `,`, Backspace. NOT captured: `Tab`, modifier keys (`Shift`, `Ctrl`, `Alt`, `Meta`), function keys, navigation keys (arrows, Home, End), `=`, `+`, `*`, `/`, etc. The captured set covers numeric entry + the comma separator (for future pair input) + Backspace for editing.

- **A9 — Accumulator publication to store.** New field `commandBar.accumulator: string` (default `''`) so the pill can render the in-progress shortcut. Router writes via `editorUiActions.setAccumulator` on every accumulator mutation (append, clear). Adding this single field has no other consumer this round.

- **A10 — Submit semantics.** Enter at canvas focus disambiguation:
  - `inputBuffer.length > 0` AND `runningToolRef.current !== null` → submit buffer via `onSubmitBuffer` callback (new) → EditorRoot's `handleCommandSubmit(buffer)` (existing path).
  - `inputBuffer.length > 0` AND no tool active → discard buffer (no tool to consume); clear it. Or: ignore. Pick: **clear silently** (no tool to send the value to). Edge case unlikely in practice.
  - `inputBuffer.length === 0` AND `accumulator.length > 0` → flush + activate (G1).
  - `inputBuffer.length === 0` AND `accumulator.length === 0` → existing `onCommitCurrentTool` (commit in-flight tool / abort gracefully).

  Space at canvas focus: SAME as Enter for G1 + the inputBuffer-submit case (per existing F6 spacebar = repeat-last-command shape, extended). Specifically:
  - `inputBuffer.length > 0` AND tool active → submit buffer (same as Enter).
  - `accumulator.length > 0` → flush + activate (same as Enter).
  - tool active → existing `onCommitCurrentTool` (M1.3d-Rem-3 F6).
  - no tool + `lastToolId` set → existing `onRepeatLastCommand` (M1.3d-Rem-3 F6).

- **A11 — Escape semantics.** Existing: Escape calls `flushAccumulator` (which currently activates if exact match) + `onAbortCurrentTool` + sets focus to canvas. Under G1, `flushAccumulator` becomes `clearAccumulator` (no activation). Escape also clears `inputBuffer` (new — under G2, Esc cancels both staging surfaces). Refresh: Escape = "abort everything in flight" (tool, accumulator, inputBuffer).

- **A12 — Pill DOM placement.** New `DynamicInputPill.tsx` mounts inside the canvas-area div (sibling of `<CanvasHost />`), positioned absolutely. Anchor uses `transform: translate(${x}px, ${y}px)` for fast updates. CSS module file `DynamicInputPill.module.css`.

- **A13 — Bottom command line vs pill SSOT.** The bottom command line stays the canonical history surface (scrollback, sub-option click targets, defaultValue display). The pill is a *visual mirror* of the in-flight buffer/accumulator — it does NOT have its own buffer. Both surfaces read the same `commandBar.inputBuffer` / `accumulator` / `activePrompt` slice fields. SSOT preserved.

- **A14 — One commit on `feature/m1-3d-drafting-polish`.** Branch is still pre-merge to main; landing this as one more commit before merge keeps the M1.3d shipped unit cohesive.

## 4. Scope

### 4.1 In scope — files modified

| Path | Change |
|---|---|
| `packages/editor-2d/src/ui-state/store.ts` | Add `commandBar.accumulator: string` (default `''`) + `setAccumulator(value: string)` action. No other slice changes. |
| `packages/editor-2d/src/keyboard/router.ts` | (G1) Remove auto-activation in `pumpAccumulator` (the `if (exact && !couldExtend) flushAccumulator(); return;` heuristic goes away). Rename `flushAccumulator` → `clearAccumulator` (no activation; just clear + cancel timer + write `setAccumulator('')`). Add `flushAccumulatorAndActivate` for Enter/Space-driven flush. (G1) Enter handler: branch on `accumulator` non-empty → `flushAccumulatorAndActivate`; else existing `onCommitCurrentTool`. (G1) Space handler: branch the same way (chained with the existing F6 spacebar branches: input buffer first, then accumulator, then active-tool commit, then last-tool repeat). (G1) Escape clears `inputBuffer` too via new `editorUiActions.setInputBuffer('')`. (G2) Capture digits / `.` / `-` / `,` / Backspace at canvas focus → write to `inputBuffer` (append for printables; pop last char for Backspace). (G2) Publish accumulator on every mutation via `editorUiActions.setAccumulator`. |
| `packages/editor-2d/src/EditorRoot.tsx` | (G2 click-eat) `handleCanvasClick`, `handleSelectRectStart`, `handleGripDown` early-return when `editorUiStore.getState().commandBar.inputBuffer.length > 0`. (G1+G2 submit wiring) Add `onSubmitBuffer: (raw: string) => void` callback to keyboard router callbacks; impl reads `inputBuffer` and feeds through existing `handleCommandSubmit` path (the same routing — direct-distance transform, number, etc.). After submit, clear `inputBuffer`. |
| `packages/editor-2d/src/chrome/DynamicInputPill.tsx` | NEW. Reads `overlay.cursor`, `commandBar.inputBuffer`, `commandBar.accumulator`, `commandBar.activePrompt`, `toggles.dynamicInput` via `useEditorUi`. Renders absolute-positioned pill at `cursor.screen + {dx: 16, dy: -24}` when visibility predicate holds (per A3). Hides otherwise (returns null). Single React component, ~50-70 LOC. |
| `packages/editor-2d/src/chrome/DynamicInputPill.module.css` | NEW. `.pill` class: absolute positioned, dotted border, monospace, small padding, semi-transparent background using `var(--surface-overlay)` + `var(--text-primary)` semantic tokens. ~25-40 LOC. |
| `packages/editor-2d/src/chrome/CommandBar.tsx` | No change. Bottom command line continues to render the same buffer; pill is an alternate surface for the same SSOT. |
| `packages/editor-2d/src/keyboard/shortcuts.ts` | No change. |
| `packages/editor-2d/tests/keyboard-router.test.ts` | (G1 migration) Update existing tests `'single-letter "L" with canvas focus activates draw-line'`, `'multi-letter "P" then "L" within timeout activates draw-polyline'`, `'"L" without further input falls back to single-letter draw-line'` — they currently `await new Promise(r => setTimeout(r, 800))` for the auto-flush. Under G1, these must press Enter or Space and assert activation happens immediately. (G1 new) Test: `'letter alone does NOT activate without Enter or Space'`. (G1 new) Test: `'Enter at canvas focus + accumulator non-empty → activates the accumulated tool'`. (G1 new) Test: `'Space at canvas focus + accumulator non-empty → activates the accumulated tool'`. (G1 new) Test: `'Escape clears accumulator without activating'`. (G2 new) Test: `'digit at canvas focus appends to inputBuffer'`. (G2 new) Test: `'comma + minus + dot at canvas focus append to inputBuffer'`. (G2 new) Test: `'Backspace at canvas focus pops the last char from inputBuffer'`. (G2 new) Test: `'Enter at canvas focus + inputBuffer non-empty + tool active → onSubmitBuffer fires with buffer contents'`. (G2 new) Test: `'Escape clears inputBuffer'`. |
| `packages/editor-2d/tests/ui-state.test.ts` | (G1) Add tests for `commandBar.accumulator` default + `setAccumulator` mutator. |
| `packages/editor-2d/tests/CommandBar.test.tsx` | No change. |
| `packages/editor-2d/tests/DynamicInputPill.test.tsx` | NEW. (G2) Tests: `'pill renders inputBuffer when buffer non-empty'`, `'pill renders accumulator when buffer empty + accumulator non-empty'`, `'pill renders activePrompt when both buffers empty + prompt active'`, `'pill hides when toggles.dynamicInput is false'`, `'pill hides when nothing to render and no active prompt'`, `'pill anchors at cursor.screen + offset'`. |
| `packages/editor-2d/tests/smoke-e2e.test.tsx` | (G1+G2 migration) Update existing scenarios that use the `ACCUMULATOR_FLUSH_MS` wait-then-activate pattern. Any of: `'draw line and reload'`, `'pan zoom toggle'` (no letter activation — skip), `'layer manager flow'`, `'live preview during line draw'`, `'snap glyph appears at endpoint'`, `'window vs crossing selection'` (no letter — skip), `'grip stretch updates primitive'` (no letter — skip), `'cursor coords update on mousemove'` (no letter — skip), `'snap honored on grip-stretch mouseup'` (no letter — skip), `'crossing selection narrows to wire-intersect (not bbox)'` (no letter — skip), `'hovered grip highlights on cursor proximity'` (no letter — skip), `'direct distance entry'`, `'grip click during running tool feeds point'`, `'spacebar repeats last command'`. Audit each: any that does `fireEvent.keyDown(window, {key: 'L'})` + `wait(ACCUMULATOR_FLUSH_MS)` must add a `fireEvent.keyDown(window, {key: 'Enter'})` (or Space) AFTER the letter and BEFORE the wait. (G2 new smoke) `'dynamic input pill: typing a number while in line tool shows pill + Enter submits'` — F1 SOLE integration validation (replaces the existing `'direct distance entry'` smoke or extends it). (G2 new smoke) `'click is eaten while inputBuffer non-empty (AC parity)'`. |
| `packages/editor-2d/tests/EditorRoot.test.tsx` | If exists: add click-eat tests. (Need to check if such a file exists; if not, click-eat is covered by smoke.) |
| `docs/operator-shortcuts.md` | Minor bump 1.1.0 → 1.2.0. New "Behavior notes" subsection (or paragraph after the shortcut map) documenting AC-mode letter activation: "Letter shortcuts at canvas focus accumulate silently; Enter or Space activates the accumulated command. Escape clears the accumulator." Changelog row added per registry governance. No new shortcut rows; this is a behavior clarification + minor bump because behavior change. |
| `docs/glossary.md` | (Optional, low priority) Add "Dynamic input" + "Command line" + "Accumulator" entries pointing at the relevant code/docs. Decide at execution time if it adds value. |

### 4.2 In scope — files created

- `packages/editor-2d/src/chrome/DynamicInputPill.tsx` — new chrome component.
- `packages/editor-2d/src/chrome/DynamicInputPill.module.css` — new CSS module.
- `packages/editor-2d/tests/DynamicInputPill.test.tsx` — new test file.

### 4.3 Out of scope (deferred)

- G3 (pair-input W,H comma-separated) — see §2.
- F12 toggle UI changes — already plumbed.
- Pill animations / theme variants / multi-line content / history navigation — design refinement post-M1.
- M1.3b modify operators — separate milestone.

### 4.4 Blast radius

- **Packages affected:** `editor-2d` only (router, ui-state, EditorRoot, new chrome component).
- **Cross-cutting hard gates affected:** none — DTP-T1/T2/T6/T7 stay clean (no painters touched; no project-store imports introduced; no `editorUiStore` in canvas-host).
- **Stored data:** none. UI-state-only extensions.
- **UI surfaces affected:** keyboard router (letter routing, numeric routing, Enter/Space semantics), canvas-area chrome (new pill), canvas click handlers (click-eat).
- **ADRs:** none modified. ADR-023 (tool state machine + command bar) gains a new chrome surface (DI pill) which is additive within ADR-023's "dynamic input" envelope.
- **I-DTP invariants:** none changed. The pill is a NEW chrome surface; bottom command line behavior is preserved.
- **Test rework volume:** medium-large. Approximately 8-12 existing keyboard-router + smoke-e2e tests need updates (replace `ACCUMULATOR_FLUSH_MS` wait pattern with explicit Enter/Space). Plus ~12-15 new tests for G1 + G2.

## 5. Architecture doc impact

| Doc | Change |
|---|---|
| `docs/operator-shortcuts.md` | Minor bump 1.1.0 → 1.2.0. Add "Behavior notes" paragraph documenting the AC-mode letter activation (Enter/Space required; Escape clears; 750 ms silent stale-clear). Changelog row added per registry's "minor bump on behavior change" rule. |
| `docs/glossary.md` | (Optional) Add "Dynamic input pill" + "Command line" + "Accumulator" definitions. Decide at execution time. |
| All other binding spec docs | No change. |

## 6. Deviations from binding specifications (§0.7)

**None.** All changes extend existing systems within their declared extension points (Prompt fields unchanged; new chrome component; router extends its routing rules additively; click-eat is a guard added to existing handlers).

## 7. Implementation steps (single phase)

The G1 + G2 changes are interdependent (G1's accumulator publication is consumed by G2's pill; G2's submit path interacts with G1's Enter/Space semantics). Single phase covers both with clear ordering.

### Step-by-step

1. **Store: publish accumulator.** In `ui-state/store.ts`, add `commandBar.accumulator: string` (default `''`) to `CommandBarState`. Update `createInitialEditorUiState` defaults. Add action `setAccumulator(value: string)`. Document the field's purpose (router-internal staging buffer for multi-letter shortcuts; pill reads it).

2. **G1: Router accumulator behavior change.**
   - In `keyboard/router.ts`, replace `flushAccumulator` with two functions: `clearAccumulator` (silent: clear local var, cancel timer, write `editorUiActions.setAccumulator('')`) and `flushAccumulatorAndActivate` (look up the accumulated string, call `onActivateTool` if it resolves, then clear).
   - In `pumpAccumulator`: still appends to the local accumulator + writes to store via `setAccumulator`. **REMOVE** the `if (exact && !couldExtend) flushAccumulator(); return;` block — letters never auto-activate.
   - Keep the 750 ms timeout, but its action is now `clearAccumulator` (silent). Stale state goes away after 750 ms of inactivity; nothing activates.

3. **G1: Enter handler updated.** `if (key === 'Enter' && focus === 'canvas')` block branches on:
   - `accumulator.length > 0` → `flushAccumulatorAndActivate()`. Return.
   - `inputBuffer.length > 0` AND tool active → `callbacks.onSubmitBuffer(inputBuffer)`. Return. (G2 path; covered in step 6.)
   - Else → existing `callbacks.onCommitCurrentTool()`.

4. **G1: Space handler updated.** Same branch order as Enter, plus the existing F6 spacebar logic preserved at the bottom:
   - `accumulator.length > 0` → `flushAccumulatorAndActivate()`.
   - `inputBuffer.length > 0` AND tool active → `callbacks.onSubmitBuffer(inputBuffer)`.
   - tool active → `callbacks.onCommitCurrentTool()` (existing F6).
   - no tool + `lastToolId` set → `callbacks.onRepeatLastCommand()` (existing F6).

5. **G1: Escape extended.** Existing Escape handler calls `flushAccumulator` + `onAbortCurrentTool` + `setFocusHolder('canvas')`. Update to `clearAccumulator` (no activation) + clear `inputBuffer` (`editorUiActions.setInputBuffer('')`) + existing abort + focus set.

6. **G2: Numeric routing.** Add a key-class branch in the keyboard router handler: at canvas focus, when the key is a printable non-letter that we capture (digits 0-9, `.`, `-`, `,`):
   - `e.preventDefault()`.
   - Read `editorUiStore.getState().commandBar.inputBuffer`.
   - Append the key char.
   - `editorUiActions.setInputBuffer(newBuffer)`.

   Backspace at canvas focus when `inputBuffer.length > 0`:
   - `e.preventDefault()`.
   - Pop the last char.
   - `setInputBuffer(newBuffer)`.

   Backspace when `inputBuffer.length === 0` → fall through (no-op or let browser handle, which is fine — there's nothing to delete and no useful default action).

7. **G2: `onSubmitBuffer` callback in router callbacks type.** Add to `KeyboardRouterCallbacks`:
   ```ts
   /** G2: submit the current commandBar.inputBuffer to the active tool.
    *  Fired when the user hits Enter (or Space) at canvas focus while
    *  the buffer has content. EditorRoot routes through the same
    *  handleCommandSubmit path the bottom command line's form uses
    *  (so the F1 direct-distance transform applies uniformly). */
   onSubmitBuffer: (raw: string) => void;
   ```

   Wired in router's Enter and Space branches (steps 3 and 4).

8. **G2: EditorRoot wires `onSubmitBuffer`.** New callback in the `registerKeyboardRouter` arg block:
   ```ts
   onSubmitBuffer: (raw) => {
     handleCommandSubmit(raw);  // existing handler — does the F1 transform
     editorUiActions.setInputBuffer('');  // clear after dispatch
   },
   ```

9. **G2: Click-eat in EditorRoot.** Top-of-function early-returns in the three click handlers:
   ```ts
   const handleCanvasClick = (metric, screen) => {
     if (editorUiStore.getState().commandBar.inputBuffer.length > 0) return;
     // ... existing logic
   };
   const handleSelectRectStart = (metric, screen) => {
     if (editorUiStore.getState().commandBar.inputBuffer.length > 0) return;
     // ... existing logic
   };
   const handleGripDown = (grip) => {
     if (editorUiStore.getState().commandBar.inputBuffer.length > 0) return;
     // ... existing logic (incl. the F5 2-branch dispatch)
   };
   ```
   `handleCanvasMouseUp` doesn't need the guard (it only acts when activeToolId is select-rect or grip-stretch, both of which can't have started if the mousedown was eaten).

10. **G2: DynamicInputPill component.** New file `chrome/DynamicInputPill.tsx`:
    ```tsx
    export function DynamicInputPill(): ReactElement | null {
      const cursor = useEditorUi(s => s.overlay.cursor);
      const inputBuffer = useEditorUi(s => s.commandBar.inputBuffer);
      const accumulator = useEditorUi(s => s.commandBar.accumulator);
      const activePrompt = useEditorUi(s => s.commandBar.activePrompt);
      const dynEnabled = useEditorUi(s => s.toggles.dynamicInput);
      if (!dynEnabled || !cursor) return null;
      const text = inputBuffer || accumulator || activePrompt;
      if (!text) return null;
      return (
        <div
          className={styles.pill}
          data-component="dynamic-input-pill"
          style={{ transform: `translate(${cursor.screen.x + 16}px, ${cursor.screen.y - 24}px)` }}
        >
          {text}
        </div>
      );
    }
    ```
    No useEffect; pure render driven by store subscriptions.

11. **G2: CSS.** `chrome/DynamicInputPill.module.css`:
    ```css
    .pill {
      position: absolute;
      pointer-events: none;
      top: 0;
      left: 0;
      background: var(--surface-overlay, rgba(17, 17, 17, 0.92));
      color: var(--text-primary, #eee);
      font-family: ui-monospace, monospace;
      font-size: 12px;
      padding: 2px 8px;
      border: 1px dotted var(--surface-border, #555);
      border-radius: 4px;
      white-space: nowrap;
      z-index: 10;
    }
    ```

12. **G2: Mount the pill.** In `EditorRoot.tsx`'s render, inside the `data-component="canvas-area"` div (sibling of `<CanvasHost />`):
    ```tsx
    <div data-component="canvas-area" style={{ position: 'relative', overflow: 'hidden', ... }}>
      <CanvasHost ... />
      <DynamicInputPill />
    </div>
    ```
    The canvas-area div already has `position: relative`, so the pill's absolute positioning anchors correctly.

13. **Test migration: keyboard-router.test.ts.** Audit existing tests:
    - `'single-letter "L" with canvas focus activates draw-line'` — replace `await wait(800)` with `pressKey('Enter')` + `expect(...).toHaveBeenCalledWith('draw-line')`.
    - `'multi-letter "P" then "L" within timeout activates draw-polyline'` — same: press P, L, then Enter; assert.
    - `'"L" without further input falls back to single-letter draw-line'` — replace timeout with explicit Enter.
    - Other existing tests that don't rely on the timeout pattern stay unchanged.

14. **Test migration: smoke-e2e.test.tsx.** Audit each scenario for `ACCUMULATOR_FLUSH_MS` usage. Where present, after the letter-keydown, also fire Enter (or Space):
    ```ts
    fireEvent.keyDown(window, { key: 'L' });
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);  // brief flush
    expect(activeToolId).toBe('draw-line');
    ```
    Affected scenarios (audit at execution time): `'draw line and reload'`, `'layer manager flow'` (uses L+A), `'live preview during line draw'`, `'snap glyph appears at endpoint'`, `'direct distance entry'`, `'grip click during running tool feeds point'`, `'spacebar repeats last command'` (note: this scenario already presses Space — but the L activation needs Enter too now).

    `ACCUMULATOR_FLUSH_MS` constant becomes unused after migration; remove it or repurpose for the brief post-flush settle wait.

15. **New tests added per §4.1.**

16. **Spec doc bump.** Update `docs/operator-shortcuts.md`:
    - Header version 1.1.0 → 1.2.0.
    - New "Behavior notes" paragraph (or section) after the shortcut map table:
      > **AC-mode letter activation (M1.3d-Rem-4 G1):** letter shortcuts at canvas focus accumulate silently. Enter or Space activates the accumulated command. Escape clears the accumulator. A 750 ms idle timeout silently clears the accumulator without activating.
    - Changelog row at the bottom: `| 1.2.0 | 2026-04-27 | AC-mode letter activation (Enter/Space required, Esc clears, 750 ms silent stale-clear). M1.3d-Remediation-4 G1. Behavior change; minor bump per governance. |`.

### Mandatory completion gates

```
Gate REM4-G1a: pumpAccumulator no longer auto-activates
  Command: rg -n "if \(exact && !couldExtend\)" packages/editor-2d/src/keyboard/router.ts
  Expected: 0 matches (the heuristic is removed)

Gate REM4-G1b: clearAccumulator and flushAccumulatorAndActivate exist as distinct functions
  Command: rg -n "function clearAccumulator|function flushAccumulatorAndActivate" packages/editor-2d/src/keyboard/router.ts
  Expected: ≥2 matches (one per declaration; closure-style `const` declarations also count if the regex matches `(const|function) clearAccumulator`)

Gate REM4-G1c: Enter handler branches on accumulator
  Command: rg -A 8 -n "key === 'Enter' && focus === 'canvas'" packages/editor-2d/src/keyboard/router.ts | rg "accumulator|flushAccumulatorAndActivate"
  Expected: ≥1 match (the new branch references accumulator)

Gate REM4-G1d: Space handler branches on accumulator
  Command: rg -A 12 -n "key === ' ' && focus === 'canvas'" packages/editor-2d/src/keyboard/router.ts | rg "accumulator|flushAccumulatorAndActivate"
  Expected: ≥1 match

Gate REM4-G2a: commandBar.accumulator field on store
  Command: rg -n "accumulator" packages/editor-2d/src/ui-state/store.ts
  Expected: ≥3 matches (slice declaration + default + setter)

Gate REM4-G2b: Numeric / punctuation routing in keyboard router
  Command: rg -n "0-9|setInputBuffer\(" packages/editor-2d/src/keyboard/router.ts
  Expected: ≥2 matches (regex character class for digits + setInputBuffer call site)

Gate REM4-G2c: DynamicInputPill component file exists + mounted in EditorRoot
  Commands:
    (a) ls packages/editor-2d/src/chrome/DynamicInputPill.tsx
        Expected: file exists
    (b) rg -n "DynamicInputPill" packages/editor-2d/src/EditorRoot.tsx
        Expected: ≥2 matches (import + JSX usage)

Gate REM4-G2d: Pill visibility gated on toggles.dynamicInput
  Command: rg -n "dynamicInput" packages/editor-2d/src/chrome/DynamicInputPill.tsx
  Expected: ≥1 match

Gate REM4-G2e: Click-eat guards in three EditorRoot handlers
  Command: rg -A 2 -n "const handleCanvasClick|const handleSelectRectStart|const handleGripDown" packages/editor-2d/src/EditorRoot.tsx | rg "inputBuffer\.length"
  Expected: ≥3 matches (one guard per handler)

Gate REM4-G2f: onSubmitBuffer callback wired
  Commands:
    (a) rg -n "onSubmitBuffer" packages/editor-2d/src/keyboard/router.ts packages/editor-2d/src/EditorRoot.tsx
        Expected: ≥3 matches (callback type + router call site + EditorRoot impl)

Gate REM4-9: Targeted test files pass
  Command: pnpm --filter @portplanner/editor-2d test -- tests/keyboard-router tests/ui-state tests/CommandBar tests/DynamicInputPill tests/smoke-e2e
  Expected: passes; G1 + G2 tests + migrated existing tests + 2 new smoke scenarios all green

Gate REM4-9b: Two new R4 smoke scenarios in SCENARIOS const + matching it() blocks
  Command: rg -n "'dynamic input pill: typing a number while in line tool shows pill \+ Enter submits'|'click is eaten while inputBuffer non-empty \(AC parity\)'" packages/editor-2d/tests/smoke-e2e.test.tsx
  Expected: ≥4 matches (each scenario name appears twice — SCENARIOS const + it() title)

Gate REM4-10: Workspace test suite passes
  Command: pnpm test
  Expected: all 6 packages pass; total ≥460 (post-Round-3 baseline 437 + ≥23 net-new across G1 ~6 + G2 ~10 + DynamicInputPill ~6 + ui-state ~2 + smoke ~2 — conservative threshold; may go higher with test migration adding sub-cases)

Gate REM4-11: Cross-cutting hard gates clean (DTP-T1/T2/T6/T7)
  Same commands as M1.3d §9. Expected: 0 offenders each.

Gate REM4-12: Typecheck + Biome + build
  Commands: pnpm typecheck, pnpm check, pnpm build
  Expected: all exit 0

Gate REM4-SPEC: docs/operator-shortcuts.md updated for AC-mode (G1 behavior change)
  Commands:
    (a) rg -n "^\*\*Version:\*\* 1\.2\.0" docs/operator-shortcuts.md
        Expected: 1 match (header version bumped to 1.2.0)
    (b) rg -n "^\| 1\.2\.0 " docs/operator-shortcuts.md
        Expected: 1 match (changelog row for 1.2.0 present)
    (c) rg -n "AC-mode|Enter or Space activates" docs/operator-shortcuts.md
        Expected: ≥1 match (behavior note present)
```

## 8. Done Criteria — objective pass/fail

- [ ] **G1** — Letter shortcuts at canvas focus do NOT auto-activate. Enter or Space activates the accumulated command. Escape clears. Verified by Gate REM4-G1a + G1b + G1c + G1d + REM4-9 (keyboard-router tests including `'letter alone does NOT activate'`, `'Enter at canvas focus + accumulator non-empty → activates'`, `'Space at canvas focus + accumulator non-empty → activates'`, `'Escape clears accumulator without activating'`).
- [ ] **G2** — Dynamic Input pill renders at the cursor showing the typed buffer / accumulator / active prompt. Numeric / punctuation keys at canvas focus route into `commandBar.inputBuffer`. Backspace edits. Enter submits via the same path the bottom command line's form uses. Click on canvas is eaten when buffer is non-empty. Pill hides when `toggles.dynamicInput === false`. Verified by Gate REM4-G2a + G2b + G2c + G2d + G2e + G2f + REM4-9 + REM4-9b (smoke scenarios `'dynamic input pill: typing a number while in line tool shows pill + Enter submits'` + `'click is eaten while inputBuffer non-empty (AC parity)'`).
- [ ] **Binding spec doc updated (G1 behavior change)** — `docs/operator-shortcuts.md` bumped 1.1.0 → 1.2.0 with AC-mode behavior note. Verified by Gate REM4-SPEC (a + b + c).
- [ ] All Phase REM4-G1a..REM4-SPEC + REM4-9..REM4-12 gates pass.
- [ ] Cross-cutting hard gates DTP-T1 / T2 / T6 / T7 pass (parent §9). Verified by Gate REM4-11.
- [ ] **Workspace test count** ≥ 460 (post-Round-3 baseline 437 + ≥23 net-new). REM4-10 provides the threshold; behavioral correctness via vitest's exit code; this checkbox is the human-review consistency check.
- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build` all pass (Gate REM4-12).

## 9. Risks and Mitigations

(Single canonical risk register per Round-1 Rev-4 lesson on §8/§11 duplication.)

| Risk | Mitigation |
|------|-----------|
| **G1 test rework volume.** Many existing keyboard-router + smoke-e2e tests use the `ACCUMULATOR_FLUSH_MS` wait pattern; migrating each is a non-trivial chunk of work. | §7 step 13-14 explicitly lists the migration. §4.1's row for `tests/keyboard-router.test.ts` enumerates the affected tests. Test migration is a known cost; doing it cleanly preserves the safety net. |
| G1 sub-option fast-path interaction unclear. Sub-options route letters to `onSubOption` BEFORE accumulator. With G1 changes, what happens when a letter doesn't match a sub-option but a tool is active? | Sub-option fast-path branch executes first and returns early when matched. When NOT matched, control falls through to `pumpAccumulator`. Under G1, pumping is silent — no activation until Enter. If user hits Enter with the accumulator holding a letter that doesn't match a sub-option, the existing tool aborts and the accumulated tool starts (AC parity). Documented in §3 A7. |
| G1 silent stale-clear (750 ms) might confuse users who type a letter, walk away, and find their accumulator gone. | AC behavior is similar (typing M then doing nothing also clears). The pill (G2) renders the accumulator visibly during the 750 ms window so the user sees what's happening. Documented in §3 A1. |
| G2 numeric routing might collide with shortcut keys we haven't defined yet (e.g., a future numeric-shortcut feature). | The captured set is fixed: digits 0-9, `.`, `-`, `,`, Backspace. Future numeric shortcuts would conflict with this — but that's true of any character we route to inputBuffer. Decision: reserve numerics for inputBuffer; numeric shortcuts (if ever added) would need a different convention (e.g., Ctrl+1 for Properties already exists; Ctrl+number is unaffected by canvas-focus key routing). Documented in §3 A8. |
| G2 click-eat surprises users who don't realize they have a buffer pending. | Pill (G2) makes the buffer visible. Pre-existing buffer pending → click no-op → pill is the visual cue that something's there. AC parity. Documented in §3 A6. |
| G2 pill positioning during canvas pan/zoom. Cursor coords might lag the actual pointer position briefly during high-frequency pan. | Pill anchors via `cursor.screen` which is updated by canvas-host's mousemove handler (rAF-coalesced). Same lag as the existing crosshair / snap glyph. Acceptable. |
| G2 DOM render at 60 Hz. Pill re-renders on every cursor change. | Pure render with no useEffect; React's reconciliation just updates the `transform` style. Cheap. The existing `data-component="cursor-readout"` chip already does this. |
| G2 pill vs CommandBar history append on submit. When Enter submits the buffer, does history record the input? | EditorRoot's `handleCommandSubmit` already appends to history when called via the form's onSubmit. The new `onSubmitBuffer` path goes through the same `handleCommandSubmit`, so history is recorded uniformly. SSOT preserved. |
| G2 pill stylesheet collision. New `.pill` class might collide with anything? | CSS modules scope class names per-file; `.pill` resolves to a unique generated name. No collision risk. |
| G1 + Escape semantics. Escape currently calls `flushAccumulator` which under the OLD code might have activated. Now Escape calls `clearAccumulator` which doesn't activate AND clears `inputBuffer`. Behavior change to verify. | New test in §4.1 `'Escape clears accumulator without activating'` + `'Escape clears inputBuffer'` covers both. Existing `'Escape aborts current tool and returns focus to canvas'` test still passes (the abort + focus parts are unchanged). |
| `setAccumulator` writes on every keystroke. Could thrash store. | Single string field; setState is cheap. The pill is the only consumer; it re-renders the same way the existing readout components do. |
| EditorRoot click-eat guard order: clicks during select-rect / grip-stretch already-running operation. Should the eat guard apply mid-drag? | The guard is on the START handlers (`handleSelectRectStart`, `handleGripDown`). Once a select-rect or grip-stretch is in flight, mouseup is forwarded by `handleCanvasMouseUp` — which doesn't gate on inputBuffer. That's fine: if the user managed to start a drag (because the buffer was empty at mousedown), they can finish it (the buffer presumably stayed empty). |

## 10. §1.3 Three-round self-audit

Per parent plans' §1 lesson (real adversarial pass, not a tabulated stand-in).

### Round 1 — Chief Architect (boundaries, invariants, SSOT)

- **C1.1 — Pill placement: chrome vs canvas overlay?** Two candidates: paint the pill on the canvas in the overlay pass (like the snap glyph), or render as a DOM sibling of the canvas. Decision: DOM sibling. Reasons: (a) text rendering quality is much better in DOM than canvas2D's `fillText`, (b) we already have an I-DTP-2 invariant (`paintTransientLabel` is the SOLE source of transient text on canvas; adding a second canvas text source would violate it), (c) the pill is a chrome surface (per A12 / A13), not a canvas overlay. SSOT preserved.
- **C1.2 — Accumulator publication: who owns the buffer?** Currently the accumulator is local-closure state in `registerKeyboardRouter`. Publishing it to the store as `commandBar.accumulator` introduces a second source of truth — but the router writes via setter and never reads the store back, so it's a one-way mirror (router → store → pill). The accumulator local var stays the primary source for routing logic; the store field is purely for read-only display by the pill. SSOT preserved (the local closure is canonical; the store mirror is derived).
- **C1.3 — Two distinct staging surfaces (accumulator vs inputBuffer): is this an SSOT violation?** No. They serve different purposes: accumulator is for command activation (which tool to start), inputBuffer is for value entry (what number to feed the active tool). AC keeps them distinct in its dynamic input UI too. Mixing them would lose the "did the user mean to start LINE or to type 5 into MOVE's prompt" distinction. Two streams, two consumers — clear separation.
- **C1.4 — Click-eat blast radius.** All three click handlers (`handleCanvasClick`, `handleSelectRectStart`, `handleGripDown`) get a single-line guard. Pure additive; no behavior change when the buffer is empty (the dominant case). The risk is a stuck buffer (e.g., user types numbers, walks away, comes back, clicks — click is eaten). G2's pill makes the stuck buffer visible; user can Esc to clear. Documented in §9.
- **C1.5 — `toggles.dynamicInput` reading.** Already plumbed via F12 (M1.3a Phase 8). The DI pill is the first runtime consumer of the toggle. Wiring it now means F12 actually does something visible — bonus side effect (positive). No behavior change to the toggle itself.

### Round 2 — Sceptical Reader (what would Codex flag?)

- **C2.1 — `flushAccumulatorAndActivate` lookup behavior.** Current `flushAccumulator` calls `lookupShortcut(accumulator)` and routes to `onActivateTool`. Under G1, this still works for both single-letter (`L` → draw-line) and multi-letter (`PL` → draw-polyline) cases. Need to verify: typing `XX` (xline alias) followed by Enter → `lookupShortcut('XX')` → 'draw-xline' → `onActivateTool('draw-xline')`. Yes — unchanged path.
- **C2.2 — Empty-accumulator Enter at canvas focus.** Old behavior: `onCommitCurrentTool` (commits in-flight). New behavior: same when accumulator is empty AND inputBuffer is empty AND no tool is active... wait, actually `onCommitCurrentTool` should fire even when no tool is active (it's a no-op via the `runningToolRef.current?.feedInput(...)` optional chain in EditorRoot). So old behavior preserved. ✓
- **C2.3 — Numeric routing at bar focus.** When the user has the bottom command line input focused (focusHolder='bar'), they type numbers — the bar input handles those natively (controlled input). Router doesn't intercept. The pill should ideally STILL show the buffer because both surfaces mirror the same `commandBar.inputBuffer`. But wait — at bar focus, the input's onChange writes to the inputBuffer via `setInputBuffer`. The pill reads inputBuffer. So the pill DOES show the buffer in real time even when typing in the bar. Cross-surface mirror works. ✓
- **C2.4 — Pill at bar focus.** When user focuses the bar input, focus transitions to 'bar'. The pill renders if buffer/accumulator/prompt non-empty AND `dynamicInput === true` AND cursor is on canvas. If cursor leaves the canvas (which happens when user moves to focus the bar), `overlay.cursor` is set to null by canvas-host's mouseLeave (need to verify) — pill returns null. Actually checking: canvas-host's mousemove-leave behavior... this needs the implementation to verify. If `cursor` stays non-null after pointer leaves, the pill might render at a stale position. Mitigation: pill explicitly checks `if (!cursor) return null;` (already in step 10). For users who just type without ever moving the cursor on canvas first, `cursor === null` → pill hidden. They use the bottom command line in that case. Acceptable.
- **C2.5 — `setInputBuffer` is the ONLY mutator for buffer.** Currently the bottom command line input uses `setInputBuffer` via onChange, AND now the keyboard router uses it for numeric capture. Two writers. Order matters: which writes "win" if both fire on the same tick? In practice they don't fire concurrently — focus is either canvas or bar, not both. Single-writer-at-a-time invariant via focus exclusivity. ✓
- **C2.6 — Backspace at canvas focus when buffer is empty.** Step 6 says "fall through". That means the keyboard router doesn't preventDefault, and the browser's default Backspace behavior fires — which on most pages is "go back in history". On a canvas-focused page, Backspace usually does nothing (no input element to delete from). Verify: jsdom doesn't implement go-back; production browsers might. Acceptable: the user can configure browser shortcuts; we don't actively suppress Backspace because that's annoying. Defensive: the router's existing pattern is to only preventDefault when we ACTIVELY handle a key. ✓
- **C2.7 — Pill and command line history append.** When Enter at canvas focus submits the buffer via `onSubmitBuffer`, EditorRoot calls `handleCommandSubmit(raw)`. Looking at the current `handleCommandSubmit` — it does NOT append to history (history append is in CommandBar.tsx's onSubmit wrapper). So the pill submit path bypasses history append. Need to fix: either add history append to `handleCommandSubmit` itself, or to the new `onSubmitBuffer` impl in EditorRoot. Cleaner: add to `onSubmitBuffer` impl with the same history append shape as CommandBar.tsx (`editorUiActions.appendHistory({ role: 'input', text: raw, timestamp: ... })`). **Action: update step 8 to include this.**
- **C2.8 — Test count math.** Net-new estimate ≈ 23 (G1 router ×6 + G2 router ×5 + ui-state ×2 + DynamicInputPill ×6 + smoke ×2 = ~21; conservative ≥460 = baseline 437 + 23). Migrated existing tests stay in the count (they're not new, they're updates). ✓

### Round 3 — Blast Radius (what could break elsewhere?)

- **C3.1 — Existing keyboard-router tests using ACCUMULATOR_FLUSH_MS.** All listed in §4.1 + §7 step 13. Migration is mechanical: add explicit Enter/Space press after the letter, then assert immediately (no more 800 ms wait). Net effect on test execution time: faster (no 800 ms idle waits per test).
- **C3.2 — Existing smoke-e2e scenarios using ACCUMULATOR_FLUSH_MS.** Same migration. Listed in §7 step 14. Smoke suite gets faster overall.
- **C3.3 — `editorUiActions.setInputBuffer` consumers.** Currently only `CommandPromptLine.tsx` (the bar input's onChange). Adding the keyboard router as a second writer is additive. The existing onChange fires only when the user types into the bar input element — focus is 'bar'. Adding canvas-focus keypress writes is a different focus state. No collision.
- **C3.4 — `editorUiActions.setAccumulator` is brand new.** No existing consumers. Sole writer is the keyboard router; sole reader is the pill. Adding it doesn't affect anything else.
- **C3.5 — DynamicInputPill bundle size.** Small component (~50 LOC) + small CSS module (~30 LOC). Estimated +1-2 kB raw / +0.5 kB gz. Bundle was 445 kB raw / 128.55 kB gz at Rem-3 baseline. New estimate: ~447 kB raw / ~129 kB gz. Well under budget.
- **C3.6 — F12 toggle: did anything depend on `dynamicInput` being unwired?** Searching… no — `toggles.dynamicInput` is set/read but no rendering branch consumed it. Wiring it as the pill visibility gate is purely additive. F12 was already a user-facing toggle (M1.3a).
- **C3.7 — Click-eat in EditorRoot: does it break the existing 'grip stretch updates primitive' smoke scenario?** That scenario fires mousedown on a grip with NO active tool AND empty buffer. The new guard is `inputBuffer.length > 0` → return. Empty buffer → guard passes through → existing path (start grip-stretch). Unchanged behavior for empty buffer. ✓
- **C3.8 — Click-eat and the F5 smoke scenario `'grip click during running tool feeds point'`.** That scenario activates MOVE (via 'M' keyDown), clicks base point, etc. Under G1 + G2, the M activation now requires Enter — test must add `fireEvent.keyDown(window, {key: 'Enter'})` after the M. Then base-point click — buffer is empty, click passes through. Then second click on a grip — same. No regression beyond the test migration. ✓

## 11. Test strategy

**Tests existing before:** baseline at commit `63380bb` is 437 / 437 across 6 packages.

**Tests added by this remediation (~23-30 net-new):**

- **G1 keyboard router (~6 tests):** `'letter alone does NOT activate without Enter or Space'`, `'Enter at canvas focus + accumulator non-empty → activates the accumulated tool'`, `'Space at canvas focus + accumulator non-empty → activates the accumulated tool'`, `'Escape clears accumulator without activating'`, `'Escape clears inputBuffer'`, `'750 ms idle clears accumulator silently (no activation)'`.

- **G1 ui-state (~2 tests):** `'commandBar.accumulator default is empty string'`, `'setAccumulator stores and clears'`.

- **G2 keyboard router numeric routing (~5 tests):** `'digit at canvas focus appends to inputBuffer'`, `'comma + minus + dot at canvas focus append to inputBuffer'`, `'Backspace at canvas focus pops the last char from inputBuffer'`, `'Backspace when inputBuffer empty is a no-op'`, `'Enter at canvas focus + inputBuffer non-empty + tool active → onSubmitBuffer fires with buffer contents'`.

- **G2 DynamicInputPill (~6 tests):** `'pill renders inputBuffer when non-empty'`, `'pill renders accumulator when buffer empty + accumulator non-empty'`, `'pill renders activePrompt when both buffers empty + prompt active'`, `'pill hides when toggles.dynamicInput is false'`, `'pill hides when nothing to render'`, `'pill anchors at cursor.screen + offset'`.

- **G2 click-eat in EditorRoot.test.tsx if exists, otherwise smoke (~1 test).**

**Smoke E2E new scenarios (2 net-new):**
- `'dynamic input pill: typing a number while in line tool shows pill + Enter submits'` — F1 + G2 SOLE integration validation. Replaces or extends the existing `'direct distance entry'` scenario.
- `'click is eaten while inputBuffer non-empty (AC parity)'` — G2 SOLE integration validation for the click-eat path.

**Tests intentionally not added (deferred):**
- Visual regression for the pill — out of scope (no image-diff infra).
- Multi-modifier combinations (Ctrl+number etc.) — not in scope.

**Migrated existing tests (no count change; ~8-12 tests):**
- `tests/keyboard-router.test.ts`: `'single-letter "L"...'`, `'multi-letter "P" then "L"...'`, `'"L" without further input...'`. All replace `await wait(800)` with explicit Enter/Space.
- `tests/smoke-e2e.test.tsx`: `'draw line and reload'`, `'layer manager flow'`, `'live preview during line draw'`, `'snap glyph appears at endpoint'`, `'direct distance entry'`, `'grip click during running tool feeds point'`, `'spacebar repeats last command'`. All add explicit Enter (or Space) after letter activation.

## 12. Why this is one phase, not many

- G1 and G2 are interdependent: G1's accumulator publication is consumed by G2's pill; G2's submit semantics depend on G1's Enter/Space branching policy.
- Test migration spans both G1 (auto-flush removal) and G2 (new pill + routing). Doing them separately would force a second migration pass.
- Total LOC: ~150-200 production + ~150-200 tests.
- Single phase keeps the Procedure-03 audit cycle tight (one phase audit + one self-review loop).

---

## Plan Review Handoff

(Footer convention per Round-1 Rev-5 lesson: revision-history table at the top of this file is the SSOT for the hash chain; the footer points at the table rather than inlining self-referential hashes.)

**Plan:** `docs/plans/feature/m1-3d-drafting-polish-remediation-4.md`
**Branch:** `feature/m1-3d-drafting-polish` (atop `63380bb`)
**Status:** Plan authored — awaiting Codex Round-1 review

### Paste to Codex for plan review
> Review this plan using `docs/procedures/Codex/02-plan-review.md`
> (Procedure 02). Apply strict evidence mode. Start from Round 1.
>
> Context: this is the FOURTH remediation pass on `feature/m1-3d-drafting-polish`,
> covering two AutoCAD-parity behaviors surfaced by the user during manual
> testing of M1.3d-Rem-3 at `63380bb`:
> - **G1**: AC-mode keyboard accumulator (letter shortcuts require Enter
>   or Space to activate; current code auto-activates on the 750 ms
>   timeout, which blocks `MI` for Mirror, `MA` for Match-Properties,
>   etc.).
> - **G2**: Dynamic Input pill at the cursor — new chrome component that
>   echoes the in-flight `inputBuffer` / `accumulator` / `activePrompt`
>   anchored at `overlay.cursor.screen`. Numeric / punctuation keys at
>   canvas focus route into `inputBuffer`. Click-eat when buffer is
>   non-empty (AC parity). Wires the existing `toggles.dynamicInput`
>   F12 toggle as the visibility gate.
>
> G3 (W,H comma-separated input) is explicitly deferred — the existing
> two-prompt W/H flow becomes usable once G2 lands; AC itself uses two
> prompts there.
>
> Round 1 (R1/R2a/R2b/R4 + QG-1/QG-2 + Rev-5 footer fix) is at `2c13b49`.
> Round 2 (R5/R6/R7 + Rev-3 gate-polish + Procedure-05 wire-intersect bug
> fix) is at `98e0915`. Round 3 (F1-F7 + Rev-1 B1 spec doc + Codex
> Round-1 governance fix) is at `63380bb`. Round 4 starts here.
>
> Parent plans + Round-1 / Round-2 / Round-3 plan files + their revision
> histories + post-execution / post-commit notes are the authoritative
> context for invariants, gates, and the existing implementation surface.

### Paste to user for approval
> Please review the plan at
> `docs/plans/feature/m1-3d-drafting-polish-remediation-4.md`. After
> approval, invoke Procedure 03 to execute the single phase.
