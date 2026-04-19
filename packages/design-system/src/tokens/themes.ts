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
  };
}

export { dark } from './semantic-dark';
