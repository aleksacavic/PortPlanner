// M1.3b fillet-chamfer Phase 3 — Chamfer tool.
//
// Mirrors fillet.ts structure with two-distance method (d1, d2) instead
// of radius. New entity is a straight LinePrimitive (chamfer segment)
// for two-line / mixed cases; polyline-internal modifies in place with
// bulge=0 for the new straight (P1→P2) edge.
//
// Per I-FC-5 truth table (chamfer parity with fillet):
//   - two-line:               2× UPDATE + 1× CREATE LinePrimitive
//   - polyline-internal:      1× UPDATE
//   - line+polyline-endpoint: 2× UPDATE + 1× CREATE LinePrimitive
//   - aborted (any cause):    0 ops

import {
  type LinePrimitive,
  type Point2D,
  type PolylinePrimitive,
  type Primitive,
  type PrimitiveId,
  chamferLineAndPolylineEndpoint,
  chamferPolylineCorner,
  chamferTwoLines,
  newPrimitiveId,
} from '@portplanner/domain';
import { addPrimitive, projectStore, updatePrimitive } from '@portplanner/project-store';

import { findEntityAtMetricPoint } from '../canvas/hit-test';
import { editorUiActions, editorUiStore } from '../ui-state/store';
import type { ChamferPreviewCase, PreviewShape, ToolGenerator, ToolResult } from './types';

const HIT_TOLERANCE_METRIC = 0.6;

interface PickedEntity {
  id: PrimitiveId;
  primitive: Primitive;
  hint: Point2D;
}

function isLine(p: Primitive): p is LinePrimitive {
  return p.kind === 'line';
}
function isPolyline(p: Primitive): p is PolylinePrimitive {
  return p.kind === 'polyline';
}

function resolvePolylineEndpoint(poly: PolylinePrimitive, hint: Point2D): 0 | -1 | null {
  if (poly.closed) return null;
  const n = poly.vertices.length;
  if (n < 2) return null;
  let bestIdx = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < n; i += 1) {
    const v = poly.vertices[i]!;
    const d = Math.hypot(v.x - hint.x, v.y - hint.y);
    if (d < bestDist) {
      bestIdx = i;
      bestDist = d;
    }
  }
  if (bestIdx === 0) return 0;
  if (bestIdx === n - 1) return -1;
  return null;
}

function resolvePolylineInteriorVertex(poly: PolylinePrimitive, hint: Point2D): number | null {
  const n = poly.vertices.length;
  let bestIdx = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  const minIdx = poly.closed ? 0 : 1;
  const maxIdx = poly.closed ? n - 1 : n - 2;
  for (let i = minIdx; i <= maxIdx; i += 1) {
    const v = poly.vertices[i]!;
    const d = Math.hypot(v.x - hint.x, v.y - hint.y);
    if (d < bestDist) {
      bestIdx = i;
      bestDist = d;
    }
  }
  return bestIdx >= 0 ? bestIdx : null;
}

function emitStatus(_message: string): void {
  // eslint-disable-next-line no-console
  console.warn(_message);
}

export async function* chamferTool(): ToolGenerator {
  let firstPick: PickedEntity | null = null;
  while (firstPick === null) {
    const { d1, d2 } = editorUiStore.getState().chamfer;
    const input = yield {
      text: 'Select first object or [Distance]',
      acceptedInputKinds: ['point', 'subOption'],
      subOptions: [{ label: 'Distance', shortcut: 'd' }],
    };
    if (input.kind === 'subOption' && input.optionLabel === 'Distance') {
      const d1Input = yield {
        text: `Specify first chamfer distance <${d1}>`,
        acceptedInputKinds: ['number'],
        dynamicInput: { fields: [{ kind: 'distance', label: 'Distance 1' }], combineAs: 'number' },
      };
      if (d1Input.kind !== 'number') return { committed: false, reason: 'aborted' };
      const newD1 = d1Input.value > 0 ? d1Input.value : d1;
      const d2Input = yield {
        text: `Specify second chamfer distance <${d2}>`,
        acceptedInputKinds: ['number'],
        dynamicInput: { fields: [{ kind: 'distance', label: 'Distance 2' }], combineAs: 'number' },
      };
      if (d2Input.kind !== 'number') return { committed: false, reason: 'aborted' };
      const newD2 = d2Input.value > 0 ? d2Input.value : d2;
      editorUiActions.setChamferDistances(newD1, newD2);
      continue;
    }
    if (input.kind !== 'point') return { committed: false, reason: 'aborted' };
    const project = projectStore.getState().project;
    if (!project) return { committed: false, reason: 'aborted' };
    const hit = findEntityAtMetricPoint(input.point, project.primitives, HIT_TOLERANCE_METRIC);
    if (!hit) return { committed: false, reason: 'aborted' };
    firstPick = { id: hit.id, primitive: hit.primitive, hint: input.point };
  }

  const secondInput = yield {
    text: 'Select second object',
    acceptedInputKinds: ['point'],
    previewBuilder: (cursor): PreviewShape => {
      const project = projectStore.getState().project;
      const { d1, d2 } = editorUiStore.getState().chamfer;
      const noOp: PreviewShape = { kind: 'line', p1: cursor, cursor };
      if (!project) return noOp;
      const hit = findEntityAtMetricPoint(cursor, project.primitives, HIT_TOLERANCE_METRIC);
      if (!hit) return noOp;
      const previewCase = buildChamferPreviewCase(
        firstPick!,
        { id: hit.id, primitive: hit.primitive, hint: cursor },
        d1,
        d2,
      );
      if (!previewCase) return noOp;
      return { kind: 'chamfer-preview', case: previewCase };
    },
  };
  if (secondInput.kind !== 'point') return { committed: false, reason: 'aborted' };
  const project = projectStore.getState().project;
  if (!project) return { committed: false, reason: 'aborted' };
  const hit2 = findEntityAtMetricPoint(secondInput.point, project.primitives, HIT_TOLERANCE_METRIC);
  if (!hit2) return { committed: false, reason: 'aborted' };
  const secondPick: PickedEntity = {
    id: hit2.id,
    primitive: hit2.primitive,
    hint: secondInput.point,
  };
  const { d1, d2 } = editorUiStore.getState().chamfer;
  return commitChamfer(firstPick, secondPick, d1, d2);
}

function buildChamferPreviewCase(
  a: PickedEntity,
  b: PickedEntity,
  d1: number,
  d2: number,
): ChamferPreviewCase | null {
  if (isLine(a.primitive) && isLine(b.primitive) && a.id !== b.id) {
    return {
      pairType: 'two-line',
      l1: a.primitive,
      l2: b.primitive,
      pickHints: { p1Hint: a.hint, p2Hint: b.hint },
      d1,
      d2,
    };
  }
  if (a.id === b.id && isPolyline(a.primitive)) {
    const k = resolvePolylineInteriorVertex(a.primitive, a.hint);
    if (k === null) return null;
    return { pairType: 'polyline-internal', polyline: a.primitive, vertexIdx: k, d1, d2 };
  }
  const linePick = isLine(a.primitive) ? a : isLine(b.primitive) ? b : null;
  const polyPick = isPolyline(a.primitive) ? a : isPolyline(b.primitive) ? b : null;
  if (linePick && polyPick) {
    const endpoint = resolvePolylineEndpoint(
      polyPick.primitive as PolylinePrimitive,
      polyPick.hint,
    );
    if (endpoint === null) return null;
    return {
      pairType: 'line-polyline-end',
      line: linePick.primitive as LinePrimitive,
      lineHint: linePick.hint,
      polyline: polyPick.primitive as PolylinePrimitive,
      polylineEndpoint: endpoint,
      d1,
      d2,
    };
  }
  return null;
}

function commitChamfer(a: PickedEntity, b: PickedEntity, d1: number, d2: number): ToolResult {
  if (isLine(a.primitive) && isLine(b.primitive)) {
    if (a.id === b.id) {
      emitStatus('Chamfer: pair not supported in V1');
      return { committed: false, reason: 'aborted' };
    }
    try {
      const r = chamferTwoLines(a.primitive, b.primitive, d1, d2, {
        p1Hint: a.hint,
        p2Hint: b.hint,
      });
      const segId = newPrimitiveId();
      updatePrimitive(a.id, stripIdentity(r.l1Updated));
      updatePrimitive(b.id, stripIdentity(r.l2Updated));
      addPrimitive({
        ...r.newSegment,
        id: segId,
        layerId: a.primitive.layerId,
        displayOverrides: {},
      });
      return { committed: true, description: 'chamfered line + line' };
    } catch (err) {
      emitStatus(`Chamfer: ${(err as Error).message}`);
      return { committed: false, reason: 'aborted' };
    }
  }

  if (a.id === b.id && isPolyline(a.primitive)) {
    const k = resolvePolylineInteriorVertex(a.primitive, a.hint);
    if (k === null) {
      emitStatus(
        'Chamfer: open polyline endpoint vertex is not a corner — pick an interior vertex',
      );
      return { committed: false, reason: 'aborted' };
    }
    try {
      const updated = chamferPolylineCorner(a.primitive, k, d1, d2);
      updatePrimitive(a.id, stripIdentity(updated));
      return { committed: true, description: 'chamfered polyline corner' };
    } catch (err) {
      emitStatus(`Chamfer: ${(err as Error).message}`);
      return { committed: false, reason: 'aborted' };
    }
  }

  const linePick = isLine(a.primitive) ? a : isLine(b.primitive) ? b : null;
  const polyPick = isPolyline(a.primitive) ? a : isPolyline(b.primitive) ? b : null;
  if (linePick && polyPick) {
    const poly = polyPick.primitive as PolylinePrimitive;
    if (poly.closed) {
      emitStatus(
        'Chamfer: closed polyline has no endpoint segment — pick the polyline twice for an interior chamfer, or pick a different pair',
      );
      return { committed: false, reason: 'aborted' };
    }
    const endpoint = resolvePolylineEndpoint(poly, polyPick.hint);
    if (endpoint === null) {
      emitStatus(
        'Chamfer: only polyline endpoint segments supported (interior segment chamfer deferred to follow-up)',
      );
      return { committed: false, reason: 'aborted' };
    }
    try {
      const r = chamferLineAndPolylineEndpoint(
        linePick.primitive as LinePrimitive,
        linePick.hint,
        poly,
        endpoint,
        d1,
        d2,
      );
      const segId = newPrimitiveId();
      updatePrimitive(linePick.id, stripIdentity(r.lineUpdated));
      updatePrimitive(polyPick.id, stripIdentity(r.polylineUpdated));
      addPrimitive({
        ...r.newSegment,
        id: segId,
        layerId: linePick.primitive.layerId,
        displayOverrides: {},
      });
      return { committed: true, description: 'chamfered line + polyline-end' };
    } catch (err) {
      emitStatus(`Chamfer: ${(err as Error).message}`);
      return { committed: false, reason: 'aborted' };
    }
  }

  if (isPolyline(a.primitive) && isPolyline(b.primitive)) {
    emitStatus('Chamfer: two-different-polylines not supported in V1');
  } else {
    emitStatus('Chamfer: pair not supported in V1');
  }
  return { committed: false, reason: 'aborted' };
}

function stripIdentity(p: Primitive): Partial<Primitive> {
  const { id: _id, ...rest } = p;
  return rest as Partial<Primitive>;
}
