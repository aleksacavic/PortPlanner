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
  useEffect,
  useRef,
} from 'react';

import { paint } from './paint';
import { PrimitiveSpatialIndex } from './spatial-index';
import { type Viewport, screenToMetric } from './view-transform';

export interface CanvasHostProps {
  viewport: Viewport;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onCanvasClick?: (metric: Point2D, screen: { x: number; y: number }) => void;
  onPan?: (dxCss: number, dyCss: number) => void;
  onWheelZoom?: (deltaY: number, focal: { x: number; y: number }) => void;
}

export function CanvasHost(props: CanvasHostProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const indexRef = useRef<PrimitiveSpatialIndex | null>(null);
  const rafRef = useRef<number | null>(null);
  const panStateRef = useRef<{ x: number; y: number } | null>(null);

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

  // Re-paint on project changes via direct store subscription.
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
        paint(ctx, { project, viewport: props.viewport, spatialIndex: idx });
      });
    };
    const unsubscribe = projectStore.subscribe(schedulePaint);
    schedulePaint();
    return () => {
      unsubscribe();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [props.viewport]);

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

  const onMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (e.button === 1) {
      // Middle-mouse-drag pan starts.
      panStateRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button === 0) {
      const rect = canvas.getBoundingClientRect();
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const metric = screenToMetric(screen, props.viewport);
      props.onCanvasClick?.(metric, screen);
    }
  };

  const onMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>): void => {
    if (panStateRef.current) {
      const dx = e.clientX - panStateRef.current.x;
      const dy = e.clientY - panStateRef.current.y;
      panStateRef.current = { x: e.clientX, y: e.clientY };
      if (dx !== 0 || dy !== 0) props.onPan?.(dx, dy);
    }
  };

  const onMouseUp = (): void => {
    panStateRef.current = null;
  };

  const onWheel = (e: ReactWheelEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const focal = { x: e.clientX - rect.left, y: e.clientY - rect.top };
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
    />
  );
}
