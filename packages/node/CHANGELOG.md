# gt-node

## 1.0.8

### Patch Changes

- [#1923](https://github.com/generaltranslation/gt/pull/1923) [`1ae3e65`](https://github.com/generaltranslation/gt/commit/1ae3e657f6e72f6fffa9bd5118c4c6aab2439846) Thanks [@JoshKappler](https://github.com/JoshKappler)! - `initializeGT()` now reads `GT_PROJECT_ID`, `GT_API_KEY`, and `GT_DEV_API_KEY` from the environment as a fallback when they are not passed explicitly, matching the gt-node quickstart which sets these in `.env`. Explicit params still take precedence.

## 1.0.7

### Patch Changes

- [#1916](https://github.com/generaltranslation/gt/pull/1916) [`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Unify `gt.config.json` types so complete config objects can be spread into compiler plugins and runtime initializers while file settings remain optional.

- Updated dependencies [[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:
  - generaltranslation@9.0.3
  - gt-i18n@1.0.7

## 1.0.6

### Patch Changes

- Updated dependencies [[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584), [`8836fbd`](https://github.com/generaltranslation/gt/commit/8836fbda088b5192b2eaa8e2109a724256458bc2), [`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57), [`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:
  - generaltranslation@9.0.2
  - gt-i18n@1.0.6

## 1.0.5

### Patch Changes

- Updated dependencies [[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:
  - generaltranslation@9.0.1
  - gt-i18n@1.0.5

## 1.0.4

### Patch Changes

- Updated dependencies [[`b742df9`](https://github.com/generaltranslation/gt/commit/b742df9f0684c6ea12da140c4fd73eebb42f897a), [`a148737`](https://github.com/generaltranslation/gt/commit/a1487377728b662dfd749ecfbd449a1e8d47db49)]:
  - gt-i18n@1.0.4

## 1.0.3

### Patch Changes

- Updated dependencies [[`6345dc5`](https://github.com/generaltranslation/gt/commit/6345dc5e3fe0a1e3ead9a3c30a0adaa4037d50a8)]:
  - gt-i18n@1.0.3

## 1.0.2

### Patch Changes

- [#1846](https://github.com/generaltranslation/gt/pull/1846) [`7fb4a74`](https://github.com/generaltranslation/gt/commit/7fb4a74c52065694a40deafcf4596acc09e17f58) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add `parseLocale(request)` to resolve server-rendered React locales from the configured cookie, the `Accept-Language` header, or the default locale.

  Share cookie and `Accept-Language` parsing across the framework packages.

- Updated dependencies [[`006e071`](https://github.com/generaltranslation/gt/commit/006e071bf87ffe80f2d18958ddfa8f18cc2d85d2), [`7fb4a74`](https://github.com/generaltranslation/gt/commit/7fb4a74c52065694a40deafcf4596acc09e17f58), [`1f33d5f`](https://github.com/generaltranslation/gt/commit/1f33d5f76ffc879d2d21aa2508e07e1d3b66c4e3)]:
  - gt-i18n@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies []:
  - gt-i18n@1.0.1

## 1.0.0

### Major Changes

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`e12fb17`](https://github.com/generaltranslation/gt/commit/e12fb17d41cfa5fa231e64fe70423434739ea985) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Prepare Odysseus major releases for core runtime packages.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`8a2f7ee`](https://github.com/generaltranslation/gt/commit/8a2f7ee79f4b890fb1aaf47f42bb844334899793) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Simplify translation option types. Replace deprecated inline and dictionary option aliases with `GTTranslationOptions`, use interpolation variables for dictionary `t()` options, and trim higher-level type exports to avoid exposing internal translation option fields.

### Patch Changes

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`693288d`](https://github.com/generaltranslation/gt/commit/693288d632c42b923920a2fdd9ae2babc1bc28f5) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove internal source barrel exports and update imports to reference defining files directly.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`195f009`](https://github.com/generaltranslation/gt/commit/195f00910c2a675a6f9da327e19e3d3c5e44e26b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: make singleton not-initialized errors consistent and descriptive, and stop error paths from masking the original failure when I18nConfig is also uninitialized

- Updated dependencies [[`463a8db`](https://github.com/generaltranslation/gt/commit/463a8dbb03bde35f2f229dfdabfe117197d4527b), [`8870496`](https://github.com/generaltranslation/gt/commit/88704963eb74e81401994681ce7cdae3ba91b6c0), [`b72c30b`](https://github.com/generaltranslation/gt/commit/b72c30bc603562310a51b656fb003f1486315a8a), [`72e9e16`](https://github.com/generaltranslation/gt/commit/72e9e1643797be8e4ae1453897fd0b023fce2674), [`42a440f`](https://github.com/generaltranslation/gt/commit/42a440ff3420bdbdb35ed24f9a5af1c9040eaf66), [`fd22c68`](https://github.com/generaltranslation/gt/commit/fd22c68978af50ce519dc06c7b887d3fa67181ae), [`bea8233`](https://github.com/generaltranslation/gt/commit/bea8233d8b055980483cb2e226157f6adcbd8c2b), [`8870496`](https://github.com/generaltranslation/gt/commit/88704963eb74e81401994681ce7cdae3ba91b6c0), [`04b5064`](https://github.com/generaltranslation/gt/commit/04b50645675abb9e927a82056b249b50f0907fcc), [`5adeede`](https://github.com/generaltranslation/gt/commit/5adeede157922d547a33a078d0f527f572c9a8b4), [`328795b`](https://github.com/generaltranslation/gt/commit/328795bf730296658a57b7132bbd1e0bbff2fd62), [`1f53e42`](https://github.com/generaltranslation/gt/commit/1f53e420e9a6475f85cf27e1cd0c9c89f4beeb36), [`b3bb391`](https://github.com/generaltranslation/gt/commit/b3bb391d33041680e2d62b6a7c9b05662946544f), [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546), [`e12fb17`](https://github.com/generaltranslation/gt/commit/e12fb17d41cfa5fa231e64fe70423434739ea985), [`5752fe8`](https://github.com/generaltranslation/gt/commit/5752fe81bf5b5deaae878638e0de99959bf719be), [`3d95277`](https://github.com/generaltranslation/gt/commit/3d95277a057b28fffc73b3fa616210bdcb447e85), [`97dc7f4`](https://github.com/generaltranslation/gt/commit/97dc7f4818476a319a54b1519e994a62d5a9a3a5), [`c1e0a0f`](https://github.com/generaltranslation/gt/commit/c1e0a0f837da440eeed84af10b553dee24bfc936), [`693288d`](https://github.com/generaltranslation/gt/commit/693288d632c42b923920a2fdd9ae2babc1bc28f5), [`8a2f7ee`](https://github.com/generaltranslation/gt/commit/8a2f7ee79f4b890fb1aaf47f42bb844334899793), [`c5364f9`](https://github.com/generaltranslation/gt/commit/c5364f977ffb4b387ad39206e6ed626bbeec56f3), [`2e85ebd`](https://github.com/generaltranslation/gt/commit/2e85ebd1528a4f99a8e36e1d8d6714a639040596), [`d5cf2d3`](https://github.com/generaltranslation/gt/commit/d5cf2d34f412ad49e8b2818fe788b870a5964d65), [`4986567`](https://github.com/generaltranslation/gt/commit/498656728741898a56ae348a536107bd92f95c04), [`795edc8`](https://github.com/generaltranslation/gt/commit/795edc8a2b3e91fc9801d726f4b5cd6fbbc98fb0), [`d863bcf`](https://github.com/generaltranslation/gt/commit/d863bcf05770c336c98b2b2fae8534c90f00df51), [`11ecf87`](https://github.com/generaltranslation/gt/commit/11ecf876a1221b9dbce9fc0c0f0804101558c8a7), [`03bae6d`](https://github.com/generaltranslation/gt/commit/03bae6d3b4791107781cb800c1ae7ac4f675705c), [`5d42608`](https://github.com/generaltranslation/gt/commit/5d426089f04f37dd7369620e9db3e6512f06eee8), [`9804aa4`](https://github.com/generaltranslation/gt/commit/9804aa460c07ec36d2e667d79a839720a1e011e8), [`2ca78ec`](https://github.com/generaltranslation/gt/commit/2ca78ec4805639c10c7b200c8dee660b55eddf15), [`195f009`](https://github.com/generaltranslation/gt/commit/195f00910c2a675a6f9da327e19e3d3c5e44e26b)]:
  - gt-i18n@1.0.0
  - generaltranslation@9.0.0

## 1.0.0-odysseus.9

### Patch Changes

- Updated dependencies [463a8db]
- Updated dependencies [b72c30b]
- Updated dependencies [bea8233]
- Updated dependencies [1f53e42]
- Updated dependencies [d5cf2d3]
  - gt-i18n@1.0.0-odysseus.9
  - generaltranslation@9.0.0-odysseus.6

## 1.0.0-odysseus.8

### Patch Changes

- 195f009: fix: make singleton not-initialized errors consistent and descriptive, and stop error paths from masking the original failure when I18nConfig is also uninitialized
- Updated dependencies [72e9e16]
- Updated dependencies [42a440f]
- Updated dependencies [5adeede]
- Updated dependencies [c5364f9]
- Updated dependencies [2e85ebd]
- Updated dependencies [195f009]
  - generaltranslation@9.0.0-odysseus.5
  - gt-i18n@1.0.0-odysseus.8

## 1.0.0-odysseus.7

### Patch Changes

- Updated dependencies [ab61565]
- Updated dependencies [0cd7813]
  - gt-i18n@1.0.0-odysseus.7

## 1.0.0-odysseus.6

### Patch Changes

- Updated dependencies [a2b9677]
- Updated dependencies [41371e0]
  - gt-i18n@1.0.0-odysseus.6

## 1.0.0-odysseus.5

### Patch Changes

- Updated dependencies [432fa49]
- Updated dependencies [432fa49]
- Updated dependencies [933916e]
- Updated dependencies [4a5f8e8]
- Updated dependencies [083d306]
  - gt-i18n@1.0.0-odysseus.5

## 1.0.0-odysseus.4

### Patch Changes

- Updated dependencies [26faa87]
- Updated dependencies [270b821]
- Updated dependencies [bffaa67]
- Updated dependencies [d602065]
  - generaltranslation@9.0.0-odysseus.4
  - gt-i18n@1.0.0-odysseus.4

## 1.0.0-odysseus.3

### Patch Changes

- Updated dependencies [b1eef00]
- Updated dependencies [b765174]
  - generaltranslation@9.0.0-odysseus.3
  - gt-i18n@1.0.0-odysseus.3

## 1.0.0-odysseus.2

### Major Changes

- [#1690](https://github.com/generaltranslation/gt/pull/1690) [`b3c3b9a`](https://github.com/generaltranslation/gt/commit/b3c3b9af39f1b2abec2c2b6bf2c2a40fe76db5ce) Thanks [@bgub](https://github.com/bgub)! - Simplify translation option types. Replace deprecated inline and dictionary option aliases with `GTTranslationOptions`, use interpolation variables for dictionary `t()` options, and trim higher-level type exports to avoid exposing internal translation option fields.

### Patch Changes

- Updated dependencies [[`4b97bc3`](https://github.com/generaltranslation/gt/commit/4b97bc360b2869bbb6e5f214589ef84f6d58a660), [`020c6bd`](https://github.com/generaltranslation/gt/commit/020c6bdd8c604bc07d80d75e8ea2ace1e70d7447), [`41c938c`](https://github.com/generaltranslation/gt/commit/41c938c0d00f4b76faa7a2805ad0015891e0740e), [`b3c3b9a`](https://github.com/generaltranslation/gt/commit/b3c3b9af39f1b2abec2c2b6bf2c2a40fe76db5ce)]:
  - generaltranslation@9.0.0-odysseus.2
  - gt-i18n@1.0.0-odysseus.2

## 1.0.0-odysseus.1

### Patch Changes

- [#1677](https://github.com/generaltranslation/gt/pull/1677) [`87d6320`](https://github.com/generaltranslation/gt/commit/87d6320d271a1bf455f4e283dc1bb23893c7ba64) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Remove internal source barrel exports and update imports to reference defining files directly.

- Updated dependencies [[`87d6320`](https://github.com/generaltranslation/gt/commit/87d6320d271a1bf455f4e283dc1bb23893c7ba64)]:
  - generaltranslation@9.0.0-odysseus.1
  - gt-i18n@1.0.0-odysseus.1

## 1.0.0-odysseus.0

### Major Changes

- [#1627](https://github.com/generaltranslation/gt/pull/1627) [`bd0d788`](https://github.com/generaltranslation/gt/commit/bd0d7883601a183a31b47b36ea4ea2dca69c62d0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Prepare Odysseus major releases for core runtime packages.

### Patch Changes

- [#1508](https://github.com/generaltranslation/gt/pull/1508) [`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- Updated dependencies [[`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575), [`bd0d788`](https://github.com/generaltranslation/gt/commit/bd0d7883601a183a31b47b36ea4ea2dca69c62d0)]:
  - generaltranslation@9.0.0-odysseus.0
  - gt-i18n@1.0.0-odysseus.0

## 0.7.8

### Patch Changes

- Updated dependencies []:
  - gt-i18n@0.9.8

## 0.7.7

### Patch Changes

- Updated dependencies [[`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8)]:
  - generaltranslation@8.2.18
  - gt-i18n@0.9.7

## 0.7.6

### Patch Changes

- Updated dependencies [[`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01)]:
  - generaltranslation@8.2.17
  - gt-i18n@0.9.6

## 0.7.5

### Patch Changes

- Updated dependencies [[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:
  - generaltranslation@8.2.16
  - gt-i18n@0.9.5

## 0.7.4

### Patch Changes

- Updated dependencies []:
  - gt-i18n@0.9.4

## 0.7.9

### Patch Changes

- Updated dependencies [[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:
  - generaltranslation@8.2.19
  - gt-i18n@0.9.9

## 0.7.8

### Patch Changes

- Updated dependencies []:
  - gt-i18n@0.9.8

## 0.7.7

### Patch Changes

- Updated dependencies [[`9709a2f`](https://github.com/generaltranslation/gt/commit/9709a2f2b97b9d8239298e39bb31e57692bbffd8)]:
  - generaltranslation@8.2.18
  - gt-i18n@0.9.7

## 0.7.6

### Patch Changes

- Updated dependencies [[`3197028`](https://github.com/generaltranslation/gt/commit/319702855a7b129f95217d41be9f2402680a2f01)]:
  - generaltranslation@8.2.17
  - gt-i18n@0.9.6

## 0.7.5

### Patch Changes

- Updated dependencies [[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:
  - generaltranslation@8.2.16
  - gt-i18n@0.9.5

## 0.7.4

### Patch Changes

- Updated dependencies []:
  - gt-i18n@0.9.4

## 0.7.3

### Patch Changes

- Updated dependencies [[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa), [`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:
  - generaltranslation@8.2.15
  - gt-i18n@0.9.3

## 0.7.2

### Patch Changes

- Updated dependencies [[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99), [`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6), [`8650ae9`](https://github.com/generaltranslation/gt/commit/8650ae9ced69755bf3eebc1bafdf7743ba0c5136)]:
  - generaltranslation@8.2.14
  - gt-i18n@0.9.2

## 0.7.1

### Patch Changes

- Updated dependencies [[`4d77edf`](https://github.com/generaltranslation/gt/commit/4d77edf7cb2bca5c20911c20c58f702803c9acc9), [`feffb35`](https://github.com/generaltranslation/gt/commit/feffb35f75b3deee12e29878792461b8d32fad3e), [`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7), [`86263b3`](https://github.com/generaltranslation/gt/commit/86263b3aa8f2d283200515d609d69f570b97a84f), [`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:
  - gt-i18n@0.9.1
  - generaltranslation@8.2.13

## 0.7.0

### Minor Changes

- [#1359](https://github.com/generaltranslation/gt/pull/1359) [`528bb4a`](https://github.com/generaltranslation/gt/commit/528bb4a34b3eeab6f676137ab0f09e85dff213b0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Enable dictionary-backed getTranslations with t and t.obj, and expose it from gt-node.

### Patch Changes

- Updated dependencies [[`663af94`](https://github.com/generaltranslation/gt/commit/663af94207bc244de30046d96130e913f48c9add), [`a88c86d`](https://github.com/generaltranslation/gt/commit/a88c86df7842299063f1a2f6f7404e021c905016), [`0f252ff`](https://github.com/generaltranslation/gt/commit/0f252fff408c701811cba61565beaf15bf9cdd95), [`ee3a6ee`](https://github.com/generaltranslation/gt/commit/ee3a6eea113fbc5c2f5f0e8771d878a305f7bc7f), [`375d75f`](https://github.com/generaltranslation/gt/commit/375d75f7a6525d83e19a5cf015a375a0f50537d2), [`528bb4a`](https://github.com/generaltranslation/gt/commit/528bb4a34b3eeab6f676137ab0f09e85dff213b0), [`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0), [`e123485`](https://github.com/generaltranslation/gt/commit/e12348563700ed886f64b2e00d7964355fb4558a), [`40e26b9`](https://github.com/generaltranslation/gt/commit/40e26b914295101d1be00f738fc33eb4ba9c495a)]:
  - gt-i18n@0.9.0
  - generaltranslation@8.2.12

## 0.6.14

### Patch Changes

- Updated dependencies [[`cb2e106`](https://github.com/generaltranslation/gt/commit/cb2e1066f975dce8e90b166c51f763a3778c3861), [`b907d87`](https://github.com/generaltranslation/gt/commit/b907d8799670e9e22355b5664da4c9f6f323b8f4), [`bf0386b`](https://github.com/generaltranslation/gt/commit/bf0386b38b8a9342619eb2f8b4e5f043dcba4d8f)]:
  - gt-i18n@0.8.14

## 0.6.13

### Patch Changes

- Updated dependencies [[`c7f8dbe`](https://github.com/generaltranslation/gt/commit/c7f8dbe7841b772358e4e0391fd7782e223cbec8), [`3af2461`](https://github.com/generaltranslation/gt/commit/3af2461b5456a87883431561712615fdb4f8c89e), [`6f56c52`](https://github.com/generaltranslation/gt/commit/6f56c52d2d6687b614b3eee7226f886c8eac9a96), [`a5b18eb`](https://github.com/generaltranslation/gt/commit/a5b18eb39f6f74e77df78b58f11f065cc7dbdbda), [`4976fc6`](https://github.com/generaltranslation/gt/commit/4976fc682c84fa95b7deace431b2235ca1fccf24)]:
  - gt-i18n@0.8.13

## 0.6.12

### Patch Changes

- Updated dependencies [[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:
  - generaltranslation@8.2.11
  - gt-i18n@0.8.12

## 0.6.11

### Patch Changes

- [#1296](https://github.com/generaltranslation/gt/pull/1296) [`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401) Thanks [@bgub](https://github.com/bgub)! - Require explicit locales for I18nManager translation/cache operations, move current-locale lookup into higher-level helpers, and keep runtime condition storage in wrapper runtimes.

- Updated dependencies [[`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401)]:
  - gt-i18n@0.8.11

## 0.6.10

### Patch Changes

- Updated dependencies [[`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2)]:
  - gt-i18n@0.8.10

## 0.6.9

### Patch Changes

- Updated dependencies [[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:
  - generaltranslation@8.2.10
  - gt-i18n@0.8.9

## 0.6.8

### Patch Changes

- Updated dependencies [[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:
  - generaltranslation@8.2.9
  - gt-i18n@0.8.8

## 0.6.7

### Patch Changes

- Updated dependencies [[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:
  - generaltranslation@8.2.8
  - gt-i18n@0.8.7

## 0.6.6

### Patch Changes

- Updated dependencies [[`5af18c1`](https://github.com/generaltranslation/gt/commit/5af18c13c2c2ad341ec67c2b4f6f6ef29320123b)]:
  - gt-i18n@0.8.6

## 0.6.5

### Patch Changes

- [#1251](https://github.com/generaltranslation/gt/pull/1251) [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7) Thanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each package's `package.json` to enable tree-shaking in consumer bundlers (webpack, esbuild, Rollup). Packages with no module-scope side effects are marked `"sideEffects": false`. Packages with intentional side-effect entry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server entries, `gt-react-native` TurboModule spec) list those files explicitly so they are preserved.

- [#1249](https://github.com/generaltranslation/gt/pull/1249) [`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569) Thanks [@bgub](https://github.com/bgub)! - chore: migrate build from Rollup to tsdown

- Updated dependencies [[`47ad56b`](https://github.com/generaltranslation/gt/commit/47ad56bb23a70382ba98a900d968e9a48beee2b8), [`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5), [`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7), [`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)]:
  - gt-i18n@0.8.5
  - generaltranslation@8.2.7

## 0.6.4

### Patch Changes

- Updated dependencies [[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:
  - generaltranslation@8.2.6
  - gt-i18n@0.8.4

## 0.6.3

### Patch Changes

- [#1225](https://github.com/generaltranslation/gt/pull/1225) [`f769750`](https://github.com/generaltranslation/gt/commit/f769750d813293c5978ad975f7cc338f836e0aa6) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: utility function for extracting a request locale

## 0.6.2

### Patch Changes

- Updated dependencies [[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:
  - generaltranslation@8.2.5
  - gt-i18n@0.8.3

## 0.6.1

### Patch Changes

- Updated dependencies [[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:
  - generaltranslation@8.2.4
  - gt-i18n@0.8.2

## 0.6.0

### Minor Changes

- [#1207](https://github.com/generaltranslation/gt/pull/1207) [`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: runtime translation

### Patch Changes

- Updated dependencies [[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:
  - generaltranslation@8.2.3
  - gt-i18n@0.8.1

## 0.5.0

### Minor Changes

- [#1173](https://github.com/generaltranslation/gt/pull/1173) [`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context derivation

### Patch Changes

- Updated dependencies [[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)]:
  - gt-i18n@0.8.0

## 0.4.10

### Patch Changes

- [#1158](https://github.com/generaltranslation/gt/pull/1158) [`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto injection for jsx translation

- Updated dependencies [[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:
  - generaltranslation@8.2.2
  - gt-i18n@0.7.10

## 0.4.9

### Patch Changes

- [#1161](https://github.com/generaltranslation/gt/pull/1161) [`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update logo blocks in READMEs

- Updated dependencies [[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:
  - gt-i18n@0.7.9
  - generaltranslation@8.2.1

## 0.4.8

### Patch Changes

- Updated dependencies [[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290), [`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:
  - generaltranslation@8.2.0
  - gt-i18n@0.7.8

## 0.4.7

### Patch Changes

- Updated dependencies [[`10a0f2e`](https://github.com/generaltranslation/gt/commit/10a0f2ef28003c2767129ba8ba88a61f8d6c3f04)]:
  - gt-i18n@0.7.7

## 0.4.6

### Patch Changes

- Updated dependencies [[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:
  - generaltranslation@8.1.23
  - gt-i18n@0.7.6

## 0.4.5

### Patch Changes

- Updated dependencies [[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:
  - generaltranslation@8.1.22
  - gt-i18n@0.7.5

## 0.4.4

### Patch Changes

- Updated dependencies [[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e), [`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:
  - generaltranslation@8.1.21
  - gt-i18n@0.7.4

## 0.4.3

### Patch Changes

- Updated dependencies []:
  - gt-i18n@0.7.3

## 0.4.2

### Patch Changes

- Updated dependencies [[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:
  - generaltranslation@8.1.20
  - gt-i18n@0.7.2

## 0.4.1

### Patch Changes

- [#1129](https://github.com/generaltranslation/gt/pull/1129) [`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: derivation support for the t macro

- Updated dependencies [[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:
  - generaltranslation@8.1.19
  - gt-i18n@0.7.1

## 0.4.0

### Minor Changes

- [#1121](https://github.com/generaltranslation/gt/pull/1121) [`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5) Thanks [@pie575](https://github.com/pie575)! - Added a versionId hook for users to better access what Version their GT translations are on

### Patch Changes

- Updated dependencies [[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5), [`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:
  - gt-i18n@0.7.0
  - generaltranslation@8.1.18

## 0.3.5

### Patch Changes

- Updated dependencies [[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)]:
  - gt-i18n@0.6.2

## 0.3.4

### Patch Changes

- [#1062](https://github.com/generaltranslation/gt/pull/1062) [`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: rename static to derive, and deprecate static

- Updated dependencies [[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:
  - generaltranslation@8.1.17
  - gt-i18n@0.6.1

## 0.3.3

### Patch Changes

- Updated dependencies [[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)]:
  - gt-i18n@0.6.0

## 0.3.2

### Patch Changes

- Updated dependencies [[`e364093`](https://github.com/generaltranslation/gt/commit/e3640931cf0ca2df08dcadbae30b1668e14a3ed8)]:
  - generaltranslation@8.1.16
  - gt-i18n@0.5.2

## 0.3.1

### Patch Changes

- Updated dependencies [[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:
  - generaltranslation@8.1.15
  - gt-i18n@0.5.1

## 0.3.0

### Minor Changes

- [#1090](https://github.com/generaltranslation/gt/pull/1090) [`7846d06`](https://github.com/generaltranslation/gt/commit/7846d0672ba357081793706fdf55313b4f5428e0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add locale utilities

### Patch Changes

- Updated dependencies [[`7846d06`](https://github.com/generaltranslation/gt/commit/7846d0672ba357081793706fdf55313b4f5428e0)]:
  - gt-i18n@0.5.0

## 0.2.8

### Patch Changes

- Updated dependencies [[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)]:
  - generaltranslation@8.1.14
  - gt-i18n@0.4.2

## 0.2.7

### Patch Changes

- Updated dependencies [[`21b3304`](https://github.com/generaltranslation/gt/commit/21b33040774f9638fdf7edcfcf7170246a36fbec)]:
  - generaltranslation@8.1.13
  - gt-i18n@0.4.1

## 0.2.6

### Patch Changes

- Updated dependencies [[`065cfaf`](https://github.com/generaltranslation/gt/commit/065cfaf4e6ac220755a9667b58731520d64fef85), [`d36d4b8`](https://github.com/generaltranslation/gt/commit/d36d4b8459626c552c143fbdfa6d01f647a66533)]:
  - gt-i18n@0.4.0

## 0.2.5

### Patch Changes

- Updated dependencies [[`47918b7`](https://github.com/generaltranslation/gt/commit/47918b7a4c38967fe2148d972f0a3c740e0bc25d)]:
  - generaltranslation@8.1.12
  - gt-i18n@0.3.12

## 0.2.4

### Patch Changes

- Updated dependencies [[`7cd02ba`](https://github.com/generaltranslation/gt/commit/7cd02ba200c8645de01527a88f7cf32346e67d12)]:
  - generaltranslation@8.1.11
  - gt-i18n@0.3.11

## 0.2.3

### Patch Changes

- Updated dependencies []:
  - gt-i18n@0.3.10

## 0.2.2

### Patch Changes

- Updated dependencies []:
  - gt-i18n@0.3.9

## 0.2.1

### Patch Changes

- Updated dependencies [[`9e99e94`](https://github.com/generaltranslation/gt/commit/9e99e945cbf9e31990930e3428468f64d7240da5), [`c66bbe1`](https://github.com/generaltranslation/gt/commit/c66bbe125f3fbba7a97604d3c2ca6b7d7a065f31)]:
  - generaltranslation@8.1.10
  - gt-i18n@0.3.8

## 0.2.0

### Minor Changes

- [#1008](https://github.com/generaltranslation/gt/pull/1008) [`7c0a319`](https://github.com/generaltranslation/gt/commit/7c0a31917215bd77528f9e8f01c29a113f8f25c6) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: gt-node translation interface

### Patch Changes

- Updated dependencies [[`7c0a319`](https://github.com/generaltranslation/gt/commit/7c0a31917215bd77528f9e8f01c29a113f8f25c6)]:
  - gt-i18n@0.3.7

## 0.1.0

### Minor Changes

- [#991](https://github.com/generaltranslation/gt/pull/991) [`8b65862`](https://github.com/generaltranslation/gt/commit/8b65862c33ecb62fa0d9b80ec3fba55dbfe04719) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: support for node environments

### Patch Changes

- Updated dependencies [[`4a66903`](https://github.com/generaltranslation/gt/commit/4a669031f74a0b20783709752ab7fc0ab40869df), [`8b65862`](https://github.com/generaltranslation/gt/commit/8b65862c33ecb62fa0d9b80ec3fba55dbfe04719)]:
  - generaltranslation@8.1.9
  - gt-i18n@0.3.6

## 0.0.2

### Patch Changes

- Updated dependencies [[`fca3a25`](https://github.com/generaltranslation/gt/commit/fca3a2583eb7f21bc3ef13516351d479f7bef882)]:
  - generaltranslation@8.1.8
  - gt-i18n@0.3.5

## 0.0.1

### Patch Changes

- [#979](https://github.com/generaltranslation/gt/pull/979) [`3e50918`](https://github.com/generaltranslation/gt/commit/3e509184eb52f5886ebac9cd17e62503277986fd) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: setup package boilerplate
