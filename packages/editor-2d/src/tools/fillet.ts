// M1.3b fillet-chamfer Phase 2 — Fillet tool.
//
// Flow per the plan §6.1.0 decision table + §3.0 walkthrough:
//   1. Yield "Select first object or [Radius]" — accepting 'point' or
//      'subOption'. R/Radius opens a sub-flow yielding "Specify fillet
//      radius <{current}>" (typed number, persists to
//      editorUiStore.fillet.radius), then loops back.
//   2. Yield "Select second object" — accepting 'point' with
//      previewBuilder showing the fillet ghost.
//   3. Classify the picked pair, dispatch the matching domain helper
//      (filletTwoLines / filletPolylineCorner / filletLineAndPolyline-
//      Endpoint), commit via addPrimitive / updatePrimitive.
//
// Plan §3.10 implementation note: the plan suggested 'entity' input
// kind but EditorRoot only feeds 'point' inputs to active tools, AND
// fillet needs the click coordinate as pickHint for AC-quadrant
// disambiguation. Resolution: tool yields 'point' prompts, does
// internal hit-test on metric click points, uses the click as pickHint.
//
// Per I-FC-5 truth table:
//   - two-line:               2× UPDATE + 1× CREATE
//   - polyline-internal:      1× UPDATE
//   - line+polyline-endpoint: 2× UPDATE + 1× CREATE
//   - aborted (any cause):    0 ops

import {
  type LinePrimitive,
  type Point2D,
  type PolylinePrimitive,
  type Primitive,
  type PrimitiveId,
  filletLineAndPolylineEndpoint,
  filletPolylineCorner,
  filletTwoLines,
  newPrimitiveId,
} from '@portplanner/domain';
import { addPrimitive, projectStore, updatePrimitive } from '@portplanner/project-store';

import { findEntityAtMetricPoint } from '../canvas/hit-test';
import { editorUiActions, editorUiStore } from '../ui-state/store';
import type { FilletPreviewCase, PreviewShape, ToolGenerator, ToolResult } from './types';

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

/** Resolve which polyline endpoint (0 or N-1) is closest to the pick
 *  hint. Returns null if the hint is closer to an interior vertex than
 *  to either endpoint (interior-segment fillet not supported in V1). */
function resolvePolylineEndpoint(poly: PolylinePrimitive, hint: Point2D): 0 | -1 | null {
  if (poly.closed) return null;
  const n = poly.vertices.length;
  if (n < 2) return null;
  // Closest vertex to hint.
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
  return null; // interior — reject in V1
}

/** Resolve the closest interior vertex of a polyline given a pick hint.
 *  For closed polylines, all vertices qualify; for open, only interior
 *  (1..N-2). Returns null if no qualifying vertex exists. */
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
  // Surface command-bar message — currently logs to console; future
  // wiring will route through editorUiStore.commandBar.statusMessage
  // when that field is added. For V1 the messages live in the source
  // (asserted by FC-P2-NoStaleAbortMessage gate) so future surface is
  // a documentation lift, not a domain change.
  // eslint-disable-next-line no-console
  console.warn(_message);
}

export async function* filletTool(): ToolGenerator {
  // First-pick prompt with [Radius] sub-option (loops back after radius set).
  let firstPick: PickedEntity | null = null;
  while (firstPick === null) {
    const radius = editorUiStore.getState().fillet.radius;
    const input = yield {
      text: 'Select first object or [Radius]',
      acceptedInputKinds: ['point', 'subOption'],
      subOptions: [{ label: 'Radius', shortcut: 'r' }],
    };
    if (input.kind === 'subOption' && input.optionLabel === 'Radius') {
      const radiusInput = yield {
        text: `Specify fillet radius <${radius}>`,
        acceptedInputKinds: ['number'],
        dynamicInput: { fields: [{ kind: 'distance', label: 'Radius' }], combineAs: 'number' },
      };
      if (radiusInput.kind !== 'number') return { committed: false, reason: 'aborted' };
      if (radiusInput.value > 0) editorUiActions.setFilletRadius(radiusInput.value);
      continue;
    }
    if (input.kind !== 'point') return { committed: false, reason: 'aborted' };
    const project = projectStore.getState().project;
    if (!project) return { committed: false, reason: 'aborted' };
    const hit = findEntityAtMetricPoint(input.point, project.primitives, HIT_TOLERANCE_METRIC);
    if (!hit) return { committed: false, reason: 'aborted' };
    firstPick = { id: hit.id, primitive: hit.primitive, hint: input.point };
  }

  // Second-pick prompt with live preview.
  const secondInput = yield {
    text: 'Select second object',
    acceptedInputKinds: ['point'],
    previewBuilder: (cursor): PreviewShape => {
      const project = projectStore.getState().project;
      const radius = editorUiStore.getState().fillet.radius;
      const noOp: PreviewShape = { kind: 'line', p1: cursor, cursor };
      if (!project) return noOp;
      const hit = findEntityAtMetricPoint(cursor, project.primitives, HIT_TOLERANCE_METRIC);
      if (!hit) return noOp;
      const previewCase = buildFilletPreviewCase(
        firstPick!,
        { id: hit.id, primitive: hit.primitive, hint: cursor },
        radius,
      );
      if (!previewCase) return noOp;
      return { kind: 'fillet-preview', case: previewCase };
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
  const radius = editorUiStore.getState().fillet.radius;

  // Dispatch per pair-type (per plan §6.1.0 decision table).
  return commitFillet(firstPick, secondPick, radius);
}

function buildFilletPreviewCase(
  a: PickedEntity,
  b: PickedEntity,
  radius: number,
): FilletPreviewCase | null {
  if (isLine(a.primitive) && isLine(b.primitive) && a.id !== b.id) {
    return {
      pairType: 'two-line',
      l1: a.primitive,
      l2: b.primitive,
      pickHints: { p1Hint: a.hint, p2Hint: b.hint },
      radius,
    };
  }
  if (a.id === b.id && isPolyline(a.primitive)) {
    const k = resolvePolylineInteriorVertex(a.primitive, a.hint);
    if (k === null) return null;
    return { pairType: 'polyline-internal', polyline: a.primitive, vertexIdx: k, radius };
  }
  // Mixed line + polyline (either order).
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
      radius,
    };
  }
  return null;
}

function commitFillet(a: PickedEntity, b: PickedEntity, radius: number): ToolResult {
  // Two-line case.
  if (isLine(a.primitive) && isLine(b.primitive)) {
    if (a.id === b.id) {
      emitStatus('Fillet: pair not supported in V1');
      return { committed: false, reason: 'aborted' };
    }
    try {
      const r = filletTwoLines(a.primitive, b.primitive, radius, {
        p1Hint: a.hint,
        p2Hint: b.hint,
      });
      const arcId = newPrimitiveId();
      updatePrimitive(a.id, stripIdentity(r.l1Updated));
      updatePrimitive(b.id, stripIdentity(r.l2Updated));
      addPrimitive({
        ...r.newArc,
        id: arcId,
        layerId: a.primitive.layerId,
        displayOverrides: {},
      });
      return { committed: true, description: `filleted line + line @ R=${radius}` };
    } catch (err) {
      emitStatus(`Fillet: ${(err as Error).message}`);
      return { committed: false, reason: 'aborted' };
    }
  }

  // Polyline-internal case (same polyline picked twice).
  if (a.id === b.id && isPolyline(a.primitive)) {
    const k = resolvePolylineInteriorVertex(a.primitive, a.hint);
    if (k === null) {
      emitStatus('Fillet: open polyline endpoint vertex is not a corner — pick an interior vertex');
      return { committed: false, reason: 'aborted' };
    }
    try {
      const updated = filletPolylineCorner(a.primitive, k, radius);
      updatePrimitive(a.id, stripIdentity(updated));
      return { committed: true, description: `filleted polyline corner @ R=${radius}` };
    } catch (err) {
      emitStatus(`Fillet: ${(err as Error).message}`);
      return { committed: false, reason: 'aborted' };
    }
  }

  // Line + Polyline-endpoint case.
  const linePick = isLine(a.primitive) ? a : isLine(b.primitive) ? b : null;
  const polyPick = isPolyline(a.primitive) ? a : isPolyline(b.primitive) ? b : null;
  if (linePick && polyPick) {
    const poly = polyPick.primitive as PolylinePrimitive;
    if (poly.closed) {
      emitStatus(
        'Fillet: closed polyline has no endpoint segment — pick the polyline twice for an interior fillet, or pick a different pair',
      );
      return { committed: false, reason: 'aborted' };
    }
    const endpoint = resolvePolylineEndpoint(poly, polyPick.hint);
    if (endpoint === null) {
      emitStatus(
        'Fillet: only polyline endpoint segments supported (interior segment fillet deferred to follow-up)',
      );
      return { committed: false, reason: 'aborted' };
    }
    try {
      const r = filletLineAndPolylineEndpoint(
        linePick.primitive as LinePrimitive,
        linePick.hint,
        poly,
        endpoint,
        radius,
      );
      const arcId = newPrimitiveId();
      updatePrimitive(linePick.id, stripIdentity(r.lineUpdated));
      updatePrimitive(polyPick.id, stripIdentity(r.polylineUpdated));
      addPrimitive({
        ...r.newArc,
        id: arcId,
        layerId: linePick.primitive.layerId,
        displayOverrides: {},
      });
      return { committed: true, description: `filleted line + polyline-end @ R=${radius}` };
    } catch (err) {
      emitStatus(`Fillet: ${(err as Error).message}`);
      return { committed: false, reason: 'aborted' };
    }
  }

  // Two different polylines, or any pair containing point/circle/arc/xline/rectangle.
  if (isPolyline(a.primitive) && isPolyline(b.primitive)) {
    emitStatus('Fillet: two-different-polylines not supported in V1');
  } else {
    emitStatus('Fillet: pair not supported in V1');
  }
  return { committed: false, reason: 'aborted' };
}

function stripIdentity(p: Primitive): Partial<Primitive> {
  const { id: _id, ...rest } = p;
  return rest as Partial<Primitive>;
}
