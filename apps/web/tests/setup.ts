import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
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

// Silence jsdom 25's "Not implemented: HTMLCanvasElement.getContext"
// stderr — apps/web shell mounts EditorRoot which mounts CanvasHost.
// Same stub as packages/editor-2d/tests/setup.ts.
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
