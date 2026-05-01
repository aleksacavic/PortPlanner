// M1.3b simple-transforms Phase 3 — Mirror tool.
//
// Flow per AC parity:
//   1. Yield "Select objects" if selection empty.
//   2. Yield "Specify first mirror line point".
//   3. Yield "Specify second mirror line point" with live ghost
//      reflection across the line through (p1, cursor).
//   4. Yield "Erase source objects? [Yes/No] <No>" sub-prompt.
//   5. Commit: addPrimitive(mirroredCopy(src, line)) per source. If
//      eraseInput optionLabel === 'Yes', also deletePrimitive(srcId).
//
// Per I-MOD-6 truth table: emits 'CREATE' per copy + optional 'DELETE'
// per source on Yes.

import {
  type Primitive,
  type PrimitiveId,
  mirrorPrimitive,
  newPrimitiveId,
} from '@portplanner/domain';
import { addPrimitive, deletePrimitive, projectStore } from '@portplanner/project-store';

import { editorUiStore } from '../ui-state/store';
import type { ToolGenerator } from './types';

export async function* mirrorTool(): ToolGenerator {
  let selection = editorUiStore.getState().selection;
  if (selection.length === 0) {
    const sel = yield { text: 'Select objects', acceptedInputKinds: ['entity'] };
    if (sel.kind !== 'entity') return { committed: false, reason: 'aborted' };
    selection = [sel.entityId as PrimitiveId];
  }

  const p1Input = yield {
    text: 'Specify first mirror line point',
    acceptedInputKinds: ['point'],
  };
  if (p1Input.kind !== 'point') return { committed: false, reason: 'aborted' };
  const p1 = p1Input.point;

  // Snapshot ghost primitives at first-point-pick time.
  const baseProject = projectStore.getState().project;
  const ghostPrimitives: Primitive[] = baseProject
    ? selection.flatMap((id) => {
        const p = baseProject.primitives[id];
        return p ? [p] : [];
      })
    : [];

  const p2Input = yield {
    text: 'Specify second mirror line point',
    acceptedInputKinds: ['point'],
    directDistanceFrom: p1,
    previewBuilder: (cursor) => ({
      kind: 'mirrored-entities',
      primitives: ghostPrimitives,
      line: { p1, p2: cursor },
    }),
  };
  if (p2Input.kind !== 'point') return { committed: false, reason: 'aborted' };
  const p2 = p2Input.point;

  // Erase-source sub-prompt with default 'No' (AC parity).
  const eraseInput = yield {
    text: 'Erase source objects? [Yes/No]',
    acceptedInputKinds: ['subOption'],
    subOptions: [
      { label: 'Yes', shortcut: 'y' },
      { label: 'No', shortcut: 'n' },
    ],
    defaultValue: 'No',
  };
  // Default Enter without input → defaultValue 'No' → eraseSource false.
  // Explicit subOption Yes → true. Anything else → false (defensive).
  const eraseSource = eraseInput.kind === 'subOption' && eraseInput.optionLabel === 'Yes';

  // Commit: per I-MOD-6 truth table — addPrimitive per mirrored copy;
  // optional deletePrimitive per source on eraseSource.
  const project = projectStore.getState().project;
  if (!project) return { committed: false, reason: 'aborted' };
  let count = 0;
  for (const id of selection) {
    const src = project.primitives[id];
    if (!src) continue;
    const mirrored = mirrorPrimitive(src, { p1, p2 }) as Primitive;
    addPrimitive({ ...mirrored, id: newPrimitiveId() } as Primitive);
    if (eraseSource) deletePrimitive(id);
    count += 1;
  }
  return {
    committed: true,
    description: `mirrored ${count} entity/entities${eraseSource ? ' (sources erased)' : ''}`,
  };
}
