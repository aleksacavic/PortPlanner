import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom 25 doesn't ship ResizeObserver. EditorRoot uses one to keep
// canvas size in sync with its container.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

// editor-2d's keyboard router registers a window-level keydown handler
// the first time EditorRoot mounts. React StrictMode + multiple test
// mounts trip the "already registered" guard. The router exports a
// best-effort unregister hook for tests; call it before each new mount
// via the test helper. (Each test imports it explicitly when needed.)

afterEach(() => {
  cleanup();
});
