// M1.3b simple-transforms Phase 5 — Offset tool.
//
// Flow: select entity → "Specify offset distance" (DI: combineAs
// 'number') → "Specify point on side to offset" with live preview.
// Side determined by sign of perpendicular projection of (cursor -
// source) onto source's normal.
//
// V1 single-entity per A8 — multi-select Offset deferred. Per I-MOD-6:
// emits 'CREATE' per offset entity.

import {
  type Point2D,
  type Primitive,
  type PrimitiveId,
  newPrimitiveId,
  offsetPrimitive,
} from '@portplanner/domain';
import { addPrimitive, projectStore } from '@portplanner/project-store';

import { editorUiStore } from '../ui-state/store';
import type { ToolGenerator } from './types';

/**
 * Compute which side of the source primitive `cursor` is on.
 * Returns +1 or -1 based on the sign of the cursor's projection onto
 * the primitive's CCW normal. Per-kind rules:
 *   - line: sign of (cursor - p1) · normal where normal = CCW(p2-p1)
 *   - circle / arc: sign of (|cursor - center| - radius). Outside = +1.
 *   - rectangle: sign of grow-shrink (cursor outside bounding box → +1)
 *   - xline: sign of (cursor - pivot) · normal (CCW perp to direction)
 *   - polyline: V1 — sign of (cursor - first-vertex) · normal of first segment
 *   - point: not supported by offsetPrimitive (caller filters earlier)
 */
function computeOffsetSide(p: Primitive, cursor: Point2D): 1 | -1 {
  switch (p.kind) {
    case 'line': {
      const dx = p.p2.x - p.p1.x;
      const dy = p.p2.y - p.p1.y;
      const nx = -dy;
      const ny = dx;
      const dot = (cursor.x - p.p1.x) * nx + (cursor.y - p.p1.y) * ny;
      return dot >= 0 ? 1 : -1;
    }
    case 'circle':
    case 'arc': {
      const dist = Math.hypot(cursor.x - p.center.x, cursor.y - p.center.y);
      return dist >= p.radius ? 1 : -1;
    }
    case 'rectangle': {
      const cx = p.origin.x + p.width / 2;
      const cy = p.origin.y + p.height / 2;
      // Outside = farther from center than the half-extent
      const outside =
        Math.abs(cursor.x - cx) > p.width / 2 || Math.abs(cursor.y - cy) > p.height / 2;
      return outside ? 1 : -1;
    }
    case 'xline': {
      const cos = Math.cos(p.angle);
      const sin = Math.sin(p.angle);
      const nx = -sin;
      const ny = cos;
      const dot = (cursor.x - p.pivot.x) * nx + (cursor.y - p.pivot.y) * ny;
      return dot >= 0 ? 1 : -1;
    }
    case 'polyline': {
      const v0 = p.vertices[0];
      const v1 = p.vertices[1];
      if (!v0 || !v1) return 1; // defensive — caller filtered
      const dx = v1.x - v0.x;
      const dy = v1.y - v0.y;
      const nx = -dy;
      const ny = dx;
      const dot = (cursor.x - v0.x) * nx + (cursor.y - v0.y) * ny;
      return dot >= 0 ? 1 : -1;
    }
    case 'point':
      return 1; // unreachable — point throws in offsetPrimitive
  }
}

export async function* offsetTool(): ToolGenerator {
  // 1. Select object (single-entity per A8). If selection has exactly
  // one, skip; otherwise prompt for one entity.
  const initial = editorUiStore.getState().selection;
  let entityId: PrimitiveId;
  if (initial.length === 1) {
    entityId = initial[0]!;
  } else {
    const sel = yield {
      text: 'Select object to offset',
      acceptedInputKinds: ['entity'],
    };
    if (sel.kind !== 'entity') return { committed: false, reason: 'aborted' };
    entityId = sel.entityId as PrimitiveId;
  }

  const baseProject = projectStore.getState().project;
  if (!baseProject) return { committed: false, reason: 'aborted' };
  const source = baseProject.primitives[entityId];
  if (!source) return { committed: false, reason: 'aborted' };
  if (source.kind === 'point') return { committed: false, reason: 'aborted' };

  // 2. Specify offset distance (DI typed-number).
  const distInput = yield {
    text: 'Specify offset distance',
    acceptedInputKinds: ['number'],
    dynamicInput: { fields: [{ kind: 'distance', label: 'Distance' }], combineAs: 'number' },
  };
  if (distInput.kind !== 'number') return { committed: false, reason: 'aborted' };
  const distance = Math.abs(distInput.value);
  if (distance === 0) return { committed: false, reason: 'aborted' };

  // 3. Specify side via cursor-click; live preview shows the offset.
  const sideInput = yield {
    text: 'Specify point on side to offset',
    acceptedInputKinds: ['point'],
    previewBuilder: (cursor) => ({
      kind: 'offset-preview',
      primitive: source,
      distance,
      side: computeOffsetSide(source, cursor),
    }),
  };
  if (sideInput.kind !== 'point') return { committed: false, reason: 'aborted' };
  const side = computeOffsetSide(source, sideInput.point);

  // Commit: addPrimitive (per I-MOD-6 'CREATE'). offsetPrimitive may
  // throw on degenerate inputs (e.g., circle shrinks to ≤ 0); abort
  // gracefully if so.
  let offsetCopy: Primitive;
  try {
    offsetCopy = offsetPrimitive(source, distance, side);
  } catch {
    return { committed: false, reason: 'aborted' };
  }
  addPrimitive({ ...offsetCopy, id: newPrimitiveId() } as Primitive);
  return { committed: true, description: `offset ${source.kind} by ${distance}` };
}
