# Reference Artifacts

This directory contains visual and interaction references. These are **not**
code patterns to copy. They inform design decisions and UX validation.

## Files

- `prototype-v1.html` — the original single-file HTML mockup that validated
  the 2D editor interactions, the 3D viewer approach, and the overall visual
  language.

## What this prototype is

A functional proof of concept. It demonstrates:

- 2D editor with tool switching, drawing, selection
- Road drawing with fillets at vertices (hover slider pattern)
- RTG block configuration dialog and parameters
- Building and pavement type managers
- Property panel pattern
- 3D tab with derived scene rendering
- Container ISO textures and stacking
- RTG crane procedural model
- Occupancy slider with seeded contiguous stack filling
- Node dragging for all object types
- Snap indicators and cursor feedback

## What this prototype is NOT

- Not a code reference. The prototype is a single-file monolith that mixes
  view, domain state, geometry math, and 3D rendering. It violates ADR-001
  (screen-pixel coordinate math), ADR-002 (no object model separation),
  ADR-004 (no parameter extraction layer), ADR-007 (no validation engine),
  and ADR-010 (no operation log).

- Not a blueprint for module boundaries. The prototype has no module
  boundaries at all — it is one HTML file.

- Not a source of truth for behaviour. The ADRs and extraction registry
  are the source of truth. Where the prototype and the specification
  disagree, the specification wins.

## How to use this reference

**For designers and design token extraction:**
- Colour palette → already extracted to `docs/design-tokens.md`
- Typography → already extracted to `docs/design-tokens.md`
- Spacing and radius conventions → already extracted
- Interaction visual treatments (hover states, selection indicators, snap
  indicators) → observe in the prototype, implement against the token set

**For engineers implementing UI:**
- Open the prototype in a browser alongside your React implementation
- Match the *visual outcome* using the token system, not the CSS
- Match the *interaction behaviour* using the architecture-compliant domain
  and state layers, not the prototype's monolithic state

**For interaction design validation:**
- The fillet hover slider pattern is a good reference — replicate its
  behaviour (slider appears on node hover, auto-dismisses on mouse-out with
  400ms grace period)
- The node drag pattern is a good reference — any vertex dot on any
  selected object is draggable
- The picker popup pattern (pavement type, building type) is a good
  reference — appears at the end of polygon creation with stop-propagation
  to prevent the global click handler from closing it
- The RTG configuration dialog is a good reference for parameter dialogs
- The 3D occupancy slider is a good reference for live-updating derived
  views

## Do not

- Do not copy CSS from the prototype into production. Use the design
  tokens.
- Do not port the prototype's JavaScript to TypeScript. Rebuild against
  the architecture.
- Do not use the prototype's 3D scene generation as reference for
  production 3D — the ADR-008 mesh descriptor cache is the correct pattern.
- Do not use the prototype's coordinate handling as reference — it works in
  screen pixels which ADR-001 explicitly forbids.

## Version

Prototype captured: 2026-04-16
Architecture pack version: v1.0

If the prototype is updated (additional experiments, new interactions),
replace the file in place and update this version date. The prototype is
not versioned like the specification — it is a snapshot of exploration.
