# ADR-011 — UI Stack: Icon Library and Theme Switching

**Status:** ACCEPTED
**Date:** 2026-04-16

## Context

The design system needs two foundational choices that affect every
component built against it:

1. An icon library. Ports have dozens of semantic concepts — draw, select,
   rotate, snap, fillet, freeze, detach, measure, extrude, and many more —
   and every tool button, menu item, and indicator needs a recognisable
   glyph. Building icons from scratch is a distraction; choosing a
   heterogeneous set across the app produces visual incoherence.

2. A theme switching mechanism. The design token system defined in
   `docs/design-tokens.md` already specifies dark and light themes with a
   three-layer token architecture. What was not specified is how
   components consume the active theme at runtime and how switching is
   wired.

Both are low-stakes technically and high-stakes for consistency. Choosing
them deliberately once prevents drift later.

## Options considered

### For icons

**A. Heroicons.** Tailwind-adjacent, good coverage of generic UI icons,
thinner coverage of domain-specific glyphs (no freight, no construction,
limited maritime).

**B. Lucide.** Fork of Feather, actively maintained, broader set than
Feather, consistent stroke-based style, React component per icon with
tree-shaking support. Lucide already has usable glyphs for many
port-planning concepts (anchor, truck, warehouse, building, construction,
ruler, compass, navigation, move, rotate-ccw, rotate-cw).

**C. Material Symbols / Material Icons.** Large library, broad coverage,
but visually heavy and Material-design specific. Stylistically a poor
match for a technical drawing tool.

**D. Custom icon set.** Maximum control, maximum maintenance burden.
Rejected for V1. May revisit if Lucide proves insufficient for
port-specific concepts.

### For theme switching

**A. CSS `prefers-color-scheme` media query, no user control.** Follows OS
preference automatically. Zero UI surface. Removes user choice, which is
wrong for a tool people use for hours — user preference often diverges
from OS setting.

**B. CSS custom properties set on `:root`, swapped by a class on
`<html>` (e.g. `html.theme-dark` vs `html.theme-light`), controlled by
a React context provider.** Semantic tokens are emitted as CSS variables
by the theme layer; components reference variables. Switching theme =
swapping the class, no re-render of component tree needed for styling.

**C. Theme values passed through React context as a JS object.**
Components read the theme object and apply inline styles or styled-component
values. Triggers re-render of the entire tree on theme change. Slower,
less ergonomic for canvas rendering which needs access to theme values
outside the React tree.

## Decision

### Icons — Lucide

Use [`lucide-react`](https://lucide.dev/). All icons imported individually:

```typescript
import { Move, RotateCcw, Ruler, Anchor, Truck, Warehouse } from 'lucide-react';
```

**Rules:**
- Do not mix icon libraries. If Lucide lacks a specific glyph, raise it as
  a finding and propose either a Lucide-compatible custom icon (same
  stroke weight, same style) in `packages/design-system/src/icons/`, or a
  different concept that maps to an existing Lucide glyph.
- Icons receive `size` and `strokeWidth` props via the design token scale.
  Default: `size={16}` in toolbars, `size={14}` in property panels,
  `strokeWidth={1.5}`.
- Icon colour comes from `currentColor` in CSS — colour is set by the
  parent element's `color` property, which resolves to a semantic token.
- Icon meaning MUST be supported by a text label or tooltip. Icons alone
  are never the sole affordance.

### Theme switching — CSS variables + class on root + React context

Implementation:

1. Token layers (per `docs/design-tokens.md`) compile to two flat sets of
   CSS custom properties, emitted as:

   ```css
   html.theme-dark {
     --surface-base: #1a1a2e;
     --surface-raised: #161b26;
     --text-primary: #c8d8f0;
     /* ... */
   }
   html.theme-light {
     --surface-base: #f0f2f5;
     --surface-raised: #ffffff;
     --text-primary: #1a2030;
     /* ... */
   }
   ```

2. A `ThemeProvider` React context at the top of `apps/web/` controls the
   active theme. It:
   - Reads the user's saved preference (localStorage key: `theme-preference`)
   - Falls back to `window.matchMedia('(prefers-color-scheme: dark)')`
     if no preference
   - Writes the class on `document.documentElement`
   - Exposes `useTheme()` returning `{ theme, setTheme }` for the switcher UI

3. Components style themselves with CSS variables only:

   ```tsx
   const Button = styled.button`
     background: var(--surface-raised);
     color: var(--text-primary);
     border: 1px solid var(--border-default);
   `;
   ```

4. Canvas rendering (2D editor, 3D viewer) reads tokens through a helper
   that pulls the active theme's semantic tokens as a JS object:

   ```typescript
   const tokens = useActiveThemeTokens();
   ctx.fillStyle = tokens.canvas.snap_indicator;
   ```

   This helper re-runs when the theme changes, triggering a redraw.

5. A theme switcher UI component lives in `packages/design-system/` and
   appears in the app settings menu. Three states:
   - `dark` — force dark
   - `light` — force light
   - `system` — follow OS preference via media query

## Consequences

- Every icon across the app has consistent stroke style, visual weight,
  and sizing behaviour.
- Theme switching is instant, class-level, no component re-render for
  styling. Canvas redraws are explicit.
- `useActiveThemeTokens()` is the single canvas-side API for theme values.
  No scattered imports of token files directly.
- User preference is respected, system preference is the default.
- Adding a new theme (e.g. "high-contrast") is a matter of adding a new
  set of CSS custom properties and a new class, with no component changes.

## What this makes harder

- Lucide's glyph set is not exhaustive for port concepts. Some domain
  icons (e.g. "RTG crane", "container stack", "berth") will need custom
  icons. These must match Lucide's style.
- Canvas code cannot reference CSS variables directly (the CSS variable
  isn't available to 2D canvas contexts). The `useActiveThemeTokens()`
  bridge is required.
- If a component is rendered outside the React tree (e.g. in a portal or
  imperative overlay), theme access requires explicit wiring.
