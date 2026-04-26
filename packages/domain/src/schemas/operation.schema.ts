// OperationSchema per ADR-020 (supersedes ADR-010). Discriminated
// TargetSnapshot covers object / primitive / layer / grid arms;
// 'dimension' arm is reserved for M1.3c with `z.never()` payload
// (Condition 2 of progressive implementation per §0.7 — runtime
// rejection mirrors the type-level unreachability).

import { z } from 'zod';
import { GridSchema } from './grid.schema';
import { LayerSchema } from './layer.schema';
import { ProjectObjectSchema } from './object.schema';
import { PrimitiveSchema } from './primitive.schema';

const OperationTypeSchema = z.enum([
  'CREATE',
  'UPDATE',
  'DELETE',
  'GENERATE',
  'FREEZE',
  'DETACH',
  'UNFREEZE',
]);

const TargetKindSchema = z.enum(['object', 'primitive', 'dimension', 'layer', 'grid']);

const TargetSnapshotSchema = z.union([
  z.object({ kind: z.literal('object'), snapshot: ProjectObjectSchema }),
  z.object({ kind: z.literal('primitive'), snapshot: PrimitiveSchema }),
  z.object({ kind: z.literal('layer'), snapshot: LayerSchema }),
  z.object({ kind: z.literal('grid'), snapshot: GridSchema }),
  z.object({ kind: z.literal('dimension'), snapshot: z.never() }),
]);

export const OperationSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sequence: z.number().int().nonnegative(),
  timestamp: z.string(),
  userId: z.string(),
  type: OperationTypeSchema,
  targetKind: TargetKindSchema,
  targetId: z.string(),
  before: TargetSnapshotSchema.nullable(),
  after: TargetSnapshotSchema.nullable(),
  promotionGroupId: z.string().optional(),
});
