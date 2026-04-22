// M1.2 Phase 5 — "Save" toolbar button. Disabled unless a dirty project
// is loaded. On click: saveProject() → markSaved(savedAt). The savedAt
// returned by saveProject is the timestamp that was written to
// IndexedDB; threading it into markSaved keeps in-memory
// lastSavedAt byte-identical to the persisted updatedAt (SR-2
// remediation — Codex Round 1 H1).

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
      const { savedAt } = await saveProject(project);
      markSaved(savedAt);
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
