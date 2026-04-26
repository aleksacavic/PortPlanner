import { LayerId, newLayerId } from '@portplanner/domain';
import { addLayer, deleteLayer, updateLayer } from '@portplanner/project-store';
import { useLayers } from '@portplanner/project-store-react';
import type { ReactElement } from 'react';

import styles from './LayerManagerDialog.module.css';

export function LayerManagerDialog(): ReactElement {
  const layers = useLayers();
  const layerArr = Object.values(layers).sort((a, b) => a.name.localeCompare(b.name));

  const handleCreate = (): void => {
    addLayer({
      id: newLayerId(),
      name: `Layer-${Object.keys(layers).length}`,
      color: '#CCCCCC',
      lineType: 'continuous',
      lineWeight: 0.25,
      visible: true,
      frozen: false,
      locked: false,
    });
  };

  return (
    <div className={styles.dialog} data-component="layer-manager-dialog">
      <div className={`${styles.row} ${styles.headerRow}`}>
        <span>Name</span>
        <span>Color</span>
        <span>Visible</span>
        <span>Frozen</span>
        <span>Locked</span>
        <span>Delete</span>
      </div>
      {layerArr.map((layer) => {
        const isDefault = layer.id === LayerId.DEFAULT;
        return (
          <div key={layer.id} className={styles.row}>
            <input
              defaultValue={layer.name}
              disabled={isDefault}
              onBlur={(e) => updateLayer(layer.id, { name: e.target.value })}
              data-component="layer-name-input"
            />
            <input
              type="color"
              value={layer.color}
              onChange={(e) => updateLayer(layer.id, { color: e.target.value })}
            />
            <input
              type="checkbox"
              checked={layer.visible}
              onChange={(e) => updateLayer(layer.id, { visible: e.target.checked })}
            />
            <input
              type="checkbox"
              checked={layer.frozen}
              onChange={(e) => updateLayer(layer.id, { frozen: e.target.checked })}
            />
            <input
              type="checkbox"
              checked={layer.locked}
              onChange={(e) => updateLayer(layer.id, { locked: e.target.checked })}
            />
            <button
              type="button"
              className={styles.button}
              disabled={isDefault}
              onClick={() => {
                try {
                  deleteLayer(layer.id);
                } catch {
                  // Throws on default layer (LayerId.DEFAULT) per I-13 + I-56;
                  // Throws on layers with referencing entities (no reassign target prompted yet — M1.3b enhancement).
                }
              }}
              data-component="layer-delete-button"
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className={styles.button}
        onClick={handleCreate}
        data-component="layer-create-button"
        style={{ marginTop: 8 }}
      >
        + New layer
      </button>
    </div>
  );
}
