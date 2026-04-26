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
  },
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
  ): void {
    editorUiStore.setState((s) => {
      s.commandBar.activePrompt = prompt;
      s.commandBar.subOptions = subOptions;
      s.commandBar.defaultValue = defaultValue;
      s.commandBar.inputBuffer = '';
      s.commandBar.acceptedInputKinds = acceptedInputKinds;
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
