import type { Grid, GridId } from '@portplanner/domain';
import { useProjectStoreSelector } from '../use-project-store';

const empty: Record<GridId, Grid> = {};

export function useGrids(): Record<GridId, Grid> {
  return useProjectStoreSelector((state) => state.project?.grids ?? empty);
}
