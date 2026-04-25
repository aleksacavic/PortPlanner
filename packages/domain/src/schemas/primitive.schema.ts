// Zod schemas for the seven primitive kinds per ADR-016.
// Note: `z.discriminatedUnion` rejects refined object arms, so we use
// `z.union` for the public PrimitiveSchema. Type narrowing on `kind`
// still works because each arm declares `z.literal(...)`.

import { z } from 'zod';

const Point2DSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const DisplayOverridesShape = z.object({
  color: z.string().optional(),
  lineType: z.enum(['continuous', 'dashed', 'dotted', 'dashdot']).optional(),
  lineWeight: z.number().optional(),
});

const BaseShape = {
  id: z.string(),
  layerId: z.string(),
  displayOverrides: DisplayOverridesShape,
};

const PointPrimitiveSchema = z.object({
  ...BaseShape,
  kind: z.literal('point'),
  position: Point2DSchema,
});

const LinePrimitiveSchema = z.object({
  ...BaseShape,
  kind: z.literal('line'),
  p1: Point2DSchema,
  p2: Point2DSchema,
});

const PolylinePrimitiveSchema = z
  .object({
    ...BaseShape,
    kind: z.literal('polyline'),
    vertices: z.array(Point2DSchema),
    bulges: z.array(z.number()),
    closed: z.boolean(),
  })
  .refine((p) => (p.closed ? p.vertices.length >= 3 : true), {
    message: 'closed polyline requires vertices.length >= 3',
  })
  .refine((p) => p.bulges.length === (p.closed ? p.vertices.length : p.vertices.length - 1), {
    message:
      'bulges.length must equal vertices.length when closed and vertices.length - 1 when open',
  });

const RectanglePrimitiveSchema = z.object({
  ...BaseShape,
  kind: z.literal('rectangle'),
  origin: Point2DSchema,
  width: z.number(),
  height: z.number(),
  localAxisAngle: z.number(),
});

const CirclePrimitiveSchema = z.object({
  ...BaseShape,
  kind: z.literal('circle'),
  center: Point2DSchema,
  radius: z.number(),
});

const ArcPrimitiveSchema = z.object({
  ...BaseShape,
  kind: z.literal('arc'),
  center: Point2DSchema,
  radius: z.number(),
  startAngle: z.number(),
  endAngle: z.number(),
});

const XlinePrimitiveSchema = z.object({
  ...BaseShape,
  kind: z.literal('xline'),
  pivot: Point2DSchema,
  angle: z.number(),
});

export const PrimitiveSchema = z.union([
  PointPrimitiveSchema,
  LinePrimitiveSchema,
  PolylinePrimitiveSchema,
  RectanglePrimitiveSchema,
  CirclePrimitiveSchema,
  ArcPrimitiveSchema,
  XlinePrimitiveSchema,
]);
