import { z } from 'zod';
import { DisplayOverridesSchema } from './layer.schema';
import { OwnershipStateSchema } from './ownership.schema';

// ProjectObjectSchema per ADR-019 (supersedes ADR-002).
// Adds layerId + displayOverrides + sourceKind + sourceProvenance?
// fields. `parameters` remains the JSONB bag.
// Refinement: sourceProvenance is set iff sourceKind === 'promoted'.

const PrimitiveKindSchema = z.enum([
  'point',
  'line',
  'polyline',
  'rectangle',
  'circle',
  'arc',
  'xline',
]);

export const ProjectObjectSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    classification: z.string().optional(),
    geometry: z.unknown(),
    parameters: z.record(z.string(), z.unknown()),
    ownership: OwnershipStateSchema,
    layerId: z.string(),
    displayOverrides: DisplayOverridesSchema,
    sourceKind: z.enum(['direct', 'promoted']),
    sourceProvenance: z
      .object({
        primitiveKind: PrimitiveKindSchema,
        promotedAt: z.string(),
        primitiveId: z.string(),
      })
      .optional(),
    libraryRef: z
      .object({
        source: z.string(),
        version: z.string(),
      })
      .optional(),
  })
  .refine(
    (o) => {
      if (o.sourceKind === 'promoted') return o.sourceProvenance !== undefined;
      return o.sourceProvenance === undefined;
    },
    {
      message: "sourceProvenance must be set iff sourceKind === 'promoted'",
    },
  );
