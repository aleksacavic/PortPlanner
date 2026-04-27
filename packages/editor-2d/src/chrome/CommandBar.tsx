// Command bar component per ADR-023. Renders prompt line + bracket
// sub-options + history scrollback. Bound to editorUiStore via
// useEditorUi (chrome React-side).
//
// Submit + sub-option callbacks are accepted as props so the parent
// (EditorRoot) can route them into the active tool runner.
//
// M1.3d-Remediation-3 F7 — tool badge: when a user-invoked tool is
// active, render a colored pill ("LINE", "CIRCLE", "MOVE", etc.) to
// the left of the prompt line. Internal tools (select-rect,
// grip-stretch, escape) map to null in TOOL_DISPLAY_NAMES and don't
// render. Visual anchor reinforcing F5's grip-feeds-point semantic.

import type { ReactElement } from 'react';

import { TOOL_DISPLAY_NAMES, type ToolId } from '../keyboard/shortcuts';
import { editorUiActions } from '../ui-state/store';
import styles from './CommandBar.module.css';
import { CommandHistoryList } from './CommandHistoryList';
import { CommandPromptLine } from './CommandPromptLine';
import { useEditorUi } from './use-editor-ui-store';

export interface CommandBarProps {
  onSubOption?: (label: string) => void;
  onSubmit?: (raw: string) => void;
}

function lookupBadgeName(activeToolId: string | null): string | null {
  if (activeToolId === null) return null;
  // TOOL_DISPLAY_NAMES is keyed by the ToolId union; a runtime
  // activeToolId outside that union (shouldn't happen, but defensive)
  // returns null and renders no badge.
  const name = TOOL_DISPLAY_NAMES[activeToolId as ToolId];
  return name ?? null;
}

export function CommandBar(props: CommandBarProps): ReactElement {
  const cb = useEditorUi((s) => s.commandBar);
  const activeToolId = useEditorUi((s) => s.activeToolId);
  const badgeName = lookupBadgeName(activeToolId);

  return (
    <div className={styles.commandBar} data-component="command-bar">
      <CommandHistoryList entries={cb.history} />
      <div className={styles.promptRow}>
        {badgeName !== null ? (
          <span className={styles.toolBadge} data-component="command-tool-badge">
            {badgeName}
          </span>
        ) : null}
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
    </div>
  );
}
