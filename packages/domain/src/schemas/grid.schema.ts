import { z } from 'zod';

const Point2DSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const GridSchema = z.object({
  id: z.string(),
  origin: Point2DSchema,
  angle: z.number(),
  spacingX: z.number(),
  spacingY: z.number(),
  layerId: z.string(),
  visible: z.boolean(),
  activeForSnap: z.boolean(),
});
