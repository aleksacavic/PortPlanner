// Dynamic Input pills — multi-pill chrome for the M1.3 Round 6 DI
// manifest. Plan §4.1 Pills row + §3 A2.1; ADR-025 §7 (angle-pill
// placement at arc midpoint).
//
// Renders one of three modes based on store state:
//   1. 0 pills if `toggles.dynamicInput` is false.
//   2. N pills if `commandBar.dynamicInput.manifest !== null` AND
//      `overlay.dimensionGuides` is populated. Each pill anchors to a
//      derivation of `overlay.dimensionGuides[N]` (linear-dim midpoint
//      or angle-arc midpoint) converted to screen via `metricToScreen`.
//      Focused pill (`activeFieldIdx`) gets a glow ring + animated
//      caret.
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

/**
 * **M1.3 DI pipeline overhaul Phase 2 (B6) — live cursor read.**
 *
 * Compute the displayed value for an empty + unlocked pill from its
 * matching dimension guide. This is the live cursor-derived value the
 * user sees update per cursor frame: linear-dim → distance (length of
 * anchorB - anchorA), angle-arc → degrees (sweepAngleRad converted).
 *
 * Per plan A6, no unit suffix appended (recall pill in Phase 4 also
 * suppresses units). Per plan A15, distance uses 3 decimals; angle
 * uses 2 decimals.
 *
 * Single argument (per plan Phase 2 step 1): the guide carries
 * everything needed (kind + numeric inputs). The field-kind → format
 * mapping is bijective with `guide.kind` for the 5-tool matrix.
 */
function deriveLivePillValue(guide: DimensionGuide): string {
  switch (guide.kind) {
    case 'linear-dim': {
      const len = Math.hypot(guide.anchorB.x - guide.anchorA.x, guide.anchorB.y - guide.anchorA.y);
      return len.toFixed(3);
    }
    case 'angle-arc': {
      const deg = (guide.sweepAngleRad * 180) / Math.PI;
      return deg.toFixed(2);
    }
  }
}

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
          const isLocked = dynamicInput.locked[idx] ?? false;
          // M1.3 DI pipeline overhaul Phase 2 (B6) — live-value render.
          // Render-path priority: typed buffer → typed display (abs)
          // > locked + empty → blank (degenerate state)
          // > unlocked + empty → live cursor read from guide.
          // Phase 4 retires the placeholder slice field; Phase 2 stops
          // reading it here so the placeholder mechanic is unreachable.
          let valueText: string;
          if (buffer.length > 0) {
            // Plan A1: pill displays absolute value of typed buffer
            // (typed `-5` → `5`; sign retained in buffer for combiner).
            valueText = buffer.startsWith('-') ? buffer.slice(1) : buffer;
          } else if (isLocked) {
            // Empty + locked: degenerate edge case (Backspace-on-locked
            // or programmatic setDynamicInputFieldLocked on empty). Pill
            // renders empty value (label only); user can re-type and
            // lock stays on. Plan §13 risk row + I-DI-2.
            valueText = '';
          } else {
            // Empty + unlocked: live cursor read from the matching
            // dimension guide (B6). Updates per cursor frame because
            // dimensionGuides is rewritten by the runner subscription.
            valueText = deriveLivePillValue(guide);
          }
          const labelPrefix = field.label ? `${field.label}: ` : '';
          const text = `${labelPrefix}${valueText}`;
          const focusClass = focused ? styles.pillFocused : styles.pillDimmed;
          return (
            <div
              key={`di-pill-${idx}`}
              className={`${styles.pill} ${styles.pillCentered} ${focusClass}`}
              data-component="dynamic-input-pill"
              data-pill-index={idx}
              data-pill-focused={focused ? 'true' : 'false'}
              data-pill-locked={isLocked ? 'true' : 'false'}
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
 *   - angle-arc: pill at the ARC MIDPOINT — pivot + radiusMetric ×
 *     (cos midAngle, sin midAngle) projected through metricToScreen.
 *     Since the arc radius is the full line length, the midpoint sits
 *     halfway along the arc, dead center of the wedge.
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
      // Compute perpendicular in METRIC space (matches painter's
      // direction), then project to screen coords with the Y-flip.
      // Bug pre-fix: computing perp from screen deltas directly gave
      // the OPPOSITE direction (rectangle W/H pills landed INSIDE the
      // rectangle instead of on the dim line outside it). Painter
      // operates in metric space where +Y is up; screen has +Y down,
      // so the metric perp's Y component must be negated for screen.
      const a = guide.anchorA;
      const b = guide.anchorB;
      const metricDx = b.x - a.x;
      const metricDy = b.y - a.y;
      const len = Math.hypot(metricDx, metricDy);
      if (len === 0) return { x: midX, y: midY };
      const metricPerpX = -metricDy / len;
      const metricPerpY = metricDx / len;
      // Y-flip when projecting metric → screen.
      const screenPerpX = metricPerpX;
      const screenPerpY = -metricPerpY;
      return {
        x: midX + screenPerpX * guide.offsetCssPx,
        y: midY + screenPerpY * guide.offsetCssPx,
      };
    }
    case 'angle-arc': {
      // Pill at the arc midpoint — compute midpoint in metric, then
      // project through metricToScreen so the canvas Y-flip is handled
      // identically to the painter's metric→pixel transform.
      const midAngleRad = guide.baseAngleRad + guide.sweepAngleRad / 2;
      const midpointMetric = {
        x: guide.pivot.x + Math.cos(midAngleRad) * guide.radiusMetric,
        y: guide.pivot.y + Math.sin(midAngleRad) * guide.radiusMetric,
      };
      return metricToScreen(midpointMetric, viewport);
    }
  }
}
