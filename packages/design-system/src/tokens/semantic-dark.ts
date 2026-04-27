// Layer 2 — Semantic tokens for the DARK theme.
// This file is the ONLY place primitives may be imported outside the
// tokens/ folder in M1.1 (enforced by grep gate G3.1).
// Milestone 5 adds a sibling `semantic-light.ts` additively.

import { color, text_color } from './primitives';
import type { SemanticTokens } from './themes';

export const dark: SemanticTokens = {
  surface: {
    base: '#1a1a2e',
    raised: color.gray[950],
    overlay: color.gray[900],
    sunken: color.gray[925],
    inverse: color.gray[50],
  },
  border: {
    default: color.gray[800],
    strong: color.gray[700],
    focus: color.blue[500],
    error: color.red[400],
    selected: color.blue[500],
  },
  text: {
    primary: text_color.on_dark.primary,
    secondary: text_color.on_dark.secondary,
    tertiary: text_color.on_dark.tertiary,
    inverse: text_color.on_light.primary,
    accent: color.blue[500],
    error: color.red[400],
    warning: color.amber[400],
    success: color.green[500],
  },
  interactive: {
    default: color.gray[900],
    hover: color.gray[800],
    active: 'rgba(42, 127, 255, 0.18)',
    disabled: color.gray[700],
    focus_ring: color.blue[500],
  },
  accent: {
    primary: color.blue[500],
    success: color.green[500],
    warning: color.amber[400],
    danger: color.red[400],
    cyard: '#e8c830',
    road: color.gray[500],
    building: '#c87030',
    pavement: '#708058',
  },
  canvas: {
    background: '#0d1420',
    grid: 'rgba(42, 53, 80, 0.6)',
    snap_indicator: color.green[400],
    selection_fill: 'rgba(42, 127, 255, 0.07)',
    selection_border: color.blue[500],
    node_default: 'rgba(180, 200, 255, 0.35)',
    node_selected: 'rgba(255, 255, 255, 0.9)',
    node_hover: color.blue[500],
    node_fillet: color.green[500],
    handle_move: color.blue[500],
    handle_rotate: color.amber[400],
    generated_tint: 'rgba(0, 212, 170, 0.07)',
    frozen_tint: 'rgba(138, 180, 248, 0.15)',
    detached_tint: 'rgba(245, 166, 35, 0.12)',
    validation_error: color.red[400],
    validation_warn: color.amber[400],
    transient: {
      preview_stroke: '#7d8fa3',
      preview_fill: 'rgba(125, 143, 163, 0.05)',
      preview_dash: '6 4',
      // M1.3d-Remediation-2 R6 — small blue rounded pill for in-flight
      // measurements. blue matches selection_window.stroke / accent.primary
      // for consistent "selection / accent" visual vocabulary across
      // overlay surfaces. White text on blue for max contrast on the
      // dark canvas background. Padding shrunk 4 → 3 for compactness.
      label_text: '#ffffff',
      label_bg: 'rgba(42, 127, 255, 0.9)',
      label_padding: '3',
      crosshair: 'rgba(180, 200, 255, 0.35)',
      crosshair_dash: 'solid',
      dimension_line: '#7d8fa3',
      selection_window: {
        stroke: 'rgba(42, 127, 255, 0.9)',
        fill: 'rgba(42, 127, 255, 0.07)',
        dash: '6 4',
      },
      selection_crossing: {
        stroke: 'rgba(0, 255, 128, 0.9)',
        fill: 'rgba(0, 255, 128, 0.07)',
        dash: '6 4',
      },
      hover_highlight: {
        stroke: 'rgba(180, 200, 255, 0.5)',
        dash: '4 2',
      },
    },
  },
};
