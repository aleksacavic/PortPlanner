import styles from './Navbar.module.css';

export function Navbar() {
  return (
    <header className={styles.navbar}>
      <div className={styles.brand}>PortPlanner</div>
      <div className={styles.controls} aria-label="Toolbar (tool controls land in M1.3 / M1.4)" />
    </header>
  );
}
