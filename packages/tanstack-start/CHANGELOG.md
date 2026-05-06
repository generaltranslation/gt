# gt-tanstack-start

## 0.4.16

### Patch Changes

- Updated dependencies [[`c7f8dbe`](https://github.com/generaltranslation/gt/commit/c7f8dbe7841b772358e4e0391fd7782e223cbec8), [`3af2461`](https://github.com/generaltranslation/gt/commit/3af2461b5456a87883431561712615fdb4f8c89e), [`6f56c52`](https://github.com/generaltranslation/gt/commit/6f56c52d2d6687b614b3eee7226f886c8eac9a96), [`a5b18eb`](https://github.com/generaltranslation/gt/commit/a5b18eb39f6f74e77df78b58f11f065cc7dbdbda), [`4976fc6`](https://github.com/generaltranslation/gt/commit/4976fc682c84fa95b7deace431b2235ca1fccf24)]:
  - gt-i18n@0.8.13
  - gt-react@10.19.12
  - @generaltranslation/react-core@1.8.14

## 0.4.15

### Patch Changes

- Updated dependencies [[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6), [`d9f3646`](https://github.com/generaltranslation/gt/commit/d9f3646aee45dc85cb3e28952bbf2c61b2b25050)]:
  - generaltranslation@8.2.11
  - gt-i18n@0.8.12
  - @generaltranslation/react-core@1.8.13
  - gt-react@10.19.11

## 0.4.14

### Patch Changes

- [#1296](https://github.com/generaltranslation/gt/pull/1296) [`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401) Thanks [@bgub](https://github.com/bgub)! - Require explicit locales for I18nManager translation/cache operations, move current-locale lookup into higher-level helpers, and keep runtime condition storage in wrapper runtimes.

- Updated dependencies [[`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401)]:
  - gt-i18n@0.8.11
  - gt-react@10.19.10
  - @generaltranslation/react-core@1.8.12

## 0.4.13

### Patch Changes

- [#1301](https://github.com/generaltranslation/gt/pull/1301) [`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2) Thanks [@bgub](https://github.com/bgub)! - Fix source-locale interpolation for missing translations and resolve custom locale aliases consistently in browser and TanStack Start locale detection.

- Updated dependencies [[`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2)]:
  - gt-i18n@0.8.10
  - gt-react@10.19.9
  - @generaltranslation/react-core@1.8.11

## 0.4.12

### Patch Changes

- Updated dependencies [[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:
  - generaltranslation@8.2.10
  - gt-i18n@0.8.9
  - gt-react@10.19.8
  - @generaltranslation/react-core@1.8.10

## 0.4.11

### Patch Changes

- Updated dependencies [[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:
  - generaltranslation@8.2.9
  - gt-i18n@0.8.8
  - gt-react@10.19.7
  - @generaltranslation/react-core@1.8.9

## 0.4.10

### Patch Changes

- Updated dependencies [[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:
  - generaltranslation@8.2.8
  - gt-i18n@0.8.7
  - gt-react@10.19.6
  - @generaltranslation/react-core@1.8.8

## 0.4.9

### Patch Changes

- Updated dependencies [[`5af18c1`](https://github.com/generaltranslation/gt/commit/5af18c13c2c2ad341ec67c2b4f6f6ef29320123b)]:
  - gt-i18n@0.8.6
  - gt-react@10.19.5
  - @generaltranslation/react-core@1.8.7

## 0.4.8

### Patch Changes

- [#1251](https://github.com/generaltranslation/gt/pull/1251) [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7) Thanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each package's `package.json` to enable tree-shaking in consumer bundlers (webpack, esbuild, Rollup). Packages with no module-scope side effects are marked `"sideEffects": false`. Packages with intentional side-effect entry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server entries, `gt-react-native` TurboModule spec) list those files explicitly so they are preserved.

- Updated dependencies [[`47ad56b`](https://github.com/generaltranslation/gt/commit/47ad56bb23a70382ba98a900d968e9a48beee2b8), [`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5), [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7), [`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)]:
  - gt-i18n@0.8.5
  - generaltranslation@8.2.7
  - gt-react@10.19.4
  - @generaltranslation/react-core@1.8.6

## 0.4.7

### Patch Changes

- Updated dependencies [[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:
  - generaltranslation@8.2.6
  - gt-i18n@0.8.4
  - gt-react@10.19.3
  - @generaltranslation/react-core@1.8.5

## 0.4.6

### Patch Changes

- Updated dependencies []:
  - gt-react@10.19.2

## 0.4.5

### Patch Changes

- Updated dependencies []:
  - gt-react@10.19.1

## 0.4.4

### Patch Changes

- Updated dependencies [[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:
  - gt-react@10.19.0
  - generaltranslation@8.2.5
  - gt-i18n@0.8.3
  - @generaltranslation/react-core@1.8.4

## 0.4.3

### Patch Changes

- Updated dependencies [[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:
  - generaltranslation@8.2.4
  - gt-i18n@0.8.2
  - gt-react@10.18.3
  - @generaltranslation/react-core@1.8.3

## 0.4.2

### Patch Changes

- [#1207](https://github.com/generaltranslation/gt/pull/1207) [`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: runtime translation

- Updated dependencies [[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:
  - gt-react@10.18.2
  - generaltranslation@8.2.3
  - gt-i18n@0.8.1
  - @generaltranslation/react-core@1.8.2

## 0.4.1

### Patch Changes

- Updated dependencies [[`0a1aef8`](https://github.com/generaltranslation/gt/commit/0a1aef8da966c4c02557dc834f1bc7c6822e55be)]:
  - @generaltranslation/react-core@1.8.1
  - gt-react@10.18.1

## 0.4.0

### Minor Changes

- [#1173](https://github.com/generaltranslation/gt/pull/1173) [`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context derivation

### Patch Changes

- Updated dependencies [[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)]:
  - gt-i18n@0.8.0
  - gt-react@10.18.0
  - @generaltranslation/react-core@1.8.0

## 0.3.2

### Patch Changes

- [#1158](https://github.com/generaltranslation/gt/pull/1158) [`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto injection for jsx translation

- Updated dependencies [[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:
  - gt-react@10.17.0
  - @generaltranslation/react-core@1.7.2
  - generaltranslation@8.2.2
  - gt-i18n@0.7.10

## 0.3.1

### Patch Changes

- [#1161](https://github.com/generaltranslation/gt/pull/1161) [`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update logo blocks in READMEs

- Updated dependencies [[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:
  - gt-react@10.16.1
  - gt-i18n@0.7.9
  - generaltranslation@8.2.1
  - @generaltranslation/react-core@1.7.1

## 0.3.0

### Minor Changes

- [#1153](https://github.com/generaltranslation/gt/pull/1153) [`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Add `<RelativeTime>` component for localized relative time formatting
  - New `<RelativeTime>` component with two usage modes:
    - Auto-select unit from a Date: `<RelativeTime>{someDate}</RelativeTime>` → "2 hours ago"
    - Explicit value + unit: `<RelativeTime value={-1} unit="day" />` → "yesterday"
  - Core: `_selectRelativeTimeUnit()` auto-selects the best unit (seconds → minutes → hours → days → weeks → months → years)
  - Core: `formatRelativeTimeFromDate()` standalone function and `GT.formatRelativeTimeFromDate()` class method
  - Week unit included in auto-selection thresholds (7-27 days)
  - CLI, compiler, and SWC plugin updated to recognize `RelativeTime` as a variable component

### Patch Changes

- Updated dependencies [[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290), [`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:
  - generaltranslation@8.2.0
  - @generaltranslation/react-core@1.7.0
  - gt-react@10.16.0
  - gt-i18n@0.7.8

## 0.2.7

### Patch Changes

- Updated dependencies [[`10a0f2e`](https://github.com/generaltranslation/gt/commit/10a0f2ef28003c2767129ba8ba88a61f8d6c3f04)]:
  - gt-i18n@0.7.7
  - gt-react@10.15.6
  - @generaltranslation/react-core@1.6.7

## 0.2.6

### Patch Changes

- Updated dependencies [[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:
  - @generaltranslation/react-core@1.6.6
  - generaltranslation@8.1.23
  - gt-i18n@0.7.6
  - gt-react@10.15.5

## 0.2.5

### Patch Changes

- Updated dependencies [[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:
  - generaltranslation@8.1.22
  - gt-i18n@0.7.5
  - gt-react@10.15.4
  - @generaltranslation/react-core@1.6.5

## 0.2.4

### Patch Changes

- Updated dependencies [[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e), [`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:
  - generaltranslation@8.1.21
  - gt-i18n@0.7.4
  - gt-react@10.15.3
  - @generaltranslation/react-core@1.6.4

## 0.2.3

### Patch Changes

- Updated dependencies []:
  - gt-i18n@0.7.3
  - gt-react@10.15.2
  - @generaltranslation/react-core@1.6.3

## 0.2.2

### Patch Changes

- [#1125](https://github.com/generaltranslation/gt/pull/1125) [`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo URLs in README files (updated to `/brand/gt-logo-*.svg`)

- Updated dependencies [[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:
  - generaltranslation@8.1.20
  - gt-i18n@0.7.2
  - @generaltranslation/react-core@1.6.2
  - gt-react@10.15.1

## 0.2.1

### Patch Changes

- [#1129](https://github.com/generaltranslation/gt/pull/1129) [`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: derivation support for the t macro

- Updated dependencies [[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:
  - gt-react@10.15.0
  - @generaltranslation/react-core@1.6.1
  - generaltranslation@8.1.19
  - gt-i18n@0.7.1

## 0.2.0

### Minor Changes

- [#1121](https://github.com/generaltranslation/gt/pull/1121) [`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5) Thanks [@pie575](https://github.com/pie575)! - Added a versionId hook for users to better access what Version their GT translations are on

### Patch Changes

- Updated dependencies [[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5), [`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:
  - @generaltranslation/react-core@1.6.0
  - gt-react@10.14.0
  - gt-i18n@0.7.0
  - generaltranslation@8.1.18

## 0.1.17

### Patch Changes

- Updated dependencies [[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)]:
  - gt-react@10.13.0
  - gt-i18n@0.6.2
  - @generaltranslation/react-core@1.5.10

## 0.1.16

### Patch Changes

- Updated dependencies [[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:
  - @generaltranslation/react-core@1.5.9
  - gt-react@10.12.1
  - generaltranslation@8.1.17
  - gt-i18n@0.6.1

## 0.1.15

### Patch Changes

- [#1113](https://github.com/generaltranslation/gt/pull/1113) [`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add string translation function t()

- Updated dependencies [[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)]:
  - gt-react@10.12.0
  - gt-i18n@0.6.0
  - @generaltranslation/react-core@1.5.8

## 0.1.14

### Patch Changes

- Updated dependencies [[`e364093`](https://github.com/generaltranslation/gt/commit/e3640931cf0ca2df08dcadbae30b1668e14a3ed8)]:
  - generaltranslation@8.1.16
  - gt-i18n@0.5.2
  - gt-react@10.11.7
  - @generaltranslation/react-core@1.5.7

## 0.1.13

### Patch Changes

- Updated dependencies [[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:
  - generaltranslation@8.1.15
  - gt-i18n@0.5.1
  - gt-react@10.11.6
  - @generaltranslation/react-core@1.5.6

## 0.1.12

### Patch Changes

- Updated dependencies [[`7846d06`](https://github.com/generaltranslation/gt/commit/7846d0672ba357081793706fdf55313b4f5428e0)]:
  - gt-i18n@0.5.0
  - @generaltranslation/react-core@1.5.5
  - gt-react@10.11.5

## 0.1.11

### Patch Changes

- Updated dependencies [[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76), [`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)]:
  - generaltranslation@8.1.14
  - @generaltranslation/react-core@1.5.4
  - gt-i18n@0.4.2
  - gt-react@10.11.4

## 0.1.10

### Patch Changes

- [#1069](https://github.com/generaltranslation/gt/pull/1069) [`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new gt package

- Updated dependencies [[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)]:
  - @generaltranslation/react-core@1.5.3
  - gt-react@10.11.3

## 0.1.9

### Patch Changes

- Updated dependencies [[`94b95ef`](https://github.com/generaltranslation/gt/commit/94b95ef662b81dac51416ecc64f3318339171f0b)]:
  - @generaltranslation/react-core@1.5.2
  - gt-react@10.11.2

## 0.1.8

### Patch Changes

- Updated dependencies [[`21b3304`](https://github.com/generaltranslation/gt/commit/21b33040774f9638fdf7edcfcf7170246a36fbec)]:
  - generaltranslation@8.1.13
  - gt-i18n@0.4.1
  - gt-react@10.11.1
  - @generaltranslation/react-core@1.5.1

## 0.1.7

### Patch Changes

- Updated dependencies [[`065cfaf`](https://github.com/generaltranslation/gt/commit/065cfaf4e6ac220755a9667b58731520d64fef85), [`d36d4b8`](https://github.com/generaltranslation/gt/commit/d36d4b8459626c552c143fbdfa6d01f647a66533)]:
  - gt-i18n@0.4.0
  - gt-react@10.11.0
  - @generaltranslation/react-core@1.5.0

## 0.1.6

### Patch Changes

- Updated dependencies [[`47918b7`](https://github.com/generaltranslation/gt/commit/47918b7a4c38967fe2148d972f0a3c740e0bc25d)]:
  - @generaltranslation/react-core@1.4.12
  - generaltranslation@8.1.12
  - gt-react@10.10.14
  - gt-i18n@0.3.12

## 0.1.5

### Patch Changes

- Updated dependencies [[`eb7855b`](https://github.com/generaltranslation/gt/commit/eb7855b6e35a244395da7d01e3b9b659884c6488)]:
  - gt-react@10.10.13

## 0.1.4

### Patch Changes

- Updated dependencies [[`7cd02ba`](https://github.com/generaltranslation/gt/commit/7cd02ba200c8645de01527a88f7cf32346e67d12)]:
  - generaltranslation@8.1.11
  - gt-i18n@0.3.11
  - gt-react@10.10.12
  - @generaltranslation/react-core@1.4.11

## 0.1.3

### Patch Changes

- Updated dependencies []:
  - gt-i18n@0.3.10
  - gt-react@10.10.11
  - @generaltranslation/react-core@1.4.10

## 0.1.2

### Patch Changes

- Updated dependencies []:
  - gt-i18n@0.3.9
  - gt-react@10.10.10
  - @generaltranslation/react-core@1.4.9

## 0.1.1

### Patch Changes

- [#1025](https://github.com/generaltranslation/gt/pull/1025) [`4aca966`](https://github.com/generaltranslation/gt/commit/4aca96658d38ce3f220984228510c2106afbe5ca) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: release

## 0.1.0

### Minor Changes

- [#1023](https://github.com/generaltranslation/gt/pull/1023) [`c66bbe1`](https://github.com/generaltranslation/gt/commit/c66bbe125f3fbba7a97604d3c2ca6b7d7a065f31) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: tanstack start i18n support

### Patch Changes

- Updated dependencies [[`9e99e94`](https://github.com/generaltranslation/gt/commit/9e99e945cbf9e31990930e3428468f64d7240da5), [`c66bbe1`](https://github.com/generaltranslation/gt/commit/c66bbe125f3fbba7a97604d3c2ca6b7d7a065f31)]:
  - generaltranslation@8.1.10
  - @generaltranslation/react-core@1.4.8
  - gt-react@10.10.9
  - gt-i18n@0.3.8
