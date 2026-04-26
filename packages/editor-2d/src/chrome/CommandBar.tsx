// Command bar component per ADR-023. Renders prompt line + bracket
// sub-options + history scrollback. Bound to editorUiStore via
// useEditorUi (chrome React-side).
//
// Submit + sub-option callbacks are accepted as props so the parent
// (EditorRoot) can route them into the active tool runner.

import type { ReactElement } from 'react';

import { editorUiActions } from '../ui-state/store';
import styles from './CommandBar.module.css';
import { CommandHistoryList } from './CommandHistoryList';
import { CommandPromptLine } from './CommandPromptLine';
import { useEditorUi } from './use-editor-ui-store';

export interface CommandBarProps {
  onSubOption?: (label: string) => void;
  onSubmit?: (raw: string) => void;
}

export function CommandBar(props: CommandBarProps): ReactElement {
  const cb = useEditorUi((s) => s.commandBar);

  return (
    <div className={styles.commandBar} data-component="command-bar">
      <CommandHistoryList entries={cb.history} />
      <CommandPromptLine
        prompt={cb.activePrompt}
        subOptions={cb.subOptions}
        defaultValue={cb.defaultValue}
        inputBuffer={cb.inputBuffer}
        onSubOption={(label) => {
          editorUiActions.appendHistory({
            role: 'input',
            text: label,
            timestamp: new Date().toISOString(),
          });
          props.onSubOption?.(label);
        }}
        onSubmit={(raw) => {
          if (raw.length > 0) {
            editorUiActions.appendHistory({
              role: 'input',
              text: raw,
              timestamp: new Date().toISOString(),
            });
          }
          props.onSubmit?.(raw);
        }}
      />
    </div>
  );
}
