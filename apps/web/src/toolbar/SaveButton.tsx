// M1.2 Phase 5 — "Save" toolbar button. Disabled unless a dirty project
// is loaded. On click: saveProject() → markSaved(). The saveProject
// return carries { savedAt } for SR-2 skew mitigation; M1.2 does not
// use it beyond the bare flow, but it is the contract callers will
// extend in later milestones.

import { markSaved } from '@portplanner/project-store';
import { useIsDirty, useProject } from '@portplanner/project-store-react';
import { useState } from 'react';

import { saveProject } from '../persistence';
import styles from './SaveButton.module.css';

export function SaveButton() {
  const project = useProject();
  const dirty = useIsDirty();
  const [busy, setBusy] = useState(false);

  const disabled = project === null || !dirty || busy;

  async function handleClick() {
    if (project === null) {
      return;
    }
    setBusy(true);
    try {
      await saveProject(project);
      markSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={styles.button} onClick={handleClick} disabled={disabled}>
      Save
    </button>
  );
}
