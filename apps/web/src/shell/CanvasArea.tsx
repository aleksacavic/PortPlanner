import styles from './CanvasArea.module.css';

export function CanvasArea() {
  return (
    <div
      className={styles.canvasArea}
      aria-label="2D canvas area (Canvas2D rendering lands in M1.3)"
    >
      <div className={styles.grid} />
    </div>
  );
}
