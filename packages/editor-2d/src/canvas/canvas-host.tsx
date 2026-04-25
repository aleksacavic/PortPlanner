// CanvasHost — React component owning the <canvas> ref + DPR + paint
// subscription + pointer events. Subscribes to projectStore directly
// (NOT via project-store-react) per A14 + GR-3 module-isolation rule.
// UI state (viewport, primitives, etc.) is bound separately in
// editor-2d's own ui-state store (Phase 11).
//
// This is the ONLY file under packages/editor-2d/src/canvas/ that
// imports React (Gate 10.5 enforces).

import { projectStore } from '@portplanner/project-store';
import { type PointerEvent, type ReactElement, type WheelEvent, useEffect, useRef } from 'react';

import type { Point2D } from '@portplanner/domain';
import { paint } from './paint';
import { PrimitiveSpatialIndex } from './spatial-index';
import { type Viewport, screenToMetric } from './view-transform';

export interface CanvasHostProps {
  viewport: Viewport;
  /** Pointer down on the canvas in metric coordinates (left click). */
  onCanvasClick?: (metric: Point2D, native: PointerEvent<HTMLCanvasElement>) => void;
  /** Pointer move in metric (for cursor tracking / overlays). */
  onCanvasMove?: (metric: Point2D) => void;
  /** Middle-mouse-drag pan delta in screen pixels (CSS px). */
  onPan?: (deltaXCss: number, deltaYCss: number) => void;
  /** Wheel zoom — sign of `deltaY`. */
  onWheelZoom?: (deltaY: number, focalScreen: { x: number; y: number }) => void;
}

export function CanvasHost(props: CanvasHostProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const indexRef = useRef<PrimitiveSpatialIndex | null>(null);
  const rafRef = useRef<number | null>(null);
  const panOriginRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize spatial index from current project state + keep in sync.
  useEffect(() => {
    const idx = new PrimitiveSpatialIndex();
    indexRef.current = idx;
    const initial = projectStore.getState().project;
    if (initial) {
      for (const p of Object.values(initial.primitives)) idx.insert(p);
    }

    // Keep the spatial index in sync with project mutations. Cheap diff
    // strategy: on every project change, rebuild from scratch. M1.3a
    // workloads are small (≤ a few thousand primitives); profiling
    // post-M1 if needed.
    const unsubscribe = projectStore.subscribe(() => {
      const project = projectStore.getState().project;
      idx.clear();
      if (project) {
        for (const p of Object.values(project.primitives)) idx.insert(p);
      }
    });

    return () => {
      unsubscribe();
      idx.clear();
    };
  }, []);

  // Re-paint on project changes via direct store subscription.
  useEffect(() => {
    const schedulePaint = () => {
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
  }, [props.viewport.canvasWidthCss, props.viewport.canvasHeightCss, props.viewport.dpr]);

  function canvasRelative(e: PointerEvent<HTMLCanvasElement> | WheelEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const screen = canvasRelative(e);
    if (!screen) return;
    if (e.button === 1) {
      // Middle mouse — start pan.
      panOriginRef.current = screen;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 0) {
      const metric = screenToMetric(screen, props.viewport);
      props.onCanvasClick?.(metric, e);
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const screen = canvasRelative(e);
    if (!screen) return;
    if (panOriginRef.current) {
      const dx = screen.x - panOriginRef.current.x;
      const dy = screen.y - panOriginRef.current.y;
      props.onPan?.(dx, dy);
      panOriginRef.current = screen;
      return;
    }
    const metric = screenToMetric(screen, props.viewport);
    props.onCanvasMove?.(metric);
  };

  const handlePointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    if (panOriginRef.current) {
      panOriginRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* best effort */
      }
    }
  };

  const handleWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    const screen = canvasRelative(e);
    if (!screen) return;
    e.preventDefault();
    props.onWheelZoom?.(e.deltaY, screen);
  };

  return (
    <canvas
      ref={canvasRef}
      data-component="canvas-host"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      style={{ display: 'block', cursor: 'crosshair' }}
    />
  );
}
