// Draw circle by center + radius (default) or 2-point diameter
// (sub-option, M1.3a stub — radius via second click).

import { LayerId, newPrimitiveId } from '@portplanner/domain';
import { addPrimitive } from '@portplanner/project-store';

import { editorUiStore } from '../../ui-state/store';
import type { ToolGenerator } from '../types';

export async function* drawCircleTool(): ToolGenerator {
  const center = yield { text: 'Specify center', acceptedInputKinds: ['point'] };
  if (center.kind !== 'point') return { committed: false, reason: 'aborted' };
  const edge = yield { text: 'Specify radius (point on circle)', acceptedInputKinds: ['point'] };
  if (edge.kind !== 'point') return { committed: false, reason: 'aborted' };

  const radius = Math.hypot(edge.point.x - center.point.x, edge.point.y - center.point.y);
  if (radius === 0) return { committed: false, reason: 'aborted' };

  const layerId = editorUiStore.getState().activeLayerId ?? LayerId.DEFAULT;
  addPrimitive({
    id: newPrimitiveId(),
    kind: 'circle',
    layerId,
    displayOverrides: {},
    center: center.point,
    radius,
  });
  return { committed: true, description: 'circle' };
}
