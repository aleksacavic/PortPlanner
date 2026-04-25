import type { Primitive, PrimitiveId } from '@portplanner/domain';
import { useProjectStoreSelector } from '../use-project-store';

export function usePrimitive(id: PrimitiveId): Primitive | undefined {
  return useProjectStoreSelector((state) => state.project?.primitives[id]);
}
