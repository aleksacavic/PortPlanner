import { z } from 'zod';
import { ProjectObjectSchema } from './object.schema';

const OperationTypeSchema = z.enum([
  'CREATE',
  'UPDATE',
  'DELETE',
  'GENERATE',
  'FREEZE',
  'DETACH',
  'UNFREEZE',
]);

export const OperationSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sequence: z.number().int().nonnegative(),
  timestamp: z.string(),
  userId: z.string(),
  type: OperationTypeSchema,
  objectId: z.string(),
  before: ProjectObjectSchema.nullable(),
  after: ProjectObjectSchema.nullable(),
});
