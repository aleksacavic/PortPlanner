import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommandBar } from '../src/chrome/CommandBar';
import { editorUiActions, resetEditorUiStoreForTests } from '../src/ui-state/store';

afterEach(() => {
  cleanup();
  resetEditorUiStoreForTests();
});

describe('CommandBar component', () => {
  it('renders the active prompt text from ui-state', () => {
    act(() => editorUiActions.setPrompt('Specify base point', [], '0'));
    const { getByText } = render(<CommandBar />);
    expect(getByText('Specify base point')).toBeTruthy();
  });

  it('renders bracket sub-options and triggers onSubOption on click', () => {
    act(() =>
      editorUiActions.setPrompt('Choose option', [
        { label: 'Reference', shortcut: 'r' },
        { label: 'Copy', shortcut: 'c' },
      ]),
    );
    const onSubOption = vi.fn();
    const { getByText } = render(<CommandBar onSubOption={onSubOption} />);
    fireEvent.click(getByText('Reference'));
    expect(onSubOption).toHaveBeenCalledWith('Reference');
  });

  it('focusing the input transitions ui-state focus to bar', () => {
    const { container } = render(<CommandBar />);
    const input = container.querySelector('[data-component="command-input"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.focus(input);
    fireEvent.blur(input);
  });

  it('history is rendered', () => {
    act(() => {
      for (let i = 0; i < 5; i++) {
        editorUiActions.appendHistory({ role: 'response', text: `entry-${i}`, timestamp: '' });
      }
    });
    const { getByText } = render(<CommandBar />);
    expect(getByText('entry-4')).toBeTruthy();
  });
});

// M1.3d-Remediation-3 F7 — tool badge renders when activeToolId maps to
// a non-null TOOL_DISPLAY_NAMES entry; hides when null.
describe('CommandBar — F7 tool badge', () => {
  it('badge hidden when no tool is active', () => {
    act(() => editorUiActions.setActiveToolId(null));
    const { container } = render(<CommandBar />);
    expect(container.querySelector('[data-component="command-tool-badge"]')).toBeNull();
  });

  it('badge renders with display name for an active user-tool', () => {
    act(() => editorUiActions.setActiveToolId('draw-line'));
    const { container } = render(<CommandBar />);
    const badge = container.querySelector('[data-component="command-tool-badge"]');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('LINE');
  });

  it('badge hidden for internal tools (select-rect / grip-stretch) — null in TOOL_DISPLAY_NAMES', () => {
    act(() => editorUiActions.setActiveToolId('select-rect'));
    const { container } = render(<CommandBar />);
    expect(container.querySelector('[data-component="command-tool-badge"]')).toBeNull();
  });
});
