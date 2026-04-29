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
import { type ReactElement, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { type Viewport, metricToScreen } from '../canvas/view-transform';
import type { DimensionGuide, DynamicInputField } from '../tools/types';
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
          const placeholder = dynamicInput.placeholders[idx] ?? '';
          return (
            <DynamicInputPill
              key={`di-pill-${idx}`}
              field={field}
              idx={idx}
              focused={focused}
              buffer={buffer}
              placeholder={placeholder}
              screen={screen}
            />
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
 * Round 7 Phase 3 — single multi-pill DI cell with hover-overflow
 * tooltip. When the pill's text is wider than its visible box
 * (`scrollWidth > clientWidth`), hovering shows a tooltip rendered
 * via `createPortal` to `document.body` containing the full
 * value + a unit suffix derived from `field.kind`. Non-overflow
 * pills don't trigger a tooltip — overflow-only behaviour locks
 * I-HOV-1 + REM7-P3-OverflowDetection.
 *
 * Pointer-events on the pill itself are enabled so the hover lands
 * (parent `.pill` base class declares `pointer-events: none` for
 * canvas-passthrough; `.pillHoverable` re-enables on this element).
 */
interface DynamicInputPillProps {
  field: DynamicInputField;
  idx: number;
  focused: boolean;
  buffer: string;
  placeholder: string;
  screen: { x: number; y: number };
}

function DynamicInputPill({
  field,
  idx,
  focused,
  buffer,
  placeholder,
  screen,
}: DynamicInputPillProps): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const showPlaceholder = buffer.length === 0 && placeholder.length > 0;
  const labelPrefix = field.label ? `${field.label}: ` : '';
  const valueText = showPlaceholder ? placeholder : buffer;
  const text = `${labelPrefix}${valueText}`;
  const focusClass = focused ? styles.pillFocused : styles.pillDimmed;
  const placeholderClass = showPlaceholder ? styles.pillPlaceholder : '';

  const handleEnter = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Overflow detection — the pill clips its content via
    // `.pill { white-space: nowrap; overflow: hidden }`. Compare
    // scroll vs client width to know if there's hidden content.
    if (el.scrollWidth <= el.clientWidth) {
      // No overflow → no tooltip.
      return;
    }
    const rect = el.getBoundingClientRect();
    const unit = unitSuffix(field.kind);
    const tipText = `${labelPrefix}${valueText}${unit}`;
    setTooltip({
      text: tipText,
      // Anchor the tooltip below the pill (rect.bottom in viewport
      // coords). Tooltip CSS centers horizontally via translate(-50%).
      x: rect.left + rect.width / 2,
      y: rect.bottom + 4,
    });
  }, [field.kind, labelPrefix, valueText]);

  const handleLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <>
      <div
        ref={ref}
        className={`${styles.pill} ${styles.pillCentered} ${styles.pillHoverable} ${focusClass} ${placeholderClass}`}
        data-component="dynamic-input-pill"
        data-pill-index={idx}
        data-pill-focused={focused ? 'true' : 'false'}
        data-pill-placeholder={showPlaceholder ? 'true' : 'false'}
        style={{ left: `${screen.x}px`, top: `${screen.y}px` }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {text}
        {focused ? <span className={styles.pillCaret} aria-hidden /> : null}
      </div>
      {tooltip && typeof document !== 'undefined'
        ? createPortal(
            <div
              className={styles.pillTooltip}
              data-component="dynamic-input-pill-tooltip"
              data-pill-tooltip-index={idx}
              style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
            >
              {tooltip.text}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * Round 7 Phase 3 — unit suffix per DI field kind. Distance values
 * are in metres (the project's metric SSOT). Angle values are in
 * degrees (parsed by the combiner from the per-field buffer).
 * Generic numeric fields (rectangle W/H, circle radius — which is
 * also distance but kind is 'number' for combineAs:'numberPair' or
 * 'number') get no suffix because the unit context isn't always
 * metres (e.g., a dimensionless count in a future tool).
 */
function unitSuffix(kind: DynamicInputField['kind']): string {
  switch (kind) {
    case 'distance':
      return ' m';
    case 'angle':
      return '°';
    default:
      return '';
  }
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
