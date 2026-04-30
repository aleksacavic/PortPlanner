// M1.3 Round 6 — DynamicInputPills component tests per plan §11.
// Replaces DynamicInputPill.test.tsx. Three modes:
//   1. 0 pills if `toggles.dynamicInput` is false.
//   2. N pills if a manifest is active + dimensionGuides match field count.
//   3. 1 fallback pill at cursor.screen + offset for legacy non-DI prompts.

import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DynamicInputPills } from '../src/chrome/DynamicInputPills';
import { editorUiActions, editorUiStore, resetEditorUiStoreForTests } from '../src/ui-state/store';

afterEach(() => resetEditorUiStoreForTests());

describe('DynamicInputPills — multi-pill chrome', () => {
  it('renders 0 pills when toggles.dynamicInput is false', () => {
    editorUiActions.toggleDynamicInput(); // default true → false.
    expect(editorUiStore.getState().toggles.dynamicInput).toBe(false);
    const { container } = render(<DynamicInputPills />);
    expect(container.querySelectorAll('[data-component="dynamic-input-pill"]')).toHaveLength(0);
  });

  it('fallback single pill: renders at cursor when no manifest but inputBuffer non-empty', () => {
    editorUiActions.setCursor({ metric: { x: 0, y: 0 }, screen: { x: 100, y: 200 } });
    editorUiActions.setInputBuffer('5');
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    expect(pills).toHaveLength(1);
    expect(pills[0]?.textContent).toBe('5');
  });

  it('fallback single pill: hidden when no manifest AND inputBuffer/accumulator/activePrompt all empty', () => {
    editorUiActions.setCursor({ metric: { x: 0, y: 0 }, screen: { x: 100, y: 200 } });
    const { container } = render(<DynamicInputPills />);
    expect(container.querySelectorAll('[data-component="dynamic-input-pill"]')).toHaveLength(0);
  });

  it('multi-pill mode: renders N pills when manifest active + dimensionGuides match field count', () => {
    editorUiActions.setCursor({ metric: { x: 0, y: 0 }, screen: { x: 100, y: 200 } });
    editorUiActions.setDynamicInputManifest({
      fields: [
        { kind: 'number', label: 'W' },
        { kind: 'number', label: 'H' },
      ],
      combineAs: 'numberPair',
    });
    editorUiActions.setDimensionGuides([
      {
        kind: 'linear-dim',
        anchorA: { x: 0, y: 0 },
        anchorB: { x: 10, y: 0 },
        offsetCssPx: 10,
      },
      {
        kind: 'linear-dim',
        anchorA: { x: 10, y: 0 },
        anchorB: { x: 10, y: 5 },
        offsetCssPx: 10,
      },
    ]);
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    expect(pills).toHaveLength(2);
    // Pill 0 = W (focused by default — activeFieldIdx = 0).
    expect(pills[0]?.textContent).toContain('W:');
    expect(pills[0]?.getAttribute('data-pill-focused')).toBe('true');
    // Pill 1 = H (not focused).
    expect(pills[1]?.textContent).toContain('H:');
    expect(pills[1]?.getAttribute('data-pill-focused')).toBe('false');
  });

  it('multi-pill mode: focused pill follows activeFieldIdx', () => {
    editorUiActions.setCursor({ metric: { x: 0, y: 0 }, screen: { x: 100, y: 200 } });
    editorUiActions.setDynamicInputManifest({
      fields: [
        { kind: 'distance', label: 'D' },
        { kind: 'angle', label: 'A' },
      ],
      combineAs: 'point',
    });
    editorUiActions.setDimensionGuides([
      { kind: 'linear-dim', anchorA: { x: 0, y: 0 }, anchorB: { x: 5, y: 0 }, offsetCssPx: 10 },
      {
        kind: 'angle-arc',
        pivot: { x: 0, y: 0 },
        baseAngleRad: 0,
        sweepAngleRad: Math.PI / 6,
        radiusMetric: 5,
      },
    ]);
    editorUiActions.setDynamicInputActiveField(1);
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    expect(pills[0]?.getAttribute('data-pill-focused')).toBe('false');
    expect(pills[1]?.getAttribute('data-pill-focused')).toBe('true');
  });

  it('multi-pill mode: pill text reflects per-field buffer contents', () => {
    editorUiActions.setCursor({ metric: { x: 0, y: 0 }, screen: { x: 100, y: 200 } });
    editorUiActions.setDynamicInputManifest({
      fields: [
        { kind: 'distance', label: 'D' },
        { kind: 'angle', label: 'A' },
      ],
      combineAs: 'point',
    });
    editorUiActions.setDimensionGuides([
      { kind: 'linear-dim', anchorA: { x: 0, y: 0 }, anchorB: { x: 5, y: 0 }, offsetCssPx: 10 },
      {
        kind: 'angle-arc',
        pivot: { x: 0, y: 0 },
        baseAngleRad: 0,
        sweepAngleRad: 0,
        radiusMetric: 5,
      },
    ]);
    editorUiActions.setDynamicInputFieldBuffer(0, '5');
    editorUiActions.setDynamicInputFieldBuffer(1, '30');
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    // Field labels are prefixed; buffers follow.
    expect(pills[0]?.textContent).toContain('D: 5');
    expect(pills[1]?.textContent).toContain('A: 30');
  });

  it('multi-pill mode: degrades gracefully when manifest+guides field-count mismatch (defensive — falls through to single fallback or null)', () => {
    editorUiActions.setCursor({ metric: { x: 0, y: 0 }, screen: { x: 100, y: 200 } });
    editorUiActions.setDynamicInputManifest({
      fields: [{ kind: 'number', label: 'X' }],
      combineAs: 'number',
    });
    // Set guides with 0 entries (mismatch).
    editorUiActions.setDimensionGuides([]);
    const { container } = render(<DynamicInputPills />);
    // Multi-pill arm bails (length mismatch); falls through to single-pill
    // fallback path, which requires inputBuffer/accumulator/activePrompt
    // — none set, so 0 pills.
    expect(container.querySelectorAll('[data-component="dynamic-input-pill"]')).toHaveLength(0);
  });
});

// Round 7 Phase 2 — dim-placeholder pill rendering. When the active
// buffer for a field is empty AND a previously-submitted value is
// available under the current promptKey, the pill renders the
// placeholder text dim. Locks REM7-P2-Placeholder.
describe('Round 7 Phase 2 — dim placeholder rendering (REM7-P2-Placeholder)', () => {
  function seedTwoFieldGuides(): void {
    editorUiActions.setCursor({ metric: { x: 0, y: 0 }, screen: { x: 100, y: 200 } });
    editorUiActions.setDimensionGuides([
      {
        kind: 'linear-dim',
        anchorA: { x: 0, y: 0 },
        anchorB: { x: 5, y: 0 },
        offsetCssPx: 40,
      },
      {
        kind: 'angle-arc',
        pivot: { x: 0, y: 0 },
        baseAngleRad: 0,
        sweepAngleRad: 0.5,
        radiusMetric: 5,
      },
    ]);
  }

  it('renders dim placeholder when buffer empty AND placeholder non-empty (data-pill-placeholder="true")', () => {
    seedTwoFieldGuides();
    editorUiActions.recordSubmittedBuffers('draw-line:0', ['5', '30']);
    editorUiActions.setDynamicInputManifest(
      {
        fields: [
          { kind: 'distance', label: 'D' },
          { kind: 'angle', label: 'A' },
        ],
        combineAs: 'point',
      },
      'draw-line:0',
    );
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    expect(pills).toHaveLength(2);
    expect(pills[0]?.getAttribute('data-pill-placeholder')).toBe('true');
    expect(pills[1]?.getAttribute('data-pill-placeholder')).toBe('true');
    expect(pills[0]?.textContent).toContain('D: 5');
    expect(pills[1]?.textContent).toContain('A: 30');
  });

  it('typing replaces the placeholder (data-pill-placeholder="false" once buffer non-empty)', () => {
    seedTwoFieldGuides();
    editorUiActions.recordSubmittedBuffers('draw-line:0', ['5', '30']);
    editorUiActions.setDynamicInputManifest(
      {
        fields: [
          { kind: 'distance', label: 'D' },
          { kind: 'angle', label: 'A' },
        ],
        combineAs: 'point',
      },
      'draw-line:0',
    );
    editorUiActions.setDynamicInputFieldBuffer(0, '7');
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    expect(pills[0]?.getAttribute('data-pill-placeholder')).toBe('false');
    expect(pills[0]?.textContent).toContain('D: 7');
    expect(pills[1]?.getAttribute('data-pill-placeholder')).toBe('true');
    expect(pills[1]?.textContent).toContain('A: 30');
  });

  it('no placeholder rendered when no persisted value under the promptKey', () => {
    seedTwoFieldGuides();
    editorUiActions.setDynamicInputManifest(
      {
        fields: [
          { kind: 'distance', label: 'D' },
          { kind: 'angle', label: 'A' },
        ],
        combineAs: 'point',
      },
      'draw-line:0',
    );
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    expect(pills[0]?.getAttribute('data-pill-placeholder')).toBe('false');
    expect(pills[1]?.getAttribute('data-pill-placeholder')).toBe('false');
    expect(pills[0]?.textContent).toBe('D: ');
    expect(pills[1]?.textContent).toBe('A: ');
  });
});
