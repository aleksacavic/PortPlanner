# ADR-006 — Scenario Model

**Status:** ACCEPTED
**Date:** 2026-04-16

## Context

Port planners need to compare alternatives. Alternatives may be operational
(different dwell assumptions, different tariffs, different peak factors) or
geometric (layout A with one yard configuration vs layout B with another).

Full geometry branching — independent geometry per scenario, tracked with diff
and merge capabilities — is a significant engineering investment. Building it
from the start risks spending months on infrastructure before delivering
useful analysis.

## Options considered

**A. No scenarios.** Single project state. Forces users to clone projects to
compare alternatives. Destroys comparison capability.

**B. Scenarios as full document branches.** Independent geometry per scenario,
Git-style branching with diff/merge. Maximum flexibility. Large
implementation cost. High UX risk — users confused about which branch they
are editing.

**C. Scenarios as parameter overlays on shared baseline geometry.** Scenario
can override operational assumptions, financial assumptions, library rates,
and specific extracted quantities. Cannot change geometry. Lower
implementation cost. Sufficient for most planning work.

## Decision

**Option C for V1. Option B design-compatible for V2.**

A scenario is:

```typescript
interface Scenario {
  id: UUID;
  project_id: UUID;
  name: string;
  description: string;
  type: 'PARAMETER_OVERLAY';           // V1 only

  // What this scenario overrides
  operational_assumptions: Partial<OperationalAssumptions>;
  financial_assumptions: Partial<FinancialAssumptions>;
  library_overrides: LibraryDelta[];
  quantity_overrides: QuantityOverride[];

  // Derived outputs
  analysis_results: AnalysisResult | null;
  cost_summary: CostSummary | null;

  // Audit
  created_by: UUID;
  created_at: timestamp;
  approved_by: UUID | null;
  approved_at: timestamp | null;
}
```

**The baseline geometry is shared across all scenarios in V1.**

**Future-proofing for V2:** the `scenario_id` column exists on every object
record from day one. In V1 it is always null (baseline). In V2, a scenario
may have non-null geometry records that override or replace baseline objects.
This makes V2 geometry branching an additive change rather than a migration.

## Consequences

- Multiple scenarios can be created within weeks of launch.
- Scenario comparison UI is built on top of deterministic derived outputs.
- No risk of conflicting geometry branches in V1.
- Users understand scenarios as "what if we assume X instead" rather than
  "what if we changed the layout" — the simpler mental model.
- Scenario approval becomes a governance action: a scenario marked APPROVED
  is eligible for export or client submission.

## What this makes harder

- Comparing two layouts requires creating two projects until V2.
- A scenario cannot show "what if we move this building 10m" until V2.
- The V2 migration will need to handle cases where a scenario-specific
  geometry diverges from baseline — design work deferred but anticipated.
- Analytical comparisons across scenarios must be careful about
  apples-to-apples: same geometry, different parameters.
