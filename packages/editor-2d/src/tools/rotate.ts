// M1.3b simple-transforms Phase 2 — Rotate tool.
//
// Flow per AC parity (plan §9 Phase 2 Rev-2):
//   1. Yield "Select objects" if selection empty.
//   2. Yield "Specify base point".
//   3. Yield "Specify rotation angle or [Reference]" — single-prompt
//      live preview rotating from 0° as cursor angle changes. User
//      commits via:
//        - 'point' input → deltaAngle = atan2(point - base)
//        - 'angle' input (typed) → deltaAngle = radians
//        - 'subOption' R/Reference → 2-click sub-flow:
//            yield "Specify reference angle" → "Specify final angle"
//            deltaAngle = finalAngle - referenceAngle
//   4. Commit: for each id in selection,
//      updatePrimitive(id, rotatePrimitive(p, base, deltaAngle))
//
// Per I-MOD-6 truth table: emits 'UPDATE' per selected primitive.

import { type Primitive, type PrimitiveId, rotatePrimitive } from '@portplanner/domain';
import { projectStore, updatePrimitive } from '@portplanner/project-store';

import { editorUiStore } from '../ui-state/store';
import type { DimensionGuide, ToolGenerator } from './types';

export async function* rotateTool(): ToolGenerator {
  // 1. Selection (skip prompt if non-empty).
  let selection = editorUiStore.getState().selection;
  if (selection.length === 0) {
    const sel = yield { text: 'Select objects', acceptedInputKinds: ['entity'] };
    if (sel.kind !== 'entity') return { committed: false, reason: 'aborted' };
    selection = [sel.entityId as PrimitiveId];
  }

  // 2. Base point.
  const baseInput = yield { text: 'Specify base point', acceptedInputKinds: ['point'] };
  if (baseInput.kind !== 'point') return { committed: false, reason: 'aborted' };
  const base = baseInput.point;

  // Snapshot ghost primitives at base-point-pick time (mirrors move.ts).
  const baseProject = projectStore.getState().project;
  const ghostPrimitives: Primitive[] = baseProject
    ? selection.flatMap((id) => {
        const p = baseProject.primitives[id];
        return p ? [p] : [];
      })
    : [];

  // 3. Rotation angle prompt with live preview from 0° + Reference sub-option.
  const angleInput = yield {
    text: 'Specify rotation angle or [Reference]',
    acceptedInputKinds: ['point', 'angle', 'subOption'],
    subOptions: [{ label: 'Reference', shortcut: 'r' }],
    directDistanceFrom: base,
    dynamicInput: { fields: [{ kind: 'angle', label: 'Angle' }], combineAs: 'angle' },
    previewBuilder: (cursor) => ({
      kind: 'rotated-entities',
      primitives: ghostPrimitives,
      base,
      angleRad: Math.atan2(cursor.y - base.y, cursor.x - base.x),
    }),
    dimensionGuidesBuilder: (cursor): DimensionGuide[] => [
      {
        kind: 'angle-arc',
        pivot: base,
        baseAngleRad: 0,
        sweepAngleRad: Math.atan2(cursor.y - base.y, cursor.x - base.x),
        radiusMetric: Math.hypot(cursor.x - base.x, cursor.y - base.y),
      },
    ],
  };

  // 4. Branch on input kind to determine deltaAngle.
  let deltaAngle: number;
  if (angleInput.kind === 'point') {
    deltaAngle = Math.atan2(angleInput.point.y - base.y, angleInput.point.x - base.x);
  } else if (angleInput.kind === 'angle') {
    deltaAngle = angleInput.radians;
  } else if (angleInput.kind === 'subOption' && angleInput.optionLabel === 'Reference') {
    // Reference sub-flow: 2 more prompts.
    const refInput = yield {
      text: 'Specify reference angle (pick a point)',
      acceptedInputKinds: ['point'],
      directDistanceFrom: base,
      previewBuilder: (cursor) => ({ kind: 'line', p1: base, cursor }),
    };
    if (refInput.kind !== 'point') return { committed: false, reason: 'aborted' };
    const referenceAngleRad = Math.atan2(refInput.point.y - base.y, refInput.point.x - base.x);

    const finalInput = yield {
      text: 'Specify new angle (pick a point)',
      acceptedInputKinds: ['point', 'angle'],
      directDistanceFrom: base,
      dynamicInput: { fields: [{ kind: 'angle', label: 'Angle' }], combineAs: 'angle' },
      previewBuilder: (cursor) => ({
        kind: 'rotated-entities',
        primitives: ghostPrimitives,
        base,
        angleRad: Math.atan2(cursor.y - base.y, cursor.x - base.x) - referenceAngleRad,
      }),
    };
    if (finalInput.kind === 'point') {
      const finalAngleRad = Math.atan2(finalInput.point.y - base.y, finalInput.point.x - base.x);
      deltaAngle = finalAngleRad - referenceAngleRad;
    } else if (finalInput.kind === 'angle') {
      deltaAngle = finalInput.radians - referenceAngleRad;
    } else {
      return { committed: false, reason: 'aborted' };
    }
  } else {
    return { committed: false, reason: 'aborted' };
  }

  // Commit: rotate each selected primitive about base by deltaAngle.
  // Per I-MOD-6 truth table: 'UPDATE' per primitive.
  const project = projectStore.getState().project;
  if (!project) return { committed: false, reason: 'aborted' };
  let count = 0;
  for (const id of selection) {
    const p = project.primitives[id];
    if (!p) continue;
    const rotated = rotatePrimitive(p, base, deltaAngle);
    // The rotated primitive shares the same id + kind; updatePrimitive
    // takes Partial<Primitive>. Spread minus identity fields.
    const { id: _id, ...patch } = rotated;
    updatePrimitive(id, patch as Partial<Primitive>);
    count += 1;
  }
  return { committed: true, description: `rotated ${count} entity/entities` };
}
