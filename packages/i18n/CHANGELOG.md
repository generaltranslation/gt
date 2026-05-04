# gt-i18n

## 0.8.12

### Patch Changes

- [#1308](https://github.com/generaltranslation/gt/pull/1308) [`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6) Thanks [@bgub](https://github.com/bgub)! - Add shared cache expiry, batching, and runtime translation configuration to I18nManager.

- Updated dependencies [[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:
  - generaltranslation@8.2.11
  - @generaltranslation/supported-locales@2.0.69

## 0.8.11

### Patch Changes

- [#1296](https://github.com/generaltranslation/gt/pull/1296) [`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401) Thanks [@bgub](https://github.com/bgub)! - Require explicit locales for I18nManager translation/cache operations, move current-locale lookup into higher-level helpers, and keep runtime condition storage in wrapper runtimes.

## 0.8.10

### Patch Changes

- [#1301](https://github.com/generaltranslation/gt/pull/1301) [`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2) Thanks [@bgub](https://github.com/bgub)! - Fix source-locale interpolation for missing translations and resolve custom locale aliases consistently in browser and TanStack Start locale detection.

## 0.8.9

### Patch Changes

- Updated dependencies [[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:
  - generaltranslation@8.2.10
  - @generaltranslation/supported-locales@2.0.68

## 0.8.8

### Patch Changes

- [#1278](https://github.com/generaltranslation/gt/pull/1278) [`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8) Thanks [@bgub](https://github.com/bgub)! - Add a `generaltranslation/core` entrypoint for locale and formatting helpers, and update `gt-i18n` to consume it where possible.

- Updated dependencies [[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:
  - generaltranslation@8.2.9
  - @generaltranslation/supported-locales@2.0.67

## 0.8.7

### Patch Changes

- Updated dependencies [[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:
  - generaltranslation@8.2.8
  - @generaltranslation/supported-locales@2.0.66

## 0.8.6

### Patch Changes

- [#1262](https://github.com/generaltranslation/gt/pull/1262) [`5af18c1`](https://github.com/generaltranslation/gt/commit/5af18c13c2c2ad341ec67c2b4f6f6ef29320123b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor(gt-i18n): move over to subscription system

## 0.8.5

### Patch Changes

- [#1252](https://github.com/generaltranslation/gt/pull/1252) [`47ad56b`](https://github.com/generaltranslation/gt/commit/47ad56bb23a70382ba98a900d968e9a48beee2b8) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - fix: pass `maxChars` (not `$maxChars`) to `hashSource` so it factors into the hash

- [#1251](https://github.com/generaltranslation/gt/pull/1251) [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7) Thanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each package's `package.json` to enable tree-shaking in consumer bundlers (webpack, esbuild, Rollup). Packages with no module-scope side effects are marked `"sideEffects": false`. Packages with intentional side-effect entry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server entries, `gt-react-native` TurboModule spec) list those files explicitly so they are preserved.

- [#1249](https://github.com/generaltranslation/gt/pull/1249) [`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569) Thanks [@bgub](https://github.com/bgub)! - chore: migrate build from Rollup to tsdown

- Updated dependencies [[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5), [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7), [`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)]:
  - generaltranslation@8.2.7
  - @generaltranslation/supported-locales@2.0.65

## 0.8.4

### Patch Changes

- Updated dependencies [[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:
  - generaltranslation@8.2.6
  - @generaltranslation/supported-locales@2.0.64

## 0.8.3

### Patch Changes

- [#1218](https://github.com/generaltranslation/gt/pull/1218) [`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat(react/browser): dev hot reload

- Updated dependencies [[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:
  - generaltranslation@8.2.5
  - @generaltranslation/supported-locales@2.0.63

## 0.8.2

### Patch Changes

- Updated dependencies [[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:
  - generaltranslation@8.2.4
  - @generaltranslation/supported-locales@2.0.62

## 0.8.1

### Patch Changes

- [#1207](https://github.com/generaltranslation/gt/pull/1207) [`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: runtime translation

- Updated dependencies [[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:
  - generaltranslation@8.2.3
  - @generaltranslation/supported-locales@2.0.61

## 0.8.0

### Minor Changes

- [#1173](https://github.com/generaltranslation/gt/pull/1173) [`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context derivation

## 0.7.10

### Patch Changes

- [#1158](https://github.com/generaltranslation/gt/pull/1158) [`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto injection for jsx translation

- Updated dependencies [[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:
  - @generaltranslation/supported-locales@2.0.60
  - generaltranslation@8.2.2

## 0.7.9

### Patch Changes

- [#1161](https://github.com/generaltranslation/gt/pull/1161) [`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update logo blocks in READMEs

- Updated dependencies [[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:
  - generaltranslation@8.2.1
  - @generaltranslation/supported-locales@2.0.59

## 0.7.8

### Patch Changes

- Updated dependencies [[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290), [`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:
  - generaltranslation@8.2.0
  - @generaltranslation/supported-locales@2.0.58

## 0.7.7

### Patch Changes

- [#1154](https://github.com/generaltranslation/gt/pull/1154) [`10a0f2e`](https://github.com/generaltranslation/gt/commit/10a0f2ef28003c2767129ba8ba88a61f8d6c3f04) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Restore `GTFunctionType` return type to `string`

## 0.7.6

### Patch Changes

- [#1147](https://github.com/generaltranslation/gt/pull/1147) [`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add support for multiple format types

- Updated dependencies [[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:
  - generaltranslation@8.1.23
  - @generaltranslation/supported-locales@2.0.57

## 0.7.5

### Patch Changes

- Updated dependencies [[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:
  - generaltranslation@8.1.22
  - @generaltranslation/supported-locales@2.0.56

## 0.7.4

### Patch Changes

- Updated dependencies [[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e), [`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:
  - generaltranslation@8.1.21
  - @generaltranslation/supported-locales@2.0.55

## 0.7.3

### Patch Changes

- Updated dependencies [[`881edc4`](https://github.com/generaltranslation/gt/commit/881edc4ccb5c9685c137da98aa5123b0e645686c)]:
  - @generaltranslation/supported-locales@2.0.54

## 0.7.2

### Patch Changes

- [#1125](https://github.com/generaltranslation/gt/pull/1125) [`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo URLs in README files (updated to `/brand/gt-logo-*.svg`)

- Updated dependencies [[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:
  - generaltranslation@8.1.20
  - @generaltranslation/supported-locales@2.0.53

## 0.7.1

### Patch Changes

- [#1129](https://github.com/generaltranslation/gt/pull/1129) [`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: derivation support for the t macro

- Updated dependencies [[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:
  - @generaltranslation/supported-locales@2.0.52
  - generaltranslation@8.1.19

## 0.7.0

### Minor Changes

- [#1121](https://github.com/generaltranslation/gt/pull/1121) [`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5) Thanks [@pie575](https://github.com/pie575)! - Added a versionId hook for users to better access what Version their GT translations are on

### Patch Changes

- Updated dependencies [[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:
  - generaltranslation@8.1.18
  - @generaltranslation/supported-locales@2.0.51

## 0.6.2

### Patch Changes

- [#1118](https://github.com/generaltranslation/gt/pull/1118) [`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add t macro

## 0.6.1

### Patch Changes

- [#1062](https://github.com/generaltranslation/gt/pull/1062) [`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: rename static to derive, and deprecate static

- Updated dependencies [[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:
  - generaltranslation@8.1.17
  - @generaltranslation/supported-locales@2.0.50

## 0.6.0

### Minor Changes

- [#1113](https://github.com/generaltranslation/gt/pull/1113) [`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add string translation function t()

## 0.5.2

### Patch Changes

- Updated dependencies [[`e364093`](https://github.com/generaltranslation/gt/commit/e3640931cf0ca2df08dcadbae30b1668e14a3ed8)]:
  - generaltranslation@8.1.16
  - @generaltranslation/supported-locales@2.0.49

## 0.5.1

### Patch Changes

- Updated dependencies [[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:
  - generaltranslation@8.1.15
  - @generaltranslation/supported-locales@2.0.48

## 0.5.0

### Minor Changes

- [#1090](https://github.com/generaltranslation/gt/pull/1090) [`7846d06`](https://github.com/generaltranslation/gt/commit/7846d0672ba357081793706fdf55313b4f5428e0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add locale utilities

## 0.4.2

### Patch Changes

- Updated dependencies [[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)]:
  - generaltranslation@8.1.14
  - @generaltranslation/supported-locales@2.0.47

## 0.4.1

### Patch Changes

- Updated dependencies [[`21b3304`](https://github.com/generaltranslation/gt/commit/21b33040774f9638fdf7edcfcf7170246a36fbec)]:
  - generaltranslation@8.1.13
  - @generaltranslation/supported-locales@2.0.46

## 0.4.0

### Minor Changes

- [#1051](https://github.com/generaltranslation/gt/pull/1051) [`d36d4b8`](https://github.com/generaltranslation/gt/commit/d36d4b8459626c552c143fbdfa6d01f647a66533) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: string list registration

### Patch Changes

- [#1048](https://github.com/generaltranslation/gt/pull/1048) [`065cfaf`](https://github.com/generaltranslation/gt/commit/065cfaf4e6ac220755a9667b58731520d64fef85) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: declareVar support for gt-i18n

## 0.3.12

### Patch Changes

- Updated dependencies [[`47918b7`](https://github.com/generaltranslation/gt/commit/47918b7a4c38967fe2148d972f0a3c740e0bc25d)]:
  - generaltranslation@8.1.12
  - @generaltranslation/supported-locales@2.0.45

## 0.3.11

### Patch Changes

- Updated dependencies [[`7cd02ba`](https://github.com/generaltranslation/gt/commit/7cd02ba200c8645de01527a88f7cf32346e67d12)]:
  - generaltranslation@8.1.11
  - @generaltranslation/supported-locales@2.0.44

## 0.3.10

### Patch Changes

- Updated dependencies [[`573287c`](https://github.com/generaltranslation/gt/commit/573287cb6ac3429c8dd276230e7f5bebf9077230)]:
  - @generaltranslation/supported-locales@2.0.43

## 0.3.9

### Patch Changes

- Updated dependencies [[`06104b0`](https://github.com/generaltranslation/gt/commit/06104b075e14b2299490e645ce1d313224aac639)]:
  - @generaltranslation/supported-locales@2.0.42

## 0.3.8

### Patch Changes

- [#1023](https://github.com/generaltranslation/gt/pull/1023) [`c66bbe1`](https://github.com/generaltranslation/gt/commit/c66bbe125f3fbba7a97604d3c2ca6b7d7a065f31) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: tanstack start i18n support

- Updated dependencies [[`9e99e94`](https://github.com/generaltranslation/gt/commit/9e99e945cbf9e31990930e3428468f64d7240da5)]:
  - generaltranslation@8.1.10
  - @generaltranslation/supported-locales@2.0.41

## 0.3.7

### Patch Changes

- [#1008](https://github.com/generaltranslation/gt/pull/1008) [`7c0a319`](https://github.com/generaltranslation/gt/commit/7c0a31917215bd77528f9e8f01c29a113f8f25c6) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: gt-node translation interface

## 0.3.6

### Patch Changes

- [#989](https://github.com/generaltranslation/gt/pull/989) [`4a66903`](https://github.com/generaltranslation/gt/commit/4a669031f74a0b20783709752ab7fc0ab40869df) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: set up i18n base

- [#991](https://github.com/generaltranslation/gt/pull/991) [`8b65862`](https://github.com/generaltranslation/gt/commit/8b65862c33ecb62fa0d9b80ec3fba55dbfe04719) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: support for node environments

- Updated dependencies [[`4a66903`](https://github.com/generaltranslation/gt/commit/4a669031f74a0b20783709752ab7fc0ab40869df)]:
  - generaltranslation@8.1.9
  - @generaltranslation/supported-locales@2.0.40

## 0.3.5

### Patch Changes

- Updated dependencies [[`fca3a25`](https://github.com/generaltranslation/gt/commit/fca3a2583eb7f21bc3ef13516351d479f7bef882)]:
  - generaltranslation@8.1.8
  - @generaltranslation/supported-locales@2.0.39

## 0.3.4

### Patch Changes

- Updated dependencies [[`eb07e8c`](https://github.com/generaltranslation/gt/commit/eb07e8ce1b610551437b40f96c72ac76d0af7b67)]:
  - generaltranslation@8.1.7
  - @generaltranslation/supported-locales@2.0.38

## 0.3.3

### Patch Changes

- Updated dependencies [[`feada39`](https://github.com/generaltranslation/gt/commit/feada3918ad78a1584f07245ac158c2d994a38da)]:
  - generaltranslation@8.1.6
  - @generaltranslation/supported-locales@2.0.37

## 0.3.2

### Patch Changes

- Updated dependencies [[`4def431`](https://github.com/generaltranslation/gt/commit/4def4316c4e9fe0de02d091a2320667a0f86284a)]:
  - @generaltranslation/supported-locales@2.0.36

## 0.3.1

### Patch Changes

- Updated dependencies [[`1e7e52f`](https://github.com/generaltranslation/gt/commit/1e7e52f3a77835887ff187ffeb99d6e3dc2a9e6c)]:
  - generaltranslation@8.1.5
  - @generaltranslation/supported-locales@2.0.35

## 0.3.0

### Minor Changes

- [#806](https://github.com/generaltranslation/gt/pull/806) [`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - feat: declareStatic()

### Patch Changes

- Updated dependencies [[`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f)]:
  - generaltranslation@8.1.4
  - @generaltranslation/supported-locales@2.0.34

## 0.2.2

### Patch Changes

- Updated dependencies [[`e113d8d`](https://github.com/generaltranslation/gt/commit/e113d8d8fb5e37f45a4aa77544e8f4666519bfe8)]:
  - generaltranslation@8.1.3
  - @generaltranslation/supported-locales@2.0.33

## 0.2.1

### Patch Changes

- Updated dependencies [[`3dc7b64`](https://github.com/generaltranslation/gt/commit/3dc7b6460cd05ddcb656a247602f4f50b06312fd)]:
  - generaltranslation@8.1.2
  - @generaltranslation/supported-locales@2.0.32

## 0.2.0

### Minor Changes

- [#859](https://github.com/generaltranslation/gt/pull/859) [`b585745`](https://github.com/generaltranslation/gt/commit/b585745b64e005a977b837cd1f59be6d61c681ab) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: max char support

### Patch Changes

- Updated dependencies [[`37bac4c`](https://github.com/generaltranslation/gt/commit/37bac4ce11689a2f729efbcb2e052205447a7f71)]:
  - generaltranslation@8.1.1
  - @generaltranslation/supported-locales@2.0.31

## 0.1.3

### Patch Changes

- Updated dependencies [[`3e8ceb4`](https://github.com/generaltranslation/gt/commit/3e8ceb4526530d38eae469b05e8bf273d5ca05ac)]:
  - generaltranslation@8.1.0
  - @generaltranslation/supported-locales@2.0.30

## 0.1.2

### Patch Changes

- Updated dependencies [[`997a5df`](https://github.com/generaltranslation/gt/commit/997a5df6ac355b49a77e768935f9017af689de21)]:
  - generaltranslation@8.0.6
  - @generaltranslation/supported-locales@2.0.29

## 0.1.1

### Patch Changes

- Updated dependencies [[`30a04f9`](https://github.com/generaltranslation/gt/commit/30a04f955c64013daf2a32480fb33b3d4e08d678)]:
  - generaltranslation@8.0.5
  - @generaltranslation/supported-locales@2.0.28

## 0.1.0

### Minor Changes

- [#816](https://github.com/generaltranslation/gt/pull/816) [`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add gt-i18n, a pure js library for translation

### Patch Changes

- Updated dependencies [[`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605)]:
  - @generaltranslation/supported-locales@2.0.27
  - generaltranslation@8.0.4
