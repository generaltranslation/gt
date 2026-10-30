# GT Compiler Plugin

`@generaltranslation/compiler` — an unplugin-based build plugin for compile-time i18n optimization. Works with webpack, Vite, Rollup, and esbuild.

## Architecture

The compiler uses a **4-pass Babel pipeline** on `.tsx/.jsx/.ts/.js` files:

1. **JSX Insertion Pass** — Auto-wraps translatable JSX in `_T` / `_Var` components (when `enableAutoJsxInjection` is enabled)
2. **Macro Expansion Pass** — Transforms `t`\`...\``tagged templates and`t("...")` calls
3. **Collection Pass** — Collects translation data, computes hashes, validates usage
4. **Injection Pass** — Injects hashes and metadata into the AST

Two optional passes follow: **4b Locale Twins Pass** (see [Locale twins](#locale-twins)) and **5 Runtime Translate Pass** (dev hot reload; skipped when 4b stripped source text, because it would put the text back).

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
├── transform/            # AST edits used by the passes (locale-twins/: call site markers, stripping)
├── locale-twins/         # Post-build twin engine and Vite hooks (no Babel)
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

## Locale twins

Opt-in translation splitting strategy (`files.gt.splitting: 'locale-twins'` in gt.config.json, or the `splitting` / `localeTwins` plugin options, resolved once at plugin creation by `resolveLocaleTwinsSettings` in `src/config.ts`). Every client chunk that carries entries is emitted once per locale, so a visitor downloads one locale's entries for the pages they visit. Vocabulary: _locale twin_, _twinned chunk_, _shared chunk_, _attribution_, _unattributed entry_. The shared contract (placeholder format, filled value, manifest) lives in `packages/core/src/locale-twins/` and is imported from `generaltranslation/internal`; the runtime marker reading (`resolveLocaleTwin`), the twin client decision and the SPA document/bootstrap/server helper live in `packages/i18n/src/locale-twins/`. There is no runtime registry: each call site carries its own content.

`src/index.ts` only calls `createLocaleTwinsPlugin` (`locale-twins/createLocaleTwinsPlugin.ts`), which owns every locale twins decision of the plugin: whether a transform runs Pass 4b (`beginTransform`), the pass itself and the unattributed-entry records (`runPass`), the end-of-build warning (`buildEnd`), and the Vite hooks (`vite`). Locale twins need Vite: with any other bundler (`meta.framework`), the plugin warns once and never runs Pass 4b.

Two halves:

- **Transform (per module, Pass 4b, `passes/localeTwinsPass.ts`).** Runs only in production Vite builds (not `vite dev`: `isDevServerTransform` in `utils/bundlerEnvironment.ts`), and only with `compileTimeHash`, so `compileTimeHash: false` attributes nothing. Only modules importing a GT source that supports locale twins (`isLocaleTwinsImportSource`: gt-react, gt-tanstack-start, gt-i18n; not gt-next) are marked. The marker is the `$_twin` option of `gt()`/`t()`/`msg()` or the `_twin` prop of `<T>` (`LOCALE_TWIN_MARKER`, added by `transform/locale-twins/injectLocaleTwinMarker.ts`; a call that already has one keeps it). In client production builds (`isClientProductionBuild`), every attributed call site gets `$_twin: "__GT_LOCALE_TWIN__:<hash>:<base64url source>"` and its source text is blanked to `""` (`transform/locale-twins/stripSourceText.ts`), keeping every element, prop and variable so GT JSX indices are unchanged. In client and server production builds, entries the compiler cannot attribute get `$_twin: 0` / `_twin: 0`, so both render their source text (hydration matches); they keep their text and are collected per module id into one build warning and the build report's `unattributed` list (`utils/locale-twins/unattributedEntries.ts`). A call that cannot carry the marker (more than two arguments, `<T>` props that are not an object literal) is unattributed with reason `call`. Server builds keep attributed source text unmarked (the server translates from whole locales). No import is inserted.
- **Build (after the client output is written, `locale-twins/`).** `generateLocaleTwins.ts` is the pure engine: seed (files with a placeholder) plus closure (files that reference a twinned file), per-locale fill (each placeholder token, quotes included, becomes the expression `[locale, content]`, or `[defaultLocale, source]` for the default locale and missing translations) and rename, per-locale version, source maps, manifest, report (including the entries each twinned file carries and their inline bytes per locale, since inline values carry no hash). `writeLocaleTwins.ts` is the Node-side runner (reads `[locale].json`, writes twins and `gt-locale-twins.json` into the outDir, rewrites SPA HTML via `spaDocument.ts`, and writes `gt-locale-twins-report.json` to `<root>/node_modules/.cache/gt/`, out of the public outDir). Original twinned files stay in the outDir with their unfilled placeholders (the next build reads them for idempotency); no served document references them. Diagnostics are in `buildDiagnostics.ts` and `diagnostics.ts`, created with `createCompilerDiagnostic`.

Vite integration is `locale-twins/vite/localeTwinsViteHooks.ts` (built by `createLocaleTwinsPlugin`), assigned to the plugin's **only** `vite:` key in `src/index.ts`. unplugin `Object.assign`s that object over the generic hooks, so a hook defined there replaces the generic one of the same name: the generic end-of-build work runs through `finishBuild` (called from the generic `buildEnd` and via `onBuildEnd`), and `configResolved` work goes through `onConfigResolved`. Add every new Vite hook inside `createLocaleTwinsViteHooks`. The hooks:

- `buildEnd` records the module graph and `outputOptions` adds the default vendor chunk (`vite/vendorChunk.ts`: Rolldown `codeSplitting.groups` on Vite 8, `manualChunks` on Vite 7), client environment of a build only, skipped with a warning when the user configured chunking. Both run on the same plugin instance on purpose: TanStack Start loads the Vite config once per environment (`builder.sharedPlugins`), creating extra plugin instances that never see the graph.
- `buildStart` watches the non-default locales' translation files (client consumer of `vite build`), so `vite build --watch` regenerates twins after a translation edit.
- `writeBundle` (`order: 'post'`) runs the engine for the client consumer of `vite build` only.
- `resolveId`/`load` serve `virtual:gt-locale-twins-manifest` (`vite/manifestModule.ts`): server environments read the client build's manifest, everything else gets `null`. Types: `locale-twins-manifest.d.ts`.
- `configureServer` prints the dev notice; `vite dev` never runs Pass 4b, strips or twins.

gt.config.json and `files.gt.output` resolve against `process.cwd()` captured at plugin creation, not Vite's `root`.

The user guide for this feature is maintained outside this repo (docs site); keep option names and file names there in sync when they change.

## Testing

```sh
pnpm --filter @generaltranslation/compiler test
```

Test suites in `src/passes/__tests__/`:

- `jsxInsertionPass.test.ts` — core JSX insertion behavior
- `jsxInsertionE2E.test.ts` — end-to-end pipeline tests
- `jsxInsertionEdgeCases.test.ts` — edge cases and regressions

Locale twins: `src/__tests__/localeTwins*.test.ts` (transform), `src/locale-twins/__tests__/generateLocaleTwins.test.ts` (engine), `minification.test.ts` (placeholders through Rolldown/Oxc, Rollup/esbuild and Terser, then the filled twins run) and `viteBuild.test.ts` (real Vite 8 and Vite 7 builds of `__tests__/fixtures/spa` through `buildFixture.ts`, which loads the config once per environment like TanStack Start). Build the workspace dependencies first: `pnpm turbo run build --filter='@generaltranslation/compiler^...'`.

## Important Invariants

- The JSX insertion pass operates on **compiled JSX** (after Vite/SWC transforms `<div>` into `jsx("div", ...)`), not raw JSX syntax.
- Each `{expression}` maps to exactly one `_Var` — never grouped or combined.
- The CLI extraction tool must simulate the same insertion to compute matching hashes.
- Processing functions have a 1-to-1 relationship with their Babel visitor counterparts.
- Locale twin placeholders survive minifiers because they are string values in an options object or props passed to a runtime function that reads them. Rollup drops arguments of a bundled callee that never reads them, so the runtime functions (and test stubs) must read `$_twin` / `_twin`. The engine replaces the whole token with an expression, so a minifier must not fold or concatenate the literal (`minification.test.ts` checks the supported minifiers).
