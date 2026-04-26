// CanvasHost — React component owning the <canvas> ref + DPR + paint
// subscription. Subscribes to projectStore directly (NOT via project-
// store-react) per A14 + GR-3 module-isolation rule. UI state (viewport)
// is bound separately in editor-2d's own ui-state store (Phase 11).
//
// This is the ONLY file under packages/editor-2d/src/canvas/ that
// imports React (Gate 10.5 enforces).
//
// Phase 22: pointer + wheel handlers added. Left-click forwards
// `onCanvasClick(metric, screen)` to EditorRoot (which routes into the
// active tool runner or hit-test selection). Middle-mouse-drag emits
// `onPan(dxCss, dyCss)`. Wheel emits `onWheelZoom(deltaY, focal)`.
//
// M1.3d Phase 2 — mousemove cursor tracking with rAF coalescing:
// every mousemove updates an internal `cursorRef`; a single rAF per
// frame reads the ref and fires `onCanvasHover(metric, screen)` to the
// parent. Caps cursor-driven updates at the display refresh rate
// regardless of mousemove poll rate (I-DTP-4). Also exposes a
// `requestPaint()` imperative ref via forwardRef so EditorRoot can
// nudge the paint loop on overlay state changes (Phase 1 step 6
// data-flow contract).
//
// I-DTP-22 / Gate DTP-T7: canvas-host MUST NOT subscribe to or import
// the editor-ui store. Overlay state is delivered via the `getOverlay`
// callback prop, called once per paint frame from the rAF callback.
// This keeps canvas-host a single-side (project-store-only) subscriber
// and preserves I-68 (Gate 22.7). The Gate DTP-T7 grep is a hard
// substring match on the runtime symbol, so it MUST NOT appear here
// (or anywhere else) in the file — even inside comments.
//
// Mouse events (not pointer events) are used for jsdom + Pointer-Events-
// in-jsdom-25 compatibility — jsdom drops PointerEvent init fields like
// `button` and `clientX`, breaking the smoke E2E. MouseEvent fields are
// fully populated. Touch support is post-M1.

import type { Point2D } from '@portplanner/domain';
import { projectStore } from '@portplanner/project-store';
import {
  type ReactElement,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
  type Ref,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import type { Grip, OverlayState } from '../ui-state/store';
import { paint } from './paint';
import { PrimitiveSpatialIndex } from './spatial-index';
import { type ScreenPoint, type Viewport, screenToMetric } from './view-transform';

export interface CanvasHostProps {
  viewport: Viewport;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onCanvasClick?: (metric: Point2D, screen: ScreenPoint) => void;
  /** Right-click — commit in-flight tool (CAD convention; distinct from
   *  Escape which aborts). EditorRoot routes this to a `commit` Input. */
  onCanvasCommit?: () => void;
  onPan?: (dxCss: number, dyCss: number) => void;
  onWheelZoom?: (deltaY: number, focal: ScreenPoint) => void;
  /**
   * M1.3d Phase 2 — fires at most once per animation frame with the
   * latest cursor position derived from `mousemove`. EditorRoot writes
   * the value to `overlay.cursor`. The same ref position is reused if
   * multiple mousemove events occur within one frame (I-DTP-4).
   */
  onCanvasHover?: (metric: Point2D, screen: ScreenPoint) => void;
  /**
   * One-shot reader for editor-ui overlay state, called once per paint
   * frame from canvas-host's rAF. EditorRoot provides a stable callback
   * that returns the editor-ui store's `.getState().overlay`. Per
   * I-DTP-22 / Gate DTP-T7, canvas-host MUST NOT subscribe to editor-ui
   * state directly; this callback is the only bridge.
   */
  getOverlay?: () => OverlayState | null;
  /**
   * M1.3d Phase 6 — grip hit-test callback. canvas-host fires this on
   * left-mousedown BEFORE forwarding the click to onCanvasClick. If
   * the callback returns a grip, canvas-host fires onGripDown(grip)
   * and STOPS — onCanvasClick is NOT invoked. EditorRoot owns the
   * grip set (derives from overlay.grips); canvas-host is just the
   * mouse plumbing.
   */
  onGripHitTest?: (screen: ScreenPoint) => Grip | null;
  onGripDown?: (grip: Grip) => void;
  /**
   * M1.3d Phase 7 — left-mousedown WITHOUT an active tool AND
   * without a grip hit. canvas-host fires this with the start point
   * (metric + screen) so EditorRoot can spawn the modeless select-rect
   * tool. Distinct from `onCanvasClick` because we want the start of
   * a potential drag, not a single-point input to a running tool.
   */
  onSelectRectStart?: (metric: Point2D, screen: ScreenPoint) => void;
  /**
   * M1.3d Phase 7 — fired on every left-mouseup with a non-null
   * tracked mousedown. EditorRoot uses this to commit the select-rect
   * / grip-stretch drag (it whitelists those tools and forwards the
   * point input). Not wired for non-drag tools to avoid spurious
   * "extra point" inputs after a click.
   */
  onCanvasMouseUp?: (metric: Point2D, screen: ScreenPoint) => void;
}

export interface CanvasHostHandle {
  /**
   * Schedules a paint (rAF-coalesced — multiple calls within a frame
   * collapse to one paint). EditorRoot calls this when overlay state
   * changes so the new overlay snapshot reaches the paint loop without
   * canvas-host having to subscribe to editor-ui state.
   */
  requestPaint: () => void;
}

function CanvasHostInner(props: CanvasHostProps, ref: Ref<CanvasHostHandle>): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const indexRef = useRef<PrimitiveSpatialIndex | null>(null);
  const rafRef = useRef<number | null>(null);
  const panStateRef = useRef<{ x: number; y: number } | null>(null);

  // Cursor tracking — updated synchronously on every mousemove, flushed
  // once per animation frame to onCanvasHover.
  const cursorRef = useRef<{ metric: Point2D; screen: ScreenPoint } | null>(null);
  const cursorRafRef = useRef<number | null>(null);
  const lastFlushedCursorRef = useRef<{ metric: Point2D; screen: ScreenPoint } | null>(null);

  // Stable ref to the paint scheduler so the imperative requestPaint()
  // method can reach it without the imperative handle being re-created
  // every render. The effect below assigns the latest schedulePaint into
  // this ref each time it re-runs (viewport / getOverlay changes).
  const schedulePaintRef = useRef<(() => void) | null>(null);

  // Initialize spatial index from current project state and keep it in
  // sync with projectStore mutations. M1.3a workloads (tens to hundreds
  // of primitives) make full-rebuild on each change cheap; profile and
  // diff-only updates are post-M1 work.
  useEffect(() => {
    const idx = new PrimitiveSpatialIndex();
    indexRef.current = idx;
    const rebuild = (): void => {
      idx.clear();
      const project = projectStore.getState().project;
      if (project) {
        for (const p of Object.values(project.primitives)) idx.insert(p);
      }
    };
    rebuild();
    const unsubscribe = projectStore.subscribe(rebuild);
    return () => {
      unsubscribe();
      idx.clear();
    };
  }, []);

  // Re-paint on project changes via direct store subscription. The
  // overlay snapshot is read once per frame via the getOverlay callback
  // so canvas-host stays a single-side subscriber (I-DTP-22).
  useEffect(() => {
    const schedulePaint = (): void => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const idx = indexRef.current;
        const project = projectStore.getState().project;
        if (!canvas || !ctx || !idx || !project) return;
        const overlay = props.getOverlay?.() ?? null;
        paint(ctx, { project, viewport: props.viewport, spatialIndex: idx, overlay });
      });
    };
    schedulePaintRef.current = schedulePaint;
    const unsubscribe = projectStore.subscribe(schedulePaint);
    schedulePaint();
    return () => {
      unsubscribe();
      schedulePaintRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        // Reset the ref so the next mount's schedulePaint() doesn't see a
        // stale (cancelled) frame id and short-circuit on the
        // `rafRef.current !== null` guard. React 19 StrictMode mounts
        // effects twice (mount → cleanup → re-mount); without this reset
        // the paint loop is permanently starved after the StrictMode
        // re-mount because the rAF callback never ran (it was cancelled),
        // so it never had a chance to clear the ref itself.
        rafRef.current = null;
      }
    };
  }, [props.viewport, props.getOverlay]);

  useImperativeHandle(
    ref,
    () => ({
      requestPaint: () => {
        schedulePaintRef.current?.();
      },
    }),
    [],
  );

  // Resize / DPR sync.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = props.viewport.canvasWidthCss * props.viewport.dpr;
    canvas.height = props.viewport.canvasHeightCss * props.viewport.dpr;
    canvas.style.width = `${props.viewport.canvasWidthCss}px`;
    canvas.style.height = `${props.viewport.canvasHeightCss}px`;
    if (props.onCanvasReady) props.onCanvasReady(canvas);
  }, [
    props.viewport.canvasWidthCss,
    props.viewport.canvasHeightCss,
    props.viewport.dpr,
    props.onCanvasReady,
  ]);

  // Cursor-rAF cleanup on unmount — same StrictMode-safety pattern as
  // the paint rafRef above.
  useEffect(() => {
    return () => {
      if (cursorRafRef.current !== null) {
        cancelAnimationFrame(cursorRafRef.current);
        cursorRafRef.current = null;
      }
      cursorRef.current = null;
      lastFlushedCursorRef.current = null;
    };
  }, []);

  const onMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (e.button === 1) {
      // Middle-mouse-drag pan starts.
      panStateRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button === 2) {
      // Right-click commits in-flight tool (CAD convention).
      e.preventDefault();
      props.onCanvasCommit?.();
      return;
    }
    if (e.button === 0) {
      const rect = canvas.getBoundingClientRect();
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      // M1.3d Phase 6 — grip hit-test fires BEFORE the regular click
      // handler so a grip-down doesn't double-fire as both grip-stretch
      // start and a tool input. If a grip is hit, stop here.
      const grip = props.onGripHitTest?.(screen);
      if (grip) {
        props.onGripDown?.(grip);
        return;
      }
      const metric = screenToMetric(screen, props.viewport);
      props.onCanvasClick?.(metric, screen);
      // M1.3d Phase 7 — also notify of the potential drag start. The
      // notification fires on EVERY mousedown, but EditorRoot only
      // spawns select-rect when no tool is active. Spawning is
      // EditorRoot's responsibility because canvas-host doesn't know
      // the active tool state (and shouldn't, per I-DTP-22).
      props.onSelectRectStart?.(metric, screen);
    }
  };

  const onMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>): void => {
    if (panStateRef.current) {
      const dx = e.clientX - panStateRef.current.x;
      const dy = e.clientY - panStateRef.current.y;
      panStateRef.current = { x: e.clientX, y: e.clientY };
      if (dx !== 0 || dy !== 0) props.onPan?.(dx, dy);
    }
    // Cursor tracking runs whether or not a pan is in flight — the
    // overlay layer (snap glyph, hover highlight, crosshair) wants the
    // cursor position even mid-pan so visual feedback stays current.
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screen: ScreenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const metric = screenToMetric(screen, props.viewport);
    cursorRef.current = { metric, screen };
    if (cursorRafRef.current !== null) return;
    cursorRafRef.current = requestAnimationFrame(() => {
      cursorRafRef.current = null;
      const c = cursorRef.current;
      if (!c) return;
      const last = lastFlushedCursorRef.current;
      // Skip the flush if the cursor hasn't moved since the last flush.
      // The pre-write to cursorRef is cheap; the parent callback may
      // re-trigger React renders so de-duping pays off.
      if (last && last.metric.x === c.metric.x && last.metric.y === c.metric.y) return;
      lastFlushedCursorRef.current = c;
      props.onCanvasHover?.(c.metric, c.screen);
    });
  };

  const onMouseUp = (e: ReactMouseEvent<HTMLCanvasElement>): void => {
    panStateRef.current = null;
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screen: ScreenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const metric = screenToMetric(screen, props.viewport);
    props.onCanvasMouseUp?.(metric, screen);
  };

  const onWheel = (e: ReactWheelEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const focal: ScreenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    props.onWheelZoom?.(e.deltaY, focal);
  };

  return (
    <canvas
      ref={canvasRef}
      data-component="canvas-host"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      // Suppress the native context menu so right-click can serve as
      // the CAD "commit in-flight tool" gesture.
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

export const CanvasHost = forwardRef<CanvasHostHandle, CanvasHostProps>(CanvasHostInner);
CanvasHost.displayName = 'CanvasHost';
