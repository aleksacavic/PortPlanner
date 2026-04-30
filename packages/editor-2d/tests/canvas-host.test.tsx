// canvas-host tests for M1.3d Phase 2 — rAF-coalesced cursor tracking,
// imperative requestPaint(), getOverlay-feeds-paint, and the I-DTP-22 /
// Gate DTP-T7 source-import sanity check.

import { readFileSync } from 'node:fs';
import { LayerId, type Project, defaultLayer, newProjectId } from '@portplanner/domain';
import {
  hydrateProject,
  projectStore,
  resetProjectStoreForTests,
} from '@portplanner/project-store';
import { fireEvent, render } from '@testing-library/react';
import { type ReactElement, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasHost, type CanvasHostHandle } from '../src/canvas/canvas-host';
import type { Viewport } from '../src/canvas/view-transform';
import type { OverlayState } from '../src/ui-state/store';

const viewport: Viewport = {
  panX: 0,
  panY: 0,
  zoom: 10,
  dpr: 1,
  canvasWidthCss: 800,
  canvasHeightCss: 600,
  crosshairSizePct: 100,
};

function makeOverlay(): OverlayState {
  return {
    cursor: null,
    snapTarget: null,
    guides: [],
    selectionHandles: [],
    previewShape: null,
    hoverEntity: null,
    grips: null,
    suppressEntityPaint: null,
  };
}

function makeProject(): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.2.0',
    name: 'CH-test',
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z',
    coordinateSystem: null,
    objects: {},
    primitives: {},
    layers: { [LayerId.DEFAULT]: defaultLayer() },
    grids: {},
    scenarioId: null,
  };
}

// Wait long enough for any pending rAF callback to fire. jsdom schedules
// rAF on a setTimeout-like loop; 50 ms gives ~3 frame ticks of headroom.
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 50));

// jsdom 25's HTMLCanvasElement.getContext is a "not-implemented" wrapper
// that THROWS via the report-exception helper. The shared `tests/setup.ts`
// only installs its no-op stub when `getContext` is missing OR its
// toString matches /Not implemented/, neither of which is true for
// jsdom 25's generated wrapper — so paint()'s `ctx` early-return fires
// and the rAF callback exits before reaching `getOverlay()`. We need
// paint() to actually run for these tests, so install a local minimal
// stub before each test.
const noop = (): void => {};
const ctxStub: Partial<CanvasRenderingContext2D> = {
  save: noop,
  restore: noop,
  beginPath: noop,
  closePath: noop,
  moveTo: noop,
  lineTo: noop,
  arc: noop,
  ellipse: noop,
  rect: noop,
  stroke: noop,
  fill: noop,
  clearRect: noop,
  fillRect: noop,
  strokeRect: noop,
  setTransform: noop,
  resetTransform: noop,
  translate: noop,
  scale: noop,
  rotate: noop,
  measureText: () => ({ width: 0 }) as TextMetrics,
  fillText: noop,
  strokeText: noop,
  setLineDash: noop,
};
let originalGetContext: typeof HTMLCanvasElement.prototype.getContext | null = null;

beforeEach(() => {
  resetProjectStoreForTests();
  hydrateProject(makeProject(), '2026-04-26T00:00:00.000Z');
  originalGetContext = HTMLCanvasElement.prototype.getContext;
  (
    HTMLCanvasElement.prototype as unknown as {
      getContext: (type: string) => CanvasRenderingContext2D | null;
    }
  ).getContext = (type: string): CanvasRenderingContext2D | null =>
    type === '2d' ? (ctxStub as CanvasRenderingContext2D) : null;
});

afterEach(() => {
  if (originalGetContext) {
    (
      HTMLCanvasElement.prototype as unknown as {
        getContext: typeof HTMLCanvasElement.prototype.getContext;
      }
    ).getContext = originalGetContext;
  }
  resetProjectStoreForTests();
});

describe('canvas-host — M1.3d Phase 2 mousemove + getOverlay + requestPaint', () => {
  it('rAF-coalesces multiple synchronous mousemoves into ≤1 onCanvasHover per frame (I-DTP-4)', async () => {
    const onCanvasHover = vi.fn();
    const { container } = render(<CanvasHost viewport={viewport} onCanvasHover={onCanvasHover} />);
    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('canvas not in DOM');

    fireEvent.mouseMove(canvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.mouseMove(canvas, { clientX: 30, clientY: 30 });
    fireEvent.mouseMove(canvas, { clientX: 40, clientY: 40 });
    fireEvent.mouseMove(canvas, { clientX: 50, clientY: 50 });

    await flush();

    expect(onCanvasHover).toHaveBeenCalledTimes(1);
    const call = onCanvasHover.mock.calls[0];
    expect(call).toBeDefined();
    const [, screen] = call as [unknown, { x: number; y: number }];
    // The flushed value is the LATEST cursor, not the first.
    expect(screen.x).toBe(50);
    expect(screen.y).toBe(50);
  });

  it('reports metric derived via screenToMetric — same view-transform as click (I-DTP-5)', async () => {
    const onCanvasHover = vi.fn();
    const { container } = render(<CanvasHost viewport={viewport} onCanvasHover={onCanvasHover} />);
    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('canvas not in DOM');

    // canvasWidthCss=800, canvasHeightCss=600, zoom=10, pan=(0,0).
    // screen (400, 300) is canvas centre → metric (0, 0).
    // screen (450, 300) is 50 px right of centre → metric (5, 0).
    fireEvent.mouseMove(canvas, { clientX: 450, clientY: 300 });
    await flush();

    const call = onCanvasHover.mock.calls[0];
    expect(call).toBeDefined();
    const [metric] = call as [{ x: number; y: number }];
    expect(metric.x).toBeCloseTo(5, 6);
    expect(metric.y).toBeCloseTo(0, 6);
  });

  it('skips the flush when the cursor has not moved since the last flush', async () => {
    const onCanvasHover = vi.fn();
    const { container } = render(<CanvasHost viewport={viewport} onCanvasHover={onCanvasHover} />);
    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('canvas not in DOM');

    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    await flush();
    expect(onCanvasHover).toHaveBeenCalledTimes(1);

    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    await flush();
    expect(onCanvasHover).toHaveBeenCalledTimes(1);

    fireEvent.mouseMove(canvas, { clientX: 101, clientY: 100 });
    await flush();
    expect(onCanvasHover).toHaveBeenCalledTimes(2);
  });

  it('requestPaint() imperative ref does not throw and is wired through forwardRef', async () => {
    function Harness(): ReactElement {
      const ref = useRef<CanvasHostHandle | null>(null);
      return (
        <>
          <button type="button" data-testid="trigger" onClick={() => ref.current?.requestPaint()}>
            paint
          </button>
          <CanvasHost ref={ref} viewport={viewport} />
        </>
      );
    }
    const { getByTestId } = render(<Harness />);
    await flush();

    expect(() => fireEvent.click(getByTestId('trigger'))).not.toThrow();
    await flush();
  });

  it('reads overlay via getOverlay() during the paint frame (I-DTP-22 data flow)', async () => {
    const overlay = makeOverlay();
    overlay.cursor = { metric: { x: 5, y: 5 }, screen: { x: 100, y: 100 } };
    const getOverlay = vi.fn(() => overlay);

    render(<CanvasHost viewport={viewport} getOverlay={getOverlay} />);
    await flush();

    // The initial paint fires once on mount via schedulePaint(). It calls
    // getOverlay() before invoking paint(). Subsequent project mutations
    // would trigger more calls; mounting alone is enough to verify the
    // wire-up.
    expect(getOverlay).toHaveBeenCalled();
  });

  it('repaints on requestPaint() — getOverlay called again', async () => {
    const overlay = makeOverlay();
    const getOverlay = vi.fn(() => overlay);

    function Harness(): ReactElement {
      const ref = useRef<CanvasHostHandle | null>(null);
      return (
        <>
          <button type="button" data-testid="trigger" onClick={() => ref.current?.requestPaint()}>
            paint
          </button>
          <CanvasHost ref={ref} viewport={viewport} getOverlay={getOverlay} />
        </>
      );
    }
    const { getByTestId } = render(<Harness />);
    await flush();
    const initial = getOverlay.mock.calls.length;
    expect(initial).toBeGreaterThan(0);

    fireEvent.click(getByTestId('trigger'));
    await flush();
    expect(getOverlay.mock.calls.length).toBeGreaterThan(initial);
  });
});

describe('canvas-host — Gate DTP-T7 source-import isolation (I-DTP-22 / I-68)', () => {
  // Direct source-file inspection: canvas-host.tsx must NEVER reference
  // editorUiStore (the runtime symbol), useEditorUi (the React hook),
  // or import the use-editor-ui-store module path. This is the source-
  // level mirror of Gate DTP-T7 and the I-68 store-isolation invariant
  // from M1.3a (Gate 22.7).
  // Vitest runs each package's test suite with cwd set to the package
  // root, so a relative path resolves the source file deterministically
  // — same pattern as `tests/store-isolation.test.ts`.
  const sourceText = readFileSync('src/canvas/canvas-host.tsx', 'utf8');

  it('does not reference the editorUiStore runtime symbol anywhere', () => {
    expect(sourceText).not.toMatch(/\beditorUiStore\b/);
  });

  it('does not call the useEditorUi React hook', () => {
    expect(sourceText).not.toMatch(/\buseEditorUi\(/);
  });

  it('does not import the use-editor-ui-store module', () => {
    expect(sourceText).not.toMatch(/from\s+['"]\.\.\/chrome\/use-editor-ui-store['"]/);
  });
});

// Sanity: keep the projectStore import live (would otherwise be flagged
// by a stricter unused-import lint pass).
void projectStore;
