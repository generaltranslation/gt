/**
 * Closed reasons why a React seed cannot participate in exact Vue parity yet.
 *
 * This list intentionally describes the primary framework boundary exercised
 * by each seed, never an alternate Vue source or hash. A large stress seed can
 * cross more than one boundary; every paired seed not listed here must still
 * match React exactly.
 */
export type NonPortableSeed = {
  id: string;
  /** React's exact runtime hash at this documented framework boundary. */
  reactHash: string;
  /** SHA-256 of React's complete canonical semantic wire. */
  reactWireFingerprint: string;
  /** Vue's exact runtime hash at this documented framework boundary. */
  vueHash: string;
  /** SHA-256 of Vue's complete canonical semantic wire. */
  vueWireFingerprint: string;
} & (
  | { reason: 'unsupported-derive' }
  | { reason: 'unsupported-named-variable' }
  | { reason: 'vue-display-string-erasure' }
  | { reason: 'vue-text-coalescing' }
);

/**
 * Exhaustive allowlist of presently non-portable React seeds.
 *
 * Keep this list narrow. Adding an entry removes a seed only from cross-runtime
 * React/Vue parity. The test harness still requires the Vue extractor to match
 * the Vue runtime for all 84 seeds. Each primary reason is evidenced against
 * its source fixture; implementing it should remove entries from this list and
 * increase the exact cross-runtime parity count.
 */
export const NON_PORTABLE_SEEDS = [
  {
    id: 'complex-cases/complex-fragment-nesting',
    reason: 'vue-text-coalescing',
    reactHash: 'c1185ce9694073a0',
    reactWireFingerprint:
      'e5699751ebe551d37ff42377149bdabe685ff1e7fca67347611afb95684d639e',
    vueHash: '0a2294911cc34255',
    vueWireFingerprint:
      '87057dbcafe663da768761f79ec6f45d96bae53404f33ba0d9bb2e82a48ba7c2',
  },
  {
    id: 'complex-cases/deeply-nested-branch-components',
    reason: 'vue-text-coalescing',
    reactHash: '7bf234f246fdd842',
    reactWireFingerprint:
      'dc453dd678a9c15ce81348d6cd6a552fa251b56bdf76a1b51a76f2915d41df8b',
    vueHash: '89b7399ed054927d',
    vueWireFingerprint:
      'fd8ac7007a489f399258bd0eb435327dcd8aae4bd70a07108fdfdf489404be63',
  },
  {
    id: 'complex-cases/duplicate-branches',
    reason: 'vue-text-coalescing',
    reactHash: '9f724296a7e15fda',
    reactWireFingerprint:
      '77e39b86735a51d6a943cc5f1f794ab8ddd77e29cf648c6dc6cb898398e968f2',
    vueHash: 'a8dc7b4e1bde5106',
    vueWireFingerprint:
      '90da46500e1cdfad56223ca4ac33a6b153a059a6271a23f2f5b9f0315dcdeacd',
  },
  {
    id: 'complex-cases/five-level-nesting',
    reason: 'unsupported-named-variable',
    reactHash: 'a26e6d6f63ba42ad',
    reactWireFingerprint:
      '5099ce4ab7ffdf9f590b07fb08f28bfa414abda9fdf4e00729b65c2a3e395579',
    vueHash: '9f713d07f015a6e7',
    vueWireFingerprint:
      'aadb14043b375b350f7095fcbb8fac27b900f39d58050d129ef5b45546880926',
  },
  {
    id: 'complex-cases/long-content-string',
    reason: 'vue-text-coalescing',
    reactHash: '4bafdc80a3a55418',
    reactWireFingerprint:
      'e9882a3443473e8bd7ccebab16bc8b8456f01a55e4e8b19306743dba09326779',
    vueHash: 'bc773800710c5e3e',
    vueWireFingerprint:
      '2958ac0aa66b84fc7403c4032fc16f8d5ef920b9119e077dbd95ec09571933c1',
  },
  {
    id: 'complex-cases/many-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: '1ab8805c4c3bbb55',
    reactWireFingerprint:
      '82146bd14a5f9e4d81bff76284d2b4652dc2943b3ae9294e228bdcf8946d1b03',
    vueHash: 'fd4cabf8d61eb35b',
    vueWireFingerprint:
      '47f37353babe147dbae4d145c12e205566ec87806b2f4d6098ff056b8301455d',
  },
  {
    id: 'complex-cases/mixed-component-types',
    reason: 'vue-text-coalescing',
    reactHash: '5241a113dbbb9210',
    reactWireFingerprint:
      'c8737a3310d5716f9e1d73e03930c09ab863afbf9336c236a2ea304f2b75d778',
    vueHash: 'c5ba829c5c1ac22a',
    vueWireFingerprint:
      'bcaad9c0d1d1c90ee5a2a390f1442a25522f9c436c9c9cafbde3e83248ac4342',
  },
  {
    id: 'complex-cases/mixed-element-types-in-branches',
    reason: 'vue-text-coalescing',
    reactHash: '08b3f0224d60b092',
    reactWireFingerprint:
      'c691ce2774620d24682dd7cd40513a7849c63d53fbc1e138445bd19d49165162',
    vueHash: 'b12e8d1d5345d038',
    vueWireFingerprint:
      '9e3531d846bb3ff960ae2b5fd38c3eced11fbec28a77c4ee97763f0e7842f8d0',
  },
  {
    id: 'complex-cases/more-extreme-edge-cases',
    reason: 'unsupported-named-variable',
    reactHash: '234daa03bbb9b0b7',
    reactWireFingerprint:
      'd546365d1c23b162a01c7fa3463285cd2fe6411f731660e91d75f4903d464e01',
    vueHash: '833b7cc8aef2e37d',
    vueWireFingerprint:
      '3fe949869c50e6bcfeb4fd11f9896316311bc9525dcce5a3b54ea340c236e371',
  },
  {
    id: 'complex-cases/multiple-variable-types-in-branch',
    reason: 'unsupported-named-variable',
    reactHash: '8ef95990b777846a',
    reactWireFingerprint:
      '1f0f11f920b6d31d3fde3034aca1506a6f3dca245a898e0807f9082296f4626a',
    vueHash: '8baa0240bf8e09b4',
    vueWireFingerprint:
      '585c2333b0734f860c455ca0b8a78219f24d447349be74f99212f091f61091e8',
  },
  {
    id: 'complex-cases/whitespace',
    reason: 'vue-display-string-erasure',
    reactHash: '0f71ab60dcb2e44e',
    reactWireFingerprint:
      'e5c5e4297f6f40fe4261ae2a7ad43651919afea743ab77b45ccb5d8624526d26',
    vueHash: '045d714300823f6f',
    vueWireFingerprint:
      '706ec1beaa617b885fad03b9f71c99234bcf34c309ea44cead81cc7b465eaa32',
  },
  {
    id: 'complex-cases/whitespace-preservation-complex-structure',
    reason: 'vue-text-coalescing',
    reactHash: '002cc9ab48b42309',
    reactWireFingerprint:
      '10afd24c9ca586bf5bdd51aabb8ef87173a6640670be1e82c8a23a0700bf525b',
    vueHash: 'ac61a95b7ebe287e',
    vueWireFingerprint:
      'f24b23ed065dddc5921fee819df6bd128fd67cfbd435670511cadbc8cf8b97c0',
  },
  {
    id: 't-component/simple/expressions/null/fragment-null',
    reason: 'vue-display-string-erasure',
    reactHash: 'a013c005483cdd19',
    reactWireFingerprint:
      '071c14c7253e4f2cfdb905ab57d1ac1ebe37ee6feecbf1bd7fbdae8311aa0cc0',
    vueHash: 'a013c005483cdd19',
    vueWireFingerprint:
      'e21816c878794165363221e4291698a9e9b1f04200fec555a6db9012a4a5d2ca',
  },
  {
    id: 't-component/simple/expressions/null/plain-null',
    reason: 'vue-display-string-erasure',
    reactHash: '471b9124c31817e9',
    reactWireFingerprint:
      '718510af2d06865175f266a92aa01cee14dd583238b449218698195d59f611a9',
    vueHash: '5a72d4120af78654',
    vueWireFingerprint:
      '59b723d56c59dbc0655db897fc9d2986cfceee0fb0738a70eb6593ce47aced3a',
  },
  {
    id: 't-component/simple/expressions/static-boolean/array',
    reason: 'vue-display-string-erasure',
    reactHash: '9ff224ca1118e4df',
    reactWireFingerprint:
      '64e49e0804deba86b921abb1ff001e867cc85404b1a07cef9d5ee5160731d1d4',
    vueHash: '1ae5ad3f1db215c1',
    vueWireFingerprint:
      '141b0fb70e0e2f83d598975f37163a1fc1e8ee5b87aff585bda5ba94f435f71d',
  },
  {
    id: 't-component/simple/expressions/static-boolean/false',
    reason: 'vue-display-string-erasure',
    reactHash: 'd98d8886a31c98f3',
    reactWireFingerprint:
      'f894a19150e48bb39b5daaccd413e94b9568fa09be2c7b6f795992faf859de24',
    vueHash: '87a04f81044aef74',
    vueWireFingerprint:
      '188f8451d7cba75e21432f4b9c151c5e801e11a54ba0ff0b11d8443be138e73c',
  },
  {
    id: 't-component/simple/expressions/static-boolean/fragment-false',
    reason: 'vue-display-string-erasure',
    reactHash: 'a013c005483cdd19',
    reactWireFingerprint:
      '071c14c7253e4f2cfdb905ab57d1ac1ebe37ee6feecbf1bd7fbdae8311aa0cc0',
    vueHash: '3572f24bad84aee9',
    vueWireFingerprint:
      '33e6af382a1382c9448469e031daf7b9cd84f9eb018b0e5f3600a0fe1a9f1524',
  },
  {
    id: 't-component/simple/expressions/static-boolean/fragment-true',
    reason: 'vue-display-string-erasure',
    reactHash: '200db4fbcabc7d06',
    reactWireFingerprint:
      '37421d0a8ad9b231489dbdd578eb25d0a2a385eb563ad30444839b15e83d5a9f',
    vueHash: '6d6d11f10ff17065',
    vueWireFingerprint:
      '6e19521ed2457c59508401f87dfb4d8dbe978b995171cd0b9ece75c31527521d',
  },
  {
    id: 't-component/simple/expressions/static-boolean/true',
    reason: 'vue-display-string-erasure',
    reactHash: '73b6b211a4122ba8',
    reactWireFingerprint:
      '8cd434f976b549e52d6e788d5b385f1a9b3e00063253ac10ea139ae0425d1baa',
    vueHash: '6d23edcaf7dc34aa',
    vueWireFingerprint:
      '76bf6c6a3cf717c766119b5dbc85aaaae92e76fb5fcb4d9b82b1807bfcb1900d',
  },
  {
    id: 't-component/simple/expressions/static-special-identifiers',
    reason: 'vue-display-string-erasure',
    reactHash: '4f82a98ad0b111d9',
    reactWireFingerprint:
      '252ab59c74a6b9f4b0c206874dcb96c37227c5ced7b202e3f11ed9d9256a49a2',
    vueHash: 'f758c211b552cd3e',
    vueWireFingerprint:
      '9a9319090df4cec6a6f1d526429b1ddf9b22829658b194d3a6388304dba1d78a',
  },
  {
    id: 'variable-components/static/branches',
    reason: 'unsupported-derive',
    reactHash: '151c5ea756354da4',
    reactWireFingerprint:
      '4719bbe59e4de1608be3fa4a3a7d8c01ae2f6f198a46fdb8f26c9a005776e51e',
    vueHash: 'fd88ed0e98e2d8ee',
    vueWireFingerprint:
      '4737ba27575cfa2ed3e4ab61c89a9a89ea64c82b19f5cb6c11eeb935f6304110',
  },
  {
    id: 'variable-components/static/simple',
    reason: 'unsupported-derive',
    reactHash: '4b9fdc8e2a028557',
    reactWireFingerprint:
      '406adffbcd6784a8701928fc7295fe8b71bfa69a5ca197b496a7effed5afbb18',
    vueHash: '7587d554b46e4dc0',
    vueWireFingerprint:
      'afbc2fb1f659c293b4082db6e36e53e1ec73de2229371416f6ffa9c927520afd',
  },
  {
    id: 'variable-components/static/ternaries',
    reason: 'unsupported-derive',
    reactHash: 'b504e6005f6d2aad',
    reactWireFingerprint:
      'c5c43e261d8d12668327a0c9605166e8d23d7eee613a7fcdd1a0fff1fa7aa8c7',
    vueHash: '28da75b7c45137da',
    vueWireFingerprint:
      'bae51dade912d0339dcbcc2512ec7ca96914af1eb7a349db1f726b0504efdc74',
  },
  {
    id: 'variable-components/var/simple/name',
    reason: 'unsupported-named-variable',
    reactHash: '5313ec64034eb6b2',
    reactWireFingerprint:
      '7c6a5b2059e3b9e476d34008f66f700f7c662f5db0b007a164cf62b63cef06d7',
    vueHash: '69ba8f868c3bcb1a',
    vueWireFingerprint:
      '4b23892ded85416fcef653778d3c683227da4fa5e876c2e50c2ad592560e8b9d',
  },
] as const satisfies readonly NonPortableSeed[];

/** Exact parity cannot regress below the first complete Vue seed port. */
export const MINIMUM_EXACT_SEED_COUNT = 60;
