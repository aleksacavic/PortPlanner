import { NewProjectButton } from '../toolbar/NewProjectButton';
import { SaveButton } from '../toolbar/SaveButton';
import styles from './Navbar.module.css';

export function Navbar() {
  return (
    <header className={styles.navbar}>
      <div className={styles.brand}>PortPlanner</div>
      <div className={styles.controls}>
        <NewProjectButton />
        <SaveButton />
      </div>
    </header>
  );
}
