# @generaltranslation/compiler

## 1.3.32

### Patch Changes

- [#1918](https://github.com/generaltranslation/gt/pull/1918) [`dce7a7a`](https://github.com/generaltranslation/gt/commit/dce7a7a0b5b82ee0ac7ca3518030ab51026da103) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Allow framework integrations to configure the package used for automatic JSX injection imports.

- [#1916](https://github.com/generaltranslation/gt/pull/1916) [`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Unify `gt.config.json` types so complete config objects can be spread into compiler plugins and runtime initializers while file settings remain optional.

- Updated dependencies [[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:
  - generaltranslation@9.0.3

## 1.3.31

### Patch Changes

- [#1887](https://github.com/generaltranslation/gt/pull/1887) [`da32fa0`](https://github.com/generaltranslation/gt/commit/da32fa05bd718fc55ce418e68678c2d2691d5433) Thanks [@bgub](https://github.com/bgub)! - Remove empty callback registration and injection modules while preserving callback validation and `useGT` hash injection behavior.

- Updated dependencies [[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584), [`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57), [`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:
  - generaltranslation@9.0.2

## 1.3.30

### Patch Changes

- [#1862](https://github.com/generaltranslation/gt/pull/1862) [`7f0fbfe`](https://github.com/generaltranslation/gt/commit/7f0fbfef78f677372d39087252ab8d6c72d78e7e) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Skip compile-time hash injection for `<T>` components containing `<Derive>` children. A single injected hash pinned the runtime lookup to a hash matching none of the per-variant translations, so the rendered translation was stuck on one variant. Also stops injecting an empty `_hash` for `<T $context={derive(...)}>` and autoderive dynamic content.

- [#1863](https://github.com/generaltranslation/gt/pull/1863) [`ed53c71`](https://github.com/generaltranslation/gt/commit/ed53c71bc5c6a8d82feaef1b52f68d20b3794c0b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fix `$_hash` injection for `gt()` callbacks with derive content: a derive call no longer shifts the injected hashes of sibling `gt()` calls (counter misalignment), and derive `$context` no longer injects an empty `$_hash` or an empty-hash `useGT()` prefetch entry, both of which broke translation lookups.

- Updated dependencies [[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:
  - generaltranslation@9.0.1

## 1.3.29

### Patch Changes

- [#1873](https://github.com/generaltranslation/gt/pull/1873) [`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retrigger package publication after repairing release workspace dependency resolution.

## 1.3.28

### Patch Changes

- [#1864](https://github.com/generaltranslation/gt/pull/1864) [`cb8f38e`](https://github.com/generaltranslation/gt/commit/cb8f38ebe5e9c7336bb4820dbef4b6ee5675645d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Honor the `compileTimeHash` option: setting it to `false` now actually disables hash injection (previously it was ignored and injection always ran). The default flips to `true`, matching the previously observed always-inject behavior, so default behavior is unchanged.

- [#1866](https://github.com/generaltranslation/gt/pull/1866) [`53e61ab`](https://github.com/generaltranslation/gt/commit/53e61abbb4522631f252bcd268eae9c079dd9967) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Recover the stable releases skipped after the Odysseus version regression and publish the accumulated package changes under new npm versions.

## 1.3.26

### Patch Changes

- [#1858](https://github.com/generaltranslation/gt/pull/1858) [`006e071`](https://github.com/generaltranslation/gt/commit/006e071bf87ffe80f2d18958ddfa8f18cc2d85d2) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Accept parsed `gt.config.json` objects in the compiler and React SPA configuration types.

## 1.3.25

### Patch Changes

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`8870496`](https://github.com/generaltranslation/gt/commit/88704963eb74e81401994681ce7cdae3ba91b6c0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Support dev hot reload lookups for server `getGT` strings.

  `getGT` can now receive compiler-injected message metadata and prefetch missing translations through the runtime cache in development. `gt-next` forwards the server request conditions into this path so App Router server strings can participate in hot reload translation updates.

  Compiler-injected `getGT` and `useGT` preload messages now emit the same sugar metadata keys used by runtime lookup options.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`55c77ea`](https://github.com/generaltranslation/gt/commit/55c77ea871f5c7bc333c046d89a32472e68f0f4b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Preserve `$format` in compiler-injected `getGT` and `useGT` preload metadata so preloaded runtime lookups use the same hash format as the original translation call.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`693288d`](https://github.com/generaltranslation/gt/commit/693288d632c42b923920a2fdd9ae2babc1bc28f5) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove internal source barrel exports and update imports to reference defining files directly.

- Updated dependencies [[`b72c30b`](https://github.com/generaltranslation/gt/commit/b72c30bc603562310a51b656fb003f1486315a8a), [`72e9e16`](https://github.com/generaltranslation/gt/commit/72e9e1643797be8e4ae1453897fd0b023fce2674), [`5adeede`](https://github.com/generaltranslation/gt/commit/5adeede157922d547a33a078d0f527f572c9a8b4), [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546), [`88f3a2e`](https://github.com/generaltranslation/gt/commit/88f3a2e0f304fdd19891afac0b41954edc9497c6), [`e12fb17`](https://github.com/generaltranslation/gt/commit/e12fb17d41cfa5fa231e64fe70423434739ea985), [`5752fe8`](https://github.com/generaltranslation/gt/commit/5752fe81bf5b5deaae878638e0de99959bf719be), [`97dc7f4`](https://github.com/generaltranslation/gt/commit/97dc7f4818476a319a54b1519e994a62d5a9a3a5), [`693288d`](https://github.com/generaltranslation/gt/commit/693288d632c42b923920a2fdd9ae2babc1bc28f5), [`2e85ebd`](https://github.com/generaltranslation/gt/commit/2e85ebd1528a4f99a8e36e1d8d6714a639040596), [`d5cf2d3`](https://github.com/generaltranslation/gt/commit/d5cf2d34f412ad49e8b2818fe788b870a5964d65), [`4986567`](https://github.com/generaltranslation/gt/commit/498656728741898a56ae348a536107bd92f95c04), [`795edc8`](https://github.com/generaltranslation/gt/commit/795edc8a2b3e91fc9801d726f4b5cd6fbbc98fb0)]:
  - generaltranslation@9.0.0
  - @generaltranslation/format@0.1.2

## 1.3.25-odysseus.8

### Patch Changes

- Updated dependencies [b72c30b]
- Updated dependencies [d5cf2d3]
  - generaltranslation@9.0.0-odysseus.6

## 1.3.25-odysseus.7

### Patch Changes

- Updated dependencies [72e9e16]
- Updated dependencies [5adeede]
- Updated dependencies [2e85ebd]
  - generaltranslation@9.0.0-odysseus.5

## 1.3.25-odysseus.6

### Patch Changes

- c34cab3: Preserve `$format` in compiler-injected `getGT` and `useGT` preload metadata so preloaded runtime lookups use the same hash format as the original translation call.

## 1.3.25-odysseus.5

### Patch Changes

- 432fa49: Support dev hot reload lookups for server `getGT` strings.

  `getGT` can now receive compiler-injected message metadata and prefetch missing translations through the runtime cache in development. `gt-next` forwards the server request conditions into this path so App Router server strings can participate in hot reload translation updates.

  Compiler-injected `getGT` and `useGT` preload messages now emit the same sugar metadata keys used by runtime lookup options.

## 1.3.25-odysseus.4

### Patch Changes

- Updated dependencies [26faa87]
  - generaltranslation@9.0.0-odysseus.4

## 1.3.25-odysseus.3

### Patch Changes

- Updated dependencies [b1eef00]
  - generaltranslation@9.0.0-odysseus.3

## 1.3.25-odysseus.2

### Patch Changes

- Updated dependencies [[`4b97bc3`](https://github.com/generaltranslation/gt/commit/4b97bc360b2869bbb6e5f214589ef84f6d58a660), [`020c6bd`](https://github.com/generaltranslation/gt/commit/020c6bdd8c604bc07d80d75e8ea2ace1e70d7447)]:
  - @generaltranslation/format@0.1.2-odysseus.1
  - generaltranslation@9.0.0-odysseus.2

## 1.3.25-odysseus.1

### Patch Changes

- [#1677](https://github.com/generaltranslation/gt/pull/1677) [`87d6320`](https://github.com/generaltranslation/gt/commit/87d6320d271a1bf455f4e283dc1bb23893c7ba64) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove internal source barrel exports and update imports to reference defining files directly.

- Updated dependencies [[`87d6320`](https://github.com/generaltranslation/gt/commit/87d6320d271a1bf455f4e283dc1bb23893c7ba64)]:
  - generaltranslation@9.0.0-odysseus.1

## 1.3.25-odysseus.0

### Patch Changes

- [#1508](https://github.com/generaltranslation/gt/pull/1508) [`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- Updated dependencies [[`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575), [`620621a`](https://github.com/generaltranslation/gt/commit/620621aceeafedbb958884cacc5495736191b065), [`bd0d788`](https://github.com/generaltranslation/gt/commit/bd0d7883601a183a31b47b36ea4ea2dca69c62d0)]:
  - @generaltranslation/format@0.1.2-odysseus.0
  - generaltranslation@9.0.0-odysseus.0

## 1.3.26

### Patch Changes

- Updated dependencies [[`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8)]:
  - generaltranslation@8.2.18

## 1.3.25

### Patch Changes

- Updated dependencies [[`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01)]:
  - generaltranslation@8.2.17

## 1.3.24

### Patch Changes

- Updated dependencies [[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:
  - generaltranslation@8.2.16

## 1.3.27

### Patch Changes

- [#1786](https://github.com/generaltranslation/gt/pull/1786) [`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add `requiresReview`

- Updated dependencies [[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:
  - generaltranslation@8.2.19

## 1.3.26

### Patch Changes

- Updated dependencies [[`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8)]:
  - generaltranslation@8.2.18

## 1.3.25

### Patch Changes

- Updated dependencies [[`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01)]:
  - generaltranslation@8.2.17

## 1.3.24

### Patch Changes

- Updated dependencies [[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:
  - generaltranslation@8.2.16

## 1.3.23

### Patch Changes

- Updated dependencies [[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa), [`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:
  - @generaltranslation/format@0.1.1
  - generaltranslation@8.2.15

## 1.3.22

### Patch Changes

- [#1408](https://github.com/generaltranslation/gt/pull/1408) [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6) Thanks [@bgub](https://github.com/bgub)! - Use @generaltranslation/format directly for shared formatting and locale helpers.

- Updated dependencies [[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99), [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)]:
  - @generaltranslation/format@0.1.0
  - generaltranslation@8.2.14

## 1.3.21

### Patch Changes

- Updated dependencies [[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7), [`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:
  - generaltranslation@8.2.13

## 1.3.20

### Patch Changes

- [#1342](https://github.com/generaltranslation/gt/pull/1342) [`6a255fb`](https://github.com/generaltranslation/gt/commit/6a255fb7ee440c88f6374fe14e7b0008e051d3a8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Auto-load gt.config.json for compiler plugins when no gtConfig option is passed.

- Updated dependencies [[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)]:
  - generaltranslation@8.2.12

## 1.3.19

### Patch Changes

- [#1315](https://github.com/generaltranslation/gt/pull/1315) [`5801996`](https://github.com/generaltranslation/gt/commit/58019961cf4142e5468fbbc523a514e3f90b4123) Thanks [@bgub](https://github.com/bgub)! - Preserve invalid template escape errors in `msg()` and `t()` validation even when string autoderive is enabled.

- [#1331](https://github.com/generaltranslation/gt/pull/1331) [`3dedd4a`](https://github.com/generaltranslation/gt/commit/3dedd4a07b674f7b943f963190232e5c0f01026f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Thread JSX collection through path-aware helpers for future derivation support.

## 1.3.18

### Patch Changes

- [#1313](https://github.com/generaltranslation/gt/pull/1313) [`b6098f8`](https://github.com/generaltranslation/gt/commit/b6098f87e2355e7d862d201c24b25467fb569015) Thanks [@bgub](https://github.com/bgub)! - Do not treat JavaScript labels as shadowing GT translation imports during string extraction.

- Updated dependencies [[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:
  - generaltranslation@8.2.11

## 1.3.17

### Patch Changes

- [#1272](https://github.com/generaltranslation/gt/pull/1272) [`7ce1813`](https://github.com/generaltranslation/gt/commit/7ce18131c7a1e494fdc5c488e2f53d033b083311) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: add error enforcement for msg(), t() and t``

## 1.3.16

### Patch Changes

- [#1271](https://github.com/generaltranslation/gt/pull/1271) [`7b1fd81`](https://github.com/generaltranslation/gt/commit/7b1fd816f8c8c9f2997bc0b9abe2cabd1dab00e8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor(compiler): consolidate string extraction logic

- Updated dependencies [[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:
  - generaltranslation@8.2.10

## 1.3.15

### Patch Changes

- Updated dependencies [[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:
  - generaltranslation@8.2.9

## 1.3.14

### Patch Changes

- Updated dependencies [[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:
  - generaltranslation@8.2.8

## 1.3.13

### Patch Changes

- [`28d0c06`](https://github.com/generaltranslation/gt/commit/28d0c06f3e8366fc2c119b7792620c4764eda2de) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - patch: inject compile-time hashes into standalone t() calls

## 1.3.12

### Patch Changes

- Updated dependencies [[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5), [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)]:
  - generaltranslation@8.2.7

## 1.3.11

### Patch Changes

- Updated dependencies [[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:
  - generaltranslation@8.2.6

## 1.3.10

### Patch Changes

- [#1236](https://github.com/generaltranslation/gt/pull/1236) [`3d6c60e`](https://github.com/generaltranslation/gt/commit/3d6c60e1595bc9409a2d21a153caa5f909154691) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: string extraction for concat with non-strings

## 1.3.9

### Patch Changes

- [#1233](https://github.com/generaltranslation/gt/pull/1233) [`2e1869d`](https://github.com/generaltranslation/gt/commit/2e1869d464714427e018911c61bd06b2cf5bb900) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: more robust string extraction

## 1.3.8

### Patch Changes

- [#1218](https://github.com/generaltranslation/gt/pull/1218) [`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat(react/browser): dev hot reload

- Updated dependencies [[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:
  - generaltranslation@8.2.5

## 1.3.7

### Patch Changes

- Updated dependencies [[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:
  - generaltranslation@8.2.4

## 1.3.6

### Patch Changes

- Updated dependencies [[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:
  - generaltranslation@8.2.3

## 1.3.5

### Patch Changes

- [#1199](https://github.com/generaltranslation/gt/pull/1199) [`1828cd4`](https://github.com/generaltranslation/gt/commit/1828cd4eafb1f3ea868b437b914c844670d2c50f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: enable autoderive for jsx

- [#1201](https://github.com/generaltranslation/gt/pull/1201) [`fbb9d26`](https://github.com/generaltranslation/gt/commit/fbb9d268dbee58142e305b9076e44000205d5437) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: customize autoderive

## 1.3.4

### Patch Changes

- [#1195](https://github.com/generaltranslation/gt/pull/1195) [`2090de3`](https://github.com/generaltranslation/gt/commit/2090de3613b9684fd43adc3b83f677bc33c1d9a6) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: standardize naming convention for "autoderive"

## 1.3.3

### Patch Changes

- [#1188](https://github.com/generaltranslation/gt/pull/1188) [`a76a386`](https://github.com/generaltranslation/gt/commit/a76a38624a2defbfd8d0540ccb74bb264079f61a) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix(compiler): extend autoderive gt msg

## 1.3.2

### Patch Changes

- [#1182](https://github.com/generaltranslation/gt/pull/1182) [`80fe63f`](https://github.com/generaltranslation/gt/commit/80fe63fa349f8ece0871ba455f16dae614327fdd) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: handle member expressions without throwing errors

## 1.3.1

### Patch Changes

- [#1173](https://github.com/generaltranslation/gt/pull/1173) [`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context derivation

## 1.3.0

### Minor Changes

- [#1158](https://github.com/generaltranslation/gt/pull/1158) [`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto injection for jsx translation

### Patch Changes

- Updated dependencies [[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:
  - generaltranslation@8.2.2

## 1.2.1

### Patch Changes

- [#1161](https://github.com/generaltranslation/gt/pull/1161) [`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update logo blocks in READMEs

- Updated dependencies [[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:
  - generaltranslation@8.2.1

## 1.2.0

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

## 1.1.36

### Patch Changes

- [#1147](https://github.com/generaltranslation/gt/pull/1147) [`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add support for multiple format types

- Updated dependencies [[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:
  - generaltranslation@8.1.23

## 1.1.35

### Patch Changes

- Updated dependencies [[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:
  - generaltranslation@8.1.22

## 1.1.34

### Patch Changes

- [#1141](https://github.com/generaltranslation/gt/pull/1141) [`4820643`](https://github.com/generaltranslation/gt/commit/4820643665d5aecacc34c52707c0c81bf4da18ca) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: auto derive for the t() function

## 1.1.33

### Patch Changes

- Updated dependencies [[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e), [`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:
  - generaltranslation@8.1.21

## 1.1.32

### Patch Changes

- [#1125](https://github.com/generaltranslation/gt/pull/1125) [`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo URLs in README files (updated to `/brand/gt-logo-*.svg`)

- Updated dependencies [[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:
  - generaltranslation@8.1.20

## 1.1.31

### Patch Changes

- [#1129](https://github.com/generaltranslation/gt/pull/1129) [`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: derivation support for the t macro

- Updated dependencies [[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:
  - generaltranslation@8.1.19

## 1.1.30

### Patch Changes

- Updated dependencies [[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:
  - generaltranslation@8.1.18

## 1.1.29

### Patch Changes

- [#1118](https://github.com/generaltranslation/gt/pull/1118) [`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add t macro

## 1.1.28

### Patch Changes

- [#1062](https://github.com/generaltranslation/gt/pull/1062) [`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: rename static to derive, and deprecate static

- Updated dependencies [[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:
  - generaltranslation@8.1.17

## 1.1.27

### Patch Changes

- Updated dependencies [[`e364093`](https://github.com/generaltranslation/gt/commit/e3640931cf0ca2df08dcadbae30b1668e14a3ed8)]:
  - generaltranslation@8.1.16

## 1.1.26

### Patch Changes

- Updated dependencies [[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:
  - generaltranslation@8.1.15

## 1.1.25

### Patch Changes

- [#1076](https://github.com/generaltranslation/gt/pull/1076) [`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Apply style guide to error messages and warnings: remove "Please", simplify verbose phrasing, fix `in-line` → `inline`.

- Updated dependencies [[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)]:
  - generaltranslation@8.1.14

## 1.1.24

### Patch Changes

- [#1069](https://github.com/generaltranslation/gt/pull/1069) [`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new gt package

## 1.1.23

### Patch Changes

- [#1068](https://github.com/generaltranslation/gt/pull/1068) [`94b95ef`](https://github.com/generaltranslation/gt/commit/94b95ef662b81dac51416ecc64f3318339171f0b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: runtime calculation for the injection of 'data-' attribute in jsx

## 1.1.22

### Patch Changes

- Updated dependencies [[`21b3304`](https://github.com/generaltranslation/gt/commit/21b33040774f9638fdf7edcfcf7170246a36fbec)]:
  - generaltranslation@8.1.13

## 1.1.21

### Patch Changes

- Updated dependencies [[`47918b7`](https://github.com/generaltranslation/gt/commit/47918b7a4c38967fe2148d972f0a3c740e0bc25d)]:
  - generaltranslation@8.1.12

## 1.1.20

### Patch Changes

- Updated dependencies [[`7cd02ba`](https://github.com/generaltranslation/gt/commit/7cd02ba200c8645de01527a88f7cf32346e67d12)]:
  - generaltranslation@8.1.11

## 1.1.19

### Patch Changes

- Updated dependencies [[`9e99e94`](https://github.com/generaltranslation/gt/commit/9e99e945cbf9e31990930e3428468f64d7240da5)]:
  - generaltranslation@8.1.10

## 1.1.18

### Patch Changes

- Updated dependencies [[`4a66903`](https://github.com/generaltranslation/gt/commit/4a669031f74a0b20783709752ab7fc0ab40869df)]:
  - generaltranslation@8.1.9

## 1.1.17

### Patch Changes

- Updated dependencies [[`fca3a25`](https://github.com/generaltranslation/gt/commit/fca3a2583eb7f21bc3ef13516351d479f7bef882)]:
  - generaltranslation@8.1.8

## 1.1.16

### Patch Changes

- Updated dependencies [[`eb07e8c`](https://github.com/generaltranslation/gt/commit/eb07e8ce1b610551437b40f96c72ac76d0af7b67)]:
  - generaltranslation@8.1.7

## 1.1.15

### Patch Changes

- Updated dependencies [[`feada39`](https://github.com/generaltranslation/gt/commit/feada3918ad78a1584f07245ac158c2d994a38da)]:
  - generaltranslation@8.1.6

## 1.1.14

### Patch Changes

- [#932](https://github.com/generaltranslation/gt/pull/932) [`dcdd751`](https://github.com/generaltranslation/gt/commit/dcdd7516edfe2e51ed633c79bc2045fb14fd938b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: compiler cli deps when installed at the same time caused an bug in npm with the esbuild version

## 1.1.13

### Patch Changes

- Updated dependencies [[`1e7e52f`](https://github.com/generaltranslation/gt/commit/1e7e52f3a77835887ff187ffeb99d6e3dc2a9e6c)]:
  - generaltranslation@8.1.5

## 1.1.12

### Patch Changes

- [#806](https://github.com/generaltranslation/gt/pull/806) [`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - feat: declareStatic()

- Updated dependencies [[`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f)]:
  - generaltranslation@8.1.4

## 1.1.11

### Patch Changes

- Updated dependencies [[`e113d8d`](https://github.com/generaltranslation/gt/commit/e113d8d8fb5e37f45a4aa77544e8f4666519bfe8)]:
  - generaltranslation@8.1.3

## 1.1.10

### Patch Changes

- Updated dependencies [[`3dc7b64`](https://github.com/generaltranslation/gt/commit/3dc7b6460cd05ddcb656a247602f4f50b06312fd)]:
  - generaltranslation@8.1.2

## 1.1.9

### Patch Changes

- [#859](https://github.com/generaltranslation/gt/pull/859) [`b585745`](https://github.com/generaltranslation/gt/commit/b585745b64e005a977b837cd1f59be6d61c681ab) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: max char compatibility

- Updated dependencies [[`37bac4c`](https://github.com/generaltranslation/gt/commit/37bac4ce11689a2f729efbcb2e052205447a7f71)]:
  - generaltranslation@8.1.1

## 1.1.8

### Patch Changes

- Updated dependencies [[`3e8ceb4`](https://github.com/generaltranslation/gt/commit/3e8ceb4526530d38eae469b05e8bf273d5ca05ac)]:
  - generaltranslation@8.1.0

## 1.1.7

### Patch Changes

- Updated dependencies [[`997a5df`](https://github.com/generaltranslation/gt/commit/997a5df6ac355b49a77e768935f9017af689de21)]:
  - generaltranslation@8.0.6

## 1.1.6

### Patch Changes

- Updated dependencies [[`30a04f9`](https://github.com/generaltranslation/gt/commit/30a04f955c64013daf2a32480fb33b3d4e08d678)]:
  - generaltranslation@8.0.5

## 1.1.5

### Patch Changes

- [#816](https://github.com/generaltranslation/gt/pull/816) [`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add gt-i18n, a pure js library for translation

- Updated dependencies [[`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605)]:
  - generaltranslation@8.0.4

## 1.1.4

### Patch Changes

- Updated dependencies [[`afbd29a`](https://github.com/generaltranslation/gt/commit/afbd29a34b051c76fce387269c4eb4a2e00a5831)]:
  - generaltranslation@8.0.3

## 1.1.3

### Patch Changes

- Updated dependencies [[`e7d25b0`](https://github.com/generaltranslation/gt/commit/e7d25b06a3e1d7ca404d64257570b88e7b0d1915)]:
  - generaltranslation@8.0.2

## 1.1.2

### Patch Changes

- [#803](https://github.com/generaltranslation/gt/pull/803) [`b0715ff`](https://github.com/generaltranslation/gt/commit/b0715ffd91c119c4546790f03f1cfcafcae00c3f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: repository field

## 1.1.1

### Patch Changes

- Updated dependencies [[`f98c504`](https://github.com/generaltranslation/gt/commit/f98c504f1e025024b3e1e5e16a0271e86ed095fa)]:
  - generaltranslation@8.0.1

## 1.1.0

### Minor Changes

- [#788](https://github.com/generaltranslation/gt/pull/788) [`99e4648`](https://github.com/generaltranslation/gt/commit/99e46486ae2046c689e0045372d63c4eb3dc5d48) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - More information: https://https://generaltranslation.com/en-US/blog/gt-next_v6_8_0

  feat: static component

### Patch Changes

- Updated dependencies [[`fee5d4a`](https://github.com/generaltranslation/gt/commit/fee5d4a3d0fd20e0928eebb83201a87289265719)]:
  - generaltranslation@8.0.0

## 1.0.9

### Patch Changes

- Updated dependencies [[`3da05a1`](https://github.com/generaltranslation/gt/commit/3da05a12a37a62ace3c7e321aa2fed5a4af52ad9)]:
  - generaltranslation@7.9.1

## 1.0.8

### Patch Changes

- Updated dependencies [[`93881f1`](https://github.com/generaltranslation/gt/commit/93881f159455a9bbc13d14e7fec9befa60998ba3)]:
  - generaltranslation@7.9.0

## 1.0.7

### Patch Changes

- Updated dependencies [[`7434c15`](https://github.com/generaltranslation/gt/commit/7434c1503c2a62bdb90d4058f903a56331276365)]:
  - generaltranslation@7.8.0

## 1.0.6

### Patch Changes

- Updated dependencies [[`7ba2e84`](https://github.com/generaltranslation/gt/commit/7ba2e8412b608aa3415f4865dc26adbbd3daa236)]:
  - generaltranslation@7.7.3

## 1.0.5

### Patch Changes

- Updated dependencies [[`20ec920`](https://github.com/generaltranslation/gt/commit/20ec920ecf3fb04e464f281400429c68f3c1a701)]:
  - generaltranslation@7.7.2

## 1.0.4

### Patch Changes

- Updated dependencies [[`7114780`](https://github.com/generaltranslation/gt/commit/71147803bf3e4cf21556ffb9b5f77756e283a32a)]:
  - generaltranslation@7.7.1

## 1.0.3

### Patch Changes

- Updated dependencies [[`5208937`](https://github.com/generaltranslation/gt/commit/520893719480b40774ccd749fe73727cf490f46c)]:
  - generaltranslation@7.7.0

## 1.0.2

### Patch Changes

- Updated dependencies [[`ed93e41`](https://github.com/generaltranslation/gt/commit/ed93e419e9547e6f2353d99f896702016f8ba751)]:
  - generaltranslation@7.6.5

## 1.0.1

### Patch Changes

- [#723](https://github.com/generaltranslation/gt/pull/723) [`3cb2e06`](https://github.com/generaltranslation/gt/commit/3cb2e06490820d6a27d2dc3e749044a81c48a07a) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: release

## 1.0.0

### Major Changes

- [#575](https://github.com/generaltranslation/gt/pull/575) [`fa9c8d6`](https://github.com/generaltranslation/gt/commit/fa9c8d695ca8d17d03c79dee524f47f25ea63728) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: babel compiler
