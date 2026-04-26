// Operator shortcut registry per ADR-023. Maps keyboard literals to
// tool ids. Multi-letter shortcuts use an accumulator (router.ts).
//
// M1.3a operators land here. M1.3b/c additions go in
// docs/operator-shortcuts.md and get registered alongside the
// implementing tool.

export type ToolId =
  | 'select'
  | 'erase'
  | 'move'
  | 'copy'
  | 'undo'
  | 'redo'
  | 'zoom'
  | 'pan'
  | 'properties'
  | 'layer-manager'
  | 'escape'
  | 'draw-point'
  | 'draw-line'
  | 'draw-polyline'
  | 'draw-rectangle'
  | 'draw-circle'
  | 'draw-arc'
  | 'draw-xline'
  // M1.3d Phase 6 + Phase 7 — modeless drag-style tools started by
  // canvas-host (NOT by keyboard shortcut). They live in the ToolId
  // union so the registry, runner, and store-isolation can refer to
  // them, but they're absent from SINGLE_LETTER_SHORTCUTS /
  // MULTI_LETTER_SHORTCUTS — keyboard activation would be the wrong UX.
  | 'grip-stretch'
  | 'select-rect';

/** Single-letter shortcut → tool id (M1.3a essential operators + Line/Arc draw tools). */
export const SINGLE_LETTER_SHORTCUTS: Record<string, ToolId> = {
  S: 'select',
  E: 'erase',
  M: 'move',
  C: 'copy',
  U: 'undo',
  Z: 'zoom',
  P: 'pan',
  L: 'draw-line',
  A: 'draw-arc',
};

/** Multi-letter shortcut → tool id. Accumulator routes via these. */
export const MULTI_LETTER_SHORTCUTS: Record<string, ToolId> = {
  LA: 'layer-manager',
  PT: 'draw-point',
  PL: 'draw-polyline',
  REC: 'draw-rectangle',
  CC: 'draw-circle',
  XL: 'draw-xline',
  XX: 'draw-xline',
};

/** Returns the tool id for a typed accumulator buffer, or null if no match. */
export function lookupShortcut(buffer: string): ToolId | null {
  const up = buffer.toUpperCase();
  if (MULTI_LETTER_SHORTCUTS[up] !== undefined) return MULTI_LETTER_SHORTCUTS[up];
  if (up.length === 1 && SINGLE_LETTER_SHORTCUTS[up] !== undefined) {
    return SINGLE_LETTER_SHORTCUTS[up];
  }
  return null;
}

/** Returns true if `buffer` is a prefix of any multi-letter shortcut. */
export function isMultiLetterPrefix(buffer: string): boolean {
  const up = buffer.toUpperCase();
  return Object.keys(MULTI_LETTER_SHORTCUTS).some((k) => k.startsWith(up) && k !== up);
}
