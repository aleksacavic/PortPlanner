// StatusBarCoordReadout — live cursor metric coordinates for the
// status-bar (M1.3d Phase 8).
//
// Reads `editorUiStore.overlay.cursor` via the existing useEditorUi
// selector. When cursor is null (no mousemove yet OR cursor off
// canvas), renders the placeholder `X: —  Y: —`. Format is fixed-3-
// decimal metric. M1.3d does not add a unit-system layer; that lands
// with M1.3c when dimensions introduce one (the readout will switch
// from the hard-coded `m` suffix to whatever the dimension system
// declares).

import type { ReactElement } from 'react';

import styles from './StatusBarCoordReadout.module.css';
import { useEditorUi } from './use-editor-ui-store';

export function StatusBarCoordReadout(): ReactElement {
  const cursor = useEditorUi((s) => s.overlay.cursor);
  const c = cursor?.metric;
  const text = c ? `X: ${c.x.toFixed(3)}  Y: ${c.y.toFixed(3)}` : 'X: —  Y: —';
  return (
    <span className={styles.coordReadout} data-component="coord-readout">
      {text}
    </span>
  );
}
