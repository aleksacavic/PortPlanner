// Draw rectangle by two opposite corners. localAxisAngle = 0 in M1.3a;
// rotated rectangles via post-creation Rotate (M1.3b).
//
// M1.3d-Remediation-3:
//  - F2: holding Shift while picking the second corner forces a square
//        (preview AND commit consistent — both read modifiers.shift via
//        editorUiStore.getState() at evaluation time).
//  - F3: typing `D` (or clicking the [Dimensions] sub-option) at the
//        second prompt switches to typed Width / Height numeric prompts;
//        rectangle commits with the entered dimensions extending right /
//        up from the first corner.

import { LayerId, type Point2D, newPrimitiveId } from '@portplanner/domain';
import { addPrimitive } from '@portplanner/project-store';

import { editorUiStore } from '../../ui-state/store';
import type { DimensionGuide, DynamicInputManifest, ToolGenerator } from '../types';

// M1.3 Round 6 — DI manifest for the primary second-corner prompt.
// Sparse: 2 number fields (W, H), combineAs numberPair. Re-uses the
// existing M1.3d-Rem-5 H1 numberPair Input arm. Plan §4.1 + Phase 2
// step 12.
const RECTANGLE_DI_MANIFEST: DynamicInputManifest = {
  fields: [
    { kind: 'number', label: 'W' },
    { kind: 'number', label: 'H' },
  ],
  combineAs: 'numberPair',
};

function squareCorner(corner1: Point2D, cursor: Point2D): Point2D {
  const dx = cursor.x - corner1.x;
  const dy = cursor.y - corner1.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  const sx = dx >= 0 ? 1 : -1;
  const sy = dy >= 0 ? 1 : -1;
  return { x: corner1.x + sx * side, y: corner1.y + sy * side };
}

export async function* drawRectangleTool(): ToolGenerator {
  const c0 = yield { text: 'Specify first corner', acceptedInputKinds: ['point'] };
  if (c0.kind !== 'point') return { committed: false, reason: 'aborted' };
  const corner1 = c0.point;
  const c1 = yield {
    text: 'Specify opposite corner or [Dimensions]',
    subOptions: [{ label: 'Dimensions', shortcut: 'd' }],
    // M1.3 Round 6 — accept numberPair on the primary prompt so the
    // DI multi-field pill flow (typed W,H + Tab + Enter) commits the
    // rectangle directly without going through the [Dimensions] sub-
    // option. AC parity for canvas-focus typing.
    acceptedInputKinds: ['point', 'subOption', 'numberPair'],
    previewBuilder: (cursor) => {
      const shift = editorUiStore.getState().modifiers.shift;
      const effectiveCursor = shift ? squareCorner(corner1, cursor) : cursor;
      return { kind: 'rectangle', corner1, cursor: effectiveCursor };
    },
    dynamicInput: RECTANGLE_DI_MANIFEST,
    // M1.3 Round 6 — dimensionGuidesBuilder mirrors previewBuilder
    // pattern. Two linear-dim guides anchored at rectangle corners:
    // W along the bottom edge, H along the right edge. Per cursor-tick
    // the runner re-invokes this and writes overlay.dimensionGuides.
    dimensionGuidesBuilder: (cursor): DimensionGuide[] => {
      const shift = editorUiStore.getState().modifiers.shift;
      const effective = shift ? squareCorner(corner1, cursor) : cursor;
      // Bottom-right corner of the rectangle preview = (effective.x, corner1.y).
      const bottomRight = { x: effective.x, y: corner1.y };
      return [
        // W: along bottom edge from corner1 → bottomRight. AC-style
        // perpendicular dim line offset 35 CSS-px outside the rectangle
        // (mockup-measured value, plan §3 A2 + docs/round-6-mockup.html).
        { kind: 'linear-dim', anchorA: corner1, anchorB: bottomRight, offsetCssPx: 35 },
        // H: along right edge from bottomRight → effective (top-right cursor).
        { kind: 'linear-dim', anchorA: bottomRight, anchorB: effective, offsetCssPx: 35 },
      ];
    },
  };

  // F3 + M1.3d-Rem-5 H1: Dimensions sub-option — single comma-pair
  // prompt (was two prompts in M1.3d-Rem-3 / pre-Rem-5). User types
  // "30,40" + Enter at the bottom command line OR via the Dynamic
  // Input pill at canvas focus; EditorRoot.handleCommandSubmit parses
  // and feeds {kind:'numberPair', a, b}. AC parity for muscle-memory.
  if (c1.kind === 'subOption' && c1.optionLabel === 'Dimensions') {
    const dims = yield {
      text: 'Specify dimensions <width,height>',
      acceptedInputKinds: ['numberPair'],
    };
    if (dims.kind !== 'numberPair') return { committed: false, reason: 'aborted' };
    const width = Math.abs(dims.a);
    const height = Math.abs(dims.b);
    if (width === 0 || height === 0) return { committed: false, reason: 'aborted' };

    const layerId = editorUiStore.getState().activeLayerId ?? LayerId.DEFAULT;
    addPrimitive({
      id: newPrimitiveId(),
      kind: 'rectangle',
      layerId,
      displayOverrides: {},
      origin: corner1,
      width,
      height,
      localAxisAngle: 0,
    });
    return { committed: true, description: 'rectangle (typed dimensions)' };
  }

  // M1.3 Round 6 — primary-prompt numberPair (typed W,H via DI pill
  // + Enter). Same width/height application as the F3 sub-flow but
  // committed without the Dimensions sub-option round-trip.
  if (c1.kind === 'numberPair') {
    const width = Math.abs(c1.a);
    const height = Math.abs(c1.b);
    if (width === 0 || height === 0) return { committed: false, reason: 'aborted' };
    const layerId = editorUiStore.getState().activeLayerId ?? LayerId.DEFAULT;
    addPrimitive({
      id: newPrimitiveId(),
      kind: 'rectangle',
      layerId,
      displayOverrides: {},
      origin: corner1,
      width,
      height,
      localAxisAngle: 0,
    });
    return { committed: true, description: 'rectangle (DI W,H)' };
  }

  if (c1.kind !== 'point') return { committed: false, reason: 'aborted' };

  // F2: if shift was held at click time, snap to square.
  const shiftAtCommit = editorUiStore.getState().modifiers.shift;
  const second = shiftAtCommit ? squareCorner(corner1, c1.point) : c1.point;

  const minX = Math.min(c0.point.x, second.x);
  const minY = Math.min(c0.point.y, second.y);
  const width = Math.abs(second.x - c0.point.x);
  const height = Math.abs(second.y - c0.point.y);
  if (width === 0 || height === 0) return { committed: false, reason: 'aborted' };

  const layerId = editorUiStore.getState().activeLayerId ?? LayerId.DEFAULT;
  addPrimitive({
    id: newPrimitiveId(),
    kind: 'rectangle',
    layerId,
    displayOverrides: {},
    origin: { x: minX, y: minY },
    width,
    height,
    localAxisAngle: 0,
  });
  return { committed: true, description: 'rectangle' };
}
