// Draw rectangle by two opposite corners. localAxisAngle = 0 in M1.3a;
// rotated rectangles via post-creation Rotate (M1.3b).

import { LayerId, newPrimitiveId } from '@portplanner/domain';
import { addPrimitive } from '@portplanner/project-store';

import { editorUiStore } from '../../ui-state/store';
import type { ToolGenerator } from '../types';

export async function* drawRectangleTool(): ToolGenerator {
  const c0 = yield { text: 'Specify first corner', acceptedInputKinds: ['point'] };
  if (c0.kind !== 'point') return { committed: false, reason: 'aborted' };
  const corner1 = c0.point;
  const c1 = yield {
    text: 'Specify opposite corner',
    acceptedInputKinds: ['point'],
    previewBuilder: (cursor) => ({ kind: 'rectangle', corner1, cursor }),
  };
  if (c1.kind !== 'point') return { committed: false, reason: 'aborted' };

  const minX = Math.min(c0.point.x, c1.point.x);
  const minY = Math.min(c0.point.y, c1.point.y);
  const width = Math.abs(c1.point.x - c0.point.x);
  const height = Math.abs(c1.point.y - c0.point.y);
  if (width === 0 || height === 0) return { committed: false, reason: 'aborted' };

  const layerId = editorUiStore.getState().activeLayerId ?? LayerId.DEFAULT;
  addPrimitive({
    id: newPrimitiveId(),
    kind: 'rectangle',
    layerId,
    displayOverrides: {},
    origin: { x: minX, y: minY },
    width,
    height,
    localAxisAngle: 0,
  });
  return { committed: true, description: 'rectangle' };
}
