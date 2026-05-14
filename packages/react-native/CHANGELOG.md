# gt-react-native

## 10.19.17

### Patch Changes

- [#1419](https://github.com/generaltranslation/gt/pull/1419) [`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300) Thanks [@bgub](https://github.com/bgub)! - Improve diagnostic messages and package-local diagnostic formatting.

- Updated dependencies [[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa), [`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:
  - @generaltranslation/format@0.1.1
  - generaltranslation@8.2.15
  - @generaltranslation/react-core@1.8.19
  - @generaltranslation/supported-locales@2.0.73

## 10.19.16

### Patch Changes

- [#1408](https://github.com/generaltranslation/gt/pull/1408) [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6) Thanks [@bgub](https://github.com/bgub)! - Use @generaltranslation/format directly for shared formatting and locale helpers.

- Updated dependencies [[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99), [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6), [`6e6c69e`](https://github.com/generaltranslation/gt/commit/6e6c69e3ca2f51937407674cf101b69e968952a1)]:
  - @generaltranslation/format@0.1.0
  - generaltranslation@8.2.14
  - @generaltranslation/react-core@1.8.18
  - @generaltranslation/supported-locales@2.0.72

## 10.19.15

### Patch Changes

- Updated dependencies [[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7), [`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:
  - generaltranslation@8.2.13
  - @generaltranslation/react-core@1.8.17
  - @generaltranslation/supported-locales@2.0.71

## 10.19.14

### Patch Changes

- Updated dependencies [[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)]:
  - @generaltranslation/react-core@1.8.16
  - generaltranslation@8.2.12
  - @generaltranslation/supported-locales@2.0.70

## 10.19.13

### Patch Changes

- Updated dependencies []:
  - @generaltranslation/react-core@1.8.15

## 10.19.12

### Patch Changes

- Updated dependencies []:
  - @generaltranslation/react-core@1.8.14

## 10.19.11

### Patch Changes

- Updated dependencies [[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6), [`d9f3646`](https://github.com/generaltranslation/gt/commit/d9f3646aee45dc85cb3e28952bbf2c61b2b25050)]:
  - generaltranslation@8.2.11
  - @generaltranslation/react-core@1.8.13
  - @generaltranslation/supported-locales@2.0.69

## 10.19.10

### Patch Changes

- Updated dependencies []:
  - @generaltranslation/react-core@1.8.12

## 10.19.9

### Patch Changes

- Updated dependencies []:
  - @generaltranslation/react-core@1.8.11

## 10.19.8

### Patch Changes

- Updated dependencies [[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:
  - generaltranslation@8.2.10
  - @generaltranslation/react-core@1.8.10
  - @generaltranslation/supported-locales@2.0.68

## 10.19.7

### Patch Changes

- Updated dependencies [[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:
  - generaltranslation@8.2.9
  - @generaltranslation/react-core@1.8.9
  - @generaltranslation/supported-locales@2.0.67

## 10.19.6

### Patch Changes

- Updated dependencies [[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:
  - generaltranslation@8.2.8
  - @generaltranslation/react-core@1.8.8
  - @generaltranslation/supported-locales@2.0.66

## 10.19.5

### Patch Changes

- Updated dependencies []:
  - @generaltranslation/react-core@1.8.7

## 10.19.4

### Patch Changes

- [#1251](https://github.com/generaltranslation/gt/pull/1251) [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7) Thanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each package's `package.json` to enable tree-shaking in consumer bundlers (webpack, esbuild, Rollup). Packages with no module-scope side effects are marked `"sideEffects": false`. Packages with intentional side-effect entry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server entries, `gt-react-native` TurboModule spec) list those files explicitly so they are preserved.

- Updated dependencies [[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5), [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7), [`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)]:
  - generaltranslation@8.2.7
  - @generaltranslation/react-core@1.8.6
  - @generaltranslation/supported-locales@2.0.65

## 10.19.3

### Patch Changes

- Updated dependencies [[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:
  - generaltranslation@8.2.6
  - @generaltranslation/react-core@1.8.5
  - @generaltranslation/supported-locales@2.0.64

## 10.19.2

### Patch Changes

- [#1232](https://github.com/generaltranslation/gt/pull/1232) [`485fa93`](https://github.com/generaltranslation/gt/commit/485fa93b212dcf42289ddf3cb9859a60da82c932) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: clean up minor issues

## 10.19.1

### Patch Changes

- [#1228](https://github.com/generaltranslation/gt/pull/1228) [`b8a8ada`](https://github.com/generaltranslation/gt/commit/b8a8ada6fe6ad8bd48f6492de19036a5a69bff19) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: migrate gt-react-native to monorepo
