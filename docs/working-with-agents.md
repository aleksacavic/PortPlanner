# Working with AI Coding Agents

This project is being built with AI coding agents (e.g. Claude Code, Codex) as
primary implementers, with a reviewer agent as a second opinion. This document
describes the patterns that keep agents aligned with the architecture rather
than quietly drifting from it.

## The loop

1. **You (human)** write or update the ADR or extraction registry entry that
   governs the feature being built.
2. **Implementer agent** builds code against the specification, referencing
   the specific ADR or registry entry in the prompt.
3. **Reviewer agent** reviews the implementation for correctness against the
   specification (not against its own architectural preferences).
4. **You** approve or request changes.
5. The specification and implementation land in the same PR.

## Prompting the implementer

### Good prompt pattern

```
Implement the RTG_BLOCK QuantityExtractor per
docs/extraction-registry/RTG_BLOCK.md v1.0.0.

Place the implementation at packages/domain/src/extractors/rtg-block.ts.
Follow the QuantityExtractor interface defined in
packages/domain/src/types/extractor.ts.

Write unit tests covering:
- Every output formula with at least two input configurations
- Every validation rule with true and false cases
- Edge cases: zero-length block, single-container block, maximum block

Do not change the registry entry. If you identify a bug in the specification,
raise it as a question rather than silently diverging.
```

### Bad prompt pattern

```
Build the RTG block feature.
```

The good pattern anchors the agent to a specific specification version and a
specific output location. The bad pattern gives the agent latitude to make
architectural choices that should be human-owned.

## Prompting the reviewer

### Good prompt pattern

```
Review the implementation of packages/domain/src/extractors/rtg-block.ts
against docs/extraction-registry/RTG_BLOCK.md v1.0.0.

Check:
1. Every output listed in the registry is produced
2. Every formula matches the specification
3. Every validation rule is registered with the correct severity
4. Unit tests cover the criteria listed in the PR description
5. The extractor_version string in the output matches the registry version

Do not propose architectural changes. If you see a spec issue, report it as a
finding for human review, not a code change.
```

## What agents may decide

- Implementation details within a module (data structures, helper functions)
- Choice of well-scoped third-party libraries where any of several would work
- Code organisation within a file or folder
- Test case specifics (as long as coverage criteria are met)
- Performance optimisations that do not change external behaviour

## What agents may not decide

- Architectural deviations from an ADR
- Changes to the extraction registry
- New object types
- Changes to the project model shape
- Changes to the RBAC model
- Library model modifications
- Coordinate system changes

If an agent identifies a case where the architecture seems wrong, the correct
response is to surface the concern as a question, not to "fix" it in the
implementation.

## When implementer and reviewer disagree

Disagreement between agents is signal, not noise. Common cases:

- **Implementer did X, reviewer says do Y.** Read both positions, decide. Do
  not let one auto-win.
- **Both agree on X, but X violates an ADR.** ADR wins. Push back on both.
- **Specification is ambiguous on the disputed point.** Update the spec, then
  re-run the work against the updated spec.

## Guardrails

- The ADRs and extraction registry must be in the repo before the first line
  of code is written.
- Prompts should reference specific file paths and version numbers.
- Agents should not have write access to `docs/adr/` in automated pipelines;
  ADR changes go through human review explicitly.
- Every PR description must state which ADRs and registry entries the change
  implements or affects.

## Red flags

Watch for these in agent output:

- "I simplified the approach" on architectural matters
- Adding new fields to object types without registry updates
- Changing validation rule severities
- Introducing new object types or extractors without a registry entry
- Deprecating existing specifications without writing a superseding ADR
- Skipping validation rules because they are inconvenient to implement

Any of these are reasons to reject the PR and reset the context.
