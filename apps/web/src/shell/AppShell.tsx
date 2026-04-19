import styles from './AppShell.module.css';
import { CanvasArea } from './CanvasArea';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <Navbar />
      <Sidebar side="left" title="Tools" />
      <CanvasArea />
      <Sidebar side="right" title="Properties" />
      <StatusBar />
    </div>
  );
}
