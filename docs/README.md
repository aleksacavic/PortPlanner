# Port Layout Intelligence Platform — Architecture Pack

This directory is the authoritative specification for the system. Code is built
against it. Decisions are recorded in it. It is versioned alongside the
implementation.

## Structure

- `overview.md` — what this platform is, in one page
- `glossary.md` — domain terms with precise definitions
- `coordinate-system.md` — how coordinates work across the system
- `design-tokens.md` — visual design token specification (primitives,
  semantic tokens, theme mappings, icon library, theme switching)
- `execution-plan.md` — milestone-based execution plan
- `working-with-agents.md` — how to prompt AI coding agents against this pack
- `adr/` — architecture decision records (011 ADRs currently)
- `extraction-registry/` — parameter extraction contracts per object type
- `procedures/` — operating procedures for Claude and Codex
  - `Claude/` — plan authoring, review, execution, audit, remediation
  - `Codex/` — plan review, post-commit review (reviewer role only)

**Related directories outside `docs/`:**

- `../reference/` — visual and interaction references including the
  prototype HTML. Not code patterns.

## Rules

1. ADRs are never edited. They are superseded by a new ADR that references them.
2. The extraction registry is specification. It is written before implementation.
3. Design tokens are specification. Components reference semantic tokens, not
   primitives, and never bypass the token system.
4. Every PR that changes behaviour updates the relevant doc in the same commit.
5. Changes to the glossary are dated in-line.
6. If you want to deviate from a binding specification, follow the Approved
   Deviation Protocol in `procedures/Claude/00-architecture-contract.md` §0.7.

## Reading order for new engineers

1. `overview.md`
2. `glossary.md`
3. `adr/001-coordinate-system.md` through `adr/011-ui-stack.md`
4. `extraction-registry/` for the object types you will work on
5. `design-tokens.md` if you will touch UI
6. `../reference/README.md` if you need visual or interaction reference
7. `execution-plan.md` to understand where the project currently is
8. `procedures/Claude/00-architecture-contract.md` — binding contracts summary
9. The applicable procedure in `procedures/Claude/` for the task at hand
