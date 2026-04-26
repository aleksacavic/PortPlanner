import { EditorRoot } from '@portplanner/editor-2d';

import styles from './CanvasArea.module.css';

export function CanvasArea() {
  return (
    <div className={styles.canvasArea} aria-label="2D drafting canvas">
      <EditorRoot />
    </div>
  );
}
