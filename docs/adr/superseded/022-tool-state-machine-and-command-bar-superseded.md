# ADR-022 — Tool State Machine and Command Bar

**Status:** SUPERSEDED
**Superseded by:** ADR-023 (`docs/adr/023-tool-state-machine-and-command-bar.md`)
**Date:** 2026-04-23
**Supersedes:** none (new concept)

## Context

ADR-013 (superseded by ADR-021) explicitly left "Tool state machine (SELECT, LINE, POLYGON, RTG_BLOCK)" as an execution-phase design choice. During M1.3 planning (2026-04-23), the user committed to an AutoCAD-style interaction model: every drafting / modify operator drives prompts through a bottom-positioned **command bar**, with sub-option brackets (`[Reference/Undo]`), keyboard shortcuts, history scrollback, and focus management.

This interaction model is ubiquitous across drafting. Every tool, every modifier, every sub-prompt routes through the same bar. Retrofitting the bar onto tools built without it is expensive — every state machine would need refactoring. This ADR pins the framework *before* M1.3a starts so tools are built against it from the start.

**Scope:** command bar as REPL-ish UI surface, tool state machines as prompt-driven generators, keyboard routing, focus discipline, sub-option chains, and the operator shortcut map. Per-operator prompt flows are execution-phase artifacts under the M1.3a / b / c plans.

## Options considered

### 1. Tool state machine shape

- **A. Ad hoc state machines per tool.** Each tool owns its state management; no shared abstraction.
- **B. Generator-pattern prompt-driven machines.** Each tool is a function that `yield`s prompts and consumes input; framework handles input routing.
- **C. Statechart library (XState).** Declarative state machines; more abstraction than needed.

### 2. Command input surface

- **A. Modal dialogs per operator.** Every operator opens a modal; bar is history-only.
- **B. AutoCAD-style persistent command bar.** Bottom UI; always-visible; current prompt + sub-options + history.
- **C. Inline floating toolbar near cursor.** Dynamic input at cursor; no persistent bar.

### 3. Keyboard routing

- **A. All keys always route to canvas.** Bar reacts only to explicit focus.
- **B. Context-aware routing.** Canvas has focus by default; letter keys route to bar when a tool is active; bar keeps focus during a prompt chain; Escape returns to canvas.
- **C. Dual-focus.** Canvas and bar both receive keys simultaneously.

### 4. Sub-option chain representation

- **A. Nested modal dialogs.** Each sub-prompt opens a new modal.
- **B. Bracket notation in bar.** `Specify rotation angle or [Reference/Copy/Undo] <default>:` — letter activates sub-state.
- **C. Right-click context menus.** Sub-options never appear in the bar.

## Decision

| # | Area | Choice | Rationale |
|---|------|--------|-----------|
| 1 | Tool state machine | **B. Generator-pattern prompt-driven machines.** Each tool is an async generator (or equivalent) that yields `Prompt` descriptors and consumes `Input` events. A central `ToolRunner` drives the generator and routes canvas / keyboard / bar events into it. | DRY — all tools share input routing, history, Escape-to-abort. Sub-prompts are just nested yields, no framework refactoring per-tool. Statecharts (C) are over-engineered for this scale; ad-hoc (A) fragments. |
| 2 | Command input surface | **B. Persistent bottom command bar.** Always visible, always interactive. Current prompt, current sub-options, scrollback, typed input line. | Matches AutoCAD mental model; drafters type commands by letter while keeping eyes on canvas. Modal-only (A) interrupts flow; floating (C) is hard to scan history. |
| 3 | Keyboard routing | **B. Context-aware.** Canvas focus by default. When user types a command letter (or sub-option letter while a prompt is active), bar takes focus and accumulates input. Escape always aborts current tool and returns focus to canvas. Dialogs take focus modally. | Matches every CAD tool. Canvas-only (A) loses letter shortcuts; dual-focus (C) is ambiguous and causes key-drop bugs. |
| 4 | Sub-option chain | **B. Bracket notation in bar.** Format: `Specify rotation angle or [Reference/Copy/Undo] <default>:`. Each bracketed word is clickable AND keyboard-activatable (first letter, or whole word). Triggers a sub-state within the same tool generator. | Matches AutoCAD exactly; drafters recognise the pattern instantly. Nested dialogs (A) interrupt flow; right-click-only (C) buries options. |

### Command bar schema

```typescript
interface CommandBarState {
  activePrompt: string | null;                // current prompt text or null when idle
  subOptions: SubOption[];                    // bracket options for the current prompt
  defaultValue: string | null;                // <default> value, Enter accepts
  inputBuffer: string;                        // what the user has typed so far
  history: CommandHistoryEntry[];             // scrollback, append-only
  activeToolId: ToolId | null;                // which tool owns the prompt, if any
}

interface SubOption {
  label: string;                              // display text, e.g., "Reference"
  keyboardShortcut: string;                   // single letter, typically first char of label
  action: () => void;                         // enters the sub-state
}

interface CommandHistoryEntry {
  role: 'prompt' | 'input' | 'response' | 'error';
  text: string;
  timestamp: string;
}
```

### Tool generator shape

```typescript
type ToolGenerator = AsyncGenerator<Prompt, ToolResult, Input>;

interface Prompt {
  text: string;                               // e.g., "Specify base point"
  subOptions?: SubOption[];                   // bracket options
  defaultValue?: string;
  acceptedInputKinds: Array<'point' | 'number' | 'angle' | 'distance' | 'entity' | 'subOption'>;
}

type Input =
  | { kind: 'point'; point: Point2D }
  | { kind: 'number'; value: number }
  | { kind: 'angle'; radians: number }
  | { kind: 'distance'; metres: number }
  | { kind: 'entity'; entityId: UUID; entityKind: TargetKind }
  | { kind: 'subOption'; optionLabel: string }
  | { kind: 'escape' };
```

Example ROTATE tool (pseudo):

```
async function* rotateTool(): ToolGenerator {
  // Prompt 1: select objects (if none already selected)
  if (selection.isEmpty()) {
    const selected = yield { text: 'Select objects', acceptedInputKinds: ['entity'] };
  }

  // Prompt 2: base point
  const base = yield { text: 'Specify base point', acceptedInputKinds: ['point'] };

  // Prompt 3: angle or reference sub-option
  const angleOrRef = yield {
    text: 'Specify rotation angle',
    subOptions: [{ label: 'Reference', keyboardShortcut: 'r', action: () => {/* sub-state */} }],
    acceptedInputKinds: ['angle', 'number', 'subOption']
  };

  if (angleOrRef.kind === 'subOption' && angleOrRef.optionLabel === 'Reference') {
    // Sub-state: collect reference angle
    const refFrom = yield { text: 'Specify reference angle — from', acceptedInputKinds: ['point', 'angle'] };
    const refTo = yield { text: 'Specify reference angle — to', acceptedInputKinds: ['point', 'angle'] };
    const refAngle = computeAngle(refFrom, refTo);
    const newAngle = yield { text: 'Specify new angle', acceptedInputKinds: ['angle', 'number'] };
    return applyRotation(selected, base, newAngle.value - refAngle);
  } else {
    return applyRotation(selected, base, angleOrRef.radians ?? angleOrRef.value);
  }
}
```

The `ToolRunner` consumes this generator, feeds canvas clicks / bar input / keyboard shortcuts in as `Input` events, and commits the final transformation through the project store (which emits ADR-020 operations).

### Keyboard routing rules

- **Canvas has focus** (default): hotkeys activate tools; mouse events flow to the canvas paint loop; arrow keys pan.
- **Bar has focus** (after user types a command letter, or after bar click): letter keys accumulate in `inputBuffer`; Enter submits; Escape aborts and returns canvas focus.
- **Dialog has focus** (promotion parameter dialog, layer manager, etc.): keyboard and mouse scoped to the dialog; Escape closes it and returns to the previous focus holder.
- **Function-key toggles** (F3 OSNAP, F8 Ortho, etc.): always active regardless of focus.

### Operator shortcut map (M1.3a–M1.3c scope)

Per user's 2026-04-23 commitments:

| Shortcut | Operator | Phase landing |
|---|---|---|
| `S` | Select (modal default; Escape returns here) | M1.3a |
| `E` / `DEL` | Erase | M1.3a |
| `M` | Move | M1.3a |
| `C` | Copy | M1.3a |
| `U` / `Ctrl+Z` | Undo | M1.3a |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo | M1.3a |
| `Z` | Zoom (with sub-options: Extents, Window, Previous) | M1.3a |
| `P` | Pan (modeless; middle-mouse-drag also) | M1.3a |
| `Ctrl+1` | Properties | M1.3a |
| `LA` | Layer Manager | M1.3a |
| `Escape` | Cancel current tool; return to Select | M1.3a |
| `F3` | OSNAP toggle | M1.3a |
| `F8` | Ortho toggle | M1.3a |
| `F9` | GSNAP (grid snap) toggle | M1.3a |
| `F10` | POLAR toggle | M1.3c |
| `F11` | OTRACK toggle | M1.3c |
| `F12` | Dynamic Input / command bar toggle | M1.3a |
| `R` | Rotate | M1.3b |
| `MI` | Mirror | M1.3b |
| `SC` | Scale | M1.3b |
| `O` | Offset | M1.3b |
| `F` | Fillet | M1.3b |
| `CHA` | Chamfer | M1.3b |
| `TR` | Trim | M1.3b |
| `EX` | Extend | M1.3b |
| `J` | Join (PEDIT-style; required by ADR-016 for multi-primitive merge) | M1.3b |
| `X` | Explode (primitive-level only; typed-object explode rejected) | M1.3b |
| `BR` | Break | M1.3b |
| `AR` | Array (rectangular / polar) | M1.3b |
| `MA` | Match Properties (painter UX) | M1.3b |
| `CV` or right-click "Convert to…" | Promote (primitive → typed object) | M1.3b |
| `CL` | Classify (change typed-object classification) | M1.3b |
| *(re-align)* | Re-align (ROAD canonical-axis shift; see ADR-016) | M1.3b |
| `DIMLINEAR`, `DIMRADIUS`, `DIMANGULAR` | Dimension operators | M1.3c |

**Deferred:** `STRETCH` (would conflict with `S` Select; shortcut TBD, post-M1 unless demand).

**Deferred explicitly rejected:** Typed-object `EXPLODE` (would break ADR-019 provenance). Parametric / driving dimensions (ADR-018 rejects).

### Sub-option discipline

Every operator that has alternative prompt paths exposes them as bracket sub-options. Each sub-option has:
- A label (display text; e.g., "Reference")
- A single-letter keyboard shortcut (typically first character, lowercase)
- An action handler that transitions the tool generator into the sub-state

Sub-options render in the bar as `[Reference/Copy/Undo]`. Clicking a bracket word or pressing its first letter (while bar has focus) activates the sub-option.

## Consequences

- Every tool shares a single input-routing framework; per-tool code is just the generator.
- Sub-prompts are cheap — nested yields, not new state objects.
- Keyboard routing is deterministic and debuggable.
- Adding a new operator in M2 requires: (a) register its shortcut, (b) write its generator, (c) list it in this ADR's shortcut map (changelog bump).
- Command bar is the single source of truth for "what is the app asking me to do right now?" — replaces scattered modal dialogs.

## What this makes harder

- Focus management is an invariant with multiple actors (canvas, bar, dialogs); bugs tend to be "key dropped" or "wrong receiver". Mitigated by explicit focus-holder state in a single top-level store.
- Tools that need mid-flow cancellation (e.g., Escape during sub-option prompt) must handle generator cancellation cleanly — framework responsibility.
- Command history scrollback in a long session can grow unbounded; retention policy (clear on new project, cap at N entries, ...) is an M1.3a execution-phase concern.
- Shortcut collisions are a real risk as operators multiply; this ADR's shortcut map is the authoritative index and must be consulted before adding a new operator.

## Cross-references

- **ADR-011** UI Stack — command bar is a design-system component; Lucide icons for bracket sub-option visual hints.
- **ADR-016** Drawing Model — promotion `CV` operator; primitives' snap targets.
- **ADR-017** Layer Model — `LA` operator opens layer manager dialog.
- **ADR-018** Dimension Model — dimension operators in M1.3c.
- **ADR-019** Object Model v2 — `CL` operator modifies classification; `EXPLODE` rejected for typed objects.
- **ADR-020** Project Sync v2 — every operator commits through the project store, emitting ADR-020 operations.
- **ADR-021** 2D Rendering Pipeline v2 — tool overlays render via `overlayState` during tool execution.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-23 | Initial ADR. Pins tool state machine (generator-pattern), command bar UI, keyboard routing rules, sub-option bracket notation, operator shortcut map for M1.3a / b / c. |
