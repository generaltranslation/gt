# gt-rrweb

## 0.2.0

### Minor Changes

- [#2154](https://github.com/generaltranslation/gt/pull/2154) [`8855e5e`](https://github.com/generaltranslation/gt/commit/8855e5e9161b7816e7ec266a85aa706b9a21b9b5) Thanks [@logflash](https://github.com/logflash)! - Add the replayer: `createGTReplayer()` (framework-agnostic) + `<GTReplayer>` via the new `gt-rrweb/replay` entry play a recording in any of its traced locales — live in-player locale switching, a synthesized cursor that follows the recorded clicks, scrubbing, light/dark toggle, and full-screen. Options: `initialLocale`, `switchLocalesAllowed`, `debug` (drop a recording JSON to hot-swap). Events-only exports still replay localized via the locale/overlay events the recorder embeds in the stream. `@rrweb/replay` joins `@rrweb/record` as an optional peer.

## 0.1.0

### Minor Changes

- [#2144](https://github.com/generaltranslation/gt/pull/2144) [`4422032`](https://github.com/generaltranslation/gt/commit/4422032bb5d365aabe095ee1ff103fd5bfdee578) Thanks [@eoinest](https://github.com/eoinest)! - Add the recorder: `GTRecorder` + `useRecorder()` capture a product walkthrough once with rrweb, and `gt-rrweb/harvest` reads each locale's own published translations (source-agnostic; honors a custom `loadTranslations`). Replays via any rrweb replayer.

## 0.0.2

### Patch Changes

- [#2106](https://github.com/generaltranslation/gt/pull/2106) [`572357d`](https://github.com/generaltranslation/gt/commit/572357d55f8e1708b7417bf4622248322418bf25) Thanks [@logflash](https://github.com/logflash)! - Set up the `gt-rrweb` package: scaffold for recording a product walkthrough once with rrweb and replaying it per-locale using General Translation's own published translations.
