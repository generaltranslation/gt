# @generaltranslation/paraglide-js

## 0.3.0

### Minor Changes

- [#2725](https://github.com/generaltranslation/gt/pull/2725) [`a796de5`](https://github.com/generaltranslation/gt/commit/a796de5b497b13ed2ffaac90174b52a142fcaa01) Thanks [@JacksonO123](https://github.com/JacksonO123)! - Track only message usages, the only ones written to metadata files. Removes the runtime, server, registry and adapter targets (`runtimeTarget`, `serverTarget`, `registryTarget`, `adapterTargets`, `packageTarget`, `generatedFileTarget`) and a language's `elements` (`SourceElement`), which fed only usage fields that were never written. Metadata files are unchanged.

### Patch Changes

- [#2768](https://github.com/generaltranslation/gt/pull/2768) [`68be231`](https://github.com/generaltranslation/gt/commit/68be2311b370e197b43ea177b473a5ebb4bcbaab) Thanks [@JacksonO123](https://github.com/JacksonO123)! - Make `paraglide-context` and `collectContext()` faster and lighter on memory, so that large projects finish: a run is about twice as fast on one core, a large project is analyzed on every core, and the syntax trees a run holds no longer grow with the project. `PARAGLIDE_CONTEXT_THREADS` sets the number of threads; `0` analyzes in the main thread. `PARAGLIDE_CONTEXT_MEMORY_MB` sets the memory the run plans for, in place of the machine's or container's. Metadata files are written in pieces, and only the lines around each usage are held: a project whose metadata is longer than the longest string Node holds no longer runs out of memory, and its metadata file can be read back. A barrel of many `export *` no longer makes a run quadratic, an outdir with one file per message is read at once, and Vue, Svelte and Astro components cost less. A Vue or VitePress file's generated code is no longer kept for the rest of the run. The metadata files are unchanged. Source files are now read at most 64 at a time. Before, on Node 24 and older, a project with more files than the process's open-file limit could leave usages out of the metadata files without a warning.

  With the `cache` option (`paraglide-context --cache`), off by default, a run keeps what it found of each file in the `paraglide-usage-context` section of the project's `gt-lock.json`, which is committed: the next run, e.g. in CI, indexes again only the files that changed. Without a lock file, or past 2 MB, it is kept in `node_modules/.cache/paraglide-usage-context.json`. Merging the lock file with `gt`'s merge driver takes a `gt` release that keeps the section.

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - generaltranslation@9.5.13

## 0.2.0

### Minor Changes

- [#2714](https://github.com/generaltranslation/gt/pull/2714) [`ab192e7`](https://github.com/generaltranslation/gt/commit/ab192e7cf830c437ecd87404fd91f3d334a54cc3) Thanks [@JacksonO123](https://github.com/JacksonO123)! - Add `paraglide-context install <language...>`: it installs the packages that the named languages' files need (for example `svelte2tsx` for `.svelte` files) as dev dependencies, with the project's package manager, and skips the ones already installed. Warnings and errors are now written with `createDiagnosticMessage`, like the other General Translation packages: "paraglide-context Warning: …" and "paraglide-context Error: …".

### Patch Changes

- [#2691](https://github.com/generaltranslation/gt/pull/2691) [`c612d29`](https://github.com/generaltranslation/gt/commit/c612d296340602c6d7e568bd3ac50fc779e1712b) Thanks [@JacksonO123](https://github.com/JacksonO123)! - Fix the warnings about missing language tools: a Vue component's pug template that is skipped without `@vue/language-plugin-pug` is now reported, plain Markdown such as a README no longer asks for the Vue tools, and a tool that is installed but fails to load is no longer reported as not installed.

## 0.1.0

### Minor Changes

- [#2689](https://github.com/generaltranslation/gt/pull/2689) [`e982909`](https://github.com/generaltranslation/gt/commit/e982909453e085350382f2a075fa1d924296c0f7) Thanks [@JacksonO123](https://github.com/JacksonO123)! - Add `@generaltranslation/paraglide-js`: the `paraglide-context` CLI and `collectContext()` find every usage of a Paraglide message in an app's source and write the surrounding code to a `<name>.metadata.json` file next to the base-locale message file, which `gt translate` uploads as translation context.
