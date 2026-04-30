# Design Tokens

This document is the authoritative source for visual design tokens. Tokens
are organised in three layers: primitives (raw values), semantic tokens
(purpose-mapped), and theme mappings (dark/light).

Values are derived from the validated prototype in `reference/prototype-v1.html`
with extensions where the prototype's dark-only palette needed a light-mode
counterpart.

## Layer 1 — Primitives

Primitives are raw values. Components **never** reference these directly.
They are used by semantic tokens and theme mappings only.

### Colour scales

```typescript
color.gray = {
  50:   '#f8f9fb',
  100:  '#f0f2f5',
  200:  '#e2e6ed',
  300:  '#c8d0dc',
  400:  '#9aa8bf',
  500:  '#7a90b8',    // prototype --tx2
  600:  '#4a5a7a',    // prototype --tx3
  700:  '#3a4a6a',    // prototype --bdr2
  800:  '#2a3550',    // prototype --bdr
  900:  '#1e2636',    // prototype --bg3
  925:  '#1a2030',
  950:  '#161b26',    // prototype --bg2
  1000: '#0d1117'     // deepest background for light-source-on-dark
}

color.blue = {
  100: '#cce0ff',
  300: '#4a9eff',
  400: '#3b8bd4',    // prototype --dim
  500: '#2a7fff',    // prototype --acc (primary accent)
  600: '#1a6fee',
  700: '#0a5fd4'
}

color.green = {
  200: '#88ffe0',
  400: '#00e5a0',    // prototype --snp (snap indicator)
  500: '#00d4aa',    // prototype --grn (success/valid)
  600: '#00b894',
  700: '#009978'
}

color.amber = {
  300: '#ffc14d',
  400: '#f5a623',    // prototype --wrn (warning)
  500: '#e09520',
  600: '#b57800'
}

color.red = {
  300: '#ff7a7a',
  400: '#e05555',    // prototype --dng (danger/error)
  500: '#c74444',
  600: '#a33333'
}

color.white = '#ffffff'
color.black = '#000000'
```

### Text colour primitives

```typescript
text_color.on_dark = {
  primary:   '#c8d8f0',    // prototype --tx
  secondary: '#7a90b8',    // prototype --tx2
  tertiary:  '#4a5a7a'     // prototype --tx3
}

text_color.on_light = {
  primary:   '#1a2030',
  secondary: '#4a5a7a',
  tertiary:  '#7a90b8'
}
```

### Size scale

```typescript
size = {
  0:   '0',
  1:   '2px',
  2:   '4px',
  3:   '6px',
  4:   '8px',
  6:   '12px',
  8:   '16px',
  10:  '20px',
  12:  '24px',
  16:  '32px',
  20:  '40px',
  24:  '48px',
  32:  '64px'
}
```

### Border radius

```typescript
radius = {
  sm:   '3px',      // small buttons, inputs
  md:   '5px',      // panels, cards
  lg:   '7px',      // dialogs
  xl:   '12px',     // feature cards
  full: '9999px'    // pills, circular handles
}
```

### Typography

```typescript
font = {
  family: {
    sans: '"Inter", "Segoe UI", system-ui, sans-serif',
    mono: '"JetBrains Mono", "Consolas", monospace'
  },
  size: {
    xs:   '8px',      // labels, hints
    sm:   '9px',      // small labels
    base: '10px',     // default body text in editor
    md:   '11px',     // property values
    lg:   '12px',     // body text
    xl:   '14px',     // section headers
    '2xl': '16px',    // panel titles
    '3xl': '20px'     // page titles
  },
  weight: {
    normal:   400,
    medium:   500,
    semibold: 600,
    bold:     700
  },
  letter_spacing: {
    tight:  '-0.01em',
    normal: '0',
    wide:   '0.05em',
    wider:  '0.08em',
    widest: '0.12em'   // used for section headers in prototype
  },
  line_height: {
    tight:   1.2,
    normal:  1.5,
    relaxed: 1.7
  }
}
```

### Shadow

```typescript
shadow = {
  sm: '0 1px 2px rgba(0,0,0,0.2)',
  md: '0 4px 12px rgba(0,0,0,0.4)',
  lg: '0 8px 28px rgba(0,0,0,0.6)',
  xl: '0 12px 40px rgba(0,0,0,0.8)'      // used for dialogs over canvas
}
```

### Motion

```typescript
motion = {
  duration: {
    fast:   '100ms',
    normal: '150ms',
    slow:   '250ms',
    slower: '400ms'     // used for fillet popup auto-hide
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)'
  }
}
```

## Layer 2 — Semantic Tokens

Semantic tokens map purpose to primitives. Components reference these.
The theme system swaps semantic → primitive mappings when switching modes.

```typescript
interface SemanticTokens {
  // Surfaces — background levels
  surface: {
    base:     Color;    // app background
    raised:   Color;    // panels, cards
    overlay:  Color;    // modals, popovers
    sunken:   Color;    // inset fields, input backgrounds
    inverse:  Color;    // reversed areas (e.g. tooltips)
  };

  // Borders
  border: {
    default:  Color;    // standard dividers
    strong:   Color;    // emphasis borders
    focus:    Color;    // keyboard focus rings
    error:    Color;    // validation error state
    selected: Color;    // selected element outline
  };

  // Text
  text: {
    primary:   Color;   // main content
    secondary: Color;   // labels, captions
    tertiary:  Color;   // placeholder, disabled hints
    inverse:   Color;   // text on dark/coloured surfaces
    accent:    Color;   // links, interactive labels
    error:     Color;
    warning:   Color;
    success:   Color;
  };

  // Interactive
  interactive: {
    default:       Color;    // button and toggle backgrounds
    hover:         Color;
    active:        Color;    // pressed state
    disabled:      Color;
    focus_ring:    Color;
  };

  // Tool-specific accents
  accent: {
    primary: Color;     // selection, active tool (blue)
    success: Color;     // snap indicator, valid state (green)
    warning: Color;     // warnings, fillet handles (amber)
    danger:  Color;     // errors, delete actions (red)
    cyard:   Color;     // RTG block / container elements (amber-gold)
    road:    Color;     // road elements (gray)
    building: Color;    // building elements (warm orange)
    pavement: Color;    // pavement elements (green-gray)
  };

  // Canvas-specific (2D editor overlay)
  canvas: {
    background:       Color;
    grid:             Color;
    snap_indicator:   Color;
    selection_fill:   Color;      // selection rectangle background
    selection_border: Color;      // selection rectangle border

    node_default:     Color;      // unselected vertex dot
    node_selected:    Color;      // selected vertex dot
    node_hover:       Color;      // hovered vertex dot (draggable)
    node_fillet:      Color;      // node with fillet applied

    handle_move:      Color;
    handle_rotate:    Color;

    generated_tint:   Color;      // subtle tint on GENERATED objects
    frozen_tint:      Color;      // FROZEN object indicator
    detached_tint:    Color;      // DETACHED object warning tint

    validation_error: Color;      // error object outline colour
    validation_warn:  Color;      // warning object outline colour

    transient:        TransientTokens;   // M1.3d — see Transient overlay tokens
  };
}
```

## Layer 3 — Theme Mappings

### Dark theme (default, matches prototype)

```typescript
const dark: SemanticTokens = {
  surface: {
    base:    '#1a1a2e',
    raised:  color.gray[950],    // #161b26
    overlay: color.gray[900],    // #1e2636
    sunken:  color.gray[925],
    inverse: color.gray[50]
  },
  border: {
    default:  color.gray[800],   // #2a3550
    strong:   color.gray[700],   // #3a4a6a
    focus:    color.blue[500],
    error:    color.red[400],
    selected: color.blue[500]
  },
  text: {
    primary:   text_color.on_dark.primary,    // #c8d8f0
    secondary: text_color.on_dark.secondary,  // #7a90b8
    tertiary:  text_color.on_dark.tertiary,   // #4a5a7a
    inverse:   text_color.on_light.primary,
    accent:    color.blue[500],
    error:     color.red[400],
    warning:   color.amber[400],
    success:   color.green[500]
  },
  interactive: {
    default:     color.gray[900],
    hover:       color.gray[800],
    active:      'rgba(42, 127, 255, 0.18)',  // prototype active button
    disabled:    color.gray[700],
    focus_ring:  color.blue[500]
  },
  accent: {
    primary:  color.blue[500],
    success:  color.green[500],
    warning:  color.amber[400],
    danger:   color.red[400],
    cyard:    '#e8c830',
    road:     color.gray[500],
    building: '#c87030',
    pavement: '#708058'
  },
  canvas: {
    background:       '#0d1420',
    grid:             'rgba(42, 53, 80, 0.6)',
    snap_indicator:   color.green[400],       // #00e5a0
    selection_fill:   'rgba(42, 127, 255, 0.07)',
    selection_border: color.blue[500],

    node_default:  'rgba(180, 200, 255, 0.35)',
    node_selected: 'rgba(255, 255, 255, 0.9)',
    node_hover:    color.blue[500],
    node_fillet:   color.green[500],

    handle_move:   color.blue[500],
    handle_rotate: color.amber[400],

    generated_tint: 'rgba(0, 212, 170, 0.07)',     // subtle green
    frozen_tint:    'rgba(138, 180, 248, 0.15)',   // subtle blue
    detached_tint:  'rgba(245, 166, 35, 0.12)',    // subtle amber

    validation_error: color.red[400],
    validation_warn:  color.amber[400],

    transient: {
      preview_stroke:  '#7d8fa3',
      preview_fill:    'rgba(125, 143, 163, 0.05)',
      preview_dash:    '6 4',
      label_text:      '#ffffff',
      label_bg:        'rgba(42, 127, 255, 0.9)',
      label_padding:   '3',
      crosshair:       'rgba(180, 200, 255, 0.35)',
      crosshair_dash:  'solid',
      dimension_line:  '#7d8fa3',
      selection_window:   { stroke: 'rgba(42, 127, 255, 0.9)', fill: 'rgba(42, 127, 255, 0.07)', dash: '6 4' },
      selection_crossing: { stroke: 'rgba(0, 255, 128, 0.9)',  fill: 'rgba(0, 255, 128, 0.07)',  dash: '6 4' },
      hover_highlight:    { stroke: 'rgba(180, 200, 255, 0.5)', dash: '4 2' }
    }
  }
};
```

### Light theme

```typescript
const light: SemanticTokens = {
  surface: {
    base:    color.gray[100],
    raised:  color.white,
    overlay: color.white,
    sunken:  color.gray[100],
    inverse: color.gray[950]
  },
  border: {
    default:  color.gray[200],
    strong:   color.gray[300],
    focus:    color.blue[600],
    error:    color.red[500],
    selected: color.blue[600]
  },
  text: {
    primary:   text_color.on_light.primary,
    secondary: text_color.on_light.secondary,
    tertiary:  text_color.on_light.tertiary,
    inverse:   text_color.on_dark.primary,
    accent:    color.blue[600],
    error:     color.red[500],
    warning:   color.amber[500],
    success:   color.green[600]
  },
  interactive: {
    default:     color.gray[100],
    hover:       color.gray[200],
    active:      'rgba(42, 127, 255, 0.12)',
    disabled:    color.gray[200],
    focus_ring:  color.blue[600]
  },
  accent: {
    primary:  color.blue[600],
    success:  color.green[600],
    warning:  color.amber[500],
    danger:   color.red[500],
    cyard:    '#b89520',
    road:     color.gray[600],
    building: '#a85820',
    pavement: '#506848'
  },
  canvas: {
    background:       color.gray[50],
    grid:             'rgba(180, 190, 210, 0.5)',
    snap_indicator:   color.green[600],
    selection_fill:   'rgba(42, 127, 255, 0.08)',
    selection_border: color.blue[600],

    node_default:  'rgba(80, 100, 140, 0.4)',
    node_selected: 'rgba(30, 40, 70, 0.95)',
    node_hover:    color.blue[600],
    node_fillet:   color.green[600],

    handle_move:   color.blue[600],
    handle_rotate: color.amber[500],

    generated_tint: 'rgba(0, 180, 140, 0.08)',
    frozen_tint:    'rgba(100, 140, 200, 0.12)',
    detached_tint:  'rgba(200, 140, 30, 0.12)',

    validation_error: color.red[500],
    validation_warn:  color.amber[500]
  }
};
```

## Transient overlay tokens (`canvas.transient.*`)

The transient sub-namespace under `canvas` is a **hard SSOT boundary**
introduced in M1.3d. Painters of in-flight UI — live preview, snap glyph,
selection rectangle, hover-entity highlight, grip handles, cursor crosshair,
and transient labels — read EXCLUSIVELY from `canvas.transient.*`. They
MUST NOT read other `canvas.*` tokens, layer color tokens, or any ByLayer
styling. The ByLayer ladder is for entities; transient overlays bypass it
entirely.

This separation matters because the lifecycle is different. Entity styling
flows through the ByLayer ladder (entity color → layer color → default
color) and is captured in the project document. Transient overlays exist
only while a tool is in flight or a selection is active; they are never
persisted, never serialized, never themed via layer rules.

**Enforcement:** Gate `DTP-T1` greps each transient painter file for
references to `layer.color` or `effectiveColor.*layer` and fails the build
if any match. See `docs/plans/feature/m1-3d-drafting-polish.md` §9 for
the cross-cutting hard gates.

**Storage convention.** Numeric values (dash patterns, padding) are stored
as strings to preserve the existing `SemanticTokens` leaf-is-string
contract that `tokens.test.ts` validates. Painters parse on consumption:
dash patterns split on whitespace and convert to `number[]` for
`ctx.setLineDash`; padding values pass through `parseInt`.

| Token | Purpose |
|-------|---------|
| `preview_stroke` | Stroke color for live-preview shape outlines (line/circle/rect/arc/xline rubber bands). |
| `preview_fill` | Fill color for live-preview interiors (translucent or near-zero alpha). |
| `preview_dash` | Dash pattern (space-separated, e.g. `'6 4'`) for `ctx.setLineDash` on preview strokes. |
| `label_text` | Foreground color for transient labels (length, radius, angle readouts). |
| `label_bg` | Translucent background for the rounded-pill label backdrop. |
| `label_padding` | Inner padding (px, stringified) inside the label pill. |
| `crosshair` | Stroke color for the cursor crosshair. |
| `crosshair_dash` | Dash pattern for the crosshair. Sentinel `'solid'` means "no dashing" (painter skips `ctx.setLineDash`). Empty strings are forbidden by the leaf-non-empty invariant. |
| `dimension_line` | Stroke color for transient dimension witness/extension lines (used by M1.3c). |
| `selection_window.stroke` / `.fill` / `.dash` / `.stroke_width` | Window-selection (L→R drag, fully-enclosed) rectangle styling. `stroke_width` added in 1.4.0. |
| `selection_crossing.stroke` / `.fill` / `.dash` / `.stroke_width` | Crossing-selection (R→L drag, any-touch) rectangle styling. `stroke_width` added in 1.4.0. |
| `hover_highlight.stroke` / `.dash` / `.stroke_width` | Faint outline drawn on the entity under the cursor when no tool is active. `stroke_width` added in 1.4.0. |
| `preview_stroke_width` | Stroke width (CSS-px stringified) for live-preview rubber-band outlines. Added 1.4.0. |
| `label_font_size` | Font size (CSS-px stringified) for transient label text. Added 1.4.0. |
| `label_radius` | Corner radius (CSS-px stringified) for the transient label pill backdrop. Added 1.4.0. |
| `crosshair_stroke_width` / `crosshair_pickbox_half` | Cursor crosshair stroke width + pickbox half-extent (CSS-px stringified). Added 1.4.0. |
| `dim_stroke_width` / `dim_arrow_tick` / `dim_witness_overshoot` / `dim_witness_offset` / `dim_witness_endcap` / `dim_dashed_pattern` | Dimension-guide (`linear-dim` + `angle-arc`) numeric chrome. `dim_witness_offset` is mirrored by the `DIM_OFFSET_CSS = 40` literal in `paintDimensionGuides.ts` (locked by `tests/dim-offset-mirror.test.ts`). Added 1.4.0. |
| `grid_stroke_width` | Canvas-grid stroke width (CSS-px stringified, divided by `metricToPx`). Added 1.4.0. |
| `selection_outline_width` | Stroke width (CSS-px stringified) for the solid outline drawn around selected entities. Added 1.4.0. |
| `grip.side` / `.hovered_side` / `.border_width` | Grip-handle square sizes + border thickness (CSS-px stringified). Added 1.4.0. |
| `snap_glyph.endpoint_side` / `.midpoint_side` / `.intersection_half` / `.node_radius` / `.grid_node_half` / `.grid_line_half` / `.stroke_width` | Snap-target glyph sizes + stroke (CSS-px stringified). Added 1.4.0. |
| `pill_placeholder_opacity` | Opacity (unitless 0..1, stringified) applied to the dim-placeholder text inside a DI pill when the active buffer is empty AND a previously-submitted value is available. Added 1.4.0; consumed by Phase 2 (buffer persistence). |

## Icon Library

Icons are drawn from [**Lucide**](https://lucide.dev/) via `lucide-react`.
See ADR-011 for the rationale.

### Usage pattern

```tsx
import { Move, RotateCcw, Ruler } from 'lucide-react';

<Move size={16} strokeWidth={1.5} />
```

### Size tokens for icons

Icons consume the standard `size` scale via pixel values:

| Context | Size | Stroke width |
|---------|------|--------------|
| Toolbar buttons | 16 | 1.5 |
| Property panel rows | 14 | 1.5 |
| Inline text glyphs | 12 | 1.75 |
| Large status indicators | 20 | 1.5 |
| Icon-only action buttons | 18 | 1.5 |

### Colour

Icons use `currentColor`. The icon colour is determined by the parent's
`color` CSS property, which resolves to a semantic token. Do not hardcode
icon colours.

```tsx
// Correct
<span style={{ color: 'var(--text-primary)' }}>
  <Move size={16} />
</span>

// Wrong
<Move size={16} color="#c8d8f0" />
```

### Mixing icon sources

Do not mix icon libraries. If Lucide lacks a specific port-domain glyph
(RTG crane, container stack, berth line, gate), create a custom icon in
`packages/design-system/src/icons/` that:

- Uses the same SVG viewBox as Lucide (0 0 24 24).
- Uses stroke-based drawing with `stroke-width="2"` in the source SVG.
- Uses `stroke="currentColor"` and `fill="none"`.
- Exports as a React component matching Lucide's API (accepts `size`,
  `strokeWidth`, and standard SVG props).

Custom icons MUST follow this pattern so they are indistinguishable
from Lucide icons at usage sites.

### Accessibility

Icons alone are never the sole affordance. Every icon:

- Has a text label adjacent, OR
- Has an accessible `aria-label` matching its action, AND
- Has a tooltip on hover for icon-only buttons

---

## Theme Switching

See ADR-011 for the decision. This section is the implementation
reference.

### How themes are applied

Token values are compiled to CSS custom properties emitted on `<html>`
with a class controlling which theme is active:

```css
html.theme-dark {
  --surface-base: #1a1a2e;
  --surface-raised: #161b26;
  --text-primary: #c8d8f0;
  --accent-primary: #2a7fff;
  /* ... all semantic tokens ... */
}

html.theme-light {
  --surface-base: #f0f2f5;
  --surface-raised: #ffffff;
  --text-primary: #1a2030;
  --accent-primary: #1a6fee;
  /* ... */
}
```

The class on `<html>` is written by `ThemeProvider` at app startup and
updated when the user changes preference.

### The three theme states

The switcher exposes three states, not two:

| State | Behaviour |
|-------|-----------|
| `dark` | Force dark theme regardless of OS. |
| `light` | Force light theme regardless of OS. |
| `system` | Follow OS preference via `prefers-color-scheme`. |

Default on first visit: `system`. User's explicit choice is stored in
`localStorage` under the key `theme-preference`.

### ThemeProvider contract

Located in `packages/design-system/src/theme/`. Exposes:

```typescript
type ThemeMode = 'dark' | 'light' | 'system';
type ActiveTheme = 'dark' | 'light';  // resolved from ThemeMode + OS

interface ThemeContextValue {
  mode: ThemeMode;                    // user's preference
  active: ActiveTheme;                // currently applied theme
  setMode: (mode: ThemeMode) => void;
}

function useTheme(): ThemeContextValue;
function useActiveThemeTokens(): SemanticTokens;
```

### Component styling

Components MUST consume theme values via CSS custom properties. Do not
import token constants directly in component styles.

Styling uses **CSS Modules + CSS custom properties** per ADR-012 decision
#12. Each component has a sibling `*.module.css` file; the compiled class
names are scoped per file.

```css
/* Panel.module.css — correct */
.panel {
  background: var(--surface-raised);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}
```

```tsx
// Panel.tsx — correct
import styles from './Panel.module.css';

export function Panel({ children }: { children: React.ReactNode }) {
  return <div className={styles.panel}>{children}</div>;
}
```

```tsx
// Wrong — do not import token constants directly in component styles
import { dark } from '@portplanner/design-system';

export function Panel({ children }: { children: React.ReactNode }) {
  return <div style={{ background: dark.surface.raised }}>{children}</div>;
}
```

### Canvas rendering

Canvas (2D editor, 3D viewer) cannot read CSS custom properties from
drawing contexts. Use the bridge hook:

```tsx
function Canvas2DEditor() {
  const tokens = useActiveThemeTokens();

  useEffect(() => {
    ctx.fillStyle = tokens.canvas.background;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = tokens.canvas.grid;
    drawGrid(ctx);
  }, [tokens, /* other deps */]);
}
```

`useActiveThemeTokens()` re-runs on theme change and triggers redraw
via the effect dependency.

### The theme switcher UI component

A `<ThemeSwitcher />` component in `packages/design-system/` renders the
three-state selector. Placed in the app's settings menu. Does not appear
in the main chrome — theme changes are infrequent.

### Persistence

- User preference: `localStorage` key `theme-preference`, value
  `'dark' | 'light' | 'system'`.
- On app startup, ThemeProvider reads this key. If absent, defaults to
  `system`.
- When user changes preference, written immediately to localStorage and
  the `<html>` class updates.

### Testing themes

All Storybook stories (when introduced in M5) MUST render in both dark
and light themes. Any component that looks correct in one theme but not
the other is a bug.

---

## Usage rules

1. **Components never reference primitives directly.** A Button component
   uses `surface.raised`, not `color.gray[950]`.

2. **Theme switching is a semantic-layer swap.** No component needs to know
   about themes. Wrap the app in `<ThemeProvider theme={dark | light}>` and
   CSS custom properties update.

3. **Adding a new semantic token requires a reason.** Not every visual tweak
   needs a new token. If `surface.raised` is close enough, use it.

4. **Canvas tokens are for 2D canvas rendering only.** The React component
   tree uses `surface`, `text`, `interactive`, `accent`. The canvas drawing
   code uses `canvas.*` tokens read from the theme.

5. **Do not introduce brand colours that bypass the accent system.** If a
   new object type needs a colour, add it to `accent.*` in both themes.

## Implementation notes

**Milestone 1:** tokens as a single TypeScript module. Exported as both
constants (for canvas rendering) and CSS custom properties (for components).
Theme context provider. No Storybook, no component library yet.

**Milestone 5:** extract to a separate `packages/design-system` package when
component library work begins.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.4.0 | 2026-04-29 | M1.3 Round 7 (canvas-tokens-and-di-polish) Phase 1 — canvas painter token sweep. Every overlay painter's hardcoded numeric chrome constant migrated to `canvas.transient.*` tokens. **27 new leaves added** (additive only — no rename of existing tokens): `preview_stroke_width`, `label_font_size`, `label_radius`, `crosshair_stroke_width`, `crosshair_pickbox_half`, `dim_stroke_width`, `dim_arrow_tick`, `dim_witness_overshoot`, `dim_witness_offset`, `dim_witness_endcap`, `dim_dashed_pattern`, `grid_stroke_width`, `selection_outline_width`, `selection_window.stroke_width`, `selection_crossing.stroke_width`, `hover_highlight.stroke_width`, `grip.side`, `grip.hovered_side`, `grip.border_width`, `snap_glyph.endpoint_side`, `snap_glyph.midpoint_side`, `snap_glyph.intersection_half`, `snap_glyph.node_radius`, `snap_glyph.grid_node_half`, `snap_glyph.grid_line_half`, `snap_glyph.stroke_width`, `pill_placeholder_opacity`. Numeric leaves stored as decimal strings per existing string-leaf convention. New SSOT helper `parseNumericToken` in `packages/editor-2d/src/canvas/painters/_tokens.ts` (consolidating duplicate `parseDashPattern` + `parsePadding` definitions previously scattered across paintCrosshair / paintHoverHighlight / paintSelectionRect / paintTransientLabel). `paintPoint` excluded — entity painter, not transient overlay. `DIM_OFFSET_CSS = 40` exported literal in `paintDimensionGuides.ts` mirrors `dim_witness_offset` token; equality locked by `tests/dim-offset-mirror.test.ts`. |
| 1.3.1 | 2026-04-27 | M1.3d-Remediation-2 R6 — value-only updates in `canvas.transient` block: `label_bg` `'rgba(13, 20, 32, 0.85)'` → `'rgba(42, 127, 255, 0.9)'` (blue, matches selection_window.stroke / accent.primary); `label_text` `'#c8d4e3'` → `'#ffffff'` (white on blue for contrast); `label_padding` `'4'` → `'3'` (compactness). Token interface unchanged. |
| 1.3.0 | 2026-04-26 | Added `canvas.transient.*` sub-namespace for in-flight UI styling (live preview, snap glyph, selection rectangle, hover highlight, grip handles, cursor crosshair, transient labels). Documented as a hard SSOT boundary outside the ByLayer ladder, enforced by Gate DTP-T1. Numeric values (dash patterns, padding) stored as strings to preserve leaf-is-string contract. M1.3d Phase 1. |
| 1.2.0 | 2026-04-18 | Replaced illustrative `styled.div` examples with CSS-module examples to align with ADR-012 decision #12 (CSS Modules + CSS custom properties). No change to semantic or theme-switching behaviour. Token values unchanged. |
| 1.1.0 | 2026-04-16 | Added Icon Library section (Lucide). Added Theme Switching section. See ADR-011. |
| 1.0.0 | 2026-04-16 | Initial specification extracted from prototype-v1.html |
