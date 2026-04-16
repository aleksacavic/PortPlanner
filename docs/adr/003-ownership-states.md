# ADR-003 — Ownership States

**Status:** ACCEPTED
**Date:** 2026-04-16

## Context

The generative layout engine creates objects automatically from user-drawn
constraints. Users will then want to modify generated objects manually. When
the constraints change, the generator must regenerate dependent objects.

If regeneration silently overwrites manual edits, users lose work and trust
the system. If regeneration refuses to run after any manual edit, the layout
becomes stale and the generative feature becomes useless.

This is the primary UX risk of a generative system.

## Options considered

**A. All objects equivalent; regeneration always overwrites.** Maximally
simple. Destroys manual work.

**B. Manual edits permanently lock an object; regeneration skips locked
objects.** Prevents data loss but creates dead-ends: user cannot easily
re-enable regeneration on an edited object.

**C. Four explicit ownership states with defined regeneration behaviour.**
More complex but gives users predictable, reversible control.

**D. Lock the authored bounding area; reject geometry changes until unlocked.**
Considered but rejected. Forces an unlock ceremony for every trivial edit to
authored constraints, which port planners do constantly. Creates friction on
the wrong side — constraints should be free, consequences should be managed.

## Decision

**Option C.**

Every object has an `ownership` field:

```typescript
enum OwnershipState {
  AUTHORED    // user-drawn constraint, never touched by generator
  GENERATED   // generator-created, no manual edits, safe to regenerate
  FROZEN      // was generated, explicitly frozen by user
  DETACHED    // was generated, manually edited by user
}
```

**Regeneration rules:**

| State | Behaviour on regeneration |
|---|---|
| AUTHORED | Never touched by generator. Moving it may trigger regeneration of dependent objects. |
| GENERATED | Deleted and replaced. |
| FROZEN | Skipped entirely. Position held fixed and treated as an obstacle by the generator. |
| DETACHED | Generator prompts user: "X objects have manual edits. Keep edits (freeze) or regenerate?" |

**State transitions:**

| From | Event | To |
|---|---|---|
| (none) | Generator creates | GENERATED |
| (none) | User draws directly | AUTHORED |
| GENERATED | User edits geometry or parameters | DETACHED |
| GENERATED | User explicitly freezes | FROZEN |
| DETACHED | User explicitly freezes | FROZEN |
| DETACHED | User accepts regeneration | (deleted, replaced by new GENERATED) |
| FROZEN | User unfreezes | GENERATED (re-evaluated on next regeneration) |

**Mental model:** authored objects are constraints; generated objects are
consequences. Moving a constraint freely updates its consequences. FROZEN and
DETACHED are user-facing escape hatches when the automatic consequence is
not what the user wants.

## Consequences

- Users can safely tweak generated layouts without fear of silent overwrite.
- The generator always knows what it owns vs what is user-controlled.
- Warnings are targeted (only DETACHED objects trigger prompts), not blanket.
- "Regenerate all" is a safe, predictable operation with explicit exceptions.
- Moving an AUTHORED road automatically updates dependent GENERATED yards
  without any lock/unlock ceremony.

## What this makes harder

- Implementation has to maintain state transitions correctly across
  regeneration, manual edit, freeze, and unfreeze operations.
- Undo/redo must handle ownership state transitions as part of the history.
- When displaying an object, the UI must show its ownership state clearly
  (badge or outline style) so users know what kind of object they are
  interacting with.
