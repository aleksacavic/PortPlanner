import type { ProjectId } from '@portplanner/domain';
import { useProjectStoreSelector } from '../use-project-store';

export function useProjectId(): ProjectId | null {
  return useProjectStoreSelector((state) => state.project?.id ?? null);
}
