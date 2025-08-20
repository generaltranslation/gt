# generaltranslation

## 7.4.0

### Minor Changes

- [#536](https://github.com/generaltranslation/gt/pull/536) [`468b0b7`](https://github.com/generaltranslation/gt/commit/468b0b7c660fd1ab9e8c2611a26ade63ba268e80) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Added locale selection based on region
  Added compile time hashing
  Added es lint plugin for gt-next (in alpha)
  Fix CLI validation (used to error for {<JSX/>} inside <T>)

## 7.3.0

### Minor Changes

- [#556](https://github.com/generaltranslation/gt/pull/556) [`c52d896`](https://github.com/generaltranslation/gt/commit/c52d896f83fb4f6e58921286320a524885c8a52d) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding modelProvider field to gt.config

## 7.2.0

### Minor Changes

- [#547](https://github.com/generaltranslation/gt/pull/547) [`4806575`](https://github.com/generaltranslation/gt/commit/4806575a7b01184ea35a55fb07fe241144205e4a) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Added locale selection based on region

## 7.1.6

### Patch Changes

- [#544](https://github.com/generaltranslation/gt/pull/544) [`ca7d1ac`](https://github.com/generaltranslation/gt/commit/ca7d1ac0d424f9804031020e3a36bae27bdcc049) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - corrected nameWithRegionCode and nativeNameWithRegion code

## 7.1.5

### Patch Changes

- [#531](https://github.com/generaltranslation/gt/pull/531) [`46fb40d`](https://github.com/generaltranslation/gt/commit/46fb40d5e76898c7cbf7dc02d7b62de5ad64a95f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: deprecate \_translate for translate in core

## 7.1.4

### Patch Changes

- [#495](https://github.com/generaltranslation/gt/pull/495) [`a7eca74`](https://github.com/generaltranslation/gt/commit/a7eca74677356b392c7c1a431f664c8e28adbf0c) Thanks [@brian-lou](https://github.com/brian-lou)! - Add support for translating arbitrary JSON files (all strings). Add support for partially translating JSON files via jsonSchema config setting. Add support for composite JSON files (where there is a single JSON containing data for all translated languages). Add support for preset jsonSchemas.

## 7.1.3

### Patch Changes

- [#493](https://github.com/generaltranslation/gt/pull/493) [`b922f0f`](https://github.com/generaltranslation/gt/commit/b922f0f955e616d53d0964b420191a0f8c07a343) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: backwards compatability

## 7.1.2

### Patch Changes

- [#490](https://github.com/generaltranslation/gt/pull/490) [`03b3367`](https://github.com/generaltranslation/gt/commit/03b3367e98b155a21a723f0a645999f3efb40d18) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: add internal header when necessary

## 7.1.1

### Patch Changes

- [#487](https://github.com/generaltranslation/gt/pull/487) [`984cf09`](https://github.com/generaltranslation/gt/commit/984cf098fea9d42f5619e95b78ad289c32e3b4d2) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: metadata field

## 7.1.0

### Minor Changes

- [#444](https://github.com/generaltranslation/gt/pull/444) [`c206a11`](https://github.com/generaltranslation/gt/commit/c206a1158516a0d815b1570d77e6dd62acdcedc4) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add translation interface for generaltranslation

## 7.0.1

### Patch Changes

- [#440](https://github.com/generaltranslation/gt/pull/440) [`e6fdedf`](https://github.com/generaltranslation/gt/commit/e6fdedffcdfbac5d257ea35140cbb81de6aa2729) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fixes to breaking changes

## 7.0.0

### Major Changes

- [#436](https://github.com/generaltranslation/gt/pull/436) [`08377f3`](https://github.com/generaltranslation/gt/commit/08377f3b5b3b600efb1e232a7b9361e8c85ea4ae) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Breaking changes

## 6.3.2

### Patch Changes

- [#346](https://github.com/generaltranslation/gt/pull/346) [`28b78a6`](https://github.com/generaltranslation/gt/commit/28b78a62de117cc8e4370cab79280495de37f28f) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: switch to GT object

## 6.3.1

### Patch Changes

- [#340](https://github.com/generaltranslation/gt/pull/340) [`df5d5db`](https://github.com/generaltranslation/gt/commit/df5d5dbb25e2031891fc425e1e04f9022e935f00) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Exported LocaleProperties type in generaltranslation/types

## 6.3.0

### Minor Changes

- [#334](https://github.com/generaltranslation/gt/pull/334) [`f08ebb9`](https://github.com/generaltranslation/gt/commit/f08ebb92680c6158dd75ea1089924e74a8731774) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - Added custom mapping in the GT driver

### Patch Changes

- [#334](https://github.com/generaltranslation/gt/pull/334) [`f08ebb9`](https://github.com/generaltranslation/gt/commit/f08ebb92680c6158dd75ea1089924e74a8731774) Thanks [@archie-mckenzie](https://github.com/archie-mckenzie)! - fix error that was introduced during testing

## 6.2.10

### Patch Changes

- [#316](https://github.com/generaltranslation/gt/pull/316) [`274a88e`](https://github.com/generaltranslation/gt/commit/274a88e2ac2e4d60360bf950f56c4ee2850804fe) Thanks [@michellee-wang](https://github.com/michellee-wang)! - updated localeselector

## 6.2.9

### Patch Changes

- [#311](https://github.com/generaltranslation/gt/pull/311) [`d2bb9f5`](https://github.com/generaltranslation/gt/commit/d2bb9f5caa5b7366af3d3f8110a9f1586c9f58e7) Thanks [@michellee-wang](https://github.com/michellee-wang)! - added qbr and emojis + bumped verison

## 6.2.8

### Patch Changes

- [#305](https://github.com/generaltranslation/gt/pull/305) [`5991569`](https://github.com/generaltranslation/gt/commit/59915699154fa0b442c4460c7c8d586fdc8020f9) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Bump downstream

## 6.2.7

### Patch Changes

- [#300](https://github.com/generaltranslation/gt/pull/300) [`6d98de0`](https://github.com/generaltranslation/gt/commit/6d98de0b0b0b56e58bf69dac96380eac2f1122b1) Thanks [@brian-lou](https://github.com/brian-lou)! - Re-release core package

## 6.2.6

### Patch Changes

- [#296](https://github.com/generaltranslation/gt/pull/296) [`a558260`](https://github.com/generaltranslation/gt/commit/a55826006f69c0e9869f687c065de7ad1e2828a6) Thanks [@brian-lou](https://github.com/brian-lou)! - Test with new package.json

## 6.2.5

### Patch Changes

- [#294](https://github.com/generaltranslation/gt/pull/294) [`a3303d7`](https://github.com/generaltranslation/gt/commit/a3303d7a7ccfc39ddbdd7edd51a2689da1c6ded0) Thanks [@brian-lou](https://github.com/brian-lou)! - Modify core to support custom locales
