// StatusBarCoordReadout tests for M1.3d Phase 8.

import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StatusBarCoordReadout } from '../src/chrome/StatusBarCoordReadout';
import { editorUiActions, resetEditorUiStoreForTests } from '../src/ui-state/store';

afterEach(() => resetEditorUiStoreForTests());

describe('StatusBarCoordReadout', () => {
  it('renders placeholder X: —  Y: — when overlay.cursor is null', () => {
    render(<StatusBarCoordReadout />);
    const el = document.querySelector('[data-component="coord-readout"]');
    expect(el).toBeTruthy();
    expect(el?.textContent).toContain('X: —');
    expect(el?.textContent).toContain('Y: —');
  });

  it('renders X: x.xxx  Y: y.yyy when overlay.cursor is set', () => {
    render(<StatusBarCoordReadout />);
    editorUiActions.setCursor({
      metric: { x: 12.345678, y: -5.6789 },
      screen: { x: 0, y: 0 },
    });
    const el = document.querySelector('[data-component="coord-readout"]')!;
    // Re-render is automatic via Zustand subscription. Wait a microtask.
    return Promise.resolve().then(() => {
      expect(el.textContent).toContain('X: 12.346');
      expect(el.textContent).toContain('Y: -5.679');
    });
  });

  it('updates when cursor changes (live re-render via useEditorUi)', async () => {
    render(<StatusBarCoordReadout />);
    editorUiActions.setCursor({ metric: { x: 1, y: 2 }, screen: { x: 0, y: 0 } });
    await Promise.resolve();
    const el = document.querySelector('[data-component="coord-readout"]')!;
    expect(el.textContent).toContain('X: 1.000');
    editorUiActions.setCursor({ metric: { x: 9, y: 9 }, screen: { x: 0, y: 0 } });
    await Promise.resolve();
    expect(el.textContent).toContain('X: 9.000');
  });
});
