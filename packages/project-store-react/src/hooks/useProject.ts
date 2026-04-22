import type { Project } from '@portplanner/domain';
import { useProjectStoreSelector } from '../use-project-store';

export function useProject(): Project | null {
  return useProjectStoreSelector((state) => state.project);
}
