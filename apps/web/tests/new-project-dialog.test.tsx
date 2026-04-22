import { ThemeProvider } from '@portplanner/design-system';
import { projectStore, resetProjectStoreForTests } from '@portplanner/project-store';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { NewProjectDialog } from '../src/dialogs/NewProjectDialog';

function renderDialog(open = true, onClose = () => {}) {
  return render(
    <ThemeProvider mode="dark">
      <NewProjectDialog open={open} onClose={onClose} />
    </ThemeProvider>,
  );
}

describe('<NewProjectDialog />', () => {
  beforeEach(() => {
    resetProjectStoreForTests();
  });

  it('renders nothing when closed', () => {
    const { container } = renderDialog(false);
    expect(container.textContent).toBe('');
  });

  it('submits a valid name and populates the store with dirty=true', () => {
    let closed = false;
    const { getByLabelText, getByText } = renderDialog(true, () => {
      closed = true;
    });
    fireEvent.change(getByLabelText('Project name'), { target: { value: 'Test Port' } });
    fireEvent.click(getByText('Create'));

    const state = projectStore.getState();
    expect(state.project?.name).toBe('Test Port');
    expect(state.dirty).toBe(true);
    expect(state.lastSavedAt).toBeNull();
    expect(closed).toBe(true);
  });

  it('rejects an empty name without mutating the store', () => {
    const { getByLabelText, getByText, getByRole } = renderDialog(true);
    fireEvent.change(getByLabelText('Project name'), { target: { value: '   ' } });
    fireEvent.submit(getByRole('dialog').querySelector('form') as HTMLFormElement);
    expect(getByText(/1–100 characters/)).toBeDefined();
    expect(projectStore.getState().project).toBeNull();
  });
});
