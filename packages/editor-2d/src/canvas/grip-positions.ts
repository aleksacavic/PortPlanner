// gripsOf — per-primitive-kind grip positions for click-select editing.
// M1.3d Phase 5 ships the AutoCAD-comparable subset:
//   point     → 1 grip at position
//   line      → 2 grips (p1, p2)
//   polyline  → N grips, one per vertex
//   rectangle → 4 corner grips (mid-edges + center deferred post-M1)
//   circle    → 5 grips (N/E/S/W on circumference + center)
//   arc       → 3 grips (start, mid, end)
//   xline     → 2 grips (pivot + a direction indicator at pivot+10m)
//
// Phase 6 (`gripHitTest`) and the grip-stretch tool consume these
// records. `gripKind` strings are stable identifiers the tool uses to
// decide which patch field to update on commit (e.g. 'p1' → patch.p1).

import type { Point2D, Primitive } from '@portplanner/domain';

import type { Grip } from '../ui-state/store';

const XLINE_INDICATOR_DISTANCE_M = 10;

export function gripsOf(p: Primitive): Grip[] {
  switch (p.kind) {
    case 'point':
      return [{ entityId: p.id, gripKind: 'position', position: p.position }];
    case 'line':
      return [
        { entityId: p.id, gripKind: 'p1', position: p.p1 },
        { entityId: p.id, gripKind: 'p2', position: p.p2 },
      ];
    case 'polyline':
      return p.vertices.map((v, i) => ({
        entityId: p.id,
        gripKind: `vertex-${i}`,
        position: v,
      }));
    case 'rectangle': {
      const cos = Math.cos(p.localAxisAngle);
      const sin = Math.sin(p.localAxisAngle);
      const corner = (du: number, dv: number): Point2D => ({
        x: p.origin.x + du * cos - dv * sin,
        y: p.origin.y + du * sin + dv * cos,
      });
      return [
        { entityId: p.id, gripKind: 'corner-sw', position: corner(0, 0) },
        { entityId: p.id, gripKind: 'corner-se', position: corner(p.width, 0) },
        { entityId: p.id, gripKind: 'corner-ne', position: corner(p.width, p.height) },
        { entityId: p.id, gripKind: 'corner-nw', position: corner(0, p.height) },
      ];
    }
    case 'circle':
      return [
        { entityId: p.id, gripKind: 'center', position: p.center },
        {
          entityId: p.id,
          gripKind: 'east',
          position: { x: p.center.x + p.radius, y: p.center.y },
        },
        {
          entityId: p.id,
          gripKind: 'north',
          position: { x: p.center.x, y: p.center.y + p.radius },
        },
        {
          entityId: p.id,
          gripKind: 'west',
          position: { x: p.center.x - p.radius, y: p.center.y },
        },
        {
          entityId: p.id,
          gripKind: 'south',
          position: { x: p.center.x, y: p.center.y - p.radius },
        },
      ];
    case 'arc': {
      const startX = p.center.x + p.radius * Math.cos(p.startAngle);
      const startY = p.center.y + p.radius * Math.sin(p.startAngle);
      const endX = p.center.x + p.radius * Math.cos(p.endAngle);
      const endY = p.center.y + p.radius * Math.sin(p.endAngle);
      const midA = (p.startAngle + p.endAngle) / 2;
      const midX = p.center.x + p.radius * Math.cos(midA);
      const midY = p.center.y + p.radius * Math.sin(midA);
      return [
        { entityId: p.id, gripKind: 'start', position: { x: startX, y: startY } },
        { entityId: p.id, gripKind: 'mid', position: { x: midX, y: midY } },
        { entityId: p.id, gripKind: 'end', position: { x: endX, y: endY } },
      ];
    }
    case 'xline':
      return [
        { entityId: p.id, gripKind: 'pivot', position: p.pivot },
        {
          entityId: p.id,
          gripKind: 'direction',
          position: {
            x: p.pivot.x + XLINE_INDICATOR_DISTANCE_M * Math.cos(p.angle),
            y: p.pivot.y + XLINE_INDICATOR_DISTANCE_M * Math.sin(p.angle),
          },
        },
      ];
  }
}
