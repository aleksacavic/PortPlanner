import { StatusBarGeoRefChip } from '@portplanner/editor-2d';
import { useIsDirty, useLastSavedAt, useProject } from '@portplanner/project-store-react';

import styles from './StatusBar.module.css';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function StatusBar() {
  const project = useProject();
  const dirty = useIsDirty();
  const lastSavedAt = useLastSavedAt();

  let leftClass = styles.left;
  let leftContent = 'No project';
  if (project !== null) {
    if (dirty) {
      leftClass = `${styles.left} ${styles.dirty}`;
      leftContent = `${project.name} · Unsaved changes`;
    } else if (lastSavedAt !== null) {
      leftClass = `${styles.left} ${styles.clean}`;
      leftContent = `${project.name} · Saved ${formatTime(lastSavedAt)}`;
    } else {
      leftContent = project.name;
    }
  }

  return (
    <footer className={styles.statusBar}>
      <div className={leftClass}>{leftContent}</div>
      <div className={styles.right}>
        {project !== null ? <StatusBarGeoRefChip /> : null}
        <span style={{ marginLeft: 8 }}>v0.1.0</span>
      </div>
    </footer>
  );
}
