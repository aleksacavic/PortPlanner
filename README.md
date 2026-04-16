# PortPlanner

A closed-loop port layout intelligence platform. Planners draw port infrastructure
in 2D. The system extracts operational quantities from the geometry, runs
validation and throughput analysis, computes capex and revenue, and reports
inconsistencies back to the geometry layer. 3D is a derived view.

## Status

Architecture specification complete. Implementation not yet started.

Current milestone: pre-Milestone 1. See [`docs/execution-plan.md`](docs/execution-plan.md).

## The architecture pack

All architectural decisions, domain definitions, and operating procedures
live in [`docs/`](docs/).

**Start here:**

1. [`CLAUDE.md`](CLAUDE.md) — behavioural rules when coding
2. [`CODEX.md`](CODEX.md) — reviewer-role rules for Codex
3. [`docs/overview.md`](docs/overview.md) — what this platform is
4. [`docs/glossary.md`](docs/glossary.md) — domain terms
5. [`docs/adr/`](docs/adr/) — architecture decision records
6. [`docs/extraction-registry/`](docs/extraction-registry/) — parameter extraction contracts
7. [`docs/procedures/Claude/`](docs/procedures/Claude/) — operating procedures for Claude
8. [`docs/procedures/Codex/`](docs/procedures/Codex/) — operating procedures for Codex
9. [`docs/execution-plan.md`](docs/execution-plan.md) — milestone plan

## Core principle

2D is the source of truth. Everything else — 3D scene, analysis outputs,
costing, validation results — is a deterministic projection of the 2D
document plus scenario parameters plus library rates.

## Discipline

- ADRs are never edited. If a decision changes, a new ADR supersedes the old.
- The extraction registry is specification. Formulas are implemented against it.
- Every PR that changes behaviour updates the relevant docs in the same commit.
- Architecture-level deviations follow the Approved Deviation Protocol
  (`docs/procedures/Claude/00-architecture-contract.md` §0.7).
- Before any substantive task, read the applicable procedure file.

## Repository layout (planned)

```
PortPlanner/
├── CLAUDE.md                    # Behavioural rules for Claude
├── CODEX.md                     # Reviewer rules for Codex
├── apps/web/                    # React application (M1)
├── packages/
│   └── domain/                  # Types, extractors, validators (M1)
├── services/api/                # Node/TypeScript backend (M1)
├── docs/                        # Architecture pack
│   ├── adr/                     # Architecture decision records
│   ├── extraction-registry/     # Parameter extraction contracts
│   └── procedures/
│       ├── Claude/              # Plan/execute/audit procedures
│       └── Codex/               # Reviewer procedures
└── reference/                   # Non-binding visual/interaction reference
```

Package boundaries expand as milestones complete and real ownership patterns
emerge. Additional packages (design-system, editor-2d, viewer-3d) are extracted
in later milestones when justified by actual use.

## Contributing

Before writing code:

1. Read `CLAUDE.md` or `CODEX.md` depending on role.
2. Read `docs/procedures/Claude/00-architecture-contract.md` for the binding
   contracts.
3. Read the relevant ADRs for what you are building.
4. Read the extraction registry entries for the object types you will touch.
5. If what you want to build deviates from an ADR, follow the Approved
   Deviation Protocol before starting.

## License

TBD
