// vitest setup — jsdom environment shims + per-test cleanup.
//
// jsdom 25 does not ship ResizeObserver natively; EditorRoot's
// container observer would throw without it. Defining a minimal
// no-op stub is sufficient for smoke-level tests since we drive
// viewport size manually via editorUiActions.setViewport.

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

class ResizeObserverShim {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as { ResizeObserver: typeof ResizeObserverShim }).ResizeObserver = ResizeObserverShim;
}

// jsdom 25 does not implement HTMLCanvasElement.getContext. The smoke
// E2E suite mounts EditorRoot which in turn mounts CanvasHost; the
// paint loop calls ctx.getContext('2d') and silently no-ops when null
// is returned, but jsdom emits a noisy "Not implemented" stderr line.
// Stub it to return a minimal mock with the methods the painters call.
if (typeof HTMLCanvasElement !== 'undefined') {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (type: string) => CanvasRenderingContext2D | null;
  };
  if (
    typeof proto.getContext !== 'function' ||
    proto.getContext.toString().includes('Not implemented')
  ) {
    proto.getContext = function getContextStub(type: string): CanvasRenderingContext2D | null {
      if (type !== '2d') return null;
      const noop = (): void => {};
      const stub: Partial<CanvasRenderingContext2D> = {
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
      };
      return stub as CanvasRenderingContext2D;
    };
  }
}

afterEach(() => {
  cleanup();
});
