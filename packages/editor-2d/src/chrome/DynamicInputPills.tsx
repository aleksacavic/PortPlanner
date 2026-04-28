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

import { metricToScreen } from '../canvas/view-transform';
import type { DimensionGuide } from '../tools/types';
import styles from './DynamicInputPills.module.css';
import { useEditorUi } from './use-editor-ui-store';

const FALLBACK_PILL_OFFSET_X_PX = 16;
const FALLBACK_PILL_OFFSET_Y_PX = 28;

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
          const anchorMetric = derivePillAnchorMetric(guide);
          const screen = metricToScreen(anchorMetric, viewport);
          const focused = idx === dynamicInput.activeFieldIdx;
          const buffer = dynamicInput.buffers[idx] ?? '';
          const labelPrefix = field.label ? `${field.label}: ` : '';
          const text = `${labelPrefix}${buffer}`;
          return (
            <div
              key={`di-pill-${idx}`}
              className={`${styles.pill} ${focused ? styles.pillFocused : ''}`}
              data-component="dynamic-input-pill"
              data-pill-index={idx}
              data-pill-focused={focused ? 'true' : 'false'}
              style={{
                transform: `translate(${screen.x + FALLBACK_PILL_OFFSET_X_PX}px, ${screen.y + FALLBACK_PILL_OFFSET_Y_PX}px)`,
              }}
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
 * Derive a metric anchor point for the pill from a `DimensionGuide`.
 * Plan §4.1 Pills row: linear-dim → midpoint of [anchorA, anchorB];
 * angle-arc → on the arc at sweep midpoint (computed in metric);
 * radius-line → midpoint of [pivot, endpoint].
 *
 * For angle-arc, the arc radius is in screen-px (`radiusCssPx`); we
 * approximate the metric anchor by placing the pill at the pivot —
 * the fixed screen offset (FALLBACK_PILL_OFFSET_X_PX/Y_PX) carries
 * the pill off the pivot visually. A more accurate variant could
 * convert radiusCssPx through viewport.zoom; v0 is intentionally
 * simple and refines if visual-test feedback warrants.
 */
function derivePillAnchorMetric(guide: DimensionGuide): Point2D {
  switch (guide.kind) {
    case 'linear-dim':
      return {
        x: (guide.anchorA.x + guide.anchorB.x) / 2,
        y: (guide.anchorA.y + guide.anchorB.y) / 2,
      };
    case 'angle-arc':
      return { x: guide.pivot.x, y: guide.pivot.y };
    case 'radius-line':
      return {
        x: (guide.pivot.x + guide.endpoint.x) / 2,
        y: (guide.pivot.y + guide.endpoint.y) / 2,
      };
  }
}
