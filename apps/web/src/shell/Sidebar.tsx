import styles from './Sidebar.module.css';

interface SidebarProps {
  side: 'left' | 'right';
  title: string;
}

export function Sidebar({ side, title }: SidebarProps) {
  return (
    <aside className={side === 'left' ? styles.leftSidebar : styles.rightSidebar}>
      <div className={styles.header}>{title}</div>
      <div className={styles.body} aria-label={`${title} panel content`} />
    </aside>
  );
}
