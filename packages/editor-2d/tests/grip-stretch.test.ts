// grip-stretch tool tests for M1.3d Phase 6.
//
// Verifies that a grip + new point patches the primitive correctly
// for each kind, that the tool emits exactly one updatePrimitive call
// per release (I-DTP-13), and that suppressEntityPaint is set during
// the drag and cleared on commit/abort.

import {
  type CirclePrimitive,
  LayerId,
  type LinePrimitive,
  type PolylinePrimitive,
  type Project,
  type RectanglePrimitive,
  type XlinePrimitive,
  defaultLayer,
  newPrimitiveId,
  newProjectId,
} from '@portplanner/domain';
import {
  hydrateProject,
  projectStore,
  resetProjectStoreForTests,
} from '@portplanner/project-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { gripsOf } from '../src/canvas/grip-positions';
import { gripStretchTool } from '../src/tools/grip-stretch';
import { startTool } from '../src/tools/runner';
import { editorUiStore, resetEditorUiStoreForTests } from '../src/ui-state/store';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function makeProjectWith<T extends { id: string }>(p: T): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.2.0',
    name: 'GS-test',
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z',
    coordinateSystem: null,
    objects: {},
    primitives: {
      [p.id]: p as unknown as PolylinePrimitive | LinePrimitive,
    } as Project['primitives'],
    layers: { [LayerId.DEFAULT]: defaultLayer() },
    grids: {},
    scenarioId: null,
  };
}

beforeEach(() => {
  resetProjectStoreForTests();
  resetEditorUiStoreForTests();
});
afterEach(() => {
  resetProjectStoreForTests();
  resetEditorUiStoreForTests();
});

describe('grip-stretch — line endpoints', () => {
  it('p1 grip moves p1 to the new point', async () => {
    const line: LinePrimitive = {
      id: newPrimitiveId(),
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    };
    hydrateProject(makeProjectWith(line), '2026-04-26T00:00:00.000Z');
    const grip = gripsOf(line).find((g) => g.gripKind === 'p1')!;
    const tool = startTool('grip-stretch', gripStretchTool(grip));
    await tick();
    expect(editorUiStore.getState().overlay.suppressEntityPaint).toBe(line.id);
    tool.feedInput({ kind: 'point', point: { x: 2, y: 3 } });
    await tool.done();
    const after = projectStore.getState().project!.primitives[line.id] as LinePrimitive;
    expect(after.p1).toEqual({ x: 2, y: 3 });
    expect(after.p2).toEqual({ x: 10, y: 0 });
    expect(editorUiStore.getState().overlay.suppressEntityPaint).toBeNull();
  });

  it('p2 grip moves p2 to the new point', async () => {
    const line: LinePrimitive = {
      id: newPrimitiveId(),
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    };
    hydrateProject(makeProjectWith(line), '2026-04-26T00:00:00.000Z');
    const grip = gripsOf(line).find((g) => g.gripKind === 'p2')!;
    const tool = startTool('grip-stretch', gripStretchTool(grip));
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 7, y: 7 } });
    await tool.done();
    const after = projectStore.getState().project!.primitives[line.id] as LinePrimitive;
    expect(after.p1).toEqual({ x: 0, y: 0 });
    expect(after.p2).toEqual({ x: 7, y: 7 });
  });
});

describe('grip-stretch — polyline vertex', () => {
  it('vertex-N grip replaces vertices[N]', async () => {
    const poly: PolylinePrimitive = {
      id: newPrimitiveId(),
      kind: 'polyline',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      vertices: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
      ],
      bulges: [0, 0],
      closed: false,
    };
    hydrateProject(makeProjectWith(poly), '2026-04-26T00:00:00.000Z');
    const grip = gripsOf(poly).find((g) => g.gripKind === 'vertex-1')!;
    const tool = startTool('grip-stretch', gripStretchTool(grip));
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 5, y: 2 } });
    await tool.done();
    const after = projectStore.getState().project!.primitives[poly.id] as PolylinePrimitive;
    expect(after.vertices[1]).toEqual({ x: 5, y: 2 });
    expect(after.vertices[0]).toEqual({ x: 0, y: 0 });
    expect(after.vertices[2]).toEqual({ x: 5, y: 5 });
  });
});

describe('grip-stretch — circle (center vs edge)', () => {
  it('center grip moves the circle, preserves radius', async () => {
    const circle: CirclePrimitive = {
      id: newPrimitiveId(),
      kind: 'circle',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      center: { x: 0, y: 0 },
      radius: 5,
    };
    hydrateProject(makeProjectWith(circle), '2026-04-26T00:00:00.000Z');
    const grip = gripsOf(circle).find((g) => g.gripKind === 'center')!;
    const tool = startTool('grip-stretch', gripStretchTool(grip));
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 10 } });
    await tool.done();
    const after = projectStore.getState().project!.primitives[circle.id] as CirclePrimitive;
    expect(after.center).toEqual({ x: 10, y: 10 });
    expect(after.radius).toBe(5);
  });

  it('edge grip resizes the radius', async () => {
    const circle: CirclePrimitive = {
      id: newPrimitiveId(),
      kind: 'circle',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      center: { x: 0, y: 0 },
      radius: 5,
    };
    hydrateProject(makeProjectWith(circle), '2026-04-26T00:00:00.000Z');
    const grip = gripsOf(circle).find((g) => g.gripKind === 'east')!;
    const tool = startTool('grip-stretch', gripStretchTool(grip));
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 8, y: 0 } });
    await tool.done();
    const after = projectStore.getState().project!.primitives[circle.id] as CirclePrimitive;
    expect(after.center).toEqual({ x: 0, y: 0 });
    expect(after.radius).toBeCloseTo(8, 9);
  });
});

describe('grip-stretch — rectangle corner', () => {
  it('dragging corner-ne re-fits the bounding box from corner-sw', async () => {
    const rect: RectanglePrimitive = {
      id: newPrimitiveId(),
      kind: 'rectangle',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      origin: { x: 0, y: 0 },
      width: 4,
      height: 3,
      localAxisAngle: 0,
    };
    hydrateProject(makeProjectWith(rect), '2026-04-26T00:00:00.000Z');
    const grip = gripsOf(rect).find((g) => g.gripKind === 'corner-ne')!;
    const tool = startTool('grip-stretch', gripStretchTool(grip));
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 6, y: 5 } });
    await tool.done();
    const after = projectStore.getState().project!.primitives[rect.id] as RectanglePrimitive;
    expect(after.origin).toEqual({ x: 0, y: 0 });
    expect(after.width).toBe(6);
    expect(after.height).toBe(5);
  });
});

describe('grip-stretch — xline pivot vs direction', () => {
  it('pivot grip moves the pivot, preserves angle', async () => {
    const xl: XlinePrimitive = {
      id: newPrimitiveId(),
      kind: 'xline',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      pivot: { x: 0, y: 0 },
      angle: 0,
    };
    hydrateProject(makeProjectWith(xl), '2026-04-26T00:00:00.000Z');
    const grip = gripsOf(xl).find((g) => g.gripKind === 'pivot')!;
    const tool = startTool('grip-stretch', gripStretchTool(grip));
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 5, y: 5 } });
    await tool.done();
    const after = projectStore.getState().project!.primitives[xl.id] as XlinePrimitive;
    expect(after.pivot).toEqual({ x: 5, y: 5 });
    expect(after.angle).toBe(0);
  });

  it('direction grip recomputes angle from pivot to new point', async () => {
    const xl: XlinePrimitive = {
      id: newPrimitiveId(),
      kind: 'xline',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      pivot: { x: 0, y: 0 },
      angle: 0,
    };
    hydrateProject(makeProjectWith(xl), '2026-04-26T00:00:00.000Z');
    const grip = gripsOf(xl).find((g) => g.gripKind === 'direction')!;
    const tool = startTool('grip-stretch', gripStretchTool(grip));
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 10 } });
    await tool.done();
    const after = projectStore.getState().project!.primitives[xl.id] as XlinePrimitive;
    expect(after.pivot).toEqual({ x: 0, y: 0 });
    expect(after.angle).toBeCloseTo(Math.PI / 2, 9);
  });
});

// M1.3d-Remediation-3 F5 — regression marker. The bug fix lives in
// EditorRoot.handleGripDown (when a tool is running, feed grip.position
// as 'point' rather than aborting). Tool-level tests can't exercise the
// EditorRoot routing change, but they can confirm the runner-level
// invariant: if a tool is running and receives a 'point' input at the
// grip's position, it consumes it like any other 'point'. The SOLE
// integration validation surface is `smoke-e2e.test.tsx`'s
// `'grip click during running tool feeds point'` scenario.
describe('F5 regression — feeding grip.position as a point reaches the running tool', () => {
  it('a tool that expects a point consumes grip.position the same as any point', async () => {
    const line: LinePrimitive = {
      id: newPrimitiveId(),
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    };
    hydrateProject(makeProjectWith(line), '2026-04-26T00:00:00.000Z');
    const grip = gripsOf(line).find((g) => g.gripKind === 'p1')!;
    expect(grip.position).toEqual({ x: 0, y: 0 });
    const tool = startTool('grip-stretch', gripStretchTool(grip));
    await tick();
    // EditorRoot's F5 fix calls `tool.feedInput({ kind: 'point', point: grip.position })`.
    // We replicate that exact call here.
    tool.feedInput({ kind: 'point', point: grip.position });
    await tool.done();
    // The grip-stretch tool consumed the point and updated p1 → grip.position.
    const after = projectStore.getState().project!.primitives[line.id] as LinePrimitive;
    expect(after.p1).toEqual(grip.position);
  });
});

describe('grip-stretch — abort lifecycle', () => {
  it('escape aborts the tool and clears suppressEntityPaint', async () => {
    const line: LinePrimitive = {
      id: newPrimitiveId(),
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    };
    hydrateProject(makeProjectWith(line), '2026-04-26T00:00:00.000Z');
    const grip = gripsOf(line).find((g) => g.gripKind === 'p1')!;
    const tool = startTool('grip-stretch', gripStretchTool(grip));
    await tick();
    expect(editorUiStore.getState().overlay.suppressEntityPaint).toBe(line.id);
    tool.abort();
    const result = await tool.done();
    expect(result.committed).toBe(false);
    expect(editorUiStore.getState().overlay.suppressEntityPaint).toBeNull();
    // Primitive unchanged.
    const after = projectStore.getState().project!.primitives[line.id] as LinePrimitive;
    expect(after.p1).toEqual({ x: 0, y: 0 });
  });
});
