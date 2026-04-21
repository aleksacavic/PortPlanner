# ADR-012 — Technology Stack

**Status:** ACCEPTED
**Date:** 2026-04-18

## Context

The architecture pack (ADRs 001–011, the extraction registry, the glossary,
and the design tokens) defines the domain model and invariants. It does not
pin the concrete technology stack. Before Milestone 1 begins, the team must
choose language, framework, state management, bundler, test runner, formatter
and linter, package manager, ID generation strategy, serialization primitive,
schema validation library, and Node version.

Without these pins, M1 execution stalls on cross-cutting decisions or — worse
— a choice gets made silently by whoever writes code first. This ADR closes
that gap.

ADR-011 (UI Stack) and `docs/design-tokens.md` v1.1.0 already implied React
(they pick `lucide-react` and show JSX `ThemeProvider` code), but never
explicitly decided it. This ADR makes the framework decision explicit so it
is supersede-able.

Separately, ADR-013 (2D Rendering Pipeline) and ADR-014 (Persistence
Architecture) cover rendering and persistence-specific choices. Each can be
superseded independently of this stack ADR.

## Options considered

### Language

- **A. TypeScript 5.x, `strict: true`.** Every ADR already uses TS signatures;
  cross-package type sharing is free.
- **B. Plain JavaScript.** Zero friction, zero guarantees.
- **C. ReScript, Elm.** Small communities, adoption risk.

### Frontend framework

- **A. React 18+.** ADR-011 already picks `lucide-react`; `design-tokens.md`
  shows JSX; largest ecosystem in 2026.
- **B. SolidJS.** Excellent fine-grained reactivity; smaller ecosystem; no
  `lucide-solid` maintained to Lucide parity.
- **C. Svelte 5 with runes.** Great DX; requires rebuilding ADR-011 assumptions.
- **D. Vue 3.** Viable; no alignment with existing binding docs.

### State management

- **A. Zustand with `zundo` middleware, scoped to the project-state slice.**
  `store.subscribe` works outside the React tree (ADR-013's canvas draw loop
  needs this); tiny; no providers; undo/redo middleware fits the ADR-010
  operation log.
- **B. `useState` + Context.** Zero deps; prop drilling and Context perf
  pitfalls; canvas needs imperative subscribe rolled by hand.
- **C. Jotai.** Fine-grained atoms; atom subscriptions less clean outside
  the React tree.
- **D. Redux Toolkit.** Superb DevTools; boilerplate overhead; overkill for
  this size.
- **E. Valtio.** Proxy-based; debugging surprises.

### Schema validation

- **A. Zod.** TS-ecosystem default in 2026; rich inference; registry + API
  boundary fit.
- **B. Valibot.** Smaller; fewer integrations.
- **C. ArkType.** Newer; syntax novelty cost.
- **D. Yup.** Older; less TS-native.

### Build tool

- **A. Vite 5+.** Default for React/TS; native CSS Modules; fast HMR.
- **B. Webpack 5.** Legacy-feeling in 2026.
- **C. Turbopack / Rspack.** Less mature for this stack.

### Test runner

- **A. Vitest.** Vite-native; Jest-compatible API; fast.
- **B. Jest.** Works; Vite+Jest integration friction.
- **C. Playwright.** Needed for editor e2e eventually; not the unit runner.

### Lint + format

- **A. Biome.** Single tool; replaces Prettier + most ESLint/TS-ESLint rules;
  fast.
- **B. ESLint + Prettier.** Comprehensive rules; two tools; slower.
- **C. Both.** Rule overlap, conflicting opinions. Worst of both worlds.

### Package manager + monorepo

- **A. pnpm workspaces.** Least magic, strict resolution, best disk usage.
- **B. Yarn Berry.** PnP complexity; tooling integrations variable.
- **C. npm workspaces.** Works; slower; less strict.
- **D. Turborepo on pnpm.** Good once build graph is complex; premature for M1.
- **E. Nx.** Heavy for this size.

### ID generation

- **A. UUIDv7.** Time-ordered; sorts by creation; Postgres PK-friendly.
- **B. UUIDv4.** Random; no sort-by-creation locality.
- **C. nanoid / cuid2.** Short, non-UUID format; mismatches ADR-002's
  `id: UUID` typing.

### Serialization primitive

- **A. JSON with canonical key ordering and deterministic number formatting.**
  Human-debuggable; deterministic round-trip.
- **B. MessagePack.** Binary; smaller; harder to debug by hand.
- **C. CBOR.** Similar tradeoff to MessagePack.
- **D. Protobuf.** Heavy schema maintenance for a single-app domain.

### Styling

- **A. CSS Modules + CSS custom properties.** Direct fit with the three-layer
  token system in `design-tokens.md`. Zero runtime. Scoped class names.
- **B. Vanilla-extract.** Type-safe CSS-in-TS; zero runtime; learning curve.
- **C. Tailwind v4.** Requires re-mapping our size/radius/typography scales
  into Tailwind's config; permanent sync surface with `design-tokens.md`.
- **D. Styled-components / Emotion.** Styled-components entered maintenance
  mode in late 2024; runtime cost.
- **E. PandaCSS.** Newer; smaller ecosystem.

### Node version + pinning

- **A. Node 20 LTS, pinned via `.nvmrc` + `engines` + `packageManager` field.**
  Reproducible.
- **B. Latest LTS, unpinned.** Works-on-my-machine risk.

## Decision

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Language | **TypeScript 5.x, `strict: true`** | Every ADR uses TS signatures; cross-package type sharing |
| 2 | Frontend framework | **React 18+** | Aligns with ADR-011 + design-tokens.md implicit commitment |
| 3 | State management | **Zustand** with **`zundo` middleware scoped to the project-state slice** | Works outside React tree (ADR-013 canvas draw); undo/redo fits ADR-010 op log |
| 4 | Schema validation | **Zod** | TS-ecosystem default; extractor registry + API boundary validation |
| 5 | Build tool | **Vite 5+** | Native TS + CSS Modules; fast HMR |
| 6 | Test runner | **Vitest** (unit + integration); Playwright added when editor e2e is needed | Vite-native; Jest-compatible |
| 7 | Lint + format | **Biome 1.x** (replaces Prettier + ESLint) | One tool; faster; rule coverage sufficient for M1 |
| 8 | Package manager | **pnpm 9.x** via `packageManager` field | Least magic; strict resolution |
| 9 | Monorepo | **pnpm workspaces**; turborepo deferred until build graph demands it | Minimal tooling for M1 |
| 10 | ID generation | **UUIDv7** | Time-ordered; Postgres PK-friendly; sorts by creation |
| 11 | Serialization primitive | **JSON with canonical key ordering + deterministic number formatting** | Human-debuggable; deterministic round-trip satisfies M1 exit criterion |
| 12 | Styling | **CSS Modules + CSS custom properties** | Direct fit with `design-tokens.md` three-layer tokens; zero runtime |
| 13 | Node version | **Node 20 LTS** pinned via `.nvmrc` + `engines` field | Reproducible across dev machines |

### Rule for Biome and ESLint

Biome is the formatter AND linter. Adding ESLint alongside is a **named
decision, not a fallback**. If the team discovers a specific rule Biome does
not cover and wants it, the options are:

1. Live without the rule and enforce in code review.
2. Build a Biome custom lint plugin.
3. Add a supplementary ESLint config for that specific rule set only. This
   counts as a §0.7 deviation — requires explicit approval and PR-level
   scope definition.

We do NOT run both tools concurrently by default.

### Decisions this ADR does NOT make

- **Backend framework** (Fastify / Hono / tRPC / Express). Not needed until
  a server ships.
- **Offline storage wrapper.** Addressed in ADR-014 for M1.
- **Auth provider.** Out of M1 scope.
- **Deployment target.** Out of M1 scope.
- **CI provider.** Decide within the first two weeks of M1 work.
- **3D renderer.** Three.js via `@react-three/fiber` is the likely choice;
  ADR-008 keeps mesh descriptors renderer-neutral so the decision waits
  until Milestone 5.
- **Database server.** ADR-014 names Postgres + PostGIS as the planned
  server DB; no server in M1.

## Consequences

- Every M1 developer clones and runs identical versions of Node, pnpm, TS,
  Vite, Vitest, Biome.
- Types flow across packages without translation layers.
- Canvas draw loops subscribe to state directly via Zustand, avoiding a
  React re-render loop.
- Serialized documents are human-readable and diffable.
- Lint + format is a single tool; contributor friction is low.
- UUIDv7 IDs sort by creation in DB indexes, log tables, and in-memory maps
  — a free locality win.

## What this makes harder

- Adopting Tailwind, SolidJS, or a different bundler later is a §0.7
  deviation requiring a new superseding ADR. This is the supersede-ability
  tradeoff working as designed.
- Biome coverage gaps for niche typescript-eslint rules will surface in
  review. Each case follows the rule above (live without / Biome plugin /
  approved supplementary ESLint).
- `zundo` only captures store state, not side effects. The document-slice
  scoping keeps it clean but means UI-state undo (e.g. "undo selection
  change") is not free and is not in scope.

## Cross-references

- **ADR-004** Parameter Extraction — Zod enforces extractor parameter shapes
  at the API boundary.
- **ADR-010** Project Sync — the op log is the undo unit; `zundo` wraps the
  document store.
- **ADR-011** UI Stack — already picks `lucide-react` and the React
  `ThemeProvider`. This ADR makes the React decision explicit.
- **ADR-013** 2D Rendering Pipeline — relies on Zustand `store.subscribe` for
  canvas redraw triggers.
- **ADR-014** Persistence Architecture — uses UUIDv7 and the JSON
  serialization primitive decided here.
- **`docs/design-tokens.md`** v1.2.0 (same PR) — replaces `styled.div`
  illustrative examples with CSS-module examples to align with Decision #12.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-18 | Initial ADR. Pins M1 technology stack. |
