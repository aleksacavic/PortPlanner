// Primitive entities per ADR-016. Seven first-class primitive kinds
// (point, line, polyline, rectangle, circle, arc, xline) plus the
// shared base shape carrying id / kind / layerId / displayOverrides.
// All point coordinates are project-local metric Float64 per ADR-001.

import type { LayerId, PrimitiveId } from '../ids';
import type { DisplayOverrides } from './layer';

export interface Point2D {
  x: number;
  y: number;
}

export type PrimitiveKind =
  | 'point'
  | 'line'
  | 'polyline'
  | 'rectangle'
  | 'circle'
  | 'arc'
  | 'xline';

export interface PrimitiveBase {
  id: PrimitiveId;
  kind: PrimitiveKind;
  layerId: LayerId;
  displayOverrides: DisplayOverrides;
}

export interface PointPrimitive extends PrimitiveBase {
  kind: 'point';
  position: Point2D;
}

export interface LinePrimitive extends PrimitiveBase {
  kind: 'line';
  p1: Point2D;
  p2: Point2D;
}

/**
 * Polyline with DXF-convention bulge per segment. `bulge === 0` is a
 * straight segment; non-zero encodes `tan(θ/4)` where θ is the included
 * arc angle, sign = direction. When `closed`, `bulges.length === vertices.length`
 * (last bulge applies to the wrap-around segment N-1 → 0); when open,
 * `bulges.length === vertices.length - 1`.
 */
export interface PolylinePrimitive extends PrimitiveBase {
  kind: 'polyline';
  vertices: Point2D[];
  bulges: number[];
  closed: boolean;
}

export interface RectanglePrimitive extends PrimitiveBase {
  kind: 'rectangle';
  origin: Point2D;
  width: number;
  height: number;
  /** Rotation of the local +X axis from project +X, radians CCW. */
  localAxisAngle: number;
}

export interface CirclePrimitive extends PrimitiveBase {
  kind: 'circle';
  center: Point2D;
  radius: number;
}

export interface ArcPrimitive extends PrimitiveBase {
  kind: 'arc';
  center: Point2D;
  radius: number;
  /** Radians, CCW from +X. */
  startAngle: number;
  /** Radians, CCW from +X. By convention `endAngle > startAngle`. */
  endAngle: number;
}

export interface XlinePrimitive extends PrimitiveBase {
  kind: 'xline';
  pivot: Point2D;
  /** Radians, CCW from +X. */
  angle: number;
}

export type Primitive =
  | PointPrimitive
  | LinePrimitive
  | PolylinePrimitive
  | RectanglePrimitive
  | CirclePrimitive
  | ArcPrimitive
  | XlinePrimitive;

/** Snapshot alias used by ADR-020 Operation `before` / `after`. */
export type PrimitiveSnapshot = Primitive;
