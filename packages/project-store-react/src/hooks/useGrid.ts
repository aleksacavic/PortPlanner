import type { Grid, GridId } from '@portplanner/domain';
import { useProjectStoreSelector } from '../use-project-store';

export function useGrid(id: GridId): Grid | undefined {
  return useProjectStoreSelector((state) => state.project?.grids[id]);
}
