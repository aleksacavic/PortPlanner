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

import { CanvasHost } from './canvas/canvas-host';
import { hitTest } from './canvas/hit-test';
import { PrimitiveSpatialIndex } from './canvas/spatial-index';
import { CommandBar } from './chrome/CommandBar';
import { LayerManagerDialog } from './chrome/LayerManagerDialog';
import { PropertiesPanel } from './chrome/PropertiesPanel';
import { useEditorUi } from './chrome/use-editor-ui-store';
import { registerKeyboardRouter } from './keyboard/router';
import { lookupTool } from './tools';
import { type RunningTool, startTool } from './tools/runner';
import { editorUiActions, editorUiStore } from './ui-state/store';

const ZOOM_MIN = 0.001;
const ZOOM_MAX = 10000;
const ZOOM_STEP = 1.1;

export function EditorRoot(): ReactElement {
  const viewport = useEditorUi((s) => s.viewport);
  const runningToolRef = useRef<RunningTool | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
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
    return registerKeyboardRouter({
      onActivateTool: (id) => {
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
      },
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

  const handleCanvasClick = (metric: Point2D, screen: { x: number; y: number }): void => {
    const tool = runningToolRef.current;
    if (tool) {
      tool.feedInput({ kind: 'point', point: metric });
      return;
    }
    // No active tool — hit-test for selection (Phase 22 wiring; the
    // canvas-host owns its own spatial index for paint, but selection
    // builds a one-shot index here to keep canvas-host single-purpose).
    const project = projectStore.getState().project;
    if (!project) return;
    const idx = new PrimitiveSpatialIndex();
    for (const p of Object.values(project.primitives)) idx.insert(p);
    const hit = hitTest(screen, viewport, idx, project.primitives);
    editorUiActions.setSelection(hit ? [hit] : []);
  };

  const handlePan = (dxCss: number, dyCss: number): void => {
    const v = editorUiStore.getState().viewport;
    editorUiActions.setViewport({
      panX: v.panX - dxCss / v.zoom,
      panY: v.panY + dyCss / v.zoom,
    });
  };

  const handleWheelZoom = (deltaY: number): void => {
    const v = editorUiStore.getState().viewport;
    const factor = ZOOM_STEP ** -Math.sign(deltaY);
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * factor));
    editorUiActions.setViewport({ zoom: next });
  };

  const handleCommandSubOption = (label: string): void => {
    runningToolRef.current?.feedInput({ kind: 'subOption', optionLabel: label });
  };

  const handleCommandSubmit = (raw: string): void => {
    if (raw.length === 0) {
      runningToolRef.current?.feedInput({ kind: 'escape' });
      return;
    }
    const num = Number(raw);
    if (Number.isFinite(num)) {
      runningToolRef.current?.feedInput({ kind: 'number', value: num });
    }
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
          viewport={viewport}
          onCanvasClick={handleCanvasClick}
          onPan={handlePan}
          onWheelZoom={handleWheelZoom}
        />
      </div>
      <div data-component="properties-area" style={{ gridColumn: 2, gridRow: 1, overflow: 'auto' }}>
        <PropertiesPanel />
      </div>
      <div data-component="command-bar-area" style={{ gridColumn: '1 / -1', gridRow: 2 }}>
        <CommandBar onSubOption={handleCommandSubOption} onSubmit={handleCommandSubmit} />
      </div>
      {layerManagerOpen ? <LayerManagerDialog /> : null}
    </div>
  );
}
