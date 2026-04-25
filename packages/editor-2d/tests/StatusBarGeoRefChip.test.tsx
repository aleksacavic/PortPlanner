import { LayerId, type Project, defaultLayer, newProjectId } from '@portplanner/domain';
import { createNewProject, resetProjectStoreForTests } from '@portplanner/project-store';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StatusBarGeoRefChip } from '../src/chrome/StatusBarGeoRefChip';
import { editorUiStore, resetEditorUiStoreForTests } from '../src/ui-state/store';

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

describe('StatusBarGeoRefChip', () => {
  it('renders "Not geo-referenced" when coordinateSystem is null', () => {
    const { getByText } = render(<StatusBarGeoRefChip />);
    expect(getByText('Not geo-referenced')).toBeTruthy();
  });

  it('clicking the chip transitions ui-state focus to dialog (I-57 — drafting unblocked when null)', async () => {
    const { getByText } = render(<StatusBarGeoRefChip />);
    expect(editorUiStore.getState().focusHolder).toBe('canvas');
    fireEvent.click(getByText('Not geo-referenced'));
    await waitFor(() => {
      expect(editorUiStore.getState().focusHolder).toBe('dialog');
    });
  });
});
