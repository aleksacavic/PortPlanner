import {
  LayerId,
  type Project,
  defaultLayer,
  newPrimitiveId,
  newProjectId,
} from '@portplanner/domain';
import {
  addLayer,
  addPrimitive,
  createNewProject,
  resetProjectStoreForTests,
} from '@portplanner/project-store';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PropertiesPanel } from '../src/chrome/PropertiesPanel';
import { editorUiActions, resetEditorUiStoreForTests } from '../src/ui-state/store';

function makeProject(): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.1.0',
    name: 'T',
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

beforeEach(() => createNewProject(makeProject()));
afterEach(() => {
  cleanup();
  resetProjectStoreForTests();
  resetEditorUiStoreForTests();
});

describe('PropertiesPanel', () => {
  it('renders placeholder when no selection', () => {
    const { getByText } = render(<PropertiesPanel />);
    expect(getByText('Nothing selected.')).toBeTruthy();
  });

  it('renders multi-select placeholder when more than one entity selected', () => {
    const id1 = newPrimitiveId();
    const id2 = newPrimitiveId();
    addPrimitive({
      id: id1,
      kind: 'point',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      position: { x: 0, y: 0 },
    });
    addPrimitive({
      id: id2,
      kind: 'point',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      position: { x: 10, y: 0 },
    });
    editorUiActions.setSelection([id1, id2]);
    const { getByText } = render(<PropertiesPanel />);
    expect(getByText('2 entities selected.')).toBeTruthy();
  });

  it('renders single-entity properties + layer dropdown sourced from useLayers (I-55)', () => {
    addLayer({
      id: 'aux-layer' as never,
      name: 'Aux',
      color: '#FF0000',
      lineType: 'continuous',
      lineWeight: 0.25,
      visible: true,
      frozen: false,
      locked: false,
    });
    const id = newPrimitiveId();
    addPrimitive({
      id,
      kind: 'circle',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      center: { x: 0, y: 0 },
      radius: 5,
    });
    editorUiActions.setSelection([id]);
    const { container } = render(<PropertiesPanel />);
    const select = container.querySelector('[data-component="properties-layer-select"]') as HTMLSelectElement;
    expect(select).toBeTruthy();
    const optionLabels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionLabels).toContain('0'); // default
    expect(optionLabels).toContain('Aux');
  });
});
