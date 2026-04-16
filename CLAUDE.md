# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with
project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial
tasks, use judgment.

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes,
simplify.

**Exception:** abstractions mandated by the project contract
(`docs/procedures/Claude/00-architecture-contract.md`) are not discretionary,
even when they look like overengineering for the current scope.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it
work") require constant clarification.

---

## Project-Specific Routing

Before starting any substantive work in this repository, you MUST read the
applicable procedure file from `docs/procedures/Claude/`. These are binding
operating rules, not suggestions.

| Procedure | Path | When to use |
|-----------|------|-------------|
| 00 — Architecture Contract | `docs/procedures/Claude/00-architecture-contract.md` | **Always read first.** Lists binding documents, ADR rules, registry rules, deviation protocol. |
| 01 — Plan Authoring | `docs/procedures/Claude/01-plan-authoring.md` | Writing a new plan (PLAN-ONLY mode) |
| 02 — Plan Review | `docs/procedures/Claude/02-plan-review.md` | Reviewing/scrutinising a plan before execution (READ-ONLY) |
| 03 — Plan Execution | `docs/procedures/Claude/03-plan-execution.md` | Implementing an approved plan (AUDIT-FIRST mode) |
| 04 — Post-Commit Review | `docs/procedures/Claude/04-post-commit-review.md` | Auditing committed code (READ-ONLY memo, no fixes) |
| 05 — Post-Commit Remediation | `docs/procedures/Claude/05-post-commit-remediation.md` | Fixing issues found after commit |

**Hard rules:**
- MUST NOT skip reading the applicable procedure.
- MUST NOT rely on memory of previous sessions. Procedure files are the
  SSOT for operating rules. Re-read each session.
- MUST NOT deviate from the architecture contract without following the
  Approved Deviation Protocol in 00-architecture-contract.md.

---

**These guidelines are working if:** fewer unnecessary changes in diffs,
fewer rewrites due to overcomplication, and clarifying questions come before
implementation rather than after mistakes.
