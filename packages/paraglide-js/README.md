# @generaltranslation/paraglide-js (proof of concept)

Collects the source-code context of every usage of a Paraglide message in an
app, **without changing Paraglide**. It writes the 10 lines above and below
each usage to a metadata file next to each message file
(`messages/en.json` → `messages/en.metadata.json`), which the gt CLI uploads
with the messages as translation context.

Supports Paraglide 1, 2 and 3, and any framework built with Vite 5+, webpack 5,
rspack (Next.js), Rollup, Rolldown or esbuild: JSX frameworks, Vue/Nuxt,
Svelte/SvelteKit, Astro, Angular/Analog, VitePress, Lit, Marko, Ember, and plain
TypeScript. Bundlers without plugins (Turbopack, Angular CLI) use the CLI.

## Usage

```ts
// vite.config.ts
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { paraglideContext } from '@generaltranslation/paraglide-js/compiler';

export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
    }),
    paraglideContext(),
  ],
});
```

Everything is exported from `@generaltranslation/paraglide-js/compiler`;
`@generaltranslation/paraglide-js` itself exports nothing. Other bundlers take the same options:

```ts
// webpack / rspack (e.g. next.config.ts)
import { ParaglideContextWebpackPlugin } from '@generaltranslation/paraglide-js/compiler';
config.plugins.push(new ParaglideContextWebpackPlugin());

// Rollup / Rolldown
import { paraglideContextRollup } from '@generaltranslation/paraglide-js/compiler';

// esbuild
import { paraglideContextEsbuild } from '@generaltranslation/paraglide-js/compiler';
```

Without a bundler, use the CLI or `collectContext` / `watchContext`. Only `include` is analyzed then (imports are still
followed):

```bash
npx paraglide-context [root] [--watch] [--include src] [--alias ~=./src] [--project project.inlang]
```

## Output

A metadata file has the keys of its message file. Each used message lists the
code around its usages, by source file (relative to the project root):

```json
// messages/en.metadata.json
{
  "greeting": {
    "sourceCode": {
      "src/ContextProbe.tsx": [
        {
          "before": "import { t } from './i18n.js'\n…",
          "target": "  return <p title={page_title()}>{t.greeting({ username: 'x' })}</p>",
          "after": "}\n…"
        }
      ]
    }
  }
}
```

- **Only the base locale** gets one: the context is the same for every target
  language.
- **Several message files** (`pathPattern` is a list) each get their own, with
  their own keys. Nested keys stay nested.
- **Several inlang projects** each get their own: a usage goes to the project
  its outdir was compiled from.
- **Only keys the message file has** are written; the gt CLI rejects others.
  Unused messages have no entry.
- **`sourceCode` is replaced on every write.** Other fields (`context`,
  `maxChars`) are hand-written and kept.
- A dynamic name like `error_*` goes to every message it matches; `m[key]`
  alone goes to none.

## Options

| Option           | Default            | Meaning                                                                                                 |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| `include`        | the whole project  | Paths or globs analyzed, relative to the project root.                                                  |
| `exclude`        | `DEFAULT_EXCLUDE`  | Paths or globs not analyzed. The default excludes tests.                                                |
| `targets`        | `defaultTargets`   | What counts as Paraglide (see [Targets](#targets)).                                                     |
| `languages`      | `defaultLanguages` | Formats besides JS/TS (see [Frameworks](#frameworks)).                                                  |
| `outdirs`        | detected           | Paraglide outdirs to trust without verification.                                                        |
| `autoImports`    | detected           | Names used without an import, e.g. `{ m: "./src/paraglide/messages.js" }`. `false` disables detection.  |
| `inlangProjects` | detected           | inlang project directories whose messages get metadata files (see [inlang projects](#inlang-projects)). |
| `radius`         | `10`               | Lines of context above and below each usage.                                                            |
| `enabled`        | off in tests       | Set `true` to run under Vitest, `mode: "test"` or `NODE_ENV=test`.                                      |

## How it works

**Files.** The project root is the nearest `package.json` at or above Vite's
root. Analyzed: `include` (minus `exclude`, `node_modules`, build output and
anything `.gitignore`d from the repository or monorepo root down), plus every
module the bundler loads, wherever it lives
(monorepo packages, Vike's `pages/`, Laravel's `resources/js`).

**Imports** are never matched by specifier text. Each one is:

1. **Resolved** with the bundler's own resolver (Vite's plugin container,
   webpack's resolver, Rollup's `this.resolve`, esbuild's resolutions), so
   aliases, `exports`/`imports`, tsconfig paths and Paraglide's virtual modules
   all work.
2. **Followed** through re-exports of non-Paraglide modules, ESM and CommonJS.
3. **Verified** to end at a file a target matches; otherwise nothing is recorded.

**Values** are tracked with ESLint's scope analysis
(`@typescript-eslint/scope-manager`): aliases (`const t = m`), destructuring,
reassignment, object spreads, function arguments and JSX props passed to
parameters (also across modules and re-export barrels, and from templates), and
computed keys (`m["a"]`, `m[c ? "a" : "b"]`). Unknown keys give
a dynamic name like `error_*`.

**The message catalog** is read from the generated files. Unknown messages are
flagged `not in the catalog` (with a build warning), and dynamic names list the
messages they can match.

**Auto-imports** from unplugin-auto-import, unplugin-vue-components and Nuxt
are read from their `.d.ts` files; local names shadow them.

**Outdirs** are detected, not configured, so several Paraglide projects in one
app need no setup. A directory counts only if it contains Paraglide's exact
generated code for the installed version (Paraglide 2/3: byte comparison with an
empty compiled project; Paraglide 1: structural check). A failing directory is
skipped with a warning saying why; list it in `outdirs` to force it.

## inlang projects

Each outdir is paired with the inlang project it was compiled from:

1. the project its `README.md` names (`Compiled from: …`, written by
   Paraglide 2 and 3 unless `emitReadme` is off);
2. else, of the `*.inlang` directories in the bundler's root and each
   directory above it up to the monorepo root, the only one, or the one that
   defines the most of the outdir's messages.

`inlangProjects` replaces both with a list, matched the same way. Message
files come from the project's `settings.json`: `baseLocale` and
`plugin.inlang.messageFormat.pathPattern`. Other format plugins (i18next, …)
are not written yet.

## Targets

A target says which resolved files belong to Paraglide and what each export is:

```ts
type ParaglideTarget = {
  name: string; // label on usages, e.g. "message"
  matches(file: TargetFile): boolean; // file: { file, outdir?, outdirPath? }
  exportSymbol(exportName: string, file): SymbolSpec | undefined;
};
// SymbolSpec: { type: "namespace", member(name) } | { type: "value", name, methods? }
```

Built in: `messagesTarget` (`messages.js`, `messages/*.js`), `runtimeTarget`,
`serverTarget`, `registryTarget`, and `adapterTargets`, Paraglide's framework
adapters (`@inlang/paraglide-js-react`, `-solid`, `-svelte`, `-vue`, and
Paraglide 1's `@inlang/paraglide-sveltekit`, `-next`, `-astro`), so
`<Message message={m.tos} />` is a usage too. Custom ones can use
`defineTarget()`, `generatedFileTarget(name, path)` or
`packageTarget(name, packageName)`:

```ts
paraglideContext({
  targets: [
    ...defaultTargets,
    packageTarget('ui-kit', '@acme/i18n-components'),
  ],
});
```

When several targets match a file, the last one wins, so a target after
`defaultTargets` can also relabel a built-in one.

Usage kinds: `call`, `method` (`m.tos.parts()`), `reference` (`message={m.tos}`)
and `component` (`<ParaglideMessage />`).

## Frameworks

JS/TS/JSX are parsed directly with oxc; Lit-style `` html`…` `` templates get
their elements from parse5. Every other format is read with the framework's own
tooling, which turns a component into TypeScript with mappings back to the
file, so usages report the file's own lines and its scoping rules are the
framework's:

| Files                        | Tool the project needs                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `.vue`, VitePress `.md`      | `@vue/language-core` (comes with `vue-tsc`), `typescript` 5 or 6; `@vue/language-plugin-pug` for pug |
| `.svelte`                    | `svelte2tsx` (comes with `svelte-check`), `svelte`                                                   |
| `.astro`                     | `@astrojs/astro2tsx` (comes with `@astrojs/check`), else `@astrojs/compiler`                         |
| `.mdx`                       | `@mdx-js/language-service`, `typescript` 5 or 6                                                      |
| Angular `.ts`/`.html`, `.ag` | `@angular/compiler`                                                                                  |
| `.marko`                     | `@marko/language-tools`, `@marko/compiler`                                                           |
| `.gjs`, `.gts`               | `@glint/ember-tsc`                                                                                   |

The tools are loaded from the app, so their versions match its framework. They
are also found as dependencies of the app's dependencies (e.g. `svelte2tsx` of
`svelte-check`). When one is missing, that format's files are skipped with one
warning naming what to install, e.g.:

```
[paraglide-context] 14 .vue file(s) were not analyzed (e.g. src/App.vue): they need
@vue/language-core, which is not installed. Install it: pnpm add -D vue-tsc (vue-tsc includes
@vue/language-core)
```

A file its tool rejects (mid-edit) is skipped until it parses again.

Each usage records its `scope` (nearest named function, component or class
member) and the element and attribute it is in, from the framework's parser.

Add formats with `languages`: a `SourceLanguage` returns the tool's output as
`{ code, lang, mappings, elements }` (`mappingsFromVolar`, `mappingsFromSourceMap`):

```ts
import {
  defaultLanguages,
  mappingsFromSourceMap,
  type SourceLanguage,
} from '@generaltranslation/paraglide-js/compiler';

const riot: SourceLanguage = {
  name: 'riot',
  extensions: ['.riot'],
  requires: ['@riotjs/compiler'],
  async generate(source, file, context) {
    const compiler =
      await context.load<typeof import('@riotjs/compiler')>('@riotjs/compiler');
    if (!compiler) return undefined; // skipped, naming `requires`
    const { code, map } = compiler.compile(source, { file });
    return {
      code,
      lang: 'js',
      mappings: mappingsFromSourceMap(map, code, source),
    };
  },
};
paraglideContext({ languages: [...defaultLanguages, riot] });
```

## Build and dev

- **Build** analyzes `include` at `buildStart` and loaded modules at `buildEnd`.
- **Dev** analyzes at startup, then each module as it loads. A change
  re-analyzes the file and its dependents; adding or deleting a file re-scans.
- It never transforms modules and imports nothing from `vite` at runtime.
- Bundler instances of one project in one process (Nuxt, Next.js, Astro) share
  the metadata files; writes are atomic and only happen when content changes.
- Paraglide's own plugin watches the messages directory, so it recompiles once
  after a metadata file changes; the unchanged output ends there.

## Not handled yet

- Apps that share one inlang project overwrite each other's `sourceCode`: the
  last one built wins.
- Usages of runtime functions and other targets are analyzed but not written;
  only messages have a key to be written under.
- CommonJS exports below a module's top level.
- Computed keys with more than 16 alternatives (become `*`).
- A file that stops parsing (mid-edit in dev) keeps its last version's usages
  until it parses again; at build time it is skipped. Tools recover from most
  errors, but Astro loses the rest of an element after an unclosed `{`, and
  with `@astrojs/compiler` alone (Astro 6 and older) the rest of the line.
- Formats whose tool is not installed are skipped (with a warning).
- Values are followed through bindings, arguments, props and re-exports, not
  through return values, React context, `provide`/`inject`, arrays or objects
  assigned later. A read after an unconditional reassignment sees only it;
  loops are not modelled.
- Props are followed into Svelte, Vue and Astro components, imported or
  auto-imported, not into ones registered with `app.component()` or
  `<svelte:component this={X}>`.

## Layout

```
src/                    the package's entry points, nothing else
  index.ts              `@generaltranslation/paraglide-js`: empty
  compiler.ts           `@generaltranslation/paraglide-js/compiler`: the public API
lib/compiler/
  options.ts            plugin and CLI options
  plugins/              bundler adapters (the only code that knows bundlers)
  cli/                  the `paraglide-context` command
  collector/            bundler-neutral orchestration and the metadata files
  project/              include/exclude, roots, auto-imports, installed packages
  paraglide/            outdir verification, catalog, targets, virtual modules
  inlang/               inlang projects: settings, message files, their keys
  analysis/             JS semantics: module graph, scopes, value flow, usages
  languages/            file formats → the framework tool's TypeScript, mapped back
  output/               usages → a message file's metadata (the gt CLI's format)
  utils/
__tests__/              mirrors lib/compiler/
```

To add a bundler, write a `plugins/` adapter that calls `createCollector` and
drives it from the bundler's hooks. A file format is a `SourceLanguage` in
`languages/`; something Paraglide-like is a `ParaglideTarget`.

## Development

```bash
pnpm install                                             # at the repository root
pnpm --filter @generaltranslation/paraglide-js test      # vitest; covers Vite 5–8, webpack, rspack, Rollup, esbuild, Paraglide 1–3
pnpm --filter @generaltranslation/paraglide-js build     # tsc → dist/
pnpm --filter @generaltranslation/paraglide-js typecheck
```

To use a local checkout in an app, install it as an **injected** dependency
(not `link:`, which leads to duplicate Vite types and TS2321 in
`defineConfig()`):

```json
{
  "devDependencies": {
    "@generaltranslation/paraglide-js": "file:../gt/packages/paraglide-js"
  },
  "dependenciesMeta": {
    "@generaltranslation/paraglide-js": { "injected": true }
  }
}
```

After changing the plugin, build it and run `pnpm install` in the app.
