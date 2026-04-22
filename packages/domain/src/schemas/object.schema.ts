import { z } from 'zod';
import { OwnershipStateSchema } from './ownership.schema';

// `parameters` is typed as a record of unknown — the JSONB bag per
// ADR-002. Concrete per-type parameter schemas arrive in M1.4+.

export const ProjectObjectSchema = z.object({
  id: z.string(),
  type: z.string(),
  classification: z.string().optional(),
  geometry: z.unknown(),
  parameters: z.record(z.string(), z.unknown()),
  ownership: OwnershipStateSchema,
  libraryRef: z
    .object({
      source: z.string(),
      version: z.string(),
    })
    .optional(),
});
