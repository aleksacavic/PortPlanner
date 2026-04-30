import { newPrimitiveId } from '@portplanner/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

  it('default crosshairSizePct is 5 (short pickbox, AC default per Round 7 backlog B2)', () => {
    expect(editorUiStore.getState().viewport.crosshairSizePct).toBe(5);
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

// M1.3d-Remediation-3 — slice extensions for F1 (directDistanceFrom +
// lastKnownCursor), F2 (modifiers.shift), F6 (lastToolId).
describe('editorUiStore — M1.3d-Rem-3 slice extensions', () => {
  afterEach(() => resetEditorUiStoreForTests());

  // F1 — directDistanceFrom on commandBar slice.
  it('F1: commandBar.directDistanceFrom defaults to null', () => {
    expect(editorUiStore.getState().commandBar.directDistanceFrom).toBeNull();
  });

  it('F1: setPrompt extended 5th arg writes directDistanceFrom', () => {
    editorUiActions.setPrompt('Specify end point', [], null, ['point'], { x: 3, y: 4 });
    expect(editorUiStore.getState().commandBar.directDistanceFrom).toEqual({ x: 3, y: 4 });
    // Default-omitted setPrompt resets to null (typical "next prompt has no anchor").
    editorUiActions.setPrompt('Specify base point', [], null, ['point']);
    expect(editorUiStore.getState().commandBar.directDistanceFrom).toBeNull();
  });

  // F1 — lastKnownCursor on overlay slice.
  it('F1: overlay.lastKnownCursor defaults to null', () => {
    expect(editorUiStore.getState().overlay.lastKnownCursor).toBeNull();
  });

  it('F1: setLastKnownCursor stores and is NEVER cleared by null cursor', () => {
    editorUiActions.setLastKnownCursor({ x: 1, y: 2 });
    expect(editorUiStore.getState().overlay.lastKnownCursor).toEqual({ x: 1, y: 2 });
    // setCursor(null) does NOT clear lastKnownCursor — F1 contract: it's
    // a memory of the last on-canvas cursor, used while pointer is over
    // the command bar (where overlay.cursor is null).
    editorUiActions.setCursor(null);
    expect(editorUiStore.getState().overlay.lastKnownCursor).toEqual({ x: 1, y: 2 });
  });

  // F2 — modifiers slice.
  it('F2: modifiers.shift defaults to false', () => {
    expect(editorUiStore.getState().modifiers.shift).toBe(false);
  });

  it('F2: setShift toggles the shift modifier', () => {
    editorUiActions.setShift(true);
    expect(editorUiStore.getState().modifiers.shift).toBe(true);
    editorUiActions.setShift(false);
    expect(editorUiStore.getState().modifiers.shift).toBe(false);
  });

  // F6 — lastToolId on commandBar slice.
  it('F6: commandBar.lastToolId defaults to null', () => {
    expect(editorUiStore.getState().commandBar.lastToolId).toBeNull();
  });

  it('F6: setLastToolId stores and clears via null', () => {
    editorUiActions.setLastToolId('draw-line');
    expect(editorUiStore.getState().commandBar.lastToolId).toBe('draw-line');
    editorUiActions.setLastToolId(null);
    expect(editorUiStore.getState().commandBar.lastToolId).toBeNull();
  });
});

// M1.3d-Remediation-4 G1 — accumulator slice extension. Mirror of the
// keyboard router's local accumulator string so the Dynamic Input pill
// (G2) can render the in-progress shortcut.
describe('editorUiStore — M1.3d-Rem-4 G1 accumulator', () => {
  afterEach(() => resetEditorUiStoreForTests());

  it('G1: commandBar.accumulator default is empty string', () => {
    expect(editorUiStore.getState().commandBar.accumulator).toBe('');
  });

  it('G1: setAccumulator stores and clears', () => {
    editorUiActions.setAccumulator('LA');
    expect(editorUiStore.getState().commandBar.accumulator).toBe('LA');
    editorUiActions.setAccumulator('');
    expect(editorUiStore.getState().commandBar.accumulator).toBe('');
  });
});

// M1.3 Round 6 — Dynamic Input slice extensions per plan §3 A2.1 +
// §11 substrate slice tests. commandBar.dynamicInput (manifest +
// buffers + activeFieldIdx); overlay.dimensionGuides.
describe('editorUiStore — M1.3 Round 6 Dynamic Input slice', () => {
  afterEach(() => resetEditorUiStoreForTests());

  it('commandBar.dynamicInput defaults to null', () => {
    expect(editorUiStore.getState().commandBar.dynamicInput).toBeNull();
  });

  it('overlay.dimensionGuides defaults to null', () => {
    expect(editorUiStore.getState().overlay.dimensionGuides).toBeNull();
  });

  it('setDynamicInputManifest stores manifest AND resets buffers + activeFieldIdx (Rev-1 R2-A5)', () => {
    editorUiActions.setDynamicInputManifest({
      fields: [
        { kind: 'number', label: 'W' },
        { kind: 'number', label: 'H' },
      ],
      combineAs: 'numberPair',
    });
    const di = editorUiStore.getState().commandBar.dynamicInput;
    expect(di).not.toBeNull();
    if (!di) return;
    expect(di.manifest.fields).toHaveLength(2);
    expect(di.buffers).toEqual(['', '']);
    expect(di.activeFieldIdx).toBe(0);
  });

  it('setDynamicInputFieldBuffer updates the buffer at idx', () => {
    editorUiActions.setDynamicInputManifest({
      fields: [
        { kind: 'number', label: 'W' },
        { kind: 'number', label: 'H' },
      ],
      combineAs: 'numberPair',
    });
    editorUiActions.setDynamicInputFieldBuffer(1, '4');
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers).toEqual(['', '4']);
    editorUiActions.setDynamicInputFieldBuffer(0, '6');
    expect(editorUiStore.getState().commandBar.dynamicInput?.buffers).toEqual(['6', '4']);
  });

  it('setDynamicInputActiveField cycles idx', () => {
    editorUiActions.setDynamicInputManifest({
      fields: [
        { kind: 'distance', label: 'D' },
        { kind: 'angle', label: 'A' },
      ],
      combineAs: 'point',
    });
    editorUiActions.setDynamicInputActiveField(1);
    expect(editorUiStore.getState().commandBar.dynamicInput?.activeFieldIdx).toBe(1);
    editorUiActions.setDynamicInputActiveField(0);
    expect(editorUiStore.getState().commandBar.dynamicInput?.activeFieldIdx).toBe(0);
  });

  it('clearDynamicInput resets to null', () => {
    editorUiActions.setDynamicInputManifest({
      fields: [{ kind: 'number', label: 'R' }],
      combineAs: 'number',
    });
    editorUiActions.clearDynamicInput();
    expect(editorUiStore.getState().commandBar.dynamicInput).toBeNull();
  });

  it('setDimensionGuides stores and clears via null', () => {
    editorUiActions.setDimensionGuides([
      {
        kind: 'linear-dim',
        anchorA: { x: 0, y: 0 },
        anchorB: { x: 10, y: 0 },
        offsetCssPx: 10,
      },
    ]);
    const guides = editorUiStore.getState().overlay.dimensionGuides;
    expect(guides).toHaveLength(1);
    expect(guides?.[0]?.kind).toBe('linear-dim');
    editorUiActions.setDimensionGuides(null);
    expect(editorUiStore.getState().overlay.dimensionGuides).toBeNull();
  });

  it('setDynamicInputManifest re-yield resets buffers (polyline-loop semantics — Rev-1 R2-A5)', () => {
    editorUiActions.setDynamicInputManifest({
      fields: [
        { kind: 'distance', label: 'D' },
        { kind: 'angle', label: 'A' },
      ],
      combineAs: 'point',
    });
    editorUiActions.setDynamicInputFieldBuffer(0, '5');
    editorUiActions.setDynamicInputFieldBuffer(1, '30');
    editorUiActions.setDynamicInputActiveField(1);
    // Re-publish (simulates next polyline-loop iteration).
    editorUiActions.setDynamicInputManifest({
      fields: [
        { kind: 'distance', label: 'D' },
        { kind: 'angle', label: 'A' },
      ],
      combineAs: 'point',
    });
    const di = editorUiStore.getState().commandBar.dynamicInput;
    expect(di?.buffers).toEqual(['', '']);
    expect(di?.activeFieldIdx).toBe(0);
  });
});

describe('Round 7 Phase 2 — buffer persistence slice', () => {
  beforeEach(() => {
    resetEditorUiStoreForTests();
  });

  it('lastSubmittedBuffers defaults to {}', () => {
    expect(editorUiStore.getState().commandBar.lastSubmittedBuffers).toEqual({});
  });

  it('recordSubmittedBuffers stores the array under the given promptKey', () => {
    editorUiActions.recordSubmittedBuffers('draw-line:0', ['5', '30']);
    expect(editorUiStore.getState().commandBar.lastSubmittedBuffers['draw-line:0']).toEqual([
      '5',
      '30',
    ]);
  });

  it('recordSubmittedBuffers replaces an existing entry under the same promptKey', () => {
    editorUiActions.recordSubmittedBuffers('draw-line:0', ['5', '30']);
    editorUiActions.recordSubmittedBuffers('draw-line:0', ['7', '45']);
    expect(editorUiStore.getState().commandBar.lastSubmittedBuffers['draw-line:0']).toEqual([
      '7',
      '45',
    ]);
  });

  it('recordSubmittedBuffers preserves entries under other promptKeys', () => {
    editorUiActions.recordSubmittedBuffers('draw-line:0', ['5', '30']);
    editorUiActions.recordSubmittedBuffers('draw-circle:0', ['7']);
    const map = editorUiStore.getState().commandBar.lastSubmittedBuffers;
    expect(map['draw-line:0']).toEqual(['5', '30']);
    expect(map['draw-circle:0']).toEqual(['7']);
  });

  it('reading lastSubmittedBuffers via editorUiStore.getState() returns the stored array (no helper function — A15 lock)', () => {
    editorUiActions.recordSubmittedBuffers('draw-line:0', ['5', '30']);
    const persisted = editorUiStore.getState().commandBar.lastSubmittedBuffers['draw-line:0'];
    expect(persisted).toEqual(['5', '30']);
    const missing = editorUiStore.getState().commandBar.lastSubmittedBuffers['draw-line:99'];
    expect(missing).toBeUndefined();
  });

  it('setDynamicInputManifest seeds placeholders from lastSubmittedBuffers[promptKey] when present', () => {
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
    const di = editorUiStore.getState().commandBar.dynamicInput;
    expect(di?.placeholders).toEqual(['5', '30']);
    expect(di?.buffers).toEqual(['', '']);
    expect(di?.promptKey).toBe('draw-line:0');
  });

  it('setDynamicInputManifest seeds empty placeholders when promptKey has no persisted entry', () => {
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
    const di = editorUiStore.getState().commandBar.dynamicInput;
    expect(di?.placeholders).toEqual(['', '']);
    expect(di?.promptKey).toBe('draw-line:0');
  });
});
