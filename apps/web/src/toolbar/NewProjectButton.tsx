// M1.2 Phase 5 — "New" toolbar button. If a dirty project exists,
// routes through ConfirmDialog first; otherwise opens NewProjectDialog.

import { useIsDirty, useProject } from '@portplanner/project-store-react';
import { useState } from 'react';

import { ConfirmDialog } from '../dialogs/ConfirmDialog';
import { NewProjectDialog } from '../dialogs/NewProjectDialog';
import styles from './NewProjectButton.module.css';

export function NewProjectButton() {
  const project = useProject();
  const dirty = useIsDirty();
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function handleClick() {
    if (project !== null && dirty) {
      setShowConfirm(true);
    } else {
      setShowNew(true);
    }
  }

  function handleConfirmDiscard() {
    setShowConfirm(false);
    setShowNew(true);
  }

  return (
    <>
      <button type="button" className={styles.button} onClick={handleClick}>
        New
      </button>
      <NewProjectDialog open={showNew} onClose={() => setShowNew(false)} />
      <ConfirmDialog
        open={showConfirm}
        title="Discard unsaved changes?"
        message="You have unsaved changes. Creating a new project will discard them."
        confirmLabel="Discard"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDiscard}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
