import { useProject } from '@portplanner/project-store-react';
import { type MouseEvent, type ReactElement, useState } from 'react';

import { editorUiActions } from '../ui-state/store';
import { GeoRefDialog } from './GeoRefDialog';
import styles from './StatusBarGeoRefChip.module.css';

export function StatusBarGeoRefChip(): ReactElement {
  const project = useProject();
  const [open, setOpen] = useState(false);
  const isGeoref = project?.coordinateSystem != null;

  const handleClick = (e: MouseEvent): void => {
    e.preventDefault();
    setOpen(true);
    editorUiActions.pushFocusAndSet('dialog');
  };
  const handleClose = (): void => {
    setOpen(false);
    editorUiActions.popFocus();
  };

  return (
    <>
      <span
        className={styles.chip}
        onClick={handleClick}
        role="button"
        data-component="georef-chip"
      >
        {isGeoref ? 'Geo-referenced' : 'Not geo-referenced'}
      </span>
      {open ? <GeoRefDialog onClose={handleClose} /> : null}
    </>
  );
}
