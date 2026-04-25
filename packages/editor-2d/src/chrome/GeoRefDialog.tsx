// Geo-ref dialog placeholder per A6. M1.3a does NOT block drafting on
// geodetic anchor; this dialog is purely informational with a "Set
// later" button. Real basemap / GIS workflows arrive post-M1.

import type { ReactElement } from 'react';

import styles from './GeoRefDialog.module.css';

export interface GeoRefDialogProps {
  onClose: () => void;
}

export function GeoRefDialog({ onClose }: GeoRefDialogProps): ReactElement {
  return (
    <div className={styles.dialog} role="dialog" data-component="georef-dialog">
      <h3>Project geo-reference</h3>
      <p className={styles.body}>
        This project is currently <strong>not geo-referenced</strong>. Drafting works fully without
        a geodetic anchor — coordinates are project-local metric. The anchor is only needed when you
        later add a satellite basemap, import a GIS file, or export a geo-referenced format.
      </p>
      <button
        type="button"
        className={styles.button}
        onClick={onClose}
        data-component="georef-set-later"
      >
        Set later
      </button>
    </div>
  );
}
