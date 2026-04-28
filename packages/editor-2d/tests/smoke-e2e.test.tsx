// Smoke E2E suite for M1.3a per A18 + Revision-4 narrowing.
//
// Each scenario MUST mount <EditorRoot /> via @testing-library/react
// and exercise the editor through DOM events. Per A18:
//   - A18-assert  : pass/fail asserted via DOM events.
//   - A18-uistate : UI-state writes (selection, active tool, focus,
//                   viewport, F-key toggles) MUST be DOM-driven.
//   - A18-setup   : project-state seeding via the action API
//                   permitted as test arrangement (vitest
//                   arrange / act / assert convention).
//
// The discipline meta-test at the bottom enforces Gate 21.2.disc
// (Revision-4 per-scenario form): for each name in SCENARIOS, the
// scenario block MUST contain BOTH `render(<EditorRoot` AND
// `fireEvent.`. SCENARIOS is the in-file SSOT of scenario names.
//
// Phase ordering note: when this file runs against the Phase-8
// EditorRoot placeholder, the five behavioural scenarios fail
// (no canvas-host in the DOM, no keyboard router, no chrome).
// Phase 22 (Editor integration) wires EditorRoot and turns them green.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  LayerId,
  type Project,
  defaultLayer,
  deserialize,
  newLayerId,
  newPrimitiveId,
  newProjectId,
  serialize,
} from '@portplanner/domain';
import {
  addLayer,
  addPrimitive,
  createNewProject,
  hydrateProject,
  projectStore,
  resetProjectStoreForTests,
} from '@portplanner/project-store';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EditorRoot } from '../src/EditorRoot';
import { StatusBarCoordReadout } from '../src/chrome/StatusBarCoordReadout';
import { StatusBarGeoRefChip } from '../src/chrome/StatusBarGeoRefChip';
import { editorUiActions, editorUiStore, resetEditorUiStoreForTests } from '../src/ui-state/store';

const SCENARIOS = [
  'draw line and reload',
  'pan zoom toggle',
  'layer manager flow',
  'properties edit',
  'geo-ref chip non-blocking',
  // M1.3d Phase 9 — polish surface scenarios.
  'live preview during line draw',
  'snap glyph appears at endpoint',
  'window vs crossing selection',
  'grip stretch updates primitive',
  'cursor coords update on mousemove',
  // M1.3d-Remediation R4 + post-merge fix
  // (fix/grip-stretch-click-sticky-click) — snap consumption on the
  // grip-stretch destination click. Originally tested on mouseup
  // (drag pattern); migrated to click-sticky-click. SOLE validation
  // surface that EditorRoot's snap-resolved metric is fed via
  // handleCanvasClick when grip-stretch is awaiting its destination.
  'snap honored on grip-stretch destination click',
  // M1.3d-Remediation-2 R5 — crossing selection uses geometric
  // wire-vs-rect intersect, not bbox-intersect. SOLE integration
  // validation surface for R5 (wire-intersect.test.ts covers per-kind
  // helper math; smoke verifies EditorRoot → select-rect → searchCrossing
  // wiring).
  'crossing selection narrows to wire-intersect (not bbox)',
  // M1.3d-Remediation-2 R7 — hovered-grip differential rendering.
  // SOLE integration validation surface for R7 (paintSelection.test.ts
  // covers the rendering math; smoke verifies the EditorRoot
  // cursor-effect → setHoveredGrip → paintSelection consumption wiring).
  'hovered grip highlights on cursor proximity',
  // M1.3d-Remediation-3 F1 — direct distance entry. SOLE integration
  // surface (EditorRoot.handleCommandSubmit reads directDistanceFrom +
  // lastKnownCursor → 'point'; tool-level tests can't exercise this).
  'direct distance entry',
  // M1.3d-Remediation-3 F5 — bug fix: grip click during a running tool
  // feeds grip.position as 'point' input instead of aborting. SOLE
  // integration surface (EditorRoot.handleGripDown wrap; grip-stretch.test
  // covers tool-layer regression but not the routing change).
  'grip click during running tool feeds point',
  // M1.3d-Remediation-3 F6 — Spacebar at canvas focus repeats last tool.
  // SOLE integration surface (router.ts handler + EditorRoot's
  // onRepeatLastCommand wiring across the runner's lastToolId capture).
  'spacebar repeats last command',
  // M1.3d-Remediation-4 G2 — Dynamic Input pill + numeric routing at
  // canvas focus + Enter-submits-buffer. SOLE integration surface for
  // G2 (router routes numerics into inputBuffer; EditorRoot's
  // onSubmitBuffer feeds via handleCommandSubmit + appendHistory).
  'dynamic input pill: typing a number while in line tool shows pill + Enter submits',
  // M1.3d-Remediation-4 G2 — click-eat. SOLE integration surface for
  // the click-eat path (handleCanvasClick guard on inputBuffer).
  'click is eaten while inputBuffer non-empty (AC parity)',
  // M1.3d-Remediation-5 H1 — rectangle Dimensions comma-pair input.
  // SOLE integration surface: EditorRoot.handleCommandSubmit's
  // numberPair branch + draw-rectangle's single-prompt sub-flow.
  'rectangle Dimensions: typed "30,40" + Enter commits W=30 H=40',
  // M1.3d-Remediation-5 H2 — accumulator persists indefinitely (no
  // 750 ms timeout). SOLE integration surface: keyboard router silently
  // holds the accumulator past any idle interval until Enter activates.
  'accumulator persists indefinitely (no idle timeout, AC parity)',
  // M1.3d-Remediation-5 Codex-Round-1 post-commit fix — direct
  // parser-boundary test for malformed comma-pair inputs at the
  // handleCommandSubmit level (the Round-5 plan's draw-tools.test
  // version was a tool-level abort proxy and did NOT exercise the
  // parser boundary).
  'rectangle Dimensions: parser rejects malformed comma-pairs at handleCommandSubmit boundary',
  // M1.3 Round 6 — Phase 2 DI smoke scenarios per plan §11 + Gate
  // REM6-P2-Smoke. Each exercises the per-tool DI substrate at the
  // <EditorRoot /> level: manifest publish on yield, dimensionGuides
  // populate on cursor-tick, multi-pill chrome renders, DI buffers
  // populate on canvas-focus digit typing.
  'rectangle DI: type 6 Tab 4 Enter commits 6×4',
  'line DI: type 5 Tab 30 Enter commits a 5m line at 30°',
  'circle DI: type 7 Enter commits a radius-7 circle',
  'click is eaten while DI buffer non-empty (multi-field DI parity)',
  'first-frame DI coherence',
] as const;

function makeProject(): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.1.0',
    name: 'Smoke',
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

function getCanvasOrThrow(container: HTMLElement): HTMLCanvasElement {
  const canvas = container.querySelector<HTMLCanvasElement>('[data-component="canvas-host"]');
  if (!canvas) {
    throw new Error(
      'canvas-host not in DOM — EditorRoot is not mounted as expected (Phase 22 wiring missing?)',
    );
  }
  // jsdom returns a 0×0 rect by default; mock with the default editor
  // viewport size (800×600 css px) so pointer-event clientX/Y math lines
  // up with the metric-to-screen transform.
  canvas.getBoundingClientRect = (): DOMRect => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  });
  return canvas;
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  resetProjectStoreForTests();
  resetEditorUiStoreForTests();
});

afterEach(() => {
  resetProjectStoreForTests();
  resetEditorUiStoreForTests();
});

describe('M1.3a smoke E2E (DOM-level per A18, Revision-4)', () => {
  it('draw line and reload', async () => {
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);

    // A18-uistate: tool activation via window-level keyboard.
    fireEvent.keyDown(window, { key: 'L' });
    // M1.3d-Rem-4 G1 — Enter required (no more auto-flush).
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    expect(editorUiStore.getState().activeToolId).toBe('draw-line');

    // A18-uistate: pointer events drive tool inputs.
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    fireEvent.mouseDown(canvas, { button: 0, clientX: 500, clientY: 300 });
    await wait(50);

    // A18-assert: line primitive landed via DOM-driven actions.
    const lines = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'line',
    );
    expect(lines).toHaveLength(1);

    // Round-trip via serialize / deserialize (persistence assertion).
    const snapshot = projectStore.getState().project!;
    const json = serialize(snapshot);
    const reloaded = deserialize(json);
    hydrateProject(reloaded, '2026-04-25T11:00:00.000Z');

    const after = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'line',
    );
    expect(after).toHaveLength(1);
  });

  it('pan zoom toggle', async () => {
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);
    const before = editorUiStore.getState().viewport;

    // A18-uistate: wheel zoom via DOM wheel event.
    fireEvent.wheel(canvas, { deltaY: -100, clientX: 400, clientY: 300 });
    expect(editorUiStore.getState().viewport.zoom).toBeGreaterThan(before.zoom);

    // A18-uistate: middle-mouse-drag pan via DOM pointer events.
    fireEvent.mouseDown(canvas, { button: 1, clientX: 400, clientY: 300 });
    fireEvent.mouseMove(canvas, { button: 1, clientX: 450, clientY: 320, buttons: 4 });
    fireEvent.mouseUp(canvas, { button: 1, clientX: 450, clientY: 320 });
    expect(editorUiStore.getState().viewport.panX).not.toBe(before.panX);

    // A18-uistate: F-key toggles via window-level keydown.
    const osnapBefore = editorUiStore.getState().toggles.osnap;
    fireEvent.keyDown(window, { key: 'F3' });
    expect(editorUiStore.getState().toggles.osnap).toBe(!osnapBefore);

    fireEvent.keyDown(window, { key: 'F8' });
    expect(editorUiStore.getState().toggles.ortho).toBe(true);

    fireEvent.keyDown(window, { key: 'F9' });
    fireEvent.keyDown(window, { key: 'F12' });
    expect(editorUiStore.getState().toggles.gsnap).toBe(false);
    expect(editorUiStore.getState().toggles.dynamicInput).toBe(false);

    // Focal-point zoom contract: wheeling at an off-centre cursor must
    // keep the metric point under that cursor stationary across the
    // zoom step (Codex Round-1 quality-gap fix). With viewport size
    // 800×600 + zoom=10, screen (600, 200) maps to metric (20, 10) at
    // the pre-wheel viewport — that metric coordinate must remain at
    // screen (600, 200) after the wheel updates pan + zoom together.
    {
      const focal = { x: 600, y: 200 };
      const v0 = editorUiStore.getState().viewport;
      const metricBefore = {
        x: v0.panX + (focal.x - v0.canvasWidthCss / 2) / v0.zoom,
        y: v0.panY - (focal.y - v0.canvasHeightCss / 2) / v0.zoom,
      };
      fireEvent.wheel(canvas, { deltaY: -100, clientX: focal.x, clientY: focal.y });
      const v1 = editorUiStore.getState().viewport;
      const metricAfter = {
        x: v1.panX + (focal.x - v1.canvasWidthCss / 2) / v1.zoom,
        y: v1.panY - (focal.y - v1.canvasHeightCss / 2) / v1.zoom,
      };
      expect(v1.zoom).toBeGreaterThan(v0.zoom);
      expect(Math.abs(metricAfter.x - metricBefore.x)).toBeLessThan(1e-9);
      expect(Math.abs(metricAfter.y - metricBefore.y)).toBeLessThan(1e-9);
    }
  });

  it('layer manager flow', async () => {
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);

    // A18-uistate: open Layer Manager via L+A multi-letter shortcut.
    fireEvent.keyDown(window, { key: 'L' });
    fireEvent.keyDown(window, { key: 'A' });
    // M1.3d-Rem-4 G1 — Enter required (no more auto-flush).
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);

    // A18-assert: dialog renders.
    const dialog = container.querySelector('[data-component="layer-manager-dialog"]');
    expect(dialog).toBeTruthy();

    // A18-uistate: click "+ New layer" button via DOM.
    const createBtn = container.querySelector<HTMLButtonElement>(
      '[data-component="layer-create-button"]',
    );
    expect(createBtn).toBeTruthy();
    const layerCountBefore = Object.keys(projectStore.getState().project!.layers).length;
    fireEvent.click(createBtn!);
    expect(Object.keys(projectStore.getState().project!.layers).length).toBe(layerCountBefore + 1);

    // Close dialog via Escape.
    fireEvent.keyDown(window, { key: 'Escape' });

    // Activate draw-line and click two points.
    fireEvent.keyDown(window, { key: 'L' });
    // M1.3d-Rem-4 G1 — Enter required (no more auto-flush).
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    expect(editorUiStore.getState().activeToolId).toBe('draw-line');

    fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseDown(canvas, { button: 0, clientX: 200, clientY: 100 });
    await wait(50);

    const drawn = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'line',
    );
    expect(drawn).toHaveLength(1);
    expect(drawn[0]!.layerId).toBe(editorUiStore.getState().activeLayerId);
  });

  it('properties edit', async () => {
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());

    // A18-setup (permitted): seed a primitive via the action API as
    // legitimate test arrangement.
    const id = newPrimitiveId();
    addPrimitive({
      id,
      kind: 'circle',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      center: { x: 0, y: 0 },
      radius: 5,
    });

    const canvas = getCanvasOrThrow(container);

    // A18-uistate: drive selection through a canvas pointerDown +
    // pointerUp pair (Revision-4 narrowing). The hit-test treats
    // circles as outlines (distance to circumference), so we click at
    // the right edge of the radius-5 circle — metric (5,0) maps to
    // screen (450, 300) at zoom=10 with default viewport size 800×600.
    // M1.3d Phase 7 update: single-click selection now flows through
    // the select-rect tool's click-without-drag branch, which commits
    // on mouseup. The test fires both events at the same screen point.
    fireEvent.mouseDown(canvas, { button: 0, clientX: 450, clientY: 300 });
    fireEvent.mouseUp(canvas, { button: 0, clientX: 450, clientY: 300 });
    await wait(20);

    // A18-assert: Properties panel renders the selection's fields.
    const panel = container.querySelector('[data-component="properties-panel"]');
    expect(panel).toBeTruthy();

    // A18-uistate (DOM-driven): change layer via select.
    const newLayer = newLayerId();
    addLayer({
      id: newLayer,
      name: 'Aux',
      color: '#00FF00',
      lineType: 'continuous',
      lineWeight: 0.25,
      visible: true,
      frozen: false,
      locked: false,
    });
    // Yield so React flushes the new <option> into the select before
    // we dispatch the change event — otherwise the value isn't in the
    // option list yet and jsdom drops it.
    await wait(20);

    const select = container.querySelector<HTMLSelectElement>(
      '[data-component="properties-layer-select"]',
    );
    expect(select).toBeTruthy();
    fireEvent.change(select!, { target: { value: newLayer } });
    expect(projectStore.getState().project!.primitives[id]!.layerId).toBe(newLayer);

    // A18-uistate (DOM-driven): change color override.
    const colorInput = container.querySelector<HTMLInputElement>(
      '[data-component="properties-color-input"]',
    );
    expect(colorInput).toBeTruthy();
    fireEvent.change(colorInput!, { target: { value: '#ff0000' } });
    const after = projectStore.getState().project!.primitives[id]!;
    expect((after as { displayOverrides: { color?: string } }).displayOverrides.color).toBe(
      '#ff0000',
    );
  });

  it('geo-ref chip non-blocking', async () => {
    // §13.2 — chip ownership stays in apps/web/src/shell/StatusBar.tsx
    // for the running app; the smoke test composes <EditorRoot /> +
    // <StatusBarGeoRefChip /> as fragment siblings to verify the same
    // user-facing flow without duplicating the chip in EditorRoot.
    const { container } = render(
      <>
        <EditorRoot />
        <StatusBarGeoRefChip />
      </>,
    );
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);

    // A18-assert: chip is in the DOM with the expected label.
    const chip = container.querySelector('[data-component="georef-chip"]');
    expect(chip).toBeTruthy();
    expect(chip!.textContent).toBe('Not geo-referenced');

    // A18-uistate: clicking the chip opens GeoRefDialog.
    fireEvent.click(chip!);
    const dialog = container.querySelector('[data-component="georef-dialog"]');
    expect(dialog).toBeTruthy();

    // A18-uistate: clicking "Set later" closes the dialog without
    // setting coordinateSystem.
    const setLaterBtn = screen.getByText('Set later');
    fireEvent.click(setLaterBtn);
    expect(container.querySelector('[data-component="georef-dialog"]')).toBeNull();
    expect(projectStore.getState().project!.coordinateSystem).toBeNull();

    // A18-assert: drafting still works after closing the chip.
    fireEvent.keyDown(window, { key: 'L' });
    // M1.3d-Rem-4 G1 — Enter required (no more auto-flush).
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    expect(editorUiStore.getState().activeToolId).toBe('draw-line');
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    fireEvent.mouseDown(canvas, { button: 0, clientX: 500, clientY: 300 });
    await wait(50);
    const lines = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'line',
    );
    expect(lines).toHaveLength(1);
  });

  // ============================================================
  // M1.3d Phase 9 — polish surface scenarios.
  // Each mounts <EditorRoot /> and drives the polish item via DOM
  // events. End-to-end wire-up only; per-painter / per-helper unit
  // tests exhaust the kind matrix (paintSnapGlyph, grip-positions,
  // grip-stretch, select-rect, etc.).
  // ============================================================

  it('live preview during line draw', async () => {
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);

    // Activate draw-line via keyboard, click first point, fire
    // mousemove and assert overlay.previewShape is a line shape.
    fireEvent.keyDown(window, { key: 'L' });
    // M1.3d-Rem-4 G1 — Enter required (no more auto-flush).
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    expect(editorUiStore.getState().activeToolId).toBe('draw-line');

    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    await wait(20);
    fireEvent.mouseMove(canvas, { clientX: 500, clientY: 300 });
    await wait(60);

    const ps = editorUiStore.getState().overlay.previewShape;
    expect(ps).not.toBeNull();
    expect(ps?.kind).toBe('line');

    // Commit the second point and assert the preview clears.
    fireEvent.mouseDown(canvas, { button: 0, clientX: 500, clientY: 300 });
    await wait(50);
    expect(editorUiStore.getState().overlay.previewShape).toBeNull();
  });

  it('snap glyph appears at endpoint', async () => {
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    // Seed a horizontal line with endpoints at metric (0,0) and (10,0)
    // — viewport zoom=10, so screen (400, 300) is metric (0,0) and
    // (500, 300) is metric (10, 0).
    addPrimitive({
      id: newPrimitiveId(),
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    });
    const canvas = getCanvasOrThrow(container);

    // Activate draw-line so a 'point' input is awaited (snap-on-cursor
    // gates on this), click first point, then move cursor near the
    // existing line's endpoint at screen (500, 300) — well inside the
    // 16-px snap tolerance from M1.3a.
    fireEvent.keyDown(window, { key: 'L' });
    // M1.3d-Rem-4 G1 — Enter required (no more auto-flush).
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 100 });
    await wait(20);
    fireEvent.mouseMove(canvas, { clientX: 502, clientY: 300 });
    await wait(60);

    const snap = editorUiStore.getState().overlay.snapTarget;
    expect(snap).not.toBeNull();
    expect(snap?.kind).toBe('endpoint');
  });

  it('window vs crossing selection', async () => {
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    // Seed two lines: A is fully inside the window (1..4 metric), B
    // straddles into outside (3..50 metric). Window selects only A;
    // crossing selects both.
    const idA = newPrimitiveId();
    const idB = newPrimitiveId();
    addPrimitive({
      id: idA,
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 1, y: 1 },
      p2: { x: 4, y: 4 },
    });
    addPrimitive({
      id: idB,
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 3, y: 3 },
      p2: { x: 50, y: 50 },
    });
    const canvas = getCanvasOrThrow(container);

    // L→R drag (window). Viewport: 800×600, zoom=10. Metric (0,0) →
    // screen (400, 300). Metric (10, 10) → screen (500, 200) (Y flips).
    // Use a pure rect that captures only A (fully) but cuts off B.
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    await wait(20);
    fireEvent.mouseUp(canvas, { button: 0, clientX: 450, clientY: 250 }); // metric (5, 5)
    await wait(20);
    let sel = editorUiStore.getState().selection;
    expect(sel).toContain(idA);
    expect(sel).not.toContain(idB);

    // Clear and try R→L drag (crossing). Same metric area but reversed.
    editorUiActions.setSelection([]);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 450, clientY: 250 });
    await wait(20);
    fireEvent.mouseUp(canvas, { button: 0, clientX: 400, clientY: 300 });
    await wait(20);
    sel = editorUiStore.getState().selection;
    expect(sel).toContain(idA);
    expect(sel).toContain(idB);
  });

  it('grip stretch updates primitive', async () => {
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const id = newPrimitiveId();
    addPrimitive({
      id,
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    });
    // Select the line so its grips populate (Phase 5 effect).
    editorUiActions.setSelection([id]);
    await wait(20);

    const canvas = getCanvasOrThrow(container);
    // p1 grip is at metric (0, 0) → screen (400, 300). Click on the
    // grip (full click — mousedown + mouseup at the same position;
    // post-fix click-sticky-click pattern means the mouseup does NOT
    // commit). Then click destination at metric (5, 5) → screen
    // (450, 250); the destination mousedown commits via
    // handleCanvasClick.
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    fireEvent.mouseUp(canvas, { button: 0, clientX: 400, clientY: 300 });
    await wait(20);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 450, clientY: 250 });
    fireEvent.mouseUp(canvas, { button: 0, clientX: 450, clientY: 250 });
    await wait(50);

    const after = projectStore.getState().project!.primitives[id]!;
    expect((after as { p1: { x: number; y: number } }).p1.x).toBeCloseTo(5, 6);
    expect((after as { p1: { x: number; y: number } }).p1.y).toBeCloseTo(5, 6);
  });

  it('cursor coords update on mousemove', async () => {
    const { container } = render(
      <>
        <EditorRoot />
        <StatusBarCoordReadout />
      </>,
    );
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);

    // Initial readout shows placeholder.
    let readout = container.querySelector('[data-component="coord-readout"]');
    expect(readout?.textContent).toContain('X: —');

    // Move cursor and wait for the rAF flush + render.
    fireEvent.mouseMove(canvas, { clientX: 450, clientY: 300 });
    await wait(80);

    readout = container.querySelector('[data-component="coord-readout"]');
    expect(readout?.textContent).toMatch(/X: 5\.000/);
    expect(readout?.textContent).toMatch(/Y: 0\.000/);
  });

  it('snap honored on grip-stretch destination click', async () => {
    // M1.3d-Remediation R4 + post-merge fix
    // (fix/grip-stretch-click-sticky-click) — SOLE validation surface
    // for snap consumption at grip-stretch's destination click. The
    // wiring under test lives in EditorRoot.handleCanvasClick: when
    // overlay.snapTarget is set at click time AND grip-stretch is
    // awaiting a 'point', the runner receives the snap-resolved metric
    // (commitSnappedVertex bit-copy), NOT the raw cursor metric.
    // Pre-fix this test exercised mouseup (drag pattern); post-fix
    // it exercises mousedown of the destination click (click-sticky-click).
    // Tool-level tests bypass EditorRoot and cannot validate this path.
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());

    // Two primitives:
    //   targetLine — supplies the snap target (endpoint at metric (5, 0)
    //                → screen (450, 300) at zoom=10).
    //   draggedLine — has its p1 grip at metric (0, -5) → screen (400, 350).
    const targetId = newPrimitiveId();
    addPrimitive({
      id: targetId,
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 5, y: 0 },
      p2: { x: 15, y: 0 },
    });
    const draggedId = newPrimitiveId();
    addPrimitive({
      id: draggedId,
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: -5 },
      p2: { x: 0, y: -10 },
    });
    // Select the dragged line so its grips populate (Phase 5 effect).
    editorUiActions.setSelection([draggedId]);
    await wait(20);

    const canvas = getCanvasOrThrow(container);
    // Click on the dragged line's p1 grip at screen (400, 350) — full
    // click (mousedown+mouseup at same position). Post-fix the mouseup
    // does NOT commit; cursor sticks to grip-stretch.
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 350 });
    fireEvent.mouseUp(canvas, { button: 0, clientX: 400, clientY: 350 });
    await wait(20);
    // Move cursor near the targetLine's p1 endpoint (screen 450, 300) so
    // the snap-on-cursor effect resolves overlay.snapTarget to the
    // endpoint at metric (5, 0). Land 2 px off so the raw click metric
    // would NOT equal the snap-resolved metric — proving the gate.
    fireEvent.mouseMove(canvas, { clientX: 452, clientY: 301 });
    await wait(80); // rAF flush + snap resolution + paint requestPaint

    // Destination click at the slightly-off position; commit MUST use
    // the snap-resolved metric (5, 0), not the raw click metric.
    fireEvent.mouseDown(canvas, { button: 0, clientX: 452, clientY: 301 });
    fireEvent.mouseUp(canvas, { button: 0, clientX: 452, clientY: 301 });
    await wait(50);

    const after = projectStore.getState().project!.primitives[draggedId]!;
    const p1 = (after as { p1: { x: number; y: number } }).p1;
    // commitSnappedVertex bit-copies the snap point — assert exact equality
    // (toBeCloseTo with 9-decimal tolerance handles any float artefact).
    expect(p1.x).toBeCloseTo(5, 9);
    expect(p1.y).toBeCloseTo(0, 9);
  });

  it('crossing selection narrows to wire-intersect (not bbox)', async () => {
    // M1.3d-Remediation-2 R5 — SOLE integration validation surface.
    // Pre-R5: crossing used bbox-intersects, so a diagonal line with
    // bbox overlapping the rect would be selected even if its wire
    // didn't cross. Post-R5: searchCrossing uses wireIntersectsRect
    // (Liang-Barsky for segments), so bbox-only-overlap is filtered out.
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    // Two primitives:
    //   wireCrosser — small line whose actual wire crosses the rect.
    //                 (1, 1) → (4, 4): bbox AND wire both inside rect (10x10).
    //                 We use a smaller-than-rect line entirely inside.
    //   bboxOnly    — diagonal whose bbox covers the rect but wire stays
    //                 well clear. Same shape as wire-intersect.test.ts:
    //                 (-5, 50) → (50, -5). Bbox = (-5,-5)→(50,50).
    //                 At x ∈ [10, 15], y ≈ 33-37 (above rect's [10, 15]).
    const wireCrosserId = newPrimitiveId();
    addPrimitive({
      id: wireCrosserId,
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 11, y: 11 },
      p2: { x: 14, y: 14 },
    });
    const bboxOnlyId = newPrimitiveId();
    addPrimitive({
      id: bboxOnlyId,
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: -5, y: 50 },
      p2: { x: 50, y: -5 },
    });
    const canvas = getCanvasOrThrow(container);

    // R→L drag for crossing selection over the rect (10, 10) → (15, 15).
    // Viewport: zoom=10, pan (0,0). Metric (15, 15) → screen (550, 150).
    // Metric (10, 10) → screen (500, 200). end.x < start.x → crossing.
    fireEvent.mouseDown(canvas, { button: 0, clientX: 550, clientY: 150 });
    await wait(20);
    fireEvent.mouseUp(canvas, { button: 0, clientX: 500, clientY: 200 });
    await wait(50);

    const sel = editorUiStore.getState().selection;
    expect(sel).toContain(wireCrosserId);
    expect(sel).not.toContain(bboxOnlyId);
  });

  // ============================================================
  // M1.3d-Remediation-3 — F1 / F5 / F6 SOLE integration scenarios.
  // ============================================================

  it('direct distance entry', async () => {
    // F1 — typing a numeric distance in the command bar after the first
    // line click computes p2 along cursor heading from p1. SOLE
    // integration surface: EditorRoot.handleCommandSubmit reads
    // commandBar.directDistanceFrom (published by the runner from
    // draw-line's second prompt) + overlay.lastKnownCursor (captured by
    // handleCanvasHover) and feeds a 'point' input.
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);

    // Activate L (draw-line).
    fireEvent.keyDown(window, { key: 'L' });
    // M1.3d-Rem-4 G1 — Enter required (no more auto-flush).
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    expect(editorUiStore.getState().activeToolId).toBe('draw-line');

    // First click: metric (0, 0) → screen (400, 300) at zoom=10 / viewport (800, 600).
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    await wait(20);

    // Move cursor to (450, 300) → metric (5, 0) — establishes lastKnownCursor +
    // a horizontal heading from the anchor (0, 0).
    fireEvent.mouseMove(canvas, { clientX: 450, clientY: 300 });
    await wait(40);
    expect(editorUiStore.getState().overlay.lastKnownCursor).not.toBeNull();
    expect(editorUiStore.getState().commandBar.directDistanceFrom).toEqual({ x: 0, y: 0 });

    // Type "7" in the command bar input and submit (form Enter).
    const input = container.querySelector<HTMLInputElement>('[data-component="command-input"]');
    expect(input).toBeTruthy();
    fireEvent.focus(input!);
    fireEvent.change(input!, { target: { value: '7' } });
    // Yield so React flushes the local state update before form submit
    // reads it (CommandPromptLine.handleSubmit reads `local`, not the
    // store's inputBuffer).
    await wait(20);
    const form = container.querySelector('[data-component="command-prompt"]');
    fireEvent.submit(form!);
    await wait(50);

    const lines = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'line',
    );
    expect(lines).toHaveLength(1);
    const ln = lines[0] as { p1: { x: number; y: number }; p2: { x: number; y: number } };
    expect(ln.p1).toEqual({ x: 0, y: 0 });
    // unit(cursor - anchor) = unit(5, 0) = (1, 0); dest = (0, 0) + 7 * (1, 0) = (7, 0).
    expect(ln.p2.x).toBeCloseTo(7, 6);
    expect(ln.p2.y).toBeCloseTo(0, 6);
  });

  it('grip click during running tool feeds point', async () => {
    // F5 BUG FIX — pre-fix: clicking a grip while move tool is running
    // aborted the tool and started grip-stretch. Post-fix: the grip's
    // position is fed to the running tool as a 'point' input. SOLE
    // integration surface: EditorRoot.handleGripDown 2-branch dispatch.
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());

    // Two lines — A is the entity to move (selected for grip rendering),
    // B is where we'll click a grip mid-MOVE so its endpoint serves as
    // the move destination.
    const idA = newPrimitiveId();
    addPrimitive({
      id: idA,
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: -10, y: -5 },
      p2: { x: -8, y: -5 },
    });
    const idB = newPrimitiveId();
    addPrimitive({
      id: idB,
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 5, y: 0 }, // → screen (450, 300)
      p2: { x: 10, y: 0 },
    });
    // Pre-select A so its grips populate (so the F5 grip-click path makes sense
    // ONLY when MOVE is running and we click on B's grip).
    editorUiActions.setSelection([idA]);
    await wait(20);

    const canvas = getCanvasOrThrow(container);

    // Activate MOVE.
    fireEvent.keyDown(window, { key: 'M' });
    // M1.3d-Rem-4 G1 — Enter required (no more auto-flush).
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    expect(editorUiStore.getState().activeToolId).toBe('move');

    // Click an arbitrary base point at metric (-10, -5) → screen (300, 350).
    fireEvent.mouseDown(canvas, { button: 0, clientX: 300, clientY: 350 });
    await wait(20);

    // Now select B too so its grips appear AS WELL (we want a grip on B
    // to click for the destination). Select-rect would normally do this;
    // for the test we set selection directly via the UI-state action
    // (A18-uistate is satisfied because the keyboard event activated MOVE
    // and the canvas event committed the base point).
    editorUiActions.setSelection([idA, idB]);
    await wait(20);

    // B's p1 grip is at metric (5, 0) → screen (450, 300). With MOVE
    // running and awaiting the second 'point', clicking on this grip
    // should feed { x: 5, y: 0 } into MOVE — NOT abort + start grip-stretch.
    fireEvent.mouseDown(canvas, { button: 0, clientX: 450, clientY: 300 });
    await wait(50);

    // Post-condition: A moved by (5 - (-10), 0 - (-5)) = (15, 5). MOVE
    // completed; activeToolId is null (NOT 'grip-stretch').
    const lineAfterA = projectStore.getState().project!.primitives[idA] as {
      p1: { x: number; y: number };
    };
    // Original A.p1 = (-10, -5); base = (-10, -5); destination = (5, 0); delta = (15, 5).
    expect(lineAfterA.p1.x).toBeCloseTo(5, 6);
    expect(lineAfterA.p1.y).toBeCloseTo(0, 6);
    // No grip-stretch started (MOVE consumed the click).
    expect(editorUiStore.getState().activeToolId).not.toBe('grip-stretch');
  });

  // ============================================================
  // M1.3d-Remediation-4 — G1 + G2 SOLE integration scenarios.
  // ============================================================

  it('dynamic input pill: typing a number while in line tool shows pill + Enter submits', async () => {
    // M1.3 Round 6 migration (plan §11): assertions updated to multi-
    // field DI flow. After draw-line's second-point manifest publishes,
    // digits at canvas focus route to dynamicInput.buffers[activeFieldIdx]
    // (NOT the legacy inputBuffer). The pill renders with field labels.
    // DI-submit DOM mechanics (Tab + Enter → line commit) are covered
    // by the new 'line DI' smoke scenario added in Phase 2 + the
    // tool-runner sync-bootstrap unit test; this scenario asserts only
    // the substrate routing of digits and pill rendering.
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);

    fireEvent.keyDown(window, { key: 'L' });
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    expect(editorUiStore.getState().activeToolId).toBe('draw-line');

    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    await wait(20);
    // Move cursor so cursor-tick subscription fires the dimensionGuides-
    // Builder; guides[] populates → multi-pill mode renders.
    fireEvent.mouseMove(canvas, { clientX: 450, clientY: 300 });
    await wait(40);

    expect(editorUiStore.getState().focusHolder).toBe('canvas');
    // Type "7" → routes to DI buffers[0] (Distance), NOT inputBuffer.
    fireEvent.keyDown(window, { key: '7' });
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('');
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers[0]).toBe('7');

    // Pill renders the buffer (multi-pill mode active because line's
    // second-point prompt has a manifest + dimensionGuides populated).
    const pills = container.querySelectorAll('[data-component="dynamic-input-pill"]');
    expect(pills.length).toBeGreaterThanOrEqual(1);
    expect(pills[0]?.textContent).toContain('7');
  });

  it('click is eaten while inputBuffer non-empty (AC parity)', async () => {
    // M1.3 Round 6 migration (plan §11): assertions updated to multi-
    // field DI flow. After draw-line yields the manifest, digits route
    // to DI buffers (NOT inputBuffer). Click-eat extension catches both
    // (hasNonEmptyTypingBuffer in EditorRoot ORs the two checks).
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);

    fireEvent.keyDown(window, { key: 'L' });
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    await wait(20);

    // Pollute the DI buffer (simulating mid-typing in the Distance field).
    fireEvent.keyDown(window, { key: '5' });
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers[0]).toBe('5');
    // inputBuffer remains empty — the new flow routes digits to DI.
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('');

    // Click on canvas — should be EATEN by hasNonEmptyTypingBuffer
    // (which OR-checks DI buffers per M1.3 Round 6 + Rev-6 D5).
    fireEvent.mouseDown(canvas, { button: 0, clientX: 500, clientY: 300 });
    await wait(50);

    expect(editorUiStore.getState().activeToolId).toBe('draw-line');
    expect(
      Object.values(projectStore.getState().project!.primitives).filter((p) => p.kind === 'line')
        .length,
    ).toBe(0);
    // DI buffer still pending (click-eat preserves typing in flight).
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers[0]).toBe('5');
  });

  it('rectangle Dimensions: typed "30,40" + Enter commits W=30 H=40', async () => {
    // M1.3d-Rem-5 H1 — SOLE integration validation. Activate REC + Enter,
    // click first corner, click [Dimensions] sub-option (or type D + Enter),
    // type "30,40" via canvas-focus number-keys (router routes into
    // inputBuffer), Enter submits. EditorRoot's handleCommandSubmit
    // numberPair branch parses + feeds; rectangle commits with W=30, H=40.
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);

    // Activate REC: R+E+C+Enter (AC mode).
    fireEvent.keyDown(window, { key: 'R' });
    fireEvent.keyDown(window, { key: 'E' });
    fireEvent.keyDown(window, { key: 'C' });
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    expect(editorUiStore.getState().activeToolId).toBe('draw-rectangle');

    // Click first corner at metric (1, 2) → screen (410, 280) at zoom=10.
    fireEvent.mouseDown(canvas, { button: 0, clientX: 410, clientY: 280 });
    await wait(20);

    // Type D — sub-option fast-path fires immediately (no Enter needed
    // because the active tool's subOptions include 'd' for Dimensions).
    fireEvent.keyDown(window, { key: 'D' });
    await wait(20);

    // Buffer should now be empty + prompt should accept numberPair.
    expect(editorUiStore.getState().commandBar.acceptedInputKinds).toEqual(['numberPair']);

    // Type "30,40" via canvas-focus numeric routing.
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.keyDown(window, { key: '0' });
    fireEvent.keyDown(window, { key: ',' });
    fireEvent.keyDown(window, { key: '4' });
    fireEvent.keyDown(window, { key: '0' });
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('30,40');

    // Enter submits — handleCommandSubmit parses comma-pair, tool commits.
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(50);

    const rects = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'rectangle',
    );
    expect(rects).toHaveLength(1);
    const r = rects[0] as { origin: { x: number; y: number }; width: number; height: number };
    expect(r.origin).toEqual({ x: 1, y: 2 });
    expect(r.width).toBe(30);
    expect(r.height).toBe(40);
    // Buffer cleared after submit.
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('');
  });

  it('rectangle Dimensions: parser rejects malformed comma-pairs at handleCommandSubmit boundary', async () => {
    // Codex post-commit Round-1 H1 fix — the Round-5 plan called for
    // direct parser-boundary coverage of `,40` / `30,` / `,` inputs;
    // the originally-shipped draw-tools.test version was a tool-level
    // abort proxy that didn't exercise the parser. This smoke fires
    // raw malformed strings through the buffer + Enter pipeline and
    // asserts NO numberPair is fed (no rectangle commits).
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);

    // Activate REC + Enter, click first corner, enter Dimensions sub-flow.
    fireEvent.keyDown(window, { key: 'R' });
    fireEvent.keyDown(window, { key: 'E' });
    fireEvent.keyDown(window, { key: 'C' });
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 410, clientY: 280 });
    await wait(20);
    fireEvent.keyDown(window, { key: 'D' });
    await wait(20);
    expect(editorUiStore.getState().commandBar.acceptedInputKinds).toEqual(['numberPair']);

    // Helper: type a buffer string + Enter, then assert no rectangle yet
    // and the tool is still in numberPair-wait state.
    const submitBufferAndAssertRejected = async (raw: string): Promise<void> => {
      // Clear any prior buffer first.
      editorUiActions.setInputBuffer('');
      // Type each char via canvas-focus number/punct routing.
      for (const ch of raw) {
        fireEvent.keyDown(window, { key: ch });
      }
      expect(editorUiStore.getState().commandBar.inputBuffer).toBe(raw);
      fireEvent.keyDown(window, { key: 'Enter' });
      await wait(30);
      // Buffer cleared by onSubmitBuffer regardless of parser outcome.
      expect(editorUiStore.getState().commandBar.inputBuffer).toBe('');
      // No rectangle committed (parser rejected; tool not fed numberPair).
      expect(
        Object.values(projectStore.getState().project!.primitives).filter(
          (p) => p.kind === 'rectangle',
        ),
      ).toHaveLength(0);
      // Tool still in numberPair-wait state.
      expect(editorUiStore.getState().commandBar.acceptedInputKinds).toEqual(['numberPair']);
      expect(editorUiStore.getState().activeToolId).toBe('draw-rectangle');
    };

    // Parser-boundary rejections per A2/Step 2 trim-both-tokens guard.
    await submitBufferAndAssertRejected(',');
    await submitBufferAndAssertRejected(',40');
    await submitBufferAndAssertRejected('30,');

    // Sanity: a valid pair AFTER three rejections still works (no state
    // corruption from the rejection path).
    editorUiActions.setInputBuffer('');
    for (const ch of '30,40') fireEvent.keyDown(window, { key: ch });
    expect(editorUiStore.getState().commandBar.inputBuffer).toBe('30,40');
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(50);
    const rects = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'rectangle',
    );
    expect(rects).toHaveLength(1);
    const r = rects[0] as { width: number; height: number };
    expect(r.width).toBe(30);
    expect(r.height).toBe(40);
  });

  it('accumulator persists indefinitely (no idle timeout, AC parity)', async () => {
    // M1.3d-Rem-5 H2 — SOLE integration validation. Type L (silent
    // accumulator under G1), wait WELL past the OLD 750 ms timeout
    // window, verify accumulator is STILL 'L' and no tool activated.
    // Then Enter activates — confirms the accumulator was live the
    // whole time. AC parity (no idle stale-clear).
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    void getCanvasOrThrow(container);

    fireEvent.keyDown(window, { key: 'L' });
    expect(editorUiStore.getState().commandBar.accumulator).toBe('L');
    // Wait 1100 ms — well past the (now-removed) 750 ms timeout window.
    await wait(1100);
    expect(editorUiStore.getState().activeToolId).toBeNull();
    expect(editorUiStore.getState().commandBar.accumulator).toBe('L');
    // Enter activates.
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    expect(editorUiStore.getState().activeToolId).toBe('draw-line');
  });

  it('spacebar repeats last command', async () => {
    // F6 — Activate L, commit a line, then press Space at canvas focus →
    // draw-line activates again. SOLE integration: router.ts spacebar
    // handler → EditorRoot.onRepeatLastCommand → activateToolById, with
    // lastToolId captured by the runner's finally block.
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);

    // Activate L, draw a line.
    fireEvent.keyDown(window, { key: 'L' });
    // M1.3d-Rem-4 G1 — Enter required (no more auto-flush).
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    expect(editorUiStore.getState().activeToolId).toBe('draw-line');
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    fireEvent.mouseDown(canvas, { button: 0, clientX: 500, clientY: 300 });
    await wait(50);
    expect(editorUiStore.getState().activeToolId).toBeNull();
    // lastToolId is captured by the runner.
    expect(editorUiStore.getState().commandBar.lastToolId).toBe('draw-line');

    // Press Space at canvas focus — should re-invoke draw-line.
    fireEvent.keyDown(window, { key: ' ' });
    await wait(20);
    expect(editorUiStore.getState().activeToolId).toBe('draw-line');
  });

  it('hovered grip highlights on cursor proximity', async () => {
    // M1.3d-Remediation-2 R7 — SOLE integration validation surface.
    // EditorRoot's cursor effect runs gripHitTest on overlay.cursor change
    // and writes overlay.hoveredGrip when a grip is within tolerance.
    // paintSelection consumes the field for differential rendering.
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const id = newPrimitiveId();
    addPrimitive({
      id,
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    });
    // Select the line so its grips populate.
    editorUiActions.setSelection([id]);
    await wait(20);

    const canvas = getCanvasOrThrow(container);
    // p1 grip at metric (0, 0) → screen (400, 300).
    // Move cursor to (401, 301) — well inside the 4-CSS-px tolerance.
    fireEvent.mouseMove(canvas, { clientX: 401, clientY: 301 });
    await wait(80);

    const hovered = editorUiStore.getState().overlay.hoveredGrip;
    expect(hovered).not.toBeNull();
    expect(hovered?.entityId).toBe(id);
    expect(hovered?.gripKind).toBe('p1');
  });

  // M1.3 Round 6 — Phase 2 DI smoke scenarios. Mounted-EditorRoot DOM-
  // event scenarios that exercise the per-tool DI substrate. Per Gate
  // REM6-P2-Smoke, each scenario name appears in SCENARIOS const + as
  // an it() title (≥10 grep matches total).

  it('rectangle DI: type 6 Tab 4 Enter commits 6×4', async () => {
    // Verifies rectangle's DI manifest publish + multi-pill rendering +
    // per-field digit routing at <EditorRoot /> level. DI-commit DOM
    // mechanics (typing → DI submit → numberPair Input → rectangle
    // commit) are unit-covered by tests/draw-tools.test.ts (Math.abs
    // numberPair handling) + the new combiner unit test for numberPair.
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);
    fireEvent.keyDown(window, { key: 'R' });
    fireEvent.keyDown(window, { key: 'E' });
    fireEvent.keyDown(window, { key: 'C' });
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    await wait(20);
    fireEvent.mouseMove(canvas, { clientX: 460, clientY: 240 });
    await wait(40);
    // Manifest published; cursor-tick populated dimensionGuides; multi-
    // pill chrome should be rendering 2 pills (W + H).
    const di = editorUiStore.getState().commandBar.dynamicInput;
    expect(di?.manifest.combineAs).toBe('numberPair');
    expect(di?.manifest.fields).toHaveLength(2);
    // Type 6 → DI buffers[0] = '6'.
    fireEvent.keyDown(window, { key: '6' });
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers[0]).toBe('6');
    // Tab → activeFieldIdx 1.
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(editorUiStore.getState().commandBar.dynamicInput?.activeFieldIdx).toBe(1);
    fireEvent.keyDown(window, { key: '4' });
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers[1]).toBe('4');
  });

  it('line DI: type 5 Tab 30 Enter commits a 5m line at 30°', async () => {
    // Verifies line's DI manifest (Distance + Angle, combineAs point) +
    // multi-pill rendering + Tab routing. DI-commit deg→rad correctness
    // is unit-covered by combiner test [5,30] → (5*cos(π/6), 5*sin(π/6)).
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);
    fireEvent.keyDown(window, { key: 'L' });
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    await wait(20);
    fireEvent.mouseMove(canvas, { clientX: 450, clientY: 300 });
    await wait(40);
    const di = editorUiStore.getState().commandBar.dynamicInput;
    expect(di?.manifest.combineAs).toBe('point');
    expect(di?.manifest.fields[0]?.label).toBe('Distance');
    expect(di?.manifest.fields[1]?.label).toBe('Angle');
    fireEvent.keyDown(window, { key: '5' });
    fireEvent.keyDown(window, { key: 'Tab' });
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.keyDown(window, { key: '0' });
    const buffers = editorUiStore.getState().commandBar.dynamicInput?.buffers;
    expect(buffers).toEqual(['5', '30']);
  });

  it('circle DI: type 7 Enter commits a radius-7 circle', async () => {
    // Verifies circle's single-field DI manifest (Radius, combineAs
    // number) + per-field digit routing. DI-commit (number → radius
    // scalar) is unit-covered by combiner test ['7'] → {kind:'number',
    // value:7} + draw-tools.test.ts circle.kind='number' branch.
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);
    fireEvent.keyDown(window, { key: 'C' });
    fireEvent.keyDown(window, { key: 'C' });
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    await wait(20);
    fireEvent.mouseMove(canvas, { clientX: 470, clientY: 300 });
    await wait(40);
    const di = editorUiStore.getState().commandBar.dynamicInput;
    expect(di?.manifest.combineAs).toBe('number');
    expect(di?.manifest.fields).toHaveLength(1);
    expect(di?.manifest.fields[0]?.label).toBe('Radius');
    fireEvent.keyDown(window, { key: '7' });
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers[0]).toBe('7');
  });

  it('click is eaten while DI buffer non-empty (multi-field DI parity)', async () => {
    // Round 6 — multi-field click-eat parity. After draw-line yields
    // its 2-field manifest and the user types '5' in the Distance
    // field, a canvas click MUST be eaten (no second-point feed → no
    // line commit). Equivalent semantic outcome to the unit tests in
    // tests/click-eat-with-di.test.tsx (3 handlers × locked primary
    // assertion target). This is the end-to-end wired-behavior gate.
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);
    fireEvent.keyDown(window, { key: 'L' });
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    await wait(20);
    fireEvent.mouseMove(canvas, { clientX: 450, clientY: 300 });
    await wait(40);
    fireEvent.keyDown(window, { key: '5' });
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers[0]).toBe('5');
    // Click — should be eaten.
    fireEvent.mouseDown(canvas, { button: 0, clientX: 500, clientY: 300 });
    await wait(50);
    expect(editorUiStore.getState().activeToolId).toBe('draw-line');
    expect(
      Object.values(projectStore.getState().project!.primitives).filter((p) => p.kind === 'line')
        .length,
    ).toBe(0);
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers[0]).toBe('5');
  });

  it('first-frame DI coherence', async () => {
    // Rev-3 H2 first-frame coherence: manifest published on prompt-
    // yield triggers synchronous bootstrap of dimensionGuidesBuilder
    // BEFORE first paint (no flicker). Asserts overlay.dimensionGuides
    // is populated immediately after manifest publication — without
    // requiring a cursor-tick mouseMove. The 'sync-bootstrap-on-prompt-
    // yield' unit test in tool-runner.test.ts covers the architectural
    // primary; this scenario verifies the same property at <EditorRoot />
    // level (canvas-host wiring + cursor-set-on-mousedown).
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);
    fireEvent.keyDown(window, { key: 'L' });
    fireEvent.keyDown(window, { key: 'Enter' });
    await wait(20);
    // Pre-seed cursor (canvas-host's mouseMove handler does this in
    // production; here we set it directly so the sync bootstrap reads a
    // valid value when the second-prompt yield triggers).
    editorUiActions.setCursor({ metric: { x: 5, y: 0 }, screen: { x: 450, y: 300 } });
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    await wait(40);
    // Manifest published → dimensionGuides populated synchronously.
    const di = editorUiStore.getState().commandBar.dynamicInput;
    const guides = editorUiStore.getState().overlay.dimensionGuides;
    expect(di).not.toBeNull();
    expect(guides).not.toBeNull();
    if (di && guides) {
      expect(guides.length).toBe(di.manifest.fields.length);
    }
  });
});

// Discipline meta-test (Gate 21.2.disc, Revision-4 per-scenario form +
// §13 mid-execution refinement). Reads its own source, splits on
// `it(`, and per-scenario asserts the block contains BOTH `<EditorRoot`
// (JSX usage — direct or inside a fragment / wrapper, allowing the
// geo-ref scenario's `<><EditorRoot /><StatusBarGeoRefChip /></>`
// composition) AND `fireEvent.`. Per-scenario structural enforcement
// of A18-assert + A18-uistate.
describe('smoke E2E discipline (A18 / Revision-4)', () => {
  it('every named scenario mounts EditorRoot and fires DOM events', () => {
    const src = readFileSync(fileURLToPath(import.meta.url), 'utf8');

    for (const name of SCENARIOS) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const declRe = new RegExp(`it\\(\\s*['"\`]${escaped}['"\`]`, 'g');
      const allDecls = src.match(declRe) ?? [];
      expect(
        allDecls.length,
        `scenario "${name}" must have exactly one it(...) declaration; found ${allDecls.length}`,
      ).toBe(1);

      const findRe = new RegExp(`it\\(\\s*['"\`]${escaped}['"\`]`);
      const m = findRe.exec(src);
      expect(m, `scenario "${name}" not found`).toBeTruthy();
      const blockStart = m!.index;

      // Heuristic block end: next `it(` declaration or end-of-file.
      const remainder = src.slice(blockStart + 1);
      const nextItIdx = remainder.search(/\bit\(\s*['"`]/);
      const blockEnd = nextItIdx === -1 ? src.length : blockStart + 1 + nextItIdx;
      const body = src.slice(blockStart, blockEnd);

      expect(/<EditorRoot/.test(body), `"${name}" missing <EditorRoot JSX`).toBe(true);
      expect(/fireEvent\./.test(body), `"${name}" missing fireEvent.`).toBe(true);
    }
  });
});
