# @generaltranslation/paraglide-js

## 0.2.0

### Minor Changes

- [#2714](https://github.com/generaltranslation/gt/pull/2714) [`ab192e7`](https://github.com/generaltranslation/gt/commit/ab192e7cf830c437ecd87404fd91f3d334a54cc3) Thanks [@JacksonO123](https://github.com/JacksonO123)! - Add `paraglide-context install <language...>`: it installs the packages that the named languages' files need (for example `svelte2tsx` for `.svelte` files) as dev dependencies, with the project's package manager, and skips the ones already installed. Warnings and errors are now written with `createDiagnosticMessage`, like the other General Translation packages: "paraglide-context Warning: …" and "paraglide-context Error: …".

### Patch Changes

- [#2691](https://github.com/generaltranslation/gt/pull/2691) [`c612d29`](https://github.com/generaltranslation/gt/commit/c612d296340602c6d7e568bd3ac50fc779e1712b) Thanks [@JacksonO123](https://github.com/JacksonO123)! - Fix the warnings about missing language tools: a Vue component's pug template that is skipped without `@vue/language-plugin-pug` is now reported, plain Markdown such as a README no longer asks for the Vue tools, and a tool that is installed but fails to load is no longer reported as not installed.

## 0.1.0

### Minor Changes

- [#2689](https://github.com/generaltranslation/gt/pull/2689) [`e982909`](https://github.com/generaltranslation/gt/commit/e982909453e085350382f2a075fa1d924296c0f7) Thanks [@JacksonO123](https://github.com/JacksonO123)! - Add `@generaltranslation/paraglide-js`: the `paraglide-context` CLI and `collectContext()` find every usage of a Paraglide message in an app's source and write the surrounding code to a `<name>.metadata.json` file next to the base-locale message file, which `gt translate` uploads as translation context.
