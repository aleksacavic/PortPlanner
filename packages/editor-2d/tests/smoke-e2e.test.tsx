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
import { StatusBarGeoRefChip } from '../src/chrome/StatusBarGeoRefChip';
import { editorUiStore, resetEditorUiStoreForTests } from '../src/ui-state/store';

const SCENARIOS = [
  'draw line and reload',
  'pan zoom toggle',
  'layer manager flow',
  'properties edit',
  'geo-ref chip non-blocking',
] as const;

const ACCUMULATOR_FLUSH_MS = 800;

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
    await wait(ACCUMULATOR_FLUSH_MS);
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
    await wait(ACCUMULATOR_FLUSH_MS);

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
    await wait(ACCUMULATOR_FLUSH_MS);
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

    // A18-uistate: drive selection through a canvas pointerDown rather
    // than editorUiActions.setSelection (Revision-4 narrowing). The
    // hit-test treats circles as outlines (distance to circumference),
    // so we click at the right edge of the radius-5 circle —
    // metric (5,0) maps to screen (450, 300) at zoom=10 with default
    // viewport size 800×600.
    fireEvent.mouseDown(canvas, { button: 0, clientX: 450, clientY: 300 });
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
    await wait(ACCUMULATOR_FLUSH_MS);
    expect(editorUiStore.getState().activeToolId).toBe('draw-line');
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    fireEvent.mouseDown(canvas, { button: 0, clientX: 500, clientY: 300 });
    await wait(50);
    const lines = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'line',
    );
    expect(lines).toHaveLength(1);
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
