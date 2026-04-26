// Draw arc by 3 points (start, mid, end). Computes the unique circle
// through them, derives center / radius / start+end angles.

import { LayerId, type Point2D, newPrimitiveId } from '@portplanner/domain';
import { addPrimitive } from '@portplanner/project-store';

import { editorUiStore } from '../../ui-state/store';
import type { ToolGenerator } from '../types';

function circumcircle(
  a: Point2D,
  b: Point2D,
  c: Point2D,
): {
  cx: number;
  cy: number;
  r: number;
} | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) return null;
  const ax2 = a.x * a.x + a.y * a.y;
  const bx2 = b.x * b.x + b.y * b.y;
  const cx2 = c.x * c.x + c.y * c.y;
  const cx = (ax2 * (b.y - c.y) + bx2 * (c.y - a.y) + cx2 * (a.y - b.y)) / d;
  const cy = (ax2 * (c.x - b.x) + bx2 * (a.x - c.x) + cx2 * (b.x - a.x)) / d;
  const r = Math.hypot(a.x - cx, a.y - cy);
  return { cx, cy, r };
}

export async function* drawArcTool(): ToolGenerator {
  const start = yield { text: 'Specify start point', acceptedInputKinds: ['point'] };
  if (start.kind !== 'point') return { committed: false, reason: 'aborted' };
  const mid = yield { text: 'Specify mid point', acceptedInputKinds: ['point'] };
  if (mid.kind !== 'point') return { committed: false, reason: 'aborted' };
  const end = yield { text: 'Specify end point', acceptedInputKinds: ['point'] };
  if (end.kind !== 'point') return { committed: false, reason: 'aborted' };

  const cc = circumcircle(start.point, mid.point, end.point);
  if (!cc) return { committed: false, reason: 'aborted' };

  const startAngle = Math.atan2(start.point.y - cc.cy, start.point.x - cc.cx);
  const endAngle = Math.atan2(end.point.y - cc.cy, end.point.x - cc.cx);
  // Normalize so endAngle > startAngle (CCW sweep).
  const s = startAngle;
  let e = endAngle;
  while (e < s) e += Math.PI * 2;

  const layerId = editorUiStore.getState().activeLayerId ?? LayerId.DEFAULT;
  addPrimitive({
    id: newPrimitiveId(),
    kind: 'arc',
    layerId,
    displayOverrides: {},
    center: { x: cc.cx, y: cc.cy },
    radius: cc.r,
    startAngle: s,
    endAngle: e,
  });
  return { committed: true, description: 'arc (3-point)' };
}
