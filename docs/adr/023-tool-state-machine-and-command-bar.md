# ADR-023 — Tool State Machine and Command Bar (v2)

**Status:** ACCEPTED
**Date:** 2026-04-25
**Supersedes:** ADR-022 (`docs/adr/superseded/022-tool-state-machine-and-command-bar-superseded.md`)

## Context

ADR-022 established an AutoCAD-style interaction model: a bottom-
positioned command bar driving prompts, generator-pattern tool state
machines, keyboard routing per focus holder, and bracket sub-options.
ADR-022 also embedded an operator shortcut map directly in its body
and described a "changelog bump" mechanism for future operator
additions.

During M1.3a planning (Codex Round-1 review, 2026-04-25), the
self-described "edit ADR shortcut map via changelog bump" mechanism
was found to conflict with `00-architecture-contract.md §0.6`
("ADR files: never edited after acceptance"). Per the Approved
Deviation Protocol §0.7 step 3, the resolution for ADR text changes
is supersession — not in-place edit.

This ADR supersedes ADR-022 and:
- restates ADR-022's framework decisions (command bar, generator-
  pattern tool machines, keyboard routing, sub-option brackets, focus
  discipline) verbatim;
- includes the complete shortcut map snapshot at supersession time —
  every M1.3a/b/c row from ADR-022 plus the seven new primitive draw-
  tool rows (`PT`, `L`, `PL`, `REC`, `CC`, `A`, `XL`/`XX`);
- moves the operator shortcut SSOT to a sibling registry file
  `docs/operator-shortcuts.md`. Future operator additions edit the
  registry file with a version bump + changelog line; this ADR's
  shortcut map is the snapshot at supersession and SHOULD NOT be
  edited again. New operators do NOT require a new ADR.

The ADR-022 shortcut-map convention pattern persists; only the
governance is corrected (registry file instead of ADR-internal table).

## Options considered

Same four areas as ADR-022:

1. Tool state machine shape — A. ad hoc / B. generator-pattern / C. statechart.
2. Command input surface — A. modal / B. persistent bar / C. floating.
3. Keyboard routing — A. canvas-only / B. context-aware / C. dual-focus.
4. Sub-option chain — A. nested modals / B. bracket notation / C. right-click menus.

Plus the new shortcut SSOT question (Codex Round-1 OI-1):

5. Shortcut SSOT — A. embedded in ADR (ADR-022 path; conflicts with §0.6) / B. subordinate registry file (this ADR).

## Decision

| # | Area | Choice | Rationale |
|---|------|--------|-----------|
| 1 | Tool state machine | **B. Generator-pattern prompt-driven machines.** | Same rationale as ADR-022 §1. |
| 2 | Command input surface | **B. Persistent bottom command bar.** | Same rationale as ADR-022 §2. |
| 3 | Keyboard routing | **B. Context-aware.** | Same rationale as ADR-022 §3. |
| 4 | Sub-option chain | **B. Bracket notation.** | Same rationale as ADR-022 §4. |
| 5 | Shortcut SSOT | **B. Subordinate registry file `docs/operator-shortcuts.md`.** | Resolves the §0.6 immutability conflict from ADR-022's self-described "edit shortcut map via changelog bump". Mirrors the `docs/extraction-registry/` governance pattern — registry files are version-bumpable; ADRs are not. |

### Command bar schema

(Identical to ADR-022 §Command bar schema. See `docs/adr/superseded/
022-tool-state-machine-and-command-bar-superseded.md` for the full
TypeScript declarations of `CommandBarState`, `SubOption`,
`CommandHistoryEntry`. The implementation in `packages/editor-2d/src/
ui-state/store.ts` `CommandBarState` interface matches.)

### Tool generator shape

(Identical to ADR-022 §Tool generator shape. `Prompt`, `Input`,
`ToolGenerator`, `ToolResult` types as declared in
`packages/editor-2d/src/tools/types.ts`.)

### Keyboard routing rules

(Identical to ADR-022 §Keyboard routing rules.)

### Operator shortcut map (snapshot at supersession)

| Shortcut | Operator | Phase landing |
|---|---|---|
| `S` | Select (modal default; Escape returns here) | M1.3a |
| `E` / `DEL` | Erase | M1.3a |
| `M` | Move | M1.3a |
| `C` | Copy | M1.3a |
| `U` / `Ctrl+Z` | Undo | M1.3a |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo | M1.3a |
| `Z` | Zoom (with sub-options: Extents, Window, Previous) | M1.3a |
| `P` | Pan (modeless; middle-mouse-drag also) | M1.3a |
| `Ctrl+1` | Properties | M1.3a |
| `LA` | Layer Manager | M1.3a |
| `Escape` | Cancel current tool; return to Select | M1.3a |
| `F3` | OSNAP toggle | M1.3a |
| `F8` | Ortho toggle | M1.3a |
| `F9` | GSNAP (grid snap) toggle | M1.3a |
| `F10` | POLAR toggle | M1.3c |
| `F11` | OTRACK toggle | M1.3c |
| `F12` | Dynamic Input / command bar toggle | M1.3a |
| `PT` | Point (draw) | M1.3a |
| `L` | Line (draw) | M1.3a |
| `PL` | Polyline (draw) | M1.3a |
| `REC` | Rectangle (draw) | M1.3a |
| `CC` | Circle (draw) — `C` collides with Copy | M1.3a |
| `A` | Arc (draw) | M1.3a |
| `XL` | Xline (draw) | M1.3a |
| `XX` | Xline (draw, alias) | M1.3a |
| `R` | Rotate | M1.3b |
| `MI` | Mirror | M1.3b |
| `SC` | Scale | M1.3b |
| `O` | Offset | M1.3b |
| `F` | Fillet | M1.3b |
| `CHA` | Chamfer | M1.3b |
| `TR` | Trim | M1.3b |
| `EX` | Extend | M1.3b |
| `J` | Join (PEDIT-style; required by ADR-016 for multi-primitive merge) | M1.3b |
| `X` | Explode (primitive-level only; typed-object explode rejected) | M1.3b |
| `BR` | Break | M1.3b |
| `AR` | Array (rectangular / polar) | M1.3b |
| `MA` | Match Properties (painter UX) | M1.3b |
| `CV` or right-click "Convert to…" | Promote (primitive → typed object) | M1.3b |
| `CL` | Classify (change typed-object classification) | M1.3b |
| *(re-align)* | Re-align (ROAD canonical-axis shift; see ADR-016) | M1.3b |
| `DIMLINEAR`, `DIMRADIUS`, `DIMANGULAR` | Dimension operators | M1.3c |

**Deferred:** `STRETCH` (would conflict with `S` Select; shortcut TBD,
post-M1 unless demand).

**Deferred explicitly rejected:** Typed-object `EXPLODE` (would break
ADR-019 provenance). Parametric / driving dimensions (ADR-018
rejects).

### Future operator additions

To add a new operator after this ADR is accepted:

1. Edit `docs/operator-shortcuts.md` to add the new row + bump its
   version + changelog line.
2. Implement the tool generator under `packages/editor-2d/src/tools/`
   and register in the keyboard shortcuts table.
3. Reference the registry file from any docs that describe the new
   operator. Do NOT edit ADR-023's snapshot table.

The shortcut map embedded above is a one-time snapshot; the registry
is the going-forward authority.

## Consequences

- Shortcut governance is corrected: §0.6 immutability holds for ADRs,
  registry-style governance holds for the shortcut map.
- Future operator additions are lightweight (registry edit, no new
  ADR).
- Implementation files under `packages/editor-2d/src/keyboard/
  shortcuts.ts` register concrete TypeScript shortcut → ToolId
  mappings; the registry file is the canonical human-readable index.

## Cross-references

- **ADR-016** Drawing Model — promotion `CV` operator; primitives'
  snap targets.
- **ADR-017** Layer Model — `LA` operator opens Layer Manager.
- **ADR-018** Dimension Model — dimension operators in M1.3c.
- **ADR-019** Object Model v2 — `CL` operator modifies classification;
  `EXPLODE` rejected for typed objects.
- **ADR-020** Project Sync v2 — every operator commits through the
  project store, emitting ADR-020 operations.
- **ADR-021** 2D Rendering Pipeline v2 — tool overlays render via
  `overlayState` during tool execution.
- **`docs/operator-shortcuts.md`** — going-forward shortcut SSOT.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-25 | Replaces ADR-022. Restates framework + adds seven primitive draw-tool shortcuts (PT, L, PL, REC, CC, A, XL/XX). Moves operator-shortcut SSOT to docs/operator-shortcuts.md going forward. |
