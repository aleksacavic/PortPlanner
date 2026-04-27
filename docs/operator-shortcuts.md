# Operator Shortcut Registry

**Version:** 1.0.2
**Date:** 2026-04-27
**Authority:** ADR-023 (`docs/adr/023-tool-state-machine-and-command-bar.md`)

This registry is the going-forward source of truth for keyboard
shortcuts in PortPlanner. It is edited in place with a version bump
+ changelog line on every change, mirroring the
`docs/extraction-registry/` governance pattern. ADR-023's shortcut map
is the snapshot at supersession; this file is the active registry.

---

## Governance

- **Adding a new shortcut**: minor version bump (e.g. `1.0.0` →
  `1.1.0`). Add a row to the appropriate section + a changelog entry.
- **Changing an existing shortcut letter or behaviour**: major version
  bump (e.g. `1.0.0` → `2.0.0`). Document the rationale in the
  changelog entry.
- **Removing a shortcut**: major version bump.
- **Implementation files** under `packages/editor-2d/src/keyboard/
  shortcuts.ts` MUST stay in sync with this registry. Drift between
  the two is a Blocker; CI / review catches via grep gate.

---

## Shortcut map

### M1.3a — Essential operators + draw tools

| Shortcut | Operator | Notes |
|---|---|---|
| `S` | Select | Modal default; Escape returns here |
| `E` / `DEL` | Erase | |
| `M` | Move | |
| `C` | Copy | |
| `U` / `Ctrl+Z` | Undo | zundo temporal |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo | zundo temporal |
| `Z` | Zoom | sub-options: Extents, Window, Previous |
| `P` | Pan | modeless; middle-mouse-drag also pans |
| `Ctrl+1` | Properties | |
| `LA` | Layer Manager | |
| `Escape` | Cancel current tool | always returns focus to canvas |
| `Space` | repeat-last-command | Canvas focus only; same handler shape as Enter — commits in-flight tool when active, else re-invokes last user-tool |
| `F3` | OSNAP toggle | |
| `F8` | Ortho toggle | |
| `F9` | GSNAP toggle | |
| `F12` | Dynamic Input / command bar toggle | |
| `F7` | toggle-crosshair | Toggle crosshair size between full-canvas and pickbox preset (M1.3d) |
| `PT` | Point (draw) | M1.3a primitive |
| `L` | Line (draw) | M1.3a primitive |
| `PL` | Polyline (draw) | M1.3a primitive (bulges deferred to M1.3c) |
| `REC` | Rectangle (draw) | M1.3a primitive |
| `CC` | Circle (draw) | `C` collides with Copy; we use `CC` |
| `A` | Arc (draw) | M1.3a primitive |
| `XL` | Xline (draw) | M1.3a primitive |
| `XX` | Xline (draw, alias) | alias for `XL` |

### M1.3b — Promotion + modify operators

| Shortcut | Operator | Notes |
|---|---|---|
| `R` | Rotate | |
| `MI` | Mirror | |
| `SC` | Scale | |
| `O` | Offset | |
| `F` | Fillet | |
| `CHA` | Chamfer | |
| `TR` | Trim | |
| `EX` | Extend | |
| `J` | Join | PEDIT-style; required by ADR-016 for multi-primitive merge |
| `X` | Explode | primitive-level only; typed-object explode rejected (ADR-019) |
| `BR` | Break | |
| `AR` | Array | rectangular / polar |
| `MA` | Match Properties | painter UX |
| `CV` | Convert to... (Promote) | primitive → typed object; ADR-016 |
| `CL` | Classify | change typed-object classification |
| *(re-align)* | Re-align | ROAD canonical-axis shift; see ADR-016 |

### M1.3c — Dimensions + extended snap

| Shortcut | Operator | Notes |
|---|---|---|
| `F10` | POLAR toggle | non-enforcing angle guides |
| `F11` | OTRACK toggle | alignment tracking |
| `DIMLINEAR` | Linear dimension | |
| `DIMRADIUS` | Radius dimension | |
| `DIMANGULAR` | Angular dimension | |

---

## Deferred / rejected

- **`STRETCH`** — would collide with `S` (Select). Shortcut TBD,
  post-M1 unless demand.
- **Typed-object `EXPLODE`** — rejected per ADR-019 (would break
  provenance).
- **Parametric / driving dimensions** — rejected per ADR-018.

---

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.2 | 2026-04-27 | Add `Space` → repeat-last-command (canvas focus only; commits in-flight tool when one is active, else re-invokes most recently completed user-tool). M1.3d-Remediation-3 F6. |
| 1.0.1 | 2026-04-26 | Add `F7` → toggle-crosshair (full-canvas / pickbox preset). M1.3d Phase 8. |
| 1.0.0 | 2026-04-25 | Initial registry. Seeded from ADR-023 shortcut map at supersession of ADR-022. M1.3a / M1.3b / M1.3c sections populated. |
