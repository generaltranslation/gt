# gt-rrweb

## 1.0.0-samsara.2

### Major Changes

- c0f8d3d: **Breaking:** a variable in the content of a `<T>` is found by its id, and has a name only when its author gave it one. A variable component without a `name` used to get a generated one, such as `_gt_cost_2`.

  ```diff
  - { "i": 2, "k": "_gt_cost_2", "v": "c" }   // <Currency>
  + { "i": 2, "v": "c" }

    { "i": 3, "k": "price", "v": "c" }        // <Currency name="price">, unchanged
  ```

  - `i` identifies a variable among its siblings, as it does an element. The runtimes match a translated variable to its value by `i`, so two variables with the same `name` no longer render the same value.
  - `v`, the type, is always there, and is how a variable is told from an element. `Variable` in `@generaltranslation/format` is now `{ i: number; v: VariableType; k?: string }`.
  - `k` is only a label for translators. An empty `name` counts as none, in every runtime and extractor.
  - `hashSource` hashes a variable by its `v` and, when it has one, its `k`.

  Every `<T>` that holds a `<Var>`, `<Num>`, `<Currency>`, `<DateTime>` or `<RelativeTime>` without a `name` gets a new hash. The runtimes, `gt`, the compiler, the Next.js SWC plugin and the Vue and Svelte extractors all write the new form, so upgrade them together, then run `gt translate` again. Translations stored under the old hashes are no longer found, and a translated variable needs its `i`: local translation files need their keys and variables updated or regenerated. A `<T>` whose variables all have a `name`, or that has no variables, keeps its hash.

  gt-svelte's `_gtm` metadata no longer lists variable names.

## 1.0.0-samsara.1

### Major Changes

- bb107a8: Remove `typesVersions`. Subpath types such as `gt-next/server` now resolve only through `exports`, which needs `moduleResolution` `bundler` (TypeScript 5.0+) or `node16`/`nodenext` (TypeScript 4.7+). `moduleResolution` `node` (node10) is no longer supported, including its implicit use with `module: commonjs` in TypeScript 5.9 and earlier and in create-next-app projects from Next.js 13.4.10 and earlier.

## 0.2.1-samsara.0

### Patch Changes

- 0604209: Seed the Samsara prerelease channel.

## 0.2.0

### Minor Changes

- [#2154](https://github.com/generaltranslation/gt/pull/2154) [`8855e5e`](https://github.com/generaltranslation/gt/commit/8855e5e9161b7816e7ec266a85aa706b9a21b9b5) Thanks [@logflash](https://github.com/logflash)! - Add the replayer: `createGTReplayer()` (framework-agnostic) + `<GTReplayer>` via the new `gt-rrweb/replay` entry play a recording in any of its traced locales — live in-player locale switching, a synthesized cursor that follows the recorded clicks, scrubbing, light/dark toggle, and full-screen. Options: `initialLocale`, `switchLocalesAllowed`, `debug` (drop a recording JSON to hot-swap). Events-only exports still replay localized via the locale/overlay events the recorder embeds in the stream. `@rrweb/replay` joins `@rrweb/record` as an optional peer.

## 0.1.0

### Minor Changes

- [#2144](https://github.com/generaltranslation/gt/pull/2144) [`4422032`](https://github.com/generaltranslation/gt/commit/4422032bb5d365aabe095ee1ff103fd5bfdee578) Thanks [@eoinest](https://github.com/eoinest)! - Add the recorder: `GTRecorder` + `useRecorder()` capture a product walkthrough once with rrweb, and `gt-rrweb/harvest` reads each locale's own published translations (source-agnostic; honors a custom `loadTranslations`). Replays via any rrweb replayer.

## 0.0.2

### Patch Changes

- [#2106](https://github.com/generaltranslation/gt/pull/2106) [`572357d`](https://github.com/generaltranslation/gt/commit/572357d55f8e1708b7417bf4622248322418bf25) Thanks [@logflash](https://github.com/logflash)! - Set up the `gt-rrweb` package: scaffold for recording a product walkthrough once with rrweb and replaying it per-locale using General Translation's own published translations.
