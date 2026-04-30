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

/**
 * Display shape of a Point primitive (M1.3 snap-engine-extension
 * Phase 3). Three options. Default is `'circle-dot'` (a small circle
 * outline with a 1-px center dot — visually distinct from snap glyphs
 * which are now outline-only per Round-7 backlog B1, and distinct from
 * vertex grips which are filled). Old projects (1.1.0 schema) reject
 * on parse per the clean-break policy (A9 / I-PT-1); 1.2.0 saves that
 * omit `displayShape` get `'circle-dot'` filled in by the schema's
 * `.default()` (in-flight 1.2.0 tolerance, NOT a 1.1.0 compat
 * scaffold).
 */
export type PointDisplayShape = 'dot' | 'x' | 'circle-dot';

export interface PointPrimitive extends PrimitiveBase {
  kind: 'point';
  position: Point2D;
  /** Display shape (M1.3 snap-engine-extension Phase 3). Optional
   *  on the interface; the schema's `.default('circle-dot')` ensures
   *  every parsed instance has a concrete value. */
  displayShape?: PointDisplayShape;
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
