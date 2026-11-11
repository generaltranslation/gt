# @generaltranslation/paraglide-js (proof of concept)

Finds every usage of a Paraglide message in an app and saves the code around it
as translation context, **without changing Paraglide**.

Each message file of the base locale gets a metadata file next to it
(`messages/en.json` → `messages/en.metadata.json`) with the 10 lines above and
below every usage. The gt CLI uploads it with the messages. Other locales'
files (`messages/fr.json`) get none: the context is the same for every target
language.

Supports Paraglide 1–3 on Node 20+. It reads the app's source and never runs
its bundler, so it works however the app is built.

## Usage

Run it either way. Both take the same [options](#options) and write the same
files.

**CLI:**

```bash
npx paraglide-context [root] [--verbose] [options]
```

`--verbose` prints a summary.

**Library:**

```ts
import { collectContext } from '@generaltranslation/paraglide-js/compiler';

await collectContext({ root: './apps/web', include: ['src'] });
```

The public API is exported from `@generaltranslation/paraglide-js/compiler`:
`collectContext` and what its options take. The package root exports nothing.

## Output

A metadata file mirrors its message file. Each used message lists the code
around its usages, by source file:

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

- Only base-locale message files get one: context is the same for every target
  language. Nested keys stay nested.
- Only keys the message file has are written (the gt CLI rejects others).
  Unused messages have no entry.
- `sourceCode` is replaced on every write. Hand-written fields (`context`,
  `maxChars`) are kept.
- A dynamic name like ``m[`error_${code}`]`` goes to every message matching
  `error_*`. `m[key]` alone goes to none.
- With several inlang projects, a usage goes to the project its outdir was
  compiled from.
- Files are written atomically and only when they change. One that cannot be
  read or is not a JSON object is left alone, with a warning.

## Options

Paths are relative to the project root: the nearest `package.json` at or above
`root`. Flags marked `…` can be repeated.

| Option           | CLI flag              | Default                 | Meaning                                                                              |
| ---------------- | --------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `include`        | `--include …`         | the whole project       | Paths or globs to analyze.                                                           |
| `exclude`        | `--exclude …`         | `DEFAULT_EXCLUDE`       | Paths or globs to skip. The default skips tests and tool configs.                    |
| `radius`         | `--radius`            | `10`                    | Lines of context above and below each usage.                                         |
| `outdirs`        | `--outdir …`          | detected                | Paraglide outdirs to trust without verification.                                     |
| `inlangProjects` | `--project …`         | detected                | inlang project directories whose messages get metadata files.                        |
| `autoImports`    |                       | detected                | Names used without an import: `{ m: "./src/paraglide/messages.js" }`. `false`: none. |
| `targets`        |                       | `defaultTargets`        | What counts as Paraglide. See [Targets](#targets).                                   |
| `languages`      |                       | `defaultLanguages`      | File formats besides JS/TS. See [File formats](#file-formats).                       |
| `root`           | `[root]`              | working directory       | The project, or a directory in it.                                                   |
| `alias`          | `--alias ~=./src …`   | none                    | Import aliases: `{ "~": "/abs/src" }` or a list of `{ find, replacement }`.          |
| `bundlerConfigs` | `--no-bundler-config` | `defaultBundlerConfigs` | Bundler configs to read aliases from. `[]`: none.                                    |

`collectContext` also takes `logger` (`{ warn, info }`),
`conditions` (package export conditions) and `rootDirectory` (where `/src/a.js`
resolves from).

## How it works

**Files.** `include`, minus `exclude`, `node_modules`, build and framework
output, and anything `.gitignore`d. Files outside the project are analyzed when
`include` lists them (`../shared`).

**Imports** are never matched by their text. Each is resolved, followed through
re-exports (ESM and CommonJS), and counted only if it ends in a Paraglide file.
They are resolved like the app's bundler would, without running it. Aliases
come from, in order:

1. the `alias` option;
2. the first `vite.config.*`, `webpack.config.*` or `rspack.config.*` it finds.
   Vite's is resolved by the project's own Vite, so plugin aliases (SvelteKit's
   `$lib`) and root paths (`/src/a.js`) work. webpack's and rspack's is
   imported, so a TypeScript config needs a Node.js that runs TypeScript. Its
   `name$` and wildcard (`"@/*"`) aliases work;
3. `tsconfig.json` `paths` and `package.json` `imports`.

When no bundler config could be read, imports that did not resolve are listed
in a warning, since they may be undeclared aliases.

**Outdirs** are detected, so several Paraglide projects in one app need no
setup. A directory counts if it holds exactly what the installed Paraglide
generates (Paraglide 1: the same structure), on disk or as virtual modules. A
rejected one is skipped with a warning; list it in `outdirs` to force it.

**inlang projects.** Each outdir is paired with the project its `README.md`
names (`Compiled from: …`), else the only `*.inlang` directory between `root`
and the monorepo root, else the one defining the most of its
messages. `inlangProjects` replaces that search. Message files come from the
project's `settings.json`: `baseLocale` and
`plugin.inlang.messageFormat.pathPattern`.

**Usages.** Values are tracked with ESLint's scope analysis through aliases
(`const t = m`), destructuring, reassignment, object spreads, function
arguments and parameter defaults, component props (across modules and from
templates) and computed keys (`m["a"]`, `m[c ? "a" : "b"]`). Each is a `call` (`m.tos()`), `method`
(`m.tos.parts()`), `reference` (`message={m.tos}`) or `component`
(`<ParaglideMessage />`). Messages missing from the generated catalog are
reported in a warning.

**Auto-imports** from unplugin-auto-import, unplugin-vue-components and Nuxt
are read from their `.d.ts` files.

## File formats

JS, TS and JSX are parsed with oxc, including Lit-style `` html`…` ``
templates. Other formats are converted to TypeScript by the framework's own
tooling, loaded from the app so versions match:

| Files                                   | Needs in the app                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `.vue`, VitePress `.md`                 | `@vue/language-core` (comes with `vue-tsc`), `typescript` 5 or 6; `@vue/language-plugin-pug` for pug |
| `.svelte`                               | `svelte2tsx` (comes with `svelte-check`), `svelte`                                                   |
| `.astro`                                | `@astrojs/astro2tsx` (comes with `@astrojs/check`), else `@astrojs/compiler`                         |
| `.mdx`                                  | `@mdx-js/language-service`, `typescript` 5 or 6                                                      |
| Angular `.ts`/`.html`, `.ag`, `.analog` | `@angular/compiler`                                                                                  |
| `.marko`                                | `@marko/language-tools`, `@marko/compiler`                                                           |
| `.gjs`, `.gts`                          | `@glint/ember-tsc`                                                                                   |

A format whose tool is missing is skipped with one warning naming what to
install. A file that does not parse is skipped with a warning.

## Extending

### Targets

A target says which resolved files belong to Paraglide and what each export is:

```ts
type ParaglideTarget = {
  name: string; // label on usages, e.g. "message"
  matches(file: TargetFile): boolean; // file: { file, outdir?, outdirPath? }
  exportSymbol(exportName: string, file): SymbolSpec | undefined;
};
// SymbolSpec: { type: "namespace", member(name) } | { type: "value", name, methods? }
```

`defaultTargets` is `messagesTarget` (`messages.js`, `messages/*.js`),
`runtimeTarget`, `serverTarget`, `registryTarget` and `adapterTargets`:
`@inlang/paraglide-js-react`, `-solid`, `-svelte`, `-vue`, and Paraglide 1's
`@inlang/paraglide-sveltekit`, `-next`, `-astro`. So
`<Message message={m.tos} />` is a usage too.

Write your own with `defineTarget()`, `generatedFileTarget(name, path)` or
`packageTarget(name, packageName)`. When several match a file, the last wins:

```ts
await collectContext({
  targets: [
    ...defaultTargets,
    packageTarget('ui-kit', '@acme/i18n-components'),
  ],
});
```

### Languages

A `SourceLanguage` returns its tool's output as
`{ code, lang, mappings, elements? }`. Build `mappings` with
`mappingsFromSourceMap` or `mappingsFromVolar`. Scripts that are modules of
their own, like an Astro page's client scripts, go in `scripts`, each as
`{ code, lang, mappings }`:

```ts
const riot: SourceLanguage = {
  name: 'riot',
  extensions: ['.riot'],
  requires: ['@riotjs/compiler'], // named in the warning when missing
  async generate(source, file, context) {
    // Loaded from the app; undefined if it is not installed.
    const compiler =
      await context.load<typeof import('@riotjs/compiler')>('@riotjs/compiler');
    if (!compiler) return undefined; // skipped
    const { code, map } = compiler.compile(source, { file });
    const mappings = mappingsFromSourceMap(map, code, source);
    return { code, lang: 'js', mappings };
  },
};
await collectContext({ languages: [...defaultLanguages, riot] });
```

### Bundler configs and resolvers

- **Aliases from another bundler's config:** add a `BundlerConfig`
  (`{ name, files, read }`) to
  `bundlerConfigs: [...defaultBundlerConfigs, yours]`. `webpackLikeConfig()`
  makes one for a config in webpack's format.
- **Another resolver:** call
  `createCollector(options, { root, logger, resolver })`, then `scanAll()` and
  `write()`. `nodeResolver` and `ProjectResolver` are the ones `collectContext`
  uses.

Each built-in language (`vueLanguage`, …) and bundler config (`viteConfig`, …)
is exported on its own. The analysis itself (module graph, usages, rendering)
is internal.

## Not handled yet

- **Aliases:** a bundler config gives only its aliases (and Vite's root),
  not its plugins' virtual modules.
  Next.js, Nuxt and Astro configs are not read; their aliases come from
  `tsconfig.json`.
- **Other inlang format plugins** (i18next, …) get no metadata files.
- **Apps sharing one inlang project** overwrite each other's `sourceCode`. The
  last one analyzed wins.
- **A project that no longer imports Paraglide** keeps its metadata files as
  they are: its outdir, and so its inlang project, is not found.
- **Other targets** (runtime functions, …) are analyzed but not written: only
  messages have a key to write under.
- **Value flow** stops at return values, React context, `provide`/`inject`,
  arrays, and objects assigned later. A read after an unconditional
  reassignment sees only the new value. Loops are not modelled.
- **Props** are followed into Svelte, Vue and Astro components, but not ones
  registered with `app.component()` or `<svelte:component this={X}>`.
- **Computed keys** with more than 16 alternatives become `*`.
- **CommonJS exports** below a module's top level.
- **Broken Astro files** lose the rest of an element after an unclosed `{`, or
  the rest of the line with only `@astrojs/compiler` (Astro 6 and older).

## Development

```bash
pnpm install                                             # at the repository root
pnpm --filter @generaltranslation/paraglide-js test      # vitest: Paraglide 1–3, Vite 5–8 configs
pnpm --filter @generaltranslation/paraglide-js build     # tsc → dist/
pnpm --filter @generaltranslation/paraglide-js typecheck
```

```
src/                    entry points: index.ts (empty), compiler.ts (the public API)
src/compiler/
  context.ts            collectContext
  options.ts            their options, and the CLI's
  cli/                  the `paraglide-context` command
  collector/            orchestration and the metadata files
  resolver/             imports → files, like the app's bundler would
  bundler-configs/      bundler configs → import aliases
  project/              include/exclude, roots, auto-imports, installed packages
  paraglide/            outdir verification, catalog, targets, virtual modules
  inlang/               inlang projects: settings, message files, their keys
  analysis/             JS semantics: module graph, scopes, value flow, usages
  languages/            file formats → the framework tool's TypeScript, mapped back
  output/               usages → a message file's metadata (the gt CLI's format)
__tests__/              mirrors src/compiler/
```

To try a local checkout in an app, install it as a `file:` dependency, then
rebuild and re-run `pnpm install` in the app after each change:

```json
{
  "devDependencies": {
    "@generaltranslation/paraglide-js": "file:../gt/packages/paraglide-js"
  }
}
```
