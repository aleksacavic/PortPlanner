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
// hoverEntity / transientLabels / grips / suppressEntityPaint), adds
// per-field setters, and re-exports the local-to-overlay forward types
// `Grip`, `TransientLabel`, and `SnapTarget` (alias for SnapHit). The
// `PreviewShape` discriminated union is owned by `../tools/types` to
// keep the tool-runner contract co-located with tool generators.

import type { LayerId, Point2D, PrimitiveId } from '@portplanner/domain';
import { immer } from 'zustand/middleware/immer';
import { createStore } from 'zustand/vanilla';

import type { ScreenPoint, Viewport } from '../canvas/view-transform';
import type { SnapHit } from '../snap/priority';
import type { AcceptedInputKind, PreviewShape } from '../tools/types';

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

/**
 * Transient label record (length / radius / angle / dimension readouts
 * a tool wants painted near an anchor point). Painted by
 * `paintTransientLabel` (Phase 4). Anchor is metric so the renderer can
 * place the label after applying the current view transform; an
 * optional screen-space offset nudges the label off the anchor.
 */
export interface TransientLabel {
  anchor: { metric: Point2D; screenOffset?: { dx: number; dy: number } };
  text: string;
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
   * Tool-yielded transient labels rendered via `paintTransientLabel`
   * (Phase 4). `paintTransientLabel` is the SOLE source of transient
   * text on canvas (I-DTP-8, Gate DTP-T2 — other painters never call
   * `ctx.fillText` / `ctx.strokeText`).
   */
  transientLabels: TransientLabel[];
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
    crosshairSizePct: 100,
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
    transientLabels: [],
    grips: null,
    suppressEntityPaint: null,
    hoveredGrip: null,
    lastKnownCursor: null,
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
  setTransientLabels(labels: TransientLabel[]): void {
    editorUiStore.setState((s) => {
      s.overlay.transientLabels = labels;
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
