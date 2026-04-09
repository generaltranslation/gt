# GT Compiler Plugin

`@generaltranslation/compiler` — an unplugin-based build plugin for compile-time i18n optimization. Works with webpack, Vite, Rollup, and esbuild.

## Architecture

The compiler uses a **4-pass Babel pipeline** on `.tsx/.jsx/.ts/.js` files:

1. **JSX Insertion Pass** — Auto-wraps translatable JSX in `_T` / `_Var` components (when `enableAutoJsxInjection` is enabled)
2. **Macro Expansion Pass** — Transforms `t`\`...\``tagged templates and`t("...")` calls
3. **Collection Pass** — Collects translation data, computes hashes, validates usage
4. **Injection Pass** — Injects hashes and metadata into the AST

Entry point: `src/index.ts` (creates the unplugin).

## Code Organization

```
src/
├── index.ts              # Unplugin entry point
├── config.ts             # PluginConfig / PluginSettings types
├── passes/               # Babel visitor passes (one per pipeline stage)
│   ├── jsxInsertionPass.ts
│   ├── macroExpansionPass.ts
│   ├── collectionPass.ts
│   ├── injectionPass.ts
│   └── __tests__/
├── processing/           # Core logic invoked by passes
│   ├── jsx-insertion/    # JSX auto-insertion logic + rules doc
│   ├── collection/
│   └── injection/
├── state/                # State management classes
└── utils/                # Stateless helpers
```

## JSX Insertion Rules

The full 15-rule spec lives in `.claude/rules/jsx-insertion-rules.md` and loads automatically when editing JSX insertion code. The original source copy is at `src/processing/jsx-insertion/JSX_INSERTION_RULES.md`.

Both the compiler plugin and the CLI registration tool must implement these rules identically, or translation hashes will disagree and runtime resolution will fail.

Key concepts:

- `_T` (`GtInternalTranslateJsx`) wraps the highest ancestor with translatable text
- `_Var` (`GtInternalVar`) wraps dynamic expressions, only inside `_T` regions
- User-written `<T>`, `<Var>`, `<Num>`, `<Currency>`, `<DateTime>` are never modified
- `Branch`, `Plural`, `Derive`, `Static` trigger `_T` at the parent level
- Nested `_T` inside `Derive` is expected — removed at runtime by `removeInjectedT()`

## Configuration

Key flags in `PluginConfig` (`src/config.ts`):

- `enableAutoJsxInjection` — enables JSX insertion pass
- `enableMacroTransform` — enables t\`\` macro expansion
- `compileTimeHash` — enables hash generation
- `disableBuildChecks` — skips validation checks
- `autoDerive` — treats interpolated values as `derive()` calls

Can be set via `gt.config.json` under `files.gt.parsingFlags.enableAutoJsxInjection`.

## Testing

```sh
pnpm --filter @generaltranslation/compiler test
```

Test suites in `src/passes/__tests__/`:

- `jsxInsertionPass.test.ts` — core JSX insertion behavior
- `jsxInsertionE2E.test.ts` — end-to-end pipeline tests
- `jsxInsertionEdgeCases.test.ts` — edge cases and regressions

## Important Invariants

- The JSX insertion pass operates on **compiled JSX** (after Vite/SWC transforms `<div>` into `jsx("div", ...)`), not raw JSX syntax.
- Each `{expression}` maps to exactly one `_Var` — never grouped or combined.
- The CLI extraction tool must simulate the same insertion to compute matching hashes.
- Processing functions have a 1-to-1 relationship with their Babel visitor counterparts.
