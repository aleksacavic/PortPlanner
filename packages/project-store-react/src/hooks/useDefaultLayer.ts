import { type Layer, LayerId } from '@portplanner/domain';
import { useProjectStoreSelector } from '../use-project-store';

export function useDefaultLayer(): Layer | undefined {
  return useProjectStoreSelector((state) => state.project?.layers[LayerId.DEFAULT]);
}
