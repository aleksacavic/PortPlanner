import { useProjectStoreSelector } from '../use-project-store';

export function useIsDirty(): boolean {
  return useProjectStoreSelector((state) => state.dirty);
}
