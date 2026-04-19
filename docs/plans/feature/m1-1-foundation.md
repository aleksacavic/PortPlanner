# Plan — M1.1 Foundation

**Branch:** `feature/m1-1-foundation`
**Author:** Claude (Opus 4.7, 1M context)
**Date:** 2026-04-18
**Status:** Authored — awaiting review
**Operating mode:** Procedure 01 (PLAN-ONLY) → Procedure 03 (EXECUTION) after approval

---

## 1. Request summary

Stand up the M1.1 Foundation: the monorepo scaffold, M1 tooling pins per
ADR-012, the `packages/design-system` package with the three-layer token
pipeline and `ThemeProvider` per `design-tokens.md` v1.2.0, an `apps/web`
shell matching the prototype layout (navbar + sidebars + empty canvas area)
styled under the dark theme, and a minimal GitHub Actions CI workflow.
No document model, no canvas rendering, no RTG_BLOCK — those are subsequent
M1 slices.

This is the first of four M1 slices (M1.1 Foundation → M1.2 Document Model
→ M1.3 2D Editor Shell → M1.4 RTG_BLOCK).

## 2. Assumptions and scope clarifications

Answered via pre-plan user questions on 2026-04-18:

| # | Question | User answer |
|---|---|---|
| 1 | M1 theme | **Dark only.** Matches the validated prototype palette. Light theme deferred to Milestone 5. |
| 2 | npm workspace scope | **`@portplanner/*`** as working name. User noted the scope is a working name and mechanically renameable later (update `name` fields + import paths in one commit). |
| 3 | CI workflow in M1.1 | **GitHub Actions** — minimal workflow on PRs to main: install, typecheck, test, Biome. |
| 4 | `apps/web` content | **Prototype-shell placeholder.** Navbar + left/right sidebars + empty canvas area matching the prototype layout, styled with tokens under dark theme. |

Other assumptions (not popped as questions because obvious defaults):

- **Node 20 LTS.** Pinned via `.nvmrc`, `engines`, and `packageManager` fields.
- **pnpm 9.x.** Pinned via `packageManager` field.
- **TypeScript 5.x strict.** Root `tsconfig.base.json` with `strict: true`.
- **Vite 5+** for `apps/web` bundling.
- **Vitest 2.x** for unit + integration tests.
- **Biome 1.x** as the sole formatter + linter. No Prettier. No ESLint.
- **React 18+** (latest stable at execution time; the ADR-012 floor is 18).
- **Package names for M1.1:** `@portplanner/domain`, `@portplanner/design-system`, `@portplanner/web`. `packages/domain` is scaffolded as an empty skeleton (types/extractors land in M1.2+).
- **Reference prototype** at `reference/prototype-v1.html` is for **visual layout reference only**. MUST NOT port code. See §0.3 of either architecture contract (`docs/procedures/Claude/00-architecture-contract.md` or `docs/procedures/Codex/00-architecture-contract.md` — the rule is mirrored).

## 3. Scope and Blast Radius

### In scope

**Files to be created (all new):**

Repository root:
- `pnpm-workspace.yaml`
- `package.json` (root with dev scripts + workspaces)
- `tsconfig.base.json`
- `.nvmrc`
- `.gitignore`
- `.gitattributes`
- `biome.json`
- `vitest.config.ts` (root)
- `.github/workflows/ci.yml`

`packages/domain/`:
- `package.json`
- `tsconfig.json`
- `src/index.ts` (empty placeholder — expands in M1.2)

`packages/design-system/`:
- `package.json`
- `tsconfig.json`
- `src/index.ts` (re-exports)
- `src/tokens/primitives.ts`
- `src/tokens/semantic-dark.ts`
- `src/tokens/themes.ts`
- `src/tokens/css-vars.ts`
- `src/tokens/index.ts`
- `src/theme/ThemeContext.ts`
- `src/theme/ThemeProvider.tsx`
- `src/theme/useTheme.ts`
- `src/theme/useActiveThemeTokens.ts`
- `src/theme/index.ts`
- `src/global.css`
- `tests/tokens.test.ts`
- `tests/theme-provider.test.tsx`

`apps/web/`:
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/App.module.css`
- `src/shell/AppShell.tsx`
- `src/shell/AppShell.module.css`
- `src/shell/Navbar.tsx`
- `src/shell/Navbar.module.css`
- `src/shell/Sidebar.tsx`
- `src/shell/Sidebar.module.css`
- `src/shell/CanvasArea.tsx`
- `src/shell/CanvasArea.module.css`
- `src/shell/StatusBar.tsx`
- `src/shell/StatusBar.module.css`
- `src/global.css`
- `tests/app-shell.test.tsx`

Root documentation touch-up (not a binding-spec change):
- `README.md` — append a "Local development" subsection.

### Files to be modified

None. All files in this plan are new creations. `README.md` is the only
existing file edited, and only to append local-dev instructions.

### Out of scope (explicitly deferred)

| Concern | Slice / Milestone |
|---|---|
| Document model, core types, Zod schemas | M1.2 |
| UUIDv7 generation utility | M1.2 |
| Canonical JSON serializer | M1.2 |
| IndexedDB persistence (ADR-014) | M1.2 |
| Zustand + zundo stores | M1.2 |
| Canvas2D + DPR + view transform + `rbush` + `@flatten-js/core` | M1.3 |
| RTG_BLOCK tool, extractor, validation rules, yard capacity panel | M1.4 |
| `packages/editor-2d` package creation | M1.3 |
| `packages/viewer-3d` package creation | Milestone 5 |
| `services/api` package creation | Milestone 3+ (when server ships) |
| Light theme + theme switcher UI | Milestone 5 |
| Component library extraction, Storybook, component docs | Milestone 5 |
| Library system, scenarios, RBAC, auth, deployment | Milestones 3–5 |

### Blast radius

| Area | Effect |
|---|---|
| Packages affected | `packages/domain` (skeleton only), `packages/design-system` (first full implementation), `apps/web` (first implementation) |
| Cross-object extractors | None touched |
| Scenarios | None touched |
| Stored data | None — no persistence in M1.1 |
| UI surfaces | The app shell is brand-new. No pre-existing UI. |

## 4. Binding specifications touched

| Spec | Role in this plan |
|---|---|
| **ADR-012** Technology Stack | Implemented literally. All pinned choices applied. |
| **`docs/design-tokens.md` v1.2.0** | Implemented literally for the **dark** theme. Three-layer tokens; `ThemeProvider`, `useTheme`, `useActiveThemeTokens`; CSS custom-property emission; CSS-Modules component styling. Light and system modes are unreachable at the type level in M1.1 — progressive implementation per §6. |
| **ADR-011** UI Stack | Implemented literally. `lucide-react` not yet imported (no icons needed in M1.1 shell placeholders — section titles "Tools" and "Properties" are plain text). `ThemeProvider` type narrowed to `mode: 'dark'` in M1.1; widens to the full `'dark' \| 'light' \| 'system'` union in Milestone 5 (additive, backward-compatible). |
| **Architecture contract** §0.4 GR-3 Module Isolation | Enforced via grep gates G1.1, G1.2, G3.3 covering every GR-3 boundary including the future `services/api` as `@portplanner/api`. |
| **Architecture contract** §0.4 GR-1 Preproduction Clean-break | No migration shims. No compatibility code. |
| **Architecture contract** §0.4 GR-2 Architecture-first | SSOT tokens; single source of truth for theme; no shortcut styling. |

Other binding specs (ADRs 001–010, 013, 014, extraction registry, glossary,
`coordinate-system.md`) — **no change**. M1.1 does not touch them.
M1.2–M1.4 will.

### Non-binding reference material consulted

Per §0.3 of the architecture contract, the following is reference material
only and is NOT a binding spec. Listed here for transparency, separate
from the binding table above.

| Material | Path | Role |
|---|---|---|
| Prototype HTML | `reference/prototype-v1.html` | Visual layout reference for Phase 4 (navbar + sidebars + canvas area + status bar shape). MUST NOT port code, CSS, or HTML structure. Anti-port enforced by grep gate G4.1 (no hardcoded hex colours in CSS modules) and by the general §0.3 rule. |

## 5. Architecture Doc Impact

| Doc | Path | Change type | Reason |
|-----|------|-------------|--------|
| ADR-012 Technology Stack | `docs/adr/012-technology-stack.md` | No change | Implementation conforms |
| ADR-013 2D Rendering Pipeline | `docs/adr/013-2d-rendering-pipeline.md` | No change | Not yet implemented in M1.1 |
| ADR-014 Persistence Architecture | `docs/adr/014-persistence-architecture.md` | No change | Not yet implemented in M1.1 |
| ADR-011 UI Stack | `docs/adr/011-ui-stack.md` | No change | Implementation conforms |
| Design Tokens | `docs/design-tokens.md` | No change | v1.2.0 is the binding version; implementation consumes it exactly |
| Glossary | `docs/glossary.md` | No change | No new domain terms introduced |
| Extraction Registry | `docs/extraction-registry/*.md` | No change | No object types implemented in M1.1 |
| Architecture contract (Claude + Codex) | `docs/procedures/Claude/00-architecture-contract.md`, `docs/procedures/Codex/00-architecture-contract.md` | No change | Implementation conforms |
| README (root) | `README.md` | Append "Local development" section | Onboarding text; no binding behaviour change |

## 6. Deviations from binding specs

**None.** This plan implements binding specs literally. No §0.7 deviation
is proposed.

### Explicit note on theme handling (Round 1 Codex review, item P2/SM1)

Codex Round 1 flagged the original ThemeProvider handling of `light` /
`system` modes (Proxy throwing on read; `console.warn` fallback) as a
candidate §0.7 deviation. In response, Phase 3 was revised to implement
`ThemeProvider` with `mode: 'dark'` only — a strict **narrower subset** of
`design-tokens.md` v1.2.0's three-state contract
(`'dark' | 'light' | 'system'`). This is **progressive implementation**,
not a deviation, for the following reasons:

1. The execution plan explicitly excludes the theme switcher and one of
   the themes from M1 ("pick dark or light, ship one" —
   `docs/execution-plan.md` Milestone 1 "Explicitly out of scope").
2. The narrower type reflects what is implementable in M1.1. Milestone 5
   widens the union additively. Consumers passing `mode="dark"` continue
   to type-check after widening; no breaking change for M1.1 code.
3. Per §0.7, a deviation **alters spec semantics**. A strict subset is
   not an alteration — it is incomplete-but-forward-compatible
   implementation, explicitly allowed by M1's exclusions.
4. No runtime fallback behaviour is introduced. The previous
   Proxy-throwing / warning-on-fallback design (revised out) *would* have
   added spec-absent runtime semantics and warranted a deviation; the
   revised narrow-type design does not.

**User approval of this interpretation:** 2026-04-18,
`aleksacavic@gmail.com`, via pre-plan question response confirming
"Narrow type, no deviation" over "Declare §0.7 deviation, keep Proxy".
Also recorded in Appendix A.

### Progressive-implementation compliance check (architecture-contract §0.7)

Per the §0.7 "Progressive implementation (distinct from deviation)"
clause (landed on main in commit `a209ed9`, merged into this branch by
merge commit `1c96ed5`), this plan satisfies all four conditions for
non-deviation classification:

| # | Condition | Status | Plan reference |
|---|---|---|---|
| 1 | No conflicting runtime semantics | **Satisfied** | Phase 3 Step 3: Proxy removed; Steps 3 and 6 both state "no Proxy, no fallback, no warning log". No runtime behaviour is added that is absent from `design-tokens.md` v1.2.0. |
| 2 | Excluded features unreachable at the type level | **Satisfied** | Phase 3 Step 6 narrows `ThemeMode` to `'dark'` only in M1.1; the widening in Milestone 5 is additive (a union superset), so M1.1 consumers continue to type-check after widening. Phase 3 Step 9 adds a type-level test confirming `'light'` and `'system'` are rejected by the compiler. |
| 3 | User approval recorded in plan file with identifier and date | **Satisfied** | §6 above records: 2026-04-18, `aleksacavic@gmail.com`, selected "Narrow type, no deviation" via pre-plan AskUserQuestion popup. Appendix A records the same approval. |
| 4 | Widening plan explicitly stated | **Satisfied** | Phase 3 Step 3 names **Milestone 5** as the widening point: "Milestone 5 adds `light` and `system` by widening the provider's mode type and adding the missing semantic-token exports — a purely additive change." See also `docs/execution-plan.md` Milestone 5 scope. |

**Classification: Progressive implementation, not deviation.** No §0.7
Approved Deviation Protocol ceremony is required. The Codex Round 2
reviewer verification expectation (per the §0.7 Codex-mirror note) is
satisfied by this mapping table and the plan references above.

## 7. Object Model and Extraction Integration

**Not applicable.**

M1.1 does not introduce any object types, extractors, validation rules,
ownership-state transitions, mesh descriptors, or document-sync behaviour.
Those land in M1.2–M1.4.

## 8. Hydration, Serialization, Undo/Redo, Sync

**Not applicable.**

M1.1 does not touch the document model. No load/save paths are implemented;
no operations are logged; no undo/redo; no sync. First introduced in M1.2.

## 9. Implementation phases

Five phases. Each phase must pass every listed gate before the next begins.

---

### Phase 1 — Repository skeleton

**Goal:** Establish the monorepo structure per GR-3 with tooling pins per
ADR-012. Nothing runs yet; the scaffolding just validates.

**Files created in this phase:**

- `pnpm-workspace.yaml`
- `package.json` (root)
- `.nvmrc`
- `.gitignore`
- `.gitattributes`
- `tsconfig.base.json`
- `packages/domain/package.json`
- `packages/domain/tsconfig.json`
- `packages/domain/src/index.ts` (single `export {}` placeholder)
- `packages/design-system/package.json`
- `packages/design-system/tsconfig.json`
- `packages/design-system/src/index.ts` (empty re-export stub)
- `apps/web/package.json`
- `apps/web/tsconfig.json`

**Steps:**

1. Create `pnpm-workspace.yaml` listing `apps/*` and `packages/*`.
2. Create root `package.json` with:
   - `"private": true`
   - `"packageManager": "pnpm@9.15.0"` (or latest pnpm 9.x at execution time)
   - `"engines": { "node": ">=20.0.0" }` (open floor; `.nvmrc` still pins CI to Node 20 — see Post-execution notes "PE-1")
   - Scripts: `dev`, `build`, `test`, `typecheck`, `check`, `fix` (exact script bodies defined in Phase 2; placeholder `echo` bodies acceptable here if needed)
3. Create `.nvmrc` containing `20`.
4. Create `.gitignore` with: `node_modules/`, `dist/`, `.DS_Store`, `*.log`, `coverage/`, `.claude/`, `.idea/`, `.vscode/`.
5. Create `.gitattributes` with `* text=auto eol=lf`.
6. Create `tsconfig.base.json` with `strict: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `esModuleInterop: true`, `skipLibCheck: true`, `jsx: "react-jsx"`, `isolatedModules: true`, `verbatimModuleSyntax: true`, `noUncheckedIndexedAccess: true`.
7. Create each package's `package.json` with `name`, `version: "0.1.0"`, `private: true`, `type: "module"`, `main: "src/index.ts"`, `exports: { ".": "./src/index.ts" }`.
8. Create each package's `tsconfig.json` extending `tsconfig.base.json`.
9. Run `pnpm install`.

**Invariants introduced:**

| ID | Invariant | Enforcement |
|---|---|---|
| I1 | `packages/domain` has no imports from other packages | Grep gate G1.1 |
| I2 | `packages/design-system` has no imports from `domain`, `editor-2d`, `viewer-3d`, `apps/*`, `services/*` | Grep gate G1.2 |
| I5 | TypeScript strict mode enabled in every package | `tsc --noEmit` across all packages exits 0 |

**Mandatory completion gates:**

```
G1.0 — pnpm install succeeds
  Command: pnpm install
  Expected: exit 0

G1.1 — domain has zero cross-package imports (incl. future services/api)
  Command: rg -n "from '@portplanner/(design-system|web|editor-2d|viewer-3d|api)'" packages/domain/src
  Expected: zero matches

G1.2 — design-system has zero cross-package imports (incl. future services/api)
  Command: rg -n "from '@portplanner/(domain|web|editor-2d|viewer-3d|api)'" packages/design-system/src
  Expected: zero matches

G1.3 — typecheck passes across all packages
  Command: pnpm -r exec tsc --noEmit
  Expected: exit 0, zero errors
```

**Tests added in this phase:** none. Phase 2 adds Vitest config; Phase 3
adds first real tests.

---

### Phase 2 — Tooling (Biome + Vitest + Vite)

**Goal:** Wire the formatter, linter, test runner, and dev server. Scripts
become real. Nothing runs application code yet.

**Files created in this phase:**

- `biome.json` (root)
- `vitest.config.ts` (root)
- `apps/web/vite.config.ts`
- `apps/web/index.html` (minimal — `<div id="root"></div>`)
- `apps/web/src/main.tsx` (temporary hello-world; replaced in Phase 4)
- `apps/web/src/App.tsx` (temporary hello-world; replaced in Phase 4)

**Steps:**

1. Add `biome.json` with formatter + linter enabled, recommended rules on,
   no conflicting overrides. Ignore patterns: `dist/`, `node_modules/`,
   `coverage/`, `.claude/`.
2. Add root `vitest.config.ts` with workspace discovery via
   `test.projects` pointing at each package's vitest setup (or global
   config if simpler).
3. Add `apps/web/vite.config.ts` with the React plugin and CSS-Modules
   enabled (Vite's default CSS-Modules for `*.module.css` is sufficient).
4. Add `apps/web/index.html` with a root div and a `<script type="module" src="/src/main.tsx"></script>`.
5. Add temporary `main.tsx` rendering `<App />`; temporary `App.tsx`
   returning `<h1>PortPlanner</h1>`. These are replaced in Phase 4.
6. Fill root `package.json` scripts:
   - `"dev": "pnpm --filter @portplanner/web dev"`
   - `"build": "pnpm -r build"`
   - `"test": "vitest run"`
   - `"typecheck": "pnpm -r exec tsc --noEmit"`
   - `"check": "biome check"`
   - `"fix": "biome check --write"`
7. Add each package's `dev`/`build`/`test` scripts as appropriate
   (apps/web has `dev: "vite"`, `build: "vite build"`; packages have
   `test: "vitest run"`).

**Invariants introduced:**

| ID | Invariant | Enforcement |
|---|---|---|
| I6 | Biome lint + format passes on every file | `pnpm check` exits 0 |

**Mandatory completion gates:**

```
G2.0 — Biome check passes
  Command: pnpm check
  Expected: exit 0

G2.1 — typecheck still passes
  Command: pnpm typecheck
  Expected: exit 0

G2.2 — test runner exits 0 with zero or placeholder tests
  Command: pnpm test
  Expected: exit 0 (zero tests is acceptable in this phase)

G2.3 — Vite dev config is valid
  Command: pnpm --filter @portplanner/web exec vite build --mode development
  Expected: exit 0 (build succeeds with temporary App.tsx)
```

**Tests added in this phase:** none required. A single smoke test in
`apps/web/tests` verifying the temporary App renders is optional; Phase 4
will replace it with a real shell test.

---

### Phase 3 — Design system: tokens + ThemeProvider

**Goal:** Implement the three-layer token architecture, the CSS custom
property emission, and the `ThemeProvider` with `useTheme` and
`useActiveThemeTokens` hooks — per `design-tokens.md` v1.2.0. Only the
**dark** theme is implemented in M1.1; `light` and `system` are neither
exported nor reachable at the type level (narrow `ThemeMode = 'dark'`) and
widen additively in Milestone 5. See §6 for the progressive-implementation
classification and user approval (Q1).

**Files created in this phase:**

- `packages/design-system/src/tokens/primitives.ts`
- `packages/design-system/src/tokens/semantic-dark.ts`
- `packages/design-system/src/tokens/themes.ts`
- `packages/design-system/src/tokens/css-vars.ts`
- `packages/design-system/src/tokens/index.ts`
- `packages/design-system/src/theme/ThemeContext.ts`
- `packages/design-system/src/theme/ThemeProvider.tsx`
- `packages/design-system/src/theme/useTheme.ts`
- `packages/design-system/src/theme/useActiveThemeTokens.ts`
- `packages/design-system/src/theme/index.ts`
- `packages/design-system/src/global.css`
- `packages/design-system/src/index.ts` (top-level re-exports)
- `packages/design-system/tests/tokens.test.ts`
- `packages/design-system/tests/theme-provider.test.tsx`
- `packages/design-system/vitest.config.ts` (with `jsdom` environment for the provider test)

**Steps:**

1. **Primitives (`primitives.ts`).** Implement `color`, `text_color`,
   `size`, `radius`, `font`, `shadow`, `motion` objects matching
   `design-tokens.md` §"Layer 1 — Primitives" exactly. Typed `as const`.
2. **Semantic tokens — dark (`semantic-dark.ts`).** Implement the full
   `SemanticTokens` interface per `design-tokens.md` §"Layer 2 — Semantic
   Tokens" with dark values per §"Dark theme". Import primitives. Expose
   `const dark: SemanticTokens`.
3. **Theme mappings (`themes.ts`).** Define the `SemanticTokens` type (the
   interface body shown in `design-tokens.md`). Export **only** the `dark`
   theme constant. `light` and `system` are **not** exported, not declared,
   and not reachable at the type level in M1.1.
   ```ts
   export const dark: SemanticTokens = { /* … */ };
   ```
   **No Proxy. No runtime fallback. No warning log.** Milestone 5 adds
   `light` and `system` by widening the provider's mode type and adding
   the missing semantic-token exports — a purely additive change.
4. **CSS-var emitter (`css-vars.ts`).** A pure function
   `emitCSSVars(tokens: SemanticTokens): string` that produces a string
   of `--foo: value;` declarations flattening the semantic-token tree
   using dotted keys, for example:
   - `surface.raised` → `--surface-raised: #161b26;`
   - `canvas.snap_indicator` → `--canvas-snap-indicator: #00e5a0;`
   The naming rule: lowercase, dots → hyphens, underscores → hyphens.
   Deterministic ordering (sort keys).
5. **Global CSS (`global.css`).** Exports the compiled CSS for both
   themes under class selectors. In M1.1 only `.theme-dark` is populated;
   `.theme-light` is omitted (Milestone 5). `global.css` is imported by
   `apps/web/src/global.css` in Phase 4.
6. **`ThemeContext` + `ThemeProvider`.** M1.1 implements a **narrower
   subset** of the final contract in `design-tokens.md` §"ThemeProvider
   contract". The types widen progressively in later milestones.
   ```ts
   // M1.1 — narrow
   type ThemeMode = 'dark';
   type ActiveTheme = 'dark';

   // Milestone 5 widens additively (non-breaking for M1.1 consumers):
   // type ThemeMode = 'dark' | 'light' | 'system';
   // type ActiveTheme = 'dark' | 'light';
   ```
   Consumers passing `mode="dark"` continue to type-check when the widening
   lands — widening a union is backward-compatible. The narrowing is
   **progressive implementation** aligned with the execution plan's M1
   exclusion of the theme switcher and one of the themes; it is
   **not a §0.7 deviation** (see §6 for the explicit rationale).

   M1.1 behaviour: `mode="dark"` → `active="dark"`. No fallback logic,
   no warnings, no Proxy. `light` and `system` are unreachable at the
   type level.
7. **`useTheme`.** Returns `{ mode, active, setMode }` from context.
8. **`useActiveThemeTokens`.** Returns the semantic-tokens object for the
   active theme; always `dark` in M1.1.
9. **Tests (`tokens.test.ts`):**
   - Every semantic-token path that appears in the `SemanticTokens`
     interface has a non-null value in `dark`.
   - `emitCSSVars(dark)` is deterministic: calling it twice produces
     byte-identical output.
   - `emitCSSVars(dark)` emits one declaration per leaf semantic token.
   - **Type-level check**: `ThemeMode` accepts `'dark'` and only `'dark'`.
     A `// @ts-expect-error` assertion (or equivalent `tsd` / `expect-type`
     assertion) confirms that passing `'light'` or `'system'` is a type
     error in M1.1.
10. **Tests (`theme-provider.test.tsx`):**
    - `<ThemeProvider mode="dark">` mounted via `@testing-library/react`
      sets `html.theme-dark` class on the document root, and
      `useActiveThemeTokens()` returns the `dark` token object.
    - `useTheme()` returns `{ mode: 'dark', active: 'dark', setMode }`.
      `setMode('dark')` is a no-op (the only valid argument in M1.1);
      the widening to accept `'light'`/`'system'` is deferred to
      Milestone 5.

**Invariants introduced:**

| ID | Invariant | Enforcement |
|---|---|---|
| I3 | Primitives are referenced only inside `packages/design-system/src/tokens/semantic-dark.ts` (and future light sibling). Components and apps consume semantic tokens only. | Grep gate G3.1 |
| I4 | `styled-components` / `@emotion/styled` / `@emotion/react` are not imported anywhere | Grep gate G3.2 |
| I8 | `emitCSSVars` is deterministic | Unit test `tokens.test.ts::emit-is-deterministic` |

**Mandatory completion gates:**

```
G3.0 — design-system tests pass
  Command: pnpm --filter @portplanner/design-system test
  Expected: exit 0, all tests pass

G3.1 — primitives not leaked outside semantic-token files
  Command: rg -n "from '.*tokens/primitives'" packages/ apps/ -g '!packages/design-system/src/tokens/semantic-*.ts'
  Expected: zero matches

G3.2 — no styled-components / emotion imports anywhere
  Command: rg -n "from 'styled-components'|from '@emotion/(styled|react)'" packages/ apps/
  Expected: zero matches

G3.3 — design-system has zero cross-package imports (re-verify; incl. future services/api)
  Command: rg -n "from '@portplanner/(domain|web|editor-2d|viewer-3d|api)'" packages/design-system/src
  Expected: zero matches

G3.4 — typecheck still passes
  Command: pnpm typecheck
  Expected: exit 0
```

**Tests added in this phase:**

- `packages/design-system/tests/tokens.test.ts` — 4 test cases (see Step 9).
- `packages/design-system/tests/theme-provider.test.tsx` — 2 test cases
  (see Step 10).

---

### Phase 4 — apps/web prototype-shell placeholder

**Goal:** Render the app shell matching the prototype layout. Navbar + left
sidebar + empty canvas area + right sidebar + status bar, all styled with
CSS Modules consuming tokens via `var(--…)` under the dark theme. No
interactivity beyond what the ThemeProvider provides.

**Files created in this phase:**

- `apps/web/src/main.tsx` (replaces Phase 2 placeholder)
- `apps/web/src/App.tsx` (replaces Phase 2 placeholder)
- `apps/web/src/App.module.css`
- `apps/web/src/shell/AppShell.tsx`
- `apps/web/src/shell/AppShell.module.css`
- `apps/web/src/shell/Navbar.tsx`
- `apps/web/src/shell/Navbar.module.css`
- `apps/web/src/shell/Sidebar.tsx`
- `apps/web/src/shell/Sidebar.module.css`
- `apps/web/src/shell/CanvasArea.tsx`
- `apps/web/src/shell/CanvasArea.module.css`
- `apps/web/src/shell/StatusBar.tsx`
- `apps/web/src/shell/StatusBar.module.css`
- `apps/web/src/global.css`
- `apps/web/tests/app-shell.test.tsx`

**Steps:**

1. **`main.tsx`:** Mount React. Wrap with `<ThemeProvider mode="dark">`.
   Import `apps/web/src/global.css`.
2. **`global.css`:** Import `@portplanner/design-system/src/global.css` to
   inject the `.theme-dark` CSS custom properties. Add app-level resets
   (`* { box-sizing: border-box }`, `body { margin: 0 }`, etc.) using
   tokens where appropriate (`body { background: var(--surface-base); color: var(--text-primary); font-family: var(--font-family-sans); }`).
3. **`App.tsx`:** Renders `<AppShell>{/* canvas goes here */}</AppShell>`.
4. **`AppShell.tsx`:** Five-region CSS Grid layout:
   - Row 1: Navbar (full width)
   - Row 2 columns: left Sidebar + content + right Sidebar
   - Row 3: StatusBar (full width)
   All five regions are sibling children of the grid root. Grid template
   expressed in `AppShell.module.css`.
5. **`Navbar.tsx`:** Horizontal flex row. Left: "PortPlanner" wordmark
   text styled with `var(--text-primary)` and typography tokens. Right:
   an inert placeholder region where tool controls will land later. No
   icons (Lucide imports deferred until first real icon need).
6. **`Sidebar.tsx`:** Reusable component taking a `title: string` prop and
   `side: 'left' | 'right'` prop. Renders the title at the top (using
   secondary-text token) and an empty placeholder region. Used twice from
   `AppShell`: left with `title="Tools"`, right with `title="Properties"`.
7. **`CanvasArea.tsx`:** Styled empty `<div>` with canvas-background token
   and a faint grid hint using `canvas.grid` token (optional; the empty
   region alone is fine if execution prefers minimal). The actual
   `<canvas>` element arrives in M1.3.
8. **`StatusBar.tsx`:** Single row. Left: "Ready" text. Right: app version
   (`0.1.0` from `package.json`, read at build time via Vite's
   `import.meta.env` or hardcoded).
9. **CSS Modules (`*.module.css`):** Each component's file consumes
   `var(--…)` tokens only. No primitive imports. No hardcoded colour
   values.
10. **Tests (`app-shell.test.tsx`):**
    - `<App />` renders without throwing.
    - Heading "PortPlanner" is in the document.
    - "Tools" and "Properties" sidebar titles are in the document.
    - "Ready" status text is in the document.
    - (Optional) `document.documentElement.classList` contains
      `theme-dark` after mount.

**Invariants introduced:**

| ID | Invariant | Enforcement |
|---|---|---|
| I9 | `apps/web` component styles do not hardcode colour values — all colours come from `var(--…)` | Grep gate G4.1 |
| I10 | `apps/web` does not import `@portplanner/design-system/src/tokens/primitives` | Grep gate G4.2 |

**Mandatory completion gates:**

```
G4.0 — apps/web tests pass
  Command: pnpm --filter @portplanner/web test
  Expected: exit 0, all tests pass

G4.1 — no hardcoded hex colours in apps/web component styles
  Command: rg -n "#[0-9a-fA-F]{3,8}\b" apps/web/src -g "*.module.css"
  Expected: zero matches (all colours via var(--…))

G4.2 — apps/web does not import primitives
  Command: rg -n "from '.*tokens/primitives'" apps/web
  Expected: zero matches

G4.3 — build succeeds
  Command: pnpm --filter @portplanner/web build
  Expected: exit 0, dist/ produced

G4.4 — Biome + typecheck still pass
  Command: pnpm check && pnpm typecheck
  Expected: exit 0
```

**Manual verification (user, not gated):**

- `pnpm dev` starts Vite; visiting the dev URL shows the dark-themed shell
  with navbar, left sidebar ("Tools"), right sidebar ("Properties"), empty
  canvas area, and status bar.

---

### Phase 5 — CI workflow

**Goal:** Wire a minimal GitHub Actions workflow that runs install +
typecheck + test + Biome on every PR targeting main and on every push to
main.

**Files created in this phase:**

- `.github/workflows/ci.yml`

**Steps:**

1. Workflow triggers: `pull_request` with branches `[main]` and `push`
   with branches `[main]`.
2. Single job `check` running on `ubuntu-latest`.
3. Steps:
   - `actions/checkout@v4`
   - `actions/setup-node@v4` with `node-version-file: .nvmrc`
   - `pnpm/action-setup@v4` with `version: 9` (or `package.json`
     `packageManager` field)
   - `pnpm install --frozen-lockfile`
   - `pnpm typecheck`
   - `pnpm check`
   - `pnpm test`

**Invariants introduced:**

| ID | Invariant | Enforcement |
|---|---|---|
| I11 | CI runs on every PR to main | GitHub Actions configuration present |

**Mandatory completion gates:**

```
G5.0 — CI workflow file exists with required structural keys
  Commands (all must exit 0):
    test -f .github/workflows/ci.yml
    rg -q "^on:" .github/workflows/ci.yml
    rg -q "pull_request:" .github/workflows/ci.yml
    rg -q "pnpm install" .github/workflows/ci.yml
  Expected: every command exits 0
  (Updated per PE-6: actionlint is a Go binary, not an npm package,
  so `pnpm dlx actionlint` is not feasible. GitHub Actions itself
  validates YAML at workflow-run time — this local gate verifies
  structural presence only.)
```

**Tests added in this phase:** none. The CI itself is the test.

---

## 10. Invariants summary

| ID | Invariant | Phase | Enforcement |
|----|-----------|-------|-------------|
| I1 | `packages/domain` has zero cross-package imports | 1 | G1.1 |
| I2 | `packages/design-system` has zero cross-package imports | 1, 3 | G1.2, G3.3 |
| I3 | Primitives referenced only inside semantic-token files | 3 | G3.1 |
| I4 | No styled-components / emotion imports anywhere | 3 | G3.2 |
| I5 | TypeScript strict mode on in every package | 1 | G1.3 |
| I6 | Biome lint + format passes on every file | 2 | G2.0 |
| I7 | Node version pinned via `.nvmrc` + `engines` + `packageManager` | 1 | File presence; CI uses `node-version-file: .nvmrc` |
| I8 | `emitCSSVars` is deterministic | 3 | Unit test `tokens.test.ts::emit-is-deterministic` |
| I9 | apps/web component styles reference no hardcoded hex colours | 4 | G4.1 |
| I10 | apps/web does not import token primitives | 4 | G4.2 |
| I11 | CI runs on every PR to main | 5 | G5.0 (workflow file structural checks: file exists + required YAML keys present via `test` + `rg -q`; see PE-6) + Done Criterion #8 (remote: CI workflow conclusion == `"success"` via `gh run list`) |

## 11. Test strategy

**Before this plan:** no tests exist.

**Added by this plan:**

| File | Test count | Purpose |
|------|-----------|---------|
| `packages/design-system/tests/tokens.test.ts` | 4 | Token shape completeness (every `SemanticTokens` path non-null in `dark`), `emitCSSVars` determinism, leaf-count match, type-level `ThemeMode` narrowness (`'light'`/`'system'` rejected by compiler) |
| `packages/design-system/tests/theme-provider.test.tsx` | 2 | Provider sets correct class on document root; `useTheme` hook returns the expected `{ mode, active, setMode }` shape |
| `apps/web/tests/app-shell.test.tsx` | 5 | Smoke test: App renders, sidebar titles present, status text present |

Total: **11 test cases** by end of M1.1.

Additional test types:
- **Typecheck** (via `pnpm typecheck`) runs across all packages.
- **Lint + format** (via `pnpm check`) runs across all files.
- **Build** (via `pnpm build`) validates the bundler for `apps/web`.

**Not in M1.1:**
- No end-to-end (Playwright) tests. Introduced when the interactive editor
  ships (M1.3+).
- No visual regression tests. Introduced if/when design-system components
  are extracted (Milestone 5).

## 12. Done Criteria

### Local — verifiable on a clean dev machine without external auth

All of the following MUST be true before M1.1 is considered locally complete:

1. After cloning the repository and running `pnpm install` from the repo
   root, `pnpm dev` starts the Vite dev server with no errors.
2. Opening the dev URL in a browser shows the dark-themed shell: navbar
   with "PortPlanner" wordmark, left sidebar labeled "Tools", right
   sidebar labeled "Properties", empty canvas area, status bar with
   "Ready".
3. `pnpm typecheck` exits 0.
4. `pnpm check` exits 0 (Biome clean).
5. `pnpm test` exits 0 with all 11 tests passing.
6. `pnpm build` exits 0 and produces `apps/web/dist/`.
7. All grep gates G1.1, G1.2, G3.1, G3.2, G3.3, G4.1, G4.2 return zero
   matches.

### Remote — requires push access + `gh` auth

8. CI workflow `ci.yml` runs green on the feature branch's PR.
   Verification command (requires `gh` authenticated):

   ```
   gh run list --workflow=ci.yml --branch=feature/m1-1-foundation --limit=1 --json conclusion -q '.[0].conclusion'
   ```

   Expected output: `"success"`.

### Invariants preserved

9. All binding specs in §4 remain unchanged beyond the `README.md` append
   documented in §5.
10. No edits to any ADR (001–014). No edits to `design-tokens.md` beyond
    v1.2.0 which is already on main. No edits to the extraction registry.
    No deviations proposed beyond the progressive-implementation note in
    §6 (which is not classified as a deviation per §0.7).

## 13. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Vite/React/TS version incompatibility with Biome or Vitest | Low | Use latest stable of each; if conflict surfaces, pin to the most recent compatible set |
| Node 20 LTS vs Node 22 on dev machines | Low | `.nvmrc` + `engines` + CI pins; devs without nvm get a clear error |
| CRLF drift on Windows dev machines | Low | `.gitattributes` with `eol=lf` on day one |
| Biome rule coverage gaps surface late | Medium | ADR-012 already names the policy: ESLint adoption is a §0.7 deviation, not a silent fallback. Raise as finding if hit. |
| Prototype-shell scope creeps (additional panels, bottom drawer) | Medium | This plan names exactly 5 shell components (Navbar, Sidebar×2, CanvasArea, StatusBar); adding more is a separate plan |
| Reference-prototype code is accidentally ported into shell CSS/TSX | Medium | Gate G4.1 (no hardcoded colours) catches colour porting; reviewer specifically asked to check pattern re-use per §0.3 of the architecture contract |

## 14. Execution notes

Procedure 03 (Plan Execution) operates in AUDIT-FIRST mode. Specific to
this plan:

- **Phase boundaries are strict.** All gates in Phase N must pass before
  Phase N+1 begins.
- **Commit granularity.** One commit per phase is the default. Alternative
  granularity (one commit per file group) requires a commit-message trail
  that names the phase.
- **Do not pre-compute or stub code ahead of its phase.** If Phase 3 needs
  a helper that Phase 4 will use, Phase 3 ships only what Phase 3 needs.
- **No new dependencies** beyond those named in this plan or ADR-012
  without a plan update. Specifically, no state-management lib (Zustand
  enters in M1.2), no canvas library (M1.3), no geometry library (M1.3).

---

## Plan Review Handoff

**Plan:** `docs/plans/feature/m1-1-foundation.md`
**Branch:** `feature/m1-1-foundation`
**Status:** Plan revised for Round 3 — awaiting re-review (Codex Round 2 memo dated 2026-04-18 rated 8.6/10, No-Go on N1; resolved by new architecture-contract §0.7 "Progressive implementation" clause landed in main commit `a209ed9` and four-condition compliance table added to §6. Q1 and Q2 stale-text quality gaps also fixed. All Round 1 resolutions verified still passing. See Appendix A.)

### Paste to Codex for plan review

> Review this plan using the protocol at
> `docs/procedures/Codex/02-plan-review.md` (Procedure 02).
> Apply strict evidence mode. Start from Round 1.
>
> Additionally verify:
>
> 1. §4 correctly lists every binding spec touched — ADR-011, ADR-012,
>    `design-tokens.md` v1.2.0, and the architecture-contract ground
>    rules are the only binding specs in scope. No ADR in 001–010 or
>    013–014 should be affected by M1.1.
> 2. §6 is truthful: no §0.7 deviation is proposed by this plan. If the
>    light-theme Proxy fallback in Phase 3 Step 3 constitutes a deviation
>    from `design-tokens.md` v1.2.0 (which defines a three-state mode but
>    does not explicitly require both themes to be runtime-complete in
>    every milestone), flag it as a Blocker so user approval is
>    recorded before execution begins.
> 3. All phases have mandatory completion gates per §1.12 of Procedure 01.
>    Each gate is a single concrete command with expected output.
> 4. Module-isolation grep gates cover every package boundary named in
>    GR-3 (domain, design-system, editor-2d, viewer-3d, apps/web,
>    services/api). The editor-2d and viewer-3d packages do not exist in
>    M1.1 but their absence must not be confused with their isolation —
>    gate patterns should still be present against future imports.
> 5. The plan does NOT pre-introduce anything that belongs in M1.2–M1.4
>    (no Zustand, no Canvas2D, no rbush, no @flatten-js, no RTG_BLOCK
>    code, no extractor, no IndexedDB, no UUIDv7 generator, no Zod
>    schemas beyond what exists in `packages/design-system` types).
> 6. The Done Criteria in §12 are objective and testable end-to-end.
>
> Report findings as Blocker / High-risk / Quality gap per §0.8 of the
> architecture contract.

---

## Appendix A — Scrutiny Assessment and Actions (Round 1 → Round 2)

In response to Codex Round 1 review (memo dated 2026-04-18, reviewing
plan at commit `7d3e2e1`). Per Procedure 02 §2.10, this appendix
documents each review item's decision, rationale, and the plan updates
made. History is preserved — prior plan text is updated in place, but
the review itself is recorded here without rewriting.

### Blockers

| ID | Codex Item | Decision | Plan updates | Rationale |
|---|---|---|---|---|
| P2 / SM1 | Undeclared §0.7 deviation: theme Proxy fallback | **Agree** | Phase 3 Steps 3, 6, 9, 10 rewritten. `themes.ts` exports only `dark`. `ThemeProvider`'s `ThemeMode` narrowed to `'dark'`. Proxy removed. No runtime fallback. Type-level test added to confirm `'light'` / `'system'` are rejected. §6 adds the progressive-implementation note. | Narrow-type approach is cleaner than declaring a deviation. A strict subset of the spec is progressive implementation, not a deviation. Milestone 5 widens the union additively without breaking M1.1 consumers. User-approved 2026-04-18 (narrow-type selected over "Declare §0.7 deviation, keep Proxy"). |
| P3 / SM2 | Phase 5 G5.1 narrative/manual, not a concrete command | **Agree** | G5.1 dropped. G5.0 reshaped to use `pnpm dlx actionlint` — single deterministic command. "CI green on PR" moved to Done Criteria §12 Remote bucket with a concrete `gh run list … conclusion` command. | Phase 5's scope is creating the workflow file. Whether CI runs green depends on Phases 1–4 and is a Done Criterion, not a phase gate. |
| P4 / SM3 | GR-3 grep gates miss `services/api` boundary | **Agree** | Grep gates G1.1, G1.2, and G3.3 updated: rejection union becomes `(design-system\|web\|editor-2d\|viewer-3d\|api)`. User confirmed `@portplanner/api` as the future package name (2026-04-18). | Forward-looking rejection patterns prevent future imports from silently bypassing GR-3 when `services/api` ships post-M1. |

### High-risk

| ID | Codex Item | Decision | Plan updates | Rationale |
|---|---|---|---|---|
| P6 | Done Criteria mixes local + remote (CI green depends on GitHub auth) | **Agree** | §12 restructured into three buckets: **Local** (clean machine), **Remote** (requires push + `gh` auth), **Invariants preserved**. CI-green moves to Remote with a concrete `gh run list` command. | A clean-machine engineer can verify the Local bucket without external credentials. Remote is explicit about what requires push access. |
| P9 | G3.1 pipe-based command may be fragile cross-shell | **Agree** | G3.1 rewritten to use `rg`'s native `-g '!…'` exclude flag. Single command, no shell pipe. Works identically on Windows (Git Bash / cmd / PowerShell) and Unix shells. | Eliminates cross-shell fragility by staying inside `rg`'s own flag surface. |

### Quality gaps

| ID | Codex Item | Decision | Plan updates | Rationale |
|---|---|---|---|---|
| P1 / SM4 | `reference/prototype-v1.html` listed under "Binding specs touched" | **Agree** | Row removed from §4 binding-spec table. New §4 subsection "Non-binding reference material consulted" documents the prototype's visual-reference-only role. | Prototype is reference material per §0.3 of the architecture contract, not a binding spec. The distinction matters — binding specs trigger §0.7 on deviation; reference material does not. |
| — | Path cite in §2 Assumptions referenced only the Claude contract mirror | **Agree** | §2 cite now references both `docs/procedures/Claude/00-architecture-contract.md` and `docs/procedures/Codex/00-architecture-contract.md` §0.3, noting the rule is mirrored. | Plan is reviewed by Codex, which reads from the Codex mirror. Both should be cited since both contain the same rule. |
| — | Done Criteria #1 `cd portplanner` (case-sensitive filesystem risk) | **Agree** | §12 Local #1 rewritten: "After cloning the repository and running `pnpm install` from the repo root, `pnpm dev` starts the Vite dev server…" Removes the case-sensitive `cd`. | Works across filesystems regardless of case sensitivity. |

### Passed in Round 1 (retained unchanged in revision)

- **P5** — No M1.2–M1.4 pre-introduction.
- **P7** — Prototype-shell placeholder does not port code or CSS from `reference/prototype-v1.html`.
- **P8** — Phase ordering correct.
- **P10** — Reviewer Handoff block matches Procedure 01 §1.11 Part A format.

### User approvals recorded (2026-04-18, aleksacavic@gmail.com)

| # | Decision | Scope in plan | Source |
|---|---|---|---|
| 1 | Narrow-type ThemeProvider for M1.1 (no §0.7 deviation; progressive implementation) | Phase 3 Steps 3, 6, 9, 10; §6 | AskUserQuestion popup: selected "Narrow type, no deviation (Recommended)" |
| 2 | `@portplanner/api` as the future package name for `services/api` | Grep gates G1.1, G1.2, G3.3 | AskUserQuestion popup: selected "@portplanner/api (Recommended)" |
| 3 | All other Round 1 findings (Blockers, High-risk, Quality gaps) resolved as documented above | Multiple sections | Implicit in user request "ask me if any decisions need my input" + approval of triage table |

### Round 2 closure checklist (against Codex §2.11)

- [x] Zero Blockers: P2/SM1 (deviation) resolved by narrow-type approach; P3/SM2 (gate quality) resolved by dropping G5.1; P4/SM3 (GR-3 coverage) resolved by adding `api` to grep unions.
- [x] Every High-risk item explicitly handled: P6 (done-criteria split), P9 (rg glob exclude).
- [x] Enforceable gates for all critical claims: Phase 5 now has a concrete `actionlint` gate; all isolation gates use single rg commands; no narrative gates remain.
- [x] Architecture-doc impact assessed and matches binding-spec realities: §4 is cleaner; non-binding prototype moved out; ADR-011 description updated for narrow type.
- [x] GR-3 module isolation verified across all current and future packages (domain, design-system, web, editor-2d, viewer-3d, api).
- [x] All deviations follow §0.7 protocol — none proposed in this plan; the narrow-type note in §6 is explicitly classified as progressive implementation with user approval recorded.

### Round 2 → Round 3 response

In response to Codex Round 2 review (memo dated 2026-04-18, reviewing
plan at commit `8f8d5bb`, rating **8.6/10 No-Go** with one open
High-risk item and two Quality gaps).

#### High-risk

| ID | Codex Item | Decision | Plan updates | Rationale |
|---|---|---|---|---|
| N1 / H1 | Subset-vs-deviation classification ambiguity at milestone granularity | **Agree — root cause is procedure gap, not author error** | Formalised as a new subsection in architecture-contract §0.7 "Progressive implementation (distinct from deviation)" via chore commit `a209ed9` (both Claude and Codex mirrors), merged to main. Feature branch pulled that change in via merge commit `1c96ed5`. Plan §6 extended with an explicit four-condition compliance table referencing the new §0.7 clause with concrete plan-section references for each condition. | Codex correctly identified that the prior contract did not explicitly distinguish progressive implementation from deviation at milestone granularity. Codifying Codex's four-condition rule as a first-class concept in §0.7 closes the ambiguity for this plan and for every future milestone plan. |

#### Quality gaps

| ID | Codex Item | Decision | Plan updates | Rationale |
|---|---|---|---|---|
| Q1 | §11 test strategy still references "light-theme placeholder throws" after Round 1 revision removed the Proxy | **Agree** | `tokens.test.ts` row description rewritten to accurately describe the four current tests: token shape completeness, `emitCSSVars` determinism, leaf-count match, and type-level `ThemeMode` narrowness. | Author edit drift from Round 1 revision. Consistency sweep performed in Round 2 response. |
| Q2 | §13 risks table row "Light-theme placeholder Proxy causes subtle bugs at mount" referenced behaviour that no longer exists | **Agree** | Row removed. No replacement risk added because the narrow-type approach introduces no new risk of its own beyond what is already covered by TypeScript strict mode and Phase 3 tests. | Author edit drift from Round 1 revision. |

#### Passed in Round 2 (retained unchanged in Round 3 revision)

All Round 1 resolutions (RR1–RR7) verified still passing; no
regressions introduced by Round 2 response.

#### User approvals recorded (2026-04-18, aleksacavic@gmail.com)

| # | Decision | Scope | Source |
|---|---|---|---|
| 4 | Formalise "Progressive implementation" in architecture-contract §0.7 on its own chore branch, then reference from plan §6 | `docs/procedures/Claude/00-architecture-contract.md` and Codex mirror | User approved the Round 2 → Round 3 response plan ("One High-risk [N1]… Codex's four-condition rule becomes canonical. Separate chore branch, merge to main.") consistent with the prior-established chore-branch-for-procedure-changes pattern |

#### Round 3 closure checklist (against Codex §2.11)

- [x] N1 resolved: §0.7 now explicitly defines progressive implementation. §6 invokes it with a four-condition compliance table backed by plan references.
- [x] Q1 resolved: §11 test-strategy description updated to match current tests.
- [x] Q2 resolved: §13 stale risk row removed.
- [x] No regressions: Round 1 items RR1–RR7 still passing; no new M1.2–M1.4 code pre-introduced.
- [x] Architecture-contract change landed on main before the plan references it; the cross-reference (`a209ed9`, `1c96ed5`) is valid in both git history and on the feature branch's working tree.
- [x] History preserved per §2.10: prior Round 1 plan text is updated in place, but the Round 1 review record in this appendix is untouched; Round 2 response is appended as a new subsection.

---

## Post-execution notes

Per Procedure 03 §3.7, mid-execution plan corrections discovered during
Procedure 03 execution are recorded here.

### PE-1 — Relax Node `engines` upper bound (discovered during Phase 1)

**Discovered:** Phase 1 G1.0 (`pnpm install`) context — developer machine
had Node v24.12.0 installed but the plan's `engines` field
`">=20.0.0 <21.0.0"` excluded it.

**Patch applied** (same commit as Phase 1 implementation):
- Plan §9 Phase 1 Step 2: `"engines": { "node": ">=20.0.0 <21.0.0" }` →
  `"engines": { "node": ">=20.0.0" }`.
- Rationale: ADR-012 #13 says *"Node 20 LTS pinned via `.nvmrc` +
  `engines` field."* The `.nvmrc` pin (`20`) is preserved and is what CI
  enforces. The `engines` field was over-encoded as a range lock; the
  ADR intent is a floor (do not silently allow Node 18 or earlier), not
  a ceiling (no pressure to refuse Node 22/24). Node 20 enters
  maintenance 2026-04-30; widening to a floor matches reality without
  weakening CI.
- Classification: plan correction, not an ADR deviation. ADR-012's word
  is "pinned"; `.nvmrc` remains the pin of record. No §0.7 protocol
  required.
- User approval: 2026-04-18, `aleksacavic@gmail.com`, response "go go
  agreed" to Option B proposal.

**Discovered:** pnpm not installed on developer machine at Phase 1 start.

**Resolution:** Environment setup step performed outside the plan:
developer ran `npm install -g pnpm@9.15.0` in an admin shell.
No plan patch required — pnpm availability was an implicit
prerequisite the plan did not name; future plans with pnpm as a
prerequisite should include an environment-check step before Phase 1.
(Candidate procedure enhancement, not logged here.)

### PE-2 — Existing `.gitignore` preserved

**Discovered:** Phase 1 Step 4 specified creating `.gitignore` with a
named set of entries. Repository already had a more comprehensive
`.gitignore` (covering `.pnpm-store/`, build outputs, test output,
`.env*` patterns, editor files, coverage). Plan's set was a subset.

**Resolution:** Kept the existing file. Appended the one missing entry
(`.claude/` — Claude Code local state directory, per-user, should not
be committed).

**Classification:** Not a deviation. Plan's list was a floor, not a
ceiling.

### PE-3 — `apps/web/src/index.ts` placeholder added

**Discovered:** G1.3 (`pnpm -r exec tsc --noEmit`) failed with TS18003
"No inputs were found" because `apps/web/tsconfig.json` includes
`src/**/*` but Phase 1 creates no files under `apps/web/src/` (Phase 2
adds `main.tsx`).

**Resolution:** Added `apps/web/src/index.ts` with a placeholder
comment and `export {};`. Phase 2 will create `main.tsx` alongside or
delete this placeholder — the plan's Phase 2 Step 5 wording
("Add temporary `main.tsx`") is untouched; implementation-time
decision for Phase 2 to either keep or delete `index.ts`.

**Classification:** Minor scope addition within Phase 1 to unblock
G1.3. Not a deviation; matches the same pattern used for empty
`packages/domain/src/index.ts` and `packages/design-system/src/index.ts`
scaffold stubs.

### PE-4 — Testing-library cleanup setup files added (Phase 4)

**Discovered:** Phase 4 G4.0 — apps/web tests initially failed with
`getMultipleElementsFoundError` because `@testing-library/react` does
not auto-cleanup between Vitest tests. DOM elements from prior tests
accumulated, so `getByText` matched multiple nodes.

**Resolution:**
- Added `apps/web/tests/setup.ts` and
  `packages/design-system/tests/setup.ts`, each calling `cleanup()`
  (from `@testing-library/react`) inside `afterEach` and importing
  `@testing-library/jest-dom/vitest` for extended matchers.
- Both package `vitest.config.ts` files now reference the setup file
  via `test.setupFiles: ['./tests/setup.ts']`.

**Classification:** Plan gap (testing-library cleanup discipline not
specified in Phase 3/4 steps). Not a deviation. Future plans using
`@testing-library/react` should include a setup-file creation step.

### PE-5 — `apps/web/src/vite-env.d.ts` added (Phase 4)

**Discovered:** TypeScript could not resolve CSS-module imports
(`import styles from './X.module.css'`) without Vite's ambient types.

**Resolution:** Added `apps/web/src/vite-env.d.ts` with
`/// <reference types="vite/client" />`. This is the standard Vite
project scaffold; not in the original file list but implicit
requirement for CSS Modules + TS.

**Classification:** Plan implicit prerequisite, not a deviation.

### PE-6 — G5.0 gate command changed (actionlint not an npm package)

**Discovered:** Phase 5 G5.0 was written as
`pnpm dlx actionlint .github/workflows/ci.yml`. Execution revealed
`actionlint` is a Go binary, not an npm package; `pnpm dlx` fails
with ENOENT.

**Resolution:** Replaced the gate command with a grep-based
structural check (file exists + required keys present). GitHub
Actions itself is the authoritative YAML validator at workflow-run
time — the remote Done Criterion #8 (`gh run list … conclusion ==
"success"`) covers full semantic validation.

**Classification:** Plan correction, not a deviation. The intent of
G5.0 — "don't ship a broken workflow file" — is preserved; the
mechanism changes from hard validation to structural sanity check.
