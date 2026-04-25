import type { Layer, LayerId } from '@portplanner/domain';
import { useProjectStoreSelector } from '../use-project-store';

const empty: Record<LayerId, Layer> = {};

export function useLayers(): Record<LayerId, Layer> {
  return useProjectStoreSelector((state) => state.project?.layers ?? empty);
}
