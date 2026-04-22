import { useAutoLoadMostRecent } from './hooks/useAutoLoadMostRecent';
import { useBeforeUnloadGuard } from './hooks/useBeforeUnloadGuard';
import { AppShell } from './shell/AppShell';

export function App() {
  useAutoLoadMostRecent();
  useBeforeUnloadGuard();
  return <AppShell />;
}
