import type { Layer, LayerId } from '@portplanner/domain';
import { useProjectStoreSelector } from '../use-project-store';

export function useLayer(id: LayerId): Layer | undefined {
  return useProjectStoreSelector((state) => state.project?.layers[id]);
}
