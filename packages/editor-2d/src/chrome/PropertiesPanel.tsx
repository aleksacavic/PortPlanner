// Properties panel — read-only display + layer/displayOverrides edit.
// Multi-select shows a placeholder.

import type { LayerId, Primitive } from '@portplanner/domain';
import { updatePrimitive } from '@portplanner/project-store';
import { useLayers, usePrimitive } from '@portplanner/project-store-react';
import type { ReactElement } from 'react';

import styles from './PropertiesPanel.module.css';
import { useEditorUi } from './use-editor-ui-store';

function summarize(p: Primitive): Array<[string, string]> {
  switch (p.kind) {
    case 'point':
      return [
        ['kind', 'point'],
        ['x', p.position.x.toFixed(3)],
        ['y', p.position.y.toFixed(3)],
      ];
    case 'line':
      return [
        ['kind', 'line'],
        ['p1', `(${p.p1.x.toFixed(3)}, ${p.p1.y.toFixed(3)})`],
        ['p2', `(${p.p2.x.toFixed(3)}, ${p.p2.y.toFixed(3)})`],
      ];
    case 'polyline':
      return [
        ['kind', 'polyline'],
        ['vertices', `${p.vertices.length}`],
        ['closed', p.closed ? 'true' : 'false'],
      ];
    case 'rectangle':
      return [
        ['kind', 'rectangle'],
        ['width', p.width.toFixed(3)],
        ['height', p.height.toFixed(3)],
      ];
    case 'circle':
      return [
        ['kind', 'circle'],
        ['radius', p.radius.toFixed(3)],
      ];
    case 'arc':
      return [
        ['kind', 'arc'],
        ['radius', p.radius.toFixed(3)],
        ['span (rad)', (p.endAngle - p.startAngle).toFixed(3)],
      ];
    case 'xline':
      return [
        ['kind', 'xline'],
        ['angle (rad)', p.angle.toFixed(3)],
      ];
  }
}

export function PropertiesPanel(): ReactElement {
  const selection = useEditorUi((s) => s.selection);
  const layers = useLayers();
  const single = usePrimitive(selection[0]!);

  if (selection.length === 0) {
    return <div className={styles.placeholder}>Nothing selected.</div>;
  }
  if (selection.length > 1 || !single) {
    return <div className={styles.placeholder}>{selection.length} entities selected.</div>;
  }

  return (
    <div className={styles.panel} data-component="properties-panel">
      {summarize(single).map(([k, v]) => (
        <div key={k} className={styles.row}>
          <span className={styles.label}>{k}</span>
          <span className={styles.value}>{v}</span>
        </div>
      ))}
      <div className={styles.row}>
        <span className={styles.label}>layer</span>
        <select
          value={single.layerId}
          onChange={(e) =>
            updatePrimitive(single.id, { layerId: e.target.value as LayerId } as never)
          }
          data-component="properties-layer-select"
        >
          {Object.values(layers).map((layer) => (
            <option key={layer.id} value={layer.id}>
              {layer.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>color override</span>
        <input
          type="color"
          value={single.displayOverrides.color ?? '#FFFFFF'}
          onChange={(e) =>
            updatePrimitive(single.id, {
              displayOverrides: { ...single.displayOverrides, color: e.target.value },
            } as never)
          }
          data-component="properties-color-input"
        />
      </div>
    </div>
  );
}
