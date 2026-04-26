import { type FormEvent, type ReactElement, useEffect, useRef, useState } from 'react';

import { editorUiActions } from '../ui-state/store';
import type { SubOption } from '../ui-state/store';
import styles from './CommandBar.module.css';

export interface CommandPromptLineProps {
  prompt: string | null;
  subOptions: SubOption[];
  defaultValue: string | null;
  inputBuffer: string;
  onSubOption: (label: string) => void;
  onSubmit: (raw: string) => void;
}

export function CommandPromptLine(props: CommandPromptLineProps): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [local, setLocal] = useState(props.inputBuffer);

  useEffect(() => setLocal(props.inputBuffer), [props.inputBuffer]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    props.onSubmit(local);
    setLocal('');
  };

  return (
    <form className={styles.promptLine} onSubmit={handleSubmit} data-component="command-prompt">
      <span className={styles.promptText}>{props.prompt ?? 'Command:'}</span>
      {props.subOptions.length > 0 && (
        <span>
          [
          {props.subOptions.map((opt, i) => (
            <span key={opt.label}>
              {i > 0 ? '/' : ''}
              <span
                className={styles.subOption}
                onClick={() => props.onSubOption(opt.label)}
                role="button"
              >
                {opt.label}
              </span>
            </span>
          ))}
          ]
        </span>
      )}
      {props.defaultValue !== null && <span>{`<${props.defaultValue}>`}</span>}
      <input
        ref={inputRef}
        className={styles.input}
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          editorUiActions.setInputBuffer(e.target.value);
        }}
        onFocus={() => editorUiActions.setFocusHolder('bar')}
        onBlur={() => editorUiActions.setFocusHolder('canvas')}
        data-component="command-input"
      />
    </form>
  );
}
