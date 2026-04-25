// EditorRoot — top-level React component that wires the canvas host,
// command bar, properties panel, and dialog chrome into a single
// drafting surface. Phase 8 lands a placeholder; subsequent phases
// fill in canvas / chrome / state.

import type { ReactElement } from 'react';

export function EditorRoot(): ReactElement {
  return (
    <div
      data-component="editor-root"
      style={{ display: 'grid', gridTemplateRows: '1fr auto', height: '100%' }}
    >
      <div data-component="canvas-area" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* canvas-host lands in Phase 10 */}
      </div>
    </div>
  );
}
