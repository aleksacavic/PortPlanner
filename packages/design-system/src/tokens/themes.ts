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
  /** Stroke width (CSS px, stringified) for live-preview shape outlines.
   *  Consumed by `paintPreview`. */
  preview_stroke_width: Color;
  /** Foreground color for transient label text. */
  label_text: Color;
  /** Translucent background for transient label rounded-pill backdrop. */
  label_bg: Color;
  /** Padding (px) inside the label pill background, stringified (e.g. "4"). */
  label_padding: Color;
  /** Font size (CSS px, stringified) for transient label text. Consumed
   *  by `paintTransientLabel`. */
  label_font_size: Color;
  /** Corner radius (CSS px, stringified) for the transient label pill
   *  backdrop. Consumed by `paintTransientLabel`. */
  label_radius: Color;
  /** Stroke color for the cursor crosshair. */
  crosshair: Color;
  /** Crosshair dash pattern. The literal `'solid'` sentinel means "no
   *  dashing" — painter helpers treat it as a skip of `ctx.setLineDash`.
   *  An empty string is forbidden (would trip the leaf-non-empty
   *  invariant in `tokens.test.ts`). */
  crosshair_dash: Color;
  /** Crosshair stroke width (CSS px, stringified). Consumed by
   *  `paintCrosshair`. */
  crosshair_stroke_width: Color;
  /** Half-extent (CSS px, stringified) of the cursor pickbox square at
   *  the crosshair centre. Consumed by `paintCrosshair`. */
  crosshair_pickbox_half: Color;
  /** Stroke for transient dimension witness/extension lines (M1.3c). */
  dimension_line: Color;
  /** Stroke width (CSS px, stringified) shared by every dimension-guide
   *  arm. Consumed by `paintDimensionGuides`. */
  dim_stroke_width: Color;
  /** Length (CSS px, stringified) of the small perpendicular tick at
   *  each end of an inline dimension. Consumed by `paintDimensionGuides`
   *  (linear-dim INLINE mode). */
  dim_arrow_tick: Color;
  /** Distance (CSS px, stringified) the witness line extends PAST the
   *  dim line. Consumed by `paintDimensionGuides`. */
  dim_witness_overshoot: Color;
  /** Perpendicular offset (CSS px, stringified) between the measured
   *  segment and the parallel dim line. Mirrored by the literal
   *  `DIM_OFFSET_CSS` exported from `paintDimensionGuides.ts` for tools
   *  that consume it at module load (line / polyline / rectangle /
   *  circle); equality enforced by `tests/dim-offset-mirror.test.ts`. */
  dim_witness_offset: Color;
  /** Side length (CSS px, stringified) of the filled-square end-cap at
   *  each witness endpoint. Consumed by `paintDimensionGuides`
   *  (linear-dim FULL mode). */
  dim_witness_endcap: Color;
  /** Space-separated dash pattern (e.g. "2 3") shared by every dimension-
   *  guide arm. Consumed by `paintDimensionGuides`. */
  dim_dashed_pattern: Color;
  /** Stroke width (CSS px, stringified) divided by `metricToPx` to
   *  derive the metric-space line width for the canvas grid. Consumed
   *  by `paintGrid`. */
  grid_stroke_width: Color;
  /** Window-selection rectangle (L→R drag, fully-enclosed). */
  selection_window: {
    stroke: Color;
    fill: Color;
    dash: Color;
    stroke_width: Color;
  };
  /** Crossing-selection rectangle (R→L drag, any-touch). */
  selection_crossing: {
    stroke: Color;
    fill: Color;
    dash: Color;
    stroke_width: Color;
  };
  /** Hover-entity faint outline (no fill, no grips). */
  hover_highlight: { stroke: Color; dash: Color; stroke_width: Color };
  /** Selection outline stroke width (CSS px, stringified) for the solid
   *  outline drawn around selected entities. Consumed by
   *  `paintSelection`. */
  selection_outline_width: Color;
  /** Grip handle (M1.3d Phase 5) sizing. Consumed by `paintSelection`. */
  grip: {
    /** Default grip square side (CSS px, stringified). */
    side: Color;
    /** Hovered grip square side (CSS px, stringified) — slightly larger
     *  per AutoCAD's "this grip will grab on click" feedback. */
    hovered_side: Color;
    /** White border thickness (CSS px, stringified) drawn around each
     *  grip square. */
    border_width: Color;
  };
  /** Snap-glyph sizing per snap kind. Consumed by `paintSnapGlyph`.
   *  All values are CSS px stringified. */
  snap_glyph: {
    /** Filled-square side length for endpoint snaps. */
    endpoint_side: Color;
    /** Triangle side length for midpoint snaps. */
    midpoint_side: Color;
    /** Half-diagonal length for the × shape used by intersection snaps. */
    intersection_half: Color;
    /** Filled-circle radius for node snaps. */
    node_radius: Color;
    /** Half-arm length for the + shape used by grid-node snaps. */
    grid_node_half: Color;
    /** Half-arm length for the small + shape used by grid-line snaps
     *  (degraded fallback per `paintSnapGlyph` header note). */
    grid_line_half: Color;
    /** Stroke width applied to every snap-glyph shape. */
    stroke_width: Color;
  };
  /** Opacity (unitless 0..1, stringified) applied to the dim placeholder
   *  text rendered inside a DI pill when the active buffer is empty
   *  AND a previously-submitted value is available. Consumed by
   *  `chrome/DynamicInputPills.tsx` (Phase 2). */
  pill_placeholder_opacity: Color;
}

export { dark } from './semantic-dark';
