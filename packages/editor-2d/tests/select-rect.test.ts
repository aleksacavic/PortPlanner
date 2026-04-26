// select-rect tool tests for M1.3d Phase 7.
//
// Verifies direction convention (I-DTP-15), window vs crossing
// resolution (I-DTP-16), and click-without-drag → single hit-test
// (I-DTP-17).

import {
  LayerId,
  type LinePrimitive,
  type Project,
  defaultLayer,
  newPrimitiveId,
  newProjectId,
} from '@portplanner/domain';
import { hydrateProject, resetProjectStoreForTests } from '@portplanner/project-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type Viewport, metricToScreen } from '../src/canvas/view-transform';
import { startTool } from '../src/tools/runner';
import { selectRectTool } from '../src/tools/select-rect';
import { editorUiActions, editorUiStore, resetEditorUiStoreForTests } from '../src/ui-state/store';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const viewport: Viewport = {
  panX: 0,
  panY: 0,
  zoom: 10,
  dpr: 1,
  canvasWidthCss: 800,
  canvasHeightCss: 600,
  crosshairSizePct: 100,
};

function lineP(p1: { x: number; y: number }, p2: { x: number; y: number }): LinePrimitive {
  return {
    id: newPrimitiveId(),
    kind: 'line',
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    p1,
    p2,
  };
}

function makeProjectWith(prims: LinePrimitive[]): Project {
  const primitives: Project['primitives'] = {};
  for (const p of prims) primitives[p.id] = p;
  return {
    id: newProjectId(),
    schemaVersion: '1.1.0',
    name: 'SR-test',
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z',
    coordinateSystem: null,
    objects: {},
    primitives,
    layers: { [LayerId.DEFAULT]: defaultLayer() },
    grids: {},
    scenarioId: null,
  };
}

beforeEach(() => {
  resetProjectStoreForTests();
  resetEditorUiStoreForTests();
  editorUiActions.setViewport(viewport);
});
afterEach(() => {
  resetProjectStoreForTests();
  resetEditorUiStoreForTests();
});

describe('select-rect — window (L→R) selects only fully-enclosed entities', () => {
  it('selects entity whose bbox is inside the drag rect', async () => {
    const inside = lineP({ x: 1, y: 1 }, { x: 4, y: 4 });
    const partial = lineP({ x: 3, y: 3 }, { x: 50, y: 50 });
    hydrateProject(makeProjectWith([inside, partial]), '2026-04-26T00:00:00.000Z');
    // L→R drag: start (0,0) → end (10,10), in metric.
    const start = { x: 0, y: 0 };
    const startScreen = metricToScreen(start, viewport);
    const tool = startTool('select-rect', selectRectTool(start, startScreen));
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 10 } });
    await tool.done();
    const sel = editorUiStore.getState().selection;
    expect(sel).toContain(inside.id);
    expect(sel).not.toContain(partial.id);
  });
});

describe('select-rect — crossing (R→L) selects any-touch entities', () => {
  it('selects entities whose bbox intersects the drag rect (incl. partials)', async () => {
    const inside = lineP({ x: 1, y: 1 }, { x: 4, y: 4 });
    const partial = lineP({ x: 3, y: 3 }, { x: 50, y: 50 });
    const outside = lineP({ x: 200, y: 200 }, { x: 210, y: 210 });
    hydrateProject(makeProjectWith([inside, partial, outside]), '2026-04-26T00:00:00.000Z');
    // R→L drag: start (10,10) → end (0,0). end.x < start.x → crossing.
    const start = { x: 10, y: 10 };
    const startScreen = metricToScreen(start, viewport);
    const tool = startTool('select-rect', selectRectTool(start, startScreen));
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tool.done();
    const sel = editorUiStore.getState().selection;
    expect(sel).toContain(inside.id);
    expect(sel).toContain(partial.id);
    expect(sel).not.toContain(outside.id);
  });
});

describe('select-rect — click-without-drag (start ≈ end) → single-entity hit-test (I-DTP-17)', () => {
  it('clicking on an entity selects it without firing the drag rect', async () => {
    const target = lineP({ x: 0, y: 0 }, { x: 10, y: 0 });
    hydrateProject(makeProjectWith([target]), '2026-04-26T00:00:00.000Z');
    // Click at metric (5, 0) — on the line. Mousedown == mouseup.
    const start = { x: 5, y: 0 };
    const startScreen = metricToScreen(start, viewport);
    const tool = startTool('select-rect', selectRectTool(start, startScreen));
    await tick();
    tool.feedInput({ kind: 'point', point: start });
    await tool.done();
    const sel = editorUiStore.getState().selection;
    expect(sel).toContain(target.id);
  });

  it('clicking on empty space clears the selection', async () => {
    const target = lineP({ x: 0, y: 0 }, { x: 10, y: 0 });
    hydrateProject(makeProjectWith([target]), '2026-04-26T00:00:00.000Z');
    editorUiActions.setSelection([target.id]); // pre-existing selection

    const start = { x: 100, y: 100 }; // far from any entity
    const startScreen = metricToScreen(start, viewport);
    const tool = startTool('select-rect', selectRectTool(start, startScreen));
    await tick();
    tool.feedInput({ kind: 'point', point: start });
    await tool.done();
    const sel = editorUiStore.getState().selection;
    expect(sel).toEqual([]);
  });
});

describe('select-rect — selection-rect previewBuilder dispatches by direction', () => {
  it('emits direction = window when cursor.x >= start.x', async () => {
    const start = { x: 0, y: 0 };
    const startScreen = metricToScreen(start, viewport);
    const tool = startTool('select-rect', selectRectTool(start, startScreen));
    await tick();
    // The runner publishes the previewShape for cursor=(0,0) initially
    // (since overlay.cursor is null in this test, no preview yet).
    // Drive a cursor change and assert the previewShape direction.
    editorUiActions.setCursor({
      metric: { x: 10, y: 10 },
      screen: { x: 0, y: 0 },
    });
    await tick();
    const ps = editorUiStore.getState().overlay.previewShape;
    expect(ps?.kind).toBe('selection-rect');
    if (ps?.kind === 'selection-rect') {
      expect(ps.direction).toBe('window');
    }
    // R→L direction
    editorUiActions.setCursor({ metric: { x: -1, y: 0 }, screen: { x: 0, y: 0 } });
    await tick();
    const ps2 = editorUiStore.getState().overlay.previewShape;
    if (ps2?.kind === 'selection-rect') {
      expect(ps2.direction).toBe('crossing');
    }
    tool.abort();
    await tool.done();
  });
});
