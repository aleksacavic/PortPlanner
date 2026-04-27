// Layer 3 — Theme mapping types.
// M1.1 declares only the SemanticTokens interface and re-exports the dark
// theme constant from semantic-dark.ts. Milestone 5 will add `light` and
// `system` mode types + semantic-light.ts additively (see plan §6 and
// architecture-contract §0.7 "Progressive implementation").

export type Color = string;

export interface SemanticTokens {
  surface: {
    base: Color;
    raised: Color;
    overlay: Color;
    sunken: Color;
    inverse: Color;
  };
  border: {
    default: Color;
    strong: Color;
    focus: Color;
    error: Color;
    selected: Color;
  };
  text: {
    primary: Color;
    secondary: Color;
    tertiary: Color;
    inverse: Color;
    accent: Color;
    error: Color;
    warning: Color;
    success: Color;
  };
  interactive: {
    default: Color;
    hover: Color;
    active: Color;
    disabled: Color;
    focus_ring: Color;
  };
  accent: {
    primary: Color;
    success: Color;
    warning: Color;
    danger: Color;
    cyard: Color;
    road: Color;
    building: Color;
    pavement: Color;
  };
  canvas: {
    background: Color;
    grid: Color;
    snap_indicator: Color;
    selection_fill: Color;
    selection_border: Color;
    node_default: Color;
    node_selected: Color;
    node_hover: Color;
    node_fillet: Color;
    handle_move: Color;
    handle_rotate: Color;
    generated_tint: Color;
    frozen_tint: Color;
    detached_tint: Color;
    validation_error: Color;
    validation_warn: Color;
    /**
     * M1.3d transient overlay sub-namespace. Painters of in-flight UI
     * (live preview, snap glyph, selection rectangle, hover highlight,
     * grip handles, crosshair, transient labels) read EXCLUSIVELY from
     * here. They MUST NOT read other `canvas.*` tokens or layer color
     * tokens — the ByLayer ladder is for entities, not overlays
     * (I-DTP-1, Gate DTP-T1).
     *
     * Numeric values (dash patterns, padding) are stored as strings to
     * keep every leaf a `Color` (string), preserving the css-vars
     * emitter contract. Painters parse on consumption — see
     * `parseDashPattern` in canvas/painters helpers.
     */
    transient: TransientTokens;
  };
}

export interface TransientTokens {
  /** Stroke for live-preview shape outlines (dashed line / circle / etc.). */
  preview_stroke: Color;
  /** Fill for live-preview shape interiors (translucent or none). */
  preview_fill: Color;
  /** Space-separated dash pattern (e.g. "6 4") for `ctx.setLineDash`. */
  preview_dash: Color;
  /** Foreground color for transient label text. */
  label_text: Color;
  /** Translucent background for transient label rounded-pill backdrop. */
  label_bg: Color;
  /** Padding (px) inside the label pill background, stringified (e.g. "4"). */
  label_padding: Color;
  /** Stroke color for the cursor crosshair. */
  crosshair: Color;
  /** Crosshair dash pattern. The literal `'solid'` sentinel means "no
   *  dashing" — painter helpers treat it as a skip of `ctx.setLineDash`.
   *  An empty string is forbidden (would trip the leaf-non-empty
   *  invariant in `tokens.test.ts`). */
  crosshair_dash: Color;
  /** Stroke for transient dimension witness/extension lines (M1.3c). */
  dimension_line: Color;
  /** Window-selection rectangle (L→R drag, fully-enclosed). */
  selection_window: { stroke: Color; fill: Color; dash: Color };
  /** Crossing-selection rectangle (R→L drag, any-touch). */
  selection_crossing: { stroke: Color; fill: Color; dash: Color };
  /** Hover-entity faint outline (no fill, no grips). */
  hover_highlight: { stroke: Color; dash: Color };
}

export { dark } from './semantic-dark';
