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

// M1.3 DI pipeline overhaul Phase 2 (B6) — live cursor pill values.
// When a field's buffer is empty AND the field is not locked, the pill
// renders a value derived from the matching dimension guide:
//   linear-dim → distance (length of anchorB - anchorA, 3 decimals)
//   angle-arc  → degrees (sweepAngleRad converted, 2 decimals)
// Once the user types, the typed buffer (abs value per A1) replaces
// the live read. Locked + empty stays blank (degenerate edge case).
// Locks invariant I-DI-2.
describe('M1.3 DI pipeline overhaul Phase 2 — live cursor pill values (B6)', () => {
  function seedTwoFieldGuides(distance: number, sweepRad: number): void {
    editorUiActions.setCursor({ metric: { x: 0, y: 0 }, screen: { x: 100, y: 200 } });
    editorUiActions.setDimensionGuides([
      {
        kind: 'linear-dim',
        anchorA: { x: 0, y: 0 },
        anchorB: { x: distance, y: 0 },
        offsetCssPx: 40,
      },
      {
        kind: 'angle-arc',
        pivot: { x: 0, y: 0 },
        baseAngleRad: 0,
        sweepAngleRad: sweepRad,
        radiusMetric: 5,
      },
    ]);
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
  }

  it('pill shows live distance from linear-dim guide when buffer empty + unlocked (3 decimals)', () => {
    // anchorB = (3, 4) → hypot = 5 → "5.000".
    seedTwoFieldGuides(3, 0);
    editorUiActions.setDimensionGuides([
      {
        kind: 'linear-dim',
        anchorA: { x: 0, y: 0 },
        anchorB: { x: 3, y: 4 },
        offsetCssPx: 40,
      },
      {
        kind: 'angle-arc',
        pivot: { x: 0, y: 0 },
        baseAngleRad: 0,
        sweepAngleRad: 0,
        radiusMetric: 5,
      },
    ]);
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    expect(pills[0]?.textContent).toBe('D: 5.000');
  });

  it('pill shows live angle in degrees from angle-arc guide when buffer empty + unlocked (2 decimals)', () => {
    // sweepAngleRad = π/4 → 45 degrees → "45.00".
    seedTwoFieldGuides(5, Math.PI / 4);
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    expect(pills[1]?.textContent).toBe('A: 45.00');
  });

  it('pill shows typed buffer as-is (Phase 6 — minus visible) overriding live cursor read', () => {
    seedTwoFieldGuides(5, Math.PI / 4);
    editorUiActions.setDynamicInputFieldBuffer(0, '-7');
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    // Phase 6 — Pill displays the buffer including any leading minus
    // (Phase 2 stripped it per A1; user feedback overrode that lock).
    expect(pills[0]?.textContent).toBe('D: -7');
  });

  it('pill empty + locked renders label only (degenerate edge case — Backspace-on-locked)', () => {
    seedTwoFieldGuides(5, Math.PI / 4);
    editorUiActions.setDynamicInputFieldLocked(0, true);
    // Buffer empty + locked = degenerate; pill shows label only.
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    expect(pills[0]?.textContent).toBe('D: ');
    expect(pills[0]?.getAttribute('data-pill-locked')).toBe('true');
  });

  it('pill non-empty buffer + locked renders typed value (abs) — locked freezes display', () => {
    seedTwoFieldGuides(5, Math.PI / 4);
    editorUiActions.setDynamicInputFieldBuffer(1, '30');
    editorUiActions.setDynamicInputFieldLocked(1, true);
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    // Pill 1 shows typed "30" (NOT live cursor 45.00) because buffer
    // takes precedence; locked just freezes display semantics.
    expect(pills[1]?.textContent).toBe('A: 30');
    expect(pills[1]?.getAttribute('data-pill-locked')).toBe('true');
  });

  it('data-pill-placeholder attribute is no longer rendered (Phase 2 retires the placeholder render path)', () => {
    seedTwoFieldGuides(5, 0);
    editorUiActions.recordSubmittedBuffers('draw-line:0', ['9', '99']);
    // Re-publish manifest now that recall is set so placeholders array
    // gets seeded (Phase 1-3 still seeds the slice; Phase 4 drops it).
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
    expect(pills[0]?.getAttribute('data-pill-placeholder')).toBeNull();
    expect(pills[1]?.getAttribute('data-pill-placeholder')).toBeNull();
    // Pill text is the live cursor read, NOT the placeholder values
    // (the placeholder slice still exists but is no longer rendered).
    expect(pills[0]?.textContent).toBe('D: 5.000');
  });
});

// M1.3 DI pipeline overhaul Phase 4 (B8) — recall pill render.
// When dynamicInput.recallActive=true: per-field pills get pillDimmed
// styling; recall pill renders at cursor + (16, 28) CSS-px showing
// `${label}=${value} / ...` for the recalled buffers from
// dynamicInputRecall[promptKey]. Plan A13 / A14 / I-DI-10.
describe('M1.3 DI pipeline overhaul Phase 4 — recall pill render (B8)', () => {
  function seedRecallAndManifest(): void {
    editorUiActions.setCursor({ metric: { x: 0, y: 0 }, screen: { x: 200, y: 300 } });
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
        sweepAngleRad: Math.PI / 6,
        radiusMetric: 5,
      },
    ]);
    editorUiActions.recordSubmittedBuffers('draw-line:0', ['5', '30']);
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

  it('recallActive=false: no recall pill rendered; per-field pills focus normally', () => {
    seedRecallAndManifest();
    const { container } = render(<DynamicInputPills />);
    const recallPill = container.querySelector('[data-component="dynamic-input-recall-pill"]');
    expect(recallPill).toBeNull();
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    expect(pills[0]?.getAttribute('data-pill-focused')).toBe('true');
  });

  it('recallActive=true: recall pill rendered with `Distance=5 / Angle=30` text at cursor offset', () => {
    seedRecallAndManifest();
    editorUiActions.setDynamicInputRecallActive(true);
    const { container } = render(<DynamicInputPills />);
    const recallPill = container.querySelector<HTMLElement>(
      '[data-component="dynamic-input-recall-pill"]',
    );
    expect(recallPill).not.toBeNull();
    expect(recallPill?.textContent).toBe('Distance=5 / Angle=30');
    // Position derives from cursor.screen + (16, 28).
    const transform = recallPill?.style.transform ?? '';
    expect(transform).toContain('216px'); // 200 + 16
    expect(transform).toContain('328px'); // 300 + 28
  });

  it('recallActive=true: per-field pills get data-pill-focused="false" + pillDimmed (lose focus styling)', () => {
    seedRecallAndManifest();
    editorUiActions.setDynamicInputRecallActive(true);
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    expect(pills).toHaveLength(2);
    expect(pills[0]?.getAttribute('data-pill-focused')).toBe('false');
    expect(pills[1]?.getAttribute('data-pill-focused')).toBe('false');
  });

  it('recallActive=true with no recall entry under promptKey → recall pill not rendered (graceful degradation)', () => {
    editorUiActions.setCursor({ metric: { x: 0, y: 0 }, screen: { x: 100, y: 100 } });
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
        sweepAngleRad: 0,
        radiusMetric: 5,
      },
    ]);
    // NO recordSubmittedBuffers — recall map empty for this promptKey.
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
    editorUiActions.setDynamicInputRecallActive(true);
    const { container } = render(<DynamicInputPills />);
    const recallPill = container.querySelector('[data-component="dynamic-input-recall-pill"]');
    expect(recallPill).toBeNull(); // defensive: no entry → render nothing
  });
});

// M1.3 DI pipeline overhaul Phase 7 (regression backfill per Codex
// Round-2 audit) — locked-pill renders a Lucide Lock SVG inline; an
// unlocked pill does not. Phase 6 added this affordance to replace
// the amber outline (which was too heavy per user feedback). The
// SVG presence is the user-visible signal that the field is frozen.
describe('DynamicInputPills — Phase 7 regression: lock icon visible affordance', () => {
  function seedManifestAndGuides(): void {
    editorUiActions.setCursor({ metric: { x: 0, y: 0 }, screen: { x: 100, y: 100 } });
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
        sweepAngleRad: 0,
        radiusMetric: 5,
      },
    ]);
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
  }

  it('locked pill renders a Lock SVG icon inline (Phase 6 affordance)', () => {
    seedManifestAndGuides();
    editorUiActions.setDynamicInputFieldBuffer(0, '5');
    editorUiActions.setDynamicInputFieldLocked(0, true);
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    expect(pills[0]?.getAttribute('data-pill-locked')).toBe('true');
    // Lucide icons render as inline <svg>. Locked pill MUST have one.
    const lockedSvg = pills[0]?.querySelector('svg');
    expect(lockedSvg).not.toBeNull();
  });

  it('unlocked pill does NOT render a Lock SVG icon', () => {
    seedManifestAndGuides();
    editorUiActions.setDynamicInputFieldBuffer(0, '5');
    // Don't lock — buffer typed without Tab.
    const { container } = render(<DynamicInputPills />);
    const pills = container.querySelectorAll<HTMLElement>('[data-component="dynamic-input-pill"]');
    expect(pills[0]?.getAttribute('data-pill-locked')).toBe('false');
    const lockedSvg = pills[0]?.querySelector('svg');
    expect(lockedSvg).toBeNull();
  });
});
