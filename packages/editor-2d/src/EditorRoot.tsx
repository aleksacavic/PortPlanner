// EditorRoot — top-level integration of canvas + chrome + tool runner +
// keyboard router. Wires up the running drafting surface.

import { type Project } from '@portplanner/domain';
import { projectStore } from '@portplanner/project-store';
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';

import { CanvasHost } from './canvas/canvas-host';
import { CommandBar } from './chrome/CommandBar';
import { LayerManagerDialog } from './chrome/LayerManagerDialog';
import { PropertiesPanel } from './chrome/PropertiesPanel';
import { useEditorUi } from './chrome/use-editor-ui-store';
import { registerKeyboardRouter } from './keyboard/router';
import type { ToolId } from './keyboard/shortcuts';
import { lookupTool } from './tools';
import { type RunningTool, startTool } from './tools/runner';
import { editorUiActions, editorUiStore } from './ui-state/store';

const ZOOM_FACTOR_PER_NOTCH = 1.1;

export function EditorRoot(): ReactElement {
  const viewport = useEditorUi((s) => s.viewport);
  const focusHolder = useEditorUi((s) => s.focusHolder);
  const activeToolId = useEditorUi((s) => s.activeToolId);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const runningToolRef = useRef<RunningTool | null>(null);
  const [layerManagerOpen, setLayerManagerOpen] = useState(false);

  const startToolById = useCallback((id: ToolId) => {
    if (runningToolRef.current) {
      runningToolRef.current.abort();
    }
    if (id === 'layer-manager') {
      setLayerManagerOpen(true);
      editorUiActions.pushFocusAndSet('dialog');
      return;
    }
    if (id === 'undo') {
      projectStore.temporal.getState().undo();
      return;
    }
    if (id === 'redo') {
      projectStore.temporal.getState().redo();
      return;
    }
    const factory = lookupTool(id);
    if (!factory) return;
    const tool = startTool(id, factory);
    runningToolRef.current = tool;
    tool.done().finally(() => {
      if (runningToolRef.current === tool) runningToolRef.current = null;
    });
  }, []);

  // Register the window-level keyboard router once on mount.
  useEffect(() => {
    const cleanup = registerKeyboardRouter({
      onActivateTool: startToolById,
      onUndo: () => projectStore.temporal.getState().undo(),
      onRedo: () => projectStore.temporal.getState().redo(),
      onAbortCurrentTool: () => {
        runningToolRef.current?.abort();
        runningToolRef.current = null;
      },
    });
    return cleanup;
  }, [startToolById]);

  // Resize observer to keep viewport canvas size in sync with the
  // container element.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const sync = () => {
      const rect = container.getBoundingClientRect();
      editorUiActions.setViewport({
        canvasWidthCss: Math.max(1, Math.floor(rect.width)),
        canvasHeightCss: Math.max(1, Math.floor(rect.height)),
        dpr: window.devicePixelRatio || 1,
      });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Auto-set activeLayerId to the project's default layer when a project
  // exists and no active layer is set.
  useEffect(() => {
    const sync = () => {
      const project: Project | null = projectStore.getState().project;
      const ui = editorUiStore.getState();
      if (project && ui.activeLayerId === null) {
        const firstLayer = Object.keys(project.layers)[0];
        if (firstLayer) editorUiActions.setActiveLayerId(firstLayer as never);
      }
    };
    sync();
    return projectStore.subscribe(sync);
  }, []);

  const handleCanvasClick = (metric: { x: number; y: number }) => {
    const tool = runningToolRef.current;
    if (tool) tool.feedInput({ kind: 'point', point: metric });
  };

  const handleSubOption = (label: string) => {
    runningToolRef.current?.feedInput({ kind: 'subOption', optionLabel: label });
  };

  const handleSubmit = (raw: string) => {
    const tool = runningToolRef.current;
    if (!tool) return;
    const asNum = Number(raw);
    if (raw.length > 0 && !Number.isNaN(asNum)) {
      tool.feedInput({ kind: 'number', value: asNum });
      return;
    }
    tool.feedInput({ kind: 'escape' });
  };

  const handlePan = (dxCss: number, dyCss: number) => {
    const v = editorUiStore.getState().viewport;
    editorUiActions.setViewport({
      panX: v.panX - dxCss / v.zoom,
      panY: v.panY + dyCss / v.zoom,
    });
  };

  const handleWheelZoom = (deltaY: number) => {
    const v = editorUiStore.getState().viewport;
    const factor = deltaY > 0 ? 1 / ZOOM_FACTOR_PER_NOTCH : ZOOM_FACTOR_PER_NOTCH;
    editorUiActions.setViewport({ zoom: Math.max(0.001, Math.min(10000, v.zoom * factor)) });
  };

  const handleLayerManagerClose = () => {
    setLayerManagerOpen(false);
    editorUiActions.popFocus();
  };

  return (
    <div
      data-component="editor-root"
      style={{
        display: 'grid',
        gridTemplateRows: '1fr auto',
        gridTemplateColumns: '1fr 260px',
        gridTemplateAreas: '"canvas props" "bar bar"',
        height: '100%',
        position: 'relative',
      }}
    >
      <div
        ref={containerRef}
        style={{ gridArea: 'canvas', position: 'relative', overflow: 'hidden' }}
      >
        <CanvasHost
          viewport={viewport}
          onCanvasClick={handleCanvasClick}
          onPan={handlePan}
          onWheelZoom={handleWheelZoom}
        />
        <ToolStatusOverlay activeToolId={activeToolId} focusHolder={focusHolder} />
        <ShortcutsHint />
      </div>
      <div style={{ gridArea: 'props', borderLeft: '1px solid #2a2a2a', overflow: 'auto' }}>
        <PropertiesPanel />
      </div>
      <div style={{ gridArea: 'bar' }}>
        <CommandBar onSubOption={handleSubOption} onSubmit={handleSubmit} />
      </div>
      {layerManagerOpen ? (
        <div style={{ position: 'absolute', top: 40, left: 40, zIndex: 10 }}>
          <LayerManagerDialog />
          <button
            type="button"
            onClick={handleLayerManagerClose}
            style={{ marginTop: 8, padding: '4px 12px' }}
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ToolStatusOverlay(props: {
  activeToolId: string | null;
  focusHolder: string;
}): ReactElement | null {
  if (!props.activeToolId) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        background: 'rgba(0,0,0,0.6)',
        color: '#eee',
        padding: '4px 8px',
        fontSize: 12,
        fontFamily: 'ui-monospace, monospace',
        borderRadius: 4,
        pointerEvents: 'none',
      }}
    >
      Active: {props.activeToolId} · focus: {props.focusHolder}
    </div>
  );
}

function ShortcutsHint(): ReactElement {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 8,
        right: 8,
        background: 'rgba(0,0,0,0.55)',
        color: '#bbb',
        padding: '6px 10px',
        fontSize: 11,
        fontFamily: 'ui-monospace, monospace',
        borderRadius: 4,
        lineHeight: 1.6,
        pointerEvents: 'none',
        maxWidth: 260,
      }}
    >
      <strong>Draw:</strong> L · PT · PL · REC · CC · A · XL
      <br />
      <strong>Edit:</strong> S · E · M · C · Z · LA · Ctrl+Z
      <br />
      <strong>Toggles:</strong> F3 OSNAP · F8 Ortho · F9 GSnap · F12 Bar
      <br />
      <strong>Pan/zoom:</strong> middle-drag / wheel
    </div>
  );
}
