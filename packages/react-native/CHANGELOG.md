# gt-react-native

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
