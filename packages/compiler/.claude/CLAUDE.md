# GT Compiler Plugin

`@generaltranslation/compiler` — an unplugin-based build plugin for compile-time i18n optimization. Works with webpack, Vite, Rollup, and esbuild.

## Architecture

The compiler uses a **4-pass Babel pipeline** on `.tsx/.jsx/.ts/.js` files:

1. **JSX Insertion Pass** — Auto-wraps translatable JSX in `_T` / `_Var` components (when `enableAutoJsxInjection` is enabled)
2. **Macro Expansion Pass** — Transforms `t`\`...\``tagged templates and`t("...")` calls
3. **Collection Pass** — Collects translation data, computes hashes, validates usage
4. **Injection Pass** — Injects hashes and metadata into the AST

Two optional passes follow: **4b Extension Pass** (a build extension's `afterInjection`, such as the experimental locale twins; see [Locale twins](#locale-twins-experimental)) and **5 Runtime Translate Pass** (dev hot reload; skipped when the extension asks, because it would put stripped text back).

Entry point: `src/index.ts` (creates the unplugin with `createGTUnpluginFactory()`). The experimental entry point `src/experimental/index.ts` (`@generaltranslation/compiler/experimental`) creates it with the locale twins extension.

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
├── transform/            # AST edits used by the passes
├── state/                # State management classes (EntryObserver: the extension seam of the collection pass)
├── experimental/         # Locale twins (experimental): pass, stripping, post-build engine, Vite hooks
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

## Locale twins (experimental)

Opt-in translation splitting strategy, published only from `@generaltranslation/compiler/experimental`: `experimental.splitting: 'locale-twins'` in gt.config.json, or the `splitting` / `localeTwins` plugin options, resolved once at plugin creation by `resolveLocaleTwinsSettings` in `src/experimental/config.ts`. Every client chunk that carries entries is emitted once per locale, so a visitor downloads one locale's entries for the pages they visit. Vocabulary: _locale twin_, _twinned chunk_, _shared chunk_, _attribution_, _unattributed entry_. The shared contract (placeholder format, filled table, manifest) lives in `packages/core/src/experimental/locale-twins/` (`generaltranslation/internal/experimental`); the runtime registry and the SPA document/bootstrap/server helper live in `packages/i18n/src/experimental/locale-twins/` (`gt-i18n/internal/experimental`).

**Every locale twin file lives under `src/experimental/`; the regular plugin has no locale twin code.** It offers two neutral seams that the experimental entry point plugs into:

- `EntryObserver` (`src/state/EntryObserver.ts`, `state.entryObserver`): the collection and injection passes tell it about each entry with a compile-time hash (`add`), each entry hashed only at runtime (`addRuntimeHashed`), and where `<T>` text and prefetch messages sit in the AST. Regular builds have none.
- `createGTUnpluginFactory(createExtension)` (`src/index.ts`): a `PluginExtension` decides per transform (`beginTransform`, returning an observer and an `afterInjection` hook that reports whether it changed the AST and whether to skip the dev hot reload pass), runs at the end of a build (`buildEnd`), and adds Vite hooks (`vite`).

`src/experimental/index.ts` builds the extension with `createLocaleTwinsPlugin` (`experimental/locale-twins/createLocaleTwinsPlugin.ts`), which owns every locale twins decision of the plugin: whether a transform runs the pass, the pass itself and the unattributed-entry records, the end-of-build warning, and the Vite hooks. It also defaults `autoJsxImportSource` to `gt-react/experimental`. Locale twins need Vite: with any other bundler (`meta.framework`), the plugin warns once and never runs the pass.

Two halves:

- **Transform (per module, Pass 4b, `experimental/passes/localeTwinsPass.ts`).** Runs only in production Vite builds (not `vite dev`: `isDevServerTransform` in `experimental/utils/bundlerEnvironment.ts`), in client and server environments alike (the server's placeholder stays inert, but its `msg()` hashes keep SSR consistent with the client), and only with `compileTimeHash`, so `compileTimeHash: false` attributes nothing. The module's entries come from `LocaleTwinCollector` (the `EntryObserver`). Inserts one `GtInternalRegisterLocaleTwin("__GT_LOCALE_TWIN__:<hashes>:<base64url sources>")` call after the imports, imported from the module's `/experimental` GT source (`getLocaleTwinRegistrationImportSource` in `experimental/utils/importSources.ts`: `gt-react/experimental`, `gt-tanstack-start/experimental`, and `gt-i18n` → `gt-i18n/internal/experimental`; modules that import GT from a regular entry point get none, and their entries are unattributed with reason `importSource`). A module with such an import but no attributed entries gets `GtInternalRegisterLocaleTwin()` without a placeholder: it tells the runtime that compiled code ran (so a missing compiler plugin is reported). It also injects `$_hash` into attributed `msg()` calls. In client production builds only (`isClientProductionBuild`) it also blanks attributed source text to `""` (`experimental/transform/stripSourceText.ts`), keeping every element, prop and variable so GT JSX indices are unchanged. Entries it cannot attribute keep their text (they render in the source locale) and are collected per module id into one build warning and the build report's `unattributed` list (`experimental/utils/unattributedEntries.ts`).
- **Build (after the client output is written, `experimental/locale-twins/`).** `generateLocaleTwins.ts` is the pure engine: seed (files with a placeholder) plus closure (files that reference a twinned file), per-locale fill and rename, per-locale version, source maps, manifest, report. `writeLocaleTwins.ts` is the Node-side runner (reads `[locale].json`, writes twins and `gt-locale-twins.json` into the outDir, rewrites SPA HTML via `spaDocument.ts`, and writes `gt-locale-twins-report.json` to `<root>/node_modules/.cache/gt/`, out of the public outDir). Original twinned files stay in the outDir with their unfilled placeholders (the next build reads them for idempotency); no served document references them. Diagnostics are in `buildDiagnostics.ts` and `diagnostics.ts`, created with `createCompilerDiagnostic`.

Vite integration is `experimental/locale-twins/vite/localeTwinsViteHooks.ts` (built by `createLocaleTwinsPlugin`), which the regular factory assigns to the plugin's **only** `vite:` key. unplugin `Object.assign`s that object over the generic hooks, so a hook defined there replaces the generic one of the same name: the generic end-of-build work runs through `finishBuild` (called from the generic `buildEnd` and via `onBuildEnd`), and `configResolved` work goes through `onConfigResolved`. Add every new Vite hook inside `createLocaleTwinsViteHooks`. The hooks:

- `buildEnd` records the module graph and `outputOptions` adds the default vendor chunk (`vite/vendorChunk.ts`: Rolldown `codeSplitting.groups` on Vite 8, `manualChunks` on Vite 7), client environment of a build only, skipped with a warning when the user configured chunking. Both run on the same plugin instance on purpose: TanStack Start loads the Vite config once per environment (`builder.sharedPlugins`), creating extra plugin instances that never see the graph.
- `buildStart` watches the non-default locales' translation files (client consumer of `vite build`), so `vite build --watch` regenerates twins after a translation edit.
- `writeBundle` (`order: 'post'`) runs the engine for the client consumer of `vite build` only.
- `resolveId`/`load` serve `virtual:gt-locale-twins-manifest` (`vite/manifestModule.ts`): server environments read the client build's manifest, everything else gets `null`. Types: `src/experimental/locale-twins-manifest.d.ts`, copied to `dist/experimental/` and published as `@generaltranslation/compiler/experimental/locale-twins-manifest`.
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

Locale twins: `src/experimental/__tests__/localeTwins*.test.ts` (transform), `packageExports.test.ts` (the `/experimental` entry, and no locale twin code reachable from the regular one), `src/experimental/locale-twins/__tests__/generateLocaleTwins.test.ts` (engine) and `viteBuild.test.ts` (real Vite 8 and Vite 7 builds of `__tests__/fixtures/spa` through `buildFixture.ts`, which loads the config once per environment like TanStack Start). Build the workspace dependencies first: `pnpm turbo run build --filter='@generaltranslation/compiler^...'`.

## Important Invariants

- The JSX insertion pass operates on **compiled JSX** (after Vite/SWC transforms `<div>` into `jsx("div", ...)`), not raw JSX syntax.
- Each `{expression}` maps to exactly one `_Var` — never grouped or combined.
- The CLI extraction tool must simulate the same insertion to compute matching hashes.
- Processing functions have a 1-to-1 relationship with their Babel visitor counterparts.
