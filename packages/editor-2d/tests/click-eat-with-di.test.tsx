// M1.3 Round 6 — click-eat with DI buffer non-empty unit tests per
// plan §11 + Gate REM6-P1-ClickEat. Replaces the Rev-2 helper-name-
// coupled grep gate with semantic-outcome assertions.
//
// 3 tests, one per actual click-eat handler (Rev-6 D5 corrected names):
//   - handleCanvasClick (line 389): canvas left-click commit path.
//   - handleGripDown (line 533): grip click-down (auto-start grip-stretch).
//   - handleSelectRectStart (line 560): canvas left-mousedown when no
//     tool active (auto-start select-rect).
//
// Locked deterministic two-tier gate per Rev-4 Q2 + Rev-5 Q2:
//   Primary (MUST pass): projectStore.entities.size unchanged AND
//                        projectStore.temporal.pastStates.length unchanged.
//   Secondary (MUST pass): overlay.preview unchanged.
//   (Rev-5 Q2 dropped fragile tertiary "no console.error".)

import {
  LayerId,
  type Project,
  defaultLayer,
  newPrimitiveId,
  newProjectId,
} from '@portplanner/domain';
import {
  createNewProject,
  projectStore,
  resetProjectStoreForTests,
} from '@portplanner/project-store';
import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EditorRoot } from '../src/EditorRoot';
import {
  type Grip,
  editorUiActions,
  editorUiStore,
  resetEditorUiStoreForTests,
} from '../src/ui-state/store';

function makeProject(): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.2.0',
    name: 'Smoke',
    createdAt: '2026-04-25T10:00:00.000Z',
    updatedAt: '2026-04-25T10:00:00.000Z',
    coordinateSystem: null,
    objects: {},
    primitives: {},
    layers: { [LayerId.DEFAULT]: defaultLayer() },
    grids: {},
    scenarioId: null,
  };
}

function getCanvasOrThrow(container: HTMLElement): HTMLCanvasElement {
  const canvas = container.querySelector<HTMLCanvasElement>('[data-component="canvas-host"]');
  if (!canvas) throw new Error('canvas-host not in DOM');
  canvas.getBoundingClientRect = (): DOMRect => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  });
  return canvas;
}

beforeEach(() => {
  resetProjectStoreForTests();
  resetEditorUiStoreForTests();
});
afterEach(() => {
  resetProjectStoreForTests();
  resetEditorUiStoreForTests();
});

/**
 * Set DI to a multi-field manifest with non-empty buffers (5 in field 0).
 * `inputBuffer` stays empty — proves the click-eat extension catches
 * the DI-only path that the legacy `inputBuffer.length > 0` check misses.
 */
function setupDIBufferNonEmpty(): void {
  editorUiActions.setDynamicInputManifest({
    fields: [
      { kind: 'distance', label: 'D' },
      { kind: 'angle', label: 'A' },
    ],
    combineAs: 'point',
  });
  editorUiActions.setDynamicInputFieldBuffer(0, '5');
  // inputBuffer remains '' (not set).
}

interface Snapshot {
  entityCount: number;
  temporalStackLength: number;
  preview: unknown;
}

function snap(): Snapshot {
  return {
    entityCount: Object.keys(projectStore.getState().project!.primitives).length,
    temporalStackLength: projectStore.temporal.getState().pastStates.length,
    preview: editorUiStore.getState().overlay.previewShape,
  };
}

describe('click-eat with DI buffer non-empty (multi-field DI parity) — REM6-P1-ClickEat', () => {
  it('handleCanvasClick: canvas click does NOT commit geometry when DI buffer non-empty', () => {
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);
    setupDIBufferNonEmpty();
    const before = snap();
    // Fire a canvas click event (the M1.3d Phase 22 wiring routes
    // mousedown→handleCanvasClick when no tool is active; for click-eat
    // we just assert no geometry committed AND no zundo frame pushed).
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    fireEvent.mouseUp(canvas, { button: 0, clientX: 400, clientY: 300 });
    fireEvent.click(canvas, { button: 0, clientX: 400, clientY: 300 });
    const after = snap();
    // Primary: no entity created + no zundo frame pushed.
    expect(after.entityCount).toBe(before.entityCount);
    expect(after.temporalStackLength).toBe(before.temporalStackLength);
    // Secondary: overlay.previewShape unchanged.
    expect(after.preview).toBe(before.preview);
  });

  it('handleGripDown: grip click-down does NOT auto-start grip-stretch when DI buffer non-empty', () => {
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);
    // Seed a grip in overlay.grips so the canvas-host's grip-hit-test
    // would fire handleGripDown (in the absence of click-eat).
    const grip: Grip = {
      entityId: newPrimitiveId(),
      gripKind: 'p1',
      position: { x: 0, y: 0 },
    };
    editorUiActions.setGrips([grip]);
    setupDIBufferNonEmpty();
    const before = snap();
    // Fire a mousedown over the grip's screen position. Without click-eat,
    // handleGripDown would either feed the grip's position into the running
    // tool OR auto-start grip-stretch (no tool active in this test).
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    fireEvent.mouseUp(canvas, { button: 0, clientX: 400, clientY: 300 });
    const after = snap();
    expect(after.entityCount).toBe(before.entityCount);
    expect(after.temporalStackLength).toBe(before.temporalStackLength);
    expect(after.preview).toBe(before.preview);
    // No active tool spawned (grip-stretch was suppressed).
    expect(editorUiStore.getState().activeToolId).toBeNull();
  });

  it('handleSelectRectStart: left-mousedown does NOT auto-start select-rect when DI buffer non-empty', () => {
    const { container } = render(<EditorRoot />);
    createNewProject(makeProject());
    const canvas = getCanvasOrThrow(container);
    setupDIBufferNonEmpty();
    const before = snap();
    // Fire mousedown when no tool is active. Without click-eat, this
    // would auto-start select-rect.
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    fireEvent.mouseUp(canvas, { button: 0, clientX: 400, clientY: 300 });
    const after = snap();
    expect(after.entityCount).toBe(before.entityCount);
    expect(after.temporalStackLength).toBe(before.temporalStackLength);
    expect(after.preview).toBe(before.preview);
    // No active tool spawned (select-rect was suppressed).
    expect(editorUiStore.getState().activeToolId).toBeNull();
  });
});
