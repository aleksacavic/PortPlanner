// grip-stretch tool — modeless selection-driven stretch of a single
// primitive's grip (M1.3d Phase 6).
//
// Lifecycle:
//   1) canvas-host's mousedown left-button hits a grip → EditorRoot
//      starts grip-stretch via `gripStretchTool(grip)` (closure).
//   2) Tool yields one Prompt with a previewBuilder that constructs
//      the modified-entity preview shape; the tool runner re-invokes
//      the builder on every cursor frame and writes
//      overlay.previewShape (Phase 4 mechanism). Tool also flips
//      overlay.suppressEntityPaint so the original entity is hidden
//      mid-drag (paint.ts Phase 5 honours this) — without it the user
//      sees both the original AND the moving preview overlapping.
//   3) Tool awaits a 'point' input (mouseup point routed by EditorRoot
//      through the canvas-host onCanvasMouseUp prop, Phase 7 wiring).
//   4) On commit: builds the patch from gripKind, calls updatePrimitive,
//      clears suppressEntityPaint. I-DTP-13 (one UPDATE Operation per
//      release) holds because updatePrimitive emits one Operation and
//      the previewBuilder doesn't write to projectStore.
//   5) On Escape: clears suppressEntityPaint, returns aborted.

import type { Point2D, PolylinePrimitive, Primitive } from '@portplanner/domain';
import { projectStore, updatePrimitive } from '@portplanner/project-store';

import { editorUiActions } from '../ui-state/store';
import type { Grip } from '../ui-state/store';
import type { PreviewShape, ToolGenerator } from './types';

export function gripStretchTool(grip: Grip): () => ToolGenerator {
  return async function* (): ToolGenerator {
    editorUiActions.setSuppressEntityPaint(grip.entityId);
    try {
      const next = yield {
        text: 'Specify new position',
        acceptedInputKinds: ['point'],
        previewBuilder: (cursor) => buildPreview(grip, cursor),
      };
      if (next.kind !== 'point') {
        return { committed: false, reason: 'aborted' };
      }
      const project = projectStore.getState().project;
      const original = project?.primitives[grip.entityId];
      if (!original) return { committed: false, reason: 'aborted' };
      const patch = buildPatch(original, grip, next.point);
      if (!patch) return { committed: false, reason: 'aborted' };
      updatePrimitive(grip.entityId, patch);
      return { committed: true, description: `stretch ${grip.gripKind}` };
    } finally {
      editorUiActions.setSuppressEntityPaint(null);
    }
  };
}

/** Build the kind-discriminated preview shape that visualises the
 *  in-flight stretch. Reads the original entity from projectStore at
 *  build time — pure read, no subscription. */
function buildPreview(grip: Grip, cursor: Point2D): PreviewShape {
  const project = projectStore.getState().project;
  const original = project?.primitives[grip.entityId];
  if (!original) {
    // Defensive — entity gone (concurrent delete). Render an empty
    // line preview at cursor; the tool will commit-fail next.
    return { kind: 'line', p1: cursor, cursor };
  }
  switch (original.kind) {
    case 'line': {
      const p1 = grip.gripKind === 'p1' ? cursor : original.p1;
      const p2 = grip.gripKind === 'p2' ? cursor : original.p2;
      return { kind: 'line', p1, cursor: p2 };
    }
    case 'polyline': {
      const verts = original.vertices.map((v, i) => {
        if (grip.gripKind === `vertex-${i}`) return cursor;
        return v;
      });
      return {
        kind: 'polyline',
        vertices: verts.slice(0, -1),
        cursor: verts[verts.length - 1] ?? cursor,
        closed: original.closed,
      };
    }
    case 'rectangle':
      // Rectangle stretch: drag a corner to a new position. We render
      // the new rectangle as the bounding box between the dragged
      // corner's CURSOR position and the diagonally opposite corner.
      // M1.3d ships axis-aligned only (no rotation re-fit).
      return rectanglePreview(original, grip, cursor);
    case 'circle': {
      if (grip.gripKind === 'center') {
        // Move the circle whole — render at cursor with same radius.
        return {
          kind: 'circle',
          center: cursor,
          cursor: { x: cursor.x + original.radius, y: cursor.y },
        };
      }
      // Edge grip — re-fit radius to cursor distance from center.
      return { kind: 'circle', center: original.center, cursor };
    }
    case 'arc':
      return arcPreview(original, grip, cursor);
    case 'xline':
      if (grip.gripKind === 'pivot') {
        return { kind: 'xline', pivot: cursor, cursor: { x: cursor.x + 1, y: cursor.y } };
      }
      return { kind: 'xline', pivot: original.pivot, cursor };
    case 'point':
      // Point primitive's "stretch" is just a move — preview as a
      // tiny line at the new position so something visible appears.
      return { kind: 'line', p1: cursor, cursor };
  }
}

function rectanglePreview(
  original: Extract<Primitive, { kind: 'rectangle' }>,
  grip: Grip,
  cursor: Point2D,
): PreviewShape {
  // axis-aligned only in M1.3d
  const sw = { x: original.origin.x, y: original.origin.y };
  const ne = { x: original.origin.x + original.width, y: original.origin.y + original.height };
  const corner1 = oppositeCorner(grip.gripKind, sw, ne);
  return { kind: 'rectangle', corner1, cursor };
}

function oppositeCorner(kind: string, sw: Point2D, ne: Point2D): Point2D {
  switch (kind) {
    case 'corner-sw':
      return ne;
    case 'corner-se':
      return { x: sw.x, y: ne.y };
    case 'corner-ne':
      return sw;
    case 'corner-nw':
      return { x: ne.x, y: sw.y };
    default:
      return sw;
  }
}

function arcPreview(
  original: Extract<Primitive, { kind: 'arc' }>,
  grip: Grip,
  cursor: Point2D,
): PreviewShape {
  // Stretching an arc grip → re-fit through the new 3-point arc
  // (start, mid, end) where one point is the cursor.
  const startX = original.center.x + original.radius * Math.cos(original.startAngle);
  const startY = original.center.y + original.radius * Math.sin(original.startAngle);
  const endX = original.center.x + original.radius * Math.cos(original.endAngle);
  const endY = original.center.y + original.radius * Math.sin(original.endAngle);
  const midA = (original.startAngle + original.endAngle) / 2;
  const midX = original.center.x + original.radius * Math.cos(midA);
  const midY = original.center.y + original.radius * Math.sin(midA);
  const start = grip.gripKind === 'start' ? cursor : { x: startX, y: startY };
  const mid = grip.gripKind === 'mid' ? cursor : { x: midX, y: midY };
  const end = grip.gripKind === 'end' ? cursor : { x: endX, y: endY };
  return { kind: 'arc-3pt', p1: start, p2: mid, cursor: end };
}

/** Build a primitive patch from the grip + new position. */
function buildPatch(original: Primitive, grip: Grip, newPoint: Point2D): Partial<Primitive> | null {
  switch (original.kind) {
    case 'point':
      return { position: newPoint } as Partial<Primitive>;
    case 'line': {
      if (grip.gripKind === 'p1') return { p1: newPoint } as Partial<Primitive>;
      if (grip.gripKind === 'p2') return { p2: newPoint } as Partial<Primitive>;
      return null;
    }
    case 'polyline': {
      const idx = parsePolylinePrimitiveGrip(grip.gripKind);
      if (idx === null) return null;
      const vertices = original.vertices.map((v, i) => (i === idx ? newPoint : v));
      return { vertices } as Partial<PolylinePrimitive>;
    }
    case 'rectangle': {
      // Diagonal-corner stretch — produces a new origin + width/height
      // bounding the dragged corner and the opposite corner.
      const sw = { x: original.origin.x, y: original.origin.y };
      const ne = { x: original.origin.x + original.width, y: original.origin.y + original.height };
      const opposite = oppositeCorner(grip.gripKind, sw, ne);
      const minX = Math.min(opposite.x, newPoint.x);
      const minY = Math.min(opposite.y, newPoint.y);
      const w = Math.abs(newPoint.x - opposite.x);
      const h = Math.abs(newPoint.y - opposite.y);
      if (w === 0 || h === 0) return null;
      return {
        origin: { x: minX, y: minY },
        width: w,
        height: h,
      } as Partial<Primitive>;
    }
    case 'circle': {
      if (grip.gripKind === 'center') return { center: newPoint } as Partial<Primitive>;
      const radius = Math.hypot(newPoint.x - original.center.x, newPoint.y - original.center.y);
      if (radius <= 0) return null;
      return { radius } as Partial<Primitive>;
    }
    case 'arc': {
      // Arc grip stretch — refit through (start', mid', end') via
      // the same circumcircle math draw-arc uses on commit.
      const startX = original.center.x + original.radius * Math.cos(original.startAngle);
      const startY = original.center.y + original.radius * Math.sin(original.startAngle);
      const endX = original.center.x + original.radius * Math.cos(original.endAngle);
      const endY = original.center.y + original.radius * Math.sin(original.endAngle);
      const midA = (original.startAngle + original.endAngle) / 2;
      const midX = original.center.x + original.radius * Math.cos(midA);
      const midY = original.center.y + original.radius * Math.sin(midA);
      const start = grip.gripKind === 'start' ? newPoint : { x: startX, y: startY };
      const mid = grip.gripKind === 'mid' ? newPoint : { x: midX, y: midY };
      const end = grip.gripKind === 'end' ? newPoint : { x: endX, y: endY };
      const cc = circumcircle(start, mid, end);
      if (!cc) return null;
      const sa = Math.atan2(start.y - cc.cy, start.x - cc.cx);
      let ea = Math.atan2(end.y - cc.cy, end.x - cc.cx);
      while (ea < sa) ea += Math.PI * 2;
      return {
        center: { x: cc.cx, y: cc.cy },
        radius: cc.r,
        startAngle: sa,
        endAngle: ea,
      } as Partial<Primitive>;
    }
    case 'xline': {
      if (grip.gripKind === 'pivot') return { pivot: newPoint } as Partial<Primitive>;
      const angle = Math.atan2(newPoint.y - original.pivot.y, newPoint.x - original.pivot.x);
      return { angle } as Partial<Primitive>;
    }
  }
}

function parsePolylinePrimitiveGrip(gripKind: string): number | null {
  const m = /^vertex-(\d+)$/.exec(gripKind);
  if (!m) return null;
  return Number.parseInt(m[1] ?? '', 10);
}

function circumcircle(
  a: Point2D,
  b: Point2D,
  c: Point2D,
): { cx: number; cy: number; r: number } | null {
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
