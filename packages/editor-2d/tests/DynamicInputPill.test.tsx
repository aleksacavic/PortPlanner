// Dynamic Input pill tests for M1.3d-Remediation-4 G2.
//
// Verifies content-priority rendering (inputBuffer > accumulator >
// activePrompt), visibility gating on toggles.dynamicInput, and
// cursor-anchored positioning.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DynamicInputPill } from '../src/chrome/DynamicInputPill';
import { editorUiActions, resetEditorUiStoreForTests } from '../src/ui-state/store';

afterEach(() => {
  cleanup();
  resetEditorUiStoreForTests();
});

function setCursor(): void {
  editorUiActions.setCursor({ metric: { x: 0, y: 0 }, screen: { x: 100, y: 200 } });
}

describe('DynamicInputPill — visibility', () => {
  it('hides when toggles.dynamicInput is false', () => {
    setCursor();
    editorUiActions.setInputBuffer('5');
    editorUiActions.toggleDynamicInput(); // default true → false
    const { container } = render(<DynamicInputPill />);
    expect(container.querySelector('[data-component="dynamic-input-pill"]')).toBeNull();
  });

  it('hides when overlay.cursor is null (no canvas hover yet)', () => {
    editorUiActions.setInputBuffer('5');
    // cursor not set
    const { container } = render(<DynamicInputPill />);
    expect(container.querySelector('[data-component="dynamic-input-pill"]')).toBeNull();
  });

  it('hides when nothing to render (all three sources empty)', () => {
    setCursor();
    // No inputBuffer, no accumulator, no activePrompt.
    const { container } = render(<DynamicInputPill />);
    expect(container.querySelector('[data-component="dynamic-input-pill"]')).toBeNull();
  });
});

describe('DynamicInputPill — content priority (inputBuffer > accumulator > activePrompt)', () => {
  it('renders inputBuffer when buffer non-empty', () => {
    setCursor();
    // setPrompt resets inputBuffer (existing slice contract); call it
    // FIRST, then set inputBuffer + accumulator after.
    editorUiActions.setPrompt('Specify width');
    editorUiActions.setAccumulator('REC');
    editorUiActions.setInputBuffer('5.2');
    const { container } = render(<DynamicInputPill />);
    const pill = container.querySelector('[data-component="dynamic-input-pill"]');
    expect(pill).not.toBeNull();
    expect(pill!.textContent).toBe('5.2');
  });

  it('renders accumulator when buffer empty + accumulator non-empty', () => {
    setCursor();
    editorUiActions.setPrompt('Some prompt');
    editorUiActions.setAccumulator('REC');
    const { container } = render(<DynamicInputPill />);
    const pill = container.querySelector('[data-component="dynamic-input-pill"]');
    expect(pill?.textContent).toBe('REC');
  });

  it('renders activePrompt when both buffers empty + prompt active', () => {
    setCursor();
    editorUiActions.setPrompt('Specify base point');
    const { container } = render(<DynamicInputPill />);
    const pill = container.querySelector('[data-component="dynamic-input-pill"]');
    expect(pill?.textContent).toBe('Specify base point');
  });
});

describe('DynamicInputPill — cursor-anchored positioning', () => {
  it('anchors at cursor.screen + offset (16, -24)', () => {
    setCursor(); // screen = (100, 200)
    editorUiActions.setInputBuffer('5');
    const { container } = render(<DynamicInputPill />);
    const pill = container.querySelector<HTMLDivElement>('[data-component="dynamic-input-pill"]');
    expect(pill).not.toBeNull();
    // transform: translate(116px, 176px) — offset {dx: 16, dy: -24}.
    expect(pill!.style.transform).toContain('translate(116px, 176px)');
  });
});
