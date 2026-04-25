import { z } from 'zod';

export const LineTypeSchema = z.enum(['continuous', 'dashed', 'dotted', 'dashdot']);

export const DisplayOverridesSchema = z.object({
  color: z.string().optional(),
  lineType: LineTypeSchema.optional(),
  lineWeight: z.number().optional(),
});

export const LayerSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string(),
  lineType: LineTypeSchema,
  lineWeight: z.number(),
  visible: z.boolean(),
  frozen: z.boolean(),
  locked: z.boolean(),
});
