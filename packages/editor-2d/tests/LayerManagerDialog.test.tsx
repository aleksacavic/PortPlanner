import { LayerId, type Project, defaultLayer, newProjectId } from '@portplanner/domain';
import { createNewProject, resetProjectStoreForTests } from '@portplanner/project-store';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LayerManagerDialog } from '../src/chrome/LayerManagerDialog';
import { resetEditorUiStoreForTests } from '../src/ui-state/store';

function makeProject(): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.2.0',
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

describe('LayerManagerDialog', () => {
  it('renders the default layer with disabled rename + delete (I-56)', () => {
    const { container } = render(<LayerManagerDialog />);
    const nameInput = container.querySelector(
      '[data-component="layer-name-input"]',
    ) as HTMLInputElement;
    const deleteBtn = container.querySelector(
      '[data-component="layer-delete-button"]',
    ) as HTMLButtonElement;
    expect(nameInput).toBeTruthy();
    expect(nameInput.disabled).toBe(true);
    expect(deleteBtn.disabled).toBe(true);
  });

  it('clicking + New layer adds a new row', () => {
    const { container } = render(<LayerManagerDialog />);
    const before = container.querySelectorAll('[data-component="layer-name-input"]').length;
    fireEvent.click(container.querySelector('[data-component="layer-create-button"]')!);
    const after = container.querySelectorAll('[data-component="layer-name-input"]').length;
    expect(after).toBe(before + 1);
  });
});
