// EditorRoot — top-level React component that wires the canvas host,
// command bar, properties panel, and dialog chrome into a single
// drafting surface. Phase 22 replaces the Phase-8 placeholder with the
// full integration: mounts CanvasHost / CommandBar / PropertiesPanel,
// registers the window-level keyboard router on mount (idempotent
// re-register on remount per I-65), routes pointer events into the
// active tool runner or hit-test selection, and gates LayerManager
// dialog visibility via local state.
//
// I-68: this is the only file in packages/editor-2d/src/ that
// subscribes to BOTH `projectStore` (via `.subscribe`) and the editor-
// 2d UI store (via `useEditorUi`). Lower-level files subscribe to one
// or the other, never both. Enforced by Gate 22.7 store-isolation
// meta-test.

import { LayerId, type Point2D } from '@portplanner/domain';
import { projectStore } from '@portplanner/project-store';
import { type ReactElement, useEffect, useRef, useState } from 'react';

import { CanvasHost, type CanvasHostHandle } from './canvas/canvas-host';
import { gripHitTest } from './canvas/grip-hit-test';
import { gripsOf } from './canvas/grip-positions';
import { hitTest } from './canvas/hit-test';
import { PrimitiveSpatialIndex } from './canvas/spatial-index';
import { type ScreenPoint, screenToMetric } from './canvas/view-transform';
import { CommandBar } from './chrome/CommandBar';
import { LayerManagerDialog } from './chrome/LayerManagerDialog';
import { PropertiesPanel } from './chrome/PropertiesPanel';
import { useEditorUi } from './chrome/use-editor-ui-store';
import { registerKeyboardRouter } from './keyboard/router';
import type { ToolId } from './keyboard/shortcuts';
import { commitSnappedVertex } from './snap/commit';
import { resolveSnap } from './snap/priority';
import { lookupTool } from './tools';
import { gripStretchTool } from './tools/grip-stretch';
import { type RunningTool, startTool } from './tools/runner';
import { selectRectTool } from './tools/select-rect';
import type { Grip } from './ui-state/store';
import { type OverlayState, editorUiActions, editorUiStore } from './ui-state/store';

const ZOOM_MIN = 0.001;
const ZOOM_MAX = 10000;
const ZOOM_STEP = 1.1;

export function EditorRoot(): ReactElement {
  const viewport = useEditorUi((s) => s.viewport);
  // M1.3d Phase 2 — overlay subscription drives paint requests on
  // overlay changes (cursor, snapTarget, previewShape, hoverEntity,
  // etc.). The selector returns `s.overlay` (a stable reference until
  // any field changes) so React only re-renders when overlay actually
  // mutates. EditorRoot is the legitimate dual-store subscriber per
  // I-68 / Gate 22.7.
  const overlay = useEditorUi((s) => s.overlay);
  const runningToolRef = useRef<RunningTool | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<CanvasHostHandle | null>(null);
  // Stable callback: returns the latest overlay snapshot via a one-shot
  // getState read. Passing this to canvas-host as `getOverlay` lets
  // canvas-host's paint rAF read overlay without subscribing to the
  // editor-ui store (I-DTP-22 / Gate DTP-T7). The ref is created once
  // (initial-fn form) and never reassigned, so its identity is stable
  // across renders — important so canvas-host's paint useEffect doesn't
  // re-subscribe on every parent render.
  const getOverlayRef = useRef<() => OverlayState | null>(() => editorUiStore.getState().overlay);
  const [layerManagerOpen, setLayerManagerOpen] = useState(false);

  // Auto-set activeLayerId to LayerId.DEFAULT on first project mount so
  // draw tools have a layer to assign without an extra LA ceremony.
  useEffect(() => {
    const sync = (): void => {
      const project = projectStore.getState().project;
      if (!project) return;
      const ui = editorUiStore.getState();
      if (ui.activeLayerId === null && project.layers[LayerId.DEFAULT]) {
        editorUiActions.setActiveLayerId(LayerId.DEFAULT);
      }
    };
    sync();
    const unsubscribe = projectStore.subscribe(sync);
    return () => unsubscribe();
  }, []);

  // Register the window-level keyboard router on mount; cleanup on
  // unmount. registerKeyboardRouter is idempotent (I-65) so React 19
  // StrictMode + per-test mounts work correctly.
  useEffect(() => {
    // Shared "activate tool by id" flow used by both onActivateTool
    // (single/multi-letter shortcut) and onRepeatLastCommand
    // (M1.3d-Remediation-3 F6 spacebar repeat). Aborts any in-flight
    // tool, then starts the requested one. Layer manager is special-
    // cased to also pop the dialog.
    // `id` typed as ToolId (the keyboard router's union); onRepeatLastCommand
    // reads lastToolId as string and casts it — at runtime lastToolId is
    // always sourced from a successful prior activation, so the cast holds.
    // lookupTool returns null for unknown ids regardless, so this stays
    // defensive even if the cast were wrong.
    const activateToolById = (id: ToolId): void => {
      runningToolRef.current?.abort();
      runningToolRef.current = null;
      if (id === 'layer-manager') {
        setLayerManagerOpen(true);
      }
      const factory = lookupTool(id);
      if (!factory) return;
      const running = startTool(id, factory);
      runningToolRef.current = running;
      running.done().finally(() => {
        if (runningToolRef.current === running) runningToolRef.current = null;
      });
    };
    return registerKeyboardRouter({
      onActivateTool: (id) => activateToolById(id),
      onUndo: () => {
        runningToolRef.current?.abort();
        runningToolRef.current = null;
        projectStore.temporal.getState().undo();
      },
      onRedo: () => {
        runningToolRef.current?.abort();
        runningToolRef.current = null;
        projectStore.temporal.getState().redo();
      },
      onAbortCurrentTool: () => {
        runningToolRef.current?.abort();
        runningToolRef.current = null;
        setLayerManagerOpen(false);
      },
      onCommitCurrentTool: () => {
        // Enter on canvas focus — feed a `commit` Input. Polyline uses
        // this to end its open-ended loop and commit-open. Tools with
        // fixed-arity prompts (line, rectangle, circle, arc) abort
        // gracefully because their next yield expects a 'point'.
        runningToolRef.current?.feedInput({ kind: 'commit' });
      },
      onSubOption: (label: string) => {
        // Sub-option shortcut letter (c/u) while a tool is running —
        // routes the same way the [Close]/[Undo] bracket clicks do.
        runningToolRef.current?.feedInput({ kind: 'subOption', optionLabel: label });
      },
      onToggleCrosshair: () => {
        // M1.3d Phase 8 — F7 toggle. M1.3d ships only the two presets
        // (full-canvas 100, pickbox 5). A future settings dialog can
        // expose a slider for arbitrary 0..100 values; this handler
        // just flips between the two extremes.
        const current = editorUiStore.getState().viewport.crosshairSizePct;
        editorUiActions.setCrosshairSizePct(current >= 50 ? 5 : 100);
      },
      // M1.3d-Remediation-3 F6 — Spacebar at canvas focus + no active
      // tool re-invokes the last user-tool. lastToolId is captured by
      // the runner's finally block (see runner.ts EXCLUDED_FROM_LAST).
      // No-op when lastToolId is null (first spacebar after page load).
      onRepeatLastCommand: () => {
        const id = editorUiStore.getState().commandBar.lastToolId;
        if (id === null) return;
        activateToolById(id as ToolId);
      },
    });
  }, []);

  // ResizeObserver — keep canvasWidthCss / canvasHeightCss / dpr in
  // sync with the container element size.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      editorUiActions.setViewport({
        canvasWidthCss: Math.max(1, Math.floor(width)),
        canvasHeightCss: Math.max(1, Math.floor(height)),
        dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // M1.3d Phase 2 — overlay-driven repaint. canvas-host's own paint
  // subscription only fires on projectStore changes, so we need to
  // explicitly nudge the paint loop when overlay state mutates (e.g.
  // cursor move → preview rebuild → paint). Because schedulePaint is
  // rAF-coalesced, requestPaint() from a 60Hz cursor stream still
  // collapses to ≤60 frames/s — no over-paint. The `overlay` value
  // isn't read inside the effect; it's a *change trigger* (Biome's
  // useExhaustiveDependencies rule mis-flags this — we read overlay's
  // identity via the dep array to know WHEN to re-paint).
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger-only dep
  useEffect(() => {
    canvasHostRef.current?.requestPaint();
  }, [overlay]);

  // M1.3d Phase 3 — snap-on-cursor. When a tool is running, awaiting a
  // 'point' input, AND OSNAP / GSNAP is on, run resolveSnap() against
  // the cursor and publish the result to overlay.snapTarget. paintSnapGlyph
  // (Phase 3) reads it during the overlay pass. handleCanvasClick (below)
  // reads the same target so a click commits the snap-resolved metric,
  // not the raw cursor — this is the visible side of the snap engine
  // that M1.3a deferred (I-DTP-7 + the A15 click-time bit-copy contract;
  // see plan §13.3 for the M1.3a wiring gap closed here).
  useEffect(() => {
    const ui = editorUiStore.getState();
    const cursor = overlay.cursor;
    const clear = (): void => {
      if (editorUiStore.getState().overlay.snapTarget !== null) {
        editorUiActions.setSnapTarget(null);
      }
    };
    if (!cursor) {
      clear();
      return;
    }
    if (ui.activeToolId === null || !ui.commandBar.acceptedInputKinds.includes('point')) {
      clear();
      return;
    }
    if (!ui.toggles.osnap && !ui.toggles.gsnap) {
      clear();
      return;
    }
    const project = projectStore.getState().project;
    if (!project) {
      clear();
      return;
    }
    const hit = resolveSnap({
      cursor: cursor.metric,
      priorPoint: null,
      primitives: Object.values(project.primitives),
      grids: Object.values(project.grids),
      viewport: ui.viewport,
      toggles: { osnap: ui.toggles.osnap, gsnap: ui.toggles.gsnap, ortho: ui.toggles.ortho },
    });
    if (hit.kind === 'cursor') {
      clear();
      return;
    }
    const current = editorUiStore.getState().overlay.snapTarget;
    if (
      current &&
      current.kind === hit.kind &&
      current.point.x === hit.point.x &&
      current.point.y === hit.point.y
    ) {
      // No-op write avoidance: identical snap target already published.
      return;
    }
    editorUiActions.setSnapTarget(hit);
  }, [overlay.cursor]);

  const handleCanvasHover = (metric: Point2D, screen: ScreenPoint): void => {
    editorUiActions.setCursor({ metric, screen });
    // M1.3d-Remediation-3 F1 — capture last cursor for direct-distance
    // entry. Once set, never cleared (so typing a distance in the
    // command bar — where overlay.cursor is null — still works).
    editorUiActions.setLastKnownCursor(metric);
  };

  // M1.3d Phase 5 — hover entity highlight. When NO tool is active
  // (I-DTP-12) and the cursor is over the canvas, hit-test against the
  // primitives and set overlay.hoverEntity. The paint loop's overlay
  // pass renders the faint outline. Gating on activeToolId === null
  // keeps the highlight from appearing while a draw tool is in flight
  // (where it would compete with the snap glyph and preview shapes).
  useEffect(() => {
    const ui = editorUiStore.getState();
    const cursor = overlay.cursor;
    const clear = (): void => {
      if (editorUiStore.getState().overlay.hoverEntity !== null) {
        editorUiActions.setHoverEntity(null);
      }
    };
    if (!cursor || ui.activeToolId !== null) {
      clear();
      return;
    }
    const project = projectStore.getState().project;
    if (!project) {
      clear();
      return;
    }
    const idx = new PrimitiveSpatialIndex();
    for (const p of Object.values(project.primitives)) idx.insert(p);
    const hit = hitTest(cursor.screen, ui.viewport, idx, project.primitives);
    if (hit !== editorUiStore.getState().overlay.hoverEntity) {
      editorUiActions.setHoverEntity(hit);
    }
  }, [overlay.cursor]);

  // M1.3d-Remediation-2 R7 — hovered-grip highlight. When grips are
  // visible (entity selected) and the cursor is on canvas, compute
  // gripHitTest with the existing 4 CSS-px tolerance and publish the
  // result to overlay.hoveredGrip. paintSelection reads it during the
  // overlay pass and renders the matching grip with amber + 9×9 instead
  // of the default blue + 7×7. Effect dep is overlay.cursor — same
  // trigger pattern as the snap-on-cursor and hover-entity effects.
  useEffect(() => {
    const ui = editorUiStore.getState();
    const cursor = overlay.cursor;
    const grips = ui.overlay.grips;
    const clear = (): void => {
      if (editorUiStore.getState().overlay.hoveredGrip !== null) {
        editorUiActions.setHoveredGrip(null);
      }
    };
    if (!cursor || !grips || grips.length === 0) {
      clear();
      return;
    }
    const hit = gripHitTest(cursor.screen, grips, ui.viewport);
    if (!hit) {
      clear();
      return;
    }
    const current = editorUiStore.getState().overlay.hoveredGrip;
    if (current && current.entityId === hit.entityId && current.gripKind === hit.gripKind) {
      // No-op write avoidance.
      return;
    }
    editorUiActions.setHoveredGrip({ entityId: hit.entityId, gripKind: hit.gripKind });
  }, [overlay.cursor]);

  // M1.3d Phase 5 — selection-grips recompute. When selection or
  // primitive geometry changes, rebuild overlay.grips from the
  // currently selected primitives. Empty selection → null grips.
  const selection = useEditorUi((s) => s.selection);
  useEffect(() => {
    const project = projectStore.getState().project;
    if (!project || selection.length === 0) {
      if (editorUiStore.getState().overlay.grips !== null) {
        editorUiActions.setGrips(null);
      }
      return;
    }
    const grips = selection.flatMap((id) => {
      const p = project.primitives[id];
      return p ? gripsOf(p) : [];
    });
    editorUiActions.setGrips(grips);
  }, [selection]);

  // M1.3a kept the overlay-grips computation in sync with primitive
  // mutations via projectStore subscription; M1.3d Phase 5 reuses that
  // pathway for grip refresh after grip-stretch commits land in Phase 6.
  useEffect(() => {
    const recompute = (): void => {
      const ui = editorUiStore.getState();
      if (ui.selection.length === 0) {
        if (ui.overlay.grips !== null) editorUiActions.setGrips(null);
        return;
      }
      const project = projectStore.getState().project;
      if (!project) return;
      const grips = ui.selection.flatMap((id) => {
        const p = project.primitives[id];
        return p ? gripsOf(p) : [];
      });
      editorUiActions.setGrips(grips);
    };
    const unsubscribe = projectStore.subscribe(recompute);
    return () => unsubscribe();
  }, []);

  const handleCanvasClick = (metric: Point2D, screen: { x: number; y: number }): void => {
    const tool = runningToolRef.current;
    if (tool) {
      // M1.3d Phase 3 — if the snap engine resolved a target this frame,
      // feed the snap-resolved metric (bit-copied per I-39) instead of
      // the raw cursor metric. The visible snap glyph and the committed
      // vertex are the same point.
      const snap = editorUiStore.getState().overlay.snapTarget;
      const point = snap ? commitSnappedVertex(snap.point) : metric;
      tool.feedInput({ kind: 'point', point });
      return;
    }
    // M1.3d Phase 7 — no tool active: do NOTHING here. The mousedown
    // also fires onSelectRectStart which spawns the select-rect tool;
    // that tool's click-without-drag branch performs the same single-
    // entity hit-test selection that M1.3a's inline code did. Both
    // handlers running selection logic on the same click would
    // double-select.
    void metric;
    void screen;
  };

  const handlePan = (dxCss: number, dyCss: number): void => {
    const v = editorUiStore.getState().viewport;
    editorUiActions.setViewport({
      panX: v.panX - dxCss / v.zoom,
      panY: v.panY + dyCss / v.zoom,
    });
  };

  const handleWheelZoom = (deltaY: number, focal: { x: number; y: number }): void => {
    // Focal-point zoom: keep the metric point under the cursor stationary
    // across the zoom step. Without this, wheel-zoom pivots around the
    // canvas centre regardless of cursor position — surprising in CAD UX.
    //
    // Derivation: screenToMetric(focal, v) = M (the metric point under
    // the cursor). After zooming we want screenToMetric(focal, v') = M
    // again, where v' has the new zoom. Solving for v'.panX / panY:
    //   newPanX = M.x - (focal.x - cw/2) / nextZoom
    //   newPanY = M.y + (focal.y - ch/2) / nextZoom   (y-flip in screenToMetric)
    const v = editorUiStore.getState().viewport;
    const factor = ZOOM_STEP ** -Math.sign(deltaY);
    const nextZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * factor));
    if (nextZoom === v.zoom) return;
    const M = screenToMetric(focal, v);
    const halfW = v.canvasWidthCss / 2;
    const halfH = v.canvasHeightCss / 2;
    const nextPanX = M.x - (focal.x - halfW) / nextZoom;
    const nextPanY = M.y + (focal.y - halfH) / nextZoom;
    editorUiActions.setViewport({ zoom: nextZoom, panX: nextPanX, panY: nextPanY });
  };

  const handleCommandSubOption = (label: string): void => {
    runningToolRef.current?.feedInput({ kind: 'subOption', optionLabel: label });
  };

  const handleCommandSubmit = (raw: string): void => {
    if (raw.length === 0) {
      // Empty Enter in the command bar = "I'm done with my open-ended
      // input loop" (e.g. end an open polyline). Distinct from Escape
      // which aborts.
      runningToolRef.current?.feedInput({ kind: 'commit' });
      return;
    }
    const num = Number(raw);
    if (!Number.isFinite(num)) return;

    // M1.3d-Remediation-3 F1 — direct distance entry. When the active
    // prompt published a `directDistanceFrom` anchor AND we have a
    // last-known cursor, transform the typed distance into a 'point'
    // input at `anchor + unit(cursor - anchor) * distance`. Otherwise
    // fall through to the existing 'number' input (e.g. typed Width /
    // Height for rectangle's Dimensions sub-option).
    const cb = editorUiStore.getState().commandBar;
    const anchor = cb.directDistanceFrom;
    const lkc = editorUiStore.getState().overlay.lastKnownCursor;
    if (anchor && lkc) {
      const dx = lkc.x - anchor.x;
      const dy = lkc.y - anchor.y;
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        const ux = dx / len;
        const uy = dy / len;
        const dest: Point2D = { x: anchor.x + ux * num, y: anchor.y + uy * num };
        runningToolRef.current?.feedInput({ kind: 'point', point: dest });
        return;
      }
      // Zero-length direction (cursor exactly on anchor): fall through
      // to 'number' — tool will treat it per its own contract.
    }
    runningToolRef.current?.feedInput({ kind: 'number', value: num });
  };

  const handleCanvasCommit = (): void => {
    // Right-click on canvas = commit in-flight tool (CAD convention).
    runningToolRef.current?.feedInput({ kind: 'commit' });
  };

  // M1.3d Phase 6 — grip hit-test + grip-stretch lifecycle. canvas-host
  // calls handleGripHitTest BEFORE its onCanvasClick. If a grip hits,
  // we abort the active tool (if any), start grip-stretch, and route
  // the eventual mouseup as the 'point' commit. The mouseup wiring
  // lands in Phase 7 (canvas-host onCanvasMouseUp + tool runner input
  // routing); for now, the user releases the mouse off-canvas or
  // clicks again to commit the new position.
  const handleGripHitTest = (screen: ScreenPoint): Grip | null => {
    const grips = editorUiStore.getState().overlay.grips;
    if (!grips || grips.length === 0) return null;
    return gripHitTest(screen, grips, viewport);
  };

  const handleGripDown = (grip: Grip): void => {
    // M1.3d-Remediation-3 F5 BUG FIX — when a tool is already running
    // and awaiting a 'point' input, clicking on a grip MUST feed the
    // grip's exact position as the input (AutoCAD parity: grip serves
    // as a snap target). Pre-fix, this branch unconditionally aborted
    // the running tool and started grip-stretch; the running tool
    // never received the grip click. Bit-copy semantics — grip.position
    // is the canonical metric, no snap re-resolution needed.
    const tool = runningToolRef.current;
    if (tool) {
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

  // M1.3d Phase 7 — selection-rect autostart on left-mousedown when
  // no tool is active. canvas-host fires onSelectRectStart on EVERY
  // mousedown; we gate on activeToolId === null here.
  const handleSelectRectStart = (metric: Point2D, screen: ScreenPoint): void => {
    if (runningToolRef.current !== null) return;
    const factory = selectRectTool(metric, screen);
    const running = startTool('select-rect', factory);
    runningToolRef.current = running;
    running.done().finally(() => {
      if (runningToolRef.current === running) runningToolRef.current = null;
    });
  };

  // M1.3d Phase 7 — mouseup whitelist (C13). Only forward mouseup as a
  // 'point' input when the active tool is one of the drag-style tools
  // that expects an mouseup-driven commit. Other tools (line, circle,
  // arc, etc.) take their points from mousedown via onCanvasClick;
  // forwarding a mouseup point would cause an unwanted "extra point".
  //
  // M1.3d-Remediation R4 — symmetry with handleCanvasClick: when a snap
  // target is resolved this frame, feed the snap-resolved metric (bit-
  // copied via commitSnappedVertex per I-39) instead of the raw cursor
  // metric. Without this, the visible snap glyph mid-drag was misleading:
  // glyph rendered, click committed at the raw cursor — Phase 7 oversight.
  const handleCanvasMouseUp = (metric: Point2D, _screen: ScreenPoint): void => {
    const id = editorUiStore.getState().activeToolId;
    if (id !== 'select-rect' && id !== 'grip-stretch') return;
    const snap = editorUiStore.getState().overlay.snapTarget;
    const point = snap ? commitSnappedVertex(snap.point) : metric;
    runningToolRef.current?.feedInput({ kind: 'point', point });
  };

  return (
    <div
      ref={containerRef}
      data-component="editor-root"
      style={{
        display: 'grid',
        gridTemplateRows: '1fr auto',
        gridTemplateColumns: '1fr 260px',
        height: '100%',
        position: 'relative',
      }}
    >
      <div
        data-component="canvas-area"
        style={{ position: 'relative', overflow: 'hidden', gridColumn: 1, gridRow: 1 }}
      >
        <CanvasHost
          ref={canvasHostRef}
          viewport={viewport}
          onCanvasClick={handleCanvasClick}
          onCanvasCommit={handleCanvasCommit}
          onCanvasHover={handleCanvasHover}
          onPan={handlePan}
          onWheelZoom={handleWheelZoom}
          getOverlay={getOverlayRef.current}
          onGripHitTest={handleGripHitTest}
          onGripDown={handleGripDown}
          onSelectRectStart={handleSelectRectStart}
          onCanvasMouseUp={handleCanvasMouseUp}
        />
      </div>
      <div
        data-component="properties-area"
        style={{
          gridColumn: 2,
          gridRow: 1,
          overflow: 'auto',
          // M1.3d-Remediation R1 — visible seam between canvas and the
          // right-hand properties panel. Token from docs/design-tokens.md
          // (chrome border story). No CSS module needed — matches the
          // existing inline-style pattern of this layout grid.
          borderLeft: '1px solid var(--border-default)',
        }}
      >
        <PropertiesPanel />
      </div>
      <div data-component="command-bar-area" style={{ gridColumn: '1 / -1', gridRow: 2 }}>
        <CommandBar onSubOption={handleCommandSubOption} onSubmit={handleCommandSubmit} />
      </div>
      {layerManagerOpen ? <LayerManagerDialog /> : null}
    </div>
  );
}
