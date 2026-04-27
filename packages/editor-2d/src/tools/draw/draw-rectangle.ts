// Draw rectangle by two opposite corners. localAxisAngle = 0 in M1.3a;
// rotated rectangles via post-creation Rotate (M1.3b).
//
// M1.3d-Remediation-3:
//  - F2: holding Shift while picking the second corner forces a square
//        (preview AND commit consistent — both read modifiers.shift via
//        editorUiStore.getState() at evaluation time).
//  - F3: typing `D` (or clicking the [Dimensions] sub-option) at the
//        second prompt switches to typed Width / Height numeric prompts;
//        rectangle commits with the entered dimensions extending right /
//        up from the first corner.

import { LayerId, type Point2D, newPrimitiveId } from '@portplanner/domain';
import { addPrimitive } from '@portplanner/project-store';

import { editorUiStore } from '../../ui-state/store';
import type { ToolGenerator } from '../types';

function squareCorner(corner1: Point2D, cursor: Point2D): Point2D {
  const dx = cursor.x - corner1.x;
  const dy = cursor.y - corner1.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  const sx = dx >= 0 ? 1 : -1;
  const sy = dy >= 0 ? 1 : -1;
  return { x: corner1.x + sx * side, y: corner1.y + sy * side };
}

export async function* drawRectangleTool(): ToolGenerator {
  const c0 = yield { text: 'Specify first corner', acceptedInputKinds: ['point'] };
  if (c0.kind !== 'point') return { committed: false, reason: 'aborted' };
  const corner1 = c0.point;
  const c1 = yield {
    text: 'Specify opposite corner or [Dimensions]',
    subOptions: [{ label: 'Dimensions', shortcut: 'd' }],
    acceptedInputKinds: ['point', 'subOption'],
    previewBuilder: (cursor) => {
      const shift = editorUiStore.getState().modifiers.shift;
      const effectiveCursor = shift ? squareCorner(corner1, cursor) : cursor;
      return { kind: 'rectangle', corner1, cursor: effectiveCursor };
    },
  };

  // F3: Dimensions sub-option — switch to typed W/H prompts.
  if (c1.kind === 'subOption' && c1.optionLabel === 'Dimensions') {
    const w = yield { text: 'Specify width', acceptedInputKinds: ['number'] };
    if (w.kind !== 'number') return { committed: false, reason: 'aborted' };
    const h = yield { text: 'Specify height', acceptedInputKinds: ['number'] };
    if (h.kind !== 'number') return { committed: false, reason: 'aborted' };
    const width = Math.abs(w.value);
    const height = Math.abs(h.value);
    if (width === 0 || height === 0) return { committed: false, reason: 'aborted' };

    const layerId = editorUiStore.getState().activeLayerId ?? LayerId.DEFAULT;
    addPrimitive({
      id: newPrimitiveId(),
      kind: 'rectangle',
      layerId,
      displayOverrides: {},
      origin: corner1,
      width,
      height,
      localAxisAngle: 0,
    });
    return { committed: true, description: 'rectangle (typed dimensions)' };
  }

  if (c1.kind !== 'point') return { committed: false, reason: 'aborted' };

  // F2: if shift was held at click time, snap to square.
  const shiftAtCommit = editorUiStore.getState().modifiers.shift;
  const second = shiftAtCommit ? squareCorner(corner1, c1.point) : c1.point;

  const minX = Math.min(c0.point.x, second.x);
  const minY = Math.min(c0.point.y, second.y);
  const width = Math.abs(second.x - c0.point.x);
  const height = Math.abs(second.y - c0.point.y);
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
