import { newPrimitiveId } from '@portplanner/domain';
import { afterEach, describe, expect, it } from 'vitest';

import {
  HISTORY_CAP,
  editorUiActions,
  editorUiStore,
  resetEditorUiStoreForTests,
} from '../src/ui-state/store';

describe('editorUiStore', () => {
  afterEach(() => resetEditorUiStoreForTests());

  it('focus holder is canvas by default and can be set', () => {
    expect(editorUiStore.getState().focusHolder).toBe('canvas');
    editorUiActions.setFocusHolder('bar');
    expect(editorUiStore.getState().focusHolder).toBe('bar');
  });

  it('pushFocusAndSet/popFocus stack restores prior holder', () => {
    expect(editorUiStore.getState().focusHolder).toBe('canvas');
    editorUiActions.pushFocusAndSet('dialog');
    expect(editorUiStore.getState().focusHolder).toBe('dialog');
    editorUiActions.popFocus();
    expect(editorUiStore.getState().focusHolder).toBe('canvas');
  });

  it('toggle actions flip toggle states', () => {
    const before = editorUiStore.getState().toggles.osnap;
    editorUiActions.toggleOsnap();
    expect(editorUiStore.getState().toggles.osnap).toBe(!before);
  });

  it('command-bar history caps at HISTORY_CAP', () => {
    for (let i = 0; i < HISTORY_CAP + 50; i++) {
      editorUiActions.appendHistory({ role: 'input', text: `${i}`, timestamp: '' });
    }
    expect(editorUiStore.getState().commandBar.history).toHaveLength(HISTORY_CAP);
  });

  it('setPrompt resets inputBuffer and updates subOptions', () => {
    editorUiActions.setInputBuffer('typed');
    editorUiActions.setPrompt('Specify base point', [{ label: 'Reference', shortcut: 'r' }], '0');
    const cb = editorUiStore.getState().commandBar;
    expect(cb.activePrompt).toBe('Specify base point');
    expect(cb.subOptions).toHaveLength(1);
    expect(cb.defaultValue).toBe('0');
    expect(cb.inputBuffer).toBe('');
  });
});

// M1.3d Phase 1 — overlay slice extensions + crosshairSizePct.
describe('editorUiStore — M1.3d overlay extensions', () => {
  afterEach(() => resetEditorUiStoreForTests());

  it('overlay defaults are all null/empty', () => {
    const o = editorUiStore.getState().overlay;
    expect(o.cursor).toBeNull();
    expect(o.snapTarget).toBeNull();
    expect(o.previewShape).toBeNull();
    expect(o.hoverEntity).toBeNull();
    expect(o.transientLabels).toEqual([]);
    expect(o.grips).toBeNull();
    expect(o.suppressEntityPaint).toBeNull();
    // Existing fields retained.
    expect(o.guides).toEqual([]);
    expect(o.selectionHandles).toEqual([]);
  });

  it('setCursor stores metric + screen and clears via null', () => {
    editorUiActions.setCursor({ metric: { x: 1.5, y: -2.5 }, screen: { x: 100, y: 200 } });
    const o1 = editorUiStore.getState().overlay;
    expect(o1.cursor).toEqual({ metric: { x: 1.5, y: -2.5 }, screen: { x: 100, y: 200 } });

    editorUiActions.setCursor(null);
    expect(editorUiStore.getState().overlay.cursor).toBeNull();
  });

  it('setPreviewShape stores a discriminated union arm', () => {
    editorUiActions.setPreviewShape({
      kind: 'line',
      p1: { x: 0, y: 0 },
      cursor: { x: 5, y: 5 },
    });
    const ps = editorUiStore.getState().overlay.previewShape;
    expect(ps?.kind).toBe('line');

    editorUiActions.setPreviewShape(null);
    expect(editorUiStore.getState().overlay.previewShape).toBeNull();
  });

  it('setSnapTarget accepts a SnapHit-shaped target and clears via null', () => {
    editorUiActions.setSnapTarget({ kind: 'endpoint', point: { x: 10, y: 0 } });
    const t = editorUiStore.getState().overlay.snapTarget;
    expect(t).toEqual({ kind: 'endpoint', point: { x: 10, y: 0 } });

    editorUiActions.setSnapTarget(null);
    expect(editorUiStore.getState().overlay.snapTarget).toBeNull();
  });

  it('setHoverEntity stores an id and clears via null', () => {
    const id = newPrimitiveId();
    editorUiActions.setHoverEntity(id);
    expect(editorUiStore.getState().overlay.hoverEntity).toBe(id);
    editorUiActions.setHoverEntity(null);
    expect(editorUiStore.getState().overlay.hoverEntity).toBeNull();
  });

  it('setTransientLabels replaces the labels array', () => {
    editorUiActions.setTransientLabels([{ anchor: { metric: { x: 1, y: 2 } }, text: '5.000 m' }]);
    expect(editorUiStore.getState().overlay.transientLabels).toHaveLength(1);
    editorUiActions.setTransientLabels([]);
    expect(editorUiStore.getState().overlay.transientLabels).toEqual([]);
  });

  it('setGrips stores grip records and clears via null', () => {
    const id = newPrimitiveId();
    editorUiActions.setGrips([
      { entityId: id, gripKind: 'p1', position: { x: 0, y: 0 } },
      { entityId: id, gripKind: 'p2', position: { x: 10, y: 0 } },
    ]);
    expect(editorUiStore.getState().overlay.grips).toHaveLength(2);
    editorUiActions.setGrips(null);
    expect(editorUiStore.getState().overlay.grips).toBeNull();
  });

  it('setSuppressEntityPaint stores an id and clears via null', () => {
    const id = newPrimitiveId();
    editorUiActions.setSuppressEntityPaint(id);
    expect(editorUiStore.getState().overlay.suppressEntityPaint).toBe(id);
    editorUiActions.setSuppressEntityPaint(null);
    expect(editorUiStore.getState().overlay.suppressEntityPaint).toBeNull();
  });

  // M1.3d-Remediation-2 R7 — overlay.hoveredGrip.

  it('R7: overlay.hoveredGrip default is null', () => {
    const o = editorUiStore.getState().overlay;
    expect(o.hoveredGrip).toBeNull();
  });

  it('R7: setHoveredGrip stores and clears via null', () => {
    const id = newPrimitiveId();
    editorUiActions.setHoveredGrip({ entityId: id, gripKind: 'p1' });
    expect(editorUiStore.getState().overlay.hoveredGrip).toEqual({
      entityId: id,
      gripKind: 'p1',
    });
    editorUiActions.setHoveredGrip(null);
    expect(editorUiStore.getState().overlay.hoveredGrip).toBeNull();
  });

  it('individual setters do not disturb sibling overlay fields', () => {
    const id = newPrimitiveId();
    editorUiActions.setHoverEntity(id);
    editorUiActions.setCursor({ metric: { x: 0, y: 0 }, screen: { x: 0, y: 0 } });
    const o = editorUiStore.getState().overlay;
    expect(o.hoverEntity).toBe(id);
    expect(o.cursor).not.toBeNull();
    expect(o.previewShape).toBeNull();
    expect(o.transientLabels).toEqual([]);
  });
});

describe('editorUiStore — viewport.crosshairSizePct (I-DTP-3 / I-DTP-18)', () => {
  afterEach(() => resetEditorUiStoreForTests());

  it('default crosshairSizePct is 100 (full-canvas, AutoCAD default)', () => {
    expect(editorUiStore.getState().viewport.crosshairSizePct).toBe(100);
  });

  it('setCrosshairSizePct stores in-range values verbatim', () => {
    editorUiActions.setCrosshairSizePct(5);
    expect(editorUiStore.getState().viewport.crosshairSizePct).toBe(5);
    editorUiActions.setCrosshairSizePct(50.5);
    expect(editorUiStore.getState().viewport.crosshairSizePct).toBe(50.5);
    editorUiActions.setCrosshairSizePct(0);
    expect(editorUiStore.getState().viewport.crosshairSizePct).toBe(0);
    editorUiActions.setCrosshairSizePct(100);
    expect(editorUiStore.getState().viewport.crosshairSizePct).toBe(100);
  });

  it('setCrosshairSizePct clamps below 0 to 0', () => {
    editorUiActions.setCrosshairSizePct(-25);
    expect(editorUiStore.getState().viewport.crosshairSizePct).toBe(0);
  });

  it('setCrosshairSizePct clamps above 100 to 100', () => {
    editorUiActions.setCrosshairSizePct(150);
    expect(editorUiStore.getState().viewport.crosshairSizePct).toBe(100);
  });
});
