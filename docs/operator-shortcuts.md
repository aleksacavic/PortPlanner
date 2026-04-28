# Operator Shortcut Registry

**Version:** 2.1.0
**Date:** 2026-04-29
**Authority:** ADR-023 (`docs/adr/023-tool-state-machine-and-command-bar.md`); extended by ADR-024 (`docs/adr/024-dynamic-input-manifest.md`) for the multi-field Dynamic Input behaviour described under §M1.3 below.

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
| `Tab` | DI cycle next field | Canvas / bar focus when DI manifest active (`commandBar.dynamicInput !== null`) AND `manifest.fields.length > 1`. Cycles `activeFieldIdx` modulo field count. Pass-through to native browser behaviour when no DI is active OR single-field manifest (preserves keyboard accessibility for chrome regions). M1.3 Round 6. |
| `Shift+Tab` | DI cycle previous field | Same context as Tab; cycles `activeFieldIdx` backward. M1.3 Round 6. |
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

## Behavior notes

**AC-mode letter activation (M1.3d-Remediation-4 G1 / Remediation-5 H2 / 2.0.0):**
letter shortcuts at canvas focus accumulate silently. Enter or Space
activates the accumulated command. Escape clears the accumulator.
**Accumulator persists indefinitely; clear via Escape, Enter, or Space.**
(Pre-Rem-5 the accumulator was silently cleared after a 750 ms idle
timeout; M1.3d-Rem-5 H2 removed the timeout for true AC parity — AC
itself has no such timer. The Dynamic Input pill is the visible safety
net, showing the in-progress accumulator at the cursor as the user
types.) Pre-Rem-4 the accumulator auto-activated on
exact-match-no-extension (the heuristic was fragile — it blocked `MI`
for Mirror, `MA` for Match-Properties, etc., as soon as `M` matched
alone). The new policy matches AutoCAD parity.

**Dynamic Input pill (M1.3d-Remediation-4 G2 / 1.2.0):** numeric and
punctuation keys (digits 0-9, `.`, `-`, `,`, Backspace) at canvas
focus route into the command bar's `inputBuffer` and echo in a small
floating pill anchored to the cursor. F12 (`toggles.dynamicInput`)
controls pill visibility. Enter at canvas focus + buffer non-empty +
tool active submits the buffer through the same path the bottom
command line's form uses (so direct-distance entry and other prompt
inputs work whether the user focuses the command line or types
directly at canvas focus). When the buffer is non-empty, canvas
clicks are silently eaten — AC parity (the buffer takes precedence
until the user commits with Enter or aborts with Esc).

## Changelog

| Version | Date | Change |
|---|---|---|
| 2.1.0 | 2026-04-29 | Add `Tab` / `Shift+Tab` → DI cycle next/previous field (canvas / bar focus when `commandBar.dynamicInput.manifest !== null` AND `manifest.fields.length > 1`; pass-through otherwise to preserve keyboard accessibility for chrome regions). M1.3 Round 6 multi-field Dynamic Input — see ADR-024 for the manifest contract. **Minor bump** per registry governance ("Adding a new shortcut: minor version bump"). |
| 2.0.0 | 2026-04-28 | Letter accumulator behavior change: 750 ms idle stale-clear removed; accumulator persists indefinitely until Enter, Space, or Escape (true AC parity). M1.3d-Remediation-5 H2. **Major bump** per registry governance ("Changing an existing shortcut behaviour: major version bump") — first MAJOR application of the rule. The earlier `1.2.0 → 1.2.1` patch proposal was rejected by Codex Round-1 review as governance-non-compliant. |
| 1.2.0 | 2026-04-27 | AC-mode letter activation (Enter or Space required; Escape clears; 750 ms silent stale-clear). Dynamic Input pill at the cursor (numeric / punctuation routes into `inputBuffer`; F12 toggles visibility; Enter submits buffer through the same path as the bottom command line; click eaten while buffer non-empty). M1.3d-Remediation-4 G1 + G2. Behavior change; minor bump per registry governance. |
| 1.1.0 | 2026-04-27 | Add `Space` → repeat-last-command (canvas focus only; commits in-flight tool when one is active, else re-invokes most recently completed user-tool). M1.3d-Remediation-3 F6. **Note:** version corrected from initially-applied 1.0.2 (patch) to 1.1.0 (minor) per the registry's "adding a new shortcut → minor bump" governance rule (above §Governance). Codex post-commit Round-1 quality cleanup. |
| 1.0.1 | 2026-04-26 | Add `F7` → toggle-crosshair (full-canvas / pickbox preset). M1.3d Phase 8. *(Pre-existing governance drift: should have been a minor bump per the rule above; recorded historically as patch. Going forward all additions are minor.)* |
| 1.0.0 | 2026-04-25 | Initial registry. Seeded from ADR-023 shortcut map at supersession of ADR-022. M1.3a / M1.3b / M1.3c sections populated. |
