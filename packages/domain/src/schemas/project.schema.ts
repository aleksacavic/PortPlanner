import { z } from 'zod';
import { CoordinateSystemSchema } from './coordinate-system.schema';
import { GridSchema } from './grid.schema';
import { LayerSchema } from './layer.schema';
import { ProjectObjectSchema } from './object.schema';
import { PrimitiveSchema } from './primitive.schema';

// Default (strip) behaviour at the root — version-forward tolerance.
// `.strict()` is explicitly forbidden per M1.2 plan Phase 1 Step 8
// and ADR-015: it would reject unknown keys on future-version docs,
// breaking forward compatibility. `.passthrough()` on nested JSONB
// (Object.parameters) preserves extensible payload.
//
// schemaVersion bumped 1.0.0 → 1.1.0 in M1.3a per GR-1 clean break:
// adds `primitives`, `layers`, `grids` maps. Old `1.0.0` projects
// fail to load with LoadFailure; no migration shim per GR-1.
//
// M1.3 snap-engine-extension Phase 3: bumped 1.1.0 → 1.2.0 (clean-
// break per A9 / I-PT-1). Adds optional `displayShape` field on Point
// primitives with `.default('circle-dot')`. Old 1.1.0 projects fail
// to load with LoadFailure — no migration shim per GR-1 +
// architecture-contract §0.6 preproduction posture.

export const ProjectSchema = z.object({
  id: z.string(),
  schemaVersion: z.literal('1.2.0'),
  name: z.string().min(1).max(100),
  createdAt: z.string(),
  updatedAt: z.string(),
  coordinateSystem: CoordinateSystemSchema.nullable(),
  objects: z.record(z.string(), ProjectObjectSchema),
  primitives: z.record(z.string(), PrimitiveSchema),
  layers: z.record(z.string(), LayerSchema),
  grids: z.record(z.string(), GridSchema),
  scenarioId: z.string().nullable(),
});
