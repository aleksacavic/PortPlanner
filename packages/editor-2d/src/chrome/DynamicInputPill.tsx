// Dynamic Input pill — small floating chrome anchored to the cursor.
// M1.3d-Remediation-4 G2.
//
// Renders the in-flight `commandBar.inputBuffer` (digits/punctuation
// the user is typing as a value) OR `commandBar.accumulator` (letters
// the user is typing as a tool-activation shortcut) OR
// `commandBar.activePrompt` (current tool's prompt text when neither
// buffer has content yet). Visibility is gated on
// `toggles.dynamicInput` (F12) and on `overlay.cursor` being non-null.
//
// SSOT note: this component reads ONLY ui-state slice fields; it has
// NO local state. The bottom command line (CommandBar.tsx) is the
// canonical history surface; this pill is an alternate visual mirror
// of the same in-flight buffer/accumulator. See plan §3 A13.
//
// Position: absolute, anchored at `cursor.screen + {dx: 16, dy: +28}`
// so it sits below-and-to-the-right of the cursor (M1.3d-Rem-5 H3 —
// flipped from the original `dy: -24` to clear the bottom command
// line area when the cursor is near the canvas bottom). pointer-events
// none so it never intercepts clicks.

import type { ReactElement } from 'react';

import styles from './DynamicInputPill.module.css';
import { useEditorUi } from './use-editor-ui-store';

const PILL_OFFSET_X_PX = 16;
const PILL_OFFSET_Y_PX = 28;

export function DynamicInputPill(): ReactElement | null {
  const cursor = useEditorUi((s) => s.overlay.cursor);
  const inputBuffer = useEditorUi((s) => s.commandBar.inputBuffer);
  const accumulator = useEditorUi((s) => s.commandBar.accumulator);
  const activePrompt = useEditorUi((s) => s.commandBar.activePrompt);
  const dynEnabled = useEditorUi((s) => s.toggles.dynamicInput);

  if (!dynEnabled) return null;
  if (!cursor) return null;

  // Content priority per plan §3 A3: inputBuffer > accumulator >
  // activePrompt. When all three are empty/null, hide.
  const text = inputBuffer || accumulator || activePrompt;
  if (!text) return null;

  return (
    <div
      className={styles.pill}
      data-component="dynamic-input-pill"
      style={{
        transform: `translate(${cursor.screen.x + PILL_OFFSET_X_PX}px, ${cursor.screen.y + PILL_OFFSET_Y_PX}px)`,
      }}
    >
      {text}
    </div>
  );
}
