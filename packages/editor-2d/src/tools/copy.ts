import type { Point2D, Primitive, PrimitiveId } from '@portplanner/domain';
import { newPrimitiveId } from '@portplanner/domain';
import { addPrimitive, projectStore } from '@portplanner/project-store';

import { editorUiStore } from '../ui-state/store';
import type { ToolGenerator } from './types';

function shiftedClone(p: Primitive, dx: number, dy: number): Primitive {
  const id = newPrimitiveId();
  switch (p.kind) {
    case 'point':
      return { ...p, id, position: { x: p.position.x + dx, y: p.position.y + dy } };
    case 'line':
      return {
        ...p,
        id,
        p1: { x: p.p1.x + dx, y: p.p1.y + dy },
        p2: { x: p.p2.x + dx, y: p.p2.y + dy },
      };
    case 'polyline':
      return { ...p, id, vertices: p.vertices.map((v) => ({ x: v.x + dx, y: v.y + dy })) };
    case 'rectangle':
      return { ...p, id, origin: { x: p.origin.x + dx, y: p.origin.y + dy } };
    case 'circle':
    case 'arc':
      return { ...p, id, center: { x: p.center.x + dx, y: p.center.y + dy } };
    case 'xline':
      return { ...p, id, pivot: { x: p.pivot.x + dx, y: p.pivot.y + dy } };
  }
}

export async function* copyTool(): ToolGenerator {
  let selection = editorUiStore.getState().selection;
  if (selection.length === 0) {
    const sel = yield { text: 'Select objects', acceptedInputKinds: ['entity'] };
    if (sel.kind !== 'entity') return { committed: false, reason: 'aborted' };
    selection = [sel.entityId as PrimitiveId];
  }
  const baseInput = yield { text: 'Specify base point', acceptedInputKinds: ['point'] };
  if (baseInput.kind !== 'point') return { committed: false, reason: 'aborted' };
  const targetInput = yield { text: 'Specify second point', acceptedInputKinds: ['point'] };
  if (targetInput.kind !== 'point') return { committed: false, reason: 'aborted' };

  const base = baseInput.point;
  const target = targetInput.point as Point2D;
  const dx = target.x - base.x;
  const dy = target.y - base.y;

  const project = projectStore.getState().project;
  if (!project) return { committed: false, reason: 'aborted' };
  for (const id of selection) {
    const p = project.primitives[id];
    if (!p) continue;
    addPrimitive(shiftedClone(p, dx, dy));
  }
  return { committed: true, description: `copied ${selection.length} entity/entities` };
}
