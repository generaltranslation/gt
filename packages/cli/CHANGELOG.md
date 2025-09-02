# gtx-cli

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
