// CanvasHost — React component owning the <canvas> ref + DPR + paint
// subscription. Subscribes to projectStore directly (NOT via project-
// store-react) per A14 + GR-3 module-isolation rule. UI state (viewport)
// is bound separately in editor-2d's own ui-state store (Phase 11).
//
// This is the ONLY file under packages/editor-2d/src/canvas/ that
// imports React (Gate 10.5 enforces).

import { projectStore } from '@portplanner/project-store';
import { type ReactElement, useEffect, useRef } from 'react';

import { paint } from './paint';
import { PrimitiveSpatialIndex } from './spatial-index';
import { type Viewport } from './view-transform';

export interface CanvasHostProps {
  viewport: Viewport;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export function CanvasHost(props: CanvasHostProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const indexRef = useRef<PrimitiveSpatialIndex | null>(null);
  const rafRef = useRef<number | null>(null);

  // Initialize spatial index from current project state.
  useEffect(() => {
    const idx = new PrimitiveSpatialIndex();
    indexRef.current = idx;
    const initial = projectStore.getState().project;
    if (initial) {
      for (const p of Object.values(initial.primitives)) idx.insert(p);
    }
    return () => {
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
    if (props.onCanvasReady) props.onCanvasReady(canvas);
  }, [props.viewport.canvasWidthCss, props.viewport.canvasHeightCss, props.viewport.dpr, props.onCanvasReady]);

  return <canvas ref={canvasRef} data-component="canvas-host" />;
}
