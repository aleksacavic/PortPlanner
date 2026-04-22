import type { ObjectId, ProjectObject } from '@portplanner/domain';
import { useProjectStoreSelector } from '../use-project-store';

export function useObjectById(id: ObjectId): ProjectObject | undefined {
  return useProjectStoreSelector((state) => state.project?.objects[id]);
}
