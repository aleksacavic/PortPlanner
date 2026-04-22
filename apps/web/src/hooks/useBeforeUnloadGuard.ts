// M1.2 Phase 5 — "leave without saving?" browser guard.
// Subscribes to dirty state; installs a beforeunload listener that
// triggers the browser's built-in confirm dialog when dirty.

import { useIsDirty } from '@portplanner/project-store-react';
import { useEffect } from 'react';

export function useBeforeUnloadGuard(): void {
  const dirty = useIsDirty();
  useEffect(() => {
    if (!dirty) {
      return;
    }
    function handler(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Modern browsers show a generic localized message; returnValue
      // must be set for legacy compatibility.
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [dirty]);
}
