// Draw polyline. M1.3a polyline emits zero bulges only (I-48); non-zero
// bulges enter via post-creation Fillet (M1.3b) or property edit (M1.3c).
//
// Sub-options:
//   - Close — close the polyline at the current vertex (>=3 vertices).
//   - Undo — drop the last vertex.
// Termination:
//   - { kind: 'commit' } — exit the loop and commit-open if vertices>=2.
//     Sources: empty Enter in command bar, Enter on canvas focus,
//     right-click on canvas. Sub-option shortcut letters (`c`, `u`)
//     route through the keyboard router's sub-option fast-path.
//   - { kind: 'escape' } — runner sets aborted; tool returns
//     { committed: false, reason: 'aborted' }. Vertices are discarded.

import { LayerId, type Point2D, newPrimitiveId } from '@portplanner/domain';
import { addPrimitive } from '@portplanner/project-store';

import { editorUiStore } from '../../ui-state/store';
import type { DimensionGuide, DynamicInputManifest, ToolGenerator } from '../types';

// M1.3 Round 6 — DI manifest for the per-loop next-point prompt.
// Same shape as draw-line (distance + angle, combineAs:'point').
// Plan §4.1 + Phase 2 step 14.
const POLYLINE_DI_MANIFEST: DynamicInputManifest = {
  fields: [
    { kind: 'distance', label: 'Distance' },
    { kind: 'angle', label: 'Angle' },
  ],
  combineAs: 'point',
};

export async function* drawPolylineTool(): ToolGenerator {
  const start = yield { text: 'Specify start point', acceptedInputKinds: ['point'] };
  if (start.kind !== 'point') return { committed: false, reason: 'aborted' };
  const vertices: Point2D[] = [start.point];
  let closed = false;

  while (true) {
    // Capture the current vertex chain in a closure for the preview
    // builder. previewBuilder MUST be a pure function of cursor; the
    // chain is bound at yield time so the runner can re-invoke it on
    // every cursor frame without re-yielding.
    const verticesSnapshot: Point2D[] = [...vertices];
    const lastVertex = verticesSnapshot[verticesSnapshot.length - 1]!;
    const next = yield {
      text: 'Specify next point or [Close/Undo]',
      subOptions: [
        { label: 'Close', shortcut: 'c' },
        { label: 'Undo', shortcut: 'u' },
      ],
      acceptedInputKinds: ['point', 'subOption'],
      previewBuilder: (cursor) => ({
        kind: 'polyline',
        vertices: verticesSnapshot,
        cursor,
        closed: false,
      }),
      // F1: typed numeric distance lands at lastVertex + unit(cursor - lastVertex) * d.
      directDistanceFrom: lastVertex,
      // M1.3 Round 6 — same DI shape as draw-line per loop iteration.
      // Pivot/anchorA = last committed vertex; anchorB / sweep updates
      // per cursor-tick. Per-loop yield resets buffers (Rev-1 R2-A5).
      dynamicInput: POLYLINE_DI_MANIFEST,
      dimensionGuidesBuilder: (cursor): DimensionGuide[] => [
        // Same shape as draw-line: both-side witness tube + 120px arc
        // + line-length-proportional polar reference baseline.
        {
          kind: 'linear-dim',
          anchorA: lastVertex,
          anchorB: cursor,
          offsetCssPx: 14,
          mirrorWitness: true,
        },
        {
          kind: 'angle-arc',
          pivot: lastVertex,
          baseAngleRad: 0,
          sweepAngleRad: Math.atan2(cursor.y - lastVertex.y, cursor.x - lastVertex.x),
          radiusCssPx: 120,
          polarRefLengthMetric: Math.abs(cursor.x - lastVertex.x),
        },
      ],
    };
    if (next.kind === 'subOption' && next.optionLabel === 'Close') {
      if (vertices.length < 3) {
        return { committed: false, reason: 'aborted' };
      }
      closed = true;
      break;
    }
    if (next.kind === 'subOption' && next.optionLabel === 'Undo') {
      if (vertices.length > 1) vertices.pop();
      continue;
    }
    if (next.kind === 'point') {
      vertices.push(next.point);
      continue;
    }
    if (next.kind === 'commit') {
      // Right-click / Enter on canvas focus / empty Enter in command bar
      // all route here. End the loop and commit-open if the polyline has
      // enough vertices.
      break;
    }
    // Any other (unexpected) input kind: treat as commit-open intent —
    // safer than silently dropping the input.
    break;
  }

  if (vertices.length < 2) return { committed: false, reason: 'aborted' };

  const layerId = editorUiStore.getState().activeLayerId ?? LayerId.DEFAULT;
  // I-48: M1.3a draws straight segments; bulges all zero.
  const bulges = new Array<number>(closed ? vertices.length : vertices.length - 1).fill(0);
  addPrimitive({
    id: newPrimitiveId(),
    kind: 'polyline',
    layerId,
    displayOverrides: {},
    vertices,
    bulges,
    closed,
  });
  return { committed: true, description: `polyline (${vertices.length} vertices)` };
}
