// Round 7 Phase 3 — hover overflow tooltip on multi-pill DI cells.
// Locks REM7-P3-OverflowDetection + REM7-P3-OverflowDeterministic +
// REM7-P3-MouseLeaveCleanup + REM7-P3-UnitFormat per the
// canvas-tokens-and-di-polish plan §11 + Codex Round-1 B2 fix
// (deterministic Object.defineProperty stubbing of scrollWidth /
// clientWidth, since JSDOM doesn't compute layout).

import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DynamicInputPills } from '../src/chrome/DynamicInputPills';
import { editorUiActions, resetEditorUiStoreForTests } from '../src/ui-state/store';

afterEach(() => resetEditorUiStoreForTests());

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

function seedDistanceAngleManifest(): void {
  editorUiActions.setDynamicInputManifest(
    {
      fields: [
        { kind: 'distance', label: 'Distance' },
        { kind: 'angle', label: 'Angle' },
      ],
      combineAs: 'point',
    },
    'draw-line:0',
  );
}

/**
 * Stub `scrollWidth` and `clientWidth` on a DOM element so the
 * overflow-detection branch is deterministic (JSDOM otherwise reports
 * 0 for both). `configurable: true` lets later tests override the
 * stub on the same node.
 */
function stubLayout(el: Element, scrollWidth: number, clientWidth: number): void {
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
}

describe('Round 7 Phase 3 — hover overflow tooltip', () => {
  beforeEach(() => {
    seedTwoFieldGuides();
  });

  it('shows tooltip on hover when scrollWidth > clientWidth (overflow case) — REM7-P3-OverflowDetection + REM7-P3-OverflowDeterministic', () => {
    seedDistanceAngleManifest();
    editorUiActions.setDynamicInputFieldBuffer(0, '12345.678');
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    const distPill = pills[0];
    if (!distPill) throw new Error('expected distance pill');
    // Stub overflow BEFORE hover.
    stubLayout(distPill, 200, 100);
    fireEvent.mouseEnter(distPill);
    const tooltip = document.body.querySelector('[data-component="dynamic-input-pill-tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toBe('Distance: 12345.678 m');
  });

  it('does NOT show tooltip when scrollWidth <= clientWidth (no overflow) — REM7-P3-OverflowDetection negative branch', () => {
    seedDistanceAngleManifest();
    editorUiActions.setDynamicInputFieldBuffer(0, '5');
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    const distPill = pills[0];
    if (!distPill) throw new Error('expected distance pill');
    // Stub: short text fits.
    stubLayout(distPill, 80, 100);
    fireEvent.mouseEnter(distPill);
    const tooltip = document.body.querySelector('[data-component="dynamic-input-pill-tooltip"]');
    expect(tooltip).toBeNull();
  });

  it('removes tooltip on mouseLeave — REM7-P3-MouseLeaveCleanup', () => {
    seedDistanceAngleManifest();
    editorUiActions.setDynamicInputFieldBuffer(0, '12345.678');
    const { container } = render(<DynamicInputPills />);
    const distPill = container.querySelector<HTMLElement>('[data-component="dynamic-input-pill"]');
    if (!distPill) throw new Error('expected distance pill');
    stubLayout(distPill, 200, 100);
    fireEvent.mouseEnter(distPill);
    expect(
      document.body.querySelector('[data-component="dynamic-input-pill-tooltip"]'),
    ).not.toBeNull();
    fireEvent.mouseLeave(distPill);
    expect(document.body.querySelector('[data-component="dynamic-input-pill-tooltip"]')).toBeNull();
  });
});

describe('Round 7 Phase 3 — unit suffix per field kind (REM7-P3-UnitFormat)', () => {
  beforeEach(() => {
    seedTwoFieldGuides();
  });

  it("'distance' field tooltip ends with ' m'", () => {
    seedDistanceAngleManifest();
    editorUiActions.setDynamicInputFieldBuffer(0, '12345.678');
    const { container } = render(<DynamicInputPills />);
    const distPill = container.querySelectorAll<HTMLElement>(
      '[data-component="dynamic-input-pill"]',
    )[0];
    if (!distPill) throw new Error('expected distance pill');
    stubLayout(distPill, 200, 100);
    fireEvent.mouseEnter(distPill);
    const tooltip = document.body.querySelector('[data-component="dynamic-input-pill-tooltip"]');
    expect(tooltip?.textContent).toMatch(/ m$/);
  });

  it("'angle' field tooltip ends with '°'", () => {
    seedDistanceAngleManifest();
    editorUiActions.setDynamicInputFieldBuffer(1, '359.9999');
    const { container } = render(<DynamicInputPills />);
    const anglePill = container.querySelectorAll<HTMLElement>(
      '[data-component="dynamic-input-pill"]',
    )[1];
    if (!anglePill) throw new Error('expected angle pill');
    stubLayout(anglePill, 200, 100);
    fireEvent.mouseEnter(anglePill);
    const tooltip = document.body.querySelector('[data-component="dynamic-input-pill-tooltip"]');
    expect(tooltip?.textContent).toMatch(/°$/);
  });

  it("'number' field tooltip has NO unit suffix", () => {
    // Rectangle's W/H manifest uses kind 'number' (combineAs:'numberPair').
    editorUiActions.setDynamicInputManifest(
      {
        fields: [
          { kind: 'number', label: 'W' },
          { kind: 'number', label: 'H' },
        ],
        combineAs: 'numberPair',
      },
      'draw-rectangle:0',
    );
    editorUiActions.setDynamicInputFieldBuffer(0, '6.789012345');
    const { container } = render(<DynamicInputPills />);
    const wPill = container.querySelectorAll<HTMLElement>(
      '[data-component="dynamic-input-pill"]',
    )[0];
    if (!wPill) throw new Error('expected W pill');
    stubLayout(wPill, 200, 100);
    fireEvent.mouseEnter(wPill);
    const tooltip = document.body.querySelector('[data-component="dynamic-input-pill-tooltip"]');
    expect(tooltip?.textContent).toBe('W: 6.789012345');
    // Negative — no trailing unit.
    expect(tooltip?.textContent).not.toMatch(/[m°]$/);
  });
});
