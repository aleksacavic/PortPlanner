// Dynamic Input pills — multi-pill chrome for the M1.3 Round 6 DI
// manifest. Plan §4.1 Pills row + §3 A2.1.
//
// Renders one of three modes based on store state:
//   1. 0 pills if `toggles.dynamicInput` is false.
//   2. N pills if `commandBar.dynamicInput.manifest !== null` AND
//      `overlay.dimensionGuides` is populated. Each pill anchors to a
//      derivation of `overlay.dimensionGuides[N]` (linear-dim midpoint /
//      angle-arc midpoint / radius-line midpoint) converted to screen
//      via `metricToScreen` + small screen-px offset. Focused pill
//      (`activeFieldIdx`) gets a glow ring + animated caret.
//   3. 1 fallback pill at `cursor.screen + offset` if no manifest but
//      `inputBuffer` / `accumulator` / `activePrompt` is non-empty —
//      preserves M1.3d-Remediation-4 G2 single-pill behavior for
//      non-DI prompts.
//
// SSOT: this component reads ONLY ui-state slice fields; no local
// state. Multi-source reads (commandBar + overlay + viewport) are
// allowed in chrome — the painter contract restriction (DTP-T6
// project-store ban) does not apply to React components.
//
// Re-renders on cursor / viewport / overlay.dimensionGuides /
// commandBar.dynamicInput change.

import type { Point2D } from '@portplanner/domain';
import type { ReactElement } from 'react';

import { type Viewport, metricToScreen } from '../canvas/view-transform';
import type { DimensionGuide } from '../tools/types';
import styles from './DynamicInputPills.module.css';
import { useEditorUi } from './use-editor-ui-store';

const FALLBACK_PILL_OFFSET_X_PX = 16;
const FALLBACK_PILL_OFFSET_Y_PX = 28;
// Linear-dim FULL-mode pill perpendicular offset (matches paintDimensionGuides
// dim-line offset). Pill sits ON the dim line, centered via CSS
// translate(-50%, -50%).
// Inline-mode (offsetCssPx === 0) pills sit on the segment midpoint with
// no perpendicular offset.

export function DynamicInputPills(): ReactElement | null {
  const cursor = useEditorUi((s) => s.overlay.cursor);
  const inputBuffer = useEditorUi((s) => s.commandBar.inputBuffer);
  const accumulator = useEditorUi((s) => s.commandBar.accumulator);
  const activePrompt = useEditorUi((s) => s.commandBar.activePrompt);
  const dynEnabled = useEditorUi((s) => s.toggles.dynamicInput);
  const dynamicInput = useEditorUi((s) => s.commandBar.dynamicInput);
  const dimensionGuides = useEditorUi((s) => s.overlay.dimensionGuides);
  const viewport = useEditorUi((s) => s.viewport);

  if (!dynEnabled) return null;

  // Multi-pill mode (DI manifest active). Defensive check: pill array
  // renders only when BOTH manifest AND guides are present, with
  // matching field count (per first-frame coherence invariant in plan
  // §3 A2.1; if violated by a future bug, falls through to single-pill
  // path or null — graceful degradation).
  if (
    dynamicInput &&
    dimensionGuides &&
    dimensionGuides.length === dynamicInput.manifest.fields.length
  ) {
    return (
      <>
        {dynamicInput.manifest.fields.map((field, idx) => {
          const guide = dimensionGuides[idx];
          if (!guide) return null;
          const screen = derivePillScreenAnchor(guide, viewport);
          const focused = idx === dynamicInput.activeFieldIdx;
          const buffer = dynamicInput.buffers[idx] ?? '';
          const labelPrefix = field.label ? `${field.label}: ` : '';
          const text = `${labelPrefix}${buffer}`;
          // Multi-pill mode: pill centered on dim-line midpoint via
          // .pillCentered translate(-50%, -50%). Inline left/top set
          // to absolute screen position. AC parity per mockup.
          const focusClass = focused ? styles.pillFocused : styles.pillDimmed;
          return (
            <div
              key={`di-pill-${idx}`}
              className={`${styles.pill} ${styles.pillCentered} ${focusClass}`}
              data-component="dynamic-input-pill"
              data-pill-index={idx}
              data-pill-focused={focused ? 'true' : 'false'}
              style={{ left: `${screen.x}px`, top: `${screen.y}px` }}
            >
              {text}
              {focused ? <span className={styles.pillCaret} aria-hidden /> : null}
            </div>
          );
        })}
      </>
    );
  }

  // Single fallback pill (legacy M1.3d-Remediation-4 G2 behavior).
  if (!cursor) return null;
  const fallbackText = inputBuffer || accumulator || activePrompt;
  if (!fallbackText) return null;
  return (
    <div
      className={styles.pill}
      data-component="dynamic-input-pill"
      style={{
        transform: `translate(${cursor.screen.x + FALLBACK_PILL_OFFSET_X_PX}px, ${cursor.screen.y + FALLBACK_PILL_OFFSET_Y_PX}px)`,
      }}
    >
      {fallbackText}
    </div>
  );
}

/**
 * Compute a SCREEN-SPACE anchor point for a pill given its
 * DimensionGuide. Returns `{x, y}` in CSS pixels (viewport-screen
 * coordinates) — the multi-pill mode then sets `left` + `top` to
 * these and centers the pill rectangle via `.pillCentered`.
 *
 * Per-kind logic (mockup-grounded):
 *   - linear-dim FULL (offsetCssPx > 0): pill on the DIM-LINE midpoint
 *     (segment midpoint + perpendicular offsetCssPx). Computed in
 *     screen space because the perpendicular offset is screen-px.
 *   - linear-dim INLINE (offsetCssPx === 0): pill on the SEGMENT
 *     midpoint (no perpendicular offset). The line itself is the
 *     dim reference.
 *   - angle-arc: pill on the ARC MIDPOINT — pivot + radiusCssPx
 *     (cos(midAngle), sin(midAngle)) in screen space (radius is
 *     screen-px, so screen-space placement avoids zoom-distortion
 *     of the offset).
 *   - radius-line: pill on the segment midpoint between pivot and
 *     endpoint (paintPreview's circle arm draws the actual line; the
 *     pill sits on its midpoint).
 */
function derivePillScreenAnchor(guide: DimensionGuide, viewport: Viewport): Point2D {
  switch (guide.kind) {
    case 'linear-dim': {
      const ascr = metricToScreen(guide.anchorA, viewport);
      const bscr = metricToScreen(guide.anchorB, viewport);
      const midX = (ascr.x + bscr.x) / 2;
      const midY = (ascr.y + bscr.y) / 2;
      if (guide.offsetCssPx === 0) {
        return { x: midX, y: midY };
      }
      // Perpendicular in screen space (rotated 90° CCW from segment).
      const dx = bscr.x - ascr.x;
      const dy = bscr.y - ascr.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) return { x: midX, y: midY };
      const perpX = -dy / len;
      const perpY = dx / len;
      return {
        x: midX + perpX * guide.offsetCssPx,
        y: midY + perpY * guide.offsetCssPx,
      };
    }
    case 'angle-arc': {
      const pivot = metricToScreen(guide.pivot, viewport);
      const midAngleRad = guide.baseAngleRad + guide.sweepAngleRad / 2;
      // Screen-Y is flipped relative to metric-Y, so negate the sin
      // term when projecting from the (positive-CCW) angle into screen
      // space.
      return {
        x: pivot.x + Math.cos(midAngleRad) * guide.radiusCssPx,
        y: pivot.y - Math.sin(midAngleRad) * guide.radiusCssPx,
      };
    }
    case 'radius-line': {
      const pivot = metricToScreen(guide.pivot, viewport);
      const endpoint = metricToScreen(guide.endpoint, viewport);
      return {
        x: (pivot.x + endpoint.x) / 2,
        y: (pivot.y + endpoint.y) / 2,
      };
    }
  }
}
