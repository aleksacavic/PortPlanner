import type { Point2D, Primitive, PrimitiveId } from '@portplanner/domain';
import { projectStore, updatePrimitive } from '@portplanner/project-store';

import { editorUiStore } from '../ui-state/store';
import type { ToolGenerator } from './types';

function shiftPrimitive(p: Primitive, dx: number, dy: number): Partial<Primitive> {
  switch (p.kind) {
    case 'point':
      return { position: { x: p.position.x + dx, y: p.position.y + dy } } as Partial<Primitive>;
    case 'line':
      return {
        p1: { x: p.p1.x + dx, y: p.p1.y + dy },
        p2: { x: p.p2.x + dx, y: p.p2.y + dy },
      } as Partial<Primitive>;
    case 'polyline':
      return {
        vertices: p.vertices.map((v) => ({ x: v.x + dx, y: v.y + dy })),
      } as Partial<Primitive>;
    case 'rectangle':
      return { origin: { x: p.origin.x + dx, y: p.origin.y + dy } } as Partial<Primitive>;
    case 'circle':
    case 'arc':
      return { center: { x: p.center.x + dx, y: p.center.y + dy } } as Partial<Primitive>;
    case 'xline':
      return { pivot: { x: p.pivot.x + dx, y: p.pivot.y + dy } } as Partial<Primitive>;
  }
}

export async function* moveTool(): ToolGenerator {
  let selection = editorUiStore.getState().selection;
  if (selection.length === 0) {
    const sel = yield { text: 'Select objects', acceptedInputKinds: ['entity'] };
    if (sel.kind !== 'entity') return { committed: false, reason: 'aborted' };
    selection = [sel.entityId as PrimitiveId];
  }
  const baseInput = yield { text: 'Specify base point', acceptedInputKinds: ['point'] };
  if (baseInput.kind !== 'point') return { committed: false, reason: 'aborted' };
  // M1.3d-Remediation-3 F4 — capture the selected primitives now for
  // the ghost preview. Snapshot at base-point-pick time so the preview
  // doesn't mutate if the project store changes mid-prompt.
  const baseProject = projectStore.getState().project;
  const ghostPrimitives: Primitive[] = baseProject
    ? selection.flatMap((id) => {
        const p = baseProject.primitives[id];
        return p ? [p] : [];
      })
    : [];
  const base = baseInput.point;
  const targetInput = yield {
    text: 'Specify second point',
    acceptedInputKinds: ['point'],
    previewBuilder: (cursor) => ({
      kind: 'modified-entities',
      primitives: ghostPrimitives,
      offsetMetric: { x: cursor.x - base.x, y: cursor.y - base.y },
    }),
  };
  if (targetInput.kind !== 'point') return { committed: false, reason: 'aborted' };

  const target = targetInput.point as Point2D;
  const dx = target.x - base.x;
  const dy = target.y - base.y;

  const project = projectStore.getState().project;
  if (!project) return { committed: false, reason: 'aborted' };
  for (const id of selection) {
    const p = project.primitives[id];
    if (!p) continue;
    updatePrimitive(id, shiftPrimitive(p, dx, dy) as never);
  }
  return { committed: true, description: `moved ${selection.length} entity/entities` };
}
