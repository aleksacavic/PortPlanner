// editor-2d UI state store — vanilla zustand + immer only.
// Undo middleware is intentionally absent (UI state not undoable per
// ADR-015 / I-35).
//
// Slices: viewport, selection, activeTool, toggles, command-bar, focus,
// overlay. Each slice declares its own shape; the store composes them
// into a single state object exposed via projectEditorUiStore.
//
// M1.3d Phase 1 extends `viewport` (crosshairSizePct lives on Viewport
// itself in view-transform.ts) and `overlay` (cursor / previewShape /
// hoverEntity / grips / suppressEntityPaint), adds
// per-field setters, and re-exports the local-to-overlay forward types
// `Grip`, `TransientLabel`, and `SnapTarget` (alias for SnapHit). The
// `PreviewShape` discriminated union is owned by `../tools/types` to
// keep the tool-runner contract co-located with tool generators.

import type { LayerId, Point2D, PrimitiveId } from '@portplanner/domain';
import { immer } from 'zustand/middleware/immer';
import { createStore } from 'zustand/vanilla';

import type { ScreenPoint, Viewport } from '../canvas/view-transform';
import type { SnapHit } from '../snap/priority';
import type {
  AcceptedInputKind,
  DimensionGuide,
  DynamicInputManifest,
  PreviewShape,
} from '../tools/types';

/**
 * Snap target highlighted under the cursor — alias of the snap engine's
 * `SnapHit` so the overlay carries the same shape the resolver returns.
 * Re-exported for callers that read `overlay.snapTarget` and only need
 * the overlay-local symbol.
 */
export type SnapTarget = SnapHit;

/**
 * Interactive grip square painted at a key point of a selected entity
 * (line endpoints, polyline vertices, rectangle corners, circle quadrant
 * points + center, arc endpoints + midpoint, xline pivot). Click-and-
 * drag a grip to stretch the entity. Defined in Phase 1 for slice
 * typing; consumed by Phase 5 (`gripsOf`, `paintSelection`) and Phase 6
 * (`gripHitTest`, `grip-stretch` tool).
 */
export interface Grip {
  entityId: PrimitiveId;
  /** Per-kind identifier (e.g. 'p1', 'p2', 'vertex-3', 'corner-nw',
   *  'center', 'mid', 'pivot'); the grip-stretch tool uses this to
   *  decide which patch field to update on commit. */
  gripKind: string;
  position: Point2D;
}

export type FocusHolder = 'canvas' | 'bar' | 'dialog';

export interface CommandBarHistoryEntry {
  role: 'prompt' | 'input' | 'response' | 'error';
  text: string;
  timestamp: string;
}

export interface SubOption {
  label: string;
  shortcut: string;
}

export interface CommandBarState {
  activePrompt: string | null;
  subOptions: SubOption[];
  defaultValue: string | null;
  inputBuffer: string;
  history: CommandBarHistoryEntry[];
  activeToolId: string | null;
  /**
   * Input kinds the active prompt is willing to accept. Published by
   * the tool runner alongside the prompt text. Phase 3's snap-on-cursor
   * effect gates on `acceptedInputKinds.includes('point')` so the snap
   * engine doesn't run (and the snap glyph doesn't show) when the
   * active prompt only wants a number / distance / angle / etc.
   * Empty when no prompt is active.
   */
  acceptedInputKinds: AcceptedInputKind[];
  /**
   * M1.3d-Remediation-3 F1 — direct distance entry anchor published by
   * the tool runner from `prompt.directDistanceFrom`. When non-null
   * AND the user types a numeric input AND `overlay.lastKnownCursor`
   * is non-null, EditorRoot.handleCommandSubmit transforms the number
   * into a 'point' input at `anchor + unit(cursor - anchor) * distance`
   * (AutoCAD direct-distance entry). Null when no prompt is active OR
   * the active prompt's numeric semantic is something other than a
   * cursor-direction distance (e.g. typed Width/Height for rectangle's
   * Dimensions sub-option).
   */
  directDistanceFrom: Point2D | null;
  /**
   * M1.3d-Remediation-3 F6 — most recently completed (or aborted)
   * user-invoked tool id. Captured by the tool runner's finally block
   * when `setActiveToolId(null)` fires after a non-null id that is
   * NOT in `EXCLUDED_FROM_LAST` (`select-rect`, `grip-stretch`,
   * `escape` — modeless / system tools never user-invoked). Spacebar
   * at canvas focus with no active tool re-invokes this id; null
   * means the very first spacebar after page load is a no-op.
   */
  lastToolId: string | null;
  /**
   * M1.3d-Remediation-4 G1 — multi-letter shortcut staging buffer
   * published by the keyboard router. Mirrors the router's local
   * accumulator string so the Dynamic Input pill (G2) can render the
   * in-progress shortcut as the user types. Read-only from the pill;
   * sole writer is the keyboard router via `setAccumulator`. Default
   * `''` (empty string).
   *
   * Stream separation: this slice holds LETTERS being assembled into
   * a tool-activation shortcut (e.g. `LA` → Layer Manager). The
   * sibling `inputBuffer` field holds DIGITS / punctuation / Backspace
   * for value entry into the active tool's prompt. Two distinct
   * streams matching AC's mental model (see plan §3 A4 / A10b).
   */
  accumulator: string;
  /**
   * M1.3 Round 6 — Dynamic Input multi-field state. Published by the
   * tool runner on prompt-yield with `prompt.dynamicInput` set; cleared
   * on tool teardown OR yielded prompt without manifest. Plan §3 A2.1:
   * sparse — manifest carries NO anchor info; anchor coords live on
   * `overlay.dimensionGuides`.
   *
   * Buffer reset semantics (Rev-1 R2-A5): each prompt yield with a
   * manifest resets `buffers` to `Array(manifest.fields.length).fill('')`
   * and `activeFieldIdx` to 0. Polyline-loop iterations therefore
   * start with empty buffers per leg.
   */
  dynamicInput: {
    manifest: DynamicInputManifest;
    buffers: string[];
    activeFieldIdx: number;
    /**
     * Round 7 Phase 2 — buffer-persistence identity for the active
     * prompt. Computed by the runner per A16:
     * `${toolId}:${prompt.persistKey ?? promptIndex}`. Used by the
     * pill chrome to look up `dynamicInputRecall[promptKey]` for
     * placeholder seeding (Phase 1-3) / ArrowUp recall (Phase 4) and
     * by EditorRoot.onSubmitDynamicInput to record the submitted
     * buffers under this key.
     */
    promptKey: string;
    /**
     * **M1.3 DI pipeline overhaul Phase 1** — per-field lock state.
     * Parallel to `buffers`; `true` when the field's value is frozen
     * via Tab (set by router when Tab transitions a typed field).
     * Live-cursor read on the pill is suppressed for locked fields
     * (Phase 2 chrome behavior). Initialized to
     * `Array(N).fill(false)` on every manifest publish (sibling to
     * the `buffers: Array(N).fill('')` reset). Plan invariant I-DI-1.
     */
    locked: boolean[];
    /**
     * **M1.3 DI pipeline overhaul Phase 4 (B8)** — recall pill state.
     * `true` when the user has pressed ArrowUp on a DI prompt that has
     * a prior submit recorded under its promptKey: per-field pills dim
     * + a recall pill renders at cursor + (16, 28) CSS-px offset
     * showing `${label}=${value}` joined ` / ` for the recalled
     * buffers. Rubber-band freezes during recall (runner subscription
     * short-circuits per A16). Cancelled by Tab / ArrowDown / Esc;
     * accepted by Enter / Space (commits using the recalled buffers
     * via the standard onSubmitDynamicInput path). Initialized to
     * `false` on every manifest publish. Plan invariants I-DI-10 + I-DI-11.
     */
    recallActive: boolean;
  } | null;
  /**
   * Round 7 Phase 2 — buffer persistence within tab. Key =
   * `${toolId}:${prompt.persistKey ?? promptIndex}` (canonical per
   * plan A16). Value = the per-field buffer array submitted on the
   * most recent successful `onSubmitDynamicInput` for that prompt
   * key. Cleared on page reload (lives only in editorUiStore;
   * never written to IndexedDB / project-store / API per I-DI-13).
   *
   * **M1.3 DI pipeline overhaul Phase 1** — slice renamed at this
   * round to force every consumer to acknowledge the consumption-
   * pattern change (placeholder pre-fill in Phases 1-3 → ArrowUp
   * recall pill in Phase 4). Map shape unchanged.
   */
  dynamicInputRecall: Record<string, string[]>;
}

export interface OverlayState {
  /**
   * Latest cursor metric + screen position. `null` when no mousemove
   * has yet occurred OR the cursor has left the canvas (I-DTP-2).
   * Written by canvas-host's rAF-coalesced mousemove handler via
   * EditorRoot in Phase 2.
   */
  cursor: { metric: Point2D; screen: ScreenPoint } | null;
  /**
   * Snap target highlighted under the cursor (with kind + point), or
   * `null` when no tool awaits a 'point' input or all snap toggles
   * are off (I-DTP-7). Written by EditorRoot's snap-on-cursor effect
   * in Phase 3; read by `paintSnapGlyph` during the overlay pass.
   */
  snapTarget: SnapTarget | null;
  /** Guides drawn during a tool prompt (e.g., ortho-axis lines). */
  guides: Array<{ from: Point2D; to: Point2D }>;
  /** Selection handles to draw on top of selected entities (legacy
   *  field from M1.3a; superseded by `grips` for click-select grip
   *  squares — kept for compatibility until Phase 5 wires grips). */
  selectionHandles: Point2D[];
  /**
   * In-flight visualisation a tool yields. Painted during the overlay
   * pass by `paintPreview` (line / polyline / rectangle / circle / arc
   * / xline) or `paintSelectionRect` (selection-rect arm). UI-only
   * state — `paintPreview` reads ONLY here, never `projectStore`
   * (I-DTP-9, Gate DTP-T6).
   */
  previewShape: PreviewShape | null;
  /**
   * Entity under the cursor when no tool is active — paints a faint
   * outline highlight via `paintHoverHighlight` (Phase 5). Updated
   * only when `activeToolId === null` (I-DTP-12).
   */
  hoverEntity: PrimitiveId | null;
  /**
   * Click-select grip squares for entities currently in `selection`.
   * `null` when no entity is selected (Phase 5 sets after computing
   * `gripsOf` for each selected primitive). Grips appear ONLY on
   * click-select, NEVER on hover (I-DTP-11).
   */
  grips: Grip[] | null;
  /**
   * When set, the entity-pass painter skips painting the entity with
   * this id. Used by grip-stretch (Phase 6) so the user sees only the
   * modified-entity preview during a drag, not the original entity
   * AND the preview overlapping. Cleared on grip-stretch commit/abort.
   */
  suppressEntityPaint: PrimitiveId | null;
  /**
   * M1.3d-Remediation-2 R7 — pointer to the grip the cursor is closest
   * to (within `gripHitTest`'s 4 CSS-px tolerance). When set, paintSelection
   * renders THAT grip with amber fill + 9×9 CSS px instead of the default
   * blue + 7×7. Set by an EditorRoot cursor-effect; null when no grip is
   * within tolerance OR when no entity is selected (`overlay.grips === null`).
   * AutoCAD parity: signals to the user which grip clicking will grab.
   */
  hoveredGrip: { entityId: PrimitiveId; gripKind: string } | null;
  /**
   * M1.3d-Remediation-3 F1 — last non-null cursor metric seen on canvas.
   * Captures the latest `cursor.metric` and NEVER clears once set. Used
   * by direct-distance entry: when the pointer is over the command bar,
   * `overlay.cursor` is null (the cursor isn't on canvas) but the user
   * still needs a "where the cursor was" to compute the direction. F1
   * routing reads this. paintCrosshair stays bound to the live
   * `overlay.cursor` (only paint when cursor is actually on canvas);
   * `lastKnownCursor` is purely a memory of the last-seen position.
   */
  lastKnownCursor: Point2D | null;
  /**
   * M1.3 Round 6 — Dimension-guide descriptors written by per-tool
   * cursor-effect (extends the existing `Prompt.previewBuilder` pattern
   * via sibling `Prompt.dimensionGuidesBuilder`). Read by
   * `paintDimensionGuides` (overlay-pass painter; flat metric coords
   * only, no resolution logic) and by the multi-pill chrome
   * (`DynamicInputPills`) for per-pill anchor positioning.
   *
   * Plan §3 A2.1 publication contract: dynamic — written every
   * cursor-tick AND seeded synchronously on prompt-yield (Rev-3 H2
   * first-frame coherence; sync seed wrapped with `inSyncBootstrap`
   * try/finally per Rev-4 H + Rev-6 single-method re-entrancy guard).
   * Cleared on tool teardown OR yielded prompt without manifest.
   *
   * Shape invariant: when `commandBar.dynamicInput.manifest !== null`,
   * `dimensionGuides !== null && dimensionGuides.length ===
   * manifest.fields.length`.
   */
  dimensionGuides: DimensionGuide[] | null;
}

/**
 * M1.3d-Remediation-3 F2 — global modifier-key state. Updated by the
 * keyboard router's `keydown` / `keyup` / `blur` listeners. Currently
 * only `shift` is tracked (consumed by `draw-rectangle` to force the
 * preview / commit to a 1:1 aspect ratio when held). Other modifiers
 * (alt, ctrl, meta) extend the same slice when needed; SSOT preserved.
 */
export interface ModifiersState {
  shift: boolean;
}

export interface EditorUiState {
  viewport: Viewport;
  selection: PrimitiveId[];
  activeToolId: string | null;
  activeLayerId: LayerId | null;
  toggles: {
    osnap: boolean;
    ortho: boolean;
    gsnap: boolean;
    dynamicInput: boolean;
  };
  commandBar: CommandBarState;
  focusHolder: FocusHolder;
  /** Stack of previous focus holders so dialog open/close can restore. */
  focusStack: FocusHolder[];
  overlay: OverlayState;
  modifiers: ModifiersState;
}

const HISTORY_CAP = 200;

export const createInitialEditorUiState = (): EditorUiState => ({
  viewport: {
    panX: 0,
    panY: 0,
    zoom: 10,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    canvasWidthCss: 800,
    canvasHeightCss: 600,
    // Round 7 backlog B2 — short pickbox is the AC default; full-canvas
    // (100) is the toggled-on state via F7. Was 100 prior to backlog
    // sweep (M1.3 Round 7).
    crosshairSizePct: 5,
  },
  selection: [],
  activeToolId: null,
  activeLayerId: null,
  toggles: {
    osnap: true,
    ortho: false,
    gsnap: true,
    dynamicInput: true,
  },
  commandBar: {
    activePrompt: null,
    subOptions: [],
    defaultValue: null,
    inputBuffer: '',
    history: [],
    activeToolId: null,
    acceptedInputKinds: [],
    directDistanceFrom: null,
    lastToolId: null,
    accumulator: '',
    dynamicInput: null,
    dynamicInputRecall: {},
  },
  focusHolder: 'canvas',
  focusStack: [],
  overlay: {
    cursor: null,
    snapTarget: null,
    guides: [],
    selectionHandles: [],
    previewShape: null,
    hoverEntity: null,
    grips: null,
    suppressEntityPaint: null,
    hoveredGrip: null,
    lastKnownCursor: null,
    dimensionGuides: null,
  },
  modifiers: { shift: false },
});

export const editorUiStore = createStore<EditorUiState>()(
  immer(() => createInitialEditorUiState()),
);

// --- Slice action helpers (typed mutators) ----------------------------

export const editorUiActions = {
  setViewport(patch: Partial<Viewport>): void {
    editorUiStore.setState((s) => {
      Object.assign(s.viewport, patch);
    });
  },
  setSelection(ids: PrimitiveId[]): void {
    editorUiStore.setState((s) => {
      s.selection = ids;
    });
  },
  setActiveToolId(id: string | null): void {
    editorUiStore.setState((s) => {
      s.activeToolId = id;
      s.commandBar.activeToolId = id;
    });
  },
  setActiveLayerId(id: LayerId | null): void {
    editorUiStore.setState((s) => {
      s.activeLayerId = id;
    });
  },
  toggleOsnap(): void {
    editorUiStore.setState((s) => {
      s.toggles.osnap = !s.toggles.osnap;
    });
  },
  toggleOrtho(): void {
    editorUiStore.setState((s) => {
      s.toggles.ortho = !s.toggles.ortho;
    });
  },
  toggleGsnap(): void {
    editorUiStore.setState((s) => {
      s.toggles.gsnap = !s.toggles.gsnap;
    });
  },
  toggleDynamicInput(): void {
    editorUiStore.setState((s) => {
      s.toggles.dynamicInput = !s.toggles.dynamicInput;
    });
  },
  setPrompt(
    prompt: string | null,
    subOptions: SubOption[] = [],
    defaultValue: string | null = null,
    acceptedInputKinds: AcceptedInputKind[] = [],
    directDistanceFrom: Point2D | null = null,
  ): void {
    editorUiStore.setState((s) => {
      s.commandBar.activePrompt = prompt;
      s.commandBar.subOptions = subOptions;
      s.commandBar.defaultValue = defaultValue;
      s.commandBar.inputBuffer = '';
      s.commandBar.acceptedInputKinds = acceptedInputKinds;
      s.commandBar.directDistanceFrom = directDistanceFrom;
    });
  },
  appendHistory(entry: CommandBarHistoryEntry): void {
    editorUiStore.setState((s) => {
      s.commandBar.history.push(entry);
      if (s.commandBar.history.length > HISTORY_CAP) {
        s.commandBar.history.splice(0, s.commandBar.history.length - HISTORY_CAP);
      }
    });
  },
  setInputBuffer(value: string): void {
    editorUiStore.setState((s) => {
      s.commandBar.inputBuffer = value;
    });
  },
  setFocusHolder(holder: FocusHolder): void {
    editorUiStore.setState((s) => {
      s.focusHolder = holder;
    });
  },
  pushFocusAndSet(next: FocusHolder): void {
    editorUiStore.setState((s) => {
      s.focusStack.push(s.focusHolder);
      s.focusHolder = next;
    });
  },
  popFocus(): void {
    editorUiStore.setState((s) => {
      const prev = s.focusStack.pop();
      s.focusHolder = prev ?? 'canvas';
    });
  },
  setOverlay(patch: Partial<OverlayState>): void {
    editorUiStore.setState((s) => {
      Object.assign(s.overlay, patch);
    });
  },
  // M1.3d Phase 1 — granular overlay setters consumed by Phases 2-8.
  // Per-field setters are preferred over `setOverlay(patch)` because
  // they make the call sites self-documenting and let store.subscribe
  // listeners narrow on the specific concern that changed.
  setCursor(cursor: { metric: Point2D; screen: ScreenPoint } | null): void {
    editorUiStore.setState((s) => {
      s.overlay.cursor = cursor;
    });
  },
  setPreviewShape(shape: PreviewShape | null): void {
    editorUiStore.setState((s) => {
      s.overlay.previewShape = shape;
    });
  },
  setSnapTarget(target: SnapTarget | null): void {
    editorUiStore.setState((s) => {
      s.overlay.snapTarget = target;
    });
  },
  setHoverEntity(id: PrimitiveId | null): void {
    editorUiStore.setState((s) => {
      s.overlay.hoverEntity = id;
    });
  },
  setGrips(grips: Grip[] | null): void {
    editorUiStore.setState((s) => {
      s.overlay.grips = grips;
    });
  },
  setSuppressEntityPaint(id: PrimitiveId | null): void {
    editorUiStore.setState((s) => {
      s.overlay.suppressEntityPaint = id;
    });
  },
  setHoveredGrip(grip: { entityId: PrimitiveId; gripKind: string } | null): void {
    editorUiStore.setState((s) => {
      s.overlay.hoveredGrip = grip;
    });
  },
  // M1.3d-Remediation-3 F1 — captures last non-null cursor metric. Once
  // set, NEVER cleared (so direct-distance entry works while pointer is
  // over the command bar where overlay.cursor is null).
  setLastKnownCursor(metric: Point2D): void {
    editorUiStore.setState((s) => {
      s.overlay.lastKnownCursor = metric;
    });
  },
  // M1.3d-Remediation-3 F2 — Shift modifier setter, called by the
  // keyboard router on keydown / keyup / window.blur.
  setShift(held: boolean): void {
    editorUiStore.setState((s) => {
      s.modifiers.shift = held;
    });
  },
  // M1.3d-Remediation-3 F6 — last user-invoked tool id setter. Spacebar
  // at canvas focus with no active tool re-invokes this id.
  setLastToolId(id: string | null): void {
    editorUiStore.setState((s) => {
      s.commandBar.lastToolId = id;
    });
  },
  // M1.3d-Remediation-4 G1 — multi-letter accumulator setter. Sole
  // writer is the keyboard router; sole reader (this round) is the
  // Dynamic Input pill. Mirrors the router's local accumulator
  // closure variable so the pill can render the in-progress shortcut.
  setAccumulator(value: string): void {
    editorUiStore.setState((s) => {
      s.commandBar.accumulator = value;
    });
  },
  // M1.3 Round 6 — Dynamic Input multi-field state setters per plan §3 A2.1.
  // Plan Rev-1 R2-A5: each prompt yield with a manifest resets buffers + activeFieldIdx.
  /**
   * Round 7 Phase 2 — manifest publication takes the runner-derived
   * `promptKey` (canonical expression per plan A16:
   * `${toolId}:${prompt.persistKey ?? promptIndex}`).
   *
   * **M1.3 DI pipeline overhaul Phase 1** — also initializes `locked`
   * parallel to `buffers` (`Array(N).fill(false)`). I-DI-1 invariant.
   *
   * **M1.3 DI pipeline overhaul Phase 4 (B8)** — placeholder pre-fill
   * mechanic retired (the slice no longer has a `placeholders` field;
   * the dim-placeholder pill render path is gone). Recall is now
   * surfaced via the ArrowUp recall pill at the cursor (router-driven;
   * sets `recallActive = true` when a recall entry exists for the
   * active promptKey). `recallActive` initializes to `false` on every
   * manifest publish.
   */
  setDynamicInputManifest(manifest: DynamicInputManifest, promptKey: string): void {
    editorUiStore.setState((s) => {
      s.commandBar.dynamicInput = {
        manifest,
        buffers: Array<string>(manifest.fields.length).fill(''),
        activeFieldIdx: 0,
        promptKey,
        locked: Array<boolean>(manifest.fields.length).fill(false),
        recallActive: false,
      };
    });
  },
  /**
   * Round 7 Phase 2 — record the submitted buffers for a prompt under
   * the given key (canonical expression — see plan A16). Replaces any
   * previous entry for the key. Called by EditorRoot.onSubmitDynamicInput
   * BEFORE clearDynamicInput on a successful combiner result. Locks
   * I-DI-13: writes only to editorUiStore; never reaches the
   * project-store / IndexedDB / API.
   *
   * **M1.3 DI pipeline overhaul Phase 1** — write-target slice renamed
   * to `dynamicInputRecall` at this round. Action name + signature
   * unchanged.
   */
  recordSubmittedBuffers(promptKey: string, buffers: string[]): void {
    editorUiStore.setState((s) => {
      s.commandBar.dynamicInputRecall[promptKey] = [...buffers];
    });
  },
  /**
   * **M1.3 DI pipeline overhaul Phase 1** — set `locked[idx]` to the
   * given value. No-op when `dynamicInput` is null OR `idx` out of
   * range. Sole writer (apart from `setDynamicInputManifest` which
   * initializes the array): the keyboard router's Tab handler (Phase 3
   * lock-on-typed semantic) and `unlockAllDynamicInputFields` (Esc
   * step 1). Plan invariant I-DI-4.
   */
  setDynamicInputFieldLocked(idx: number, locked: boolean): void {
    editorUiStore.setState((s) => {
      if (s.commandBar.dynamicInput && idx >= 0 && idx < s.commandBar.dynamicInput.locked.length) {
        s.commandBar.dynamicInput.locked[idx] = locked;
      }
    });
  },
  /**
   * **M1.3 DI pipeline overhaul Phase 1** — reset every entry of
   * `locked` to `false`. No-op when `dynamicInput` is null. Sole
   * writer: the keyboard router's Esc handler (Phase 3 two-step
   * unwind: first press unlocks all; second press aborts). Plan
   * invariant I-DI-6 (later refined by I-DI-12 in Phase 4).
   */
  unlockAllDynamicInputFields(): void {
    editorUiStore.setState((s) => {
      if (s.commandBar.dynamicInput) {
        s.commandBar.dynamicInput.locked = s.commandBar.dynamicInput.locked.map(() => false);
      }
    });
  },
  /**
   * **M1.3 DI pipeline overhaul Phase 4 (B8)** — set `recallActive` flag.
   * Sole writer: keyboard router (ArrowUp → true; ArrowDown / Tab → false;
   * Esc cancels recall before falling through to unlock / abort).
   * No-op when `dynamicInput` is null. Plan invariants I-DI-10 + I-DI-12.
   */
  setDynamicInputRecallActive(active: boolean): void {
    editorUiStore.setState((s) => {
      if (s.commandBar.dynamicInput) {
        s.commandBar.dynamicInput.recallActive = active;
      }
    });
  },
  setDynamicInputActiveField(idx: number): void {
    editorUiStore.setState((s) => {
      if (s.commandBar.dynamicInput) {
        s.commandBar.dynamicInput.activeFieldIdx = idx;
      }
    });
  },
  setDynamicInputFieldBuffer(idx: number, value: string): void {
    editorUiStore.setState((s) => {
      if (s.commandBar.dynamicInput && idx >= 0 && idx < s.commandBar.dynamicInput.buffers.length) {
        s.commandBar.dynamicInput.buffers[idx] = value;
      }
    });
  },
  clearDynamicInput(): void {
    editorUiStore.setState((s) => {
      s.commandBar.dynamicInput = null;
    });
  },
  setDimensionGuides(guides: DimensionGuide[] | null): void {
    editorUiStore.setState((s) => {
      s.overlay.dimensionGuides = guides;
    });
  },
  /**
   * Clamps to [0, 100] per I-DTP-3 / I-DTP-18. Out-of-range inputs
   * snap to the boundary rather than rejecting — keeps a future
   * settings-slider from having to pre-validate.
   */
  setCrosshairSizePct(n: number): void {
    const clamped = Math.max(0, Math.min(100, n));
    editorUiStore.setState((s) => {
      s.viewport.crosshairSizePct = clamped;
    });
  },
};

export function resetEditorUiStoreForTests(): void {
  editorUiStore.setState(createInitialEditorUiState(), true);
}

export { HISTORY_CAP };
