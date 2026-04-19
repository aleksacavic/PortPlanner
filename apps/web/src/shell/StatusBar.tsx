import styles from './StatusBar.module.css';

export function StatusBar() {
  return (
    <footer className={styles.statusBar}>
      <div className={styles.left}>Ready</div>
      <div className={styles.right}>v0.1.0</div>
    </footer>
  );
}
