import { useProjectStoreSelector } from '../use-project-store';

export function useLastSavedAt(): string | null {
  return useProjectStoreSelector((state) => state.lastSavedAt);
}
