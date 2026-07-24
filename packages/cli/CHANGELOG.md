# gtx-cli

## 2.14.67

### Patch Changes

- [#1889](https://github.com/generaltranslation/gt/pull/1889) [`29cd6b8`](https://github.com/generaltranslation/gt/commit/29cd6b89f3587d3253cfadde6bec925d8697324b) Thanks [@bgub](https://github.com/bgub)! - Allow `awaitJobs()` to poll job IDs directly and reuse that shared polling implementation for CLI and Sanity project setup.

- [#1886](https://github.com/generaltranslation/gt/pull/1886) [`7cb2dfe`](https://github.com/generaltranslation/gt/commit/7cb2dfef077ee642f211996b0d729844a18258a8) Thanks [@bgub](https://github.com/bgub)! - Flatten the CLI workflow step lifecycle by folding completion behavior into each step's `run()` method and removing the unused shared step protocol.

- Updated dependencies [[`29cd6b8`](https://github.com/generaltranslation/gt/commit/29cd6b89f3587d3253cfadde6bec925d8697324b)]:
  - generaltranslation@9.0.5
  - @generaltranslation/python-extractor@0.2.32
  - @generaltranslation/supported-locales@2.1.12

## 2.14.66

### Patch Changes

- [#1929](https://github.com/generaltranslation/gt/pull/1929) [`f53bb5e`](https://github.com/generaltranslation/gt/commit/f53bb5ea4b4989a2a4ad3aebf464011f01e029ad) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Replace the FormatJS ICU parser and runtime formatter dependencies with the new dependency-free `@generaltranslation/icu` package.

- Updated dependencies [[`bbf4eb0`](https://github.com/generaltranslation/gt/commit/bbf4eb0cf77160baa615776619acd7afe35697ba), [`f53bb5e`](https://github.com/generaltranslation/gt/commit/f53bb5ea4b4989a2a4ad3aebf464011f01e029ad)]:
  - generaltranslation@9.0.4
  - @generaltranslation/icu@0.1.0
  - @generaltranslation/format@0.1.3
  - @generaltranslation/python-extractor@0.2.31
  - @generaltranslation/supported-locales@2.1.11

## 2.14.65

### Patch Changes

- [#1962](https://github.com/generaltranslation/gt/pull/1962) [`99f63e6`](https://github.com/generaltranslation/gt/commit/99f63e6826244cb07c18382031cce3fd8ca4ffc2) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Clear the locale search query after selecting a locale during setup.

## 2.14.64

### Patch Changes

- Updated dependencies [[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:
  - generaltranslation@9.0.3
  - @generaltranslation/python-extractor@0.2.30
  - @generaltranslation/supported-locales@2.1.10

## 2.14.63

### Patch Changes

- [#1867](https://github.com/generaltranslation/gt/pull/1867) [`a7aea57`](https://github.com/generaltranslation/gt/commit/a7aea57b1c6ecdc3edc0ace4cb21a859ac6ef508) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fix `<T $context="...">` and `<T $id="...">` string-literal props being dropped from hashing and registration. Context-carrying `<T>` components were registered under context-less hashes that the runtime never looks up, so their file translations always missed; `gt translate` now registers them under the same context-aware hashes the runtime and compiler compute.

- [#1890](https://github.com/generaltranslation/gt/pull/1890) [`6feb7b7`](https://github.com/generaltranslation/gt/commit/6feb7b79f0320d54d341f06b1482a9153e69d909) Thanks [@bgub](https://github.com/bgub)! - Inline single-use derive-expression adapters in the CLI string parser to reduce pass-through indirection.

- [#1882](https://github.com/generaltranslation/gt/pull/1882) [`288a47d`](https://github.com/generaltranslation/gt/commit/288a47dccfa7572b381bf76cc0bfc863436ae4a4) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Warn when GT React packages before version 11 may use incompatible ID-based translation keys, with an explicit suppression flag.

- Updated dependencies [[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584), [`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57), [`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:
  - generaltranslation@9.0.2
  - @generaltranslation/python-extractor@0.2.29
  - @generaltranslation/supported-locales@2.1.9

## 2.14.62

### Patch Changes

- Updated dependencies [[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:
  - generaltranslation@9.0.1
  - @generaltranslation/python-extractor@0.2.28
  - @generaltranslation/supported-locales@2.1.8

## 2.14.61

### Patch Changes

- [#1876](https://github.com/generaltranslation/gt/pull/1876) [`ae59375`](https://github.com/generaltranslation/gt/commit/ae593758047e32396e8eb7eeca9b38b86a20a909) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Make `upload` command overwrite content

## 2.14.60

### Patch Changes

- [#1873](https://github.com/generaltranslation/gt/pull/1873) [`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retrigger package publication after repairing release workspace dependency resolution.

- Updated dependencies [[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1)]:
  - @generaltranslation/python-extractor@0.2.27
  - @generaltranslation/supported-locales@2.1.7

## 2.14.59

### Patch Changes

- [#1866](https://github.com/generaltranslation/gt/pull/1866) [`53e61ab`](https://github.com/generaltranslation/gt/commit/53e61abbb4522631f252bcd268eae9c079dd9967) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Recover the stable releases skipped after the Odysseus version regression and publish the accumulated package changes under new npm versions.

- Updated dependencies [[`53e61ab`](https://github.com/generaltranslation/gt/commit/53e61abbb4522631f252bcd268eae9c079dd9967)]:
  - @generaltranslation/python-extractor@0.2.26
  - @generaltranslation/supported-locales@2.1.6

## 2.14.53

### Patch Changes

- [#1857](https://github.com/generaltranslation/gt/pull/1857) [`70813b2`](https://github.com/generaltranslation/gt/commit/70813b23e62ec1afbee54dd8fd41186b913242c4) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add `git setup`, merge drivers, and `omitConfigIds` flags

## 2.14.52

### Patch Changes

- [#1838](https://github.com/generaltranslation/gt/pull/1838) [`b4ef241`](https://github.com/generaltranslation/gt/commit/b4ef2412635f7bc64886b8babde475c6ea1c3503) Thanks [@bgub](https://github.com/bgub)! - Move `@babel/types` from `devDependencies` to `dependencies`. The CLI imports `@babel/types` at runtime across its parsing/JSX-injection code, but it was only declared as a dev dependency and left external in the published build. On strict/isolated installs (e.g. pnpm on Vercel) consumers hit `ERR_MODULE_NOT_FOUND: Cannot find package '@babel/types'` when running `gtx-cli translate`. It now sits alongside the other `@babel/*` runtime dependencies so it is installed for consumers.

- Updated dependencies [[`7db86bd`](https://github.com/generaltranslation/gt/commit/7db86bd92be5d09a2da10133dbb873248b0e5a5c)]:
  - @generaltranslation/supported-locales@2.1.3

## 2.14.51

### Patch Changes

- [#1818](https://github.com/generaltranslation/gt/pull/1818) [`b72c30b`](https://github.com/generaltranslation/gt/commit/b72c30bc603562310a51b656fb003f1486315a8a) Thanks [@bgub](https://github.com/bgub)! - Clean up the `generaltranslation` public API surface for the next major.

  Removes the unused `generaltranslation/core` subpath, stale endpoint types, duplicate `ApiError` accessors, and dead `/internal` exports. Moves `API_VERSION` to `generaltranslation/internal`, exports the derivation helpers from the public root, and points `gt-i18n` at that public entry.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`3d95277`](https://github.com/generaltranslation/gt/commit/3d95277a057b28fffc73b3fa616210bdcb447e85) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove unused internal exports and dead utility code.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`693288d`](https://github.com/generaltranslation/gt/commit/693288d632c42b923920a2fdd9ae2babc1bc28f5) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove internal source barrel exports and update imports to reference defining files directly.

- [#1822](https://github.com/generaltranslation/gt/pull/1822) [`ce8a665`](https://github.com/generaltranslation/gt/commit/ce8a665fd077ce2acb66c3f81db3bad5a781e9a7) Thanks [@bgub](https://github.com/bgub)! - Clean up the `gt-next` API surface for the next major prerelease.

  Removes the deprecated `initGT` config alias and the redundant `gt-next/types` subpath. Moves the hidden dictionary and loader subpaths under `gt-next/internal/*`, updates the Next config alias plumbing to match, and adjusts CLI setup detection so it no longer treats `initGT` as a valid existing config wrapper.

- Updated dependencies [[`b72c30b`](https://github.com/generaltranslation/gt/commit/b72c30bc603562310a51b656fb003f1486315a8a), [`72e9e16`](https://github.com/generaltranslation/gt/commit/72e9e1643797be8e4ae1453897fd0b023fce2674), [`5adeede`](https://github.com/generaltranslation/gt/commit/5adeede157922d547a33a078d0f527f572c9a8b4), [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546), [`88f3a2e`](https://github.com/generaltranslation/gt/commit/88f3a2e0f304fdd19891afac0b41954edc9497c6), [`e12fb17`](https://github.com/generaltranslation/gt/commit/e12fb17d41cfa5fa231e64fe70423434739ea985), [`5752fe8`](https://github.com/generaltranslation/gt/commit/5752fe81bf5b5deaae878638e0de99959bf719be), [`97dc7f4`](https://github.com/generaltranslation/gt/commit/97dc7f4818476a319a54b1519e994a62d5a9a3a5), [`693288d`](https://github.com/generaltranslation/gt/commit/693288d632c42b923920a2fdd9ae2babc1bc28f5), [`2e85ebd`](https://github.com/generaltranslation/gt/commit/2e85ebd1528a4f99a8e36e1d8d6714a639040596), [`d5cf2d3`](https://github.com/generaltranslation/gt/commit/d5cf2d34f412ad49e8b2818fe788b870a5964d65), [`4986567`](https://github.com/generaltranslation/gt/commit/498656728741898a56ae348a536107bd92f95c04), [`795edc8`](https://github.com/generaltranslation/gt/commit/795edc8a2b3e91fc9801d726f4b5cd6fbbc98fb0)]:
  - generaltranslation@9.0.0
  - @generaltranslation/format@0.1.2
  - @generaltranslation/python-extractor@0.2.23
  - @generaltranslation/supported-locales@2.1.2
  - gt-remark@1.0.11

## 2.14.51-odysseus.7

### Patch Changes

- b72c30b: Clean up the `generaltranslation` public API surface for the next major.

  Removes the unused `generaltranslation/core` subpath, stale endpoint types, duplicate `ApiError` accessors, and dead `/internal` exports. Moves `API_VERSION` to `generaltranslation/internal`, exports the derivation helpers from the public root, and points `gt-i18n` at that public entry.

- ce8a665: Clean up the `gt-next` API surface for the next major prerelease.

  Removes the deprecated `initGT` config alias and the redundant `gt-next/types` subpath. Moves the hidden dictionary and loader subpaths under `gt-next/internal/*`, updates the Next config alias plumbing to match, and adjusts CLI setup detection so it no longer treats `initGT` as a valid existing config wrapper.

- Updated dependencies [b72c30b]
- Updated dependencies [d5cf2d3]
  - generaltranslation@9.0.0-odysseus.6
  - @generaltranslation/python-extractor@0.2.23-odysseus.6
  - @generaltranslation/supported-locales@2.1.2-odysseus.6

## 2.14.51-odysseus.6

### Patch Changes

- Updated dependencies [72e9e16]
- Updated dependencies [5adeede]
- Updated dependencies [2e85ebd]
  - generaltranslation@9.0.0-odysseus.5
  - @generaltranslation/python-extractor@0.2.23-odysseus.5
  - @generaltranslation/supported-locales@2.1.2-odysseus.5

## 2.14.51-odysseus.5

### Patch Changes

- 4a5f8e8: Remove unused internal exports and dead utility code.

## 2.14.51-odysseus.4

### Patch Changes

- Updated dependencies [26faa87]
  - generaltranslation@9.0.0-odysseus.4
  - @generaltranslation/python-extractor@0.2.23-odysseus.4
  - @generaltranslation/supported-locales@2.1.2-odysseus.4

## 2.14.51-odysseus.3

### Patch Changes

- Updated dependencies [b1eef00]
  - generaltranslation@9.0.0-odysseus.3
  - @generaltranslation/python-extractor@0.2.23-odysseus.3
  - @generaltranslation/supported-locales@2.1.2-odysseus.3

## 2.14.51-odysseus.2

### Patch Changes

- Updated dependencies [[`4b97bc3`](https://github.com/generaltranslation/gt/commit/4b97bc360b2869bbb6e5f214589ef84f6d58a660), [`020c6bd`](https://github.com/generaltranslation/gt/commit/020c6bdd8c604bc07d80d75e8ea2ace1e70d7447)]:
  - @generaltranslation/format@0.1.2-odysseus.1
  - generaltranslation@9.0.0-odysseus.2
  - @generaltranslation/python-extractor@0.2.23-odysseus.2
  - @generaltranslation/supported-locales@2.1.2-odysseus.2

## 2.14.51-odysseus.1

### Patch Changes

- [#1677](https://github.com/generaltranslation/gt/pull/1677) [`87d6320`](https://github.com/generaltranslation/gt/commit/87d6320d271a1bf455f4e283dc1bb23893c7ba64) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove internal source barrel exports and update imports to reference defining files directly.

- Updated dependencies [[`87d6320`](https://github.com/generaltranslation/gt/commit/87d6320d271a1bf455f4e283dc1bb23893c7ba64)]:
  - generaltranslation@9.0.0-odysseus.1
  - @generaltranslation/python-extractor@0.2.23-odysseus.1
  - @generaltranslation/supported-locales@2.1.2-odysseus.1

## 2.14.51-odysseus.0

### Patch Changes

- [#1508](https://github.com/generaltranslation/gt/pull/1508) [`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- Updated dependencies [[`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575), [`620621a`](https://github.com/generaltranslation/gt/commit/620621aceeafedbb958884cacc5495736191b065), [`bd0d788`](https://github.com/generaltranslation/gt/commit/bd0d7883601a183a31b47b36ea4ea2dca69c62d0)]:
  - @generaltranslation/format@0.1.2-odysseus.0
  - @generaltranslation/python-extractor@0.2.23-odysseus.0
  - @generaltranslation/supported-locales@2.1.2-odysseus.0
  - generaltranslation@9.0.0-odysseus.0
  - gt-remark@1.0.11-odysseus.0

## 2.14.56

### Patch Changes

- [#1724](https://github.com/generaltranslation/gt/pull/1724) [`dd0d1cd`](https://github.com/generaltranslation/gt/commit/dd0d1cd0276cd0a158fc3dd73a312502066782a7) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Fix translation file path in `gt-lock.json`

## 2.14.55

### Patch Changes

- Updated dependencies [[`a2a3dd0`](https://github.com/generaltranslation/gt/commit/a2a3dd0bcdce9abe360c406a12fc6bb3bc3ca181)]:
  - @generaltranslation/supported-locales@2.1.4

## 2.14.54

### Patch Changes

- [#1648](https://github.com/generaltranslation/gt/pull/1648) [`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8) Thanks [@brian-lou](https://github.com/brian-lou)! - Use `gt-project-id` instead of `x-gt-project-id` for API request headers. Update the API key header to use standard `Authorization: Bearer <api-key>` prefix.

- Updated dependencies [[`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8)]:
  - generaltranslation@8.2.18
  - @generaltranslation/python-extractor@0.2.24
  - @generaltranslation/supported-locales@2.1.3

## 2.14.53

### Patch Changes

- [#1642](https://github.com/generaltranslation/gt/pull/1642) [`28b1b59`](https://github.com/generaltranslation/gt/commit/28b1b59d13422ef665490a5500cacaabaa00541d) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Skip enqueue for already translated files

## 2.14.52

### Patch Changes

- Updated dependencies [[`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01)]:
  - generaltranslation@8.2.17
  - @generaltranslation/python-extractor@0.2.23
  - @generaltranslation/supported-locales@2.1.2

## 2.14.51

### Patch Changes

- [#1605](https://github.com/generaltranslation/gt/pull/1605) [`69172dc`](https://github.com/generaltranslation/gt/commit/69172dc72e3fe22b6072b4c60e26c3de2cd68494) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Aggregate files on `upload` command. Ensures consistency with `stage` and `translate`

## 2.14.50

### Patch Changes

- [#1586](https://github.com/generaltranslation/gt/pull/1586) [`81d0d09`](https://github.com/generaltranslation/gt/commit/81d0d09db3f0d9d8a2ce7fc45f76bf5dd34fa34a) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Refetch composite content

## 2.14.49

### Patch Changes

- Updated dependencies [[`a41729b`](https://github.com/generaltranslation/gt/commit/a41729b0f6f42ec3bccd6d99299b35eebfb0cc6e)]:
  - gt-remark@1.0.10

## 2.14.48

### Patch Changes

- [#1582](https://github.com/generaltranslation/gt/pull/1582) [`1e5e748`](https://github.com/generaltranslation/gt/commit/1e5e748b1aef33eb58f536496592a6258fc441e5) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Handle Mintlify `$ref` siblings, add omit to composite JSONs

## 2.14.47

### Patch Changes

- Updated dependencies [[`34aae81`](https://github.com/generaltranslation/gt/commit/34aae8107d69e6cc1a54cde5d7645ebcd8e14d21)]:
  - gt-remark@1.0.9

## 2.14.46

### Patch Changes

- [#1534](https://github.com/generaltranslation/gt/pull/1534) [`e64b96d`](https://github.com/generaltranslation/gt/commit/e64b96db770c0049551277b2d4ed1034ad977ce5) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Hash cooked static template literal values during CLI extraction.

## 2.14.45

### Patch Changes

- Updated dependencies [[`1245397`](https://github.com/generaltranslation/gt/commit/12453971eac9dbdea5abac0d2ad67d56e5f1580a)]:
  - gt-remark@1.0.8

## 2.14.44

### Patch Changes

- [#1523](https://github.com/generaltranslation/gt/pull/1523) [`bda984e`](https://github.com/generaltranslation/gt/commit/bda984e3351520e49314d1b3601a362ea9eb7396) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Update Mintlify `$ref` handling

## 2.14.43

### Patch Changes

- [#1502](https://github.com/generaltranslation/gt/pull/1502) [`0c5cb81`](https://github.com/generaltranslation/gt/commit/0c5cb817468acf1b140ec5371aa003c739584579) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove default target locales from the setup prompt.

## 2.14.42

### Patch Changes

- [#1491](https://github.com/generaltranslation/gt/pull/1491) [`205c246`](https://github.com/generaltranslation/gt/commit/205c24647b9f50a68358ee6c3332d110a77ce1b3) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Handle derived children with whitespace

## 2.14.41

### Patch Changes

- Updated dependencies [[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:
  - generaltranslation@8.2.16
  - @generaltranslation/python-extractor@0.2.22
  - @generaltranslation/supported-locales@2.1.1

## 2.14.40

### Patch Changes

- [#1456](https://github.com/generaltranslation/gt/pull/1456) [`8094012`](https://github.com/generaltranslation/gt/commit/8094012f9827f3a35e053776946bea67492da9db) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Handling slash in Mint `url` fields

## 2.14.39

### Patch Changes

- [#1455](https://github.com/generaltranslation/gt/pull/1455) [`cd8fa50`](https://github.com/generaltranslation/gt/commit/cd8fa505c90624160d6ef4d044946b3bf230f646) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Handle Mintlify `docs.json` `directory` field

- [#1448](https://github.com/generaltranslation/gt/pull/1448) [`f19bade`](https://github.com/generaltranslation/gt/commit/f19bade4741e934505e75880218599d27873e864) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fix CLI binary release builds by resolving Ink's devtools peer dependency and failing binary build scripts on compile errors.

## 2.14.38

### Patch Changes

- Updated dependencies [[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)]:
  - @generaltranslation/supported-locales@2.1.0

## 2.14.58

### Patch Changes

- [#1786](https://github.com/generaltranslation/gt/pull/1786) [`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add `requiresReview`

- Updated dependencies [[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:
  - generaltranslation@8.2.19
  - @generaltranslation/python-extractor@0.2.25
  - @generaltranslation/supported-locales@2.1.5

## 2.14.57

## 2.14.56

### Patch Changes

- [#1724](https://github.com/generaltranslation/gt/pull/1724) [`dd0d1cd`](https://github.com/generaltranslation/gt/commit/dd0d1cd0276cd0a158fc3dd73a312502066782a7) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Fix translation file path in `gt-lock.json`

## 2.14.55

### Patch Changes

- Updated dependencies [[`a2a3dd0`](https://github.com/generaltranslation/gt/commit/a2a3dd0bcdce9abe360c406a12fc6bb3bc3ca181)]:
  - @generaltranslation/supported-locales@2.1.4

## 2.14.54

### Patch Changes

- [#1648](https://github.com/generaltranslation/gt/pull/1648) [`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8) Thanks [@brian-lou](https://github.com/brian-lou)! - Use `gt-project-id` instead of `x-gt-project-id` for API request headers. Update the API key header to use standard `Authorization: Bearer <api-key>` prefix.

- Updated dependencies [[`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8)]:
  - generaltranslation@8.2.18
  - @generaltranslation/python-extractor@0.2.24
  - @generaltranslation/supported-locales@2.1.3

## 2.14.53

### Patch Changes

- [#1642](https://github.com/generaltranslation/gt/pull/1642) [`28b1b59`](https://github.com/generaltranslation/gt/commit/28b1b59d13422ef665490a5500cacaabaa00541d) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Skip enqueue for already translated files

## 2.14.52

### Patch Changes

- Updated dependencies [[`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01)]:
  - generaltranslation@8.2.17
  - @generaltranslation/python-extractor@0.2.23
  - @generaltranslation/supported-locales@2.1.2

## 2.14.51

### Patch Changes

- [#1605](https://github.com/generaltranslation/gt/pull/1605) [`69172dc`](https://github.com/generaltranslation/gt/commit/69172dc72e3fe22b6072b4c60e26c3de2cd68494) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Aggregate files on `upload` command. Ensures consistency with `stage` and `translate`

## 2.14.50

### Patch Changes

- [#1586](https://github.com/generaltranslation/gt/pull/1586) [`81d0d09`](https://github.com/generaltranslation/gt/commit/81d0d09db3f0d9d8a2ce7fc45f76bf5dd34fa34a) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Refetch composite content

## 2.14.49

### Patch Changes

- Updated dependencies [[`a41729b`](https://github.com/generaltranslation/gt/commit/a41729b0f6f42ec3bccd6d99299b35eebfb0cc6e)]:
  - gt-remark@1.0.10

## 2.14.48

### Patch Changes

- [#1582](https://github.com/generaltranslation/gt/pull/1582) [`1e5e748`](https://github.com/generaltranslation/gt/commit/1e5e748b1aef33eb58f536496592a6258fc441e5) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Handle Mintlify `$ref` siblings, add omit to composite JSONs

## 2.14.47

### Patch Changes

- Updated dependencies [[`34aae81`](https://github.com/generaltranslation/gt/commit/34aae8107d69e6cc1a54cde5d7645ebcd8e14d21)]:
  - gt-remark@1.0.9

## 2.14.46

### Patch Changes

- [#1534](https://github.com/generaltranslation/gt/pull/1534) [`e64b96d`](https://github.com/generaltranslation/gt/commit/e64b96db770c0049551277b2d4ed1034ad977ce5) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Hash cooked static template literal values during CLI extraction.

## 2.14.45

### Patch Changes

- Updated dependencies [[`1245397`](https://github.com/generaltranslation/gt/commit/12453971eac9dbdea5abac0d2ad67d56e5f1580a)]:
  - gt-remark@1.0.8

## 2.14.44

### Patch Changes

- [#1523](https://github.com/generaltranslation/gt/pull/1523) [`bda984e`](https://github.com/generaltranslation/gt/commit/bda984e3351520e49314d1b3601a362ea9eb7396) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Update Mintlify `$ref` handling

## 2.14.43

### Patch Changes

- [#1502](https://github.com/generaltranslation/gt/pull/1502) [`0c5cb81`](https://github.com/generaltranslation/gt/commit/0c5cb817468acf1b140ec5371aa003c739584579) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove default target locales from the setup prompt.

## 2.14.42

### Patch Changes

- [#1491](https://github.com/generaltranslation/gt/pull/1491) [`205c246`](https://github.com/generaltranslation/gt/commit/205c24647b9f50a68358ee6c3332d110a77ce1b3) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Handle derived children with whitespace

## 2.14.41

### Patch Changes

- Updated dependencies [[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:
  - generaltranslation@8.2.16
  - @generaltranslation/python-extractor@0.2.22
  - @generaltranslation/supported-locales@2.1.1

## 2.14.40

### Patch Changes

- [#1456](https://github.com/generaltranslation/gt/pull/1456) [`8094012`](https://github.com/generaltranslation/gt/commit/8094012f9827f3a35e053776946bea67492da9db) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Handling slash in Mint `url` fields

## 2.14.39

### Patch Changes

- [#1455](https://github.com/generaltranslation/gt/pull/1455) [`cd8fa50`](https://github.com/generaltranslation/gt/commit/cd8fa505c90624160d6ef4d044946b3bf230f646) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Handle Mintlify `docs.json` `directory` field

- [#1448](https://github.com/generaltranslation/gt/pull/1448) [`f19bade`](https://github.com/generaltranslation/gt/commit/f19bade4741e934505e75880218599d27873e864) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fix CLI binary release builds by resolving Ink's devtools peer dependency and failing binary build scripts on compile errors.

## 2.14.38

### Patch Changes

- Updated dependencies [[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)]:
  - @generaltranslation/supported-locales@2.1.0

## 2.14.37

### Patch Changes

- [#1425](https://github.com/generaltranslation/gt/pull/1425) [`a5e6975`](https://github.com/generaltranslation/gt/commit/a5e697561776466763ee1d6cae1f4b905eed581d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Resolve TypeScript path aliases that point to directory index barrel files during CLI extraction.

## 2.14.36

### Patch Changes

- [#1363](https://github.com/generaltranslation/gt/pull/1363) [`6a0e55b`](https://github.com/generaltranslation/gt/commit/6a0e55b6787b8e05f6c1fef7796e1b8b68f6d87b) Thanks [@bgub](https://github.com/bgub)! - Add an Ink-powered full-screen setup wizard for interactive CLI prompts.

- [#1419](https://github.com/generaltranslation/gt/pull/1419) [`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300) Thanks [@bgub](https://github.com/bgub)! - Improve diagnostic messages and package-local diagnostic formatting.

- [#1423](https://github.com/generaltranslation/gt/pull/1423) [`347cb48`](https://github.com/generaltranslation/gt/commit/347cb4844bba2007c7942f3f0e6a2ede4a1aa73e) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Suppress unnecessary project detection warnings for file-only translations.

- Updated dependencies [[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa), [`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:
  - @generaltranslation/format@0.1.1
  - generaltranslation@8.2.15
  - @generaltranslation/python-extractor@0.2.21
  - @generaltranslation/supported-locales@2.0.73

## 2.14.35

### Patch Changes

- [#1408](https://github.com/generaltranslation/gt/pull/1408) [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6) Thanks [@bgub](https://github.com/bgub)! - Use @generaltranslation/format directly for shared formatting and locale helpers.

- Updated dependencies [[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99), [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)]:
  - @generaltranslation/format@0.1.0
  - generaltranslation@8.2.14
  - @generaltranslation/python-extractor@0.2.20

## 2.14.34

### Patch Changes

- [#1385](https://github.com/generaltranslation/gt/pull/1385) [`bcb2b91`](https://github.com/generaltranslation/gt/commit/bcb2b91581d1edb134a451f9713c3a899e32282a) Thanks [@bgub](https://github.com/bgub)! - Warn when duplicate source update IDs include hashless entries.

- [#1379](https://github.com/generaltranslation/gt/pull/1379) [`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7) Thanks [@bgub](https://github.com/bgub)! - Tighten public and API metadata types, and handle metadata entries without hashes in the CLI.

- Updated dependencies [[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7), [`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:
  - generaltranslation@8.2.13
  - @generaltranslation/python-extractor@0.2.19

## 2.14.33

### Patch Changes

- Updated dependencies [[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)]:
  - generaltranslation@8.2.12
  - @generaltranslation/python-extractor@0.2.18

## 2.14.32

### Patch Changes

- [#1338](https://github.com/generaltranslation/gt/pull/1338) [`66b5df5`](https://github.com/generaltranslation/gt/commit/66b5df57a69d224345ad0a6191437ba8aca3a19d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Generate explicit relative import paths in `loadTranslations.js` for local
  translation files.

- [#1314](https://github.com/generaltranslation/gt/pull/1314) [`a13629f`](https://github.com/generaltranslation/gt/commit/a13629f2c5e5a2fcc22c34704507bcc591174825) Thanks [@bgub](https://github.com/bgub)! - Show a warning download status when completed files are missing from the download response.

## 2.14.31

### Patch Changes

- Updated dependencies [[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:
  - generaltranslation@8.2.11
  - @generaltranslation/python-extractor@0.2.17

## 2.14.30

### Patch Changes

- [#1304](https://github.com/generaltranslation/gt/pull/1304) [`c15ecf5`](https://github.com/generaltranslation/gt/commit/c15ecf581821a2feac72f53c5470b5b9b163564a) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Sort JSON keys when outputting translation files for deterministic output

## 2.14.29

### Patch Changes

- Updated dependencies [[`a6c4adb`](https://github.com/generaltranslation/gt/commit/a6c4adbc46f3297bad11bf9f9d2eba7ba545c90a)]:
  - @generaltranslation/python-extractor@0.2.16

## 2.14.28

### Patch Changes

- [#1295](https://github.com/generaltranslation/gt/pull/1295) [`17cf156`](https://github.com/generaltranslation/gt/commit/17cf156403de524a665903c9d45262acf4dbe657) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Pass metadata to for tagged templates

## 2.14.27

### Patch Changes

- [#1285](https://github.com/generaltranslation/gt/pull/1285) [`0404f04`](https://github.com/generaltranslation/gt/commit/0404f04be055275048ab3db03013cecb0d3d9153) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: silent error on download file failure

- [#1277](https://github.com/generaltranslation/gt/pull/1277) [`5eae67c`](https://github.com/generaltranslation/gt/commit/5eae67c47b14edf65f7a8911559aa154db19f437) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Improve transformationFormat error message and normalize casing so lowercase values like "po" work in gt.config.json.

- Updated dependencies [[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:
  - generaltranslation@8.2.10
  - @generaltranslation/python-extractor@0.2.15

## 2.14.26

### Patch Changes

- [#1290](https://github.com/generaltranslation/gt/pull/1290) [`7172355`](https://github.com/generaltranslation/gt/commit/71723554db498946450606442c2a42c23caf8abb) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: fix release

## 2.14.25

### Patch Changes

- Updated dependencies [[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:
  - generaltranslation@8.2.9
  - @generaltranslation/python-extractor@0.2.14

## 2.14.24

### Patch Changes

- [#1287](https://github.com/generaltranslation/gt/pull/1287) [`37f9e7e`](https://github.com/generaltranslation/gt/commit/37f9e7eb2d78df4008c9b64d782f6ebe53f5ef5d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: release versioning

## 2.14.23

### Patch Changes

- [#1282](https://github.com/generaltranslation/gt/pull/1282) [`756f963`](https://github.com/generaltranslation/gt/commit/756f963c370243ecca09cda4824d666d58c04b1c) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add PyPI distribution support for the GT CLI.

## 2.14.22

### Patch Changes

- [#1248](https://github.com/generaltranslation/gt/pull/1248) [`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add PO/POT file format support and transformFormat plumbing for API uploads and CLI file downloads.

- Updated dependencies [[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:
  - generaltranslation@8.2.8
  - @generaltranslation/python-extractor@0.2.13

## 2.14.21

### Patch Changes

- [#1261](https://github.com/generaltranslation/gt/pull/1261) [`a2c5c2e`](https://github.com/generaltranslation/gt/commit/a2c5c2e8c748c9d3d81dc3c99800ea17e2f2c9b9) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix(cli): enforcement of gt-react-native and gt-react sync

## 2.14.20

### Patch Changes

- Updated dependencies [[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5), [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)]:
  - generaltranslation@8.2.7
  - @generaltranslation/python-extractor@0.2.12

## 2.14.19

### Patch Changes

- [#1244](https://github.com/generaltranslation/gt/pull/1244) [`c4c8b9c`](https://github.com/generaltranslation/gt/commit/c4c8b9c0429ce10d98ebdfaabc1213bd85a572bf) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Updating Mintlify $ref handling

- Updated dependencies [[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:
  - generaltranslation@8.2.6
  - @generaltranslation/python-extractor@0.2.11

## 2.14.18

### Patch Changes

- [#1243](https://github.com/generaltranslation/gt/pull/1243) [`a0e19f6`](https://github.com/generaltranslation/gt/commit/a0e19f64a17d1a439d2352a6bc3ca7390c4ed401) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Handling Mintlify $ref

## 2.14.17

### Patch Changes

- [#1220](https://github.com/generaltranslation/gt/pull/1220) [`d5bfe1d`](https://github.com/generaltranslation/gt/commit/d5bfe1d0768006eda5842a548651c6be73d69a55) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: cross file resolution failure on relative imports

## 2.14.16

### Patch Changes

- Updated dependencies [[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:
  - generaltranslation@8.2.5
  - @generaltranslation/python-extractor@0.2.10

## 2.14.15

### Patch Changes

- [#1213](https://github.com/generaltranslation/gt/pull/1213) [`38e21c1`](https://github.com/generaltranslation/gt/commit/38e21c10bcbd2c5b767793b9659583cf6d03c867) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix inline content extraction for gt-tanstack-start projects. The CLI now correctly detects gt-tanstack-start in package.json, routes it to ReactCLI, and scans imports from gt-tanstack-start for translatable content like `<T>` components.

## 2.14.14

### Patch Changes

- Updated dependencies [[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:
  - generaltranslation@8.2.4
  - @generaltranslation/python-extractor@0.2.9

## 2.14.13

### Patch Changes

- [#1207](https://github.com/generaltranslation/gt/pull/1207) [`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: runtime translation

- Updated dependencies [[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:
  - generaltranslation@8.2.3
  - @generaltranslation/python-extractor@0.2.8

## 2.14.12

### Patch Changes

- [#1205](https://github.com/generaltranslation/gt/pull/1205) [`aea881c`](https://github.com/generaltranslation/gt/commit/aea881c7009eea528338872da9afe175484cec8d) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Hash postprocessed source content

## 2.14.11

### Patch Changes

- [#1196](https://github.com/generaltranslation/gt/pull/1196) [`cf8bee6`](https://github.com/generaltranslation/gt/commit/cf8bee67159eeafccf22ac06861905b0a672f64a) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix CLI silently creating `gt.config.json` when running commands like `gt stage` in directories without a config file. Commands that require a config now exit with a clear error message pointing users to `gt init`. Config creation is only handled by the init/setup wizard.

- [#1199](https://github.com/generaltranslation/gt/pull/1199) [`1828cd4`](https://github.com/generaltranslation/gt/commit/1828cd4eafb1f3ea868b437b914c844670d2c50f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: enable autoderive for jsx

- [#1201](https://github.com/generaltranslation/gt/pull/1201) [`fbb9d26`](https://github.com/generaltranslation/gt/commit/fbb9d268dbee58142e305b9076e44000205d5437) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: customize autoderive

## 2.14.10

### Patch Changes

- [#1195](https://github.com/generaltranslation/gt/pull/1195) [`2090de3`](https://github.com/generaltranslation/gt/commit/2090de3613b9684fd43adc3b83f677bc33c1d9a6) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: standardize naming convention for "autoderive"

## 2.14.9

### Patch Changes

- [#1191](https://github.com/generaltranslation/gt/pull/1191) [`0c24b75`](https://github.com/generaltranslation/gt/commit/0c24b7563005a967a2b8916fabf60ee203466087) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: Derive JSX tracing behavior for variable declarations

## 2.14.8

### Patch Changes

- [#1187](https://github.com/generaltranslation/gt/pull/1187) [`9281fe5`](https://github.com/generaltranslation/gt/commit/9281fe5d9c2f3e35b67ccedb9c444aebbb6a8bd1) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix(cli): extend autoderive gt msg

- [#1185](https://github.com/generaltranslation/gt/pull/1185) [`121be24`](https://github.com/generaltranslation/gt/commit/121be24def7f9dc464b8589bf0be14d04ac3e6e1) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: exploration of properties for Branch and Plural during multiplication step

- [#1186](https://github.com/generaltranslation/gt/pull/1186) [`7a3c7de`](https://github.com/generaltranslation/gt/commit/7a3c7de8e5d5103bd9fec893a677a13068f822e6) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Warn when Mintlify docs.json contains unsupported $ref fields

## 2.14.7

## 2.14.6

### Patch Changes

- [#1173](https://github.com/generaltranslation/gt/pull/1173) [`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context derivation

- Updated dependencies [[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)]:
  - @generaltranslation/python-extractor@0.2.7

## 2.14.5

### Patch Changes

- [#1174](https://github.com/generaltranslation/gt/pull/1174) [`4730814`](https://github.com/generaltranslation/gt/commit/4730814799ba5487b45477094c6ca581ac56c3ff) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: recursive string translation function resolution

## 2.14.4

### Patch Changes

- [#1158](https://github.com/generaltranslation/gt/pull/1158) [`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto injection for jsx translation

- Updated dependencies [[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:
  - generaltranslation@8.2.2
  - @generaltranslation/python-extractor@0.2.6

## 2.14.3

### Patch Changes

- [#1168](https://github.com/generaltranslation/gt/pull/1168) [`55d7ccd`](https://github.com/generaltranslation/gt/commit/55d7ccd82683992f8d9a0cfa9d380dd95b24b85e) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Record re-merged files for postprocessing

## 2.14.2

### Patch Changes

- [#1161](https://github.com/generaltranslation/gt/pull/1161) [`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update logo blocks in READMEs

- Updated dependencies [[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:
  - gt-remark@1.0.7
  - generaltranslation@8.2.1
  - @generaltranslation/python-extractor@0.2.5

## 2.14.1

### Patch Changes

- [#1162](https://github.com/generaltranslation/gt/pull/1162) [`faa90dc`](https://github.com/generaltranslation/gt/commit/faa90dca8f855712f0f99cd9c9644fb2cf69524f) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Make `git` tagging command default behavior

## 2.14.0

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

- [#1160](https://github.com/generaltranslation/gt/pull/1160) [`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding translation tagging

- Updated dependencies [[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290), [`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:
  - generaltranslation@8.2.0
  - @generaltranslation/python-extractor@0.2.4

## 2.13.3

### Patch Changes

- [#1156](https://github.com/generaltranslation/gt/pull/1156) [`0606939`](https://github.com/generaltranslation/gt/commit/0606939da3b78c7423688fd8ee5cbb6af035c193) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add branch ID to lockfile during staging

## 2.13.2

### Patch Changes

- [#1147](https://github.com/generaltranslation/gt/pull/1147) [`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add support for multiple format types

- Updated dependencies [[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:
  - generaltranslation@8.1.23
  - @generaltranslation/python-extractor@0.2.3

## 2.13.1

### Patch Changes

- [#1145](https://github.com/generaltranslation/gt/pull/1145) [`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: add string datatype formatting

- Updated dependencies [[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:
  - generaltranslation@8.1.22
  - @generaltranslation/python-extractor@0.2.2

## 2.13.0

### Minor Changes

- [#1141](https://github.com/generaltranslation/gt/pull/1141) [`4820643`](https://github.com/generaltranslation/gt/commit/4820643665d5aecacc34c52707c0c81bf4da18ca) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: auto derive for the t() function

## 2.12.1

### Patch Changes

- [#1140](https://github.com/generaltranslation/gt/pull/1140) [`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding staged status to `gt-lock.json`, adding `useLatestAvailableVersion` flag to core download

- Updated dependencies [[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e), [`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:
  - generaltranslation@8.1.21
  - @generaltranslation/python-extractor@0.2.1

## 2.12.0

### Minor Changes

- [#1137](https://github.com/generaltranslation/gt/pull/1137) [`f8993aa`](https://github.com/generaltranslation/gt/commit/f8993aabe07acdfaf8a97177f038c408a8fc4c45) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: object derivation

### Patch Changes

- Updated dependencies [[`f8993aa`](https://github.com/generaltranslation/gt/commit/f8993aabe07acdfaf8a97177f038c408a8fc4c45)]:
  - @generaltranslation/python-extractor@0.2.0

## 2.11.3

### Patch Changes

- [#1133](https://github.com/generaltranslation/gt/pull/1133) [`4de22d7`](https://github.com/generaltranslation/gt/commit/4de22d7548b5d34c0d7e465132878d192c2f41e0) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Extending publish step to save-local and upload commands

## 2.11.2

### Patch Changes

- [#1125](https://github.com/generaltranslation/gt/pull/1125) [`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo URLs in README files (updated to `/brand/gt-logo-*.svg`)

- [#1132](https://github.com/generaltranslation/gt/pull/1132) [`a83a130`](https://github.com/generaltranslation/gt/commit/a83a130944193ec4b9784fb7687808936e175d19) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Make CDN unpublish behavior opt-in

- Updated dependencies [[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:
  - generaltranslation@8.1.20
  - gt-remark@1.0.6
  - @generaltranslation/python-extractor@0.1.6

## 2.11.1

### Patch Changes

- [#1129](https://github.com/generaltranslation/gt/pull/1129) [`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: derivation support for the t macro

- Updated dependencies [[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281), [`84c1443`](https://github.com/generaltranslation/gt/commit/84c1443bda85ccbd8d8dbf56ede341de974db522)]:
  - @generaltranslation/python-extractor@0.1.5
  - generaltranslation@8.1.19

## 2.11.0

### Minor Changes

- [#1122](https://github.com/generaltranslation/gt/pull/1122) [`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding CDN publishing for all file types

### Patch Changes

- Updated dependencies [[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:
  - generaltranslation@8.1.18
  - @generaltranslation/python-extractor@0.1.4

## 2.10.8

### Patch Changes

- [#1123](https://github.com/generaltranslation/gt/pull/1123) [`3f6242c`](https://github.com/generaltranslation/gt/commit/3f6242cd5775ff894fecffe4c8279059eebf008a) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Move includeSourceCodeContext flag into files.gt

## 2.10.7

### Patch Changes

- [#1118](https://github.com/generaltranslation/gt/pull/1118) [`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add t macro

## 2.10.6

### Patch Changes

- [#1062](https://github.com/generaltranslation/gt/pull/1062) [`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: rename static to derive, and deprecate static

- Updated dependencies [[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:
  - generaltranslation@8.1.17
  - @generaltranslation/python-extractor@0.1.3

## 2.10.5

### Patch Changes

- [#1116](https://github.com/generaltranslation/gt/pull/1116) [`31d7229`](https://github.com/generaltranslation/gt/commit/31d7229e3893b712e2007369e8b3d219bcc9bde8) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding v2 of `gt-lock.json`

## 2.10.4

### Patch Changes

- [#1113](https://github.com/generaltranslation/gt/pull/1113) [`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add string translation function t()

## 2.10.3

### Patch Changes

- [#1110](https://github.com/generaltranslation/gt/pull/1110) [`38ecda0`](https://github.com/generaltranslation/gt/commit/38ecda003b6873464e350aff0463a8dc64030565) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding monorepo GT package version check, remove writing to agent files

## 2.10.2

### Patch Changes

- [#1108](https://github.com/generaltranslation/gt/pull/1108) [`2dff603`](https://github.com/generaltranslation/gt/commit/2dff6036382040438a3fa8bbd4c2475da7617f93) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix string behavior

## 2.10.1

### Patch Changes

- [#1105](https://github.com/generaltranslation/gt/pull/1105) [`952a515`](https://github.com/generaltranslation/gt/commit/952a51528c298ad2466ca6cb73302eae06f56c45) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix --force behavior

## 2.10.0

### Minor Changes

- [#1104](https://github.com/generaltranslation/gt/pull/1104) [`51430bd`](https://github.com/generaltranslation/gt/commit/51430bd1d85a4937ff3b4dcd0090d79e3b4c1504) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding metadata support for keyed file types

### Patch Changes

- [#1101](https://github.com/generaltranslation/gt/pull/1101) [`437a389`](https://github.com/generaltranslation/gt/commit/437a3898f1daa0a40ac033c2cc1bb94b4a0fd86b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: remove tw content json from init

- [#1103](https://github.com/generaltranslation/gt/pull/1103) [`7164ceb`](https://github.com/generaltranslation/gt/commit/7164ceb9785863cdf4dc659fe5bd0f87511a5bed) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Extract code metadata

## 2.9.0

### Minor Changes

- [#1099](https://github.com/generaltranslation/gt/pull/1099) [`e364093`](https://github.com/generaltranslation/gt/commit/e3640931cf0ca2df08dcadbae30b1668e14a3ed8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add twilio json support for cli

### Patch Changes

- Updated dependencies [[`e364093`](https://github.com/generaltranslation/gt/commit/e3640931cf0ca2df08dcadbae30b1668e14a3ed8)]:
  - generaltranslation@8.1.16
  - @generaltranslation/python-extractor@0.1.2

## 2.8.2

### Patch Changes

- [#1098](https://github.com/generaltranslation/gt/pull/1098) [`612ace4`](https://github.com/generaltranslation/gt/commit/612ace4bb30aaa3406b949931c8ffdb3f43ebd9f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: upload supporting composite json

- Updated dependencies [[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:
  - generaltranslation@8.1.15
  - @generaltranslation/python-extractor@0.1.1

## 2.8.1

### Patch Changes

- [#1093](https://github.com/generaltranslation/gt/pull/1093) [`69a13a5`](https://github.com/generaltranslation/gt/commit/69a13a5791254ebb4a2679321d24fecebb1fef11) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: support for temporary structural transforms

## 2.8.0

### Minor Changes

- [#1088](https://github.com/generaltranslation/gt/pull/1088) [`2cad388`](https://github.com/generaltranslation/gt/commit/2cad38875e4dccdd7d90de3eba6997eb75371db3) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add python support for registration

### Patch Changes

- Updated dependencies [[`2cad388`](https://github.com/generaltranslation/gt/commit/2cad38875e4dccdd7d90de3eba6997eb75371db3)]:
  - @generaltranslation/python-extractor@0.1.0

## 2.7.1

### Patch Changes

- [#1085](https://github.com/generaltranslation/gt/pull/1085) [`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76) Thanks [@brian-lou](https://github.com/brian-lou)! - feat: Auth wizard supports both types of key creation

- [#1082](https://github.com/generaltranslation/gt/pull/1082) [`3cb3bbd`](https://github.com/generaltranslation/gt/commit/3cb3bbd13046e6c1f6f9d4b5286669b96b4a85b2) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Bumping CLI timeouts

- [#1076](https://github.com/generaltranslation/gt/pull/1076) [`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Apply style guide to error messages and warnings: remove "Please", simplify verbose phrasing, fix `in-line` → `inline`.

- Updated dependencies [[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)]:
  - generaltranslation@8.1.14

## 2.7.0

### Minor Changes

- [#1069](https://github.com/generaltranslation/gt/pull/1069) [`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new gt package

## 2.6.31

### Patch Changes

- [#1070](https://github.com/generaltranslation/gt/pull/1070) [`516979d`](https://github.com/generaltranslation/gt/commit/516979d36cd16c4bc9080ea7dc06b7e299200919) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Handle case where all jobs fail

## 2.6.30

### Patch Changes

- [#1068](https://github.com/generaltranslation/gt/pull/1068) [`94b95ef`](https://github.com/generaltranslation/gt/commit/94b95ef662b81dac51416ecc64f3318339171f0b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: runtime calculation for the injection of 'data-' attribute in jsx

- [#1066](https://github.com/generaltranslation/gt/pull/1066) [`7b4837f`](https://github.com/generaltranslation/gt/commit/7b4837fe44e387c4de812d9b3f7fc394cb24e49e) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Wrapping text node URLs for Mintlify MDX to align with their parser

## 2.6.29

### Patch Changes

- Updated dependencies [[`21b3304`](https://github.com/generaltranslation/gt/commit/21b33040774f9638fdf7edcfcf7170246a36fbec)]:
  - generaltranslation@8.1.13

## 2.6.28

### Patch Changes

- [#1063](https://github.com/generaltranslation/gt/pull/1063) [`e7b1bb0`](https://github.com/generaltranslation/gt/commit/e7b1bb079145809d66296c0ad6628079f784b88e) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding CJK parser to gt-remark, bumping CLI

- Updated dependencies [[`e7b1bb0`](https://github.com/generaltranslation/gt/commit/e7b1bb079145809d66296c0ad6628079f784b88e)]:
  - gt-remark@1.0.5

## 2.6.27

### Patch Changes

- [#1051](https://github.com/generaltranslation/gt/pull/1051) [`d36d4b8`](https://github.com/generaltranslation/gt/commit/d36d4b8459626c552c143fbdfa6d01f647a66533) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: string list registration

## 2.6.26

### Patch Changes

- [#1046](https://github.com/generaltranslation/gt/pull/1046) [`47918b7`](https://github.com/generaltranslation/gt/commit/47918b7a4c38967fe2148d972f0a3c740e0bc25d) Thanks [@brian-lou](https://github.com/brian-lou)! - Update /translate endpoint

- Updated dependencies [[`47918b7`](https://github.com/generaltranslation/gt/commit/47918b7a4c38967fe2148d972f0a3c740e0bc25d)]:
  - generaltranslation@8.1.12

## 2.6.25

### Patch Changes

- [#1040](https://github.com/generaltranslation/gt/pull/1040) [`d7bc63f`](https://github.com/generaltranslation/gt/commit/d7bc63f497534eede92138c8836bc84169600ff1) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: expose enqueue and upload commands

## 2.6.24

### Patch Changes

- [#1036](https://github.com/generaltranslation/gt/pull/1036) [`5fc08d0`](https://github.com/generaltranslation/gt/commit/5fc08d0028b7936b5916a048786bedc3b13e0042) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Fix: Update composite JSONs when non-translatable content changes, fix bug where `save-local` update composite key index

## 2.6.23

### Patch Changes

- [#1034](https://github.com/generaltranslation/gt/pull/1034) [`7cd02ba`](https://github.com/generaltranslation/gt/commit/7cd02ba200c8645de01527a88f7cf32346e67d12) Thanks [@brian-lou](https://github.com/brian-lou)! - Modularize API logic; add retry for 5XX errors

- Updated dependencies [[`7cd02ba`](https://github.com/generaltranslation/gt/commit/7cd02ba200c8645de01527a88f7cf32346e67d12)]:
  - generaltranslation@8.1.11

## 2.6.22

### Patch Changes

- [#1029](https://github.com/generaltranslation/gt/pull/1029) [`c3dcd6f`](https://github.com/generaltranslation/gt/commit/c3dcd6f9390e8516c6c0c1eee373e587b38c4772) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: compatability interface issue with types

## 2.6.21

### Patch Changes

- [#1021](https://github.com/generaltranslation/gt/pull/1021) [`4cbf7da`](https://github.com/generaltranslation/gt/commit/4cbf7da4bb0d202e2b7c8a6995566538b71856e9) Thanks [@brian-lou](https://github.com/brian-lou)! - Use default branch name instead of placeholder

- Updated dependencies [[`9e99e94`](https://github.com/generaltranslation/gt/commit/9e99e945cbf9e31990930e3428468f64d7240da5)]:
  - generaltranslation@8.1.10

## 2.6.20

### Patch Changes

- [#1019](https://github.com/generaltranslation/gt/pull/1019) [`4dd02f0`](https://github.com/generaltranslation/gt/commit/4dd02f00309bfdbc8a2d49c1d4986ead1f28ac8b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: default branch fallback

## 2.6.19

### Patch Changes

- [#1014](https://github.com/generaltranslation/gt/pull/1014) [`e421292`](https://github.com/generaltranslation/gt/commit/e421292739807db8696d7912da8b92731fb34b2b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: library names

- [#1018](https://github.com/generaltranslation/gt/pull/1018) [`3ac2e30`](https://github.com/generaltranslation/gt/commit/3ac2e30dcd76bf5819f1a385397eb59bcc158732) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: gt-react-native inline tx

## 2.6.18

### Patch Changes

- [#1009](https://github.com/generaltranslation/gt/pull/1009) [`ffd6995`](https://github.com/generaltranslation/gt/commit/ffd6995d57e5444157071696e533ee29abcc2df4) Thanks [@pie575](https://github.com/pie575)! - added ai instructions on how to use the gt library

- [#1013](https://github.com/generaltranslation/gt/pull/1013) [`d01b29c`](https://github.com/generaltranslation/gt/commit/d01b29c0f5a4442f49a1ab6d8d5ee72403c6fa17) Thanks [@pie575](https://github.com/pie575)! - added flag to update-instructions add comments to ai files even if they weren't there before

- [#1007](https://github.com/generaltranslation/gt/pull/1007) [`7aaac80`](https://github.com/generaltranslation/gt/commit/7aaac80b67f4f6ffa8d9ef9aa00f6fc669596003) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add gt-node support

## 2.6.17

### Patch Changes

- [#1005](https://github.com/generaltranslation/gt/pull/1005) [`ca125b3`](https://github.com/generaltranslation/gt/commit/ca125b3212675b27fa756b8cad80b7a1f21f8306) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add handling of `openapi` field in group nodes for Mintlify docs

## 2.6.16

### Patch Changes

- [#1002](https://github.com/generaltranslation/gt/pull/1002) [`8f8368a`](https://github.com/generaltranslation/gt/commit/8f8368a8723f79c4ebe56129bac03cb6cb33eec8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: branch detection vercel

## 2.6.15

### Patch Changes

- [#999](https://github.com/generaltranslation/gt/pull/999) [`09f3e68`](https://github.com/generaltranslation/gt/commit/09f3e6829243decffa795251d46c9e6a0d1ed878) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Allow `sharedStaticAssets` configuration to mirror shared asset structure

## 2.6.14

### Patch Changes

- [#996](https://github.com/generaltranslation/gt/pull/996) [`13714ba`](https://github.com/generaltranslation/gt/commit/13714ba951bd56e7b897e81ee529661da3dec01a) Thanks [@brian-lou](https://github.com/brian-lou)! - Change pino transport

- [#998](https://github.com/generaltranslation/gt/pull/998) [`9661270`](https://github.com/generaltranslation/gt/commit/966127076152d8a6d911324947942a05bd31cf6e) Thanks [@brian-lou](https://github.com/brian-lou)! - Disable branching by default

## 2.6.13

### Patch Changes

- [#995](https://github.com/generaltranslation/gt/pull/995) [`b33e1fd`](https://github.com/generaltranslation/gt/commit/b33e1fd3073b23c2cc5db900619fb4c8d4a64c1f) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Improve warning display for CLI

- Updated dependencies [[`4a66903`](https://github.com/generaltranslation/gt/commit/4a669031f74a0b20783709752ab7fc0ab40869df)]:
  - generaltranslation@8.1.9

## 2.6.12

### Patch Changes

- [#992](https://github.com/generaltranslation/gt/pull/992) [`776a12f`](https://github.com/generaltranslation/gt/commit/776a12f5ac2fbc3bb832d96ca337fcbadbf1fd49) Thanks [@brian-lou](https://github.com/brian-lou)! - Enable branching for default; graceful fallback

## 2.6.11

### Patch Changes

- [#988](https://github.com/generaltranslation/gt/pull/988) [`efdf632`](https://github.com/generaltranslation/gt/commit/efdf632acab7cdd4d1819408d808bd4ac05bc7c8) Thanks [@pie575](https://github.com/pie575)! - Added function to export errors as json from running validate

## 2.6.10

### Patch Changes

- [#986](https://github.com/generaltranslation/gt/pull/986) [`b943ac2`](https://github.com/generaltranslation/gt/commit/b943ac200d8ec41219b3c09a669f94590fec0f65) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: include branchid in gt config

## 2.6.9

### Patch Changes

- [#984](https://github.com/generaltranslation/gt/pull/984) [`bfd90d5`](https://github.com/generaltranslation/gt/commit/bfd90d596f925ce0ab56d856994d1fb11cd55dc2) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix versionid calculation

## 2.6.8

### Patch Changes

- [#981](https://github.com/generaltranslation/gt/pull/981) [`fca3a25`](https://github.com/generaltranslation/gt/commit/fca3a2583eb7f21bc3ef13516351d479f7bef882) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Handling source file movement to persist existing translations instead of retranslating

- Updated dependencies [[`fca3a25`](https://github.com/generaltranslation/gt/commit/fca3a2583eb7f21bc3ef13516351d479f7bef882)]:
  - generaltranslation@8.1.8

## 2.6.7

### Patch Changes

- [#975](https://github.com/generaltranslation/gt/pull/975) [`18d6672`](https://github.com/generaltranslation/gt/commit/18d6672c45d1cafe93817aec67fa60c70a1c7567) Thanks [@brian-lou](https://github.com/brian-lou)! - Add branch config options

- [#978](https://github.com/generaltranslation/gt/pull/978) [`73238cf`](https://github.com/generaltranslation/gt/commit/73238cf4d55e8b42c10c870c6a525df9ff36c338) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Fixing `save-local` behavior for composite JSONs

## 2.6.6

### Patch Changes

- [#974](https://github.com/generaltranslation/gt/pull/974) [`ba07f07`](https://github.com/generaltranslation/gt/commit/ba07f078079a4ae0d07231fb98fee1a4668a5a39) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Fixing `save-local` behavior for composite JSONs

## 2.6.5

### Patch Changes

- [#971](https://github.com/generaltranslation/gt/pull/971) [`821b0f0`](https://github.com/generaltranslation/gt/commit/821b0f05bab247e4d4c91cabc3ccfd45d672d25f) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding `experimentalLocalizeRelativeAssets` config option to handle asset paths

## 2.6.4

### Patch Changes

- [#969](https://github.com/generaltranslation/gt/pull/969) [`0fef5cb`](https://github.com/generaltranslation/gt/commit/0fef5cb5266a0aa6ccdf2dc8778ee913eb145b5d) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add flag for Mintlify docs to infer title from source file name when missing title in YAML frontmatter

## 2.6.3

### Patch Changes

- [#967](https://github.com/generaltranslation/gt/pull/967) [`bc52a1d`](https://github.com/generaltranslation/gt/commit/bc52a1ddc8ef11540681215b8a9b0ab54e1b3bca) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Reverting Mintlify-specific `docs.json` file filtering

## 2.6.2

### Patch Changes

- [#964](https://github.com/generaltranslation/gt/pull/964) [`e0da677`](https://github.com/generaltranslation/gt/commit/e0da677827434c5bfda945557f643c4468a2dac6) Thanks [@pie575](https://github.com/pie575)! - Refactor parseJSX and parseStringFunction

- [#966](https://github.com/generaltranslation/gt/pull/966) [`f446e01`](https://github.com/generaltranslation/gt/commit/f446e01754671d3586feb811c036d317a8693039) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add config flag to filter Mintlify files based on `docs.json` pages

## 2.6.1

### Patch Changes

- [#960](https://github.com/generaltranslation/gt/pull/960) [`eb07e8c`](https://github.com/generaltranslation/gt/commit/eb07e8ce1b610551437b40f96c72ac76d0af7b67) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: upload shared id for static content

- Updated dependencies [[`eb07e8c`](https://github.com/generaltranslation/gt/commit/eb07e8ce1b610551437b40f96c72ac76d0af7b67)]:
  - generaltranslation@8.1.7

## 2.6.0

### Minor Changes

- [#958](https://github.com/generaltranslation/gt/pull/958) [`c64d5d1`](https://github.com/generaltranslation/gt/commit/c64d5d1bc7fda78294e09b93c4a4e08d576409fc) Thanks [@pie575](https://github.com/pie575)! - CLI New Default Workflow

## 2.5.49

### Patch Changes

- [#953](https://github.com/generaltranslation/gt/pull/953) [`4fca112`](https://github.com/generaltranslation/gt/commit/4fca1123d797883b8ad73a770ad177b5068a4707) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add handling for OpenAPI configurations via Mintlify's `docs.json`

## 2.5.48

### Patch Changes

- Updated dependencies [[`feada39`](https://github.com/generaltranslation/gt/commit/feada3918ad78a1584f07245ac158c2d994a38da)]:
  - generaltranslation@8.1.6

## 2.5.47

### Patch Changes

- [#947](https://github.com/generaltranslation/gt/pull/947) [`5dccb20`](https://github.com/generaltranslation/gt/commit/5dccb20c94080aba17685d0ef623882b446cb39b) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Fix to avoid anchor ID double escaping during parse fallback on MDX

## 2.5.46

### Patch Changes

- [#945](https://github.com/generaltranslation/gt/pull/945) [`3f0da49`](https://github.com/generaltranslation/gt/commit/3f0da498beaff2fe697cbf785bd1cc5fa069d93d) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add escaping of anchor ID syntax to all files passed in as MDX via gt.config.json

## 2.5.45

### Patch Changes

- [#944](https://github.com/generaltranslation/gt/pull/944) [`0a58f13`](https://github.com/generaltranslation/gt/commit/0a58f13c9d25938a5e12644349248ce18aebb796) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add option to skip file validation when passing for translation

- [#942](https://github.com/generaltranslation/gt/pull/942) [`0cb890b`](https://github.com/generaltranslation/gt/commit/0cb890b84d775b360de0d8f6ed2b1ec8aeaa0af2) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Refreshed CLI setup wizard flow

## 2.5.44

### Patch Changes

- [#936](https://github.com/generaltranslation/gt/pull/936) [`45ee200`](https://github.com/generaltranslation/gt/commit/45ee20016ff82ea07008e053e296146a0e925841) Thanks [@brian-lou](https://github.com/brian-lou)! - Create Locadex AI Agent link in gtx-cli init command

## 2.5.43

### Patch Changes

- [#933](https://github.com/generaltranslation/gt/pull/933) [`a9aae8c`](https://github.com/generaltranslation/gt/commit/a9aae8c7d22a074ef490b4f4a563a64ae50cd444) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Fixing handling of [locale] placeholder in blob patterns

## 2.5.42

### Patch Changes

- [#932](https://github.com/generaltranslation/gt/pull/932) [`dcdd751`](https://github.com/generaltranslation/gt/commit/dcdd7516edfe2e51ed633c79bc2045fb14fd938b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: compiler cli deps when installed at the same time caused an bug in npm with the esbuild version

## 2.5.41

### Patch Changes

- [#929](https://github.com/generaltranslation/gt/pull/929) [`ca7b778`](https://github.com/generaltranslation/gt/commit/ca7b7785cc28817c154900933ac7be2098a10faf) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Auto-update OpenAPI spec paths when specs are modified

## 2.5.40

### Patch Changes

- [#927](https://github.com/generaltranslation/gt/pull/927) [`f0f86f3`](https://github.com/generaltranslation/gt/commit/f0f86f3c2dbb90d43029f64def2b3dc43584bad7) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding YAML support for Mintlify OpenAPI configurations

## 2.5.39

### Patch Changes

- [#920](https://github.com/generaltranslation/gt/pull/920) [`3071d23`](https://github.com/generaltranslation/gt/commit/3071d2396f67e1e0a907878ec4555c314b2e5c52) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: bin release

## 2.5.38

### Patch Changes

- [#921](https://github.com/generaltranslation/gt/pull/921) [`1aece7c`](https://github.com/generaltranslation/gt/commit/1aece7c23081a0b26d6d0e58e0fc76ba18b80b47) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Bumping CLI minor version to avoid npm release conflict

## 2.5.37

### Patch Changes

- [#911](https://github.com/generaltranslation/gt/pull/911) [`6af64c0`](https://github.com/generaltranslation/gt/commit/6af64c04fa6e3d6332a206d9b68fa1a46de1c002) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding `experimentalCanonicalLocaleKeys` option to `gt.config.json`. It overrides alias configurations when setting keys in a JSON schema

- [#908](https://github.com/generaltranslation/gt/pull/908) [`1e7e52f`](https://github.com/generaltranslation/gt/commit/1e7e52f3a77835887ff187ffeb99d6e3dc2a9e6c) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix timeout logic; Refactor upload command

- Updated dependencies [[`1e7e52f`](https://github.com/generaltranslation/gt/commit/1e7e52f3a77835887ff187ffeb99d6e3dc2a9e6c)]:
  - generaltranslation@8.1.5

## 2.5.36

### Patch Changes

- [#806](https://github.com/generaltranslation/gt/pull/806) [`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - feat: declareStatic()

- Updated dependencies [[`d59dd40`](https://github.com/generaltranslation/gt/commit/d59dd40e7b042e2bb4e718f17f3b2e764165151f)]:
  - generaltranslation@8.1.4

## 2.5.35

### Patch Changes

- [#905](https://github.com/generaltranslation/gt/pull/905) [`e73bf82`](https://github.com/generaltranslation/gt/commit/e73bf820422771a59408eb643e22ef7f99682b9f) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix CLI failure handling

## 2.5.34

### Patch Changes

- [#904](https://github.com/generaltranslation/gt/pull/904) [`51d412f`](https://github.com/generaltranslation/gt/commit/51d412f503bbb838daaaca47fc8165873ce1857e) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Assign `save-local` changes to most recent download

## 2.5.33

### Patch Changes

- [#901](https://github.com/generaltranslation/gt/pull/901) [`6320663`](https://github.com/generaltranslation/gt/commit/6320663e032aa4b8a337e08423a5be7215260e87) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: release error

## 2.5.32

### Patch Changes

- [#899](https://github.com/generaltranslation/gt/pull/899) [`94edf07`](https://github.com/generaltranslation/gt/commit/94edf07fb5a05130da967ffb1e76577667e9dff0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: bin release

## 2.5.31

### Patch Changes

- [#895](https://github.com/generaltranslation/gt/pull/895) [`a64277c`](https://github.com/generaltranslation/gt/commit/a64277cd1d633899f4ac0977b389ccfa00660512) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: support for cli execution independent of package resolution

## 2.5.30

### Patch Changes

- [#896](https://github.com/generaltranslation/gt/pull/896) [`443ee73`](https://github.com/generaltranslation/gt/commit/443ee73395a514eec448b03810cb871062bf5b2a) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix dry-run error conditions

## 2.5.29

### Patch Changes

- [#892](https://github.com/generaltranslation/gt/pull/892) [`48b2771`](https://github.com/generaltranslation/gt/commit/48b2771aa7666e8f94f485f86acf32525d26bd3f) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Fixing handling of OpenAPI paths for Mintlify

## 2.5.28

### Patch Changes

- [#883](https://github.com/generaltranslation/gt/pull/883) [`e113d8d`](https://github.com/generaltranslation/gt/commit/e113d8d8fb5e37f45a4aa77544e8f4666519bfe8) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Send file paths in translation metadata

- [#885](https://github.com/generaltranslation/gt/pull/885) [`22ef3ec`](https://github.com/generaltranslation/gt/commit/22ef3ecb9c2a41a5d982684cc2d45834be11ae5b) Thanks [@brian-lou](https://github.com/brian-lou)! - Add shared flags to CLI save-local command

- [#886](https://github.com/generaltranslation/gt/pull/886) [`8ba1edf`](https://github.com/generaltranslation/gt/commit/8ba1edfa838fe9209ae6fa5fe154e7c991be9aa6) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Handle Mintlify anchor IDs containing escaped characters

- Updated dependencies [[`e113d8d`](https://github.com/generaltranslation/gt/commit/e113d8d8fb5e37f45a4aa77544e8f4666519bfe8)]:
  - generaltranslation@8.1.3

## 2.5.27

### Patch Changes

- [#880](https://github.com/generaltranslation/gt/pull/880) [`3dc7b64`](https://github.com/generaltranslation/gt/commit/3dc7b6460cd05ddcb656a247602f4f50b06312fd) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Hotfix: sending format metadata to the API during build time translation

- Updated dependencies [[`3dc7b64`](https://github.com/generaltranslation/gt/commit/3dc7b6460cd05ddcb656a247602f4f50b06312fd)]:
  - generaltranslation@8.1.2

## 2.5.26

### Patch Changes

- [#878](https://github.com/generaltranslation/gt/pull/878) [`5624f1c`](https://github.com/generaltranslation/gt/commit/5624f1c074ff9cb2065ed85dbb30fae24939f53e) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Updating Mintlify preset to include `experimentalSort`

## 2.5.25

### Patch Changes

- [#876](https://github.com/generaltranslation/gt/pull/876) [`28bd6d5`](https://github.com/generaltranslation/gt/commit/28bd6d5f1ed50658da2e3adc5b59a40804b00b02) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding experimental alphabetical sort for JSONs with locales as keys

## 2.5.24

### Patch Changes

- [#860](https://github.com/generaltranslation/gt/pull/860) [`37bac4c`](https://github.com/generaltranslation/gt/commit/37bac4ce11689a2f729efbcb2e052205447a7f71) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: support for max char

- Updated dependencies [[`37bac4c`](https://github.com/generaltranslation/gt/commit/37bac4ce11689a2f729efbcb2e052205447a7f71)]:
  - generaltranslation@8.1.1

## 2.5.23

### Patch Changes

- Updated dependencies [[`3e8ceb4`](https://github.com/generaltranslation/gt/commit/3e8ceb4526530d38eae469b05e8bf273d5ca05ac)]:
  - generaltranslation@8.1.0

## 2.5.22

### Patch Changes

- [#870](https://github.com/generaltranslation/gt/pull/870) [`4291258`](https://github.com/generaltranslation/gt/commit/42912587a51da045c0b578ac71699fda4a8fcc26) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Persist style of YAML frontmatter when applying Mintlify OpenAPI postprocessing

## 2.5.21

### Patch Changes

- [#868](https://github.com/generaltranslation/gt/pull/868) [`34499ce`](https://github.com/generaltranslation/gt/commit/34499ce8407d4b96dea1b4db7a92225e8118fc56) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Removing `"openapi"` top level config, adding as option under `"options.mintlify.openapi"`. Also adding a `jsonSchema` preset for `openapi`.

## 2.5.20

### Patch Changes

- Updated dependencies [[`997a5df`](https://github.com/generaltranslation/gt/commit/997a5df6ac355b49a77e768935f9017af689de21)]:
  - generaltranslation@8.0.6

## 2.5.19

### Patch Changes

- [#853](https://github.com/generaltranslation/gt/pull/853) [`02abd0a`](https://github.com/generaltranslation/gt/commit/02abd0a970a09c514744982f06169f385dfdd972) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Including hash of post-processed files in `gt-lock.json` to avoid unnecessary saves when calling `save-local`

## 2.5.18

### Patch Changes

- [#851](https://github.com/generaltranslation/gt/pull/851) [`cf5f0e3`](https://github.com/generaltranslation/gt/commit/cf5f0e3f1537c304b7ea5703714ffb4956a7f6f4) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Skip anchor ID fallback in codeblocks to avoid adding anchors to comments

## 2.5.17

### Patch Changes

- [#848](https://github.com/generaltranslation/gt/pull/848) [`db4ab5c`](https://github.com/generaltranslation/gt/commit/db4ab5cad2726d78dc7c4e4dd7f3a83adaa1fcfb) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding OpenAPI handling via `gt.config.json`

## 2.5.16

### Patch Changes

- [#843](https://github.com/generaltranslation/gt/pull/843) [`b135cbe`](https://github.com/generaltranslation/gt/commit/b135cbed44b259619697d9a429ba61c434bed7b5) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Job polling correctly resolves locale aliases

## 2.5.15

### Patch Changes

- [#838](https://github.com/generaltranslation/gt/pull/838) [`3a3d45b`](https://github.com/generaltranslation/gt/commit/3a3d45be0b454fb017ad4b75a772df1c8aaee65e) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding fallback when localizing static imports

## 2.5.14

### Patch Changes

- [#837](https://github.com/generaltranslation/gt/pull/837) [`0772b57`](https://github.com/generaltranslation/gt/commit/0772b5714f1cfe8af5f5edcdf6bcb28125a1536f) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Making experimentalAddHeaderAnchorIds independent of experimentalLocalizeStaticUrls and fetching anchor IDs from source files when present

- [#835](https://github.com/generaltranslation/gt/pull/835) [`79225fb`](https://github.com/generaltranslation/gt/commit/79225fb3bbea3bb7a453cc237c619b67dd0dd3da) Thanks [@brian-lou](https://github.com/brian-lou)! - When using --force translate, also force files to re-download

## 2.5.13

### Patch Changes

- [#833](https://github.com/generaltranslation/gt/pull/833) [`30a04f9`](https://github.com/generaltranslation/gt/commit/30a04f955c64013daf2a32480fb33b3d4e08d678) Thanks [@brian-lou](https://github.com/brian-lou)! - Add txt file translation support

- Updated dependencies [[`30a04f9`](https://github.com/generaltranslation/gt/commit/30a04f955c64013daf2a32480fb33b3d4e08d678)]:
  - generaltranslation@8.0.5

## 2.5.12

### Patch Changes

- [#816](https://github.com/generaltranslation/gt/pull/816) [`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add gt-i18n, a pure js library for translation

- Updated dependencies [[`e42a442`](https://github.com/generaltranslation/gt/commit/e42a44280442e588b82b3fe1aff52f1e53aa8605)]:
  - generaltranslation@8.0.4

## 2.5.11

### Patch Changes

- [#827](https://github.com/generaltranslation/gt/pull/827) [`35197d0`](https://github.com/generaltranslation/gt/commit/35197d075670411dcdd2ddc93fd5eaf021cd924b) Thanks [@brian-lou](https://github.com/brian-lou)! - Pin @clack/prompts version

## 2.5.10

### Patch Changes

- [#825](https://github.com/generaltranslation/gt/pull/825) [`a9bdf21`](https://github.com/generaltranslation/gt/commit/a9bdf21d9ec80edc190b32b963dfe19c5fe2ea33) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix init write files

## 2.5.9

### Patch Changes

- [#823](https://github.com/generaltranslation/gt/pull/823) [`afbd29a`](https://github.com/generaltranslation/gt/commit/afbd29a34b051c76fce387269c4eb4a2e00a5831) Thanks [@brian-lou](https://github.com/brian-lou)! - Deprecate old 'setup' command -> Use 'init' instead. New 'setup' command runs project setup

- Updated dependencies [[`afbd29a`](https://github.com/generaltranslation/gt/commit/afbd29a34b051c76fce387269c4eb4a2e00a5831)]:
  - generaltranslation@8.0.3

## 2.5.8

### Patch Changes

- [#821](https://github.com/generaltranslation/gt/pull/821) [`321854a`](https://github.com/generaltranslation/gt/commit/321854ad881ca07b6a0207b3b0cbc004c6c0f5a4) Thanks [@brian-lou](https://github.com/brian-lou)! - Refactor CLI Logging behavior

## 2.5.7

### Patch Changes

- [#819](https://github.com/generaltranslation/gt/pull/819) [`50338d2`](https://github.com/generaltranslation/gt/commit/50338d2192e2882a4192273a7bbf12d39939c209) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding sorting by locale order

## 2.5.6

### Patch Changes

- [#817](https://github.com/generaltranslation/gt/pull/817) [`80eef0e`](https://github.com/generaltranslation/gt/commit/80eef0e0f61d5a07ed850aa39b25e81bddd12b34) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: Static component resolution edge cases

## 2.5.5

### Patch Changes

- [#815](https://github.com/generaltranslation/gt/pull/815) [`e7d25b0`](https://github.com/generaltranslation/gt/commit/e7d25b06a3e1d7ca404d64257570b88e7b0d1915) Thanks [@brian-lou](https://github.com/brian-lou)! - Batch enqueue jobs

- Updated dependencies [[`e7d25b0`](https://github.com/generaltranslation/gt/commit/e7d25b06a3e1d7ca404d64257570b88e7b0d1915)]:
  - generaltranslation@8.0.2

## 2.5.4

### Patch Changes

- [#807](https://github.com/generaltranslation/gt/pull/807) [`293a5a3`](https://github.com/generaltranslation/gt/commit/293a5a3ceba2321eed7b1271ca955331995f40a7) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add handling of shared static assets

## 2.5.3

### Patch Changes

- Updated dependencies [[`f98c504`](https://github.com/generaltranslation/gt/commit/f98c504f1e025024b3e1e5e16a0271e86ed095fa)]:
  - generaltranslation@8.0.1

## 2.5.2

### Patch Changes

- [#798](https://github.com/generaltranslation/gt/pull/798) [`cf475e4`](https://github.com/generaltranslation/gt/commit/cf475e4db92199cf61f9179b7d678ed3aa116c98) Thanks [@brian-lou](https://github.com/brian-lou)! - Test OIDC

## 2.5.1

### Patch Changes

- [#796](https://github.com/generaltranslation/gt/pull/796) [`855a653`](https://github.com/generaltranslation/gt/commit/855a6538e2a080fc73d97585df2a838f02a3d00a) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: remove null vals from jsx children

## 2.5.0

### Minor Changes

- [#788](https://github.com/generaltranslation/gt/pull/788) [`99e4648`](https://github.com/generaltranslation/gt/commit/99e46486ae2046c689e0045372d63c4eb3dc5d48) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - More information: https://https://generaltranslation.com/en-US/blog/gt-next_v6_8_0

  feat: static component

- [#791](https://github.com/generaltranslation/gt/pull/791) [`fee5d4a`](https://github.com/generaltranslation/gt/commit/fee5d4a3d0fd20e0928eebb83201a87289265719) Thanks [@brian-lou](https://github.com/brian-lou)! - Update Notes:
  https://generaltranslation.com/blog/generaltranslation_v8

  Please update the following packages to the latest version:
  - generaltranslation: `7.9.1` or later
  - gtx-cli: `2.4.15` or later
  - gt-sanity: `1.0.11` or later

  Older versions of these packages may not be compatible with the latest version of the General Translation API and may require updating.

### Patch Changes

- Updated dependencies [[`fee5d4a`](https://github.com/generaltranslation/gt/commit/fee5d4a3d0fd20e0928eebb83201a87289265719)]:
  - generaltranslation@8.0.0

## 2.4.15

### Patch Changes

- [#792](https://github.com/generaltranslation/gt/pull/792) [`b6d6869`](https://github.com/generaltranslation/gt/commit/b6d686917316f6ed44130a54509459a7f9ee35fa) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Skipping over JSON and YAML files with failing parse to avoid crashing

## 2.4.14

### Patch Changes

- Updated dependencies [[`3da05a1`](https://github.com/generaltranslation/gt/commit/3da05a12a37a62ace3c7e321aa2fed5a4af52ad9)]:
  - generaltranslation@7.9.1

## 2.4.13

### Patch Changes

- Updated dependencies [[`93881f1`](https://github.com/generaltranslation/gt/commit/93881f159455a9bbc13d14e7fec9befa60998ba3)]:
  - generaltranslation@7.9.0

## 2.4.12

### Patch Changes

- [#782](https://github.com/generaltranslation/gt/pull/782) [`155fc2c`](https://github.com/generaltranslation/gt/commit/155fc2c987078b2ffc12c55abb65bb7ff16eb09b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: only throw errors in development for invalid icu strings

## 2.4.11

### Patch Changes

- [#780](https://github.com/generaltranslation/gt/pull/780) [`c048320`](https://github.com/generaltranslation/gt/commit/c048320ae0daf91bebf65145aba6fb15c2f3612d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fix CLI parsing for nbsp characters

## 2.4.10

### Patch Changes

- [#778](https://github.com/generaltranslation/gt/pull/778) [`0d8f414`](https://github.com/generaltranslation/gt/commit/0d8f4144696873b15f0aaa6744bdb7390d472279) Thanks [@SamEggert](https://github.com/SamEggert)! - skip dynamic expressions for HTML content props in parseJSX

## 2.4.9

### Patch Changes

- [#774](https://github.com/generaltranslation/gt/pull/774) [`87dab40`](https://github.com/generaltranslation/gt/commit/87dab40efc9469d6ba3b3dc143d7d7a27422f7b0) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Hiding saving local translations behind the --save-local flag

## 2.4.8

### Patch Changes

- Updated dependencies [[`7434c15`](https://github.com/generaltranslation/gt/commit/7434c1503c2a62bdb90d4058f903a56331276365)]:
  - generaltranslation@7.8.0

## 2.4.7

### Patch Changes

- [#767](https://github.com/generaltranslation/gt/pull/767) [`b27a947`](https://github.com/generaltranslation/gt/commit/b27a947a46d2ad802278d79d45d25cdccd7193d5) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix monorepo in-line string resolution

## 2.4.6

### Patch Changes

- [#763](https://github.com/generaltranslation/gt/pull/763) [`b6a79a8`](https://github.com/generaltranslation/gt/commit/b6a79a868630725eb1106faaa2c385c305891e9c) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Allow lists for overrides in gt.config.json

## 2.4.5

### Patch Changes

- [#759](https://github.com/generaltranslation/gt/pull/759) [`cf04026`](https://github.com/generaltranslation/gt/commit/cf04026df7072af60999f281ba342a1baa58f7ff) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Migrating downloaded-versions.json to gt-lock.json, make .gt and .locadex interchangable

## 2.4.4

### Patch Changes

- Updated dependencies [[`7ba2e84`](https://github.com/generaltranslation/gt/commit/7ba2e8412b608aa3415f4865dc26adbbd3daa236)]:
  - generaltranslation@7.7.3

## 2.4.3

### Patch Changes

- [#755](https://github.com/generaltranslation/gt/pull/755) [`20ec920`](https://github.com/generaltranslation/gt/commit/20ec920ecf3fb04e464f281400429c68f3c1a701) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Passing project locales as part of translation setup process

- Updated dependencies [[`20ec920`](https://github.com/generaltranslation/gt/commit/20ec920ecf3fb04e464f281400429c68f3c1a701)]:
  - generaltranslation@7.7.2

## 2.4.2

### Patch Changes

- [#753](https://github.com/generaltranslation/gt/pull/753) [`bd0bc26`](https://github.com/generaltranslation/gt/commit/bd0bc265192d5b51618a537a92122cd6eeae6e4d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: avoid downloading files when using --publish flag

## 2.4.1

### Patch Changes

- [#751](https://github.com/generaltranslation/gt/pull/751) [`7114780`](https://github.com/generaltranslation/gt/commit/71147803bf3e4cf21556ffb9b5f77756e283a32a) Thanks [@SamEggert](https://github.com/SamEggert)! - transform for yaml files -- retrieve file format in downloadFileBatch

- Updated dependencies [[`7114780`](https://github.com/generaltranslation/gt/commit/71147803bf3e4cf21556ffb9b5f77756e283a32a)]:
  - generaltranslation@7.7.1

## 2.4.0

### Minor Changes

- [#745](https://github.com/generaltranslation/gt/pull/745) [`5208937`](https://github.com/generaltranslation/gt/commit/520893719480b40774ccd749fe73727cf490f46c) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding local translation editing. Local user edits to translation will now be saved and used to inform future translations of the same file.

### Patch Changes

- Updated dependencies [[`5208937`](https://github.com/generaltranslation/gt/commit/520893719480b40774ccd749fe73727cf490f46c)]:
  - generaltranslation@7.7.0

## 2.3.15

### Patch Changes

- [#741](https://github.com/generaltranslation/gt/pull/741) [`559c0bf`](https://github.com/generaltranslation/gt/commit/559c0bfa7ff9e6664f65317eddbab419682a3c95) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Avoid localizing relative MDX links

## 2.3.14

### Patch Changes

- [#739](https://github.com/generaltranslation/gt/pull/739) [`7afed0b`](https://github.com/generaltranslation/gt/commit/7afed0bda5be08d83bbe75cca9fb657ff5a50dae) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Only post-process files downloaded by gtx-cli on current run

## 2.3.13

### Patch Changes

- Updated dependencies [[`ed93e41`](https://github.com/generaltranslation/gt/commit/ed93e419e9547e6f2353d99f896702016f8ba751)]:
  - generaltranslation@7.6.5

## 2.3.12

### Patch Changes

- [#735](https://github.com/generaltranslation/gt/pull/735) [`8e4612e`](https://github.com/generaltranslation/gt/commit/8e4612e0b2c426d64153b6ca460e619fa29cb8e8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: auto enable gt compiler in default config

## 2.3.11

### Patch Changes

- [#732](https://github.com/generaltranslation/gt/pull/732) [`bcd8272`](https://github.com/generaltranslation/gt/commit/bcd8272576ff02432e39cf1887a48b4f566eb752) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Added freezing when fetching translations for unmodified source files. This will keep any local changes until retranslation is triggered or --force-download is used

## 2.3.10

### Patch Changes

- [#731](https://github.com/generaltranslation/gt/pull/731) [`6896570`](https://github.com/generaltranslation/gt/commit/68965708f43f1bdd0315aa96ce69b6ef6d68260d) Thanks [@SamEggert](https://github.com/SamEggert)! - check for gt.config.json in the .locadex directory

## 2.3.9

### Patch Changes

- [#715](https://github.com/generaltranslation/gt/pull/715) [`cc6c06a`](https://github.com/generaltranslation/gt/commit/cc6c06abf0ad0f00f55825e85d59d199ffbec263) Thanks [@brian-lou](https://github.com/brian-lou)! - Instead of throwing errors, CLI will now call process.exit

## 2.3.8

### Patch Changes

- [#713](https://github.com/generaltranslation/gt/pull/713) [`b8feb26`](https://github.com/generaltranslation/gt/commit/b8feb2638613f54b76b5f3768edc6039db512c53) Thanks [@SamEggert](https://github.com/SamEggert)! - rename clearLocaleFolders to clearLocaleDirs

## 2.3.7

### Patch Changes

- [#710](https://github.com/generaltranslation/gt/pull/710) [`8325bae`](https://github.com/generaltranslation/gt/commit/8325bae9a8661a0b269131ac6dadefab327c5b2c) Thanks [@SamEggert](https://github.com/SamEggert)! - add clearLocaleFolders option

## 2.3.6

### Patch Changes

- [#698](https://github.com/generaltranslation/gt/pull/698) [`9eefc14`](https://github.com/generaltranslation/gt/commit/9eefc14577013fcfa699344c4a950c12d3b3350b) Thanks [@brian-lou](https://github.com/brian-lou)! - Switch monorepo package manager to pnpm (no new features or bugs fixed). Please report issues to https://github.com/generaltranslation/gt

- Updated dependencies [[`9eefc14`](https://github.com/generaltranslation/gt/commit/9eefc14577013fcfa699344c4a950c12d3b3350b)]:
  - gt-remark@1.0.2
  - generaltranslation@7.6.4

## 2.3.5

### Patch Changes

- [#687](https://github.com/generaltranslation/gt/pull/687) [`99a1958`](https://github.com/generaltranslation/gt/commit/99a1958124d532bb3817f76a69d5232d9eb26f76) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: showing superfluous warning for composite json paths

## 2.3.4

### Patch Changes

- [#671](https://github.com/generaltranslation/gt/pull/671) [`b8c19d1`](https://github.com/generaltranslation/gt/commit/b8c19d13c0ab18a3f9376ebb940d9985cee6d961) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Fixing --force command in gtx-cli

## 2.3.3

### Patch Changes

- [#665](https://github.com/generaltranslation/gt/pull/665) [`814cb12`](https://github.com/generaltranslation/gt/commit/814cb122e68a51ea1a513e9f6e51249af345db64) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Migrating CLI to gt-remark plugin, updating plugin

- Updated dependencies [[`814cb12`](https://github.com/generaltranslation/gt/commit/814cb122e68a51ea1a513e9f6e51249af345db64)]:
  - gt-remark@1.0.1

## 2.3.2

### Patch Changes

- [#660](https://github.com/generaltranslation/gt/pull/660) [`2ddff43`](https://github.com/generaltranslation/gt/commit/2ddff430817ad61e996b516c539b6b7b944e618e) Thanks [@brian-lou](https://github.com/brian-lou)! - Update API utility functions

- Updated dependencies [[`2ddff43`](https://github.com/generaltranslation/gt/commit/2ddff430817ad61e996b516c539b6b7b944e618e)]:
  - generaltranslation@7.6.2

## 2.3.1

### Patch Changes

- [#655](https://github.com/generaltranslation/gt/pull/655) [`26a296c`](https://github.com/generaltranslation/gt/commit/26a296c113666dde77165c260dfb692bb8611ade) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Addng literal braces ('{' and '}') to list of characters to escape during AST stringify

## 2.3.0

### Minor Changes

- [#651](https://github.com/generaltranslation/gt/pull/651) [`3e5705b`](https://github.com/generaltranslation/gt/commit/3e5705bc96005441798619fec97574fa15a5a2bd) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Split up file upload into source/translation specific uploads; added project setup visibility

### Patch Changes

- Updated dependencies [[`3e5705b`](https://github.com/generaltranslation/gt/commit/3e5705bc96005441798619fec97574fa15a5a2bd)]:
  - generaltranslation@7.6.0

## 2.2.0

### Minor Changes

- [#638](https://github.com/generaltranslation/gt/pull/638) [`16bf30d`](https://github.com/generaltranslation/gt/commit/16bf30d70a0599ec863305f4f7a5a0852dd07e5d) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add locale aliasing

### Patch Changes

- Updated dependencies [[`16bf30d`](https://github.com/generaltranslation/gt/commit/16bf30d70a0599ec863305f4f7a5a0852dd07e5d)]:
  - generaltranslation@7.5.0

## 2.1.21

### Patch Changes

- [#645](https://github.com/generaltranslation/gt/pull/645) [`58cfaee`](https://github.com/generaltranslation/gt/commit/58cfaee5cc1dcd187f0b72b2761f96c19b4f313e) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Escaping HTML to avoid parsing issues from MDX consumers

## 2.1.20

### Patch Changes

- [#643](https://github.com/generaltranslation/gt/pull/643) [`4f553c0`](https://github.com/generaltranslation/gt/commit/4f553c00c119f272edc5ccb3616f2d0effec8586) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Removing custom configuration on remarkStringify

## 2.1.19

### Patch Changes

- [#641](https://github.com/generaltranslation/gt/pull/641) [`4c67f77`](https://github.com/generaltranslation/gt/commit/4c67f775ee892b47eebcc3178c00ad6547a84d84) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Encoding placeholders that break MDX parse

## 2.1.18

### Patch Changes

- [#637](https://github.com/generaltranslation/gt/pull/637) [`9c40a3c`](https://github.com/generaltranslation/gt/commit/9c40a3c729bf690381959679078c11c9c29bcdf2) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Skipping over empty files when sending for translation

## 2.1.17

### Patch Changes

- [#635](https://github.com/generaltranslation/gt/pull/635) [`10aa051`](https://github.com/generaltranslation/gt/commit/10aa051592cea43f772615da200c8615d4dd1a78) Thanks [@brian-lou](https://github.com/brian-lou)! - Create dictionary with uuid to reduce flakiness

## 2.1.16

### Patch Changes

- [#630](https://github.com/generaltranslation/gt/pull/630) [`1f0dc1b`](https://github.com/generaltranslation/gt/commit/1f0dc1b17f22737263938998f5c516e0aa136b1a) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding localization of import paths to MDX files

## 2.1.15

### Patch Changes

- [#622](https://github.com/generaltranslation/gt/pull/622) [`f5f888d`](https://github.com/generaltranslation/gt/commit/f5f888d79319ac79f3cde12588d1e24ec2003b25) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Skipping invalid (cannot be parsed by AST) MDX files when generating translations

## 2.1.14

### Patch Changes

- [#623](https://github.com/generaltranslation/gt/pull/623) [`288d2c6`](https://github.com/generaltranslation/gt/commit/288d2c657ff46eb5f4a5cdbc76ecc3f9be85228f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add --force flag for overwriting cached translations

- Updated dependencies [[`288d2c6`](https://github.com/generaltranslation/gt/commit/288d2c657ff46eb5f4a5cdbc76ecc3f9be85228f)]:
  - generaltranslation@7.4.2

## 2.1.13

### Patch Changes

- [#620](https://github.com/generaltranslation/gt/pull/620) [`1404b8f`](https://github.com/generaltranslation/gt/commit/1404b8feda21acdfba42483d496c61816babd327) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Display warning on MDX header mismatch instead of failure

## 2.1.12

### Patch Changes

- [#618](https://github.com/generaltranslation/gt/pull/618) [`195b65f`](https://github.com/generaltranslation/gt/commit/195b65fcbdebc027156ba04409b48f3ad175e20f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: src sepcification

## 2.1.11

### Patch Changes

- [#610](https://github.com/generaltranslation/gt/pull/610) [`bfb4f53`](https://github.com/generaltranslation/gt/commit/bfb4f53658c785520373af53a1e9fadb6eca2d0b) Thanks [@SamEggert](https://github.com/SamEggert)! - create loadTranslations.js when user specifies local translations in gtx-cli init

## 2.1.10

### Patch Changes

- [#600](https://github.com/generaltranslation/gt/pull/600) [`e94aac2`](https://github.com/generaltranslation/gt/commit/e94aac2b2554a279245d090b0872f6f64eb71c62) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Added handling of fragment URLs (i.e. href="#my-mdx-id") for correct routing across locales.

## 2.1.9

### Patch Changes

- [#604](https://github.com/generaltranslation/gt/pull/604) [`43c6a76`](https://github.com/generaltranslation/gt/commit/43c6a76be3d3be420e892b86188ef41c45ae8ffe) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Refactored useGT and useMessages in order to make useMessages function like an unlintable useGT

## 2.1.8

### Patch Changes

- [#599](https://github.com/generaltranslation/gt/pull/599) [`5950592`](https://github.com/generaltranslation/gt/commit/5950592ca44197915216ec5c8e26f9714cb4f55c) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: msg() function

## 2.1.8

### Patch Changes

- [#594](https://github.com/generaltranslation/gt/pull/594) [`3fa9c41`](https://github.com/generaltranslation/gt/commit/3fa9c41e2e37933b04e6c3d6c0f94271a07d0ff6) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix <GTProvider> wizard scan behavior

## 2.1.7

### Patch Changes

- [#579](https://github.com/generaltranslation/gt/pull/579) [`a485533`](https://github.com/generaltranslation/gt/commit/a4855336dfe5242cfdb24fd2e981f86b0bffdf05) Thanks [@SamEggert](https://github.com/SamEggert)! - fix localize static urls, add baseDomain functionality

## 2.1.6

### Patch Changes

- [#584](https://github.com/generaltranslation/gt/pull/584) [`fd3d958`](https://github.com/generaltranslation/gt/commit/fd3d958dab3d14a7f1f9b49c5c49fba191077a57) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix version

## 2.1.5

### Patch Changes

- [#580](https://github.com/generaltranslation/gt/pull/580) [`9b05fda`](https://github.com/generaltranslation/gt/commit/9b05fda9959f9e24491c02f357bc2a2c49ba0276) Thanks [@brian-lou](https://github.com/brian-lou)! - Update API schema, combine files and JSX translation endpoints

- Updated dependencies [[`9b05fda`](https://github.com/generaltranslation/gt/commit/9b05fda9959f9e24491c02f357bc2a2c49ba0276)]:
  - generaltranslation@7.4.1

## 2.1.5

### Patch Changes

- [#576](https://github.com/generaltranslation/gt/pull/576) [`be9c1ff`](https://github.com/generaltranslation/gt/commit/be9c1ff24c9a15a35e3f0da26e9ec941e5b41eea) Thanks [@SamEggert](https://github.com/SamEggert)! - Fix url localization

## 2.1.4

### Patch Changes

- [#536](https://github.com/generaltranslation/gt/pull/536) [`468b0b7`](https://github.com/generaltranslation/gt/commit/468b0b7c660fd1ab9e8c2611a26ade63ba268e80) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Added locale selection based on region
  Added compile time hashing
  Added es lint plugin for gt-next (in alpha)
  Fix CLI validation (used to error for {<JSX/>} inside <T>)
- Updated dependencies [[`468b0b7`](https://github.com/generaltranslation/gt/commit/468b0b7c660fd1ab9e8c2611a26ade63ba268e80)]:
  - generaltranslation@7.4.0

## 2.1.3

### Patch Changes

- [#564](https://github.com/generaltranslation/gt/pull/564) [`7251fc5`](https://github.com/generaltranslation/gt/commit/7251fc5d2474ad71b2da9ae5b71e37aed8199bce) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix CLI validation (used to error for {<JSX/>} inside <T>)

## 2.1.2

### Patch Changes

- [#562](https://github.com/generaltranslation/gt/pull/562) [`8461c5e`](https://github.com/generaltranslation/gt/commit/8461c5ee2ca25cf50d4e366cb4d1e765107851fd) Thanks [@SamEggert](https://github.com/SamEggert)! - localStaticImports gracefully handles invalid MDX

## 2.1.1

### Patch Changes

- [#554](https://github.com/generaltranslation/gt/pull/554) [`77fb048`](https://github.com/generaltranslation/gt/commit/77fb048ab2e4432739df1c4fbabe165712e84fb3) Thanks [@SamEggert](https://github.com/SamEggert)! - use MDX AST for static imports/urls

## 2.1.0

### Minor Changes

- [#556](https://github.com/generaltranslation/gt/pull/556) [`c52d896`](https://github.com/generaltranslation/gt/commit/c52d896f83fb4f6e58921286320a524885c8a52d) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding modelProvider field to gt.config

### Patch Changes

- Updated dependencies [[`c52d896`](https://github.com/generaltranslation/gt/commit/c52d896f83fb4f6e58921286320a524885c8a52d)]:
  - generaltranslation@7.3.0

## 2.0.24

### Patch Changes

- [#552](https://github.com/generaltranslation/gt/pull/552) [`65acf00`](https://github.com/generaltranslation/gt/commit/65acf0085a2b2c89f46b6b4685d94815a16467e6) Thanks [@brian-lou](https://github.com/brian-lou)! - Remove wizard auto-add T components

## 2.0.23

### Patch Changes

- [#539](https://github.com/generaltranslation/gt/pull/539) [`b88e468`](https://github.com/generaltranslation/gt/commit/b88e4684be9cd82a7d23e38fc893c2a8b7f0165f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add ability to exclude import paths and url paths from localization

## 2.0.22

### Patch Changes

- [#527](https://github.com/generaltranslation/gt/pull/527) [`d209aa9`](https://github.com/generaltranslation/gt/commit/d209aa99dbae8627ea85b240b60d4bbb5a53dbd6) Thanks [@brian-lou](https://github.com/brian-lou)! - Bump form-data version to address CVE-2025-7783

## 2.0.21

### Patch Changes

- [#524](https://github.com/generaltranslation/gt/pull/524) [`39b36e5`](https://github.com/generaltranslation/gt/commit/39b36e56f50fff663826c66022d798147a622898) Thanks [@brian-lou](https://github.com/brian-lou)! - Add support for translating YAML files via the General Translation API

## 2.0.20

### Patch Changes

- [#521](https://github.com/generaltranslation/gt/pull/521) [`6b137bc`](https://github.com/generaltranslation/gt/commit/6b137bcf0b2aaf50adacd5fb03ed64525fb12473) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: add support for experimental flags in config file

## 2.0.19

### Patch Changes

- [#519](https://github.com/generaltranslation/gt/pull/519) [`2ba4848`](https://github.com/generaltranslation/gt/commit/2ba48486603ef5e8e4026d89dc36311ce6505b81) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: exclude files with the [locales] tag

## 2.0.18

### Patch Changes

- [#507](https://github.com/generaltranslation/gt/pull/507) [`8f80795`](https://github.com/generaltranslation/gt/commit/8f80795daf862f769be728c044d48e5e28d7b126) Thanks [@SamEggert](https://github.com/SamEggert)! - Setup wizard detects and matches your module system when modifying the next.config

- [#517](https://github.com/generaltranslation/gt/pull/517) [`452da1e`](https://github.com/generaltranslation/gt/commit/452da1e1f0f6d7825b82bc66fb5d3dd6e7a6ad92) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add support for yaml

## 2.0.17

### Patch Changes

- [#514](https://github.com/generaltranslation/gt/pull/514) [`4beab58`](https://github.com/generaltranslation/gt/commit/4beab58142fa014bed5dbfc0acab03a1d1536b05) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix jsonSchema conflict with transform option

## 2.0.16

### Patch Changes

- [#512](https://github.com/generaltranslation/gt/pull/512) [`7c01ee8`](https://github.com/generaltranslation/gt/commit/7c01ee8af1e882d222fc3b0224b17f459ec5243b) Thanks [@brian-lou](https://github.com/brian-lou)! - Add new CLI command 'upload', add additional transform options for file translations

## 2.0.15

### Patch Changes

- [#510](https://github.com/generaltranslation/gt/pull/510) [`e69c23b`](https://github.com/generaltranslation/gt/commit/e69c23bb55062e91804f52379e231626573df30f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: backwards compatability

## 2.0.14

### Patch Changes

- [#508](https://github.com/generaltranslation/gt/pull/508) [`5375e2c`](https://github.com/generaltranslation/gt/commit/5375e2c1b17fba3ca52291e7d79f8d78a585ed49) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add zh-Hans and zh-Hant

## 2.0.13

### Patch Changes

- [#505](https://github.com/generaltranslation/gt/pull/505) [`e8c5650`](https://github.com/generaltranslation/gt/commit/e8c5650c163119301d2f9d6b946c0ed8383c57e1) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: json translation for composite arrays where there are multiple default locale items

## 2.0.12

### Patch Changes

- [#503](https://github.com/generaltranslation/gt/pull/503) [`9549d88`](https://github.com/generaltranslation/gt/commit/9549d88485af4dc57fb19847016d53aa3375b380) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix path resolution mechanism for useGT/getGT usage scanning

## 2.0.11

### Patch Changes

- [#501](https://github.com/generaltranslation/gt/pull/501) [`d353c84`](https://github.com/generaltranslation/gt/commit/d353c84aaa159dbc77cff3ac29953adef4c64597) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add localization for href

## 2.0.10

### Patch Changes

- [#499](https://github.com/generaltranslation/gt/pull/499) [`0793ef7`](https://github.com/generaltranslation/gt/commit/0793ef7f0d5b391805d072ff0c251fe43fa58b29) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add localization for imports

## 2.0.9

### Patch Changes

- [#497](https://github.com/generaltranslation/gt/pull/497) [`0f44ba0`](https://github.com/generaltranslation/gt/commit/0f44ba0eb1b31f339a43854efe4c64ca2df7e4ca) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add customizability for localize static url

## 2.0.8

### Patch Changes

- [#495](https://github.com/generaltranslation/gt/pull/495) [`a7eca74`](https://github.com/generaltranslation/gt/commit/a7eca74677356b392c7c1a431f664c8e28adbf0c) Thanks [@brian-lou](https://github.com/brian-lou)! - Add support for translating arbitrary JSON files (all strings). Add support for partially translating JSON files via jsonSchema config setting. Add support for composite JSON files (where there is a single JSON containing data for all translated languages). Add support for preset jsonSchemas.

- Updated dependencies [[`a7eca74`](https://github.com/generaltranslation/gt/commit/a7eca74677356b392c7c1a431f664c8e28adbf0c)]:
  - generaltranslation@7.1.4

## 2.0.7

### Patch Changes

- [#490](https://github.com/generaltranslation/gt/pull/490) [`03b3367`](https://github.com/generaltranslation/gt/commit/03b3367e98b155a21a723f0a645999f3efb40d18) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: add internal header when necessary

- Updated dependencies [[`03b3367`](https://github.com/generaltranslation/gt/commit/03b3367e98b155a21a723f0a645999f3efb40d18)]:
  - generaltranslation@7.1.2

## 2.0.6

### Patch Changes

- [#444](https://github.com/generaltranslation/gt/pull/444) [`c206a11`](https://github.com/generaltranslation/gt/commit/c206a1158516a0d815b1570d77e6dd62acdcedc4) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add translation interface for generaltranslation

- Updated dependencies [[`c206a11`](https://github.com/generaltranslation/gt/commit/c206a1158516a0d815b1570d77e6dd62acdcedc4)]:
  - generaltranslation@7.1.0

## 2.0.5

### Patch Changes

- [#467](https://github.com/generaltranslation/gt/pull/467) [`e043f07`](https://github.com/generaltranslation/gt/commit/e043f07decb426c2b275b67ad955b4ddca7d20ee) Thanks [@brian-lou](https://github.com/brian-lou)! - Add async errors for useGT/getGT to translate

## 2.0.4

### Patch Changes

- [#464](https://github.com/generaltranslation/gt/pull/464) [`a10331c`](https://github.com/generaltranslation/gt/commit/a10331c6854d60f3328d4ce6c307acc0c28e8ef4) Thanks [@brian-lou](https://github.com/brian-lou)! - Add success message for validate

- [#464](https://github.com/generaltranslation/gt/pull/464) [`a10331c`](https://github.com/generaltranslation/gt/commit/a10331c6854d60f3328d4ce6c307acc0c28e8ef4) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix glob pattern for validate files

## 2.0.3

### Patch Changes

- [#462](https://github.com/generaltranslation/gt/pull/462) [`678e9e7`](https://github.com/generaltranslation/gt/commit/678e9e70dd57a38ee10dcf9deb78cdd5dcfb759b) Thanks [@brian-lou](https://github.com/brian-lou)! - Revert adding version to cli tool

## 2.0.2

### Patch Changes

- [#458](https://github.com/generaltranslation/gt/pull/458) [`aff4b95`](https://github.com/generaltranslation/gt/commit/aff4b95f582ec9fcb28f1395d2eba907c93e4e31) Thanks [@brian-lou](https://github.com/brian-lou)! - Add individual file support to validate

## 2.0.1

### Patch Changes

- [#440](https://github.com/generaltranslation/gt/pull/440) [`e6fdedf`](https://github.com/generaltranslation/gt/commit/e6fdedffcdfbac5d257ea35140cbb81de6aa2729) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fixes to breaking changes

- Updated dependencies [[`e6fdedf`](https://github.com/generaltranslation/gt/commit/e6fdedffcdfbac5d257ea35140cbb81de6aa2729)]:
  - generaltranslation@7.0.1

## 2.0.0

### Major Changes

- [#436](https://github.com/generaltranslation/gt/pull/436) [`08377f3`](https://github.com/generaltranslation/gt/commit/08377f3b5b3b600efb1e232a7b9361e8c85ea4ae) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Breaking changes

### Patch Changes

- Updated dependencies [[`08377f3`](https://github.com/generaltranslation/gt/commit/08377f3b5b3b600efb1e232a7b9361e8c85ea4ae)]:
  - generaltranslation@7.0.0

## 1.2.34

### Patch Changes

- [#428](https://github.com/generaltranslation/gt/pull/428) [`54036f5`](https://github.com/generaltranslation/gt/commit/54036f54308bdb9f9e6dcec93871e004dcf1be4c) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add experimental options to translate

## 1.2.33

### Patch Changes

- [#426](https://github.com/generaltranslation/gt/pull/426) [`ce57545`](https://github.com/generaltranslation/gt/commit/ce575454301185c663cfb93345d3058c9ceb25dd) Thanks [@brian-lou](https://github.com/brian-lou)! - Improve file pattern matching

## 1.2.31

### Patch Changes

- [#423](https://github.com/generaltranslation/gt/pull/423) [`0ed08c7`](https://github.com/generaltranslation/gt/commit/0ed08c7bb1e63c99296b74138e4d44b718681fc8) Thanks [@brian-lou](https://github.com/brian-lou)! - Add setting configuration options

## 1.2.30

### Patch Changes

- [#409](https://github.com/generaltranslation/gt/pull/409) [`557f74d`](https://github.com/generaltranslation/gt/commit/557f74da58ebd84ca50c1961fc6dfecd63bb7797) Thanks [@brian-lou](https://github.com/brian-lou)! - Make locadex more reliable + improve validation

## 1.2.29

### Patch Changes

- [#400](https://github.com/generaltranslation/gt/pull/400) [`cf9c724`](https://github.com/generaltranslation/gt/commit/cf9c72488f74db5ccd7c4dca2650d75e3484d1f2) Thanks [@brian-lou](https://github.com/brian-lou)! - Reorder linter detection preference

## 1.2.28

### Patch Changes

- [#397](https://github.com/generaltranslation/gt/pull/397) [`80a1395`](https://github.com/generaltranslation/gt/commit/80a13955db9ff46e5883ac8b0909ab294c63d001) Thanks [@brian-lou](https://github.com/brian-lou)! - Run translate after i18n

## 1.2.27

### Patch Changes

- [#392](https://github.com/generaltranslation/gt/pull/392) [`cebc905`](https://github.com/generaltranslation/gt/commit/cebc905cb5364bdcc218d4e93a6aee606d804419) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix require not being present in ESM package

## 1.2.26

### Patch Changes

- [#391](https://github.com/generaltranslation/gt/pull/391) [`dd41343`](https://github.com/generaltranslation/gt/commit/dd413435742930d995c9fdb84368a91381da3d65) Thanks [@brian-lou](https://github.com/brian-lou)! - Improve logs for cli; Improve QOL setup for locadex

## 1.2.25

### Patch Changes

- [#368](https://github.com/generaltranslation/gt/pull/368) [`86f5a18`](https://github.com/generaltranslation/gt/commit/86f5a188439864244b74d590d07bfd6a52c193f9) Thanks [@brian-lou](https://github.com/brian-lou)! - Add new 'validate' command to gtx-cli

## 1.2.24

### Patch Changes

- [#358](https://github.com/generaltranslation/gt/pull/358) [`b0ea226`](https://github.com/generaltranslation/gt/commit/b0ea226310abb04ef5aa9ef1af23ee37b9e18cd1) Thanks [@brian-lou](https://github.com/brian-lou)! - Release Locadex (Beta) version

## 1.2.23

### Patch Changes

- [#336](https://github.com/generaltranslation/gt/pull/336) [`d22c287`](https://github.com/generaltranslation/gt/commit/d22c2871f1b474bc6cf981621a37400a92b4bbff) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix string translation fallback function tracing when translating

## 1.2.22

### Patch Changes

- [#316](https://github.com/generaltranslation/gt/pull/316) [`274a88e`](https://github.com/generaltranslation/gt/commit/274a88e2ac2e4d60360bf950f56c4ee2850804fe) Thanks [@michellee-wang](https://github.com/michellee-wang)! - updated localeselector

- Updated dependencies [[`274a88e`](https://github.com/generaltranslation/gt/commit/274a88e2ac2e4d60360bf950f56c4ee2850804fe)]:
  - generaltranslation@6.2.10

## 1.2.21

### Patch Changes

- [#324](https://github.com/generaltranslation/gt/pull/324) [`34a8c97`](https://github.com/generaltranslation/gt/commit/34a8c97a9d4c9efb3b441eecf0f7ea77ccc1ad7a) Thanks [@brian-lou](https://github.com/brian-lou)! - Add support for passing useGT and getGT function callback into other functions

## 1.2.20

### Patch Changes

- [#318](https://github.com/generaltranslation/gt/pull/318) [`5e6fabd`](https://github.com/generaltranslation/gt/commit/5e6fabdecd692ea26b1e709cc9a3dc5d22387410) Thanks [@brian-lou](https://github.com/brian-lou)! - Fix wrapping behavior for JSX fragments

## 1.2.19

### Patch Changes

- [#311](https://github.com/generaltranslation/gt/pull/311) [`d2bb9f5`](https://github.com/generaltranslation/gt/commit/d2bb9f5caa5b7366af3d3f8110a9f1586c9f58e7) Thanks [@michellee-wang](https://github.com/michellee-wang)! - added qbr and emojis + bumped verison

- Updated dependencies [[`d2bb9f5`](https://github.com/generaltranslation/gt/commit/d2bb9f5caa5b7366af3d3f8110a9f1586c9f58e7)]:
  - generaltranslation@6.2.9

## 1.2.18

### Patch Changes

- [#305](https://github.com/generaltranslation/gt/pull/305) [`5991569`](https://github.com/generaltranslation/gt/commit/59915699154fa0b442c4460c7c8d586fdc8020f9) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Bump downstream

- Updated dependencies [[`5991569`](https://github.com/generaltranslation/gt/commit/59915699154fa0b442c4460c7c8d586fdc8020f9)]:
  - generaltranslation@6.2.8

## 1.2.17

### Patch Changes

- [#302](https://github.com/generaltranslation/gt/pull/302) [`1b4a90c`](https://github.com/generaltranslation/gt/commit/1b4a90c60c1d8c974de3f098f95a20e88a55edb7) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - bump version

## 1.2.15

### Patch Changes

- [#289](https://github.com/generaltranslation/gt/pull/289) [`0a5f385`](https://github.com/generaltranslation/gt/commit/0a5f38560a2ef175b5f01e6e9e75538be3962f0a) Thanks [@brian-lou](https://github.com/brian-lou)! - Test Changesets
