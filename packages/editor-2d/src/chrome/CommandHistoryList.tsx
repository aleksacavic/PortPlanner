import type { ReactElement } from 'react';

import type { CommandBarHistoryEntry } from '../ui-state/store';
import styles from './CommandBar.module.css';

export interface CommandHistoryListProps {
  entries: CommandBarHistoryEntry[];
}

export function CommandHistoryList({ entries }: CommandHistoryListProps): ReactElement {
  return (
    <div className={styles.history} data-component="command-history">
      {entries.map((e, i) => (
        <div key={i} className={styles.historyItem} data-role={e.role}>
          {e.role === 'prompt' ? '> ' : ''}
          {e.text}
        </div>
      ))}
    </div>
  );
}
