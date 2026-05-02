// M1.3b simple-transforms Phase 4 — Scale tool.
//
// Flow per AC parity (single-prompt live + R sub-option):
//   1. Yield "Select objects" if selection empty.
//   2. Yield "Specify base point".
//   3. Yield "Specify scale factor or [Reference]" with live ghost
//      scaled by factor = hypot(cursor - base) (AC convention).
//      Branch:
//        - 'point' input → factor = hypot(point - base). Reject 0.
//        - 'number' input → factor = value. Reject ONLY factor === 0
//          (per I-MOD-7 SSOT). Negative factor allowed (AC flip).
//        - 'subOption' R/Reference → 2-click sub-flow:
//            yield "Specify reference distance" → "Specify new distance"
//            factor = newDist / refDist.
//   4. Commit: for each id, updatePrimitive(id, scalePrimitive(p, base, factor)).

import { type Primitive, type PrimitiveId, scalePrimitive } from '@portplanner/domain';
import { projectStore, updatePrimitive } from '@portplanner/project-store';

import { DIM_OFFSET_CSS } from '../canvas/painters/paintDimensionGuides';
import { editorUiStore } from '../ui-state/store';
import type { DimensionGuide, ToolGenerator } from './types';

export async function* scaleTool(): ToolGenerator {
  let selection = editorUiStore.getState().selection;
  if (selection.length === 0) {
    const sel = yield { text: 'Select objects', acceptedInputKinds: ['entity'] };
    if (sel.kind !== 'entity') return { committed: false, reason: 'aborted' };
    selection = [sel.entityId as PrimitiveId];
  }

  const baseInput = yield { text: 'Specify base point', acceptedInputKinds: ['point'] };
  if (baseInput.kind !== 'point') return { committed: false, reason: 'aborted' };
  const base = baseInput.point;

  const baseProject = projectStore.getState().project;
  const ghostPrimitives: Primitive[] = baseProject
    ? selection.flatMap((id) => {
        const p = baseProject.primitives[id];
        return p ? [p] : [];
      })
    : [];

  const factorInput = yield {
    text: 'Specify scale factor or [Reference]',
    acceptedInputKinds: ['point', 'number', 'subOption'],
    subOptions: [{ label: 'Reference', shortcut: 'r' }],
    directDistanceFrom: base,
    dynamicInput: { fields: [{ kind: 'number', label: 'Factor' }], combineAs: 'number' },
    previewBuilder: (cursor) => ({
      kind: 'scaled-entities',
      primitives: ghostPrimitives,
      base,
      factor: Math.hypot(cursor.x - base.x, cursor.y - base.y),
    }),
  };

  let factor: number;
  if (factorInput.kind === 'point') {
    factor = Math.hypot(factorInput.point.x - base.x, factorInput.point.y - base.y);
    if (factor === 0) return { committed: false, reason: 'aborted' };
  } else if (factorInput.kind === 'number') {
    // Per I-MOD-7 SSOT: reject factor === 0 ONLY (degenerate).
    // factor < 0 is ALLOWED (AC flip semantics). scalePrimitive handles
    // negative factors via base + factor*(p - base) which flips through base.
    factor = factorInput.value;
    if (factor === 0) return { committed: false, reason: 'aborted' };
  } else if (factorInput.kind === 'subOption' && factorInput.optionLabel === 'Reference') {
    const refInput = yield {
      text: 'Specify reference distance (pick a point)',
      acceptedInputKinds: ['point'],
      directDistanceFrom: base,
      previewBuilder: (cursor) => ({ kind: 'line', p1: base, cursor }),
      // Witness lines + offset dim line along base→cursor (mirrors
      // draw-line / draw-circle radius pattern). User sees the
      // reference distance being measured.
      dimensionGuidesBuilder: (cursor): DimensionGuide[] => [
        { kind: 'linear-dim', anchorA: base, anchorB: cursor, offsetCssPx: DIM_OFFSET_CSS },
      ],
    };
    if (refInput.kind !== 'point') return { committed: false, reason: 'aborted' };
    const refDist = Math.hypot(refInput.point.x - base.x, refInput.point.y - base.y);
    if (refDist === 0) return { committed: false, reason: 'aborted' };

    const newInput = yield {
      text: 'Specify new distance (pick a point)',
      acceptedInputKinds: ['point', 'number'],
      directDistanceFrom: base,
      dynamicInput: { fields: [{ kind: 'distance', label: 'Distance' }], combineAs: 'number' },
      previewBuilder: (cursor) => ({
        kind: 'scaled-entities',
        primitives: ghostPrimitives,
        base,
        factor: Math.hypot(cursor.x - base.x, cursor.y - base.y) / refDist,
      }),
      // Same linear-dim along base→cursor for the new distance — the
      // resulting factor is newDist/refDist, so showing newDist visibly
      // matches what the user types or clicks.
      dimensionGuidesBuilder: (cursor): DimensionGuide[] => [
        { kind: 'linear-dim', anchorA: base, anchorB: cursor, offsetCssPx: DIM_OFFSET_CSS },
      ],
    };
    let newDist: number;
    if (newInput.kind === 'point') {
      newDist = Math.hypot(newInput.point.x - base.x, newInput.point.y - base.y);
    } else if (newInput.kind === 'number') {
      newDist = newInput.value;
    } else {
      return { committed: false, reason: 'aborted' };
    }
    factor = newDist / refDist;
    if (factor === 0) return { committed: false, reason: 'aborted' };
  } else {
    return { committed: false, reason: 'aborted' };
  }

  // Commit. Per I-MOD-6: 'UPDATE' per primitive.
  const project = projectStore.getState().project;
  if (!project) return { committed: false, reason: 'aborted' };
  let count = 0;
  for (const id of selection) {
    const p = project.primitives[id];
    if (!p) continue;
    const scaled = scalePrimitive(p, base, factor);
    const { id: _id, ...patch } = scaled;
    updatePrimitive(id, patch as Partial<Primitive>);
    count += 1;
  }
  return { committed: true, description: `scaled ${count} entity/entities by ${factor}` };
}
