# @generaltranslation/paraglide-js

## 0.2.0-samsara.2

### Patch Changes

- Updated dependencies [96f428a]
- Updated dependencies [2d7f9bd]
- Updated dependencies [ba09ee2]
- Updated dependencies [ba09ee2]
- Updated dependencies [63b6748]
- Updated dependencies [ea429a2]
- Updated dependencies [82999f0]
- Updated dependencies [ba09ee2]
- Updated dependencies [ba09ee2]
- Updated dependencies [943c094]
- Updated dependencies [3832c15]
- Updated dependencies [a191c9a]
- Updated dependencies [2d7f9bd]
- Updated dependencies [1a5e9ae]
- Updated dependencies [e29f6f9]
  - generaltranslation@10.0.0-samsara.9

## 0.2.0-samsara.1

### Patch Changes

- generaltranslation@10.0.0-samsara.8

## 0.2.0-samsara.0

### Minor Changes

- 27c26cd: Add `paraglide-context install <language...>`: it installs the packages that the named languages' files need (for example `svelte2tsx` for `.svelte` files) as dev dependencies, with the project's package manager, and skips the ones already installed. Warnings and errors are now written with `createDiagnosticMessage`, like the other General Translation packages: "paraglide-context Warning: …" and "paraglide-context Error: …".

### Patch Changes

- 27c26cd: `paraglide-context` no longer stops with "Maximum call stack size exceeded" on a variable that is assigned a spread of itself, like `msgs = { ...msgs }`. The right side now reads what the variable held before the assignment.
- 27c26cd: When two inlang projects use the same base-locale message file, its metadata file now gets the source code of both projects' usages. Each project wrote the file with only its own usages, so the last write dropped the other's.
  - generaltranslation@10.0.0-samsara.7

## 0.1.0

### Minor Changes

- [#2689](https://github.com/generaltranslation/gt/pull/2689) [`e982909`](https://github.com/generaltranslation/gt/commit/e982909453e085350382f2a075fa1d924296c0f7) Thanks [@JacksonO123](https://github.com/JacksonO123)! - Add `@generaltranslation/paraglide-js`: the `paraglide-context` CLI and `collectContext()` find every usage of a Paraglide message in an app's source and write the surrounding code to a `<name>.metadata.json` file next to the base-locale message file, which `gt translate` uploads as translation context.
