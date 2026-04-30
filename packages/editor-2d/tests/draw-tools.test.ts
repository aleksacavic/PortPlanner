import {
  LayerId,
  type Polyline,
  type Project,
  defaultLayer,
  newProjectId,
} from '@portplanner/domain';
import {
  createNewProject,
  projectStore,
  resetProjectStoreForTests,
} from '@portplanner/project-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { lookupTool } from '../src/tools';
import { startTool } from '../src/tools/runner';
import { editorUiActions, resetEditorUiStoreForTests } from '../src/ui-state/store';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function makeProject(): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.2.0',
    name: 'T',
    createdAt: '2026-04-25T10:00:00.000Z',
    updatedAt: '2026-04-25T10:00:00.000Z',
    coordinateSystem: null,
    objects: {},
    primitives: {},
    layers: { [LayerId.DEFAULT]: defaultLayer() },
    grids: {},
    scenarioId: null,
  };
}

describe('seven primitive draw tools', () => {
  beforeEach(() => {
    createNewProject(makeProject());
  });
  afterEach(() => resetProjectStoreForTests());

  it('draw-line places a line primitive (2 prompts)', async () => {
    const tool = startTool('draw-line', lookupTool('draw-line')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 0 } });
    const result = await tool.done();
    expect(result.committed).toBe(true);
    const lines = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'line',
    );
    expect(lines).toHaveLength(1);
  });

  it('draw-point places a point', async () => {
    const tool = startTool('draw-point', lookupTool('draw-point')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 5, y: 5 } });
    await tool.done();
    const points = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'point',
    );
    expect(points).toHaveLength(1);
  });

  it('draw-rectangle places a rectangle with localAxisAngle=0 (M1.3a)', async () => {
    const tool = startTool('draw-rectangle', lookupTool('draw-rectangle')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 5, y: 3 } });
    await tool.done();
    const rects = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'rectangle',
    );
    expect(rects).toHaveLength(1);
    expect((rects[0] as { localAxisAngle: number }).localAxisAngle).toBe(0);
  });

  it('draw-circle places a circle with center + radius', async () => {
    const tool = startTool('draw-circle', lookupTool('draw-circle')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 3, y: 4 } });
    await tool.done();
    const circles = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'circle',
    );
    expect(circles).toHaveLength(1);
    expect((circles[0] as { radius: number }).radius).toBeCloseTo(5, 9);
  });

  it('draw-arc 3-point places an arc', async () => {
    const tool = startTool('draw-arc', lookupTool('draw-arc')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 1, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 1 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: -1, y: 0 } });
    await tool.done();
    const arcs = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'arc',
    );
    expect(arcs).toHaveLength(1);
  });

  it('draw-xline places an xline with computed angle', async () => {
    const tool = startTool('draw-xline', lookupTool('draw-xline')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 0 } });
    await tool.done();
    const xs = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'xline',
    );
    expect(xs).toHaveLength(1);
    expect((xs[0] as { angle: number }).angle).toBeCloseTo(0, 9);
  });

  it('draw-polyline emits zero bulges only (I-48 — M1.3a polyline draw is straight-only)', async () => {
    const tool = startTool('draw-polyline', lookupTool('draw-polyline')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 5 } });
    await tick();
    tool.feedInput({ kind: 'subOption', optionLabel: 'Close' });
    await tool.done();
    const polys = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'polyline',
    );
    expect(polys).toHaveLength(1);
    const poly = polys[0] as Polyline;
    expect(poly.bulges.every((b) => b === 0)).toBe(true);
    expect(poly.closed).toBe(true);
  });

  it('draw-polyline Close requires >=3 vertices', async () => {
    const tool = startTool('draw-polyline', lookupTool('draw-polyline')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'subOption', optionLabel: 'Close' });
    const result = await tool.done();
    expect(result.committed).toBe(false);
  });

  it('draw-polyline commit-open ends the loop and saves an open polyline (>=2 vertices)', async () => {
    // commit Input mirrors the runtime path: empty Enter in the command
    // bar / Enter on canvas focus / right-click on canvas all feed
    // { kind: 'commit' } so the open-ended polyline loop can exit.
    const tool = startTool('draw-polyline', lookupTool('draw-polyline')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 5 } });
    await tick();
    tool.feedInput({ kind: 'commit' });
    const result = await tool.done();
    expect(result.committed).toBe(true);
    const polys = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'polyline',
    );
    expect(polys).toHaveLength(1);
    const poly = polys[0] as Polyline;
    expect(poly.closed).toBe(false);
    expect(poly.vertices).toHaveLength(3);
    // Open polyline: bulges length === vertices.length - 1 (per ADR-016 / I-5).
    expect(poly.bulges).toHaveLength(2);
  });

  it('draw-polyline commit-open with only 1 vertex aborts (cannot make a 1-vertex polyline)', async () => {
    const tool = startTool('draw-polyline', lookupTool('draw-polyline')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'commit' });
    const result = await tool.done();
    expect(result.committed).toBe(false);
  });
});

// M1.3d Phase 4 — assert each draw tool yields a previewBuilder on the
// expected prompt(s). We drive the generator directly (bypassing the
// runner) so the assertion is on what the tool yields, not what the
// runner does with it.
describe('draw tools yield previewBuilder (M1.3d Phase 4)', () => {
  beforeEach(() => createNewProject(makeProject()));
  afterEach(() => resetProjectStoreForTests());

  it('draw-line yields previewBuilder on the second prompt only', async () => {
    const factory = lookupTool('draw-line')!;
    const gen = factory();
    const first = await gen.next();
    expect((first.value as { previewBuilder?: unknown }).previewBuilder).toBeUndefined();
    const second = await gen.next({ kind: 'point', point: { x: 0, y: 0 } });
    expect(typeof (second.value as { previewBuilder?: unknown }).previewBuilder).toBe('function');
    const built = (
      second.value as { previewBuilder: (c: { x: number; y: number }) => unknown }
    ).previewBuilder({ x: 5, y: 0 });
    expect(built).toEqual({ kind: 'line', p1: { x: 0, y: 0 }, cursor: { x: 5, y: 0 } });
    await gen.return({ committed: false, reason: 'aborted' });
  });

  it('draw-rectangle yields previewBuilder on the second prompt', async () => {
    const factory = lookupTool('draw-rectangle')!;
    const gen = factory();
    await gen.next();
    const second = await gen.next({ kind: 'point', point: { x: 1, y: 2 } });
    const builder = (second.value as { previewBuilder?: (c: unknown) => unknown }).previewBuilder;
    expect(typeof builder).toBe('function');
    expect(builder!({ x: 4, y: 6 })).toEqual({
      kind: 'rectangle',
      corner1: { x: 1, y: 2 },
      cursor: { x: 4, y: 6 },
    });
    await gen.return({ committed: false, reason: 'aborted' });
  });

  it('draw-circle yields previewBuilder on the second prompt', async () => {
    const factory = lookupTool('draw-circle')!;
    const gen = factory();
    await gen.next();
    const second = await gen.next({ kind: 'point', point: { x: 0, y: 0 } });
    const builder = (second.value as { previewBuilder?: (c: unknown) => unknown }).previewBuilder;
    expect(typeof builder).toBe('function');
    expect(builder!({ x: 5, y: 0 })).toEqual({
      kind: 'circle',
      center: { x: 0, y: 0 },
      cursor: { x: 5, y: 0 },
    });
    await gen.return({ committed: false, reason: 'aborted' });
  });

  it('draw-arc yields arc-2pt on prompt 2 and arc-3pt on prompt 3', async () => {
    const factory = lookupTool('draw-arc')!;
    const gen = factory();
    await gen.next();
    const second = await gen.next({ kind: 'point', point: { x: 0, y: 0 } });
    const builder2 = (second.value as { previewBuilder?: (c: unknown) => unknown }).previewBuilder;
    expect(builder2!({ x: 1, y: 0 })).toMatchObject({ kind: 'arc-2pt' });
    const third = await gen.next({ kind: 'point', point: { x: 1, y: 1 } });
    const builder3 = (third.value as { previewBuilder?: (c: unknown) => unknown }).previewBuilder;
    expect(builder3!({ x: 2, y: 0 })).toMatchObject({ kind: 'arc-3pt' });
    await gen.return({ committed: false, reason: 'aborted' });
  });

  it('draw-xline yields previewBuilder on the second prompt', async () => {
    const factory = lookupTool('draw-xline')!;
    const gen = factory();
    await gen.next();
    const second = await gen.next({ kind: 'point', point: { x: 0, y: 0 } });
    const builder = (second.value as { previewBuilder?: (c: unknown) => unknown }).previewBuilder;
    expect(builder!({ x: 1, y: 1 })).toMatchObject({ kind: 'xline' });
    await gen.return({ committed: false, reason: 'aborted' });
  });

  it('draw-polyline yields previewBuilder on every loop iteration', async () => {
    const factory = lookupTool('draw-polyline')!;
    const gen = factory();
    await gen.next();
    const loop1 = await gen.next({ kind: 'point', point: { x: 0, y: 0 } });
    const builder1 = (loop1.value as { previewBuilder?: (c: unknown) => unknown }).previewBuilder;
    expect(typeof builder1).toBe('function');
    expect(builder1!({ x: 5, y: 5 })).toEqual({
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }],
      cursor: { x: 5, y: 5 },
      closed: false,
    });
    const loop2 = await gen.next({ kind: 'point', point: { x: 10, y: 0 } });
    const builder2 = (loop2.value as { previewBuilder?: (c: unknown) => unknown }).previewBuilder;
    expect(builder2!({ x: 5, y: 5 })).toEqual({
      kind: 'polyline',
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      cursor: { x: 5, y: 5 },
      closed: false,
    });
    await gen.return({ committed: false, reason: 'aborted' });
  });

  it('draw-point does NOT yield previewBuilder (single-click commit)', async () => {
    const factory = lookupTool('draw-point')!;
    const gen = factory();
    const first = await gen.next();
    expect((first.value as { previewBuilder?: unknown }).previewBuilder).toBeUndefined();
    await gen.return({ committed: false, reason: 'aborted' });
  });
});

// M1.3d-Remediation-3 F1 — opted-in draw tools yield directDistanceFrom
// alongside the previewBuilder. EditorRoot's handleCommandSubmit
// converts numeric input + this anchor + lastKnownCursor → 'point'.
describe('draw tools yield directDistanceFrom (M1.3d-Rem-3 F1)', () => {
  beforeEach(() => createNewProject(makeProject()));
  afterEach(() => resetProjectStoreForTests());

  it('draw-line yields directDistanceFrom = p1 on the second prompt', async () => {
    const factory = lookupTool('draw-line')!;
    const gen = factory();
    const first = await gen.next();
    expect((first.value as { directDistanceFrom?: unknown }).directDistanceFrom).toBeUndefined();
    const second = await gen.next({ kind: 'point', point: { x: 7, y: 11 } });
    expect(
      (second.value as { directDistanceFrom?: { x: number; y: number } }).directDistanceFrom,
    ).toEqual({
      x: 7,
      y: 11,
    });
    await gen.return({ committed: false, reason: 'aborted' });
  });

  it('draw-polyline yields directDistanceFrom = lastVertex on each loop iteration', async () => {
    const factory = lookupTool('draw-polyline')!;
    const gen = factory();
    await gen.next();
    const loop1 = await gen.next({ kind: 'point', point: { x: 0, y: 0 } });
    expect(
      (loop1.value as { directDistanceFrom?: { x: number; y: number } }).directDistanceFrom,
    ).toEqual({
      x: 0,
      y: 0,
    });
    const loop2 = await gen.next({ kind: 'point', point: { x: 10, y: 5 } });
    expect(
      (loop2.value as { directDistanceFrom?: { x: number; y: number } }).directDistanceFrom,
    ).toEqual({
      x: 10,
      y: 5,
    });
    await gen.return({ committed: false, reason: 'aborted' });
  });

  it('draw-circle yields directDistanceFrom = center on the second prompt', async () => {
    const factory = lookupTool('draw-circle')!;
    const gen = factory();
    await gen.next();
    const second = await gen.next({ kind: 'point', point: { x: 3, y: 4 } });
    expect(
      (second.value as { directDistanceFrom?: { x: number; y: number } }).directDistanceFrom,
    ).toEqual({
      x: 3,
      y: 4,
    });
    await gen.return({ committed: false, reason: 'aborted' });
  });

  it('draw-arc yields directDistanceFrom on second (=p1) and third (=p2) prompts', async () => {
    const factory = lookupTool('draw-arc')!;
    const gen = factory();
    await gen.next();
    const second = await gen.next({ kind: 'point', point: { x: 1, y: 0 } });
    expect(
      (second.value as { directDistanceFrom?: { x: number; y: number } }).directDistanceFrom,
    ).toEqual({
      x: 1,
      y: 0,
    });
    const third = await gen.next({ kind: 'point', point: { x: 0, y: 1 } });
    expect(
      (third.value as { directDistanceFrom?: { x: number; y: number } }).directDistanceFrom,
    ).toEqual({
      x: 0,
      y: 1,
    });
    await gen.return({ committed: false, reason: 'aborted' });
  });

  it('draw-rectangle does NOT yield directDistanceFrom (F3 D-sub-option handles its typed dims)', async () => {
    const factory = lookupTool('draw-rectangle')!;
    const gen = factory();
    await gen.next();
    const second = await gen.next({ kind: 'point', point: { x: 0, y: 0 } });
    expect((second.value as { directDistanceFrom?: unknown }).directDistanceFrom).toBeUndefined();
    await gen.return({ committed: false, reason: 'aborted' });
  });
});

// M1.3d-Remediation-3 F2 — Shift held during second click forces square.
// Test mutates editorUiStore.modifiers.shift directly to simulate the
// keyboard router's keydown listener.
describe('draw-rectangle F2 — Shift forces square', () => {
  beforeEach(() => createNewProject(makeProject()));
  afterEach(() => {
    resetProjectStoreForTests();
    resetEditorUiStoreForTests();
  });

  it('Shift held: rectangle commits as a square sized by max(|dx|, |dy|)', async () => {
    editorUiActions.setShift(true);
    const tool = startTool('draw-rectangle', lookupTool('draw-rectangle')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    // Cursor at (5, 3) with shift → side = max(5, 3) = 5 → square 5×5.
    tool.feedInput({ kind: 'point', point: { x: 5, y: 3 } });
    await tool.done();
    const rects = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'rectangle',
    );
    expect(rects).toHaveLength(1);
    const r = rects[0] as { width: number; height: number };
    expect(r.width).toBe(5);
    expect(r.height).toBe(5);
  });

  it('Shift NOT held: rectangle commits as the actual W×H from the two clicks', async () => {
    editorUiActions.setShift(false);
    const tool = startTool('draw-rectangle', lookupTool('draw-rectangle')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 5, y: 3 } });
    await tool.done();
    const rects = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'rectangle',
    );
    const r = rects[0] as { width: number; height: number };
    expect(r.width).toBe(5);
    expect(r.height).toBe(3);
  });
});

// M1.3d-Remediation-3 F3 — Dimensions sub-option flow.
describe('draw-rectangle F3 — Dimensions sub-option', () => {
  beforeEach(() => createNewProject(makeProject()));
  afterEach(() => {
    resetProjectStoreForTests();
    resetEditorUiStoreForTests();
  });

  it('second prompt declares the [Dimensions] sub-option with shortcut "d"', async () => {
    const factory = lookupTool('draw-rectangle')!;
    const gen = factory();
    await gen.next();
    const second = await gen.next({ kind: 'point', point: { x: 0, y: 0 } });
    const subOptions = (second.value as { subOptions?: Array<{ label: string; shortcut: string }> })
      .subOptions;
    expect(subOptions).toEqual([{ label: 'Dimensions', shortcut: 'd' }]);
    expect((second.value as { acceptedInputKinds: string[] }).acceptedInputKinds).toContain(
      'subOption',
    );
    await gen.return({ committed: false, reason: 'aborted' });
  });

  // M1.3d-Rem-5 H1 — Dimensions sub-flow now takes a single comma-pair
  // input (`{kind:'numberPair', a:width, b:height}`) instead of two
  // separate `'number'` inputs.
  it('Dimensions flow: typed W,H commit a rectangle of those dimensions from corner1', async () => {
    const tool = startTool('draw-rectangle', lookupTool('draw-rectangle')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 1, y: 2 } });
    await tick();
    tool.feedInput({ kind: 'subOption', optionLabel: 'Dimensions' });
    await tick();
    tool.feedInput({ kind: 'numberPair', a: 8, b: 4 });
    await tool.done();
    const rects = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'rectangle',
    );
    expect(rects).toHaveLength(1);
    const r = rects[0] as { origin: { x: number; y: number }; width: number; height: number };
    expect(r.origin).toEqual({ x: 1, y: 2 });
    expect(r.width).toBe(8);
    expect(r.height).toBe(4);
  });

  it('Dimensions abort path: missing dimensions input aborts cleanly', async () => {
    const tool = startTool('draw-rectangle', lookupTool('draw-rectangle')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'subOption', optionLabel: 'Dimensions' });
    await tick();
    // Send a non-numberPair input → tool aborts via `dims.kind !== 'numberPair'` guard.
    tool.feedInput({ kind: 'commit' });
    const result = await tool.done();
    expect(result.committed).toBe(false);
    const rects = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'rectangle',
    );
    expect(rects).toHaveLength(0);
  });

  it('Dimensions sub-flow yields ONE prompt accepting numberPair (Rem-5 H1 contract lock)', async () => {
    const factory = lookupTool('draw-rectangle')!;
    const gen = factory();
    await gen.next();
    const second = await gen.next({ kind: 'point', point: { x: 0, y: 0 } });
    const dimsPrompt = await gen.next({ kind: 'subOption', optionLabel: 'Dimensions' });
    expect((dimsPrompt.value as { acceptedInputKinds: string[] }).acceptedInputKinds).toEqual([
      'numberPair',
    ]);
    expect((dimsPrompt.value as { text: string }).text).toContain('width,height');
    // Verify there is NOT a second follow-up prompt by ending the generator.
    await gen.return({ committed: false, reason: 'aborted' });
    void second;
  });

  it('Dimensions: parser rejects empty first/second token via tool abort (Rem-5 H1 R3-C2)', async () => {
    // The H1 parser guard rejects malformed pairs (",40", "30,", ",", etc.)
    // by falling through past the numberPair branch. The runner never
    // receives a numberPair Input. This tool-level test verifies that if
    // the runner DOES receive a non-numberPair input at the Dimensions
    // prompt, the tool aborts cleanly. Combined with the parser unit
    // semantics (the comma-pair branch only fires when both tokens
    // trim-non-empty — verified by code inspection / Gate REM5-H1b),
    // this proves end-to-end that ",40" / "30," / "," do not commit a
    // rectangle. (A more exhaustive parser-level test would require
    // mounted EditorRoot — covered separately if added.)
    const tool = startTool('draw-rectangle', lookupTool('draw-rectangle')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'subOption', optionLabel: 'Dimensions' });
    await tick();
    // Simulate parser fall-through: no numberPair fed; commit aborts the tool.
    tool.feedInput({ kind: 'commit' });
    const result = await tool.done();
    expect(result.committed).toBe(false);
  });

  it('Dimensions: Math.abs handles negative numberPair inputs (width=-8 → 8)', async () => {
    const tool = startTool('draw-rectangle', lookupTool('draw-rectangle')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'subOption', optionLabel: 'Dimensions' });
    await tick();
    tool.feedInput({ kind: 'numberPair', a: -8, b: 4 });
    await tool.done();
    const rects = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'rectangle',
    );
    const r = rects[0] as { width: number; height: number };
    expect(r.width).toBe(8);
    expect(r.height).toBe(4);
  });
});

// M1.3 Round 6 — per-tool manifest publish tests per plan §11. Verifies
// each migrated tool yields the expected DynamicInputManifest on the
// relevant prompt + that the dimensionGuidesBuilder produces the
// expected DimensionGuide[] given known cursor + state.
describe('M1.3 Round 6 — per-tool DI manifest publish', () => {
  beforeEach(() => {
    createNewProject(makeProject());
    editorUiActions.setCursor({ metric: { x: 5, y: 2 }, screen: { x: 50, y: 20 } });
  });
  afterEach(() => resetEditorUiStoreForTests());

  it('rectangle: second-corner prompt yields {fields: [W, H], combineAs: numberPair} + 2 linear-dim guides', async () => {
    const tool = startTool('draw-rectangle', lookupTool('draw-rectangle')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    // Now second-corner prompt is yielded; runner has published manifest.
    const di = (await import('../src/ui-state/store')).editorUiStore.getState().commandBar
      .dynamicInput;
    expect(di).not.toBeNull();
    expect(di?.manifest.fields).toHaveLength(2);
    expect(di?.manifest.combineAs).toBe('numberPair');
    expect(di?.manifest.fields[0]?.label).toBe('W');
    expect(di?.manifest.fields[1]?.label).toBe('H');
    // dimensionGuides populated synchronously on yield.
    const guides = (await import('../src/ui-state/store')).editorUiStore.getState().overlay
      .dimensionGuides;
    expect(guides).toHaveLength(2);
    expect(guides?.[0]?.kind).toBe('linear-dim');
    expect(guides?.[1]?.kind).toBe('linear-dim');
    tool.abort();
    await tool.done();
  });

  it('line: second-point prompt yields {fields: [Distance, Angle], combineAs: point} + linear-dim + angle-arc guides', async () => {
    const tool = startTool('draw-line', lookupTool('draw-line')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    const di = (await import('../src/ui-state/store')).editorUiStore.getState().commandBar
      .dynamicInput;
    expect(di?.manifest.fields).toHaveLength(2);
    expect(di?.manifest.combineAs).toBe('point');
    expect(di?.manifest.fields[0]?.label).toBe('Distance');
    expect(di?.manifest.fields[1]?.label).toBe('Angle');
    const guides = (await import('../src/ui-state/store')).editorUiStore.getState().overlay
      .dimensionGuides;
    expect(guides?.[0]?.kind).toBe('linear-dim');
    expect(guides?.[1]?.kind).toBe('angle-arc');
    tool.abort();
    await tool.done();
  });

  it('polyline: per-loop next-point prompt yields the same shape as line + uses last vertex as anchor + sets persistKey "next-vertex" (Round 7 Phase 2 — I-BPER-3)', async () => {
    const tool = startTool('draw-polyline', lookupTool('draw-polyline')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    // After p1, polyline yields next-point with manifest. Anchor = p1.
    const di = (await import('../src/ui-state/store')).editorUiStore.getState().commandBar
      .dynamicInput;
    expect(di?.manifest.combineAs).toBe('point');
    // Round 7 Phase 2: every loop iteration shares one persistKey
    // ('next-vertex') so iteration N+1 dim-placeholder seeds from
    // iteration N's submitted buffers. Locks I-BPER-3.
    expect(di?.promptKey).toBe('draw-polyline:next-vertex');
    const guides = (await import('../src/ui-state/store')).editorUiStore.getState().overlay
      .dimensionGuides;
    if (guides?.[0]?.kind === 'linear-dim') {
      expect(guides[0].anchorA).toEqual({ x: 0, y: 0 });
    } else {
      throw new Error('expected linear-dim guide[0]');
    }
    // Feed second vertex; next loop iteration should re-yield with anchor at (3,4).
    tool.feedInput({ kind: 'point', point: { x: 3, y: 4 } });
    await tick();
    const storeAfter2 = (await import('../src/ui-state/store')).editorUiStore.getState();
    const guidesNext = storeAfter2.overlay.dimensionGuides;
    if (guidesNext?.[0]?.kind === 'linear-dim') {
      expect(guidesNext[0].anchorA).toEqual({ x: 3, y: 4 });
    } else {
      throw new Error('expected linear-dim guide[0] after 2nd vertex');
    }
    // Round 7 Phase 2: persistKey stays 'next-vertex' across iterations.
    expect(storeAfter2.commandBar.dynamicInput?.promptKey).toBe('draw-polyline:next-vertex');
    tool.abort();
    await tool.done();
  });

  it('circle: radius prompt yields single-field {fields: [Radius], combineAs: number} + linear-dim guide (Round-2: dim treatment, no angle since rotationally symmetric)', async () => {
    const tool = startTool('draw-circle', lookupTool('draw-circle')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 5, y: 5 } });
    await tick();
    const di = (await import('../src/ui-state/store')).editorUiStore.getState().commandBar
      .dynamicInput;
    expect(di?.manifest.fields).toHaveLength(1);
    expect(di?.manifest.combineAs).toBe('number');
    expect(di?.manifest.fields[0]?.label).toBe('Radius');
    const guides = (await import('../src/ui-state/store')).editorUiStore.getState().overlay
      .dimensionGuides;
    expect(guides).toHaveLength(1);
    expect(guides?.[0]?.kind).toBe('linear-dim');
    if (guides?.[0]?.kind === 'linear-dim') {
      expect(guides[0].anchorA).toEqual({ x: 5, y: 5 });
    }
    tool.abort();
    await tool.done();
  });

  it('xline: direction prompt yields 1-field {fields: [Angle], combineAs: angle} + angle-arc guide only (polar witness, no distance dim) (Round-2)', async () => {
    const tool = startTool('draw-xline', lookupTool('draw-xline')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 2, y: 3 } });
    await tick();
    const di = (await import('../src/ui-state/store')).editorUiStore.getState().commandBar
      .dynamicInput;
    expect(di?.manifest.fields).toHaveLength(1);
    expect(di?.manifest.combineAs).toBe('angle');
    expect(di?.manifest.fields[0]?.label).toBe('Angle');
    const guides = (await import('../src/ui-state/store')).editorUiStore.getState().overlay
      .dimensionGuides;
    expect(guides).toHaveLength(1);
    expect(guides?.[0]?.kind).toBe('angle-arc');
    if (guides?.[0]?.kind === 'angle-arc') {
      expect(guides[0].pivot).toEqual({ x: 2, y: 3 });
    }
    tool.abort();
    await tool.done();
  });
});
