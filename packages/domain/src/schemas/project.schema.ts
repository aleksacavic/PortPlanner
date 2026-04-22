import { z } from 'zod';
import { CoordinateSystemSchema } from './coordinate-system.schema';
import { ProjectObjectSchema } from './object.schema';

// Default (strip) behaviour at the root — version-forward tolerance.
// `.strict()` is explicitly forbidden per M1.2 plan Phase 1 Step 8
// and ADR-015: it would reject unknown keys on future-version docs,
// breaking forward compatibility. `.passthrough()` on nested JSONB
// (Object.parameters) preserves extensible payload.

export const ProjectSchema = z.object({
  id: z.string(),
  schemaVersion: z.literal('1.0.0'),
  name: z.string().min(1).max(100),
  createdAt: z.string(),
  updatedAt: z.string(),
  coordinateSystem: CoordinateSystemSchema.nullable(),
  objects: z.record(z.string(), ProjectObjectSchema),
  scenarioId: z.string().nullable(),
});
