import type { Primitive, PrimitiveId } from '@portplanner/domain';
import { useProjectStoreSelector } from '../use-project-store';

const empty: Record<PrimitiveId, Primitive> = {};

export function usePrimitives(): Record<PrimitiveId, Primitive> {
  return useProjectStoreSelector((state) => state.project?.primitives ?? empty);
}
